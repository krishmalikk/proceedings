"""
matching.py — "Find users in same boat" (phase-M, D-051).

Capture an applicant's matching CRITERIA via a US-immigration-expert chat, then
rank OTHER registered users (Firestore `users/{id}` profiles) by tag-overlap
similarity so the user can pick whom to include and form a group. This phase
only finds matches + forms the group; communication is a later phase.

Reuses, rather than re-implements:
  - chat plumbing + Gemini JSON  → profile._gen_json
  - controlled vocabulary        → posting._master_tags_block / clean helpers
  - profile validation + merge   → profile.clean_profile / merge_profile
  - validate-vs-profile + offer-to-update → the existing reconcile feature
    (reconcile.reconcile_profile_message + /api/reconcile + PUT /api/profile);
    matching itself always uses the ENTERED criteria.

The CRITERIA carry the same controlled-vocab fields as a profile/message (so
they double as the reconcile `message`), minus the journey/PII bits:
  current_visa_or_greencard_category, visa_applying_for, primary_consulate,
  consulates, key_stages_or_info, key_dates, background_text.

New Firestore collection:
  groups/{auto_id} = {owner_id, owner_username, criteria_text, criteria_tags,
                      members:[{user_id, username, score}], status, created_at}
"""
from __future__ import annotations

import json
from datetime import datetime, timezone

import posting
import profile

CRITERIA_FIELDS = [
    "current_visa_or_greencard_category",
    "visa_applying_for",
    "primary_consulate",
    "consulates",
    "key_stages_or_info",
    "key_dates",
    "background_text",
]

# Similarity weights — visa/category dominates "same boat", then consulate, then
# a shared status fact (same key AND value), then a shared milestone date.
W_VISA, W_CONSULATE, W_STAGE = 3.0, 1.5, 1.0
MIN_SCORE = 1.0  # at least one shared visa | consulate | status fact | exact date

# Date proximity ("same place in line"): for the SAME milestone key, credit by
# how close the two YYYY-MM-DD values are. The **±30-day** bucket is the
# "approximate match" boundary — it scores exactly MIN_SCORE, so two users whose
# milestone dates are within a month count as a match even with no other shared
# facet. Exact scores higher; wider windows give graduated bonus; a shared key
# with far/blank dates keeps a small floor (same milestone, different timing).
_DATE_EXACT = 1.5
_DATE_BUCKETS = [(30, 1.0), (90, 0.6), (180, 0.3)]  # (max_days_inclusive, weight)
_DATE_FLOOR = 0.1


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _as_set(v) -> set[str]:
    if isinstance(v, list):
        return {str(x) for x in v if x}
    return {str(v)} if v else set()


def _parse_ymd(s):
    """Parse a YYYY-MM-DD string to a datetime, or None if blank/malformed.
    Criteria/profile dates are normalized to YYYY-MM-DD upstream (clean_profile)."""
    try:
        return datetime.strptime(str(s), "%Y-%m-%d")
    except (ValueError, TypeError):
        return None


def _date_proximity(a, b) -> float:
    """0..1 closeness of two YYYY-MM-DD dates: exact ⇒ 1.0; within a bucket ⇒
    graduated; far apart or unparseable ⇒ 0.0 (the 'approximate match' rule)."""
    da, db = _parse_ymd(a), _parse_ymd(b)
    if da is None or db is None:
        return 0.0
    days = abs((da - db).days)
    if days == 0:
        return _DATE_EXACT
    for max_days, weight in _DATE_BUCKETS:
        if days <= max_days:
            return weight
    return 0.0


def _date_key_score(a, b) -> float:
    """Score for a shared milestone key: proximity if close, else a small floor
    (the two users track the same milestone, just at different times)."""
    return max(_date_proximity(a, b), _DATE_FLOOR)


def _date_label(key: str, a, b) -> str:
    p = _date_proximity(a, b)
    tag = "exact" if p >= _DATE_EXACT else ("~" if p > 0 else "≠")
    return f"{key}({tag})"


# ---------------------------------------------------------------------------
# Criteria cleaning + merge (reuse the profile validators)
# ---------------------------------------------------------------------------

def _clean_criteria(d: dict | None) -> dict:
    """Validate criteria against the controlled vocab via profile.clean_profile
    (drop journey/identity), returning only the matchable tag fields."""
    p = profile.clean_profile({**(d or {}), "journey": []})
    return {f: p[f] for f in CRITERIA_FIELDS}


def _merge_criteria(base: dict, incoming: dict) -> dict:
    """Union lists / overlay maps / keep prior — reuse profile.merge_profile."""
    m = profile.merge_profile({**base, "journey": []}, {**incoming, "journey": []})
    return {f: m[f] for f in CRITERIA_FIELDS}


# ---------------------------------------------------------------------------
# Expert chat turn (single stage; mirrors profile.onboard_turn)
# ---------------------------------------------------------------------------

def _find_system_prompt(draft: dict) -> str:
    posting._Vocab.load()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return f"""You are a friendly US immigration expert helping the user find OTHER applicants in the SAME
situation ("same boat") so they can connect. Hold a short, natural conversation to capture the CRITERIA that
define who they want to find — essentially their own immigration situation: current status, what they are
applying for, the consulate(s) involved, key status facts, and the dates that fix their place in line. Ask
ONE focused question at a time (you may group a few RELATED dates). Concise and warm.

Today is {today}. Resolve relative dates against it; output exact YYYY-MM-DD.

# CAPTURE (only what applies) — controlled-vocabulary strings only
- current_visa_or_greencard_category (1.1/1.2) and/or visa_applying_for (1.1/1.2)
- primary_consulate + consulates (1.4) when relevant
- citizen_of_country / resident_of_country (ISO-2) and other 1.7 status facts under key_stages_or_info
- the key_dates (1.8) that matter most (priority_date, *_filed_date, visa_interview_date, ...)
- a short background_text in their own words
When the criteria are reasonably specific, set "done": true and tell them you'll find their matches now.

# SCOPE — this finds peers, it is NOT a Q&A
If they ask an immigration QUESTION, briefly say this page only builds their match criteria and steer back.

# HARD RULES
- NEVER ask for or store PII (name, DOB, address, phone, email, passport/A-number, SSN).
- Use ONLY controlled-vocabulary strings; if unsure, leave the field out and put the idea in background_text. Do NOT invent tags.
- Country values for *_of_country MUST be ISO-2 codes (IN, CN, MX, AE).

# CONTROLLED VOCABULARY (use exact strings)
{posting._master_tags_block()}

# OUTPUT — return ONE JSON object only (no prose, no fences):
{{
  "reply": string,
  "criteria": {{
    "current_visa_or_greencard_category": string[],
    "visa_applying_for": string[],
    "primary_consulate": string,
    "consulates": string[],
    "key_stages_or_info": object,
    "key_dates": object,
    "background_text": string
  }},
  "done": boolean
}}

# Criteria so far (merge your new findings into this; keep prior values):
{json.dumps(draft, ensure_ascii=False)}
"""


def find_turn(messages: list[dict], draft: dict | None) -> dict:
    """One conversational turn capturing match criteria. Returns
    {reply, criteria (validated), done}. Stateless — client passes history+draft."""
    base = _clean_criteria(draft)
    convo = "\n".join(
        f"{str(m.get('role', 'user')).capitalize()}: {m.get('content', '')}"
        for m in (messages or [])[-12:]
    )
    prompt = _find_system_prompt(base)
    try:
        data = profile._gen_json(f"{prompt}\n\nConversation so far:\n{convo}\n\nReturn the JSON now.")
    except json.JSONDecodeError:
        return {"reply": "Sorry, could you say that another way?", "criteria": base, "done": False}
    merged = _merge_criteria(base, _clean_criteria(data.get("criteria") or {}))
    return {
        "reply": str(data.get("reply") or "").strip() or "Tell me about your immigration situation.",
        "criteria": merged,
        "done": bool(data.get("done")),
    }


# ---------------------------------------------------------------------------
# Similarity scoring (pure) + matching
# ---------------------------------------------------------------------------

def _score(criteria: dict, prof: dict) -> dict:
    """Weighted tag-overlap between criteria and a candidate profile. Pure.
    Returns {score, shared (human strings), shared_detail}."""
    c_visa = _as_set(criteria.get("current_visa_or_greencard_category")) | _as_set(criteria.get("visa_applying_for"))
    p_visa = _as_set(prof.get("current_visa_or_greencard_category")) | _as_set(prof.get("visa_applying_for"))
    visa = sorted(c_visa & p_visa)

    c_cons = _as_set(criteria.get("consulates")) | _as_set(criteria.get("primary_consulate"))
    p_cons = _as_set(prof.get("consulates")) | _as_set(prof.get("primary_consulate"))
    cons = sorted(c_cons & p_cons)

    c_st = criteria.get("key_stages_or_info") or {}
    p_st = prof.get("key_stages_or_info") or {}
    stages = sorted(k for k in c_st if k in p_st and str(c_st[k]) == str(p_st[k]))

    c_dt = criteria.get("key_dates") or {}
    p_dt = prof.get("key_dates") or {}
    dt_keys = sorted(set(c_dt) & set(p_dt))
    date_score = sum(_date_key_score(c_dt[k], p_dt[k]) for k in dt_keys)

    score = W_VISA * len(visa) + W_CONSULATE * len(cons) + W_STAGE * len(stages) + date_score
    shared = [*visa, *cons, *[f"{k}={c_st[k]}" for k in stages],
              *[_date_label(k, c_dt[k], p_dt[k]) for k in dt_keys]]
    return {
        "score": round(score, 2),
        "shared": shared,
        "shared_detail": {"visa": visa, "consulates": cons, "stages": stages, "dates": dt_keys},
    }


def _summary(prof: dict) -> str:
    visa = (prof.get("current_visa_or_greencard_category") or prof.get("visa_applying_for") or [])[:2]
    cons = (prof.get("consulates") or ([prof["primary_consulate"]] if prof.get("primary_consulate") else []))[:2]
    bits = [*visa, *cons]
    return " · ".join(bits) if bits else "immigration"


def list_candidate_profiles(db, exclude_id: str = "") -> list[dict]:
    """All saved user profiles (Firestore `users`), cleaned, excluding `exclude_id`."""
    if db is None:
        return []
    out: list[dict] = []
    for snap in db.collection("users").stream():
        if snap.id == exclude_id:
            continue
        data = snap.to_dict() or {}
        p = profile.clean_profile(data)
        p["user_id"] = snap.id
        p["username"] = data.get("username") or profile.username_for(snap.id)
        out.append(p)
    return out


def find_matches(db, user_id: str, criteria: dict, top_n: int = 20, min_score: float = MIN_SCORE) -> list[dict]:
    """Rank other users by similarity to `criteria`. Excludes self; drops
    below-threshold/zero-overlap candidates; returns the top-N."""
    crit = _clean_criteria(criteria)
    matches: list[dict] = []
    for p in list_candidate_profiles(db, exclude_id=user_id):
        s = _score(crit, p)
        if s["shared"] and s["score"] >= min_score:
            matches.append({
                "user_id": p["user_id"], "username": p["username"],
                "score": s["score"], "shared": s["shared"], "summary": _summary(p),
                "background": (p.get("background_text") or "")[:280],
            })
    matches.sort(key=lambda m: (m["score"], m["username"]), reverse=True)
    return matches[:top_n]


# ---------------------------------------------------------------------------
# Groups — criteria-defined, joinable communities
# ---------------------------------------------------------------------------
# A group is identified by the SIGNATURE of its distinctive criteria facets
# (visa/category ∪, consulates ∪, citizen/resident country). Same signature ⇒
# same group, so users in the same boat converge into one group (join existing
# rather than duplicate). Members accumulate; a generated `name` + the criteria
# metadata are stored. Users can also browse all groups and join directly.

_COUNTRY_KEYS = profile._COUNTRY_STAGE_KEYS


def _signature(criteria: dict) -> str:
    """Stable identity from the distinctive facets (dates/free-text excluded)."""
    c = _clean_criteria(criteria)
    visa = sorted(_as_set(c["current_visa_or_greencard_category"]) | _as_set(c["visa_applying_for"]))
    cons = sorted(_as_set(c["consulates"]) | _as_set(c["primary_consulate"]))
    country = sorted({v for k, v in (c["key_stages_or_info"] or {}).items() if k in _COUNTRY_KEYS})
    return f"v:{','.join(visa)}|c:{','.join(cons)}|n:{','.join(country)}"


def _is_distinctive(sig: str) -> bool:
    return sig != "v:|c:|n:"


def _group_name(criteria: dict) -> str:
    """A human-readable name generated from the criteria, e.g. 'H-1B → EB-2 at BOM (IN)'."""
    c = _clean_criteria(criteria)
    cur, nxt = ", ".join(c["current_visa_or_greencard_category"]), ", ".join(c["visa_applying_for"])
    name = " → ".join([p for p in (cur, nxt) if p]) or "Immigration"
    cons = c["consulates"] or ([c["primary_consulate"]] if c["primary_consulate"] else [])
    if cons:
        name += " at " + "/".join(cons[:2])
    country = [v for k, v in (c["key_stages_or_info"] or {}).items() if k == "citizen_of_country"]
    if country:
        name += f" ({country[0]})"
    return name


def _member(user_id: str, username: str = "") -> dict:
    return {"user_id": str(user_id), "username": username or profile.username_for(user_id)}


def _dedupe_members(members: list[dict]) -> list[dict]:
    seen: set[str] = set()
    out: list[dict] = []
    for m in members:
        uid = str(m.get("user_id") or "")
        if uid and uid not in seen:
            seen.add(uid)
            out.append({"user_id": uid, "username": str(m.get("username") or profile.username_for(uid))})
    return out


def _find_by_signature(db, sig: str):
    from google.cloud.firestore_v1.base_query import FieldFilter
    docs = list(db.collection("groups").where(filter=FieldFilter("signature", "==", sig)).limit(1).stream())
    return docs[0] if docs else None


def _group_view(doc_id: str, data: dict, viewer_id: str, joined: bool = False) -> dict:
    members = data.get("members") or []
    return {
        "group_id": doc_id,
        "name": data.get("name") or "",
        "criteria_text": data.get("criteria_text") or "",
        "criteria_tags": data.get("criteria_tags") or {},
        "members": members,
        "status": data.get("status") or "formed",
        "created_at": data.get("created_at") or "",
        "is_member": any(m.get("user_id") == viewer_id for m in members),
        "joined": joined,
    }


def find_or_create_group(db, user_id: str, criteria_text: str, criteria: dict,
                         members: list[dict] | None = None) -> dict:
    """Join the existing group for this criteria signature, or create it. The
    acting user is always added; provided peers are added too. `joined`=True when
    an existing group was joined rather than created."""
    if db is None:
        raise RuntimeError("Firestore unavailable")
    sig = _signature(criteria)
    if not _is_distinctive(sig):
        raise ValueError("Add at least a visa or consulate to form a group.")
    to_add = _dedupe_members([_member(user_id), *(members or [])])

    existing = _find_by_signature(db, sig)
    if existing is not None:
        data = existing.to_dict() or {}
        merged = _dedupe_members([*(data.get("members") or []), *to_add])
        existing.reference.update({"members": merged, "updated_at": _now_iso()})
        return _group_view(existing.id, {**data, "members": merged}, user_id, joined=True)

    doc = {
        "name": _group_name(criteria),
        "signature": sig,
        "criteria_text": str(criteria_text or "")[:2000],
        "criteria_tags": _clean_criteria(criteria),
        "members": to_add,
        "created_by": user_id,
        "status": "formed",
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    }
    ref = db.collection("groups").document()
    ref.set(doc)
    return _group_view(ref.id, doc, user_id, joined=False)


def join_group(db, group_id: str, user_id: str) -> dict:
    """Add the user to an existing group (browse → join)."""
    if db is None:
        raise RuntimeError("Firestore unavailable")
    ref = db.collection("groups").document(group_id)
    snap = ref.get()
    if not snap.exists:
        raise KeyError("Group not found.")
    data = snap.to_dict() or {}
    members = _dedupe_members([*(data.get("members") or []), _member(user_id)])
    ref.update({"members": members, "updated_at": _now_iso()})
    return _group_view(group_id, {**data, "members": members}, user_id, joined=True)


def list_all_groups(db, viewer_id: str = "") -> list[dict]:
    """All groups (for browsing), newest first, flagged with the viewer's membership."""
    if db is None:
        return []
    out = [_group_view(d.id, d.to_dict() or {}, viewer_id) for d in db.collection("groups").stream()]
    out.sort(key=lambda g: g.get("created_at", ""), reverse=True)
    return out


def my_groups(db, user_id: str) -> list[dict]:
    """Groups the user is a member of, newest first."""
    return [g for g in list_all_groups(db, user_id) if g["is_member"]]
