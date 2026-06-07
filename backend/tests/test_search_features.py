"""
test_search_features.py — Phase B + precision features (search mode, chat
routing, generic facet extraction, strictness, posting detail, pagination).

Complements tests/test_grounding_e2e.py. Mixes fast deterministic UNIT checks
(facet extraction, filter/boost builders, heuristic intent — no GCP) with live
INTEGRATION checks through FastAPI's TestClient.

Run:  .venv/bin/python tests/test_search_features.py
"""

import os
import sys

from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv()

PROJECT = os.getenv("GCP_PROJECT_ID") or os.getenv("GCP_PROJECT", "")
LOCATION = os.getenv("GCP_VERTEX_DATASTORE_LOCATION", "global")
ENGINE = os.getenv("GCP_VERTEX_SEARCH_APP_ID", "imm-postings-search-app")
KNOWN_CASE_ID = "reddit-2026-04-11-USVisas-1socshn"  # the Australia B1/B2 post

_results: list[tuple[str, bool, str]] = []


def check(name: str, passed: bool, detail: str = "") -> None:
    _results.append((name, passed, detail))
    print(f"  [{'PASS' if passed else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


# ---------------------------------------------------------------------------
# F — Generic facet extraction (UNIT, deterministic, no GCP)
# ---------------------------------------------------------------------------

def group_f_extraction() -> None:
    print("\nF — Generic facet extraction (unit)")
    import search_client as s

    codes = lambda q: s.applied_codes(s.extract_filters(q))  # noqa: E731

    f1 = codes("approved B1/B2 in Mumbai")
    check("F1 multi-facet: consulate+visa+outcome",
          f1.get("consulate") == ["BOM"] and set(f1.get("visa", [])) == {"B-1", "B-2"}
          and f1.get("outcome") == ["approved"], str(f1))

    f2 = codes("my bombay interview")
    check("F2 consulate alias bombay -> BOM", f2.get("consulate") == ["BOM"], str(f2))

    f3 = codes("EB-2 green card consular processing")
    check("F3 green-card category + topical tag",
          f3.get("category") == ["EB-2"] and "consular-processing" in f3.get("tag", []), str(f3))

    f4 = codes("hello how is the weather today")
    check("F4 no facets for an off-topic sentence", f4 == {}, str(f4))

    f5 = codes("F-1 student visa denied in Hyderabad")
    check("F5 visa + outcome + consulate across fields",
          f5.get("visa") == ["F-1"] and f5.get("consulate") == ["HYD"]
          and f5.get("outcome") == ["denied"], str(f5))


# ---------------------------------------------------------------------------
# G — Filter / boost builders + heuristic intent (UNIT)
# ---------------------------------------------------------------------------

def group_g_builders() -> None:
    print("\nG — Filter/boost builders + heuristic intent (unit)")
    import search_client as s

    facets = s.extract_filters("approved B1/B2 in Mumbai")
    expr = s._filter_expr_from_facets(facets)
    check("G1 filter expr ANDs facets + ORs fields/values",
          " AND " in expr and 'consulates: ANY("BOM")' in expr
          and 'visa_applying_for: ANY("B-1")' in expr
          and 'key_stages_or_info.outcome_status: ANY("approved")' in expr, expr[:120])

    boost = s._boost_from_facets(facets)
    check("G2 boost spec built from facets", boost is not None and len(boost.condition_boost_specs) == 3,
          f"conditions={len(boost.condition_boost_specs) if boost else 0}")

    check("G3 empty facets -> empty filter / no boost",
          s._filter_expr_from_facets({}) == "" and s._boost_from_facets({}) is None)

    import query
    check("G4 heuristic intent: 'show me ...' -> search",
          query._heuristic_intent("show me B1/B2 experiences in Delhi") == "search")
    check("G5 heuristic intent: 'what is ...' -> ask",
          query._heuristic_intent("what is the H-1B grace period") == "ask")


# ---------------------------------------------------------------------------
# H — /api/search endpoint (INTEGRATION)
# ---------------------------------------------------------------------------

def group_h_search_endpoint() -> None:
    print("\nH — /api/search endpoint (integration)")
    from fastapi.testclient import TestClient
    import api

    with TestClient(api.app) as client:
        api._db = None

        r = client.get("/api/search", params={"q": "B1/B2 interview", "consulate": "BOM"}).json()
        check("H1 explicit consulate=BOM -> only BOM postings",
              len(r["results"]) >= 1 and all("BOM" in c["consulates"] for c in r["results"]),
              f'{len(r["results"])} results')

        p1 = client.get("/api/search", params={"q": "visa experience", "page_size": 3, "strictness": "broad"}).json()
        ids1 = [c["case_id"] for c in p1["results"]]
        check("H2a page 1 returns a next_page_token", bool(p1["next_page_token"]), f"{len(ids1)} results")
        if p1["next_page_token"]:
            p2 = client.get("/api/search", params={"q": "visa experience", "page_size": 3,
                                                   "strictness": "broad", "page_token": p1["next_page_token"]}).json()
            ids2 = [c["case_id"] for c in p2["results"]]
            check("H2b page 2 is disjoint from page 1", set(ids1).isdisjoint(ids2), f"p2={ids2}")

        strict = client.get("/api/search", params={"q": "B1/B2 in Mumbai", "strictness": "strict"}).json()
        broad = client.get("/api/search", params={"q": "B1/B2 in Mumbai", "strictness": "broad"}).json()
        check("H3 strict total <= broad total", 1 <= strict["total"] <= broad["total"],
              f'strict={strict["total"]} broad={broad["total"]}')


# ---------------------------------------------------------------------------
# I — /api/postings/{id} detail (INTEGRATION)
# ---------------------------------------------------------------------------

def group_i_posting_detail() -> None:
    print("\nI — /api/postings/{id} detail (integration)")
    from fastapi.testclient import TestClient
    import api

    with TestClient(api.app) as client:
        r = client.get(f"/api/postings/{KNOWN_CASE_ID}")
        ok = r.status_code == 200
        body = r.json() if ok else {}
        check("I1 known posting returns 200 with body + title",
              ok and len(body.get("body", "")) > 100 and bool(body.get("title")),
              f'status={r.status_code} body_chars={len(body.get("body", ""))}')
        check("I1b detail carries facets (visa/consulate)",
              bool(body.get("visa")) or bool(body.get("consulates")),
              f'visa={body.get("visa")} consulates={body.get("consulates")}')

        r404 = client.get("/api/postings/does-not-exist-xyz")
        check("I2 missing posting returns 404", r404.status_code == 404, f"status={r404.status_code}")


# ---------------------------------------------------------------------------
# J — /api/chat strictness + relax fallback (INTEGRATION)
# ---------------------------------------------------------------------------

def group_j_chat_strictness() -> None:
    print("\nJ — /api/chat strictness + relax (integration)")
    from fastapi.testclient import TestClient
    import api

    with TestClient(api.app) as client:
        api._db = None

        strict = client.post("/api/chat", json={"question": "Show me B1/B2 experiences in Mumbai",
                                                "strictness": "strict"}).json()
        broad = client.post("/api/chat", json={"question": "Show me B1/B2 experiences in Mumbai",
                                               "strictness": "broad"}).json()
        check("J1 strict search returns fewer cards than broad",
              strict["mode"] == "search" and broad["mode"] == "search"
              and len(strict["results"]) <= len(broad["results"]),
              f'strict={len(strict["results"])} broad={len(broad["results"])}')
        check("J2 strict applies extracted facets (consulate=BOM)",
              "BOM" in strict.get("applied_filters", {}).get("consulate", []),
              str(strict.get("applied_filters")))

        # H-1B has no Mumbai posting -> strict finds nothing -> relaxes to balanced.
        relaxed = client.post("/api/chat", json={"question": "Show me H-1B experiences in Mumbai",
                                                "strictness": "strict"}).json()
        check("J3 over-narrow strict relaxes (relaxed flag set)",
              relaxed.get("relaxed") is True and relaxed.get("effective_strictness") == "balanced",
              f'relaxed={relaxed.get("relaxed")} eff={relaxed.get("effective_strictness")}')


def group_k_context_filters() -> None:
    print("\nK — Context-aware dynamic filters (hierarchy + live counts)")
    import search_client as s

    groups = s.suggested_filters("I am on H-1B applying for extension with a question on RFE",
                                 PROJECT, LOCATION, ENGINE)
    by_key = {g["key"]: g for g in groups}
    check("K1 returns facet groups (concern/outcome/...)", len(groups) >= 2, str(list(by_key)))
    concern = by_key.get("concern", {}).get("values", [])
    check("K2 H-1B concerns are hierarchy-related (h1b-*) and counted",
          any(v["code"].startswith("h1b-") for v in concern) and all("count" in v for v in concern),
          str([v["code"] for v in concern[:4]]))

    from fastapi.testclient import TestClient
    import api
    with TestClient(api.app) as client:
        api._db = None
        base = client.get("/api/search", params={"q": "H-1B experiences", "strictness": "broad"}).json()
        sel = client.get("/api/search", params={"q": "H-1B experiences", "strictness": "broad",
                                                "facet": "concerns_or_questions_tags:h1b-rfe"}).json()
        check("K3 selecting a facet chip narrows results exactly",
              0 < sel["total"] < base["total"], f'base={base["total"]} selected={sel["total"]}')
        chat = client.post("/api/chat", json={"question": "Show me H-1B experiences", "strictness": "broad",
                                              "facets": ["concerns_or_questions_tags:h1b-rfe"]}).json()
        check("K4 /api/chat honors selected facets",
              chat["mode"] == "search" and 0 < len(chat["results"]) <= sel["total"],
              f'cards={len(chat["results"])}')


def main() -> int:
    if not PROJECT:
        print("GCP_PROJECT_ID must be set")
        return 2
    # This suite makes many TestClient calls from one IP; lift the API rate limit.
    import api
    api.RATE_LIMIT_MAX = 100000
    print(f"Search-feature tests — project={PROJECT}, engine={ENGINE}")
    group_f_extraction()
    group_g_builders()
    group_h_search_endpoint()
    group_i_posting_detail()
    group_j_chat_strictness()
    group_k_context_filters()

    print("\n" + "=" * 60)
    passed = sum(1 for _, ok, _ in _results if ok)
    failed = [n for n, ok, _ in _results if not ok]
    print(f"SUMMARY: {passed}/{len(_results)} checks passed")
    if failed:
        print("FAILED: " + "; ".join(failed))
        return 1
    print("All search-feature checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
