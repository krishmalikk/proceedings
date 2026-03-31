"""
pipeline.py — Full Pipeline Orchestration for Proceedings
==========================================================
Runs the complete pipeline without Label Studio in the critical path:
  1. Crawl pending URLs from url_registry.json
  2. Auto-label each crawled file using Gemini
  3. Upload labeled files to GCS /labeled/
  4. Run incremental indexing (embed + upsert to existing index)

USAGE:
  python pipeline.py                # Run full pipeline
  python pipeline.py --skip-crawl   # Skip crawling, just label + index
  python pipeline.py --skip-label   # Skip labeling, just index existing
"""

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.cloud import storage

load_dotenv()

GCP_BUCKET_NAME = os.getenv("GCP_BUCKET_NAME", "law-firm-knowledge-base")

VALID_LABELS = ["visa-info", "eligibility", "process", "fees", "timeline", "other"]

CLASSIFICATION_PROMPT = """You are a legal content classifier. Given the following markdown content from an immigration law website, classify it into one or more of these categories:

- visa-info: General information about visa types, categories, descriptions
- eligibility: Who qualifies, requirements, conditions
- process: Steps to apply, procedures, forms needed
- fees: Costs, filing fees, payment methods
- timeline: Processing times, wait periods, deadlines
- other: Anything that doesn't fit the above categories

Respond with ONLY a JSON array of matching category strings. For example: ["visa-info", "process"]

Content:
{content}
"""


def get_crawled_files() -> list[Path]:
    """Get all markdown files in crawled_pages/."""
    crawled_dir = Path("crawled_pages")
    if not crawled_dir.exists():
        return []
    return sorted(crawled_dir.glob("*.md"))


def get_already_labeled(bucket_name: str) -> set[str]:
    """Check which files already have labels in GCS /labeled/."""
    client = storage.Client()
    bucket = client.bucket(bucket_name)
    blobs = bucket.list_blobs(prefix="labeled/")

    labeled_sources = set()
    for blob in blobs:
        if blob.name.endswith("/") or blob.name.endswith(".keep"):
            continue
        # Download and check the source field
        try:
            content = blob.download_as_text()
            data = json.loads(content)
            source = data.get("task", {}).get("data", {}).get("text", "")
            if source:
                # Extract filename from GCS URI
                labeled_sources.add(source.split("/")[-1])
        except (json.JSONDecodeError, Exception):
            continue

    return labeled_sources


def strip_frontmatter(content: str) -> str:
    """Remove YAML frontmatter from markdown content."""
    if content.startswith("---"):
        parts = content.split("---", 2)
        if len(parts) >= 3:
            return parts[2].strip()
    return content


def classify_content(client, content: str) -> list[str]:
    """Use Gemini to classify markdown content into label categories."""
    # Strip frontmatter before classifying
    clean_content = strip_frontmatter(content)
    prompt = CLASSIFICATION_PROMPT.format(content=clean_content[:10000])

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
    )
    text = response.text.strip()

    # Handle markdown code blocks in response
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()

    labels = json.loads(text)
    labels = [l for l in labels if l in VALID_LABELS]
    return labels if labels else ["other"]


def upload_labeled_file(
    bucket_name: str,
    filename: str,
    labels: list[str],
    label_id: int,
) -> None:
    """Upload a Label Studio-compatible annotation JSON to GCS /labeled/."""
    annotation = {
        "id": label_id,
        "result": [
            {
                "from_name": "category",
                "to_name": "text",
                "type": "choices",
                "value": {"choices": labels},
            }
        ],
        "task": {
            "id": label_id,
            "data": {"text": f"gs://{bucket_name}/crawled/{filename}"},
        },
    }

    client = storage.Client()
    bucket = client.bucket(bucket_name)
    blob = bucket.blob(f"labeled/{label_id}")
    blob.upload_from_string(json.dumps(annotation), content_type="application/json")


def run_crawl():
    """Run the crawler for pending URLs using agent_crawl (trafilatura)."""
    print("=" * 50)
    print("STAGE 1: Crawling pending URLs (trafilatura)")
    print("=" * 50)
    os.system(f"{sys.executable} agent_crawl.py")


def run_label(bucket_name: str):
    """Auto-label crawled files using Agent Engine."""
    print("\n" + "=" * 50)
    print("STAGE 2: Auto-labeling with Agent Engine")
    print("=" * 50)
    os.system(f"{sys.executable} agent_label.py")


def run_index():
    """Run incremental indexing."""
    print("\n" + "=" * 50)
    print("STAGE 3: Incremental indexing")
    print("=" * 50)
    os.system(f"{sys.executable} index.py")


def main():
    parser = argparse.ArgumentParser(description="Run the full Proceedings pipeline")
    parser.add_argument("--skip-crawl", action="store_true", help="Skip crawling stage")
    parser.add_argument("--skip-label", action="store_true", help="Skip labeling stage")
    parser.add_argument("--skip-index", action="store_true", help="Skip indexing stage")
    args = parser.parse_args()

    bucket_name = os.getenv("GCP_BUCKET_NAME", "law-firm-knowledge-base")

    print("Proceedings Pipeline")
    print("=" * 50)

    if not args.skip_crawl:
        run_crawl()

    if not args.skip_label:
        run_label(bucket_name)

    if not args.skip_index:
        run_index()

    print("\n" + "=" * 50)
    print("PIPELINE COMPLETE")
    print("=" * 50)


if __name__ == "__main__":
    main()
