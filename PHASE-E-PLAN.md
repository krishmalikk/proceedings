# Phase E — Plan: Decommission the retired Vertex AI Vector Search

**Branch:** `phase-E` · **Status:** PLAN (review before executing) · **Date:** 2026-06-03

## Why
The original prototype grounded on a **self-managed Vertex AI Vector Search** index. It was retired in D-016/D-039 — grounding now runs entirely on the managed **Discovery Engine datastore** (`imm-postings-datastore`), live in production (Cloud Run revision `…00009`, validated 13/13). The Vector Search **index endpoint is still deployed with 2 always-on replicas**, billing 24/7 for a component nothing uses anymore (~$150–500+/mo per the D-016 estimate). This plan tears it down safely.

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

## Execution checklist
- [ ] Step 0 — snapshot (optional)
- [ ] Step 1 — undeploy `legal_intake_deployed_v2`
- [ ] Step 2 — delete endpoint `245914571645124608`
- [ ] Step 3 — delete index `8958040089863127040`
- [ ] Step 4 — delete `gs://imm-postings-ingestion/chunk_mapping.json`
- [ ] Step 5 — remove `VERTEX_AI_INDEX_ENDPOINT_ID` from Cloud Run
- [ ] Step 6 — `.env` + `CLAUDE.md` + TODO cleanup (commit)
- [ ] Post-verify (13/13 + endpoint gone + health ok)
- [ ] Record `D-NNN`
