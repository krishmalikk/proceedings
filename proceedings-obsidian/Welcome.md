# Proceedings Vault

Start here: **[[Proceedings — Project Overview]]**

---

## Pipeline Scripts
- [[discover_urls.py]] — Stage 0: Auto-discover immigration law firm URLs
- [[crawler.py]] — Stage 1: Web crawling via Firecrawl with metadata
- [[pipeline.py]] — Orchestrator: crawl → auto-label → incremental index
- [[auto_label.py]] — Stage 2: Automated labeling via Gemini
- [[Label Studio Setup]] — Stage 2: Manual labeling on GCP VM
- [[index.py]] — Stage 3: Chunking, embedding, vector indexing (incremental)
- [[query.py]] — Stage 4: RAG query engine with guardrails + Firestore logging
- [[api.py]] — FastAPI server exposing RAG as HTTP endpoints

## Infrastructure
- [[Deployment]] — Cloud Run (API) + Vercel (website)
- [[GCP Setup]] — Bucket provisioning script
- [[Website]] — Next.js site with `/ask` Q&A page

## Business
- [[Business Documents]] — All client-facing documents
- [[Data Intake Checklist]] — Client onboarding form
- [[Launch Requirements]] — V1 vs Later prioritization
- [[Pilot Offer]] — 30-day pilot one-pager ($750)
