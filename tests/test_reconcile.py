"""
test_reconcile.py — phase-J: reconciliation + experience/connect-card documents.

  A  reconcile_profile_message field rules (UNIT, deterministic)
  B  build_experience_canonical: doc_kind=experience, facets-from-text-not-
     current-state, milestone date mapping, handle (no PII) (UNIT, deterministic
     — extraction injected, no network)

Run:  .venv/bin/python tests/test_reconcile.py
"""

import os
import re
import sys

from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv()

PROJECT = os.getenv("GCP_PROJECT_ID") or os.getenv("GCP_PROJECT", "")
_results: list[tuple[str, bool]] = []


def check(name: str, passed: bool, detail: str = "") -> None:
    _results.append((name, passed))
    print(f"  [{'PASS' if passed else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


# ---------------------------------------------------------------------------
# A — reconcile_profile_message (UNIT)
# ---------------------------------------------------------------------------

def group_a() -> None:
    print("\nA — reconcile field rules (unit)")
    import reconcile as rc

    prof = {"current_visa_or_greencard_category": ["H-1B"], "consulates": ["BOM"],
            "key_stages_or_info": {"citizen_of_country": "IN"},
            "key_dates": {"visa_interview_date": "2024-03-10"},
            "background_text": "H-1B holder from India."}
    msg = {"current_visa_or_greencard_category": ["H-4"], "consulates": [],
           "key_dates": {"visa_interview_date": "2025-01-01"},
           "description": "Asking about my H-4 EAD."}
    r = rc.reconcile_profile_message(prof, msg)
    m, conf = r["merged"], r["conflicts"]

    check("A1 message wins on a tag conflict", m["current_visa_or_greencard_category"] == ["H-4"])
    check("A2 conflict recorded for differing visa",
          any(c["field"] == "current_visa_or_greencard_category" for c in conf))
    check("A3 empty message field pre-filled from profile",
          m["consulates"] == ["BOM"] and "consulates" in r["prefilled"])
    check("A4 map overlap: message value wins + conflict logged",
          m["key_dates"]["visa_interview_date"] == "2025-01-01"
          and any(c["field"] == "key_dates.visa_interview_date" for c in conf))
    check("A5 profile-only map keys retained (additive)",
          m["key_stages_or_info"].get("citizen_of_country") == "IN")
    check("A6 background unioned (message first, profile appended)",
          "H-4 EAD" in m["background_text"] and "from India" in m["background_text"])

    # no-conflict: identical values -> no conflicts, no prefill churn
    r2 = rc.reconcile_profile_message(
        {"current_visa_or_greencard_category": ["H-1B"]},
        {"current_visa_or_greencard_category": ["H-1B"], "description": "x"})
    check("A7 identical values -> no conflict",
          r2["conflicts"] == [] and r2["merged"]["current_visa_or_greencard_category"] == ["H-1B"])

    # out-of-vocab values are dropped before comparison (no spurious conflict)
    r3 = rc.reconcile_profile_message(
        {"current_visa_or_greencard_category": ["H-1B"]},
        {"current_visa_or_greencard_category": ["H-1B", "NOT-A-VISA"], "description": "x"})
    check("A8 out-of-vocab dropped, no false conflict",
          r3["conflicts"] == [] and r3["merged"]["current_visa_or_greencard_category"] == ["H-1B"])


# ---------------------------------------------------------------------------
# B — build_experience_canonical (UNIT; extraction injected)
# ---------------------------------------------------------------------------

def group_b() -> None:
    print("\nB — experience document builder (unit)")
    import posting as p

    # Injected tagger output for the EXPERIENCE text (a consular interview).
    extracted = {
        "visa_applying_for": ["H-1B"], "current_visa_or_greencard_category": [],
        "consulates": ["BOM"], "primary_consulate": "BOM",
        "tags": ["visa-stamping", "approved"], "concerns_or_questions_tags": [],
        "key_stages_or_info": {"visa_status": "approved"}, "key_dates": {},
        "background_summary": "H-1B stamping at Mumbai.",
        "concerns_or_questions_summary": "Interview experience.",
        "severity": "low", "employer_type": "unknown", "resolution_status": "resolved",
        "derived_topic_cluster": ["visa-stamping"],
    }
    profile = {"username": "eager-delta-7277", "current_visa_or_greencard_category": ["H-1B"]}
    entry = {"milestone": "Visa Interview", "date": "March 10, 2024",
             "experience": "Interview at Mumbai went smoothly, approved in 2 minutes."}
    c = p.build_experience_canonical(profile, entry, extracted)

    check("B1 doc_kind == experience", c["doc_kind"] == "experience", c["doc_kind"])
    check("B2 case_id is an exp- id", bool(re.match(r"^ourwebsite-exp-\d{4}-\d{2}-\d{2}-[0-9a-f]{8}$", c["case_id"])), c["case_id"])
    check("B3 author/parent = synthetic handle (no PII)",
          c["author_handle"] == "eager-delta-7277" and c["parent_case_id"] == "eager-delta-7277")
    check("B4 facets describe the EXPERIENCE (from text), not current state",
          c["visa_applying_for"] == ["H-1B"] and c["consulates"] == ["BOM"]
          and "visa-stamping" in c["tags"], str(c["visa_applying_for"]))
    check("B5 milestone date mapped to its 1.8 key (normalized)",
          c["key_dates"].get("visa_interview_date") == "2024-03-10", str(c["key_dates"]))
    check("B6 milestone slug added to derived_topic_cluster", "visa_interview" in c["derived_topic_cluster"], str(c["derived_topic_cluster"]))
    check("B7 current-state tag stays empty (experience didn't assert current status)",
          c["current_visa_or_greencard_category"] == [], str(c["current_visa_or_greencard_category"]))
    check("B8 milestone->date map covers the common milestones",
          all(k in p._MILESTONE_DATE_KEY for k in ("visa_interview", "port_of_entry", "h1b_approval", "i485_filing")))


# ---------------------------------------------------------------------------
# C — boundary + consent guards (UNIT, deterministic, no network)
# ---------------------------------------------------------------------------

def group_c() -> None:
    print("\nC — boundary + consent guards (unit)")
    import profile as pr

    # C1 — the PROFILE record has NONE of the content-doc fields, so it can never be
    # mistaken for / imported as an indexable document (D-041 boundary, structural).
    prof = pr.empty_profile()
    content_only = {"doc_kind", "case_id", "embedding_text", "gcs_path", "ingestion_method"}
    check("C1 profile schema has no content-doc fields (never indexable)",
          content_only.isdisjoint(prof.keys()), str(sorted(content_only & set(prof.keys()))))

    # C2 — consent default ON (per product: "share the timeline" ticked by default),
    # but with no published doc id until a save actually projects it.
    e = pr.clean_profile({"journey": [{"milestone": "visa_interview", "date": "2024-03-10",
                                       "experience": "Mumbai interview, approved."}]})["journey"][0]
    check("C2 experience consent defaults ON (shared=True, no doc id yet)",
          e["shared"] is True and e["experience_case_id"] == "", str(e))
    # explicit opt-out is still respected.
    e2 = pr.clean_profile({"journey": [{"milestone": "visa_interview", "date": "2024-03-10",
                                        "experience": "x", "shared": False}]})["journey"][0]
    check("C2b explicit shared=False is respected", e2["shared"] is False, str(e2))

    # C3 — projection is a no-op when nothing is shared (no publish, no network).
    prof2 = pr.clean_profile({"username": "x", "journey": [
        {"milestone": "visa_interview", "date": "2024-03-10", "experience": "a", "shared": False}]})
    out, notes = pr.project_experiences(prof2)
    check("C3 project_experiences no-op when unshared",
          notes == [] and out["journey"][0]["experience_case_id"] == "", str(notes))


def main() -> int:
    if not PROJECT:
        print("GCP_PROJECT_ID must be set"); return 2
    print(f"Reconcile/experience tests — project={PROJECT}")
    group_a()
    group_b()
    group_c()
    print("\n" + "=" * 60)
    passed = sum(1 for _, ok in _results if ok)
    failed = [n for n, ok in _results if not ok]
    print(f"SUMMARY: {passed}/{len(_results)} checks passed")
    if failed:
        print("FAILED: " + "; ".join(failed)); return 1
    print("All reconcile/experience checks passed."); return 0


if __name__ == "__main__":
    sys.exit(main())
