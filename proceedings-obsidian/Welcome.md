# Proceedings Vault

Start here: **[[Proceedings — Project Overview]]**

---

## Pipeline Scripts
- [[discover_urls.py]] — Stage 0: Auto-discover immigration law firm URLs
- [[agent_crawl.py]] — Stage 1: Web crawling via trafilatura (replaced Firecrawl)
- [[agent_label.py]] — Stage 2: Content labeling via Agent Engine (47 categories)
- [[labeling_agent]] — Agent package: taxonomy + ImmigrationLabelingAgent class
- [[pipeline.py]] — Orchestrator: crawl → label → index
- [[continuous_crawl.py]] — Continuous mode: discover → crawl → label → index in a loop
- [[index.py]] — Stage 3: Chunking, embedding, vector indexing (incremental)
- [[query.py]] — Stage 4: RAG query engine with guardrails + Firestore logging
- [[api.py]] — FastAPI server exposing RAG as HTTP endpoints

## Reddit Pipeline (branch: reddit-scraping)
- [[Reddit Pipeline]] — Architecture, components, CLI usage, GCS storage
- [[Subreddits]] — 52 immigration subreddits being crawled with descriptions
- [[Expanded Taxonomy]] — 39 categories (11 visa, 9 green card, 12 process, 7 H-1B specific)

## Legacy (kept for reference)
- [[crawler.py]] — Original Firecrawl-based crawler (replaced by agent_crawl.py)
- [[auto_label.py]] — Original Gemini labeling (replaced by agent_label.py)
- [[Label Studio Setup]] — Manual labeling on GCP VM

## Infrastructure
- [[Deployment]] — Cloud Run (API) + Vercel (website) + Agent Engine
- [[Statistics & Analytics]] — Chunks, labels, Q&A performance, quality timeline
- [[GCP Setup]] — Bucket provisioning script
- [[Website]] — Next.js site with `/ask` Q&A page

## Business
- [[Business Documents]] — All client-facing documents
- [[Data Intake Checklist]] — Client onboarding form
- [[Launch Requirements]] — V1 vs Later prioritization
- [[Pilot Offer]] — 30-day pilot one-pager ($750)
