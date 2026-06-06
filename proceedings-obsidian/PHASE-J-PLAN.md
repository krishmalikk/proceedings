# Phase J — Profile ↔ message reconciliation + multi-view searchable user content

**Branch:** `phase-J-reconcile` · **Date:** 2026-06-06 · **Refs:** [specs-userprofile.md](specs-userprofile.md), [FINAL-ARCHITECTURE.md](FINAL-ARCHITECTURE.md) §4/§6/§10, [JSON-SCHEMA-FIELD-DICTIONARY.md](JSON-SCHEMA-FIELD-DICTIONARY.md), MEMORY.md **D-041 / D-042**

---

## 1. Goal

Two related capabilities, built on the phase-I profile:

1. **Reconcile (publish-time):** marry the saved profile (`users/{id}` in Firestore) with a message/posting being composed → one canonical posting sidecar JSON, applying the `specs-userprofile.md` conflict rules.
2. **Multi-view searchable content:** make *consented* user content searchable as **distinct DS-1 documents** — messages (already), **past experiences (new `doc_kind`)**, and an optional "connect card" later.

## 2. The architectural boundary (D-041 — non-negotiable)

- **Searchable = CONTENT in DS-1** — a sidecar (`.md` + `.json`) document, distinguished by `channel` / `doc_kind`. This is exactly what D-036 ("a new source = a new channel value, zero schema work") was built for.
- **Profile = Firestore app-state, NEVER indexed.** D-035 / FINAL-ARCHITECTURE §6 ("NEVER a grounding source") stays intact. We never point `documents.import` at `users/{id}`.
- **Multiple views = multiple DOCUMENTS** (one `.json` per doc), not multiple JSONs on one document.
- **Source of truth:** profile = Firestore; *published* content = GCS sidecar (D-031), with a Firestore mirror for ownership ("my experiences"), mirroring `posts/{case_id}`.

## 3. Data model

Reuse the posting canonical (`schema.py` `PostingMetadata` / JSON-SCHEMA-FIELD-DICTIONARY). Extend the `doc_kind` enum:

| `doc_kind` | Source | Searchable | Notes |
|---|---|---|---|
| `post` | message/posting | yes | exists |
| `comment` | reddit comment | yes | exists |
| **`experience`** | a `profile.journey[]` entry the user consents to share | yes (consented) | **new** |
| *`connect_card`* | explicit "looking to connect" post | yes | optional, later |

- **Channel:** in-app content uses the existing in-app channel (`ourwebsite` today; FINAL-ARCHITECTURE calls it `app` — naming reconciled in §6 of this plan). Experiences = same in-app channel, `doc_kind=experience`.
- **Experience sidecar** (`<id>.md` + `<id>.json`):
  - `case_id`: `ourwebsite-exp-<YYYY-MM-DD>-<short>`; `doc_kind=experience`; `parent_case_id` = the author's synthetic handle (no PII).
  - `.md` body = the experience **text** (PII-scrubbed).
  - **Facets describe the EXPERIENCE, not current state**: `milestone`, `key_dates` (the dated event), `visa_at_time`, `consulates`, `outcome` (1.9), derived tags. (A past refusal is an *experience facet*, never the user's current status — keeps the phase-I "past ≠ current" rule.)
  - `embedding_text` from milestone + text + facets.

## 4. Reconciliation engine (publish-time, profile ↔ message)

Both sides share canonical tag-field **names**, so the merge is a field-level projection. New module `reconcile.py`:

`reconcile_profile_message(profile, message) -> {merged, conflicts[]}`, per field:
- **same value** → no-op (pick either).
- **message empty, profile set** → pre-fill from profile.
- **both set & differ** → **conflict**: default *message wins for this posting* (it's the current message) **and** surface an **offer to update the profile** from the message (per spec). Record `{field, profile_value, message_value}`.
- **background** → union (so the user never re-enters background already in the profile).

Output → the single posting sidecar JSON → existing `posting.publish_posting` path (GCS → `documents.import`). Start **deterministic** (field-level) + an **LLM "conflict explainer"** (plain-English "your profile says H-1B but this message says H-4 — update profile?"); a fully agentic reconcile agent is a later option, not v1.

## 5. Firestore → GCS projection (make consented slices searchable)

- On profile save (stage-2 experiences) **with consent**, project each consented `journey` entry → experience sidecar in GCS → `documents.import` (`doc_kind=experience`).
- `profile.journey` stays in Firestore as the user's private copy (mirror); the GCS sidecar is the searchable source of truth.
- **Consent:** a per-experience "share so others can find me" toggle, **default OFF**. Only consented experiences are projected/indexed.
- Update/delete propagate (re-import / `documents.delete`) like postings.

## 6. "Same boat" search (forward-looking, not built in J)

- Search DS-1 with `doc_kind=experience` + facets (milestone, visa, consulate, outcome) → matching experiences → surface the author handle for the **connect feature (coming soon)**.
- `boostSpec` precedence (app > reddit > public) unaffected — experiences are in-app content.
- Channel-name reconciliation: standardize the in-app channel label (`app` per FINAL-ARCHITECTURE vs `ourwebsite` as implemented) — pick one and note it (low-risk, a constant).

## 7. Steps

- **J1** `schema.py`: add `doc_kind=experience`; `build_experience_sidecar(profile, entry)` (posting canonical + experience facets).
- **J2** `reconcile.py`: `reconcile_profile_message()` (deterministic merge + conflict list) + an LLM conflict explainer.
- **J3** `api.py`: `/api/reconcile` (preview merge + conflicts); profile consent flag per journey entry; projection of consented experiences on `PUT /api/profile`.
- **J4** Wire posting publish to reconcile (pre-fill from profile; conflict prompts; offer profile update).
- **J5** Frontend: composer conflict prompt ("differs from your profile — update profile?"); per-experience **share** toggle in onboarding stage 2.
- **J6** Tests: reconcile conflict matrix; experience projection + facets; **profile-never-indexed guard**; consent gating; past-experience-not-current-state still holds on experience docs.

## 8. Open decisions (confirm before building)

1. **Which views indexed now?** Recommend: **experiences only** (messages already; profile NEVER; connect-card later).
2. **Conflict default:** message-wins-for-post + offer-profile-update *(recommended)* vs block-until-resolved.
3. **Consent model:** per-experience opt-in *(recommended)* vs whole-profile opt-in.
4. **Experience facets:** carry milestone/visa/consulate/outcome for searchability *(recommended — about the experience, not current state)*.
5. **Reconcile agent:** deterministic merge + LLM explainer first *(recommended)* vs full agent now.
6. **Channel label:** standardize on `app` or keep `ourwebsite` (cosmetic; decide once).
