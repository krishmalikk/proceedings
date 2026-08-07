"""
test_attribute_config.py — the externalised Timeline attribute config.

Groups (all pure unless noted — no GCP calls; Firestore is stubbed):
  V  validate() accepts the shipped default and rejects every malformed shape
  F  fallback ladder: firestore -> last-good -> in-code default
  C  caching: TTL hit/miss, force refresh, and what a slow backend costs
  P  the posting.py views resolve from the live config, not from imports

The bias throughout is toward the NEGATIVE cases. A config loader that serves
the happy path is easy; the whole reason this one is worth testing is that a
bad document must degrade to "stale", never to "broken" — nobody should be
locked out of joining a group because someone fat-fingered a JSON edit.

Run:  ALLOW_USER_IMPERSONATION=1 .venv/bin/python tests/test_attribute_config.py
"""

import copy
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv  # noqa: E402

load_dotenv()

import attribute_config as ac  # noqa: E402
import posting  # noqa: E402

_results: list[tuple[str, bool]] = []


def check(name: str, passed: bool, detail: str = "") -> None:
    _results.append((name, passed))
    print(f"  [{'PASS' if passed else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


def default_spec() -> dict:
    return copy.deepcopy(posting.DEFAULT_ATTRIBUTE_SPEC)


class _StubFirestore:
    """Stands in for _read_firestore. `payload` may be a dict (the document),
    None (nothing published), or an Exception instance (transport failure)."""

    def __init__(self, payload):
        self.payload = payload
        self.reads = 0

    def __call__(self):
        self.reads += 1
        if isinstance(self.payload, Exception):
            raise self.payload
        return self.payload


def _install(payload):
    """Point the loader at a stub and clear the cache. Returns the stub so a
    test can count how many times Firestore was actually hit."""
    stub = _StubFirestore(payload)
    ac._read_firestore = stub
    ac._reset_for_tests()
    return stub


# ---------------------------------------------------------------------------
# V — validation
# ---------------------------------------------------------------------------
def group_validation() -> None:
    print("\nV — validate()")
    check("V1 the spec shipped in the code validates",
          ac.validate(default_spec()) == [], str(ac.validate(default_spec())[:2]))

    check("V2 a non-object spec is rejected", ac.validate([]) != [])
    check("V3 processing_types cannot be empty — that empties the first dropdown",
          any("processing_types" in e for e in ac.validate({**default_spec(), "processing_types": []})))

    def rejects(mutate, name, needle=""):
        spec = default_spec()
        mutate(spec)
        errs = ac.validate(spec)
        ok = bool(errs) and (not needle or any(needle in e for e in errs))
        check(name, ok, str(errs[:2]) if errs else "accepted!")

    # The two that fail SILENTLY at runtime if they get through: a key the
    # profile cleaners don't know, and a field that isn't a real profile map.
    rejects(lambda s: s["post_join_row_extras"]["stem-opt-extension"].append(
        {"kind": "date", "label": "Made Up", "field": "key_dates", "key": "not_a_vocab_key"}),
        "V4 a key outside the controlled vocabulary is rejected", "not_a_vocab_key")
    rejects(lambda s: s["post_join_row_extras"]["stem-opt-extension"].append(
        {"kind": "date", "label": "X", "field": "nowhere", "key": "rfe_date"}),
        "V5 a field that is not a profile map is rejected", "field")

    rejects(lambda s: s["post_join_row_extras"]["stem-opt-extension"].append(
        {"kind": "wormhole", "label": "X", "field": "key_dates", "key": "rfe_date"}),
        "V6 an unknown kind is rejected — the clients can only render four", "kind")
    rejects(lambda s: s["post_join_row_extras"]["stem-opt-extension"].append(
        {"kind": "select", "label": "X", "field": "key_stages_or_info", "key": "service_center"}),
        "V7 a select with no options is rejected — an unpickable dropdown", "options")
    rejects(lambda s: s["post_join_row_extras"]["stem-opt-extension"].append(
        {"kind": "date", "label": "X", "field": "key_dates", "key": "rfe_date", "options": ["a"]}),
        "V8 options on a non-select is rejected as a likely mistake", "options")
    rejects(lambda s: s["post_join_row_extras"]["stem-opt-extension"].append(
        {"kind": "date", "label": "", "field": "key_dates", "key": "rfe_date"}),
        "V9 a row with no label is rejected — it would render blank", "label")
    rejects(lambda s: s["post_join_row_extras"]["stem-opt-extension"].append(
        {"kind": "date", "label": "Dup", "field": "key_dates", "key": "ead_filed_date"}),
        "V10 a duplicate key in one list is rejected", "duplicate")

    # Side confusion: `required` is meaningless on a scope row, `name_prefix`
    # on a post-join row. Both silently do nothing, so both are caught here.
    rejects(lambda s: s["scope_row_extras"].update({"h4-ead": [
        {"kind": "date", "label": "X", "field": "key_dates", "key": "rfe_date", "required": True}]}),
        "V11 'required' on a SCOPE row is rejected — scope rows are never required", "required")
    rejects(lambda s: s["post_join_row_extras"]["stem-opt-extension"].append(
        {"kind": "date", "label": "X", "field": "key_dates", "key": "rfe_date", "name_prefix": "X"}),
        "V12 'name_prefix' on a POST-JOIN row is rejected — it names a group-name segment", "name_prefix")

    rejects(lambda s: s["processing_types"][0]["eligibility_categories"].append(
        {"code": "(x)", "label": "Bogus", "tag": "not-a-real-tag"}),
        "V13 a category tag outside the vocabulary is rejected", "not-a-real-tag")
    rejects(lambda s: s["processing_types"].append({"value": "EAD", "label": "dupe",
                                                    "eligibility_categories": []}),
        "V14 a duplicate processing type is rejected", "duplicate")
    rejects(lambda s: s.update({"period_rows": "nope"}),
            "V15 period_rows must be a list")

    # A valid ADDITION must still pass — validation that rejects everything is
    # just an outage with extra steps.
    spec = default_spec()
    spec["post_join_row_extras"]["h4-ead"] = [
        {"kind": "date", "label": "Receipt Date", "field": "key_dates",
         "key": "ead_card_received_date", "required": False}]
    check("V16 (positive) a legitimate new category template is accepted",
          ac.validate(spec) == [], str(ac.validate(spec)[:2]))


# ---------------------------------------------------------------------------
# F — the fallback ladder
# ---------------------------------------------------------------------------
def group_fallback() -> None:
    print("\nF — fallback: firestore -> last-good -> default")
    published = default_spec()
    published["version"] = 42

    _install(published)
    check("F1 a published document is served, and says so",
          ac.get().get("version") == 42 and ac.meta()["source"] == "firestore",
          ac.meta()["source"])

    _install(None)
    check("F2 nothing published falls back to the in-code default",
          ac.get()["processing_types"][0]["value"] == "EAD" and ac.meta()["source"] == "default",
          ac.meta()["source"])

    _install(RuntimeError("firestore unreachable"))
    check("F3 an unreachable Firestore on a cold process still serves the default",
          ac.get()["processing_types"][0]["value"] == "EAD" and ac.meta()["source"] == "default")
    check("F3b …and records why, so it isn't silent",
          "firestore unreachable" in ac.meta()["last_error"], ac.meta()["last_error"])

    # The important one: a WARM process must not lose a good config because
    # the next read failed.
    stub = _install(published)
    ac.get()
    stub.payload = RuntimeError("transient 503")
    ac.refresh(force=True)
    check("F4 a read failure keeps serving the LAST-GOOD config, not the default",
          ac.get().get("version") == 42 and ac.meta()["source"] == "last-good",
          f"{ac.meta()['source']} v{ac.get().get('version')}")

    # Equally important: a published-but-invalid document must not be served.
    stub = _install(published)
    ac.get()
    bad = default_spec()
    bad["version"] = 43
    bad["post_join_row_extras"]["stem-opt-extension"] = [
        {"kind": "date", "label": "X", "field": "key_dates", "key": "not_a_vocab_key"}]
    stub.payload = bad
    ac.refresh(force=True)
    check("F5 an INVALID published config is rejected and last-good is kept",
          ac.get().get("version") == 42 and ac.meta()["source"] == "last-good",
          f"{ac.meta()['source']} v{ac.get().get('version')}")
    check("F5b …and the validation problem is reported in the metadata",
          "not_a_vocab_key" in ac.meta()["last_error"], ac.meta()["last_error"])

    # Invalid on a COLD process — nothing good to fall back to.
    _install(bad)
    check("F6 an invalid config on a cold process falls back to the default",
          ac.meta()["source"] == "default" and ac.get()["processing_types"][0]["value"] == "EAD",
          ac.meta()["source"])

    _install({})
    check("F7 an empty document is treated as 'nothing published', not as an empty config",
          ac.meta()["source"] == "default")


# ---------------------------------------------------------------------------
# C — caching
# ---------------------------------------------------------------------------
def group_caching() -> None:
    print("\nC — caching")
    spec = default_spec()

    os.environ["ATTR_CONFIG_TTL_SECONDS"] = "60"
    stub = _install(spec)
    for _ in range(50):
        ac.get()
    check("C1 fifty reads inside the TTL hit Firestore exactly once",
          stub.reads == 1, f"{stub.reads} reads")

    ac.refresh(force=True)
    check("C2 force=True re-reads even though the TTL is nowhere near expiry",
          stub.reads == 2, f"{stub.reads} reads")

    os.environ["ATTR_CONFIG_TTL_SECONDS"] = "0.2"
    stub = _install(spec)
    ac.get()
    time.sleep(0.25)
    ac.get()
    check("C3 a read after the TTL expires goes back to Firestore",
          stub.reads == 2, f"{stub.reads} reads")

    # A dead backend must not turn into a read storm — the failure path
    # re-stamps the cache so the next call waits out a full TTL.
    os.environ["ATTR_CONFIG_TTL_SECONDS"] = "60"
    stub = _install(RuntimeError("down"))
    for _ in range(20):
        ac.get()
    check("C4 a failing backend is retried once per TTL, not on every request",
          stub.reads == 1, f"{stub.reads} reads")

    os.environ["ATTR_CONFIG_TTL_SECONDS"] = "0"
    stub = _install(spec)
    ac.get(); ac.get()
    check("C5 TTL=0 disables caching entirely (an escape hatch for debugging)",
          stub.reads == 2, f"{stub.reads} reads")
    os.environ["ATTR_CONFIG_TTL_SECONDS"] = "60"

    os.environ["ATTR_CONFIG_TTL_SECONDS"] = "not-a-number"
    check("C6 a garbled TTL env var falls back to the default rather than crashing",
          ac._ttl_seconds() == 60.0, str(ac._ttl_seconds()))
    os.environ["ATTR_CONFIG_TTL_SECONDS"] = "60"


# ---------------------------------------------------------------------------
# P — posting.py resolves from the live config
# ---------------------------------------------------------------------------
def group_posting_views() -> None:
    print("\nP — posting.py views follow the config")
    _install(default_spec())

    check("P1 the tag-keyed registries match the shipped default",
          "stem-opt-extension" in posting.POST_JOIN_ATTRIBUTE_TEMPLATES
          and "adjustment-of-status" in posting.POST_JOIN_ATTRIBUTE_TEMPLATES,
          str(sorted(posting.POST_JOIN_ATTRIBUTE_TEMPLATES)))
    check("P2 the views behave as plain dicts for existing call sites",
          posting.TAG_ATTRIBUTE_TEMPLATES.get("nope", "sentinel") == "sentinel"
          and len(posting.TAG_ATTRIBUTE_TEMPLATES) > 0
          and isinstance(dict(posting.TAG_ATTRIBUTE_TEMPLATES), dict))
    check("P3 PROCESSING_TYPES indexes and iterates like a list",
          posting.PROCESSING_TYPES[0]["value"] == "EAD"
          and [t["value"] for t in posting.PROCESSING_TYPES] == ["EAD", "H-1B"])

    # The whole point: publish a change, see it WITHOUT reimporting anything.
    spec = default_spec()
    spec["post_join_row_extras"]["h4-ead"] = [
        {"kind": "date", "label": "Card Received", "field": "key_dates", "key": "ead_card_received_date"}]
    _install(spec)
    check("P4 a config edit adds a join field with no restart and no reimport",
          [r["key"] for r in posting.POST_JOIN_ATTRIBUTE_TEMPLATES["h4-ead"]] == ["ead_card_received_date"],
          str(posting.POST_JOIN_ATTRIBUTE_TEMPLATES.get("h4-ead")))
    check("P5 …and it reaches the dropdown option the client reads",
          any(c["tag"] == "h4-ead" and [r["key"] for r in c["post_join_rows"]] == ["ead_card_received_date"]
              for c in posting.EAD_ELIGIBILITY_CATEGORIES))
    check("P6 …and the /api/tag-vocab payload, which is what both apps fetch",
          "h4-ead" in posting.vocab_lists()["post_join_attribute_templates"])
    check("P7 …and the row is validated on submit, so config and 422s agree",
          __import__("matching")._validate_attribute_values(
              "h4-ead", {"ead_card_received_date": "2026-08-20"}) == {"ead_card_received_date": "2026-08-20"})

    _install(default_spec())
    check("P8 reverting the config removes the field again — no deploy either way",
          "h4-ead" not in posting.POST_JOIN_ATTRIBUTE_TEMPLATES)

    # A new processing type is config too, not just new rows on an old one.
    spec = default_spec()
    spec["processing_types"].append(
        {"value": "TPS", "label": "TPS", "eligibility_categories": []})
    _install(spec)
    check("P9 a whole new processing type appears from config alone",
          [t["value"] for t in posting.PROCESSING_TYPES] == ["EAD", "H-1B", "TPS"],
          str([t["value"] for t in posting.PROCESSING_TYPES]))
    check("P10 …and it gets the base period rows without configuring them",
          [r["key"] for r in posting.TAG_ATTRIBUTE_TEMPLATES["TPS"]]
          == ["filing_month", "filing_year"])
    _install(default_spec())


def main() -> int:
    real_read = ac._read_firestore
    try:
        group_validation()
        group_fallback()
        group_caching()
        group_posting_views()
    finally:
        ac._read_firestore = real_read
        ac._reset_for_tests()

    passed = sum(1 for _, ok in _results if ok)
    print("\n" + "=" * 60)
    print(f"SUMMARY: {passed}/{len(_results)} checks passed")
    failed = [n for n, ok in _results if not ok]
    if failed:
        print("FAILED: " + "; ".join(failed))
        return 1
    print("All attribute-config checks passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
