# Deployment

---

## Architecture

```
User → Vercel (Next.js) → Cloud Run (FastAPI) → Vertex AI Vector Search + Gemini
                                      ↓
                                  Firestore (Q&A storage)
```

---

## API — Cloud Run

| Setting | Value |
|---------|-------|
| Service | `proceedings-api` |
| URL | `https://proceedings-api-971592620882.us-central1.run.app` |
| Region | `us-central1` |
| Memory | 1Gi |
| Min instances | 1 (avoids cold starts) |
| Timeout | 60s |

**Env vars set on Cloud Run:**
- `GCP_PROJECT_ID=proceedings-490601`
- `GCP_REGION=us-central1`
- `GCP_BUCKET_NAME=law-firm-knowledge-base`
- `VERTEX_AI_INDEX_ID=8958040089863127040`
- `VERTEX_AI_INDEX_ENDPOINT_ID=245914571645124608`

**Redeploy:**
```bash
gcloud run deploy proceedings-api --source . --project proceedings-490601 --region us-central1 --quiet
```

---

## Website — Vercel

| Setting | Value |
|---------|-------|
| Repo | `krishmalikk/proceedings` |
| Root directory | `website` |
| Framework | Next.js 14 |

**Env var on Vercel:**
- `PYTHON_API_URL=https://proceedings-api-971592620882.us-central1.run.app`

Deploys automatically on push to `main`.

---

## Dockerfile

Located at `/Dockerfile`. Copies `api.py` and `query.py`, installs Python dependencies, runs uvicorn on port 8080.

---

## Infrastructure Summary

| Service | Provider | Purpose |
|---------|----------|---------|
| Website hosting | Vercel | Next.js frontend |
| API server | Cloud Run | FastAPI backend |
| Vector database | Vertex AI Vector Search | Chunk retrieval |
| LLM | Gemini 2.5 Flash (Vertex AI) | Answer generation |
| Embeddings | Vertex AI text-embedding-005 | Query + document embeddings |
| Object storage | GCS (`law-firm-knowledge-base`) | Crawled pages, labeled data, chunk mapping |
| Q&A database | Firestore | Question/answer pairs + feedback |
| Labeling | Label Studio (GCP VM) | Optional manual review |
