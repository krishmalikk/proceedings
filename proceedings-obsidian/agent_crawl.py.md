# agent_crawl.py

**Type:** Web crawling script (replaces Firecrawl)
**Location:** `/agent_crawl.py`

---

## Purpose

Crawls pending URLs from `url_registry.json` using Firecrawl API with JavaScript rendering for clean Markdown extraction.

---

## How It Works

1. Loads pending URLs from `url_registry.json`
2. For each URL, uses Firecrawl API to scrape and convert to Markdown
3. Adds YAML frontmatter (source_url, domain, source_type, category, crawled_at)
4. Saves to `crawled_pages/` and uploads to `gs://bucket/crawled/`
5. Updates registry status (done/failed/skipped)

---

## Key Details

- **Firecrawl** — Renders JavaScript, handles dynamic law firm sites
- Content quality filter: skips pages with < 200 chars
- Domain-aware rate limiting: 3s same-domain, 1s between domains
- Resumable: tracks status in registry
- Requires `FIRECRAWL_API_KEY` in `.env`

---

## Usage

```bash
python agent_crawl.py              # Crawl pending URLs
python agent_crawl.py --extract-only  # Skip crawl trigger
```

---

## Related

- Replaces [[crawler.py]] (original version)
- Output consumed by [[agent_label.py]] and [[index.py]]
- Called by [[pipeline.py]] stage 1 and [[continuous_crawl.py]]
