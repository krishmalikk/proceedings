"""
agent_crawl.py — Crawl URLs using Firecrawl API
=================================================
Crawls pending URLs from url_registry.json using Firecrawl for
JavaScript rendering and clean Markdown extraction.

USAGE:
  python agent_crawl.py
"""

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

load_dotenv()

GCP_BUCKET_NAME = os.getenv("GCP_BUCKET_NAME", "law-firm-knowledge-base")
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
    return f"---\nsource_url: {entry['url']}\ndomain: {entry.get('domain', '')}\nsource_type: {entry.get('source_type', 'unknown')}\ncategory: {entry.get('category', 'general')}\ncrawled_at: {now}\n---\n\n{content}"


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
        uploaded += 1
    return uploaded


def main():
    api_key = os.getenv("FIRECRAWL_API_KEY")
    if not api_key:
        print("Error: FIRECRAWL_API_KEY not set in .env")
        return

    app = FirecrawlApp(api_key=api_key)
    entries = load_url_registry()

    if not entries:
        print("No pending URLs in registry.")
        return

    print(f"Found {len(entries)} URLs to crawl with Firecrawl.\n")

    last_domain = ""
    succeeded = []
    failed = []
    skipped = []

    for i, entry in enumerate(entries, 1):
        url = entry["url"]
        filename = url_to_filename(url)
        domain = entry.get("domain", "")

        print(f"[{i}/{len(entries)}] {url[:90]}")

        # Domain-aware rate limiting
        if domain == last_domain:
            time.sleep(3)
        elif i > 1:
            time.sleep(1)
        last_domain = domain

        try:
            result = app.scrape(url, formats=["markdown"])
            markdown = result.markdown or ""

            if not markdown or len(markdown.strip()) < MIN_CONTENT_LENGTH:
                skipped.append(url)
                update_registry_entry(url, "skipped")
                print(f"  Skipped (insufficient content)")
                continue

            content = add_frontmatter(markdown, entry)
            save_markdown(content, filename)
            succeeded.append(url)
            update_registry_entry(url, "done")
            print(f"  Saved ({len(markdown):,} chars)")

        except Exception as e:
            failed.append(url)
            update_registry_entry(url, "failed")
            print(f"  Failed: {str(e)[:80]}")

    # Upload to GCS
    print(f"\nUploading to GCS...")
    uploaded = upload_to_gcs("crawled_pages", GCP_BUCKET_NAME)

    print(f"\n{'='*50}")
    print(f"CRAWL COMPLETE (Firecrawl)")
    print(f"  Succeeded: {len(succeeded)}/{len(entries)}")
    print(f"  Skipped:   {len(skipped)}/{len(entries)}")
    print(f"  Failed:    {len(failed)}/{len(entries)}")
    print(f"  Uploaded:  {uploaded} files")


if __name__ == "__main__":
    main()
