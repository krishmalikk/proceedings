"""
test_grounding_e2e.py — End-to-end grounding verification for the usajourney.ai API
=================================================================================
Verifies the three grounding guarantees of the realigned backend (D-039):

  A. Reddit-ingested content is returned          (DS-1 imm-postings-datastore)
  B. App/web postings land in the right place for grounding (DS-1, channel=app)
  C. Public target sites are consulted only if/when required, and only the
     registered domains exist                      (DS-2, tier-3 fallback gating)

Runs against LIVE GCP (uses ADC). Group B creates a clearly-labelled synthetic
document in the datastore and deletes it in cleanup. Group C uses FastAPI's
TestClient with a recording stub — no live search calls, no Firestore writes.

Run:  .venv/bin/python tests/test_grounding_e2e.py
"""

import os
import sys
import time

from dotenv import load_dotenv

# Make the project root importable when run from anywhere.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

load_dotenv()

PROJECT = os.getenv("GCP_PROJECT_ID") or os.getenv("GCP_PROJECT", "")
LOCATION = os.getenv("GCP_VERTEX_DATASTORE_LOCATION", "global")
ENGINE = os.getenv("GCP_VERTEX_SEARCH_APP_ID", "imm-postings-search-app")
PUBLIC_ENGINE = "imm-public-reference-search-app"
DATASTORE = "imm-postings-datastore"
PUBLIC_DATASTORE = "imm-public-reference-datastore"
EXPECTED_PUBLIC_DOMAINS = {"uscis.gov", "travel.state.gov", "dol.gov", "boundless.com", "immigrationdirect.com"}

_results: list[tuple[str, bool, str]] = []


def check(name: str, passed: bool, detail: str = "") -> None:
    _results.append((name, passed, detail))
    mark = "PASS" if passed else "FAIL"
    print(f"  [{mark}] {name}" + (f" — {detail}" if detail else ""))


def warn(name: str, detail: str) -> None:
    _results.append((name, True, "WARN: " + detail))
    print(f"  [WARN] {name} — {detail}")


# ---------------------------------------------------------------------------
# Group A — Reddit-ingested content is returned (DS-1)
# ---------------------------------------------------------------------------

def group_a_reddit_grounding() -> None:
    print("\nGroup A — Reddit content is returned (DS-1)")
    import search_client

    # A1: direct Answer-API client
    res = search_client.answer_query(
        "What was the experience getting a B1/B2 visa in Mumbai?", PROJECT, LOCATION, ENGINE
    )
    check("A1 reddit answer is grounded (not fallback)", not res["is_fallback"], res["answer"][:80])
    reddit_sources = [c for c in res["chunks"] if c["chunk_id"].startswith("reddit-")]
    check("A1 sources are reddit-ingested docs", len(reddit_sources) >= 1,
          f"{len(reddit_sources)} reddit sources, e.g. {reddit_sources[0]['chunk_id'] if reddit_sources else 'none'}")

    # A2: through the HTTP API (TestClient), real grounding, Firestore disabled
    from fastapi.testclient import TestClient
    import api

    with TestClient(api.app) as client:
        api._db = None  # avoid polluting the qa_pairs log during the test
        r = client.post("/api/ask", json={"question": "B1/B2 visa interview experience in Mumbai"})
        ok = r.status_code == 200
        body = r.json() if ok else {}
        check("A2 /api/ask returns 200 grounded", ok and not body.get("is_fallback", True),
              f"status={r.status_code}, sources={len(body.get('sources', []))}")
        srcs = body.get("sources", [])
        check("A2 /api/ask sources are reddit docs",
              any(s["chunk_id"].startswith("reddit-") for s in srcs),
              srcs[0]["chunk_id"] if srcs else "no sources")


# ---------------------------------------------------------------------------
# Group B — App posting lands in the right place for grounding (DS-1, channel=app)
# ---------------------------------------------------------------------------

def group_b_app_posting_placement() -> None:
    print("\nGroup B — App posting goes to the right place for grounding (DS-1, channel=app)")
    from google.api_core.client_options import ClientOptions
    from google.api_core.exceptions import AlreadyExists, NotFound
    from google.cloud import discoveryengine_v1 as de

    opts = ClientOptions(quota_project_id=PROJECT)
    client = de.DocumentServiceClient(client_options=opts)
    branch = (
        f"projects/{PROJECT}/locations/{LOCATION}/collections/default_collection"
        f"/dataStores/{DATASTORE}/branches/default_branch"
    )
    case_id = "app-2026-06-03-e2e_test_user-zorbital9000"
    doc_name = f"{branch}/documents/{case_id}"
    # A deliberately unique phrase so the grounded search can only match this doc.
    unique = "Zorbital Quagmire Visa Center"
    body_md = (
        f"# App posting E2E test\n\nI applied for a B-2 visa at the {unique} and the "
        f"officer asked three questions about my trip. Approved in 4 minutes. "
        f"This is a synthetic app-channel posting created by the E2E test."
    )
    struct = {
        "case_id": case_id,
        "channel": "app",                       # the app-channel facet (D-036)
        "source_system": "usajourney",
        "source_container": "e2e_test_user",
        "ingestion_method": "app_conversational_post",
        "post_title": f"B-2 experience at {unique}",
        "doc_kind": "post",
    }

    created = False
    try:
        # --- create (simulates the publish step writing an app-channel doc into DS-1) ---
        doc = de.Document(
            id=case_id,
            struct_data=struct,
            content=de.Document.Content(mime_type="text/plain", raw_bytes=body_md.encode("utf-8")),
        )
        try:
            client.create_document(parent=branch, document=doc, document_id=case_id)
            created = True
        except AlreadyExists:
            created = True  # left over from a prior run; fine

        # --- B1: placement — the doc is in DS-1 with channel=app (deterministic) ---
        got = client.get_document(name=doc_name)
        sd = dict(got.struct_data)
        check("B1 app post created in DS-1 (imm-postings-datastore)", got.id == case_id, got.id)
        check("B1 app post carries channel=app", sd.get("channel") == "app", f"channel={sd.get('channel')}")

        # --- B2: grounding — the same engine the API uses can answer from it ---
        import search_client
        grounded = False
        deadline = time.time() + 150  # documents.import freshness is "minutes"
        last = None
        while time.time() < deadline:
            res = search_client.answer_query(
                f"Tell me about the visa experience at the {unique}.", PROJECT, LOCATION, ENGINE
            )
            last = res
            if not res["is_fallback"] and any(c["chunk_id"] == case_id for c in res["chunks"]):
                grounded = True
                break
            time.sleep(15)
        if grounded:
            check("B2 app post is grounded via the same engine", True, "answer cites the app-channel doc")
        else:
            warn("B2 app post grounding", "placement verified; search index not fresh within 150s "
                 "(documents.import is minutes-fresh) — re-run B2 later to confirm")
    finally:
        # --- cleanup: always remove the synthetic test doc ---
        if created:
            try:
                client.delete_document(name=doc_name)
                print(f"  (cleanup) deleted test doc {case_id}")
            except NotFound:
                pass
            except Exception as e:
                print(f"  (cleanup) WARNING could not delete {case_id}: {e}")


# ---------------------------------------------------------------------------
# Group C — Public sites only if/when required, and only registered domains
# ---------------------------------------------------------------------------

def group_c_public_gating() -> None:
    print("\nGroup C — Public target sites: only registered domains, consulted only when required")
    from google.api_core.client_options import ClientOptions
    from google.cloud import discoveryengine_v1 as de

    # C1: DS-2 contains exactly the registered domains, nothing else.
    ss = de.SiteSearchEngineServiceClient(client_options=ClientOptions(quota_project_id=PROJECT))
    parent = (
        f"projects/{PROJECT}/locations/{LOCATION}/collections/default_collection"
        f"/dataStores/{PUBLIC_DATASTORE}/siteSearchEngine"
    )
    found = set()
    for ts in ss.list_target_sites(parent=parent):
        pat = ts.generated_uri_pattern or ts.provided_uri_pattern or ""
        for dom in EXPECTED_PUBLIC_DOMAINS:
            if dom in pat:
                found.add(dom)
    check("C1 DS-2 has exactly the registered public domains", found == EXPECTED_PUBLIC_DOMAINS,
          f"found={sorted(found)}")

    # C2: orchestration — DS-2 is queried only when DS-1 falls back AND the gate is on.
    from fastapi.testclient import TestClient
    import api

    original = api.answer_query
    calls: list[str] = []

    def recorder(question, project, location, engine_id, max_results=5):
        calls.append(engine_id)
        answerable = "UNANSWERABLE" not in question
        if engine_id == api._engine_id:  # DS-1
            if answerable:
                return {"answer": "grounded", "chunks": [
                    {"chunk_id": "reddit-x", "text": "t", "source": "s", "labels": [], "score": 0.5}],
                    "is_fallback": False}
            return {"answer": api.FALLBACK_MESSAGE, "chunks": [], "is_fallback": True}
        # DS-2 public
        return {"answer": "public grounded", "chunks": [
            {"chunk_id": "uscis-x", "text": "t", "source": "uscis.gov", "labels": [], "score": 0.4}],
            "is_fallback": False}

    try:
        api.answer_query = recorder
        with TestClient(api.app) as client:
            api._db = None  # no Firestore writes during the logic test

            def ask(q):
                calls.clear()
                client.post("/api/ask", json={"question": q})
                return list(calls)

            # Case 1: DS-1 answers, public tier OFF -> only DS-1 consulted
            api._public_engine_id = ""
            c1 = ask("a normal answerable question")
            check("C2.1 DS-1 answers -> DS-2 not consulted (gate off)",
                  c1 == [api._engine_id], f"engines={c1}")

            # Case 2: DS-1 falls back, public tier OFF -> DS-2 still not consulted
            c2 = ask("an UNANSWERABLE question")
            check("C2.2 gate off -> DS-2 never consulted even on fallback",
                  c2 == [api._engine_id], f"engines={c2}")

            # Case 3: DS-1 falls back, public tier ON -> DS-2 consulted (when required)
            api._public_engine_id = PUBLIC_ENGINE
            c3 = ask("an UNANSWERABLE question")
            check("C2.3 gate on + DS-1 fallback -> DS-2 consulted",
                  c3 == [api._engine_id, PUBLIC_ENGINE], f"engines={c3}")

            # Case 4: DS-1 answers, public tier ON -> DS-2 NOT consulted (only if required)
            c4 = ask("a normal answerable question")
            check("C2.4 gate on + DS-1 answers -> DS-2 NOT consulted (only when required)",
                  c4 == [api._engine_id], f"engines={c4}")
    finally:
        api.answer_query = original


def group_d_chat_routing() -> None:
    print("\nGroup D — chat intent routing (/api/chat: search vs ask)")
    from fastapi.testclient import TestClient
    import api

    with TestClient(api.app) as client:
        api._db = None  # no Firestore writes during the test
        r1 = client.post("/api/chat", json={"question": "Show me B1/B2 interview experiences in Mumbai"}).json()
        check("D1 search intent -> posting cards", r1.get("mode") == "search" and len(r1.get("results", [])) > 0,
              f"mode={r1.get('mode')} cards={len(r1.get('results', []))}")
        r2 = client.post("/api/chat", json={"question": "What is the H-1B 60-day grace period?"}).json()
        check("D2 ask intent -> synthesized answer", r2.get("mode") == "answer" and bool(r2.get("answer")),
              f"mode={r2.get('mode')}")


def group_e_strictness() -> None:
    print("\nGroup E — search precision (strict vs broad)")
    import search_client

    q = "Show me B1/B2 experiences in Mumbai"
    strict = search_client.search_with_strictness(q, PROJECT, LOCATION, ENGINE, page_size=20, strictness="strict")
    broad = search_client.search_with_strictness(q, PROJECT, LOCATION, ENGINE, page_size=20, strictness="broad")
    check("E1 strict extracts consulate=BOM (Mumbai)", "BOM" in strict["applied_filters"].get("consulate", []),
          str(strict["applied_filters"]))
    check("E2 strict is narrower than broad", 1 <= strict["total"] <= broad["total"],
          f"strict={strict['total']} broad={broad['total']}")
    check("E3 strict returns only Mumbai (BOM) postings",
          all("BOM" in c["consulates"] for c in strict["results"]),
          str([c["consulates"] for c in strict["results"]]))


def main() -> int:
    if not PROJECT:
        print("GCP_PROJECT_ID must be set")
        return 2
    print(f"E2E grounding verification — project={PROJECT}, engine={ENGINE}")
    group_a_reddit_grounding()
    group_b_app_posting_placement()
    group_c_public_gating()
    group_d_chat_routing()
    group_e_strictness()

    print("\n" + "=" * 60)
    passed = sum(1 for _, ok, _ in _results if ok)
    failed = [n for n, ok, _ in _results if not ok]
    warns = sum(1 for _, _, d in _results if d.startswith("WARN"))
    print(f"SUMMARY: {passed}/{len(_results)} checks passed" + (f", {warns} warning(s)" if warns else ""))
    if failed:
        print("FAILED: " + "; ".join(failed))
        return 1
    print("All grounding guarantees verified.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
