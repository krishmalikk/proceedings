"""
interactions.py — replies + votes (Firestore), phase-L (D-050).

Replies and votes live entirely in Firestore — the lightweight "interactions"
store — deliberately kept OUT of the GCS→datastore→BigQuery posting pipeline so
they never pollute search/grounding (which read the datastore). Three collections:

    replies/{auto_id}        = {parent_case_id, body, author_handle, user_id,
                                created_at, deleted, deleted_at?}
    votes/{contentId}__{uid} = {dir: -1 | 1, updated_at}
    content_meta/{contentId} = {up, down, score, updated_at}

`contentId` is a posting `case_id` OR a reply id — one vote-tally path serves
both (`score = up - down`). Replies are flat (v1): a reply links only to its
parent posting via `parent_case_id`. Listing is a single-equality query, sorted
in Python, so no composite Firestore index is required.

Identity: replying/voting require an active user id (the caller passes the
resolved `X-User-Id`); `author_handle` is the user's stable seed username (not
PII, not the raw user id). `user_id` is stored only to enforce author-only
delete and per-user vote dedup; it is never serialized to clients.
"""
from __future__ import annotations

from datetime import datetime, timezone

from google.cloud import firestore
from google.cloud.firestore_v1.base_query import FieldFilter

MAX_BODY = 5000
_ZERO = {"up": 0, "down": 0, "score": 0}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _vote_id(content_id: str, user_id: str) -> str:
    return f"{content_id}__{user_id}"


def _tally(d: dict | None) -> dict:
    d = d or {}
    up, down = int(d.get("up", 0)), int(d.get("down", 0))
    return {"up": up, "down": down, "score": up - down}


# ---------------------------------------------------------------------------
# Pure vote math (no Firestore) — the toggle brain, unit-tested directly.
# ---------------------------------------------------------------------------

def _apply_vote(old_dir: int, new_dir: int) -> tuple[int, int]:
    """Deltas (d_up, d_down) when a user's vote on a content item moves from
    `old_dir` to `new_dir`, each in {-1, 0, 1} (0 = no vote). Examples:
      none→up  = (+1,  0)   up→none = (-1, 0)   up→down = (-1, +1)
    """
    d_up = (1 if new_dir == 1 else 0) - (1 if old_dir == 1 else 0)
    d_down = (1 if new_dir == -1 else 0) - (1 if old_dir == -1 else 0)
    return d_up, d_down


def _norm_dir(value: int) -> int:
    return 1 if value > 0 else (-1 if value < 0 else 0)


# ---------------------------------------------------------------------------
# Serialization
# ---------------------------------------------------------------------------

def _reply_view(doc: dict, tally: dict, your_vote: int, viewer_id: str) -> dict:
    """Client-facing reply shape. `user_id` is intentionally omitted; the only
    thing the client learns about authorship is the boolean `is_author`."""
    deleted = bool(doc.get("deleted"))
    return {
        "id": doc["id"],
        "parent_case_id": doc.get("parent_case_id", ""),
        "body": "" if deleted else doc.get("body", ""),
        "author_handle": doc.get("author_handle", ""),
        "created_at": doc.get("created_at", ""),
        "deleted": deleted,
        "up": tally["up"],
        "down": tally["down"],
        "score": tally["score"],
        "your_vote": your_vote,
        "is_author": bool(viewer_id) and doc.get("user_id") == viewer_id,
    }


# ---------------------------------------------------------------------------
# Batch reads (tallies + the viewer's own votes)
# ---------------------------------------------------------------------------

def _batch_tallies(db, content_ids: list[str]) -> dict:
    if not content_ids:
        return {}
    refs = [db.collection("content_meta").document(c) for c in content_ids]
    out = {c: dict(_ZERO) for c in content_ids}
    for snap in db.get_all(refs):
        if snap.exists:
            out[snap.id] = _tally(snap.to_dict())
    return out


def _viewer_votes(db, content_ids: list[str], viewer_id: str) -> dict:
    """Map content_id → the viewer's current dir (-1/1). Absent ⇒ no vote."""
    if not viewer_id or not content_ids:
        return {}
    suffix = len(viewer_id) + 2  # strip "__<viewer_id>"
    refs = [db.collection("votes").document(_vote_id(c, viewer_id)) for c in content_ids]
    out: dict[str, int] = {}
    for snap in db.get_all(refs):
        if snap.exists:
            out[snap.id[:-suffix]] = int((snap.to_dict() or {}).get("dir", 0))
    return out


def vote_state(db, content_ids: list[str], viewer_id: str = "") -> dict:
    """Tally + the viewer's vote for each content id (posting case_id or reply id)."""
    if db is None:
        return {c: {**_ZERO, "your_vote": 0} for c in content_ids}
    tallies = _batch_tallies(db, content_ids)
    votes = _viewer_votes(db, content_ids, viewer_id)
    return {c: {**tallies.get(c, dict(_ZERO)), "your_vote": votes.get(c, 0)} for c in content_ids}


# ---------------------------------------------------------------------------
# Votes (write) — one transaction keeps the per-user vote + tally consistent.
# ---------------------------------------------------------------------------

def cast_vote(db, content_id: str, user_id: str, target_dir: int) -> dict:
    """Set the user's vote on `content_id` to `target_dir` ∈ {-1, 0, 1}
    (0 clears it) and update the aggregate tally atomically. Idempotent: the
    frontend decides toggling and sends the desired resulting direction.
    Returns {content_id, up, down, score, your_vote}."""
    if db is None:
        raise RuntimeError("Firestore unavailable")
    if not content_id:
        raise ValueError("content_id is required.")
    if not user_id:
        raise ValueError("A user id is required to vote.")
    target = _norm_dir(target_dir)
    vote_ref = db.collection("votes").document(_vote_id(content_id, user_id))
    meta_ref = db.collection("content_meta").document(content_id)

    @firestore.transactional
    def _txn(txn):
        vsnap = vote_ref.get(transaction=txn)
        old_dir = int((vsnap.to_dict() or {}).get("dir", 0)) if vsnap.exists else 0
        msnap = meta_ref.get(transaction=txn)
        m = msnap.to_dict() if msnap.exists else {}
        up, down = int(m.get("up", 0)), int(m.get("down", 0))
        d_up, d_down = _apply_vote(old_dir, target)
        up, down = max(0, up + d_up), max(0, down + d_down)
        ts = _now_iso()
        txn.set(meta_ref, {"up": up, "down": down, "score": up - down, "updated_at": ts})
        if target == 0:
            if vsnap.exists:
                txn.delete(vote_ref)
        else:
            txn.set(vote_ref, {"dir": target, "updated_at": ts})
        return {"content_id": content_id, "up": up, "down": down,
                "score": up - down, "your_vote": target}

    return _txn(db.transaction())


# ---------------------------------------------------------------------------
# Replies
# ---------------------------------------------------------------------------

def add_reply(db, parent_case_id: str, body: str, user_id: str, author_handle: str) -> dict:
    """Create a flat reply on a posting. Returns the client-facing reply view."""
    if db is None:
        raise RuntimeError("Firestore unavailable")
    parent_case_id = (parent_case_id or "").strip()
    body = (body or "").strip()
    if not parent_case_id:
        raise ValueError("parent_case_id is required.")
    if not body:
        raise ValueError("Reply body is empty.")
    if len(body) > MAX_BODY:
        raise ValueError(f"Reply is too long (max {MAX_BODY} characters).")
    if not user_id:
        raise ValueError("A user id is required to reply.")

    doc = {
        "parent_case_id": parent_case_id,
        "body": body,
        "author_handle": author_handle or user_id,
        "user_id": user_id,
        "created_at": _now_iso(),
        "deleted": False,
    }
    ref = db.collection("replies").document()
    ref.set(doc)
    return _reply_view({**doc, "id": ref.id}, dict(_ZERO), 0, user_id)


def list_replies(db, parent_case_id: str, viewer_id: str = "", sort: str = "top") -> list[dict]:
    """All non-deleted replies on a posting, each merged with its tally + the
    viewer's vote. `sort` = 'top' (score, then recency) | 'new' (recency)."""
    if db is None:
        return []
    q = db.collection("replies").where(filter=FieldFilter("parent_case_id", "==", parent_case_id))
    docs = [{**d.to_dict(), "id": d.id} for d in q.stream()]
    docs = [d for d in docs if not d.get("deleted")]
    ids = [d["id"] for d in docs]
    tallies = _batch_tallies(db, ids)
    votes = _viewer_votes(db, ids, viewer_id)
    views = [_reply_view(d, tallies.get(d["id"], dict(_ZERO)), votes.get(d["id"], 0), viewer_id)
             for d in docs]
    if sort == "new":
        views.sort(key=lambda r: r["created_at"], reverse=True)
    else:
        views.sort(key=lambda r: (r["score"], r["created_at"]), reverse=True)
    return views


def delete_reply(db, reply_id: str, user_id: str) -> None:
    """Soft-delete a reply. Author-only: raises PermissionError otherwise,
    KeyError if the reply does not exist."""
    if db is None:
        raise RuntimeError("Firestore unavailable")
    ref = db.collection("replies").document(reply_id)
    snap = ref.get()
    if not snap.exists:
        raise KeyError("Reply not found.")
    if (snap.to_dict() or {}).get("user_id") != user_id:
        raise PermissionError("Only the author can delete this reply.")
    ref.update({"deleted": True, "deleted_at": _now_iso()})
