# crawler.py

**Stage:** 1 — Crawling
**Lines:** ~240
**Location:** `/crawler.py`

---

## Purpose

Reads URLs from `url_registry.json` (or legacy `urls.txt`), crawls via Firecrawl API, adds YAML frontmatter with metadata, filters low-quality content, saves locally and uploads to GCS.

---

## Functions

| Function | Description |
|----------|-------------|
| `load_url_registry()` | Reads pending URLs from `url_registry.json` |
| `update_registry_entry(url, status)` | Updates status/last_crawled in registry (resumable) |
| `load_urls_legacy()` | Fallback: reads from `urls.txt` (`--legacy` flag) |
| `url_to_filename(url)` | Converts a URL to a safe filename |
| `crawl_url(app, url)` | Scrapes a single URL with retries (exponential backoff) |
| `add_frontmatter(content, entry)` | Prepends YAML frontmatter (source_url, domain, source_type, crawled_at) |
| `is_content_useful(content)` | Filters pages with < 200 chars of real content |
| `save_markdown(content, filename)` | Writes Markdown to `crawled_pages/` directory |
| `upload_to_gcs(local_dir, bucket_name)` | Uploads `.md` files to `gs://bucket/crawled/` |
| `main()` | Orchestrates crawl with domain-aware rate limiting |

---

## Data Flow

```
url_registry.json → Firecrawl API → add frontmatter → crawled_pages/*.md → GCS /crawled/
```

---

## Dependencies

- `firecrawl-py` — Web scraping API client
- `google-cloud-storage` — GCS uploads
- `python-dotenv` — Environment variable loading

---

## Env Vars Required

- `FIRECRAWL_API_KEY`
- `GCP_BUCKET_NAME` (default: `law-firm-knowledge-base`)

---

## Currently Crawled (45 pages)

**Government (USCIS, State Dept, DOL):** Green card (general, eligibility, processes, marriage, employment, family preference), H-1B, OPT, STEM OPT, O-1, L-1A, citizenship, naturalization, DACA, TPS, humanitarian parole, asylum, permanent workers, visa fees, diversity visa, immigrant visa process, forms, priority dates

**Law firm resources:** Boundless (green card, H-1B, marriage, citizenship guides), Nolo (green card, marriage visa, asylum FAQ), VisaGuide (H-1B, green card)

---

## Notes

- Retries up to 3 times per URL with exponential backoff
- Domain-aware rate limiting: 3s same-domain, 1s between domains
- Resumable: tracks status in registry, skips already-done URLs
- Content filtering: skips pages with < 200 chars of real content
- YAML frontmatter on each file for source tracking
- Output feeds into [[pipeline.py]] or [[Label Studio Setup]]
