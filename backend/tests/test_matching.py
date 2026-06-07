"""
test_matching.py — phase-M "Find users in same boat" (matching + groups).

Groups:
  A  pure scoring + criteria cleaning/merge (no network) — always runs
  B  live Firestore: find_turn shape, find_matches ranking, group round-trip — INTEGRATION
  C  HTTP API via FastAPI TestClient (auth gating, matches, groups) — INTEGRATION

Run:  .venv/bin/python tests/test_matching.py [unit|integration|all]
"""

import os
import secrets
import sys

from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv()

import matching as M  # noqa: E402

PROJECT = os.getenv("GCP_PROJECT_ID") or os.getenv("GCP_PROJECT", "")
_results: list[tuple[str, bool]] = []


def check(name: str, passed: bool, detail: str = "") -> None:
    _results.append((name, passed))
    print(f"  [{'PASS' if passed else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


# ---------------------------------------------------------------------------
# A — pure scoring + criteria cleaning/merge
# ---------------------------------------------------------------------------

def group_a_pure() -> None:
    print("\nA — pure scoring + criteria")
    crit = {"current_visa_or_greencard_category": ["H-1B"], "visa_applying_for": ["EB-2"],
            "consulates": ["BOM"], "key_stages_or_info": {"citizen_of_country": "IN", "visa_status": "pending"},
            "key_dates": {"priority_date": "2022-01-01"}}

    strong = M._score(crit, {"current_visa_or_greencard_category": ["H-1B"], "visa_applying_for": ["EB-2"],
                             "consulates": ["BOM"], "key_stages_or_info": {"citizen_of_country": "IN"}})
    check("A1 strong = visa+visa+consulate+stage (3+3+1.5+1)", abs(strong["score"] - 8.5) < 0.01, str(strong["score"]))
    check("A2 shared lists the overlap",
          set(strong["shared"]) == {"H-1B", "EB-2", "BOM", "citizen_of_country=IN"}, str(strong["shared"]))

    consonly = M._score(crit, {"consulates": ["BOM"], "current_visa_or_greencard_category": ["F-1"]})
    check("A3 consulate-only = 1.5", abs(consonly["score"] - 1.5) < 0.01, str(consonly["score"]))

    disjoint = M._score(crit, {"current_visa_or_greencard_category": ["B-1"], "consulates": ["LON"],
                               "key_stages_or_info": {"citizen_of_country": "GB"}})
    check("A4 disjoint = 0 + empty shared", disjoint["score"] == 0.0 and disjoint["shared"] == [])

    check("A5 visa outweighs consulate (ranking)", strong["score"] > consonly["score"] > disjoint["score"])

    # stage requires SAME key AND value
    sval = M._score({"key_stages_or_info": {"visa_status": "pending"}},
                    {"key_stages_or_info": {"visa_status": "approved"}})
    check("A6 same stage key, different value → no match", sval["score"] == 0.0)

    # cleaning drops out-of-vocab + journey/identity
    cleaned = M._clean_criteria({"current_visa_or_greencard_category": ["H-1B", "NOT-A-VISA"],
                                 "journey": [1, 2], "username": "x"})
    check("A7 _clean_criteria drops bad tags + journey/identity",
          cleaned["current_visa_or_greencard_category"] == ["H-1B"]
          and "journey" not in cleaned and "username" not in cleaned, str(cleaned))

    merged = M._merge_criteria({"consulates": ["BOM"]}, {"consulates": ["DEL"]})
    check("A8 _merge_criteria unions lists", merged["consulates"] == ["BOM", "DEL"], str(merged["consulates"]))

    check("A9 _summary is a compact line",
          M._summary({"current_visa_or_greencard_category": ["H-1B"], "consulates": ["BOM"]}) == "H-1B · BOM")


# ---------------------------------------------------------------------------
# B — live Firestore: find_turn, find_matches, groups
# ---------------------------------------------------------------------------

def group_b_firestore() -> None:
    print("\nB — live Firestore matching + groups (integration)")
    from google.cloud import firestore
    db = firestore.Client(project=PROJECT)

    ids = {k: f"test-match-{k}-{secrets.token_hex(3)}" for k in ("a", "b", "c")}
    seeds = {
        ids["a"]: {"username": "alpha", "current_visa_or_greencard_category": ["H-1B"],
                   "consulates": ["BOM"], "key_stages_or_info": {"citizen_of_country": "IN"}},
        ids["b"]: {"username": "bravo", "current_visa_or_greencard_category": ["H-1B"]},
        ids["c"]: {"username": "charlie", "current_visa_or_greencard_category": ["F-1"], "consulates": ["LON"]},
    }
    criteria = {"current_visa_or_greencard_category": ["H-1B"], "consulates": ["BOM"],
                "key_stages_or_info": {"citizen_of_country": "IN"}}
    gid = ""
    try:
        # one live find_turn — assert SHAPE only (LLM output is non-deterministic)
        turn = M.find_turn([{"role": "user", "content": "I'm on H-1B from India, applied EB-2, interview in Mumbai"}], {})
        check("B0 find_turn returns {reply, criteria(validated), done}",
              isinstance(turn.get("reply"), str) and isinstance(turn.get("done"), bool)
              and set(turn.get("criteria", {})) == set(M.CRITERIA_FIELDS), str(list(turn.get("criteria", {}))))

        for uid, p in seeds.items():
            db.collection("users").document(uid).set(p)

        # from a's perspective: self excluded; b qualifies (H-1B=3.0); c disjoint (dropped)
        by = {m["user_id"]: m for m in M.find_matches(db, ids["a"], criteria)}
        check("B1 self excluded", ids["a"] not in by)
        check("B2 H-1B peer present, disjoint absent", ids["b"] in by and ids["c"] not in by, str(list(by)))
        check("B3 H-1B-only peer scores 3.0", ids["b"] in by and abs(by[ids["b"]]["score"] - 3.0) < 0.01,
              str(by.get(ids["b"])))

        # from b's perspective: a is a strong match (H-1B + BOM + citizen IN = 5.5)
        m2 = {m["user_id"]: m for m in M.find_matches(db, ids["b"], criteria)}
        check("B4 strong peer ranks 5.5", ids["a"] in m2 and abs(m2[ids["a"]]["score"] - 5.5) < 0.01,
              str(m2.get(ids["a"])))

        # group: create (me + selected peer), with a generated name
        g = M.find_or_create_group(db, "demo-arjun", "looking for H-1B folks at Mumbai", criteria,
                                   [{"user_id": ids["a"], "username": "alpha"}])
        gid = g["group_id"]
        member_ids = {m["user_id"] for m in g["members"]}
        check("B5 create: id + generated name + me & peer as members + not joined",
              bool(gid) and g["name"] and {"demo-arjun", ids["a"]} <= member_ids and g["joined"] is False,
              f"name={g['name']} members={member_ids}")

        # same signature (extra dates ignored) → JOIN the same group, add new member
        g2 = M.find_or_create_group(db, ids["b"], "same boat, different words",
                                    {**criteria, "key_dates": {"priority_date": "2022-05-01"}}, [])
        check("B6 same-signature → joins existing group + adds member",
              g2["group_id"] == gid and g2["joined"] is True and ids["b"] in {m["user_id"] for m in g2["members"]},
              f"gid={g2['group_id']} joined={g2['joined']}")

        # browse all + my membership + direct join
        allg = {x["group_id"]: x for x in M.list_all_groups(db, ids["c"])}
        check("B7 list_all_groups includes it, is_member False for non-member",
              gid in allg and allg[gid]["is_member"] is False)
        jg = M.join_group(db, gid, ids["c"])
        check("B8 join_group adds the user", ids["c"] in {m["user_id"] for m in jg["members"]} and jg["joined"] is True)
        mine = {x["group_id"] for x in M.my_groups(db, ids["c"])}
        check("B9 my_groups reflects membership after join", gid in mine)

        try:
            M.find_or_create_group(db, "demo-arjun", "x", {}, [])
            check("B10 non-distinctive criteria rejected", False, "no raise")
        except ValueError:
            check("B10 non-distinctive criteria rejected (ValueError)", True)
    finally:
        for uid in ids.values():
            db.collection("users").document(uid).delete()
        if gid:
            db.collection("groups").document(gid).delete()
        print("  cleaned up test docs")


# ---------------------------------------------------------------------------
# C — HTTP API via TestClient
# ---------------------------------------------------------------------------

def group_c_api() -> None:
    print("\nC — HTTP API via TestClient (integration)")
    from fastapi.testclient import TestClient
    from google.cloud import firestore
    import api
    api.RATE_LIMIT_MAX = 100000

    db = firestore.Client(project=PROJECT)
    test_uid = f"test-match-api-{secrets.token_hex(3)}"
    A = {"X-User-Id": "demo-arjun"}
    created_groups: list[str] = []
    try:
        db.collection("users").document(test_uid).set(
            {"username": "apitest", "current_visa_or_greencard_category": ["H-1B"], "consulates": ["BOM"]})
        with TestClient(api.app) as c:
            check("C1 find/matches without user → 400",
                  c.post("/api/find/matches", json={"criteria": {}}).status_code == 400)
            check("C2 groups list without user → 400", c.get("/api/groups").status_code == 400)
            check("C3 unknown user → 404",
                  c.post("/api/find/matches", json={"criteria": {}},
                         headers={"X-User-Id": "ghost"}).status_code == 404)

            r = c.post("/api/find/matches",
                       json={"criteria": {"current_visa_or_greencard_category": ["H-1B"], "consulates": ["BOM"]}},
                       headers=A)
            by = {m["user_id"]: m for m in r.json().get("matches", [])}
            check("C4 matches 200 + excludes self + finds the test peer",
                  r.status_code == 200 and "demo-arjun" not in by and test_uid in by, f"status={r.status_code}")

            check("C5 create group with non-distinctive criteria → 422",
                  c.post("/api/groups", json={"criteria_text": "x", "criteria": {}, "members": []},
                         headers=A).status_code == 422)

            g = c.post("/api/groups", json={
                "criteria_text": "H-1B at Mumbai",
                "criteria": {"current_visa_or_greencard_category": ["H-1B"], "consulates": ["BOM"]},
                "members": [{"user_id": test_uid, "username": "apitest"}],
            }, headers=A)
            gj = g.json()
            if gj.get("group_id"):
                created_groups.append(gj["group_id"])
            mids = {m["user_id"] for m in gj.get("members", [])}
            check("C6 create 200 + name + me & peer members + not joined",
                  g.status_code == 200 and gj.get("group_id") and gj.get("name")
                  and {"demo-arjun", test_uid} <= mids and gj.get("joined") is False, f"status={g.status_code}")

            # same signature again as mei → JOINs the existing group
            g2 = c.post("/api/groups", json={
                "criteria_text": "same boat",
                "criteria": {"current_visa_or_greencard_category": ["H-1B"], "consulates": ["BOM"]},
                "members": [],
            }, headers={"X-User-Id": "demo-mei"})
            g2j = g2.json()
            check("C7 same-signature create → joined existing (same id, joined=true)",
                  g2j.get("group_id") == gj.get("group_id") and g2j.get("joined") is True, str(g2j.get("joined")))

            mine = c.get("/api/groups", headers=A).json().get("groups", [])
            check("C8 GET /api/groups returns groups I'm a member of",
                  any(x["group_id"] == gj.get("group_id") for x in mine))

            allg = c.get("/api/groups/all", headers={"X-User-Id": "demo-sofia"}).json().get("groups", [])
            mine_in_all = next((x for x in allg if x["group_id"] == gj.get("group_id")), {})
            check("C9 GET /api/groups/all browse + is_member False for sofia",
                  bool(mine_in_all) and mine_in_all.get("is_member") is False)

            j = c.post(f"/api/groups/{gj.get('group_id')}/join", headers={"X-User-Id": "demo-sofia"})
            jj = j.json()
            check("C10 POST /{id}/join adds the user (joined=true, is_member)",
                  j.status_code == 200 and jj.get("joined") is True
                  and "demo-sofia" in {m["user_id"] for m in jj.get("members", [])}, f"status={j.status_code}")
            check("C11 join unknown group → 404",
                  c.post("/api/groups/no-such-group/join", headers=A).status_code == 404)
    finally:
        db.collection("users").document(test_uid).delete()
        for gid in created_groups:
            db.collection("groups").document(gid).delete()
        print("  cleaned up API test docs")


def main() -> int:
    if not PROJECT:
        print("GCP_PROJECT_ID must be set")
        return 2
    only = sys.argv[1] if len(sys.argv) > 1 else "all"
    print(f"Matching tests — project={PROJECT}  (scope={only})")

    group_a_pure()
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
    print("All matching checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
