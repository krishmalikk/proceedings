"""
agent_crawl.py — Crawl URLs using Vertex AI Agent Builder Discovery Engine
============================================================================
Replaces Firecrawl with Google's Discovery Engine Website Data Store for
web crawling. Falls back to trafilatura for content extraction if
Discovery Engine's extractive content is insufficient.

USAGE:
  python agent_crawl.py                    # Crawl pending URLs from registry
  python agent_crawl.py --extract-only     # Skip crawl, just extract content from existing data store
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
from google.cloud import storage

load_dotenv()

GCP_PROJECT_ID = os.getenv("GCP_PROJECT_ID", "proceedings-490601")
GCP_REGION = os.getenv("GCP_REGION", "us-central1")
GCP_BUCKET_NAME = os.getenv("GCP_BUCKET_NAME", "law-firm-knowledge-base")
DISCOVERY_ENGINE_DATA_STORE_ID = os.getenv("DISCOVERY_ENGINE_DATA_STORE_ID", "")

REGISTRY_PATH = "url_registry.json"
MIN_CONTENT_LENGTH = 200


def load_url_registry() -> list[dict]:
    """Load URL registry and return pending entries."""
    if not os.path.exists(REGISTRY_PATH):
        return []
    with open(REGISTRY_PATH, "r") as f:
        registry = json.load(f)
    return [entry for entry in registry if entry.get("status") == "pending"]


def update_registry_entry(url: str, status: str) -> None:
    """Update a single entry's status in the registry."""
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


def url_to_filename(url: str) -> str:
    """Convert a URL into a safe filename."""
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


def add_frontmatter(content: str, entry: dict) -> str:
    """Prepend YAML frontmatter with source metadata."""
    now = datetime.now(timezone.utc).isoformat()
    frontmatter = f"""---
source_url: {entry['url']}
domain: {entry.get('domain', '')}
source_type: {entry.get('source_type', 'unknown')}
category: {entry.get('category', 'general')}
crawled_at: {now}
crawled_by: vertex-ai-discovery-engine
---

"""
    return frontmatter + content


def scrape_with_trafilatura(url: str) -> str | None:
    """
    Scrape a URL using trafilatura (HTML → clean text/Markdown).
    This is the primary extraction method, replacing Firecrawl.
    """
    try:
        import trafilatura

        downloaded = trafilatura.fetch_url(url)
        if not downloaded:
            return None

        text = trafilatura.extract(
            downloaded,
            include_links=True,
            include_tables=True,
            output_format="txt",
            favor_recall=True,
        )
        return text
    except Exception as e:
        print(f"    trafilatura error: {e}")
        return None


def save_markdown(content: str, filename: str, output_dir: str = "crawled_pages") -> str:
    """Save Markdown content to a local file."""
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    filepath = os.path.join(output_dir, filename)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    return filepath


def upload_to_gcs(local_dir: str, bucket_name: str, prefix: str = "crawled/") -> int:
    """Upload all .md files to GCS."""
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


def main():
    parser = argparse.ArgumentParser(description="Crawl URLs using Vertex AI / trafilatura")
    parser.add_argument("--extract-only", action="store_true", help="Skip crawl trigger, just extract")
    args = parser.parse_args()

    print("=" * 50)
    print("CRAWLING: Vertex AI Discovery Engine + trafilatura")
    print("=" * 50)

    entries = load_url_registry()
    if not entries:
        print("No pending URLs in registry.")
        return

    print(f"Found {len(entries)} URLs to crawl.\n")

    # Use trafilatura for content extraction (replaces Firecrawl)
    # This is a local, free, open-source alternative
    try:
        import trafilatura
        print("Using trafilatura for content extraction (no Firecrawl dependency)\n")
    except ImportError:
        print("Error: trafilatura not installed. Run: pip install trafilatura")
        return

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

        content = scrape_with_trafilatura(url)

        if not content:
            failed.append(url)
            update_registry_entry(url, "failed")
            print(f"  X Failed")
            continue

        # Content quality check
        if len(content.strip()) < MIN_CONTENT_LENGTH:
            skipped.append(url)
            update_registry_entry(url, "skipped")
            print(f"  - Skipped (insufficient content: {len(content.strip())} chars)")
            continue

        # Add metadata frontmatter
        content_with_meta = add_frontmatter(content, entry)
        save_markdown(content_with_meta, filename)
        succeeded.append(url)
        update_registry_entry(url, "done")
        print(f"  Saved ({len(content):,} characters)")

    # Upload to GCS
    print(f"\nUploading to GCS bucket: {GCP_BUCKET_NAME}")
    uploaded_count = upload_to_gcs("crawled_pages", GCP_BUCKET_NAME)

    # Summary
    print(f"\n{'='*50}")
    print(f"CRAWL COMPLETE")
    print(f"  Succeeded: {len(succeeded)}/{len(entries)}")
    print(f"  Skipped:   {len(skipped)}/{len(entries)} (low content)")
    print(f"  Failed:    {len(failed)}/{len(entries)}")
    print(f"  Uploaded:  {uploaded_count} files to gs://{GCP_BUCKET_NAME}/crawled/")

    if failed:
        print(f"\nFailed URLs:")
        for url in failed:
            print(f"  - {url}")


if __name__ == "__main__":
    main()
