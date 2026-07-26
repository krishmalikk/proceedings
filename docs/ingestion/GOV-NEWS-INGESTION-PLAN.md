# Government Agency News Ingestion — Approach (starting with USCIS)

**Status:** PLANNING — for review. **No code implemented yet.**
**Scope:** One source to start — USCIS "All News" (`uscis.gov/newsroom/all-news`) — designed with a config-driven source registry (§4) so a second **vetted** source is a config addition, not a redesign. "Vetted" is load-bearing: see §4's legal-posture split between government and law-firm sources before assuming any new source is as clean as USCIS.

> **Why this doc exists.** New functionality requested: ingest official news/
> updates from government immigration agencies (and, per follow-up, design
> for eventual expansion to other government and/or law-firm sites), tag
> them the same way as existing postings, and surface them in a dedicated
> News tab on website + mobile with reply/comment support. This documents
> what the USCIS source actually offers (checked directly, not assumed) and
> a concrete approach built on the existing pipeline rather than a new one.

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
  is not present in the RSS item fields themselves** — only on the HTML page
  (see §3.5 for the decision on whether to go get it).

## 2. Legal posture — meaningfully cleaner than the Reddit case, for USCIS specifically

This is a different situation from the Reddit ingestion work
([`REDDIT-INGESTION-ALTERNATIVES.md`](REDDIT-INGESTION-ALTERNATIVES.md)),
not a variant of it — **for this source**:

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

**This legal analysis is USCIS-specific and does not automatically transfer**
— see §4 for why "government and/or law-firm sites" are two different legal
categories, not one.

## 3. Proposed pipeline design — extend `posting.py`, don't fork it

Mirrors the shape of Path B (`publish_reddit_posting()`,
[`PATH-B-PROVENANCE-PLAN.md`](PATH-B-PROVENANCE-PLAN.md)) rather than
inventing new infrastructure — same canonical schema, same GCS→Discovery
Engine→BigQuery fan-out, same tagging model.

### 3.1 New provenance values (additive, no schema change unless noted)

| Field | Value | Notes |
|---|---|---|
| `channel` | `"gov_news"` | New coarse bucket, parallel to existing `"app"`/`"reddit"`. Add a boost line in `search_client.py` (mirrors the existing `channel: ANY("app")`/`ANY("reddit")` lines at [`search_client.py:89-90`](../../backend/search_client.py)). Per-source-category, not global — see §4 (a law-firm source would likely warrant its own channel value with different trust weighting, not share `gov_news`). |
| `source_system` | `"uscis"` | Agency-specific — comes from the source registry (§4), not hardcoded. |
| `ingestion_method` | `"rss_feed"` (new value) | The Path B doc reserved `"automated_scrape"`/`"official_api"` as future values — neither quite fits. RSS is sanctioned syndication, closer in spirit to `"official_api"` but structurally distinct enough (no auth, no request quota) to warrant its own explicit value rather than overload one of those. |
| `doc_kind` | `"gov_news"` (new value) | Parallel to existing `"post"`/`"experience"`/`"connect_card"` ([`posting.py:920,1318,1364`](../../backend/posting.py)). |
| `posting_date` | RSS `pubDate` | **Free and accurate for every item** — unlike Reddit, no manual entry needed; this is the real original publish date straight from the source. |
| `full_url` | RSS `link` | Already a generic field — exact fit, no schema change. |
| `author_handle` | The source's display name (e.g. `"USCIS"`) | **Decided — see §3.6.** Not a synthetic per-item handle; one fixed value per source, from the registry. |
| `subreddit` / `reddit_post_id` | unused (`""`) | Reddit-specific; harmless to leave blank, same as how `channel="app"` postings already leave them blank today. |
| *(new)* `source_item_id` | RSS `guid` | Needed as the **dedup key** — `guid` is stable and URL-independent (a source could restructure URLs without breaking dedup). Case for one new field, since nothing existing fits this role cleanly. |
| *(new)* `content_hash` | hash of `title+description` | Needed to detect an **edited** item (same `guid`, changed content) without diffing full text on every poll — see §5.2. |
| `case_id` | `f"{channel}-{source_slug}-{date_str}-{short(guid)}"` → e.g. `gov_news-uscis-2026-07-26-a1b2c3d4` | Deterministic from `guid`, same dedup-by-construction pattern as the Reddit `reddit-{date}-{subreddit}-{post_id}` scheme. Leading segment matches `channel` exactly, consistent with `delete_content()`'s existing `case_id.split("-", 1)[0]` channel-recovery convention ([`posting.py`](../../backend/posting.py), see the Path B GCS-path bug it fixed). |

### 3.2 New function: `publish_gov_news_item()`

Same publish orchestration as `publish_posting()`/`publish_reddit_posting()`
(canonical → validate → GCS → Discovery Engine → BigQuery), but:
- Takes a source slug (looked up in the registry, §4) + an RSS item (title,
  description, link, pubDate, guid) instead of user-submitted fields.
- Skips `scrub_pii()`/`moderation.check_text()` for `content_license:
  public_domain` sources (official content, not a live user submission) —
  **not** for `content_license: copyrighted` sources (§4) — that distinction
  matters more than it might look like it does, since it's what keeps a
  future law-firm source from accidentally being treated like USCIS.
- Fetches the full article page **conditionally**, not always — see §3.5.
- **Deterministically adds the `news-update` tag** to every item it
  publishes — see §3.4. Not left to the Gemini tagger to remember, same
  reasoning as the existing deterministic `timeline` tag (added whenever
  `key_dates` is present, [`posting.py:842-843`](../../backend/posting.py)) and
  `family-based-immigration` (added whenever an I-130 tag is present,
  [`posting.py:857-858`](../../backend/posting.py)) — both single-point-of-truth
  backfills rather than relying on model judgment for something that should
  never be inconsistent.

### 3.3 Tagging — reuse the existing Gemini extraction, don't build a new one

**Decided (§5 old #4):** start with the **existing** `_extract()`/
`suggest_tags()` pipeline ([`posting.py`](../../backend/posting.py)) — the same
Gemini-based tagger already used for every posting today, run against
title+description (or full article text, per §3.5), against the same
controlled vocabulary. **Do not** build a separate scrape of USCIS's ~70-item
category filter to start — only revisit that if Gemini-derived tags turn out
too thin in practice once real items are running through it. This is the
single biggest reason this is cheap to build: zero new tagging
infrastructure, zero new vocabulary, until/unless proven insufficient.

### 3.4 `news-update` tag — decided (resolves §5 old #1)

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

### 3.5 Full article fetch — conditional, not unconditional (resolves §5 old #2)

**Decision:** default to the RSS `description` (already a real paragraph);
fetch the full article page **only when needed**, not on every item. Concrete
rule: if `description` is short/thin (e.g. under ~40 words, or otherwise
looks like a truncated teaser rather than a real summary), fetch the article
page at `link` and extract its body text as a fallback before running
extraction. This keeps the common case cheap (one request per new item) and
only pays the extra-request cost when the feed's own summary genuinely isn't
enough to tag well — a real problem to solve if it comes up, not one to
build defensively against 100% of the time. At current volume (a handful of
items/week) the cost either way is trivial; the point is not over-fetching
by default for its own sake.

### 3.6 `author_handle` — decided (resolves §5 old #3)

**Decision:** `author_handle` is the **source's display name** (e.g.
`"USCIS"`), one fixed value per source from the registry (§4) — not a
per-item synthetic handle the way user postings get one
(`_synthetic_handle()`, [`posting.py`](../../backend/posting.py)). Frontend
implication worth flagging alongside this: clicking the author on a gov-news
item should link out to the **source website/article** (`full_url`), not
navigate to an in-app author-profile page the way a real user's handle does
— there's no "USCIS user profile" in this system, and treating it like one
would surface an empty/nonsensical profile page.

## 4. Multi-source configuration & extensibility

Per follow-up request: design this so expanding to **other government
agencies and/or law firm websites** later is cheap. Two things need to be
true for that, and they're different in kind:

### 4.1 A config-driven source registry (the mechanism)

```python
# illustrative shape, not final code
NEWS_SOURCES = {
    "uscis": {
        "display_name": "USCIS",
        "site_url": "https://www.uscis.gov",
        "fetch_method": "rss",                # rss | scrape | api (future)
        "feed_url": "https://www.uscis.gov/news/rss-feed/59144",
        "source_category": "government",      # government | law_firm
        "content_license": "public_domain",   # public_domain | copyrighted
        "channel": "gov_news",
    },
    # future entries follow the same shape once vetted (§4.2) —
    # e.g. "dol", "state-dept", or a specific law firm's slug.
}
```

Adding a **vetted** new source with a clean RSS feed becomes a config entry
+ a `publish_gov_news_item(source_slug=...)` call — no new ingestion code.
`fetch_method` is the honest limit of that promise: this project only has an
adapter for `rss` right now. A future source with a JSON API or that needs
scraping is a new adapter function (additive, same registry, not a
redesign) — but it is new code, not "just config," when the fetch shape
differs from RSS.

### 4.2 Government vs. law-firm sources are legally different categories — vet each one

**This is the one place a shortcut would be a real mistake, so being
explicit about it:** §2's clean legal posture rests entirely on USCIS being
**federal government** content (17 U.S.C. § 105, public domain). That
reasoning does **not** extend to a law firm's website — a law firm's blog
posts, news updates, and articles are **ordinarily-copyrighted content**,
the same legal category as Reddit posts, not the same as USCIS. Treating
"government and/or lawyer's website" as one uniform bucket would risk
verbatim-storing copyrighted third-party content by default, which is
exactly the exposure this project deliberately avoided with Reddit (D-017's
paraphrase posture).

Concretely, the registry's `content_license` field exists to carry this
distinction through the pipeline, and it must be set correctly per source,
not assumed:
- `content_license: public_domain` (federal government sources) → verbatim
  storage is fine, same as USCIS. Still worth a per-site check before
  assuming — confirm it's actually a **federal** agency (state agencies and
  government contractors don't get the same 17 U.S.C. § 105 treatment) and
  do the same `robots.txt`/RSS-availability check this doc did for USCIS in
  §1, since site infrastructure varies even across federal agencies.
- `content_license: copyrighted` (law firm sources, and any non-federal
  source) → needs the **same evaluation discipline** already applied to
  Reddit before adding it at all: `robots.txt` check, ToS check, and almost
  certainly a paraphrase-only storage posture (not verbatim) rather than
  reusing USCIS's "store it as-is" approach.
- `channel` likely shouldn't be shared between the two categories either —
  official government guidance and a law firm's marketing/blog content
  plausibly warrant different search-boost trust weighting. Proposal: gov
  sources use `channel="gov_news"`; a law-firm category would get its own
  channel value (e.g. `"law_firm_news"`) when/if one is actually added,
  rather than retrofitting `gov_news`'s semantics later.

**What this section does and doesn't do:** it designs the registry mechanism
now, so a vetted source is cheap to add later. It does **not** vet or add
any second source (government or law firm) — each one needs its own §1/§2-style
check, done explicitly, before it goes in the registry.

## 5. Change detection & automation design

### 5.1 Confirmed empirically: polling is the only mechanism, with a huge safety margin

Checked the live feed directly (not assumed):
- **No WebSub/PubSubHubbub hub link** and **no `<lastBuildDate>`** on the
  channel — so there's no push/webhook option and no cheap "did anything
  change" shortcut at the channel level. Polling + diffing items is the only
  mechanism available, which is what §5.2 below does.
- **The feed returns 250 items**, not just the ~10 shown per page on the
  HTML site. Against the observed cadence of roughly 2–5 new items/week,
  that's a window of **roughly a year** before an item could naturally fall
  out of the feed. Practical implication: **polling frequency is a product-
  freshness decision, not a data-loss-risk one** — even a 6-hour or daily
  poll would carry essentially zero risk of silently missing an item at this
  volume. Recommend polling every 30–60 min anyway, purely so a new alert
  shows up in the app reasonably promptly — not because a slower cadence
  would lose data.

### 5.2 The diff algorithm — new / unchanged / edited

```
Cloud Scheduler (e.g. every 30–60 min)
  → Cloud Run job / Cloud Function
      1. For each source in the registry with fetch_method="rss":
         a. One BigQuery query: SELECT source_item_id, content_hash
            FROM postings_metadata WHERE source_system = <slug>
            → load into an in-memory {guid: hash} map. (One query per run,
            not one per item — trivial at this volume, avoids N lookups.)
         b. Fetch feed_url, parse all items.
         c. For each item, compute content_hash = hash(title + description):
              - guid not in map            → NEW      → publish_gov_news_item(...)
              - guid in map, hash matches  → unchanged → skip, no work
              - guid in map, hash differs  → EDITED    → re-publish (§5.3)
      2. Log a per-source run summary: items in feed / new / edited /
         unchanged / failed.
```

Any failure publishing one item is logged and skipped, not fatal to the
run — because `case_id` is deterministic from `guid`, a failed item simply
still looks "new" on the next scheduled run and retries itself naturally.
No manual retry bookkeeping needed.

### 5.3 Edited items — GCS/Discovery Engine upsert cleanly; BigQuery does not (open point)

Re-publishing an item under its existing (deterministic) `case_id` behaves
differently per sink, worth being explicit about rather than assuming it's
uniformly fine:
- **GCS** — overwrites the same blob path. Clean.
- **Discovery Engine** — `_import_to_datastore()` already uses `INCREMENTAL`
  reconciliation keyed by `case_id` ([`posting.py:998`](../../backend/posting.py)),
  which is upsert behavior by design (confirmed in this doc's own docstring
  reading — used specifically so re-issuing a publish is safe). Clean.
- **BigQuery** — `_write_bigquery()` calls `insert_rows_json()`
  ([`posting.py`](../../backend/posting.py)), which only **appends**. Re-publishing an
  edited item under the same `case_id` would insert a **second row**, not
  update the first — `postings_metadata` isn't currently upsert-friendly.
  This has never mattered before because nothing has re-published under an
  existing `case_id` in current usage; gov-news edits would be the first
  real case. **Needs a decision before §3.2 is built**, not solved in this
  doc: either (a) accept duplicate rows and have downstream BigQuery queries
  always select the latest row per `case_id` by `ingestion_timestamp` (§3.3
  in `TIMESTAMPS-AND-ANALYTICS.md`'s pattern already does something similar
  conceptually), or (b) do a real `DELETE`+`INSERT` (or `MERGE`) for the
  edited case rather than a plain append.

### 5.4 Items removed from the feed — not treated as a deletion signal

Given the ~year-long window (§5.1), an item disappearing between polls
during normal operation is far more likely a genuine retraction than the
item aging out — but this doc deliberately does **not** propose auto-
deleting on feed-absence: a transient partial response would look
identical to a real removal, and that's too risky a trigger for a
destructive action. Recommend leaving this as a manual/known limitation for
now rather than building deletion-detection logic without a clear signal to
key it off.

### 5.5 Cost/ops summary

No credentials, no auth, one feed request + one BigQuery query per source
per run, beyond the Cloud Run invocation itself — the cheapest ingestion
path in this project by a wide margin, because the source wants to be
polled. (A `copyrighted`-license source with a human-review step, if one is
ever added, would not be fully unattended the same way — closer to the
Reddit manual-curation shape.)

## 6. Reply/comment support — already works, zero new backend code

Confirmed directly: `/api/postings/{case_id}/replies` (GET/POST/DELETE) and
`/api/votes` ([`api.py:1585-1726`](../../backend/api.py)) are keyed purely by a
generic `case_id` path param — no coupling to `doc_kind` or `channel`
anywhere in the route. The moment a `gov_news-uscis-...` case_id is published
the same way any other content is, replies and voting **already work against
it** via the existing `interactions.py` (Firestore) machinery. No backend
changes needed for this part of the ask at all.

## 7. Frontend — the one genuinely new workstream

Everything above is backend/ingestion. The "separate tab on website and
mobile" ask is real new frontend work, not automatic:

- A new News/Updates tab (website `src/app/...`, mobile
  `src/screens/...`) querying content filtered to `doc_kind="gov_news"`
  (needs a filter added to `search_client.py`/`api.py`'s query path — small,
  additive, same shape as the existing `channel` facet).
- Feed UI: title, source (`author_handle`/`source_system`), `posting_date`,
  summary, tags — then reuse the **existing** reply-thread UI components
  from the postings detail view (phase-L) rather than building new ones,
  since the underlying reply/vote API is identical. Author link points out
  to `full_url`, not an in-app profile (§3.6).
- Not scoped/estimated in this doc — a separate pass once backend ingestion
  is actually built.

## 8. Recommended incremental order

1. Add the source registry (§4.1) with just `uscis` in it, and the
   `news-update` vocab entry (§3.4).
2. Build `publish_gov_news_item()` + the RSS poll/dedup script, run it
   **manually** first (like `scripts/curation/publish_reddit.py`) against a
   handful of real items to sanity-check tagging quality before automating.
3. Wire the Cloud Scheduler job once manual runs look right.
4. Frontend tab (website first, then mobile — matches this project's
   existing rollout-lag reality for mobile releases, see
   [`PATH-B-PROVENANCE-PLAN.md`'s mobile timeline note](PATH-B-PROVENANCE-PLAN.md)).
5. Only once the above is working: evaluate a second **vetted** source
   (§4.2) — another federal agency first (closer to USCIS's legal shape),
   before ever considering a law-firm source.

## 9. Non-goals for this doc

- Does not vet or add any second source, government or law-firm — §4
  designs the mechanism, not a specific expansion.
- Does not include actual frontend design/mockups for the News tab.
- Does not design the `copyrighted`-content-license storage posture in
  detail (paraphrase rules, review step) — flagged in §4.2 as needed
  *before* any such source is added, not designed here since none is in
  scope yet.
- Does not resolve the BigQuery append-vs-upsert question for edited items
  (§5.3) — flagged as needed before `publish_gov_news_item()` is built,
  not decided here.
