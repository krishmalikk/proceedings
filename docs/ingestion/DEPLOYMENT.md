# Deployment Guide — GCP Component Inventory & Provisioning

**Status**: DRAFT for review
**Companion to**: [PIPELINE-ARCHITECTURE-WORKFLOW.md](PIPELINE-ARCHITECTURE-WORKFLOW.md), [REDDIT-INGESTION-PIPELINE.md](REDDIT-INGESTION-PIPELINE.md)
**Answers**: §12.1 — what is deployed, where, and the Agent Engine vs Cloud Run rationale.

---

## 1. Component inventory (what gets provisioned, and where)

| # | Component | GCP service | Provisioned via | Runtime location | Lifecycle |
|---|---|---|---|---|---|
| 1 | **Ingestion Agent** | Vertex AI **Agent Engine** | `gcloud ai reasoning-engines` / Vertex SDK deploy | Managed Vertex AI (regional) | Long-lived; redeployed on agent code change |
| 2 | **Scraper Tool** | **Cloud Run** (service) | `gcloud run deploy` | Cloud Run (regional) | Long-lived; called by the agent |
| 3 | **Validator Tool** | **Cloud Run** (service) | `gcloud run deploy` | Cloud Run | Long-lived |
| 4 | **GCS-Writer Tool** | **Cloud Run** (service) | `gcloud run deploy` | Cloud Run | Long-lived |
| 5 | **BQ-Writer Tool** | **Cloud Run** (service) | `gcloud run deploy` | Cloud Run | Long-lived |
| 6 | **Scheduler trigger** | **Cloud Scheduler** | `gcloud scheduler jobs create http` | Managed | Cron, every 30 min (pilot) |
| 7 | **Object store** | **Cloud Storage** `imm-postings-ingestion` | `gcloud storage buckets create` (already created) | Regional bucket | Persistent |
| 8 | **Metadata warehouse** | **BigQuery** dataset `postings` + live table `postings_metadata` + **`postings_metadata_staging`** (Storage Write API landing zone) + **scheduled MERGE query** (5-min cadence) | `bq mk` / DDL in repo + `bq mk --transfer_config` for the scheduled MERGE | Regional dataset | Persistent. Production BQ-Writer writes via Storage Write API → staging; scheduled MERGE upserts into live table. See PIPELINE-ARCHITECTURE-WORKFLOW.md §5.1. |
| 9 | **Few-shot store** | Vertex AI **Example Store** | Vertex SDK | Managed Vertex AI | Persistent, grows over time |
| 10 | **Search index** | **Vertex AI Search** data store + app | Agent Builder console / API | Managed | Persistent; daily auto-sync from GCS |
| 11 | **Eval harness** | Vertex AI **Gen AI Evaluation Service** | Vertex SDK (scheduled) | Managed | Run per batch / nightly |
| 12 | **Guardrail** | **Model Armor** template | `gcloud model-armor` | Managed; attached to agent | Versioned |
| 13 | **Secrets** | **Secret Manager** | `gcloud secrets create` | Managed | Reddit creds, etc. |
| 14 | **Kill-switch fn** | **Cloud Run function** (2nd gen) | `gcloud functions deploy` | Cloud Run (event) | Triggered by Billing Pub/Sub |
| 15 | **Budget + alerts** | **Cloud Billing Budget** + Pub/Sub | Billing console / API | Managed | Persistent |
| 16 | **Observability** | **Cloud Logging / Monitoring** | Auto + dashboards-as-code | Managed | Persistent |
| 17 | **Human review UI** | **Label Studio** on **Cloud Run** | `gcloud run deploy` (container) | Cloud Run | Long-lived; see [QUARANTINE-PROCESS.md](QUARANTINE-PROCESS.md) |
| 18 | **Image registry** | **Artifact Registry** | `gcloud artifacts repositories create` | Regional | Persistent |
| 19 | **CI/CD** | **Cloud Build** | `cloudbuild.yaml` | Managed | On commit |
| 20 | **`search-importer`** (Phase 2, event ingest) | **Cloud Run** (event service) | `gcloud run deploy` | Cloud Run (event) | Long-lived; see PIPELINE-ARCHITECTURE-WORKFLOW.md §17 |
| 21 | **GCS→import trigger** (Phase 2) | **Eventarc** (GCS `object.finalized`/`object.deleted`) | `gcloud eventarc triggers create` | Managed | Persistent; filtered to live prefixes |
| 22 | **Import DLQ** (Phase 2) | **Pub/Sub** dead-letter topic | `gcloud pubsub topics create` | Managed | Persistent; alerted + reconciled by daily sync |
> Firestore is intentionally **absent** — BigQuery is the dedup/watermark store (decision in PIPELINE-ARCHITECTURE-WORKFLOW.md §3.3).
> **Cloud DLP / Sensitive Data Protection is intentionally absent** — Reddit public postings are not treated as sensitive data; there is no PII-Guard tool, DLP API, de-identification template, or `sa-piiguard-tool` (decision: PIPELINE-ARCHITECTURE-WORKFLOW.md §3.5).
> **Vertex AI Vector Search is intentionally absent** — a streaming Vector Search sink was evaluated and **rejected** on cost grounds (always-on serving node ~$150–$500+/mo; minutes latency is acceptable). See PIPELINE-ARCHITECTURE-WORKFLOW.md §15.1 / Appendix A. Do not provision an Embedding Tool, Vector-Upsert Tool, Vector Search index, or index endpoint.
> **Ingestion**: single sink = Vertex AI Search. Bring-up on the daily auto-sync (rows 1–21); the **event-driven import (rows 22–24, §17) is the primary ingestion path**; daily auto-sync is demoted to a reconciliation backstop.

### 1.1 What is deployed in Phase 1 vs Phase 2

Authoritative phase definitions live in [PIPELINE-ARCHITECTURE-WORKFLOW.md §18](PIPELINE-ARCHITECTURE-WORKFLOW.md). Component mapping:

| Phase | Rows deployed | Ingestion | Scope |
|---|---|---|---|
| **Phase 1 — Pilot** | Rows **1–19** (Agent Engine, 4 Cloud Run tools, BigQuery, Example Store, Vertex AI Search data store, Cloud Scheduler, Label Studio, budget/kill-switch, registry, CI/CD) | Daily Vertex AI Search **auto-sync** only | 3 subreddits, forward-only, no backfill |
| **Phase 2 — Production** | Phase 1 **+ rows 20–22** (`search-importer` Cloud Run, Eventarc trigger, Pub/Sub DLQ) | **Event-driven import** primary; daily auto-sync = backstop | + more subreddits; one-time backfill (≥50 upvotes, last 3 mo) |

Rows 20–22 are the **only** infrastructure delta between phases. Nothing is removed going from Phase 1 → 2; the daily auto-sync configured in Phase 1 simply becomes the reconciliation backstop. No Cloud DLP and no Vector Search rows in either phase.

---

## 2. Agent Engine vs Cloud Run — the split and why

### 2.1 The rule of thumb

| Put it on **Agent Engine** when… | Put it on **Cloud Run** when… |
|---|---|
| It is the *reasoning/orchestration* layer (LLM decides what to do next) | It is a *deterministic capability* the agent calls (a "tool") |
| It needs managed LLM sessions, tracing, memory, Example Store integration | It needs a plain request/response HTTP contract |
| It benefits from the ADK runtime (planning, tool routing, retries) | It is stateless I/O: scrape, validate, write |
| One per pipeline | One per capability; independently scalable & deployable |

### 2.2 What runs where

**Agent Engine (1 component — the brain):**
- The **Ingestion Agent**. It holds the LLM-extraction prompt, calls Gemini 2.5, decides the tool sequence (scrape → tag → validate → write), retrieves few-shot examples from the Example Store, and handles per-document control flow including the quarantine branch.

**Cloud Run (4 tools + Label Studio + kill-switch — the hands):**
- **Scraper Tool**, **Validator Tool**, **GCS-Writer Tool**, **BQ-Writer Tool**: each a single-purpose stateless HTTPS service the agent invokes as an ADK tool.
- **Label Studio**: a long-running web app (human review) — a classic container workload, not agentic.
- **Kill-switch function**: event-driven Cloud Run function bound to the billing Pub/Sub topic.

### 2.3 Why this division (rationale)

1. **Separation of reasoning from capability.** The agent's value is *deciding*; the tools' value is *doing*. Mixing them makes both harder to test. The Validator must be a pure function with golden tests; the agent must be evaluated on tool-routing quality. Different test strategies → different runtimes.
2. **Independent scaling & deploy cadence.** The Scraper changes when Reddit's API changes; the Validator changes when the schema changes; the agent changes when the prompt/model changes. Cloud Run lets each tool deploy and scale independently. Agent Engine redeploys only on agent-logic change.
3. **Cost shape.** Agent Engine bills for managed-agent session time (includes the LLM orchestration value-add). Tools are short, high-frequency, CPU-bound calls — far cheaper as plain Cloud Run with scale-to-zero. Running the tools *inside* the agent runtime would pay agent-runtime rates for trivial I/O.
4. **Blast radius.** A bug in the GCS-Writer cannot corrupt the agent's reasoning state; a prompt regression cannot break BigQuery writes. Process isolation = operational safety.
5. **Reusability.** The Validator and GCS/BQ writers are channel-agnostic. When a future non-Reddit channel is added, those Cloud Run tools are reused unchanged; only the Scraper gets a new adapter and the agent gets minor prompt tweaks.
6. **Why not a plain Cloud Run job for everything (the v1 design)?** It works but gives up: managed LLM tracing, the Example Store self-learning hook, built-in tool-call planning/retry, and a clean evaluation surface. You explicitly asked for the Agent Platform and a self-learning loop — those live naturally in Agent Engine.

---

## 3. Provisioning order (dependency-correct)

```
── Phase 1 (Pilot) ───────────────────────────────────────────────────
1.  Project + enable APIs + Artifact Registry + Cloud Build
2.  IAM service accounts (agent SA, tool SA, Vertex Search service agent)
3.  Secret Manager secrets (Reddit creds)
4.  GCS bucket (exists) + lifecycle/versioning + IAM
5.  BigQuery dataset + `postings_metadata` (live) + `postings_metadata_staging` (DDL from schema.py BIGQUERY_SCHEMA) + scheduled MERGE query every 5 min (PIPELINE-ARCHITECTURE-WORKFLOW.md §5.1)
6.  Build & push tool images → deploy 4 Cloud Run tools (Scraper, Validator, GCS-Writer, BQ-Writer)
7.  Vertex AI Example Store instance
8.  Vertex AI Search data store + app (gs://imm-postings-ingestion/*/reddit/*.json, sidecar mode, DAILY auto-sync)
9.  Model Armor template
10. Deploy Ingestion Agent to Agent Engine (binds tools by URL, prompt, Example Store)
11. Cloud Scheduler → Agent Engine endpoint (OIDC)
12. Billing budget + Pub/Sub + kill-switch function
13. Label Studio on Cloud Run + its GCS/BigQuery IAM
14. Monitoring dashboards + alert policies
15. Smoke test: 1 canary post end-to-end → visible in Vertex AI Search (via daily sync)
    → run pilot; gate on Phase 1 exit criteria (PIPELINE-ARCHITECTURE-WORKFLOW.md §18.1)
    (No Cloud DLP step — Reddit public postings are not treated as sensitive data, §3.5)

── Phase 2 (Production: event-driven + scale) ────────────────────────
16. Deploy `search-importer` Cloud Run + Pub/Sub DLQ
18. Eventarc trigger (GCS object.finalized/.deleted on live prefixes) → search-importer
19. Flip primary ingestion to event-driven; daily auto-sync → reconciliation backstop
20. Expand subreddit list; run one-time backfill (≥50 upvotes, last 3 months)
21. Enable active-learning sampling; (later) fine-tuning + Vertex ML Metadata + search tuning
22. Phase-2 monitoring (DLQ growth, no-ingest watchdog) + raised quotas/cap
```

(Detailed `gcloud`/Terraform commands belong in an infra repo; this doc fixes the *what/where/order*, not the exact CLI.)

---

## 4. IAM summary

> **Authoritative IAM, service-account model, and least-privilege bindings live in
> [PREREQUISITES-IAM-INFRASTRUCTURE.md](PREREQUISITES-IAM-INFRASTRUCTURE.md).**
> That doc defines one SA per component (no shared SA, no key files, resource-scoped
> roles, custom roles where predefined are too broad). The table below is only a
> high-level orientation; defer to that doc for exact members/roles/scopes.

| Principal (see §3 of the IAM doc) | Essence | Scope |
|---|---|---|
| `sa-reddit-ingest-agent` | orchestration only — `aiplatform.user`, `run.invoker` on tools | no GCS/BQ/secret |
| per-tool SAs (`sa-scraper/validator/gcs-writer/bq-writer`) | one identity per Cloud Run tool, minimal role each | resource-scoped |
| `sa-search-importer` (Phase 2) | custom `discoveryEngineDocumentWriter` + bucket viewer + BQ editor | data store / bucket / dataset |
| `sa-labelstudio`, `sa-promote-fn` | quarantine review + promote | `_quarantine/` prefix, `postings` |
| `sa-scheduler-invoker`, `sa-killswitch-fn`, `sa-cicd-deployer` | trigger / pause / deploy | narrowest viable (custom roles) |
| Vertex AI Search service agent (Google-managed) | `storage.objectViewer` | `imm-postings-ingestion` |

---

## 5. Environments

Recommend three: `dev` (sandbox subreddit, fake billing cap $10), `stage` (real subs, dry-run writes), `prod`. Each is a separate GCP project (or at minimum separate datasets/buckets and a project prefix) so the billing kill-switch and quotas are isolated.

---

## 6. Open items

- Confirm region (recommend a single region, e.g. `us-central1`, for Agent Engine + Vertex AI Search + BigQuery colocation to minimize egress and latency).
- Confirm Terraform vs `gcloud` scripts for IaC (recommend Terraform; modules per §1 row).
- Label Studio: self-hosted on Cloud Run (in this doc) vs managed Vertex AI Labelling — see [QUARANTINE-PROCESS.md](QUARANTINE-PROCESS.md) §2.
