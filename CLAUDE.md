# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Proceedings is a RAG (Retrieval-Augmented Generation) pipeline for a legal intake assistant focused on immigration law. It crawls government/law firm websites, labels the content, indexes it into Vertex AI Vector Search, and serves answers via Gemini Pro — with strict guardrails against providing legal advice.

## Architecture

The pipeline has three sequential stages, each a standalone Python script:

1. **`crawler.py`** — Crawls URLs from `urls.txt` using the Firecrawl API, converts pages to Markdown, saves locally to `crawled_pages/`, and uploads to a GCS bucket.
2. **`index.py`** — Downloads labeled Markdown from `gs://<bucket>/labeled/`, chunks text into ~512-token pieces (50-token overlap, tiktoken cl100k_base), generates embeddings via Vertex AI `text-embedding-005` (768-dim), creates a Vertex AI Vector Search index (Tree-AH, DOT_PRODUCT), and uploads a `chunk_mapping.json` to GCS.
3. **`query.py`** — Interactive CLI that embeds a user question, retrieves top-5 chunks from Vector Search, and passes them as context to `gemini-2.0-pro` with guardrails. The prompt explicitly forbids legal advice and uses a fallback message when context is insufficient.

Supporting files:
- `gcp_setup.sh` — Creates and configures the GCS bucket (public access blocked, versioning enabled, `labeled/` subfolder).
- `label_studio_setup.md` — Instructions for the labeling step between crawling and indexing.
- `documents/` — Business/legal documents (intake checklist, launch requirements, pilot offer).
- `website/` — Next.js 14 marketing site (React 18, Tailwind CSS, TypeScript).

## Commands

### Python pipeline (from project root)
```bash
pip install -r requirements.txt
python crawler.py    # Stage 1: crawl URLs
python index.py      # Stage 2: chunk, embed, index
python query.py      # Stage 3: interactive Q&A
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
- `VERTEX_AI_INDEX_ID`, `VERTEX_AI_INDEX_ENDPOINT_ID` — output by index.py, required by query.py
- `LABEL_STUDIO_URL`, `LABEL_STUDIO_API_KEY` — optional, for Label Studio API automation

## Key Design Decisions

- **Embedding model consistency**: Both indexing (`RETRIEVAL_DOCUMENT`) and querying (`RETRIEVAL_QUERY`) must use `text-embedding-005`. Changing one without the other silently breaks retrieval.
- **Guardrails in query.py**: The Gemini prompt explicitly forbids legal advice, eligibility determinations, and case assessments. The `FALLBACK_MESSAGE` constant is returned when context is insufficient. These guardrails are critical for the legal domain.
- **chunk_mapping.json**: Vector Search only stores IDs and vectors. This JSON file (stored in GCS, cached locally) maps chunk IDs back to text, source file, and labels. It's the bridge between retrieval and generation.

## Obsidian Knowledge Base

The `proceedings-obsidian/` folder contains an Obsidian vault with detailed analysis of every file in the project. See `proceedings-obsidian/CLAUDE.md` for the full index. When you need deeper context about any script, component, or business document, read the corresponding note in that directory.
