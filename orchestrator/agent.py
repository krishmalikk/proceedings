"""
Reddit Scraping Orchestrator Agent for Vertex AI Agent Engine
==============================================================
Receives subreddit names, discovers recent posts, calls the
Cloud Run Scraper Tool, and labels each result using the
expanded immigration taxonomy.

Follows Agent Engine contract: __init__, set_up, query.
"""

import json
import re
import time


# Reddit subreddits to scrape for immigration content
DEFAULT_SUBREDDITS = [
    "h1b",
    "immigration",
    "USCIS",
    "greencard",
    "f1visa",
    "askimmigration",
]

# Expanded taxonomy (inlined for Agent Engine deployment)
CATEGORIES = [
    {"id": "b1-b2-visitor", "name": "B-1/B-2 Visitor Visa"},
    {"id": "f1-student", "name": "F-1 Student Visa"},
    {"id": "j1-exchange", "name": "J-1 Exchange Visitor"},
    {"id": "h1b-visa", "name": "H-1B Specialty Occupation"},
    {"id": "l1-transfer", "name": "L-1 Intracompany Transferee"},
    {"id": "o1-extraordinary", "name": "O-1 Extraordinary Ability"},
    {"id": "e1-e2-treaty", "name": "E-1/E-2 Treaty Trader/Investor"},
    {"id": "tn-usmca", "name": "TN/TD USMCA Professional"},
    {"id": "k1-fiance", "name": "K-1 Fiance(e) Visa"},
    {"id": "p-visa-athlete", "name": "P Visa (Athletes & Entertainers)"},
    {"id": "r1-religious", "name": "R-1 Religious Worker"},
    {"id": "family-based-immigration", "name": "Family-Based Immigration"},
    {"id": "eb1-priority", "name": "EB-1 Priority Workers"},
    {"id": "eb2-niw", "name": "EB-2 Professionals / NIW"},
    {"id": "eb3-skilled", "name": "EB-3 Skilled Workers"},
    {"id": "eb4-special", "name": "EB-4 Special Immigrants"},
    {"id": "eb5-investor-visa", "name": "EB-5 Immigrant Investor"},
    {"id": "diversity-visa-lottery", "name": "Diversity Visa Lottery"},
    {"id": "special-immigrant-visa", "name": "Special Immigrant Visa (SIV)"},
    {"id": "adjustment-of-status", "name": "Adjustment of Status"},
    {"id": "consular-processing", "name": "Consular Processing"},
    {"id": "visa-fees-filing", "name": "Visa Fees & Filing"},
    {"id": "work-authorization", "name": "Work Authorization / EAD"},
    {"id": "deportation-defense", "name": "Deportation Defense"},
    {"id": "asylum-refugees", "name": "Asylum & Refugees"},
    {"id": "naturalization-citizenship", "name": "Naturalization & Citizenship"},
    {"id": "daca", "name": "DACA"},
    {"id": "tps", "name": "Temporary Protected Status"},
    {"id": "humanitarian-parole", "name": "Humanitarian Parole"},
    {"id": "immigration-court", "name": "Immigration Court / EOIR"},
    {"id": "travel-documents", "name": "Travel Documents"},
    {"id": "h1b-lottery", "name": "H-1B Lottery & Registration"},
    {"id": "h1b-transfer", "name": "H-1B Transfer / Portability"},
    {"id": "premium-processing", "name": "Premium Processing"},
    {"id": "rfe-response", "name": "RFE / NOID Response"},
    {"id": "grace-period", "name": "Grace Period & Status Gap"},
    {"id": "change-of-status", "name": "Change of Status (COS)"},
    {"id": "layoff-immigration", "name": "Layoff & Immigration Impact"},
    {"id": "general-immigration-info", "name": "General Immigration Info"},
]

VALID_LABELS = [c["id"] for c in CATEGORIES]

LABELING_PROMPT = """You are an expert US immigration content classifier.

Classify this content from a Reddit immigration post into one or more categories.

CATEGORIES:
{categories}

Return ONLY a JSON object:
{{"labels": ["category-id-1", "category-id-2"], "confidence": 0.95}}

CONTENT:
{content}

CLASSIFICATION:"""


class RedditScrapingAgent:
    """
    Orchestrator agent that:
    1. Discovers recent Reddit post URLs from subreddits
    2. Calls the Cloud Run Scraper Tool
    3. Labels each scraped result with the immigration taxonomy
    """

    def __init__(self, model="gemini-2.5-flash", project=None, location=None, scraper_url=None):
        self.model = model
        self.project = project
        self.location = location
        self.scraper_url = scraper_url
        self.client = None

    def set_up(self):
        """Initialize Gemini client."""
        from google import genai
        self.client = genai.Client(
            vertexai=True,
            project=self.project,
            location=self.location,
        )

    def query(self, *, urls: list[str] = None, subreddits: list[str] = None) -> dict:
        """
        Orchestrate: discover URLs → scrape → label.

        Args:
            urls: Direct list of URLs to scrape (if provided, skip discovery)
            subreddits: List of subreddit names to discover posts from

        Returns:
            {
                "scraped": [{"url", "gcs_path", "raw_text", "labels", "confidence"}],
                "total": int,
                "succeeded": int,
                "failed": int
            }
        """
        if self.client is None:
            self.set_up()

        # Step 1: Get URLs to scrape
        if urls:
            target_urls = urls
        elif subreddits:
            target_urls = self._discover_reddit_urls(subreddits)
        else:
            target_urls = self._discover_reddit_urls(DEFAULT_SUBREDDITS)

        if not target_urls:
            return {"scraped": [], "total": 0, "succeeded": 0, "failed": 0}

        # Step 2: Call Scraper Tool
        scrape_results = self._call_scraper(target_urls)

        # Step 3: Label each result
        labeled_results = []
        for result in scrape_results:
            if result.get("status") != "success" or not result.get("raw_text"):
                labeled_results.append({**result, "labels": [], "confidence": 0.0})
                continue

            label_result = self._label_content(result["raw_text"])
            labeled_results.append({
                **result,
                "labels": label_result.get("labels", []),
                "confidence": label_result.get("confidence", 0.0),
            })
            time.sleep(2)  # Rate limit labeling calls

        succeeded = sum(1 for r in labeled_results if r.get("status") == "success")

        return {
            "scraped": labeled_results,
            "total": len(target_urls),
            "succeeded": succeeded,
            "failed": len(target_urls) - succeeded,
        }

    def _discover_reddit_urls(self, subreddits: list[str]) -> list[str]:
        """Discover recent post URLs from Reddit subreddits."""
        import ssl
        import urllib.request

        # Bypass SSL verification for Reddit API (macOS cert issue)
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE

        urls = []
        for sub in subreddits:
            try:
                api_url = f"https://old.reddit.com/r/{sub}/new.json?limit=10"
                req = urllib.request.Request(api_url, headers={
                    "User-Agent": "proceedings-bot/1.0 (immigration research)"
                })
                with urllib.request.urlopen(req, timeout=15, context=ctx) as resp:
                    data = json.loads(resp.read().decode())

                posts = data.get("data", {}).get("children", [])
                for post in posts:
                    permalink = post.get("data", {}).get("permalink", "")
                    if permalink:
                        # Use old.reddit.com for better Firecrawl compatibility
                        urls.append(f"https://old.reddit.com{permalink}")
            except Exception as e:
                print(f"  Warning: Could not fetch r/{sub}: {e}")
                urls.append(f"https://old.reddit.com/r/{sub}/")

        return urls[:50]

    def _call_scraper(self, urls: list[str]) -> list[dict]:
        """Call the Cloud Run Scraper Tool via HTTP."""
        import urllib.request

        if not self.scraper_url:
            # Fallback: scrape locally with Firecrawl
            return self._scrape_locally(urls)

        try:
            payload = json.dumps({"urls": urls}).encode()
            req = urllib.request.Request(
                f"{self.scraper_url}/scrape",
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=300) as resp:
                data = json.loads(resp.read().decode())
            return data.get("results", [])
        except Exception as e:
            print(f"  Scraper call failed: {e}, falling back to local scraping")
            return self._scrape_locally(urls)

    def _scrape_locally(self, urls: list[str]) -> list[dict]:
        """Scrape Reddit URLs using Reddit's JSON API (Firecrawl doesn't support Reddit)."""
        import os
        import ssl
        import urllib.request
        from datetime import datetime, timezone

        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE

        from google.cloud import storage as gcs
        bucket_name = os.getenv("GCP_BUCKET_NAME", "law-firm-knowledge-base")
        gcs_client = gcs.Client()
        bucket = gcs_client.bucket(bucket_name)

        now = datetime.now(timezone.utc)
        prefix = f"raw/{now.strftime('%Y/%m/%d')}"

        results = []
        for url in urls:
            try:
                # Use Reddit's JSON API to get post content
                json_url = url.rstrip("/") + ".json"
                req = urllib.request.Request(json_url, headers={
                    "User-Agent": "proceedings-bot/1.0 (immigration research)"
                })
                with urllib.request.urlopen(req, timeout=15, context=ctx) as resp:
                    data = json.loads(resp.read().decode())

                # Extract post data
                post_data = data[0]["data"]["children"][0]["data"]
                title = post_data.get("title", "")
                selftext = post_data.get("selftext", "")
                author = post_data.get("author", "")
                subreddit = post_data.get("subreddit", "")
                score = post_data.get("score", 0)
                created = post_data.get("created_utc", 0)

                # Extract top comments
                comments = []
                if len(data) > 1:
                    for comment in data[1]["data"]["children"][:10]:
                        if comment.get("kind") == "t1":
                            body = comment["data"].get("body", "")
                            c_author = comment["data"].get("author", "")
                            c_score = comment["data"].get("score", 0)
                            if body and len(body) > 20:
                                comments.append(f"**u/{c_author}** (score: {c_score}):\n{body}")

                # Build markdown content
                md_parts = [f"# {title}\n"]
                md_parts.append(f"**Subreddit:** r/{subreddit} | **Author:** u/{author} | **Score:** {score}\n")
                if selftext:
                    md_parts.append(f"\n{selftext}\n")
                if comments:
                    md_parts.append(f"\n---\n\n## Top Comments\n")
                    for c in comments:
                        md_parts.append(f"\n{c}\n")

                md = "\n".join(md_parts)

                if len(md.strip()) < 100:
                    results.append({"url": url, "gcs_path": "", "raw_text": "", "status": "skipped"})
                    continue

                # Write to GCS
                slug = re.sub(r"[^a-zA-Z0-9\-]", "-", post_data.get("id", "unknown"))
                filename = f"reddit-r-{subreddit}-{slug}.md".lower()

                content = f"---\nsource_url: {url}\nsubreddit: r/{subreddit}\nauthor: u/{author}\nscore: {score}\ncrawled_at: {now.isoformat()}\n---\n\n{md}"
                blob = bucket.blob(f"{prefix}/{filename}")
                blob.upload_from_string(content, content_type="text/markdown")

                gcs_path = f"gs://{bucket_name}/{prefix}/{filename}"
                results.append({"url": url, "gcs_path": gcs_path, "raw_text": md, "status": "success"})

            except Exception as e:
                results.append({"url": url, "gcs_path": "", "raw_text": "", "status": "failed", "error": str(e)[:100]})
            time.sleep(1)

        return results

    def _label_content(self, content: str) -> dict:
        """Label content using Gemini with the immigration taxonomy."""
        categories_str = "\n".join([f"- {c['id']}: {c['name']}" for c in CATEGORIES])
        prompt = LABELING_PROMPT.format(
            categories=categories_str,
            content=content[:15000],
        )

        try:
            from google import genai as genai_module

            response = self.client.models.generate_content(
                model=self.model,
                contents=prompt,
                config=genai_module.types.GenerateContentConfig(
                    temperature=0.1,
                    max_output_tokens=2048,
                ),
            )

            text = response.text
            if not text:
                return {"labels": ["general-immigration-info"], "confidence": 0.0}

            text = text.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()

            result = json.loads(text)
            labels = [l for l in result.get("labels", []) if l in VALID_LABELS]
            if not labels:
                labels = ["general-immigration-info"]

            return {
                "labels": labels,
                "confidence": min(1.0, max(0.0, float(result.get("confidence", 0.5)))),
            }

        except Exception as e:
            print(f"  Label error: {e}")
            return {"labels": ["general-immigration-info"], "confidence": 0.0}
