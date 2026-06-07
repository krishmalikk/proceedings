"""
test_cloud_run.py — End-to-end validation against the DEPLOYED Cloud Run backend.

Hits the live `immiguide-api` over HTTP (not TestClient), validating the real
deployment: grounding, chat routing, search facets/filters/pagination,
strictness, posting detail, and context-aware suggested filters.

The deployed service rate-limits (10 req / 60s per IP), so every call retries
on HTTP 429 with a wait.

Run:  .venv/bin/python tests/test_cloud_run.py
Env:  CLOUD_RUN_URL  (default: the known immiguide-api URL)
"""

import os
import secrets
import sys
import time

import requests

BASE = os.getenv("CLOUD_RUN_URL", "https://immiguide-api-971592620882.us-central1.run.app").rstrip("/")
KNOWN_CASE_ID = "reddit-2026-04-11-USVisas-1socshn"

_results: list[tuple[str, bool, str]] = []


def check(name: str, passed: bool, detail: str = "") -> None:
    _results.append((name, passed, detail))
    print(f"  [{'PASS' if passed else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


def req(method: str, path: str, **kw):
    """HTTP call with retry-on-429 (deployed rate limit) and cold-start tolerance."""
    kw.setdefault("timeout", 90)
    last = None
    for _ in range(12):
        last = requests.request(method, BASE + path, **kw)
        if last.status_code != 429:
            return last
        time.sleep(8)
    return last


def get(path, **kw):
    return req("GET", path, **kw)


def post(path, body, **kw):
    return req("POST", path, json=body, **kw)


def delete(path, **kw):
    return req("DELETE", path, **kw)


def hdr(uid: str) -> dict:
    return {"X-User-Id": uid}


def group_a_health() -> None:
    print("\nA — Health")
    r = get("/api/health")
    ok = r.status_code == 200 and r.json().get("status") == "ok"
    check("A1 /api/health ok", ok, f"status={r.status_code} body={r.text[:80]}")


def group_b_grounding() -> None:
    print("\nB — Reddit grounding (deployed)")
    r = post("/api/ask", {"question": "B1/B2 visa interview experience in Mumbai"})
    d = r.json() if r.status_code == 200 else {}
    check("B1 /api/ask 200 + grounded", r.status_code == 200 and not d.get("is_fallback", True),
          f"status={r.status_code} sources={len(d.get('sources', []))}")
    srcs = [s["chunk_id"] for s in d.get("sources", [])]
    check("B2 sources are reddit-* (new datastore, not 40_0)",
          any(s.startswith("reddit-") for s in srcs), str(srcs[:2]))


def group_c_chat() -> None:
    print("\nC — Chat routing (deployed)")
    s = post("/api/chat", {"question": "Show me B1/B2 experiences in Mumbai"}).json()
    check("C1 search intent -> cards", s.get("mode") == "search" and len(s.get("results", [])) > 0,
          f"mode={s.get('mode')} cards={len(s.get('results', []))}")
    a = post("/api/chat", {"question": "What is the H-1B 60-day grace period?"}).json()
    check("C2 ask intent -> answer", a.get("mode") == "answer" and bool(a.get("answer")),
          f"mode={a.get('mode')}")


def group_d_search() -> None:
    print("\nD — Search: facets, filter precision, pagination, strictness (deployed)")
    base = get("/api/search", params={"q": "B1/B2 interview", "strictness": "broad"}).json()
    check("D1 suggested_filters present (Concern/Outcome/...)",
          len(base.get("suggested_filters", [])) >= 2,
          str([g["label"] for g in base.get("suggested_filters", [])]))

    bom = get("/api/search", params={"q": "B1/B2 interview", "consulate": "BOM"}).json()
    check("D2 explicit consulate=BOM -> only BOM postings",
          len(bom["results"]) >= 1 and all("BOM" in c["consulates"] for c in bom["results"]),
          f'{len(bom["results"])} results')

    p1 = get("/api/search", params={"q": "visa experience", "page_size": 3, "strictness": "broad"}).json()
    ids1 = [c["case_id"] for c in p1["results"]]
    p2 = get("/api/search", params={"q": "visa experience", "page_size": 3, "strictness": "broad",
                                    "page_token": p1["next_page_token"]}).json()
    ids2 = [c["case_id"] for c in p2["results"]]
    check("D3 pagination: page 2 disjoint from page 1", bool(ids1) and set(ids1).isdisjoint(ids2),
          f"p1={len(ids1)} p2={len(ids2)}")

    strict = get("/api/search", params={"q": "B1/B2 in Mumbai", "strictness": "strict"}).json()
    broad = get("/api/search", params={"q": "B1/B2 in Mumbai", "strictness": "broad"}).json()
    check("D4 strict total <= broad total", 1 <= strict["total"] <= broad["total"],
          f'strict={strict["total"]} broad={broad["total"]}')


def group_e_postings() -> None:
    print("\nE — Posting detail (deployed)")
    r = get(f"/api/postings/{KNOWN_CASE_ID}")
    d = r.json() if r.status_code == 200 else {}
    check("E1 known posting 200 + body", r.status_code == 200 and len(d.get("body", "")) > 100,
          f'status={r.status_code} body={len(d.get("body", ""))}')
    r404 = get("/api/postings/does-not-exist-xyz")
    check("E2 missing posting -> 404", r404.status_code == 404, f"status={r404.status_code}")


def group_f_context_filters() -> None:
    print("\nF — Context-aware filters + exact selection (deployed)")
    chat = post("/api/chat", {"question": "I am on H-1B applying for extension with a question on RFE"})
    d = chat.json()
    concern = next((g for g in d.get("suggested_filters", []) if g["key"] == "concern"), {})
    vals = concern.get("values", [])
    check("F1 H-1B concerns are hierarchy-related (h1b-*) + counted",
          any(v["code"].startswith("h1b-") for v in vals) and all("count" in v for v in vals),
          str([v["code"] for v in vals[:4]]))

    base = get("/api/search", params={"q": "H-1B experiences", "strictness": "broad"}).json()
    sel = get("/api/search", params={"q": "H-1B experiences", "strictness": "broad",
                                     "facet": "concerns_or_questions_tags:h1b-rfe"}).json()
    check("F2 selecting a facet chip narrows exactly",
          0 < sel["total"] < base["total"], f'base={base["total"]} selected={sel["total"]}')


def _cleanup_interactions(parent: str, reply_ids: list[str]) -> None:
    """Best-effort hard delete of Firestore docs a run created (keeps the
    deployed service clean). No-op if ADC/Firestore is unavailable."""
    try:
        from google.cloud import firestore
        db = firestore.Client(project=os.getenv("GCP_PROJECT_ID") or os.getenv("GCP_PROJECT"))
        for rid in set(reply_ids):
            db.collection("replies").document(rid).delete()
            db.collection("content_meta").document(rid).delete()
        db.collection("content_meta").document(parent).delete()
        for cid in set([parent, *reply_ids]):
            for uid in ("demo-arjun", "demo-mei"):
                db.collection("votes").document(f"{cid}__{uid}").delete()
    except Exception as e:  # noqa: BLE001
        print(f"  cleanup note: {e}")


def group_g_interactions() -> None:
    print("\nG — Replies + voting (deployed, phase-L)")
    parent = f"test-posting-cr-{secrets.token_hex(4)}"  # synthetic; not a real case_id
    created: list[str] = []
    try:
        # anonymous read works; gating blocks writes
        g0 = get(f"/api/postings/{parent}/replies")
        d0 = g0.json() if g0.status_code == 200 else {}
        check("G1 anon list replies 200 + empty + zero tally",
              g0.status_code == 200 and d0.get("total") == 0 and d0.get("posting", {}).get("score") == 0,
              f"status={g0.status_code}")

        noauth = post(f"/api/postings/{parent}/replies", {"body": "nope"})
        check("G2 reply without user -> 400", noauth.status_code == 400, f"status={noauth.status_code}")

        rp = post(f"/api/postings/{parent}/replies", {"body": "Cloud Run e2e reply"}, headers=hdr("demo-arjun"))
        rj = rp.json() if rp.status_code == 200 else {}
        rid = rj.get("id", "")
        if rid:
            created.append(rid)
        check("G3 reply as arjun -> 200 (handle + is_author)",
              rp.status_code == 200 and rj.get("author_handle") == "arjun-h1b" and rj.get("is_author") is True,
              f"status={rp.status_code}")

        v = post("/api/votes", {"content_id": rid, "dir": 1}, headers=hdr("demo-mei")).json()
        check("G4 upvote reply -> score 1, your_vote 1", v.get("score") == 1 and v.get("your_vote") == 1, str(v))

        vswitch = post("/api/votes", {"content_id": rid, "dir": -1}, headers=hdr("demo-mei")).json()
        vclear = post("/api/votes", {"content_id": rid, "dir": 0}, headers=hdr("demo-mei")).json()
        check("G5 switch to down (-1) then clear (0)",
              vswitch.get("score") == -1 and vclear.get("score") == 0 and vclear.get("your_vote") == 0,
              f"switch={vswitch.get('score')} clear={vclear.get('score')}")

        post("/api/votes", {"content_id": parent, "dir": 1}, headers=hdr("demo-arjun"))
        pv = post("/api/votes", {"content_id": parent, "dir": 1}, headers=hdr("demo-mei")).json()
        check("G6 two users upvote posting -> score 2", pv.get("score") == 2, str(pv))

        listed = get(f"/api/postings/{parent}/replies", headers=hdr("demo-arjun")).json()
        r0 = (listed.get("replies") or [{}])[0]
        check("G7 list reflects state (reply visible, posting your_vote=1)",
              r0.get("id") == rid and r0.get("is_author") is True and listed.get("posting", {}).get("your_vote") == 1,
              f"posting={listed.get('posting')}")

        dwrong = delete(f"/api/postings/{parent}/replies/{rid}", headers=hdr("demo-mei"))
        dauthor = delete(f"/api/postings/{parent}/replies/{rid}", headers=hdr("demo-arjun"))
        check("G8 delete: wrong-user 403, author 200",
              dwrong.status_code == 403 and dauthor.status_code == 200,
              f"wrong={dwrong.status_code} author={dauthor.status_code}")

        after = get(f"/api/postings/{parent}/replies").json()
        check("G9 soft-deleted reply hidden from list", rid not in {r["id"] for r in after.get("replies", [])})
    finally:
        _cleanup_interactions(parent, created)
        print("  cleaned up interactions test docs")


def group_h_matching() -> None:
    print("\nH — Find users in same boat + groups (deployed, phase-M)")
    try:
        from google.cloud import firestore
        db = firestore.Client(project=os.getenv("GCP_PROJECT_ID") or os.getenv("GCP_PROJECT"))
    except Exception as e:  # noqa: BLE001
        check("H0 Firestore available for seeding", False, str(e))
        return
    strong, weak = f"test-peer-strong-{secrets.token_hex(3)}", f"test-peer-weak-{secrets.token_hex(3)}"
    group_id = ""
    try:
        db.collection("users").document(strong).set(
            {"username": "strong-peer", "current_visa_or_greencard_category": ["H-1B"],
             "consulates": ["BOM"], "key_stages_or_info": {"citizen_of_country": "IN"}})
        db.collection("users").document(weak).set(
            {"username": "weak-peer", "current_visa_or_greencard_category": ["H-1B"]})

        check("H1 matches without user → 400", post("/api/find/matches", {"criteria": {}}).status_code == 400)

        crit = {"current_visa_or_greencard_category": ["H-1B"], "consulates": ["BOM"],
                "key_stages_or_info": {"citizen_of_country": "IN"}}
        r = post("/api/find/matches", {"criteria": crit}, headers=hdr("demo-arjun"))
        by = {m["user_id"]: m for m in r.json().get("matches", [])}
        check("H2 matches 200 + excludes self + ranks strong>weak",
              r.status_code == 200 and "demo-arjun" not in by and strong in by and weak in by
              and by[strong]["score"] > by[weak]["score"],
              f"status={r.status_code} strong={by.get(strong, {}).get('score')} weak={by.get(weak, {}).get('score')}")

        empty = post("/api/groups", {"criteria_text": "x", "criteria": {}, "members": []}, headers=hdr("demo-arjun"))
        check("H3 non-distinctive criteria → 422", empty.status_code == 422, f"status={empty.status_code}")

        crit_g = {"current_visa_or_greencard_category": ["H-1B"], "consulates": ["BOM"]}
        g = post("/api/groups", {"criteria_text": "H-1B at Mumbai", "criteria": crit_g,
                                 "members": [{"user_id": strong, "username": "strong-peer"}]}, headers=hdr("demo-arjun"))
        gj = g.json()
        group_id = gj.get("group_id", "")
        mids = {m["user_id"] for m in gj.get("members", [])}
        check("H4 create 200 + generated name + me & peer members + not joined",
              g.status_code == 200 and group_id and gj.get("name")
              and {"demo-arjun", strong} <= mids and gj.get("joined") is False, f"status={g.status_code}")

        # same signature as another user → joins the same group
        g2 = post("/api/groups", {"criteria_text": "same boat", "criteria": crit_g, "members": []}, headers=hdr("demo-mei"))
        check("H5 same-signature → joins existing group",
              g2.json().get("group_id") == group_id and g2.json().get("joined") is True, str(g2.json().get("joined")))

        allg = get("/api/groups/all", headers=hdr("demo-sofia")).json().get("groups", [])
        mine = next((x for x in allg if x.get("group_id") == group_id), {})
        check("H6 browse /api/groups/all + is_member False for non-member",
              bool(mine) and mine.get("is_member") is False)
        j = post("/api/groups/%s/join" % group_id, {}, headers=hdr("demo-sofia"))
        check("H7 join 200 + joined", j.status_code == 200 and j.json().get("joined") is True, f"status={j.status_code}")
    finally:
        for u in (strong, weak):
            db.collection("users").document(u).delete()
        if group_id:
            db.collection("groups").document(group_id).delete()
        print("  cleaned up matching test docs")


def main() -> int:
    print(f"Cloud Run E2E — {BASE}")
    group_a_health()
    group_b_grounding()
    group_c_chat()
    group_d_search()
    group_e_postings()
    group_f_context_filters()
    group_g_interactions()
    group_h_matching()

    print("\n" + "=" * 60)
    passed = sum(1 for _, ok, _ in _results if ok)
    failed = [n for n, ok, _ in _results if not ok]
    print(f"SUMMARY: {passed}/{len(_results)} checks passed")
    if failed:
        print("FAILED: " + "; ".join(failed))
        return 1
    print("Deployed Cloud Run backend validated.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
