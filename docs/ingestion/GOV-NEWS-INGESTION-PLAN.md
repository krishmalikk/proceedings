# Government Agency News Ingestion — Approach (starting with USCIS)

**Status:** PLANNING — for review. **No code implemented yet.**
**Scope:** One source to start — USCIS "All News" (`uscis.gov/newsroom/all-news`) — designed so a second agency (DOL, `travel.state.gov`, …) is a config addition, not a redesign.

> **Why this doc exists.** New functionality requested: ingest official news/
> updates from government immigration agencies, tag them the same way as
> existing postings, and surface them in a dedicated News tab on website +
> mobile with reply/comment support. This documents what the source actually
> offers (checked directly, not assumed) and a concrete approach built on
> the existing pipeline rather than a new one.

---

## 1. What the source actually offers (checked directly)

Loaded `uscis.gov/newsroom/all-news` in a real browser (a plain HTTP fetch got
`403` — USCIS has bot-fingerprint detection on the HTML page itself, same
category of block seen on Reddit) and found:

- **An official RSS feed**: `https://www.uscis.gov/news/rss-feed/59144`,
  linked directly on the page ("Click to subscribe to this RSS Feed"). This
  loaded via plain HTTP with no bot-detection issue — RSS is a sanctioned,
  designed-for-this syndication mechanism, not a workaround.
- **Feed content** (standard RSS 2.0, verified against the live feed):
  `title`, `link` (canonical article permalink), `description` (a full
  paragraph, not just a headline snippet), `pubDate` (RFC-822, includes
  timezone — the real, original publish timestamp), `dc:creator` (`"USCIS"`),
  and `guid` (a stable UUID, `isPermaLink="false"` — a proper dedup key
  independent of the URL).
- **`robots.txt`**: `/newsroom/`, `/news/rss-feed/`, and article permalinks
  are **not disallowed**. Only a generic `Crawl-delay: 10` applies (trivial
  to satisfy — polling every 15–60 min is one request per poll, not a crawl).
  The specific disallowed paths are unrelated admin/export/search endpoints.
- **~303 total articles** in "All News", recent cadence looks like roughly
  2–5 new items/week from the visible dates (this will vary with news cycle).
- The page also exposes a rich **category taxonomy** (~70 options in the
  filter dropdown — "H-1B Specialty Occupations", "Premium Processing",
  "Public Charge", "Naturalization (Form N-400)", etc.) but **this taxonomy
  is not present in the RSS item fields themselves** — only on the HTML page.
  Getting it would mean either scraping the article page per item (more
  requests, more fragility) or deriving our own tags from title+description
  the same way the existing pipeline already does (see §3).

## 2. Legal posture — meaningfully cleaner than the Reddit case

This is a different situation from the Reddit ingestion work
([`REDDIT-INGESTION-ALTERNATIVES.md`](REDDIT-INGESTION-ALTERNATIVES.md)),
not a variant of it:

- **Public domain by statute.** USCIS is a U.S. federal agency; under
  17 U.S.C. § 105, works of the U.S. federal government are **not subject to
  copyright**. Unlike Reddit content (D-017's paraphrase-only posture, driven
  by real copyright/ToS exposure), there is no copyright reason to avoid
  storing full article text verbatim.
- **Officially syndicated, not scraped.** The RSS feed is a first-party
  mechanism USCIS built and links publicly for exactly this purpose — polling
  it isn't circumventing anything, unlike the Reddit JSON-endpoint block or
  the rejected Claude-Skill/Redlib route
  ([`REDDIT-INGESTION-ALTERNATIVES.md` §1-D, §1-E](REDDIT-INGESTION-ALTERNATIVES.md)).
- **`robots.txt`-clean**, as confirmed above.
- **Practical implication:** this is the one Reddit-adjacent idea in this
  project that can legitimately run as a **real, unattended, scheduled
  pipeline** — no human-curation bottleneck, no paraphrase requirement. This
  is the biggest structural difference from every Reddit option evaluated so
  far.

## 3. Proposed pipeline design — extend `posting.py`, don't fork it

Mirrors the shape of Path B (`publish_reddit_posting()`,
[`PATH-B-PROVENANCE-PLAN.md`](PATH-B-PROVENANCE-PLAN.md)) rather than
inventing new infrastructure — same canonical schema, same GCS→Discovery
Engine→BigQuery fan-out, same tagging model.

### 3.1 New provenance values (additive, no schema change)

| Field | Value | Notes |
|---|---|---|
| `channel` | `"gov_news"` | New coarse bucket, parallel to existing `"app"`/`"reddit"`. Add a third `Cond` boost line in `search_client.py` (mirrors the existing `channel: ANY("app")`/`ANY("reddit")` lines at [`search_client.py:89-90`](../../backend/search_client.py)). |
| `source_system` | `"uscis"` | Agency-specific — `"dol"`, `"state-dept"`, etc. for future agencies. This is the field that actually scales to "relevant government agencies" plural without a redesign. |
| `ingestion_method` | `"rss_feed"` (new value) | The Path B doc reserved `"automated_scrape"`/`"official_api"` as future values — neither quite fits. RSS is sanctioned syndication, closer in spirit to `"official_api"` but structurally distinct enough (no auth, no request quota) to warrant its own explicit value rather than overload one of those. |
| `doc_kind` | `"gov_news"` (new value) | Parallel to existing `"post"`/`"experience"`/`"connect_card"` ([`posting.py:920,1318,1364`](../../backend/posting.py)). |
| `posting_date` | RSS `pubDate` | **Free and accurate for every item** — unlike Reddit, no manual entry needed; this is the real original publish date straight from the source. |
| `full_url` | RSS `link` | Already a generic field — exact fit, no schema change. |
| `subreddit` / `reddit_post_id` | unused (`""`) | Reddit-specific; harmless to leave blank, same as how `channel="app"` postings already leave them blank today. |
| *(new)* `source_item_id` | RSS `guid` | Needed as the **dedup key** — `guid` is stable and URL-independent (USCIS could restructure URLs without breaking dedup). Case for one new field, since nothing existing fits this role cleanly. |
| `case_id` | `f"gov-uscis-{date_str}-{short(guid)}"` | Deterministic from `guid`, same dedup-by-construction pattern as the Reddit `reddit-{date}-{subreddit}-{post_id}` scheme. |

### 3.2 New function: `publish_gov_news_item()`

Same publish orchestration as `publish_posting()`/`publish_reddit_posting()`
(canonical → validate → GCS → Discovery Engine → BigQuery), but:
- Takes an RSS item (title, description, link, pubDate, guid, source agency
  slug) instead of user-submitted fields.
- Skips `scrub_pii()`/`moderation.check_text()` — same reasoning as Path B
  (this is official government content, not a live user submission).
- **Can store full article text**, not just the RSS description, if fetching
  the article page turns out to matter for tag/search quality (open question,
  §5). Either way there's no paraphrase requirement.
- **Deterministically adds the `news-update` tag** to every item it
  publishes — see §3.4. Not left to the Gemini tagger to remember, same
  reasoning as the existing deterministic `timeline` tag (added whenever
  `key_dates` is present, [`posting.py:842-843`](../../backend/posting.py)) and
  `family-based-immigration` (added whenever an I-130 tag is present,
  [`posting.py:857-858`](../../backend/posting.py)) — both single-point-of-truth
  backfills rather than relying on model judgment for something that should
  never be inconsistent.

### 3.3 Tagging — reuse the existing Gemini extraction, don't build a new one

Since the USCIS category taxonomy doesn't travel with the RSS item, run
title+description (or full article text, if fetched) through the **existing**
`_extract()`/`suggest_tags()` pipeline ([`posting.py`](../../backend/posting.py)) — the same
Gemini-based tagger already used for every posting today, against the same
controlled vocabulary. This is the single biggest reason this is cheap to
build: zero new tagging infrastructure, zero new vocabulary.

### 3.4 `news-update` tag — decided (resolves §5 #1 below)

**Decision:** general policy/news content that doesn't represent a personal
visa/status claim (e.g. *"DHS Announces Move to Revoke Citizenship from 10
Naturalized Criminals"*) gets a new controlled tag, **`news-update`**. When
that tag is present, `validate()` no longer requires
`current_visa_or_greencard_category`/`visa_applying_for` to be non-empty.

Implementation shape:
- New vocab entry in `tags-cleaned/1.10-common-misc.csv` (the same
  cross-cutting bucket `premium-processing`/`pp-clock` already live in —
  §1.10 in this repo's own controlled vocabulary is exactly the "doesn't
  belong to one visa" bucket).
- `publish_gov_news_item()` adds `news-update` to every item's `tags`
  deterministically (§3.2) — it's a property of the *source* (this is a gov
  news item, full stop), not something to leave to the model's per-item
  judgment.
- `validate()` ([`posting.py:728-733`](../../backend/posting.py)) gets one
  additional condition: skip the visa/status-required check when
  `"news-update" in c.get("tags", [])`. A gov-news item that *also*
  genuinely ties to a specific visa (like the H-1B cap alert) still gets
  tagged with that visa normally via the existing Gemini extraction — the
  bypass only kicks in when no visa tag was found at all, so no signal is
  lost for the items that do have one.

## 4. Automation design (sketch — this can genuinely run unattended)

```
Cloud Scheduler (e.g. every 30–60 min)
  → Cloud Run job / Cloud Function
      1. Fetch https://www.uscis.gov/news/rss-feed/59144
      2. Parse items; for each, check `source_item_id` (guid) against
         already-ingested case_ids (a cheap BigQuery/Firestore existence
         check, same dedup pattern as Reddit's deterministic case_id)
      3. For each NEW item: publish_gov_news_item(...)
      4. Log a run summary (items seen / new / published / failed)
```

No credentials, no auth, no per-request cost beyond the Cloud Run
invocation — the cheapest ingestion path in this project by a wide margin,
because the source wants to be polled.

## 5. Open design questions

1. ~~`validate()`'s "capture a visa/status" rule doesn't fit general policy
   news.~~ **Decided — see §3.4.** New `news-update` tag, deterministically
   applied to every gov-news item; `validate()` skips the visa/status
   requirement whenever that tag is present. Items that do tie to a specific
   visa (e.g. the H-1B cap alert) still get that visa tagged normally
   alongside it.
2. **RSS description vs. full article text.** The RSS `description` is a
   real paragraph (not just a headline), which may be enough for both
   tagging and display. Fetching the full article page adds one more request
   per new item (trivial at this volume) for richer search grounding. Worth
   a quick quality check on a sample before deciding either way.
3. **`author_handle` doesn't have an obvious value for gov content.** Every
   existing `doc_kind` has a human (real or synthetic) author, which also
   drives author-profile pages elsewhere in the app. A fixed system handle
   (e.g. `"USCIS"`, matching the feed's own `dc:creator`) is the obvious
   default — flagging in case the author-profile surface needs to special-case
   non-human authors.
4. **Category-taxonomy mapping.** The ~70 USCIS categories are richer than
   what Gemini extraction alone would infer from title+description. Worth
   deciding later whether it's worth the extra per-item request to scrape
   each article page's category chip, or whether Gemini-derived tags are
   good enough (likely yes, to start).

## 6. Reply/comment support — already works, zero new backend code

Confirmed directly: `/api/postings/{case_id}/replies` (GET/POST/DELETE) and
`/api/votes` ([`api.py:1585-1726`](../../backend/api.py)) are keyed purely by a
generic `case_id` path param — no coupling to `doc_kind` or `channel`
anywhere in the route. The moment a `gov-uscis-...` case_id is published the
same way any other content is, replies and voting **already work against it**
via the existing `interactions.py` (Firestore) machinery. No backend changes
needed for this part of the ask at all.

## 7. Frontend — the one genuinely new workstream

Everything above is backend/ingestion. The "separate tab on website and
mobile" ask is real new frontend work, not automatic:

- A new News/Updates tab (website `src/app/...`, mobile
  `src/screens/...`) querying content filtered to `doc_kind="gov_news"`
  (needs a filter added to `search_client.py`/`api.py`'s query path — small,
  additive, same shape as the existing `channel` facet).
- Feed UI: title, agency (`source_system`), `posting_date`, summary, tags —
  then reuse the **existing** reply-thread UI components from the postings
  detail view (phase-L) rather than building new ones, since the underlying
  reply/vote API is identical.
- Not scoped/estimated in this doc — a separate pass once the backend
  ingestion + schema questions in §5 are settled.

## 8. Recommended incremental order

1. Settle the remaining §5 open questions (#2–#4 — §5 #1 is decided, §3.4).
2. Build `publish_gov_news_item()` + the RSS poll/dedup script, run it
   **manually** first (like `scripts/curation/publish_reddit.py`) against a
   handful of real items to sanity-check tagging quality before automating.
3. Wire the Cloud Scheduler job once manual runs look right.
4. Frontend tab (website first, then mobile — matches this project's
   existing rollout-lag reality for mobile releases, see
   [`PATH-B-PROVENANCE-PLAN.md`'s mobile timeline note](PATH-B-PROVENANCE-PLAN.md)).

## 9. Non-goals for this doc

- Does not cover a second agency yet (DOL, `travel.state.gov`, ICE, etc.) —
  the schema is designed to extend to them via `source_system` alone, but
  each would need its own source-format check (their RSS/API may differ from
  USCIS's) before assuming the same approach works unchanged.
- Does not decide §5's open questions — flagged for a decision, not resolved
  here.
- Does not include actual frontend design/mockups for the News tab.
