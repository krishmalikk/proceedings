# Obsidian Vault Context

This folder is the Obsidian knowledge base for the Proceedings project. When working on any part of the project, reference these notes for detailed context.

## Vault Index

- `Proceedings — Project Overview.md` — Full architecture, tech stack, pipeline diagram, env vars, design decisions
- `crawler.py.md` — Stage 1: Firecrawl crawling (functions, data flow, dependencies)
- `auto_label.py.md` — Stage 2: Gemini auto-labeling (label categories, rate limiting, workflow)
- `Label Studio Setup.md` — Stage 2: Manual labeling on GCP VM (infrastructure, storage config, template)
- `index.py.md` — Stage 3: Chunking, embedding, vector indexing (7-step pipeline, key parameters)
- `query.py.md` — Stage 4: RAG query engine (guardrails, generation config, full pipeline)
- `GCP Setup.md` — Bucket provisioning script (project ID, bucket config)
- `Website.md` — Next.js marketing site (pages, components, commands)
- `Business Documents.md` — Client-facing documents index
- `Data Intake Checklist.md` — Client onboarding form (12 sections)
- `Launch Requirements.md` — V1 vs Later prioritization
- `Pilot Offer.md` — 30-day pilot one-pager ($750 pilot, $300-500/mo ongoing)

## How to Use

When you need detailed context about a specific script, component, or business document, read the corresponding `.md` file in this directory. Each note contains function-level breakdowns, data flows, dependencies, and relationships to other parts of the project.
