# Obsidian Vault Context

This folder is the Obsidian knowledge base for the Proceedings project. When working on any part of the project, reference these notes for detailed context.

## Vault Index

### Architecture & Deployment
- `Proceedings — Project Overview.md` — Full architecture, tech stack, pipeline diagram, design decisions
- `Deployment.md` — Cloud Run (API) and Vercel (website) deployment details, URLs, env vars

### Pipeline Scripts
- `discover_urls.py.md` — URL auto-discovery via web search and seed lists
- `crawler.py.md` — Firecrawl crawling with metadata frontmatter, registry-based, resumable
- `pipeline.py.md` — Full pipeline orchestrator: crawl → auto-label → incremental index
- `auto_label.py.md` — Gemini auto-labeling (label categories, workflow)
- `Label Studio Setup.md` — Manual labeling on GCP VM (infrastructure, storage config)
- `index.py.md` — Chunking, embedding, vector indexing (incremental mode)
- `query.py.md` — RAG query engine with Firestore Q&A logging and feedback
- `api.py.md` — FastAPI server on Cloud Run (endpoints, CORS, rate limiting)

### Infrastructure
- `GCP Setup.md` — Bucket provisioning script (project ID, bucket config)
- `Website.md` — Next.js site on Vercel (pages including /ask, components, commands)

### Business Documents
- `Business Documents.md` — Client-facing documents index
- `Data Intake Checklist.md` — Client onboarding form (12 sections)
- `Launch Requirements.md` — V1 vs Later prioritization
- `Pilot Offer.md` — 30-day pilot one-pager ($750 pilot, $300-500/mo ongoing)

## How to Use

When you need detailed context about a specific script, component, or business document, read the corresponding `.md` file in this directory. Each note contains function-level breakdowns, data flows, dependencies, and relationships to other parts of the project.
