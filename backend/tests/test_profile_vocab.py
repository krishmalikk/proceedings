"""
test_profile_vocab.py — regression tests for the profile vocabulary changes on the
`change-profile-enhancements` branch. All deterministic (no network / GCP calls —
only the controlled-vocab CSVs are read).

Covers:
  T  profile `tags` = miscellaneous (1.3 abbreviations + 1.10 topics) ONLY
  S  key_stages_or_info value-domains: forms(1.5)->outcome(1.9), country, etc.; 1.6 excluded
  D  stage_value_domain / stage_value_ok helpers + 'filed' is a valid outcome
  V  /api/tag-vocab payload exposes misc / misc_options / profile_stage_key / domains
  P  onboarding prompts RENDER (guards the f-string `{{form: outcome}}` escaping bug)
  M  merge_profile unions the tags list

Run:  .venv/bin/python tests/test_profile_vocab.py
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


# ---------------------------------------------------------------------------
# T — profile.tags is "miscellaneous tags & topics" (1.3 + 1.10) ONLY
# ---------------------------------------------------------------------------
def group_tags() -> None:
    print("\nT — profile tags = miscellaneous (1.3 + 1.10) only")
    import posting
    import profile as pr
    posting._Vocab.load()
    misc_code = next(iter(posting._Vocab.misc))  # a real 1.3/1.10 code
    c = pr.clean_profile({"tags": [misc_code, "I-485", "approved", "h1b-petition", "NOT-A-TAG"]})
    check("T1 valid miscellaneous tag kept", misc_code in c["tags"], str(c["tags"]))
    check("T2 form (1.5 'I-485') dropped from tags", "I-485" not in c["tags"])
    check("T3 outcome (1.9 'approved') dropped from tags", "approved" not in c["tags"])
    check("T4 visa-form-action (1.6 'h1b-petition') dropped from tags", "h1b-petition" not in c["tags"])
    check("T5 garbage dropped from tags", "NOT-A-TAG" not in c["tags"])


# ---------------------------------------------------------------------------
# S — key_stages_or_info value-domains (forms->outcome, country, 1.6 excluded)
# ---------------------------------------------------------------------------
def group_stages() -> None:
    print("\nS — key_stages value-domains")
    import profile as pr
    c = pr.clean_profile({"key_stages_or_info": {
        "I-485": "filed",            # form key -> outcome value ('filed' is valid)
        "I-130": "approved",         # form key -> outcome value
        "I-129": "banana",           # form key -> invalid outcome -> dropped
        "citizen_of_country": "IN",  # country domain
        "born_in_country": "ZZ",     # invalid country -> dropped
        "outcome_status": "RFE",     # outcome domain
        "h1b-petition": "x",         # 1.6 key -> not a profile stage key -> dropped
    }})
    ks = c["key_stages_or_info"]
    check("S1 form key + valid outcome 'filed' kept", ks.get("I-485") == "filed", str(ks))
    check("S2 form key + valid outcome 'approved' kept", ks.get("I-130") == "approved")
    check("S3 form key + invalid value dropped", "I-129" not in ks)
    check("S4 country stage valid kept", ks.get("citizen_of_country") == "IN")
    check("S5 country stage invalid dropped", "born_in_country" not in ks)
    check("S6 outcome_status valid outcome kept", ks.get("outcome_status") == "RFE")
    check("S7 1.6 action key dropped from profile stages", "h1b-petition" not in ks)


# ---------------------------------------------------------------------------
# D — domain helpers + 'filed' outcome + profile stage-key set
# ---------------------------------------------------------------------------
def group_domains() -> None:
    print("\nD — stage_value_domain / stage_value_ok / 'filed'")
    import posting
    posting._Vocab.load()
    check("D1 form key domain == outcome", posting.stage_value_domain("I-485") == "outcome")
    check("D2 citizen_of_country domain == country", posting.stage_value_domain("citizen_of_country") == "country")
    check("D3 unconstrained stage key domain is None", posting.stage_value_domain("visa_status") is None,
          str(posting.stage_value_domain("visa_status")))
    check("D4 'filed' is a valid 1.9 outcome", "filed" in posting._Vocab.outcomes)
    check("D5 stage_value_ok(form, 'filed') True", posting.stage_value_ok("I-485", "filed"))
    check("D6 stage_value_ok(form, 'banana') False", not posting.stage_value_ok("I-485", "banana"))
    check("D7 1.6 action NOT in profile_stage_keys", "h1b-petition" not in posting._Vocab.profile_stage_keys)
    check("D8 form IS in profile_stage_keys", "I-485" in posting._Vocab.profile_stage_keys)


# ---------------------------------------------------------------------------
# V — /api/tag-vocab payload shape (drives the profile UI dropdowns)
# ---------------------------------------------------------------------------
def group_vocab_api() -> None:
    print("\nV — vocab_lists() payload")
    import posting
    v = posting.vocab_lists()
    for key in ("misc", "misc_options", "profile_stage_key", "outcome", "country", "stage_value_domains"):
        check(f"V:{key} present + non-empty", bool(v.get(key)), str(type(v.get(key))))
    check("V misc_options carry code+label", all("code" in o and "label" in o for o in v["misc_options"][:5]))
    check("V misc_option label shows the description ('CODE — meaning')",
          any(" — " in o["label"] for o in v["misc_options"][:30]))
    check("V stage_value_domains maps a form -> outcome", v["stage_value_domains"].get("I-485") == "outcome")
    check("V profile_stage_key excludes 1.6", "h1b-petition" not in set(v["profile_stage_key"]))
    check("V 'filed' present in outcome list", "filed" in v["outcome"])
    check("V J-1 expiry date key present (j1_expire_date)", "j1_expire_date" in v["date_key"])


# ---------------------------------------------------------------------------
# P — onboarding prompts must RENDER (regression for the f-string escaping bug)
# ---------------------------------------------------------------------------
def group_prompts() -> None:
    print("\nP — onboarding prompts render")
    import profile as pr
    b = pr._basics_system_prompt({
        "current_visa_or_greencard_category": ["H-1B"],
        "key_dates": {"i140_filed_date": "2026-02-15"},
    })
    check("P1 basics prompt renders to a string", isinstance(b, str) and len(b) > 500, f"len={len(b) if isinstance(b, str) else 'n/a'}")
    check("P2 basics prompt has LITERAL '{form: outcome}' (braces escaped, not evaluated)", "{form: outcome}" in b)
    check("P3 basics prompt carries the no-re-ask instruction", "re-ask" in b.lower())
    check("P5 basics prompt has the date-key↔visa guardrail", "j1_expire_date" in b and "f1_expire_date" in b)
    e = pr._experiences_system_prompt({"current_visa_or_greencard_category": ["H-1B"], "journey": []})
    check("P4 experiences prompt renders to a string", isinstance(e, str) and len(e) > 200)


# ---------------------------------------------------------------------------
# M — merge_profile unions the tags list
# ---------------------------------------------------------------------------
def group_merge() -> None:
    print("\nM — merge_profile unions tags")
    import posting
    import profile as pr
    posting._Vocab.load()
    codes = list(posting._Vocab.misc)
    m1, m2 = codes[0], codes[1] if len(codes) > 1 else codes[0]
    merged = pr.merge_profile({"tags": [m1]}, {"tags": [m2]})
    check("M1 tags are unioned on merge", m1 in merged["tags"] and m2 in merged["tags"], str(merged["tags"]))


def main() -> int:
    print("Profile vocab regression (deterministic; no network)")
    group_tags()
    group_stages()
    group_domains()
    group_vocab_api()
    group_prompts()
    group_merge()
    print("\n" + "=" * 60)
    passed = sum(1 for _, ok in _results if ok)
    failed = [n for n, ok in _results if not ok]
    print(f"SUMMARY: {passed}/{len(_results)} checks passed")
    if failed:
        print("FAILED: " + "; ".join(failed))
        return 1
    print("All profile-vocab regression checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
