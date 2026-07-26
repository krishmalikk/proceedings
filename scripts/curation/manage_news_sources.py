#!/usr/bin/env python3
"""
manage_news_sources.py — add/list/enable/disable/remove government-news
sources in the Firestore-backed registry (backend/news_sources.py). See
docs/ingestion/GOV-NEWS-MULTI-SOURCE-CONFIG.md for the full design.

This is the ONLY thing that needs to happen to add a new source to the
pipeline — no code change, no deploy. The next scheduled (or manual) poll
run reads the registry fresh and picks it up automatically.

`--content-license` and `--source-category` are deliberately REQUIRED, no
default: this is the safety gate from GOV-NEWS-INGESTION-PLAN.md §4.2.
`public_domain` is the only license this pipeline actually processes
unattended today (see news_sources.get_enabled_sources()) — a
`copyrighted` source is stored but NEVER polled until the paraphrase/review
posture that license needs is actually built. Requiring the flag forces a
conscious choice every time, rather than defaulting to "safe" and letting
someone add a non-federal or law-firm source without thinking about it.

Usage:
  # Add a new federal-government RSS source (the only fully-supported shape today)
  manage_news_sources.py add dol \
    --display-name "Department of Labor" \
    --site-url https://www.dol.gov \
    --feed-url https://www.dol.gov/some/rss/feed.xml \
    --content-license public_domain --source-category government

  manage_news_sources.py list
  manage_news_sources.py show uscis
  manage_news_sources.py disable uscis   # stop polling without deleting config
  manage_news_sources.py enable uscis
  manage_news_sources.py remove uscis --confirm
"""

from __future__ import annotations

import argparse
import os
import sys

from dotenv import load_dotenv

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "backend"))
load_dotenv()

import news_sources as ns  # noqa: E402

_CONTENT_LICENSES = {"public_domain", "copyrighted"}
_SOURCE_CATEGORIES = {"government", "law_firm"}
_FETCH_METHODS = {"rss"}  # the honest limit — only RSS has an adapter today


def cmd_add(args: argparse.Namespace) -> int:
    if ns.get_source(args.slug):
        print(f"'{args.slug}' already exists — use a different slug, or edit it with "
              f"add again (upsert), or remove it first.", file=sys.stderr)
        return 1
    if args.fetch_method not in _FETCH_METHODS:
        print(f"WARNING: fetch_method={args.fetch_method!r} has no adapter yet in "
              f"gov_news_poll.py — this source will be stored but silently skipped by "
              f"every poll run until adapter code is added.", file=sys.stderr)
    ns.upsert_source(
        args.slug,
        display_name=args.display_name,
        site_url=args.site_url,
        feed_url=args.feed_url,
        fetch_method=args.fetch_method,
        content_license=args.content_license,
        source_category=args.source_category,
        channel=args.channel,
        enabled=not args.disabled,
    )
    if args.content_license != "public_domain":
        print(f"NOTE: content_license={args.content_license!r} — stored, but "
              f"get_enabled_sources() will exclude it from every poll run until this "
              f"pipeline implements that license's storage posture. See "
              f"GOV-NEWS-INGESTION-PLAN.md §4.2.")
    print(f"Added '{args.slug}' ({'enabled' if not args.disabled else 'disabled'}). "
          f"Picked up automatically on the next poll run — no deploy needed.")
    return 0


def cmd_list(args: argparse.Namespace) -> int:  # noqa: ARG001
    sources = ns.list_all_sources()
    if not sources:
        print("No sources configured.")
        return 0
    enabled_now = ns.get_enabled_sources()
    for slug, cfg in sources.items():
        status = "ACTIVE" if slug in enabled_now else (
            "disabled" if cfg.get("enabled") is False else "configured but not automatable")
        print(f"{slug:20} [{status:28}] {cfg.get('display_name', '?')} "
              f"— {cfg.get('content_license', '?')}/{cfg.get('source_category', '?')} "
              f"— {cfg.get('feed_url', '?')}")
    return 0


def cmd_show(args: argparse.Namespace) -> int:
    cfg = ns.get_source(args.slug)
    if not cfg:
        print(f"'{args.slug}' not found.", file=sys.stderr)
        return 1
    for k, v in sorted(cfg.items()):
        print(f"  {k}: {v}")
    return 0


def cmd_enable(args: argparse.Namespace) -> int:
    if not ns.get_source(args.slug):
        print(f"'{args.slug}' not found.", file=sys.stderr)
        return 1
    ns.set_enabled(args.slug, True)
    print(f"'{args.slug}' enabled — picked up on the next poll run.")
    return 0


def cmd_disable(args: argparse.Namespace) -> int:
    if not ns.get_source(args.slug):
        print(f"'{args.slug}' not found.", file=sys.stderr)
        return 1
    ns.set_enabled(args.slug, False)
    print(f"'{args.slug}' disabled — the next poll run will skip it (config preserved).")
    return 0


def cmd_remove(args: argparse.Namespace) -> int:
    if not args.confirm:
        print("Refusing to remove without --confirm (this deletes the config; "
              "already-published content is untouched).", file=sys.stderr)
        return 1
    if not ns.remove_source(args.slug):
        print(f"'{args.slug}' not found.", file=sys.stderr)
        return 1
    print(f"'{args.slug}' removed.")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    sub = ap.add_subparsers(dest="cmd", required=True)

    p_add = sub.add_parser("add", help="add a new source")
    p_add.add_argument("slug", help="short unique id, e.g. 'dol' — becomes source_system")
    p_add.add_argument("--display-name", required=True, help='e.g. "Department of Labor"')
    p_add.add_argument("--site-url", required=True)
    p_add.add_argument("--feed-url", required=True, help="the RSS feed URL to poll")
    p_add.add_argument("--content-license", required=True, choices=sorted(_CONTENT_LICENSES),
                        help="public_domain (federal gov, verified) or copyrighted — see the module docstring")
    p_add.add_argument("--source-category", required=True, choices=sorted(_SOURCE_CATEGORIES))
    p_add.add_argument("--fetch-method", default="rss", choices=sorted(_FETCH_METHODS | {"api", "scrape"}),
                        help="default: rss (the only one with an adapter today)")
    p_add.add_argument("--channel", default="gov_news",
                        help='search-boost/doc_kind bucket, default "gov_news" — a law-firm '
                             'source should probably use a different value, see GOV-NEWS-INGESTION-PLAN.md §4.2')
    p_add.add_argument("--disabled", action="store_true", help="add but don't enable yet")
    p_add.set_defaults(func=cmd_add)

    p_list = sub.add_parser("list", help="list all configured sources")
    p_list.set_defaults(func=cmd_list)

    p_show = sub.add_parser("show", help="show one source's full config")
    p_show.add_argument("slug")
    p_show.set_defaults(func=cmd_show)

    p_enable = sub.add_parser("enable", help="enable a source")
    p_enable.add_argument("slug")
    p_enable.set_defaults(func=cmd_enable)

    p_disable = sub.add_parser("disable", help="disable a source (config preserved)")
    p_disable.add_argument("slug")
    p_disable.set_defaults(func=cmd_disable)

    p_remove = sub.add_parser("remove", help="permanently delete a source's config")
    p_remove.add_argument("slug")
    p_remove.add_argument("--confirm", action="store_true")
    p_remove.set_defaults(func=cmd_remove)

    args = ap.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
