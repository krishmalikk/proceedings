"""
crawler.py — Firecrawl Web Crawler for Proceedings RAG Pipeline
================================================================
Crawls URLs from url_registry.json (or falls back to urls.txt), converts
web pages to Markdown with metadata frontmatter, and uploads to GCS.

Supports scaled crawling with:
  - Structured URL registry with status tracking (resumable)
  - YAML frontmatter on each file (source_url, domain, source_type, crawled_at)
  - Domain-aware rate limiting
  - Content quality filtering

USAGE:
  python crawler.py                  # Crawl pending URLs from registry
  python crawler.py --legacy         # Use urls.txt instead of registry
"""

import argparse
import json
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv
from firecrawl import FirecrawlApp
from google.cloud import storage


REGISTRY_PATH = "url_registry.json"
MIN_CONTENT_LENGTH = 200  # Skip pages with less content than this


# ---------------------------------------------------------------------------
# URL Loading
# ---------------------------------------------------------------------------

def load_url_registry() -> list[dict]:
    """Load URL registry and return entries with status 'pending'."""
    if not os.path.exists(REGISTRY_PATH):
        print(f"Warning: {REGISTRY_PATH} not found. Run discover_urls.py first.")
        return []

    with open(REGISTRY_PATH, "r") as f:
        registry = json.load(f)

    pending = [entry for entry in registry if entry.get("status") == "pending"]
    return pending


def update_registry_entry(url: str, status: str) -> None:
    """Update a single entry's status and last_crawled in the registry."""
    with open(REGISTRY_PATH, "r") as f:
        registry = json.load(f)

    for entry in registry:
        if entry["url"] == url:
            entry["status"] = status
            if status == "done":
                entry["last_crawled"] = datetime.now(timezone.utc).isoformat()
            break

    with open(REGISTRY_PATH, "w") as f:
        json.dump(registry, f, indent=2)


def load_urls_legacy(filepath: str = "urls.txt") -> list[dict]:
    """
    Legacy: Read URLs from urls.txt. Returns list of dicts matching
    registry format for compatibility.
    """
    entries = []
    with open(filepath, "r") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#"):
                parsed = urlparse(line)
                domain = parsed.netloc.replace("www.", "")
                entries.append({
                    "url": line,
                    "domain": domain,
                    "source_type": "unknown",
                    "category": "general",
                    "status": "pending",
                })
    return entries


# ---------------------------------------------------------------------------
# Filename Generation
# ---------------------------------------------------------------------------

def url_to_filename(url: str) -> str:
    """
    Convert a URL into a safe, readable filename.

    Example:
      'https://www.uscis.gov/green-card' -> 'uscis-gov-green-card.md'
    """
    parsed = urlparse(url)
    domain = parsed.netloc.replace("www.", "").replace(".", "-")
    path = parsed.path.strip("/")

    if path:
        slug = re.sub(r"[^a-zA-Z0-9\-]", "-", path.replace("/", "-"))
        slug = re.sub(r"-+", "-", slug).strip("-")
        filename = f"{domain}-{slug}.md"
    else:
        filename = f"{domain}-index.md"

    return filename.lower()


# ---------------------------------------------------------------------------
# Crawling
# ---------------------------------------------------------------------------

def crawl_url(app: FirecrawlApp, url: str, max_retries: int = 3) -> str | None:
    """
    Crawl a single URL using the Firecrawl API.
    Returns Markdown content or None if all retries fail.
    """
    for attempt in range(max_retries):
        try:
            result = app.scrape(url, formats=["markdown"])
            markdown = result.markdown or ""
            if markdown:
                return markdown
            print(f"  Warning: Empty markdown returned for {url}")
            return None
        except Exception as e:
            wait_time = 2 ** attempt
            print(f"  Attempt {attempt + 1}/{max_retries} failed: {e}")
            if attempt < max_retries - 1:
                print(f"  Retrying in {wait_time}s...")
                time.sleep(wait_time)

    print(f"  All {max_retries} attempts failed for {url}")
    return None


# ---------------------------------------------------------------------------
# Content Processing
# ---------------------------------------------------------------------------

def add_frontmatter(content: str, entry: dict) -> str:
    """Prepend YAML frontmatter with source metadata to the markdown content."""
    now = datetime.now(timezone.utc).isoformat()
    frontmatter = f"""---
source_url: {entry['url']}
domain: {entry.get('domain', '')}
source_type: {entry.get('source_type', 'unknown')}
category: {entry.get('category', 'general')}
crawled_at: {now}
---

"""
    return frontmatter + content


def is_content_useful(content: str) -> bool:
    """
    Check if the crawled content has enough substance to be worth indexing.
    Filters out pages that are mostly navigation or boilerplate.
    """
    # Strip markdown links and images
    text = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", content)
    text = re.sub(r"!\[([^\]]*)\]\([^)]*\)", "", text)
    # Strip markdown formatting
    text = re.sub(r"[#*_`>|~\-=]", "", text)
    text = text.strip()

    return len(text) >= MIN_CONTENT_LENGTH


# ---------------------------------------------------------------------------
# Local File Saving
# ---------------------------------------------------------------------------

def save_markdown(content: str, filename: str, output_dir: str = "crawled_pages") -> str:
    """Save Markdown content to a local file."""
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    filepath = os.path.join(output_dir, filename)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    return filepath


# ---------------------------------------------------------------------------
# GCS Upload
# ---------------------------------------------------------------------------

def upload_to_gcs(local_dir: str, bucket_name: str, prefix: str = "crawled/") -> int:
    """Upload all .md files to a GCS bucket under the given prefix."""
    client = storage.Client()
    bucket = client.bucket(bucket_name)
    uploaded = 0

    for filepath in Path(local_dir).glob("*.md"):
        blob_name = f"{prefix}{filepath.name}"
        blob = bucket.blob(blob_name)
        blob.upload_from_filename(str(filepath))
        print(f"  Uploaded {filepath.name} -> gs://{bucket_name}/{blob_name}")
        uploaded += 1

    return uploaded


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Crawl URLs for the Proceedings pipeline")
    parser.add_argument("--legacy", action="store_true",
                        help="Use urls.txt instead of url_registry.json")
    args = parser.parse_args()

    load_dotenv()

    api_key = os.getenv("FIRECRAWL_API_KEY")
    bucket_name = os.getenv("GCP_BUCKET_NAME", "law-firm-knowledge-base")

    if not api_key:
        print("Error: FIRECRAWL_API_KEY not set in .env file.")
        return

    app = FirecrawlApp(api_key=api_key)
    use_registry = not args.legacy

    # Load URLs
    if use_registry:
        entries = load_url_registry()
        if not entries:
            print("No pending URLs in registry. Run discover_urls.py to add URLs.")
            return
    else:
        entries = load_urls_legacy()
        if not entries:
            print("No URLs found in urls.txt")
            return

    print(f"Found {len(entries)} URLs to crawl.\n")

    # Track last domain for rate limiting
    last_domain = ""
    succeeded = []
    failed = []
    skipped = []

    for i, entry in enumerate(entries, 1):
        url = entry["url"]
        filename = url_to_filename(url)
        domain = entry.get("domain", "")

        print(f"[{i}/{len(entries)}] Crawling: {url}")
        print(f"  Output: {filename}")

        # Domain-aware rate limiting
        if domain == last_domain:
            time.sleep(3)
        elif i > 1:
            time.sleep(1)
        last_domain = domain

        markdown = crawl_url(app, url)

        if not markdown:
            failed.append(url)
            if use_registry:
                update_registry_entry(url, "failed")
            print(f"  X Failed")
            continue

        # Content quality check
        if not is_content_useful(markdown):
            skipped.append(url)
            if use_registry:
                update_registry_entry(url, "skipped")
            print(f"  - Skipped (insufficient content)")
            continue

        # Add metadata frontmatter
        markdown_with_meta = add_frontmatter(markdown, entry)
        save_markdown(markdown_with_meta, filename)
        succeeded.append(url)

        if use_registry:
            update_registry_entry(url, "done")
        print(f"  Saved ({len(markdown):,} characters)")

    # Upload to GCS
    print(f"\nUploading to GCS bucket: {bucket_name}")
    uploaded_count = upload_to_gcs("crawled_pages", bucket_name, prefix="crawled/")

    # Summary
    print(f"\n{'='*50}")
    print(f"CRAWL COMPLETE")
    print(f"  Succeeded: {len(succeeded)}/{len(entries)}")
    print(f"  Skipped:   {len(skipped)}/{len(entries)} (low content)")
    print(f"  Failed:    {len(failed)}/{len(entries)}")
    print(f"  Uploaded:  {uploaded_count} files to gs://{bucket_name}/crawled/")

    if failed:
        print(f"\nFailed URLs:")
        for url in failed:
            print(f"  - {url}")


if __name__ == "__main__":
    main()
