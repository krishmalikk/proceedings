# Proceedings — Project Overview

**Type:** RAG (Retrieval-Augmented Generation) pipeline for legal intake
**Domain:** US immigration law
**Status:** Deployed — API on Cloud Run, website on Vercel
**Fallback rate:** ~10% (down from 54.5%)

---

## What It Does

Proceedings is an AI-powered immigration law Q&A platform that crawls government and law firm websites, labels content with a 20-category immigration taxonomy using a Vertex AI Agent Engine agent, indexes it into a vector database, and answers user questions — with strict guardrails against providing legal advice.

---

## Architecture

```
discover_urls.py → url_registry.json → agent_crawl.py (Firecrawl) → crawled_pages/ → GCS /crawled/
                                                                           ↓
                                                           agent_label.py (Agent Engine / Gemini 2.5 Flash)
                                                                           ↓
                                                                 GCS /labeled/ (20 immigration categories)
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
| 1. Crawl | [[agent_crawl.py]] | Scrapes URLs via Firecrawl (JS rendering), adds YAML frontmatter, uploads to GCS |
| 2. Label | [[agent_label.py]] | Classifies content into 20 immigration categories via Agent Engine (Gemini 2.5 Flash) |
| 3. Index | [[index.py]] | Downloads labeled data, chunks into ~512 tokens, embeds with `text-embedding-005`, upserts to Vector Search (incremental) |
| 4. Serve | [[api.py]] → [[query.py]] | FastAPI on Cloud Run: embeds question, retrieves top-5 chunks, generates answer via Gemini 2.5 Flash, saves Q&A to Firestore |
| 5. Frontend | [[Website]] `/ask` page | Next.js on Vercel: ask form, category pills, popular questions, source citations, feedback, recent Q&A |
| Auto | [[continuous_crawl.py]] | Runs stages 0-3 in a loop |

**Full pipeline:** `python pipeline.py`

---

## Current Stats

| Metric | Value |
|--------|-------|
| URLs registered | 231 |
| Pages crawled | 181+ |
| Chunks indexed | 725 |
| Label categories | 20 (immigration-only) |
| Fallback rate | ~10% |
| Unique domains | 20+ |
| Test accuracy | 9/10 questions answered |

---

## Taxonomy (20 Immigration Categories)

h1b-visa, family-based-immigration, asylum-refugees, naturalization-citizenship, daca, employment-green-cards, eb5-investor-visa, student-visas, temporary-work-visas, diversity-visa-lottery, deportation-defense, humanitarian-parole, tps, visa-fees-filing, consular-processing, adjustment-of-status, travel-documents, work-authorization, immigration-court, general-immigration-info

Defined in [[labeling_agent]].

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Crawling | Firecrawl API (JS rendering) |
| Storage | Google Cloud Storage |
| Labeling | Vertex AI Agent Engine (Gemini 2.5 Flash) |
| Embeddings | Vertex AI `text-embedding-005` (768-dim) |
| Vector DB | Vertex AI Vector Search (Tree-AH, DOT_PRODUCT) |
| Generation | Gemini 2.5 Flash (Vertex AI) |
| API server | FastAPI on Cloud Run |
| Q&A storage | Firestore (`qa_pairs` collection) |
| Website | Next.js 14 on Vercel, React 18, Tailwind CSS, TypeScript |

---

## Key Design Decisions

1. **Embedding model consistency** — Both indexing (`RETRIEVAL_DOCUMENT`) and querying (`RETRIEVAL_QUERY`) must use `text-embedding-005`.
2. **Guardrails** — Gemini prompt allows factual eligibility info but blocks case-specific legal advice. Improved fallback detection catches paraphrased refusals.
3. **Junk chunk filtering** — 404 pages, boilerplate, navigation removed during indexing (~70 filtered per run).
4. **Firecrawl over trafilatura** — Firecrawl renders JavaScript, enabling crawling of law firm sites that trafilatura couldn't handle.
5. **Immigration-only taxonomy** — 20 focused categories instead of 47 broad US law categories for better classification accuracy.
