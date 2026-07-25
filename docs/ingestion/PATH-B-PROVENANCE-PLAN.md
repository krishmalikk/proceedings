# Path B: Real Provenance for Backend-Ingested Content

**Status**: PLANNING — for review. **No code implemented yet.**
**Context**: [`MANUAL-CURATION-PLAYBOOK.md`](MANUAL-CURATION-PLAYBOOK.md) first
identified this gap (its "Path A vs. Path B" distinction) when the curation
scripts in `scripts/curation/` were built. Every publish since then —
`i485-approved`, `i485-asylum-approved`, `h1b-cos-timeline`, etc. — has gone
through Path A, meaning none of it currently carries accurate provenance.
This doc plans the fix.

## The problem, confirmed

Investigated what actually gets recorded today: **there is zero distinguishing
signal between a webapp submission, a mobile-app submission, and our backend
curation scripts.** All three call the same `/api/postings` route, which
hardcodes every provenance field regardless of caller:

| Field | Current value (always, regardless of source) |
|---|---|
| `channel` | `"app"` |
| `ingestion_method` | `"user_post"` |
| `source_system` | `"meridianjourney"` |
| `subreddit` / `reddit_post_id` | `""` (empty) |
| `full_url` | `{APP_BASE_URL}/case/{case_id}` (fabricated, not a real Reddit permalink) |
| `posting_date` | `datetime.now()` at publish time — today's date, not the original Reddit post's date |

Every post curated and published this session is sitting in GCS, BigQuery,
and the search index indistinguishable from an organic first-party
submission.

## Field design

No new schema fields — the canonical schema is already channel-agnostic
(`subreddit`/`reddit_post_id` have existed since the original design, per
D-036) and just needs to actually be populated correctly. Two existing
fields' *meanings* get clarified and separated rather than changed:

| Field | Meaning (clarified) | App/webapp/mobile | Backend pipeline (Reddit) |
|---|---|---|---|
| `channel` | Coarse pathway, drives search boost (`search_client.py` already has an unused `channel:"reddit"` boost wired in) | `"app"` | `"reddit"` |
| `ingestion_method` | How the content entered our system | `"user_post"` (unchanged; also `"user_experience"`/`"user_connect_card"` for phase-J, unchanged) | `"manual_curation"` — reserving `"automated_scrape"` and `"official_api"` as future values once those paths exist (Apify / licensed API, per `REDDIT-INGESTION-ALTERNATIVES.md`) |
| `source_system` | Platform-level provenance identity (this is the field's original D-055 design intent — just never applied to non-app content until now) | `"meridianjourney"` | `"reddit"` |
| `subreddit`, `reddit_post_id`, `full_url` | Real source-platform identifiers | empty / app-derived (unchanged) | real subreddit name, real post ID, real `reddit.com` permalink |
| `posting_date` | **The original posting date** — what a reader sees as "posted on" | `now()` (unchanged — for a live submission, posting *is* the ingestion moment, so this is already correct) | the **true original Reddit post date**, not today |
| `ingestion_timestamp` | **When *our* system processed it** — unrelated to when the content was originally authored | `now()` (unchanged) | `now()` (unchanged — this is correctly "when we ingested it," and should stay `now` even for backdated Reddit content) |

`channel` + `ingestion_method` together fully distinguish all three
sources. `source_system` + `subreddit` + `reddit_post_id` + `full_url`
together identify the specific backend source precisely. `posting_date`
(original) vs. `ingestion_timestamp` (ours) are cleanly separated using
fields that already exist today but are currently both hardcoded to `now`.

## Why this needs a new, non-public code path — not new params on `/api/postings`

`/api/postings` is hit by real, unauthenticated end-users (webapp + mobile).
If `channel`, `posting_date`, `source_system`, etc. were exposed as request
parameters there, **any user could claim their post is from Reddit, or
backdate it** — a real integrity problem for a product whose value depends on
grounded, honest content. Path B must be a separate path a normal user
request can never reach, not a new field on the public route.

## Implementation plan (not yet built)

1. **Extend `build_canonical()`** (`backend/posting.py`) with optional
   override parameters — `channel`, `ingestion_method`, `source_system`,
   `subreddit`, `reddit_post_id`, `full_url`, `posting_date`. Each defaults
   to today's hardcoded value, so `/api/postings`'s existing behavior is
   unchanged when it doesn't pass them — this is an additive, backward-
   compatible signature change, not a rewrite.
2. **Add `publish_reddit_posting()`** to `posting.py` — mirrors
   `publish_posting()`'s orchestration (build canonical → `validate()` →
   `_write_gcs()` → `_import_to_datastore()` → `_write_bigquery()`) but
   threads the real Reddit metadata through. **Not wired to any FastAPI
   route** — callable only from a script, per the security reasoning above.
3. **New script** (Python, not bash+curl like the current
   `scripts/curation/*.sh` — needs direct access to `posting.py` internals
   and real GCP credentials, same pattern as running
   `backend/tests/test_posting_tagging.py` locally with ADC). Reads a
   curated post + its reviewed tags + the real subreddit/`reddit_post_id`/
   date — which `scripts/curation/reddit-export.py` already captures when
   it's usable, or which a manual curator supplies by hand otherwise — and
   calls `publish_reddit_posting()` directly.

## Open question: backfill existing content

Everything published so far this session currently has `channel="app"`,
`ingestion_method="user_post"`, and today's date as `posting_date` — all
incorrect once Path B exists. Two options, **not decided yet**:
- **Backfill**: delete + republish each via Path B with correct provenance.
- **Leave as-is**: only apply Path B going forward; treat already-published
  content as a known, accepted inaccuracy from before this fix existed.

## Testing plan (once implementation is approved)

Same pattern as the last four fixes in this repo (`timeline`, visa-backfill,
`family-based-immigration`, cross-bucket-duplicate): unit tests against
`build_canonical()`'s new optional parameters directly (no network needed),
confirming (a) omitting the new params reproduces today's exact behavior
byte-for-byte, (b) passing them produces the correct overridden values, and
(c) `validate()` still behaves correctly against Reddit-shaped canonical
docs. A live smoke-test publish + cleanup (mirroring test group G) once
merged and deployed.

## Non-goals for this plan

- Does not change anything about the legal/access-method questions already
  covered in `REDDIT-INGESTION-ALTERNATIVES.md` and
  `APIFY-SCRAPER-LEGAL-AND-INTEGRATION.md` — this is purely about correctly
  recording provenance for whatever content legitimately gets published,
  regardless of how it was sourced.
- Does not add authentication/authorization infrastructure — "non-public"
  here means "not reachable via any HTTP route a normal user's browser or
  app can hit," achieved simply by not exposing it as an API endpoint, not
  by adding a new auth layer.
