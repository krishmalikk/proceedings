"""
seed_synthetic.py — create 20 synthetic users and drive the social features
(postings, cross-replies + votes, group formation + group chat) for manual
end-to-end testing of the app.

WHAT IT CREATES (all against your REAL GCP project — test data IS live data):
  • 20 user profiles in Firestore `users/{syn-NN}` (ids syn-01 … syn-20).
  • 20 postings published to the REAL Vertex AI Search datastore + GCS + BigQuery
    (each marked pipeline_run_id=test-synthetic so cleanup can find them; ~20
    Gemini enrichment calls).
  • A web of replies + up/down votes — every user replies to and votes on several
    OTHER users' postings (and on each other's replies).
  • 4 groups (one per "boat" — a shared visa+consulate+country signature), each
    with all 5 of its members, plus a few chat messages per member.

The 20 ids MUST already be in `backend/seed_users.json` (they are — committed
alongside this script) so the API's X-User-Id impersonation accepts them and
they show in the demo-user picker.

PREREQUISITES
  • ADC: `gcloud auth application-default login` (or an attached SA), with
    Firestore + GCS + Vertex AI Search + BigQuery + Gemini permissions.
  • `.env` populated (GCP_PROJECT_ID, GCP_BUCKET_NAME, GCP_VERTEX_* …) — same as
    the rest of the backend. No SA key files (D-018).

RUN (from backend/):
    python scripts/seed_synthetic.py

It writes a manifest to `backend/scripts/seed_manifest.json`. To remove
everything afterwards:
    python scripts/teardown_synthetic.py
"""

from __future__ import annotations

import datetime as dt
import json
import os
import sys

# --- make `import api` etc. work when run from backend/ or backend/scripts/ ---
_BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _BACKEND)

from dotenv import load_dotenv  # noqa: E402

load_dotenv(os.path.join(_BACKEND, ".env"))

MARKER = "test-synthetic"  # BQ pipeline_run_id prefix (must start with "test-" to be purgeable)
MANIFEST_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "seed_manifest.json")


# ---------------------------------------------------------------------------
# Persona design — 4 "boats", 5 members each. Members of a boat share an
# identical (visa-set + consulate + citizen_of_country) signature, so the
# matcher converges them into ONE group; their key-dates are spread across the
# proximity buckets (exact / ≤30d / ≤90d / far) to exercise date scoring.
# IDs + usernames MUST match backend/seed_users.json.
# ---------------------------------------------------------------------------
BOATS = [
    {
        "key": "A", "label": "H-1B → EB-2 · Mumbai (BOM) · India",
        "current": ["H-1B"], "applying": ["EB-2"],
        "consulates": ["BOM"], "country": "IN",
        "date_key": "i140_filed_date", "base_date": "2026-02-15",
        "title": "H-1B → EB-2: I-140 filed via Mumbai — sharing my timeline",
        "desc": ("On H-1B, EB-2 with PERM certified and I-140 now filed. Posting my "
                 "dates and the Mumbai (BOM) consulate context so others in the same "
                 "boat can compare notes on priority dates and processing."),
        "members": [
            ("syn-01", "aarav-h1b", 0), ("syn-02", "diya-h1b", 10), ("syn-03", "rohan-h1b", -18),
            ("syn-04", "ananya-h1b", 40), ("syn-05", "vikram-h1b", -80),
        ],
    },
    {
        "key": "B", "label": "F-1 → H-1B · Hyderabad (HYD) · India",
        "current": ["F-1"], "applying": ["H-1B"],
        "consulates": ["HYD"], "country": "IN",
        "date_key": "h1b_filed_date", "base_date": "2026-03-10",
        "title": "F-1 OPT → H-1B: petition filed, planning Hyderabad stamping",
        "desc": ("Currently F-1 on OPT, employer filed my H-1B this cycle. Looking to "
                 "connect with others doing H-1B stamping at Hyderabad (HYD) — sharing "
                 "my filing date and questions about the consulate process."),
        "members": [
            ("syn-06", "ishaan-f1", 0), ("syn-07", "priya-f1", 8), ("syn-08", "karan-f1", -25),
            ("syn-09", "sneha-f1", 60), ("syn-10", "aditya-f1", -95),
        ],
    },
    {
        "key": "C", "label": "EB-2 NIW · Chennai (MAA) · India",
        "current": [], "applying": ["EB-2"],
        "consulates": ["MAA"], "country": "IN",
        "date_key": "i140_filed_date", "base_date": "2026-01-20",
        "title": "EB-2 NIW self-petition: I-140 filed, Chennai consular route",
        "desc": ("Self-petitioned EB-2 NIW, I-140 filed. Planning consular processing "
                 "through Chennai (MAA). Posting my timeline to find others on the NIW "
                 "path and compare priority-date movement."),
        "members": [
            ("syn-11", "meera-eb2", 0), ("syn-12", "arnav-eb2", 15), ("syn-13", "tara-eb2", -30),
            ("syn-14", "devn-eb2", 70), ("syn-15", "nisha-eb2", -120),
        ],
    },
    {
        "key": "D", "label": "B-2 visitor · Mexico City (MEX) · Mexico",
        "current": ["B-2"], "applying": [],
        "consulates": ["MEX"], "country": "MX",
        "date_key": "visa_interview_date", "base_date": "2026-04-05",
        "title": "B-2 visitor visa: interview booked at Mexico City",
        "desc": ("Applying for a B-2 visitor visa with my interview at the Mexico City "
                 "(MEX) consulate. Sharing my appointment date and looking to connect "
                 "with others interviewing around the same time."),
        "members": [
            ("syn-16", "mateo-b2", 0), ("syn-17", "valeria-b2", 5), ("syn-18", "diego-b2", -12),
            ("syn-19", "lucia-b2", 35), ("syn-20", "javier-b2", -60),
        ],
    },
]


def _date(base: str, offset_days: int) -> str:
    d = dt.date.fromisoformat(base) + dt.timedelta(days=offset_days)
    return d.isoformat()


def _build_personas() -> list[dict]:
    """Flatten BOATS into 20 ordered persona dicts (index 0..19)."""
    personas: list[dict] = []
    for boat in BOATS:
        for uid, username, off in boat["members"]:
            personas.append({
                "id": uid, "username": username, "boat": boat["key"],
                "current": boat["current"], "applying": boat["applying"],
                "consulates": boat["consulates"], "primary": boat["consulates"][0],
                "country": boat["country"],
                "date_key": boat["date_key"], "date": _date(boat["base_date"], off),
                "title": boat["title"], "desc": boat["desc"],
            })
    return personas


# ---------------------------------------------------------------------------
# Driver
# ---------------------------------------------------------------------------
def main() -> int:
    project = os.getenv("GCP_PROJECT_ID") or os.getenv("GCP_PROJECT", "")
    if not project:
        print("ERROR: GCP_PROJECT_ID is not set (check backend/.env).")
        return 2

    print("=" * 72)
    print("SYNTHETIC SEED — this writes REAL data to project:", project)
    print("  • 20 users + 20 postings (REAL Vertex AI Search datastore + GCS + BQ)")
    print("  • replies, votes, 4 groups + chat messages")
    print(f"  • BQ rows marked pipeline_run_id={MARKER}; manifest → {MANIFEST_PATH}")
    print("  Run scripts/teardown_synthetic.py afterwards to remove it all.")
    print("=" * 72)

    # Mark every BQ posting row this run writes, so teardown can purge them.
    os.environ["POSTING_PIPELINE_RUN_ID"] = MARKER

    import api  # noqa: E402  (import after env is loaded)
    from fastapi.testclient import TestClient  # noqa: E402

    api.RATE_LIMIT_MAX = 10_000_000  # disable the per-IP limiter for this batch

    personas = _build_personas()
    by_index = {i: p for i, p in enumerate(personas)}
    n = len(personas)

    manifest: dict = {
        "marker": MARKER,
        "project": project,
        "users": [p["id"] for p in personas],
        "usernames": {p["id"]: p["username"] for p in personas},
        "case_ids": {},          # user_id -> posting case_id
        "reply_ids": [],         # all reply doc ids
        "group_ids": [],         # all group doc ids
        "votes": [],             # [content_id, voter_id] pairs (for vote-doc cleanup)
        "content_ids_voted": [], # distinct content ids that have a content_meta tally
    }

    def hdr(uid: str) -> dict:
        return {"X-User-Id": uid}

    def record_vote(content_id: str, voter_id: str) -> None:
        manifest["votes"].append([content_id, voter_id])
        if content_id not in manifest["content_ids_voted"]:
            manifest["content_ids_voted"].append(content_id)

    with TestClient(api.app) as client:
        # ---- 1. PROFILES -------------------------------------------------
        print("\n[1/4] Creating 20 profiles …")
        for p in personas:
            body = {
                "username": p["username"],
                "current_visa_or_greencard_category": p["current"],
                "visa_applying_for": p["applying"],
                "primary_consulate": p["primary"],
                "consulates": p["consulates"],
                "key_stages_or_info": {"citizen_of_country": p["country"]},
                "key_dates": {p["date_key"]: p["date"]},
                "background_text": f"Synthetic test user in boat {p['boat']} ({p['username']}).",
            }
            r = client.put("/api/profile", headers=hdr(p["id"]), json=body)
            print(f"   {p['id']} {p['username']:<12} -> {r.status_code}")
            if r.status_code >= 400:
                print("     !! profile failed:", r.text[:200])

        # ---- 2. POSTINGS (real publish) ----------------------------------
        print("\n[2/4] Publishing 20 postings to the datastore (slow; Gemini per call) …")
        for i, p in by_index.items():
            body = {
                "title": f"{p['title']} [{p['username']}]",
                "description": p["desc"],
                "tags": {
                    "visa_applying_for": p["applying"],
                    "current_visa_or_greencard_category": p["current"],
                    "primary_consulate": p["primary"],
                    "consulates": p["consulates"],
                    "tags": [],
                    "concerns_or_questions_tags": [],
                },
                "key_stages_or_info": {"citizen_of_country": p["country"]},
                "key_dates": {p["date_key"]: p["date"]},
            }
            r = client.post("/api/postings", headers=hdr(p["id"]), json=body)
            if r.status_code >= 400:
                print(f"   {p['id']} -> {r.status_code} !! {r.text[:200]}")
                continue
            cid = r.json().get("case_id", "")
            manifest["case_ids"][p["id"]] = cid
            print(f"   {p['id']} {p['username']:<12} -> {cid}")

        case_ids = manifest["case_ids"]

        # ---- 3. REPLIES + VOTES (cross-user web) -------------------------
        print("\n[3/4] Cross-replying + voting …")
        # Each user replies to 3 other users' postings (deterministic offsets).
        for i in range(n):
            author = by_index[i]
            for off in (1, 3, 7):
                target = by_index[(i + off) % n]
                tcid = case_ids.get(target["id"])
                if not tcid:
                    continue
                body = {"body": f"Hi {target['username']} — I'm in a similar spot ({author['boat']} boat). "
                                f"How are you finding the {target['consulates'][0]} timeline?"}
                r = client.post(f"/api/postings/{tcid}/replies", headers=hdr(author["id"]), json=body)
                if r.status_code < 400:
                    manifest["reply_ids"].append(r.json()["id"])

        # Votes on postings: each user up-votes 3 others, down-votes 1.
        for i in range(n):
            voter = by_index[i]["id"]
            for off in (1, 2, 5):
                tcid = case_ids.get(by_index[(i + off) % n]["id"])
                if tcid:
                    r = client.post("/api/votes", headers=hdr(voter), json={"content_id": tcid, "dir": 1})
                    if r.status_code < 400:
                        record_vote(tcid, voter)
            dcid = case_ids.get(by_index[(i + 9) % n]["id"])
            if dcid:
                r = client.post("/api/votes", headers=hdr(voter), json={"content_id": dcid, "dir": -1})
                if r.status_code < 400:
                    record_vote(dcid, voter)

        # Votes on replies: each user up-votes a couple of replies (round-robin).
        replies = manifest["reply_ids"]
        if replies:
            for i in range(n):
                voter = by_index[i]["id"]
                for k in (i * 2, i * 2 + 1):
                    rid = replies[k % len(replies)]
                    r = client.post("/api/votes", headers=hdr(voter), json={"content_id": rid, "dir": 1})
                    if r.status_code < 400:
                        record_vote(rid, voter)
        print(f"   created {len(manifest['reply_ids'])} replies, {len(manifest['votes'])} votes")

        # ---- 4. GROUPS + CHAT --------------------------------------------
        print("\n[4/4] Forming 4 groups + posting chat messages …")
        for boat in BOATS:
            members = [{"user_id": uid, "username": un} for (uid, un, _off) in boat["members"]]
            criteria = {
                "current_visa_or_greencard_category": boat["current"],
                "visa_applying_for": boat["applying"],
                "primary_consulate": boat["consulates"][0],
                "consulates": boat["consulates"],
                "key_stages_or_info": {"citizen_of_country": boat["country"]},
                "key_dates": {},
                "background_text": "",
            }
            creator = boat["members"][0][0]
            r = client.post("/api/groups", headers=hdr(creator),
                            json={"criteria_text": f"In the same boat: {boat['label']}",
                                  "criteria": criteria, "members": members})
            if r.status_code >= 400:
                print(f"   boat {boat['key']} -> {r.status_code} !! {r.text[:200]}")
                continue
            g = r.json()
            gid = g["group_id"]
            manifest["group_ids"].append(gid)
            print(f"   boat {boat['key']} -> group {gid} '{g.get('name','')}' ({len(g.get('members',[]))} members)")

            # Converge check: a 2nd member posting the same criteria should JOIN, not duplicate.
            second = boat["members"][1][0]
            rc = client.post("/api/groups", headers=hdr(second),
                             json={"criteria_text": "", "criteria": criteria, "members": []})
            if rc.status_code < 400 and rc.json().get("group_id") != gid:
                print(f"     !! convergence check: expected {gid}, got {rc.json().get('group_id')}")

            # Each member posts 2 chat messages.
            for (uid, un, _off) in boat["members"]:
                for msg in (f"Hey everyone, {un} here — joining the {boat['key']} group!",
                            f"My {boat['date_key'].replace('_',' ')} is on file; happy to compare notes."):
                    client.post(f"/api/groups/{gid}/messages", headers=hdr(uid), json={"text": msg})

    # ---- manifest -------------------------------------------------------
    with open(MANIFEST_PATH, "w") as f:
        json.dump(manifest, f, indent=2)

    print("\n" + "=" * 72)
    print("DONE. Summary:")
    print(f"  users:     {len(manifest['users'])}")
    print(f"  postings:  {len(manifest['case_ids'])}")
    print(f"  replies:   {len(manifest['reply_ids'])}")
    print(f"  votes:     {len(manifest['votes'])}")
    print(f"  groups:    {len(manifest['group_ids'])}  -> {manifest['group_ids']}")
    print(f"  manifest:  {MANIFEST_PATH}")
    print("  NOTE: postings take a few minutes to become searchable (async indexing).")
    print("  Clean up with: python scripts/teardown_synthetic.py")
    print("=" * 72)
    return 0


if __name__ == "__main__":
    sys.exit(main())
