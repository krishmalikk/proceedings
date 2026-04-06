# agent_crawl.py

**Type:** Web crawling script (replaces Firecrawl)
**Location:** `/agent_crawl.py`

---

## Purpose

Crawls pending URLs from `url_registry.json` using trafilatura (free, open-source HTML→text extraction). Replaces the paid Firecrawl API.

---

## How It Works

1. Loads pending URLs from `url_registry.json`
2. For each URL, uses `trafilatura.fetch_url()` + `trafilatura.extract()` to download and extract clean text
3. Adds YAML frontmatter (source_url, domain, source_type, crawled_at, crawled_by)
4. Saves to `crawled_pages/` and uploads to `gs://bucket/crawled/`
5. Updates registry status (done/failed/skipped)

---

## Key Details

- **trafilatura** — Open-source, runs locally, no API key
- Content quality filter: skips pages with < 200 chars
- Domain-aware rate limiting: 3s same-domain, 1s between domains
- Resumable: tracks status in registry
- Cannot render JavaScript (limitation vs Firecrawl)

---

## Usage

```bash
python agent_crawl.py              # Crawl pending URLs
python agent_crawl.py --extract-only  # Skip crawl trigger
```

---

## Related

- Replaces [[crawler.py]] (which used Firecrawl)
- Output consumed by [[agent_label.py]] and [[index.py]]
- Called by [[pipeline.py]] stage 1 and [[continuous_crawl.py]]
