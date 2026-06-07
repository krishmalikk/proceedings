# legacy/ — archived prototype (NOT deployed, NOT maintained)

This folder holds the **retired first-generation prototype**: the
Firecrawl → label → self-managed Vertex AI **Vector Search** pipeline, plus the
Label-Studio labeling agent. None of it is imported by the live service
(`api.py`, `query.py`, `search_client.py`, `posting.py`, `profile.py`,
`reconcile.py`) or shipped in the `Dockerfile`. It is kept for reference /
possible future reuse (e.g. `crawler.py` as a Firecrawl non-API adapter), not
run in production.

Why it was retired: the grounding stack moved to the **managed Discovery Engine
datastore + Search/Answer API** (MEMORY.md **D-016 / D-034 / D-039**), and the
self-managed Vector Search index was decommissioned (**D-040**). Archived under
`legacy/` in **D-046**.

| File | What it was |
|---|---|
| `crawler.py` | Firecrawl crawler (`urls.txt` → Markdown → GCS). Retained as the basis for a future Firecrawl non-API channel adapter. |
| `agent_crawl.py`, `continuous_crawl.py`, `discover_urls.py` | Crawl orchestration / URL discovery for the old pipeline. |
| `auto_label.py`, `agent_label.py`, `prepare_labeled_data.py` | Old labeling / data-prep steps. |
| `labeling_agent/` + `test_labeling.py` | The Label-Studio / Agent-Engine labeling agent + its test. |
| `pipeline.py`, `deploy_agent.py`, `monitor_qa.py` | Old end-to-end pipeline, agent deploy, QA monitor. |
| `json_pydantic_schema.py` | An early standalone Pydantic schema (superseded; the live vocab is `tags-cleaned/` + the canonical builders in `posting.py`). |
| `urls.txt`, `url_registry.json` | Crawl input list + URL registry for the old pipeline. |

If you need any of this again, it lives in git history regardless; this folder
just keeps it out of the live tree.
