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

## 3. `travel.state.gov` — evaluated, not added this round

Checked directly (browser + plain HTTP, same discipline as the original
USCIS evaluation):

- **No RSS feed exists for "U.S. Visas News."** The only feed the site
  offers (`travel.state.gov/_res/rss/TAsTWs.xml`, discovered via the
  site's own `rss.html` hub page) was fetched and inspected directly — its
  content is **Travel Advisories** (per-country travel warnings, e.g.
  "Belgium - Level 2: Exercise Increased Caution"), entirely unrelated to
  visa-process news. There is no feed for the requested content.
- **The site blocks plain HTTP clients sitewide.** Unlike USCIS (which
  only blocked its HTML listing page at the bot-fingerprint level while
  leaving articles and `robots.txt` open), `travel.state.gov` returns a
  Cloudflare `403 Attention Required` to a plain `requests.get()` on
  **both** the news page **and `robots.txt` itself**. A real browser
  passes after a few seconds (used for this evaluation), but the
  lightweight script-based approach this pipeline runs on cannot.

**Conclusion:** the USCIS approach (poll an RSS feed with a plain HTTP
client) does not transfer to this site. The only way to actually ingest it
would be headless browser automation (e.g., Playwright solving the
Cloudflare challenge) — a materially heavier engineering lift than
anything built so far, and closer to the anti-bot-circumvention line this
project has deliberately stayed away from elsewhere (even though the
underlying content would still be legally clean — federal government,
public domain).

**Decision (explicit, per request):** do not build browser-automation
scraping right now. Ship the multi-source framework with `uscis` as its
only active source; `travel.state.gov` stays unaddressed until either (a)
a browser-automation adapter is explicitly requested and scoped separately,
or (b) an actual RSS/API path for this specific content is found later.

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
