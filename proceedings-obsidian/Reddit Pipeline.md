# Reddit Pipeline

**Branch:** `reddit-scraping`
**Status:** Active — ingesting from 52 immigration subreddits

---

## Architecture

```
subreddits.txt → reddit_ingest.py → orchestrator/agent.py
                                          ↓
                              Reddit JSON API (discover posts)
                                          ↓
                              Scrape each post (title + body + top 10 comments)
                                          ↓
                              Write .md to GCS raw/YYYY/MM/DD/
                                          ↓
                              Label with Gemini (39 categories)
                                          ↓
                              Return {url, gcs_path, raw_text, labels}
```

---

## Components

| Component | File | Description |
|-----------|------|-------------|
| **CLI** | [[reddit_ingest.py]] | Entry point — per-sub loop, checkpointing, resume |
| **Orchestrator Agent** | `orchestrator/agent.py` | Discovers posts, scrapes, labels. Deployed to Agent Engine |
| **Cloud Run Scraper** | `scraper/main.py` | Firecrawl-based scraper for non-Reddit URLs |
| **Subreddits list** | `subreddits.txt` | 52 subreddits, version-controlled, comment-supported |

---

## How It Works

1. **reddit_ingest.py** reads subreddits from `subreddits.txt` (or `--subreddits` flag)
2. Processes **one subreddit at a time** with `[i/N] r/<sub>` progress
3. For each sub, the orchestrator agent:
   - Calls Reddit's JSON API (`old.reddit.com/r/<sub>/<sort>.json`)
   - Fetches posts sorted by `new`, `hot`, and/or `top`
   - Deduplicates across sort modes by post ID
4. For each post, extracts: title, body (selftext), author, score, top 10 comments
5. Writes Markdown to GCS: `gs://law-firm-knowledge-base/raw/YYYY/MM/DD/reddit-r-<sub>-<id>.md`
6. Labels content with Gemini using 39-category immigration taxonomy
7. Checkpoints after each subreddit (atomic JSON write, survives Ctrl+C)

---

## GCS Storage Structure

```
gs://law-firm-knowledge-base/
├── raw/
│   └── 2026/
│       └── 04/
│           └── 19/
│               ├── reddit-r-h1b-1sprtsp.md
│               ├── reddit-r-immigration-1spsfmy.md
│               ├── reddit-r-uscis-1sptx3f.md
│               └── ...
├── crawled/    (website crawls — existing)
├── labeled/    (annotation JSONs — existing)
└── chunk_mapping.json
```

---

## Markdown File Format

Each Reddit post is saved as:

```markdown
---
source_url: https://old.reddit.com/r/h1b/comments/1sprtsp/h1b_transfer_confused/
subreddit: r/h1b
author: u/Usual_General5208
score: 15
crawled_at: 2026-04-19T14:15:13.504859+00:00
---

# H1b transfer confused.

**Subreddit:** r/h1b | **Author:** u/Usual_General5208 | **Score:** 15

Post body text here...

---

## Top Comments

**u/Away_Cancel_5208** (score: 5):
Comment text here...

**u/another_user** (score: 3):
Another comment...
```

---

## CLI Usage

```bash
# Default: 52 subs from file, 50 posts each, new+top
./venv/bin/python3 reddit_ingest.py --subreddits-file subreddits.txt

# With checkpointing (resume on crash)
./venv/bin/python3 reddit_ingest.py --subreddits-file subreddits.txt \
  --checkpoint state.json

# Resume interrupted run
./venv/bin/python3 reddit_ingest.py --subreddits-file subreddits.txt \
  --checkpoint state.json --resume

# Bulk top-of-all-time ingestion
./venv/bin/python3 reddit_ingest.py --subreddits-file subreddits.txt \
  --sort top --posts-per-sub 100 --output results.json

# Quick daily new posts
./venv/bin/python3 reddit_ingest.py --sort new --posts-per-sub 10

# Specific subreddits
./venv/bin/python3 reddit_ingest.py --subreddits h1b,immigration,USCIS
```

---

## Key Features

- **Error isolation** — one bad subreddit doesn't kill the run
- **Checkpointing** — atomic writes, survives Ctrl+C, `--resume` to continue
- **Deduplication** — same post from different sort modes only scraped once
- **Rate limiting** — `--sleep` between subs (default 2s), 1s between Reddit API calls
- **Reddit JSON API** — no Firecrawl needed (Firecrawl doesn't support Reddit)
- **Truncated output** — sample successes/failures + label distribution summary
