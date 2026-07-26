# Gov-News Multi-Source Config — Firestore-Backed Registry

**Status:** Implemented.
**Depends on:** [`GOV-NEWS-INGESTION-PLAN.md`](GOV-NEWS-INGESTION-PLAN.md) (the original single-source USCIS design, §4 of which already anticipated a config-driven registry — this doc replaces that registry's storage mechanism, not its shape).

> **Why this doc exists.** Explicit request: add a second source
> (`travel.state.gov`), and make the source registry scalable so that
> adding a future source is a **config change, not a code change or a
> deploy** — picked up automatically the next time the scheduled poll runs.
> `travel.state.gov` itself turned out not to be addable this round (§3) —
> this doc covers the framework built to make the *next* addable source
> trivial, which was the larger and more durable part of the request.

---

## 1. What changed and why

The original registry (`backend/news_sources.py`) was a hardcoded Python
dict, baked into the deployed Docker image. Adding a source meant editing
code and running `gcloud run deploy` — exactly what this request asked to
eliminate.

**New design:** sources live in a **Firestore collection** (`news_sources`,
one document per source, document id = slug), not in code.
`gov_news_poll.py`'s `poll_all()` calls
`news_sources.get_enabled_sources()` **fresh at the start of every run** —
no caching, no restart required. A source added via the new management CLI
(§2) is picked up by the very next poll, scheduled or manual, with zero
code change and zero deploy.

Firestore was chosen over a GCS JSON config file because:
- This project already uses Firestore for exactly this kind of small,
  structured, frequently-read-rarely-written config-like data (user
  profiles, moderation flags), so it's the established idiom here, not a
  new dependency.
- Firestore access here is always server-side (`google-cloud-firestore`,
  ADC/service-account) — Firestore Security Rules only govern client-SDK
  access, so this collection needs no rule changes and is not reachable
  from the website/mobile app in any way.
- Per-source documents mean adding/editing one source is a small, atomic
  write — no read-modify-write race on a shared blob the way a single JSON
  file would have.

## 2. The management CLI — how a source actually gets added

`scripts/curation/manage_news_sources.py`. This is the literal answer to
"only by adding a website URL to config" — a human runs one command, no
code touched:

```bash
manage_news_sources.py add dol \
  --display-name "Department of Labor" \
  --site-url https://www.dol.gov \
  --feed-url https://www.dol.gov/some/rss/feed.xml \
  --content-license public_domain --source-category government

manage_news_sources.py list      # see all sources + their live status
manage_news_sources.py show dol  # full config for one source
manage_news_sources.py disable dol   # stop polling, config preserved
manage_news_sources.py enable dol
manage_news_sources.py remove dol --confirm   # permanent delete
```

**`--content-license` and `--source-category` are required, no default —
deliberately.** This is the safety gate carried over from
[`GOV-NEWS-INGESTION-PLAN.md` §4.2](GOV-NEWS-INGESTION-PLAN.md): a federal
government source is public domain (17 U.S.C. § 105) and safe to store
verbatim; a law-firm or other non-federal source is ordinarily copyrighted
and needs the Reddit-style paraphrase posture (D-017) — which this pipeline
does **not** implement. Making these flags required, with no default,
forces a conscious choice on every `add`, rather than silently defaulting
to "safe" and letting someone add an unvetted source without thinking
about the license question at all.

`news_sources.get_enabled_sources()` enforces this at read time, not just
at add time: a source is excluded from every poll run — logged loudly, not
silently — unless `content_license == "public_domain"` *and* `enabled` is
not `False` *and* every required field is present. A `copyrighted` source
can be added (stored, visible in `list`/`show`) but will never actually be
polled until the paraphrase/review posture that license needs is built —
config alone can't accidentally turn on unsafe automation.

## 3. `travel.state.gov` — full options evaluation

First pass (above, in the original PR) found no RSS feed and a Cloudflare
block, and stopped there per explicit direction. Follow-up request: fully
evaluate *how* this could be ingested, not just confirm the USCIS approach
doesn't transfer. Checked several additional angles directly (browser +
plain HTTP + web search) before writing this up.

### 3.1 Confirmed facts

- **No RSS feed for "U.S. Visas News."** The only feed on
  `travel.state.gov` (`_res/rss/TAsTWs.xml`) is **Travel Advisories**
  content (per-country warnings), fetched and inspected directly —
  unrelated to visa-process news.
- **The main `state.gov` domain has its own, richer RSS set** (Press
  Releases, Department Press Briefings, Collected Department Releases,
  regional feeds — found via `state.gov/rss-feeds`), but **none specific
  to visa/consular news** either. "Press Releases" is department-wide and
  would need additional relevance-filtering to extract just the
  visa-related subset — noisier and less precise than a dedicated feed,
  and (next point) **also blocked** the same way.
- **Both domains block plain HTTP clients sitewide** — not just the one
  news page. `travel.state.gov` returns an explicit Cloudflare
  `403 Attention Required`. `state.gov` is arguably worse: it returns
  **`200 OK` with a generic "Technical Difficulties" HTML page** for
  *every* path tested, including its own RSS feed URLs and `robots.txt` —
  a silent failure mode, not a clear error code, that any polling script
  would need to explicitly detect (content-type / title sniffing) rather
  than trust the status code.
- **No `robots.txt` file exists on `travel.state.gov` at all** — confirmed
  via a real browser reaching the actual origin (a genuine `404`, "Last
  Updated: December 31, 2024," not a block page). This matters: there is
  no explicit machine-readable "don't crawl this" policy here, unlike
  Reddit's case (explicit ToS language, lawsuits against scrapers, *and*
  its own bot-fingerprint blocking, layered together). What's here is
  generic bot-mitigation (Cloudflare on one domain, a different WAF-style
  block on the other) — evidently a department-wide security posture
  applied uniformly, not a targeted "no bots on this content" signal.
- **A real browser passes both domains' challenges automatically**, in a
  few seconds, with no special handling — used throughout this
  evaluation. This is a JS-capable-client check, not a
  CAPTCHA/human-verification step.
- **No official API.** Searched for a State Department developer
  portal/API — found only **archived** snapshots
  (`2009-2017.state.gov/developer`, `2017-2021.state.gov/developer`) in
  search results. Checked the live URL directly via browser:
  `state.gov/developer` → **"Page not found."** The public API program
  appears to have been discontinued; nothing current exists to check
  against.

### 3.2 Options

**A. Headless browser automation** (e.g. Playwright driving real Chromium,
letting the Cloudflare/WAF challenge resolve the way any real browser's
would — not fingerprint spoofing or header mimicry).
- Legal/access posture is genuinely better here than it first looked, and
  better than the Reddit case: public-domain content, no `robots.txt`
  disallow, and the technique itself (running an actual browser engine) is
  less aggressive than what this project already ruled out for Reddit
  (spoofing signals from a fake client). Still not zero-risk — it's
  automated access to a site with *some* generic bot-mitigation in place —
  but a materially different, lower-risk category than Reddit's case.
- Real engineering cost, though: a new dependency (Playwright + a Chromium
  binary, ~300 MB), a new `fetch_method` adapter (HTML scraping of the
  listing page, not a stable feed contract — page markup can change
  without notice, unlike RSS), and more Cloud Run resources / slower
  per-request time than anything built so far. The once/day cadence and
  low item volume (§3.3) make the *operational* cost tolerable; the
  *engineering* cost (new adapter class, new failure modes to handle) is
  the real ask here.

**B. Manual curation** (mirrors this project's own established pattern —
`scripts/curation/publish_reddit.py` for Reddit, or Path B's reasoning
generally): a human periodically reads the page in a real browser and
publishes via `posting.publish_gov_news_item()` directly (a tiny one-off
script, or even by hand with the CLI plumbing that already exists).
- Zero legal/technical risk — a human reading a public government webpage
  is unambiguously fine, same as reading any public page. Zero new
  engineering: the publish path is already built and tested.
- Doesn't satisfy "fully automatic," but given the update cadence
  observed on this page (roughly a handful of items per month, based on
  the dates visible when this was checked), the manual burden is genuinely
  small — a few minutes, a few times a month.

**C. Wait for / enable DS-2** (this project's own already-decided,
unbuilt, Google-crawled public-website grounding tier, D-039) — would
likely cover `travel.state.gov` content for free once turned on
(`GCP_VERTEX_PUBLIC_ENGINE_ID` is currently unset/off), since Google's own
crawler isn't subject to the same generic bot-mitigation a home-grown
script hits. **Does not substitute for this feature**, though — DS-2 only
feeds the QA/grounding surface ("ask a question"), not a structured
News-tab item with its own reply thread, which is what this pipeline
exists to produce. Worth knowing about as a complementary, zero-scraper
path for the *grounding* use case specifically, not a replacement for
ingestion here.

**D. Official API** — confirmed not to exist (§3.1). Not a live option.

### 3.3 Recommendation

Given the apparently low update volume on this specific page, **Option B
(manual curation) is the pragmatic default** — it can be live essentially
immediately, at zero technical/legal risk, using infrastructure that
already exists. **Option A (headless browser automation)** is a real,
buildable path with a defensible risk posture if full automation for this
specific source is a priority worth the new engineering surface — should
be scoped as its own decision (new adapter type, new dependency,
Cloud Run resourcing) rather than folded into this framework PR.

**No decision made here — flagging both live options for an explicit
choice, not picking one.**

## 4. What adding a *real* second source looks like, end to end

For any future **federal-government source with a real RSS feed** (the
one fully-supported shape today):

1. Check it directly — RSS feed exists for the actual desired content?
   `robots.txt` clean? Plain HTTP works (or blocked, like
   `travel.state.gov`)? Same §1/§2-style check `GOV-NEWS-INGESTION-PLAN.md`
   did for USCIS — **do this per source, never assume it transfers.**
2. `manage_news_sources.py add <slug> ... --content-license public_domain --source-category government`
3. Done. The next scheduled poll (`gov-news-poll-uscis`'s Cloud Scheduler
   job, or a manually-triggered one) reads the registry fresh, sees the new
   source, and starts polling it — no code change, no deploy.

A source needing a different `fetch_method` (JSON API, or a site that
needs browser automation) is **not** a config-only addition — `add`
accepts the value but `poll_source()` still only has an adapter for
`"rss"`; anything else is stored and visible but skipped every run with a
clear reason, until adapter code is actually written for that fetch shape.

## 5. `content_type` — the registry supports two content types, not one

Explicit follow-up request: make sure this framework has room for both
**news updates from official sites** (USCIS, what's live today) and
**postings from forums like Reddit**, not just the former.

### 5.1 Why this is a second, independent gate — not folded into `content_license`

It's tempting to think `content_license` already covers this — Reddit
content is `copyrighted`, so it's already excluded from auto-polling. But
that conflates two different questions:

- `content_license` answers: **is this legally safe to store verbatim?**
- `content_type` answers: **does a publish handler that fits this
  content's risk profile even exist?**

These aren't the same question, and collapsing them would hide a real gap.
`publish_gov_news_item()` — the only automated publish handler that
exists — was built specifically for official/authoritative content: it
skips PII scrubbing and moderation checks (`posting.py`'s
`publish_gov_news_item()` docstring is explicit about this, matching
`publish_reddit_posting()`'s same reasoning), because a USCIS press
release has no PII risk and isn't user-generated. A forum posting is the
opposite on both counts — real PII risk, real moderation need — even
setting the copyright question aside entirely. A hypothetical future forum
source that somehow *was* public-domain licensed (unlikely, but the
registry shouldn't assume it can't exist) would still be wrong to run
through `publish_gov_news_item()`, because that handler was never built to
scrub PII or check moderation on the content it publishes. `content_type`
exists to catch exactly that case — independently of licensing.

### 5.2 What `content_type` does today

Two values, `news` and `forum_posting` (`news_sources.VALID_CONTENT_TYPES`).
`get_enabled_sources()` requires `content_type == "news"` in addition to
`content_license == "public_domain"` — **both** gates, not either. A
source can fail one, the other, or both; any failure excludes it from
automated polling, logged loudly with the specific reason (see the sample
output in §5.3).

`forum_posting` sources are **fully representable and storable** in this
same registry (`manage_news_sources.py add ... --content-type
forum_posting`) — that's the actual point of this field, a single source
of truth across both content types — but are **never auto-published**
through `gov_news_poll.py`. Publishing forum content stays exactly the
existing path it already was: `scripts/curation/publish_reddit.py`, a
human-curated script calling `posting.publish_reddit_posting()` directly.
Registering a subreddit as a `forum_posting` source here doesn't change
how it gets published — it changes where its provenance metadata
(display name, site URL, license, category) is recorded, so it's alongside
`news` sources in one registry instead of living only in a curator's head
or a hardcoded literal somewhere.

### 5.3 Example: registering a subreddit

```bash
manage_news_sources.py add reddit-h1b \
  --display-name "r/h1b" --site-url https://www.reddit.com/r/h1b \
  --feed-url "" --fetch-method manual \
  --content-license copyrighted --content-type forum_posting --source-category forum

manage_news_sources.py list
# reddit-h1b  [configured but not automatable  ] r/h1b — forum_posting/copyrighted/forum — (no feed — manual)
```

`--fetch-method manual` signals "no poll mechanism at all" — distinct from
`rss`/`api`/`scrape`, which describe automated-but-not-yet-adapted fetch
shapes. A `manual` source is never expected to gain an adapter; it's
inherently a config-only, human-published entry.

### 5.4 What this does *not* do

This is the schema/registry extension only, per the explicit scope
decision for this round — **no behavior change to Reddit ingestion
itself**. `scripts/curation/publish_reddit.py` does not read from this
registry yet (it still takes subreddit/post details as CLI args, same as
before). Wiring it to pull provenance config from a registered
`forum_posting` source, and/or building automated *discovery* for a forum
that does have a real RSS/API (some do — just not Reddit, per
`REDDIT-INGESTION-ALTERNATIVES.md`) with a human-review queue before
publish (since D-017's paraphrase posture means forum content can never
auto-publish verbatim the way `news` content does) are both real,
separate, bigger decisions — not built here.
