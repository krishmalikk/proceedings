"""
Reddit Scraping Orchestrator Agent — Imm Specifications Architecture
=====================================================================
Per spec: Agent calls Cloud Run Scraper Tool → Scraper returns {gcs_path, raw_text}
→ Agent injects raw_text into Labeling Prompt → Returns structured JSON matching
the ImmigrationPost schema.

Follows Agent Engine contract: __init__, set_up, query.
"""

import json
import re
import ssl
import time
import urllib.request
from datetime import datetime, timezone

# Reddit subreddits for immigration content
DEFAULT_SUBREDDITS = [
    "h1b", "immigration", "USCIS", "greencard", "f1visa", "askimmigration",
]

# The labeling prompt that produces the exact JSON format from the spec
LABELING_PROMPT = """You are an expert US immigration content analyst. Analyze the following Reddit post and extract structured metadata.

You MUST return a valid JSON object with EXACTLY these fields:

{{
  "current_visa_or_greencard_category": ["<visa category if mentioned, e.g. L-1A, H-1B, F-1>"],
  "current_nationality": "<ISO 3166-1 alpha-3 code if mentioned, e.g. IND, CHN, MEX. Use UNK if unknown>",
  "current_resident_of_country": "<ISO 3166-1 alpha-3 code, usually USA. Use UNK if unknown>",
  "visa_or_greencard_applying_for": ["<target visa/GC category if mentioned, e.g. H-1B, EB-2>"],
  "background_summary": "<2-3 sentence summary of the poster's immigration situation>",
  "consulate": "<country name if consular processing mentioned, null if not>",
  "tags": ["<relevant tags from: h1b-visa, h1b-lottery, h1b-transfer, premium-processing, rfe-response, grace-period, change-of-status-COS, layoff-immigration, f1-student, student-visa, OPT, stem-opt, cap-gap, visa-stamping, consular-processing, adjustment-of-status, family-based-immigration, employment-based-immigration, eb5-investor-visa, diversity-visa-lottery, naturalization-citizenship, daca, tps, asylum-refugees, deportation-defense, work-authorization, EAD, travel-documents, visa-fees, immigration-court, humanitarian-parole, 221g, visa-interview, visa-expired, overstay, LCA, PERM, NIW, I-140, I-485, I-130, I-765, N-400>"],
  "concerns_or_questions_tag_list": ["<tags specific to the questions/concerns raised>"],
  "concerns_or_questions_summary": "<1-2 sentence summary of what the poster is asking or worried about>",
  "key_stages_or_info": {{"<stage_name>": "<status: pending/approved/denied/filed/N/A>"}},
  "key_dates": {{"<date_name>": "<date in MM/DD/YYYY or YYYY-MM-DD format>"}},
  "confidence_score": <0-100 integer indicating your confidence in the extraction>
}}

RULES:
- Extract ONLY what is explicitly stated or strongly implied in the text
- Use "UNK" for nationality/country if not mentioned
- Use empty arrays [] if no visa categories are mentioned
- Use empty dicts {{}} if no key dates or stages are mentioned
- Tags should use the exact tag IDs listed above
- confidence_score: 90+ if post clearly states visa type and situation, 50-89 if partially clear, <50 if vague
- Do NOT hallucinate information not in the text

CONTENT:
{content}

JSON:"""


class RedditScrapingAgent:
    """
    Orchestrator agent per Imm Specifications:
    1. Discovers recent Reddit post URLs
    2. Calls Cloud Run Scraper Tool (or scrapes locally)
    3. Injects raw_text into Labeling Prompt
    4. Returns structured JSON matching ImmigrationPost schema
    """

    def __init__(self, model="gemini-2.5-flash", project=None, location=None, scraper_url=None):
        self.model = model
        self.project = project
        self.location = location
        self.scraper_url = scraper_url
        self.client = None

    def set_up(self):
        from google import genai
        self.client = genai.Client(
            vertexai=True,
            project=self.project,
            location=self.location,
        )

    def query(self, *, urls: list[str] = None, subreddits: list[str] = None,
              posts_per_sub: int = 25, sort_modes: list[str] = None) -> dict:
        """
        Orchestrate: discover URLs → scrape → label with structured JSON.

        Returns list of ImmigrationPost-format JSON objects.
        """
        if self.client is None:
            self.set_up()

        # Step 1: Get URLs
        if urls:
            target_urls = urls
        elif subreddits:
            target_urls = self._discover_reddit_urls(subreddits, posts_per_sub, sort_modes)
        else:
            target_urls = self._discover_reddit_urls(DEFAULT_SUBREDDITS, posts_per_sub, sort_modes)

        if not target_urls:
            return {"scraped": [], "total": 0, "succeeded": 0, "failed": 0}

        # Step 2: Call Scraper Tool
        scrape_results = self._call_scraper(target_urls)

        # Step 3: Label each result with structured JSON
        labeled_results = []
        for result in scrape_results:
            if result.get("status") != "success" or not result.get("raw_text"):
                labeled_results.append({
                    **result,
                    "labeled_json": None,
                })
                continue

            # Inject raw_text into Labeling Prompt
            labeled_json = self._label_content(
                raw_text=result["raw_text"],
                source_url=result.get("source_url", ""),
                source_uri=result.get("source_uri", ""),
                full_url=result.get("full_url", ""),
                gcs_path=result.get("gcs_path", ""),
            )

            labeled_results.append({
                **result,
                "labeled_json": labeled_json,
            })
            time.sleep(2)

        succeeded = sum(1 for r in labeled_results if r.get("status") == "success")

        return {
            "scraped": labeled_results,
            "total": len(target_urls),
            "succeeded": succeeded,
            "failed": len(target_urls) - succeeded,
        }

    def _discover_reddit_urls(self, subreddits: list[str], posts_per_sub: int = 25,
                               sort_modes: list[str] = None) -> list[str]:
        """Discover post URLs from Reddit subreddits."""
        if sort_modes is None:
            sort_modes = ["new", "hot", "top"]

        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE

        seen_ids = set()
        urls = []

        for sub in subreddits:
            sub_urls = []
            for sort in sort_modes:
                try:
                    params = f"limit={posts_per_sub}"
                    if sort == "top":
                        params += "&t=all"

                    api_url = f"https://old.reddit.com/r/{sub}/{sort}.json?{params}"
                    req = urllib.request.Request(api_url, headers={
                        "User-Agent": "proceedings-bot/1.0 (immigration research)"
                    })
                    with urllib.request.urlopen(req, timeout=15, context=ctx) as resp:
                        data = json.loads(resp.read().decode())

                    posts = data.get("data", {}).get("children", [])
                    for post in posts:
                        post_id = post.get("data", {}).get("id", "")
                        permalink = post.get("data", {}).get("permalink", "")
                        if permalink and post_id not in seen_ids:
                            seen_ids.add(post_id)
                            sub_urls.append(f"https://old.reddit.com{permalink}")
                except Exception as e:
                    print(f"  Warning: Could not fetch r/{sub}/{sort}: {e}")

                time.sleep(1)

            print(f"  r/{sub}: found {len(sub_urls)} unique posts")
            urls.extend(sub_urls)

        print(f"  Total unique posts discovered: {len(urls)}")
        return urls

    def _call_scraper(self, urls: list[str]) -> list[dict]:
        """Call Cloud Run Scraper Tool or scrape locally."""
        if self.scraper_url:
            try:
                payload = json.dumps({"urls": urls}).encode()
                req = urllib.request.Request(
                    f"{self.scraper_url}/scrape",
                    data=payload,
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )
                ctx = ssl.create_default_context()
                ctx.check_hostname = False
                ctx.verify_mode = ssl.CERT_NONE
                with urllib.request.urlopen(req, timeout=600, context=ctx) as resp:
                    data = json.loads(resp.read().decode())
                return data.get("data", [])
            except Exception as e:
                print(f"  Scraper call failed: {e}, falling back to local")

        return self._scrape_locally(urls)

    def _scrape_locally(self, urls: list[str]) -> list[dict]:
        """Scrape Reddit URLs locally using JSON API."""
        import os
        import uuid as uuid_mod
        from urllib.parse import urlparse

        from google.cloud import storage as gcs

        bucket_name = os.getenv("GCP_BUCKET_NAME", "law-firm-knowledge-base")
        gcs_client = gcs.Client()
        bucket = gcs_client.bucket(bucket_name)

        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE

        now = datetime.now(timezone.utc)
        date_folder = now.strftime("%Y-%m-%d")

        results = []
        for url in urls:
            parsed = urlparse(url)
            source_url = f"{parsed.scheme}://{parsed.netloc}"
            source_uri = parsed.path.strip("/")

            try:
                # Use Reddit JSON API
                json_url = url.rstrip("/") + ".json"
                req = urllib.request.Request(json_url, headers={
                    "User-Agent": "proceedings-bot/1.0 (immigration research)"
                })
                with urllib.request.urlopen(req, timeout=15, context=ctx) as resp:
                    data = json.loads(resp.read().decode())

                post_data = data[0]["data"]["children"][0]["data"]
                title = post_data.get("title", "")
                selftext = post_data.get("selftext", "")
                author = post_data.get("author", "")
                subreddit = post_data.get("subreddit", "")
                score = post_data.get("score", 0)

                # Build markdown
                md_parts = [f"# {title}\n", f"**Subreddit:** r/{subreddit} | **Author:** u/{author} | **Score:** {score}\n"]
                if selftext:
                    md_parts.append(f"\n{selftext}\n")

                # Top comments
                if len(data) > 1:
                    comments = []
                    for c in data[1]["data"]["children"][:10]:
                        if c.get("kind") == "t1":
                            body = c["data"].get("body", "")
                            if body and len(body) > 20:
                                comments.append(f"**u/{c['data'].get('author', '')}** (score: {c['data'].get('score', 0)}):\n{body}")
                    if comments:
                        md_parts.append("\n---\n\n## Top Comments\n")
                        md_parts.extend(f"\n{c}\n" for c in comments)

                md = "\n".join(md_parts)
                if len(md.strip()) < 100:
                    results.append({"source_url": source_url, "source_uri": source_uri, "full_url": url, "gcs_path": "", "raw_text": "", "status": "skipped"})
                    continue

                # Write to GCS
                file_id = str(uuid_mod.uuid4())[:8]
                blob_name = f"raw/{date_folder}/{file_id}_content.md"
                gcs_path = f"gs://{bucket_name}/{blob_name}"

                content = f"---\nsource_url: {url}\ncrawled_at: {now.isoformat()}\n---\n\n{md}"
                blob = bucket.blob(blob_name)
                blob.upload_from_string(content, content_type="text/markdown")

                results.append({
                    "source_url": source_url,
                    "source_uri": source_uri,
                    "full_url": url,
                    "gcs_path": gcs_path,
                    "raw_text": md,
                    "status": "success",
                })

            except Exception as e:
                results.append({"source_url": source_url, "source_uri": source_uri, "full_url": url, "gcs_path": "", "raw_text": "", "status": "failed", "error": str(e)[:100]})
            time.sleep(1)

        return results

    def _label_content(self, raw_text: str, source_url: str, source_uri: str,
                       full_url: str, gcs_path: str) -> dict:
        """
        Inject raw_text into Labeling Prompt. Returns the spec JSON format.
        """
        prompt = LABELING_PROMPT.format(content=raw_text[:15000])
        now = datetime.now(timezone.utc)

        try:
            from google import genai as genai_module

            response = self.client.models.generate_content(
                model=self.model,
                contents=prompt,
                config=genai_module.types.GenerateContentConfig(
                    temperature=0.1,
                    max_output_tokens=4096,
                ),
            )

            text = response.text
            if not text:
                return self._default_label(source_url, source_uri, full_url, gcs_path, now)

            text = text.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()

            labeled = json.loads(text)

            # Merge provenance fields
            labeled["source_system"] = "reddit" if "reddit" in source_url.lower() else "web_crawl"
            labeled["source_url"] = source_url
            labeled["source_uri"] = source_uri
            labeled["full_url"] = full_url
            labeled["gcs_path"] = gcs_path
            labeled["ingestion_timestamp"] = now.strftime("%Y-%m-%d %H:%M:%S")
            labeled.setdefault("posting_date", now.strftime("%Y-%m-%d"))
            labeled["source_metadata"] = f"scraped from {source_url}"

            return labeled

        except Exception as e:
            print(f"  Label error: {e}")
            return self._default_label(source_url, source_uri, full_url, gcs_path, now)

    def _default_label(self, source_url, source_uri, full_url, gcs_path, now):
        """Return a minimal valid label when extraction fails."""
        return {
            "source_system": "reddit" if "reddit" in source_url.lower() else "web_crawl",
            "source_url": source_url,
            "source_uri": source_uri,
            "full_url": full_url,
            "current_visa_or_greencard_category": [],
            "current_nationality": "UNK",
            "current_resident_of_country": "UNK",
            "visa_or_greencard_applying_for": [],
            "background_summary": "",
            "consulate": None,
            "tags": ["general-immigration-info"],
            "concerns_or_questions_tag_list": [],
            "concerns_or_questions_summary": "",
            "key_stages_or_info": {},
            "key_dates": {},
            "posting_date": now.strftime("%Y-%m-%d"),
            "ingestion_timestamp": now.strftime("%Y-%m-%d %H:%M:%S"),
            "confidence_score": 0,
            "source_metadata": "",
            "gcs_path": gcs_path,
        }
