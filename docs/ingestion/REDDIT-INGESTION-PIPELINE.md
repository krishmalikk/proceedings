# Reddit → GCS → Vertex AI Search Ingestion Pipeline

**Status**: DRAFT — original requirements doc (v1). **Architecture superseded** by
[PIPELINE-ARCHITECTURE-WORKFLOW.md](PIPELINE-ARCHITECTURE-WORKFLOW.md).
**Last updated**: 2026-05-18

> **Authoritative decisions live in [PIPELINE-ARCHITECTURE-WORKFLOW.md](PIPELINE-ARCHITECTURE-WORKFLOW.md):**
> agentic design on Vertex AI Agent Engine; **single sink = Vertex AI Search**;
> **event-driven GCS→Vertex AI Search import** as the primary ingestion path
> (daily auto-sync = reconciliation backstop only); **no Firestore** (BigQuery is
> the dedup/watermark store); **streaming Vertex AI Vector Search rejected** on
> cost grounds. Where this v1 doc's diagrams/components differ (e.g. Firestore,
> `imm-ingest-firecrawl-md` bucket, "auto-sync daily"), the architecture doc wins.

This document specifies the original requirements and prerequisites for an automated pipeline that:

1. **Crawls** new posts from a configured Reddit subreddit (e.g. `r/h1b`).
2. **Converts** each post's raw content into a Markdown file (`caseN.md`).
3. **Tags** the post using the [tagging specifications](../tagging/) in this repo, producing a canonical JSON metadata file (`caseN.json`).
4. **Uploads** both files to a Google Cloud Storage bucket.
5. **Triggers** Vertex AI Search ingestion into a data store that already follows the canonical schema.

---

## 1. Goals & Non-goals

### Goals
- Continuous ingestion of new candidate postings from one or more subreddits.
- Each posting in the GCS bucket conforms exactly to the existing `postings-examples/case-N/` shape so Vertex AI Search treats it identically to the seed corpus.
- Tagging is deterministic and validated; no posting reaches the data store with out-of-vocabulary tags or schema violations.
- Idempotent — re-running the pipeline on the same posting produces the same artifacts and does not double-index.

### Non-goals
- Real-time (sub-second) ingestion. A 5–15 minute crawl cadence is sufficient.
- Multi-platform crawling (Twitter, Quora, etc.) — separate spec if needed.
- UI for browsing posts — Vertex AI Search frontend is out of scope.

---

## 2. Architecture

### 2.1 Component diagram & data flow — see the authoritative architecture doc

The end-to-end component diagram and step-by-step data flow are maintained
**only** in [PIPELINE-ARCHITECTURE-WORKFLOW.md §2](PIPELINE-ARCHITECTURE-WORKFLOW.md)
(agentic design on Vertex AI Agent Engine, 5 Cloud Run tools, **BigQuery** as the
dedup/watermark store, single **Vertex AI Search** sink fed by **event-driven
import**). That diagram supersedes the earlier v1 sketch.

High-level summary (no Firestore; no Cloud DLP; no Vector Search):

```
Cloud Scheduler → Agent Engine (Scraper → Tagger → Validator
  → GCS-Writer → BQ-Writer)
        │                         │
        ▼                         ▼
  GCS sidecar (.md/.json)    BigQuery postings_metadata
        │   (.json finalize)      (dedup + watermark + analytics)
        ▼
  Eventarc → search-importer → Vertex AI Search data store
        │   (daily auto-sync = reconciliation backstop only)
        ▼
  Applicant chatbot (Vertex AI Search & Conversation)
```

### 2.2 Data flow

| Step | Source | Action | Sink |
|---|---|---|---|
| 1 | Cloud Scheduler | Triggers the ingestion agent run | Agent Engine |
| 2 | Reddit API (PRAW) | Fetch posts newer than the high-watermark | In-memory |
| 3 | **BigQuery** dedup query | Drop posts already processed (by `reddit_post_id`) | In-memory |
| 4 | LLM tagger (Gemini on Vertex AI) | Generate canonical JSON from raw post | In-memory JSON |
| 5 | Validator | Vocabulary + dedup + ISO-date checks | Pass or quarantine |
| 6 | GCS uploader | Write `<case_id>.md` and `<case_id>.json` atomically | GCS object pair |
| 7 | **BQ-Writer** | Upsert metadata row keyed by `reddit_post_id` / `case_id` | BigQuery |
| 8 | Eventarc → `search-importer` | `documents.import` on `.json` finalize | Vertex AI Search |

### 2.3 Trust & failure boundaries

- **External dependencies**: Reddit API, Vertex AI Gemini, Vertex AI Search. Each must have circuit breakers and retry logic.
- **Internal idempotency**: every record keyed by `reddit_post_id` so re-runs are safe.
- **Quarantine path**: any post that fails validation is written to `gs://imm-postings-ingestion/<date>/reddit/_quarantine/<case_id>.{md,json}` for manual review; not indexed.

---

## 3. Prerequisites

### 3.1 Google Cloud
- GCP project with billing enabled.
- Enable APIs:
  - `aiplatform.googleapis.com` (Vertex AI)
  - `discoveryengine.googleapis.com` (Vertex AI Search)
  - `run.googleapis.com` (Cloud Run)
  - `cloudscheduler.googleapis.com` (Cloud Scheduler)
  - `storage.googleapis.com` (Cloud Storage)
  - `secretmanager.googleapis.com` (Secret Manager)
  - `bigquery.googleapis.com` (BigQuery — dedup/watermark/analytics store)
  - `eventarc.googleapis.com` + `pubsub.googleapis.com` (Phase 2 event-driven import)
  - `logging.googleapis.com` and `monitoring.googleapis.com`
- Region: pick one (recommend `us-central1` for Vertex AI affinity).

### 3.2 GCS bucket
- Bucket name: `imm-postings-ingestion` (already created).
- Storage class: `STANDARD`.
- Versioning: enabled (for audit / rollback).
- Lifecycle rule: optional — move objects older than 18 months to `NEARLINE`.
- Layout (date/channel partitioned; sidecar pair shares the `case_id` basename):
  ```
  gs://imm-postings-ingestion/
  ├── 2026-05-18/reddit/
  │   ├── reddit-2026-05-18-h1b-1srn4ab.md
  │   ├── reddit-2026-05-18-h1b-1srn4ab.json
  │   └── _quarantine/
  │       └── reddit-2026-05-18-h1b-1xyz.{md,json} + _errors.txt
  └── 2026-05-18/<other-channel>/ …
  ```

### 3.3 Vertex AI Search data store
- Type: **Unstructured data + Structured metadata** ("media + metadata" data store).
- Schema: matches the JSON in [JSON-SCHEMA-FIELD-DICTIONARY.md](../tagging/JSON-SCHEMA-FIELD-DICTIONARY.md).
- Document ID field: `case_id`.
- Embedding source: `embedding_text` field of the JSON.
- Facet fields: `current_visa_or_greencard_category`, `visa_applying_for`, `consulates`, `tags`, `concerns_or_questions_tags`, `subreddit`, `severity`, `resolution_status`, `principal_country_of_chargeability`, `employer_type`, `derived_topic_cluster`.
- Sortable fields: `posting_date`, `ingestion_timestamp`, `tagging_confidence`.
- Sync mode: **periodic from GCS** (recommended 1×/day) or **on-demand** triggered after each batch.

### 3.4 Vertex AI Gemini model
- Model: `gemini-2.5-flash` for bulk tagging (cost-optimized).
- Optional: `gemini-2.5-pro` fallback for low-confidence retries.
- Region: same as Vertex AI Search.
- Quota check: tagging ~10,000 posts/day with avg 4k input tokens needs ≈40M tokens/day — within default quota but worth confirming.
- Enable **prompt caching** for the 10 master tag CSVs (~30k tokens cached); refresh on tag-list edits.

### 3.5 Reddit API access
> **Gated, critical-path prerequisite.** Self-service access was removed by Reddit (late-2024). Credentials require a **Data API access request (form) + Responsible Builder Policy approval** (~days non-commercial, weeks commercial). Devvit `server/reddit-api` is **not** an alternative for this external GCP pipeline. Authoritative runbook: [PREREQUISITES-IAM-INFRASTRUCTURE.md §7](PREREQUISITES-IAM-INFRASTRUCTURE.md).
- Submit the non-commercial Data API access request, then register a Reddit app: https://www.reddit.com/prefs/apps → "script" type.
- Capture: `client_id`, `client_secret`, `user_agent`.
- Comply with Reddit's [Data API Terms](https://www.redditinc.com/policies/data-api-terms) — pay particular attention to:
  - Rate limit: 60 req/min per OAuth client (10/min unauthenticated).
  - Caching / redistribution rules.
  - Required attribution and removal-on-deletion rules.
- Choose subreddits to crawl (initial scope): `r/h1b`, `r/USVisas`, `r/usvisascheduling`.

### 3.6 IAM / service accounts
Create one service account `reddit-ingest@<project>.iam.gserviceaccount.com` with these roles:

| Role | Why |
|---|---|
| `roles/aiplatform.user` | Call Gemini for tagging |
| `roles/storage.objectAdmin` on the bucket | Write `.md` + `.json` files |
| `roles/bigquery.dataEditor` on the `postings` dataset | Dedup + watermark + metadata rows |
| `roles/secretmanager.secretAccessor` | Read Reddit credentials |
| `roles/run.invoker` | Scheduler triggers the agent / tools |
| `roles/logging.logWriter` | Write structured logs |
| `roles/monitoring.metricWriter` | Custom metrics |

The Vertex AI Search data store reads the bucket via its own service agent (`service-<project-number>@gcp-sa-discoveryengine.iam.gserviceaccount.com`) — grant it `roles/storage.objectViewer` on the bucket.

### 3.7 Secret Manager
- `reddit-client-id`
- `reddit-client-secret`
- `reddit-user-agent` (literal string per Reddit's policy, e.g. `linux:tags-master:v1.0 (by /u/<your-handle>)`)
- (no refresh token needed for read-only public subreddits)

### 3.8 Local artifacts consumed
The pipeline reads these files from the repo at build time (baked into the container image):

| File | Used by |
|---|---|
| [tagging/LLM-EXTRACTION-PROMPT.md](../tagging/LLM-EXTRACTION-PROMPT.md) | Tagger module |
| [tagging/JSON-SCHEMA-FIELD-DICTIONARY.md](../tagging/JSON-SCHEMA-FIELD-DICTIONARY.md) | Validator module |
| [tags-cleaned/*.csv](../../backend/tags-cleaned/) | Tagger (vocabulary), Validator |

---

## 4. Component specifications

### 4.1 Crawler (PRAW)
**Input**: Subreddit names, high-watermark timestamp.
**Output**: Iterable of post records `{id, title, selftext, url, created_utc, author, permalink, subreddit, score, num_comments}`.

Behavior:
- Use `praw.Reddit(...)` with read-only credentials.
- Pull `r/<sub>.new(limit=100)` per subreddit per run.
- Filter to posts with `created_utc > last_watermark`.
- Filter out: removed posts, comment-only posts, posts shorter than 200 chars (likely low-value).
- Sleep 1s between subreddits (rate-limit politeness).
- On Reddit 429: exponential backoff (1, 2, 4, 8 seconds; max 3 retries).

### 4.2 Markdown converter
**Input**: A post record.
**Output**: A Markdown string for `caseN.md`.

Format:
```markdown
# <full_url>

<title>

<selftext>
```

That matches the existing 72-case corpus convention exactly.

### 4.3 Tagger (Gemini on Vertex AI)
**Input**: `case_id`, Markdown content, plus the master tag CSVs (loaded via prompt caching).
**Output**: Canonical JSON.

Implementation notes:
- Use Vertex AI's Gemini API (`google-cloud-aiplatform` SDK or the newer `google-genai` package).
- System prompt: full content of [LLM-EXTRACTION-PROMPT.md](../tagging/LLM-EXTRACTION-PROMPT.md).
- Temperature: 0.1, top_p: 0.9.
- Response MIME type: `application/json`.
- Max output tokens: 2,000.
- Enable JSON schema constraint if available in the SDK (eliminates JSON-parse retries).
- Retry once on validation failure with the previous output + the validator's error appended to the prompt.

### 4.4 Validator
**Input**: A JSON object claiming to be canonical metadata.
**Output**: `valid=True` / `valid=False, errors=[...]`.

Rules (full list in [JSON-SCHEMA-FIELD-DICTIONARY.md §3](../tagging/JSON-SCHEMA-FIELD-DICTIONARY.md)):
- Required fields present.
- Every visa/GC tag ∈ sections 1.1/1.2 vocab.
- Every consulate code ∈ section 1.4 vocab.
- Every `tags` / `concerns_or_questions_tags` element ∈ sections 1.3/1.5/1.6/1.9/1.10 vocab.
- Every `key_stages_or_info` key ∈ section 1.7 ∪ 1.1/1.3/1.5/1.6.
- Every `key_dates` key ∈ section 1.8 AND value matches `^\d{4}-\d{2}-\d{2}$`.
- 5-field dedup rule (no tag in more than one of `current_*`, `consulates`, `tags`, `concerns_*`).
- Enums (`employer_type`, `severity`, `resolution_status`) valid.
- `tagging_confidence ∈ [0.0, 1.0]`.
- `ingestion_timestamp` / `last_updated_timestamp` match ISO-8601 with `T...Z`.
- `source_uri` matches `r/<subreddit>` shape.

A validator that fails on any rule routes the JSON + MD to the `_quarantine/` GCS folder along with an `_errors.txt`.

### 4.5 GCS uploader
**Input**: `case_id`, MD string, JSON dict.
**Output**: Two GCS objects, written atomically (MD first, JSON second).

Path scheme: `gs://imm-postings-ingestion/<YYYY-MM-DD>/reddit/<case_id>.{md,json}` where `case_id` = `reddit-<YYYY-MM-DD>-<subreddit>-<post_id>` (deterministic — no counter, no Firestore).

Metadata on each object:
- `Content-Type: text/markdown` or `application/json`.
- Custom metadata: `reddit-post-id`, `subreddit`, `posting-date`, `tagging-confidence`.

### 4.6 Vertex AI Search ingestion — DECIDED: event-driven

> **Decision (final): single sink = Vertex AI Search, fed by an EVENT-DRIVEN import.**
> Each `.json` landing in GCS triggers Eventarc → a `search-importer` Cloud Run
> service → `discoveryengine.documents.import` (INCREMENTAL, id=`case_id`),
> making the document searchable in minutes. The daily GCS auto-sync is retained
> **only as a reconciliation backstop**. Streaming Vertex AI Vector Search was
> evaluated and **rejected** on cost grounds. Full design + rationale:
> [PIPELINE-ARCHITECTURE-WORKFLOW.md §17 and §15.1 / Appendix A](PIPELINE-ARCHITECTURE-WORKFLOW.md).

| Mechanism | Role |
|---|---|
| **Event-driven import** (Eventarc → `search-importer` → `documents.import`) | **Primary** ingestion path (minutes-fresh) |
| **Daily GCS auto-sync** | Reconciliation backstop only (sweeps anything an event missed) |
| Streaming Vertex AI Vector Search | **Not used** — rejected (always-on serving cost; minutes latency is acceptable) |

(The earlier "auto-sync daily" answer in §9 was the bring-up choice; the architecture has since standardized on event-driven import as the primary path with the daily sync demoted to a backstop.)

### 4.7 Dedup / watermark register (BigQuery — no Firestore)

There is **no Firestore**. BigQuery `postings.postings_metadata` is the single
dedup + watermark + analytics store (decision: PIPELINE-ARCHITECTURE-WORKFLOW.md §3.3).

- **Dedup**: a post is already processed iff `SELECT 1 FROM postings.postings_metadata WHERE reddit_post_id = @id` returns a row. The BQ-Writer upserts with `MERGE` on `case_id`, so re-runs never duplicate.
- **Watermark**: `SELECT MAX(posting_date) FROM postings.postings_metadata WHERE subreddit = @s` (or a small `ingest_watermark` table if per-subreddit `created_utc` precision is needed).
- **No `case_id` counter needed**: `case_id` is deterministic — `reddit-<YYYY-MM-DD>-<subreddit>-<post_id>` (comment docs append `__c_<comment_id>`). It is recomputable from the source, so it doubles as the idempotency key. No sequence/transaction allocation.
- **Audit log**: the same table (queryable; `index_state` tracks ingestion status).

---

## 5. Implementation steps (in order)

### 5.1 Infrastructure setup (one-time)
1. Create / select the GCP project; enable the APIs listed in §3.1.
2. Create the GCS bucket per §3.2 (versioning ON, lifecycle rules optional).
3. Create the service account per §3.6; grant the listed IAM roles.
4. Create Secret Manager secrets per §3.7.
5. Create the BigQuery dataset `postings` + `postings_metadata` table (DDL from `schema.py` `BIGQUERY_SCHEMA`) — this is the dedup/watermark store (no Firestore).
6. Create the Vertex AI Search data store per §3.3 (use `gcloud alpha discovery-engine` or the console). Bind the GCS source URI pattern and the schema.

### 5.2 Application code
1. Set up the Python project (`pyproject.toml`, dependencies: `praw`, `google-cloud-storage`, `google-cloud-bigquery`, `google-cloud-secret-manager`, `google-cloud-aiplatform`, `pydantic`).
2. Implement each module from §4 in its own file: `crawler.py`, `markdownify.py`, `tagger.py`, `validator.py`, `gcs_uploader.py`, `bq_writer.py`, `main.py`.
3. Bake the 10 master tag CSVs and the LLM extraction prompt into the container at build time. Load them once at module import.
4. Unit tests per module (pytest); integration test that uses the existing case-1 / case-3 as fixtures.
5. End-to-end smoke test against a known public r/h1b post (use a captured fixture so tests are deterministic).

### 5.3 Containerization
1. `Dockerfile` based on `python:3.12-slim`.
2. Copy code + master CSVs + extraction prompt into image.
3. `ENTRYPOINT ["python", "-m", "ingest.main"]`.
4. Build via Cloud Build: `gcloud builds submit --tag <region>-docker.pkg.dev/<project>/ingest/reddit-ingest:<git_sha>`.

### 5.4 Deployment
1. Create Cloud Run **job** (not service — job semantics fit a periodic batch).
2. Bind the service account from §3.6.
3. Set environment variables: `GCS_BUCKET=imm-postings-ingestion`, `BQ_DATASET=postings`, `SUBREDDITS=h1b,USVisas,usvisascheduling`, `MAX_POSTS_PER_RUN=200`, `DRY_RUN=false`.
4. Mount Secret Manager secrets as environment variables.
5. Configure: 1 CPU, 1 GiB memory, max retries 1, task timeout 30 min.

### 5.5 Scheduling
1. Create Cloud Scheduler job with cron `*/10 * * * *` (every 10 minutes) targeting the Cloud Run job's `runs.run` endpoint via OIDC token.
2. Optionally a second Cloud Scheduler job triggers Vertex AI Search data store sync (if on-demand mode is chosen).

### 5.6 Monitoring & alerts (set up before going live)
- Log-based metric: `validation_failures_total` (label by error type).
- Metric alert: page if validation failure rate > 5% over 1 hour.
- Metric alert: warn if no successful ingest in 60 minutes.
- Metric alert: page if Reddit 429 rate > 10/min.
- Dashboards: posts/hour, tagging_confidence distribution, severity mix, top tags.

---

## 6. Configuration reference

| Variable | Default | Notes |
|---|---|---|
| `GCS_BUCKET` | `imm-postings-ingestion` | Destination bucket |
| `BQ_DATASET` | `postings` | BigQuery dedup/watermark/metadata dataset |
| `SUBREDDITS` | `h1b,USVisas,usvisascheduling` | Comma-separated subreddit names (Phase 1) |
| `MAX_POSTS_PER_RUN` | `200` | Cap per execution to limit cost |
| `MIN_POST_LENGTH_CHARS` | `200` | Filter trivially short posts |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Tagger model |
| `GEMINI_FALLBACK_MODEL` | `gemini-2.5-pro` | Used on tagging_confidence < 0.6 |
| `DRY_RUN` | `false` | If true, log results but don't write to GCS / BigQuery |
| `LOG_LEVEL` | `INFO` | `DEBUG` for development |

---

## 7. Operational concerns

### 7.1 Deduplication
- Primary key: Reddit's `post_id` (e.g. `1srn4ab`).
- **BigQuery** lookup (`WHERE reddit_post_id = @id`) before tagging — saves ~100% of Gemini cost on already-processed posts.
- `case_id` is deterministic (`reddit-<date>-<sub>-<post_id>`), so it doubles as the idempotency key; BQ-Writer `MERGE`s on it (no counter, no transaction).

### 7.2 Rate limits
- Reddit: 60 req/min per OAuth client. With 3 subreddits at 100 posts/run × 1 listing call each, we're ~3 req/run — well below.
- Gemini: default 240 QPM per region. With batch size 200/run × 1 call/post + 1 retry, peak ~400 calls in 30 min — fine.

### 7.3 Error handling & retries
- Reddit 5xx: 3 retries with backoff.
- Gemini failures: 1 retry with augmented error prompt; if still failing, quarantine.
- GCS upload partial failure (MD wrote, JSON didn't): delete the orphan MD and quarantine.
- BigQuery writes: idempotent `MERGE` on `case_id`.

### 7.4 Reddit Terms of Service
- Respect the Data API Terms: no redistribution of user content outside Reddit allowed without compliance.
- **Deletion propagation**: if a post is deleted on Reddit, our copy must be deleted too. Implement a daily reconciliation job that re-checks `<post_id>.is_removed` and deletes the GCS pair + Vertex document if true.
- **Author handle**: do not store the Reddit `author` handle in the canonical JSON or display it in search results (it is not part of the schema).

### 7.5 Sensitive data — Cloud DLP dropped
- **Decision**: Reddit public postings are **not treated as containing sensitive data**, so the pipeline has **no Cloud DLP / PII-Guard de-identification stage** (authoritative rationale: PIPELINE-ARCHITECTURE-WORKFLOW.md §3.5).
- Residual posture: structured fields are **controlled vocabulary** (cannot carry free-form PII by construction); `background_summary`/`concerns_or_questions_summary` are LLM **paraphrases**, not verbatim copies; the `.md` stores the public post as-is (already public on reddit.com).
- Reversible: if a future source/policy needs scrubbing, a DLP (or equivalent) step can be reinserted between Scraper and Tagger with no schema or downstream change.

### 7.6 Cost (back-of-envelope)
| Cost driver | Estimate at 5,000 posts/month |
|---|---|
| Cloud Run | ~$3 (compute time) |
| Gemini 2.5 Flash | ~$15 (~4k in + 1k out per post @ Flash pricing) |
| Vertex AI Search | $5–$15 (depends on query volume; ingestion is free) |
| GCS storage | <$1 (small text files) |
| BigQuery | <$1 (storage + Storage Write API writes + scheduled MERGE) |
| **Total** | **~$25–$35 / month** |

### 7.7 Disaster recovery
- Bucket versioning + BigQuery table snapshots/exports cover most loss scenarios.
- Re-ingestion is idempotent: restoring from a backup and re-running the pipeline will not duplicate documents.

---

## 8. Testing strategy

| Layer | Approach |
|---|---|
| Unit | pytest per module with mocks for Reddit/Gemini/GCS |
| Schema | re-use the validator from §4.4 as a pytest fixture against the 72-case corpus to confirm zero regressions |
| Integration | Stage env hits a sandbox subreddit (e.g. `r/test`) with a few seeded posts |
| E2E | A canary post on a private subreddit owned by the team; assert it appears in Vertex AI Search results |
| Load | Synthetic 1k-post batch through the pipeline; measure latency, cost, and Gemini retry rate |

---

## 9. Open questions for review

1. **Subreddit scope**: Beyond `r/h1b`, `r/USVisas`, `r/usvisascheduling` — any others? (e.g. `r/USCIS`, `r/immigration`, `r/eb1`, `r/IMG`).
yes, want to include those subreddits as well, after first pilot is complete and successful.
3. **Crawl direction**: New posts only (forward), or also a one-time backfill of e.g. the past 6 months of high-engagement posts?
yes, want to include those one-time backfill as well, after first pilot is complete and successful.
3. **Comments**: Should the pipeline ingest top-level comments as separate documents, or only the original post? Comments often contain the actual answer.
ONly top level comments having more than 5 upvotes should be included
4. **Author / PII policy**: Confirm we mask A-numbers, SSNs, receipt numbers in the stored MD. Anything else? (Phone numbers, email addresses, employer names?)
No PII, personal information should be captured
UPDATE: Cloud DLP / PII-Guard has since been **dropped** — Reddit public postings are not treated as sensitive data (PIPELINE-ARCHITECTURE-WORKFLOW.md §3.5). The intent (no PII in structured metadata) is still met by design: structured fields are controlled vocabulary and summaries are LLM paraphrases, not verbatim copies. No de-identification service is provisioned.
5. **Existing `case_id` numbering**: The seed corpus is case-1…case-73 (case-45 missing). Should new ingest reuse case-45, or start at case-74?
case # format be defined to 'reddit-<ISO-8601-calendar date-format>-<subreddit>-<post-id>'. Not numeric anymore. As we intend to ingest various other data sources other than reddit in future.
6. **`gcs_path` field value in JSON**: Today the seed corpus uses `gs://imm-ingest-firecrawl-md/2026-04-13` (a date folder). The new layout above uses `gs://<bucket>/case-N/`. Pick one and document; the schema field should reflect the actual file location.
The Base GCS path should be gs://imm-postings-ingestion/<ISO-8601-calendar date-format>/reddit
8. **Vertex AI Search sync mode**: auto-sync daily (simpler) vs on-demand after each batch (lower latency).
auto-sync (daily)
8. **Reddit auth model**: read-only public access via app credentials is sufficient — confirm we don't need a user account (which would gate access to NSFW or private subs).
read-only public access via app credentials> Let me know if I need to get API key as pre-requisite
9. **Quarantine ownership**: Who triages quarantined documents? Frequency of review?
I will review daily. Please define what is the process of quarantine and process would be
10. **Cost cap**: A hard monthly cap on Gemini spend (e.g. $50) — should the pipeline self-throttle?
Yes, would need a hard-month cap. Need cost estimate on what this cost should be.

---

## 10. Implementation milestones (by phase)

Authoritative phase definitions: [PIPELINE-ARCHITECTURE-WORKFLOW.md §18](PIPELINE-ARCHITECTURE-WORKFLOW.md). (Firestore is not used — BigQuery is the dedup/watermark store.)

**Phase 1 — Pilot (daily auto-sync, 3 subreddits, forward-only)**

| Week | Milestone |
|---|---|
| 1 | Infrastructure (§3) — bucket, IAM, BigQuery `postings_metadata`, Vertex AI Search data store (daily auto-sync), Example Store (no Cloud DLP) |
| 2 | Scraper + Markdownify + BigQuery dedup (offline tests) |
| 3 | Tagger (Agent Engine/Gemini) + Validator; smoke test on 10 real r/h1b posts |
| 4 | GCS-Writer + BQ-Writer; canary post visible in Vertex AI Search via daily sync |
| 5 | Label Studio + quarantine loop + Example Store few-shot + eval harness; budget + kill-switch |
| 6 | Pilot live on 3 subreddits; cost/quality dashboards; evaluate Phase 1 exit criteria (§18.1) |

**Phase 2 — Production (event-driven + scale), after Phase 1 exit criteria met**

| Step | Milestone |
|---|---|
| 7 | Deploy `search-importer` + Eventarc + Pub/Sub DLQ; flip primary ingestion to event-driven (daily sync → backstop) |
| 8 | Real-time deletion propagation; Phase-2 alerts (DLQ growth, no-ingest watchdog) |
| 9 | Expand subreddits; one-time backfill (posts ≥ 50 upvotes, last 3 months) |
| 10 | Active-learning sampling; (later) Gemini fine-tuning + Vertex ML Metadata + Vertex AI Search data-driven tuning |

---

## 11. Additional requirements:
1. Design a table in Bigquery which matches the schema of json file generated for the metadata of each posting 
2. Create an entry into BigQuery table for each posting ingested containing the metadata
2. Design this pipeline keeping in mind that this content ingested will be used in Vertex AI Search to search for similat symmetric / symantic search by other applicants looking for similar posts who may use different wordings to search.
3. The JSON file containing metadata tags generated by this process follows a specific file naming convention or use a `metadata header`. The standard 2026 workflow uses the Sidecar JSON method.  For every .md file Scraper Tool uploads to GCS, The Vertex AI Agent should trigger a process (or the BQ Writer Tool can do this simultaneously) to upload a matching .json file with the exact same name.
4. The JSON file must follow a structure that Vertex AI Search recognizes. It should contain the fields defined in Pydantic Schema defined.
5. The `learning` of this model to generate the metadata and eventual search based upon this metadata should be `self-learning` and evolve as we ingest more content. Evaluate different methos which can be used in `'self-leaning` and improving this model over time.

--

## 12. Architecture / Implementation Questions / comments:

1. I already created a bucket called imm-postings-ingestion. The folder/file structure in this bucket will be of format:
gs://imm-postings-ingestion/<ISO-8601-calendar date-format>/reddit
gs://imm-postings-ingestion/<ISO-8601-calendar date-format>/<other-forms-or-channel>
2. What crawler or Scraper tool is suggested to use in implementation, some choice that I know of:
- Firecrawl
- Google-CloudVertexBot, a dedicated web crawler used by Vertex AI Agent Builder (and Agent Search) to ingest and index public website content into your GenAI data stores.
- Obsidian  - Web Clipper Extension
3. What tool is suggested to use for Labelling / tagging content ? Some tools that I know of:
- Label Studio
- GCP Vertex AI Labelling 
- Vertex AI playbook In the Vertex AI Agent Engine, using natural language instructions that tells the LLM how to use the Tools (Cloud Run components)
- **Reasonong Engine** in Vertex AI  It natively uses Gemini to process the text and decide when to call the next tool. This component acts as the "Middle Manager." It receives raw data from your Scraper, uses an LLM to generate structured JSON, and then decides to push that data to GCS/BigQuery
4. Identify the role of Firestore in the architecture, not clear what will it be used for.
RESOLVED: Firestore is **not used**. BigQuery is the single dedup/watermark/analytics store; `case_id` is deterministic so no sequence/counter is needed. See PIPELINE-ARCHITECTURE-WORKFLOW.md §3.3.

---

## 13. References

- [tagging/JSON-SCHEMA-FIELD-DICTIONARY.md](../tagging/JSON-SCHEMA-FIELD-DICTIONARY.md) — canonical metadata schema
- [tagging/LLM-EXTRACTION-PROMPT.md](../tagging/LLM-EXTRACTION-PROMPT.md) — tagger prompt
- [tagging/us_immigration_tag_specification.md](../tagging/us_immigration_tag_specification.md) — tag taxonomy authority
- [tagging/specs3.MD](../tagging/specs3.MD) — Vertex AI Search integration overview
- [tags-cleaned/](../../backend/tags-cleaned/) — master tag vocabularies
- Reddit Data API Terms: https://www.redditinc.com/policies/data-api-terms
- PRAW docs: https://praw.readthedocs.io/
- Vertex AI Search docs: https://cloud.google.com/generative-ai-app-builder/docs
