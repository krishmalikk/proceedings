# pipeline.py

**Type:** Pipeline orchestrator
**Location:** `/pipeline.py`

---

## Purpose

Runs the full pipeline without Label Studio in the critical path: crawl, auto-label via Gemini, and incrementally index.

---

## Stages

| Stage | What It Does | Can Skip? |
|-------|-------------|-----------|
| 1. Crawl | Runs [[crawler.py]] for pending URLs in registry | `--skip-crawl` |
| 2. Label | Auto-classifies each crawled file using Gemini 2.5 Flash via Vertex AI | `--skip-label` |
| 3. Index | Runs [[index.py]] in incremental mode (upserts to existing index) | `--skip-index` |

---

## Auto-Labeling Details

- Uses `genai.Client(vertexai=True)` — bills through GCP, no free tier limits
- Classifies into 6 categories: visa-info, eligibility, process, fees, timeline, other
- Uploads Label Studio-compatible annotation JSON to `gs://bucket/labeled/`
- Skips already-labeled files (checks GCS)
- 4-second delay between Gemini calls for rate limiting

---

## Usage

```bash
python pipeline.py                # Full pipeline
python pipeline.py --skip-crawl   # Just label + index
python pipeline.py --skip-label   # Just index existing labeled files
```

---

## Related

- Calls [[crawler.py]] and [[index.py]] as subprocesses
- Labeling logic adapted from [[auto_label.py]] but uses Vertex AI instead of API key
