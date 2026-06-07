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
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from google.api_core.exceptions import GoogleAPICallError
from google.cloud import firestore
from pydantic import BaseModel, Field

from query import (
    FALLBACK_MESSAGE,
    classify_intent,
    generate_direct_answer,
    get_recent_qa,
    save_qa_pair,
    update_feedback,
)
from search_client import (
    answer_query,
    get_posting,
    search_postings,
    search_with_strictness,
    suggested_filters,
)

# ---------------------------------------------------------------------------
# Startup / Shutdown
# ---------------------------------------------------------------------------

# Module-level singletons, initialized at startup
_db: firestore.Client = None
_engine_id: str = ""
_public_engine_id: str = ""
_datastore_id: str = "imm-postings-datastore"
_ds_location: str = "global"
_project_id: str = ""
_region: str = ""


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize Vertex AI Search grounding + Firestore on startup.

    Grounding is served by the managed Discovery Engine Search/Answer API over
    `imm-postings-datastore` (D-016/D-034/D-039) — not the retired self-managed
    Vector Search index.
    """
    global _db, _engine_id, _public_engine_id, _datastore_id, _ds_location, _project_id, _region

    load_dotenv()

    # Support both old and new env var names
    _project_id = os.getenv("GCP_PROJECT_ID") or os.getenv("GCP_PROJECT", "")
    _region = os.getenv("GCP_REGION") or os.getenv("GCP_LOCATION", "us-central1")
    _engine_id = os.getenv("GCP_VERTEX_SEARCH_APP_ID", "imm-postings-search-app")
    _datastore_id = os.getenv("GCP_VERTEX_DATASTORE_ID", "imm-postings-datastore")
    # DS-2 public-reference engine (D-039 tier 3). Off until the website data
    # store finishes indexing; set GCP_VERTEX_PUBLIC_ENGINE_ID to enable.
    _public_engine_id = os.getenv("GCP_VERTEX_PUBLIC_ENGINE_ID", "")
    _ds_location = os.getenv("GCP_VERTEX_DATASTORE_LOCATION", "global")

    if not _project_id:
        raise RuntimeError("GCP_PROJECT_ID or GCP_PROJECT must be set in environment")

    if not _engine_id:
        print("Warning: GCP_VERTEX_SEARCH_APP_ID not set. Grounded search disabled; using direct Gemini.")

    # Vertex AI init is still needed for the direct-Gemini fallback path.
    vertexai.init(project=_project_id, location=_region)

    # Initialize Firestore
    try:
        _db = firestore.Client(project=_project_id)
    except Exception as e:
        print(f"Warning: Could not initialize Firestore: {e}")
        _db = None

    print(f"API ready: grounding={'enabled' if _engine_id else 'disabled'} "
          f"(engine={_engine_id}, location={_ds_location}, "
          f"public_tier={'on:' + _public_engine_id if _public_engine_id else 'off'})")
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


class ExpertRequest(BaseModel):
    question: str = Field(..., min_length=3, max_length=500)
    history: list[dict] = []  # prior [{role, content}] turns for follow-ups


class ExpertResponse(BaseModel):
    answer: str


# --- Posting composer (phase-H) ---
class TagSuggestRequest(BaseModel):
    title: str = Field(..., min_length=3, max_length=300)
    description: str = Field(..., min_length=10, max_length=8000)


class TagGroups(BaseModel):
    visa_applying_for: list[str] = []
    current_visa_or_greencard_category: list[str] = []
    primary_consulate: str = ""
    consulates: list[str] = []
    tags: list[str] = []
    concerns_or_questions_tags: list[str] = []


class TagSuggestResponse(BaseModel):
    groups: TagGroups
    relevant_sections: list[str] = []
    posting_type: str = ""
    key_stages_or_info: dict[str, str] = {}
    key_dates: dict[str, str] = {}


class PostingCreateRequest(BaseModel):
    title: str = Field(..., min_length=3, max_length=300)
    description: str = Field(..., min_length=10, max_length=8000)
    tags: TagGroups = TagGroups()
    key_stages_or_info: dict[str, str] = {}
    key_dates: dict[str, str] = {}


class PostingCreateResponse(BaseModel):
    case_id: str
    gcs_path: str
    indexed: bool
    author_handle: str


# --- User profile + onboarding (phase-I) ---
class SeedUser(BaseModel):
    id: str
    username: str
    label: str = ""


class JourneyEntry(BaseModel):
    milestone: str = ""
    date: str = ""
    experience: str = ""
    shared: bool = False          # phase-J: consent to make this experience searchable
    experience_case_id: str = ""  # the published searchable doc id (set by the backend)


class ReconcileRequest(BaseModel):
    # The in-progress message/posting being composed (canonical fields or description).
    message: dict = {}


class ReconcileResponse(BaseModel):
    merged: dict
    conflicts: list[dict] = []
    prefilled: list[str] = []
    explainer: str = ""


class ConnectCardRequest(BaseModel):
    note: str = Field("", max_length=2000)


class ContentPublishResponse(BaseModel):
    case_id: str
    doc_kind: str
    gcs_path: str
    indexed: bool


class ProfilePayload(BaseModel):
    username: str = ""
    current_visa_or_greencard_category: list[str] = []
    visa_applying_for: list[str] = []
    primary_consulate: str = ""
    consulates: list[str] = []
    key_stages_or_info: dict[str, str] = {}
    key_dates: dict[str, str] = {}
    background_text: str = ""
    journey: list[JourneyEntry] = []


class OnboardRequest(BaseModel):
    messages: list[dict] = []
    draft: ProfilePayload = ProfilePayload()
    stage: str = "basics"  # 'basics' (Stage 1) | 'experiences' (Stage 2, post-save)


class OnboardResponse(BaseModel):
    reply: str
    profile: dict
    done: bool


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


class PostingCard(BaseModel):
    case_id: str
    title: str
    description: str
    visa: list[str]
    consulates: list[str]
    outcome: str
    subreddit: str
    channel: str
    tags: list[str]
    url: str
    date: str


class FacetValue(BaseModel):
    code: str
    label: str
    count: int


class SuggestedFilter(BaseModel):
    key: str
    label: str
    field: str
    values: list[FacetValue]


class SearchResponse(BaseModel):
    results: list[PostingCard]
    next_page_token: str
    total: int
    applied_filters: dict = {}
    relaxed: bool = False
    effective_strictness: str = ""
    suggested_filters: list[SuggestedFilter] = []


class PostingDetail(PostingCard):
    body: str


class ChatRequest(BaseModel):
    question: str = Field(..., min_length=5, max_length=500)
    strictness: str = "balanced"  # broad | balanced | strict
    facets: list[str] = []  # selected chips, each 'field:value' (exact filter)


class ChatResponse(BaseModel):
    mode: str  # "answer" | "search"
    intent: str
    answer: str = ""
    sources: list[SourceInfo] = []
    is_fallback: bool = False
    results: list[PostingCard] = []
    next_page_token: str = ""
    applied_filters: dict = {}
    relaxed: bool = False
    effective_strictness: str = ""
    suggested_filters: list[SuggestedFilter] = []
    id: str = ""


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

def _grounded_answer(question: str) -> dict:
    """Grounded answer over the datastore (tier 1+2), with the public DS-2
    fallback (tier 3) when ingested content can't answer. Falls back to direct
    Gemini only if no search engine is configured."""
    if not _engine_id:
        return {"answer": generate_direct_answer(question), "chunks": [], "is_fallback": False}
    result = answer_query(question, _project_id, _ds_location, _engine_id)
    if result["is_fallback"] and _public_engine_id:
        public = answer_query(question, _project_id, _ds_location, _public_engine_id)
        if not public["is_fallback"]:
            result = public
    return result


def _save(question: str, result: dict) -> str:
    if not _db:
        return ""
    try:
        return save_qa_pair(question, result, _db)
    except Exception as e:
        print(f"Warning: Could not save to Firestore: {e}")
        return ""


def _guard(fn):
    """Run a grounding call; turn a persistent GCP/network error into a clean
    503 instead of a 500 traceback (transient blips are already retried)."""
    try:
        return fn()
    except GoogleAPICallError as e:
        print(f"Grounding service error: {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=503,
            detail="The assistant is temporarily unavailable. Please try again in a moment.",
        )


# Dev-only user impersonation via X-User-Id. When real auth lands this is turned
# off and the uid comes only from a verified Firebase token (same users/{id} schema).
ALLOW_USER_IMPERSONATION = os.getenv("ALLOW_USER_IMPERSONATION", "1") == "1"


def _active_user(request: Request) -> str:
    """Resolve the active baked user id from the X-User-Id header (dev impersonation)."""
    import profile
    if not ALLOW_USER_IMPERSONATION:
        raise HTTPException(status_code=403, detail="User impersonation is disabled.")
    uid = request.headers.get("x-user-id", "").strip()
    if not uid:
        raise HTTPException(status_code=400, detail="X-User-Id header is required (pick a user).")
    if uid not in profile.seed_ids():
        raise HTTPException(status_code=404, detail=f"Unknown user '{uid}'.")
    return uid


@app.post("/api/ask", response_model=AskResponse)
async def ask_question(body: AskRequest, request: Request):
    """Submit a question and get a RAG-powered answer."""
    client_ip = request.client.host if request.client else "unknown"
    if not check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Try again in a minute.")

    result = _guard(lambda: _grounded_answer(body.question))
    doc_id = _save(body.question, result)

    return AskResponse(
        answer=result["answer"],
        sources=[SourceInfo(**c) for c in result["chunks"]],
        is_fallback=result["is_fallback"],
        id=doc_id,
    )


@app.post("/api/expert", response_model=ExpertResponse)
async def expert(body: ExpertRequest, request: Request):
    """A US-immigration-expert answer from Gemini's general knowledge — NOT
    grounded on the ingested postings (the 'AI mode' panel). Supports follow-ups
    via the optional conversation history."""
    client_ip = request.client.host if request.client else "unknown"
    if not check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Try again in a minute.")

    question = body.question
    if body.history:
        convo = "\n".join(
            f"{str(t.get('role', 'user')).capitalize()}: {t.get('content', '')}"
            for t in body.history[-6:]
        )
        question = f"Conversation so far:\n{convo}\n\nFollow-up question: {body.question}"

    return ExpertResponse(answer=_guard(lambda: generate_direct_answer(question)))


@app.post("/api/tag-suggest", response_model=TagSuggestResponse)
async def tag_suggest(body: TagSuggestRequest, request: Request):
    """Auto-derive controlled-vocabulary tags from the composer's title+description,
    plus the expert-curated set of relevant sections to show. Pure read; no side effects."""
    client_ip = request.client.host if request.client else "unknown"
    if not check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Try again in a minute.")

    import posting

    out = _guard(lambda: posting.suggest_tags(body.title, body.description))
    return TagSuggestResponse(
        groups=TagGroups(**out["groups"]),
        relevant_sections=out["relevant_sections"],
        posting_type=out["posting_type"],
        key_stages_or_info=out.get("key_stages_or_info", {}),
        key_dates=out.get("key_dates", {}),
    )


@app.get("/api/tag-vocab")
async def tag_vocab():
    """Controlled vocabularies (visa / consulate / tag) for the composer's
    add-tag autocomplete. Static; safe to cache on the client."""
    import posting

    return posting.vocab_lists()


@app.post("/api/postings", response_model=PostingCreateResponse)
async def create_posting(body: PostingCreateRequest, request: Request):
    """Publish a new posting: build canonical sidecar JSON → write GCS sidecar →
    documents.import into DS-1 → BigQuery row. Returns the new case_id."""
    client_ip = request.client.host if request.client else "unknown"
    if not check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Try again in a minute.")

    import posting

    try:
        result = _guard(lambda: posting.publish_posting(
            body.title, body.description, body.tags.model_dump(),
            body.key_stages_or_info, body.key_dates,
        ))
    except ValueError as e:
        # vocabulary / schema validation failure → 422
        raise HTTPException(status_code=422, detail=f"Posting failed validation: {e}")
    return PostingCreateResponse(**result)


# ---------------------------------------------------------------------------
# User profile + AI onboarding (phase-I)
# ---------------------------------------------------------------------------

@app.get("/api/users", response_model=list[SeedUser])
async def list_users():
    """The baked seed roster for the dev user-picker (no auth yet)."""
    import profile
    return [SeedUser(**u) for u in profile.seed_users()]


@app.get("/api/profile")
async def get_profile(request: Request):
    """The active user's profile (empty shell if not yet set up)."""
    import profile
    uid = _active_user(request)
    return _guard(lambda: profile.get_profile(_db, uid))


@app.put("/api/profile")
async def put_profile(body: ProfilePayload, request: Request):
    """Validate + save the active user's profile. Returns the stored profile."""
    import profile
    uid = _active_user(request)
    return _guard(lambda: profile.save_profile(_db, uid, body.model_dump()))


@app.post("/api/onboard", response_model=OnboardResponse)
async def onboard(body: OnboardRequest, request: Request):
    """One AI-onboarding turn: expert bot message + updated validated draft + done flag."""
    client_ip = request.client.host if request.client else "unknown"
    if not check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Try again in a minute.")
    import profile
    uid = _active_user(request)
    draft = body.draft.model_dump()
    if not draft.get("username"):
        draft["username"] = profile.username_for(uid)
    stage = "experiences" if body.stage == "experiences" else "basics"
    out = _guard(lambda: profile.onboard_turn(body.messages, draft, stage))
    return OnboardResponse(**out)


@app.post("/api/reconcile", response_model=ReconcileResponse)
async def reconcile(body: ReconcileRequest, request: Request):
    """Phase-J (D-042): merge the active user's saved profile with an in-progress
    message → reconciled field values + conflicts + a friendly 'update profile?' prompt.
    The profile is never indexed; this only shapes the single posting JSON."""
    import profile
    import reconcile as rc
    uid = _active_user(request)
    prof = _guard(lambda: profile.get_profile(_db, uid))
    out = rc.reconcile_profile_message(prof, body.message or {})
    explainer = rc.explain_conflicts(out["conflicts"]) if out["conflicts"] else ""
    return ReconcileResponse(merged=out["merged"], conflicts=out["conflicts"],
                             prefilled=out["prefilled"], explainer=explainer)


@app.post("/api/connect-card", response_model=ContentPublishResponse)
async def connect_card(body: ConnectCardRequest, request: Request):
    """Phase-J: publish an explicit 'looking to connect' card (doc_kind=connect_card)
    from the active user's current profile state."""
    client_ip = request.client.host if request.client else "unknown"
    if not check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Try again in a minute.")
    import posting
    import profile
    uid = _active_user(request)
    prof = _guard(lambda: profile.get_profile(_db, uid))
    if not (prof.get("current_visa_or_greencard_category") or prof.get("visa_applying_for")):
        raise HTTPException(status_code=422, detail="Set up your profile (a visa/status) before publishing a connect card.")
    return ContentPublishResponse(**_guard(lambda: posting.publish_connect_card(prof, body.note)))


@app.post("/api/chat", response_model=ChatResponse)
async def chat(body: ChatRequest, request: Request):
    """Conversational turn: routes to a synthesized answer (ask) or a ranked
    list of posting cards (search), based on classified intent. `strictness`
    (broad|balanced|strict) controls search precision."""
    client_ip = request.client.host if request.client else "unknown"
    if not check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Try again in a minute.")

    intent = classify_intent(body.question)

    if intent == "search" and _engine_id:
        data = _guard(lambda: search_with_strictness(
            body.question, _project_id, _ds_location, _engine_id,
            page_size=10, strictness=body.strictness,
            extra_filter=_facets_filter(body.facets),
        ))
        # If search found nothing, fall through to an answer rather than an empty list.
        if data["results"]:
            return ChatResponse(
                mode="search",
                intent=intent,
                results=[PostingCard(**c) for c in data["results"]],
                next_page_token=data["next_page_token"],
                applied_filters=data.get("applied_filters", {}),
                relaxed=data.get("relaxed", False),
                effective_strictness=data.get("effective_strictness", ""),
                suggested_filters=[SuggestedFilter(**g) for g in _suggest(body.question)],
            )

    result = _guard(lambda: _grounded_answer(body.question))
    doc_id = _save(body.question, result)
    return ChatResponse(
        mode="answer",
        intent=intent,
        answer=result["answer"],
        sources=[SourceInfo(**c) for c in result["chunks"]],
        is_fallback=result["is_fallback"],
        # Situation-relevant refinements even on an answer turn (e.g. "see related
        # experiences: RFE / Denial / Premium processing").
        suggested_filters=[SuggestedFilter(**g) for g in _suggest(body.question)],
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


def _suggest(query: str) -> list:
    """Context-aware refinement facets (best-effort; never breaks search)."""
    if not _engine_id:
        return []
    try:
        return suggested_filters(query, _project_id, _ds_location, _engine_id)
    except Exception as e:  # noqa: BLE001
        print(f"suggested_filters failed: {e}")
        return []


def _build_filter(visa: str, consulate: str, outcome: str) -> str:
    """Build a Discovery Engine filter expression from optional facet params."""
    clauses = []
    if visa:
        clauses.append(f'visa_applying_for: ANY("{visa}")')
    if consulate:
        clauses.append(f'consulates: ANY("{consulate}")')
    if outcome:
        clauses.append(f'key_stages_or_info.outcome_status: ANY("{outcome}")')
    return " AND ".join(clauses)


def _facets_filter(facets: list[str]) -> str:
    """Hard filter from selected chips. Each item is 'field:value' (field from the
    suggested_filters response). ANDed; values on the same field are ORed."""
    by_field: dict[str, list[str]] = {}
    for item in facets or []:
        if ":" not in item:
            continue
        field, value = item.split(":", 1)
        field, value = field.strip(), value.strip()
        # allow only known facet fields (avoid arbitrary filter injection)
        if field in {"consulates", "visa_applying_for", "current_visa_or_greencard_category",
                     "key_stages_or_info.outcome_status", "tags", "concerns_or_questions_tags",
                     "derived_topic_cluster"} and value:
            by_field.setdefault(field, []).append(value)
    clauses = []
    for field, values in by_field.items():
        ors = " OR ".join(f'{field}: ANY("{v}")' for v in values)
        clauses.append(f"({ors})")
    return " AND ".join(clauses)


@app.get("/api/search", response_model=SearchResponse)
async def search(
    request: Request,
    q: str = "",
    visa: str = "",
    consulate: str = "",
    outcome: str = "",
    strictness: str = "balanced",
    facet: list[str] = Query(default=[]),
    page_size: int = 10,
    page_token: str = "",
):
    """Ranked posting search (result cards). Browse/search mode, not Q&A.

    Explicit `visa`/`consulate`/`outcome` params and selected `facet` chips
    ('field:value') apply exact filters. `strictness` (broad|balanced|strict)
    controls how the NL query's extracted facets are applied."""
    client_ip = request.client.host if request.client else "unknown"
    if not check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Try again in a minute.")
    if not _engine_id:
        return SearchResponse(results=[], next_page_token="", total=0)

    page_size = max(1, min(page_size, 50))
    query = q or "immigration experience"
    selected = _facets_filter(facet)

    explicit = _build_filter(visa, consulate, outcome)
    hard = " AND ".join(e for e in (explicit, selected) if e)
    if hard:
        data = search_postings(query, _project_id, _ds_location, _engine_id,
                               page_size=page_size, page_token=page_token, filter_expr=hard)
        explicit_filters = {k: v for k, v in {
            "consulate": [consulate] if consulate else [],
            "visa": [visa] if visa else [],
            "outcome": [outcome] if outcome else [],
        }.items() if v}
        data.setdefault("applied_filters", explicit_filters)
        data.setdefault("effective_strictness", "strict")
        data.setdefault("relaxed", False)
    else:
        data = search_with_strictness(query, _project_id, _ds_location, _engine_id,
                                      page_size=page_size, page_token=page_token, strictness=strictness)

    return SearchResponse(
        results=[PostingCard(**c) for c in data["results"]],
        next_page_token=data["next_page_token"],
        total=data["total"],
        applied_filters=data.get("applied_filters", {}),
        relaxed=data.get("relaxed", False),
        effective_strictness=data.get("effective_strictness", ""),
        suggested_filters=[SuggestedFilter(**g) for g in _suggest(query)],
    )


@app.get("/api/postings/{case_id}", response_model=PostingDetail)
async def posting_detail(case_id: str):
    """Full detail for one posting (card fields + Markdown body)."""
    card = get_posting(case_id, _project_id, _ds_location, _datastore_id)
    if card is None:
        raise HTTPException(status_code=404, detail="Posting not found")
    return PostingDetail(**card)


@app.get("/api/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint.

    `chunks_loaded` is retained for client compatibility; it now reports
    grounding readiness (1 = Search/Answer engine configured) since chunks are
    no longer preloaded (grounding is served by the managed datastore).
    """
    return HealthResponse(
        status="ok",
        chunks_loaded=1 if _engine_id else 0,
    )
