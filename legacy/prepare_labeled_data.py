"""
prepare_labeled_data.py — Prepare data for Vector Search indexing
==================================================================
This script:
  1. Reads the JSONL manifests from GCS
  2. Downloads the referenced markdown files
  3. Saves them to a labeled/ folder with proper structure

After running this, you can run index.py to create the Vector Search
index and chunk_mapping.json.

USAGE:
  python prepare_labeled_data.py
"""

import json
import os
from pathlib import Path

from dotenv import load_dotenv
from google.cloud import storage


def main():
    load_dotenv()

    bucket_name = os.getenv("GCP_BUCKET", "imm-postings-ingestion").replace("gs://", "")
    client = storage.Client()
    bucket = client.bucket(bucket_name)

    # Create labeled folder
    labeled_dir = Path("labeled")
    labeled_dir.mkdir(exist_ok=True)

    # Find all manifest files
    print(f"Scanning gs://{bucket_name} for manifest files...")
    blobs = list(bucket.list_blobs())

    manifest_blobs = [b for b in blobs if "_manifest" in b.name and b.name.endswith(".jsonl")]
    print(f"Found {len(manifest_blobs)} manifest files")

    documents = []
    seen_ids = set()

    for manifest_blob in manifest_blobs:
        print(f"Processing {manifest_blob.name}...")
        content = manifest_blob.download_as_text()

        for line in content.strip().split("\n"):
            if not line.strip():
                continue
            try:
                doc = json.loads(line)
            except json.JSONDecodeError:
                continue

            doc_id = doc.get("id", "")
            if doc_id in seen_ids:
                continue
            seen_ids.add(doc_id)

            struct_data = doc.get("structData", {})
            content_uri = doc.get("content", {}).get("uri", "")

            # Get the embedding text or download the markdown
            text = struct_data.get("embedding_text", "")

            if not text and content_uri.startswith("gs://"):
                # Download the actual markdown content
                uri_parts = content_uri.replace("gs://", "").split("/", 1)
                source_bucket_name = uri_parts[0]
                source_blob_path = uri_parts[1] if len(uri_parts) > 1 else ""

                try:
                    source_bucket = client.bucket(source_bucket_name)
                    source_blob = source_bucket.blob(source_blob_path)
                    text = source_blob.download_as_text()
                except Exception as e:
                    print(f"  Warning: Could not download {content_uri}: {e}")
                    continue

            if text.strip():
                # Extract labels from tags
                labels = struct_data.get("tags", []) + struct_data.get("concerns_or_questions_tags", [])
                if not labels:
                    labels = ["immigration"]

                # Add visa categories as labels
                visa_categories = struct_data.get("current_visa_or_greencard_category", [])
                visa_applying = struct_data.get("visa_applying_for", [])
                labels.extend(visa_categories)
                labels.extend(visa_applying)

                documents.append({
                    "id": doc_id,
                    "text": text,
                    "labels": list(set(labels)),
                    "source": struct_data.get("gcs_path", doc_id),
                    "title": struct_data.get("post_title", ""),
                })

    print(f"\nFound {len(documents)} unique documents")

    # Save as JSON files in labeled/ folder (Label Studio format)
    for i, doc in enumerate(documents):
        # Create a Label Studio-compatible annotation JSON
        annotation = {
            "task": {
                "data": {
                    "text": doc["text"],
                }
            },
            "result": [
                {
                    "value": {
                        "choices": doc["labels"][:5]  # Top 5 labels
                    }
                }
            ]
        }

        filename = f"{i + 1}"  # Label Studio uses numeric filenames
        filepath = labeled_dir / filename
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(annotation, f, indent=2, ensure_ascii=False)

    print(f"Saved {len(documents)} documents to {labeled_dir}/")
    print("\nNext steps:")
    print("  1. Upload to GCS: gsutil -m cp -r labeled/ gs://{bucket_name}/labeled/")
    print("  2. Run: python index.py")
    print("  3. Redeploy: gcloud run deploy immiguide-api --source . --region us-central1")


if __name__ == "__main__":
    main()
