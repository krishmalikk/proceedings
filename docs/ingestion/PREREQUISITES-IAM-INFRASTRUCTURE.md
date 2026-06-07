# Prerequisites, GCP IAM & Infrastructure Provisioning

**Status**: DRAFT for review
**Companion to**: [PIPELINE-ARCHITECTURE-WORKFLOW.md](PIPELINE-ARCHITECTURE-WORKFLOW.md), [DEPLOYMENT.md](DEPLOYMENT.md), [QUARANTINE-PROCESS.md](QUARANTINE-PROCESS.md)
**Scope**: everything that must exist *before* code is deployed — projects, APIs, **least-privilege service accounts**, IAM bindings, secrets, infrastructure resources, plus the **Reddit API** and **Label Studio** setup runbooks.

This document is the authoritative source for the IAM model; [DEPLOYMENT.md §4](DEPLOYMENT.md) is a summary that defers here.

---

## 1. Guiding security principles (GCP best practice)

1. **One service account per workload component** — never a shared "god" SA. Each Cloud Run tool, the agent, the importer, Label Studio, the scheduler, and the kill-switch get their own identity. Blast radius is contained and audit logs are attributable.
2. **Least privilege, resource-scoped** — grant the *minimum* predefined role, bound at the **resource** level (bucket / dataset / secret / data store), never project-wide, and prefer **custom roles** when a predefined role is too broad.
3. **No service-account key files** — do **not** create or download JSON keys. Use **attached service accounts** (Cloud Run / Agent Engine run *as* the SA) and **Workload Identity Federation** for any non-GCP execution (e.g. CI). Enforce with the `iam.disableServiceAccountKeyCreation` org policy.
4. **No API keys for Google services** — Vertex AI (Gemini, Agent Engine, Example Store), Discovery Engine, BigQuery, GCS all authenticate via the **attached SA / ADC**. API keys are *not used* (see §6).
5. **Secrets only in Secret Manager** — the *only* long-lived external credential is the Reddit OAuth app secret. It lives in Secret Manager, accessed at runtime by exactly one SA.
6. **Separation of duties** — the human reviewer (Label Studio / quarantine) is a *user identity behind IAP*, not a service account, and is distinct from any pipeline SA.
7. **Defense in depth** — org policies (disable SA keys, restrict public buckets, domain-restricted sharing), optional VPC Service Controls perimeter, optional CMEK on the bucket/dataset.

---

## 2. Project, billing, org policy

| Item | Value / action |
|---|---|
| GCP project | One dedicated project per environment: `imm-ingest-dev`, `imm-ingest-stage`, `imm-ingest-prod` (isolates billing, quotas, kill-switch) |
| Billing | Linked; a **Billing Budget** with Pub/Sub alerts at 50/80/100% (kill-switch — see [PIPELINE-ARCHITECTURE-WORKFLOW.md §8](PIPELINE-ARCHITECTURE-WORKFLOW.md)) |
| Region | Single region (recommend `us-central1`) for Vertex AI + BigQuery + GCS colocation |
| Org policies (enforce) | `iam.disableServiceAccountKeyCreation` = on; `storage.publicAccessPrevention` = enforced; `iam.allowedPolicyMemberDomains` = your org; `run.allowedIngress` = internal+LB where possible |
| Optional hardening | VPC Service Controls perimeter around Vertex AI/GCS/BQ; CMEK keys for `imm-postings-ingestion` bucket and `postings` dataset |

### 2.1 APIs to enable

```
aiplatform.googleapis.com           # Vertex AI: Gemini, Agent Engine, Example Store
discoveryengine.googleapis.com      # Vertex AI Search (data store + Search/Conversation)
run.googleapis.com                  # Cloud Run (tools, Label Studio, kill-switch)
cloudscheduler.googleapis.com       # Cloud Scheduler (agent trigger)
storage.googleapis.com              # Cloud Storage (sidecar artifacts)
bigquery.googleapis.com             # BigQuery (dedup/watermark/analytics)
secretmanager.googleapis.com        # Secret Manager (Reddit creds)
artifactregistry.googleapis.com     # container images
cloudbuild.googleapis.com           # CI/CD image builds
logging.googleapis.com  monitoring.googleapis.com
# Phase 2 only:
eventarc.googleapis.com  pubsub.googleapis.com
# Label Studio state:
sqladmin.googleapis.com              # Cloud SQL (PostgreSQL) for Label Studio
iap.googleapis.com                   # Identity-Aware Proxy (human auth to Label Studio)
```

> Firestore (`firestore.googleapis.com`) is **NOT** enabled — BigQuery is the dedup/watermark store. Cloud DLP (`dlp.googleapis.com`) is **NOT** enabled — Reddit public postings are not treated as sensitive data, so there is no de-identification stage (decision: PIPELINE-ARCHITECTURE-WORKFLOW.md §3.5). Vertex AI Vector Search is **NOT** used (rejected — Appendix A of the architecture doc).

---

## 3. Service-account model (least privilege)

Naming convention: `sa-<component>@<project>.iam.gserviceaccount.com`. Each SA is **attached** to its runtime (no keys).

### 3.1 The dedicated Reddit batch-ingest identity

> **`sa-reddit-ingest-agent`** — the single dedicated identity for the Reddit batch-ingestion pipeline’s reasoning/orchestration layer (Vertex AI Agent Engine). This is the "used for this pipeline only to batch ingest from Reddit" account requested. It orchestrates but holds **no data-plane write** permissions itself — those are delegated to per-tool SAs (§3.2).

| Attribute | Value |
|---|---|
| Name | `sa-reddit-ingest-agent@<project>.iam.gserviceaccount.com` |
| Attached to | Vertex AI Agent Engine ingestion agent |
| Phase | 1 & 2 |
| Roles (resource-scoped) | `roles/aiplatform.user` (Gemini + Agent Engine + Example Store, project) · `roles/run.invoker` **on each tool Cloud Run service** (not project-wide) · `roles/logging.logWriter` · `roles/monitoring.metricWriter` |
| Explicitly NOT granted | GCS write, BigQuery write, Secret Manager — the agent reaches these only by invoking the purpose-built tools |

### 3.2 Per-purpose tool service accounts (one per Cloud Run tool)

| SA | Purpose | Phase | Least-privilege roles (scope) |
|---|---|---|---|
| `sa-scraper-tool` | Pull Reddit posts/comments (PRAW) | 1 | `roles/secretmanager.secretAccessor` **on the Reddit secret only**; `roles/logging.logWriter`. No GCS/BQ. Egress to reddit.com. |
| `sa-validator-tool` | Schema + vocabulary validation | 1 | `roles/storage.objectViewer` **on the `_config/tagvocab/` prefix only** (master CSVs); `roles/logging.logWriter`. No write anywhere. |
| `sa-gcs-writer-tool` | Write sidecar `.md`+`.json` (and `_quarantine/`) | 1 | `roles/storage.objectAdmin` **on `gs://imm-postings-ingestion` only**; `roles/logging.logWriter`. No BQ. |
| `sa-bq-writer-tool` | Append row via Storage Write API (production) | 1 | `roles/bigquery.dataEditor` **on dataset `postings` only** (append to `postings_metadata_staging`); `roles/logging.logWriter`. No GCS. Does **not** need `jobUser` — Storage Write API is not a query job. The scheduled MERGE runs under its own SA (`sa-bq-scheduled-merge`). |
| `sa-bq-scheduled-merge` | Run the 5-min staging→live MERGE query | 1 | `roles/bigquery.dataEditor` on `postings`; `roles/bigquery.jobUser` (project) to execute the scheduled query; `roles/logging.logWriter`. |
| `sa-search-importer` | Event-driven `documents.import`/`delete` | 2 | Custom role **`discoveryEngineDocumentWriter`** on the data store (see §3.4); `roles/storage.objectViewer` on the bucket (verify pair); `roles/bigquery.dataEditor` on `postings` (set `index_state`); `roles/logging.logWriter`. |

### 3.3 Auxiliary / non-pipeline service accounts (separate purposes)

| SA | Purpose | Phase | Least-privilege roles (scope) |
|---|---|---|---|
| `sa-scheduler-invoker` | Cloud Scheduler → trigger the agent run | 1 | `roles/aiplatform.user` *or* `roles/run.invoker` limited to the agent endpoint only |
| `sa-labelstudio` | Label Studio app (human quarantine review) | 1 | `roles/storage.objectAdmin` **on `_quarantine/` & `_rejected/` prefixes only**; `roles/bigquery.dataEditor` on `postings`; `roles/cloudsql.client` (its own Postgres instance); `roles/secretmanager.secretAccessor` on Label Studio secrets only |
| `sa-promote-fn` | Webhook target that promotes/rejects reviewed docs | 1 | `roles/storage.objectAdmin` on the bucket; `roles/bigquery.dataEditor` on `postings`; `roles/aiplatform.user` (Example Store upsert of gold examples) |
| `sa-killswitch-fn` | Billing-budget Pub/Sub → pause pipeline | 1 | Custom role **`pipelinePauser`** (BigQuery write to a 1-row `pipeline_config` table + `run.services.update` to scale tools to 0) — narrower than `run.admin` |
| `sa-cicd-deployer` | Cloud Build deploys images/services | 1 | `roles/run.admin` (deploy), `roles/artifactregistry.writer`, `roles/iam.serviceAccountUser` **only for the SAs it must attach**. Used by Cloud Build via Workload Identity — no keys. |
| Vertex AI Search service agent (Google-managed) | Daily auto-sync reads the bucket | 1 | `roles/storage.objectViewer` on `gs://imm-postings-ingestion` (grant to `service-<projectnum>@gcp-sa-discoveryengine.iam.gserviceaccount.com`) |

### 3.4 Custom roles (where predefined roles are too broad)

| Custom role | Included permissions | Replaces (too-broad) |
|---|---|---|
| `discoveryEngineDocumentWriter` | `discoveryengine.documents.create/update/delete/import`, `discoveryengine.documents.get` | `roles/discoveryengine.editor` |
| `pipelinePauser` | `bigquery.tables.updateData` (on `pipeline_config`), `run.services.get`, `run.services.update` | `roles/run.admin` + `roles/bigquery.dataEditor` |
| `redditSecretReader` (optional) | `secretmanager.versions.access` on one secret resource | `roles/secretmanager.secretAccessor` at project scope |

Define custom roles at the **project** level and bind them at the **resource** level.

### 3.5 Human identities (not service accounts)

| Identity | Access | Mechanism |
|---|---|---|
| Quarantine reviewer (you) | Label Studio UI only | Google identity on the **IAP allow-list** of the Label Studio Cloud Run service. No GCP data-plane roles. |
| Tag owner / approver | Approves `tag_proposals`, merges tag-CSV PRs | Source-repo reviewer + (optional) `roles/bigquery.dataViewer` on `postings` for audit queries |
| Platform admin | Provisioning, break-glass | `roles/owner` only on `-dev`; on `-prod` use granular admin roles + just-in-time elevation |

---

## 4. IAM binding matrix (resource → principal → role)

Bind at the resource, not the project, wherever the API supports it.

| Resource | Principal | Role |
|---|---|---|
| Secret `reddit-oauth` | `sa-scraper-tool` | `roles/secretmanager.secretAccessor` (or `redditSecretReader`) |
| Secret `labelstudio-*` | `sa-labelstudio` | `roles/secretmanager.secretAccessor` |
| Bucket `imm-postings-ingestion` | `sa-gcs-writer-tool` | `roles/storage.objectAdmin` |
| Bucket `imm-postings-ingestion` | `sa-search-importer`, Vertex AI Search service agent | `roles/storage.objectViewer` |
| Bucket prefix `_config/tagvocab/*` | `sa-validator-tool` | `roles/storage.objectViewer` |
| Bucket prefix `_quarantine/*`,`_rejected/*` | `sa-labelstudio`, `sa-promote-fn` | `roles/storage.objectAdmin` |
| Dataset `postings` | `sa-bq-writer-tool`, `sa-bq-scheduled-merge`, `sa-promote-fn`, `sa-labelstudio`, `sa-search-importer` | `roles/bigquery.dataEditor` |
| Project (BigQuery jobs) | `sa-bq-scheduled-merge` | `roles/bigquery.jobUser` |
| Project (Vertex AI) | `sa-reddit-ingest-agent` | `roles/aiplatform.user` |
| Each tool Cloud Run service | `sa-reddit-ingest-agent` | `roles/run.invoker` |
| Agent endpoint | `sa-scheduler-invoker` | `roles/run.invoker` / `roles/aiplatform.user` |
| Data store | `sa-search-importer` | `discoveryEngineDocumentWriter` (custom) |
| `pipeline_config` table + tool services | `sa-killswitch-fn` | `pipelinePauser` (custom) |

`roles/iam.serviceAccountUser` is granted **only** to `sa-cicd-deployer`, scoped to the specific SAs it must attach during deploy — not project-wide.

---

## 5. Infrastructure resources to provision

| # | Resource | Spec | Phase |
|---|---|---|---|
| 1 | GCS bucket `imm-postings-ingestion` | STANDARD, versioning ON, uniform bucket-level access, public access prevention, optional CMEK; layout `gs://…/<YYYY-MM-DD>/reddit/` + `_quarantine/`,`_rejected/`,`_config/` | 1 |
| 2 | BigQuery dataset `postings` + table `postings_metadata` | DDL from `schema.py` `BIGQUERY_SCHEMA`; partition `posting_date`; cluster `subreddit,severity`; optional CMEK | 1 |
| 3 | BigQuery table `tag_proposals`, `gold_labels`, `pipeline_config` | per TAG-LIFECYCLE.md / QUARANTINE-PROCESS.md | 1 |
| 4 | Secret Manager: `reddit-oauth` (client_id, client_secret, user_agent), `labelstudio-django-secret`, `labelstudio-db-password` | 1 |
| 5 | Artifact Registry repo `ingest` | Docker format, regional | 1 |
| 6 | Vertex AI Example Store instance | one per environment | 1 |
| 7 | Vertex AI Search data store + Search/Conversation app | unstructured + metadata (sidecar); source `gs://imm-postings-ingestion/*/reddit/*.json`; **daily auto-sync** | 1 |
| 8 | Cloud Run services: 4 tools + Label Studio + (Phase 2) `search-importer`, `promote-fn`, `killswitch-fn` | min-instances 0; concurrency tuned; each runs as its own SA | 1 / 2 |
| 9 | Vertex AI Agent Engine deployment (the agent) | runs as `sa-reddit-ingest-agent`; binds tools by URL | 1 |
| 10 | Cloud Scheduler job | cron (pilot every 30 min) → agent; OIDC as `sa-scheduler-invoker` | 1 |
| 11 | Cloud SQL (PostgreSQL) instance | Label Studio state; private IP; smallest tier | 1 |
| 12 | Billing budget + Pub/Sub topic + `killswitch-fn` | enforce monthly cap (§8) | 1 |
| 13 | Eventarc trigger + Pub/Sub DLQ | GCS `object.finalized`/`deleted` → `search-importer` | 2 |
| 14 | Monitoring dashboards + alert policies | validation-failure rate, no-ingest watchdog, DLQ growth, Reddit 429s, budget | 1 / 2 |

> **No Cloud DLP de-identification template** — Reddit public postings are not treated as sensitive data; the de-identification stage is removed (decision: PIPELINE-ARCHITECTURE-WORKFLOW.md §3.5).

---

## 6. Gemini / Vertex AI — authentication (no API keys)

**No API keys are created or used for any Google service.**

- Gemini is consumed **via Vertex AI** (`aiplatform.googleapis.com`), not the Gemini Developer API. Vertex AI authenticates with the **attached service account** (`sa-reddit-ingest-agent` for the agent; tool SAs for tool calls) using Application Default Credentials. No `GOOGLE_API_KEY`.
- Agent Engine, Example Store, Discovery Engine, BigQuery, GCS — all same: ADC via attached SA.
- Rationale: API keys are long-lived bearer secrets with weak scoping; attached SAs + IAM give per-resource least privilege, rotation-free, and full audit logging. The `iam.disableServiceAccountKeyCreation` org policy guarantees no key files exist.
- **The only external credential in the whole system is the Reddit OAuth app secret** (§7), stored in Secret Manager and readable by exactly one SA.
- **No Firecrawl API key is required.** Reddit ingestion uses **PRAW (the official Reddit API)**, not Firecrawl. Firecrawl is only the future adapter for non-API channels (PIPELINE-ARCHITECTURE-WORKFLOW.md §3.1), which are out of scope for Phase 1 and Phase 2 (Reddit-only). If a non-API channel is ever added, a Firecrawl key would follow the identical pattern as the Reddit secret: a Secret Manager secret readable only by `sa-scraper-tool`, no key files, no architecture change.

---

## 7. Reddit API — prerequisites & setup runbook

Reddit's Data API requires a registered OAuth app even for read-only public access. There is no anonymous production access and **no paid API key needed at pilot volume**.

> **⚠ Critical-path prerequisite — request access EARLY.** As of late-2024 Reddit
> **removed self-service API access**. Creating an app at `reddit.com/prefs/apps`
> is no longer sufficient by itself: programmatic access is gated behind a
> **Data API access request (a form) + Responsible Builder Policy / Data API
> Terms agreement** that Reddit must approve. Typical lead time: **~a few days
> (non-commercial / research)**, **weeks and possibly declined (commercial)**.
> Submit this **before** the Phase-1 build starts; nothing in the Scraper path
> can run in production until it is approved. (This is the form you have already
> submitted — the wait is expected and unavoidable on this path.)

### 7.1 Why not an alternative auth path?

| Path | Auth | Approval | Fit for this architecture |
|---|---|---|---|
| **Classic OAuth2 Data API** (PRAW) — *this is our path* | `client_id` + `client_secret` | Data API access form + approval | ✅ External GCP batch job (Agent Engine + Cloud Run) — matches the design |
| Reddit Developer Platform / **Devvit** `server/reddit-api` (developers.reddit.com) | App-account, injected automatically (no secret to manage) | Devvit sign-up | ❌ **Not usable here** — Devvit code runs on **Reddit's** hosting inside an app installed into subreddits (moderation/interactive apps), not as an external GCP pipeline writing to our GCS/BigQuery. Adopting it means abandoning the GCP architecture. |
| Commercial / Enterprise Data API | contract credentials | weeks; paid | ➖ Only if Phase-2 volume/commercial use later requires it |

**Decision: stay on the classic OAuth2 Data API path.** The approval wait is accepted as a gating milestone; Devvit is rejected because it is architecturally incompatible with an external GCP ingestion pipeline.

### 7.2 Prerequisites
- A dedicated Reddit team/bot account (not a personal account), with 2FA.
- Submit the **non-commercial / research** Data API access request (faster track than commercial). In the request, state the low pilot volume precisely: 3 subreddits, ~100 docs/day, ≤ a few queries/min, research / candidate-support use, **no redistribution of Reddit content** (our design stores only derived tags + LLM paraphrases; raw `.md` is already-public content; deletion-propagation is implemented — see [REDDIT-INGESTION-PIPELINE.md §7.4](REDDIT-INGESTION-PIPELINE.md)).
- Read + agree to the [Reddit Data API Terms](https://www.redditinc.com/policies/data-api-terms) and Responsible Builder Policy. Free-tier limits: **60 req/min OAuth-authenticated** (10/min unauthenticated).

### 7.3 Steps (once access is approved)
1. Sign in with the dedicated account → https://www.reddit.com/prefs/apps.
2. **Create app** → type **`script`** (server-side, read-only). Name e.g. `imm-postings-ingest`. Redirect URI: `http://localhost` (unused for script type).
3. Capture:
   - **client_id** (under the app name)
   - **client_secret** (via the edit button)
   - **user_agent** — must be descriptive per Reddit policy, e.g. `gcp:imm-postings-ingest:v1 (by /u/<bot-account>)`
4. Store in Secret Manager as a single JSON secret `reddit-oauth`:
   ```
   gcloud secrets create reddit-oauth --replication-policy=automatic
   printf '{"client_id":"…","client_secret":"…","user_agent":"gcp:imm-postings-ingest:v1 (by /u/<acct>)"}' \
     | gcloud secrets versions add reddit-oauth --data-file=-
   ```
5. Grant **only** `sa-scraper-tool` access: `gcloud secrets add-iam-policy-binding reddit-oauth --member="serviceAccount:sa-scraper-tool@<project>.iam.gserviceaccount.com" --role="roles/secretmanager.secretAccessor"`.
6. Verify read-only public access is sufficient for the target subreddits (Phase 1: `r/h1b`, `r/USVisas`, `r/usvisascheduling`). No user-context (password) grant is required since we only read public listings.
7. Implement scraper backoff for HTTP 429 and honor the **60 req/min** OAuth ceiling (PRAW handles rate limiting; keep ≤1 listing call/subreddit/run).

### 7.4 Unblocking work while approval is pending (dev only)
The Scraper tool and the rest of the pipeline can be built/tested without approved credentials by reading Reddit's **public JSON** endpoints (e.g. `https://www.reddit.com/r/<sub>/new.json`, ~10 req/min, no credentials) **for local development and smoke tests only**. Do **not** use this for production or backfill ingestion — it is rate-limited and systematic collection is still subject to the Data API Terms. Production ingestion must wait for the approved OAuth credentials.

### 7.5 Rotation
- Rotate `client_secret` from the Reddit app page; add a new Secret Manager version; the scraper reads `latest` — zero-downtime. No code change.

---

## 8. Label Studio — prerequisites & setup runbook

Label Studio is the human review UI for quarantine + gold-label creation ([QUARANTINE-PROCESS.md](QUARANTINE-PROCESS.md)). Self-hosted on Cloud Run.

### 8.1 Prerequisites
| Prerequisite | Detail |
|---|---|
| Container image | Official `heartexlabs/label-studio:<pinned-tag>` mirrored into Artifact Registry |
| State DB | Cloud SQL **PostgreSQL** (Cloud Run is stateless — never SQLite); private IP |
| Auth | **Identity-Aware Proxy** in front of the Cloud Run service; reviewer Google identities on the allow-list. No public access. |
| Identity | Runs as `sa-labelstudio` (least privilege per §3.3) |
| Secrets | `labelstudio-django-secret`, `labelstudio-db-password` in Secret Manager |
| Storage integration | Label Studio Cloud Storage source/target = the `_quarantine/` prefix (and `_rejected/` for rejects) |
| Webhook | "annotation submitted" → `promote-fn` (Cloud Run) which validates → writes live sidecar → MERGEs BigQuery → upserts gold example |

### 8.2 Steps
1. **Cloud SQL**: create a PostgreSQL instance (smallest tier, private IP); create DB `labelstudio` and a user; store the password in Secret Manager (`labelstudio-db-password`).
2. **Image**: pull `heartexlabs/label-studio:<tag>`, push to `…/ingest/label-studio:<tag>` in Artifact Registry.
3. **Service account**: create `sa-labelstudio`; grant the §3.3 roles (scoped to `_quarantine/`,`_rejected/` prefixes, `postings` dataset, its Cloud SQL instance, its secrets).
4. **Deploy Cloud Run** `label-studio` running as `sa-labelstudio`:
   - Cloud SQL connection (connector/private IP); env `DJANGO_DB=postgresql`, host/db/user, password from Secret Manager.
   - `LABEL_STUDIO_DJANGO_SECRET_KEY` from Secret Manager.
   - min-instances 1 (UI responsiveness), request timeout 300s.
   - Ingress internal+LB; **enable IAP**; add reviewer identities to the IAP allow-list.
5. **Project + labelling config**: create a "Quarantine" project; XML template renders (a) the posting `.md` (read-only), (b) `_errors.txt` (read-only), (c) the attempted JSON with per-field widgets; tag-array autocomplete sourced from the live `_config/tagvocab/` CSVs (prevents re-introducing out-of-vocabulary tags).
6. **Cloud Storage sync**: configure the project's source/target to the bucket `_quarantine/` prefix via `sa-labelstudio`.
7. **Webhook**: point "annotation submitted" at `promote-fn`; deploy `promote-fn` as `sa-promote-fn` (§3.3). It re-runs the Validator (humans cannot bypass schema validity), writes the corrected sidecar to the live prefix, `MERGE`s BigQuery (`resolved`/`rejected`), and on resolve upserts a gold example to the Example Store.
8. **Smoke test**: push one synthetic quarantined doc → review → submit "fix & accept" → confirm it lands in the live prefix, BigQuery row flips to `resolved`, and a gold example is written.

### 8.3 Alternative
Managed **Vertex AI Labelling** may replace self-hosted Label Studio if you prefer no app to operate; trade-off is less custom-UI control over the JSON-correction form. Same gold-label JSONL output contract either way.

---

## 9. Provisioning order (dependency-correct) & phase mapping

```
── Phase 1 (Pilot) ───────────────────────────────────────────────
1.  Project, billing, org policies (§2), enable Phase-1 APIs
2.  Artifact Registry + Cloud Build (Workload Identity; no keys)
3.  All Phase-1 service accounts (§3.1–3.3) + custom roles (§3.4)
4.  Secret Manager secrets (Reddit, Label Studio) + scoped bindings
5.  GCS bucket + prefixes + IAM (§4); Vertex AI Search service-agent viewer grant
6.  BigQuery dataset + tables (postings_metadata, tag_proposals, gold_labels, pipeline_config)
7.  Vertex AI Example Store; Vertex AI Search data store + app (daily auto-sync)
8.  Build/push tool images → deploy 4 Cloud Run tools (each as its own SA) — no PII-Guard/DLP
9.  Deploy Agent Engine agent (as sa-reddit-ingest-agent); bind tool invoker roles
10. Cloud Scheduler (as sa-scheduler-invoker) → agent
11. Cloud SQL + Label Studio (IAP) + promote-fn  (§8)
12. Billing budget + Pub/Sub + killswitch-fn (custom pipelinePauser role)
13. Monitoring dashboards + alerts; smoke test 1 canary post end-to-end
    → run pilot; gate on Phase-1 exit criteria (PIPELINE-ARCHITECTURE-WORKFLOW.md §18.1)

── Phase 2 (Production) ──────────────────────────────────────────
15. Enable eventarc + pubsub APIs
16. Deploy search-importer (as sa-search-importer, custom discoveryEngineDocumentWriter)
17. Pub/Sub DLQ; Eventarc trigger (GCS finalize/delete → search-importer)
18. Flip primary ingestion to event-driven; daily auto-sync → backstop
19. Expand subreddits; one-time backfill (≥50 upvotes, last 3 months)
20. Phase-2 alerts (DLQ growth, no-ingest watchdog); raise budget cap for backfill
```

---

## 10. Pre-go-live validation checklist

- [ ] No service-account JSON keys exist (`iam.disableServiceAccountKeyCreation` enforced).
- [ ] Every SA has only resource-scoped roles from §4; no project-wide `editor`/`owner` on pipeline SAs.
- [ ] `sa-reddit-ingest-agent` cannot write GCS/BigQuery directly (verify by attempting — should fail).
- [ ] `reddit-oauth` secret readable **only** by `sa-scraper-tool`.
- [ ] Bucket has public access prevention + uniform access; Vertex AI Search service agent has viewer.
- [ ] No Cloud DLP / PII-Guard provisioned (intentionally dropped — Reddit public postings, §3.5); `dlp.googleapis.com` not enabled.
- [ ] Label Studio reachable only via IAP allow-list; runs as `sa-labelstudio`; Postgres on private IP.
- [ ] Billing budget + kill-switch path tested (simulate 100% → pipeline pauses).
- [ ] Reddit app is `script` type, read-only, user_agent compliant; 429 backoff verified.
- [ ] Smoke: one canary post → tagged → validated → GCS sidecar → BigQuery row → searchable (Phase 1 via daily sync; Phase 2 within minutes).

---

## 11. Open items

- Confirm environment count (`dev`/`stage`/`prod`) and whether prod uses VPC-SC + CMEK.
- Confirm dedicated Reddit bot account ownership and 2FA custody.
- Confirm IAP allow-list reviewer identities.
- Decide custom-role vs predefined trade-off for `sa-search-importer` (custom `discoveryEngineDocumentWriter` recommended).
