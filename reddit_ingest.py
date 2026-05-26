"""
reddit_ingest.py — Robust Reddit immigration content ingestion
================================================================
Processes one subreddit at a time with progress tracking, error isolation,
checkpointing, and resume support.

USAGE:
  python reddit_ingest.py                                    # Default subreddits
  python reddit_ingest.py --subreddits h1b,immigration       # Specific subreddits
  python reddit_ingest.py --subreddits-file subreddits.txt   # From file
  python reddit_ingest.py --checkpoint state.json --resume   # Resume interrupted run
  python reddit_ingest.py --sort top --posts-per-sub 100     # Bulk ingestion
"""

import argparse
import json
import os
import signal
import sys
import tempfile
import time
from datetime import datetime, timezone

from dotenv import load_dotenv

load_dotenv()

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

DEFAULT_SUBREDDITS = [
    "h1b", "immigration", "USCIS", "greencard", "f1visa",
    "askimmigration", "iwantout", "expats",
]

# Global for signal handler
_checkpoint_path = None
_checkpoint_data = None


def save_checkpoint(path: str, data: dict) -> None:
    """Atomically write checkpoint to avoid corruption on interrupt."""
    tmp = path + ".tmp"
    with open(tmp, "w") as f:
        json.dump(data, f, indent=2)
    os.replace(tmp, path)


def load_checkpoint(path: str) -> dict:
    """Load checkpoint if it exists."""
    if os.path.exists(path):
        with open(path, "r") as f:
            return json.load(f)
    return {"completed_subs": [], "results": [], "started_at": None}


def signal_handler(sig, frame):
    """Save checkpoint on Ctrl+C before exiting."""
    if _checkpoint_path and _checkpoint_data:
        print(f"\n\nInterrupted — saving checkpoint to {_checkpoint_path}...")
        save_checkpoint(_checkpoint_path, _checkpoint_data)
        print(f"Resume with: python reddit_ingest.py --checkpoint {_checkpoint_path} --resume")
    sys.exit(1)


def load_subreddits_from_file(filepath: str) -> list[str]:
    """Load subreddit names from a newline-delimited file (# comments supported)."""
    subs = []
    with open(filepath, "r") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#"):
                subs.append(line)
    return subs


def print_summary(all_results: list[dict], max_samples: int = 5) -> None:
    """Print a truncated summary instead of dumping everything."""
    succeeded = [r for r in all_results if r.get("status") == "success"]
    failed = [r for r in all_results if r.get("status") != "success"]

    print(f"\n{'='*60}")
    print(f"FINAL SUMMARY")
    print(f"{'='*60}")
    print(f"  Total processed: {len(all_results)}")
    print(f"  Succeeded:       {len(succeeded)}")
    print(f"  Failed/Skipped:  {len(failed)}")

    if succeeded:
        # Label distribution from labeled_json
        from collections import Counter
        all_tags = Counter()
        visa_cats = Counter()
        for r in succeeded:
            lj = r.get("labeled_json", {}) or {}
            for t in lj.get("tags", []):
                all_tags[t] += 1
            for v in lj.get("current_visa_or_greencard_category", []):
                visa_cats[v] += 1

        if all_tags:
            print(f"\n--- Top Tags ---")
            for tag, count in all_tags.most_common(10):
                print(f"  {tag:35s} {count}")

        if visa_cats:
            print(f"\n--- Visa Categories Seen ---")
            for cat, count in visa_cats.most_common(10):
                print(f"  {cat:20s} {count}")

        print(f"\n--- Sample Successes ({min(max_samples, len(succeeded))} of {len(succeeded)}) ---")
        for r in succeeded[:max_samples]:
            url = r.get("full_url", r.get("url", ""))[:70]
            lj = r.get("labeled_json", {}) or {}
            tags = lj.get("tags", [])[:4]
            summary = lj.get("background_summary", "")[:80]
            conf = lj.get("confidence_score", 0)
            print(f"  {url}")
            print(f"    Tags: {tags} (confidence: {conf})")
            if summary:
                print(f"    Summary: {summary}")

    if failed:
        print(f"\n--- Sample Failures ({min(max_samples, len(failed))} of {len(failed)}) ---")
        for r in failed[:max_samples]:
            url = r.get("url", "")[:70]
            err = r.get("error", r.get("status", "unknown"))[:60]
            print(f"  {url}")
            print(f"    → {err}")


def main():
    global _checkpoint_path, _checkpoint_data

    parser = argparse.ArgumentParser(description="Reddit immigration content ingestion")
    parser.add_argument("--subreddits", type=str, default="",
                        help="Comma-separated subreddit names")
    parser.add_argument("--subreddits-file", type=str, default="",
                        help="Path to newline-delimited file of subreddit names")
    parser.add_argument("--urls", type=str, default="",
                        help="Comma-separated URLs to scrape directly")
    parser.add_argument("--posts-per-sub", type=int, default=50,
                        help="Max posts per subreddit per sort mode (default: 50)")
    parser.add_argument("--sort", type=str, default="new,hot,top",
                        help="Reddit sort modes (default: new,hot,top)")
    parser.add_argument("--sleep", type=float, default=2.0,
                        help="Seconds to wait between subreddits (default: 2)")
    parser.add_argument("--checkpoint", type=str, default="",
                        help="Path for checkpoint file (enables resume)")
    parser.add_argument("--resume", action="store_true",
                        help="Resume from checkpoint (requires --checkpoint)")
    parser.add_argument("--output", type=str, default="",
                        help="Path to write final combined JSON results")
    parser.add_argument("--scraper-url", type=str, default="",
                        help="Cloud Run Scraper Tool URL")
    args = parser.parse_args()

    # Set up signal handler for clean Ctrl+C
    signal.signal(signal.SIGINT, signal_handler)

    project_id = os.getenv("GCP_PROJECT_ID", "proceedings-490601")
    region = os.getenv("GCP_REGION", "us-central1")
    scraper_url = args.scraper_url or os.getenv("SCRAPER_URL", "")
    sort_modes = [s.strip() for s in args.sort.split(",") if s.strip()]

    print("=" * 60)
    print("REDDIT IMMIGRATION CONTENT INGESTION")
    print("=" * 60)

    # Handle direct URL mode (no per-sub loop needed)
    if args.urls:
        from orchestrator.agent import RedditScrapingAgent
        agent = RedditScrapingAgent(
            model="gemini-2.5-flash", project=project_id,
            location=region, scraper_url=scraper_url or None,
        )
        agent.set_up()
        urls = [u.strip() for u in args.urls.split(",") if u.strip()]
        print(f"Scraping {len(urls)} direct URLs...\n")
        result = agent.query(urls=urls)
        print_summary(result.get("scraped", []))
        return

    # Determine subreddit list
    if args.subreddits_file:
        subreddits = load_subreddits_from_file(args.subreddits_file)
        print(f"Loaded {len(subreddits)} subreddits from {args.subreddits_file}")
    elif args.subreddits:
        subreddits = [s.strip() for s in args.subreddits.split(",") if s.strip()]
    else:
        subreddits = list(DEFAULT_SUBREDDITS)

    print(f"Subreddits: {len(subreddits)}")
    print(f"Posts per sub: {args.posts_per_sub}")
    print(f"Sort modes: {sort_modes}")
    print(f"Sleep between subs: {args.sleep}s")

    # Load checkpoint
    checkpoint = {"completed_subs": [], "results": [], "started_at": None}
    if args.checkpoint:
        _checkpoint_path = args.checkpoint
        if args.resume:
            checkpoint = load_checkpoint(args.checkpoint)
            if checkpoint.get("completed_subs"):
                print(f"Resuming: {len(checkpoint['completed_subs'])} subs already completed")

    if not checkpoint.get("started_at"):
        checkpoint["started_at"] = datetime.now(timezone.utc).isoformat()

    _checkpoint_data = checkpoint

    # Filter out already-completed subs
    completed = set(checkpoint.get("completed_subs", []))
    remaining = [s for s in subreddits if s not in completed]
    print(f"Remaining to process: {len(remaining)}\n")

    if not remaining:
        print("All subreddits already completed.")
        print_summary(checkpoint.get("results", []))
        return

    # Initialize agent
    from orchestrator.agent import RedditScrapingAgent
    agent = RedditScrapingAgent(
        model="gemini-2.5-flash", project=project_id,
        location=region, scraper_url=scraper_url or None,
    )
    agent.set_up()

    # Process one subreddit at a time
    all_results = list(checkpoint.get("results", []))

    for i, sub in enumerate(remaining, 1):
        print(f"[{i}/{len(remaining)}] r/{sub} ", end="", flush=True)

        try:
            result = agent.query(
                subreddits=[sub],
                posts_per_sub=args.posts_per_sub,
                sort_modes=sort_modes,
            )

            sub_results = result.get("scraped", [])
            sub_succeeded = sum(1 for r in sub_results if r.get("status") == "success")
            sub_failed = len(sub_results) - sub_succeeded

            print(f"— {sub_succeeded} scraped, {sub_failed} failed")

            all_results.extend(sub_results)

        except Exception as e:
            print(f"— ERROR: {str(e)[:60]}")

        # Update checkpoint
        checkpoint["completed_subs"].append(sub)
        checkpoint["results"] = all_results
        _checkpoint_data = checkpoint

        if args.checkpoint:
            save_checkpoint(args.checkpoint, checkpoint)

        # Sleep between subs
        if i < len(remaining):
            time.sleep(args.sleep)

    # Final output
    print_summary(all_results)

    if args.output:
        with open(args.output, "w") as f:
            json.dump({
                "started_at": checkpoint.get("started_at"),
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "subreddits": subreddits,
                "total": len(all_results),
                "succeeded": sum(1 for r in all_results if r.get("status") == "success"),
                "results": all_results,
            }, f, indent=2)
        print(f"\nResults written to {args.output}")

    if args.checkpoint:
        print(f"Checkpoint saved to {args.checkpoint}")


if __name__ == "__main__":
    main()
