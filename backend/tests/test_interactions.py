"""
test_interactions.py — phase-L replies + votes (Firestore interactions store).

Groups:
  A  pure vote math + serialization (no network) — always runs
  B  live Firestore: add/list/delete replies + vote toggling — INTEGRATION

Run:  .venv/bin/python tests/test_interactions.py [unit|integration|all]
      unit         → group A only (no GCP)
      integration  → group A + B (needs Firestore ADC)
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
            for uid in ("test-user-a", "test-user-b"):
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

    finally:
        _hard_cleanup(db, parent, created)
        print("  cleaned up test docs")


def main() -> int:
    if not PROJECT:
        print("GCP_PROJECT_ID must be set")
        return 2
    only = sys.argv[1] if len(sys.argv) > 1 else "all"
    print(f"Interactions tests — project={PROJECT}  (scope={only})")

    group_a_pure()
    if only in ("all", "integration"):
        group_b_firestore()

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
