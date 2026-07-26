"""
test_news_sources.py — the Firestore-backed multi-source news registry.
See docs/ingestion/GOV-NEWS-MULTI-SOURCE-CONFIG.md for the design.

All checks here are LIVE (real Firestore, ADC) — the registry has no
in-memory mode, by design (get_enabled_sources() must always reflect
Firestore's actual current state, never a cache). Uses clearly-marked
test-* slugs and cleans up after itself.

Run:  .venv/bin/python tests/test_news_sources.py
"""

import os
import sys

from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv()

_results: list[tuple[str, bool, str]] = []


def check(name: str, passed: bool, detail: str = "") -> None:
    _results.append((name, passed, bool(detail)))
    print(f"  [{'PASS' if passed else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


_TEST_SLUG_OK = "test-source-public-domain"
_TEST_SLUG_BAD_LICENSE = "test-source-copyrighted"
_TEST_SLUG_DISABLED = "test-source-disabled"
_TEST_SLUG_INCOMPLETE = "test-source-incomplete"
_ALL_TEST_SLUGS = [_TEST_SLUG_OK, _TEST_SLUG_BAD_LICENSE, _TEST_SLUG_DISABLED, _TEST_SLUG_INCOMPLETE]


def _cleanup(ns) -> None:
    for slug in _ALL_TEST_SLUGS:
        ns.remove_source(slug)


def group_a_registry() -> None:
    print("\nA — Firestore-backed registry (live)")
    import news_sources as ns

    _cleanup(ns)  # in case a prior run left something behind

    ns.upsert_source(
        _TEST_SLUG_OK, display_name="Test Source", site_url="https://example.gov",
        feed_url="https://example.gov/rss.xml", fetch_method="rss",
        source_category="government", content_license="public_domain",
        channel="gov_news", enabled=True,
    )
    check("A1 upsert_source then get_source round-trips all fields",
          ns.get_source(_TEST_SLUG_OK) is not None and
          ns.get_source(_TEST_SLUG_OK).get("display_name") == "Test Source")
    check("A2 created_at/updated_at stamped automatically",
          bool(ns.get_source(_TEST_SLUG_OK).get("created_at")) and
          bool(ns.get_source(_TEST_SLUG_OK).get("updated_at")))
    check("A3 enabled public_domain source appears in get_enabled_sources()",
          _TEST_SLUG_OK in ns.get_enabled_sources())

    # A4-A5: the content_license safety gate — a copyrighted source is
    # stored (visible in list_all_sources()) but must NEVER be auto-polled.
    ns.upsert_source(
        _TEST_SLUG_BAD_LICENSE, display_name="Test Copyrighted Source",
        site_url="https://example-firm.com", feed_url="https://example-firm.com/rss.xml",
        fetch_method="rss", source_category="law_firm", content_license="copyrighted",
        channel="law_firm_news", enabled=True,
    )
    check("A4 copyrighted source IS stored (visible in list_all_sources())",
          _TEST_SLUG_BAD_LICENSE in ns.list_all_sources())
    check("A5 copyrighted source is EXCLUDED from get_enabled_sources() despite enabled=True",
          _TEST_SLUG_BAD_LICENSE not in ns.get_enabled_sources())

    # A6: disabled source excluded
    ns.upsert_source(
        _TEST_SLUG_DISABLED, display_name="Test Disabled Source",
        site_url="https://example.gov", feed_url="https://example.gov/rss.xml",
        fetch_method="rss", source_category="government", content_license="public_domain",
        channel="gov_news", enabled=False,
    )
    check("A6 disabled source excluded from get_enabled_sources()",
          _TEST_SLUG_DISABLED not in ns.get_enabled_sources())

    check("A7 set_enabled(True) re-includes a disabled source",
          _TEST_SLUG_DISABLED not in ns.get_enabled_sources())  # sanity: still excluded before
    ns.set_enabled(_TEST_SLUG_DISABLED, True)
    check("A7b set_enabled(True) re-included after the flip",
          _TEST_SLUG_DISABLED in ns.get_enabled_sources())

    # A8: missing required field excluded
    ns.upsert_source(
        _TEST_SLUG_INCOMPLETE, display_name="Test Incomplete Source",
        content_license="public_domain",  # missing feed_url, source_category, etc.
    )
    check("A8 source missing required fields excluded from get_enabled_sources()",
          _TEST_SLUG_INCOMPLETE not in ns.get_enabled_sources())

    # A9: remove_source
    check("A9 remove_source returns True for an existing slug", ns.remove_source(_TEST_SLUG_OK))
    check("A10 removed source no longer returned by get_source()", ns.get_source(_TEST_SLUG_OK) is None)
    check("A11 remove_source returns False for an already-gone slug", ns.remove_source(_TEST_SLUG_OK) is False)

    _cleanup(ns)


def group_b_poll_integration() -> None:
    print("\nB — gov_news_poll.py against the live registry (live)")
    import news_sources as ns
    from gov_news_poll import poll_all

    _cleanup(ns)
    ns.upsert_source(
        _TEST_SLUG_BAD_LICENSE, display_name="Test Copyrighted Source",
        site_url="https://example-firm.com", feed_url="https://example-firm.com/rss.xml",
        fetch_method="rss", source_category="law_firm", content_license="copyrighted",
        channel="law_firm_news", enabled=True,
    )
    results = poll_all(source_slug=_TEST_SLUG_BAD_LICENSE, dry_run=True)
    check("B1 polling a copyrighted-license source by slug reports skipped, not silently ignored",
          len(results) == 1 and results[0].get("skipped") is True, str(results))

    results_unknown = poll_all(source_slug="test-source-does-not-exist", dry_run=True)
    check("B2 polling an unknown slug reports skipped, doesn't crash",
          len(results_unknown) == 1 and results_unknown[0].get("skipped") is True, str(results_unknown))

    _cleanup(ns)


def main() -> int:
    group_a_registry()
    group_b_poll_integration()

    print("\n" + "=" * 60)
    passed = sum(1 for _, ok, _ in _results if ok)
    failed = [n for n, ok, _ in _results if not ok]
    print(f"SUMMARY: {passed}/{len(_results)} checks passed")
    if failed:
        print("FAILED: " + "; ".join(failed))
        return 1
    print("All news_sources checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
