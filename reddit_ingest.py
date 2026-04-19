"""
reddit_ingest.py — Trigger the Reddit scraping pipeline
========================================================
Calls the RedditScrapingAgent to discover, scrape, and label
recent Reddit posts from immigration subreddits.

USAGE:
  python reddit_ingest.py                              # Default subreddits
  python reddit_ingest.py --subreddits h1b,immigration # Specific subreddits
  python reddit_ingest.py --urls https://reddit.com/r/h1b/comments/abc123  # Direct URLs
"""

import argparse
import json
import os
import sys

from dotenv import load_dotenv

load_dotenv()

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def main():
    parser = argparse.ArgumentParser(description="Reddit immigration content ingestion")
    parser.add_argument("--subreddits", type=str, default="",
                        help="Comma-separated subreddit names (e.g., h1b,immigration,USCIS)")
    parser.add_argument("--urls", type=str, default="",
                        help="Comma-separated URLs to scrape directly")
    parser.add_argument("--scraper-url", type=str, default="",
                        help="Cloud Run Scraper Tool URL (if deployed)")
    args = parser.parse_args()

    project_id = os.getenv("GCP_PROJECT_ID", "proceedings-490601")
    region = os.getenv("GCP_REGION", "us-central1")
    scraper_url = args.scraper_url or os.getenv("SCRAPER_URL", "")

    print("=" * 60)
    print("REDDIT IMMIGRATION CONTENT INGESTION")
    print("=" * 60)

    # Initialize agent locally
    from orchestrator.agent import RedditScrapingAgent

    agent = RedditScrapingAgent(
        model="gemini-2.5-flash",
        project=project_id,
        location=region,
        scraper_url=scraper_url or None,
    )
    agent.set_up()
    print("Agent initialized.\n")

    # Determine what to scrape
    if args.urls:
        urls = [u.strip() for u in args.urls.split(",") if u.strip()]
        print(f"Scraping {len(urls)} direct URLs...\n")
        result = agent.query(urls=urls)
    elif args.subreddits:
        subs = [s.strip() for s in args.subreddits.split(",") if s.strip()]
        print(f"Scraping subreddits: {', '.join(subs)}\n")
        result = agent.query(subreddits=subs)
    else:
        print("Scraping default subreddits: h1b, immigration, USCIS, greencard, f1visa, askimmigration\n")
        result = agent.query()

    # Print results
    print(f"\n{'='*60}")
    print(f"RESULTS")
    print(f"{'='*60}")
    print(f"  Total URLs: {result['total']}")
    print(f"  Succeeded:  {result['succeeded']}")
    print(f"  Failed:     {result['failed']}")

    print(f"\n--- Scraped & Labeled ---")
    for item in result["scraped"]:
        if item.get("status") == "success":
            labels = item.get("labels", [])
            conf = item.get("confidence", 0)
            url = item.get("url", "")[:70]
            gcs = item.get("gcs_path", "")
            print(f"  {url}")
            print(f"    GCS:    {gcs}")
            print(f"    Labels: {labels} (confidence: {conf:.2f})")
            print()

    if result.get("failed", 0) > 0:
        print(f"--- Failed ---")
        for item in result["scraped"]:
            if item.get("status") != "success":
                print(f"  {item.get('url', '')[:70]} — {item.get('error', item.get('status', ''))}")


if __name__ == "__main__":
    main()
