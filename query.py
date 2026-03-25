"""
query.py — RAG Query Engine for Proceedings Legal Intake Assistant
===================================================================
This script does three things:
  1. Takes a user's question
  2. Searches the Vertex AI Vector Search index for the 5 most relevant chunks
  3. Passes those chunks as context to Gemini Pro, which generates an answer

WHY THIS EXISTS:
In the old build, a local chatbot.py used LlamaIndex to query ChromaDB directly.
Now, the retrieval happens via Vertex AI Vector Search (cloud-hosted, scalable),
and the answer generation uses Gemini Pro via the Vertex AI SDK.

The key safety feature: the prompt instructs Gemini to ONLY answer from the provided
context. If the context doesn't contain the answer, it returns a fallback message
directing the user to contact the firm. This prevents hallucination — the assistant
never makes up legal information.

BEFORE RUNNING:
  1. Run index.py first to create the index and endpoint
  2. Copy the VERTEX_AI_INDEX_ID and VERTEX_AI_INDEX_ENDPOINT_ID into your .env
  3. Authenticate with GCP: gcloud auth application-default login

USAGE:
  python query.py
"""

import json
import os
import tempfile

import vertexai
from dotenv import load_dotenv
from google import genai
from google.cloud import aiplatform, firestore, storage
from vertexai.language_models import TextEmbeddingInput, TextEmbeddingModel


# The fallback message when the answer isn't in the context
FALLBACK_MESSAGE = "I don't have that information — please contact the firm directly."


# ---------------------------------------------------------------------------
# Chunk Mapping
# ---------------------------------------------------------------------------

def load_chunk_mapping(bucket_name: str) -> dict[str, dict]:
    """
    Download the chunk_mapping.json file from GCS.

    This file maps chunk IDs (returned by Vector Search) to the actual text
    content. It was created and uploaded by index.py.

    Returns a dict like:
      {'filename.json_0': {'text': '...', 'source': '...', 'labels': [...]}, ...}
    """
    # Check for a local cache first
    local_path = "chunk_mapping.json"
    if os.path.exists(local_path):
        print("Loading chunk mapping from local cache...")
        with open(local_path, "r", encoding="utf-8") as f:
            return json.load(f)

    # Download from GCS
    print(f"Downloading chunk mapping from gs://{bucket_name}/chunk_mapping.json...")
    client = storage.Client()
    bucket = client.bucket(bucket_name)
    blob = bucket.blob("chunk_mapping.json")

    with tempfile.NamedTemporaryFile(mode="w+b", delete=False, suffix=".json") as tmp:
        blob.download_to_filename(tmp.name)
        with open(tmp.name, "r", encoding="utf-8") as f:
            mapping = json.load(f)
        os.unlink(tmp.name)

    # Cache locally for faster subsequent runs
    with open(local_path, "w", encoding="utf-8") as f:
        json.dump(mapping, f, indent=2, ensure_ascii=False)

    print(f"Loaded {len(mapping)} chunks.")
    return mapping


# ---------------------------------------------------------------------------
# Query Embedding
# ---------------------------------------------------------------------------

def embed_query(query: str) -> list[float]:
    """
    Embed a single query string using the same text-embedding-005 model
    that was used during indexing.

    IMPORTANT: The query and the indexed documents MUST use the same
    embedding model. Using different models would produce incompatible
    vectors and retrieval would fail silently (returning irrelevant results).

    We use task_type="RETRIEVAL_QUERY" (vs "RETRIEVAL_DOCUMENT" during indexing)
    because the model optimizes the embedding differently for queries vs documents.
    """
    model = TextEmbeddingModel.from_pretrained("text-embedding-005")
    inputs = [TextEmbeddingInput(query, "RETRIEVAL_QUERY")]
    embeddings = model.get_embeddings(inputs)
    return embeddings[0].values


# ---------------------------------------------------------------------------
# Vector Search Retrieval
# ---------------------------------------------------------------------------

def retrieve_chunks(
    query_embedding: list[float],
    endpoint_id: str,
    project_id: str,
    region: str,
    top_k: int = 5,
) -> list[dict]:
    """
    Query the Vertex AI Vector Search endpoint for the most similar chunks.

    Returns a list of dicts with chunk_id and similarity score:
      [{'chunk_id': 'filename.json_0', 'score': 0.87}, ...]

    The results are sorted by relevance (highest score first).
    top_k=5 means we retrieve the 5 most relevant chunks.
    """
    endpoint = aiplatform.MatchingEngineIndexEndpoint(
        index_endpoint_name=endpoint_id,
        project=project_id,
        location=region,
    )

    response = endpoint.find_neighbors(
        deployed_index_id="legal_intake_deployed_v2",
        queries=[query_embedding],
        num_neighbors=top_k,
    )

    results = []
    for neighbor in response[0]:
        results.append({
            "chunk_id": neighbor.id,
            "score": neighbor.distance,
        })

    return results


# ---------------------------------------------------------------------------
# Prompt Construction
# ---------------------------------------------------------------------------

def build_prompt(question: str, context_chunks: list[str]) -> str:
    """
    Build the prompt for Gemini Pro with the retrieved context chunks.

    The prompt has three critical parts:
      1. ROLE: Tells Gemini it's a legal intake assistant
      2. GUARDRAILS: Explicitly forbids legal advice, eligibility determinations, etc.
         (These match the guardrails defined in documents/data-intake-checklist.md)
      3. CONTEXT + QUESTION: The retrieved chunks and the user's question

    The guardrails are essential for a legal application. Without them, the LLM
    might generate information that could be mistaken for legal advice.
    """
    # Number each chunk for clarity
    numbered_chunks = []
    for i, chunk in enumerate(context_chunks, 1):
        numbered_chunks.append(f"[Chunk {i}]\n{chunk}")

    context_text = "\n\n---\n\n".join(numbered_chunks)

    prompt = f"""You are a helpful legal intake assistant for a law firm. Your job is to answer questions based ONLY on the context provided below.

IMPORTANT RULES:
- Only use information from the provided context to answer the question.
- If the context does not contain enough information to answer the question, respond with exactly: "{FALLBACK_MESSAGE}"
- Do NOT provide legal advice, eligibility determinations, case assessments, or outcome predictions.
- If the user asks for legal advice or case-specific guidance, politely decline and suggest scheduling a consultation with an attorney.
- Be concise, accurate, and helpful.
- Do NOT reference chunk numbers or internal source labels in your answer. Sources are displayed separately.

CONTEXT:
---
{context_text}
---

QUESTION: {question}

ANSWER:"""

    return prompt


# ---------------------------------------------------------------------------
# Answer Generation
# ---------------------------------------------------------------------------

def generate_answer(prompt: str) -> str:
    """
    Send the prompt to Gemini and return the generated answer.

    Uses the Google GenAI SDK in Vertex AI mode, which bills through the
    GCP project (paid account) instead of the free-tier API key.

    Configuration:
      - temperature=0.2: Very low to keep answers factual and grounded
        in the context. Higher values would risk hallucination.
      - max_output_tokens=1024: Enough for a detailed answer, but prevents
        runaway generation.
    """
    try:
        project_id = os.getenv("GCP_PROJECT_ID")
        region = os.getenv("GCP_REGION", "us-central1")

        client = genai.Client(
            vertexai=True,
            project=project_id,
            location=region,
        )
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=genai.types.GenerateContentConfig(
                temperature=0.2,
                max_output_tokens=1024,
                top_p=0.8,
            ),
        )
        return response.text
    except Exception as e:
        print(f"Error generating answer: {e}")
        return FALLBACK_MESSAGE


# ---------------------------------------------------------------------------
# Full Query Pipeline
# ---------------------------------------------------------------------------

def query(
    question: str,
    chunk_mapping: dict[str, dict],
    endpoint_id: str,
    project_id: str,
    region: str,
) -> dict:
    """
    Full RAG pipeline for a single question:
      1. Embed the question
      2. Retrieve top 5 matching chunks from Vector Search
      3. Look up the actual chunk text from the mapping
      4. Build a prompt with context
      5. Generate an answer with Gemini Pro

    Returns a structured dict:
      {
        "answer": str,
        "chunks": [{"chunk_id": str, "text": str, "source": str, "labels": list, "score": float}],
        "is_fallback": bool
      }
    """
    fallback_result = {
        "answer": FALLBACK_MESSAGE,
        "chunks": [],
        "is_fallback": True,
    }

    # Step 1: Embed the question
    query_embedding = embed_query(question)

    # Step 2: Retrieve similar chunks
    results = retrieve_chunks(query_embedding, endpoint_id, project_id, region)

    if not results:
        return fallback_result

    # Step 3: Look up chunk text and build enriched chunk list
    context_chunks = []
    enriched_chunks = []
    for result in results:
        chunk_data = chunk_mapping.get(result["chunk_id"])
        if chunk_data:
            context_chunks.append(chunk_data["text"])
            enriched_chunks.append({
                "chunk_id": result["chunk_id"],
                "text": chunk_data["text"][:500],
                "source": chunk_data.get("source", ""),
                "labels": chunk_data.get("labels", []),
                "score": result["score"],
            })

    if not context_chunks:
        return fallback_result

    # Step 4: Build prompt
    prompt = build_prompt(question, context_chunks)

    # Step 5: Generate answer
    answer = generate_answer(prompt)
    is_fallback = answer.strip() == FALLBACK_MESSAGE

    return {
        "answer": answer,
        "chunks": enriched_chunks,
        "is_fallback": is_fallback,
    }


# ---------------------------------------------------------------------------
# Firestore Q&A Storage
# ---------------------------------------------------------------------------

def save_qa_pair(question: str, result: dict, db: firestore.Client) -> str:
    """
    Save a question-answer pair to Firestore. Returns the document ID.
    """
    doc = {
        "question": question,
        "answer": result["answer"],
        "retrieved_chunks": result["chunks"],
        "sources": list({c["source"] for c in result["chunks"]}),
        "created_at": firestore.SERVER_TIMESTAMP,
        "is_fallback": result["is_fallback"],
        "helpful": None,
    }
    _, doc_ref = db.collection("qa_pairs").add(doc)
    return doc_ref.id


def get_recent_qa(db: firestore.Client, limit: int = 20, offset: int = 0) -> list[dict]:
    """
    Fetch recent Q&A pairs from Firestore, ordered by newest first.
    """
    query_ref = (
        db.collection("qa_pairs")
        .order_by("created_at", direction=firestore.Query.DESCENDING)
        .offset(offset)
        .limit(limit)
    )
    docs = []
    for doc in query_ref.stream():
        data = doc.to_dict()
        data["id"] = doc.id
        # Convert Firestore timestamp to ISO string for JSON serialization
        if data.get("created_at"):
            data["created_at"] = data["created_at"].isoformat()
        docs.append(data)
    return docs


def update_feedback(doc_id: str, helpful: bool, db: firestore.Client) -> None:
    """
    Update the feedback field on a Q&A pair.
    """
    db.collection("qa_pairs").document(doc_id).update({
        "helpful": helpful,
        "feedback_at": firestore.SERVER_TIMESTAMP,
    })


# ---------------------------------------------------------------------------
# Main (Interactive CLI)
# ---------------------------------------------------------------------------

def main():
    # Load environment variables
    load_dotenv()

    project_id = os.getenv("GCP_PROJECT_ID")
    region = os.getenv("GCP_REGION", "us-central1")
    bucket_name = os.getenv("GCP_BUCKET_NAME", "law-firm-knowledge-base")
    endpoint_id = os.getenv("VERTEX_AI_INDEX_ENDPOINT_ID")

    # Validate required env vars
    missing = []
    if not project_id:
        missing.append("GCP_PROJECT_ID")
    if not endpoint_id:
        missing.append("VERTEX_AI_INDEX_ENDPOINT_ID")

    if missing:
        print("Error: Missing required environment variables in .env:")
        for var in missing:
            print(f"  - {var}")
        print("\nRun index.py first to create the index and endpoint.")
        return

    # Initialize Vertex AI
    vertexai.init(project=project_id, location=region)
    aiplatform.init(project=project_id, location=region)

    # Load the chunk mapping (maps chunk IDs → actual text)
    chunk_mapping = load_chunk_mapping(bucket_name)

    # Initialize Firestore for Q&A logging
    db = firestore.Client(project=project_id)

    # Interactive query loop
    print()
    print("=" * 50)
    print("Proceedings Legal Intake Assistant")
    print("=" * 50)
    print("Ask a question about immigration law, visa processes, etc.")
    print("Type 'quit' or 'exit' to stop.\n")

    while True:
        try:
            question = input("You: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nGoodbye!")
            break

        if not question:
            continue

        if question.lower() in ("quit", "exit", "q"):
            print("Goodbye!")
            break

        print("\nSearching knowledge base...")
        result = query(question, chunk_mapping, endpoint_id, project_id, region)
        print(f"\nAssistant: {result['answer']}\n")

        # Log to Firestore
        try:
            doc_id = save_qa_pair(question, result, db)
            print(f"  (Saved as {doc_id})\n")
        except Exception as e:
            print(f"  (Warning: Could not save to Firestore: {e})\n")


if __name__ == "__main__":
    main()
