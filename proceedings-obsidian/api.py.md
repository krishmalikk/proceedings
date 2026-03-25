# api.py

**Type:** FastAPI HTTP server
**Lines:** ~170
**Location:** `/api.py`
**Deployed:** Cloud Run at `https://proceedings-api-971592620882.us-central1.run.app`

---

## Purpose

Exposes the RAG pipeline as HTTP endpoints for the Next.js website. Bridges the frontend to Vector Search + Gemini.

---

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ask` | POST | Submit question, get RAG answer, saves to Firestore |
| `/api/qa` | GET | List recent Q&A pairs (paginated `?limit=20&offset=0`) |
| `/api/qa/{id}/feedback` | POST | Submit helpful/not helpful feedback |
| `/api/health` | GET | Health check, reports loaded chunk count |

---

## Key Details

- Initializes Vertex AI, chunk_mapping, and Firestore client at startup (singleton pattern via `lifespan`)
- CORS allows `localhost:3000` and `*.vercel.app`
- In-memory rate limiting: 10 requests/min per IP on `/api/ask`
- Input validation: 5-500 character questions via Pydantic
- Imports core functions from [[query.py]]

---

## Dependencies

- `fastapi`, `uvicorn` — HTTP framework and server
- `google-cloud-firestore` — Q&A storage
- All dependencies from [[query.py]] (Vertex AI, GCS)

---

## Running

```bash
# Local
uvicorn api:app --reload --port 8000

# Production (Cloud Run)
gcloud run deploy proceedings-api --source .
```

---

## Related

- Frontend calls via [[Website]] Next.js API routes (`/api/ask/route.ts`, `/api/qa/route.ts`)
- Core RAG logic in [[query.py]]
- Q&A storage in Firestore `qa_pairs` collection
