"""
agent_label.py — Label crawled content using the deployed Agent Engine agent
=============================================================================
Replaces pipeline.py's Gemini-based labeling with the deployed
ImmigrationLabelingAgent on Vertex AI Agent Engine.

Produces Label Studio-compatible JSON annotations in GCS /labeled/.

USAGE:
  python agent_label.py                    # Label using deployed Agent Engine
  python agent_label.py --local            # Label using local agent (no deployment needed)
"""

import argparse
import json
import os
import time
from pathlib import Path

import vertexai
from dotenv import load_dotenv
from google.cloud import storage

load_dotenv()

GCP_PROJECT_ID = os.getenv("GCP_PROJECT_ID", "proceedings-490601")
GCP_REGION = os.getenv("GCP_REGION", "us-central1")
GCP_BUCKET_NAME = os.getenv("GCP_BUCKET_NAME", "law-firm-knowledge-base")
AGENT_ENGINE_RESOURCE_NAME = os.getenv(
    "AGENT_ENGINE_RESOURCE_NAME",
    "projects/971592620882/locations/us-central1/reasoningEngines/4797548013742456832",
)


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
        try:
            content = blob.download_as_text()
            data = json.loads(content)
            source = data.get("task", {}).get("data", {}).get("text", "")
            if source:
                labeled_sources.add(source.split("/")[-1])
        except (json.JSONDecodeError, Exception):
            continue

    return labeled_sources


def upload_labeled_file(bucket_name: str, filename: str, labels: list[str], label_id: int) -> None:
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


def main():
    parser = argparse.ArgumentParser(description="Label content using Agent Engine")
    parser.add_argument("--local", action="store_true", help="Use local agent instead of deployed")
    args = parser.parse_args()

    print("=" * 50)
    print("LABELING: Using Vertex AI Agent Engine")
    print("=" * 50)

    files = get_crawled_files()
    if not files:
        print("No crawled files found in crawled_pages/")
        return

    already_labeled = get_already_labeled(GCP_BUCKET_NAME)
    files_to_label = [f for f in files if f.name not in already_labeled]

    print(f"  Total crawled files: {len(files)}")
    print(f"  Already labeled: {len(already_labeled)}")
    print(f"  To label: {len(files_to_label)}")

    if not files_to_label:
        print("  All files already labeled.")
        return

    # Initialize agent
    if args.local:
        from labeling_agent.agent import ImmigrationLabelingAgent
        agent = ImmigrationLabelingAgent(
            model="gemini-2.5-flash",
            project=GCP_PROJECT_ID,
            location=GCP_REGION,
        )
        agent.set_up()
        print("  Using LOCAL agent")
    else:
        client = vertexai.Client(project=GCP_PROJECT_ID, location=GCP_REGION)
        agent = client.agent_engines.get(name=AGENT_ENGINE_RESOURCE_NAME)
        print(f"  Using DEPLOYED agent: {AGENT_ENGINE_RESOURCE_NAME}")

    # Find next available label ID
    label_id = len(already_labeled) + 200  # offset to avoid collisions

    labeled_count = 0
    for i, filepath in enumerate(files_to_label):
        print(f"\n  [{i+1}/{len(files_to_label)}] {filepath.name}")

        content = filepath.read_text(encoding="utf-8")
        if len(content.strip()) < 100:
            print(f"    Skipped (too short)")
            continue

        try:
            result = agent.query(content=content, source_url="")
            labels = result.get("labels", ["general-immigration-info"])
            confidence = result.get("confidence", 0)
            print(f"    Labels: {labels} (confidence: {confidence:.2f})")

            # Upload crawled file to GCS if not already there
            gcs_client = storage.Client()
            bucket = gcs_client.bucket(GCP_BUCKET_NAME)
            crawled_blob = bucket.blob(f"crawled/{filepath.name}")
            if not crawled_blob.exists():
                crawled_blob.upload_from_filename(str(filepath))

            upload_labeled_file(GCP_BUCKET_NAME, filepath.name, labels, label_id)
            label_id += 1
            labeled_count += 1

            # Rate limit
            time.sleep(2)
        except Exception as e:
            print(f"    Error: {e}")
            continue

    print(f"\n  Labeled {labeled_count} new files")


if __name__ == "__main__":
    main()
