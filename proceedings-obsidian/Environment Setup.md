# Environment Setup & Local Testing Runbook

Single operational runbook for running and testing the Proceedings stack **locally** — Python API backend, website, and mobile app — grounded on the managed **Vertex AI Search datastore** (`imm-postings-datastore`, which contains the Reddit ingestion).

> **Architecture note (current):** grounding is served by the managed **Discovery Engine Search/Answer API** over `imm-postings-datastore` (app + reddit) with an optional public-reference website tier (DS-2). The old self-managed **Vertex AI Vector Search** path (`index.py`, `chunk_mapping.json`, `VERTEX_AI_INDEX_*`, `find_neighbors`) is **retired** — ignore any older references to it. See [FINAL-ARCHITECTURE](../app-specifications/FINAL-ARCHITECTURE.md) and MEMORY.md D-039.

---

## Prerequisites

- **Python 3.11+** (3.9 will not work — the code uses `str | None` syntax)
- **Node.js 18+** and npm
- **Google Cloud SDK** (`gcloud`)
- **Expo CLI** (mobile)
- **Git**

---

## 1. Clone & navigate

```bash
git clone <repository-url>
cd proceedings
```

---

## 2. GCP authentication (ADC)

```bash
gcloud auth login
gcloud auth application-default login
gcloud config set project proceedings-490601
```

> The Discovery Engine API needs a **quota project**; the backend sets it in code, and ADC login above provides credentials. No service-account key files.

---

## 3. Environment variables (`.env` in project root)

```bash
# GCP
GCP_PROJECT=proceedings-490601
GCP_PROJECT_ID=proceedings-490601
GCP_BUCKET=gs://imm-postings-ingestion
GCP_BUCKET_NAME=imm-postings-ingestion
GCP_LOCATION=us-central1
GCP_REGION=us-central1

# Vertex AI Search (Discovery Engine) — the grounding store
GCP_VERTEX_DATASTORE_LOCATION=global
GCP_VERTEX_DATASTORE_ID=imm-postings-datastore
GCP_VERTEX_SEARCH_APP_ID=imm-postings-search-app      # DS-1: app + reddit

# Tier-3 public reference (DS-2) — leave UNSET until its website crawl finishes
# GCP_VERTEX_PUBLIC_ENGINE_ID=imm-public-reference-search-app

# Gemini (direct-answer fallback only)
GCP_GEMINI_MODEL=gemini-2.5-flash
GCP_GEMINI_LOCATION=us-central1
```

> `VERTEX_AI_INDEX_ID` / `VERTEX_AI_INDEX_ENDPOINT_ID` are **obsolete** (retired Vector Search) and ignored by the current code — they can be removed.

---

## 4. Python backend setup

```bash
# Virtual environment — MUST be Python 3.11+
/opt/homebrew/bin/python3.11 -m venv .venv      # or any python3.11+
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -r requirements.txt
```

### Run locally

```bash
.venv/bin/python -m uvicorn api:app --reload --port 8000
```

### Smoke test

```bash
curl http://localhost:8000/api/health
# {"status":"ok","chunks_loaded":1}    # chunks_loaded=1 means grounding engine is configured

curl -X POST http://localhost:8000/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question":"B1/B2 visa interview experience in Mumbai"}'
# sources should be reddit-* case ids  ->  grounded on the Reddit datastore
```

If `sources` are `reddit-*` ids, the backend is correctly grounded on `imm-postings-datastore`.

---

## 5. ⭐ Local end-to-end testing — point the web/mobile app at the LOCAL backend

**This is the key step.** Both front-ends are thin proxies; by default they call the **deployed Cloud Run** API, which runs the **old** code (no Reddit). To test the new grounding locally you must repoint them at `http://localhost:8000` **and restart them** (env is read only at startup).

### 5.1 Website (Next.js)

```bash
cd website
npm install                       # first time only

# Point the website at the local backend (NOT Cloud Run)
cat > .env.local <<'EOF'
# Local dev: use the LOCAL backend (new datastore grounding w/ Reddit)
PYTHON_API_URL=http://localhost:8000
# Cloud Run (OLD code — no Reddit). Restore only after redeploying new code.
# PYTHON_API_URL=https://immiguide-api-971592620882.us-central1.run.app
EOF

npm run dev                       # http://localhost:3000  — RESTART if it was already running
```

Verify the full chain (website → local backend → datastore):

```bash
curl -s -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question":"What was the B1/B2 visa interview experience in Mumbai?"}'
# expect is_fallback:false and reddit-* sources
```

Then refresh the browser tab (the chat thread lives in React state; reload to start fresh).

### 5.2 Mobile app (Expo)

```bash
cd proceedings-mobile
npm install                       # first time only

# Point the app at the local backend via an Expo public env var:
EXPO_PUBLIC_API_URL=http://localhost:8000 npx expo start
```

> **Device/emulator networking caveat:** `localhost` from inside a device/emulator does NOT mean your Mac.
> - **iOS simulator:** `http://localhost:8000` works.
> - **Android emulator:** use `http://10.0.2.2:8000`.
> - **Physical device:** use your Mac's LAN IP (e.g. `http://192.168.1.x:8000`) and start the backend with `--host 0.0.0.0`:
>   ```bash
>   .venv/bin/python -m uvicorn api:app --reload --host 0.0.0.0 --port 8000
>   ```

The mobile API URL falls back to Cloud Run in [`src/services/apiService.ts`](../proceedings-mobile/src/services/apiService.ts) if `EXPO_PUBLIC_API_URL` is unset — so always set it for local testing.

### 5.3 Checklist for a clean local run

1. `gcloud auth application-default login` is valid.
2. Backend running: `curl localhost:8000/api/health` → `{"status":"ok","chunks_loaded":1}`.
3. Website `.env.local` → `PYTHON_API_URL=http://localhost:8000`, then `npm run dev` **restarted**.
4. Mobile started with `EXPO_PUBLIC_API_URL` pointing at the backend (host-aware per above).
5. Ask a Reddit-answerable question → sources are `reddit-*`.

---

## 6. End-to-end test suite

```bash
.venv/bin/python tests/test_grounding_e2e.py
```

Verifies (12 checks): (A) Reddit content is returned; (B) an app/web posting lands in `imm-postings-datastore` (`channel="app"`) and is grounded; (C) the public tier (DS-2) is consulted only when required and only for the registered domains. Self-cleaning; no Firestore pollution.

---

## 7. Public-reference tier (DS-2) — optional, "no ingestion"

Curated public sites (uscis.gov, travel.state.gov, dol.gov, boundless.com, immigrationdirect.com) are grounded via a **Google-crawled** website data store — we run no crawler.

```bash
# One-time provisioning (idempotent; also reprints indexing status)
.venv/bin/python scripts/provision_ds2_website.py
```

Google crawls/indexes asynchronously (minutes–hours). Once the target sites read `SUCCEEDED`, activate the tier-3 fallback:

```bash
# in .env:
GCP_VERTEX_PUBLIC_ENGINE_ID=imm-public-reference-search-app
# then restart the backend
```

Tier-3 is only consulted when DS-1 (app + reddit) can't answer.

---

## 8. Architecture (current)

```
User question
     │
     ▼
┌──────────┐   ┌──────────────────┐   ┌─────────────────────────────┐
│ api.py   │──▶│ search_client.py │──▶│ Vertex AI Search Answer API │
│ (FastAPI)│   │ answer_query()   │   │  DS-1 imm-postings-datastore│  app + reddit
└────┬─────┘   └──────────────────┘   │  DS-2 website store (tier-3)│  public, on fallback
     │                                 └─────────────────────────────┘
     ▼ (if no engine configured)
generate_direct_answer()  ── Gemini 2.5 Flash (non-grounded fallback)
     │
     ▼
Firestore qa_pairs (history + feedback + analytics)  — NOT a grounding source
```

| File | Purpose |
|------|---------|
| [`api.py`](../api.py) | FastAPI server: `/api/ask`, `/api/qa`, `/api/qa/stats`, `/api/health` |
| [`search_client.py`](../search_client.py) | Grounded retrieval via the Discovery Engine Answer API |
| [`query.py`](../query.py) | Firestore Q&A helpers + direct-Gemini fallback |
| [`scripts/provision_ds2_website.py`](../scripts/provision_ds2_website.py) | Provision the DS-2 public website store |

---

## 9. Cloud Run deployment (production)

To make the **deployed** site/app grounded on Reddit (so the local override isn't needed), redeploy the new backend:

```bash
gcloud run deploy immiguide-api \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars="GCP_PROJECT_ID=proceedings-490601,GCP_REGION=us-central1,GCP_VERTEX_SEARCH_APP_ID=imm-postings-search-app,GCP_VERTEX_DATASTORE_LOCATION=global"

# verify it now returns reddit-* sources:
curl -s -X POST "$(gcloud run services describe immiguide-api --region=us-central1 --format='value(status.url)')/api/ask" \
  -H "Content-Type: application/json" -d '{"question":"B1/B2 interview experience in Mumbai"}'
```

After a successful redeploy, the website/mobile defaults (Cloud Run URL) will be correctly grounded and the local `.env.local` override can be reverted.

> The deployed Cloud Run SA needs Discovery Engine query permission on the data store. Logs: `gcloud run services logs read immiguide-api --region=us-central1 --limit=50`.

---

## 10. Troubleshooting

### "Responses are not coming from Reddit / look like old law-firm content"
The front-end is hitting the **old Cloud Run** backend, not your local one.
1. `cat website/.env.local` → must be `PYTHON_API_URL=http://localhost:8000` (mobile: `EXPO_PUBLIC_API_URL`).
2. **Restart** the dev server after changing env (Next/Expo read env only at startup).
3. Confirm the local backend grounds on Reddit: `curl localhost:8000/api/ask ...` → `reddit-*` sources.
4. Tell the two apart by health: local new backend = `chunks_loaded:1`; old Cloud Run = `chunks_loaded:807`.

### Backend won't start / `TypeError: unsupported operand 'type' and 'NoneType'`
The venv is Python 3.9. Rebuild it on **3.11+** (see §4).

### `/api/ask` returns the fallback message for everything
- Check `curl localhost:8000/api/health` → `chunks_loaded:1` (engine configured). If `0`, set `GCP_VERTEX_SEARCH_APP_ID` in `.env` and restart.
- Verify ADC: `gcloud auth application-default print-access-token`.
- The question may genuinely have no match in the datastore (try a Reddit-covered topic, §11).

### Discovery Engine 403 "requires a quota project"
Run `gcloud auth application-default login` (the client sets the quota project in code; ADC must be present).

---

## 11. Sample Reddit-grounded questions

- "B1/B2 visa interview experience in Mumbai"
- "What questions did the officer ask at the consulate?"
- "Experiences with H-1B extension under regular processing in Texas"
- "What was the wait time at the visa interview?"

---

## 12. Current resources

| Resource | ID / URL |
|---|---|
| Project | `proceedings-490601` |
| Grounding datastore (DS-1) | `imm-postings-datastore` / engine `imm-postings-search-app` |
| Public reference (DS-2) | `imm-public-reference-datastore` / engine `imm-public-reference-search-app` |
| Deployed API (Cloud Run) | https://immiguide-api-971592620882.us-central1.run.app *(old code until redeployed)* |
| GCS bucket | `gs://imm-postings-ingestion` |
