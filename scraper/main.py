"""
Cloud Run Scraper Tool — Firecrawl + Reddit JSON API + GCS
============================================================
Per Imm Specifications: Takes list of URLs, calls Firecrawl (or Reddit API),
writes .md files to GCS in time-series folders, returns {source_url, source_uri,
full_url, gcs_path, raw_text} for each URL back to the Agent.

USAGE:
  uvicorn main:app --port 8080
"""

import json
import os
import re
import ssl
import time
import urllib.request
import uuid
from datetime import datetime, timezone
from urllib.parse import urlparse

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from google.cloud import storage
from pydantic import BaseModel, Field

load_dotenv()

FIRECRAWL_API_KEY = os.getenv("FIRECRAWL_API_KEY", "")
GCS_BUCKET_NAME = os.getenv("GCS_BUCKET_NAME", os.getenv("GCP_BUCKET_NAME", "law-firm-knowledge-base"))

app = FastAPI(title="Imm Scraper Tool")


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class ScrapeRequest(BaseModel):
    urls: list[str] = Field(..., min_length=1, max_length=100)


class ScrapeResult(BaseModel):
    source_url: str       # Base domain (e.g. "https://reddit.com")
    source_uri: str       # Relative path (e.g. "r/h1b")
    full_url: str         # Full URL of the page
    gcs_path: str         # gs://bucket/raw/YYYY-MM-DD/uuid_content.md
    raw_text: str         # Full markdown content
    status: str           # "success", "failed", "skipped"
    error: str = ""


class ScrapeResponse(BaseModel):
    status: str
    data: list[ScrapeResult]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def parse_url_parts(url: str) -> tuple[str, str]:
    """Extract source_url (base domain) and source_uri (path) from a URL."""
    parsed = urlparse(url)
    base = f"{parsed.scheme}://{parsed.netloc}"
    path = parsed.path.strip("/")
    return base, path


def get_gcs_path(bucket_name: str) -> tuple[str, str]:
    """Generate GCS blob name and full gs:// path with date folder + UUID."""
    now = datetime.now(timezone.utc)
    date_folder = now.strftime("%Y-%m-%d")
    file_id = str(uuid.uuid4())[:8]
    blob_name = f"raw/{date_folder}/{file_id}_content.md"
    gcs_path = f"gs://{bucket_name}/{blob_name}"
    return blob_name, gcs_path


def is_reddit_url(url: str) -> bool:
    """Check if URL is a Reddit URL."""
    parsed = urlparse(url)
    return "reddit.com" in parsed.netloc


def scrape_reddit_post(url: str) -> tuple[str, dict]:
    """Scrape a Reddit post using the JSON API. Returns (markdown, metadata)."""
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    # Normalize URL for JSON API
    clean_url = url.rstrip("/")
    if not clean_url.endswith(".json"):
        json_url = clean_url + ".json"
    else:
        json_url = clean_url

    req = urllib.request.Request(json_url, headers={
        "User-Agent": "proceedings-bot/1.0 (immigration research)"
    })

    with urllib.request.urlopen(req, timeout=15, context=ctx) as resp:
        data = json.loads(resp.read().decode())

    post_data = data[0]["data"]["children"][0]["data"]
    title = post_data.get("title", "")
    selftext = post_data.get("selftext", "")
    author = post_data.get("author", "")
    subreddit = post_data.get("subreddit", "")
    score = post_data.get("score", 0)
    created_utc = post_data.get("created_utc", 0)

    # Extract top comments
    comments = []
    if len(data) > 1:
        for comment in data[1]["data"]["children"][:10]:
            if comment.get("kind") == "t1":
                body = comment["data"].get("body", "")
                c_author = comment["data"].get("author", "")
                c_score = comment["data"].get("score", 0)
                if body and len(body) > 20:
                    comments.append(f"**u/{c_author}** (score: {c_score}):\n{body}")

    # Build markdown
    md_parts = [f"# {title}\n"]
    md_parts.append(f"**Subreddit:** r/{subreddit} | **Author:** u/{author} | **Score:** {score}\n")
    if selftext:
        md_parts.append(f"\n{selftext}\n")
    if comments:
        md_parts.append(f"\n---\n\n## Top Comments\n")
        for c in comments:
            md_parts.append(f"\n{c}\n")

    markdown = "\n".join(md_parts)

    metadata = {
        "subreddit": subreddit,
        "author": author,
        "score": score,
        "created_utc": created_utc,
        "num_comments": len(comments),
    }

    return markdown, metadata


def scrape_with_firecrawl(url: str, max_retries: int = 3) -> str | None:
    """Scrape a non-Reddit URL via Firecrawl API."""
    from firecrawl import FirecrawlApp
    fc = FirecrawlApp(api_key=FIRECRAWL_API_KEY)

    for attempt in range(max_retries):
        try:
            result = fc.scrape(url, formats=["markdown"])
            markdown = result.markdown or ""
            if markdown and len(markdown.strip()) >= 100:
                return markdown
            return None
        except Exception as e:
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)
            else:
                raise e
    return None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.post("/scrape", response_model=ScrapeResponse)
async def scrape_urls(body: ScrapeRequest):
    """Scrape list of URLs, write .md to GCS, return results for Agent."""
    gcs_client = storage.Client()
    bucket = gcs_client.bucket(GCS_BUCKET_NAME)

    results = []

    for i, url in enumerate(body.urls):
        source_url, source_uri = parse_url_parts(url)
        blob_name, gcs_path = get_gcs_path(GCS_BUCKET_NAME)

        try:
            # Scrape based on URL type
            if is_reddit_url(url):
                markdown, metadata = scrape_reddit_post(url)
                source_metadata = json.dumps(metadata)
            else:
                if not FIRECRAWL_API_KEY:
                    results.append(ScrapeResult(
                        source_url=source_url, source_uri=source_uri,
                        full_url=url, gcs_path="", raw_text="",
                        status="failed", error="FIRECRAWL_API_KEY not set"
                    ))
                    continue
                markdown = scrape_with_firecrawl(url)
                source_metadata = ""

            if not markdown or len(markdown.strip()) < 100:
                results.append(ScrapeResult(
                    source_url=source_url, source_uri=source_uri,
                    full_url=url, gcs_path="", raw_text="",
                    status="skipped", error="Content too short or empty"
                ))
                continue

            # Add frontmatter
            now = datetime.now(timezone.utc).isoformat()
            content = f"---\nsource_url: {url}\ncrawled_at: {now}\n---\n\n{markdown}"

            # Write to GCS
            blob = bucket.blob(blob_name)
            blob.upload_from_string(content, content_type="text/markdown")

            results.append(ScrapeResult(
                source_url=source_url,
                source_uri=source_uri,
                full_url=url,
                gcs_path=gcs_path,
                raw_text=markdown,
                status="success",
            ))

        except Exception as e:
            results.append(ScrapeResult(
                source_url=source_url, source_uri=source_uri,
                full_url=url, gcs_path="", raw_text="",
                status="failed", error=str(e)[:200]
            ))

        # Rate limit
        if i < len(body.urls) - 1:
            time.sleep(1)

    return ScrapeResponse(status="success", data=results)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "imm-scraper-tool"}
