# Obsidian Vault Context

This folder is the Obsidian knowledge base for the Proceedings project. When working on any part of the project, reference these notes for detailed context.

## Vault Index

### Architecture & Deployment
- `Proceedings — Project Overview.md` — Full architecture, tech stack, 47-category taxonomy, pipeline diagram, current stats
- `Deployment.md` — Cloud Run (API), Vercel (website), Agent Engine deployment details

### Active Pipeline Scripts
- `discover_urls.py.md` — URL auto-discovery via web search and seed lists
- `agent_crawl.py.md` — trafilatura-based web crawling (replaced Firecrawl)
- `agent_label.py.md` — Content labeling via deployed Agent Engine (47 categories)
- `labeling_agent.md` — Agent package: taxonomy (47 categories), ImmigrationLabelingAgent class
- `pipeline.py.md` — Pipeline orchestrator: crawl → label → index
- `continuous_crawl.py.md` — Continuous pipeline runner (discover → crawl → label → index in a loop)
- `index.py.md` — Chunking, embedding, vector indexing (incremental mode)
- `query.py.md` — RAG query engine with Firestore Q&A logging and feedback
- `api.py.md` — FastAPI server on Cloud Run (endpoints, CORS, rate limiting)

### Legacy Scripts (kept for reference)
- `crawler.py.md` — Original Firecrawl-based crawler
- `auto_label.py.md` — Original Gemini labeling (6 categories)
- `Label Studio Setup.md` — Manual labeling on GCP VM

### Infrastructure
- `Statistics & Analytics.md` — Full stats: chunks, labels, Q&A performance, domains, quality timeline
- `GCP Setup.md` — Bucket provisioning script
- `Website.md` — Next.js site on Vercel (pages including /ask, components)

### Business Documents
- `Business Documents.md` — Client-facing documents index
- `Data Intake Checklist.md` — Client onboarding form (12 sections)
- `Launch Requirements.md` — V1 vs Later prioritization
- `Pilot Offer.md` — 30-day pilot one-pager ($750 pilot, $300-500/mo ongoing)

## How to Use

When you need detailed context about a specific script, component, or business document, read the corresponding `.md` file in this directory. Each note contains function-level breakdowns, data flows, dependencies, and relationships to other parts of the project.
