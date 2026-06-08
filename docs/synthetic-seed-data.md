# Synthetic seed data — guide

How to populate the app with realistic test data (users, postings, replies,
votes, groups, group chat), where it lands in GCP, how to verify it, and how to
remove it.

- **Scripts:** `backend/scripts/seed_synthetic.py` (create) · `backend/scripts/teardown_synthetic.py` (remove)
- **Project:** `proceedings-490601` (single project — **test data is live data**)
- **Manifest:** `backend/scripts/seed_manifest.json` (written by the seed run; the index of everything created; consumed by teardown). Git-ignored.

---

## 1. What gets created

20 synthetic users in **4 "boats" of 5**. Each boat shares a *visa + consulate +
country* signature, so the matcher **converges its 5 members into one group**;
their key-dates are spread across the proximity buckets to exercise date scoring.

| Boat | Signature | Users |
|---|---|---|
| A | H-1B → EB-2 · Mumbai (BOM) · India | `syn-01`…`syn-05` |
| B | F-1 → H-1B · Hyderabad (HYD) · India | `syn-06`…`syn-10` |
| C | EB-2 NIW · Chennai (MAA) · India | `syn-11`…`syn-15` |
| D | B-2 visitor · Mexico City (MEX) · Mexico | `syn-16`…`syn-20` |

The seed run produces, end to end:

| Item | Count | Stored in |
|---|---|---|
| User profiles | 20 | Firestore `users/{syn-NN}` |
| Postings (published) | 20 | GCS + Vertex AI Search datastore + BigQuery |
| Replies (cross-user) | ~60 | Firestore `replies` |
| Votes (postings + replies) | ~120 | Firestore `votes` + `content_meta` |
| Groups | 4 | Firestore `groups/{id}` |
| Group chat messages | ~40 | Firestore `groups/{id}/messages` |

The 20 ids are in `backend/seed_users.json` (labeled `Synthetic ·`), so the API's
`X-User-Id` impersonation accepts them and they appear in the demo-user picker.

---

## 2. Prerequisites

- **ADC** (no SA key files — D-018): `gcloud auth application-default login`, or
  run where a service account is attached. The principal needs Firestore, GCS,
  Vertex AI Search, BigQuery, and Gemini permissions.
- **`backend/.env`** populated (same as the rest of the backend):
  `GCP_PROJECT_ID`, `GCP_BUCKET_NAME`, `GCP_VERTEX_DATASTORE_ID`,
  `GCP_VERTEX_DATASTORE_LOCATION`, `GCP_REGION`, …
- **Python deps** installed: `pip install -r backend/requirements.txt`.
- The 20 synthetic ids present in `backend/seed_users.json` (they are, committed
  with the scripts).

---

## 3. Run the seed

From the **`backend/`** directory:

```bash
cd backend
python scripts/seed_synthetic.py
```

What it does (drives the real API in-process via FastAPI `TestClient`, so it
exercises the actual endpoints + guardrails):

1. `PUT /api/profile` × 20 — creates the user profiles.
2. `POST /api/postings` × 20 — publishes postings (each: a Gemini enrichment
   call → GCS sidecars → `documents.import` into the datastore → a BigQuery row
   marked `pipeline_run_id=test-synthetic`). **Slow** — minutes — and the rows
   become searchable a few minutes later (async indexing).
3. Cross **replies + votes** — every user replies to/votes on several others'
   postings and replies.
4. **Groups + chat** — one group per boat (with a convergence check that a
   second member re-posting the same criteria *joins* rather than duplicates),
   then a few chat messages per member.

It finishes by writing `backend/scripts/seed_manifest.json` and printing a
summary (counts + the 4 group ids).

> **Note:** this writes to the real GCP project. Postings persist in the
> production search index until you run the teardown.

---

## 4. Where the data lands in GCP — and how to verify

Start from the manifest — it lists every id created:

```bash
cat backend/scripts/seed_manifest.json   # case_ids, group_ids, reply_ids, users, votes
```

The seed touches **five** surfaces:

| Data | GCP surface | Console | CLI |
|---|---|---|---|
| Users, replies, votes, groups, chat | **Firestore** (Native): `users`, `replies`, `votes`, `content_meta`, `groups` (+ `groups/{id}/messages`) | [Firestore Data](https://console.cloud.google.com/firestore/databases/-default-/data?project=proceedings-490601) | python snippet ↓ |
| Posting sidecars (`.md` + `.json`) | **Cloud Storage**: `gs://imm-postings-ingestion/<YYYY-MM-DD>/app/` | [Storage browser](https://console.cloud.google.com/storage/browser/imm-postings-ingestion?project=proceedings-490601) | `gsutil ls -r 'gs://imm-postings-ingestion/2026-*/app/'` |
| Indexed (searchable) postings | **Vertex AI Search** datastore `imm-postings-datastore` (location `global`) | [Agent Builder → Data Stores → imm-postings-datastore → Documents](https://console.cloud.google.com/gen-app-builder/data-stores?project=proceedings-490601) | search via the app (§4.4) |
| Posting metadata rows | **BigQuery** `proceedings-490601.postings.postings_metadata` (col `pipeline_run_id`) | [BigQuery](https://console.cloud.google.com/bigquery?project=proceedings-490601) | `bq query` ↓ |

### 4.1 BigQuery — the 20 rows this run wrote
```bash
bq query --use_legacy_sql=false \
'SELECT case_id, post_title, posting_date, pipeline_run_id
 FROM `proceedings-490601.postings.postings_metadata`
 WHERE pipeline_run_id = "test-synthetic" ORDER BY posting_date'
```

### 4.2 Firestore — count the synthetic users / groups (run from `backend/`)
```bash
python - <<'PY'
from google.cloud import firestore
db = firestore.Client(project="proceedings-490601")
users = [d.id for d in db.collection("users").stream() if d.id.startswith("syn-")]
groups = list(db.collection("groups").stream())
print("syn users:", len(users), users[:5], "...")
print("groups:", len(groups))
for g in groups:
    msgs = list(db.collection("groups").document(g.id).collection("messages").stream())
    print(" ", g.id, (g.to_dict() or {}).get("name"), f"({len(msgs)} msgs)")
PY
```

### 4.3 Cloud Storage — sidecars for a specific posting (case_id from the manifest)
```bash
gsutil ls 'gs://imm-postings-ingestion/**/<case_id>.json'
```

### 4.4 Verify through the running app (easiest end-to-end)
With the backend running (local `uvicorn api:app --port 8000`, or the deployed
Cloud Run URL), the same data is visible via the API (pass an `X-User-Id`):

| Check | Request |
|---|---|
| Users in the picker | `GET /api/users` |
| Browse groups | `GET /api/groups/all` · header `X-User-Id: syn-01` |
| Replies + votes on a posting | `GET /api/postings/<case_id>/replies` · header `X-User-Id: syn-01` |
| Group chat | `GET /api/groups/<group_id>/messages` · header `X-User-Id: syn-01` |
| Search (after ~few min indexing) | `GET /api/search?q=Mumbai%20H-1B%20EB-2` |

Or in the **UI**: pick any `Synthetic · …` user in the demo-user dropdown and
browse Search / a posting's replies / the **Find** and group pages.

> **Caveats:** postings are **anonymized** in the datastore (author shows as a
> synthetic handle, not the username — by design). Search lags the run by a few
> minutes (indexing is async). The `/find` and group features read straight from
> Firestore, so they reflect the data immediately.

---

## 5. Clean up (remove everything)

From **`backend/`**:

```bash
cd backend
python scripts/teardown_synthetic.py
```

It reads the manifest and deletes, best-effort:

- postings from the **datastore + GCS** (`posting.delete_content`),
- **BigQuery** rows marked `test-synthetic` (`posting.purge_test_bq_rows`),
- Firestore **replies, votes, content_meta, groups (+ messages), and users**.

Then it archives the manifest to `seed_manifest.json.done` (so a re-run is a
no-op).

> **BigQuery same-day rows:** `purge_test_bq_rows` only deletes rows whose
> `posting_date` is *before today* (streaming-buffer limitation). Rows created
> today are purged by a later teardown run (e.g. the next day). This is expected.

**Picker:** teardown removes the *data* but leaves the 20 entries in
`backend/seed_users.json`. To clean the demo-user picker, revert that file:
```bash
git checkout origin/main -- backend/seed_users.json   # or git revert the seed commit
```

---

## 6. Reference

- Persona/boat definitions and the interaction matrix: `backend/scripts/seed_synthetic.py` (`BOATS`).
- Posting publish pipeline (GCS → datastore → BigQuery) and cleanup helpers:
  `backend/posting.py` (`publish_posting`, `delete_content`, `purge_test_bq_rows`).
- Matching / group convergence: `backend/matching.py`. Group chat: `backend/group_messages.py`.
- Impersonation roster: `backend/seed_users.json` (`_active_user` in `backend/api.py`).
