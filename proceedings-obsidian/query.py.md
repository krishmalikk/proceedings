# query.py

**Stage:** 4 — Query / RAG
**Lines:** 337
**Location:** `/query.py`

---

## Purpose

Interactive CLI that takes a user question, retrieves the 5 most relevant chunks from Vector Search, and generates an answer via Gemini Pro with strict legal guardrails.

---

## Functions

| Function | Description |
|----------|-------------|
| `load_chunk_mapping(bucket_name)` | Downloads `chunk_mapping.json` from GCS (caches locally) |
| `embed_query(query)` | Embeds query with `text-embedding-005` using `RETRIEVAL_QUERY` task type |
| `retrieve_chunks(query_embedding, ...)` | Queries Vector Search endpoint for top-5 neighbors |
| `build_prompt(question, context_chunks)` | Constructs the Gemini prompt with guardrails and numbered context chunks |
| `generate_answer(prompt)` | Calls `gemini-2.0-pro` (temp=0.2, top_p=0.8, max_tokens=1024) |
| `query(question, ...)` | Full RAG pipeline: embed → retrieve → build prompt → generate |
| `main()` | Interactive loop (type question, get answer, "quit" to exit) |

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

| Parameter | Value | Why |
|-----------|-------|-----|
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
