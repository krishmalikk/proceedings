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

import os

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


def search_postings(
    query: str,
    project_id: str,
    location: str,
    engine_id: str,
    page_size: int = 10,
    page_token: str = "",
    filter_expr: str = "",
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
    if _BOOST_ENABLED:
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
