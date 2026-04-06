# continuous_crawl.py

**Type:** Continuous pipeline runner
**Location:** `/continuous_crawl.py`

---

## Purpose

Runs the full pipeline (discover → crawl → label → index) in a loop, continuously expanding the knowledge base until stopped with Ctrl+C.

---

## How It Works

Each round:
1. **Discover** — Adds 5 curated URLs from rotating batches (10 batches covering all immigration topics)
2. **Crawl** — Downloads each URL with trafilatura
3. **Label** — Classifies with local ImmigrationLabelingAgent (47 categories)
4. **Upload** — Saves to GCS crawled/ and labeled/
5. **Index** — Runs incremental `index.py` to upsert new chunks
6. **Restart API** — Kills and restarts uvicorn to load new chunk mapping
7. **Wait 30s** — Pause before next round

---

## URL Batches (10 rotating)

| Batch | Topics |
|-------|--------|
| 0 | USCIS additional pages (P-1, R-1, special immigrants, adoption) |
| 1 | Immigration law firm blogs (Murthy, WeGreened, CitizenPath) |
| 2 | VisaGuide additional (TN, E-2, E-1, exchange visitor, diversity) |
| 3 | Government resources (military, EB-5, study, tourism visas) |
| 4 | Nolo additional (asylum, family, undocumented, adjustment) |

---

## Usage

```bash
python continuous_crawl.py    # Runs until Ctrl+C
```

---

## Related

- Combines [[agent_crawl.py]] crawling + [[agent_label.py]] labeling + [[index.py]] indexing
- Uses [[labeling_agent]] locally (no Agent Engine round-trip for speed)
