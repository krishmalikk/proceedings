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

    # T6-T7 — regression coverage for the adjustment-of-status-AOS retirement
    # (features/timeline-notifications-3/timeline-notifications-485.md), scoped
    # to profile.tags' actual domain (1.3 abbreviations + 1.10 topics only —
    # per T4 above, 1.6 action tags like ead-filing/i765-filing were NEVER
    # valid here regardless of the retirement, so they're not re-tested in
    # this file; that coverage lives in test_posting_tagging.py's E78/E79,
    # which exercise build_canonical()'s tags-field cleaning instead).
    c2 = pr.clean_profile({"tags": ["EAD", "AOS", "adjustment-of-status-AOS"]})
    check("T6 (positive) 'EAD' abbreviation still valid, kept (unaffected sanity check)",
          "EAD" in c2["tags"], str(c2["tags"]))
    check("T7 (positive) 'AOS' abbreviation still valid, kept", "AOS" in c2["tags"], str(c2["tags"]))
    check("T8 (negative) retired 'adjustment-of-status-AOS' (1.10) dropped as OOV",
          "adjustment-of-status-AOS" not in c2["tags"], str(c2["tags"]))

    # T9-T10 — regression coverage for the COE retirement
    # (features/timeline-notifications-3/timeline-notifications-coe.md) — the
    # OPPOSITE direction from AOS: here the 1.3 abbreviation was retired and
    # the 1.10 compound tag survives, since live evidence showed the model
    # never selected bare 'COE' even when the query text used the literal
    # acronym.
    c3 = pr.clean_profile({"tags": ["change-of-employer-COE", "COE"]})
    check("T9 (positive) 'change-of-employer-COE' (1.10) still valid, kept",
          "change-of-employer-COE" in c3["tags"], str(c3["tags"]))
    check("T10 (negative) retired 'COE' (1.3) dropped as OOV",
          "COE" not in c3["tags"], str(c3["tags"]))


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

    # D9-D10 — i765_filed_date -> ead_filed_date rename
    # (features/timeline-notifications-3/timeline-notifications-ead.md §3/§6)
    check("D9 (positive) 'ead_filed_date' is a valid 1.8 key_dates key",
          "ead_filed_date" in posting._Vocab.date_keys)
    check("D10 (negative) retired 'i765_filed_date' is no longer a valid key_dates key",
          "i765_filed_date" not in posting._Vocab.date_keys)

    # D11-D12 — profile-side clean_profile() key_dates cleaning honors the rename
    # (mirrors T6-T9's tags-side coverage, but for the key_dates field).
    import profile as pr
    cd = pr.clean_profile({"key_dates": {"ead_filed_date": "2026-03-01",
                                          "i765_filed_date": "2026-03-01"}})
    check("D11 (positive) clean_profile keeps 'ead_filed_date'",
          cd["key_dates"].get("ead_filed_date") == "2026-03-01", str(cd["key_dates"]))
    check("D12 (negative) clean_profile drops retired 'i765_filed_date' as OOV",
          "i765_filed_date" not in cd["key_dates"], str(cd["key_dates"]))


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
    # consulate_tree: grouped country -> cities for the two-part picker
    tree = v.get("consulate_tree") or []
    check("V consulate_tree present + non-empty", bool(tree), str(len(tree)))
    tree_by_country = {c["country"]: c for c in tree}
    india = tree_by_country.get("India")
    check("V consulate_tree India has country_code IN", bool(india) and india["country_code"] == "IN")
    check("V consulate_tree India cities include Mumbai/BOM",
          bool(india) and any(x["code"] == "BOM" and x["city"] == "Mumbai" for x in india["cities"]))
    check("V consulate_tree comma-country grouped correctly (Congo, Dem. Rep. of -> CD)",
          tree_by_country.get("Congo, Dem. Rep. of", {}).get("country_code") == "CD")
    check("V consulate_tree every city-bearing country has a country_code",
          all(c["country_code"] for c in tree if c["cities"]))
    check("V consulate_tree country codes are valid consulate values",
          all(c["country_code"] in posting._Vocab.consulate for c in tree if c["country_code"]))


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
