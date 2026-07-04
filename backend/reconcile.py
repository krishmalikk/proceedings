"""
reconcile.py — profile ↔ message reconciliation at publish time (phase-J, D-042).

Both the saved profile (Firestore `users/{id}`) and a message/posting being
composed use the SAME controlled vocabulary and field names, so reconciliation
is a deterministic field-level projection. We emit:
  - `merged`: the values to use FOR THIS POSTING (message wins on conflict;
    profile pre-fills where the message is empty; backgrounds are unioned), and
  - `conflicts`: fields where profile and message disagree, each with an offer to
    update the profile (per specs-userprofile.md "data conflict scenarios").

A small LLM "conflict explainer" turns the conflict list into one friendly
prompt. There is NO full reconcile agent in v1 (decision: deterministic core).

The profile is NEVER indexed; this only shapes the single posting sidecar JSON.
"""

from __future__ import annotations

import json

import posting  # shared vocab cleaners + Gemini client config

# Canonical fields that overlap between profile and message (reconciled).
_LIST_FIELDS = ["current_visa_or_greencard_category", "visa_applying_for", "consulates"]
_MAP_FIELDS = ["key_stages_or_info", "key_dates"]


def _clean_list(field: str, value) -> list:
    return posting._clean_group(field, value) if field != "primary_consulate" else value


def reconcile_profile_message(profile: dict, message: dict) -> dict:
    """Field-level merge of a saved profile and an in-progress message.

    Returns {merged, conflicts, prefilled} where:
      - merged: dict of reconciled field values (message wins on conflict;
                profile fills blanks; backgrounds unioned),
      - conflicts: [{field, profile_value, message_value}] needing a profile-update offer,
      - prefilled: [field] that were empty in the message and filled from the profile.
    """
    posting._Vocab.load()
    profile = profile or {}
    message = message or {}
    merged: dict = {}
    conflicts: list[dict] = []
    prefilled: list[str] = []

    # List-valued tag fields.
    for f in _LIST_FIELDS:
        p = posting._clean_group(f, profile.get(f))
        m = posting._clean_group(f, message.get(f))
        if m and p and set(m) != set(p):
            conflicts.append({"field": f, "profile_value": p, "message_value": m})
            merged[f] = m              # message wins for this posting
        elif m:
            merged[f] = m
        elif p:
            merged[f] = p              # pre-fill from profile
            prefilled.append(f)
        else:
            merged[f] = []

    # primary_consulate (scalar) — derive from consulates if absent.
    pc_p = posting._clean_group("primary_consulate", profile.get("primary_consulate"))
    pc_m = posting._clean_group("primary_consulate", message.get("primary_consulate"))
    pc = pc_m or pc_p or (merged["consulates"][0] if merged.get("consulates") else "")
    if pc_m and pc_p and pc_m != pc_p:
        conflicts.append({"field": "primary_consulate", "profile_value": pc_p, "message_value": pc_m})
    elif not pc_m and pc_p:
        prefilled.append("primary_consulate")
    merged["primary_consulate"] = pc

    # Map fields (key_stages_or_info, key_dates): union; on key collision with a
    # different value, message wins and the disagreement is a conflict.
    for f in _MAP_FIELDS:
        cleaner = posting._clean_stages if f == "key_stages_or_info" else posting._clean_dates
        p = cleaner(profile.get(f))
        m = cleaner(message.get(f))
        out = dict(p)
        for k, v in m.items():
            if k in p and p[k] != v:
                conflicts.append({"field": f"{f}.{k}", "profile_value": p[k], "message_value": v})
            elif k not in p:
                pass  # purely additive from the message
            out[k] = v  # message wins on overlap
        # keys only the profile had are pre-filled
        if set(p) - set(m):
            prefilled.append(f)
        merged[f] = out

    # Background text: union (don't make the user re-enter what's in the profile).
    pb = str(profile.get("background_text") or "").strip()
    mb = str(message.get("background_text") or message.get("description") or "").strip()
    if pb and mb and pb not in mb:
        merged["background_text"] = f"{mb}\n\n{pb}"
    else:
        merged["background_text"] = mb or pb

    return {"merged": merged, "conflicts": conflicts, "prefilled": prefilled}


def explain_conflicts(conflicts: list[dict]) -> str:
    """One friendly, plain-English prompt offering to update the profile.
    Falls back to a deterministic sentence if the LLM is unavailable."""
    if not conflicts:
        return ""
    pretty = "; ".join(
        f"{c['field'].replace('_', ' ')}: profile says {c['profile_value']} but your message says {c['message_value']}"
        for c in conflicts
    )
    fallback = (f"Heads up — some details differ from your saved profile ({pretty}). "
                f"I'll use what's in this message for the post. Want me to update your profile to match?")
    try:
        from google import genai
        prompt = (
            "You are a friendly US-immigration assistant. The user's saved profile and the message they're "
            "about to post disagree on some fields. In 1-2 short sentences, gently point out the differences "
            "and ASK whether they'd like to update their profile to match the message. Do not answer any "
            "immigration question. Differences:\n" + json.dumps(conflicts, ensure_ascii=False)
        )
        client = posting.genai_client()  # shared, 60s timeout
        cfg = dict(temperature=0.3, max_output_tokens=200)
        try:
            cfg["thinking_config"] = genai.types.ThinkingConfig(thinking_budget=0)
        except Exception:  # noqa: BLE001
            pass
        resp = client.models.generate_content(
            model=posting._gemini_model(), contents=prompt,
            config=genai.types.GenerateContentConfig(**cfg),
        )
        return (resp.text or "").strip() or fallback
    except Exception as e:  # noqa: BLE001
        print(f"reconcile: explainer fell back ({e})")
        return fallback
