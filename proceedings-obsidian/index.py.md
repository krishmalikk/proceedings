# index.py

**Stage:** 3 — Indexing
**Lines:** 419
**Location:** `/index.py`

---

## Purpose

Downloads labeled Markdown from GCS `/labeled/` subfolder, chunks text into ~512-token pieces, generates embeddings via Vertex AI, creates a Vector Search index, and uploads everything.

---

## Functions

| Function | Description |
|----------|-------------|
| `download_labeled_files(bucket_name)` | Downloads from `gs://bucket/labeled/`, parses Label Studio JSON or plain Markdown |
| `chunk_text(text, chunk_size=512, overlap=50)` | Token-based chunking using tiktoken `cl100k_base` encoder |
| `generate_embeddings(texts, batch_size=250)` | Batch embedding via `text-embedding-005` with `RETRIEVAL_DOCUMENT` task type |
| `create_vector_search_index(project_id, region)` | Creates Tree-AH index (768-dim, DOT_PRODUCT, SMALL shard) |
| `deploy_index_to_endpoint(index)` | Creates endpoint and deploys index (takes 20-30 min) |
| `save_chunk_mapping(mapping, bucket_name)` | Saves chunk ID → text mapping locally and to GCS |
| `main()` | 7-step orchestration pipeline |

---

## Pipeline Steps (in `main()`)

1. Download labeled files from GCS
2. Chunk documents (512 tokens, 50 overlap)
3. Generate embeddings with `text-embedding-005`
4. Create Vertex AI Vector Search index
5. Upsert datapoints (batches of 100)
6. Deploy index to endpoint
7. Save `chunk_mapping.json`

---

## Data Flow

```
GCS /labeled/ → chunk → embed → Vertex AI Vector Search index
                                  + chunk_mapping.json → GCS
```

---

## Key Details

- **Embedding model:** `text-embedding-005` — 768 dimensions
- **Chunking:** 512 tokens with 50-token overlap, using `cl100k_base` tokenizer
- **Index config:** Tree-AH, DOT_PRODUCT distance, SMALL shard, STREAM_UPDATE
- **Batch sizes:** 250 for embeddings, 100 for upserts

---

## Dependencies

- `tiktoken` — Token counting and chunking
- `vertexai` — Embedding model
- `google-cloud-aiplatform` — Vector Search index/endpoint
- `google-cloud-storage` — GCS operations

---

## Output

Prints `VERTEX_AI_INDEX_ID` and `VERTEX_AI_INDEX_ENDPOINT_ID` to add to `.env` for [[query.py]].
