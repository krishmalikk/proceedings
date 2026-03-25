# query.py

**Stage:** 4 — Query / RAG
**Lines:** ~400
**Location:** `/query.py`

---

## Purpose

Core RAG module. Used by both the CLI (`main()`) and [[api.py]] (imports `query`, `load_chunk_mapping`, etc.).

---

## Functions

| Function | Description |
|----------|-------------|
| `load_chunk_mapping(bucket_name)` | Downloads `chunk_mapping.json` from GCS (caches locally) |
| `embed_query(query)` | Embeds query with `text-embedding-005` using `RETRIEVAL_QUERY` task type |
| `retrieve_chunks(query_embedding, ...)` | Queries Vector Search endpoint for top-5 neighbors |
| `build_prompt(question, context_chunks)` | Constructs the Gemini prompt with guardrails and numbered context chunks |
| `generate_answer(prompt)` | Calls Gemini 2.5 Flash via Vertex AI (temp=0.2, top_p=0.8, max_tokens=1024) |
| `query(question, ...)` | Full RAG pipeline, returns structured dict: `{answer, chunks, is_fallback}` |
| `save_qa_pair(question, result, db)` | Saves Q&A pair to Firestore |
| `get_recent_qa(db, limit, offset)` | Fetches recent Q&A pairs from Firestore |
| `update_feedback(doc_id, helpful, db)` | Updates feedback on a Q&A pair |
| `main()` | Interactive CLI loop with Firestore logging |

---

## Guardrails (in prompt)

The prompt explicitly instructs Gemini to:
- Only answer from provided context
- Return `FALLBACK_MESSAGE` when context is insufficient
- Never provide legal advice, eligibility determinations, or outcome predictions
- Suggest scheduling a consultation for case-specific questions
- Cite chunk numbers when possible

**Fallback message:** `"I don't have that information — please contact the firm directly."`

---

## Generation Config

Uses `genai.Client(vertexai=True)` — bills through GCP paid account, no free tier limits.

| Parameter | Value | Why |
|-----------|-------|-----|
| Model | `gemini-2.5-flash` | Fast, capable, via Vertex AI |
| `temperature` | 0.2 | Low for factual, grounded answers |
| `max_output_tokens` | 1024 | Enough for detailed answers |
| `top_p` | 0.8 | Slightly restricts sampling for consistency |

---

## Data Flow

```
User question → embed → Vector Search (top 5) → chunk_mapping lookup → Gemini prompt → answer
```

---

## Env Vars Required

- `GCP_PROJECT_ID`
- `GCP_REGION`
- `GCP_BUCKET_NAME`
- `VERTEX_AI_INDEX_ENDPOINT_ID`
