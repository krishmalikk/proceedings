# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Proceedings is a RAG (Retrieval-Augmented Generation) immigration-intake assistant. It grounds answers on user/Reddit postings indexed in the managed **Vertex AI Search (Discovery Engine) datastore**, and serves answers + auto-tagged postings + AI onboarding via Gemini — with strict guardrails against providing legal advice. (The retired Firecrawl→Vector-Search prototype is archived under `legacy/`.)

## Architecture

The live backend is a **FastAPI service** in **`backend/`** (`backend/api.py`),
grounded on the **managed Vertex AI Search (Discovery Engine) datastore**
`imm-postings-datastore` via the Search/Answer API, with Gemini for tagging and
answers. Core live modules (all under `backend/`):

- **`api.py`** — the HTTP API (search, postings, profile, onboarding, reconcile, expert).
- **`search_client.py`** — grounded retrieval (Answer/Search API) + facets/strictness.
- **`posting.py`** — user-posting + experience tagging → GCS sidecar → `documents.import`.
- **`profile.py`** — user profile + two-stage AI onboarding (Firestore `users/{id}`).
- **`reconcile.py`** — profile↔message reconciliation at publish time.
- **`query.py`** — Gemini helpers (direct answer, intent) + Firestore Q&A log.
- **`tags-cleaned/`** — the controlled tag vocabulary (single source of truth).

> The original prototype (Firecrawl crawl → label → self-managed Vertex AI
> Vector Search) is **retired** and archived under [`legacy/`](legacy/README.md)
> (MEMORY.md D-016/D-039/D-040/D-046). It is not deployed.

Supporting files:
- `gcp_setup.sh` — Creates/configures the GCS bucket.
- `documents/` — Business/legal documents (intake checklist, launch requirements, pilot offer).
- `website/` — Next.js 14 app (marketing + search/onboarding/posting UI).

## Commands

### Backend (from `backend/`)
```bash
pip install -r backend/requirements.txt
cd backend && uvicorn api:app --reload --port 8000     # run the API locally
python backend/tests/test_reconcile.py                 # a suite (also test_profile.py / test_posting_tagging.py)
gcloud run deploy immiguide-api --source backend --region us-central1   # deploy
```

### Website (from `website/`)
```bash
npm install
npm run dev          # Local dev server
npm run build        # Production build
npm run lint         # ESLint
```

### GCP setup
```bash
gcloud auth application-default login
bash gcp_setup.sh
```

## Environment Variables

Copy `.env.example` to `.env`. Key variables:
- `GCP_PROJECT_ID`, `GCP_REGION`, `GCP_BUCKET_NAME` — GCP config
- `FIRECRAWL_API_KEY` — for crawler.py
- `GCP_VERTEX_SEARCH_APP_ID`, `GCP_VERTEX_DATASTORE_ID`, `GCP_VERTEX_DATASTORE_LOCATION` — managed Vertex AI Search (Discovery Engine) grounding sink used by `api.py`/`search_client.py`. (The old self-managed Vector Search `VERTEX_AI_INDEX_*` was retired/decommissioned — D-039/D-040.)
- `LABEL_STUDIO_URL`, `LABEL_STUDIO_API_KEY` — optional, for Label Studio API automation

## Key Design Decisions

- **Embedding model consistency**: Both indexing (`RETRIEVAL_DOCUMENT`) and querying (`RETRIEVAL_QUERY`) must use `text-embedding-005`. Changing one without the other silently breaks retrieval.
- **Guardrails in query.py**: The Gemini prompt explicitly forbids legal advice, eligibility determinations, and case assessments. The `FALLBACK_MESSAGE` constant is returned when context is insufficient. These guardrails are critical for the legal domain.
- **chunk_mapping.json**: Vector Search only stores IDs and vectors. This JSON file (stored in GCS, cached locally) maps chunk IDs back to text, source file, and labels. It's the bridge between retrieval and generation.

## Obsidian Knowledge Base

The `proceedings-obsidian/` folder contains an Obsidian vault with detailed analysis of every file in the project. See `proceedings-obsidian/CLAUDE.md` for the full index. When you need deeper context about any script, component, or business document, read the corresponding note in that directory.
