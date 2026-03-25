# Proceedings — Project Overview

**Type:** RAG (Retrieval-Augmented Generation) pipeline for legal intake
**Domain:** Immigration law
**Status:** Deployed — API on Cloud Run, website on Vercel

---

## What It Does

Proceedings is an AI-powered legal intake assistant that crawls government and law firm websites, labels the content, indexes it into a vector database, and answers prospective client questions — with strict guardrails against providing legal advice.

The business model is a **consulting service** sold to law firms: a 30-day pilot at $750, then $300–$500/month ongoing.

---

## Architecture

```
discover_urls.py → url_registry.json → crawler.py → crawled_pages/ → GCS /crawled/
                                                                          ↓
                                                              pipeline.py (auto-label via Gemini)
                                                                          ↓
                                                              GCS /labeled/ subfolder
                                                                          ↓
                                                                     index.py (incremental)
                                                          (chunk → embed → vector index)
                                                                          ↓
                                                   Vertex AI Vector Search + chunk_mapping.json
                                                                          ↓
                          User → Vercel (Next.js /ask) → Cloud Run (api.py) → query.py
                                                                          ↓
                                                          Gemini 2.5 Flash → answer
                                                                          ↓
                                                              Firestore (Q&A storage)
```

---

## Pipeline Stages

| Stage | Script | What It Does |
|-------|--------|--------------|
| 0. Discover | [[discover_urls.py]] | Auto-finds immigration law firm URLs via web search and seed lists |
| 1. Crawl | [[crawler.py]] | Reads from `url_registry.json`, scrapes via Firecrawl, adds YAML frontmatter, uploads to GCS |
| 2. Label | [[pipeline.py]] / [[auto_label.py]] | Auto-labels content via Gemini 2.5 Flash (Vertex AI). Label Studio available for manual review |
| 3. Index | [[index.py]] | Downloads labeled data, chunks into ~512 tokens, embeds with `text-embedding-005`, upserts to Vector Search (incremental) |
| 4. Serve | [[api.py]] → [[query.py]] | FastAPI on Cloud Run: embeds question, retrieves top-5 chunks, generates answer via Gemini 2.5 Flash, saves Q&A to Firestore |
| 5. Frontend | [[Website]] `/ask` page | Next.js on Vercel: ask form, answer display, source citations, feedback, recent Q&A |

**Full pipeline command:** `python pipeline.py` (runs stages 1-3 end to end)

---

## Key Relationships

- [[discover_urls.py]] populates `url_registry.json` for [[crawler.py]]
- [[crawler.py]] feeds into [[pipeline.py]] (auto-label + index) or [[Label Studio Setup]] (manual)
- [[pipeline.py]] orchestrates crawl → label → index without manual steps
- [[index.py]] supports incremental mode (detects existing index from `.env`)
- [[api.py]] imports from [[query.py]] and serves the [[Website]] frontend
- [[query.py]] uses Gemini 2.5 Flash via Vertex AI (paid, no rate limits) and logs Q&A to Firestore
- [[GCP Setup]] provisions the storage bucket all scripts share
- [[Deployment]] covers Cloud Run (API) and Vercel (website)
- [[Business Documents]] define the client-facing offer and onboarding process

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Crawling | Firecrawl API |
| Storage | Google Cloud Storage |
| Labeling | Label Studio (self-hosted on GCP VM) |
| Auto-labeling | Gemini 2.5 Flash (Vertex AI) |
| Embeddings | Vertex AI `text-embedding-005` (768-dim) |
| Vector DB | Vertex AI Vector Search (Tree-AH, DOT_PRODUCT) |
| Generation | Gemini 2.5 Flash (Vertex AI) |
| API server | FastAPI on Cloud Run |
| Q&A storage | Firestore (`qa_pairs` collection) |
| Website | Next.js 14 on Vercel, React 18, Tailwind CSS, TypeScript |
| Language | Python 3 (pipeline + API), TypeScript (website) |

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
