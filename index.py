"""
index.py — Vertex AI Vector Search Indexer for Proceedings RAG Pipeline
========================================================================
This script does four things:
  1. Downloads labeled Markdown files from the GCS bucket (/labeled/ subfolder)
  2. Chunks each document into ~512-token pieces with 50-token overlap
  3. Generates embeddings using Vertex AI's text-embedding-005 model
  4. Creates a Vertex AI Vector Search index and uploads the embeddings

WHY THIS EXISTS:
In the old build, ChromaDB stored vectors locally on your machine. Now, Vertex AI
Vector Search is a managed cloud service — it's scalable, persistent, and doesn't
depend on your laptop being on. The chunking step breaks long documents into pieces
that are small enough for the embedding model and focused enough for accurate retrieval.

BEFORE RUNNING:
  1. Complete the labeling step in Label Studio (see label_studio_setup.md)
  2. Ensure labeled data is synced to gs://law-firm-knowledge-base/labeled/
  3. Authenticate with GCP: gcloud auth application-default login
  4. Enable the Vertex AI API: gcloud services enable aiplatform.googleapis.com

USAGE:
  python index.py

AFTER RUNNING:
  The script prints a VERTEX_AI_INDEX_ID and VERTEX_AI_INDEX_ENDPOINT_ID.
  Copy these values into your .env file.
"""

import json
import os
import tempfile
from pathlib import Path

import tiktoken
import vertexai
from dotenv import load_dotenv
from google.cloud import aiplatform, storage
from vertexai.language_models import TextEmbeddingInput, TextEmbeddingModel


# ---------------------------------------------------------------------------
# Download Labeled Files from GCS
# ---------------------------------------------------------------------------

def download_labeled_files(bucket_name: str, prefix: str = "labeled/") -> list[dict]:
    """
    Download all files from the labeled/ subfolder in the GCS bucket.

    Label Studio's GCS target storage exports one JSON file per annotation,
    named by annotation ID (e.g., "1", "2", ...). Each JSON contains:
      - task.data.text: a GCS URI pointing to the original Markdown file
      - result[].value.choices: the labels assigned by the annotator

    This function parses each annotation, downloads the actual Markdown
    content from the referenced GCS URI, and pairs it with the labels.

    Returns a list of dicts:
      [{'text': '...', 'labels': ['visa-info', 'process'], 'source': 'filename.md'}, ...]
    """
    client = storage.Client()
    bucket = client.bucket(bucket_name)
    blobs = list(bucket.list_blobs(prefix=prefix))

    documents = []
    # Cache downloaded Markdown content to avoid re-downloading duplicates
    content_cache = {}

    for blob in blobs:
        # Skip the .keep placeholder and directory markers
        if blob.name.endswith(".keep") or blob.name == prefix or blob.name.endswith("/"):
            continue

        # Download the annotation JSON
        content = blob.download_as_text()
        filename = blob.name.split("/")[-1]

        try:
            annotation = json.loads(content)
        except json.JSONDecodeError:
            # Plain Markdown file — include as-is
            if content.strip():
                documents.append({
                    "text": content,
                    "labels": ["unclassified"],
                    "source": filename,
                })
            continue

        # Extract labels from result[].value.choices
        labels = []
        for r in annotation.get("result", []):
            choices = r.get("value", {}).get("choices", [])
            labels.extend(choices)

        # Get the GCS URI or raw text from task.data.text
        text_ref = annotation.get("task", {}).get("data", {}).get("text", "")

        if text_ref.startswith("gs://"):
            # Download the actual Markdown content from the referenced URI
            if text_ref in content_cache:
                text = content_cache[text_ref]
            else:
                # Parse gs://bucket-name/path into bucket and blob path
                uri_parts = text_ref.replace("gs://", "").split("/", 1)
                source_bucket_name = uri_parts[0]
                source_blob_path = uri_parts[1] if len(uri_parts) > 1 else ""
                source_bucket = client.bucket(source_bucket_name)
                source_blob = source_bucket.blob(source_blob_path)
                try:
                    text = source_blob.download_as_text()
                    content_cache[text_ref] = text
                except Exception as e:
                    print(f"  Warning: Could not download {text_ref}: {e}")
                    continue

            source_name = text_ref.split("/")[-1]
        else:
            # text field contains the actual content
            text = text_ref
            source_name = filename

        if text.strip():
            documents.append({
                "text": text,
                "labels": list(set(labels)) if labels else ["unclassified"],
                "source": source_name,
            })

    print(f"Downloaded {len(documents)} labeled documents from gs://{bucket_name}/{prefix}")
    return documents


# ---------------------------------------------------------------------------
# Token-Based Chunking
# ---------------------------------------------------------------------------

def chunk_text(text: str, chunk_size: int = 512, overlap: int = 50) -> list[str]:
    """
    Split text into chunks of approximately `chunk_size` tokens, with
    `overlap` tokens of overlap between consecutive chunks.

    WHY TOKEN-BASED CHUNKING:
    Splitting by character count or sentences is imprecise — a 500-character
    chunk might be 80 tokens or 200 tokens depending on the words. Token-based
    chunking ensures each chunk is consistently sized for the embedding model.

    We use tiktoken's cl100k_base encoding as a reasonable approximation of
    Gemini's tokenizer. It's fast (runs locally, no API calls) and close enough
    for chunking purposes.

    Example with chunk_size=512, overlap=50:
      Tokens 0-511   → Chunk 1
      Tokens 462-973  → Chunk 2  (overlaps with chunk 1 by 50 tokens)
      Tokens 924-1435 → Chunk 3  (overlaps with chunk 2 by 50 tokens)
    """
    encoder = tiktoken.get_encoding("cl100k_base")
    tokens = encoder.encode(text)

    # If the text is shorter than one chunk, return it as-is
    if len(tokens) <= chunk_size:
        return [text.strip()] if text.strip() else []

    chunks = []
    step = chunk_size - overlap
    start = 0

    while start < len(tokens):
        end = min(start + chunk_size, len(tokens))
        chunk_tokens = tokens[start:end]
        chunk_text = encoder.decode(chunk_tokens).strip()
        if chunk_text:
            chunks.append(chunk_text)
        start += step

    return chunks


# ---------------------------------------------------------------------------
# Embedding Generation
# ---------------------------------------------------------------------------

def generate_embeddings(texts: list[str], batch_size: int = 5) -> list[list[float]]:
    """
    Generate embeddings for a list of text chunks using Vertex AI's
    text-embedding-005 model.

    WHY text-embedding-005:
    This is Google's latest text embedding model. It produces 768-dimensional
    vectors optimized for retrieval tasks — exactly what we need for RAG.

    The API has a per-request token limit of 20,000 tokens. With ~512-token
    chunks, we use batches of 5 to stay safely under the limit.
    """
    model = TextEmbeddingModel.from_pretrained("text-embedding-005")
    all_embeddings = []

    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        inputs = [TextEmbeddingInput(text, "RETRIEVAL_DOCUMENT") for text in batch]
        embeddings = model.get_embeddings(inputs)
        all_embeddings.extend([e.values for e in embeddings])
        print(f"  Embedded batch {i // batch_size + 1} ({len(batch)} chunks)")

    return all_embeddings


# ---------------------------------------------------------------------------
# Vector Search Index Creation
# ---------------------------------------------------------------------------

def create_vector_search_index(
    project_id: str,
    region: str,
    display_name: str = "legal-intake-index",
) -> aiplatform.MatchingEngineIndex:
    """
    Create a Vertex AI Vector Search index.

    This is the cloud equivalent of what ChromaDB did locally. The index
    uses Tree-AH (Asymmetric Hashing), which is Google's recommended algorithm
    for fast approximate nearest-neighbor search.

    Configuration:
      - 768 dimensions (matches text-embedding-005 output)
      - DOT_PRODUCT distance (standard for normalized embeddings)
      - SMALL shard size (appropriate for < 1M vectors)

    NOTE: Index creation takes a few minutes. The script waits for it to complete.
    """
    print("Creating Vector Search index (this may take a few minutes)...")

    index = aiplatform.MatchingEngineIndex.create_tree_ah_index(
        display_name=display_name,
        dimensions=768,
        approximate_neighbors_count=150,
        leaf_node_embedding_count=1000,
        leaf_nodes_to_search_percent=10.0,
        distance_measure_type="DOT_PRODUCT_DISTANCE",
        shard_size="SHARD_SIZE_SMALL",
        description="Proceedings legal intake RAG index",
        index_update_method="STREAM_UPDATE",
    )

    print(f"Index created: {index.resource_name}")
    return index


def deploy_index_to_endpoint(
    index: aiplatform.MatchingEngineIndex,
    display_name: str = "legal-intake-endpoint",
) -> aiplatform.MatchingEngineIndexEndpoint:
    """
    Create an index endpoint and deploy the index to it.

    An endpoint is what your query script actually talks to — the index stores
    the data, but the endpoint serves the queries.

    NOTE: Deployment can take 20-30 minutes. The script waits for it to complete.
    """
    print("Creating index endpoint...")
    endpoint = aiplatform.MatchingEngineIndexEndpoint.create(
        display_name=display_name,
        public_endpoint_enabled=True,
        description="Proceedings legal intake RAG endpoint",
        create_request_timeout=1800,
    )

    print("Deploying index to endpoint (this can take 20-30 minutes)...")
    endpoint.deploy_index(
        index=index,
        deployed_index_id="legal_intake_deployed",
        display_name="legal-intake-deployed",
    )

    print(f"Endpoint ready: {endpoint.resource_name}")
    return endpoint


# ---------------------------------------------------------------------------
# Chunk Mapping
# ---------------------------------------------------------------------------

def save_chunk_mapping(
    mapping: dict[str, dict],
    bucket_name: str,
    local_path: str = "chunk_mapping.json",
) -> None:
    """
    Save the chunk ID → text mapping both locally and to GCS.

    The Vector Search index only stores IDs and vectors. To retrieve the
    actual text at query time, we need this mapping. query.py downloads
    it from GCS.
    """
    # Save locally
    with open(local_path, "w", encoding="utf-8") as f:
        json.dump(mapping, f, indent=2, ensure_ascii=False)

    # Upload to GCS
    client = storage.Client()
    bucket = client.bucket(bucket_name)
    blob = bucket.blob("chunk_mapping.json")
    blob.upload_from_filename(local_path)

    print(f"Chunk mapping saved ({len(mapping)} chunks) → gs://{bucket_name}/chunk_mapping.json")


# ---------------------------------------------------------------------------
# Content Quality Filtering
# ---------------------------------------------------------------------------

def is_chunk_useful(text: str, min_tokens: int = 50) -> bool:
    """Filter out chunks that are too short or mostly navigation/links."""
    encoder = tiktoken.get_encoding("cl100k_base")
    tokens = encoder.encode(text)

    if len(tokens) < min_tokens:
        return False

    # Check link density: if more than 60% of text is markdown links, skip
    link_chars = sum(len(m) for m in __import__("re").findall(r"\[([^\]]*)\]\([^)]*\)", text))
    if len(text) > 0 and link_chars / len(text) > 0.6:
        return False

    return True


def load_existing_chunk_mapping(local_path: str = "chunk_mapping.json") -> dict:
    """Load existing chunk mapping if available."""
    if os.path.exists(local_path):
        with open(local_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    # Load environment variables
    load_dotenv()

    project_id = os.getenv("GCP_PROJECT_ID")
    region = os.getenv("GCP_REGION", "us-central1")
    bucket_name = os.getenv("GCP_BUCKET_NAME", "law-firm-knowledge-base")
    existing_index_id = os.getenv("VERTEX_AI_INDEX_ID")
    existing_endpoint_id = os.getenv("VERTEX_AI_INDEX_ENDPOINT_ID")

    if not project_id:
        print("Error: GCP_PROJECT_ID not set in .env file.")
        return

    incremental = bool(existing_index_id and existing_endpoint_id)
    if incremental:
        print("Running in INCREMENTAL mode (existing index detected)")
    else:
        print("Running in FULL mode (no existing index)")

    # Initialize Vertex AI
    vertexai.init(project=project_id, location=region)
    aiplatform.init(project=project_id, location=region)

    # Step 1: Download labeled files from GCS
    print("\n" + "=" * 50)
    print("STEP 1: Downloading labeled files from GCS")
    print("=" * 50)
    documents = download_labeled_files(bucket_name)

    if not documents:
        print("No labeled documents found in the bucket.")
        print("Complete the labeling step first (Label Studio or auto_label.py).")
        return

    # Load existing chunk mapping for incremental mode
    existing_mapping = load_existing_chunk_mapping() if incremental else {}
    existing_sources = {v["source"] for v in existing_mapping.values()}

    # Step 2: Chunk all documents (filter to new ones in incremental mode)
    print(f"\n{'='*50}")
    print("STEP 2: Chunking documents (512 tokens, 50 overlap)")
    print("=" * 50)

    new_chunks = []       # List of chunk text strings
    new_chunk_mapping = {}    # chunk_id → {text, source, labels}

    for doc in documents:
        # In incremental mode, skip documents already indexed
        if incremental and doc["source"] in existing_sources:
            continue

        chunks = chunk_text(doc["text"], chunk_size=512, overlap=50)
        for j, chunk in enumerate(chunks):
            if not is_chunk_useful(chunk):
                continue
            chunk_id = f"{doc['source']}_{j}"
            new_chunks.append(chunk)
            new_chunk_mapping[chunk_id] = {
                "text": chunk,
                "source": doc["source"],
                "labels": doc["labels"],
            }

    print(f"Created {len(new_chunks)} new chunks from {len(documents)} documents")
    if incremental:
        print(f"  (Skipped {len(existing_sources)} already-indexed sources)")

    if not new_chunks:
        print("No new chunks to index. Everything is up to date.")
        return

    # Step 3: Generate embeddings
    print(f"\n{'='*50}")
    print("STEP 3: Generating embeddings with text-embedding-005")
    print("=" * 50)
    embeddings = generate_embeddings(new_chunks)
    print(f"Generated {len(embeddings)} embeddings (768 dimensions each)")

    # Step 4: Get or create index
    if incremental:
        print(f"\n{'='*50}")
        print("STEP 4: Using existing Vector Search index")
        print("=" * 50)
        index_name = f"projects/{project_id}/locations/{region}/indexes/{existing_index_id}"
        index = aiplatform.MatchingEngineIndex(index_name=index_name)
        print(f"Index: {index.resource_name}")
    else:
        print(f"\n{'='*50}")
        print("STEP 4: Creating Vertex AI Vector Search index")
        print("=" * 50)
        index = create_vector_search_index(project_id, region)

    # Step 5: Upsert datapoints into the index
    print(f"\n{'='*50}")
    print("STEP 5: Uploading embeddings to the index")
    print("=" * 50)

    chunk_ids = list(new_chunk_mapping.keys())
    datapoints = []
    for chunk_id, embedding in zip(chunk_ids, embeddings):
        datapoints.append(
            aiplatform.compat.types.matching_engine_index.IndexDatapoint(
                datapoint_id=chunk_id,
                feature_vector=embedding,
            )
        )

    batch_size = 100
    for i in range(0, len(datapoints), batch_size):
        batch = datapoints[i : i + batch_size]
        index.upsert_datapoints(datapoints=batch)
        print(f"  Upserted batch {i // batch_size + 1} ({len(batch)} datapoints)")

    print(f"Total new datapoints indexed: {len(datapoints)}")

    # Step 6: Deploy (only for new indexes)
    if not incremental:
        print(f"\n{'='*50}")
        print("STEP 6: Deploying index to endpoint")
        print("=" * 50)
        endpoint = deploy_index_to_endpoint(index)
        endpoint_id = endpoint.resource_name.split("/")[-1]
        index_id = index.resource_name.split("/")[-1]
    else:
        print(f"\n{'='*50}")
        print("STEP 6: Skipping deployment (using existing endpoint)")
        print("=" * 50)
        index_id = existing_index_id
        endpoint_id = existing_endpoint_id

    # Step 7: Merge and save chunk mapping
    print(f"\n{'='*50}")
    print("STEP 7: Saving chunk mapping")
    print("=" * 50)
    merged_mapping = {**existing_mapping, **new_chunk_mapping}
    save_chunk_mapping(merged_mapping, bucket_name)

    # Summary
    print(f"\n{'='*50}")
    print("INDEXING COMPLETE")
    print("=" * 50)
    print(f"  New documents:       {len(documents) - len(existing_sources)}")
    print(f"  New chunks indexed:  {len(new_chunks)}")
    print(f"  Total chunks:        {len(merged_mapping)}")
    print(f"  Index ID:            {index_id}")
    print(f"  Endpoint ID:         {endpoint_id}")

    if not incremental:
        print()
        print("Add these to your .env file:")
        print(f"  VERTEX_AI_INDEX_ID={index_id}")
        print(f"  VERTEX_AI_INDEX_ENDPOINT_ID={endpoint_id}")

    print()
    print("You can now run: python query.py")


if __name__ == "__main__":
    main()
