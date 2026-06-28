# Reddit Ingestion — Alternatives & Cost Analysis (API blocked)

**Status:** Evaluation / decision-pending
**Last updated:** 2026-06-19
**Context owner:** see MEMORY.md (D-012, D-022, D-026, D-039)

> **Why this doc exists.** The official Reddit Data API path (PRAW, the project's
> chosen approach in [D-012](../../MEMORY.md)/[D-022](../../MEMORY.md)) is
> **blocked**. As of late-2025 Reddit **disabled self-serve app creation**:
> `reddit.com/prefs/apps` → "create app" now bounces to the **Responsible Builder
> Policy** and all Data API access sits behind a **manual approval process**. A
> non-commercial Data API access ticket was **filed ~2026-05 (one month ago) with
> no response**. This doc captures the alternative ways to get Reddit content
> flowing, with real costs for the paid options, so we can pick a path instead of
> waiting indefinitely.

---

## 1. The two tracks

| | **Track 1 — Unblocked now (no Reddit approval)** | **Track 2 — Paid Reddit content at scale** |
|---|---|---|
| Goal | Keep the product moving today, ToS-clean | Automated, scalable Reddit ingestion |
| Approval needed | None | None (3rd-party) / Yes-but-paid (official) |
| Time to start | Immediate | Hours–days (3rd-party) / weeks (official) |
| Best for | Seeding quality content, building the moat | Volume Reddit coverage once justified |

The recommended posture is **run Track 1 now**, and pick a Track 2 option **only if/when** Reddit volume is worth paying for. They are not mutually exclusive.

---

## 2. Track 1 — Unblocked-now options (no Reddit approval, no/low cost)

These need **zero** Reddit approval and are either free or labor-only. Two of the
three are the project's *own* designed-but-unbuilt work, so they advance the
roadmap rather than being throwaway.

### 1-A. Lean on DS-2 (public website data store) — **recommended primary**
- **What:** The Vertex AI Search *website* data store decided in [D-039](../../MEMORY.md) — Google crawls/indexes public gov + law-firm sites (USCIS, travel.state.gov, dol.gov, …); we run **no** scraper/ingest pipeline.
- **Covers:** A large share of the "answer immigration questions" use case.
- **Approval / ToS:** None — Google-crawled public content. No Reddit dependency.
- **Cost:** Managed Vertex AI Search query pricing only (already in the budget); **no ingestion cost, no always-on node** (consistent with D-016).
- **Status:** Decided, "implementation pending P1." Highest-leverage unblocked work.

### 1-B. First-party app content (`channel="app"`) — **the long-term moat**
- **What:** User-authored postings/experiences via the app, already built ([D-034](../../MEMORY.md)/[D-050](../../MEMORY.md)/[D-051](../../MEMORY.md)).
- **Covers:** The experiential, "same-boat" peer content Reddit was meant to seed — except we **own** it and it's compliant by construction.
- **Approval / ToS:** None — our own users, our own consent flow ([D-038](../../MEMORY.md) PII consent).
- **Cost:** Already in the live backend; marginal.

### 1-C. Human-curated manual ingestion — **stopgap for Reddit specifically**
- **What:** The proven manual-batch path ([D-026](../../MEMORY.md)) that built the current 82-doc corpus — a human selects high-value **public** Reddit threads, the pipeline stores **paraphrases + controlled-vocab tags** (not verbatim dumps, per [D-017](../../MEMORY.md)).
- **Approval / ToS:** Cleanest posture for a legal-domain product (manual reading of public content; no automated collection).
- **Cost:** Labor only. Doesn't scale, but seeds quality immediately.

### 1-D. Public JSON / RSS endpoints — **dev/smoke only, NOT production**
- **What:** Unauthenticated `https://www.reddit.com/r/<sub>/new.json`, `/comments/<id>.json` (~10 req/min, returns full structured JSON incl. `score`/comments/ids), or `/r/<sub>/.rss` (no upvotes/comments).
- **Approval / ToS:** ⚠️ **Against Reddit's automated-access ToS at production scale.** [`PREREQUISITES-IAM-INFRASTRUCTURE.md §7`](PREREQUISITES-IAM-INFRASTRUCTURE.md) sanctions it **for local dev and smoke tests only — never production/backfill.**
- **Use:** Build & validate the Scraper → tag → GCS → datastore flow against real post shapes, so swapping to PRAW (or a paid provider) later is a one-line auth change.
- **Cost:** Free.

---

## 3. Track 2 — Paid options (costs)

> Volume basis for the estimates below comes from the project's own figures in
> [`REDDIT-INGESTION-PIPELINE.md §7.6`](REDDIT-INGESTION-PIPELINE.md): **~5,000
> posts/month** at pilot, and an illustrative **~50,000 posts/month** at
> production scale. Pipeline request volume is low (3 subreddits, forward-only;
> ~hundreds–low-thousands of API calls/day).

### 3-A. Official Reddit **Commercial / Enterprise Data API** — compliant, expensive
- **Pricing (published baseline, 2026):** ~**$0.24 per 1,000 API calls** above free allowances; commercial tiers carry **large minimum commitments** — reported around **$12,000/month for up to 50M calls**, with rate-tier variants (~$24k for 200 RPM, ~$60k for 500 RPM) and **enterprise pricing negotiated** individually.
- **At our volume:** Our *usage* would be trivial (~tens of thousands of calls/mo ≈ a few dollars at $0.24/1k) — but the **minimum commitment dwarfs it.** This tier is built for AI-training-scale buyers, **not** a pilot.
- **Compliance:** ✅ The only **fully-licensed, first-party** path. Contractual right to the data; deletion/attribution terms are explicit.
- **Verdict:** Only worth it at large scale or if a license is contractually required. **Disproportionate for the pilot.** ⚠️ Figures conflict across sources ($12k/month vs $12k/year in different write-ups) — **confirm directly with Reddit sales** before relying on any number.

### 3-B. Third-party scraping providers — pragmatic, mid-cost
Marketplace/managed scrapers that handle Reddit for you. **They** operate the
scraping; you consume results via their API/dataset.

| Provider / actor | Unit price | Pilot (5k posts/mo) | Production (50k/mo) | Platform fee |
|---|---|---|---|---|
| **Apify** — `prodiger/reddit-scraper` | $1.15/1k posts (→ $0.28/1k at top tier); ~$0.58/1k comments | ~**$6/mo** | ~**$58/mo** (less at higher tiers) | Free tier (~$5 credit) → Starter ~$39/mo → Scale ~$199/mo |
| **Apify** — `parseforge/reddit-posts-scraper` | $3/1k results | ~$15/mo | ~$150/mo | (as above) |
| **Apify** — `trudax/reddit-scraper` | from $2/1k results | ~$10/mo | ~$100/mo | (as above) |
| **Bright Data** — Web Scraper / Reddit dataset | ~$3/1k page loads; pay-per-success from $0.75/1k; datasets custom-priced | ~$4–15/mo | ~$40–150/mo | No monthly commitment option |

- **All-in pilot estimate (3rd-party):** roughly **$40–$65/month** (Apify Starter sub + ~5k posts usage) — comparable to the pipeline's own ~$25–35/mo compute/LLM budget.
- **Compliance:** ⚠️ **Shifts but does not erase risk.** The provider scrapes Reddit (and assumes that operational risk), but as the **data consumer** you are still using Reddit content obtained outside the official API. Reddit has **sued scrapers** (Anthropic, SerpApi) and blocks aggregators. For a **legal-domain** product, weigh this carefully — it is *not* equivalent to the licensed 3-A path.
- **Verdict:** The **fast + scalable + low-cost** option, with a residual ToS/legal risk that 3-A removes.

### 3-C. Devvit (Reddit Developer Platform) — **rejected, do not pursue**
- Easy/fast approval, free — **but** Devvit apps run on **Reddit's** hosting inside installed subreddit apps, **not** as an external GCP pipeline writing to our GCS/BigQuery. Adopting it means abandoning the GCP architecture. Already rejected in [D-012](../../MEMORY.md)/[D-022](../../MEMORY.md). Listed here only so the option isn't re-litigated.

---

## 4. Side-by-side summary

| Option | Approval | ToS / legal posture | Structured data (upvotes/comments) | Cost @ pilot | Scales? | Time to start |
|---|---|---|---|---|---|---|
| 1-A DS-2 public sites | None | ✅ Clean | n/a (different source) | $0 extra | ✅ | Now (build) |
| 1-B First-party app | None | ✅ Clean (owned) | n/a | ~$0 | ✅ | Built |
| 1-C Manual curation | None | ✅ Cleanest for Reddit | ✅ (human) | Labor | ❌ | Now |
| 1-D Public JSON/RSS | None | ⚠️ Dev/smoke only | ✅ JSON / ❌ RSS | $0 | ❌ (not prod) | Now |
| 3-A Official commercial API | Yes (paid) | ✅ Licensed | ✅ Full | **~$12k/mo floor** | ✅✅ | Weeks |
| 3-B 3rd-party scraper | None | ⚠️ Residual risk | ✅ Full | **~$40–65/mo** | ✅ | Hours–days |
| 3-C Devvit | Easy | ✅ | ✅ | Free | n/a | — (rejected) |

---

## 5. Recommendation

1. **Now (Track 1):** Build **DS-2 (1-A)** — the highest-value, fully-compliant, already-decided unblocked work — and keep growing **first-party app content (1-B)**. Use **manual curation (1-C)** to seed any must-have Reddit threads. Build the Scraper against **public JSON (1-D) in dev** so the automated path is ready.
2. **Parallel:** Re-file / escalate the Reddit ticket framed explicitly as **non-commercial / research** (lighter review).
3. **Track 2 decision — only when Reddit volume is justified:**
   - If budget is tight and some residual ToS risk is acceptable → **3-B (Apify/Bright Data), ~$40–65/mo at pilot.**
   - If a **fully-licensed** posture is required (legal-domain caution) and scale/budget justify it → **3-A official commercial API** — but **confirm real pricing with Reddit sales first**; the public baseline implies a minimum commitment far above pilot needs.

**Bottom line:** Reddit is one *channel*, not the product. The schema is channel-agnostic ([D-036](../../MEMORY.md)), so Reddit can be added later with zero rework. Don't let a blocked free API stall the roadmap — Track 1 advances the product today.

---

## 6. References
- [REDDIT-INGESTION-PIPELINE.md](REDDIT-INGESTION-PIPELINE.md) — pipeline spec, §3.5/§7.6 (Reddit access + cost)
- [PREREQUISITES-IAM-INFRASTRUCTURE.md §7](PREREQUISITES-IAM-INFRASTRUCTURE.md) — Reddit access runbook + dev-only public-JSON sanction
- MEMORY.md — D-012 (PRAW/Devvit), D-022 (approval critical-path), D-026 (manual batch), D-016/D-039 (managed sinks, DS-2), D-017 (paraphrase posture), D-036 (channel-agnostic schema)
- External pricing/policy (retrieved 2026-06-19):
  - Reddit commercial API pricing — [techloy](https://www.techloy.com/reddit-api-pricing-in-2026-complete-guide-for-developers-and-businesses/), [PainOnSocial](https://painonsocial.com/blog/how-much-does-reddit-api-cost)
  - Reddit API vs Apify (cost/throughput/compliance) — [redditapis.com](https://www.redditapis.com/blogs/reddit-api-pricing-vs-apify)
  - Apify Reddit scrapers — [prodiger](https://apify.com/prodiger/reddit-scraper), [parseforge](https://apify.com/parseforge/reddit-posts-scraper), [trudax](https://apify.com/trudax/reddit-scraper)
  - Bright Data pricing — [Bright Data web scraping APIs](https://brightdata.com/blog/web-data/best-web-scraping-apis)
  - Self-serve API shutdown — [RedditorShop](https://redditorshop.com/blog/the-end-of-the-self-serve-reddit-api-why-you-can-t-create-an-api-key-in-2026), [Responsible Builder Policy](https://support.reddithelp.com/hc/en-us/articles/42728983564564-Responsible-Builder-Policy)
</content>
</invoke>
