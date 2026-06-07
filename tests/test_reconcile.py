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

    # A9 — visa_applying_for is reconciled too (not just current status).
    r9 = rc.reconcile_profile_message({"visa_applying_for": ["EB-2"]},
                                      {"visa_applying_for": ["EB-3"], "description": "x"})
    check("A9 visa_applying_for conflict: message wins + logged",
          r9["merged"]["visa_applying_for"] == ["EB-3"]
          and any(c["field"] == "visa_applying_for" for c in r9["conflicts"]))

    # A10 — consulates conflict (both set, differ).
    r10 = rc.reconcile_profile_message({"consulates": ["BOM"]},
                                       {"consulates": ["DEL"], "description": "x"})
    check("A10 consulates conflict: message wins + logged",
          r10["merged"]["consulates"] == ["DEL"] and any(c["field"] == "consulates" for c in r10["conflicts"]))

    # A11 — primary_consulate conflict.
    r11 = rc.reconcile_profile_message({"primary_consulate": "BOM", "consulates": ["BOM"]},
                                       {"primary_consulate": "DEL", "consulates": ["DEL"], "description": "x"})
    check("A11 primary_consulate conflict: message wins + logged",
          r11["merged"]["primary_consulate"] == "DEL"
          and any(c["field"] == "primary_consulate" for c in r11["conflicts"]))

    # A12 — primary_consulate prefilled from profile when message omits it.
    r12 = rc.reconcile_profile_message({"primary_consulate": "BOM", "consulates": ["BOM"]},
                                       {"description": "x"})
    check("A12 primary_consulate prefilled from profile",
          r12["merged"]["primary_consulate"] == "BOM" and "primary_consulate" in r12["prefilled"])

    # A13 — primary_consulate derived from consulates[0] when neither side sets it.
    r13 = rc.reconcile_profile_message({}, {"consulates": ["MAA", "BOM"], "description": "x"})
    check("A13 primary_consulate derived from consulates[0]", r13["merged"]["primary_consulate"] == "MAA")

    # A14 — key_stages map: additive from the message; overlap-with-diff is a conflict.
    r14 = rc.reconcile_profile_message(
        {"key_stages_or_info": {"citizen_of_country": "IN", "spouse_status": "H-1B"}},
        {"key_stages_or_info": {"spouse_status": "H-4", "visa_status": "approved"}, "description": "x"})
    ks = r14["merged"]["key_stages_or_info"]
    check("A14 key_stages: union + message wins on overlap + conflict logged",
          ks.get("citizen_of_country") == "IN" and ks.get("spouse_status") == "H-4"
          and ks.get("visa_status") == "approved"
          and any(c["field"] == "key_stages_or_info.spouse_status" for c in r14["conflicts"]))

    # A15 — empty profile: merged == message values, no conflicts, no prefill.
    r15 = rc.reconcile_profile_message({}, {"current_visa_or_greencard_category": ["F-1"], "consulates": ["BOM"],
                                            "description": "y"})
    check("A15 empty profile -> message only, no conflicts/prefill",
          r15["merged"]["current_visa_or_greencard_category"] == ["F-1"]
          and r15["conflicts"] == [] and r15["prefilled"] == [], str(r15["prefilled"]))

    # A16 — empty message: everything prefilled from profile, no conflicts.
    r16 = rc.reconcile_profile_message(
        {"current_visa_or_greencard_category": ["H-1B"], "consulates": ["BOM"], "visa_applying_for": ["EB-2"]},
        {"description": ""})
    check("A16 empty message -> all prefilled, no conflicts",
          r16["conflicts"] == [] and set(["current_visa_or_greencard_category", "consulates", "visa_applying_for"]).issubset(set(r16["prefilled"])),
          str(r16["prefilled"]))

    # A17 — background: uses profile when the message has none.
    r17 = rc.reconcile_profile_message({"background_text": "My background."}, {"description": ""})
    check("A17 background falls back to profile when message empty",
          r17["merged"]["background_text"] == "My background.")

    # A18 — background: no duplication when message already contains the profile text.
    r18 = rc.reconcile_profile_message({"background_text": "India"},
                                       {"description": "I am from India and on H-1B."})
    check("A18 background not duplicated when already present",
          r18["merged"]["background_text"].count("India") == 1, r18["merged"]["background_text"])


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

    # Experience tagging rules: 1) universal past-experience + experience-posting;
    # 2) timeline iff dates; 3) visa-interview-experience for interview milestones; 4) no concerns.
    for t in ("past-experience", "experience-posting", "visa-interview-experience"):
        check(f"B-vocab '{t}' exists in tag vocab", t in p._Vocab.tag)

    ex_concern = dict(extracted, concerns_or_questions_tags=["visa-interview", "consular-processing"])
    cd = p.build_experience_canonical(profile, entry, ex_concern)  # entry = visa_interview w/ date
    check("B9 rule1: every experience tagged past-experience + experience-posting",
          "past-experience" in cd["tags"] and "experience-posting" in cd["tags"], str(cd["tags"]))
    check("B10 rule2: 'timeline' added when the experience has a date", "timeline" in cd["tags"], str(cd["tags"]))
    check("B11 rule4: experience never carries concerns/questions tags", cd["concerns_or_questions_tags"] == [], str(cd["concerns_or_questions_tags"]))
    check("B11d rule3: 'visa-interview-experience' on an interview milestone", "visa-interview-experience" in cd["tags"], str(cd["tags"]))

    cn = p.build_experience_canonical(profile, {"milestone": "port_of_entry", "date": "", "experience": "JFK entry, fine"},
                                      dict(extracted, key_dates={}))
    check("B12 rule2: no 'timeline' tag when the experience has no dates", "timeline" not in cn["tags"], str(cn["tags"]))
    check("B12b rule1: past-experience still universal on non-interview milestone", "past-experience" in cn["tags"], str(cn["tags"]))
    check("B12c rule3: 'visa-interview-experience' NOT on a non-interview milestone",
          "visa-interview-experience" not in cn["tags"], str(cn["tags"]))


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


# ---------------------------------------------------------------------------
# D — explainer + helpers (UNIT deterministic; one INTEGRATION check)
# ---------------------------------------------------------------------------

def group_d(run_llm: bool) -> None:
    print("\nD — explainer + date helper")
    import reconcile as rc
    import posting as p

    check("D1 explain_conflicts('') -> '' (no conflicts, no LLM call)", rc.explain_conflicts([]) == "")

    # normalize_date_safe delegates to profile.normalize_date.
    check("D2 normalize_date_safe handles formats + drops junk",
          p.normalize_date_safe("03/15/2027") == "2027-03-15"
          and p.normalize_date_safe("2026-08-12") == "2026-08-12"
          and p.normalize_date_safe("nope") == "")

    if run_llm:
        text = rc.explain_conflicts([{"field": "current_visa_or_greencard_category",
                                      "profile_value": ["H-1B"], "message_value": ["H-4"]}])
        check("D3 explain_conflicts(conflict) -> non-empty offer to update profile (LLM/fallback)",
              isinstance(text, str) and len(text) > 0 and "profile" in text.lower(), text[:80])


# ---------------------------------------------------------------------------
# E — projection / connect-card / delete (INTEGRATION: real GCS+datastore+BQ)
# ---------------------------------------------------------------------------

def group_e() -> None:
    print("\nE — projection / connect-card / delete (integration)")
    import posting as p
    import profile as pr

    # E1 — project a SHARED experience: publishes a real doc, sets the case_id; then withdraw.
    prof = pr.clean_profile({"username": "eager-delta-7277",
                             "journey": [{"milestone": "visa_interview", "date": "2024-03-10",
                                          "experience": "Mumbai H-1B stamping, approved in 2 minutes.",
                                          "shared": True}]})
    prof, notes = pr.project_experiences(prof)
    cid = prof["journey"][0]["experience_case_id"]
    check("E1 shared experience published (case_id set)", bool(cid) and any(n[0] == "published" for n in notes), str(notes))

    if cid:
        proj, loc, ds = p._project(), p._ds_location(), p._datastore()
        import search_client as sc
        doc = sc.get_posting(cid, proj, loc, ds) or {}
        check("E2 published experience carries the rule tags",
              "past-experience" in (doc.get("tags") or []) and "experience-posting" in (doc.get("tags") or []),
              str(doc.get("tags")))

        # withdraw consent -> delete_content removes it
        prof["journey"][0]["shared"] = False
        prof, notes2 = pr.project_experiences(prof)
        check("E3 un-sharing withdraws the doc (case_id cleared)",
              prof["journey"][0]["experience_case_id"] == "" and any(n[0] == "unpublished" for n in notes2), str(notes2))
        check("E4 withdrawn doc is gone from the datastore",
              sc.get_posting(cid, proj, loc, ds) is None)

    # E5 — connect card publishes a doc_kind=connect_card; then delete_content cleans it.
    cc = p.publish_connect_card({"username": "eager-delta-7277", "current_visa_or_greencard_category": ["H-1B"],
                                 "consulates": ["BOM"]}, note="Happy to connect.")
    check("E5 connect card published (doc_kind=connect_card)",
          cc["doc_kind"] == "connect_card" and cc["case_id"].startswith("ourwebsite-connect-"), str(cc))
    p.delete_content(cc["case_id"])
    check("E6 connect card deleted", True)


def main() -> int:
    if not PROJECT:
        print("GCP_PROJECT_ID must be set"); return 2
    only = sys.argv[1] if len(sys.argv) > 1 else "all"
    print(f"Reconcile/experience tests — project={PROJECT}  (scope={only})")
    group_a()
    group_b()
    group_c()
    group_d(run_llm=only in ("all", "llm"))
    if only in ("all", "integration"):
        group_e()
    print("\n" + "=" * 60)
    passed = sum(1 for _, ok in _results if ok)
    failed = [n for n, ok in _results if not ok]
    print(f"SUMMARY: {passed}/{len(_results)} checks passed")
    if failed:
        print("FAILED: " + "; ".join(failed)); return 1
    print("All reconcile/experience checks passed."); return 0


if __name__ == "__main__":
    sys.exit(main())
