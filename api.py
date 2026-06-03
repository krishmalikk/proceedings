"""
api.py — FastAPI Server for Proceedings RAG Pipeline
=====================================================
Exposes the RAG query engine as HTTP endpoints for the Next.js frontend.

USAGE:
  uvicorn api:app --reload --port 8000
"""

import os
import time
from collections import defaultdict
from contextlib import asynccontextmanager

import vertexai
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from google.cloud import aiplatform, firestore
from pydantic import BaseModel, Field

from query import (
    FALLBACK_MESSAGE,
    generate_direct_answer,
    get_recent_qa,
    load_chunk_mapping,
    query,
    save_qa_pair,
    update_feedback,
)

# ---------------------------------------------------------------------------
# Startup / Shutdown
# ---------------------------------------------------------------------------

# Module-level singletons, initialized at startup
_chunk_mapping: dict = {}
_db: firestore.Client = None
_endpoint_id: str = ""
_project_id: str = ""
_region: str = ""


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize Vertex AI, chunk mapping, and Firestore on startup."""
    global _chunk_mapping, _db, _endpoint_id, _project_id, _region

    load_dotenv()

    # Support both old and new env var names
    _project_id = os.getenv("GCP_PROJECT_ID") or os.getenv("GCP_PROJECT", "")
    _region = os.getenv("GCP_REGION") or os.getenv("GCP_LOCATION", "us-central1")
    bucket_name = os.getenv("GCP_BUCKET_NAME") or os.getenv("GCP_BUCKET", "law-firm-knowledge-base").replace("gs://", "")
    _endpoint_id = os.getenv("VERTEX_AI_INDEX_ENDPOINT_ID", "")

    if not _project_id:
        raise RuntimeError("GCP_PROJECT_ID or GCP_PROJECT must be set in environment")

    # If no Vector Search endpoint, we'll skip RAG and use a simpler flow
    if not _endpoint_id:
        print("Warning: VERTEX_AI_INDEX_ENDPOINT_ID not set. RAG retrieval disabled.")

    vertexai.init(project=_project_id, location=_region)
    aiplatform.init(project=_project_id, location=_region)

    # Try to load chunk mapping, but don't fail if not available
    try:
        _chunk_mapping = load_chunk_mapping(bucket_name)
        print(f"Loaded {len(_chunk_mapping)} chunks from {bucket_name}")
    except Exception as e:
        print(f"Warning: Could not load chunk mapping: {e}")
        _chunk_mapping = {}

    # Initialize Firestore
    try:
        _db = firestore.Client(project=_project_id)
    except Exception as e:
        print(f"Warning: Could not initialize Firestore: {e}")
        _db = None

    print(f"API ready: {len(_chunk_mapping)} chunks loaded, RAG={'enabled' if _endpoint_id else 'disabled'}")
    yield


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(title="Proceedings API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://*.vercel.app",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Simple rate limiter (in-memory, per IP)
# ---------------------------------------------------------------------------

_rate_limit: dict[str, list[float]] = defaultdict(list)
RATE_LIMIT_MAX = 10  # requests
RATE_LIMIT_WINDOW = 60  # seconds


def check_rate_limit(ip: str) -> bool:
    now = time.time()
    timestamps = _rate_limit[ip]
    # Remove old entries
    _rate_limit[ip] = [t for t in timestamps if now - t < RATE_LIMIT_WINDOW]
    if len(_rate_limit[ip]) >= RATE_LIMIT_MAX:
        return False
    _rate_limit[ip].append(now)
    return True


# ---------------------------------------------------------------------------
# Request / Response Models
# ---------------------------------------------------------------------------

class AskRequest(BaseModel):
    question: str = Field(..., min_length=5, max_length=500)


class SourceInfo(BaseModel):
    chunk_id: str
    text: str
    source: str
    labels: list[str]
    score: float


class AskResponse(BaseModel):
    answer: str
    sources: list[SourceInfo]
    is_fallback: bool
    id: str


class QAItem(BaseModel):
    id: str
    question: str
    answer: str
    sources: list[str]
    labels: list[str]
    created_at: str | None
    is_fallback: bool
    helpful: bool | None


class QAListResponse(BaseModel):
    items: list[QAItem]


class FeedbackRequest(BaseModel):
    helpful: bool


class HealthResponse(BaseModel):
    status: str
    chunks_loaded: int


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.post("/api/ask", response_model=AskResponse)
async def ask_question(body: AskRequest, request: Request):
    """Submit a question and get a RAG-powered answer."""
    client_ip = request.client.host if request.client else "unknown"
    if not check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Try again in a minute.")

    # If no Vector Search endpoint OR no chunks loaded, use direct Gemini (no RAG)
    if not _endpoint_id or not _chunk_mapping:
        answer = generate_direct_answer(body.question)
        result = {
            "answer": answer,
            "chunks": [],
            "is_fallback": False,  # Direct mode doesn't use fallback logic
        }
    else:
        result = query(body.question, _chunk_mapping, _endpoint_id, _project_id, _region)

    # Save to Firestore (if available)
    doc_id = ""
    if _db:
        try:
            doc_id = save_qa_pair(body.question, result, _db)
        except Exception as e:
            print(f"Warning: Could not save to Firestore: {e}")

    return AskResponse(
        answer=result["answer"],
        sources=[SourceInfo(**c) for c in result["chunks"]],
        is_fallback=result["is_fallback"],
        id=doc_id,
    )


@app.get("/api/qa", response_model=QAListResponse)
async def list_qa(limit: int = 20, offset: int = 0, category: str = ""):
    """List recent Q&A pairs, optionally filtered by category label."""
    if not _db:
        return QAListResponse(items=[])
    if limit > 50:
        limit = 50
    items = get_recent_qa(_db, limit=limit, offset=offset)

    qa_items = []
    for item in items:
        # Extract labels from retrieved_chunks
        labels = set()
        for chunk in item.get("retrieved_chunks", []):
            labels.update(chunk.get("labels", []))
        labels_list = sorted(labels)

        # Filter by category if specified
        if category and category not in labels_list:
            continue

        qa_items.append(QAItem(
            id=item["id"],
            question=item.get("question", ""),
            answer=item.get("answer", ""),
            sources=item.get("sources", []),
            labels=labels_list,
            created_at=item.get("created_at"),
            is_fallback=item.get("is_fallback", False),
            helpful=item.get("helpful"),
        ))

    return QAListResponse(items=qa_items)


@app.post("/api/qa/{doc_id}/feedback")
async def submit_feedback(doc_id: str, body: FeedbackRequest):
    """Submit feedback on a Q&A pair."""
    if not _db:
        return {"ok": False, "error": "Firestore not configured"}
    try:
        update_feedback(doc_id, body.helpful, _db)
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Q&A pair not found: {e}")


@app.get("/api/qa/stats")
async def qa_stats():
    """Get Q&A quality statistics."""
    if not _db:
        return {"total": 0, "successful": 0, "fallbacks": 0, "fallback_rate": 0, "helpful": 0, "not_helpful": 0, "top_categories": {}, "knowledge_gaps": []}

    from collections import Counter

    items = get_recent_qa(_db, limit=200, offset=0)
    total = len(items)
    fallbacks = [i for i in items if i.get("is_fallback")]
    successful = [i for i in items if not i.get("is_fallback")]

    # Label distribution
    all_labels = []
    for item in successful:
        for chunk in item.get("retrieved_chunks", []):
            all_labels.extend(chunk.get("labels", []))
    label_counts = dict(Counter(all_labels).most_common(20))

    # Feedback
    helpful = sum(1 for i in items if i.get("helpful") is True)
    not_helpful = sum(1 for i in items if i.get("helpful") is False)

    # Knowledge gaps
    gaps = [{"question": f.get("question", "")[:100]} for f in fallbacks[:10]]

    return {
        "total": total,
        "successful": len(successful),
        "fallbacks": len(fallbacks),
        "fallback_rate": len(fallbacks) / total if total > 0 else 0,
        "helpful": helpful,
        "not_helpful": not_helpful,
        "top_categories": label_counts,
        "knowledge_gaps": gaps,
    }


@app.get("/api/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return HealthResponse(
        status="ok",
        chunks_loaded=len(_chunk_mapping),
    )
