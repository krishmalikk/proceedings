"""
query.py — Q&A persistence + direct-Gemini fallback for the Proceedings API
===========================================================================
Grounded retrieval now lives in `search_client.py` (managed Vertex AI Search
Answer API over `imm-postings-datastore`, per D-016/D-034/D-039). This module
retains only what `api.py` still imports:

  - generate_direct_answer(): a non-grounded Gemini answer, used only when the
    Search engine isn't configured.
  - save_qa_pair() / get_recent_qa() / update_feedback(): the Firestore Q&A log
    (history + feedback + analytics source).

The self-managed Vector Search path (embedding, chunking, find_neighbors,
chunk_mapping, the interactive CLI) was retired with the Vector Search index —
see ARCHITECTURE_GAP_reddit-grounding.md and MEMORY.md D-039.
"""

import os

from google import genai
from google.cloud import firestore


# The fallback message when the answer isn't grounded in the datastore.
FALLBACK_MESSAGE = "I don't have that information — please contact the firm directly."


# ---------------------------------------------------------------------------
# Direct Gemini answer (non-grounded fallback)
# ---------------------------------------------------------------------------

def generate_direct_answer(question: str) -> str:
    """
    Generate an answer directly from Gemini without grounding context.

    Used only when no Search engine is configured. This prompt allows Gemini to
    answer from its general knowledge about US immigration, without the strict
    "only answer from context" guardrails.
    """
    prompt = f"""You are a helpful assistant specializing in US immigration law and policy.

Answer the following question about US immigration. Provide accurate, helpful information based on your knowledge.

IMPORTANT RULES:
- Provide factual information about eligibility requirements, application processes, fees, timelines, and legal definitions.
- Do NOT provide case-specific legal advice or assess whether a specific person qualifies.
- If asked about a specific situation, suggest consulting an immigration attorney while still sharing general information.
- Use bullet points when listing steps, requirements, or multiple items.
- Keep answers concise but thorough — aim for 2-4 paragraphs.
- Bold key terms using **bold**.

QUESTION: {question}

ANSWER:"""

    try:
        project_id = os.getenv("GCP_PROJECT_ID") or os.getenv("GCP_PROJECT")
        region = os.getenv("GCP_REGION") or os.getenv("GCP_GEMINI_LOCATION", "us-central1")

        client = genai.Client(
            vertexai=True,
            project=project_id,
            location=region,
        )
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=genai.types.GenerateContentConfig(
                temperature=0.3,
                max_output_tokens=1024,
                top_p=0.8,
            ),
        )
        return response.text
    except Exception as e:
        print(f"Error generating direct answer: {e}")
        return "I'm having trouble processing your question right now. Please try again later."


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
