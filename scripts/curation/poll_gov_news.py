#!/usr/bin/env python3
"""
poll_gov_news.py — poll government-agency RSS feeds and publish new/edited
items. See docs/ingestion/GOV-NEWS-INGESTION-PLAN.md for the full design.

For each source in backend/news_sources.py with fetch_method="rss":
  1. Query BigQuery for every already-known source_item_id + content_hash
     for that source (latest row per id, in case a same-day-edit duplicate
     is briefly present — see GOV-NEWS-INGESTION-PLAN.md §5.3).
  2. Fetch + parse the RSS feed.
  3. Classify each item as new / unchanged / edited against the map above.
  4. Publish new/edited items via posting.publish_gov_news_item(). A single
     item's failure is logged and skipped, not fatal to the run — its
     source_item_id will simply still look "new" (or "edited") on the next
     scheduled run and retry itself, since case_id is deterministic.

Intended to run once/day via Cloud Scheduler (§5.1's decided cadence), but
safe to run manually/repeatedly any time — every step is idempotent.

Usage:
  cd backend && ../.venv/bin/python ../scripts/curation/poll_gov_news.py [--source uscis] [--dry-run]
"""

from __future__ import annotations

import argparse
import os
import sys
from email.utils import parsedate_to_datetime
from xml.etree import ElementTree

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "backend"))
load_dotenv()

import posting  # noqa: E402
from news_sources import NEWS_SOURCES  # noqa: E402

GCP_PROJECT = os.getenv("GCP_PROJECT_ID") or os.getenv("GCP_PROJECT", "")

# Below this length (words), the RSS description is treated as too thin to
# tag well and the full article page is fetched as a fallback — decided in
# GOV-NEWS-INGESTION-PLAN.md §3.5. Kept small/simple deliberately: this is a
# rare-case fallback, not the common path (RSS descriptions have been full
# paragraphs for every real item checked while designing this).
_THIN_DESCRIPTION_WORDS = 40

# Selector for the article body on a USCIS newsroom page (Drupal). Falls back
# to `main article` (noisier — includes title/date) if the primary selector
# isn't found, since page templates can differ across alerts/news-releases/
# fact-sheets.
_ARTICLE_BODY_SELECTORS = ["article .field--name-body", "main article"]


def _fetch_full_article_text(url: str) -> str:
    """Best-effort fallback fetch for a thin RSS description. Returns "" on
    any failure — the caller falls back to the (thin) RSS description rather
    than blocking the whole item on this."""
    try:
        r = requests.get(url, timeout=15)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "html.parser")
        for sel in _ARTICLE_BODY_SELECTORS:
            el = soup.select_one(sel)
            if el:
                return el.get_text(separator=" ", strip=True)
    except Exception as e:  # noqa: BLE001 - best-effort fallback only
        print(f"  WARNING: full-article fetch failed for {url}: {type(e).__name__}: {e}")
    return ""


def _parse_feed(feed_url: str) -> list[dict]:
    r = requests.get(feed_url, timeout=30)
    r.raise_for_status()
    root = ElementTree.fromstring(r.text)
    items = []
    for el in root.findall(".//item"):
        title = (el.findtext("title") or "").strip()
        link = (el.findtext("link") or "").strip()
        description = (el.findtext("description") or "").strip()
        pub_date_raw = (el.findtext("pubDate") or "").strip()
        guid = (el.findtext("guid") or "").strip()
        if not (title and link and guid):
            continue  # malformed item — skip rather than crash the whole run
        try:
            posting_date = parsedate_to_datetime(pub_date_raw).strftime("%Y-%m-%d")
        except Exception:  # noqa: BLE001 - fall back to today rather than fail the item
            posting_date = ""
        items.append({
            "title": title, "link": link, "description": description,
            "posting_date": posting_date, "guid": guid,
        })
    return items


def _existing_hashes(source_slug: str) -> dict[str, str]:
    """{source_item_id: content_hash} for the latest row per id — a same-day
    edit can briefly leave a stale duplicate row (§5.3), so this always
    picks the most recent by ingestion_timestamp, never an arbitrary one."""
    try:
        from google.cloud import bigquery
        from google.api_core.exceptions import NotFound
    except ImportError:
        return {}
    client = bigquery.Client(project=GCP_PROJECT)
    table_id = f"{GCP_PROJECT}.postings.postings_metadata"
    sql = (
        f"SELECT source_item_id, content_hash FROM `{table_id}` "
        f"WHERE source_system = @source_system AND source_item_id != '' "
        f"QUALIFY ROW_NUMBER() OVER ("
        f"  PARTITION BY source_item_id ORDER BY ingestion_timestamp DESC"
        f") = 1"
    )
    cfg = bigquery.QueryJobConfig(query_parameters=[
        bigquery.ScalarQueryParameter("source_system", "STRING", source_slug)])
    try:
        return {row["source_item_id"]: row["content_hash"] for row in client.query(sql, job_config=cfg).result()}
    except NotFound:
        return {}  # table doesn't exist yet — first-ever run, everything is new
    except Exception as e:  # noqa: BLE001 - treat as "nothing known yet" rather than crash the run
        print(f"  WARNING: could not load existing hashes ({type(e).__name__}: {e}); treating all items as new")
        return {}


def poll_source(source_slug: str, dry_run: bool = False) -> None:
    source = NEWS_SOURCES[source_slug]
    if source["fetch_method"] != "rss":
        print(f"{source_slug}: fetch_method={source['fetch_method']!r} has no adapter yet — skipping")
        return

    print(f"\n=== {source_slug} ({source['display_name']}) ===")
    known = _existing_hashes(source_slug)
    items = _parse_feed(source["feed_url"])
    print(f"{len(items)} items in feed, {len(known)} already known")

    counts = {"new": 0, "edited": 0, "unchanged": 0, "failed": 0}
    for item in items:
        content_hash = posting.content_hash_for(item["title"], item["description"])
        prior_hash = known.get(item["guid"])
        if prior_hash == content_hash:
            counts["unchanged"] += 1
            continue
        is_edit = prior_hash is not None
        counts["edited" if is_edit else "new"] += 1

        description = item["description"]
        if len(description.split()) < _THIN_DESCRIPTION_WORDS:
            fuller = _fetch_full_article_text(item["link"])
            if fuller:
                description = fuller

        label = "EDIT" if is_edit else "NEW"
        print(f"  [{label}] {item['title']}")
        if dry_run:
            continue
        try:
            result = posting.publish_gov_news_item(
                title=item["title"], description=description,
                source_system=source_slug, author_handle=source["display_name"],
                source_item_id=item["guid"], full_url=item["link"],
                posting_date=item["posting_date"] or "", channel=source["channel"],
                is_edit=is_edit,
            )
            print(f"    -> {result['case_id']}")
        except Exception as e:  # noqa: BLE001 - one bad item must not abort the whole run
            counts["failed"] += 1
            print(f"    FAILED: {type(e).__name__}: {e}")

    print(f"{source_slug}: new={counts['new']} edited={counts['edited']} "
          f"unchanged={counts['unchanged']} failed={counts['failed']}")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--source", choices=list(NEWS_SOURCES), help="poll only this source (default: all)")
    ap.add_argument("--dry-run", action="store_true", help="classify and print, but don't publish")
    args = ap.parse_args()

    slugs = [args.source] if args.source else list(NEWS_SOURCES)
    for slug in slugs:
        poll_source(slug, dry_run=args.dry_run)
    return 0


if __name__ == "__main__":
    sys.exit(main())
