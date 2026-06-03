"""
search_client.py — Vertex AI Search (Discovery Engine) grounded-answer client
=============================================================================
Replaces the self-managed Vertex AI Vector Search retrieval path with the
managed Discovery Engine **Search + Answer API** over `imm-postings-datastore`
(engine `imm-postings-search-app`).

WHY THIS EXISTS:
The prototype grounded answers on a self-managed Vector Search index that held
only crawled gov/law-firm content (zero Reddit) — so Reddit postings never
surfaced. The 81 Reddit docs (and future app/web posts) live in the Discovery
Engine datastore. This module grounds on that datastore via the managed Answer
API, returning a grounded answer + citations.

Decision basis: D-016 (single managed Vertex AI Search sink), D-034 (BFF uses
the Search/Answer API), D-039 (3-tier grounding). See app-specifications/
FINAL-ARCHITECTURE.md.

The returned dict matches the existing `query()` contract exactly so api.py and
both clients are unchanged:
  {
    "answer": str,
    "chunks": [{"chunk_id": str, "text": str, "source": str, "labels": list, "score": float}],
    "is_fallback": bool,
  }
"""

import csv
import os
import re

from google.api_core.client_options import ClientOptions
from google.cloud import discoveryengine_v1 as de
from google.cloud import storage

# Fallback message when the datastore yields no grounded answer.
FALLBACK_MESSAGE = "I don't have that information — please contact the firm directly."

# Precedence boost (D-039): rank app posts above reddit above the rest. Disabled
# by default until the `channel` facet + app-channel posts exist in the datastore
# (the current corpus is all reddit, so the boost is a no-op / could error if the
# field is unregistered). Enable with VERTEX_SEARCH_BOOST=1 once app posts land.
_BOOST_ENABLED = os.getenv("VERTEX_SEARCH_BOOST", "0") == "1"


def _serving_config(project_id: str, location: str, engine_id: str) -> str:
    return (
        f"projects/{project_id}/locations/{location}"
        f"/collections/default_collection/engines/{engine_id}"
        f"/servingConfigs/default_search"
    )


def _client(project_id: str, location: str) -> de.ConversationalSearchServiceClient:
    # ADC needs an explicit quota project for discoveryengine.googleapis.com.
    opts = ClientOptions(quota_project_id=project_id)
    if location != "global":
        opts = ClientOptions(
            api_endpoint=f"{location}-discoveryengine.googleapis.com",
            quota_project_id=project_id,
        )
    return de.ConversationalSearchServiceClient(client_options=opts)


def _boost_spec():
    if not _BOOST_ENABLED:
        return None
    Cond = de.SearchRequest.BoostSpec.ConditionBoostSpec
    return de.SearchRequest.BoostSpec(
        condition_boost_specs=[
            Cond(condition='channel: ANY("app")', boost=0.5),
            Cond(condition='channel: ANY("reddit")', boost=0.3),
        ]
    )


def _to_native(v):
    """Recursively coerce proto-plus MapComposite/RepeatedComposite to dict/list."""
    if hasattr(v, "items"):  # MapComposite / dict-like
        return {k: _to_native(x) for k, x in v.items()}
    if not isinstance(v, (str, bytes)) and hasattr(v, "__iter__"):  # RepeatedComposite / list
        return [_to_native(x) for x in v]
    return v


def _struct_to_dict(struct_data) -> dict:
    """Coerce a proto Struct (struct_data) into a plain python dict of native types,
    recursing into nested maps/lists (e.g. key_stages_or_info)."""
    if not struct_data:
        return {}
    try:
        return {k: _to_native(v) for k, v in dict(struct_data).items()}
    except Exception:
        return {}


def _labels_from(meta: dict) -> list[str]:
    for key in ("tags", "concerns_or_questions_tags", "derived_topic_cluster"):
        val = meta.get(key)
        if isinstance(val, list) and val:
            return [str(v) for v in val]
    return []


def _reference_to_chunk(ref) -> dict | None:
    """Map one Answer.Reference (any of the 3 sub-types) into the chunk shape."""
    # Structured sidecar docs (our datastore mode) carry struct_data + title/uri.
    sdi = ref.structured_document_info
    if sdi and sdi.document:
        meta = _struct_to_dict(sdi.struct_data)
        case_id = sdi.document.split("/")[-1]
        uri = str(meta.get("full_url") or meta.get("source_uri") or sdi.uri or "")
        # Prefer a human-readable case_id over an internal gs:// path for display.
        source = uri if uri and not uri.startswith("gs://") else case_id
        return {
            "chunk_id": case_id,
            "text": str(meta.get("post_title") or meta.get("background_summary") or sdi.title or "")[:500],
            "source": source,
            "labels": _labels_from(meta),
            "score": 0.0,  # structured refs carry no relevance score
        }
    # Chunked content (advanced/website mode).
    ci = ref.chunk_info
    if ci and (ci.content or ci.chunk):
        dm = ci.document_metadata
        meta = _struct_to_dict(getattr(dm, "struct_data", {})) if dm else {}
        return {
            "chunk_id": (getattr(dm, "document", "") or ci.chunk or "").split("/")[-1],
            "text": str(ci.content or "")[:500],
            "source": str(getattr(dm, "uri", "") or getattr(dm, "title", "") or meta.get("post_title", "")),
            "labels": _labels_from(meta),
            "score": float(ci.relevance_score or 0.0),
        }
    # Unstructured docs.
    udi = ref.unstructured_document_info
    if udi and udi.document:
        meta = _struct_to_dict(udi.struct_data)
        text = ""
        if udi.chunk_contents:
            text = " ".join(c.content for c in udi.chunk_contents if c.content)[:500]
        return {
            "chunk_id": udi.document.split("/")[-1],
            "text": text or str(udi.title or "")[:500],
            "source": str(udi.uri or udi.title or udi.document.split("/")[-1]),
            "labels": _labels_from(meta),
            "score": 0.0,
        }
    return None


def answer_query(question: str, project_id: str, location: str, engine_id: str, max_results: int = 5) -> dict:
    """
    Ground `question` against the Discovery Engine datastore via the Answer API.

    Returns the same dict shape as query() in query.py.
    """
    fallback = {"answer": FALLBACK_MESSAGE, "chunks": [], "is_fallback": True}

    client = _client(project_id, location)

    search_params = de.AnswerQueryRequest.SearchSpec.SearchParams(max_return_results=max_results)
    boost = _boost_spec()
    if boost is not None:
        search_params.boost_spec = boost

    request = de.AnswerQueryRequest(
        serving_config=_serving_config(project_id, location, engine_id),
        query=de.Query(text=question),
        search_spec=de.AnswerQueryRequest.SearchSpec(search_params=search_params),
        answer_generation_spec=de.AnswerQueryRequest.AnswerGenerationSpec(
            include_citations=True,
            # Do NOT let the API skip queries via its adversarial / non-answer-
            # seeking / low-relevance classifiers: they are non-deterministic and
            # intermittently drop legitimate questions (e.g. imperative phrasings
            # like "Tell me about ...") to 0 references. We ground purely on
            # whether the datastore returned references (see below).
            ignore_adversarial_query=False,
            ignore_non_answer_seeking_query=False,
            ignore_low_relevant_content=False,
        ),
        grounding_spec=de.AnswerQueryRequest.GroundingSpec(include_grounding_supports=True),
    )

    response = client.answer_query(request)
    answer = response.answer

    answer_text = (answer.answer_text or "").strip()
    succeeded = answer.state == de.Answer.State.SUCCEEDED

    # The Answer API emits one reference per grounding support, so the same doc
    # recurs — dedupe by chunk_id (keep first), then cap to max_results.
    chunks = []
    seen = set()
    for ref in answer.references:
        mapped = _reference_to_chunk(ref)
        if mapped and mapped["chunk_id"] not in seen:
            seen.add(mapped["chunk_id"])
            chunks.append(mapped)
        if len(chunks) >= max_results:
            break

    # Grounded iff the datastore actually returned citable references. No
    # references (off-topic, or nothing relevant) => fallback. This is the
    # deterministic grounding signal, replacing the flaky skip-reason check.
    if not succeeded or not answer_text or not chunks:
        return fallback

    return {
        "answer": answer_text,
        "chunks": chunks,
        "is_fallback": False,
    }


# ---------------------------------------------------------------------------
# Search mode — ranked posting cards (the ":search" method, not ":answer")
# ---------------------------------------------------------------------------

def _search_client(project_id: str, location: str) -> de.SearchServiceClient:
    opts = ClientOptions(quota_project_id=project_id)
    if location != "global":
        opts = ClientOptions(
            api_endpoint=f"{location}-discoveryengine.googleapis.com",
            quota_project_id=project_id,
        )
    return de.SearchServiceClient(client_options=opts)


def _as_list(val) -> list[str]:
    if val is None:
        return []
    if isinstance(val, str):
        return [val] if val else []
    try:
        return [str(v) for v in val if v not in (None, "")]
    except TypeError:
        return [str(val)]


def _card_from_struct(case_id: str, meta: dict) -> dict:
    """Build a result-card dict from a posting's structData."""
    stages = meta.get("key_stages_or_info") or {}
    if not isinstance(stages, dict):
        stages = {}
    visa = _as_list(meta.get("visa_applying_for")) or _as_list(meta.get("current_visa_or_greencard_category"))
    consulates = _as_list(meta.get("consulates")) or _as_list(meta.get("primary_consulate"))
    tags = (
        _as_list(meta.get("concerns_or_questions_tags"))
        or _as_list(meta.get("tags"))
        or _as_list(meta.get("derived_topic_cluster"))
    )
    return {
        "case_id": case_id,
        "title": str(meta.get("post_title") or "").strip() or case_id,
        "description": str(meta.get("background_summary") or meta.get("concerns_or_questions_summary") or "")[:400],
        "visa": visa,
        "consulates": consulates,
        "outcome": str(meta.get("outcome_status") or stages.get("outcome_status") or ""),
        "subreddit": str(meta.get("subreddit") or meta.get("source_container") or ""),
        "channel": str(meta.get("channel") or ""),
        "tags": tags[:8],
        "url": str(meta.get("full_url") or meta.get("source_uri") or ""),
        "date": str(meta.get("posting_date") or ""),
    }


# --- Natural-language -> tagged facet extraction (for precision control) ----

_CONSULATE_MAP: dict | None = None
# Common informal names not in the vocabulary's official city column.
_CONSULATE_ALIASES = {"delhi": "DEL", "bombay": "BOM", "madras": "MAA", "calcutta": "CCU"}


def _consulate_map() -> dict:
    """Lazy-load {city/country name -> consulate code} from 1.4-consulates.csv."""
    global _CONSULATE_MAP
    if _CONSULATE_MAP is None:
        m: dict[str, str] = {}
        path = os.path.join(os.path.dirname(__file__), "tags-cleaned", "1.4-consulates.csv")
        try:
            with open(path, newline="", encoding="utf-8") as f:
                reader = csv.reader(f)
                next(reader, None)  # header
                for row in reader:
                    if len(row) < 4:
                        continue
                    code, typ, country, city = (c.strip() for c in row[:4])
                    if city:
                        m[city.lower()] = code
                    elif country and typ == "country":
                        m[country.lower()] = code
        except Exception as e:  # noqa: BLE001
            print(f"consulate map load failed: {e}")
        m.update(_CONSULATE_ALIASES)
        _CONSULATE_MAP = m
    return _CONSULATE_MAP


_VISA_PATTERNS = [
    (r"\bb-?1\s*/?\s*b-?2\b", ["B-1", "B-2"]),
    (r"\bb-?1\b", ["B-1"]),
    (r"\bb-?2\b", ["B-2"]),
    (r"\bh-?1b\b", ["H-1B"]),
    (r"\bf-?1\b", ["F-1"]),
    (r"\bl-?1\b", ["L-1"]),
]
_OUTCOME_PATTERNS = [
    (r"\bapprove", "approved"),
    (r"\bissued\b", "issued"),
    (r"\b(reject|refus|denied|denial)", "refused"),
    (r"\bpending\b", "pending"),
]


def extract_filters(query: str) -> dict:
    """Map a natural-language query to tagged facet values (consulate/visa/outcome)."""
    q = query.lower()
    facets: dict = {}
    cm = _consulate_map()
    for name in sorted(cm, key=len, reverse=True):  # prefer longer (city > country) names
        if len(name) >= 4 and re.search(r"\b" + re.escape(name) + r"\b", q):
            facets["consulate"] = cm[name]
            break
    for pat, val in _VISA_PATTERNS:
        if re.search(pat, q):
            facets["visa"] = val
            break
    for pat, val in _OUTCOME_PATTERNS:
        if re.search(pat, q):
            facets["outcome"] = val
            break
    return facets


def _filter_expr_from_facets(facets: dict) -> str:
    clauses = []
    if facets.get("consulate"):
        clauses.append(f'consulates: ANY("{facets["consulate"]}")')
    if facets.get("visa"):
        vs = " OR ".join(f'visa_applying_for: ANY("{v}")' for v in facets["visa"])
        clauses.append(f"({vs})")
    if facets.get("outcome"):
        clauses.append(f'key_stages_or_info.outcome_status: ANY("{facets["outcome"]}")')
    return " AND ".join(clauses)


def _boost_from_facets(facets: dict):
    Cond = de.SearchRequest.BoostSpec.ConditionBoostSpec
    specs = []
    if facets.get("consulate"):
        specs.append(Cond(condition=f'consulates: ANY("{facets["consulate"]}")', boost=0.5))
    if facets.get("visa"):
        cond = " OR ".join(f'visa_applying_for: ANY("{v}")' for v in facets["visa"])
        specs.append(Cond(condition=cond, boost=0.3))
    if facets.get("outcome"):
        specs.append(Cond(condition=f'key_stages_or_info.outcome_status: ANY("{facets["outcome"]}")', boost=0.2))
    return de.SearchRequest.BoostSpec(condition_boost_specs=specs) if specs else None


def search_postings(
    query: str,
    project_id: str,
    location: str,
    engine_id: str,
    page_size: int = 10,
    page_token: str = "",
    filter_expr: str = "",
    boost=None,
) -> dict:
    """
    Ranked posting search (Google-results style) via the Discovery Engine
    :search method. Returns result cards (no synthesized answer).

      { "results": [ {card}, ... ], "next_page_token": str, "total": int }
    """
    client = _search_client(project_id, location)
    serving_config = _serving_config(project_id, location, engine_id)

    request = de.SearchRequest(
        serving_config=serving_config,
        query=query,
        page_size=page_size,
        page_token=page_token or "",
        filter=filter_expr or "",
        content_search_spec=de.SearchRequest.ContentSearchSpec(
            snippet_spec=de.SearchRequest.ContentSearchSpec.SnippetSpec(return_snippet=True),
        ),
    )
    if boost is not None:
        request.boost_spec = boost
    elif _BOOST_ENABLED:
        request.boost_spec = _boost_spec()

    response = client.search(request)
    results = []
    for r in response.results:
        meta = _struct_to_dict(r.document.struct_data)
        results.append(_card_from_struct(r.document.id, meta))

    return {
        "results": results,
        "next_page_token": response.next_page_token or "",
        "total": int(getattr(response, "total_size", 0) or 0),
    }


def search_with_strictness(
    query: str,
    project_id: str,
    location: str,
    engine_id: str,
    page_size: int = 10,
    page_token: str = "",
    strictness: str = "balanced",
) -> dict:
    """
    Search with a user-chosen precision level:
      - 'strict'   : hard filter on every extracted facet (exact matches only;
                     relaxes to 'balanced' if that yields nothing).
      - 'balanced' : boost matching facets (relevant ones rank first, others kept).
      - 'broad'    : pure semantic search (no facet constraints).
    Adds `applied_filters`, `relaxed`, and `effective_strictness` to the result.
    """
    facets = extract_filters(query)

    def _wrap(data, eff, relaxed):
        data["applied_filters"] = facets
        data["effective_strictness"] = eff
        data["relaxed"] = relaxed
        return data

    if strictness == "strict" and facets:
        data = search_postings(query, project_id, location, engine_id, page_size, page_token,
                               filter_expr=_filter_expr_from_facets(facets))
        if not data["results"] and not page_token:
            # No exact matches — fall back to a boosted (balanced) search.
            data = search_postings(query, project_id, location, engine_id, page_size, "",
                                   boost=_boost_from_facets(facets))
            return _wrap(data, "balanced", True)
        return _wrap(data, "strict", False)

    if strictness == "broad":
        data = search_postings(query, project_id, location, engine_id, page_size, page_token)
        return _wrap(data, "broad", False)

    # balanced (default)
    data = search_postings(query, project_id, location, engine_id, page_size, page_token,
                           boost=_boost_from_facets(facets))
    return _wrap(data, "balanced", False)


def get_posting(case_id: str, project_id: str, location: str, datastore_id: str) -> dict | None:
    """
    Fetch one posting's full detail: structData card fields + the Markdown body
    (read from the GCS sidecar referenced by the document's content URI).
    Returns None if the document does not exist.
    """
    from google.api_core.exceptions import NotFound

    doc_client = de.DocumentServiceClient(client_options=ClientOptions(quota_project_id=project_id))
    name = (
        f"projects/{project_id}/locations/{location}/collections/default_collection"
        f"/dataStores/{datastore_id}/branches/default_branch/documents/{case_id}"
    )
    try:
        doc = doc_client.get_document(name=name)
    except NotFound:
        return None

    meta = _struct_to_dict(doc.struct_data)
    card = _card_from_struct(case_id, meta)

    # Body lives in the GCS sidecar (.md), referenced by content.uri / gcs_path.
    body = ""
    gcs_uri = doc.content.uri or meta.get("gcs_path") or ""
    if gcs_uri.startswith("gs://"):
        try:
            bucket_name, blob_path = gcs_uri[len("gs://"):].split("/", 1)
            blob = storage.Client(project=project_id).bucket(bucket_name).blob(blob_path)
            body = blob.download_as_text()
        except Exception as e:  # noqa: BLE001 - best-effort body fetch
            print(f"get_posting: could not read body from {gcs_uri}: {e}")

    card["body"] = body
    return card


if __name__ == "__main__":
    # Standalone smoke test: python search_client.py "your question"
    import sys

    from dotenv import load_dotenv

    load_dotenv()
    proj = os.getenv("GCP_PROJECT_ID") or os.getenv("GCP_PROJECT", "")
    loc = os.getenv("GCP_VERTEX_DATASTORE_LOCATION", "global")
    engine = os.getenv("GCP_VERTEX_SEARCH_APP_ID", "imm-postings-search-app")
    q = sys.argv[1] if len(sys.argv) > 1 else "B1/B2 visa interview experience in Mumbai"
    res = answer_query(q, proj, loc, engine)
    print(f"is_fallback: {res['is_fallback']}")
    print(f"answer: {res['answer'][:500]}")
    print(f"sources ({len(res['chunks'])}):")
    for c in res["chunks"]:
        print(f"  - {c['chunk_id']} | {c['source'][:60]} | labels={c['labels'][:4]}")
