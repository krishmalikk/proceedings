# Proceedings — Project Overview

**Type:** RAG (Retrieval-Augmented Generation) pipeline for legal intake
**Domain:** US law, focused on immigration
**Status:** Deployed — API on Cloud Run, website on Vercel, continuous crawl running

---

## What It Does

Proceedings is an AI-powered legal Q&A platform that crawls government and law firm websites, labels content with a 47-category taxonomy using a Vertex AI Agent Engine agent, indexes it into a vector database, and answers user questions — with strict guardrails against providing legal advice.

---

## Architecture

```
discover_urls.py → url_registry.json → agent_crawl.py (trafilatura) → crawled_pages/ → GCS /crawled/
                                                                              ↓
                                                          agent_label.py (Agent Engine / Gemini 2.5 Flash)
                                                                              ↓
                                                                    GCS /labeled/ (47 categories)
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
| 1. Crawl | [[agent_crawl.py]] | Scrapes URLs via trafilatura (free, open-source), adds YAML frontmatter, uploads to GCS |
| 2. Label | [[agent_label.py]] | Classifies content into 47 categories via Vertex AI Agent Engine (Gemini 2.5 Flash) |
| 3. Index | [[index.py]] | Downloads labeled data, chunks into ~512 tokens, embeds with `text-embedding-005`, upserts to Vector Search (incremental) |
| 4. Serve | [[api.py]] → [[query.py]] | FastAPI on Cloud Run: embeds question, retrieves top-5 chunks, generates answer via Gemini 2.5 Flash, saves Q&A to Firestore |
| 5. Frontend | [[Website]] `/ask` page | Next.js on Vercel: ask form, answer display, source citations, feedback, recent Q&A |
| Auto | [[continuous_crawl.py]] | Runs stages 0-3 in a loop, continuously expanding the knowledge base |

**Full pipeline command:** `python pipeline.py` (runs stages 1-3 end to end)
**Continuous mode:** `python continuous_crawl.py` (runs until Ctrl+C)

---

## Key Relationships

- [[discover_urls.py]] populates `url_registry.json` for [[agent_crawl.py]]
- [[agent_crawl.py]] uses trafilatura (replaced Firecrawl) for web scraping
- [[agent_label.py]] calls the deployed Agent Engine agent or local [[labeling_agent]] for classification
- [[pipeline.py]] orchestrates crawl → label → index
- [[continuous_crawl.py]] runs the full pipeline in a loop for ongoing content expansion
- [[index.py]] supports incremental mode (detects existing index from `.env`)
- [[api.py]] imports from [[query.py]] and serves the [[Website]] frontend
- [[query.py]] uses Gemini 2.5 Flash via Vertex AI and logs Q&A to Firestore
- [[Deployment]] covers Cloud Run (API) and Vercel (website)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Crawling | trafilatura (open-source, replaced Firecrawl) |
| Storage | Google Cloud Storage |
| Labeling | Vertex AI Agent Engine (Gemini 2.5 Flash, 47 categories) |
| Embeddings | Vertex AI `text-embedding-005` (768-dim) |
| Vector DB | Vertex AI Vector Search (Tree-AH, DOT_PRODUCT) |
| Generation | Gemini 2.5 Flash (Vertex AI) |
| API server | FastAPI on Cloud Run |
| Q&A storage | Firestore (`qa_pairs` collection) |
| Website | Next.js 14 on Vercel, React 18, Tailwind CSS, TypeScript |
| Language | Python 3 (pipeline + API), TypeScript (website) |

---

## Taxonomy (47 Categories)

**20 Immigration sub-categories:** h1b-visa, family-based-immigration, asylum-refugees, naturalization-citizenship, daca, employment-green-cards, eb5-investor-visa, student-visas, temporary-work-visas, diversity-visa-lottery, deportation-defense, humanitarian-parole, tps, visa-fees-filing, consular-processing, adjustment-of-status, travel-documents, work-authorization, immigration-court, general-immigration-info

**27 Broad US law categories:** personal-injury, family-law, criminal-law, criminal-defense, business-law, corporate-law, bankruptcy-law, real-estate-law, estate-planning, trusts-estates, intellectual-property, labor-employment, tax-law, health-law, medical-malpractice, environmental-law, dui-law, elder-law, education-law, entertainment-law, cybersecurity-law, administrative-law, commercial-law, litigation, international-law, traffic-law, general-legal-info

Defined in [[labeling_agent/taxonomy.py]].

---

## Current Stats

| Metric | Value |
|--------|-------|
| URLs registered | 101+ |
| Pages crawled | 73+ |
| Unique domains | 12+ |
| Chunks indexed | 509+ (growing) |
| Label categories | 47 |
| Labels assigned | 1400+ |

---

## Critical Design Decisions

1. **Embedding model consistency** — Both indexing (`RETRIEVAL_DOCUMENT`) and querying (`RETRIEVAL_QUERY`) must use `text-embedding-005`. Changing one without the other silently breaks retrieval.
2. **Guardrails** — The Gemini prompt explicitly forbids legal advice, eligibility determinations, and case assessments. A `FALLBACK_MESSAGE` constant is returned when context is insufficient.
3. **chunk_mapping.json** — Vector Search only stores IDs and vectors. This JSON file (stored in GCS, cached locally) is the bridge between retrieval and generation.
4. **trafilatura over Firecrawl** — Free, open-source, no API key needed. Tradeoff: can't render JavaScript-heavy pages.
5. **Agent Engine for labeling** — Deployed Gemini agent with 47-category taxonomy. Can be called remotely or locally.
