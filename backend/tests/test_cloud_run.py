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
from dotenv import load_dotenv

# Put the backend package dir on the path so local modules (e.g. `posting`,
# which performs datastore-side cleanup) import regardless of the CWD the test
# is launched from.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Load the repo `.env` so GCP_PROJECT_ID (→ proceedings-490601) drives the
# Firestore cleanup client explicitly, instead of silently falling back to
# whatever project ADC / gcloud config happens to default to.
load_dotenv()

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


def group_i_chat() -> None:
    print("\nI — Group chat messages (deployed, phase-N)")
    try:
        from google.cloud import firestore
        db = firestore.Client(project=os.getenv("GCP_PROJECT_ID") or os.getenv("GCP_PROJECT"))
    except Exception as e:  # noqa: BLE001
        check("I0 Firestore available for seeding", False, str(e))
        return
    gid = f"test-group-cr-{secrets.token_hex(4)}"
    try:
        db.collection("groups").document(gid).set({
            "name": "CR chat test", "status": "formed",
            "members": [{"user_id": "demo-arjun", "username": "arjun-h1b"},
                        {"user_id": "demo-mei", "username": "mei-f1"}],
        })
        check("I1 post without user → 400", post(f"/api/groups/{gid}/messages", {"text": "hi"}).status_code == 400)
        check("I2 non-member post → 403",
              post(f"/api/groups/{gid}/messages", {"text": "hi"}, headers=hdr("demo-sofia")).status_code == 403)

        r = post(f"/api/groups/{gid}/messages", {"text": "Hello — reach me at me@example.com"}, headers=hdr("demo-arjun"))
        rj = r.json()
        mid = rj.get("id", "")
        check("I3 post 200 + handle + PII scrubbed + no author_uid",
              r.status_code == 200 and rj.get("author_handle") == "arjun-h1b"
              and "me@example.com" not in rj.get("text", "") and "author_uid" not in rj, f"status={r.status_code}")

        lst = get(f"/api/groups/{gid}/messages", headers=hdr("demo-mei")).json()
        seen = next((m for m in lst.get("messages", []) if m["id"] == mid), {})
        check("I4 member list shows it; is_author False for the other member",
              bool(seen) and seen.get("is_author") is False)
        check("I5 non-member list → 403", get(f"/api/groups/{gid}/messages", headers=hdr("demo-sofia")).status_code == 403)

        dwrong = delete(f"/api/groups/{gid}/messages/{mid}", headers=hdr("demo-mei"))
        dauthor = delete(f"/api/groups/{gid}/messages/{mid}", headers=hdr("demo-arjun"))
        check("I6 delete: non-author 403, author 200",
              dwrong.status_code == 403 and dauthor.status_code == 200,
              f"wrong={dwrong.status_code} author={dauthor.status_code}")
    finally:
        for d in db.collection("groups").document(gid).collection("messages").stream():
            d.reference.delete()
        db.collection("groups").document(gid).delete()
        print("  cleaned up chat test docs")


def _cleanup_posting(case_id: str) -> None:
    """Best-effort removal of a posting this run created: the datastore doc +
    GCS sidecars (via posting.delete_content, available in CI/deployed envs) and
    the Firestore posting↔author link. No-op if those deps are unavailable."""
    try:
        from google.cloud import firestore
        db = firestore.Client(project=os.getenv("GCP_PROJECT_ID") or os.getenv("GCP_PROJECT"))
        db.collection("posting_authors").document(case_id).delete()
    except Exception as e:  # noqa: BLE001
        print(f"  cleanup note (firestore): {e}")
    try:
        import posting  # imports discoveryengine — may be absent locally
        posting.delete_content(case_id)
    except Exception as e:  # noqa: BLE001
        print(f"  cleanup note (datastore): {e}")


def group_j_author() -> None:
    """End-to-end posting author flow across two users (item: author profiles):
      - User-1 publishes a posting (success)
      - User-1 finds it in search and opens it, sees themselves as the owner
      - User-2 opens the same posting and sees User-1 as the author
      - User-2 opens the author's profile and sees User-1's profile
      - User-2 sees all of User-1's postings
    Author attribution is viewer-independent and resolved from the Firestore
    posting↔author link (immediate); search is eventually-consistent so the
    'find in search' step is retried and reported as a soft check.
    """
    print("\nJ — Posting author profile (two users, deployed)")
    user1, user2 = "demo-arjun", "demo-mei"
    marker = f"e2e-author-{int(time.time())}"
    case_id = ""
    try:
        # 1) User-1 publishes a posting with a unique keyword.
        r = post("/api/postings", {
            "title": f"E2E author test {marker} — H-1B stamping at Mumbai",
            "description": f"End-to-end author-flow test {marker}. H-1B visa stamping experience at the Mumbai consulate.",
            "tags": {"visa_applying_for": ["H-1B"], "current_visa_or_greencard_category": ["H-1B"],
                     "consulates": ["BOM"], "tags": ["premium-processing"], "concerns_or_questions_tags": []},
            "key_stages_or_info": {"outcome_status": "approved"}, "key_dates": {},
        }, headers=hdr(user1))
        case_id = r.json().get("case_id", "") if r.status_code == 200 else ""
        check("J1 user-1 publishes a posting", r.status_code == 200 and bool(case_id),
              f"status={r.status_code} case_id={case_id}")

        # 2) User-1 opens it → owner is user-1 (author attribution, immediate).
        d1 = get(f"/api/postings/{case_id}", headers=hdr(user1)).json() if case_id else {}
        check("J2 user-1 sees themselves as the owner", d1.get("author_id") == user1,
              f"author_id={d1.get('author_id')}")

        # 3) User-2 opens the SAME posting → author is user-1 (viewer-independent).
        d2 = get(f"/api/postings/{case_id}", headers=hdr(user2)).json() if case_id else {}
        check("J3 user-2 sees user-1 as the author", d2.get("author_id") == user1,
              f"author_id={d2.get('author_id')}")

        # 4) User-2 opens the author's profile → user-1's profile.
        prof = get(f"/api/users/{user1}/public-profile", headers=hdr(user2))
        pj = prof.json() if prof.status_code == 200 else {}
        check("J4 user-2 sees user-1's profile", prof.status_code == 200 and bool(pj.get("username")),
              f"status={prof.status_code} username={pj.get('username')}")

        # 5) User-2 sees all of user-1's postings (includes the new one).
        lst = get(f"/api/users/{user1}/postings", headers=hdr(user2))
        ids = [p["case_id"] for p in (lst.json().get("postings", []) if lst.status_code == 200 else [])]
        check("J5 user-2 sees user-1's postings (incl. the new one)",
              lst.status_code == 200 and case_id in ids, f"count={len(ids)} has_new={case_id in ids}")

        # 6) (soft) the posting is findable in search by its keyword — eventually consistent.
        found = False
        for _ in range(6):
            res = get("/api/search", params={"q": marker, "page_size": "20"})
            ids_s = [p.get("case_id") for p in (res.json().get("results", []) if res.status_code == 200 else [])]
            if case_id in ids_s:
                found = True
                break
            time.sleep(10)
        print(f"  [{'PASS' if found else 'SOFT'}] J6 posting indexed + findable in search "
              f"(soft — search is eventually-consistent)")
    finally:
        if case_id:
            _cleanup_posting(case_id)


def group_k_profile_and_author_consistency() -> None:
    """Profile update from the posting flow persists, and what another user sees
    of an author's profile is exactly that author's own profile (same tags)."""
    print("\nK — Profile update persists + author-profile consistency")
    u1, viewer = "demo-arjun", "demo-mei"  # demo-arjun has a current visa set (so a real conflict can arise)
    orig = get("/api/profile", headers=hdr(u1)).json()
    orig_visa = orig.get("current_visa_or_greencard_category", []) or ["H-1B"]
    new_visa = ["F-1"] if orig_visa != ["F-1"] else ["O-1"]
    # Ensure the profile has the baseline visa so the conflict is deterministic.
    if orig.get("current_visa_or_greencard_category") != orig_visa:
        seed = dict(orig); seed["current_visa_or_greencard_category"] = orig_visa
        req("PUT", "/api/profile", json=seed, headers=hdr(u1))
        orig = get("/api/profile", headers=hdr(u1)).json()
    try:
        # reconcile a message that disagrees with the saved profile → a conflict.
        rec = post("/api/reconcile", {"message": {
            "current_visa_or_greencard_category": new_visa, "visa_applying_for": [],
            "consulates": [], "tags": [], "concerns_or_questions_tags": [],
            "key_stages_or_info": {}, "key_dates": {}}}, headers=hdr(u1)).json()
        check("K1 reconcile flags the profile↔message conflict",
              any(c.get("field") == "current_visa_or_greencard_category" for c in rec.get("conflicts", [])),
              str(rec.get("conflicts")))
        # apply the conflict ("update my profile to match") and confirm it PERSISTS.
        upd = dict(orig); upd["current_visa_or_greencard_category"] = new_visa
        r = req("PUT", "/api/profile", json=upd, headers=hdr(u1))
        after = get("/api/profile", headers=hdr(u1)).json()
        check("K2 profile update from posting persists on re-read",
              r.status_code == 200 and after.get("current_visa_or_greencard_category") == new_visa,
              f"status={r.status_code} after={after.get('current_visa_or_greencard_category')}")
    finally:
        req("PUT", "/api/profile", json=orig, headers=hdr(u1))  # restore

    # Consistency: a viewer's public-profile view == the author's own profile tags.
    own = get("/api/profile", headers=hdr(u1)).json()
    pub = get(f"/api/users/{u1}/public-profile", headers=hdr(viewer)).json()
    fields = ["username", "current_visa_or_greencard_category", "visa_applying_for",
              "consulates", "tags", "key_stages_or_info", "key_dates"]
    diffs = [f for f in fields if own.get(f) != pub.get(f)]
    check("K3 viewer's author-profile view matches the author's own profile (tags)",
          not diffs, "diffs=" + str({f: (own.get(f), pub.get(f)) for f in diffs}) if diffs else "all match")


def group_l_user_replies() -> None:
    """The profile 'your activity' feed: a user's authored replies surface at
    GET /api/users/{uid}/replies (newest-first, with parent posting id), and a
    soft-deleted reply drops out of the feed."""
    print("\nL — User replies feed (deployed)")
    uid = "demo-arjun"
    parent = KNOWN_CASE_ID
    marker = f"e2e-reply-{int(time.time())}"
    reply_id = ""
    try:
        r = post(f"/api/postings/{parent}/replies", {"body": f"{marker} — E2E activity-feed reply."},
                 headers=hdr(uid))
        reply_id = r.json().get("id", "") if r.status_code == 200 else ""
        check("L1 user posts a reply", r.status_code == 200 and bool(reply_id),
              f"status={r.status_code} id={reply_id}")

        feed = get(f"/api/users/{uid}/replies", headers=hdr(uid))
        rows = feed.json().get("replies", []) if feed.status_code == 200 else []
        mine = next((x for x in rows if x.get("id") == reply_id), None)
        check("L2 reply appears in the user's activity feed",
              feed.status_code == 200 and mine is not None, f"status={feed.status_code} count={len(rows)}")
        check("L3 feed item carries the parent posting id for linking",
              bool(mine) and mine.get("parent_case_id") == parent,
              f"parent={mine.get('parent_case_id') if mine else None}")
        check("L4 feed item carries the reply body",
              bool(mine) and marker in (mine.get("body") or ""), "")
        # Newest-first: the just-created reply should be at (or near) the top.
        check("L5 feed is newest-first", bool(rows) and rows[0].get("id") == reply_id,
              f"top={rows[0].get('id') if rows else None}")

        # Soft-delete → it leaves the feed.
        d = delete(f"/api/postings/{parent}/replies/{reply_id}", headers=hdr(uid))
        feed2 = get(f"/api/users/{uid}/replies", headers=hdr(uid))
        ids2 = [x.get("id") for x in (feed2.json().get("replies", []) if feed2.status_code == 200 else [])]
        check("L6 soft-deleted reply drops out of the feed",
              d.status_code == 200 and reply_id not in ids2, f"delete={d.status_code} still_present={reply_id in ids2}")
        reply_id = ""  # already removed
    finally:
        if reply_id:
            _cleanup_interactions(parent, [reply_id])


def group_m_uid_registration() -> None:
    """The X-User-Id auth gate: a fresh uid is rejected (404) until it is
    registered via POST /api/users, after which authed endpoints accept it.
    Registration is idempotent and never overwrites an existing profile."""
    print("\nM — uid registration gate (deployed)")
    import secrets
    uid = "e2euid" + secrets.token_hex(6)  # matches [A-Za-z0-9_-]{6,128}, not a seed / not 'new-'
    try:
        # Unknown uid → the gate rejects it on an authed endpoint.
        before = get("/api/profile", headers=hdr(uid))
        check("M1 unknown uid rejected by the auth gate (404)", before.status_code == 404,
              f"status={before.status_code}")

        # Register the uid.
        reg = post("/api/users", {"uid": uid, "username": "E2E Reg User"})
        body = reg.json() if reg.status_code == 200 else {}
        check("M2 POST /api/users registers the uid", reg.status_code == 200 and body.get("id") == uid,
              f"status={reg.status_code} id={body.get('id')}")

        # Now the same uid is accepted.
        after = get("/api/profile", headers=hdr(uid))
        check("M3 registered uid is accepted by the auth gate (200)", after.status_code == 200,
              f"status={after.status_code}")
        check("M4 registered profile carries the chosen username",
              after.json().get("username") == "E2E Reg User", f"username={after.json().get('username')}")

        # Idempotent: a second register returns the existing account, no overwrite.
        reg2 = post("/api/users", {"uid": uid, "username": "Should Not Overwrite"})
        check("M5 re-registration is idempotent (keeps the original username)",
              reg2.status_code == 200 and reg2.json().get("username") == "E2E Reg User",
              f"status={reg2.status_code} username={reg2.json().get('username')}")
    finally:
        try:
            from google.cloud import firestore
            db = firestore.Client(project=os.getenv("GCP_PROJECT_ID") or os.getenv("GCP_PROJECT"))
            db.collection("users").document(uid).delete()
        except Exception as e:  # noqa: BLE001
            print(f"  cleanup note (firestore): {e}")


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
    group_i_chat()
    group_j_author()
    group_k_profile_and_author_consistency()
    group_l_user_replies()
    group_m_uid_registration()

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
