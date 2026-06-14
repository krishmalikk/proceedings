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
    postings_by_handle,
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


class NewUserRequest(BaseModel):
    username: str = ""
    # Optional client-supplied id (a Firebase uid) to REGISTER instead of minting
    # a "new-…" dev id. Idempotent: re-registering returns the existing account.
    uid: str = ""


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
    tags: list[str] = []
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


class TagSection(BaseModel):
    """One labeled tag category for the detail view (e.g. 'Applying for')."""
    label: str
    tags: list[str]


class PostingDetail(PostingCard):
    body: str
    # The authoring app user's id, resolved from the Firestore posting↔author
    # link. Empty for Reddit/other-source postings or app postings published
    # before author capture (kept OUT of the search datastore — anonymity there
    # is preserved; the link lives only in Firestore for this author view).
    author_id: str = ""
    # First-party author handle (synthetic or username). Present for app/website
    # postings, empty for external (Reddit) ingests. Links to the author-by-handle
    # page. Distinct from author_id (the real app uid, only for in-app authoring).
    author_handle: str = ""
    # All tag categories kept SEPARATE (the card's `visa`/`consulates`/`tags`
    # collapse several facet groups into one). Detail view only; empty for
    # postings whose metadata carries no recognised tag groups.
    tag_sections: list[TagSection] = []


class AuthorPostingCard(BaseModel):
    case_id: str
    title: str
    visa: list[str] = []
    consulates: list[str] = []
    outcome: str = ""
    date: str = ""


class AuthorPostingsResponse(BaseModel):
    postings: list[AuthorPostingCard]


class UserReplyCard(BaseModel):
    id: str
    parent_case_id: str
    body: str
    created_at: str = ""


class UserRepliesResponse(BaseModel):
    replies: list[UserReplyCard]


# --- Replies + voting (phase-L) ---
class ReplyCreate(BaseModel):
    body: str = Field(..., min_length=1, max_length=5000)


class VoteTally(BaseModel):
    up: int = 0
    down: int = 0
    score: int = 0
    your_vote: int = 0  # the viewer's current vote on this content: -1 | 0 | 1


class ReplyCard(BaseModel):
    id: str
    parent_case_id: str
    body: str
    author_handle: str
    created_at: str
    deleted: bool = False
    up: int = 0
    down: int = 0
    score: int = 0
    your_vote: int = 0
    is_author: bool = False


class RepliesResponse(BaseModel):
    replies: list[ReplyCard]
    posting: VoteTally  # the parent posting's own tally + the viewer's vote on it
    total: int


class VoteRequest(BaseModel):
    content_id: str = Field(..., min_length=1, max_length=300)  # posting case_id OR reply id
    dir: int = 0  # -1 | 0 | 1  (0 clears the vote)


class VoteResponse(VoteTally):
    content_id: str


# --- Find users in same boat + groups (phase-M) ---
class Criteria(BaseModel):
    current_visa_or_greencard_category: list[str] = []
    visa_applying_for: list[str] = []
    primary_consulate: str = ""
    consulates: list[str] = []
    key_stages_or_info: dict[str, str] = {}
    key_dates: dict[str, str] = {}
    background_text: str = ""


class FindChatRequest(BaseModel):
    messages: list[dict] = []
    draft: Criteria = Criteria()


class FindChatResponse(BaseModel):
    reply: str
    criteria: dict
    done: bool


class MatchesRequest(BaseModel):
    criteria: Criteria = Criteria()


class MatchCard(BaseModel):
    user_id: str
    username: str
    score: float
    shared: list[str] = []
    summary: str = ""
    background: str = ""


class MatchesResponse(BaseModel):
    matches: list[MatchCard]
    total: int


class GroupMember(BaseModel):
    user_id: str
    username: str = ""
    score: float = 0


class GroupCreate(BaseModel):
    criteria_text: str = ""
    criteria: Criteria = Criteria()
    members: list[GroupMember] = []


class GroupCard(BaseModel):
    group_id: str
    name: str = ""
    criteria_text: str = ""
    members: list[GroupMember] = []
    status: str = "formed"
    created_at: str = ""
    is_member: bool = False
    joined: bool = False  # true when an existing group was joined (vs. created)


class GroupsResponse(BaseModel):
    groups: list[GroupCard]


# --- Group chat messages (phase-N) ---
class MessageCreate(BaseModel):
    text: str = Field(..., min_length=1, max_length=4000)


class MessageCard(BaseModel):
    id: str
    author_handle: str
    text: str
    created_at: str
    deleted: bool = False
    is_author: bool = False


class MessagesResponse(BaseModel):
    messages: list[MessageCard]
    total: int


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

# Registered uids (e.g. Firebase accounts) accepted by the X-User-Id gate.
# Source of truth is the Firestore users/{uid} doc created by POST /api/users;
# this set just caches positive lookups. NOTE: the header is still UNVERIFIED —
# server-side Firebase ID-token verification is the Option-A follow-up.
_KNOWN_UIDS: set[str] = set()


def _uid_registered(uid: str) -> bool:
    """True if a users/{uid} profile doc exists (cached after first hit)."""
    if uid in _KNOWN_UIDS:
        return True
    if _db is None:
        return False
    try:
        if _db.collection("users").document(uid).get().exists:
            _KNOWN_UIDS.add(uid)
            return True
    except Exception as e:  # noqa: BLE001 — gate lookup must never 500
        print(f"_uid_registered({uid}): {e}")
    return False


def _uid_accepted(uid: str) -> bool:
    """Baked roster, dev-created 'new-…' ids, or registered (Firebase) accounts."""
    import profile
    return uid in profile.seed_ids() or uid.startswith("new-") or _uid_registered(uid)


def _active_user(request: Request) -> str:
    """Resolve the active user id from the X-User-Id header (dev impersonation)."""
    if not ALLOW_USER_IMPERSONATION:
        raise HTTPException(status_code=403, detail="User impersonation is disabled.")
    uid = request.headers.get("x-user-id", "").strip()
    if not uid:
        raise HTTPException(status_code=400, detail="X-User-Id header is required (pick a user).")
    if not _uid_accepted(uid):
        raise HTTPException(status_code=404, detail=f"Unknown user '{uid}'.")
    return uid


def _optional_user(request: Request) -> str:
    """Like `_active_user` but never raises — returns '' when no/unknown user.
    Used by read endpoints that personalize (e.g. the viewer's own votes) but
    are still usable anonymously."""
    uid = request.headers.get("x-user-id", "").strip()
    return uid if uid and _uid_accepted(uid) else ""


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

    # Author (the publishing app user). Kept OUT of the posting itself / search
    # datastore — only recorded in the Firestore posting↔author link below.
    author_uid = _optional_user(request)

    try:
        result = _guard(lambda: posting.publish_posting(
            body.title, body.description, body.tags.model_dump(),
            body.key_stages_or_info, body.key_dates,
        ))
    except ValueError as e:
        # vocabulary / schema validation failure → 422
        raise HTTPException(status_code=422, detail=f"Posting failed validation: {e}")

    # Record the author link (Firestore only) so the author's profile + their
    # other postings can be shown on the case page. Best-effort — never blocks
    # the publish.
    if author_uid and _db is not None:
        try:
            visa = list(dict.fromkeys(
                (body.tags.visa_applying_for or []) + (body.tags.current_visa_or_greencard_category or [])
            ))
            _db.collection("posting_authors").document(result["case_id"]).set({
                "case_id": result["case_id"],
                "author_uid": author_uid,
                "channel": "app",
                "title": body.title,
                "visa": visa,
                "consulates": body.tags.consulates or [],
                "outcome": (body.key_stages_or_info or {}).get("outcome_status", ""),
                "created_at": firestore.SERVER_TIMESTAMP,
            })
        except Exception as e:  # noqa: BLE001 — author link is non-critical
            print(f"posting_authors write failed for {result['case_id']}: {e}")

    return PostingCreateResponse(**result)


# ---------------------------------------------------------------------------
# User profile + AI onboarding (phase-I)
# ---------------------------------------------------------------------------

@app.get("/api/users", response_model=list[SeedUser])
async def list_users():
    """The baked seed roster for the dev user-picker (no auth yet)."""
    import profile
    return [SeedUser(**u) for u in profile.seed_users()]


@app.post("/api/users", response_model=SeedUser)
async def create_user(body: NewUserRequest):
    """Create/register a user account.

    - No `uid` (dev picker): mint a fresh "new-…" id to onboard from scratch.
    - With `uid` (Firebase sign-in/up): register that uid so the X-User-Id gate
      accepts it. Idempotent — an already-registered uid returns its existing
      account and NEVER overwrites the stored profile. The header remains
      unverified dev-mode identity until ID-token verification lands (Option A).
    """
    import re as _re
    import secrets
    import profile
    if not ALLOW_USER_IMPERSONATION:
        raise HTTPException(status_code=403, detail="User creation is disabled.")

    uid = (body.uid or "").strip()
    if uid:
        if uid in profile.seed_ids() or not _re.fullmatch(r"[A-Za-z0-9_-]{6,128}", uid):
            raise HTTPException(status_code=422, detail="Invalid uid.")
        if _uid_registered(uid):
            # Already registered — return the existing account untouched.
            existing = _guard(lambda: profile.get_profile(_db, uid))
            return SeedUser(id=uid, username=existing.get("username") or uid, label=existing.get("username") or uid)
        username = (body.username or "").strip()[:40] or f"member-{uid[:6]}"
        _guard(lambda: profile.save_profile(_db, uid, {"username": username}))
        _KNOWN_UIDS.add(uid)
        return SeedUser(id=uid, username=username, label=username)

    new_id = "new-" + secrets.token_hex(4)
    username = (body.username or "").strip()[:40] or f"new-user-{new_id[-4:]}"
    # Register by creating the (empty) profile doc with the chosen username.
    _guard(lambda: profile.save_profile(_db, new_id, {"username": username}))
    return SeedUser(id=new_id, username=username, label=f"🆕 {username}")


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


def _posting_author_uid(case_id: str) -> str:
    """The app user who authored this posting, from the Firestore link (or '')."""
    if _db is None:
        return ""
    try:
        snap = _db.collection("posting_authors").document(case_id).get()
        return (snap.to_dict() or {}).get("author_uid", "") if snap.exists else ""
    except Exception as e:  # noqa: BLE001
        print(f"_posting_author_uid({case_id}): {e}")
        return ""


@app.get("/api/postings/{case_id}", response_model=PostingDetail)
async def posting_detail(case_id: str):
    """Full detail for one posting (card fields + Markdown body + author link)."""
    card = get_posting(case_id, _project_id, _ds_location, _datastore_id)
    if card is None:
        raise HTTPException(status_code=404, detail="Posting not found")
    # Resolve the author only for first-party app postings (Reddit/others omit).
    card["author_id"] = _posting_author_uid(case_id) if card.get("channel") == "app" else ""
    return PostingDetail(**card)


@app.get("/api/authors/by-handle/{handle}/postings", response_model=AuthorPostingsResponse)
async def author_postings_by_handle(handle: str):
    """All first-party postings authored under `handle` (newest first). Powers the
    public author-by-handle page; works for every first-party posting since they
    all carry an author_handle. Empty for unknown/blank handles."""
    cards = postings_by_handle(handle, _project_id, _ds_location, _datastore_id)
    items = [
        AuthorPostingCard(
            case_id=c.get("case_id", ""),
            title=c.get("title", ""),
            visa=c.get("visa", []),
            consulates=c.get("consulates", []),
            outcome=c.get("outcome", ""),
            date=c.get("date", ""),
        )
        for c in cards
    ]
    return AuthorPostingsResponse(postings=items)


@app.get("/api/users/{uid}/public-profile")
async def public_profile(uid: str):
    """A posting author's structured profile (the same PII-free profile shown in
    setup). Returned for the case-page author section. 404 if no profile."""
    import profile
    prof = _guard(lambda: profile.get_profile(_db, uid))
    if not prof:
        raise HTTPException(status_code=404, detail="Profile not found")
    return prof


@app.get("/api/users/{uid}/postings", response_model=AuthorPostingsResponse)
async def user_postings(uid: str):
    """All app postings authored by a user (newest first), from the Firestore
    posting↔author link. Used by the case-page 'other postings by this author'."""
    if _db is None:
        return AuthorPostingsResponse(postings=[])
    try:
        docs = list(_db.collection("posting_authors").where("author_uid", "==", uid).stream())
    except Exception as e:  # noqa: BLE001
        print(f"user_postings({uid}): {e}")
        return AuthorPostingsResponse(postings=[])
    rows = [d.to_dict() or {} for d in docs]

    def _created_key(r: dict):
        ts = r.get("created_at")
        return ts.isoformat() if hasattr(ts, "isoformat") else str(ts or "")

    rows.sort(key=_created_key, reverse=True)
    cards = [
        AuthorPostingCard(
            case_id=r.get("case_id", ""),
            title=r.get("title", ""),
            visa=r.get("visa", []) or [],
            consulates=r.get("consulates", []) or [],
            outcome=r.get("outcome", "") or "",
            date=_created_key(r)[:10],
        )
        for r in rows if r.get("case_id")
    ]
    return AuthorPostingsResponse(postings=cards)


@app.get("/api/users/{uid}/replies", response_model=UserRepliesResponse)
async def user_replies(uid: str):
    """All replies a user has authored (newest first) — the profile 'your
    activity' section. Each carries the parent posting id for linking."""
    import interactions
    rows = _guard(lambda: interactions.list_user_replies(_db, uid))
    return UserRepliesResponse(replies=[UserReplyCard(**r) for r in rows])


# ---------------------------------------------------------------------------
# Replies + voting (phase-L). Replies/votes live in Firestore (interactions
# store), separate from the datastore-backed posting corpus, so the search feed
# is unaffected. Replying/voting require an active user; reads are anonymous.
# ---------------------------------------------------------------------------

@app.get("/api/postings/{case_id}/replies", response_model=RepliesResponse)
async def list_replies_route(case_id: str, request: Request, sort: str = "top"):
    """Flat replies on a posting (each with its vote tally + the viewer's vote),
    plus the posting's own tally. Anonymous-safe (your_vote = 0 with no user)."""
    import interactions
    viewer = _optional_user(request)
    replies = _guard(lambda: interactions.list_replies(_db, case_id, viewer, sort))
    posting_tally = _guard(lambda: interactions.vote_state(_db, [case_id], viewer))[case_id]
    return RepliesResponse(
        replies=[ReplyCard(**r) for r in replies],
        posting=VoteTally(**posting_tally),
        total=len(replies),
    )


@app.post("/api/postings/{case_id}/replies", response_model=ReplyCard)
async def create_reply_route(case_id: str, body: ReplyCreate, request: Request):
    """Post a reply to a posting (requires an active user)."""
    client_ip = request.client.host if request.client else "unknown"
    if not check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Try again in a minute.")
    import interactions
    import profile
    uid = _active_user(request)
    handle = profile.username_for(uid)
    try:
        reply = _guard(lambda: interactions.add_reply(_db, case_id, body.body, uid, handle))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return ReplyCard(**reply)


@app.delete("/api/postings/{case_id}/replies/{reply_id}")
async def delete_reply_route(case_id: str, reply_id: str, request: Request):
    """Soft-delete one of your own replies (author-only)."""
    import interactions
    uid = _active_user(request)
    try:
        _guard(lambda: interactions.delete_reply(_db, reply_id, uid))
    except KeyError:
        raise HTTPException(status_code=404, detail="Reply not found")
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    return {"ok": True}


@app.post("/api/votes", response_model=VoteResponse)
async def cast_vote_route(body: VoteRequest, request: Request):
    """Up/down/clear a vote on a posting or reply (requires an active user).
    `dir` is the desired resulting direction (-1 | 0 | 1); the client toggles."""
    client_ip = request.client.host if request.client else "unknown"
    if not check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Try again in a minute.")
    import interactions
    uid = _active_user(request)
    res = _guard(lambda: interactions.cast_vote(_db, body.content_id, uid, body.dir))
    return VoteResponse(**res)


# ---------------------------------------------------------------------------
# Find users in same boat + groups (phase-M). The expert chat builds match
# criteria; criteria are validated against the profile via the existing
# /api/reconcile (and applied via PUT /api/profile). Matching ranks other users'
# Firestore profiles by tag overlap; a group of selected matches is persisted.
# ---------------------------------------------------------------------------

@app.post("/api/find/chat", response_model=FindChatResponse)
async def find_chat_route(body: FindChatRequest, request: Request):
    """One expert-chat turn that captures the user's match criteria."""
    client_ip = request.client.host if request.client else "unknown"
    if not check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Try again in a minute.")
    import matching
    _active_user(request)
    out = _guard(lambda: matching.find_turn(body.messages, body.draft.model_dump()))
    return FindChatResponse(**out)


@app.post("/api/find/matches", response_model=MatchesResponse)
async def find_matches_route(body: MatchesRequest, request: Request):
    """Rank other users by similarity to the criteria (excludes the caller)."""
    import matching
    uid = _active_user(request)
    matches = _guard(lambda: matching.find_matches(_db, uid, body.criteria.model_dump()))
    return MatchesResponse(matches=[MatchCard(**m) for m in matches], total=len(matches))


@app.post("/api/groups", response_model=GroupCard)
async def create_group_route(body: GroupCreate, request: Request):
    """Join the existing group for this criteria signature, or create it. The
    acting user (+ any selected peers) become members. `joined`=true on join."""
    import matching
    uid = _active_user(request)
    try:
        g = _guard(lambda: matching.find_or_create_group(
            _db, uid, body.criteria_text, body.criteria.model_dump(),
            [m.model_dump() for m in body.members]))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return GroupCard(**g)


@app.get("/api/groups", response_model=GroupsResponse)
async def list_groups_route(request: Request):
    """The groups the active user is a member of (newest first)."""
    import matching
    uid = _active_user(request)
    groups = _guard(lambda: matching.my_groups(_db, uid))
    return GroupsResponse(groups=[GroupCard(**g) for g in groups])


@app.get("/api/groups/all", response_model=GroupsResponse)
async def list_all_groups_route(request: Request):
    """All groups (browse), flagged with the viewer's membership."""
    import matching
    uid = _active_user(request)
    groups = _guard(lambda: matching.list_all_groups(_db, uid))
    return GroupsResponse(groups=[GroupCard(**g) for g in groups])


@app.post("/api/groups/{group_id}/join", response_model=GroupCard)
async def join_group_route(group_id: str, request: Request):
    """Join an existing group directly (browse → join)."""
    import matching
    uid = _active_user(request)
    try:
        g = _guard(lambda: matching.join_group(_db, group_id, uid))
    except KeyError:
        raise HTTPException(status_code=404, detail="Group not found")
    return GroupCard(**g)


# ---------------------------------------------------------------------------
# Group chat (phase-N). Members-only messages in Firestore groups/{id}/messages
# (app-state, never the datastore). v1 real-time = client polling with `since`.
# Declared AFTER /api/groups/all so the literal route wins over {group_id}.
# ---------------------------------------------------------------------------

@app.get("/api/groups/{group_id}", response_model=GroupCard)
async def get_group_route(group_id: str, request: Request):
    """One group (name, members, is_member) for the group detail / chat page."""
    import matching
    uid = _active_user(request)
    g = next((x for x in _guard(lambda: matching.list_all_groups(_db, uid))
              if x["group_id"] == group_id), None)
    if g is None:
        raise HTTPException(status_code=404, detail="Group not found")
    return GroupCard(**g)


@app.get("/api/groups/{group_id}/messages", response_model=MessagesResponse)
async def list_messages_route(group_id: str, request: Request, since: str = "", limit: int = 200):
    """Members-only message list (polled). `since` = an ISO created_at cursor → only newer."""
    import group_messages
    uid = _active_user(request)
    try:
        msgs = _guard(lambda: group_messages.list_messages(_db, group_id, uid, since, limit))
    except KeyError:
        raise HTTPException(status_code=404, detail="Group not found")
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    return MessagesResponse(messages=[MessageCard(**m) for m in msgs], total=len(msgs))


@app.post("/api/groups/{group_id}/messages", response_model=MessageCard)
async def post_message_route(group_id: str, body: MessageCreate, request: Request):
    """Post a message to a group (members only; PII-scrubbed)."""
    client_ip = request.client.host if request.client else "unknown"
    if not check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Try again in a minute.")
    import group_messages
    uid = _active_user(request)
    try:
        msg = _guard(lambda: group_messages.post_message(_db, group_id, uid, body.text))
    except KeyError:
        raise HTTPException(status_code=404, detail="Group not found")
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return MessageCard(**msg)


@app.delete("/api/groups/{group_id}/messages/{message_id}")
async def delete_message_route(group_id: str, message_id: str, request: Request):
    """Soft-delete one of your own messages (author-only)."""
    import group_messages
    uid = _active_user(request)
    try:
        _guard(lambda: group_messages.delete_message(_db, group_id, message_id, uid))
    except KeyError:
        raise HTTPException(status_code=404, detail="Message not found")
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    return {"ok": True}


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
