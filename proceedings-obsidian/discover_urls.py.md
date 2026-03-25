# discover_urls.py

**Type:** URL discovery script
**Location:** `/discover_urls.py`

---

## Purpose

Auto-discovers immigration law firm URLs for crawling. Searches the web for FAQ pages, practice area pages, and blog posts, then adds them to `url_registry.json`.

---

## Discovery Methods

1. **Seed URLs** — 12 hardcoded high-value pages (USCIS additional pages, State Dept, DOL, ILRC, AILA)
2. **Google Custom Search** — 15 search queries targeting immigration law firm content (requires `GOOGLE_SEARCH_API_KEY` + `GOOGLE_SEARCH_ENGINE_ID`)

---

## URL Classification

Each discovered URL is automatically classified by:
- **source_type**: `government`, `organization`, or `law_firm`
- **category**: `green-card`, `work-visas`, `family-immigration`, `humanitarian`, `citizenship`, `faq`, or `general`

---

## Output

Appends to [[url_registry.json]] with `status: "pending"` for [[crawler.py]] to pick up.

---

## Usage

```bash
python discover_urls.py                # Default: up to 50 results
python discover_urls.py --max-results 100
```
