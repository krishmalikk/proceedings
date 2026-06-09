"""
test_profile_edge.py — edge-case regression tests for profile cleaning/validation
(change-profile-enhancements branch). All deterministic (no network).

  R  robustness — empty / None / wrong-typed inputs must not crash
  W  whitespace trimming, de-duplication, case handling
  K  key_dates normalization (incl. the new j1_expire_date)
  J  journey cleaning (slugify, drop empty, PII scrub, share default)
  X  PII scrubbing in background_text
  E  validate_profile drop-hints
  G  merge_profile precedence / union edge cases

Run:  .venv/bin/python tests/test_profile_edge.py
"""

import os
import sys

from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv()

_results: list[tuple[str, bool]] = []


def check(name: str, passed: bool, detail: str = "") -> None:
    _results.append((name, passed))
    print(f"  [{'PASS' if passed else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


def _misc_codes(n: int = 2) -> list[str]:
    import posting
    posting._Vocab.load()
    return list(posting._Vocab.misc)[:n]


# ---------------------------------------------------------------------------
# R — robustness: malformed / missing inputs must clean to safe empties
# ---------------------------------------------------------------------------
def group_robust() -> None:
    print("\nR — robustness (malformed inputs don't crash)")
    import profile as pr

    e = pr.clean_profile({})
    check("R1 clean_profile({}) returns all expected keys",
          all(k in e for k in ("tags", "key_stages_or_info", "key_dates", "consulates",
                               "current_visa_or_greencard_category", "journey")))
    check("R2 empty input -> empty tags/stages/dates",
          e["tags"] == [] and e["key_stages_or_info"] == {} and e["key_dates"] == {})

    none_in = pr.clean_profile({"tags": None, "key_stages_or_info": None, "key_dates": None,
                                "consulates": None, "journey": None, "background_text": None})
    check("R3 None values coerced to empties (no crash)",
          none_in["tags"] == [] and none_in["key_stages_or_info"] == {} and
          none_in["key_dates"] == {} and none_in["journey"] == [] and none_in["background_text"] == "")

    wrong = pr.clean_profile({"tags": "not-a-list", "key_stages_or_info": ["not-a-dict"],
                              "key_dates": 42})
    check("R4 wrong-typed values coerced to empties",
          wrong["tags"] == [] and wrong["key_stages_or_info"] == {} and wrong["key_dates"] == {})


# ---------------------------------------------------------------------------
# W — whitespace trim, de-dup, case
# ---------------------------------------------------------------------------
def group_whitespace() -> None:
    print("\nW — whitespace / de-dup / case")
    import profile as pr
    m = _misc_codes(2)
    c = pr.clean_profile({
        "tags": [f"  {m[0]}  ", m[0], m[1]],                       # padded + duplicate
        "key_stages_or_info": {" outcome_status ": "  approved  "},  # padded key + value
    })
    check("W1 misc tag whitespace-trimmed + kept", m[0] in c["tags"], str(c["tags"]))
    check("W2 misc tag de-duplicated", c["tags"].count(m[0]) == 1)
    check("W3 both distinct misc tags kept", m[1] in c["tags"])
    check("W4 stage key+value whitespace-trimmed",
          c["key_stages_or_info"].get("outcome_status") == "approved", str(c["key_stages_or_info"]))
    # an out-of-vocab/case-wrong value is dropped (vocab is case-sensitive)
    bad = pr.clean_profile({"key_stages_or_info": {"outcome_status": "APPROVED"}})
    check("W5 wrong-case outcome value dropped (vocab is exact)", "outcome_status" not in bad["key_stages_or_info"])


# ---------------------------------------------------------------------------
# K — key_dates normalization
# ---------------------------------------------------------------------------
def group_dates() -> None:
    print("\nK — key_dates normalization")
    import profile as pr
    c = pr.clean_profile({"key_dates": {
        "j1_expire_date": "2026-10-01",     # ISO passthrough (the new key)
        "h1b_filed_date": "Oct 1 2026",     # natural language -> ISO
        "visa_interview_date": "not a date", # unparseable -> dropped
        "bogus_date": "2026-10-01",          # invalid 1.8 key -> dropped
    }})
    kd = c["key_dates"]
    check("K1 ISO date passthrough (j1_expire_date)", kd.get("j1_expire_date") == "2026-10-01", str(kd))
    check("K2 natural-language date normalized to ISO", kd.get("h1b_filed_date") == "2026-10-01")
    check("K3 unparseable date dropped", "visa_interview_date" not in kd)
    check("K4 invalid date key dropped", "bogus_date" not in kd)


# ---------------------------------------------------------------------------
# J — journey cleaning
# ---------------------------------------------------------------------------
def group_journey() -> None:
    print("\nJ — journey cleaning")
    import profile as pr
    c = pr.clean_profile({"journey": [
        {"milestone": "Visa Interview", "date": "2024-03-10", "experience": "Went smoothly."},
        {"milestone": "no_text", "date": "", "experience": "   "},   # empty experience -> dropped
        {"milestone": "", "experience": "has text but no milestone"},  # no milestone -> dropped
    ]})
    j = c["journey"]
    check("J1 valid journey entry kept", len(j) == 1, f"{len(j)} entries")
    check("J2 milestone slugified", j and j[0]["milestone"] == "visa_interview", str(j[:1]))
    check("J3 share defaults to True", j and j[0].get("shared") is True)
    check("J4 entries without experience text dropped", all(e["experience"].strip() for e in j))


# ---------------------------------------------------------------------------
# X — PII scrubbing in background_text
# ---------------------------------------------------------------------------
def group_pii() -> None:
    print("\nX — PII scrub in background_text")
    import profile as pr
    c = pr.clean_profile({"background_text": "Reach me at jane@example.com or 415-555-1234, A123456789."})
    bg = c["background_text"]
    check("X1 email scrubbed", "jane@example.com" not in bg, bg)
    check("X2 phone scrubbed", "415-555-1234" not in bg)
    check("X3 A-number scrubbed", "A123456789" not in bg)


# ---------------------------------------------------------------------------
# E — validate_profile drop-hints
# ---------------------------------------------------------------------------
def group_validate() -> None:
    print("\nE — validate_profile hints")
    import profile as pr
    errs = pr.validate_profile({
        "current_visa_or_greencard_category": ["H-1B", "BOGUS"],
        "tags": ["NOT-A-TAG"],
        "key_dates": {"h1b_filed_date": "nope"},
        "key_stages_or_info": {"citizen_of_country": "banana"},
    })
    blob = " | ".join(errs)
    check("E1 reports dropped visa", "BOGUS" in blob, blob)
    check("E2 reports dropped tag", "NOT-A-TAG" in blob)
    check("E3 reports invalid date", "h1b_filed_date" in blob)
    check("E4 reports invalid stage value", "citizen_of_country" in blob)


# ---------------------------------------------------------------------------
# G — merge_profile precedence / unions
# ---------------------------------------------------------------------------
def group_merge() -> None:
    print("\nG — merge_profile precedence")
    import profile as pr
    base = {"current_visa_or_greencard_category": ["H-1B"], "background_text": "base text",
            "consulates": ["BOM"], "primary_consulate": "BOM"}
    inc = {"current_visa_or_greencard_category": ["EB-2"], "background_text": "",
           "consulates": ["DEL"], "primary_consulate": ""}
    m = pr.merge_profile(base, inc)
    check("G1 visa lists unioned", set(m["current_visa_or_greencard_category"]) == {"H-1B", "EB-2"},
          str(m["current_visa_or_greencard_category"]))
    check("G2 consulates unioned", set(m["consulates"]) >= {"BOM", "DEL"})
    check("G3 empty incoming background does NOT clobber base", m["background_text"] == "base text")
    check("G4 primary_consulate preserved + inside consulates",
          m["primary_consulate"] == "BOM" and "BOM" in m["consulates"])


def main() -> int:
    print("Profile edge-case regression (deterministic; no network)")
    group_robust()
    group_whitespace()
    group_dates()
    group_journey()
    group_pii()
    group_validate()
    group_merge()
    print("\n" + "=" * 60)
    passed = sum(1 for _, ok in _results if ok)
    failed = [n for n, ok in _results if not ok]
    print(f"SUMMARY: {passed}/{len(_results)} checks passed")
    if failed:
        print("FAILED: " + "; ".join(failed))
        return 1
    print("All profile edge-case checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
