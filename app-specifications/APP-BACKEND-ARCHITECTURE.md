# App Backend Architecture & Design — Vertex AI Search backend for the mobile / web apps

**Status:** Design spec (architecture + API + data model + flows + NFRs). Builds on the settled decisions D-034 (orchestration = Cloud Run BFF + Gemini), D-035 (Firebase Auth + Firestore), D-036 (generic channel-agnostic schema), D-037 (pipeline code synced), and the ingestion architecture in [content-ingestion-specifications/](../content-ingestion-specifications/). This document is the authoritative backend design the mobile + web apps integrate against.

---

## 1. Purpose & scope

The apps are **chatbot-first**: a single conversational surface drives **search**, **posting**, **profile/account**, and **general US-immigration Q&A** (see [app-specs.MD](app-specs.MD)). This backend:

1. Exposes one **HTTP API (the BFF)** that both clients call.
2. Owns the **conversation loop** — intent routing, multi-turn context, geo-aware proactive prompting, conversational filtering, the posting draft→review→publish flow, and domain guardrails.
3. Delegates the two fixed capabilities: **grounded search** to the Vertex AI Search "Search + Answer" API, and **posting ingestion** to the existing Tagger→Validator→GCS-Writer→`documents.import` contract.
4. Persists app state (auth, profile, sessions, saved searches, alerts) in **Firebase Auth + Firestore**.

**Out of scope (settled elsewhere):** the tag taxonomy ([tags-cleaned/](../tags-cleaned/)), the canonical schema ([schema.py](../content-ingestion-specifications/schema.py)), and the Reddit ingestion pipeline. This backend *reuses* them; it does not redefine them.

---

## 2. High-level architecture

```
   ┌─────────────┐     ┌─────────────┐
   │ Mobile app  │     │  Web app    │     (Firebase Auth SDK: email/Google/Apple/guest)
   └──────┬──────┘     └──────┬──────┘
          │  HTTPS + Firebase ID token (Bearer)
          └───────────┬───────┘
                      ▼
        ┌──────────────────────────────────────────────┐
        │   BFF — FastAPI on Cloud Run (sa-app-bff)      │
        │   • verify Firebase ID token (Admin SDK)       │
        │   • intent routing (Gemini)                    │
        │   • geo-aware proactive prompting              │
        │   • session/draft state  ↔ Firestore           │
        │   • search → Answer API ; post → ingest contract│
        │   • domain guardrails + confirm-before-publish │
        └───┬───────────┬───────────┬───────────┬────────┘
            │           │           │           │
            ▼           ▼           ▼           ▼
   ┌────────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────────────┐
   │ Vertex AI  │ │  Gemini  │ │ Firestore│ │ Ingestion contract (reuse)│
   │  Search    │ │ (Vertex) │ │ + Auth   │ │  Tagger→Validator→GCS-    │
   │ Answer/    │ │ intent / │ │ app state│ │  Writer→documents.import  │
   │ Search API │ │ extract  │ │          │ │  → imm-postings-datastore │
   └────────────┘ └──────────┘ └──────────┘ └──────────────────────────┘
        ▲                                              │
        └──────── same single index (D-016) ───────────┘
```

**Key invariant:** clients never call Vertex AI Search, Gemini, GCS, BigQuery, or Firestore *writes* directly — the BFF is the single choke point (holds the SA, enforces auth, business logic, guardrails, and the publish gate). The only optional client-direct path is **read-only Firestore listeners** for live alerts/session updates (D-035), guarded by security rules.

---

## 3. Component inventory

| Component | GCP service | Responsibility |
|---|---|---|
| **BFF** | Cloud Run (FastAPI, `sa-app-bff`) | The whole conversation loop + API surface |
| **Conversational LLM** | Vertex AI **Gemini** (`gemini-2.5-flash`, Pro fallback) | Intent classification, entity extraction, gap-question phrasing, summary/answer composition |
| **Search + grounded answer** | Vertex AI **Search** (Discovery Engine) — `imm-postings-search-app` / `imm-postings-datastore` (location `global`) | Hybrid retrieval + facet filters + grounded answer + citations + multi-turn search session |
| **Identity** | **Firebase Authentication** | email/Google/Apple/anonymous sign-in; issues ID tokens |
| **App state** | **Firestore** (Native, `us-central1`) | users/profiles, sessions+drafts, saved searches, alerts, post refs |
| **Posting ingestion** | shared tagger module + **GCS** (`imm-postings-ingestion`) + **BigQuery** (`IMM.postings_metadata`) + `documents.import` | Turn a confirmed draft into a tagged sidecar pair in the same index |
| **Alerts matcher** (Phase 2) | Eventarc → Cloud Run/Function + **FCM** | Match newly-ingested docs against saved searches → push |
| **Analytics** | **BigQuery** | Intent mix, zero-result queries, posting funnel, drop-off |

---

## 4. BFF API surface

All endpoints require `Authorization: Bearer <firebase-id-token>` (anonymous tokens allowed for guest search). Versioned under `/v1`. JSON over HTTPS.

| Method & path | Purpose | Core request → response |
|---|---|---|
| `POST /v1/chat` | **The main conversational turn** | `{session_id?, message, location_hint?}` → `{session_id, intent, reply, cards[], citations[], draft_preview?, suggested_followups[], active_filter}` |
| `POST /v1/search` | Direct (non-conversational) faceted search | `{query, filters{}, sort?, page_size, page_token?}` → `{answer?, results[], facet_counts{}, next_page_token}` |
| `POST /v1/posts:draft` | Create/update a posting draft from a message | `{session_id, message}` → `{draft, missing_fields[], next_question?}` |
| `POST /v1/posts:publish` | Finalize + ingest a confirmed draft | `{session_id}` (server uses the session draft) → `{case_id, full_url, status}` |
| `GET /v1/posts/{case_id}` | Fetch a post (own or public) | → posting card + body |
| `GET /v1/me/posts` | The user's posting history | → `[post refs]` |
| `GET/PUT /v1/profile` | Read/update the immigration-journey profile | canonical-aligned fields |
| `POST/GET/DELETE /v1/saved-searches` | Manage saved searches | `{query, filters, alert_enabled}` |
| `POST/GET/DELETE /v1/alerts` | Manage alert subscriptions | `{saved_search_id, transport}` |
| `POST /v1/session` | (optional) explicitly start a session + capture geo | → `{session_id, in_us}` |

**`/v1/chat` is the heart of the system**; `/v1/search`, `/v1/posts:*`, etc. are direct affordances the chat turn also reaches internally.

---

## 5. Conversation model & session state

A **session** is one Firestore document (`sessions/{session_id}`) — durable because Cloud Run is stateless/scale-to-zero (D-034 §2.1). Shape:

```jsonc
{
  "uid": "<firebase-uid>",
  "created_at": "...", "last_active": "...",
  "country": "IN", "in_us": false,            // geo branch (§7)
  "intent_state": "posting",                   // current routing state
  "active_filter": { "consulates": ["MUM"], "visa_applying_for": ["B-1","B-2"] },
  "draft": { /* partial canonical PostingMetadata being assembled */ },
  "vertex_session_name": "projects/.../sessions/<id>",  // managed search-followup context
  "turns": [ {"role":"user","text":"..."}, {"role":"assistant","text":"..."} ],
  "ttl": "..."                                 // Firestore TTL auto-expires stale sessions
}
```

Two layers of "session": the **Vertex Answer-API session** (managed; search-query rephrasing/follow-ups) referenced by `vertex_session_name`, and the **app conversation session** (this document; intent, draft, geo) — both keyed by the same `session_id`. The BFF assembles Gemini's message history from `turns` on each turn (Gemini is stateless per call).

---

## 6. Intent recognition & routing

Each `/v1/chat` turn:
1. Load session (or create one; derive geo, §7).
2. **Classify intent** with a cheap Gemini call (function-calling/classifier) into: `search` · `refine_filter` · `post` · `confirm_publish` · `profile` · `account` · `general_question` · `off_topic`.
3. Route:
   - `search` / `refine_filter` → §9 search+answer flow (update `active_filter`).
   - `post` → §10 posting flow (extract entities, update `draft`, ask next gap).
   - `confirm_publish` → §10 publish (only valid when a complete draft + explicit confirmation exist).
   - `profile` / `account` → structured Firestore read/write.
   - `general_question` → grounded answer (Answer API) or a domain-scoped Gemini answer.
   - `off_topic` → polite domain-restriction reply (guardrail, §14).
4. Append the turn to `turns`; persist session.

Routing is **explicit BFF code**, not an autonomous agent — this is the determinism rationale behind choosing Option A over C (D-034).

---

## 7. Geo-detection & proactive prompting

The app must detect **US vs outside-US** ([app-specs.MD §5](app-specs.MD)) and branch the proactive-prompt script.

- **Detection:** BFF derives `country`/`in_us` from the request (client-supplied locale/GPS hint, else IP geo at the edge). Stored on the session; user can override ("I'm currently in India").
- **Prompting:** the enumerated §5.1 question scripts are encoded as **deterministic prompt templates / a small state machine** keyed by `(in_us, has_visa, applying, has_interview, applying_gc, gc_stage)`. The BFF asks the *next missing* high-value question; Gemini only phrases it naturally. This keeps the gap-filling guaranteed and on-script (vs. steered).
- Every answer maps to a **canonical profile/draft field** so the conversation simultaneously enriches the profile and pre-fills a posting draft / search filter.

---

## 8. Vertex AI Search query contract

**Engine:** `imm-postings-search-app` over `imm-postings-datastore` (location `global`, sidecar mode — `.md` body + `.json` structData). Two methods:
- `servingConfigs/default_search:search` — ranked results + facets (for `/v1/search`, result cards, facet counts).
- `servingConfigs/default_search:answer` — grounded natural-language **answer + citations**, with a **session** for multi-turn rephrasing (for `/v1/chat`).

**Filterable facet fields** (structData; the BFF maps NL → filter expression):

| Facet | Example filter clause |
|---|---|
| `channel` *(new, D-036)* | `channel: ANY("app","reddit")` |
| `current_visa_or_greencard_category`, `visa_applying_for` | `visa_applying_for: ANY("B-1","B-2")` |
| `consulates`, `primary_consulate` | `consulates: ANY("MUM")` |
| `tags`, `concerns_or_questions_tags` | `tags: ANY("experience-posting")` |
| `source_container` *(was `subreddit`)*, `source_system`, `severity`, `resolution_status` | `severity: ANY("high")` |
| `principal_country_of_chargeability`, `employer_type`, `derived_topic_cluster` | `principal_country_of_chargeability: ANY("IN")` |

- **Sort / recency:** `posting_date`, `ingestion_timestamp`, `last_updated_timestamp`, `tagging_confidence`. "Show recent / only today" → a recency boost or a date-range filter (requires the date/timestamp fields be typed as datetime in the data-store schema — **config item, §18**).
- **Semantic match:** managed embeddings from `embedding_text` + chunked `.md` (D-016); shared controlled-vocabulary tags anchor similar situations described in different words.
- **Citations:** each Answer citation resolves to a `case_id` → the BFF renders a result card (title, snippet, key facets, link to `/v1/posts/{case_id}`).

**Conversational filtering** = the BFF keeps `active_filter` on the session and amends it across turns ("only Mumbai", "only this month", "only app posts") before re-calling the Answer/Search API with the same Vertex session.

---

## 9. Search & grounded-answer flow (`/v1/chat`, intent=search)

```
1. NL query  ──▶ BFF extracts structured filters (Gemini) → merge into session.active_filter
2. BFF → Discovery Engine :answer
      query, session=vertex_session_name, filter=<expr>, page_size,
      boostSpec (recency), citations=on, safe-answer / grounding on
3. ◀── grounded answer text + citations + (optional) related questions
4. BFF → :search (or reuse answer's results) for facet_counts → refinement chips
5. Response: { reply: answer, cards: [from citations/results], citations, facet_counts,
               suggested_followups, active_filter }
```
Subsequent "refine" turns reuse the same Vertex session and updated filter — no re-embedding, minutes-fresh index (D-016).

---

## 10. Posting flow (`/v1/chat` intent=post → `/v1/posts:publish`)

The app is **another ingestion channel** — a confirmed post becomes a first-class, faceted doc in the *same* index, tagged master-vocab-only (D-025), via the *same* contract as Reddit (D-034/D-036).

```
1. "I want to post my H-1B stamping experience…"
        │  intent=post
2. BFF extracts entities (Gemini, canonical fields) → session.draft (partial)
3. BFF asks the next missing high-value question (geo-aware, §7); each answer updates draft
4. When draft is sufficient → DRAFT-REVIEW CARD:
        parsed metadata (visa, consulate, key dates, tags) + the composed .md narrative
5. User explicitly confirms  ──▶  intent=confirm_publish   (HARD GATE: never publish without this)
6. /v1/posts:publish:
     a. compose .md body from the conversation
     b. run the FULL Tagger (LLM-EXTRACTION-PROMPT.md) on the body → canonical JSON
     c. VALIDATOR: structural (schema.py) + master-CSV vocabulary gate
            └─ fail → repair / ask the user to adjust (no silent free-form tags)
     d. mint identity: channel="app", source_system="unclesamcalling",
            source_container=<synthetic_username>, source_native_id=<firestore post doc id>,
            ingestion_method="app_conversational_post",
            case_id = app-<YYYY-MM-DD>-<username>-<post_id>
     e. write sidecar pair  gs://imm-postings-ingestion/<date>/app/<case_id>.{md,json}
     f. BigQuery upsert (prod: Storage Write API + staged MERGE, D-028)
     g. documents.import INCREMENTAL (id=case_id) → searchable in minutes
     h. mirror a post ref in Firestore (posts/{case_id}, user history)
7. Response: { case_id, full_url, status: "published" }
```

- **Reuse, not reimplementation:** steps (b)/(c)/(e)/(g) are the *same* tagger/validator/GCS/import path the Reddit pipeline uses, packaged as a **shared module** so prompt/vocab versions never drift (D-034). Production BQ writes follow D-028.
- **PII (DECIDED, D-038):** explicit **pre-publish consent + a "this will be public" notice on the draft-review card**. **No Cloud DLP / scrub for now** — reversible (DLP can be inserted before `documents.import` later, per D-017's reversibility note).
- **Moderation (DECIDED, D-038):** **Gemini safety filters + policy rules (minimum)** run before `documents.import`; thresholds / appeal flow can tighten later.

---

## 11. Saved searches & alerts (Phase 2)

- **Saved search** = `{query, filters}` in Firestore. **Alert** = a saved search with a subscription.
- **Matching** reuses the **event-driven ingestion trigger** (the `.json` finalize Eventarc event, §17 of the pipeline architecture): a matcher (Cloud Run/Function) evaluates each newly-ingested doc's facets against active saved-search filters → writes a notification doc + sends **FCM**.
- Firestore's real-time listeners deliver the "a new matching posting appeared" UX to the client instantly (D-035).

---

## 12. Firestore data model

| Collection | Doc | Key fields |
|---|---|---|
| `users/{uid}` | account + profile | `synthetic_username`, `country`, `profile{<canonical-aligned facets>}`, `settings`, `created_at` |
| `sessions/{session_id}` | conversation | see §5 (`uid`, geo, `intent_state`, `active_filter`, `draft`, `vertex_session_name`, `turns`, `ttl`) |
| `saved_searches/{id}` | saved query | `uid`, `query`, `filters`, `alert_enabled`, `created_at` |
| `alerts/{id}` | subscription | `uid`, `saved_search_id`, `transport` (fcm/email), `last_notified` |
| `posts/{case_id}` | post ref/mirror | `uid`, `status` (draft/published), `case_id`, `gcs_path`, `full_url`, `created_at` |

- **SoT note:** the GCS sidecar pair remains the source of truth for *posting content/metadata* (D-031); `posts/{case_id}` is only an app-side ref/index for "my posts" + ownership.
- **Security rules:** a user can read/write only their own `users`/`sessions`/`saved_searches`/`alerts` docs; `posts` are readable per visibility; **all writes that mutate the index go through the BFF**, not client-direct.

---

## 13. Auth & security

- **Token verification:** clients sign in with Firebase; the BFF verifies the ID token with the Admin SDK (attached SA, no key files — D-018). Guest (anonymous) tokens permit search; posting/profile require an upgraded account.
- **BFF service account `sa-app-bff`** — least privilege:
  - Discovery Engine: query (`:search`/`:answer`) + `documents.import` on the data store.
  - Vertex AI: Gemini predict (aiplatform user).
  - GCS: write objects under the `app/` prefix of `imm-postings-ingestion`.
  - BigQuery: append via Storage Write API to the staging table (D-028).
  - Firestore: read/write app-state collections.
  - Firebase Auth: token verification.
  - No SA keys; ADC via attached SA; secrets (if any) in Secret Manager only.
- **Domain guardrail:** system prompt restricts the bot to US-immigration topics; a cheap pre-classifier rejects `off_topic` before expensive calls.
- **Abuse / safety:** per-`uid` rate limits; content moderation on posts; the **confirm-before-publish hard gate**; input size caps.

---

## 14. Non-functional requirements

| Concern | Approach |
|---|---|
| **Latency** | Search turn target ~1–3 s (1 Gemini classify + 1 Answer call). Posting turns similar; publish a few seconds (tag + validate + import). No agent-loop hop (Option A). |
| **Cost** | Consumption-priced and scale-to-zero: Cloud Run per-request, Answer API per-query, Gemini per-turn, Firestore per-op (D-016/D-020). **Prompt-cache** the master tag CSVs (~30k tokens) for the tagger; refresh on tag-list edit. Gemini Flash default, Pro only for ambiguous tagging. |
| **Scaling** | Cloud Run autoscale; Firestore + Discovery Engine fully managed. |
| **Idempotency** | `case_id` is the dedup key → re-publish is an upsert across GCS/BQ/data store. |
| **Observability** | Structured Cloud Logging keyed by `session_id`/`uid`/`case_id`; Cloud Trace across BFF→{Gemini, Answer API}; metrics → BigQuery (intent mix, zero-result queries, posting funnel/drop-off, §9 of app-specs). |
| **Reliability** | Retries with backoff on transient GCP errors; failed `documents.import` → DLQ (reuse the search-importer pattern, Phase 2); validator failure → quarantine/repair, never silent. |
| **Freshness** | Event-driven import → minutes-fresh (D-016); acceptable for the search UX. |

---

## 15. Deployment

- **BFF:** container on **Cloud Run**, region `us-central1`, min instances 0 (scale-to-zero), `sa-app-bff`. Config via env; secrets via Secret Manager.
- **Regions:** Gemini + Firestore + GCS + BigQuery in `us-central1`; the Vertex AI Search data store is location `global` (existing).
- **CI/CD:** Cloud Build via Workload Identity Federation, image in Artifact Registry — consistent with the pipeline's `ci-cd/` model (no SA keys).
- **IaC:** the BFF service, `sa-app-bff` + IAM, Firestore database, and Firebase project belong in `infra/` alongside the existing inventory ([DEPLOYMENT.md](../content-ingestion-specifications/DEPLOYMENT.md), [PREREQUISITES-IAM-INFRASTRUCTURE.md](../content-ingestion-specifications/PREREQUISITES-IAM-INFRASTRUCTURE.md)).

---

## 16. Phasing

| Phase | Scope |
|---|---|
| **P1 — Search-first** | BFF with `/v1/chat` (search + general Q&A) + `/v1/search` + profile + Firebase Auth; Answer API over the existing index; Firestore sessions. Fastest grounded-search value; no posting writes yet. |
| **P2 — Posting** | `/v1/posts:draft`/`:publish`; the `app` ingestion channel (tagger→validator→GCS→import); the PII + moderation decisions resolved. |
| **P3 — Alerts & social** | Saved searches + alert matcher (Eventarc + FCM); real-time listeners; (V2) in-app messaging. |

The data tier and ingestion contract are phase-invariant — phases differ only in which BFF capabilities are switched on.

---

## 17. Relationship to the existing ingestion pipeline

The app shares the **single sink** (`imm-postings-datastore`, D-016) and the **canonical contract** (schema + sidecar SoT, D-031). The app channel simply *adds* documents with `channel="app"`; the Reddit pipeline adds `channel="reddit"`. Both use the identical Tagger/Validator/GCS/import code (shared module), so search, faceting, and grounding work uniformly across channels. No second index, no schema fork.

---

## 18. Decisions & dependencies

**Resolved (D-038):**
1. **App-content PII** — explicit pre-publish **consent + "this will be public" notice** on the review card; **no DLP/scrub for now** (reversible).
2. **Date/recency filtering** — type `posting_date` + timestamps as **datetime** in the data-store schema for range filters + recency boost; numeric epoch facet as fallback. *(Config item for P1.)*
3. **App `source_system`** = **`"unclesamcalling"`**.
4. **Answer API specifics** — `servingConfigs :search`/`:answer` + managed multi-turn session + citations; **confirm exact shapes/knobs against live Google docs at build time**.
6. **Production BQ write path** for app posts — **Storage Write API + staged MERGE (D-028)**.
7. **Moderation** — **Gemini safety + policy rules (minimum)** before `documents.import`.

**In flight:**
5. **Live BQ table recreate** (D-037) — being executed; required before app-channel writes land in BigQuery.

**Still open (non-blocking; decided when P1 code lands, own `D-NNN`):**
- **BFF home directory** — `app-backend/` vs `website/`.
- **Enumerated profile field set** — reuses canonical vocabulary (D-035); exact fields TBD.

When P1 scope is approved, the next artifact is the concrete BFF service skeleton (FastAPI routes + Firestore models + Answer-API client) under that directory, recorded with its own `D-NNN`.
