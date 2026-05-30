# Quarantine Process & Human-in-the-Loop Self-Learning

**Status**: DRAFT for review
**Companion to**: [PIPELINE-ARCHITECTURE-WORKFLOW.md](PIPELINE-ARCHITECTURE-WORKFLOW.md)
**Answers**: §12.2 (detailed quarantine process + Label Studio prerequisites) and §12.3 (how quarantine feeds self-learning and the Vertex AI Example Store).

---

## 1. What quarantine is and why it exists

Quarantine is the holding area for any document the automated pipeline could **not** confidently produce a schema-valid, vocabulary-valid JSON for. Quarantined documents are **never** synced to Vertex AI Search until a human resolves them. The daily human review is also the **primary training signal** for the self-learning loop (§5).

### 1.1 What gets quarantined

| Trigger | Detected by | Example |
|---|---|---|
| Unparseable / non-JSON model output (after 1 retry) | Agent | Gemini emitted prose or truncated JSON |
| Schema violation | Validator Tool (Pydantic, [schema.py](schema.py)) | missing required field, bad enum, dedup violation |
| Vocabulary violation | Validator Tool (master CSV check) | a tag not present in any `tags-cleaned/*.csv` |
| Low confidence | Agent | `tagging_confidence < 0.60` (configurable) |
| Ambiguous / off-topic | Agent heuristic | post is spam, a meme, or not immigration-related |

### 1.2 Where quarantined artifacts live

```
gs://imm-postings-ingestion/<YYYY-MM-DD>/reddit/_quarantine/
  ├── <case_id>.md            # post/comment body
  ├── <case_id>.json          # the agent's best-attempt JSON (may be partial)
  └── <case_id>__errors.txt   # human-readable validator / model findings
```

A BigQuery row is also written to `postings.postings_metadata` with
`resolution_status = 'quarantined'` so the queue is queryable and auditable.
The Vertex AI Search data store source pattern **excludes** `_quarantine/` so
quarantined docs are structurally unreachable by search until promoted.

---

## 2. Label Studio — prerequisites & setup

[Label Studio](https://labelstud.io/) is the human-review UI. It is deployed as a long-running container on **Cloud Run** (see [DEPLOYMENT.md](DEPLOYMENT.md) §1 row 19).

### 2.1 Prerequisites

| Prerequisite | Detail |
|---|---|
| Container image | Official `heartexlabs/label-studio:latest` (pin a version tag) pushed to Artifact Registry |
| Runtime | Cloud Run service, min-instances 0, 1 vCPU / 2 GiB, request timeout 300s |
| Persistence | Cloud SQL (PostgreSQL) instance for Label Studio's own DB (task state, annotations). **Not** SQLite — Cloud Run is stateless |
| Auth | Put the service behind **IAP (Identity-Aware Proxy)**; grant only the reviewer's Google identity. No public access |
| Storage integration | Label Studio **Cloud Storage** source + target configured to the `_quarantine/` prefix via `labelstudio-sa@` (roles: `storage.objectAdmin` on that prefix, `bigquery.dataEditor` on the dataset) |
| Secrets | Label Studio `DJANGO_SECRET`, DB password → Secret Manager |
| Labelling config | An XML labelling template (below) that renders the MD body, the attempted JSON, and the error list, and exposes editable fields |
| Webhook | Label Studio webhook on "annotation submitted" → a small Cloud Run endpoint (`promote-fn`) that executes the promote/reject action (§4) |

### 2.2 Decision: self-hosted Label Studio vs Vertex AI Labelling

| | Label Studio on Cloud Run | Vertex AI Labelling |
|---|---|---|
| JSON-edit + custom UI | ✅ Full control (custom template) | ◻️ Limited to managed templates |
| Cost | Cloud Run + Cloud SQL only | Per-labelled-item managed pricing |
| Ops burden | You run it | Fully managed |
| Recommendation | ✅ **Use for v1** — we need a custom JSON-correction UI tied to our schema | Reconsider if review volume becomes large and templates suffice |

### 2.3 Labelling template (conceptual)

The Label Studio task view shows three panes:
1. **Body** — the `<case_id>.md` post/comment body (read-only).
2. **Errors** — `<case_id>__errors.txt` (read-only) so the reviewer sees exactly which rule failed.
3. **Editable JSON** — the attempted `<case_id>.json` pre-filled, with per-field widgets for the 5 sibling tag arrays (autocomplete sourced from the live master `tags-cleaned/*.csv`), enums as dropdowns, and a free-text "reviewer note".

Autocomplete from the live master CSVs is what prevents a reviewer from re-introducing an out-of-vocabulary tag (and is the natural trigger point for proposing a *new* tag — see [TAG-LIFECYCLE.md](TAG-LIFECYCLE.md)).

---

## 3. The daily review process (operator runbook)

**Cadence**: once per day (you), before the Vertex AI Search nightly auto-sync window.

1. **Open the queue.** Label Studio "Quarantine" project lists today's tasks. (Backed by the GCS `_quarantine/` source + the BigQuery query `WHERE resolution_status='quarantined' AND DATE(ingestion_timestamp)=CURRENT_DATE()`.)
2. **Per task, read** the body + the error list. Classify into one of:
   - **Fixable tagging error** — model picked wrong/invalid tags or missed a field.
   - **Missing vocabulary** — the *correct* tag does not yet exist in the master list → follow [TAG-LIFECYCLE.md](TAG-LIFECYCLE.md) (propose-tag flow) **before** finishing this task.
   - **Reject** — spam / off-topic / duplicate.
3. **Act:**
   - **Fix & accept** → correct the JSON in the editor → Submit. The webhook's `promote-fn`:
     1. re-runs the Validator on the corrected JSON (hard gate — a human can't bypass schema validity);
     2. writes the corrected `<case_id>.md` + `.json` to the **live** prefix `gs://imm-postings-ingestion/<date>/reddit/`;
     3. `MERGE`s the BigQuery row with `resolution_status='resolved'` and `tagging_confidence=1.0` (human-verified);
     4. deletes the `_quarantine/` copies;
     5. **emits a gold example** to the self-learning store (§5).
   - **Reject** → mark `resolution_status='rejected'`; `promote-fn` moves artifacts to `_rejected/`; nothing is indexed; a (text → "rejected", reason) pair is logged for negative-signal analysis.
4. **Clear the queue daily.** SLA: zero items older than 24h, so the nightly Vertex AI Search sync only ever ingests clean, human-blessed documents.

**Escalation**: if > 20% of a day's batch quarantines, that's a systemic signal (model/prompt regression, Reddit format change, or a vocabulary gap) — page and inspect the dominant `__errors.txt` category before clearing.

---

## 4. Promote / reject actions (system side)

`promote-fn` (Cloud Run, triggered by Label Studio webhook):

| Action | Steps |
|---|---|
| **Promote (resolved)** | validate → write live sidecar pair → BigQuery MERGE `resolved` → delete quarantine copies → append gold example (§5) |
| **Reject** | BigQuery MERGE `rejected` → move artifacts to `_rejected/` → append negative example (text, reason) |
| **Defer** | leave in queue (used when a new-tag proposal is pending approval per [TAG-LIFECYCLE.md](TAG-LIFECYCLE.md)) |

All actions are idempotent (keyed by `case_id`); re-submitting a task does not duplicate rows or objects.

---

## 5. How quarantine drives self-learning

Every human decision is a labelled datapoint. The loop has four sinks; (A) and (B) are live in Phase 1.

### 5.1 (A) Vertex AI Example Store — immediate, no training

On every **promote (resolved)**, `promote-fn` upserts an example into the **Vertex AI Example Store**:

```
example = {
  "input":  <MD body + DOC_KIND + SUBREDDIT + POSTING_DATE>,
  "output": <the human-corrected canonical JSON>,
  "metadata": { "source": "quarantine_resolved",
                "subreddit": ..., "severity": ...,
                "added_at": <ts>, "confidence": 1.0 }
}
```

At tag time (workflow step 2), the agent embeds the incoming post body and **retrieves the k=5 nearest Example Store examples**, injecting them as few-shot demonstrations into the Gemini prompt. Effect: the *next* post that resembles a previously-quarantined-then-corrected one is tagged correctly **on the first pass, with no model retraining**. The store grows monotonically, so accuracy compounds as the corpus grows — this is the core "self-learning and evolve" mechanism (PIPELINE-ARCHITECTURE-WORKFLOW.md §6 method A).

Why the Example Store specifically: it is the managed Vertex AI primitive purpose-built for dynamic few-shot retrieval; it co-locates with the Agent Engine, supports similarity retrieval out of the box, and needs no training job or model promotion. Resolved quarantine items are the **highest-quality** examples in it because they are human-verified (`confidence = 1.0`).

### 5.2 (B) Gold dataset in BigQuery — for evaluation & future tuning

Each resolved item is also appended to a `postings.gold_labels` table (input text hash, final JSON, reviewer, timestamp). This gold set:
- feeds the **Gen AI Evaluation Service** harness (regression gate: a prompt/model change must not lower tag precision/recall or enum exact-match on the frozen gold set);
- is the training corpus for **Phase 2 supervised fine-tuning** of Gemini once it reaches ~500 rows (PIPELINE-ARCHITECTURE-WORKFLOW.md §6 method C). Fine-tuned candidates are promoted only if they beat the current model on the eval harness.

### 5.3 (C) Active-learning prioritisation (Phase 2)

Documents with `0.50 ≤ tagging_confidence ≤ 0.70` (model "unsure" but not quarantined) are sampled into the review queue preferentially. Human attention is spent where it most improves the model per label — maximising the value of (A) and (B).

### 5.4 (D) Negative signals

Rejected items (spam/off-topic) train a lightweight pre-filter (Phase 2) so obvious noise is dropped before it reaches Gemini — directly reducing cost and quarantine volume.

### 5.5 Feedback flow (one picture)

```
quarantine ──► Label Studio (human) ──► promote-fn
                                          │
              ┌───────────────────────────┼───────────────────────────┐
              ▼                           ▼                           ▼
   Example Store (A)            gold_labels BQ (B)            _rejected / negatives (D)
   dynamic few-shot             eval gate + Phase-2 SFT       pre-filter (Phase 2)
              │                           │
              ▼                           ▼
   next similar post tagged      model/prompt changes
   correctly first try           must beat frozen gold set
```

Net effect: the quarantine queue is self-extinguishing — each correction makes the class of error it represents less likely to recur, so steady-state quarantine volume trends down as ingestion volume grows.

---

## 6. Metrics to watch

| Metric | Target | Why |
|---|---|---|
| Daily quarantine rate | < 10% of ingested docs, trending down | Pipeline health & learning effectiveness |
| Time-to-clear queue | < 24h | Keeps the search index clean |
| Example Store size | Monotonic ↑ | Self-learning corpus growing |
| First-pass valid rate | ↑ over time | Proof the few-shot loop works |
| Repeat-error class rate | ↓ over time | Corrections are generalising |
| Reject rate | stable/low | Spike = upstream noise / scope drift |

---

## 7. Phase 1 vs Phase 2 behaviour

Authoritative phase definitions: [PIPELINE-ARCHITECTURE-WORKFLOW.md §18](PIPELINE-ARCHITECTURE-WORKFLOW.md). Quarantine differences by phase:

| Aspect | Phase 1 (Pilot) | Phase 2 (Production) |
|---|---|---|
| Review cadence | Daily manual review of the full quarantine queue (you) | Daily review continues; **active-learning sampling** also pulls 0.50–0.70-confidence non-quarantined docs into review |
| Volume | Low (3 subreddits, forward-only) | Higher (more subreddits + one-time backfill burst) — expect a temporary quarantine spike during backfill; triage by dominant `__errors.txt` category |
| Self-learning sinks active | (A) Example Store few-shot + (B) gold dataset + eval harness | + (C) active learning + (D) negative-signal pre-filter; gold set feeds **fine-tuning** once ≥ ~500 (Vertex ML Metadata lineage) |
| Index effect of a promote | Picked up by the **daily auto-sync** | Picked up in **minutes** via event-driven `search-importer` |
| New-tag proposals | Reviewed daily (see [TAG-LIFECYCLE.md](TAG-LIFECYCLE.md)) | Reviewed on a regular batch cadence (weekly at steady state) |

The quarantine *mechanism, GCS layout, Label Studio setup, and promote/reject actions are identical in both phases* — only cadence, volume, and which self-learning sinks are active differ.

## 8. Open items

- Confirm Cloud SQL (Postgres) is acceptable for Label Studio state (vs a managed alternative).
- Confirm reviewer identities for IAP allow-list.
- Define the exact `tagging_confidence` quarantine threshold (default 0.60) and the active-learning band (default 0.50–0.70).
- Decide retention for `_rejected/` (recommend 90 days then delete).
