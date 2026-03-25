# Proceedings — Project Overview

**Type:** RAG (Retrieval-Augmented Generation) pipeline for legal intake
**Domain:** Immigration law
**Status:** Early stage / pre-launch

---

## What It Does

Proceedings is an AI-powered legal intake assistant that crawls government and law firm websites, labels the content, indexes it into a vector database, and answers prospective client questions — with strict guardrails against providing legal advice.

The business model is a **consulting service** sold to law firms: a 30-day pilot at $750, then $300–$500/month ongoing.

---

## Architecture

```
urls.txt → crawler.py → crawled_pages/ → GCS bucket
                                             ↓
                                   Label Studio (GCP VM)
                                             ↓
                                   GCS /labeled/ subfolder
                                             ↓
                                        index.py
                               (chunk → embed → vector index)
                                             ↓
                              Vertex AI Vector Search + chunk_mapping.json
                                             ↓
                                        query.py
                              (embed query → retrieve → Gemini Pro → answer)
```

---

## Pipeline Stages

| Stage | Script | What It Does |
|-------|--------|--------------|
| 1. Crawl | [[crawler.py]] | Reads URLs from `urls.txt`, scrapes via Firecrawl API, saves Markdown locally and to GCS |
| 2. Label | [[Label Studio Setup]] + [[auto_label.py]] | Content is labeled in Label Studio (hosted on GCP VM) or auto-labeled via Gemini |
| 3. Index | [[index.py]] | Downloads labeled data from GCS, chunks into ~512 tokens, embeds with `text-embedding-005`, creates Vertex AI Vector Search index |
| 4. Query | [[query.py]] | Interactive CLI: embeds question, retrieves top-5 chunks, generates answer via `gemini-2.0-pro` with guardrails |

---

## Key Relationships

- [[crawler.py]] feeds into [[Label Studio Setup]]
- [[auto_label.py]] automates the labeling step using Gemini
- [[index.py]] consumes labeled output and produces the vector index + `chunk_mapping.json`
- [[query.py]] depends on both the vector index and `chunk_mapping.json`
- [[GCP Setup]] provisions the storage bucket all scripts share
- The [[Website]] is a separate Next.js marketing site for the consulting service
- [[Business Documents]] define the client-facing offer and onboarding process

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Crawling | Firecrawl API |
| Storage | Google Cloud Storage |
| Labeling | Label Studio (self-hosted on GCP VM) |
| Auto-labeling | Gemini 2.5 Flash |
| Embeddings | Vertex AI `text-embedding-005` (768-dim) |
| Vector DB | Vertex AI Vector Search (Tree-AH, DOT_PRODUCT) |
| Generation | Gemini 2.0 Pro |
| Website | Next.js 14, React 18, Tailwind CSS, TypeScript |
| Language | Python 3 (pipeline), TypeScript (website) |

---

## Environment Variables

Defined in `.env` (see `.env.example`):

| Variable | Used By |
|----------|---------|
| `GCP_PROJECT_ID` | All scripts |
| `GCP_REGION` | All scripts |
| `GCP_BUCKET_NAME` | All scripts |
| `FIRECRAWL_API_KEY` | crawler.py |
| `VERTEX_AI_INDEX_ID` | query.py |
| `VERTEX_AI_INDEX_ENDPOINT_ID` | query.py |
| `LABEL_STUDIO_URL` | auto_label.py |
| `LABEL_STUDIO_API_KEY` | auto_label.py |
| `GOOGLE_API_KEY` | auto_label.py |

---

## Critical Design Decisions

1. **Embedding model consistency** — Both indexing (`RETRIEVAL_DOCUMENT`) and querying (`RETRIEVAL_QUERY`) must use `text-embedding-005`. Changing one without the other silently breaks retrieval.
2. **Guardrails** — The Gemini prompt explicitly forbids legal advice, eligibility determinations, and case assessments. A `FALLBACK_MESSAGE` constant is returned when context is insufficient.
3. **chunk_mapping.json** — Vector Search only stores IDs and vectors. This JSON file (stored in GCS, cached locally) is the bridge between retrieval and generation.
