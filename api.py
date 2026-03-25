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

    _project_id = os.getenv("GCP_PROJECT_ID", "")
    _region = os.getenv("GCP_REGION", "us-central1")
    bucket_name = os.getenv("GCP_BUCKET_NAME", "law-firm-knowledge-base")
    _endpoint_id = os.getenv("VERTEX_AI_INDEX_ENDPOINT_ID", "")

    if not _project_id or not _endpoint_id:
        raise RuntimeError("GCP_PROJECT_ID and VERTEX_AI_INDEX_ENDPOINT_ID must be set in .env")

    vertexai.init(project=_project_id, location=_region)
    aiplatform.init(project=_project_id, location=_region)

    _chunk_mapping = load_chunk_mapping(bucket_name)
    _db = firestore.Client(project=_project_id)

    print(f"API ready: {len(_chunk_mapping)} chunks loaded")
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

    result = query(body.question, _chunk_mapping, _endpoint_id, _project_id, _region)

    # Save to Firestore
    try:
        doc_id = save_qa_pair(body.question, result, _db)
    except Exception as e:
        print(f"Warning: Could not save to Firestore: {e}")
        doc_id = ""

    return AskResponse(
        answer=result["answer"],
        sources=[SourceInfo(**c) for c in result["chunks"]],
        is_fallback=result["is_fallback"],
        id=doc_id,
    )


@app.get("/api/qa", response_model=QAListResponse)
async def list_qa(limit: int = 20, offset: int = 0):
    """List recent Q&A pairs."""
    if limit > 50:
        limit = 50
    items = get_recent_qa(_db, limit=limit, offset=offset)
    return QAListResponse(
        items=[
            QAItem(
                id=item["id"],
                question=item.get("question", ""),
                answer=item.get("answer", ""),
                sources=item.get("sources", []),
                created_at=item.get("created_at"),
                is_fallback=item.get("is_fallback", False),
                helpful=item.get("helpful"),
            )
            for item in items
        ]
    )


@app.post("/api/qa/{doc_id}/feedback")
async def submit_feedback(doc_id: str, body: FeedbackRequest):
    """Submit feedback on a Q&A pair."""
    try:
        update_feedback(doc_id, body.helpful, _db)
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Q&A pair not found: {e}")


@app.get("/api/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return HealthResponse(
        status="ok",
        chunks_loaded=len(_chunk_mapping),
    )
