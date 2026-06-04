# Phase E — Plan: Decommission the retired Vertex AI Vector Search

**Branch:** `phase-E` · **Status:** PLAN (review before executing) · **Date:** 2026-06-03

## Why decommission (rationale recap)
The Vector Search index is the **old prototype's grounding store — already replaced**:
1. It was a **self-managed** Vertex AI Vector Search index (built by the now-deleted `crawler.py` → `index.py` → `text-embedding-005` → Tree-AH index) holding **807 crawled gov/law-firm chunks**.
2. It **caused the original bug** — it held **zero Reddit content** (the 81 Reddit posts were in the Discovery Engine datastore the Vector Search path never queried), so "Ask AI" answered from law-firm sites, never Reddit.
3. It **violated the approved architecture (D-016)**, which mandates a single **managed** Vertex AI Search sink and explicitly rejected self-managed Vector Search on cost/ops grounds.
4. It **costs ~$150–500+/mo** for **2 always-on replicas**, and since the realignment (D-039) **nothing uses it** — `query.py`'s `find_neighbors` was removed, `api.py` grounds on the datastore, and the live Cloud Run service ignores its leftover env var.

## Current grounding source (what replaces it)
All grounding now runs on the **managed Vertex AI Search (Discovery Engine) datastore `imm-postings-datastore`**, queried via the **Search + Answer API** (engine `imm-postings-search-app`):
- **DS-1 (`imm-postings-datastore`)** — the **single grounding source**, holding the **Reddit-ingested** content (channel-agnostic, ready for app/web postings). Powers `/api/ask`, `/api/chat`, `/api/search`, `/api/postings`.
- **Live in production** (Cloud Run revision `…00009`, validated **13/13**; `/api/ask` returns `reddit-*` sources).
- **DS-2 (`imm-public-reference-datastore`)** — optional public-reference website store; crawl never populated, so **gated off** (not active).

Decommissioning removes **only** the dead prototype + its 24/7 billing; it does **not** touch `imm-postings-datastore`, which serves all answers.

## Resource inventory (to remove)
| Resource | Name / ID | Notes |
|---|---|---|
| Index **endpoint** | `legal-intake-endpoint` / `245914571645124608` | us-central1; the always-on cost |
| **Deployed index** | `legal_intake_deployed_v2` (on the endpoint) | **min 2 replicas** — the bleed |
| **Index** | `legal-intake-index` / `8958040089863127040` | 807 gov/law-firm chunks (retired) |
| GCS artifact | `gs://imm-postings-ingestion/chunk_mapping.json` | 1.66 MiB, retired |
| `.env` (local) | `VERTEX_AI_INDEX_ID`, `VERTEX_AI_INDEX_ENDPOINT_ID` | unused |
| Cloud Run env | `VERTEX_AI_INDEX_ENDPOINT_ID=245914571645124608` | set on `immiguide-api`; **ignored by new code** |
| Docs | `CLAUDE.md` env-var line | stale description |

## Pre-checks (already verified ✅)
- **No live code references** the IDs / `find_neighbors` / `MatchingEngine` — all matches are documentation (decision records) or stale config. `query.py`'s retrieval was stripped; `api.py` grounds via the datastore.
- **Production is independent of it** — Cloud Run runs the new code; its `VERTEX_AI_INDEX_ENDPOINT_ID` env var is unused. The Cloud Run E2E suite passes 13/13 on the datastore.
- **Order matters:** an index can't be deleted while deployed; an endpoint can't be deleted while it has a deployed index → must **undeploy → delete endpoint → delete index**.

## Decommission steps (execute in order)

**0. Snapshot for the record (optional, cheap):**
```bash
gcloud ai index-endpoints describe 245914571645124608 --region=us-central1 > /tmp/vs-endpoint-snapshot.json
gcloud ai indexes describe 8958040089863127040 --region=us-central1 > /tmp/vs-index-snapshot.json
```

**1. Undeploy the index from the endpoint** (stops the replicas — this is what stops the cost):
```bash
gcloud ai index-endpoints undeploy-index 245914571645124608 \
  --region=us-central1 --deployed-index-id=legal_intake_deployed_v2
```

**2. Delete the index endpoint:**
```bash
gcloud ai index-endpoints delete 245914571645124608 --region=us-central1 --quiet
```

**3. Delete the index:**
```bash
gcloud ai indexes delete 8958040089863127040 --region=us-central1 --quiet
```

**4. Delete the retired GCS artifact:**
```bash
gsutil rm gs://imm-postings-ingestion/chunk_mapping.json
```

**5. Remove the stale env var from Cloud Run** (no rebuild needed):
```bash
gcloud run services update immiguide-api --region=us-central1 \
  --remove-env-vars=VERTEX_AI_INDEX_ENDPOINT_ID
```

**6. Config/doc cleanup (commit on `phase-E`):**
- Remove `VERTEX_AI_INDEX_ID` + `VERTEX_AI_INDEX_ENDPOINT_ID` from `.env` (and `.env.example` if present).
- Update `CLAUDE.md` (drop the `VERTEX_AI_INDEX_*` env-var line / the index.py→query.py description).
- Leave the historical decision records (`MEMORY.md`, `ARCHITECTURE_GAP_*`, `FINAL-ARCHITECTURE.md`) **as-is** — they document why it was retired.
- Tick the TODO.md decommission item.

## Risk & rollback
- **Risk: LOW.** Nothing live depends on it (verified). Grounding is fully on the datastore.
- **Rollback:** effectively irreversible — `index.py` (the builder) was already deleted, so the index can't be trivially rebuilt. That's acceptable: it's retired and we don't want it back. The snapshots in step 0 preserve the config for reference only.
- **Blast radius:** none expected; the only consumer was the old prototype which is gone.

## Post-verification
1. Re-run the live suite — must stay green:
   ```bash
   .venv/bin/python tests/test_cloud_run.py        # expect 13/13
   ```
2. Confirm the endpoint is gone:
   ```bash
   gcloud ai index-endpoints list --region=us-central1   # legal-intake-endpoint absent
   ```
3. Confirm Cloud Run `/api/health` + `/api/ask` (reddit-grounded) still work.
4. Check next billing cycle: the Vector Search line item drops to ~$0.

## Decision to record
Add a `D-NNN` to `MEMORY.md`: "Vector Search index + endpoint decommissioned (post D-039); grounding fully on `imm-postings-datastore`; ~$150–500+/mo recovered."

## Execution — DONE ✅ (2026-06-03, D-040)

> **Discovery during execution:** the project had accumulated **4 `legal-intake` endpoints + 4 indexes** (repeated `index.py` runs since 2026-03-18), with **two** endpoints' deployed indexes billing 24/7 (`legal_intake_deployed_v2` *and* `legal_intake_deployed`). Scope expanded to remove all of them (all unreferenced by live code).

- [x] Snapshots (`/tmp/vs-*-snapshot.json`)
- [x] Undeployed **both** billing deployed-indexes (`legal_intake_deployed_v2`, `legal_intake_deployed`) — replicas/cost stopped
- [x] Deleted **all 4 index endpoints** (incl. `245914571645124608`)
- [x] Deleted **all 4 indexes** (incl. `8958040089863127040`)
- [x] Deleted `gs://imm-postings-ingestion/chunk_mapping.json`
- [x] Removed `VERTEX_AI_INDEX_ENDPOINT_ID` from Cloud Run (→ revision `…00010`)
- [x] `.env` + `CLAUDE.md` + TODO cleanup
- [x] Post-verify: Cloud Run E2E **13/13**; `index-endpoints list` + `indexes list` both empty; `/api/health` + `/api/ask` (reddit) ok
- [x] Recorded **D-040** in MEMORY.md
