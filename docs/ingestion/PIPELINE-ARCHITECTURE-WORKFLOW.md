# Pipeline Architecture & Workflow — Reddit → Vertex AI Search

**Status**: DRAFT for review
**Companion to**: [REDDIT-INGESTION-PIPELINE.md](REDDIT-INGESTION-PIPELINE.md) (requirements & prerequisites)
**Scope of this doc**: the *workflow* and the *Google Cloud Agent Platform* components that implement it. Reflects the decisions you recorded in §9–§12 of the companion doc.

---

## 0. Decisions locked from your review

| # | Decision | Impact on architecture |
|---|---|---|
| Comments | Only top-level comments with **> 5 upvotes**, ingested as **separate documents** | Scraper emits 1..N docs per post (post + qualifying comments) |
| PII / DLP | **Cloud DLP dropped** — Reddit public postings are not treated as containing sensitive data | No PII-Guard stage, no Cloud DLP service (decision: §3.5) |
| `case_id` format | `reddit-<YYYY-MM-DD>-<subreddit>-<post_id>` (non-numeric, source-prefixed) | Deterministic ID → no counter, no Firestore sequence needed |
| GCS base path | `gs://imm-postings-ingestion/<YYYY-MM-DD>/reddit/` | Date-partitioned, channel-segmented; bucket already created |
| Sidecar JSON | For every `<case_id>.md`, an identically-named `<case_id>.json` in the same prefix | Vertex AI Search "sidecar metadata" pattern |
| Vertex sync | **Auto-sync, daily** | No on-demand import call in the agent |
| Reddit auth | Read-only public via registered app credentials | API credential **is** a prerequisite (see §7) |
| BigQuery | A table mirroring the JSON schema; one row per ingested doc | Adds a BigQuery Writer tool + serves as the dedup register |
| Self-learning | Required; evaluate options | §6 evaluates 5 methods and recommends a phased path |
| Cost cap | Hard monthly cap required | §8 gives the estimate + the enforcement mechanism |
| Rollout | Two phases (no Phase 3) | **§18** is the authoritative Phase 1 / Phase 2 definition |

---

## 1. Target platform: Vertex AI Agent Engine (Agentic architecture)

We implement the pipeline as a **single orchestrating agent** running on **Vertex AI Agent Engine** (the managed agent runtime in Vertex AI Agent Builder, the GA successor to "Reasoning Engine"). The agent is authored with the **Agent Development Kit (ADK)** and reasons with **Gemini 2.5**.

The agent is the "middle manager" you described in §12.3: it receives raw scraped content, decides which **Tools** to call, produces the structured JSON, and pushes artifacts to GCS + BigQuery.

| Layer | GCP offering | Role |
|---|---|---|
| Orchestration runtime | **Vertex AI Agent Engine** | Hosts the agent, manages sessions, scaling, tracing |
| Agent framework | **Agent Development Kit (ADK)** | Declares the agent, its tools, and control flow |
| Reasoning model | **Gemini 2.5 Flash** (Pro fallback) | Reads raw post → emits canonical JSON; chooses tools |
| Few-shot memory | **Vertex AI Example Store** | Dynamic, growing few-shot examples → self-learning (see §6) |
| Tools | **Cloud Run functions** | Scraper, Validator, GCS-Writer, BQ-Writer (4 tools) |
| Trigger | **Cloud Scheduler** → Agent Engine session | Periodic batch (pilot: every 30 min) |
| Object store | **Cloud Storage** `imm-postings-ingestion` | Sidecar `.md` + `.json` |
| Metadata warehouse | **BigQuery** | One row/doc; dedup register; analytics; training-set source |
| Search | **Vertex AI Search** (Agent Builder data store) | Semantic/symmetric search for applicants |
| Eval & drift | **Vertex AI Gen AI Evaluation Service** | Scores tagging quality; gates fine-tune promotion |
| Guardrails | **Model Armor** | Prompt-injection / unsafe-content shield on scraped text |

> Why an agent and not a plain Cloud Run job? The companion doc's v1 was a linear job. You explicitly asked for the Agent Platform and a self-learning loop. The Agent Engine gives managed sessions, built-in tracing, tool orchestration, and a clean integration point for the Example Store (dynamic few-shot) — the core of the self-learning requirement.

---

## 2. End-to-end workflow

```
 Cloud Scheduler (cron)
        │  invoke
        ▼
 ┌─────────────────────── Vertex AI Agent Engine ───────────────────────┐
 │  Ingestion Agent  (ADK + Gemini 2.5)                                  │
 │                                                                       │
 │  step 1  call  Scraper Tool ───────────────► raw post + comments      │
 │  step 2  retrieve few-shot from Example Store (k nearest prior docs)   │
 │  step 3  Gemini reasons → canonical JSON (per LLM-EXTRACTION-PROMPT)   │
 │  step 4  call  Validator Tool ─────────────► pass | fail              │
 │            ├─ fail → call GCS-Writer (to _quarantine/) → STOP this doc │
 │            └─ pass ▼                                                   │
 │  step 5  call  GCS-Writer Tool  → <case_id>.md + <case_id>.json        │
 │  step 6  call  BQ-Writer Tool   → 1 row in BigQuery                    │
 │  step 7  write accepted example → Example Store (if confidence ≥ 0.85) │
 └───────────────────────────────────────────────────────────────────────┘
        │                                          │
        ▼                                          ▼
  gs://imm-postings-ingestion/<date>/reddit/   BigQuery: postings_metadata
        │  (.json finalize)                        │  (analytics, dedup,
        ▼                                          ▼   training-set export)
  Eventarc  ──►  search-importer (Cloud Run)  ─────┘
        │            │  documents.import (INCREMENTAL, id=case_id)
        │            ▼
        │      Vertex AI Search data store   ◄── (daily auto-sync = reconciliation backstop only)
        │            │
        ▼            ▼
  Applicants run semantic search  ──► search/click events ──► self-learning loop (§6)
```

**Ingestion is event-driven** (§17): each `.json` landing in GCS triggers an Eventarc event → `search-importer` → `documents.import` into the single Vertex AI Search sink, making the document searchable in minutes. The daily auto-sync is retained only as a reconciliation backstop. Streaming Vertex AI Vector Search is **not** part of the architecture (rationale: §15.1; rejected-alternative record: Appendix A).

### 2.1 Step detail

| Step | Tool / component | Input | Output | Failure handling |
|---|---|---|---|---|
| 1 | **Scraper Tool** (Cloud Run) | subreddit list, watermark | post + top-level comments > 5 upvotes | Reddit 5xx → 3× backoff; then skip post |
| 2 | Example Store query | embedding of post text | k=5 nearest accepted examples | Empty store → zero-shot (cold start OK) |
| 3 | Gemini 2.5 on Agent Engine | prompt + few-shot + master tag CSVs (cached) | canonical JSON | invalid JSON → 1 retry; else quarantine |
| 4 | **Validator Tool** (Cloud Run, Pydantic) | JSON | pass / errors[] | fail → quarantine path |
| 5 | **GCS-Writer Tool** | md + json | 2 sidecar objects | md ok / json fail → delete orphan, quarantine |
| 6 | **BQ-Writer Tool** | json | 1 BigQuery row (incl. `index_state`) | Storage Write API append → staging table → scheduled MERGE → live `postings_metadata` (see §5.1). Retries handled by the Storage Write client. |
| 7 | Example Store upsert | accepted (text, json) | stored example | best-effort; non-blocking |

There is **no PII-Guard / Cloud DLP step** — Reddit public postings are not treated as sensitive data (decision: §3.5). After step 5, the `.json` finalize in GCS asynchronously triggers the **event-driven import** to Vertex AI Search (§17) — this is outside the agent session (Eventarc → `search-importer`), so the agent is not blocked on indexing. There is **no embedding/vector-upsert step**: Vertex AI Search generates and stores embeddings internally (single-sink, §15).

---

## 3. Tool-selection answers (your §12 questions)

### 3.1 Scraper / crawler — recommendation

| Option you listed | Verdict | Reason |
|---|---|---|
| **Firecrawl** | ✅ **Use for non-API channels** | Returns clean Markdown from arbitrary sites; ideal for future `<other-channel>` sources that have no API |
| Google-CloudVertexBot (Agent Builder website crawler) | ❌ **Not suitable here** | It indexes public pages **directly into a data store** with no hook to run our tagging transform. It would bypass the entire metadata pipeline |
| Obsidian Web Clipper | ❌ Not suitable | Manual browser extension; not automatable in an unattended pipeline |
| **Reddit API via PRAW** (added recommendation) | ✅ **Use for Reddit** | Official API gives structured post + comment objects + upvote counts (needed for the ">5 upvotes" rule), pagination, and ToS-compliant access |

**Decision**: Scraper Tool is **polymorphic** — `reddit` adapter uses **PRAW**; future channels use **Firecrawl**. Both emit the same normalized `{title, body, comments[], url, created_utc, source}` contract so the rest of the pipeline is source-agnostic (consistent with your date/`<channel>` GCS layout).

### 3.2 Tagging / labelling tool — recommendation

| Option you listed | Role in this architecture |
|---|---|
| **Vertex AI Agent Engine (Reasoning Engine) + Gemini** | ✅ **Primary runtime tagger** — exactly the "middle manager" you described. This is the core of the design |
| Vertex AI Playbook | ❌ Not used — playbooks target conversational assistants, not batch structured extraction |
| Label Studio | ✅ **Secondary** — human review UI for quarantined docs and for creating *gold labels* that feed self-learning (§6) |
| GCP Vertex AI Labelling | ◻️ Optional alternative to Label Studio if you prefer a managed labelling service for the gold set |

**Decision**: Runtime tagging = Agent Engine + Gemini. Human-in-the-loop correction/gold-labelling = Label Studio (self-hosted on Cloud Run) **or** Vertex AI Labelling — pick one in implementation; both produce the same JSONL gold format.

### 3.3 No Firestore — BigQuery is the dedup/watermark store

**Decision: Firestore is NOT used and must NOT be provisioned.** `case_id` is deterministic (`reddit-<date>-<subreddit>-<post_id>`), so no sequence/counter is needed; dedup and watermark live in **BigQuery** (`postings_metadata`): a doc is "already processed" iff `SELECT 1 ... WHERE reddit_post_id = @id`; watermark = `SELECT MAX(posting_date) ... WHERE subreddit = @s`. BigQuery is the single dedup + watermark + analytics store. (If dedup-lookup latency ever became a bottleneck — not at pilot scale — a Memorystore cache could be added; Firestore still would not.)

### 3.4 Reddit API access — a gated, critical-path prerequisite

Read-only public access requires a **registered Reddit app** (type "script") for `client_id` + `client_secret`. There is no anonymous production Data API. **As of late-2024 Reddit removed self-service access**: credentials are gated behind a **Data API access request (form) + Responsible Builder Policy approval** — lead time ~days (non-commercial) to weeks (commercial). This is on the **critical path**; request it before the Phase-1 build. Free tier: **60 req/min OAuth** (no paid tier at pilot volume).

The Reddit Developer Platform / Devvit `server/reddit-api` capability is **not an alternative here** — Devvit apps run on Reddit's own hosting inside installed subreddit apps, not as an external GCP pipeline; using it would mean abandoning this architecture. Full rationale, the request runbook, and a dev-only unblock path are in [PREREQUISITES-IAM-INFRASTRUCTURE.md §7](PREREQUISITES-IAM-INFRASTRUCTURE.md).

### 3.5 No Cloud DLP — Reddit postings are not treated as sensitive data

**Decision: Cloud DLP (Sensitive Data Protection) is dropped. There is no PII-Guard tool, no DLP API, no de-identification template, and no `sa-piiguard-tool`.**

Rationale: the corpus is **public** Reddit content, which is not treated as containing sensitive personal data. Removing DLP simplifies the pipeline (one fewer tool, SA, API, and template), removes the per-document DLP latency and cost, and eliminates the "residual PII" quarantine branch.

Residual-risk posture without DLP:
- Structured fields (`tags`, enums, key-value) are **controlled vocabulary** — they cannot carry free-form PII by construction.
- `background_summary` / `concerns_or_questions_summary` are LLM-generated **paraphrases**, not verbatim dumps; the extraction prompt instructs the model to summarize the situation, not copy identifiers.
- The raw `.md` stores the public posting as-is (same content already public on reddit.com).
- This is **reversible**: if a future source or policy needs scrubbing, a DLP (or equivalent) step can be reinserted between Scraper and Tagger without changing the schema or downstream contract.

---

## 4. Sidecar JSON + GCS layout

For each accepted document the GCS-Writer writes **two objects with the same basename** in the same prefix (the Vertex AI Search structured-metadata "sidecar" pattern):

```
gs://imm-postings-ingestion/2026-05-17/reddit/
├── reddit-2026-05-17-h1b-1srn4ab.md
├── reddit-2026-05-17-h1b-1srn4ab.json
├── reddit-2026-05-17-h1b-1srn4ab__c_jk29lf.md      # a qualifying comment
├── reddit-2026-05-17-h1b-1srn4ab__c_jk29lf.json
└── _quarantine/
    └── reddit-2026-05-17-h1b-1xyz.json + .md + _errors.txt
```

- `case_id` = the basename (without extension).
- Comment documents append `__c_<comment_id>` to the parent `case_id`.
- The JSON `gcs_path` field stores the exact prefix `gs://imm-postings-ingestion/2026-05-17/reddit/`.
- Vertex AI Search data store is configured with source URI `gs://imm-postings-ingestion/*/reddit/*.json` and **sidecar mode** so the `.md` is the document body and the `.json` supplies the structured/facet fields.

---

## 5. BigQuery table (mirrors the JSON schema)

Dataset: `postings`. Table: `postings_metadata`. One row per accepted document. Nested/repeated fields preserve the JSON shape (no flattening loss). Suggested DDL:

```sql
CREATE TABLE IF NOT EXISTS postings.postings_metadata (
  case_id                              STRING   NOT NULL,
  source_system                        STRING,
  source_uri                           STRING,
  subreddit                            STRING,
  full_url                             STRING,
  post_title                           STRING,
  language                             STRING,
  posting_date                         DATE,
  ingestion_timestamp                  TIMESTAMP,
  last_updated_timestamp               TIMESTAMP,
  tagging_confidence                   FLOAT64,
  gcs_path                             STRING,
  background_summary                   STRING,
  concerns_or_questions_summary        STRING,
  current_visa_or_greencard_category   ARRAY<STRING>,
  visa_applying_for                    ARRAY<STRING>,
  primary_consulate                    STRING,
  consulates                           ARRAY<STRING>,
  tags                                 ARRAY<STRING>,
  concerns_or_questions_tags           ARRAY<STRING>,
  principal_country_of_chargeability   STRING,
  employer_type                        STRING,
  severity                             STRING,
  resolution_status                    STRING,
  derived_topic_cluster                ARRAY<STRING>,
  key_stages_or_info                   JSON,
  key_dates                            JSON,
  embedding_text                       STRING,
  doc_kind                             STRING,         -- 'post' | 'comment'
  parent_case_id                       STRING,         -- set for comment docs
  reddit_post_id                       STRING,         -- dedup key
  pipeline_run_id                      STRING
)
PARTITION BY posting_date
CLUSTER BY subreddit, severity;
```

This table doubles as: (a) the **dedup register**, (b) the **analytics** surface, and (c) the **training-set source** for self-learning (§6).

### 5.1 BQ write path — Storage Write API + staged MERGE (D-028)

The BQ-Writer Tool MUST use the **BigQuery Storage Write API** (`google-cloud-bigquery-storage` → `BigQueryWriteClient.append_rows`) — **not** the legacy `tabledata.insertAll` streaming-insert path, and **not** per-doc `MERGE` via the Jobs API. Rationale:

| Approach | Why it's wrong for the production tool |
|---|---|
| Legacy streaming insert (`insert_rows_json`) | ~1-minute weak dedup window via `insertId`; rows held in a separate streaming buffer for ~30–90 min blocking DML; ~80% more expensive than Storage Write |
| Per-doc SQL `MERGE` via Jobs API | BigQuery DML quotas (limited concurrent DML jobs per table) bottleneck at production rates; a Cloud Run tool firing once per ingested document will hit the limit |
| **Storage Write API** ✅ | Cheaper; immediately queryable; exactly-once via offsets or at-least-once via `_default` stream; no streaming buffer issue; the documented modern path |

Write pattern (mandatory for the production BQ-Writer):

1. BQ-Writer appends each canonical JSON row to **`postings.postings_metadata_staging`** via the Storage Write API `_default` stream (at-least-once). Rows here may contain duplicates of the same `case_id` if the agent retries a doc.
2. A **BigQuery scheduled query** (Phase 1: every 5 min; Phase 2: every 1 min) runs:
   ```sql
   MERGE postings.postings_metadata T
   USING (
     SELECT * EXCEPT(_rn) FROM (
       SELECT *, ROW_NUMBER() OVER (PARTITION BY case_id
                                    ORDER BY ingestion_timestamp DESC) AS _rn
       FROM postings.postings_metadata_staging
       WHERE _PARTITIONTIME >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)
     ) WHERE _rn = 1
   ) S
   ON T.case_id = S.case_id
   WHEN MATCHED THEN UPDATE SET …
   WHEN NOT MATCHED THEN INSERT ROW;
   ```
3. The **live table** `postings.postings_metadata` is what every consumer (Validator dedup-lookup, analytics queries, eval harness) reads.
4. Staging table is truncated weekly by a separate scheduled query (its data has been merged into the live table).

> The **manual one-off batch script** `vertexai-search-ingestion-from-examples/scripts/ingest_batch.py` is an explicit exception: it uses a single per-doc SQL MERGE against the live table directly. This is acceptable at 10 rows where DML quotas are irrelevant; it must NOT be the production pattern.

---

## 6. Self-learning — evaluation of methods

Goal: tagging quality and downstream search relevance should improve as more content is ingested.

| Method | What it is | Pros | Cons | Verdict |
|---|---|---|---|---|
| **A. Dynamic few-shot via Vertex AI Example Store** | Store every high-confidence accepted (text→JSON) pair; at tag-time retrieve k-nearest examples and inject into the prompt | No training cost; improves immediately; native Vertex feature; safe | Prompt grows; retrieval quality bound to embeddings | ✅ **Phase 1 (now)** |
| **B. Human-in-the-loop gold labels** | Quarantine + low-confidence docs reviewed in Label Studio; corrections become gold JSONL | Highest-quality signal; fixes systematic errors | Needs human time (you: daily review) | ✅ **Phase 1 (now)** |
| **C. Supervised fine-tuning of Gemini** | Periodically fine-tune Gemini on accumulated gold set (B) via Vertex AI tuning | Best long-term accuracy; shrinks prompt | Needs ≥ ~500 gold examples; MLOps overhead | ◻️ **Phase 2 (when gold ≥ 500)** |
| **D. Vertex AI Search tuning + user events** | Feed search/click events back; use Search "data-driven tuning" + autocomplete | Improves *retrieval* (not tagging) directly from real queries | Needs query traffic; orthogonal to tag quality | ✅ **Phase 2 (once applicants are searching)** |
| **E. Active learning loop** | Sample uncertain (0.5–0.7 confidence) docs preferentially for human review | Maximizes label efficiency | Adds sampler logic | ◻️ **Phase 2 enhancement** |

**Recommended path**

- **Phase 1 (pilot)**: A + B. Example Store gives immediate compounding improvement; daily quarantine review builds the gold set. Add a **Gen AI Evaluation Service** harness scoring each batch against a frozen golden set (precision/recall on tags, exact-match on enums) to detect regressions.
- **Phase 2 (scale)**: when gold ≥ ~500, add C (scheduled fine-tune via Vertex AI Pipelines, promoted only if it beats the current model on the eval harness). Turn on D once applicants are generating real search traffic. Layer E to make B cheaper.

This satisfies the §11.5 "self-learning and evolve" requirement with a concrete, staged plan rather than a single technique.

---

## 7. Prerequisites delta (beyond the companion doc)

New or changed prerequisites introduced by this architecture:

1. **Vertex AI Agent Engine** enabled (`aiplatform.googleapis.com` already covers it) + ADK in the build image.
2. **Vertex AI Example Store** instance created (one per environment).
3. **BigQuery** dataset `postings` + table from §5.
4. **Eventarc** (Phase 2) for event-driven import — see §17.
5. **Cloud DLP / Sensitive Data Protection** — *not a prerequisite and not provisioned*. Dropped: Reddit public postings are not treated as sensitive data (§3.5).
6. **Vertex AI Vector Search** — *not a prerequisite and not provisioned*. Evaluated and rejected on cost grounds (§15.1; Appendix A).
7. **Reddit app credentials** (you create these) → Secret Manager.
8. Firestore from the companion doc is **removed** — do not provision it.
9. **Model Armor** template attached to the agent for prompt-injection defense on scraped text.

---

## 8. Cost estimate & hard-cap mechanism

### 8.1 Estimate

Assumptions: pilot = `r/h1b`, `r/USVisas`, `r/usvisascheduling`; ~60 posts/day + ~40 qualifying comments/day = ~100 docs/day ≈ 3,000 docs/month. One-time backfill (Phase 2) ≈ 6,000 docs.

| Component | Unit basis | Monthly (pilot, ~3k docs) |
|---|---|---|
| Gemini 2.5 Flash | ~6k in (post+few-shot+cached vocab amortized) + ~1.5k out per doc | **~$4** |
| Agent Engine runtime | vCPU/GiB-hours for short sessions | ~$8 |
| Cloud Run tools | scraper/validator/writers, brief invocations | ~$3 |
| Vertex AI Search | ingestion free; query cost depends on traffic | ~$5–15 |
| BigQuery | storage + Storage Write API writes + scheduled MERGE | <$1 |
| GCS | small text objects + versioning | <$1 |
| Example Store | storage + retrieval | ~$2 |
| **Total (pilot)** | | **≈ $25–$40 / month** |
| One-time backfill (6k docs) | mostly Gemini + Agent | **≈ $22 one-time** |

### 8.2 Hard monthly cap — recommended **$75/month** (pilot)

Rationale: ~2× the expected $30–45 to absorb spikes/backfill without nuisance trips. Enforcement (defense in depth):

1. **GCP Billing Budget** on the project with the pipeline's billing label, threshold alerts at 50/80/100%.
2. **Programmatic kill-switch**: at 100% the budget's Pub/Sub notification triggers a Cloud Run function that flips a `pipeline_enabled=false` flag (in BigQuery config table); the agent checks this flag at step 0 and no-ops if disabled.
3. **Per-run cost guard**: the agent tracks token spend per batch via Agent Engine usage metadata and aborts the batch if a configurable `MAX_BATCH_USD` (default $5) is exceeded.
4. **Quota ceilings**: set explicit Gemini QPM/token quotas as a backstop.

Set the cap in config; raise it deliberately when the backfill runs.

---

## 9. Quarantine process (your §9.9 request)

**What gets quarantined**: any document where (a) Gemini returns unparseable JSON after 1 retry, or (b) the Validator finds ≥1 schema/vocabulary/dedup violation.

**Where**: `gs://imm-postings-ingestion/<date>/reddit/_quarantine/<case_id>.{md,json}` plus `<case_id>__errors.txt` (human-readable validator findings). A BigQuery row is also written with `resolution_status='quarantined'` so quarantine is queryable.

**Daily review process (you, once/day)**:
1. Query `SELECT * FROM postings.postings_metadata WHERE resolution_status='quarantined' AND DATE(ingestion_timestamp)=CURRENT_DATE()`.
2. Open each in **Label Studio** (pre-loaded with the MD + the agent's attempted JSON + the error list).
3. Decide per doc:
   - **Fix & accept** → corrected JSON is (a) written to the live GCS prefix, (b) MERGE-ed into BigQuery with `resolution_status='resolved'`, (c) **added to the gold set** (feeds self-learning C/E).
   - **Reject** (spam/off-topic/duplicate) → mark `resolution_status='rejected'`; artifacts moved to `_rejected/`; never indexed.
4. SLA target: clear the quarantine queue daily so Vertex AI Search's daily sync only ever sees clean docs.

**Feedback**: every "fix & accept" is the single most valuable training signal — it directly grows the gold set that Phase-2 fine-tuning (and active learning) consume.

---

## 10. Open items / proposed follow-ups

1. **Schema doc updates needed** (not yet applied — flagging, not changing silently):
   - `case_id` definition in [JSON-SCHEMA-FIELD-DICTIONARY.md](../tagging/JSON-SCHEMA-FIELD-DICTIONARY.md) must change from `case-N` to `reddit-<YYYY-MM-DD>-<subreddit>-<post_id>`.
   - `gcs_path` definition must change to the `gs://imm-postings-ingestion/<date>/reddit/` convention.
   - Add `doc_kind`, `parent_case_id`, `reddit_post_id` fields for the comment-as-document model.
   Want me to apply these to the field dictionary + LLM prompt next?
   Answer: Yes, please apply.
2. **Pydantic schema** (your §11.4): I can generate `schema.py` (a Pydantic v2 model) from the field dictionary so the Validator Tool and BQ-Writer share one source of truth. Confirm and I'll add it under `ingestion/`.
Answer: Yes, please apply_
3. **Comment-as-document** changes the seed-corpus assumptions (72 post-only docs). Confirm comments should be fully independent searchable documents (recommended) vs. appended context to the parent.
Answer: Top comments which has upvotes > 5 should be searchable.
4. **PII vs. tag fidelity**: `employer_type` is a categorical enum (e.g. "bigtech", "consulting"), never the company name.
Answer: Yes, acceptable. (Note: Cloud DLP has since been dropped — §3.5. `employer_type` remains categorical by *schema design* regardless; it was never a free-text company-name field.)
5. **Backfill sizing**: define "high-engagement" for the one-time backfill (e.g. posts with ≥ 50 upvotes in the last 6 months) so we can bound its cost.
Answer: posts with ≥ 50 upvotes in the last 3 months

---

## 11. Summary

- **Architecture style**: agentic — one ADK agent on **Vertex AI Agent Engine**, Gemini 2.5 as the reasoner, five Cloud Run **Tools**.
- **Crawler**: PRAW for Reddit, Firecrawl for future non-API channels. *Not* the Agent Builder website crawler (it would skip tagging).
- **Tagger**: Agent Engine + Gemini (runtime); Label Studio / Vertex AI Labelling (human gold labels).
- **Firestore**: removed — BigQuery is the dedup + watermark + analytics + training store.
- **Cloud DLP**: dropped — Reddit public postings are not treated as sensitive data; no PII-Guard tool/API/template (§3.5).
- **Storage**: sidecar `.md`+`.json` under `gs://imm-postings-ingestion/<date>/reddit/`.
- **Sink**: **single sink — Vertex AI Search (Agent Builder)**, fed by **event-driven import from GCS (§17)** (~2–12 min, accepted). Daily auto-sync kept only as a reconciliation backstop. Streaming Vertex AI Vector Search was evaluated and **dropped** on cost grounds (§15.1; Appendix A).
- **Self-learning**: Example Store few-shot + human gold loop + eval harness now; fine-tuning + search-tuning + active learning later.
- **Cost**: ~$30–45/mo pilot, **no large always-on line item** (consumption-priced Vertex AI Search; no Vector Search endpoint).

---

## 12. Follow-up Questions / Comments / Clarifications:

1. Create a separate Deployment document to document all GCP components to be deployed and where in GCP it needs to be created/provisioned. What components are going to be deployed in Agent Engine vs CLoud Run in GCP ? Why one is preferred over the other
2. Document the process of Quarantine (from §9 above) in detail in a separate document along with pre-requistes of setting up Label Studio.
3. Document in Quarantine document on this process of Quarantine will make help in `self-learning` of the Model and how is this training of model will make it to `Vertex AI Example Store` for future similar cases 
4. Document in Architecture document where are the master tags (used in `.json`) are going to stored and referenced in runtime by the pipeline
5. Create a separate document  the process of adding a new tag to master tags list as it comes up in future postings and how this process is connected with Quarantine process in Label Studio
6. Document in Architecture document the flow of content from GCS bucket into `embedding dataset` in Vertex AI dataset as eventually this content is going to be searchable from a chat bot using `Vertex AI Search and Conversation` 
7. Document in Architecture document if and how Vertex MSMD in short for `Vertex AI Managed Service for Metadata` can help in the context of self-learning and few-shot training with Gemini. And if it is not going to be used or recommended in this case, then why not.

---

## 13. Answers to §12

| §12 item | Where it is answered |
|---|---|
| 12.1 Deployment doc + Agent Engine vs Cloud Run | New doc → [DEPLOYMENT.md](DEPLOYMENT.md) |
| 12.2 Quarantine process + Label Studio prerequisites | New doc → [QUARANTINE-PROCESS.md](QUARANTINE-PROCESS.md) §1–§4, §7 |
| 12.3 Quarantine → self-learning → Example Store | New doc → [QUARANTINE-PROCESS.md](QUARANTINE-PROCESS.md) §5 |
| 12.4 Where master tags are stored & referenced at runtime | §14 below |
| 12.5 New-tag process linked to quarantine | New doc → [TAG-LIFECYCLE.md](TAG-LIFECYCLE.md) |
| 12.6 GCS → embedding dataset → Vertex AI Search & Conversation chatbot | §15 below |
| 12.7 Vertex AI ML Metadata (MSMD) — used or not, and why | §16 below |

Schema changes you approved in §10 are applied: [JSON-SCHEMA-FIELD-DICTIONARY.md](../tagging/JSON-SCHEMA-FIELD-DICTIONARY.md) and [LLM-EXTRACTION-PROMPT.md](../tagging/LLM-EXTRACTION-PROMPT.md) now use the `reddit-<date>-<sub>-<post_id>` `case_id`, the `gs://imm-postings-ingestion/<date>/reddit/` `gcs_path`, and the `doc_kind`/`parent_case_id`/`reddit_post_id` fields. The shared Pydantic model is [schema.py](schema.py).

---

## 14. Master tags — storage & runtime reference (answers §12.4)

### 14.1 Source of truth

The 10 master tag CSVs live in the repository at [`tags-cleaned/1.1 … 1.10`](../../backend/tags-cleaned/). Git is the **system of record** — every tag addition is a reviewed commit (see [TAG-LIFECYCLE.md](TAG-LIFECYCLE.md)).

### 14.2 How they reach runtime

```
 git repo  tags-cleaned/*.csv   (source of truth, versioned)
      │
      │  CI/CD (Cloud Build) on merge to main
      ├──────────────► baked into Tool container images (Validator, Scraper-normaliser)
      │                 → guarantees the Validator's vocabulary == the committed CSVs
      │
      └──────────────► published to a GCS "config" prefix:
                        gs://imm-postings-ingestion/_config/tagvocab/<TAG_VOCAB_VERSION>/*.csv
                              │
                              ├──► Agent loads them at session start and pins them in the
                              │     Gemini prompt cache (~30k tokens) keyed by TAG_VOCAB_VERSION
                              │     → cache refreshes only when the version changes
                              │
                              └──► Validator Tool loads the same versioned copy at cold start
```

### 14.3 Runtime references (who reads the master tags, when)

| Consumer | When | How it uses them |
|---|---|---|
| **Agent / Gemini** | step 4 (tagging) | Master CSVs are injected into the system prompt (cached) so the model can only choose in-vocabulary tags |
| **Validator Tool** | step 5 | Hard gate: every tag in the JSON must be a member of the loaded CSV sets, else quarantine |
| **Label Studio** | quarantine review | Tag-field autocomplete is sourced from the live versioned CSVs (prevents reviewers re-introducing OOV tags) |
| **BQ-Writer** | step 7 | No vocabulary logic — writes the validated arrays as-is |

### 14.4 Versioning & propagation

`TAG_VOCAB_VERSION` = `<YYYY-MM-DD>-<git_sha7>`. It is:
- stamped onto every JSON's processing log and BigQuery row (`pipeline_run_id` carries it),
- the cache key for the Gemini prompt cache and the Validator's CSV loader,
- bumped by the [TAG-LIFECYCLE.md](TAG-LIFECYCLE.md) apply step.

Because the prompt cache and Validator both key off this version, a vocabulary change propagates atomically on the next run and is fully traceable; rollback = redeploy the previous version string. **No model retraining is involved** — the vocabulary is data, not weights.

---

## 15. GCS → Vertex AI Search → chatbot flow (answers §12.6)

**Architecture decision (final): a SINGLE sink — Vertex AI Search (Agent Builder) — fed by EVENT-DRIVEN import from GCS (§17). Streaming Vertex AI Vector Search is dropped from the architecture (rationale §15.1; recorded as a rejected alternative in Appendix A).**

End-to-end path from a stored sidecar pair to an answer in the applicant-facing chatbot:

```
 GCS-Writer writes the sidecar pair:
   gs://imm-postings-ingestion/<date>/reddit/<case_id>.md    (document body)
   gs://imm-postings-ingestion/<date>/reddit/<case_id>.json   (sidecar metadata, incl. embedding_text)
        │
        │  .json finalize → Eventarc → search-importer → documents.import   (§17, event-driven)
        ▼
 Vertex AI Search data store ingests each pair:
   • .md  → chunked document content
   • .json → facets + embedding_text
 (managed embedding + managed index; minutes-fresh — accepted)
        │
        ▼  Query time
 Applicant asks a question in the chatbot
 (Vertex AI Search & Conversation / Agent Builder "Search + Answer"):
   • query embedded by Vertex AI Search (managed, same space as docs)
   • hybrid retrieval = semantic + keyword + facet filters
     (severity, subreddit, current_visa_or_greencard_category, …)
   • Gemini generates a grounded answer with citations
        │
        ▼
 Answer + cited similar postings returned to the applicant
```

### 15.1 Why a single Vertex AI Search sink (Vector Search dropped)

| | Vertex AI Vector Search streaming (dropped) | Vertex AI Search (chosen) |
|---|---|---|
| Pricing model | **Always-on serving nodes** billed 24/7 regardless of traffic | **Consumption** — storage/GiB + per-1k queries; no node floor |
| Realistic monthly floor | ~$48/mo (1 small node, no HA) → **$150–$500+/mo** (production HA) | single-digit → low-tens of $/mo at pilot volume |
| Freshness | seconds | minutes (event-driven import) — **accepted** |
| Embedding ownership | we own it (generate + re-embed on model upgrade) | managed by Vertex AI Search |
| Operational surface | extra index + endpoint + embedding/upsert tools + lineage | none beyond the data store |

Minutes latency is acceptable, so Vector Search's only advantage (seconds-fresh recall) is not needed while its always-on cost and operational complexity are not justified. **It is dropped from the architecture.** Appendix A keeps a one-paragraph record of the rejected option for traceability.

Key points:

1. **One sink, consumption-priced.** Vertex AI Search has no always-on node floor; cost scales with data + queries. Keeps the pilot at ~$30–45/mo (§8) with no large fixed line item.
2. **`embedding_text` does the semantic work.** Vertex AI Search generates and stores embeddings internally from `embedding_text` + the chunked `.md`; two applicants describing the same situation with different wording still retrieve the same postings (shared controlled-vocabulary tags anchor the vector). No pipeline-owned embedding.
3. **Sidecar JSON drives facets + grounding.** The `.json` supplies Vertex AI Search facets and the chatbot's citations; the `.md` supplies the readable passage. Identical-basename sidecar contract.
4. **Freshness = event-driven import (§17).** Rollout: bring up on the daily auto-sync (simplest), then make event-driven import the primary path (~2–12 min). The daily auto-sync is kept only as a reconciliation backstop.
5. **Self-learning closes here too**: applicant search/click events feed Vertex AI Search data-driven tuning (§6 method D), improving retrieval ranking independently of tagging quality.

---

## 16. Vertex AI ML Metadata (MSMD) — recommendation (answers §12.7)

"Vertex MSMD" = **Vertex ML Metadata**, the managed metadata store that tracks ML **lineage**: datasets, executions, models, parameters, and the artifact graph that produced a model.

### 16.1 What it *is* good for

| Capability | Relevance here |
|---|---|
| Lineage of training/tuning runs (which gold set + which base model → which tuned model) | ✅ Useful **later** when we run supervised fine-tuning of Gemini on the gold set |
| Experiment/run comparison (eval metrics across model versions) | ✅ Pairs with the Gen AI Evaluation Service to compare tuned candidates |
| Artifact/execution graph for reproducibility & audit | ✅ Compliance value for "which model produced this tag on this date" |

### 16.2 What it is **not**

- It is **not** a few-shot example store. It does **not** do similarity retrieval of prompt exemplars. It cannot serve dynamic few-shot at inference time.
- It is **not** a runtime data store the agent calls per document.

### 16.3 Recommendation

- **Now: not used.** The self-learning mechanism is dynamic few-shot via the **Vertex AI Example Store** (purpose-built for example retrieval) plus the human gold loop. MSMD has no role in a no-training, retrieval-based loop — adding it now would be overhead with no functional gain. Few-shot training with Gemini does **not** flow through MSMD; it flows through the Example Store (see [QUARANTINE-PROCESS.md](QUARANTINE-PROCESS.md) §5.1).
- **Later (when fine-tuning starts): adopt MSMD.** Once we periodically fine-tune Gemini on the accumulated `gold_labels`, MSMD becomes the right tool to record lineage (gold-set version + `TAG_VOCAB_VERSION` + base model → tuned model → eval scores), gate promotion, and enable rollback/audit. It complements, and does not replace, the Example Store.

**Summary**: Example Store = the *self-learning* substrate (now). MSMD = the *governance/lineage* substrate for *fine-tuning* (later). Distinct roles; MSMD is deferred, not rejected.

---

## 17. Event-driven GCS → Vertex AI Search ingestion (the ingestion architecture)

This is **the** ingestion mechanism for the pipeline: an **event-driven** path that makes a document searchable within **minutes** of its sidecar pair landing in GCS, instead of waiting up to 24h for the daily auto-sync. The daily auto-sync is retained **only** as a reconciliation backstop (§17.7). Rollout: bring up on the daily sync (simplest), then switch the primary path to event-driven.

### 17.1 Why not the daily auto-sync alone

| | Daily auto-sync (Phase 1) | Event-driven (this section) |
|---|---|---|
| Time-to-searchable | up to ~24h | minutes (event → import → managed indexing) |
| Trigger | Vertex AI Search scheduled scan of the bucket | GCS object event per document |
| Best for | backfill, steady catch-up, simplicity | "applicant posts a question now, similar posts surface shortly after" |
| Risk | latency | event loss / races (mitigated below) |

Both can run **simultaneously**: event-driven is the primary low-latency path; the daily sync sweeps up anything an event missed (defense in depth).

### 17.2 Component chain

```
 GCS-Writer Tool writes sidecar pair:
   1) gs://imm-postings-ingestion/<date>/reddit/<case_id>.md     (written FIRST)
   2) gs://imm-postings-ingestion/<date>/reddit/<case_id>.json   (written LAST)
        │
        │  GCS "object finalize" event  (fires per object)
        ▼
 Eventarc trigger  (filter: bucket = imm-postings-ingestion,
                     event = google.cloud.storage.object.v1.finalized,
                     object name suffix = ".json",   ← only the LAST write fires the importer
                     NOT prefixed with "_quarantine/" or "_rejected/" or "_config/")
        │
        ▼
 Cloud Run service  "search-importer"   (idempotent, at-least-once safe)
        │  step A  verify the paired .md exists (same basename); else retry/backoff
        │  step B  call Discovery Engine  documents.import
        │            • inlineSource OR gcsSource = the two object URIs
        │            • reconciliationMode = INCREMENTAL   (upsert, no purge)
        │            • document id = <case_id>            (idempotent upsert)
        │  step C  mark BigQuery row  index_state='import_requested', ts
        ▼
 Vertex AI Search data store
        │  (managed, internal — not orchestrated by us)
        │  • parse .md → chunk
        │  • read .json → structured/facet fields + embedding_text
        │  • generate & store embeddings in the managed index
        ▼
 Document is retrievable by the chatbot (minutes after step B)
        │
        └─ async: Vertex emits operation status → optional Pub/Sub →
           search-importer updates BigQuery index_state='indexed'|'failed'
```

### 17.3 Step-by-step orchestration

| Step | Actor | Action | Notes |
|---|---|---|---|
| 1 | GCS-Writer Tool | Write `.md` then `.json` (strict order) | `.json` is the **completion marker** for the pair |
| 2 | GCS | Emit `object.finalized` for each object | Two events; only the `.json` one is acted on |
| 3 | Eventarc | Match filter, deliver to `search-importer` | Suffix + prefix filters keep quarantine/config out |
| 4 | search-importer | **Pair check**: `HEAD` the sibling `.md` | If absent (rare race), nack → Eventarc redelivers with backoff |
| 5 | search-importer | Call `documents.import` (INCREMENTAL, id=`case_id`) | Upsert semantics → safe to repeat |
| 6 | search-importer | Write `index_state='import_requested'` to BigQuery | Observability + reconciliation source |
| 7 | Vertex AI Search | Internal chunk + embed + index | Managed; latency is Vertex-side, not controllable |
| 8 | search-importer (async) | On operation callback, set `index_state='indexed'` or `'failed'` | Failed → DLQ + alert |

### 17.4 Solving the sidecar race & ordering

- **Single trigger object**: the importer fires only on the `.json` finalize. Because GCS-Writer always writes `.md` first and `.json` last, by the time the `.json` event arrives the `.md` is normally already durable.
- **Defensive pair check (step 4)**: still verify the `.md` exists. If a partial-write/quarantine cleanup left an orphan, the importer nacks the event so Eventarc redelivers (exponential backoff), and after N attempts routes to the DLQ for the daily sync / human to reconcile.
- **Atomic-ish write option**: alternatively GCS-Writer can write to a `__staging/` prefix and copy both objects into the live prefix only after both succeed; the live-prefix finalize then guarantees pair completeness. Recommended if orphan races are ever observed.

### 17.5 Idempotency & at-least-once delivery

- Eventarc/Pub/Sub deliver **at least once** → the importer must be idempotent. It is: `documents.import` with a fixed document id (`case_id`) and `reconciliationMode=INCREMENTAL` is an **upsert** — re-importing the same pair overwrites identically, no duplicates.
- The BigQuery `index_state` row is keyed by `case_id` (`MERGE`), so repeated events don't create duplicate state.
- A short dedup guard (e.g. skip if `index_state='indexed'` and object generation unchanged) avoids redundant import calls but is an optimization, not a correctness requirement.

### 17.6 Deletion / update propagation (real-time)

- **Update**: a corrected document (e.g. promoted from quarantine) is re-written to the live prefix → new `.json` finalize → same upsert path refreshes the indexed document.
- **Delete** (Reddit ToS deletion propagation, see REDDIT-INGESTION-PIPELINE.md §7.4): a GCS `object.deleted` event on a `.json` triggers `search-importer` to call `documents.delete` (or `purge` for that id), removing it from the index in near real-time rather than waiting for the daily reconciliation.

### 17.7 Failure handling & reconciliation backstop

| Failure | Handling |
|---|---|
| `.md` missing at step 4 | nack → Eventarc backoff retries; after max attempts → DLQ topic |
| `documents.import` 5xx / quota | retry with backoff inside `search-importer`; persistent → DLQ + alert |
| Event dropped entirely | **Daily auto-sync** still runs and is INCREMENTAL — it sweeps up any document the event path missed (belt-and-suspenders) |
| Vertex internal indexing failure | async status → `index_state='failed'` → alert; daily sync retries |
| DLQ growth | metric alert; items triaged like quarantine |

The daily auto-sync is therefore **not removed** — it is demoted from "primary mechanism" to "safety net + backfill".

### 17.8 Latency budget (event-driven)

| Segment | Typical | Controllable by us? |
|---|---|---|
| GCS finalize → Eventarc delivery | ~1–5 s | No (managed) |
| Eventarc → search-importer + pair check | ~1–3 s | Yes (keep handler lean) |
| `documents.import` accepted | ~1–5 s | No |
| Vertex internal chunk + embed + index | ~1–10 min | No (managed) |
| **End-to-end to searchable** | **~2–12 min** | bounded by Vertex-side indexing |

This delivers **minutes**, which is the **accepted** latency target (§15.1) — so this event-driven path **is the ingestion architecture**. The dominant term (Vertex-side managed indexing) is not orchestrated by us, and that is fine because seconds-fresh is not required. Going further (seconds) would have required a streaming Vector Search index, which has been **dropped** on cost grounds (Appendix A).

### 17.9 New components introduced (delta to DEPLOYMENT.md)

| Component | Service | Role |
|---|---|---|
| `search-importer` | **Cloud Run** (event service) | Receives Eventarc events, verifies pair, calls Discovery Engine import/delete, updates BigQuery `index_state` |
| Eventarc trigger | **Eventarc** | GCS `object.finalized` / `object.deleted` → `search-importer` (filtered to live prefixes) |
| DLQ topic | **Pub/Sub** | Dead-letter for un-importable events; alerted + reconciled by daily sync |
| `index_state` columns | **BigQuery** (`postings_metadata`) | `index_state`, `index_state_ts` for observability & reconciliation |

These extend, and are consistent with, the Agent-Engine-vs-Cloud-Run split in [DEPLOYMENT.md](DEPLOYMENT.md) §2: `search-importer` is a deterministic capability (event in → API call out), so it is **Cloud Run**, not Agent Engine.

### 17.10 Rollout

Ingestion rolls out in two phases — see **§18 (Phase 1 & Phase 2)** for the authoritative, end-to-end definition of each phase. In short: Phase 1 brings the pipeline up on the daily auto-sync; Phase 2 makes event-driven import the primary path and scales scope. No streaming Vector Search in either phase (Appendix A).

---

## 18. Phase 1 & Phase 2 — what we intend to do in each phase

This section is the **authoritative phasing definition**. Every other doc's phase references defer to it. There are exactly **two phases**; there is no Phase 3 (streaming Vector Search was rejected — Appendix A). All phases use the identical tagging logic, canonical JSON schema, and GCS sidecar contract — phases differ only in **scope** and **ingestion delivery**, never in the data contract.

### 18.1 Phase 1 — Pilot / Bring-up

**Goal**: prove tagging quality, the quarantine/self-learning loop, and cost on a contained scope, with the simplest possible ingestion.

| Aspect | Phase 1 |
|---|---|
| **Source scope** | 3 subreddits only: `r/h1b`, `r/USVisas`, `r/usvisascheduling` |
| **Crawl direction** | **Forward only** — new posts from go-live onward. **No backfill.** |
| **Documents** | Posts **and** qualifying top-level comments (> 5 upvotes), each as its own document |
| **PII / DLP** | No Cloud DLP — Reddit public postings are not treated as sensitive data (§3.5) |
| **Tagging** | Agent Engine + Gemini 2.5 + master tag CSVs; canonical JSON; Validator gate |
| **Ingestion into Vertex AI Search** | **Daily GCS auto-sync only** (no Eventarc / `search-importer` yet) — simplest to stand up; up-to-24h freshness is acceptable for a pilot |
| **Self-learning** | Vertex AI Example Store dynamic few-shot + human gold loop (Label Studio) + Gen AI Evaluation harness |
| **Quarantine** | Daily human review (you), Label Studio; new-tag proposals via [TAG-LIFECYCLE.md](TAG-LIFECYCLE.md) |
| **Cost & guardrails** | ~$25–40/mo; hard monthly cap (default $75) with the 4-layer enforcement (§8) |
| **Components deployed** | Agent Engine agent; 4 Cloud Run tools (Scraper, Validator, GCS-Writer, BQ-Writer); BigQuery; Example Store; Vertex AI Search data store (auto-sync); Cloud Scheduler; Label Studio; budget + kill-switch. **Not** Cloud DLP, Eventarc/`search-importer`/DLQ. |
| **Exit criteria → Phase 2** | (a) tagging precision/recall on the eval gold set ≥ target; (b) daily quarantine rate < 10% and trending down; (c) cost within cap; (d) quarantine queue routinely cleared within 24h |

### 18.2 Phase 2 — Production: event-driven ingestion + scale

**Goal**: make ingestion near-real-time (minutes), broaden coverage, backfill history, and deepen self-learning — only after Phase 1 exit criteria are met.

| Aspect | Phase 2 (delta vs Phase 1) |
|---|---|
| **Ingestion into Vertex AI Search** | **Event-driven becomes the primary path**: each `.json` finalize → Eventarc → `search-importer` Cloud Run → `documents.import` (INCREMENTAL, id=`case_id`) → searchable in **~2–12 min**. The daily auto-sync is **demoted to a reconciliation backstop**. Adds a Pub/Sub **DLQ**. |
| **Source scope** | Add further subreddits (e.g. `r/USCIS`, `r/immigration`, `r/eb1`, `r/IMG`) per your §9.1 decision — after Phase 1 success |
| **Backfill** | One-time historical backfill: posts with **≥ 50 upvotes in the last 3 months** (your §9.3 decision), run through the same pipeline |
| **Deletion propagation** | Real-time: GCS `object.deleted` → `search-importer` → `documents.delete` (Reddit ToS), instead of waiting for daily reconciliation |
| **Self-learning** | Add **active-learning** prioritisation (sample 0.50–0.70-confidence docs for review); begin **supervised fine-tuning** of Gemini once gold ≥ ~500, with **Vertex ML Metadata** lineage (§16) and eval-gated promotion; turn on **Vertex AI Search data-driven tuning** from real query/click events |
| **Ops** | Full monitoring dashboards + alert policies (validation-failure rate, no-ingest watchdog, DLQ growth, Reddit 429s); raised throughput/quotas |
| **New components** | Eventarc trigger, `search-importer` (Cloud Run), Pub/Sub DLQ, `index_state` columns active (DEPLOYMENT.md rows 22–24) |
| **Cost** | Still consumption-priced (no always-on Vector Search node); modest increase from backfill (one-time) + broader scope; cap raised deliberately for the backfill window |

### 18.3 What stays constant across both phases (so Phase 1 → 2 is zero-rework)

- Tagging logic, `LLM-EXTRACTION-PROMPT.md`, and master tag vocabulary.
- Canonical JSON schema (`schema.py`) and the GCS sidecar `.md`/`.json` contract.
- BigQuery `postings_metadata` table and the dedup model.
- Single sink = Vertex AI Search. Only the *delivery* of documents into it changes (daily sync → event-driven). No Vector Search in either phase.

### 18.4 Phase summary

| | Phase 1 (Pilot) | Phase 2 (Production) |
|---|---|---|
| Ingestion | Daily auto-sync | Event-driven import (daily sync = backstop) |
| Freshness | up to ~24h | ~2–12 min |
| Subreddits | 3 (h1b, USVisas, usvisascheduling) | + USCIS, immigration, eb1, IMG, … |
| Backfill | None (forward only) | Posts ≥ 50 upvotes, last 3 months (one-time) |
| Self-learning | Example Store few-shot + human gold + eval | + active learning + fine-tuning + search tuning |
| Extra components | — | Eventarc, `search-importer`, DLQ |
| Trigger to start | Go-live | Phase 1 exit criteria met (§18.1) |

---

## Appendix A. Rejected alternative — streaming Vertex AI Vector Search

**Decision: NOT adopted. Not part of the architecture. Do not provision or budget for it.**

A second "sink" using a pipeline-owned embedding step plus a **Vertex AI Vector Search** index with `STREAM_UPDATE` was evaluated as a way to make documents searchable in **seconds** instead of minutes. It was **rejected** because:

- **Minutes latency is acceptable** (the event-driven import in §17 already delivers ~2–12 min), so the only benefit (seconds-fresh recall) is not needed.
- **Cost**: a Vector Search index endpoint is an **always-on serving node billed 24/7 regardless of query volume** — ~$48/mo for a single small node with no HA, and realistically **$150–$500+/mo** at production HA (larger machine + ≥2 nodes). That single line item can exceed the entire rest of the pipeline (~$30–45/mo, §8).
- **Operational cost**: it would add an Embedding Tool, a Vector-Upsert Tool, a Vector Search index + endpoint, and embedding-lineage/re-embed lifecycle — none of which exist in the single-sink design.

Because the sidecar `.md`/`.json` + `embedding_text` data contract is unchanged by this decision, the option remains technically achievable in the future *if* a hard sub-minute requirement ever emerges — but it is explicitly out of scope today and no schema, deployment, or tagging artifact provisions for it.