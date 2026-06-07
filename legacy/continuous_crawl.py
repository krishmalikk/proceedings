"""
continuous_crawl.py — Continuously discover, crawl, label, and index immigration law firm content
==================================================================================================
Runs in a loop: discovers new URLs, crawls them, labels with Agent Engine,
and indexes into Vector Search. Stops when you press Ctrl+C.

USAGE:
  python continuous_crawl.py
"""

import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv
from google.cloud import storage

load_dotenv()

GCP_PROJECT_ID = os.getenv("GCP_PROJECT_ID", "proceedings-490601")
GCP_REGION = os.getenv("GCP_REGION", "us-central1")
GCP_BUCKET_NAME = os.getenv("GCP_BUCKET_NAME", "law-firm-knowledge-base")
REGISTRY_PATH = "url_registry.json"
MIN_CONTENT_LENGTH = 200

# Immigration law firm search queries — rotated each round
SEARCH_BATCHES = [
    # Batch 1: H-1B and work visas
    [
        "immigration lawyer H-1B visa FAQ",
        "immigration attorney H-1B cap lottery guide",
        "H-1B visa process law firm blog",
        "H-1B transfer attorney FAQ",
        "H-1B premium processing immigration lawyer",
    ],
    # Batch 2: Green cards and family immigration
    [
        "immigration lawyer green card through marriage FAQ",
        "family-based immigration attorney guide",
        "employment-based green card EB-1 EB-2 law firm",
        "green card process immigration attorney blog",
        "I-130 petition immigration lawyer guide",
    ],
    # Batch 3: Asylum, DACA, humanitarian
    [
        "asylum attorney FAQ application process",
        "DACA immigration lawyer renewal guide",
        "deportation defense attorney FAQ",
        "immigration lawyer TPS temporary protected status",
        "humanitarian parole immigration attorney",
    ],
    # Batch 4: Student visas and OPT
    [
        "F-1 student visa OPT STEM immigration lawyer FAQ",
        "immigration attorney change of status student to H-1B",
        "CPT OPT immigration law firm guide",
        "international student immigration lawyer resources",
        "F-1 visa maintenance of status attorney",
    ],
    # Batch 5: Naturalization and citizenship
    [
        "naturalization citizenship attorney FAQ",
        "N-400 application immigration lawyer guide",
        "citizenship test preparation immigration attorney",
        "dual citizenship immigration law firm FAQ",
        "derivative citizenship attorney guide",
    ],
    # Batch 6: Consular processing and forms
    [
        "consular processing immigration attorney guide",
        "immigration lawyer I-485 adjustment of status FAQ",
        "NVC interview preparation immigration attorney",
        "immigration forms guide attorney blog",
        "advance parole travel document lawyer FAQ",
    ],
    # Batch 7: Investment and business visas
    [
        "EB-5 investor visa immigration lawyer FAQ",
        "E-2 treaty investor visa attorney guide",
        "L-1 visa intracompany transfer law firm",
        "O-1 extraordinary ability visa immigration attorney",
        "TN visa USMCA immigration lawyer FAQ",
    ],
    # Batch 8: Specific law firm resource pages
    [
        "immigration law firm resources practice areas",
        "immigration attorney client testimonials FAQ",
        "best immigration lawyers FAQ page",
        "immigration law blog green card visa",
        "immigration lawyer free consultation FAQ",
    ],
    # Batch 9: Specific immigration topics
    [
        "immigration lawyer waivers inadmissibility FAQ",
        "unlawful presence waiver immigration attorney",
        "immigration bond hearing lawyer guide",
        "VAWA immigration attorney domestic violence",
        "U visa T visa immigration lawyer FAQ",
    ],
    # Batch 10: More law firm content
    [
        "immigration attorney EB-2 NIW national interest waiver",
        "PERM labor certification immigration lawyer guide",
        "immigration lawyer K-1 fiance visa FAQ",
        "removal proceedings immigration attorney guide",
        "immigration appeals BIA attorney FAQ",
    ],
]


def load_registry():
    if os.path.exists(REGISTRY_PATH):
        with open(REGISTRY_PATH, "r") as f:
            return json.load(f)
    return []


def save_registry(registry):
    with open(REGISTRY_PATH, "w") as f:
        json.dump(registry, f, indent=2)


def get_existing_urls(registry):
    return {e["url"] for e in registry}


def normalize_url(url):
    parsed = urlparse(url)
    path = parsed.path.rstrip("/")
    return f"{parsed.scheme}://{parsed.netloc}{path}".lower()


def url_to_filename(url):
    parsed = urlparse(url)
    domain = parsed.netloc.replace("www.", "").replace(".", "-")
    path = parsed.path.strip("/")
    if path:
        slug = re.sub(r"[^a-zA-Z0-9\-]", "-", path.replace("/", "-"))
        slug = re.sub(r"-+", "-", slug).strip("-")
        filename = f"{domain}-{slug}.md"
    else:
        filename = f"{domain}-index.md"
    return filename.lower()


def discover_urls_via_search(queries):
    """Use trafilatura's built-in search to find URLs."""
    import trafilatura

    discovered = []
    for query in queries:
        print(f"    Searching: {query}")
        try:
            results = trafilatura.spider.focused_crawler(query, max_seen_urls=20, max_known_urls=20)
            if results and len(results) >= 2:
                urls = list(results[0]) if results[0] else []
                discovered.extend(urls[:10])
        except Exception:
            # Fallback: use trafilatura's URL discovery
            try:
                urls = trafilatura.downloads.find_feed_urls(query)
                discovered.extend(urls[:5])
            except Exception:
                pass
        time.sleep(2)

    return discovered


def discover_urls_manual(batch_index):
    """Return curated URLs for a given batch. These are high-quality immigration law firm pages."""
    curated_batches = [
        # Batch 0: More USCIS pages
        [
            "https://www.uscis.gov/working-in-the-united-states/temporary-workers/p-1a-internationally-recognized-athlete",
            "https://www.uscis.gov/working-in-the-united-states/temporary-workers/r-1-temporary-religious-workers",
            "https://www.uscis.gov/humanitarian/special-immigrants",
            "https://www.uscis.gov/green-card/green-card-eligibility/green-card-for-special-immigrants",
            "https://www.uscis.gov/adoption",
        ],
        # Batch 1: Immigration law firm blogs
        [
            "https://www.murthy.com/2024/h-1b-visa-news/",
            "https://www.wegreened.com/eb2-green-card",
            "https://www.wegreened.com/green-card-processing-time",
            "https://citizenpath.com/faq/green-card/",
            "https://citizenpath.com/faq/citizenship/",
        ],
        # Batch 2: VisaGuide additional
        [
            "https://visaguide.world/us-visa/nonimmigrant/work/tn/",
            "https://visaguide.world/us-visa/nonimmigrant/work/e2/",
            "https://visaguide.world/us-visa/nonimmigrant/work/e1/",
            "https://visaguide.world/us-visa/nonimmigrant/exchange-visitor/",
            "https://visaguide.world/us-visa/immigrant/diversity-visa/",
        ],
        # Batch 3: More government resources
        [
            "https://www.uscis.gov/humanitarian/unaccompanied-children",
            "https://www.uscis.gov/military",
            "https://www.uscis.gov/working-in-the-united-states/eb-5-immigrant-investor-program",
            "https://travel.state.gov/content/travel/en/us-visas/study.html",
            "https://travel.state.gov/content/travel/en/us-visas/tourism-visit.html",
        ],
        # Batch 4: Nolo additional
        [
            "https://www.nolo.com/legal-encyclopedia/who-qualifies-for-asylum.html",
            "https://www.nolo.com/legal-encyclopedia/green-card-through-family-member.html",
            "https://www.nolo.com/legal-encyclopedia/options-undocumented-immigrants.html",
            "https://www.nolo.com/legal-encyclopedia/free-books/fiance-marriage-visa-book/chapter7-2.html",
            "https://www.nolo.com/legal-encyclopedia/adjustment-of-status-who-can-apply.html",
        ],
    ]

    idx = batch_index % len(curated_batches)
    return curated_batches[idx]


def crawl_url(url):
    """Crawl a single URL with trafilatura."""
    import trafilatura

    try:
        downloaded = trafilatura.fetch_url(url)
        if not downloaded:
            return None
        text = trafilatura.extract(
            downloaded,
            include_links=True,
            include_tables=True,
            output_format="txt",
            favor_recall=True,
        )
        return text
    except Exception as e:
        print(f"      Crawl error: {e}")
        return None


def add_frontmatter(content, url, domain, source_type):
    now = datetime.now(timezone.utc).isoformat()
    return f"---\nsource_url: {url}\ndomain: {domain}\nsource_type: {source_type}\ncrawled_at: {now}\n---\n\n{content}"


def label_content(agent, content):
    """Label content using the local agent."""
    try:
        result = agent.query(content=content)
        return result.get("labels", ["general-immigration-info"])
    except Exception as e:
        print(f"      Label error: {e}")
        return ["general-immigration-info"]


def upload_labeled(bucket_name, filename, labels, label_id):
    annotation = {
        "id": label_id,
        "result": [{"from_name": "category", "to_name": "text", "type": "choices", "value": {"choices": labels}}],
        "task": {"id": label_id, "data": {"text": f"gs://{bucket_name}/crawled/{filename}"}},
    }
    client = storage.Client()
    bucket = client.bucket(bucket_name)
    blob = bucket.blob(f"labeled/{label_id}")
    blob.upload_from_string(json.dumps(annotation), content_type="application/json")


def run_round(round_num, agent, label_id_start):
    """Run one round of discovery → crawl → label → upload."""
    print(f"\n{'='*60}")
    print(f"ROUND {round_num}")
    print(f"{'='*60}")

    registry = load_registry()
    existing = get_existing_urls(registry)

    # Step 1: Discover new URLs
    print(f"\n  [1/3] Discovering new URLs (batch {round_num % len(SEARCH_BATCHES)})...")
    new_urls = discover_urls_manual(round_num)

    added = 0
    for url in new_urls:
        norm = normalize_url(url)
        if norm not in existing and url not in existing:
            parsed = urlparse(url)
            domain = parsed.netloc.replace("www.", "")
            gov_domains = ["uscis.gov", "travel.state.gov", "dol.gov"]
            source_type = "government" if any(d in domain for d in gov_domains) else "law_firm"
            registry.append({
                "url": url, "domain": domain, "source_type": source_type,
                "category": "general-immigration-info", "last_crawled": None, "status": "pending",
            })
            existing.add(url)
            added += 1

    save_registry(registry)
    print(f"    Added {added} new URLs (total registry: {len(registry)})")

    # Step 2: Crawl pending URLs
    pending = [e for e in registry if e["status"] == "pending"]
    print(f"\n  [2/3] Crawling {len(pending)} pending URLs...")

    label_id = label_id_start
    crawled = 0
    labeled = 0

    for i, entry in enumerate(pending):
        url = entry["url"]
        filename = url_to_filename(url)
        domain = entry.get("domain", "")

        print(f"    [{i+1}/{len(pending)}] {url[:80]}...")

        content = crawl_url(url)

        if not content or len(content.strip()) < MIN_CONTENT_LENGTH:
            status = "skipped" if content else "failed"
            # Update registry
            registry = load_registry()
            for e in registry:
                if e["url"] == url:
                    e["status"] = status
                    break
            save_registry(registry)
            print(f"      {'Skipped (short)' if content else 'Failed'}")
            time.sleep(1)
            continue

        # Add frontmatter and save
        content_with_meta = add_frontmatter(content, url, domain, entry.get("source_type", "unknown"))
        Path("crawled_pages").mkdir(exist_ok=True)
        filepath = f"crawled_pages/{filename}"
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content_with_meta)

        # Upload to GCS
        gcs_client = storage.Client()
        bucket = gcs_client.bucket(GCP_BUCKET_NAME)
        blob = bucket.blob(f"crawled/{filename}")
        blob.upload_from_filename(filepath)

        crawled += 1

        # Label
        labels = label_content(agent, content)
        print(f"      Saved ({len(content):,} chars) → {labels}")
        upload_labeled(GCP_BUCKET_NAME, filename, labels, label_id)
        label_id += 1
        labeled += 1

        # Update registry
        registry = load_registry()
        for e in registry:
            if e["url"] == url:
                e["status"] = "done"
                e["last_crawled"] = datetime.now(timezone.utc).isoformat()
                break
        save_registry(registry)

        time.sleep(3)  # Rate limit

    print(f"\n    Crawled: {crawled}, Labeled: {labeled}")

    # Step 3: Index new content
    if labeled > 0:
        print(f"\n  [3/3] Indexing new content...")
        os.system(f"{sys.executable} index.py 2>&1 | grep -E '(Running|STEP|Created|Generated|Total|Chunk mapping|INDEXING)'")

    return label_id


def main():
    print("=" * 60)
    print("CONTINUOUS CRAWL — Immigration Law Firm Content")
    print("Press Ctrl+C to stop")
    print("=" * 60)

    # Initialize labeling agent
    from labeling_agent.agent import ImmigrationLabelingAgent
    agent = ImmigrationLabelingAgent(
        model="gemini-2.5-flash",
        project=GCP_PROJECT_ID,
        location=GCP_REGION,
    )
    agent.set_up()
    print("Agent initialized.\n")

    round_num = 0
    label_id = 1000  # Start high to avoid collisions

    try:
        while True:
            label_id = run_round(round_num, agent, label_id)
            round_num += 1

            # Restart API to pick up new chunks
            print(f"\n  Restarting API server...")
            os.system("pkill -f 'uvicorn api:app' 2>/dev/null")
            time.sleep(2)
            os.system(f"{sys.executable} -m uvicorn api:app --reload --port 8000 &")

            print(f"\n  Round {round_num} complete. Waiting 30s before next round...")
            print(f"  Press Ctrl+C to stop.\n")
            time.sleep(30)

    except KeyboardInterrupt:
        print("\n\nStopping continuous crawl.")

        # Final stats
        registry = load_registry()
        total = len(registry)
        done = sum(1 for e in registry if e["status"] == "done")
        print(f"\nFinal stats: {done}/{total} URLs crawled")

        if os.path.exists("chunk_mapping.json"):
            with open("chunk_mapping.json") as f:
                chunks = json.load(f)
            print(f"Total chunks indexed: {len(chunks)}")


if __name__ == "__main__":
    main()
