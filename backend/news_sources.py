"""
news_sources.py — config-driven registry of government/law-firm news sources.

See docs/ingestion/GOV-NEWS-INGESTION-PLAN.md §4 for the full design. Adding
a **vetted** new source with a clean RSS feed is a new entry here, no other
code change (`scripts/curation/poll_gov_news.py` iterates this registry).
`fetch_method` is the honest limit of that promise — only "rss" has an
adapter today; a source needing a different fetch shape (JSON API, scraping)
needs new adapter code, not just a config entry.

`content_license` is the one field that must never be assumed — see §4.2.
`public_domain` (federal government works, 17 U.S.C. § 105) is verified for
USCIS specifically in §1/§2 of the plan doc; any future entry, especially a
non-federal or law-firm source, needs its own robots.txt/ToS/copyright check
before being added, and a `copyrighted` source needs the Reddit-style
paraphrase posture (D-017), not verbatim storage like USCIS gets.
"""

from __future__ import annotations

NEWS_SOURCES: dict[str, dict] = {
    "uscis": {
        "display_name": "USCIS",
        "site_url": "https://www.uscis.gov",
        "fetch_method": "rss",
        "feed_url": "https://www.uscis.gov/news/rss-feed/59144",
        "source_category": "government",
        "content_license": "public_domain",
        "channel": "gov_news",
    },
}
