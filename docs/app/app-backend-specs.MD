# Project Overview
This project is an end-2-end of tagging content on US Immigration and its search by Conversational AI

# Project Structure

This project structure consist of following parts:
- Tag specifications [Tagging specification rules](../tagging) rules which forms the basis of how the content posted via mobile or web app) or ingested from reddit.com are tagged and its metadata of tags is created in json file
- Examples of some tagging on how tagging works [vertexai-search-ingestion-from-examples](../vertexai-search-ingestion-from-examples) 
- Architecture of pipeline when ingested from website like reddit.com [content-ingestion-spcifications](../ingestion)


# 
# Vertex AI Search Backend for mobile / webapps / Conversation 
## The specs of this task is to design the Vertex AI Search COnversational APp and how it is used as backend from mobile app/ webapp

> **Full design:**
> - **Backend (server-side)** — components, BFF API surface, conversation/session model, geo routing, search & posting flows, Firestore data model, security/IAM, NFRs, phasing: **[APP-BACKEND-ARCHITECTURE.md](APP-BACKEND-ARCHITECTURE.md)**.
> - **Frontend ↔ backend integration (client-side wire contract)** — auth/session handling, the `/v1/chat` (streaming) contract, render objects (cards/citations/chips/draft-preview), posting + consent gate, alerts/FCM, geo handshake, error handling, platform specifics: **[APP-FRONTEND-INTEGRATION.md](APP-FRONTEND-INTEGRATION.md)**.
>
> The sections below are the decision summaries + the Vertex AI Search integration reference those docs build on.


## Conversational orchestration layer — Option A (DECIDED, D-034)

The layer the mobile/web apps talk to is a **custom stateless FastAPI service on Cloud Run + Gemini** (the backend-for-frontend / BFF). It owns the conversation loop — intent recognition, multi-turn context, geo-aware proactive prompting, conversational filtering, the posting/draft-review flow, and domain guardrails — and delegates the two fixed sub-capabilities:

- **Search + grounded answer** → the Vertex AI Search **"Search + Answer" API** over `imm-postings-search-app` / `imm-postings-datastore` (hybrid retrieval + facet filters + Gemini answer with citations).
- **Posting (app as an ingestion channel)** → the existing **Tagger (`LLM-EXTRACTION-PROMPT.md`) → Validator → GCS-Writer → `documents.import`** contract, kept as a **shared module** so the Reddit pipeline and the app channel never drift on vocab/prompt version.

**Session state** is persisted in the app-state store (not a separate store): Cloud Run is ephemeral/scale-to-zero and Gemini is stateless per call, so one record per `session_id` holds the turn history, the accumulating per-session posting-draft metadata JSON, intent + geo branch, user reference, and the Vertex Answer-API session name.

Option B (Agent Builder Search+Answer consumed directly) and Option C (ADK agent on Agent Engine) were not chosen; the full comparison and the explicit "why not C" rationale are in [orchestration-options-tradeoffs.md](orchestration-options-tradeoffs.md) (§8) and recorded as **D-034** in [MEMORY.md](../MEMORY.md).

## App identity + state store — Firebase Auth + Firestore (DECIDED, D-035)

- **Identity: Firebase Authentication** — email / Google / Apple + anonymous-guest (search-before-sign-up, upgradable to a permanent account). The BFF verifies Firebase JWT ID tokens via the Admin SDK on an attached SA (no SA key files, D-018). An app-generated **synthetic reddit-style username** is stored on the profile; email/real name are never exposed.
- **State store: Firestore (Native mode), `us-central1`** — holds all user-scoped operational app state: profile, conversation sessions (turn history + the accumulating per-session posting-draft metadata JSON + intent + geo branch), saved searches + alert subscriptions, posting history/drafts, and (V2) messaging. Analytics/telemetry stays in **BigQuery**, not Firestore.
- **Access pattern:** writes are **BFF-mediated only**; **optional read-only client-direct Firestore listeners** (security-rules-guarded) power real-time alerts + session live-updates.
- **Profile reuses the canonical field vocabulary** (`current_visa_or_greencard_category`, `principal_country_of_chargeability`, …) so a profile can seed a posting draft and pre-filter searches.
- This is *app state*, separate from the ingestion pipeline — it does **not** reintroduce the pipeline's Firestore (D-013 stands). Full options/rationale: [app-state-store-auth-options.md](app-state-store-auth-options.md) (§8).

## App as an ingestion channel — generic identity (DECIDED, D-036)

Posting-via-chat is "another ingestion channel" and reuses the existing **Tagger (`LLM-EXTRACTION-PROMPT.md`) → Validator → GCS-Writer → `documents.import`** contract unchanged (tagging stays master-vocab-only, D-025). The canonical schema is now **channel-agnostic** (D-036), so the app — and any future website channel (Firecrawl) — fits with no schema change:

- `case_id` = `<channel>-<YYYY-MM-DD>-<container>-<native_id>` (generalized from the Reddit-only prefix). App example: `app-2026-05-29-quiet_falcon_42-<firestore_id>`.
- New **`channel`** field (`reddit|app|web|…`) — first-class search facet; for the app it is `app`.
- Generic provenance: **`source_container`** (app = synthetic username), **`source_native_id`** (app = Firestore posting doc id; idempotency key), `source_system` = **`unclesamcalling`** (the app name, D-038), `ingestion_method` = `app_conversational_post`. Old Reddit field keys remain valid via aliases (existing corpus unchanged).
- The posting's metadata JSON is produced by the **BFF + Gemini** conversation, validated against the master vocab, written as a sidecar pair under `gs://imm-postings-ingestion/<date>/app/`, then imported.

Full options/rationale: [generic-channel-identity-options.md](generic-channel-identity-options.md). **Deferred (per D-036):** app-content PII posture; syncing the live pipeline code (`ingest_batch.py`, BigQuery columns/clustering) to the generic field names before the next pipeline run.

## Components

| Component | File / Path |
|---|---|
| Master tag vocabularies | [tags-cleaned/](../../backend/tags-cleaned/) (10 CSVs) |
| Canonical JSON schema | [JSON-SCHEMA-FIELD-DICTIONARY.md](JSON-SCHEMA-FIELD-DICTIONARY.md) |
| Tagger system prompt | [LLM-EXTRACTION-PROMPT.md](LLM-EXTRACTION-PROMPT.md) |
| Existing corpus | [postings-examples/](../postings-examples/) (72 cases) |
| Forward-looking improvements | [TAGGING-EVALUATION.md](TAGGING-EVALUATION.md) |

## Vertex AI Search integration

| Concern | Recommendation |
|---|---|
| Document ID | `case_id` |
| Primary embedding field | `embedding_text` |
| Facet fields | `channel`, `current_visa_or_greencard_category`, `visa_applying_for`, `consulates`, `primary_consulate`, `tags`, `concerns_or_questions_tags`, `source_container` (was `subreddit`), `source_system`, `severity`, `resolution_status`, `principal_country_of_chargeability`, `employer_type`, `derived_topic_cluster` |
| Sortable fields | `posting_date`, `ingestion_timestamp`, `last_updated_timestamp`, `tagging_confidence` |
| Date-range filters | `key_dates.*` (ISO-8601 enables range queries) |

## Operational notes

- **Model**: Gemini Flash for bulk re-tagging, Gemini Pro for ambiguous cases.
- **Prompt caching**: Cache the master tag CSVs in the prompt (~30k tokens); refresh on tag-list edit.
- **Validation gate**: Block ingestion on validator failure; quarantine until manually resolved.
- **Telemetry**: Track `tagging_confidence` distribution and `severity` mix to detect drift.
