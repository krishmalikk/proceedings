# MEMORY.md — Architectural Decision Log & Session Handoffs

> **Read this file at the start of every session.** It is the authoritative chronological record of every significant decision regarding architecture, logic, or format in this project, plus the end-of-session handoffs that say where the work currently stands. Older entries are immutable — when a later decision supersedes one, add a **new** entry that references and supersedes the older one (do not edit history).
>
> **After any significant decision** about architecture, logic, or format, add a new `D-NNN` entry (format below).
>
> **When the user indicates the session is ending**, append a new `S-NNN` session-summary entry (format below). The latest `S-NNN` is the "where were we?" reference for the next session.
>
> Decision-record format:
> ```
> ## D-NNN — YYYY-MM-DD — <one-line headline>
> **Decision:** what was decided (concrete, actionable)
> **Reasoning:** why (the key facts/constraints that drove the choice)
> **Alternatives rejected:** what else was considered and why it lost
> **Affected docs / status:** files touched + Done/Open/Superseded
> ```
>
> Session-summary format:
> ```
> ## S-NNN — YYYY-MM-DD — End-of-session summary
> **Completed this session:** bullet list of finished items (link to docs/D-NNN where relevant)
> **In progress / not yet finished:** what is partially done, with current state
> **Exact next step for next session:** one concrete, actionable first step (no vague "continue work")
> **Open questions / blockers:** anything waiting on the user or a third party (e.g. Reddit approval)
> ```

---

## D-001 — 2026-05-14 — Tag taxonomy organized into 10 master CSVs (sections 1.1–1.10)

**Decision:** Replace the original ad-hoc CSVs in `csv/` with 10 cleaned master CSVs in `tags-cleaned/`, one per spec category 1.1–1.10. Apply the naming conventions and dedup/normalization rules in [us_immigration_tag_specification.md](tagging-specifications/us_immigration_tag_specification.md).
**Reasoning:** Original inputs had duplicates, inconsistent casing, and mixed concerns. A category-keyed master is required for downstream LLM tagging, Vertex AI Search faceting, and validator vocabulary checks.
**Alternatives rejected:** Keep one flat tag list (loses faceting); keep input CSVs as-is (duplicate noise persists).
**Status:** Done — 10 master CSVs in [tags-cleaned/](tags-cleaned/).

## D-002 — 2026-05-14 — Family-F* renamed to F1-FAMILY / F2A-FAMILY style

**Decision:** In section 1.2 Green Card, replace `Family-F1` / `Family-F2A` / … with `F1-FAMILY`, `F2A-FAMILY`, etc.
**Reasoning:** Spec 1.2 requires UPPERCASE + hyphen; original `Family-F1` violated the rule and collided visually with non-imm visa `F-1`. Suffix disambiguator preserves preference designator first.
**Alternatives rejected:** `FAMILY-F1` prefix style (less consistent with `EB-1A` ordering); keep mixed-case original (violates spec).
**Status:** Done in [1.2-greencard-categories.csv](tags-cleaned/1.2-greencard-categories.csv).

## D-003 — 2026-05-14 — Canonical JSON schema with 5-sibling-field tag dedup rule

**Decision:** Each posting's metadata JSON puts every tag into exactly one of these sibling fields: `current_visa_or_greencard_category`, `visa_applying_for`, `consulates`, `tags`, `concerns_or_questions_tags`. A tag string MUST appear in at most one field (exception: `visa_applying_for` may share with `current_visa_or_greencard_category` for renewals/extensions).
**Reasoning:** Splits tags semantically (present status vs intent vs consulate vs background context vs active question) for Vertex AI Search faceting and embedding alignment; prevents double-counting in search.
**Alternatives rejected:** Single flat `tags` array (loses semantic split + faceting); split `tags` by spec section 1.x (over-fragmented; agents struggled with edge cases).
**Status:** Done — schema in [JSON-SCHEMA-FIELD-DICTIONARY.md](tagging-specifications/JSON-SCHEMA-FIELD-DICTIONARY.md) and Pydantic in [content-ingestion-specifications/schema.py](content-ingestion-specifications/schema.py).

## D-004 — 2026-05-14 — `visa_applying_for` kept distinct from `current_visa_or_greencard_category`

**Decision:** Separate top-level fields for **present** vs **intended-next** visa/GC status; both may carry the same tag for renewal/extension cases.
**Reasoning:** Captures candidate trajectory; supports queries like "people currently on F-1 applying for H-1B".
**Alternatives rejected:** Single combined field (loses temporal distinction).
**Status:** Done.

## D-005 — 2026-05-14 — Vertex-AI-Search-facet fields added to schema

**Decision:** Schema includes `case_id`, `subreddit`, `post_title`, `language`, `severity`, `resolution_status`, `principal_country_of_chargeability`, `employer_type`, `derived_topic_cluster`, `embedding_text`, `last_updated_timestamp`. Timestamps in ISO-8601 with `T...Z`; `key_dates` values normalized to `YYYY-MM-DD`; `tagging_confidence` is a float in [0.0,1.0].
**Reasoning:** Required for Vertex AI Search faceting, sorting, snippet generation, and embedding source.
**Alternatives rejected:** Flat free-text-only metadata (no faceting).
**Status:** Done.

## D-006 — 2026-05-14 — Seed corpus of 72 postings re-tagged to canonical schema

**Decision:** All 72 posts in `postings-examples/case-N/` use the new canonical JSON + identical-basename `.md`/`.json` sidecar pair. Validator passes for all 72.
**Reasoning:** Establishes a gold seed corpus that Vertex AI Search and the eval harness consume.
**Alternatives rejected:** Migrate incrementally (would leave inconsistent docs in the corpus).
**Status:** Done.

## D-007 — 2026-05-14 — Clean baseline: drop legacy `examples/` and `csv/`; strip audit columns from master CSVs

**Decision:** Delete `examples/`, `csv/`, `tags-cleaned/*-removed.csv`, `postings-examples/_dropped-tags-audit.csv`. Strip `action` / `renamed_from` columns from each master CSV.
**Reasoning:** Project baseline should only contain forward-looking artifacts, not migration audit; reduces confusion.
**Alternatives rejected:** Keep stripped versions of migration docs (unnecessary; migration is complete).
**Status:** Done.

## D-008 — 2026-05-17 — Specs organized into `tagging-specifications/` and `content-ingestion-specifications/`

**Decision:** Two parallel spec folders separating taxonomy-of-tags from how-content-is-ingested.
**Reasoning:** Cleaner concerns split; ingestion specs reference taxonomy specs but not vice versa.
**Alternatives rejected:** Flat root-level MDs (poor scannability).
**Status:** Done.

## D-009 — 2026-05-17 — Agentic pipeline on Vertex AI Agent Engine (ADK + Gemini 2.5)

**Decision:** Ingestion pipeline is built as a single ADK agent on **Vertex AI Agent Engine**, with **Cloud Run** stateless tools (Scraper, Validator, GCS-Writer, BQ-Writer) invoked by the agent. Reasoner: Gemini 2.5 Flash (Pro fallback).
**Reasoning:** Managed agent runtime, native Example Store integration for self-learning, separation of reasoning (Agent Engine) from deterministic capabilities (Cloud Run).
**Alternatives rejected:** Plain Cloud Run **job** end-to-end (no agentic reasoning, no Example Store hook); Vertex AI Playbook (conversational-agent orientation, not batch structured extraction).
**Status:** Done — see [PIPELINE-ARCHITECTURE-WORKFLOW.md](content-ingestion-specifications/PIPELINE-ARCHITECTURE-WORKFLOW.md).

## D-010 — 2026-05-17 — `case_id` is deterministic: `reddit-<YYYY-MM-DD>-<subreddit>-<post_id>`

**Decision:** Drop numeric `case-N` IDs (used only by the seed corpus). Source-prefixed deterministic IDs (extendable to other channels) double as idempotency keys. Comment docs append `__c_<comment_id>` and set `parent_case_id`.
**Reasoning:** Removes need for a counter / sequence allocator; survives re-runs; future-proof for non-Reddit sources.
**Alternatives rejected:** Continue numeric `case-N` with Firestore counter; UUIDs (not human-readable, not deterministic from source).
**Status:** Done.

## D-011 — 2026-05-17 — GCS path = `gs://imm-postings-ingestion/<YYYY-MM-DD>/<channel>/`, sidecar `.md`+`.json`

**Decision:** Date-partitioned, channel-segmented bucket layout; each posting is an identically-named `.md` and `.json` pair in the same prefix.
**Reasoning:** Vertex AI Search "sidecar metadata" pattern (managed embedding from `.md` body + structured/facet from `.json`); date partitioning aids lifecycle + cost; channel segmentation future-proofs for non-Reddit sources.
**Alternatives rejected:** Single object with embedded metadata (not Vertex's preferred contract); flat naming (no date partitioning).
**Status:** Done.

## D-012 — 2026-05-17 — PRAW for Reddit; Firecrawl reserved for future non-API channels; Devvit rejected

**Decision:** Scraper Tool for Reddit uses **PRAW** (official Reddit API). Firecrawl is the future adapter for non-API channels only. Reddit **Devvit `server/reddit-api`** is rejected as architecturally incompatible.
**Reasoning:** PRAW returns structured post + comment objects + upvote counts (required for the >5-upvote rule); ToS-compliant. Devvit code runs on Reddit's hosting inside installed subreddit apps — not as an external GCP batch job.
**Alternatives rejected:** Firecrawl for Reddit (heavier than necessary; API exists); Google-CloudVertexBot (indexes pages directly into a data store, bypassing the tagging transform); Obsidian Web Clipper (manual, not automatable); Devvit (incompatible — see above).
**Status:** Done. (See also D-022.)

## D-013 — 2026-05-17 — Drop Firestore; BigQuery is the single dedup + watermark + analytics + training store

**Decision:** No Firestore in the architecture. `postings_metadata` in BigQuery handles dedup (MERGE on `case_id`), watermark (`MAX(posting_date) WHERE subreddit=`), analytics, and gold-set/training-data source.
**Reasoning:** `case_id` is deterministic (D-010) → no counter needed; BigQuery is already required for analytics; collapsing two stores reduces components.
**Alternatives rejected:** Firestore Native (extra component, no remaining unique benefit); Memorystore/Redis cache (deferred — not needed at pilot scale).
**Status:** Done.

## D-014 — 2026-05-17 — Comments: only top-level comments with > 5 upvotes are ingested, each as a separate document

**Decision:** Comments are separate documents with `case_id` suffix `__c_<comment_id>` and `parent_case_id` pointing at the post.
**Reasoning:** Top comments often contain the actual answer; >5 upvotes filters low-signal noise; independent docs let Vertex AI Search surface them directly.
**Alternatives rejected:** Posts only (loses high-signal answers); comments appended as context (loses direct retrieval).
**Status:** Done.

## D-015 — 2026-05-18 — Phase 1 / Phase 2 phasing (no Phase 3)

**Decision:** Two phases authoritative in [PIPELINE-ARCHITECTURE-WORKFLOW.md §18](content-ingestion-specifications/PIPELINE-ARCHITECTURE-WORKFLOW.md). Phase 1 = pilot (3 subreddits — `r/h1b`, `r/USVisas`, `r/usvisascheduling` — forward-only, daily auto-sync, no backfill). Phase 2 = production (event-driven import primary, broader subreddits, one-time backfill ≥50 upvotes/last 3 mo, active learning, fine-tuning, deletion propagation real-time).
**Reasoning:** Bring up the simplest viable pipeline first; gate scale on tagging-quality exit criteria (precision/recall on eval gold set, quarantine rate, cost within cap).
**Alternatives rejected:** Big-bang Phase 1 with full scope (high risk); a separate "Phase 3" streaming (see D-016).
**Status:** Done.

## D-016 — 2026-05-18 — Single sink = Vertex AI Search via event-driven import; streaming Vertex AI Vector Search REJECTED

**Decision:** One sink: Vertex AI Search (Agent Builder), fed by **event-driven import** (Eventarc on `.json` `object.finalized` → `search-importer` Cloud Run → `documents.import` INCREMENTAL with `id=case_id`). Daily auto-sync demoted to reconciliation backstop. **Streaming Vertex AI Vector Search is not adopted.**
**Reasoning:** Minutes-of-latency is acceptable (~2–12 min via event-driven). Vector Search index endpoint is an **always-on serving node** billed 24/7 (~$48 single-node no-HA → $150–$500+/mo production HA) — would be the largest line item, buying seconds-fresh recall that is not needed. Embedding ownership + re-embed lifecycle adds operational surface for no value at our scale.
**Alternatives rejected:** Dual sink (Vertex AI Search + streaming Vector Search) for seconds-fresh recall — rejected on cost/benefit; standalone Vector Search only — loses managed grounding/citations of Vertex AI Search.
**Status:** Done — recorded in [PIPELINE-ARCHITECTURE-WORKFLOW.md §15.1 + Appendix A](content-ingestion-specifications/PIPELINE-ARCHITECTURE-WORKFLOW.md). Reversible (the sidecar data contract is phase-invariant).

## D-017 — 2026-05-18 — Drop Cloud DLP / PII-Guard from the pipeline

**Decision:** Remove the PII-Guard tool, `dlp.googleapis.com` API, de-identification template, and `sa-piiguard-tool`. Pipeline has 4 Cloud Run tools (Scraper, Validator, GCS-Writer, BQ-Writer), not 5.
**Reasoning:** Reddit public postings are not treated as containing sensitive personal data. Structured fields are controlled vocabulary (cannot carry free-form PII by construction); summaries are LLM paraphrases (not verbatim); raw `.md` mirrors already-public Reddit content. Reversible — DLP can be reinserted between Scraper and Tagger later without schema/contract changes.
**Alternatives rejected:** Keep DLP as defense-in-depth (over-engineering for a public-data corpus); custom regex scrubber in Scraper (worse than DLP; same operational cost).
**Status:** Done — recorded in [PIPELINE-ARCHITECTURE-WORKFLOW.md §3.5](content-ingestion-specifications/PIPELINE-ARCHITECTURE-WORKFLOW.md). Supersedes the earlier "mandatory DLP de-identification" stance documented in pre-D-017 drafts.

## D-018 — 2026-05-18 — IAM: one service account per workload, no key files, resource-scoped roles, custom roles where predefined are too broad

**Decision:** Per [PREREQUISITES-IAM-INFRASTRUCTURE.md](content-ingestion-specifications/PREREQUISITES-IAM-INFRASTRUCTURE.md). One SA per Cloud Run tool (`sa-scraper-tool`, `sa-validator-tool`, `sa-gcs-writer-tool`, `sa-bq-writer-tool`); `sa-reddit-ingest-agent` for the agent (orchestration-only — no GCS/BQ/Secret write); `sa-search-importer` for Phase 2. Auxiliary SAs for Label Studio, promote-fn, scheduler, killswitch, CI/CD. **No SA key files** (org-policy `iam.disableServiceAccountKeyCreation` enforced). Custom roles: `discoveryEngineDocumentWriter`, `pipelinePauser`, optional `redditSecretReader`. **No API keys for Google services** — Vertex AI / Gemini / Discovery Engine / BigQuery / GCS use ADC via attached SA; only external credential is the Reddit OAuth secret.
**Reasoning:** Least privilege, attributable audit logs, contained blast radius; the dedicated Reddit-ingest SA holds no data-plane writes by itself.
**Alternatives rejected:** Shared "god" SA across all tools (huge blast radius); project-wide role bindings (over-broad); `GOOGLE_API_KEY` for Gemini (long-lived bearer secret with weak scoping); Firecrawl API key (not needed — PRAW path, see D-012).
**Status:** Done.

## D-019 — 2026-05-18 — Self-learning: Vertex AI Example Store + human gold loop now; Gemini fine-tuning + Vertex ML Metadata later

**Decision:** Phase 1 self-learning = dynamic few-shot via **Vertex AI Example Store** + **human gold loop** via Label Studio + **Gen AI Evaluation Service** harness. Phase 2 adds active-learning sampling, supervised Gemini fine-tuning (once gold ≥ ~500 examples) with **Vertex ML Metadata** lineage, and Vertex AI Search data-driven tuning. Quarantined-then-corrected docs upsert into the Example Store immediately, so accuracy compounds with no retraining.
**Reasoning:** Retrieval-augmented few-shot improves accuracy without training cost; gold set is the highest-quality signal but takes time to accumulate; fine-tuning is justified only once volume warrants.
**Alternatives rejected:** Fine-tune immediately (insufficient gold data); only static few-shot in the prompt (does not self-improve); Vertex ML Metadata in Phase 1 (no fine-tuning to track lineage for).
**Status:** Done; quarantine + tag-lifecycle docs reference this.

## D-020 — 2026-05-18 — Cost cap: hard monthly budget (~$75/mo Phase-1 pilot) with 4-layer enforcement

**Decision:** GCP Billing Budget with Pub/Sub alerts at 50/80/100% → `killswitch-fn` Cloud Run function (custom `pipelinePauser` role) flips a BigQuery `pipeline_config` flag the agent checks at step 0. Per-batch USD guard inside the agent; explicit Gemini quotas as backstop.
**Reasoning:** Defense in depth; prevents unbounded LLM spend if a regression triggers retry loops.
**Alternatives rejected:** Only Billing Budget alert (notifies, doesn't stop); only quotas (blunt, doesn't capture in-batch overruns).
**Status:** Done.

## D-021 — 2026-05-18 — Tag-lifecycle: new tag proposals via Label Studio "missing vocabulary" path → `tag_proposals` BigQuery table → reviewed git PR → CSV row

**Decision:** Reviewers propose new tags from quarantine; proposals land in `tag_proposals` BigQuery table; a git PR adds the row to `tags-cleaned/*.csv`; `TAG_VOCAB_VERSION` rotates and invalidates the prompt cache; validator + agent pick up the new tag on next run; deferred docs are re-opened automatically.
**Reasoning:** Bounded human-in-the-loop expansion of vocabulary; immutable history via git; no silent vocab drift.
**Alternatives rejected:** Free-text tags (vocab explodes); ML-driven auto-vocab discovery (untrustworthy without review).
**Status:** Done — see [TAG-LIFECYCLE.md](content-ingestion-specifications/TAG-LIFECYCLE.md).

## D-022 — 2026-05-19 — Reddit API access: classic OAuth Data API (PRAW) is THE path; approval-form is critical-path; Devvit reaffirmed as non-fit

**Decision:** Stay on classic OAuth2 Data API (PRAW per D-012). The Reddit **Data API access request form + Responsible Builder Policy approval** is a mandatory critical-path prerequisite (~days non-commercial; weeks for commercial). Devvit `server/reddit-api` reaffirmed as architecturally incompatible (Devvit code runs on Reddit's hosting, not GCP). Free tier: **60 req/min OAuth** (10/min unauthenticated). A dev-only unblock path using public `https://www.reddit.com/r/<sub>/new.json` is permitted for local smoke tests, **not** production.
**Reasoning:** Reddit removed self-service access in late-2024; there is no alternative auth path for an external GCP pipeline. Devvit avoids the credential form but would mean abandoning the GCP architecture.
**Alternatives rejected:** Devvit (incompatible runtime); commercial Data API (paid; deferred until volume warrants); third-party providers / Pushshift (no longer general-developer accessible).
**Status:** Done — see [PREREQUISITES-IAM-INFRASTRUCTURE.md §7](content-ingestion-specifications/PREREQUISITES-IAM-INFRASTRUCTURE.md) and [PIPELINE-ARCHITECTURE-WORKFLOW.md §3.4](content-ingestion-specifications/PIPELINE-ARCHITECTURE-WORKFLOW.md). Approval pending.

## D-023 — 2026-05-20 — MEMORY.md instituted as the architectural decision log; auto-read on session start

**Decision:** This file (`MEMORY.md`) is the chronological, immutable-history decision log. Every significant decision on architecture, logic, or format adds a new entry (`D-NNN`). It is to be **read at the start of every session** — enforced by a directive in [CLAUDE.md](CLAUDE.md), which is auto-loaded as project context at session start. Later decisions that supersede earlier ones add a new entry referencing the older `D-NNN`; older entries are immutable.
**Reasoning:** Long-running project with several superseded earlier choices (e.g. D-017 supersedes earlier mandatory-DLP framing; D-016 supersedes earlier dual-sink draft). New sessions / new contributors need to see *why* decisions were made and what was rejected, not just the current state. Prevents re-litigating settled choices.
**Alternatives rejected:** Decision records embedded only in design docs (scattered, easy to miss); a CHANGELOG (records *what* changed, not *why*); not keeping a log (loses institutional memory).
**Status:** Done.

## D-024 — 2026-05-20 — End-of-session summaries (`S-NNN`) appended to MEMORY.md on session end

**Decision:** When the user signals the session is ending, append a new `S-NNN` entry to MEMORY.md (format defined at the top of this file) covering: what was completed, what is in progress, the exact concrete next step for the next session, and any open blockers/questions. The latest `S-NNN` is the canonical "where were we?" reference that future sessions consume immediately after reading the decision log. Enforced by a `MANDATORY at session end` directive in [CLAUDE.md](CLAUDE.md), the auto-loaded project context.
**Reasoning:** A new session opens with no working memory of the previous one. A decision log explains *why* the system looks the way it does, but not *where the work currently stands*. The `S-NNN` handoff gives the next session a concrete, actionable starting point and prevents drift / repeated context-rebuilding.
**Alternatives rejected:** Rely on the user to verbally re-brief at session start (lossy, repetitive); track in an external tool (out-of-repo, undiscoverable); embed in a separate `STATUS.md` (splits the handoff from the decision context it depends on).
**Status:** Done.

## D-025 — 2026-05-20 — Project scope expanded beyond specifications; universal master-tag rule; planned code directories named

**Decision:** The project is no longer "specs only". CLAUDE.md is the authoritative scope document and now states:
- **Master tag repository** in `tags-cleaned/` is the single source of truth for tagging vocabulary.
- **Universal tagging rule**: every piece of content ingested — Reddit posts, future non-API channels (via Firecrawl), website-authored content, anything else — must be tagged exclusively against `tags-cleaned/`, using [JSON-SCHEMA-FIELD-DICTIONARY.md](tagging-specifications/JSON-SCHEMA-FIELD-DICTIONARY.md) + [LLM-EXTRACTION-PROMPT.md](tagging-specifications/LLM-EXTRACTION-PROMPT.md), enforced by the Validator. New vocabulary only via [TAG-LIFECYCLE.md](content-ingestion-specifications/TAG-LIFECYCLE.md).
- **Planned directories** (not yet in repo): `ingestion-pipeline/` (Vertex AI Agent Engine agent + Cloud Run tools), `infra/` (Terraform / `gcloud` IaC for everything in DEPLOYMENT.md + PREREQUISITES-IAM-INFRASTRUCTURE.md), `ci-cd/` (Cloud Build via WIF, no keys), `website/` (candidate-facing search UI consuming Vertex AI Search), `ops/` (dashboards-as-code + alert policies).
- CLAUDE.md now contains dedicated sections for **GCP deployment specifics** and **GCP operational & monitoring capabilities** summarising the deployment/IAM/observability decisions already in [DEPLOYMENT.md](content-ingestion-specifications/DEPLOYMENT.md), [PREREQUISITES-IAM-INFRASTRUCTURE.md](content-ingestion-specifications/PREREQUISITES-IAM-INFRASTRUCTURE.md), and [PIPELINE-ARCHITECTURE-WORKFLOW.md §17.7](content-ingestion-specifications/PIPELINE-ARCHITECTURE-WORKFLOW.md).
**Reasoning:** The project has outgrown its "data + specs" origin; explicit scope expansion in CLAUDE.md prevents future sessions from miscategorising it as spec-only and gives planned code a pre-agreed home. Codifying the universal master-tag rule in CLAUDE.md raises it from a Reddit-specific assumption to a project-wide invariant.
**Alternatives rejected:** Implicit scope expansion (future sessions would keep treating it as spec-only); planned code under arbitrary ad-hoc paths (would diverge); restating GCP deployment + ops in CLAUDE.md instead of pointing at the authoritative specs (drift risk).
**Status:** Done — CLAUDE.md updated. No new directories created yet; they will be added (with their own conventions and a follow-up `D-NNN`) when code starts landing.

## D-026 — 2026-05-21 — Manual one-time Reddit-batch ingestion path while Reddit API approval is pending

**Decision:** Stand up a thin slice of the agentic pipeline that uses the same schema, prompt, GCS bucket, and BigQuery table but bypasses Agent Engine, Eventarc, and the Cloud Run tool fleet — so the Gemini conversational app being built next has a real Vertex AI Search index to ground against. Concretely:
- **Runner**: a local Python script (`vertexai-search-ingestion-from-examples/scripts/ingest_batch.py`) using **`gcloud auth application-default login`** ADC. No Cloud Run image build, no service-account key.
- **GCP resources provisioned now** (long-lived, shared with the future agentic pipeline): Vertex AI Search **data store** `imm-postings-datastore` (Discovery Engine, location `global`, unstructured + sidecar metadata, content-required) and **search app (engine)** `imm-postings-search-app`; BigQuery table `IMM.postings_metadata` (DDL from `content-ingestion-specifications/schema.py BIGQUERY_SCHEMA`, partition `posting_date`, cluster `subreddit, severity`); Discovery Engine service agent granted `roles/storage.objectViewer` on `gs://imm-postings-ingestion`. Created by `scripts/provision_gcp.py` (idempotent).
- **Ingest delivery**: in-batch GCS sidecar write → `documents.import` (INCREMENTAL, id=`case_id`) via a JSONL manifest at `gs://<bucket>/<BATCH_DATE>/reddit/_manifest/import-*.jsonl`. Documents searchable in minutes, not waiting for the daily auto-sync.
- **Identity synthesis for manual batch** (no Reddit URLs available in source files): `subreddit="h1b"`, `reddit_post_id` = filename stem (`posting1` … `posting10`), `posting_date` = `BATCH_DATE` from `.env` (`2026-05-21`), `full_url=""`, `ingestion_method="manual_upload"`. Yields `case_id` = `reddit-2026-05-21-h1b-posting<N>` — schema-valid per `PostingMetadata` regex in `schema.py`.
- **Quarantine-and-continue** on validation failure (Pydantic structural or master-CSV vocabulary): write to `gs://.../_quarantine/<case_id>.{md,json,__errors.txt}`, skip BQ + import.
- **Sidecar JSONs committed** to `vertexai-search-ingestion-from-examples/postings-batch-1-tagged/` (in addition to GCS) so the tagger output is reviewable via git.
- **Decommission** via `scripts/decommission_gcp.py`. Default scope: GCS objects under batch prefix + BQ rows where `case_id LIKE 'reddit-2026-05-21-%'` + Discovery Engine documents with that id prefix. `--full` also deletes the data store, search app, and BQ table. Never deletes the bucket or the BQ dataset (shared with the future agentic pipeline).

**Reasoning:** Reddit API approval is pending; the Gemini conversational app downstream of Vertex AI Search needs a real grounding source now, not weeks from now. Sharing the bucket / BQ table / data store between this manual batch and the future agentic pipeline guarantees zero schema drift and lets the agentic rollout simply *add* new docs to the same index rather than rebuild. Local-ADC runner avoids container + Cloud Run + WIF setup overhead for a 10-file batch. Explicit `documents.import` after the write makes the test loop short (minutes, not 24h).

**Alternatives rejected:**
- Spin up the full Cloud Run + Agent Engine fleet for 10 files — disproportionate effort.
- Build a separate ad-hoc data store / BQ table just for the manual batch — guarantees later migration pain when Reddit unblocks.
- Use Vertex AI Workbench notebook — interactive but heavier to provision/teardown than a local script.
- Rely on daily auto-sync only — too slow for an active test loop.
- Skip BigQuery for the manual batch — would mean the agentic pipeline later finds an empty/missing table and can't dedup.

**Affected docs / status:** Done.
- `vertexai-search-ingestion-from-examples/` populated with `requirements.txt`, `README.md`, `PROVISIONED-RESOURCES.md`, `scripts/provision_gcp.py`, `scripts/ingest_batch.py`, `scripts/decommission_gcp.py`, `postings-batch-1-tagged/` (empty until first run).
- `.env` extended with: `GCP_BQ_TABLE`, `GCP_VERTEX_DATASTORE_{LOCATION,ID}`, `GCP_VERTEX_SEARCH_APP_ID`, `GCP_GEMINI_{MODEL,LOCATION}`, `DEFAULT_{SUBREDDIT,INGEST_CHANNEL,INGESTION_METHOD}`, `BATCH_{DATE,SOURCE_DIR,TAGGED_DIR}`.
- Scripts are generated but **not executed** — user runs them.

## D-027 — 2026-05-21 — Batch-1 observations applied: gcs_path → .md URI, tagging rules tightened, vocab gaps closed, BQ writer switched to MERGE

**Decision:** Driven by `vertexai-search-ingestion-from-examples/observations-batch-1.md`. Six coordinated changes:

1. **`gcs_path` semantic** — now the URI of the document's **`.md` file** (not the parent folder). Schema regex relaxed to accept both forms (legacy seed corpus keeps the folder form). [JSON-SCHEMA-FIELD-DICTIONARY.md §2.4](tagging-specifications/JSON-SCHEMA-FIELD-DICTIONARY.md) updated; change-log v2.2.
2. **LLM tagging rules** — added three new sections to [LLM-EXTRACTION-PROMPT.md](tagging-specifications/LLM-EXTRACTION-PROMPT.md):
   - **WHO COUNTS AS "THE APPLICANT"** — only the applicant and (if married) their legal spouse populate per-applicant fields. Friend / boyfriend / family-member facts must NOT set `spouse_status`, `resident_of_country`, `citizen_of_country`, `born_in_country`, `travel_country`, or visa fields.
   - **WHEN A FIELD APPLIES** — `visa_applying_for` only when actively applying (not hypothetical/comparative posts); `resident_of_country` is current residence, not future; `case_status` (with underscore) is a stage key inside `key_stages_or_info`, never a tag.
   - **TAG-RELEVANCE GATE** — only emit a tag if the post materially discusses the concept; explicit examples (`passport`, `case-status`, visa codes mentioned only comparatively).
   - 5-FIELD DEDUP rule strengthened with "scan your own tag arrays before emitting" instruction.
3. **Master vocab additions** — `NTA` (Notice to Appear) → [1.3-abbreviations.csv](tags-cleaned/1.3-abbreviations.csv); `i-am-attorney` (self-promotional attorney post) → [1.10-common-misc.csv](tags-cleaned/1.10-common-misc.csv); `visa_refused_date` → [1.8-key-dates.csv](tags-cleaned/1.8-key-dates.csv).
4. **Schema relaxation** — `key_stages_or_info` value type is now `str | list[str]` so a `travel_country: ['IN','CA','MX']` (post discussing multiple destinations) no longer breaks validation.
5. **`ingest_batch.py` safety nets** —
   - `dedup_tag_fields()`: programmatic dedup if a tag appears in both `tags` and `concerns_or_questions_tags` (keep only in concerns); also dedups within each list.
   - `repair_invalid_tags()`: out-of-vocab tags are **dropped with a per-doc warning log** rather than full-quarantining the document. Manual-batch convenience; production agentic pipeline retains the strict quarantine contract.
   - BQ-Writer rewritten to use SQL `MERGE` with `PARSE_JSON` for `key_stages_or_info` / `key_dates`, replacing the streaming-insert path. True idempotent upserts that survive re-runs at any cadence (the streaming path's ~1-minute dedup window had produced 35 duplicate rows for 10 case_ids across re-runs).
   - Post-import `index_state` UPDATE now runs as a single statement against MERGE'd rows (no streaming-buffer blocking).
6. **Result of batch-1 re-run** — **10/10 successfully tagged + indexed in Vertex AI Search**; 1 stale BQ table truncated; 10 GCS sidecar pairs in the live prefix; quarantine empty; `index_state='indexed'` on all 10 rows. Sample search `"layoff grace period"` returns posting10 (the attorney-tagged post).

**Reasoning:** Observation #1 (`gcs_path` should be file URI, not folder) reflects a clearer downstream convention — the JSON now self-identifies its source `.md` URI without needing the caller to know the basename convention. Observations #2/#1.1/#4.2 (ignore third-party facts) match the immigration-tagging principle that a posting represents the *applicant's* case; friend/boyfriend mentions are noise for similarity search. The dedup + vocab-repair safety nets give the manual batch a higher pass rate without weakening the production pipeline (which still uses the strict quarantine path defined by [QUARANTINE-PROCESS.md](content-ingestion-specifications/QUARANTINE-PROCESS.md)). Switching BQ to SQL MERGE eliminates the duplication that the streaming-insert API allowed once retries occurred outside the ~1-minute window.

**Alternatives rejected:**
- *Keep `gcs_path` as a folder for both legacy and new*: forces every consumer to reconstruct the filename, brittle and prone to drift.
- *Add `passport` to master vocab to satisfy the LLM*: user's observation #6.1 explicitly said passport is not the relevant topic in posting6; adding the tag would license future over-tagging. Dropping with a warning preserves intent.
- *Tighten Pydantic to reject `list` in `key_stages_or_info` and instruct the LLM to pick one*: brittle when a post genuinely is about multiple options (posting1 considers IN, CA, MX). The schema relaxation costs nothing downstream — facets still work on string elements.
- *Switch BQ writes to load jobs*: heavier than the SQL MERGE path; load jobs are batchy and slow for per-doc upserts.
- *Strictly quarantine on any out-of-vocab tag* (no repair): correct for the production pipeline but blocks the manual one-time batch on a single bad tag; the user just wants 10/10 indexed for testing the conversational app.

**Affected docs / status:** Done.
- [tagging-specifications/LLM-EXTRACTION-PROMPT.md](tagging-specifications/LLM-EXTRACTION-PROMPT.md), [tagging-specifications/JSON-SCHEMA-FIELD-DICTIONARY.md](tagging-specifications/JSON-SCHEMA-FIELD-DICTIONARY.md).
- [tags-cleaned/1.3-abbreviations.csv](tags-cleaned/1.3-abbreviations.csv), [tags-cleaned/1.8-key-dates.csv](tags-cleaned/1.8-key-dates.csv), [tags-cleaned/1.10-common-misc.csv](tags-cleaned/1.10-common-misc.csv).
- [content-ingestion-specifications/schema.py](content-ingestion-specifications/schema.py) (`GCS_PREFIX_RE`, `key_stages_or_info` type).
- [vertexai-search-ingestion-from-examples/scripts/ingest_batch.py](vertexai-search-ingestion-from-examples/scripts/ingest_batch.py) (`dedup_tag_fields`, `repair_invalid_tags`, MERGE-based BQ writer, single-statement post-import UPDATE, `gcs_path` synthesis).
- Vertex AI Search data store `imm-postings-datastore` now has all **10 documents**; BQ has 10 deduplicated rows with `index_state='indexed'`.

## D-028 — 2026-05-21 — Production BQ writes MUST use Storage Write API + staged MERGE (legacy streaming insert rejected; per-doc DML MERGE is a manual-batch-only exception)

**Decision:** The production BQ-Writer Cloud Run tool MUST write to BigQuery via the **Storage Write API** (`google-cloud-bigquery-storage` → `BigQueryWriteClient.append_rows`), appending to a new **`postings.postings_metadata_staging`** table on its `_default` stream (at-least-once). A **BigQuery scheduled query** (Phase 1: every 5 min; Phase 2: every 1 min) MERGEs the latest row per `case_id` from staging into the live `postings.postings_metadata` table that all consumers read. Staging is truncated weekly by a second scheduled query.

The manual one-off batch script `vertexai-search-ingestion-from-examples/scripts/ingest_batch.py` is an **explicit exception**: it does per-doc SQL MERGE via the Jobs API directly against the live table. Acceptable at ~10 docs/run where DML quotas don't matter; explicitly NOT the production pattern. A long-form NOTE was added to `bq_merge_row()` calling this out.

A new service account `sa-bq-scheduled-merge` was added to [PREREQUISITES-IAM-INFRASTRUCTURE.md §3.2 / §4](content-ingestion-specifications/PREREQUISITES-IAM-INFRASTRUCTURE.md) to own the scheduled query (separates write-path identity from MERGE-path identity). `sa-bq-writer-tool` no longer needs `bigquery.jobUser` — Storage Write is not a query job.

**Reasoning:**
- **Legacy streaming insert (`tabledata.insertAll` / `insert_rows_json`)**: only a ~1-minute weak dedup window via `insertId`; rows held in a separate streaming buffer for ~30–90 min that blocks DML on those rows; ~80% more expensive than Storage Write. Already removed from the manual script in D-027 once we observed 35 duplicate rows for 10 case_ids after retries.
- **Per-doc `MERGE` via Jobs API**: BigQuery has tight quotas on concurrent DML against a single table (historically ~1500/day/table; mutations queue and serialize). A Cloud Run tool firing one MERGE per ingested doc, at production rates, will hit the limit. Acceptable for 10-row manual batches; not for production.
- **Storage Write API**: cheaper, immediately queryable, supports exactly-once via offsets and at-least-once via `_default` stream, no streaming-buffer issue, supports high throughput. This is Google's current recommendation for new BigQuery write code.
- **Staging + scheduled MERGE pattern**: lets writers be append-only (simple, parallel, exactly-once-tolerant) while the live table stays deduped. A common GCP analytics pattern.

**Alternatives rejected:**
- *Storage Write API direct into live table with read-time dedup* (`QUALIFY ROW_NUMBER() OVER (PARTITION BY case_id ORDER BY ts DESC) = 1`): pushes the dedup cost onto every downstream consumer (Validator dedup-lookup, eval harness queries, conversational app's BQ grounding queries). Staging-and-MERGE keeps the live table clean.
- *Storage Write API with committed streams + per-doc offset accounting* for exactly-once: more complex; the at-least-once `_default` stream + downstream MERGE delivers the same result with less code.
- *Continue with per-doc SQL MERGE in production*: would not scale past pilot — DML quotas hit, plus DML is more expensive than Storage Write at volume.

**Affected docs / status:** Done.
- [PIPELINE-ARCHITECTURE-WORKFLOW.md §5.1](content-ingestion-specifications/PIPELINE-ARCHITECTURE-WORKFLOW.md) (new subsection mandating the pattern; staging table + MERGE SQL example; explicit exception for the manual batch script). §2.1 BQ-Writer failure-handling row updated. §8.1 cost line updated.
- [DEPLOYMENT.md](content-ingestion-specifications/DEPLOYMENT.md) component row 8 (BQ now includes staging table + scheduled MERGE); §3 provisioning order step 5 updated.
- [PREREQUISITES-IAM-INFRASTRUCTURE.md](content-ingestion-specifications/PREREQUISITES-IAM-INFRASTRUCTURE.md) §3.2 (new `sa-bq-scheduled-merge`; `sa-bq-writer-tool` jobUser dropped); §4 IAM matrix.
- [REDDIT-INGESTION-PIPELINE.md §7.6](content-ingestion-specifications/REDDIT-INGESTION-PIPELINE.md) cost line updated.
- `ingest_batch.py` `bq_merge_row()` docstring expanded with the manual-batch-exception note + cross-ref to §5.1 and D-028.

**Not yet built / next step when production code starts landing:** the actual `sa-bq-writer-tool` Cloud Run service using Storage Write API + the `postings_metadata_staging` DDL + the scheduled MERGE config. These are designs only; no production code exists yet.

## D-029 — 2026-05-21 — `experience-posting` is a MANDATORY tag for any first-hand consulate-visit account (regardless of outcome)

**Decision:** Whenever a posting is a **first-hand account of the applicant's own visit to a U.S. consulate or embassy** — visa interview, OFC biometrics, stamping pickup, 221(g) document drop-off, emergency appointment, etc. — the tag `experience-posting` MUST appear in the doc's `tags` field, regardless of outcome (approved / refused / 221(g) / pending / administrative processing). This is a **REQUIRED auto-emit rule**, not a heuristic — the LLM must check this condition and add the tag whenever it's true. The rule does NOT apply to posts that only PLAN or ASK about a future appointment, nor to hearsay about someone else's visit (per D-027's "WHO COUNTS AS THE APPLICANT" rule).

Tag placement: `tags` (background — describes the post *type*), not `concerns_or_questions_tags`.

**Mechanism:**
- A new section `REQUIRED TAGS (auto-emit rules)` was added to [LLM-EXTRACTION-PROMPT.md](tagging-specifications/LLM-EXTRACTION-PROMPT.md) immediately after the `TAG-RELEVANCE GATE`. `experience-posting` is the first entry; future required tags follow the same pattern.
- The description of `experience-posting` in [tags-cleaned/1.10-common-misc.csv](tags-cleaned/1.10-common-misc.csv) was tightened from the generic "Sharing personal immigration experience" to the consulate-visit-specific definition. The description now matches the prompt rule exactly so the LLM's CSV-grounded interpretation aligns with the auto-emit semantics.

**Reasoning:** Consulate-visit experience posts are a *post-type* discrimination that is high-signal for the downstream search use case — applicants searching "what happened at my Hyderabad interview" want to filter to other experience accounts, not to "asking what to expect" posts. Without an explicit rule the LLM was inconsistent: it tagged posting10 (an attorney post) and missed posting6 (the Hyderabad H-1B refusal walkthrough). An explicit auto-emit rule eliminates this variance.

**Alternatives rejected:**
- *Leave it to the heuristic prompt only*: the LLM had access to the master vocab and still missed posting6. Heuristics alone aren't sufficient for high-recall on a post-type signal.
- *Add a structured `post_type` enum field*: would require a schema migration and broader prompt rewrite. The `tags` array already handles post-type signals well; using `experience-posting` keeps the data contract stable.
- *Apply the rule programmatically in `ingest_batch.py`* (post-LLM heuristic that scans the .md for trigger phrases): brittle, and pushes content interpretation into the writer. LLM is the right layer for "is this an experience post?".

**Affected docs / status:** Done.
- [tagging-specifications/LLM-EXTRACTION-PROMPT.md](tagging-specifications/LLM-EXTRACTION-PROMPT.md) — new `REQUIRED TAGS (auto-emit rules)` section with `experience-posting` rule.
- [tags-cleaned/1.10-common-misc.csv](tags-cleaned/1.10-common-misc.csv) — `experience-posting` description tightened.
- Batch-1 re-tagged: **posting6** now has `experience-posting` (Hyderabad H-1B refusal walkthrough, the user's example). **posting3** also auto-tagged (B-2 interview that resulted in a same-day refusal). Both confirmed in the indexed documents in Vertex AI Search `imm-postings-datastore`. 10/10 docs still indexed; no quarantines.

**Pattern for future required-tag rules:** add a new entry under `REQUIRED TAGS (auto-emit rules)` in the LLM prompt + an aligned description in the corresponding master CSV + a `D-NNN` in MEMORY.md. No code changes needed.

---

## D-030 — 2026-05-21 — Batch-2 seed-corpus re-tag (72 docs) into a separate dir; invalid-date repair added; data store at 82 docs

**Decision:** The 72 `postings-examples/` seed postings were re-tagged through the **current** pipeline (post-D-027/D-029 rules) into a **new** directory `vertexai-search-ingestion-from-examples/postings-batch-2-tagged/`, with real `reddit-<YYYY-MM-DD>-<subreddit>-<post_id>` case_ids derived from each post's `full_url`. `postings-examples/` is left **untouched** as the frozen eval baseline (per the user's explicit instruction not to overwrite it). All 72 were indexed into the same `imm-postings-datastore`, bringing the data store to **82 documents** (10 batch-1 manual + 72 batch-2 seed). The old-vs-new differences are captured in [postings-batch-2-tagged/_diff-report.md](../vertexai-search-ingestion-from-examples/postings-batch-2-tagged/_diff-report.md).

**Invalid-date bug found + fixed (systemic):** During verification the data store showed **81, not 82**. Root cause: one doc (`reddit-2026-04-11-h1b-1t7sqmn`, orig case-69) was rejected by `documents.import` with `Invalid datetime 2026-02-29` — Gemini had converted a month-only mention ("Feb 2026") to the month's last day but used `29` (2026 is **not** a leap year; Feb 2026 has 28 days). The earlier per-doc run had optimistically marked `index_state='indexed'` in BigQuery even though the import had silently failed for that doc, masking the gap. Fixes applied:
- **Pipeline guard:** added `repair_invalid_dates()` to [ingest_batch.py](../vertexai-search-ingestion-from-examples/scripts/ingest_batch.py), called right after `dedup_tag_fields()`. It scans every `key_dates` value matching `YYYY-MM-DD`, and if the date is not a real calendar date it **clamps the day to the last valid day of that month** (e.g. `2026-02-29 → 2026-02-28`, `2025-04-31 → 2025-04-30`) — which matches this corpus's "month-only → end-of-month" convention — and rewrites any matching string inside `embedding_text` so the two stay consistent. Non-ISO-shaped values are left untouched (they may be legitimate free text). Leap-year-aware (`calendar.monthrange`), unit-tested.
- **Data repair:** corrected the one doc to `2026-02-28` in the local JSON, re-uploaded its GCS `.json` sidecar, re-imported (`success_count=1`), and updated the BigQuery `key_dates` JSON column via `UPDATE ... SET key_dates = PARSE_JSON(@kd)`. Final verification: data store `list_documents` = **82**, expected set (10+72) matches exactly, **0 missing / 0 extra**.

**Reasoning:** (1) Re-tagging into a separate dir preserves the eval baseline while still enriching the conversational-app index to 82 grounding docs. (2) Discovery Engine validates datetime-shaped struct fields at import and rejects the **entire** document on one bad date — a single hallucinated date is therefore a hard ingestion failure, so a deterministic repair belongs in the writer, not left to the LLM. (3) Day-clamping (vs. dropping the date) is safe because the corpus already uses end-of-month as the canonical value for month-only mentions, so the repaired value carries the intended semantics.

**Alternatives rejected:**
- *Drop the offending date key on invalid value*: loses information; the intended end-of-month value is recoverable by clamping.
- *Quarantine the whole doc on any invalid date*: over-reacts to a mechanical, deterministically-fixable error; would have needlessly held back a valid posting.
- *Validate dates only in `schema.py` Pydantic*: `key_dates` values are `Union[str, list[str]]` free-form (not all are dates), so a blanket Pydantic date validator would reject legitimate non-date values; a targeted shape-gated repair in the writer is the right layer.
- *Trust the BQ `index_state='indexed'` flag*: it was set optimistically before confirming the import per-doc; the authoritative check is `list_documents` / `get_document` against the data store, which is what surfaced the gap.

**Affected docs / status:** Done.
- [vertexai-search-ingestion-from-examples/postings-batch-2-tagged/](../vertexai-search-ingestion-from-examples/postings-batch-2-tagged/) — 72 re-tagged JSON + `.md` sidecars and `_diff-report.md`.
- [vertexai-search-ingestion-from-examples/scripts/ingest_batch.py](../vertexai-search-ingestion-from-examples/scripts/ingest_batch.py) — `import calendar`; new `repair_invalid_dates()`; wired into the post-LLM repair chain.
- Vertex AI Search `imm-postings-datastore` — **82 documents** verified. GCS + BigQuery + local JSON for the repaired doc all consistent at `h1b_filed_date: 2026-02-28`.

---

## D-031 — 2026-05-21 — GCS sidecar pair is the single source of truth; BigQuery + Vertex AI Search are derived projections

**Decision:** Keep the per-document GCS `.json` metadata sidecar (alongside the `.md` body), and formalize **the GCS sidecar pair (`.md` + `.json`) as the single source of truth (SoT)**. BigQuery `postings.postings_metadata` and the Vertex AI Search data-store `structData` are **derived projections**, rebuildable from GCS at any time with no LLM calls. Corrections are made to the GCS sidecar (or re-emitted by the pipeline) and flow outward (GCS → re-import into the data store; GCS → re-load into BigQuery); operators do not hand-edit the data store or BigQuery independently. `index_state` in BigQuery is derived bookkeeping, **not** authoritative — the authoritative "is it indexed?" check is `get_document`/`list_documents` against the data store. The full rationale, Phase-1-vs-Phase-2 consumption, and rejected alternatives are written up in [content-ingestion-specifications/SIDECAR-METADATA-DESIGN.md](../content-ingestion-specifications/SIDECAR-METADATA-DESIGN.md).

**Reasoning:** The sidecar `.json` is not redundant — it is (1) the cheap, deterministic, LLM-free replay/rebuild source (tagging is the expensive non-deterministic step); (2) the production sink's native contract — Phase-2 runs the data store in **sidecar mode** (`gs://.../*.json`) and the `.json` finalize is the Eventarc trigger (§4/§17 of PIPELINE-ARCHITECTURE-WORKFLOW.md), supplying search facets + chatbot grounding citations; (3) the immutable audit/lineage record and gold-training artifact for the eval harness / Example Store. The only real cost is three-way consistency (GCS json + BQ row + data-store structData) — felt directly in the batch-2 invalid-date repair, which had to be applied in three places. The SoT model fixes that as a governance/process rule rather than by deleting the file.

**Alternatives rejected:** (a) **Front-matter inside the `.md`** — pollutes the indexed `content.uri` body, breaks native sidecar-mode + facets. (b) **BigQuery-only, drop the GCS `.json`** — forces the event-driven importer to join BQ on every GCS event, makes an analytics store a hard operational dependency, loses cheap replay. (c) **Manifest/NDJSON only, no per-doc json** — manifests are transient, no per-object replay, doesn't fit the Phase-2 one-event-per-`.json` trigger. (d) **One combined JSON with body inline (no `.md`)** — loses the renderable body, bloats manifests.

**Affected docs / status:** Done.
- [content-ingestion-specifications/SIDECAR-METADATA-DESIGN.md](../content-ingestion-specifications/SIDECAR-METADATA-DESIGN.md) — new spec doc.
- [CLAUDE.md](CLAUDE.md) — `content-ingestion-specifications/` doc table updated to list it.
- **Open follow-up (not yet decided):** Phase-1 batch import currently uses inline `structData`, so the GCS sidecar is not exercised on the import path. Optionally switch Phase-1 import to consume the GCS `.json` in sidecar mode to rehearse the production path (recorded in §8 of the new doc).

---

## D-032 — 2026-05-21 — Batch-2 v2 corrections: seed-corpus content-loss fix + vocab-role tagging rules (outcomes=values, stages/dates=keys)

**Decision:** Acting on the user's review of the batch-2 diff up to case-11 ([postings-batch-2-tagged/Obervations-diff-batch-2.md](../vertexai-search-ingestion-from-examples/postings-batch-2-tagged/Obervations-diff-batch-2.md)), two classes of correction were made and the 72 seed docs re-tagged (run_id `batch-2-seed-retag-v2`).

**(1) Content-loss bug (data-quality, affected 34/72 docs).** In `synth_inputs` seed mode the first body line was unconditionally dropped (assumed to be a duplicated title). When `post_title` came from the companion `.json`/URL-slug and differed from the first body line, that line was REAL content and got silently truncated — e.g. case-7 lost "I-140 approved in Jan 2026 with PD as Nov 2025…", case-1 lost its layoff/I-797/I-94/I-140 bullet block. Fix: only strip the first body line when it (normalized) equals the resolved title; otherwise keep all body lines. Verified on case-7/case-1 (content restored) and case-69 (duplicate title still stripped, no regression). NB: case-10's "missing Indonesia consulate" (obs 10.8) is NOT a pipeline bug — that text was never in `case10.md`; the seed source was already a partial capture. case-1's `…-some` post_id is a placeholder URL in the seed source (`/comments/some-full-path-to-url`), not a pipeline bug.

**(2) Vocabulary-role tagging rules (logic/format).**
- **Outcomes (1.9) are `key_stages_or_info` VALUES only, never standalone tags** — they are ambiguous alone ("approved WHAT?"). The KEY should be the specific form/visa/petition: `{"I-140":"approved"}`, not `tags:["approved"]`. **Exception:** `RFE`, `NOID`, `221g` are named notices/refusal-types that remain valid tags (they are also in 1.3/1.10, hence dual-listed and self-describing).
- **Key-stage names (1.7) are KEYS only**; **key-date names (1.8) are KEYS only** — never standalone tags.
- **Prefer a specific stage key over the generic `case_status`/`petition_status`/`application_status`.** Form names (I-94, I-140 from 1.5) and visa codes are valid stage keys (`v.stage`), so `{"I-94":"valid"}` is preferred; use the generic key only when the referent is unclear, omit if even that is unclear (addresses obs case-1.2, #2, #3).
- **Stronger anti-hallucination gate:** emit a tag only with explicit textual support; never infer from what is typical for the visa type. Specifically bans unsupported `emergency-visa-appointment`/`no-slot`/`form-mistake`/`administrative-processing`/`petition-withdrawal`/`re-apply`/`open-for-attorney` (obs case-10) and broad pathway tags `employment-based-immigration`/`family-based-immigration` unless the post discusses the pathway category itself (obs case-2.1).
- **Precise tag semantics:** `re-entry` only when the applicant is/will be physically in the U.S. concerned about returning after travel abroad (obs case-11.1); `nonimmigrant-intent` only when 214(b)/ties is actually at issue.
- **`tagging_confidence`** must be a genuine per-post value via a subtract-from-1.0 rubric; no constant (obs G4).

**Mechanism:** enforced in BOTH layers — the LLM prompt (primary) and the writer (safety net):
- [LLM-EXTRACTION-PROMPT.md](../tagging-specifications/LLM-EXTRACTION-PROMPT.md) v1.1 — new `VOCABULARY ROLES` section, expanded `TAG-RELEVANCE GATE` + `TAG SEMANTICS`, confidence rubric, `WHAT NOT TO DO` additions, few-shot now shows outcome-as-value (`{"I-94":"expired"}`).
- [ingest_batch.py](../vertexai-search-ingestion-from-examples/scripts/ingest_batch.py) — `Vocab` now has `outcome` (1.9) and `stage_key` (1.7) sets; 1.9 removed from the `tags` vocabulary; `repair_invalid_tags` strips any `stage_key | date_key | (outcome − tags)` token from tags/concerns (RFE/NOID/221g survive); `vocab_errors` messages updated.

**Reasoning:** Outcomes-as-values removes the dominant ambiguity in the tag set and makes status filterable by subject in search; keys-only for 1.7/1.8 keeps the schema bag clean; the content-loss fix was the larger issue (nearly half the corpus had its lead paragraph truncated, which is also why many "missing tag" observations occurred — the source text wasn't reaching the tagger). Dual-layer enforcement matches the project's "prompt does it right, repair is the safety net" pattern (cf. D-027/D-029).

**Alternatives rejected:**
- *Blanket-ban ALL 1.9 words as tags (including RFE/NOID/221g)*: would nuke genuinely useful, self-describing event tags the user did not flag; dual-listing is the precise carve-out.
- *Auto-move a stripped outcome into key_stages with a guessed key*: the writer can't reliably infer the key; the LLM (with the new prompt) is the right layer, and the repair is only a safety net that drops the ambiguous standalone.
- *Fix only the flagged cases (1–11)*: the content-loss bug is systemic (34 docs), so the whole batch was re-run.

**Pipeline resiliency fix (found mid-run):** the first v2 run crashed at ~case58 on `requests.exceptions.ConnectionError('Connection aborted', ConnectionResetError(54))` during a GCS multipart upload — that wrapper is NOT the builtin `ConnectionError`, so it slipped past handling and aborted the whole batch before `documents.import` ran. Fixes in [ingest_batch.py](../vertexai-search-ingestion-from-examples/scripts/ingest_batch.py): (a) `gcs_upload` now retries transient upload errors with backoff via a new `_TRANSIENT_UPLOAD_EXC` tuple (`requests_exc.ConnectionError/Timeout/ChunkedEncodingError` + api_core 5xx + builtin `ConnectionError`/`TimeoutError`); (b) the per-doc GCS/BQ write block is wrapped in try/except so one doc's failure is recorded and skipped instead of killing the run. New `from requests import exceptions as requests_exc` import. Also added a reusable [gen_diff_report.py](../vertexai-search-ingestion-from-examples/scripts/gen_diff_report.py) (shows key_stages/key_dates value changes + confidence distribution).

**Affected docs / status:** Code + prompt done; full 72-doc re-tag run `batch-2-seed-retag-v2` executed and diff report regenerated for user verification. Data store remains 82 docs (case_ids unchanged → in-place upsert).

**Follow-up tweaks (prompt v1.2, 2026-05-22 — NOT yet re-run; awaiting user's further verification):** From spot-checking the v2 output, three LLM-adherence gaps were addressed in [LLM-EXTRACTION-PROMPT.md](../tagging-specifications/LLM-EXTRACTION-PROMPT.md): (1) require the SPECIFIC `<from>-to-<to>` transition tag (e.g. `f1-to-h1b` — it IS in 1.6; case-4 missed it) in addition to generic `change-of-status-COS`; (2) `open-for-attorney` only when an attorney/lawyer is explicitly sought, not generic "advice" (case-10); (3) `form-mistake` only for an actual error on a filed form, not confusion/delays (case-8). These will take effect on the NEXT re-run, which the user has deferred pending more verification.

**Second verification round (prompt v1.3 + code, 2026-05-22 — STILL NOT re-run; user verified ~20 cases in `Obervations-diff-batch-2-1.md`):**
- **New domain auto-emit rules** (prompt REQUIRED TAGS + deterministic code safety-net `enforce_cooccurrence_tags` in [ingest_batch.py](../vertexai-search-ingestion-from-examples/scripts/ingest_batch.py)): `I-140` present (in tags or as a key_stages key, any outcome) → `employment-based-immigration` (case-7.1, G1); `day1-cpt` → also `CPT` (case-17.1, G5). Code adds the implied tag to `tags` only if absent from tags+concerns (preserves dedup).
- **Precise tag semantics (prompt):** `tips` = shared, not sought (G2/case-9); `endless-wait`/`stamping-delay`/`attorney-fee`/`change-status-options`/`visa-refused` each require explicit textual support (cases 2/5/10/11); `change-status-options` only for in-US COS deliberation (cases 10.2/14.1, +recall case-17.3); `h1b-transfer` for H-1B employer change (case-5.1); `regular-vs-premium-processing` on an explicit comparison (case-2.1b); `background-check` for security screening (case-15.2); **221(g) → status value `refused` + tags `221g` AND `visa-refused`** (case-19); `visa-refused` only on actual refusal, never when issued (case-8.2).
- **`legal-status` vs `out-of-status` (G4):** professional read = NOT redundant (opposite states); kept both, added usage guidance to prefer specific tags (`out-of-status`/`maintenance-of-status`/`unlawful-presence`) and never pair `legal-status` with `out-of-status`. No master-CSV change (a full deprecation would go through the tag-lifecycle process if the user wants it).
- **Verified non-issues:** case-10's derived `.md` is NOT trimmed (body byte-identical to `case10.md`; only the `# URL` line removed + title prepended) — answers G3 and obs 10.5. case-12's `"ESTA":"invalid"` and a few recall gaps (case-1 `F-1` in visa_applying_for, case-7 `h1b-lottery`, case-15 `pp-clock`) are LLM judgment/recall items that the v1.3 prompt nudges but cannot fully guarantee; left for the user's verification.
- Remaining residuals after the NEXT re-run will be re-checked against the regenerated diff. Re-run still deferred per the user.

---

## D-033 — 2026-05-22 — Obs-2-2 corrections: applicant-vs-poster rule, consulate-visit requires outcome+consulate, visa_status key takes outcome value, tighter visa-refused / consular-processing / discussion / tips, new `visa-scheduling-portal-issue` vocab, case-28 dropped

**Decision:** From the user's batch-2 v2 verification (`Obervations-diff-batch-2-2.md`, remaining cases 20–69), encode the following as canonical rules in [LLM-EXTRACTION-PROMPT.md](../tagging-specifications/LLM-EXTRACTION-PROMPT.md) (prompt v1.3) and corresponding 1.10 vocabulary descriptions. Re-run deferred per user instruction; rules apply on the next batch.

**Rules added / tightened:**
- **Applicant ≠ poster (strengthened).** When a poster files on behalf of an immediate-family member (parent, child, fiancé, legal spouse), THE APPLICANT IS THE FAMILY MEMBER. All structured fields (`current_visa_or_greencard_category`, `visa_applying_for`, `resident_of_country`, `citizen_of_country`, `born_in_country`, `primary_consulate`, etc.) must reflect the actual applicant, not the poster. A poster who is just sharing tips with no own case must leave applicant-only fields empty.
- **Consulate-visit posts REQUIRE both** `outcome_status` (in `key_stages_or_info`, value from 1.9 — `approved` / `refused` / `221g` / `issued` / `pending` / `administrative-processing`) **AND** a valid `primary_consulate` code from 1.4. The `outcome_status` value reflects the result of the visa application listed in `visa_applying_for`. If no outcome stated, use `pending`.
- **`visa_status` key in `key_stages_or_info` must take an OUTCOME VALUE** (e.g. `valid` / `expired` / `expiring` / `approved`), NOT a visa category. Visa categories (`H-1B`, `F-1`, `B-2`) belong in `current_visa_or_greencard_category`. Prefer the specific stage key (`h1b-petition`, `h1b-rfe`) over the generic `visa_status`.
- **`visa_applying_for` vocabulary scope:** values may come from EITHER 1.1 (non-immigrant visas) OR 1.2 (green-card categories).
- **Current vs. intended visa stay distinct.** "I'm on H-1B and planning to travel on B1/B2" → `current_*: ["H-1B"]`, `visa_applying_for: ["B-1","B-2"]`. Do not collapse.
- **REQUIRED tag `combined-appointment`** when post mentions / asks about a combined slot with spouse/family.
- **REQUIRED tag `visa-renewal`** when post mentions a visa being renewed or asks about renewal.
- **`visa-refused` / `prior-visa-rejection` are VISA-only.** Refusal/denial of an emergency-appointment request, a CEAC "Refused" status not confirmed to apply to the applicant's visa, a form rejection for completeness, etc. do NOT qualify. Master CSV descriptions tightened accordingly.
- **`consular-processing` restricted to the GC consular-processing path** (CP vs AOS) or explicit "consular processing" mention. A nonimmigrant visa interview / stamping at a consulate is NOT `consular-processing`. **Mutually exclusive with `change-of-status-COS`.** Master CSV description tightened.
- **`discussion` only for generic non-applicant-case topics** (news, policy, industry update). Mutually exclusive with `experience-posting`; never used for the applicant's own case. Master CSV description tightened.
- **`tips` only for tip-givers, not tip-seekers.** Master CSV description tightened.
- **New vocab `visa-scheduling-portal-issue` (1.10)** — issue with the consulate visa-interview scheduling website/portal (login, slot availability bug, payment failure, OFC/IV booking glitch), distinct from the underlying visa application.

**case-28 dropped from the corpus** (user: "Not a good example"). Removed from `postings-examples/case-28/`, `postings-batch-2-tagged/reddit-2026-04-11-h1b-1ss7jbo.{md,json}`, GCS sidecar pair, BigQuery row, and Vertex AI Search data store. Expected corpus size for the next batch is now **71 seed docs** (+ 10 batch-1 manual = **81** total).

**Open questions flagged for user decision (not acted on):**
- (Q1) `cap-gap` (1.10 topical) vs `h1b-cap-gap` (1.6 action) — same provision; recommend consolidating to `cap-gap` only and deprecating `h1b-cap-gap`. Per US-immigration domain: cap-gap is *only* the F-1 → cap-SUBJECT H-1B bridge, so the `h1b-` prefix is implicit and the two are redundant. **Not changed yet — pending user confirmation.**
- (Q2) `outcome_status` vs `ceac_status` — both live in 1.7 stage-key vocabulary. CEAC status is DOS-portal-specific ("Issued", "Refused", "AP"); `outcome_status` is generic. Recommend keeping both with clarified roles — use `ceac_status` ONLY when the post explicitly cites CEAC; otherwise use `outcome_status`. **Pending user confirmation before encoding.**
- (Q3) case-26: user wants `change-of-employer-COE` for an H-1B → Day-1 CPT scenario. Canonical COE is employer-to-employer on H-1B; H-1B → F-1/CPT is more accurately `h1b-to-f1` + `day1-cpt`. **Not added to rules — flagged for user.**

**Reasoning:** All rules above derive from cases the user spot-checked (cases 20–69); each rule eliminates a class of recurring LLM mistakes (over-attribution to poster, missing consulate outcome/code, conflating visa categories with status values, over-firing visa-refused on appointment denials, over-firing consular-processing on non-CP visa interviews, generic `discussion` on personal-case posts, `tips` on tip-seekers). The new `visa-scheduling-portal-issue` vocab fills a recurring concept (cases 35, 63, 58 cluster) that had no precise tag.

**Alternatives rejected:**
- *Consolidate `cap-gap` and `h1b-cap-gap` unilaterally* — these CSVs are deliberately layered (1.10 topical vs 1.6 action), and the consolidation is a vocab-deprecation decision that should be explicit. Flagged as Q1 instead.
- *Auto-add `outcome_status: pending` for every consulate visa post* — would over-emit on policy/news posts that incidentally mention a consulate. The rule is scoped to posts that already emit `experience-posting` or `visa-interview` for an actual appointment.

**Affected docs / status:** Done (rules + vocab + corpus drop). Re-run deferred per user.
- [tagging-specifications/LLM-EXTRACTION-PROMPT.md](../tagging-specifications/LLM-EXTRACTION-PROMPT.md) — v1.3 (WHO-IS-APPLICANT expanded; new REQUIRED rules for consulate-visit `outcome_status`+`primary_consulate`, `visa_status`-takes-outcome, `combined-appointment`, `visa-renewal`, current-vs-intended-visa; relevance gate strengthened for `visa-refused`/`prior-visa-rejection`/`consular-processing`/`discussion`/`tips`).
- [tags-cleaned/1.10-common-misc.csv](../tags-cleaned/1.10-common-misc.csv) — descriptions tightened (`consular-processing`, `prior-visa-rejection`, `visa-refused`, `discussion`, `tips`); new entry `visa-scheduling-portal-issue`.
- Corpus drop of case-28 across `postings-examples/`, `postings-batch-2-tagged/`, GCS sidecar pair, BigQuery row, Vertex AI Search data store.

---

## D-034 — 2026-05-29 — App conversational-orchestration layer = custom Cloud Run BFF + Gemini (Option A); Agent Engine ADK agent (Option C) deferred; Search+Answer-app-direct (Option B) is a building block, not a standalone architecture

**Decision:** The mobile/web apps' conversational backend (the layer that owns intent recognition, multi-turn context, geo-aware proactive prompting, search+grounded-answer, conversational filtering, the posting/draft-review flow, and domain guardrails) is built as **Option A: a custom stateless FastAPI service on Cloud Run + Gemini**. The BFF calls **Gemini directly** for intent/entity-extraction/proactive-prompting, calls the **Vertex AI Search "Search + Answer" API** (over the existing `imm-postings-search-app` / `imm-postings-datastore`) for retrieval + grounded answers with citations, and on publish drives the **existing Tagger (`LLM-EXTRACTION-PROMPT.md`) → Validator → GCS-Writer → `documents.import`** ingestion contract (kept as a **shared module** so the Reddit pipeline and the app channel never drift on vocab/prompt version). The data tier is unchanged: single Vertex AI Search sink (D-016) + sidecar SoT (D-031).

**Session/conversation state:** persisted durably but **not in a separate store** — it lives in the same app-state store the app already needs (profiles, saved searches, alerts). Cloud Run is ephemeral/scale-to-zero and Gemini is stateless per call, so in-process memory cannot hold the conversation; each turn the BFF reads/writes one record per `session_id` (turn history, the accumulating per-session posting-draft metadata JSON, intent + geo branch, user ref, and the Vertex Answer-API session name). Vertex's managed Answer-API session covers only the search sub-flow; the broader app conversation session is owned by the BFF. The app-state store technology (Firebase Auth + Firestore vs Identity Platform + Cloud SQL) is a **still-open decision**; this does **not** reintroduce the *pipeline's* Firestore (D-013 was scoped to the ingestion pipeline — app state is a separate concern).

**Reasoning:** Option A is the only choice that covers all seven conversation responsibilities while keeping the project's scripted, guarantee-critical UX (enumerated §5.1 proactive-prompt branches; hard confirm-before-publish gate) deterministic, fits the cost/latency posture (D-016 consumption pricing; D-020 budget + kill-switch), reuses the ingestion contract cleanly, and stays portable — while still renting managed answer quality via the Search+Answer API where it matters.

**Alternatives rejected:**
- **Option B — Agent Builder "Search + Answer" app consumed (near-)directly:** covers only ~1 of the 7 responsibilities (search+answer). Adding intent routing, geo-aware prompting, posting, profile, and account actions forces a BFF anyway — collapsing into Option A. B is retained as (i) a **building block A consumes** (the Answer API) and (ii) an optional **search-only first slice** in phasing.
- **Option C — ADK + Gemini agent on Vertex AI Agent Engine: deferred, not rejected.** Loses to A for this app's profile because: (1) Agent Engine was chosen in D-009 for a **30-min batch** workload, not high-QPS interactive chat; (2) the agent reasoning loop (plan→tool→observe→respond) adds **per-turn latency** vs A's 1–2 direct calls; (3) runtime + variable reasoning tokens per turn are **pricier and less predictable** at consumer concurrency, cutting against D-016/D-020; (4) the scripted, confirm-before-publish flows are easier to **guarantee in explicit code** than to **steer** an autonomous agent toward; (5) **higher build/ops overhead** (ADK + Agent Engine deploy/versioning/loop-debugging); (6) **reuse is partial** — a new conversational agent would still be authored (shared concepts, not code), and the posting path is reused identically by A and C anyway; (7) C's advantages (managed sessions/tracing, D-009 consistency) are **replicable in A** (Firestore + Cloud Trace) whereas A's latency/cost/determinism advantages are not retrofittable onto C. **C remains a clean future swap** if the conversation ever needs genuinely open-ended, autonomous, many-tool reasoning — the fixed data tier + ingestion contract make the orchestration layer replaceable behind the app's API.

**Affected docs / status:** Done (decision recorded).
- [app-specifications/orchestration-options-tradeoffs.md](app-specifications/orchestration-options-tradeoffs.md) — status set to DECIDED; new §8 consolidates the choice + the 7-point "why not C" rationale; §2.1 documents session/state handling.
- [app-specifications/app-backend-specs.MD](app-specifications/app-backend-specs.MD) — orchestration layer named as Option A (pointer to this entry + the tradeoffs doc).
- **Open follow-ups:** (a) app-state-store + auth choice (Firebase Auth + Firestore vs Identity Platform + Cloud SQL) → **resolved in D-035**; (b) app-channel posting/`case_id` scheme (extending `CASE_ID_RE`/`source_uri` in `schema.py`); (c) fleshing out the full backend spec (API surface, search/answer contract, posting path, geo-routing, security/IAM, cost). These will each get their own `D-NNN` when settled.

---

## D-035 — 2026-05-29 — App identity + state store = Firebase Authentication + Firestore (Native mode); Identity Platform / Cloud SQL / roll-your-own / third-party rejected

**Decision:** The Option-A BFF (D-034) uses **Firebase Authentication** for identity and **Firestore (Native mode)** as the app-state store.
- **Auth:** email / Google / Apple sign-in + anonymous-guest (search-before-sign-up, upgradable to a permanent account); an app-generated **synthetic reddit-style username** stored on the profile (email/real name never exposed). The BFF verifies Firebase JWT **ID tokens** via the Admin SDK on an attached SA (no SA key files, D-018).
- **State store:** Firestore holds all user-scoped operational app state — user profile, **conversation sessions** (turn history + the accumulating per-session posting-draft metadata JSON + intent + geo branch, per D-034 §2.1), saved searches + alert subscriptions, posting history/drafts, and (V2) in-app messaging. Analytics/telemetry stays in **BigQuery**, not Firestore.

**Adopted defaults (revisable; recorded so the next session doesn't re-litigate):**
1. **Access pattern:** writes are **BFF-mediated only** (Admin SDK); **optional read-only client-direct Firestore listeners** (security-rules-guarded on `request.auth.uid`) for alerts + session live-updates.
2. **Profile ↔ canonical schema:** the profile **reuses canonical field names/vocabulary** (`current_visa_or_greencard_category`, `principal_country_of_chargeability`, …) so it can seed a posting draft and pre-filter searches.
3. **Alert push transport:** lean **FCM**; final choice deferred to the alerts design.
4. **Region:** Firestore in **`us-central1`** to colocate with Vertex AI Search / BigQuery / GCS.

**Reasoning:** Firebase Auth covers exactly the required providers + guest sessions with first-class mobile/web SDKs at no pilot cost and is GCP-native/ADC-friendly. Firestore's document model fits the session/draft/profile shapes with no ORM, its real-time listeners make the alerts + draft-review live UX cheap, native TTL expires stale sessions, and it scales to zero / is consumption-priced — matching the cost posture (D-016/D-020). The two pair natively (security rules + shared SDKs), enabling the optional client-direct real-time read path while keeping writes at the BFF choke point.

**Alternatives rejected:**
- **GCP Identity Platform:** per-MAU cost for enterprise federation / multi-tenancy this consumer app doesn't need; it's the same underlying tech as Firebase Auth, so it's a **drop-in upgrade later** if SSO/multi-tenancy ever appears — adopting now is premature.
- **Roll-your-own auth:** owns password/token/OAuth security risk for zero differentiation.
- **Third-party auth (Auth0/Clerk/Supabase):** off-GCP vendor, extra bill, identity data off-GCP; no advantage on this stack.
- **Cloud SQL (Postgres) as app-state store:** always-on instance floor cuts against D-016/D-020; no native client push (alerts would need a bespoke layer); Cloud Run→Cloud SQL connection management overhead. Reusing the existing Label-Studio Postgres was weighed but real-time alerts + scale-to-zero ranked higher. Remains the fallback if the app-state model ever turns heavily relational.

**D-013 note:** this does **not** reintroduce the *ingestion pipeline's* Firestore — D-013 was scoped to the pipeline; app state is a separate concern, so D-013 stands.

**Affected docs / status:** Done (decision recorded).
- [app-specifications/app-state-store-auth-options.md](app-specifications/app-state-store-auth-options.md) — status set to DECIDED; new §8 consolidates the choice + adopted defaults.
- [app-specifications/app-backend-specs.MD](app-specifications/app-backend-specs.MD) — app-state + auth named.
- **Open follow-ups** (still pending their own `D-NNN`): app-channel posting/`case_id` scheme (`schema.py` `CASE_ID_RE`/`source_uri`) → **resolved in D-036**; full backend spec build-out (API surface, search/answer contract, posting path, geo-routing, security/IAM, cost); alert-matching + push-transport design.

---

## D-036 — 2026-05-29 — Canonical schema generalized to be channel-agnostic (multi-channel identity/provenance); app is the first non-Reddit channel; backward-compatible via aliases

**Decision:** The canonical posting-metadata schema is made **generic across all ingestion channels and websites** (not Reddit-specific), per the user's directive. The app (posting-via-chat, D-034) is the first new channel; future website channels (Firecrawl, D-012) drop in with no further schema change. Adopted the recommended coherent model from [generic-channel-identity-options.md](app-specifications/generic-channel-identity-options.md) (Opt 1-A + 2-A + 3-A):
- **`case_id` prefix generalized** from the literal `reddit-` to `<channel>-`: `case_id = <channel>-<YYYY-MM-DD>-<container>-<native_id>[__c_<comment_id>]`, regex `^[a-z][a-z0-9]*-\d{4}-\d{2}-\d{2}-[A-Za-z0-9_]+-[a-z0-9]+(__c_[a-z0-9]+)?$`. All existing `reddit-…` ids and legacy `case-N` ids stay valid; D-010's deterministic/human-readable/idempotency-key properties are preserved.
- **New `channel` field** (lowercase token `reddit|app|web|…`) == the case_id prefix == the GCS `<channel>` segment. Derived from the prefix when omitted (legacy `case-N` → `reddit`); a supplied value must match the prefix. New first-class search facet.
- **Channel-agnostic provenance field names**: `subreddit` → **`source_container`** (community/board/section/topic), `reddit_post_id` → **`source_native_id`** (source-native or app-minted id; dedup key). `channel` (coarse pathway) is deliberately distinct from `source_system` (precise origin: `reddit` / app name / site domain). `source_uri` relaxed to accept `r/<sub>`, any `<scheme>://…` URI, or `""`. `ingestion_method` re-documented (`api_crawl`/`firecrawl`/`app_conversational_post`/`manual_upload`).
- **Backward-compatibility (Opt 3-A):** generic names are canonical; the old keys `subreddit`/`reddit_post_id` are accepted on input via Pydantic `AliasChoices` (+ `populate_by_name`), and read-only `.subreddit`/`.reddit_post_id` properties keep old consumers working. **No migration required**; the frozen seed corpus (D-030) and the GCS sidecar SoT (D-031) are untouched.

**App-channel mapping (adopted defaults):** `channel="app"`; `source_container` = **synthetic username**; `source_native_id` = **Firestore posting doc id** (idempotency key); `ingestion_method="app_conversational_post"`; `source_uri="app://post/<id>"` (or `""`); `full_url` = app deep link or `""`; `source_system` = app name (**TBD**, product naming). The metadata JSON is produced by the BFF+Gemini conversation through the **same** Tagger(`LLM-EXTRACTION-PROMPT.md`)→Validator→GCS-Writer→`documents.import` contract (D-034) — only identity/provenance differ; tagging is still master-vocab-only (D-025).

**Reasoning:** The ingestion *contract* and GCS path were already channel-agnostic (D-011); only the identity/provenance layer was Reddit-coupled. Generalizing the prefix + field names (rather than enumerating a literal per channel) means a new website is just a new `channel`/`source_system` value with zero schema code change. Read-aliases deliver the generic schema immediately without breaking the 81 live + 72 frozen seed docs (a field rename is deterministic and needs no re-tag, so on-disk uniformity can follow later).

**Alternatives rejected:** opaque/UUID `case_id` (loses D-010 properties — already rejected); per-channel literal prefixes (every new site edits code); keep Reddit field names + relax-only (not genuinely generic — against the directive); full rename + re-emit the corpus now (touches the frozen seed corpus D-030 + re-imports 81 docs for no immediate benefit; aliases make it deferrable).

**Verification:** `schema.py` smoke test passes; **all 71 batch-2 sidecars + batch-1 sidecars (carrying the old `subreddit`/`reddit_post_id` keys) validate unchanged**; legacy `case-N` derives `channel=reddit`; a synthesized app-channel post validates; a `channel`-vs-prefix mismatch is correctly rejected. (The one nonconforming seed `postings-examples/case-1/*.json` fails on a pre-existing wrong-bucket `gcs_path`, unrelated to this change.)

**Affected docs / status:** Schema + dictionary done & verified.
- [content-ingestion-specifications/schema.py](content-ingestion-specifications/schema.py) — `CASE_ID_RE`, `CHANNEL_RE`, `SOURCE_URI_RE`, `channel` field + derivation validator, `source_container`/`source_native_id` (+ aliases + back-compat properties), `populate_by_name`, updated smoke sample, `BIGQUERY_SCHEMA`.
- [tagging-specifications/JSON-SCHEMA-FIELD-DICTIONARY.md](tagging-specifications/JSON-SCHEMA-FIELD-DICTIONARY.md) — v2.3.
- [app-specifications/generic-channel-identity-options.md](app-specifications/generic-channel-identity-options.md) — DECIDED + §9; [app-backend-specs.MD](app-specifications/app-backend-specs.MD) — app-channel identity named.
- **Deferred follow-ups (NOT done — must precede the next pipeline run):** (a) **app-content PII posture** (§8.1 — separate open decision; D-017 dropped DLP for *public Reddit*, but first-person app posts may carry more PII); (b) **live-pipeline code sync** — `ingest_batch.py`, `gen_diff_report.py`, and the live BigQuery table columns + clustering (`subreddit,severity`→`channel,severity`) to the generic names (aliases/accessors cover reads, but writers emit field names) → **done in D-037 (code); live BQ table recreate is the one remaining ops step**; (c) optional deterministic key-rename migration of the 81 live sidecars for on-disk uniformity.

---

## D-037 — 2026-05-29 — Manual-batch pipeline code synced to the generic schema (D-036); live BQ table recreate is the remaining ops step

**Decision / work done:** Updated the manual-batch pipeline scripts under `vertexai-search-ingestion-from-examples/scripts/` to emit and write the generic channel-agnostic field names from D-036, so a re-run produces schema-consistent sidecars + BigQuery rows:
- **`ingest_batch.py`** — `synth_inputs` now emits `channel`, `source_container` (was `subreddit`), `source_native_id` (was `reddit_post_id`); `case_id` built as `{CHANNEL}-<date>-<container>-<native_id>` (CHANNEL=`reddit` for this batch, so existing case_ids are unchanged → in-place upsert preserved). Seed-mode provenance reads tolerate either old or new keys (`source_container`/`subreddit`, `source_native_id`/`reddit_post_id`). `build_user_msg` labels updated (+`CHANNEL`). `merge_stub_and_llm` forces the generic keys and **pops any legacy alias keys** the LLM might emit (avoids an `AliasChoices` double-key validation error). `bq_merge_row` MERGE `SELECT`/`WHEN MATCHED`/params switched to `channel`/`source_container`/`source_native_id` (+ new `channel` param).
- **`provision_gcp.py`** — BQ table clustering `("subreddit","severity")` → `("channel","severity")`; docstring updated. (Table DDL columns come from `schema.py BIGQUERY_SCHEMA`, already generic per D-036.)
- **`decommission_gcp.py`** — `ID_PREFIX` generalized from literal `reddit-<date>-` to `{CHANNEL}-<date>-`; docstrings updated.
- **`gen_diff_report.py`** — no change needed (references only tag fields, no Reddit identity fields).

**Verification (no GCP calls — offline contract checks):** all four scripts compile; the BQ MERGE `SELECT` provides **exactly** the 35 `BIGQUERY_SCHEMA` columns and every `@param` resolves; a generic stub validates through `PostingMetadata`, derives `channel=reddit`, and `model_dump()` emits generic keys with **no** legacy keys and covers every column the writer reads. (Full pipeline run not executed — needs GCP ADC + the google-cloud libs.)

**Remaining ops step (NOT code — must happen before the next live run):** the **existing live BigQuery table must be recreated**, not altered: columns were renamed (`subreddit`→`source_container`, `reddit_post_id`→`source_native_id`) and `channel` added, and the clustering key changed — and the MERGE's `INSERT ROW` requires the source columns to match the target table **exactly** (old + new columns coexisting would break it). Path: `decommission_gcp.py --full` (drops the table) → `provision_gcp.py` (recreates with the generic schema + `channel,severity` clustering) → re-run `ingest_batch.py` (re-tags + repopulates the 81 docs). BigQuery is a derived projection (D-031), so this is safe. The GCS sidecar SoT and the Vertex data store are unaffected by the BQ recreate (case_ids unchanged → data-store docs upsert in place on re-ingest).

**Still open:** D-036 follow-up (a) app-content PII posture; (c) optional on-disk key-rename migration of the already-committed sidecars in `postings-batch-1/2-tagged/` (they still validate via aliases, so this is cosmetic/uniformity only).

**Affected docs / status:** Done (code) — `vertexai-search-ingestion-from-examples/scripts/{ingest_batch,provision_gcp,decommission_gcp}.py`; [generic-channel-identity-options.md](app-specifications/generic-channel-identity-options.md) §9 updated.

---

## D-038 — 2026-05-29 — App-backend open decisions resolved (PII, moderation, app name, alerts transport, + adopted technical defaults)

**Decision:** Resolved the [APP-BACKEND-ARCHITECTURE.md](app-specifications/APP-BACKEND-ARCHITECTURE.md) §18 open items.

**Product/policy:**
- **App-content PII (resolves D-036 §8.1):** **explicit pre-publish consent + a "this will be public" notice on the draft-review card**. **No Cloud DLP / scrub for now** — reversible (DLP can be inserted before `documents.import` later, consistent with D-017's reversibility note). Applies to the `app` channel only.
- **Moderation of user-generated public posts:** **Gemini safety filters + policy rules (minimum)** run before `documents.import`; thresholds / appeal flow can tighten later.
- **App `source_system` = `"unclesamcalling"`** (the web/mobile app's name). So app-channel identity is `channel="app"`, `source_system="unclesamcalling"`, `source_container=<synthetic_username>`, `source_native_id=<firestore post id>`, `ingestion_method="app_conversational_post"` (case_id unchanged form, D-036).
- **Alert push transport = FCM** (confirms the D-035 default).

**Technical (adopted recommendations):**
- **Answer API:** use Discovery Engine `servingConfigs :search` + `:answer` with a managed multi-turn **session** + citations; **confirm exact method/session/citation shapes + grounding/safety knobs against live Google docs before implementation** (treated as a build-time verification, not a fork).
- **Date/recency filtering:** type `posting_date` + the timestamps as **datetime** in the data-store schema so Discovery Engine supports range filters + recency boost; **numeric epoch facet** as fallback if needed.
- **Production BQ write path for app posts:** **Storage Write API + staged MERGE (D-028)**, not per-doc DML.

**Reasoning:** PII-consent-now (vs DLP) keeps P2 unblocked at low cost while staying reversible (public Reddit precedent in D-017); Gemini safety + policy rules is the minimum bar for public UGC; the app name unblocks the provenance field; FCM matches the Firebase stack; the technical items are confirmations/standard patterns, not new architecture.

**Still open (non-blocking):** BFF home directory (`app-backend/` vs `website/`); the exact enumerated profile field set (reuses canonical vocab per D-035). These get decided when P1 code lands (own `D-NNN`).

**Affected docs / status:** Done.
- [APP-BACKEND-ARCHITECTURE.md](app-specifications/APP-BACKEND-ARCHITECTURE.md) — §10 (PII + moderation + identity), §11/§12 (FCM), §18 (open items → resolved).
- [app-backend-specs.MD](app-specifications/app-backend-specs.MD) + [generic-channel-identity-options.md](app-specifications/generic-channel-identity-options.md) — `source_system` TBD → `unclesamcalling`.

---

## D-039 — 2026-06-03 — Public no-ingest grounding = a second managed Vertex AI Search **website data store** blended into the engine (extends D-016); self-managed Vector Search retired

**Decision:** Grounding spans three priority tiers, all served by **managed Vertex AI Search (Discovery Engine)** through the Search + Answer API:
1. **App/web postings** (highest) — `imm-postings-datastore` (DS-1), `channel="app"` (D-034/D-036/D-038).
2. **Reddit + future ingested sources** — DS-1, `channel="reddit"` (+ future `channel` values, no schema change, D-036).
3. **Specific public sites, NO ingestion** — a **new second data store, DS-2 = a Vertex AI Search *website* data store**, scoped to those domains' URL patterns; Google crawls/indexes them. We run no scraper/chunk/embed pipeline for this content.

- **Precedence is implemented as a managed `boostSpec`**, not custom merge code: boost `channel="app"` highest, `channel="reddit"` next (both DS-1), DS-2 (public) baseline → ranks lowest. One `:answer` call returns a single grounded answer with unified citations across all three tiers (priority `app > reddit > public`).
- **Retired:** the **self-managed Vertex AI Vector Search index** (`legal_intake_deployed_v2`, ~807 chunks, `VERTEX_AI_INDEX_*`) that the prototype `api.py`/`query.py` grounded on. It violated D-016, billed for an always-on serving node, and — being a crawl→chunk→embed artifact — contradicts the "no ingestion" requirement for public content. Its public source sites (uscis.gov, dol.gov, travel.state.gov, visaguide.world, …) become DS-2's URL patterns. The prototype's `qa_pairs` Firestore log is likewise retired in favour of the D-035 session/profile model.
- **Firestore (D-035) carries the two non-grounding requirements:** user **profile** (`users/{uid}`) and **conversational history/state** (`sessions/{session_id}`: turns, draft, intent, geo). Firestore is never a grounding source.

**Relationship to D-016:** this **extends, does not contradict, D-016.** D-016's "single sink" rejected a *parallel self-managed Vertex AI Vector Search* on cost/ops grounds (always-on node, embedding lifecycle). DS-2 keeps everything inside *managed* Vertex AI Search — no always-on Vector Search node, no embedding ownership — so D-016's cost/ops reasoning is preserved. D-016's literal "no second index" is refined: a second *managed* data store is permitted **only** to satisfy a grounding need that cannot be met by ingestion (public content we may not copy/crawl ourselves). The structured ingested corpus remains a single datastore (DS-1) across all channels.

**Reasoning:** The three sources have fundamentally different ownership: tiers 1–2 are content *we* ingest and tag (belongs in DS-1 as channels, per D-036); tier 3 is third-party public content we are explicitly **not** to ingest — so the only managed way to ground on it is a Google-crawled website data store (or Grounding-with-Google-Search restricted to those domains). Keeping all three under one engine gives managed grounding + citations + a single precedence knob (`boostSpec`), avoids a custom BFF merge layer, and avoids the always-on Vector Search cost the prototype was incurring.

**Alternatives rejected:**
- **Keep the self-managed Vector Search index for public content** (the earlier two-store hybrid) — requires ingestion (against requirement 3), keeps the always-on node D-016 rejected, and forces a custom merge layer in the BFF.
- **Ingest the public sites into DS-1** — violates the "no ingestion" requirement and risks copying third-party content we don't own.
- **Grounding with Google Search (whole web)** — too broad for "certain public sites only"; retained only as a fallback for tier 3 if basic website indexing coverage proves insufficient.

**Build-time verification (confirm against live Google docs before implementation, per D-038):**
1. Confirm a **website data store can be blended with the structured DS-1 in one engine** and that `boostSpec` ranks across data stores. **Fallback if not supported:** a thin **two-call BFF merge** (`:answer` over DS-1 primary + a secondary query over DS-2, merged by precedence) — both halves still managed (citations, no Vector Search node).
2. **Website indexing mode:** advanced website indexing requires domain verification (we don't own uscis.gov etc.), so third-party sites use **basic website search** (URL-pattern scoped, no verification) or Grounding-with-Google-Search restricted to those domains.

**Affected docs / status:** Decision recorded; implementation pending P1.
- [ARCHITECTURE_GAP_reddit-grounding.md](ARCHITECTURE_GAP_reddit-grounding.md) — investigation, deviation analysis, and the recommended solution this decision ratifies.
- Supersedes the prototype `api.py`/`query.py` Vector Search RAG stack (un-logged; diverged from D-016/D-034/D-035 — see the gap doc's "Deviations" section).
- **Open follow-ups (own `D-NNN` when settled):** the exact public domain/URL-pattern list for DS-2; the blend-vs-two-call outcome from verification item 1; decommission plan for the Vector Search index + `qa_pairs`.

---

## D-040 — 2026-06-03 — Self-managed Vertex AI Vector Search decommissioned (post-D-039); grounding fully on `imm-postings-datastore`

**Decision / work done:** After the grounding realignment (D-039) and the new backend going live on Cloud Run (datastore + Answer API, validated 13/13), the retired self-managed **Vertex AI Vector Search** resources were torn down to stop their 24/7 cost. Discovery found the project had accumulated **4 index endpoints + 4 indexes** all named `legal-intake-*` (from repeated `index.py` runs back to 2026-03-18), of which **two endpoints had deployed indexes billing 24/7** (`legal_intake_deployed_v2` and `legal_intake_deployed`). All were unreferenced by any live code.

- **Torn down:** undeployed both billing deployed-indexes, then deleted **all 4 index endpoints** (incl. `245914571645124608` from `.env`) and **all 4 indexes** (incl. `8958040089863127040`); deleted the retired `gs://imm-postings-ingestion/chunk_mapping.json`; removed the stale `VERTEX_AI_INDEX_ENDPOINT_ID` env var from the `immiguide-api` Cloud Run service (→ revision `…00010`).
- **Config cleanup:** removed `VERTEX_AI_INDEX_*` from `.env`; updated `CLAUDE.md` env-var section.
- **Verification:** post-teardown the Cloud Run E2E suite passed **13/13** — `/api/ask` still returns `reddit-*` sources; grounding entirely on the managed datastore. Effectively irreversible (the builder `index.py` was already deleted in D-039) — intentional, it's retired.

**Reasoning:** the Vector Search index was the old prototype's store (807 crawled gov/law-firm chunks, **zero Reddit** — the original grounding bug), violated D-016 (single managed sink), and billed for always-on serving replicas nothing used. Removing it recovers the cost (the largest line item per D-016's estimate, ~$150–500+/mo per billing endpoint) with no functional impact.

**Affected docs / status:** Done. [PHASE-E-PLAN.md](PHASE-E-PLAN.md) (plan + execution); TODO.md ticked; `.env` + `CLAUDE.md` cleaned. Historical decision records (ARCHITECTURE_GAP, FINAL-ARCHITECTURE) left as-is.

## D-041 — 2026-06-06 — Multi-view searchable user content via DS-1 content docs; the live profile stays Firestore app-state and is NEVER indexed

**Decision:** To make different "views" of a user searchable (current profile vs past experiences vs messages), each searchable view is modeled as **content in DS-1** — a sidecar (`.md` + `.json`) document distinguished by `channel` / `doc_kind` — **not** by indexing the profile. Specifically:
- **Messages/postings** stay tier-1 (`doc_kind=post`, in-app channel). Unchanged.
- **Past experiences** become their own searchable documents (**new `doc_kind=experience`**, in-app channel), each a sidecar pair: `.md` = the experience text; `.json` = facets **about that experience** (milestone, the dated event, visa-at-the-time, consulate, outcome) — never the user's current-state tags. Consent-gated (default OFF).
- **The live user profile (`users/{id}`) is NEVER imported into the datastore.** It remains Firestore app-state / Gemini context (pre-fill drafts, pre-filter searches), exactly per D-035 / FINAL-ARCHITECTURE §6.
- **Storage of record:** profile = Firestore; *published* content = GCS sidecar (D-031, source of truth) + a Firestore mirror for ownership ("my experiences"). To make a consented slice searchable, project it from Firestore → GCS sidecar → `documents.import` (Firestore is not a grounding source).
- Multiple views = multiple **documents** (one `.json` per doc), not multiple JSONs on one document (the sidecar contract is 1 `.md` + 1 `.json` per doc).

**Reasoning:** This is exactly what D-036 ("a new source = a new `channel` value, zero schema work") and the sidecar pattern were built for, so experiences/connect-cards as content add a `doc_kind`/`channel`, not a new architecture. The **only** thing that would deviate is indexing the *profile itself*, which contradicts D-035's "profile is app-state, NEVER a grounding source" — so we draw the hard line there: searchable views are always *published content*, never the profile record. Experience facets describe the experience (a past event), preserving the phase-I "past ≠ current state" rule.

**Alternatives rejected:** (a) Index the live profile into DS-1 — contradicts D-035/§6; reopens the app-state-vs-grounding boundary. (b) Attach multiple JSONs to one document — impossible; `structData` is one JSON per doc. (c) Match "same boat" users purely via Firestore queries — viable but doesn't make experiences citable in grounded answers; kept as a possible complement, not the primary path.

**Affected docs / status:** Open (plan). [PHASE-J-PLAN.md](PHASE-J-PLAN.md); addendum §10 added to [FINAL-ARCHITECTURE.md](FINAL-ARCHITECTURE.md). Implementation pending on `phase-J-reconcile`.

## D-042 — 2026-06-06 — Profile↔message reconciliation happens at publish time in the backend (deterministic field-merge + LLM conflict explainer)

**Decision:** The merge/reconcile of the two canonical sources — the saved profile (`users/{id}`) and a message/posting being composed — runs **at publish/compose time in the backend**, producing the **single** posting sidecar JSON that gets indexed (the profile contributes context; it does not get its own sidecar on that document). Field-level rules (the canonical tag fields share names across both schemas, so the merge is a projection):
- **same value** → no-op; **message empty + profile set** → pre-fill from profile; **both set & differ** → conflict: *message wins for this posting* and the user is **offered an update to their profile** (per `specs-userprofile.md` "data conflict scenarios"); **background** → union (user never re-enters background already in the profile).
- Start **deterministic** (field merge + conflict list) plus an **LLM "conflict explainer"** (plain-English prompt to update the profile). A fully agentic reconcile agent is a later option, not v1.

**Reasoning:** Both schemas reuse the same controlled vocabulary and field names (`current_visa_or_greencard_category`, `consulates`, `key_dates`, …), so reconciliation is a mechanical field projection — no new schema, no new datastore behavior. Doing it at publish time keeps the sidecar contract intact (one JSON indexed) and matches the BFF/posting-flow design in FINAL-ARCHITECTURE §5/§7.

**Alternatives rejected:** (a) Reconcile in an offline batch — loses the in-conversation "update your profile?" prompt the spec requires. (b) Index both the profile JSON and the message JSON and reconcile at query time — violates D-041 (profile never indexed) and the single-sidecar contract. (c) Lead with a full LLM reconcile agent — unnecessary cost/latency for a field-level merge; deterministic core + LLM explainer is cheaper and auditable.

**Affected docs / status:** Open (plan). [PHASE-J-PLAN.md](PHASE-J-PLAN.md) §4; addendum §10 in [FINAL-ARCHITECTURE.md](FINAL-ARCHITECTURE.md). Implementation pending on `phase-J-reconcile`.

## D-043 — 2026-06-06 — Experience-share consent defaults ON (supersedes the default-OFF in D-041)

**Decision:** The per-experience "share the timeline for other users" consent now defaults to **ON** (the checkbox is ticked by default). On save, every experience the user has not explicitly un-ticked is projected to a searchable DS-1 `doc_kind=experience` document. This **supersedes the default-OFF stance recorded in D-041** (per-experience opt-in). The mechanism is unchanged — still per-experience, still respects an explicit opt-out (`shared=false`); only the default flips.

**Reasoning:** Product call (user directive): the platform's value is letting applicants on the same step find each other, so experiences should be discoverable by default rather than requiring an opt-in most users would skip. Implemented in `profile._clean_journey` (`shared` defaults `True`) with the stage-2 label reworded to "Share the timeline for other users".

**Alternatives rejected:** Keep per-experience opt-in (default OFF, D-041) — safest privacy posture but suppresses the "same boat" discovery the feature exists for. Whole-profile single toggle — coarser control than per-experience.

**Caveats / residual posture:** Experiences remain PII-free (scrubbed) and tagged only about the experience (never current-state). The hard D-041 boundary is unchanged: the **live profile is still NEVER indexed** — only consented *experience documents* are. A user can still un-tick any experience (which withdraws/deletes its doc). If a stricter privacy default is ever required (e.g. regulatory), flip `_clean_journey`'s default back to `False`; no schema change.

**Affected docs / status:** Done (code) on `phase-J-reconcile`: `profile.py` (`_clean_journey` default ON), `website/.../onboarding/page.tsx` (label), tests updated (`test_reconcile` C2/C2b). D-041's default-OFF line is **superseded by this entry** (D-041 otherwise stands).

## D-044 — 2026-06-06 — Deleted the legacy `examples/` corpus (stale, redundant, unused)

**Decision:** Removed the top-level `examples/` folder (74 `case-N/` dirs with `caseN.txt` + `caseN.json`, plus a `DS-160/` guide; 147 files, ~1.2 MB) on `phase-K-cleanup`.

**Reasoning:** It was the **legacy predecessor** of `proceedings-obsidian/postings-examples/` and was (a) loaded by **no runtime code** — the only `.py` hit was the word "examples" in `query.py`'s intent-classifier keyword list, not the folder; (b) **not used by Reddit ingestion** (no live ingestion code; legacy crawl/label scripts don't reference it); (c) on an **obsolete schema** — old field names like `concerns_or_questions_tag_list` / `confidence_score`, missing most of the current canonical (`case_id`, `consulates`, `primary_consulate`, `embedding_text`, `severity`, `subreddit`, …). The only reference anywhere was a path entry in local `.claude/settings.local.json` (gitignored tooling, not app code).

**Kept (NOT deleted):** `proceedings-obsidian/postings-examples/` — the **current** canonical-schema corpus (72 cases, `.md` + `.json`), which the schema dictionary / tagging specs are documented against and which is the intended seed for static few-shot exemplars and the Phase-2 fine-tuning gold set (PIPELINE-ARCHITECTURE-WORKFLOW §6). Few-shot prompting is **designed but not implemented** in live code (all tagging is currently zero-shot: instructions + controlled vocabulary + user text).

**Affected docs / status:** Done on `phase-K-cleanup`. No code/doc references to update (none existed). `postings-examples/` retained.

## D-045 — 2026-06-06 — Single source of truth for the tag vocabulary (`tags-cleaned/`); obsidian copy is now a symlink

**Decision:** There were **two divergent copies** of `tags-cleaned/` — the root one (loaded by code: `posting.py` `_TAGS_DIR`, `search_client.py`) and a stale mirror in `proceedings-obsidian/tags-cleaned/` (5 of 10 CSVs had drifted; the mirror lacked recent root additions like `i140_filed_date`, `past-experience`, the broadened `experience-posting`, etc., and carried a stale duplicate `h1b-cap-gap` already covered by root's `cap-gap`). Made the **root `tags-cleaned/` the single source of truth** and replaced `proceedings-obsidian/tags-cleaned/` with a **symlink → `../tags-cleaned`** so the vault always reflects the live vocabulary; no possibility of future drift.

**Reasoning:** Two editable copies = two sources of truth = silent drift (already happened). The code only ever reads the root copy, so root is authoritative; the obsidian vault just needs to *see* the same files for browsing — a symlink does that with zero duplication. Verified nothing was lost (root is a superset; the lone obsidian-only key was a stale duplicate) and the live vocab still loads (415 tags). Note: git stores it as a symlink (mode 120000) — Obsidian follows it on macOS; a Windows checkout without `core.symlinks` would see a text stub (acceptable for this Mac-based project).

**Affected docs / status:** Done on `phase-K-cleanup`. obsidian `CLAUDE.md` reference to `tags-cleaned/` still resolves via the symlink (no change needed).

## D-046 — 2026-06-06 — Archived the retired prototype to `legacy/` (project-structure cleanup K.1)

**Decision:** Moved the first-generation prototype out of the repo root into `legacy/` (kept, not deleted): the 11 orphan modules `agent_crawl.py`, `agent_label.py`, `auto_label.py`, `continuous_crawl.py`, `crawler.py`, `deploy_agent.py`, `discover_urls.py`, `json_pydantic_schema.py`, `monitor_qa.py`, `pipeline.py`, `prepare_labeled_data.py`; the `labeling_agent/` package + `tests/test_labeling.py`; and `urls.txt` / `url_registry.json`. Added `legacy/README.md`. After this, the repo root holds **only the 6 live backend modules** (`api.py`, `query.py`, `search_client.py`, `posting.py`, `profile.py`, `reconcile.py`) + `seed_users.json` + `tags-cleaned/`.

**Reasoning:** None of the moved files is imported by the live service or shipped in the `Dockerfile` — they're the retired Firecrawl→label→Vector-Search pipeline (D-016/D-039/D-040). Keeping them at root obscured "what actually runs." Archived (not deleted) because some are flagged for possible reuse (e.g. `crawler.py` as a future Firecrawl non-API adapter) and they cost nothing in `legacy/`. This is **K.1** of the phased project-restructure plan (evaluation in this session): K.1 archive legacy → K.2 `backend/` package → K.3 docs consolidation.

**Verification:** live modules import; `test_reconcile` 60/60, `test_posting_tagging` 29/29, `test_profile` 25/25; `Dockerfile` unchanged (copies only live files). Updated `CLAUDE.md` (Architecture/Commands now describe the live service; old crawler pipeline marked retired/archived).

**Affected docs / status:** Done on `phase-K-cleanup`. K.2/K.3 pending.

## D-047 — 2026-06-06 — Backend moved into `backend/` package (project-structure cleanup K.2)

**Decision:** Moved the live FastAPI service out of the repo root into **`backend/`**: the 6 modules (`api.py`, `query.py`, `search_client.py`, `posting.py`, `profile.py`, `reconcile.py`) + `seed_users.json` + `tags-cleaned/` + `tests/` + `scripts/` + `Dockerfile` + `requirements.txt` + `.dockerignore`. The repo root now has **no loose `.py` files** — the three apps (`backend/`, `website/`, `proceedings-mobile/`) are each in their own dir.

**Why it needed no code changes:** every data load is `__file__`-relative (`posting._TAGS_DIR`, `profile._HERE`, `search_client._csv_path`), so moving code+data together kept all paths valid. `load_dotenv()` walks up to the root `.env` (verified). The `Dockerfile` COPY paths are relative to its own dir, so with the build context = `backend/` they still resolve unchanged.

**Operational changes:** deploy command is now **`gcloud run deploy immiguide-api --source backend`** (build context = `backend/`). Tests run as `backend/tests/...` (their `sys.path.insert(parent)` auto-resolves to `backend/`). The obsidian docs symlink was retargeted `tags-cleaned -> ../backend/tags-cleaned`. `CLAUDE.md` commands updated.

**Verification:** local — vocab loads (415 tags), `test_reconcile` 67/67, `test_posting_tagging` 42/42, `test_profile` 53/53. Deployed — `--source backend` → revision `immiguide-api-00017-2hn`, health/users/search 200, tag-vocab 415. Non-breaking.

**Affected docs / status:** Done on `phase-K-cleanup`. K.3 (docs consolidation) pending.

---

# Session summaries

(Newest at the bottom. Each entry follows the `S-NNN` format defined at the top of this file.)

## S-001 — 2026-06-03 — End-of-session summary

**Completed this session:**
- Stood up the backend locally on branch `raj-test`: rebuilt `.venv` on **Python 3.11** (the prior venv was Python 3.9.6 and crashed on `api.py`'s `str | None` syntax), installed `requirements.txt`, verified all endpoints against live GCP (`/api/health` → 807 chunks, `/api/ask` full RAG, `/api/qa`, `/api/qa/stats`).
- **Diagnosed the Reddit grounding bug.** Root cause: the prototype `api.py`/`query.py` grounds on a **self-managed Vertex AI Vector Search index** (`legal_intake_deployed_v2`, 807 chunks — all crawled gov/law-firm content, **zero Reddit**), while the **81 Reddit docs live in the `imm-postings-datastore` Discovery Engine datastore that the RAG path never queries**. The ingestion path and retrieval path point at two different stores.
- **Identified that the prototype RAG stack is un-logged and deviates from D-016 (rejected Vector Search), D-034 (Answer API over datastore), and D-035 (Firestore app-state model — only an anonymous `qa_pairs` log exists; no auth/sessions/profiles).**
- Confirmed Firestore's as-built role (anonymous `qa_pairs` log; **not** grounding; **no** per-user conversational state anywhere — client `useState` only, never sent to backend).
- Captured the full investigation, deviation analysis, Firestore findings, and the recommended solution in **[ARCHITECTURE_GAP_reddit-grounding.md](ARCHITECTURE_GAP_reddit-grounding.md)**.
- **Recorded D-039**: three-tier grounding (app > reddit > public) all under managed Vertex AI Search, with a new **website data store (DS-2)** for no-ingest public content, precedence via `boostSpec`, Firestore for profile + conversation; Vector Search index + `qa_pairs` retired.

**In progress / not yet finished:**
- D-039 is a **decision, not yet implemented**. The prototype `api.py`/`query.py` still uses the (now superseded) Vector Search path and is what runs today on `raj-test`.
- Two build-time verifications open (see D-039): (1) can a website data store be **blended** with DS-1 in one engine with cross-store `boostSpec`, else fall back to a two-call BFF merge; (2) **basic vs advanced** website indexing for third-party domains (verification constraint).

**Exact next step for next session:** Run a verification query against `imm-postings-datastore` via the Discovery Engine **Search/Answer API** (`servingConfigs/default_search:answer`) for a representative Reddit-answerable question (e.g. "B1/B2 interview experience in Mumbai") to confirm the 81 docs return relevant grounded answers + citations — proving the DS-1 half of D-039 before any BFF refactor.

**Open questions / blockers:**
- Team sign-off on **D-039** (extends D-016 — second managed data store for no-ingest public content).
- The exact **public domain/URL-pattern list** for DS-2 (which gov/law-firm sites are in scope).
- Outcome of the blend-vs-two-call verification gates the BFF retrieval design.
