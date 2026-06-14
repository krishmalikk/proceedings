"""
test_interactions.py — phase-L replies + votes (Firestore interactions store).

Groups:
  A  pure vote math + serialization (no network) — always runs
  B  live Firestore: add/list/delete replies + vote toggling — INTEGRATION
  C  HTTP API via FastAPI TestClient (auth gating, validation, shapes) — INTEGRATION

Run:  .venv/bin/python tests/test_interactions.py [unit|integration|all]
      unit         → group A only (no GCP)
      integration  → group A + B + C (needs Firestore ADC)
      all (default)→ same as integration
"""

import os
import secrets
import sys

from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv()

import interactions as I  # noqa: E402

PROJECT = os.getenv("GCP_PROJECT_ID") or os.getenv("GCP_PROJECT", "")

_results: list[tuple[str, bool]] = []


def check(name: str, passed: bool, detail: str = "") -> None:
    _results.append((name, passed))
    print(f"  [{'PASS' if passed else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


# ---------------------------------------------------------------------------
# A — pure vote math + serialization (no Firestore)
# ---------------------------------------------------------------------------

def group_a_pure() -> None:
    print("\nA — pure vote math + serialization")

    # _apply_vote truth table over every (old, new) in {-1,0,1}^2
    expected = {
        (0, 1): (1, 0), (0, -1): (0, 1), (0, 0): (0, 0),
        (1, 0): (-1, 0), (1, -1): (-1, 1), (1, 1): (0, 0),
        (-1, 0): (0, -1), (-1, 1): (1, -1), (-1, -1): (0, 0),
    }
    bad = {k: I._apply_vote(*k) for k in expected if I._apply_vote(*k) != expected[k]}
    check("A1 _apply_vote truth table (all 9 transitions)", not bad, str(bad))

    # Tally invariant: applying deltas keeps up/down ≥ 0 and score = up-down
    up = down = 0
    seq = [1, 1, -1, 0, -1, -1, 0]  # a user clicking around
    prev = 0
    for nxt in seq:
        d_up, d_down = I._apply_vote(prev, nxt)
        up, down = up + d_up, down + d_down
        prev = nxt
    check("A2 single-user vote sequence stays sane", up in (0, 1) and down in (0, 1) and up + down <= 1,
          f"up={up} down={down}")

    check("A3 _norm_dir clamps to -1/0/1", (I._norm_dir(9), I._norm_dir(-2), I._norm_dir(0)) == (1, -1, 0))
    check("A4 _vote_id composes content+user", I._vote_id("cid", "u1") == "cid__u1")

    t = I._tally({"up": 5, "down": 2})
    check("A5 _tally computes score", t == {"up": 5, "down": 2, "score": 3}, str(t))
    check("A6 _tally tolerates missing", I._tally(None) == {"up": 0, "down": 0, "score": 0})

    # _reply_view never leaks user_id; is_author reflects the viewer
    doc = {"id": "r1", "parent_case_id": "p1", "body": "hi", "author_handle": "arjun-h1b",
           "user_id": "demo-arjun", "created_at": "2026-06-07T00:00:00Z", "deleted": False}
    v_author = I._reply_view(doc, {"up": 2, "down": 0, "score": 2}, 1, "demo-arjun")
    v_other = I._reply_view(doc, {"up": 2, "down": 0, "score": 2}, 0, "demo-mei")
    check("A7 _reply_view omits user_id", "user_id" not in v_author)
    check("A8 _reply_view is_author for the author", v_author["is_author"] is True and v_other["is_author"] is False)
    check("A9 _reply_view carries tally + your_vote", v_author["score"] == 2 and v_author["your_vote"] == 1)

    deleted_doc = {**doc, "deleted": True}
    v_del = I._reply_view(deleted_doc, {"up": 0, "down": 0, "score": 0}, 0, "x")
    check("A10 deleted reply hides body", v_del["deleted"] is True and v_del["body"] == "")


# ---------------------------------------------------------------------------
# A2 — list_user_replies query logic, exercised against a fake Firestore
#      (no network): filtering by author, dropping deletes, newest-first,
#      field projection, and the empty-uid / no-db short-circuits.
# ---------------------------------------------------------------------------

class _FakeDoc:
    def __init__(self, doc_id: str, data: dict):
        self.id = doc_id
        self._data = data

    def to_dict(self) -> dict:
        return dict(self._data)


class _FakeQuery:
    """Honors a single FieldFilter('user_id','==',value) equality, like the real query."""
    def __init__(self, docs: list, value):
        self._docs = docs
        self._value = value

    def stream(self):
        for d in self._docs:
            if d._data.get("user_id") == self._value:
                yield d


class _FakeCollection:
    def __init__(self, docs: list):
        self._docs = docs

    def where(self, filter=None):  # noqa: A002 — mirror Firestore's kwarg name
        value = getattr(filter, "value", None)
        return _FakeQuery(self._docs, value)


class _FakeDB:
    def __init__(self, docs: list):
        self._docs = docs

    def collection(self, name: str):
        assert name == "replies"
        return _FakeCollection(self._docs)


def group_a2_user_replies() -> None:
    print("\nA2 — list_user_replies (fake Firestore, no network)")

    docs = [
        _FakeDoc("r-old", {"user_id": "demo-arjun", "parent_case_id": "p1", "body": "older",
                           "created_at": "2026-06-01T00:00:00Z"}),
        _FakeDoc("r-new", {"user_id": "demo-arjun", "parent_case_id": "p2", "body": "newer",
                           "created_at": "2026-06-09T00:00:00Z"}),
        _FakeDoc("r-del", {"user_id": "demo-arjun", "parent_case_id": "p3", "body": "gone",
                           "created_at": "2026-06-10T00:00:00Z", "deleted": True}),
        _FakeDoc("r-other", {"user_id": "demo-mei", "parent_case_id": "p4", "body": "not mine",
                             "created_at": "2026-06-11T00:00:00Z"}),
    ]
    db = _FakeDB(docs)

    out = I.list_user_replies(db, "demo-arjun")
    ids = [r["id"] for r in out]
    check("A2.1 only the author's non-deleted replies", ids == ["r-new", "r-old"], str(ids))
    check("A2.2 newest-first ordering", out[0]["id"] == "r-new")
    check("A2.3 deleted reply excluded", "r-del" not in ids)
    check("A2.4 other users' replies excluded", "r-other" not in ids)
    check("A2.5 projected fields only",
          set(out[0]) == {"id", "parent_case_id", "body", "created_at"}, str(set(out[0])))
    check("A2.6 parent_case_id carried for back-link", out[0]["parent_case_id"] == "p2")

    check("A2.7 limit truncates after sort", [r["id"] for r in I.list_user_replies(db, "demo-arjun", limit=1)] == ["r-new"])
    check("A2.8 empty uid short-circuits to []", I.list_user_replies(db, "") == [])
    check("A2.9 None db short-circuits to []", I.list_user_replies(None, "demo-arjun") == [])
    check("A2.10 unknown author yields []", I.list_user_replies(db, "nobody") == [])


# ---------------------------------------------------------------------------
# B — live Firestore: replies + votes
# ---------------------------------------------------------------------------

def _hard_cleanup(db, parent_case_id: str, reply_ids: list[str]) -> None:
    """Best-effort hard delete of everything a test run created."""
    try:
        from google.cloud.firestore_v1.base_query import FieldFilter
        for d in db.collection("replies").where(
                filter=FieldFilter("parent_case_id", "==", parent_case_id)).stream():
            reply_ids.append(d.id)
        for rid in set(reply_ids):
            db.collection("replies").document(rid).delete()
            db.collection("content_meta").document(rid).delete()
        db.collection("content_meta").document(parent_case_id).delete()
        # votes created during the run (posting + replies, both test users)
        for cid in set([parent_case_id, *reply_ids]):
            for uid in ("test-user-a", "test-user-b", "demo-arjun", "demo-mei"):
                db.collection("votes").document(I._vote_id(cid, uid)).delete()
    except Exception as e:  # noqa: BLE001
        print(f"  cleanup note: {e}")


def group_b_firestore() -> None:
    print("\nB — live Firestore replies + votes (integration)")
    from google.cloud import firestore

    db = firestore.Client(project=PROJECT)
    parent = f"test-posting-{secrets.token_hex(4)}"   # synthetic; never a real case_id
    user_a, user_b = "test-user-a", "test-user-b"
    created: list[str] = []

    try:
        # --- replies ---
        r1 = I.add_reply(db, parent, "First reply from A", user_a, "arjun-h1b")
        created.append(r1["id"])
        check("B1 add_reply returns view (no user_id, is_author)",
              "user_id" not in r1 and r1["is_author"] is True and r1["body"] == "First reply from A")

        r2 = I.add_reply(db, parent, "Second reply from B", user_b, "mei-f1")
        created.append(r2["id"])

        try:
            I.add_reply(db, parent, "   ", user_a, "arjun-h1b")
            check("B2 empty reply rejected", False, "no raise")
        except ValueError:
            check("B2 empty reply rejected (ValueError)", True)

        listed = I.list_replies(db, parent, viewer_id=user_a)
        ids = {r["id"] for r in listed}
        check("B3 list_replies returns both", {r1["id"], r2["id"]}.issubset(ids), str(ids))
        check("B4 viewer is_author only on own reply",
              next(r for r in listed if r["id"] == r1["id"])["is_author"] is True
              and next(r for r in listed if r["id"] == r2["id"])["is_author"] is False)

        # --- voting on a reply: up, then switch to down, then clear ---
        v_up = I.cast_vote(db, r1["id"], user_b, 1)
        check("B5 upvote → up=1 score=1 your_vote=1",
              v_up["up"] == 1 and v_up["down"] == 0 and v_up["score"] == 1 and v_up["your_vote"] == 1, str(v_up))

        v_re = I.cast_vote(db, r1["id"], user_b, 1)   # idempotent re-up
        check("B6 re-upvote idempotent (still up=1)", v_re["up"] == 1 and v_re["score"] == 1, str(v_re))

        v_down = I.cast_vote(db, r1["id"], user_b, -1)  # switch
        check("B7 switch to downvote → up=0 down=1 score=-1",
              v_down["up"] == 0 and v_down["down"] == 1 and v_down["score"] == -1 and v_down["your_vote"] == -1, str(v_down))

        v_clear = I.cast_vote(db, r1["id"], user_b, 0)  # clear
        check("B8 clear vote → up=0 down=0 score=0 your_vote=0",
              v_clear["up"] == 0 and v_clear["down"] == 0 and v_clear["score"] == 0 and v_clear["your_vote"] == 0, str(v_clear))

        # --- two distinct users both upvote the posting itself ---
        I.cast_vote(db, parent, user_a, 1)
        post_tally = I.cast_vote(db, parent, user_b, 1)
        check("B9 two users upvote posting → up=2 score=2", post_tally["up"] == 2 and post_tally["score"] == 2, str(post_tally))

        # --- vote_state hydration reflects each viewer's own vote ---
        st_a = I.vote_state(db, [parent], viewer_id=user_a)[parent]
        st_anon = I.vote_state(db, [parent], viewer_id="")[parent]
        check("B10 vote_state your_vote per viewer",
              st_a["your_vote"] == 1 and st_anon["your_vote"] == 0 and st_a["up"] == 2, f"{st_a} / {st_anon}")

        # --- list reflects scores in sort order (top) ---
        I.cast_vote(db, r2["id"], user_a, 1)  # give r2 a +1 so it outranks r1 (score 0)
        top = I.list_replies(db, parent, viewer_id=user_a, sort="top")
        check("B11 sort=top orders by score", top[0]["id"] == r2["id"],
              str([(r["id"], r["score"]) for r in top]))

        # --- delete: author-only ---
        try:
            I.delete_reply(db, r2["id"], user_a)   # user_a is NOT the author of r2
            check("B12 non-author delete blocked", False, "no raise")
        except PermissionError:
            check("B12 non-author delete blocked (PermissionError)", True)

        I.delete_reply(db, r2["id"], user_b)        # real author
        after = I.list_replies(db, parent, viewer_id=user_a)
        check("B13 soft-deleted reply hidden from list", r2["id"] not in {r["id"] for r in after})

        try:
            I.delete_reply(db, "no-such-reply-id", user_a)
            check("B14 deleting missing reply raises", False, "no raise")
        except KeyError:
            check("B14 deleting missing reply raises (KeyError)", True)

        # --- validation edges ---
        try:
            I.add_reply(db, parent, "x" * (I.MAX_BODY + 1), user_a, "arjun-h1b")
            check("B15 over-long reply rejected", False, "no raise")
        except ValueError:
            check("B15 over-long reply rejected (ValueError)", True)
        try:
            I.add_reply(db, "", "orphan", user_a, "arjun-h1b")
            check("B16 missing parent rejected", False, "no raise")
        except ValueError:
            check("B16 missing parent rejected (ValueError)", True)

        # --- downvote drives score negative ---
        r3 = I.add_reply(db, parent, "third reply", user_a, "arjun-h1b")
        created.append(r3["id"])
        dn = I.cast_vote(db, r3["id"], user_b, -1)
        check("B17 downvote → score -1", dn["score"] == -1 and dn["down"] == 1, str(dn))

        # --- sort=new orders by recency (r3 is newest) ---
        newest = I.list_replies(db, parent, viewer_id=user_a, sort="new")
        check("B18 sort=new puts newest first", newest and newest[0]["id"] == r3["id"],
              str([r["id"] for r in newest]))

        # --- anonymous viewer never carries a your_vote ---
        anon = I.list_replies(db, parent, viewer_id="", sort="top")
        check("B19 anonymous list → your_vote all 0", all(r["your_vote"] == 0 for r in anon))

        # --- vote_state batch hydrates posting + reply together, per viewer ---
        st = I.vote_state(db, [parent, r3["id"]], viewer_id=user_b)
        check("B20 vote_state batch per-id", st[parent]["up"] == 2 and st[r3["id"]]["your_vote"] == -1, str(st))

    finally:
        _hard_cleanup(db, parent, created)
        print("  cleaned up test docs")


def group_c_api() -> None:
    print("\nC — HTTP API via TestClient (integration)")
    from fastapi.testclient import TestClient
    from google.cloud import firestore
    import api
    api.RATE_LIMIT_MAX = 100000  # don't trip the limiter during the run

    db = firestore.Client(project=PROJECT)
    parent = f"test-posting-api-{secrets.token_hex(4)}"
    created: list[str] = []
    A = {"X-User-Id": "demo-arjun"}
    M = {"X-User-Id": "demo-mei"}
    try:
        with TestClient(api.app) as c:
            # anonymous read works + response shape
            g = c.get(f"/api/postings/{parent}/replies")
            gj = g.json()
            check("C1 GET replies anon 200 + {replies,posting,total}",
                  g.status_code == 200 and {"replies", "posting", "total"} <= set(gj) and gj["total"] == 0,
                  f"status={g.status_code}")

            # auth gating
            check("C2 POST reply without user → 400",
                  c.post(f"/api/postings/{parent}/replies", json={"body": "x"}).status_code == 400)
            check("C3 POST vote without user → 400",
                  c.post("/api/votes", json={"content_id": parent, "dir": 1}).status_code == 400)
            check("C4 DELETE reply without user → 400",
                  c.delete(f"/api/postings/{parent}/replies/whatever").status_code == 400)
            check("C5 unknown user → 404",
                  c.post(f"/api/postings/{parent}/replies", json={"body": "x"},
                         headers={"X-User-Id": "ghost"}).status_code == 404)

            # body / payload validation → 422
            check("C6 empty body → 422",
                  c.post(f"/api/postings/{parent}/replies", json={"body": ""}, headers=A).status_code == 422)
            check("C7 whitespace-only body → 422",
                  c.post(f"/api/postings/{parent}/replies", json={"body": "   "}, headers=A).status_code == 422)
            check("C8 over-long body → 422",
                  c.post(f"/api/postings/{parent}/replies", json={"body": "x" * 5001}, headers=A).status_code == 422)
            check("C9 vote empty content_id → 422",
                  c.post("/api/votes", json={"content_id": "", "dir": 1}, headers=A).status_code == 422)

            # happy path: reply create + shape (and no user_id leak)
            rp = c.post(f"/api/postings/{parent}/replies", json={"body": "API reply"}, headers=A)
            rj = rp.json()
            rid = rj.get("id", "")
            if rid:
                created.append(rid)
            check("C10 POST reply 200 + ReplyCard (handle/is_author/score, no user_id)",
                  rp.status_code == 200 and rj.get("author_handle") == "arjun-h1b"
                  and rj.get("is_author") is True and rj.get("score") == 0 and "user_id" not in rj,
                  f"status={rp.status_code}")

            # vote shape + value
            v = c.post("/api/votes", json={"content_id": rid, "dir": 1}, headers=M)
            vj = v.json()
            check("C11 POST vote 200 + VoteResponse (score/your_vote/content_id)",
                  v.status_code == 200 and vj.get("score") == 1 and vj.get("your_vote") == 1
                  and vj.get("content_id") == rid, str(vj))

            # per-viewer your_vote
            mine = c.get(f"/api/postings/{parent}/replies", headers=M).json()["replies"][0]
            anon = c.get(f"/api/postings/{parent}/replies").json()["replies"][0]
            check("C12 your_vote per viewer (mei=1, anon=0)",
                  mine["your_vote"] == 1 and anon["your_vote"] == 0)

            # delete authorization
            check("C13 DELETE wrong user → 403",
                  c.delete(f"/api/postings/{parent}/replies/{rid}", headers=M).status_code == 403)
            check("C14 DELETE missing reply → 404",
                  c.delete(f"/api/postings/{parent}/replies/no-such-id", headers=A).status_code == 404)
            check("C15 DELETE author → 200",
                  c.delete(f"/api/postings/{parent}/replies/{rid}", headers=A).status_code == 200)
    finally:
        _hard_cleanup(db, parent, created)
        print("  cleaned up API test docs")


def main() -> int:
    only = sys.argv[1] if len(sys.argv) > 1 else "all"
    if not PROJECT and only != "unit":
        print("GCP_PROJECT_ID must be set")
        return 2
    print(f"Interactions tests — project={PROJECT or '(none)'}  (scope={only})")

    group_a_pure()
    group_a2_user_replies()
    if only in ("all", "integration"):
        group_b_firestore()
        group_c_api()

    print("\n" + "=" * 60)
    passed = sum(1 for _, ok in _results if ok)
    failed = [n for n, ok in _results if not ok]
    print(f"SUMMARY: {passed}/{len(_results)} checks passed")
    if failed:
        print("FAILED: " + "; ".join(failed))
        return 1
    print("All interactions checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
