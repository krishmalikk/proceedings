"""
moderation.py — user-generated-content safety (App Store Guideline 1.2).

Three responsibilities, all Firestore-backed (never the Vertex datastore, which
holds the anonymous posting corpus):

  1. **Content filtering on create** — `check_text()` runs a fast profanity/slur
     wordlist plus a best-effort Gemini safety classification and raises
     `ValueError` (mapped to HTTP 422 by the callers) so objectionable content is
     rejected before it is ever stored. Wired in next to the existing PII
     `scrub_pii` seam in posting.py / interactions.py / group_messages.py.

  2. **Reporting / flagging** — `report_content()` records a report, stamps the
     shared `content_meta/{id}` doc, auto-hides content once a distinct-reporter
     threshold is reached (posting → datastore takedown; reply/message →
     soft-delete), and emails the moderation inbox. Every report notifies the
     developer (Apple 1.2: "act on reports within 24 hours").

  3. **Blocking** — `block_user()` / `unblock_user()` / `blocked_uids()` let a
     user block an abusive author; the block list is used to filter that author's
     content out of feeds instantly (Apple 1.2: "remove it from the user's feed
     instantly"). Every block also notifies the developer.

New Firestore collections / fields:
    reports/{content_id}__{reporter_uid} = {content_id, content_type, container_id,
        author_uid, reporter_uid, reason, status, created_at}
    blocks/{blocker_uid}                  = {blocked_uids: [uid, ...], updated_at}
    content_meta/{id}                    += {reported: bool, report_count: int, hidden: bool}

`content_meta` is the same doc the vote tally already lives in (interactions.py),
so feed/reply readers that already load it get the `hidden` flag for free.
"""
from __future__ import annotations

import os
import re
from datetime import datetime, timezone

from google.cloud import firestore
from google.cloud.firestore_v1.base_query import FieldFilter

# Reports from this many DISTINCT users auto-hide content pending human review
# (Apple 1.2). One report already hides the item from the reporter's own feed
# (client-side); this is the server-side automatic takedown backstop.
AUTO_TAKEDOWN_REPORTS = int(os.getenv("MODERATION_AUTO_TAKEDOWN_REPORTS", "3"))

VALID_CONTENT_TYPES = {"posting", "reply", "message"}
VALID_REPORT_REASONS = {
    "harassment", "hate", "violence", "sexual", "spam",
    "self_harm", "illegal", "other",
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ===========================================================================
# 1. Content filtering (wordlist + Gemini safety)
# ===========================================================================

# Curated hard-block list: slurs + unambiguous sexual/violent terms. Kept
# deliberately short and high-precision — nuanced abuse is caught by the Gemini
# pass below; borderline profanity is left to the report flow rather than
# false-positive-blocking legitimate immigration discussion. Matched on word
# boundaries, case-insensitive, after light leet normalization.
_BLOCKLIST = {
    "nigger", "nigga", "faggot", "fag", "retard", "spic", "chink", "kike",
    "cunt", "wetback", "beaner", "tranny", "coon", "gook", "raghead",
    "kill yourself", "kys", "rape", "child porn", "cp",
}
_LEET = str.maketrans({"@": "a", "$": "s", "0": "o", "1": "i", "3": "e", "!": "i"})


def _normalize(text: str) -> str:
    return (text or "").lower().translate(_LEET)


def _wordlist_hit(text: str) -> str | None:
    """Return the first blocklist term found (as a whole word/phrase), else None."""
    norm = _normalize(text)
    for term in _BLOCKLIST:
        pattern = r"\b" + re.escape(term).replace(r"\ ", r"\s+") + r"\b"
        if re.search(pattern, norm):
            return term
    return None


# Reused, high-level Gemini categories → friendly rejection copy.
_SAFETY_PROMPT = (
    "You are a content-safety classifier for a supportive immigration community "
    "app. Decide if the following user text contains objectionable content that "
    "violates a zero-tolerance policy: harassment, hate speech or slurs, threats "
    "or incitement of violence, sexual content, or content encouraging self-harm. "
    "Frank discussion of immigration hardship, frustration with agencies, or "
    "personal struggle is NOT objectionable. Respond with a single compact JSON "
    'object: {"objectionable": true|false, "category": "<one word or empty>"}.\n\n'
    "USER TEXT:\n"
)


def _gemini_flag(text: str) -> str | None:
    """Best-effort Gemini classification. Returns a category string when the text
    is objectionable, None when it is clean OR the check could not run (fail-open:
    infra outages must not block legitimate posting — the wordlist + report flow
    remain as backstops)."""
    if os.getenv("MODERATION_DISABLE_LLM") == "1":
        return None
    try:
        from google import genai
        import posting  # reuse project/region/model config (single source of truth)

        client = posting.genai_client()  # shared, 60s timeout
        cfg_kwargs = dict(temperature=0.0, max_output_tokens=64,
                          response_mime_type="application/json")
        try:
            cfg_kwargs["thinking_config"] = genai.types.ThinkingConfig(thinking_budget=0)
        except Exception:  # noqa: BLE001 - older SDK
            pass
        resp = client.models.generate_content(
            model=posting._gemini_model(),
            contents=f"{_SAFETY_PROMPT}{text}",
            config=genai.types.GenerateContentConfig(**cfg_kwargs),
        )
        import json
        raw = re.sub(r"^```(?:json)?|```$", "", (resp.text or "").strip(), flags=re.MULTILINE).strip()
        data = json.loads(raw) if raw else {}
        if data.get("objectionable"):
            return str(data.get("category") or "objectionable")
    except Exception as e:  # noqa: BLE001 - fail-open on any classifier error
        print(f"moderation._gemini_flag: skipped ({type(e).__name__}: {e})")
    return None


_REJECTION = (
    "This content appears to violate our community guidelines, which prohibit "
    "harassment, hate speech, threats, and other objectionable content. Please "
    "revise and try again."
)


def check_text(text: str, *, use_llm: bool = True) -> None:
    """Raise `ValueError(_REJECTION)` if `text` is objectionable, else return None.

    Fast wordlist pass first (free, deterministic), then a best-effort Gemini
    safety pass for nuanced abuse. Callers map the ValueError to HTTP 422."""
    t = (text or "").strip()
    if not t:
        return
    if _wordlist_hit(t):
        raise ValueError(_REJECTION)
    if use_llm and _gemini_flag(t):
        raise ValueError(_REJECTION)


# ===========================================================================
# Developer notification (Apple 1.2: blocking/reports must notify the developer)
# ===========================================================================

def _alert_email() -> str:
    return os.getenv("MODERATION_ALERT_EMAIL", "support@meridianjourney.ai")


def _notify_dev(subject: str, lines: list[str]) -> None:
    """Best-effort email to the moderation inbox via Resend (same integration as
    email verification). No-ops with a log line when RESEND_API_KEY is unset."""
    api_key = os.getenv("RESEND_API_KEY")
    body = "\n".join(lines)
    if not api_key:
        print(f"[MODERATION] {subject}\n{body}")
        return
    try:
        import resend
        resend.api_key = api_key
        html = "<div style='font-family:sans-serif'>" + "".join(
            f"<p style='margin:4px 0'>{ln}</p>" for ln in lines) + "</div>"
        resend.Emails.send({
            "from": "Meridian Moderation <noreply@meridianjourney.ai>",
            "to": [_alert_email()],
            "subject": subject,
            "html": html,
        })
    except Exception as e:  # noqa: BLE001 - notification must never fail the request
        print(f"moderation._notify_dev: send failed ({e}); {subject}: {body}")


# ===========================================================================
# 2. Reporting / flagging
# ===========================================================================

def _resolve_author(db, content_type: str, content_id: str, container_id: str) -> str:
    """The uid of the user who authored the reported content ('' if unknown)."""
    try:
        if content_type == "posting":
            snap = db.collection("posting_authors").document(content_id).get()
            return (snap.to_dict() or {}).get("author_uid", "") if snap.exists else ""
        if content_type == "reply":
            snap = db.collection("replies").document(content_id).get()
            return (snap.to_dict() or {}).get("user_id", "") if snap.exists else ""
        if content_type == "message" and container_id:
            snap = (db.collection("groups").document(container_id)
                    .collection("messages").document(content_id).get())
            return (snap.to_dict() or {}).get("author_uid", "") if snap.exists else ""
    except Exception as e:  # noqa: BLE001
        print(f"moderation._resolve_author: {e}")
    return ""


def _takedown(db, content_type: str, content_id: str, container_id: str) -> None:
    """Remove content after the auto-takedown threshold. Posting → datastore +
    GCS delete; reply/message → Firestore soft-delete. Also flags content_meta."""
    try:
        if content_type == "posting":
            import posting
            posting.delete_content(content_id)
        elif content_type == "reply":
            db.collection("replies").document(content_id).update(
                {"deleted": True, "deleted_at": _now_iso(), "hidden_by_moderation": True})
        elif content_type == "message" and container_id:
            (db.collection("groups").document(container_id)
             .collection("messages").document(content_id)
             .update({"deleted": True, "deleted_at": _now_iso(), "hidden_by_moderation": True}))
    except Exception as e:  # noqa: BLE001 - best-effort; report record still stands
        print(f"moderation._takedown({content_type}:{content_id}): {e}")
    _set_hidden(db, content_id, True)


def _set_hidden(db, content_id: str, hidden: bool) -> None:
    try:
        db.collection("content_meta").document(content_id).set(
            {"hidden": hidden, "updated_at": _now_iso()}, merge=True)
    except Exception as e:  # noqa: BLE001
        print(f"moderation._set_hidden({content_id}): {e}")


def report_content(db, *, content_id: str, content_type: str, reporter_uid: str,
                   reason: str = "other", container_id: str = "") -> dict:
    """Record a report on a piece of content (one per reporter, idempotent),
    stamp content_meta, auto-hide at the threshold, and notify the developer.
    Returns {ok, report_count, hidden}."""
    if db is None:
        raise RuntimeError("Firestore unavailable")
    content_id = (content_id or "").strip()
    content_type = (content_type or "").strip()
    if not content_id:
        raise ValueError("content_id is required.")
    if content_type not in VALID_CONTENT_TYPES:
        raise ValueError(f"Invalid content_type '{content_type}'.")
    if not reporter_uid:
        raise ValueError("A user id is required to report.")
    reason = reason if reason in VALID_REPORT_REASONS else "other"

    author_uid = _resolve_author(db, content_type, content_id, container_id)

    # One report per (content, reporter) — a stable doc id makes re-reporting a
    # no-op and keeps the distinct-reporter count honest.
    rid = f"{content_id}__{reporter_uid}"
    db.collection("reports").document(rid).set({
        "content_id": content_id,
        "content_type": content_type,
        "container_id": container_id,
        "author_uid": author_uid,
        "reporter_uid": reporter_uid,
        "reason": reason,
        "status": "open",
        "created_at": _now_iso(),
    })

    # Distinct-reporter count for this content — server-side aggregation
    # (count()) instead of streaming every report doc back (O(reports) reads).
    count = 0
    try:
        agg = (db.collection("reports")
               .where(filter=FieldFilter("content_id", "==", content_id))
               .count().get())
        count = int(agg[0][0].value)
    except Exception as e:  # noqa: BLE001 — older SDK/emulator: fall back to streaming
        try:
            count = sum(1 for _ in db.collection("reports")
                        .where(filter=FieldFilter("content_id", "==", content_id)).stream())
        except Exception as e2:  # noqa: BLE001
            print(f"moderation.report_content: count failed ({e}; {e2})")
            count = 1  # we at least wrote this reporter's report above

    _set_reported(db, content_id, count)

    hidden = False
    if count >= AUTO_TAKEDOWN_REPORTS:
        _takedown(db, content_type, content_id, container_id)
        hidden = True

    _notify_dev(
        f"[Meridian] Content reported ({content_type})",
        [f"Content: {content_type} {content_id}",
         f"Author uid: {author_uid or 'unknown'}",
         f"Reported by: {reporter_uid}",
         f"Reason: {reason}",
         f"Distinct reports: {count}",
         f"Auto-hidden: {hidden}",
         "Review within 24 hours: remove content and eject the user if warranted."],
    )
    return {"ok": True, "report_count": count, "hidden": hidden}


def _set_reported(db, content_id: str, count: int) -> None:
    try:
        db.collection("content_meta").document(content_id).set(
            {"reported": True, "report_count": count, "updated_at": _now_iso()}, merge=True)
    except Exception as e:  # noqa: BLE001
        print(f"moderation._set_reported({content_id}): {e}")


def hidden_content_ids(db, content_ids: list[str]) -> set[str]:
    """Subset of `content_ids` whose content_meta is flagged hidden (moderated)."""
    if not content_ids or db is None:
        return set()
    out: set[str] = set()
    refs = [db.collection("content_meta").document(c) for c in content_ids]
    try:
        for snap in db.get_all(refs):
            if snap.exists and (snap.to_dict() or {}).get("hidden"):
                out.add(snap.id)
    except Exception as e:  # noqa: BLE001
        print(f"moderation.hidden_content_ids: {e}")
    return out


# ===========================================================================
# 3. Blocking
# ===========================================================================

def block_user(db, blocker_uid: str, blocked_uid: str) -> dict:
    """Add `blocked_uid` to `blocker_uid`'s block list and notify the developer.
    Returns {ok, blocked_uids}."""
    if db is None:
        raise RuntimeError("Firestore unavailable")
    if not blocker_uid:
        raise ValueError("A user id is required to block.")
    blocked_uid = (blocked_uid or "").strip()
    if not blocked_uid:
        raise ValueError("blocked_uid is required.")
    if blocked_uid == blocker_uid:
        raise ValueError("You cannot block yourself.")

    ref = db.collection("blocks").document(blocker_uid)
    ref.set({"blocked_uids": firestore.ArrayUnion([blocked_uid]),
             "updated_at": _now_iso()}, merge=True)

    _notify_dev(
        "[Meridian] User blocked",
        [f"Blocker: {blocker_uid}", f"Blocked: {blocked_uid}",
         "A block signals possible abuse — review the blocked user's recent content."],
    )
    return {"ok": True, "blocked_uids": sorted(blocked_uids(db, blocker_uid))}


def unblock_user(db, blocker_uid: str, blocked_uid: str) -> dict:
    if db is None:
        raise RuntimeError("Firestore unavailable")
    if not blocker_uid or not blocked_uid:
        raise ValueError("blocker and blocked uids are required.")
    ref = db.collection("blocks").document(blocker_uid)
    ref.set({"blocked_uids": firestore.ArrayRemove([blocked_uid]),
             "updated_at": _now_iso()}, merge=True)
    return {"ok": True, "blocked_uids": sorted(blocked_uids(db, blocker_uid))}


def blocked_uids(db, blocker_uid: str) -> set[str]:
    """The set of uids `blocker_uid` has blocked (empty for anon/none)."""
    if not blocker_uid or db is None:
        return set()
    try:
        snap = db.collection("blocks").document(blocker_uid).get()
        if snap.exists:
            return set((snap.to_dict() or {}).get("blocked_uids") or [])
    except Exception as e:  # noqa: BLE001
        print(f"moderation.blocked_uids({blocker_uid}): {e}")
    return set()
