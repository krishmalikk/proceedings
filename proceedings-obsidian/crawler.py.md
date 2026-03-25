# crawler.py

**Stage:** 1 — Crawling
**Lines:** 229
**Location:** `/crawler.py`

---

## Purpose

Reads URLs from `urls.txt`, crawls each one via the Firecrawl API, converts pages to clean Markdown, saves locally to `crawled_pages/`, and uploads to a GCS bucket.

---

## Functions

| Function | Description |
|----------|-------------|
| `load_urls()` | Reads URLs from `urls.txt`, skipping blanks and comments |
| `url_to_filename(url)` | Converts a URL to a safe filename (e.g., `uscis-gov-green-card.md`) |
| `crawl_url(app, url)` | Scrapes a single URL with retries (exponential backoff: 1s, 2s, 4s) |
| `save_markdown(content, filename)` | Writes Markdown to `crawled_pages/` directory |
| `upload_to_gcs(local_dir, bucket_name)` | Uploads all `.md` files from a directory to GCS |
| `main()` | Orchestrates the full crawl-and-upload pipeline |

---

## Data Flow

```
urls.txt → Firecrawl API → crawled_pages/*.md → GCS bucket (root)
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

## Currently Crawled URLs

7 pages from USCIS and State Department:
- Green card (general, eligibility, processes)
- Humanitarian (refugees and asylum)
- Working in the US (general, temporary workers)
- State Dept immigrant visas

---

## Notes

- Retries up to 3 times per URL with exponential backoff
- 1-second delay between URLs for rate limiting
- Output feeds into [[Label Studio Setup]] for content labeling
