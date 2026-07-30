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
# The exact posting from the changes-2-.md item 3 bug report — its title is
# literally "POE - Boston"; used to verify the relevance-sort fix surfaces it
# near the top of a free-text search instead of being buried by recency sort.
KNOWN_POE_BOSTON_CASE_ID = "app-2026-07-29-890d259a"

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

    # features/ui-changes-1/changes-2-.md item 3: "H1B RFE POE Boston" under
    # strict precision returned many unrelated postings because RFE (outcome
    # min_len was 5, RFE is 3 chars) and POE (abbreviations/1.3 was never
    # registered as a facet at all) were both silently dropped.
    f6 = codes("H1B RFE POE Boston")
    check("F6 RFE now matches (outcome min_len 5->3, exact-code match unchanged)",
          "RFE" in f6.get("outcome", []), str(f6))
    check("F7 POE now matches via new 'abbreviation' facet (1.3-abbreviations.csv)",
          "POE" in f6.get("abbreviation", []), str(f6))


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

        # features/ui-changes-1/changes-2-.md item 3, second half: forcing
        # posting_date-desc on every free-text query buried a
        # strongly-matching-but-older posting under unrelated recent ones.
        # Default sort is now relevance for free-text queries; this exact
        # posting (title literally "POE - Boston") should rank near the top
        # for a query naming its own content, not wherever recency put it.
        poe = client.get("/api/search", params={"q": "H1B RFE POE Boston", "strictness": "broad"}).json()
        top_ids = [c["case_id"] for c in poe["results"][:5]]
        check("H4 relevance-sorted free-text search ranks the matching posting in the top 5",
              KNOWN_POE_BOSTON_CASE_ID in top_ids, f"top5={top_ids}")


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


# ---------------------------------------------------------------------------
# L — News-update tag survival + 7-day gov-news recency filter (changes-2-.md
#     items 1 & 5). Mixes a deterministic UNIT check (no GCP) with live
#     INTEGRATION checks against the real datastore.
# ---------------------------------------------------------------------------

def group_l_news_filtering() -> None:
    print("\nL — news-update tag survival + 7-day gov-news filter")
    import search_client as s

    # L1 (unit, no GCP): "news-update" must survive into the card even when a
    # different array wins the tags fallback chain (concerns_or_questions_tags
    # here) and even when the raw tags array is at/over the 8-item cap.
    meta = {
        "post_title": "Synthetic gov-news doc",
        "concerns_or_questions_tags": ["a-different-array-won"],
        "tags": ["t1", "t2", "t3", "t4", "t5", "t6", "t7", "news-update"],
    }
    card = s._card_from_struct("synthetic-case-id", meta)
    check("L1 news-update survives into card.tags despite a different fallback array winning",
          "news-update" in card["tags"], str(card["tags"]))

    meta_no_news = {"post_title": "x", "tags": ["a", "b"]}
    card_no_news = s._card_from_struct("synthetic-case-id-2", meta_no_news)
    check("L2 no false positive: news-update NOT injected when absent from raw tags",
          "news-update" not in card_no_news["tags"], str(card_no_news["tags"]))

    # L3/L4 (integration): a broad free-text query that surfaces gov_news
    # content should only include gov_news items within the last 7 days
    # (by posting_date, i.e. event/source date) — older gov_news should be
    # excluded from ordinary keyword search entirely.
    from fastapi.testclient import TestClient
    import api
    from datetime import datetime, timedelta, timezone

    cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%d")
    with TestClient(api.app) as client:
        api._db = None
        r = client.get("/api/search", params={"q": "USCIS policy update", "strictness": "broad",
                                               "page_size": 50}).json()
        gov_news_results = [c for c in r["results"] if c["channel"] == "gov_news"]
        stale = [c["case_id"] for c in gov_news_results if c["date"] and c["date"] <= cutoff]
        check("L3 free-text search excludes gov_news older than 7 days",
              not stale, f"stale={stale}")
        check("L4 gov_news results (if any) that DO appear carry the news-update tag",
              all("news-update" in c["tags"] for c in gov_news_results),
              str([(c["case_id"], c["tags"]) for c in gov_news_results if "news-update" not in c["tags"]]))

        # News tab's own path (explicit doc_kind:gov_news facet chip) must stay
        # unaffected by the 7-day carve-out — it's a different branch (hard
        # filter, not free-text) specifically so old news stays reachable there.
        news_tab = client.get("/api/search", params={"q": "", "facet": "doc_kind:gov_news",
                                                      "page_size": 50}).json()
        news_tab_old = [c for c in news_tab["results"] if c["date"] and c["date"] <= cutoff]
        check("L5 News tab's explicit facet path still returns old gov_news (unaffected by the carve-out)",
              len(news_tab_old) > 0, f"{len(news_tab_old)} old items via News tab path")


# ---------------------------------------------------------------------------
# M — Query-derived tags (changes-2-.md item 4)
# ---------------------------------------------------------------------------

def group_m_query_tags() -> None:
    print("\nM — query-derived tags (posting.suggest_query_tags)")
    import posting

    # The model is occasionally non-deterministic on a short 4-word fragment
    # (unlike a real posting's full title+description); allow up to 3
    # attempts before declaring a miss — same tolerance test_posting_tagging.py's
    # F7 already applies to Gemini-based tagging checks.
    tags: list = []
    codes: set = set()
    for _ in range(3):
        tags = posting.suggest_query_tags("H1B RFE POE Boston")
        codes = {t["code"] for t in tags}
        if codes & {"RFE", "POE"}:
            break
    check("M1 suggest_query_tags surfaces RFE and/or POE from the query text (<=3 tries)",
          bool(codes & {"RFE", "POE"}), str(tags))
    check("M2 every returned tag has the {field, code, label} shape",
          all({"field", "code", "label"} <= set(t) for t in tags), str(tags))

    check("M3 empty query returns no tags (no wasted Gemini call)",
          posting.suggest_query_tags("") == [] and posting.suggest_query_tags("   ") == [])

    from fastapi.testclient import TestClient
    import api
    with TestClient(api.app) as client:
        r = client.post("/api/search/query-tags", json={"q": "H1B RFE POE Boston"})
        check("M4 /api/search/query-tags returns 200 with a tags list",
              r.status_code == 200 and isinstance(r.json().get("tags"), list),
              f"status={r.status_code}")


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
    group_l_news_filtering()
    group_m_query_tags()

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
