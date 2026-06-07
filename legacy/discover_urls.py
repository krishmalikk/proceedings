"""
discover_urls.py — Auto-Discover Immigration Law Firm URLs
============================================================
Searches the web for immigration law firm pages (FAQs, practice areas,
blog posts) and adds them to url_registry.json for crawling.

USAGE:
  python discover_urls.py
  python discover_urls.py --max-results 50

REQUIRES:
  pip install google-api-python-client
  Set GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_ENGINE_ID in .env

  To get these:
    1. Go to https://programmablesearchengine.google.com/ and create a search engine
    2. Go to https://console.cloud.google.com/apis/credentials and create an API key
    3. Enable "Custom Search API" in your GCP project
"""

import argparse
import json
import os
import time
from urllib.parse import urlparse

from dotenv import load_dotenv

load_dotenv()

REGISTRY_PATH = "url_registry.json"

# Search queries designed to find high-value immigration law content
SEARCH_QUERIES = [
    '"immigration lawyer" FAQ',
    '"immigration attorney" "practice areas"',
    '"immigration law firm" "frequently asked questions"',
    '"visa services" "our firm" immigration',
    '"green card" attorney FAQ',
    '"H-1B visa" "law firm" guide',
    '"immigration lawyer" "work permits" resources',
    '"family immigration" attorney FAQ',
    '"deportation defense" "law firm"',
    '"immigration attorney" "asylum" resources',
    '"employment-based immigration" FAQ',
    '"naturalization" "citizenship" "law firm" FAQ',
    'immigration lawyer blog "visa process"',
    '"immigration law" "free consultation" FAQ',
    '"DACA" attorney "practice areas"',
]

# Known immigration law directories and resource pages
SEED_URLS = [
    # USCIS additional pages
    "https://www.uscis.gov/citizenship",
    "https://www.uscis.gov/family",
    "https://www.uscis.gov/working-in-the-united-states/h-1b-specialty-occupations",
    "https://www.uscis.gov/humanitarian/temporary-protected-status",
    "https://www.uscis.gov/forms/all-forms",
    "https://www.uscis.gov/green-card/green-card-processes-and-procedures/visa-availability-and-priority-dates",
    # State Department
    "https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/fees/fees-visa-services.html",
    "https://travel.state.gov/content/travel/en/us-visas/immigrate/diversity-visa-program-entry.html",
    "https://travel.state.gov/content/travel/en/us-visas/immigrate/the-immigrant-visa-process.html",
    # DOL
    "https://www.dol.gov/agencies/eta/foreign-labor",
    # Well-known immigration law firms with public resources
    "https://www.ilrc.org/resources",
    "https://www.americanimmigrationlawyers.org/practice/consumer-resources",
]

# Page path patterns that typically contain useful immigration content
VALUABLE_PATHS = [
    "/faq", "/faqs", "/frequently-asked-questions",
    "/practice-areas", "/immigration",
    "/blog", "/resources", "/guides",
    "/visa", "/green-card", "/citizenship",
    "/h1b", "/h-1b", "/work-visa", "/work-permit",
    "/family-immigration", "/asylum", "/deportation",
    "/daca", "/naturalization", "/ead",
]


def load_registry() -> list[dict]:
    """Load the existing URL registry."""
    if os.path.exists(REGISTRY_PATH):
        with open(REGISTRY_PATH, "r") as f:
            return json.load(f)
    return []


def save_registry(registry: list[dict]) -> None:
    """Save the URL registry."""
    with open(REGISTRY_PATH, "w") as f:
        json.dump(registry, f, indent=2)


def normalize_url(url: str) -> str:
    """Normalize a URL for deduplication."""
    parsed = urlparse(url)
    # Remove trailing slashes, fragments, and common tracking params
    path = parsed.path.rstrip("/")
    return f"{parsed.scheme}://{parsed.netloc}{path}".lower()


def get_existing_urls(registry: list[dict]) -> set[str]:
    """Get set of normalized URLs already in the registry."""
    return {normalize_url(entry["url"]) for entry in registry}


def classify_url(url: str) -> dict:
    """Classify a URL by domain type and category."""
    parsed = urlparse(url)
    domain = parsed.netloc.replace("www.", "")
    path = parsed.path.lower()

    # Determine source type
    gov_domains = ["uscis.gov", "travel.state.gov", "dol.gov", "justice.gov"]
    org_domains = ["ilrc.org", "americanimmigrationlawyers.org"]

    if any(d in domain for d in gov_domains):
        source_type = "government"
    elif any(d in domain for d in org_domains):
        source_type = "organization"
    else:
        source_type = "law_firm"

    # Determine category from path
    category = "general"
    category_map = {
        "green-card": ["green-card", "greencard", "permanent-resident"],
        "work-visas": ["h-1b", "h1b", "work-visa", "work-permit", "employment-based", "temporary-worker"],
        "family-immigration": ["family", "spouse", "fiance", "marriage"],
        "humanitarian": ["asylum", "refugee", "humanitarian", "tps", "daca", "deportation"],
        "citizenship": ["citizenship", "naturalization"],
        "faq": ["faq", "frequently-asked"],
    }
    for cat, keywords in category_map.items():
        if any(kw in path for kw in keywords):
            category = cat
            break

    return {
        "url": url,
        "domain": domain,
        "source_type": source_type,
        "category": category,
        "last_crawled": None,
        "status": "pending",
    }


def discover_via_google(api_key: str, engine_id: str, max_results: int = 50) -> list[str]:
    """
    Use Google Custom Search API to find immigration law firm pages.
    Free tier: 100 queries/day, 10 results per query.
    """
    try:
        from googleapiclient.discovery import build
    except ImportError:
        print("Warning: google-api-python-client not installed. Skipping Google search.")
        print("  Install with: pip install google-api-python-client")
        return []

    service = build("customsearch", "v1", developerKey=api_key)
    discovered = []

    queries_to_run = SEARCH_QUERIES[: max_results // 10 + 1]

    for i, query_str in enumerate(queries_to_run):
        if len(discovered) >= max_results:
            break

        print(f"  Searching ({i+1}/{len(queries_to_run)}): {query_str}")

        try:
            result = service.cse().list(q=query_str, cx=engine_id, num=10).execute()
            items = result.get("items", [])

            for item in items:
                link = item.get("link", "")
                if link:
                    discovered.append(link)

            # Respect rate limits
            time.sleep(1)
        except Exception as e:
            print(f"    Error: {e}")
            continue

    return discovered


def discover_seed_urls() -> list[str]:
    """Return the hardcoded seed URLs."""
    return list(SEED_URLS)


def filter_relevant_urls(urls: list[str]) -> list[str]:
    """Filter URLs to keep only those likely to have useful immigration content."""
    relevant = []
    for url in urls:
        parsed = urlparse(url)
        path = parsed.path.lower()

        # Skip non-HTTP URLs
        if parsed.scheme not in ("http", "https"):
            continue

        # Skip file downloads
        if any(path.endswith(ext) for ext in [".pdf", ".doc", ".docx", ".zip", ".jpg", ".png"]):
            continue

        # Skip social media, news aggregators, directories
        skip_domains = ["facebook.com", "twitter.com", "linkedin.com", "youtube.com",
                        "yelp.com", "reddit.com", "wikipedia.org", "amazon.com"]
        if any(d in parsed.netloc for d in skip_domains):
            continue

        relevant.append(url)

    return relevant


def main():
    parser = argparse.ArgumentParser(description="Discover immigration law firm URLs")
    parser.add_argument("--max-results", type=int, default=50,
                        help="Maximum number of URLs to discover via search (default: 50)")
    args = parser.parse_args()

    print("=" * 50)
    print("URL Discovery for Proceedings")
    print("=" * 50)

    registry = load_registry()
    existing = get_existing_urls(registry)
    print(f"Existing registry: {len(registry)} URLs")

    all_discovered = []

    # Step 1: Add seed URLs
    print(f"\nStep 1: Adding {len(SEED_URLS)} seed URLs...")
    all_discovered.extend(discover_seed_urls())

    # Step 2: Google Custom Search (if configured)
    api_key = os.getenv("GOOGLE_SEARCH_API_KEY")
    engine_id = os.getenv("GOOGLE_SEARCH_ENGINE_ID")

    if api_key and engine_id:
        print(f"\nStep 2: Searching Google (max {args.max_results} results)...")
        search_results = discover_via_google(api_key, engine_id, args.max_results)
        all_discovered.extend(search_results)
        print(f"  Found {len(search_results)} URLs from search")
    else:
        print("\nStep 2: Skipping Google search (GOOGLE_SEARCH_API_KEY / GOOGLE_SEARCH_ENGINE_ID not set)")
        print("  To enable: add these to .env and install google-api-python-client")

    # Step 3: Filter and deduplicate
    print(f"\nStep 3: Filtering and deduplicating...")
    filtered = filter_relevant_urls(all_discovered)
    print(f"  {len(all_discovered)} raw → {len(filtered)} after filtering")

    new_count = 0
    for url in filtered:
        if normalize_url(url) not in existing:
            entry = classify_url(url)
            registry.append(entry)
            existing.add(normalize_url(url))
            new_count += 1

    # Save
    save_registry(registry)

    print(f"\n{'=' * 50}")
    print(f"DISCOVERY COMPLETE")
    print(f"  New URLs added: {new_count}")
    print(f"  Total registry: {len(registry)}")
    print(f"  Pending crawl:  {sum(1 for r in registry if r['status'] == 'pending')}")
    print(f"\nNext step: python crawler.py")


if __name__ == "__main__":
    main()
