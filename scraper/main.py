"""
Cloud Run Scraper Tool — Firecrawl + GCS
==========================================
Receives a list of URLs, scrapes each via Firecrawl API,
writes .md files to GCS in time-series folders, and returns
{url, gcs_path, raw_text, status} for each page.

Called by the Vertex AI Agent (Orchestrator).

USAGE:
  uvicorn main:app --port 8080
"""

import os
import re
import time
from datetime import datetime, timezone
from urllib.parse import urlparse

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from google.cloud import storage
from pydantic import BaseModel, Field

load_dotenv()

FIRECRAWL_API_KEY = os.getenv("FIRECRAWL_API_KEY", "")
GCP_BUCKET_NAME = os.getenv("GCP_BUCKET_NAME", "law-firm-knowledge-base")

app = FastAPI(title="Proceedings Scraper Tool")


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class ScrapeRequest(BaseModel):
    urls: list[str] = Field(..., min_length=1, max_length=50)


class ScrapeResult(BaseModel):
    url: str
    gcs_path: str
    raw_text: str
    status: str  # "success", "failed", "skipped"
    error: str = ""


class ScrapeResponse(BaseModel):
    results: list[ScrapeResult]
    total: int
    succeeded: int
    failed: int


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def url_to_filename(url: str) -> str:
    """Convert URL to safe filename."""
    parsed = urlparse(url)
    domain = parsed.netloc.replace("www.", "").replace(".", "-")
    path = parsed.path.strip("/")
    if path:
        slug = re.sub(r"[^a-zA-Z0-9\-]", "-", path.replace("/", "-"))
        slug = re.sub(r"-+", "-", slug).strip("-")
        filename = f"{domain}-{slug}.md"
    else:
        filename = f"{domain}-index.md"
    return filename.lower()[:200]  # Cap filename length


def get_time_series_prefix() -> str:
    """Get GCS prefix in YYYY/MM/DD format."""
    now = datetime.now(timezone.utc)
    return f"raw/{now.strftime('%Y/%m/%d')}"


def scrape_url(app_fc, url: str, max_retries: int = 3) -> str | None:
    """Scrape a single URL via Firecrawl with retries."""
    for attempt in range(max_retries):
        try:
            result = app_fc.scrape(url, formats=["markdown"])
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
    """Scrape a list of URLs via Firecrawl, write to GCS, return results."""
    if not FIRECRAWL_API_KEY:
        raise HTTPException(status_code=500, detail="FIRECRAWL_API_KEY not configured")

    from firecrawl import FirecrawlApp
    fc_app = FirecrawlApp(api_key=FIRECRAWL_API_KEY)

    gcs_client = storage.Client()
    bucket = gcs_client.bucket(GCP_BUCKET_NAME)
    prefix = get_time_series_prefix()

    results = []
    succeeded = 0
    failed = 0

    for i, url in enumerate(body.urls):
        filename = url_to_filename(url)
        gcs_path = f"gs://{GCP_BUCKET_NAME}/{prefix}/{filename}"

        try:
            markdown = scrape_url(fc_app, url)

            if not markdown:
                results.append(ScrapeResult(
                    url=url, gcs_path="", raw_text="",
                    status="skipped", error="Empty or too short content"
                ))
                failed += 1
                continue

            # Add frontmatter
            now = datetime.now(timezone.utc).isoformat()
            content = f"---\nsource_url: {url}\ncrawled_at: {now}\n---\n\n{markdown}"

            # Write to GCS
            blob = bucket.blob(f"{prefix}/{filename}")
            blob.upload_from_string(content, content_type="text/markdown")

            results.append(ScrapeResult(
                url=url,
                gcs_path=gcs_path,
                raw_text=markdown,
                status="success",
            ))
            succeeded += 1

        except Exception as e:
            results.append(ScrapeResult(
                url=url, gcs_path="", raw_text="",
                status="failed", error=str(e)[:200]
            ))
            failed += 1

        # Rate limit between requests
        if i < len(body.urls) - 1:
            time.sleep(1)

    return ScrapeResponse(
        results=results,
        total=len(body.urls),
        succeeded=succeeded,
        failed=failed,
    )


@app.get("/health")
async def health():
    return {"status": "ok", "service": "proceedings-scraper"}
