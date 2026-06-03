# Environment Setup Guide

This guide covers setting up the complete Proceedings development environment including the Python API backend, GCP services, mobile app, and website.

---

## Prerequisites

- **Python 3.11+**
- **Node.js 18+** and npm
- **Google Cloud SDK** (`gcloud`)
- **Expo CLI** for mobile development
- **Git**

---

## 1. Clone and Navigate

```bash
git clone <repository-url>
cd proceedings-main
```

---

## 2. GCP Authentication

```bash
# Login to Google Cloud
gcloud auth login
gcloud auth application-default login

# Set project
gcloud config set project proceedings-490601
```

---

## 3. Environment Variables

Create a `.env` file in the project root:

```bash
# ===========================================
# Proceedings RAG Pipeline — Environment Variables
# ===========================================

# GCP Configuration
GCP_PROJECT=proceedings-490601
GCP_PROJECT_ID=proceedings-490601
GCP_BUCKET=gs://imm-postings-ingestion
GCP_BUCKET_NAME=imm-postings-ingestion
GCP_LOCATION=us-central1
GCP_REGION=us-central1

# BigQuery (for analytics)
GCP_BQ_DATASET=IMM
GCP_BQ_TABLE=postings_metadata

# Vertex AI Search (Discovery Engine)
GCP_VERTEX_DATASTORE_LOCATION=global
GCP_VERTEX_DATASTORE_ID=imm-postings-datastore
GCP_VERTEX_SEARCH_APP_ID=imm-postings-search-app

# Vertex AI Vector Search (RAG Pipeline)
VERTEX_AI_INDEX_ID=8958040089863127040
VERTEX_AI_INDEX_ENDPOINT_ID=245914571645124608

# Gemini Model
GCP_GEMINI_MODEL=gemini-2.5-flash
GCP_GEMINI_LOCATION=us-central1
```

---

## 4. Python Backend Setup

### Install Dependencies

```bash
# Create virtual environment (recommended)
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Key Dependencies

- `fastapi` - API framework
- `uvicorn` - ASGI server
- `google-cloud-aiplatform` - Vertex AI SDK
- `google-cloud-storage` - GCS access
- `google-cloud-firestore` - Q&A storage
- `vertexai` - Gemini and embeddings
- `tiktoken` - Token counting for chunking

### Run Locally

```bash
uvicorn api:app --reload --port 8000
```

### Test API

```bash
# Health check
curl http://localhost:8000/api/health

# Ask a question
curl -X POST http://localhost:8000/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "What is the H-1B visa?"}'
```

---

## 5. RAG Pipeline Components

### Architecture

```
User Question
     │
     ▼
┌─────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  api.py     │───▶│  query.py        │───▶│ Vertex AI       │
│  (FastAPI)  │    │  (RAG Pipeline)  │    │ Vector Search   │
└─────────────┘    └──────────────────┘    └─────────────────┘
                            │                       │
                            ▼                       ▼
                   ┌──────────────────┐    ┌─────────────────┐
                   │ chunk_mapping.json│    │ Embeddings      │
                   │ (GCS bucket)      │    │ (768-dim)       │
                   └──────────────────┘    └─────────────────┘
                            │
                            ▼
                   ┌──────────────────┐
                   │ Gemini 2.5 Flash │
                   │ (Answer Gen)     │
                   └──────────────────┘
```

### Key Files

| File | Purpose |
|------|---------|
| `api.py` | FastAPI server exposing `/api/ask`, `/api/qa`, `/api/health` |
| `query.py` | RAG pipeline: embed → retrieve → generate |
| `index.py` | Creates Vector Search index and chunk_mapping.json |
| `prepare_labeled_data.py` | Converts GCS manifests to labeled/ format |

### GCS Bucket Structure

```
gs://imm-postings-ingestion/
├── labeled/                    # Labeled documents for indexing
├── chunk_mapping.json          # Maps chunk IDs → text content
├── 2026-05-28/reddit/          # Raw Reddit data
│   └── _manifest/*.jsonl       # Document manifests
└── _manifests/                 # Global manifests
```

---

## 6. Adding New Data to RAG

### Step 1: Prepare Data

```bash
# Run the preparation script to convert manifests to labeled format
python prepare_labeled_data.py
```

### Step 2: Upload to GCS

```bash
gsutil -m cp -r labeled/ gs://imm-postings-ingestion/labeled/
```

### Step 3: Generate Embeddings and Update Index

```bash
# Option A: Run full index.py (creates new index if needed)
python index.py

# Option B: Manually upsert to existing index
python3 << 'EOF'
from google.cloud import aiplatform
from vertexai.language_models import TextEmbeddingInput, TextEmbeddingModel
import json

aiplatform.init(project="proceedings-490601", location="us-central1")

# Load chunk mapping
with open("chunk_mapping.json", "r") as f:
    chunk_mapping = json.load(f)

# Generate embeddings
model = TextEmbeddingModel.from_pretrained("text-embedding-005")
# ... (see full script in project)
EOF
```

### Step 4: Upload Updated Chunk Mapping

```bash
gsutil cp chunk_mapping.json gs://imm-postings-ingestion/chunk_mapping.json
```

### Step 5: Redeploy API

```bash
gcloud run deploy immiguide-api \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars="GCP_PROJECT_ID=proceedings-490601,GCP_REGION=us-central1,GCP_BUCKET_NAME=imm-postings-ingestion,VERTEX_AI_INDEX_ENDPOINT_ID=245914571645124608"
```

---

## 7. Mobile App Setup (Expo)

```bash
cd proceedings-mobile

# Install dependencies
npm install

# Start Expo
npx expo start
```

### Environment

The mobile app uses the API URL configured in:
`src/services/apiService.ts`

```typescript
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://immiguide-api-971592620882.us-central1.run.app';
```

---

## 8. Website Setup (Next.js)

```bash
cd website

# Install dependencies
npm install

# Create .env.local
echo 'PYTHON_API_URL=https://immiguide-api-971592620882.us-central1.run.app' > .env.local

# Run development server
npm run dev
```

---

## 9. Cloud Run Deployment

### Deploy API

```bash
gcloud run deploy immiguide-api \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars="GCP_PROJECT_ID=proceedings-490601,GCP_REGION=us-central1,GCP_BUCKET_NAME=imm-postings-ingestion,VERTEX_AI_INDEX_ENDPOINT_ID=245914571645124608"
```

### Check Deployment

```bash
# Get service URL
gcloud run services describe immiguide-api --region=us-central1 --format="value(status.url)"

# View logs
gcloud run services logs read immiguide-api --region=us-central1 --limit=50
```

---

## 10. Troubleshooting

### "I don't have that information" Error

1. Check chunks are loaded:
   ```bash
   curl https://immiguide-api-971592620882.us-central1.run.app/api/health
   # Should show: {"status":"ok","chunks_loaded":807}
   ```

2. If chunks_loaded is 0:
   - Verify `chunk_mapping.json` exists in GCS
   - Check Cloud Run logs for errors

3. If chunks_loaded > 0 but still getting fallback:
   - The question may not match any chunks in the knowledge base
   - Try questions about H-1B, green cards, or work authorization

### Vector Search Not Working

1. Verify endpoint is deployed:
   ```bash
   gcloud ai index-endpoints describe 245914571645124608 --region=us-central1
   ```

2. Check deployed index ID matches `query.py`:
   ```python
   deployed_index_id="legal_intake_deployed_v2"
   ```

### Chunk ID Mismatch

If Vector Search returns IDs that don't exist in chunk_mapping.json:
- Merge old and new chunk mappings
- Or re-index all data with consistent IDs

---

## 11. Current Production URLs

| Service | URL |
|---------|-----|
| API | https://immiguide-api-971592620882.us-central1.run.app |
| Health | https://immiguide-api-971592620882.us-central1.run.app/api/health |
| Website | (Vercel deployment) |

---

## 12. Knowledge Base Statistics

- **Total chunks**: 807
- **Reddit posts**: 82 (from r/h1b, r/usvisascheduling, r/USVisas)
- **Web scraped**: 725 (immigrationdirect.com, visaguide.world, USCIS, etc.)

### Top Topics

| Topic | Chunks |
|-------|--------|
| general-immigration-info | 322 |
| visa-fees-filing | 195 |
| consular-processing | 153 |
| family-based-immigration | 134 |
| employment-green-cards | 134 |
| h1b-visa | 77 |

---

## 13. Sample Working Questions

These questions have good coverage in the knowledge base:

- "What is the H-1B visa?"
- "What happens after I get laid off on H-1B?"
- "How does the 60-day grace period work?"
- "How do I apply for a marriage-based green card?"
- "What is adjustment of status?"
- "Can I transfer my H-1B to a new employer?"
