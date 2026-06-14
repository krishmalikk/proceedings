"""
test_author_handle.py — first-party authorship surfacing + author-by-handle.

Covers the change: a posting that originated on THIS platform (carries an
`author_handle`) exposes that handle on the detail response, and the handle is
clickable to a page listing all of that author's postings. External (Reddit)
ingests carry no handle and surface none.

Groups:
  A   postings_by_handle lookup + cache semantics (fake index builder) — no network
  A2  _build_handle_index over a fake document client (filtering + sort) — no network
  B   live datastore + FastAPI TestClient: detail.author_handle, by-handle
      endpoint, unknown handle, external posting has no handle — INTEGRATION

Run:  .venv/bin/python tests/test_author_handle.py [unit|integration|all]
      unit         → groups A + A2 (no GCP)
      integration  → A + A2 + B (needs datastore ADC)
      all (default)→ same as integration
"""

import copy
import os
import sys

from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv()

import search_client as sc  # noqa: E402

PROJECT = os.getenv("GCP_PROJECT_ID") or os.getenv("GCP_PROJECT", "")

_results: list[tuple[str, bool]] = []


def check(name: str, passed: bool, detail: str = "") -> None:
    _results.append((name, passed))
    print(f"  [{'PASS' if passed else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


def _reset_index() -> None:
    sc._handle_index = {"built_at": 0.0, "map": {}}


# ---------------------------------------------------------------------------
# A — postings_by_handle: lookup, blank short-circuit, caching, TTL, copy
# ---------------------------------------------------------------------------

def group_a_lookup() -> None:
    print("\nA — postings_by_handle lookup + cache (fake builder, no network)")

    INDEX = {
        "brave-maple-3272": [{"case_id": "app-1", "date": "2026-06-13"}],
        "rajmalikk": [
            {"case_id": "app-new", "date": "2026-06-20"},
            {"case_id": "app-old", "date": "2026-06-01"},
        ],
    }
    calls = {"n": 0}

    def fake_build(_pid, _loc, _ds):
        calls["n"] += 1
        return copy.deepcopy(INDEX)

    orig_build = sc._build_handle_index
    sc._build_handle_index = fake_build
    try:
        _reset_index()
        calls["n"] = 0

        # blank / whitespace handle short-circuits BEFORE building the index
        r = sc.postings_by_handle("   ", "p", "l", "d")
        check("A1 blank handle → [] and no index build", r == [] and calls["n"] == 0,
              f"r={r} builds={calls['n']}")

        # known handle returns exactly that author's postings
        r = sc.postings_by_handle("brave-maple-3272", "p", "l", "d")
        check("A2 known handle returns its postings", [c["case_id"] for c in r] == ["app-1"], str(r))

        # unknown handle → [] (index already built, so this is a pure miss)
        r = sc.postings_by_handle("does-not-exist", "p", "l", "d")
        check("A3 unknown handle → []", r == [])

        # index built exactly once across the three lookups above (cached)
        check("A4 index built once within TTL (cached)", calls["n"] == 1, f"builds={calls['n']}")

        # a stale index (built_at past the TTL) triggers a rebuild
        sc._handle_index["built_at"] = 0.0
        sc.postings_by_handle("rajmalikk", "p", "l", "d")
        check("A5 stale index triggers a rebuild", calls["n"] == 2, f"builds={calls['n']}")

        # the returned list is a copy — mutating it does not corrupt the cache
        r = sc.postings_by_handle("brave-maple-3272", "p", "l", "d")
        r.append({"case_id": "injected"})
        r2 = sc.postings_by_handle("brave-maple-3272", "p", "l", "d")
        check("A6 returned list is a copy (cache intact)", len(r2) == 1, str(r2))
    finally:
        sc._build_handle_index = orig_build
        _reset_index()


# ---------------------------------------------------------------------------
# A2 — _build_handle_index over a fake document client: only docs WITH a
#      handle are indexed, grouped by handle, newest-first, case_id == doc.id
# ---------------------------------------------------------------------------

class _FakeDoc:
    def __init__(self, doc_id: str, struct: dict):
        self.id = doc_id
        self.struct_data = struct


class _FakeDocClient:
    def __init__(self, docs):
        self._docs = docs

    def __call__(self, *a, **k):  # used as the DocumentServiceClient factory
        return self

    def list_documents(self, request=None):
        return iter(self._docs)


def group_a2_build_index() -> None:
    print("\nA2 — _build_handle_index (fake document client, no network)")

    docs = [
        _FakeDoc("app-a", {"author_handle": "brave-maple-3272", "post_title": "A", "posting_date": "2026-06-01"}),
        _FakeDoc("app-b", {"author_handle": "brave-maple-3272", "post_title": "B", "posting_date": "2026-06-20"}),
        _FakeDoc("reddit-x", {"post_title": "R", "posting_date": "2026-06-05"}),               # no handle
        _FakeDoc("ow-c", {"author_handle": "wise-comet-2799", "post_title": "C", "posting_date": "2026-06-10"}),
        _FakeDoc("blank-d", {"author_handle": "   ", "post_title": "D", "posting_date": "2026-06-09"}),  # blank handle
    ]
    fake_client = _FakeDocClient(docs)

    orig_client = sc.de.DocumentServiceClient
    orig_s2d = sc._struct_to_dict
    sc.de.DocumentServiceClient = fake_client          # factory returns the fake
    sc._struct_to_dict = lambda sd: sd                 # fakes already carry plain dicts
    try:
        idx = sc._build_handle_index("p", "l", "d")

        check("A2.1 only docs with a real handle are indexed",
              set(idx.keys()) == {"brave-maple-3272", "wise-comet-2799"}, str(set(idx.keys())))

        all_ids = [c["case_id"] for cards in idx.values() for c in cards]
        check("A2.2 handle-less / blank-handle docs excluded",
              "reddit-x" not in all_ids and "blank-d" not in all_ids, str(all_ids))

        ids = [c["case_id"] for c in idx["brave-maple-3272"]]
        check("A2.3 newest-first within a handle (by date)", ids == ["app-b", "app-a"], str(ids))

        check("A2.4 card case_id comes from doc.id", idx["wise-comet-2799"][0]["case_id"] == "ow-c")
    finally:
        sc.de.DocumentServiceClient = orig_client
        sc._struct_to_dict = orig_s2d


# ---------------------------------------------------------------------------
# B — live datastore + API (INTEGRATION). Self-discovers a real first-party
#     handle, so it does not hard-code environment-specific case ids.
# ---------------------------------------------------------------------------

def group_b_integration() -> None:
    print("\nB — live datastore + API (integration)")
    from fastapi.testclient import TestClient
    import api

    loc = os.getenv("GCP_VERTEX_DATASTORE_LOCATION") or "global"
    ds = os.getenv("GCP_VERTEX_DATASTORE_ID") or ""

    idx = sc._build_handle_index(PROJECT, loc, ds)
    first_party = {h: v for h, v in idx.items() if v}
    if not first_party:
        check("B0 datastore has ≥1 first-party (handled) posting", False,
              "no author_handle postings found — cannot exercise integration")
        return

    handle, cards = next(iter(first_party.items()))
    expected_ids = sorted(c["case_id"] for c in cards)
    sample_cid = cards[0]["case_id"]

    with TestClient(api.app) as client:
        # 1) detail surfaces author_handle for a first-party posting
        r = client.get(f"/api/postings/{sample_cid}")
        ah = r.json().get("author_handle", "") if r.status_code == 200 else ""
        check("B1 posting detail surfaces author_handle", r.status_code == 200 and ah == handle,
              f"status={r.status_code} author_handle={ah!r} expected={handle!r}")

        # 2) by-handle endpoint lists exactly that author's postings
        r2 = client.get(f"/api/authors/by-handle/{handle}/postings")
        got_ids = sorted(p["case_id"] for p in r2.json().get("postings", [])) if r2.status_code == 200 else []
        check("B2 by-handle endpoint returns the author's postings",
              r2.status_code == 200 and got_ids == expected_ids,
              f"status={r2.status_code} got={got_ids} expected={expected_ids}")

        # 3) unknown handle → empty list (still 200)
        r3 = client.get("/api/authors/by-handle/__no-such-handle__zzz/postings")
        check("B3 unknown handle → empty postings", r3.status_code == 200 and r3.json().get("postings") == [],
              f"status={r3.status_code} body={r3.text[:120]}")

        # 4) an external (Reddit) posting carries NO handle, if one is discoverable
        s = client.get("/api/search?q=H-1B&page_size=10")
        reddit = next((x for x in s.json().get("results", [])
                       if str(x.get("case_id", "")).startswith("reddit-")), None) if s.status_code == 200 else None
        if reddit:
            rd = client.get(f"/api/postings/{reddit['case_id']}")
            check("B4 external (Reddit) posting has no author_handle",
                  rd.status_code == 200 and rd.json().get("author_handle", "") == "",
                  f"author_handle={rd.json().get('author_handle')!r}")
        else:
            print("  [skip] B4 — no Reddit posting surfaced to assert against")


def main() -> int:
    only = sys.argv[1] if len(sys.argv) > 1 else "all"
    if not PROJECT and only != "unit":
        print("GCP_PROJECT_ID must be set")
        return 2
    print(f"author-handle tests — project={PROJECT or '(none)'}  (scope={only})")

    group_a_lookup()
    group_a2_build_index()
    if only in ("all", "integration"):
        group_b_integration()

    print("\n" + "=" * 60)
    passed = sum(1 for _, ok in _results if ok)
    failed = [n for n, ok in _results if not ok]
    print(f"SUMMARY: {passed}/{len(_results)} checks passed")
    if failed:
        print("FAILED: " + "; ".join(failed))
        return 1
    print("All author-handle checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
