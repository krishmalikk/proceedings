"""
test_e2e_journey.py — full user-journey E2E (phase-J).

Simulates the whole flow against REAL Firestore + GCS + Vertex AI Search
(Discovery Engine), asserting the generated backend JSON at each step:

  1. User A sets up a PROFILE        -> assert the stored profile JSON.
  2. User A shares an EXPERIENCE     -> assert the generated experience sidecar JSON.
  3. User A makes a POSTING          -> assert the generated posting sidecar JSON.
  4. User B SEARCHES the keywords    -> User A's posting is retrieved from Vertex AI Search.

Publishes real documents and polls search (indexing is async — minutes), then
cleans everything up in a finally block.

Run:  .venv/bin/python tests/test_e2e_journey.py
      (slow — step 4 polls search for up to ~6 minutes)
"""

import json
import os
import re
import sys
import time

from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv()

PROJECT = os.getenv("GCP_PROJECT_ID") or os.getenv("GCP_PROJECT", "")
BUCKET = os.getenv("GCP_BUCKET_NAME") or os.getenv("GCP_BUCKET", "imm-postings-ingestion")
USER_A = "demo-arjun"
USER_B = "demo-mei"

_results: list[tuple[str, bool]] = []


def check(name: str, passed: bool, detail: str = "") -> None:
    _results.append((name, passed))
    print(f"  [{'PASS' if passed else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


def assert_subset(name: str, actual: dict, expected: dict) -> None:
    """Assert every key in `expected` matches `actual` (exact). Prints the diff on failure."""
    diffs = {k: (expected[k], actual.get(k)) for k in expected if actual.get(k) != expected[k]}
    check(name, not diffs, "" if not diffs else f"mismatches {json.dumps(diffs, default=str)}")


def read_sidecar(case_id: str, gcs_prefix: str = "") -> dict:
    """Read the generated <case_id>.json sidecar from GCS (the exact canonical)."""
    from google.cloud import storage
    if gcs_prefix:
        rest = gcs_prefix[len("gs://"):].rstrip("/")
        bucket_name, base = rest.split("/", 1)
    else:
        m = re.search(r"(\d{4}-\d{2}-\d{2})", case_id)
        bucket_name, base = BUCKET, f"{m.group(1)}/ourwebsite"
    blob = storage.Client(project=PROJECT).bucket(bucket_name).blob(f"{base}/{case_id}.json")
    return json.loads(blob.download_as_text())


def poll_search(client, query: str, target_cid: str, timeout_s: int = 360, interval_s: int = 15):
    deadline = time.time() + timeout_s
    ids: list = []
    attempt = 0
    while time.time() < deadline:
        attempt += 1
        r = client.get("/api/search", params={"q": query, "strictness": "broad", "page_size": 20}).json()
        ids = [x["case_id"] for x in r.get("results", [])]
        if target_cid in ids:
            return True, attempt, ids
        time.sleep(interval_s)
    return False, attempt, ids


def main() -> int:
    if not PROJECT:
        print("GCP_PROJECT_ID must be set"); return 2

    from fastapi.testclient import TestClient
    import api, posting
    from google.cloud import firestore
    api.RATE_LIMIT_MAX = 1_000_000

    print(f"E2E journey — project={PROJECT}")
    created_docs: list[str] = []   # case_ids to delete
    db = firestore.Client(project=PROJECT)

    try:
        with TestClient(api.app) as client:
            hdrA = {"X-User-Id": USER_A}

            # ---- 1. PROFILE ----
            print("\n1 — User A sets up a profile")
            profile_in = {
                "current_visa_or_greencard_category": ["H-1B"],
                "visa_applying_for": [],
                "primary_consulate": "",
                "consulates": ["BOM"],
                "key_stages_or_info": {"citizen_of_country": "IN"},
                "key_dates": {"i140_filed_date": "02/28/2026"},          # tests date normalization
                "background_text": "H-1B from India; EB-2 PERM in progress.",
            }
            client.put("/api/profile", headers=hdrA, json=profile_in)
            stored = client.get("/api/profile", headers=hdrA).json()
            assert_subset("1a profile JSON matches expected (controlled fields)", stored, {
                "current_visa_or_greencard_category": ["H-1B"],
                "visa_applying_for": [],
                "primary_consulate": "",
                "consulates": ["BOM"],
                "key_stages_or_info": {"citizen_of_country": "IN"},
                "key_dates": {"i140_filed_date": "2026-02-28"},          # normalized
                "background_text": "H-1B from India; EB-2 PERM in progress.",
            })
            check("1b profile username + timestamps present",
                  bool(stored.get("username")) and bool(stored.get("updated_at")))

            # ---- 2. EXPERIENCE (shared -> projected to a searchable doc) ----
            print("\n2 — User A shares an experience")
            with_exp = dict(profile_in, journey=[{
                "milestone": "visa_interview", "date": "03/10/2024",
                "experience": "My H-1B visa stamping interview at the Mumbai consulate went smoothly; approved in 2 minutes.",
                "shared": True,
            }])
            saved = client.put("/api/profile", headers=hdrA, json=with_exp).json()
            exp_cid = saved["journey"][0].get("experience_case_id", "")
            check("2a shared experience was projected (case_id set)", bool(exp_cid), exp_cid)
            if exp_cid:
                created_docs.append(exp_cid)
                ej = read_sidecar(exp_cid)
                assert_subset("2b experience JSON matches expected (stable fields)", ej, {
                    "doc_kind": "experience",
                    "channel": "ourwebsite",
                    "source_system": "ourwebsite",
                    "concerns_or_questions_tags": [],                    # rule: never concerns
                    "parent_case_id": ej.get("author_handle"),          # linked by handle (no PII)
                })
                check("2c experience key_dates has the milestone date (normalized)",
                      ej.get("key_dates", {}).get("visa_interview_date") == "2024-03-10", str(ej.get("key_dates")))
                forced = {"past-experience", "experience-posting", "visa-interview-experience", "timeline"}
                check("2d experience carries the rule tags", forced.issubset(set(ej.get("tags", []))), str(ej.get("tags")))

            # ---- 3. POSTING ----
            print("\n3 — User A makes a posting")
            posting_in = {
                "title": "L-1B blanket visa stamping at Chennai — 221g then cleared",
                "description": "Sharing my experience: L-1B blanket petition, stamping at the Chennai consulate. "
                               "Got a 221(g) administrative processing slip, cleared after three weeks.",
                "tags": {"visa_applying_for": ["L-1B"], "current_visa_or_greencard_category": [],
                         "consulates": ["MAA"], "tags": ["221g", "administrative-processing"],
                         "concerns_or_questions_tags": []},
                "key_dates": {"visa_interview_date": "2024-05-01"},
            }
            pub = client.post("/api/postings", headers=hdrA, json=posting_in).json()
            post_cid = pub.get("case_id", "")
            check("3a posting published", bool(post_cid) and pub.get("indexed") is True, post_cid)
            if post_cid:
                created_docs.append(post_cid)
                pj = read_sidecar(post_cid, pub.get("gcs_path", ""))
                assert_subset("3b posting JSON matches expected (controlled fields)", pj, {
                    "doc_kind": "post",
                    "channel": "ourwebsite",
                    "source_system": "ourwebsite",
                    "current_visa_or_greencard_category": [],
                    "visa_applying_for": ["L-1B"],
                    "consulates": ["MAA"],
                    "primary_consulate": "MAA",                          # derived from consulates[0]
                    "tags": ["221g", "administrative-processing"],
                    "concerns_or_questions_tags": [],
                    "key_dates": {"visa_interview_date": "2024-05-01"},
                })
                check("3c posting title preserved + embedding_text present",
                      pj.get("post_title") == posting_in["title"] and bool(pj.get("embedding_text")))

            # ---- 4. SEARCH (User B retrieves User A's posting) ----
            print("\n4 — User B searches and retrieves the posting (polling Vertex AI Search indexing…)")
            if post_cid:
                found, attempts, ids = poll_search(client, "L-1B blanket stamping Chennai 221g administrative processing", post_cid)
                check(f"4a User B's search retrieves User A's posting (after {attempts} polls)", found,
                      "" if found else f"not indexed within timeout; last results: {ids[:5]}")

    finally:
        print("\nCleanup")
        for cid in created_docs:
            try:
                posting.delete_content(cid)
            except Exception as e:  # noqa: BLE001
                print(f"  cleanup {cid}: {e}")
        for uid in (USER_A,):
            try:
                db.collection("users").document(uid).delete()
            except Exception:  # noqa: BLE001
                pass
        print(f"  deleted {len(created_docs)} docs + profile {USER_A}")

    print("\n" + "=" * 60)
    passed = sum(1 for _, ok in _results if ok)
    failed = [n for n, ok in _results if not ok]
    print(f"SUMMARY: {passed}/{len(_results)} checks passed")
    if failed:
        print("FAILED: " + "; ".join(failed)); return 1
    print("All E2E journey checks passed."); return 0


if __name__ == "__main__":
    sys.exit(main())
