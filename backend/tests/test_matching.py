"""
test_matching.py — phase-M "Find users in same boat" (matching + groups).

Groups:
  A  pure scoring + criteria cleaning/merge (no network) — always runs
  D  pure DATE matching: exact, approximate windows, parsing care — always runs
  G  pure positive/negative matching across every criteria dimension — always runs
  B  live Firestore: find_turn shape, find_matches ranking, group round-trip — INTEGRATION
  C  HTTP API via FastAPI TestClient (auth gating, matches, groups) — INTEGRATION
  E  live Firestore: merge profile+criteria, positive/negative matching — INTEGRATION
  F  live Firestore: date matching end-to-end via find_matches — INTEGRATION
  H  live Firestore: positive/negative matches + ranking/top_n/min_score — INTEGRATION

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

    ids = {k: f"test-match-{k}-{secrets.token_hex(3)}" for k in ("a", "b", "c", "d")}
    seeds = {
        ids["a"]: {"username": "alpha", "current_visa_or_greencard_category": ["H-1B"],
                   "consulates": ["BOM"], "key_stages_or_info": {"citizen_of_country": "IN"}},
        ids["b"]: {"username": "bravo", "current_visa_or_greencard_category": ["H-1B"]},
        ids["c"]: {"username": "charlie", "current_visa_or_greencard_category": ["F-1"], "consulates": ["LON"]},
        ids["d"]: {"username": "delta", "current_visa_or_greencard_category": ["F-1"]},
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

        # B11-B14: _group_view's new fields — admin flag, description, last_activity_at
        creator_view = next(x for x in M.list_all_groups(db, "demo-arjun") if x["group_id"] == gid)
        check("B11 creator sees is_admin=True", creator_view["is_admin"] is True)
        peer_view = next(x for x in M.list_all_groups(db, ids["a"]) if x["group_id"] == gid)
        check("B12 non-creator member sees is_admin=False", peer_view["is_admin"] is False)
        check("B13 new group starts with an empty description", creator_view["description"] == "")
        check("B14 new group has a last_activity_at timestamp", bool(creator_view["last_activity_at"]))

        # B15-B16: rename_group — creator-only
        try:
            M.rename_group(db, gid, ids["a"], name="Hijacked")
            check("B15 rename by non-creator rejected", False, "no raise")
        except PermissionError:
            check("B15 rename by non-creator rejected (PermissionError)", True)
        renamed = M.rename_group(db, gid, "demo-arjun", name="Mumbai H-1B crew", description="H-1B folks near BOM")
        check("B16 rename by creator updates name + description",
              renamed["name"] == "Mumbai H-1B crew" and renamed["description"] == "H-1B folks near BOM",
              str((renamed["name"], renamed["description"])))

        # B17-B19: invite_member — member-only, handle-based, direct add
        try:
            M.invite_member(db, gid, "some-stranger-not-a-member", "delta")
            check("B17 invite by non-member rejected", False, "no raise")
        except PermissionError:
            check("B17 invite by non-member rejected (PermissionError)", True)
        try:
            M.invite_member(db, gid, "demo-arjun", "no-such-handle-at-all")
            check("B18 invite of an unknown handle rejected", False, "no raise")
        except ValueError:
            check("B18 invite of an unknown handle rejected (ValueError)", True)
        invited = M.invite_member(db, gid, "demo-arjun", "delta")
        check("B19 invite by handle adds the resolved member",
              ids["d"] in {m["user_id"] for m in invited["members"]},
              str({m["user_id"] for m in invited["members"]}))

        # B20-B21: leave_group — a regular member leaving needs no reassignment;
        # the creator leaving must hand admin to a remaining member.
        left = M.leave_group(db, gid, ids["d"])
        check("B20 leave_group removes the member, admin unchanged for a non-creator leaving",
              ids["d"] not in {m["user_id"] for m in left["members"]} and left["created_by"] == "demo-arjun",
              str(({m["user_id"] for m in left["members"]}, left["created_by"])))
        creator_left = M.leave_group(db, gid, "demo-arjun")
        check("B21 creator leaving reassigns admin to a remaining member",
              "demo-arjun" not in {m["user_id"] for m in creator_left["members"]}
              and creator_left["created_by"] in {m["user_id"] for m in creator_left["members"]},
              str((creator_left["created_by"], {m["user_id"] for m in creator_left["members"]})))
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

            gid = gj.get("group_id")
            # C12-C13: PUT rename — creator-only
            check("C12 PUT rename by non-creator → 403",
                  c.put(f"/api/groups/{gid}", json={"name": "Hijacked"},
                        headers={"X-User-Id": test_uid}).status_code == 403)
            ren = c.put(f"/api/groups/{gid}", json={"name": "API Renamed", "description": "desc via API"}, headers=A)
            check("C13 PUT rename by creator → 200, name + description updated",
                  ren.status_code == 200 and ren.json().get("name") == "API Renamed"
                  and ren.json().get("description") == "desc via API", f"status={ren.status_code}")

            # C14-C16: POST invite — member-only, handle-based
            check("C14 POST invite by non-member → 403",
                  c.post(f"/api/groups/{gid}/invite", json={"handle": "apitest"},
                         headers={"X-User-Id": "demo-omar"}).status_code == 403)
            check("C15 POST invite of an unknown handle → 422",
                  c.post(f"/api/groups/{gid}/invite", json={"handle": "no-such-handle"}, headers=A).status_code == 422)
            inv = c.post(f"/api/groups/{gid}/invite", json={"handle": "omar-b1b2"}, headers=A)
            check("C16 POST invite of a known handle → 200, the (previously non-member) invitee is added",
                  inv.status_code == 200 and "demo-omar" in {m["user_id"] for m in inv.json().get("members", [])},
                  f"status={inv.status_code}")

            # C17: POST leave — the creator leaving reassigns admin
            lv = c.post(f"/api/groups/{gid}/leave", headers=A)
            check("C17 POST leave (creator) → 200, admin reassigned to a remaining member",
                  lv.status_code == 200 and "demo-arjun" not in {m["user_id"] for m in lv.json().get("members", [])}
                  and lv.json().get("created_by") in {m["user_id"] for m in lv.json().get("members", [])},
                  f"status={lv.status_code} body={lv.json()}")
            check("C18 leave unknown group → 404",
                  c.post("/api/groups/no-such-group/leave", headers=A).status_code == 404)
    finally:
        db.collection("users").document(test_uid).delete()
        for gid in created_groups:
            db.collection("groups").document(gid).delete()
        print("  cleaned up API test docs")


def group_d_dates() -> None:
    print("\nD — date matching (pure): exact, approximate windows, parsing care")
    base = "2022-01-01"

    # proximity buckets (scenario 4 — what closeness makes a match)
    check("D1 exact date proximity = 1.5", M._date_proximity(base, "2022-01-01") == M._DATE_EXACT)
    check("D2 ±20d within 30 → 1.0", M._date_proximity(base, "2022-01-21") == 1.0)
    check("D3 ±75d within 90 → 0.6", M._date_proximity(base, "2022-03-17") == 0.6)
    check("D4 ±150d within 180 → 0.3", M._date_proximity(base, "2022-05-31") == 0.3)
    check("D5 ±400d beyond window → 0.0", M._date_proximity(base, "2023-02-05") == 0.0)
    check("D6 proximity is symmetric",
          M._date_proximity(base, "2022-02-10") == M._date_proximity("2022-02-10", base))

    # scenario 5 — careful parsing: blank/None/malformed/other-format never crash
    for bad in ("", "not-a-date", None, "2022-13-40", "02/01/2022"):
        check(f"D7 malformed date {bad!r} → 0 proximity (no crash)", M._date_proximity(base, bad) == 0.0)

    sc = lambda pd: M._score({"key_dates": {"priority_date": base}}, {"key_dates": {"priority_date": pd}})["score"]
    check("D8 exact date-only reaches MIN_SCORE (a match)", sc("2022-01-01") >= M.MIN_SCORE)
    check("D9 ±20d date-only reaches MIN_SCORE (APPROXIMATE match)", sc("2022-01-21") >= M.MIN_SCORE)
    check("D10 ±60d date-only below MIN_SCORE (not a match alone)", sc("2022-03-02") < M.MIN_SCORE)
    check("D11 far shared key keeps a floor (same milestone, different timing)", sc("2025-01-01") == M._DATE_FLOOR)

    # scenario 3 — dates must be the SAME milestone key
    diffkey = M._score({"key_dates": {"priority_date": base}}, {"key_dates": {"visa_interview_date": base}})
    check("D12 different date key → no credit + not shared", diffkey["score"] == 0.0 and diffkey["shared"] == [])

    multi = M._score({"key_dates": {"priority_date": base, "i140_approved_date": "2023-01-01"}},
                     {"key_dates": {"priority_date": base, "i140_approved_date": "2023-01-20"}})
    check("D13 multiple shared dates sum (exact 1.5 + approx 1.0 = 2.5)", abs(multi["score"] - 2.5) < 0.01, str(multi["score"]))
    check("D14 labels mark exact vs approximate",
          "priority_date(exact)" in multi["shared"] and "i140_approved_date(~)" in multi["shared"], str(multi["shared"]))

    near = M._score({"current_visa_or_greencard_category": ["H-1B"], "key_dates": {"priority_date": base}},
                    {"current_visa_or_greencard_category": ["H-1B"], "key_dates": {"priority_date": "2022-01-10"}})["score"]
    far = M._score({"current_visa_or_greencard_category": ["H-1B"], "key_dates": {"priority_date": base}},
                   {"current_visa_or_greencard_category": ["H-1B"], "key_dates": {"priority_date": "2025-01-10"}})["score"]
    check("D15 date proximity is a bonus on top of visa; closer ranks higher",
          abs(near - 4.0) < 0.01 and abs(far - 3.1) < 0.01 and near > far, f"near={near} far={far}")


def group_e_merge_match() -> None:
    print("\nE — merge profile+criteria, positive/negative matching (integration)")
    from google.cloud import firestore
    import reconcile as rc
    db = firestore.Client(project=PROJECT)

    ids = {k: f"test-mm-{k}-{secrets.token_hex(3)}" for k in ("eb2", "h1b", "both", "none")}
    seeds = {
        ids["eb2"]:  {"username": "eb2only", "visa_applying_for": ["EB-2"], "consulates": ["BOM"]},
        ids["h1b"]:  {"username": "h1bonly", "current_visa_or_greencard_category": ["H-1B"]},
        ids["both"]: {"username": "bothvisa", "current_visa_or_greencard_category": ["H-1B"],
                      "visa_applying_for": ["EB-2"], "consulates": ["BOM"]},
        ids["none"]: {"username": "unrelated", "current_visa_or_greencard_category": ["F-1"], "consulates": ["LON"]},
    }
    saved_profile = {"current_visa_or_greencard_category": ["H-1B"]}   # what's in the profile
    criteria = {"visa_applying_for": ["EB-2"], "consulates": ["BOM"]}  # different — what they typed here
    try:
        for uid, p in seeds.items():
            db.collection("users").document(uid).set(p)

        # scenario 2 — positive / negative on the ENTERED criteria
        by_crit = {m["user_id"]: m for m in M.find_matches(db, "demo-arjun", criteria)}
        check("E1 positive: EB-2/BOM peers matched", ids["eb2"] in by_crit and ids["both"] in by_crit)
        check("E2 negative: unrelated (F-1/LON) NOT matched", ids["none"] not in by_crit)
        check("E3 negative: H-1B-only NOT matched by EB-2/BOM criteria", ids["h1b"] not in by_crit)
        check("E4 only criteria∩profile counts: extra H-1B (not in criteria) doesn't inflate; both ties eb2-only at 4.5",
              abs(by_crit[ids["both"]]["score"] - by_crit[ids["eb2"]]["score"]) < 0.01
              and abs(by_crit[ids["eb2"]]["score"] - 4.5) < 0.01,
              f'both={by_crit[ids["both"]]["score"]} eb2={by_crit[ids["eb2"]]["score"]}')

        # scenario 1 — profile differs; MERGE profile+criteria, then match on merged
        merged = rc.reconcile_profile_message(saved_profile, criteria)["merged"]
        check("E5 merged = profile H-1B ∪ criteria EB-2/BOM",
              "H-1B" in (merged.get("current_visa_or_greencard_category") or [])
              and "EB-2" in (merged.get("visa_applying_for") or [])
              and "BOM" in (merged.get("consulates") or []))
        by_merged = {m["user_id"]: m for m in M.find_matches(db, "demo-arjun", merged)}
        check("E6 merge brings in the profile-only (H-1B) peer", ids["h1b"] in by_merged)
        check("E7 merged matches ⊇ criteria-only matches, and add H-1B peer",
              set(by_crit) <= set(by_merged) and ids["h1b"] in (set(by_merged) - set(by_crit)))
    finally:
        for uid in ids.values():
            db.collection("users").document(uid).delete()
        print("  cleaned up merge-match test docs")


def group_f_dates_match() -> None:
    print("\nF — date matching end-to-end via find_matches (integration)")
    from google.cloud import firestore
    db = firestore.Client(project=PROJECT)

    pd = "2022-01-01"
    ids = {k: f"test-dt-{k}-{secrets.token_hex(3)}" for k in ("exact", "near", "far", "key2", "dateonly")}
    seeds = {
        ids["exact"]: {"username": "exactpd", "current_visa_or_greencard_category": ["H-1B"], "key_dates": {"priority_date": pd}},
        ids["near"]:  {"username": "nearpd", "current_visa_or_greencard_category": ["H-1B"], "key_dates": {"priority_date": "2022-01-20"}},
        ids["far"]:   {"username": "farpd", "current_visa_or_greencard_category": ["H-1B"], "key_dates": {"priority_date": "2024-06-01"}},
        ids["key2"]:  {"username": "otherdate", "current_visa_or_greencard_category": ["H-1B"], "key_dates": {"visa_interview_date": pd}},
        ids["dateonly"]: {"username": "dateonly", "key_dates": {"priority_date": "2022-01-15"}},  # no visa, +14d
    }
    crit = {"current_visa_or_greencard_category": ["H-1B"], "key_dates": {"priority_date": pd}}
    try:
        for uid, p in seeds.items():
            db.collection("users").document(uid).set(p)

        by = {m["user_id"]: m for m in M.find_matches(db, "demo-arjun", crit)}
        check("F1 exact > near > far by date proximity (all share H-1B)",
              by[ids["exact"]]["score"] > by[ids["near"]]["score"] > by[ids["far"]]["score"],
              f'exact={by[ids["exact"]]["score"]} near={by[ids["near"]]["score"]} far={by[ids["far"]]["score"]}')
        check("F2 exact priority_date labeled (exact)", "priority_date(exact)" in by[ids["exact"]]["shared"])
        check("F3 near priority_date labeled (~) approximate", "priority_date(~)" in by[ids["near"]]["shared"])
        check("F4 different date key → matches on visa only, no date credit",
              ids["key2"] in by and abs(by[ids["key2"]]["score"] - 3.0) < 0.01
              and not any("priority_date" in s for s in by[ids["key2"]]["shared"]))

        # scenario 4 — date-only criteria: which approximate date alone qualifies
        by2 = {m["user_id"]: m for m in M.find_matches(db, "demo-arjun", {"key_dates": {"priority_date": pd}})}
        check("F5 date-only: within-30d peer IS a match (no shared visa needed)", ids["dateonly"] in by2)
        check("F6 date-only: far peer is NOT a match", ids["far"] not in by2)
    finally:
        for uid in ids.values():
            db.collection("users").document(uid).delete()
        print("  cleaned up date-match test docs")


def group_g_match_criteria() -> None:
    print("\nG — positive / negative matching across every criteria dimension (pure)")
    S = lambda c, p: M._score(c, p)["score"]

    # --- visa / category ---
    crit = {"current_visa_or_greencard_category": ["H-1B", "L-1"]}
    check("G1 one of two visas shared → 3.0 (partial positive)",
          S(crit, {"current_visa_or_greencard_category": ["H-1B"]}) == 3.0)
    check("G2 both visas shared → 6.0 (full positive)",
          S(crit, {"current_visa_or_greencard_category": ["H-1B", "L-1"]}) == 6.0)
    check("G3 no visa overlap → 0.0 (negative)",
          S(crit, {"current_visa_or_greencard_category": ["F-1"]}) == 0.0)
    check("G4 cross-field current↔applying matches the same code (same journey stage)",
          S({"current_visa_or_greencard_category": ["H-1B"]}, {"visa_applying_for": ["H-1B"]}) == 3.0)

    # --- consulates ---
    check("G5 primary_consulate ↔ consulates cross-field matches",
          S({"primary_consulate": "BOM"}, {"consulates": ["BOM"]}) == 1.5)
    check("G6 partial consulate overlap [BOM,DEL] vs [DEL,MAA] → 1.5 (shares DEL)",
          S({"consulates": ["BOM", "DEL"]}, {"consulates": ["DEL", "MAA"]}) == 1.5)
    check("G7 no consulate overlap → 0.0 (negative)",
          S({"consulates": ["BOM"]}, {"consulates": ["LON"]}) == 0.0)

    # --- status facts (key_stages_or_info) ---
    check("G8 same status fact (visa_status=approved) → 1.0 (positive)",
          S({"key_stages_or_info": {"visa_status": "approved"}}, {"key_stages_or_info": {"visa_status": "approved"}}) == 1.0)
    check("G9 same key, different value → 0.0 (negative)",
          S({"key_stages_or_info": {"visa_status": "approved"}}, {"key_stages_or_info": {"visa_status": "pending"}}) == 0.0)
    check("G10 different status key → 0.0 (negative)",
          S({"key_stages_or_info": {"visa_status": "approved"}}, {"key_stages_or_info": {"case_status": "approved"}}) == 0.0)
    check("G11 same citizen_of_country → 1.0 (positive); different → 0.0 (negative)",
          S({"key_stages_or_info": {"citizen_of_country": "IN"}}, {"key_stages_or_info": {"citizen_of_country": "IN"}}) == 1.0
          and S({"key_stages_or_info": {"citizen_of_country": "IN"}}, {"key_stages_or_info": {"citizen_of_country": "CN"}}) == 0.0)

    # --- thresholds / edges ---
    check("G12 a single status fact reaches MIN_SCORE (1.0)", 1.0 >= M.MIN_SCORE)
    check("G13 empty criteria vs anything → 0.0 (no match)",
          S({}, {"current_visa_or_greencard_category": ["H-1B"], "consulates": ["BOM"]}) == 0.0)
    check("G14 anything vs empty profile → 0.0 (no match)",
          S({"current_visa_or_greencard_category": ["H-1B"], "consulates": ["BOM"]}, {}) == 0.0)

    # --- combined ---
    full = M._score(
        {"current_visa_or_greencard_category": ["H-1B"], "consulates": ["BOM"],
         "key_stages_or_info": {"citizen_of_country": "IN"}, "key_dates": {"priority_date": "2022-01-01"}},
        {"current_visa_or_greencard_category": ["H-1B"], "consulates": ["BOM"],
         "key_stages_or_info": {"citizen_of_country": "IN"}, "key_dates": {"priority_date": "2022-01-01"}})
    check("G15 full overlap sums all signals (3+1.5+1+1.5 = 7.0)", abs(full["score"] - 7.0) < 0.01, str(full["score"]))
    check("G16 shared lists every matched facet",
          set(full["shared"]) == {"H-1B", "BOM", "citizen_of_country=IN", "priority_date(exact)"}, str(full["shared"]))


def group_h_match_integration() -> None:
    print("\nH — positive / negative matching via find_matches (integration)")
    from google.cloud import firestore
    db = firestore.Client(project=PROJECT)

    ids = {k: f"test-mc-{k}-{secrets.token_hex(3)}" for k in
           ("clone", "strong", "visa", "consulate", "stage", "diffvisa", "diffcons", "empty")}
    crit = {"current_visa_or_greencard_category": ["H-1B"], "consulates": ["BOM"],
            "key_stages_or_info": {"citizen_of_country": "IN"}}
    seeds = {
        ids["clone"]:     {"username": "clone", "current_visa_or_greencard_category": ["H-1B"], "consulates": ["BOM"], "key_stages_or_info": {"citizen_of_country": "IN"}},   # 5.5
        ids["strong"]:    {"username": "strong", "current_visa_or_greencard_category": ["H-1B"], "consulates": ["BOM"]},  # 4.5
        ids["visa"]:      {"username": "visaonly", "current_visa_or_greencard_category": ["H-1B"]},  # 3.0
        ids["consulate"]: {"username": "consonly", "current_visa_or_greencard_category": ["F-1"], "consulates": ["BOM"]},  # 1.5
        ids["stage"]:     {"username": "stageonly", "current_visa_or_greencard_category": ["O-1"], "key_stages_or_info": {"citizen_of_country": "IN"}},  # 1.0
        ids["diffvisa"]:  {"username": "diffvisa", "current_visa_or_greencard_category": ["F-1"]},  # 0 (negative)
        ids["diffcons"]:  {"username": "diffcons", "current_visa_or_greencard_category": ["B-1"], "consulates": ["LON"]},  # 0 (negative)
        ids["empty"]:     {"username": "emptyprof"},  # 0 (negative)
    }
    try:
        for uid, p in seeds.items():
            db.collection("users").document(uid).set(p)
        ms = M.find_matches(db, "demo-arjun", crit)
        by = {m["user_id"]: m for m in ms}

        # positives present with the expected scores
        check("H1 clone (visa+consulate+status) = 5.5", ids["clone"] in by and abs(by[ids["clone"]]["score"] - 5.5) < 0.01)
        check("H2 strong (visa+consulate) = 4.5", ids["strong"] in by and abs(by[ids["strong"]]["score"] - 4.5) < 0.01)
        check("H3 visa-only = 3.0", ids["visa"] in by and abs(by[ids["visa"]]["score"] - 3.0) < 0.01)
        check("H4 consulate-only = 1.5", ids["consulate"] in by and abs(by[ids["consulate"]]["score"] - 1.5) < 0.01)
        check("H5 status-fact-only = 1.0 (== MIN_SCORE, still a match)", ids["stage"] in by and abs(by[ids["stage"]]["score"] - 1.0) < 0.01)

        # negatives excluded
        check("H6 disjoint-visa peer excluded", ids["diffvisa"] not in by)
        check("H7 disjoint-consulate peer excluded", ids["diffcons"] not in by)
        check("H8 empty profile excluded", ids["empty"] not in by)
        check("H9 caller is never in their own matches", "demo-arjun" not in by)

        # ranking among our seeds is strictly by score desc
        ours = [m["user_id"] for m in ms if m["user_id"] in ids.values()]
        expected = [ids["clone"], ids["strong"], ids["visa"], ids["consulate"], ids["stage"]]
        check("H10 ranked by score desc", ours == expected, str([(by[i]["username"], by[i]["score"]) for i in ours]))

        # top_n cap + min_score override
        top2 = M.find_matches(db, "demo-arjun", crit, top_n=2)
        check("H11 top_n caps the result + stays sorted",
              len(top2) == 2 and top2[0]["score"] >= top2[1]["score"], str(len(top2)))
        strict = {m["user_id"] for m in M.find_matches(db, "demo-arjun", crit, min_score=2.0)}
        check("H12 min_score raises the bar (keeps ≥3.0, drops ≤1.5)",
              ids["visa"] in strict and ids["consulate"] not in strict and ids["stage"] not in strict)
    finally:
        for uid in ids.values():
            db.collection("users").document(uid).delete()
        print("  cleaned up match-criteria test docs")


def main() -> int:
    if not PROJECT:
        print("GCP_PROJECT_ID must be set")
        return 2
    only = sys.argv[1] if len(sys.argv) > 1 else "all"
    print(f"Matching tests — project={PROJECT}  (scope={only})")

    group_a_pure()
    group_d_dates()
    group_g_match_criteria()
    if only in ("all", "integration"):
        group_b_firestore()
        group_c_api()
        group_e_merge_match()
        group_f_dates_match()
        group_h_match_integration()

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
