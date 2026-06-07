# FINAL Architecture — Conversational Vertex AI Search Backend (web + mobile)

**Status:** Authoritative consolidation. Supersedes/reconciles the baseline [APP-BACKEND-ARCHITECTURE.md](APP-BACKEND-ARCHITECTURE.md) + [IMPROVED-BACKEND-ARCHITECTURE.md](IMPROVED-BACKEND-ARCHITECTURE.md), traces to the product requirements [app-specs.MD](app-specs.MD), and ratifies the grounding model recorded as **D-039** in [MEMORY.md](../MEMORY.md).
**Date:** 2026-06-03
**Scope:** the server-side backend the web SPA and mobile app integrate against — grounding sources, conversation/state model, why each choice was made. Client wire-contract stays in [APP-FRONTEND-INTEGRATION.md](APP-FRONTEND-INTEGRATION.md); ingestion pipeline stays in [docs/ingestion/](../docs/ingestion/).

---

## 1. Purpose

One authoritative description of: **(a) what the grounding sources are and why**, **(b) why this orchestration approach was chosen**, and **(c) what Firestore stores — specifically where user profile and conversational state/history live.** It also records the discrepancies found between the product requirements and the prior architecture specs, and how each is reconciled.

---

## 2. Requirements → architecture traceability

From [app-specs.MD](app-specs.MD), the system must:

| Req | Source | Where satisfied |
|---|---|---|
| Chatbot-first search **and** posting over US-immigration content | §1, §5.1–5.3 | BFF `/v1/chat` + Search/Answer API + posting contract (§5 below) |
| Ground on **app postings** + **reddit.com** + **other future sites** | §2, §5, §5.2 | Grounding tiers 1 & 2 → `imm-postings-datastore` channels (§4) |
| Act as an **expert with a generic knowledge base** (advice, with non-legal disclaimer) | §2 vision, §5.2(2) | Grounding tier 3 (curated public sites) + bounded Gemini fallback (§4) |
| **User profile** of the immigration journey, stored in GCP, used as Gemini context; **no PII** | §2, §5.5 | Firestore `users/{uid}` (§6) |
| Remember **conversation state**; per-session metadata JSON | §5.1 (Context Mgmt), §5.1 key-activity | Firestore `sessions/{session_id}` + Vertex managed session (§6, §7) |
| Geo-aware proactive prompting (US vs outside-US) | §5.1, §7.1 | BFF geo state machine (baseline §7) |
| Saved searches & alerts | §5.2 | Firestore `saved_searches` / `alerts` + FCM (§6) |
| Synthetic reddit-style username; email/Google/Apple + guest | §5.4 | Firebase Auth (D-035) |
| Sidecar-pattern metadata identical to Reddit ingestion | §2, §5 | Shared Tagger→Validator→GCS→import contract, channel-agnostic (D-036) |

---

## 3. Discrepancies found between requirements and prior architecture specs (and resolutions)

| # | Discrepancy | Requirements say | Architecture says | Resolution in this doc |
|---|---|---|---|---|
| **D-a** | **Orchestration engine** | §8.3: "connect frontend to **Vertex AI Agent Builder** to handle conversational logic" | D-034: **custom Cloud Run BFF + Gemini** (Option A); Agent Builder-direct (B) and ADK agent (C) **rejected** | **Architecture wins.** §8.3 is informal Stitch guidance; D-034 has a documented 7-point rationale. BFF chosen — see §5. |
| **D-b** | **Where non-grounding data lives** | §6.2: "Database: **Vertex AI Search**"; §5.5: profile "stored in backend in GCP" (Firestore unnamed) | D-035: **Firestore** holds app state | **No conflict — requirements under-specified.** Vertex AI Search = grounding only; Firestore = app state. Requirement intent ("stored in GCP, used as context") is met (§6). |
| **D-c** | **Generic knowledge base as a grounding source** | §2/§5.2: bot is an **expert with generic knowledge** | Baseline §6: `general_question` → "Answer API **or a domain-scoped Gemini answer**" — i.e. left to Gemini's *parametric* knowledge, uncitable | **Gap closed by D-039.** A curated **public-site grounding tier (DS-2)** gives citable general knowledge; raw Gemini parametric answers are a last-resort, disclaimer-gated fallback only (§4). |
| **D-d** | **PII posture** | §5.5: **no PII** gathered in profile | D-038: posts allow PII with consent (no DLP); IMPROVED adds Gemini pre-flight PII flag | **Reconciled by scope:** profile = PII-free canonical-vocab fields only; **posting** = consent + **Gemini pre-flight PII detection** (adopted from IMPROVED §6). |
| **D-e** | **Two architecture docs diverge** | — | Baseline = serial Classify→Answer, `flash`; IMPROVED = **parallel-speculative**, `flash-lite`, **`active_posts` shadow buffer**, prompt caching | **IMPROVED adopted as the production target**, baseline as the conceptual base. Shadow buffer + speculative routing folded in (§5, §6). |
| **D-f** | **Implementation vs both specs** | — | Both specs: datastore + Answer API | Current code uses **Vertex AI Vector Search + `qa_pairs`** — diverges from both. **Retired** (D-039; see [ARCHITECTURE_GAP_reddit-grounding.md](../ARCHITECTURE_GAP_reddit-grounding.md)). |
| **D-g** | **Infra provider** | §6.3: "Cloud Provider … help me decide" | Resolved across D-016/034/035 | All GCP, `us-central1` (data store `global`). Settled. |

**Net:** no blocking contradiction. The one substantive *gap* was **D-c** — the requirements explicitly wanted a "generic knowledge base," which the baseline architecture under-served by deferring to Gemini's own knowledge. D-039's public-site grounding tier closes it.

---

## 4. Grounding sources — the heart of the design

**Three grounded tiers, all served by managed Vertex AI Search (Discovery Engine) through the Search + Answer API, in strict priority order, plus one non-grounded fallback.**

| Tier | Source | Store | `channel` | Ingested by us? | Priority |
|---|---|---|---|---|---|
| **1** | **App/web postings** (users posting via chat) | **DS-1** `imm-postings-datastore` | `app` | Yes — Tagger→Validator→GCS→`documents.import` | **Highest** |
| **2** | **Reddit** (+ future ingested sites) | **DS-1** (same datastore) | `reddit` (+ future) | Yes — same contract | High |
| **3** | **Curated public sites** ("generic knowledge base": uscis.gov, travel.state.gov, dol.gov, …) | **DS-2** website data store | n/a (website store) | **No** — Google crawls/indexes | Low |
| *(fallback)* | **Gemini parametric knowledge** | none (model weights) | — | — | **Disclaimer-gated, last resort only** |

### Why this shape
- **Tiers 1 & 2 share one datastore distinguished by `channel`** because they are *our* ingested, tagged, sidecar content — exactly what D-036 generalized the schema for ("future channels drop in with no schema change"). A new source = a new `channel` value, zero schema work.
- **Tier 3 is a separate website data store because the requirement is "no ingestion"** for third-party public content. We must not crawl/copy/embed it ourselves; a Google-crawled website store grounds on it with citations and **no pipeline to run** and **no always-on serving node**. This is what makes the requirements' "generic knowledge base" *citable* rather than hallucinated.
- **Gemini's own knowledge is NOT a grounding source.** Per requirements §5.2 it may act as an "expert" for general advice, but only behind an explicit **non-legal-advice disclaimer** and only when no grounded tier answers — it is bounded by the domain guardrail preamble, never presented as cited fact.

### Precedence is a managed feature, not custom code
A single Answer-API call against the blended engine with a **`boostSpec`**: boost `channel="app"` highest, `channel="reddit"` next (both DS-1), DS-2 (public) at baseline → ranks lowest. Result: priority `app > reddit > public` with **unified citations in one grounded answer**, no BFF merge layer.

> **Build-time verification (per D-038 practice):** (1) confirm a website data store can be **blended** with DS-1 in one engine and that `boostSpec` ranks across stores — **fallback** if not: a thin two-call BFF merge (`:answer` over DS-1 primary + secondary DS-2 query, merged by precedence), both halves still managed; (2) third-party public sites use **basic website indexing** (no domain verification) or Grounding-with-Google-Search restricted to those domains.

### What is retired
- The prototype's **self-managed Vertex AI Vector Search index** (`legal_intake_deployed_v2`, 807 chunks) — violates D-016, bills 24/7, and (being a crawl→chunk→embed artifact) contradicts the tier-3 "no ingestion" rule. Its public source sites become DS-2's URL patterns.
- The prototype's **`qa_pairs`** Firestore log — replaced by the session/profile model (§6).

---

## 4.1 Crawling & indexing — how content reaches each tier

"Crawling" = acquiring/fetching the raw content; "indexing" = making it searchable (chunk + embed + facets). The two live grounding tiers use **two different mechanisms**, and one legacy mechanism is **retired**.

### Tier 1 & 2 (DS-1) — we acquire & tag; Vertex AI Search embeds & indexes
This is the **sidecar** pattern (D-011/D-016). We never own embeddings or run a vector index.

1. **Crawl (polymorphic Scraper Tool):**
   - **Reddit → PRAW** (official Reddit Data API) — structured post + top-comment objects with upvote counts (the ">5 upvotes" rule, D-014). *Not* Firecrawl.
   - **Future non-API sites → Firecrawl** adapter (clean Markdown).
   - **App/web posts → the BFF conversation itself** is the "crawl" (the user's chat becomes the content).
   - All emit one normalized `{title, body, comments[], url, created_utc, source}` contract.
2. **Tag + validate:** Gemini **Tagger** (`LLM-EXTRACTION-PROMPT.md`) → canonical metadata JSON (master-vocab only) → **Validator** (`schema.py` + vocab gate); failures → **quarantine**.
3. **Write sidecar to GCS:** `gs://imm-postings-ingestion/<date>/<channel>/<case_id>.{md,json}` (`.md` body + `.json` structData incl. `embedding_text`).
4. **Index (managed):** the `.json` `object.finalized` fires **Eventarc** → `search-importer` (Cloud Run) → **`documents.import` INCREMENTAL, `id=case_id`**. Inside Discovery Engine (we do none of this): it parses the `.md`, **chunks** it, **generates + stores embeddings itself**, and registers `structData` as **facets**. Searchable in **minutes**.

### Tier 3 (DS-2) — Google crawls *and* indexes; we only name the domains
This is the **"no ingestion"** tier (D-039). We registered **INCLUDE target sites** (`uscis.gov/*`, `travel.state.gov/*`, `dol.gov/*`, `boundless.com/*`, `immigrationdirect.com/*`). **Google's website crawler** discovers, fetches, and indexes those pages (**basic** website indexing — no domain verification needed, so third-party sites work). No scraper, no GCS, no tagging on our side. Crawl/index is **asynchronous** (hours). Provisioned by `scripts/provision_ds2_website.py`.

> The same Google website crawler was deliberately **rejected for tiers 1–2** (it bypasses our tagging transform) — but that property is exactly what tier 3 wants, since public reference content is not owned or tagged.

### Comparison

| | DS-1 (app + reddit) | DS-2 (public reference) |
|---|---|---|
| Who crawls | Us — PRAW / Firecrawl / chat | **Google** (website crawler) |
| Who tags | Us — Gemini Tagger | Nobody |
| Who chunks / embeds | **Vertex AI Search** (managed) | **Vertex AI Search** (managed) |
| Index trigger | Eventarc → `documents.import` | Google async crawl |
| Freshness | Minutes | Hours |
| Owned embeddings / serving node | None | None |

### Retired (do not use)
The original prototype's **self-managed Vertex AI Vector Search** path — `crawler.py` (Firecrawl) → `index.py` (tiktoken chunking + `text-embedding-005` + Tree-AH index on an always-on endpoint) → `query.py` `find_neighbors` — is **retired** (D-016/D-039). `index.py` and the `chunk_mapping.json` cache were removed; the dead retrieval code was stripped from `query.py`. It owned embeddings + a 24/7 serving node and held no Reddit content (the root cause of the original grounding bug).

## 4.2 Pipeline file map & operational runbook (live vs legacy)

**There is no local "indexing" script in the live system** — indexing is managed by Vertex AI Search (`documents.import`) and by Google's website crawler. The root `crawl*.py` / `prepare_labeled_data.py` files belong to the **retired prototype** and are kept only for reference / future reuse.

### File map

| File | Purpose | Live or legacy | Run mode |
|---|---|---|---|
| **DS-1 grounding (app + reddit)** | | | |
| Reddit scraper (**PRAW**) — per [REDDIT-INGESTION-PIPELINE.md](../docs/ingestion/REDDIT-INGESTION-PIPELINE.md) | Crawl reddit.com posts/comments | **Live (design)** | **Scheduled** — Cloud Scheduler → Agent Engine, ~30 min (pilot) |
| `documents.import` (no local file; `search-importer` Cloud Run) | Index sidecars into the datastore | **Live (design)** | **Event-driven** — Eventarc on GCS `.json` finalize; daily auto-sync = backstop |
| `vertexai-search-ingestion-from-examples/scripts/ingest_batch.py` *(per D-037; not in this tree)* | Manual batch tag+import (used to load the 81 reddit docs) | **Live (manual)** | **Manual** one-off |
| **DS-2 grounding (public reference)** | | | |
| [scripts/provision_ds2_website.py](../scripts/provision_ds2_website.py) | Create the website data store + target sites + engine | **Live** | **Manual**, one-time (idempotent) |
| Google website crawler (no file of ours) | Crawl/index the registered public domains | **Live** | **Managed** — Google auto-crawls + periodically re-crawls |
| **Serving** | | | |
| [search_client.py](../search_client.py) | Grounded retrieval via the Answer API | **Live** | Imported by `api.py` |
| [api.py](../api.py) | The HTTP API (Phase-1 stand-in for the BFF) | **Live** | Cloud Run / `uvicorn` |
| **Retired / legacy** | | | |
| `index.py` | Vector Search indexer (chunk+embed) | 🔴 **Deleted** | — |
| [crawler.py](../crawler.py), [agent_crawl.py](../agent_crawl.py), [continuous_crawl.py](../continuous_crawl.py), [discover_urls.py](../discover_urls.py), [prepare_labeled_data.py](../prepare_labeled_data.py), [pipeline.py](../pipeline.py) | Old Firecrawl→label→Vector Search prototype (`crawler.py` retained as the future non-API Firecrawl adapter) | **Legacy** | Manual CLI; **not part of live ops** |

### Operational runbook — what runs how, and the steps

**1. DS-1 Reddit ingestion — SCHEDULED (production) / MANUAL (today).**
- *Production design:* Cloud Scheduler triggers the Agent Engine ingestion every ~30 min (PRAW scrape → Gemini tag → validate → GCS sidecar → import). No human action per run.
- *Current state:* the 81 reddit docs were loaded by a **manual batch** (`ingest_batch.py`, D-037). To add more manually, run that batch script with ADC. The scheduled Cloud Scheduler/Agent Engine + `search-importer`/Eventarc infra is the target design and may not be deployed in this project yet.

**2. DS-1 indexing — EVENT-DRIVEN (managed), no manual step.**
- A `.json` sidecar landing in `gs://imm-postings-ingestion/<date>/<channel>/` triggers Eventarc → `search-importer` → `documents.import`. Searchable in minutes.
- *Manual fallback / reindex one doc:*
  ```bash
  # via the manual batch importer, or a documents.import call over the GCS sidecar
  ```

**3. DS-2 public reference — MANUAL one-time setup, then MANAGED.**
- *One-time provisioning (already done):*
  ```bash
  .venv/bin/python scripts/provision_ds2_website.py    # idempotent; also reprints indexing status
  ```
- *Ongoing:* Google **auto-crawls and re-crawls** the registered domains — no schedule or action from us.
- *Activate at query time* once indexing reads `SUCCEEDED`:
  ```bash
  # in .env:
  GCP_VERTEX_PUBLIC_ENGINE_ID=imm-public-reference-search-app
  # then restart the API
  ```

**4. The API (grounding service) — MANUAL (local) / Cloud Run (prod).**
```bash
.venv/bin/python -m uvicorn api:app --reload --port 8000     # local
```

**5. E2E verification — MANUAL, on demand.**
```bash
.venv/bin/python tests/test_grounding_e2e.py
```

**6. Legacy prototype crawl scripts — MANUAL only, not in live ops.** `crawler.py` etc. run as `python <file>` and target the retired Vector Search path; do not run them as part of the current system. `crawler.py` is retained only as the basis for a future Firecrawl non-API channel.

> **Summary of cadence:** Reddit ingestion = **scheduled** (or manual batch today); DS-1 indexing = **event-driven/managed**; DS-2 crawl = **managed by Google** (manual one-time setup); API + tests = **manual**; legacy scripts = **manual, not used**.

---

## 5. Orchestration — why a custom BFF (not Agent Builder)

The apps talk to a **custom stateless FastAPI service on Cloud Run + Gemini** (the BFF). It owns the conversation loop — intent recognition, multi-turn context, geo-aware proactive prompting, conversational filtering, the posting draft→review→publish flow, and domain guardrails — and delegates two fixed capabilities: **grounded search** to the Vertex AI Search Search/Answer API (§4), and **posting ingestion** to the shared Tagger→Validator→GCS→`documents.import` contract.

**Why (D-034):** only a custom BFF covers all seven conversation responsibilities while keeping the scripted, guarantee-critical UX (enumerated §5.1 geo-prompt branches; the hard confirm-before-publish gate) **deterministic in code** rather than steered through an autonomous agent — at predictable cost/latency. Agent Builder-direct covers ~1 of 7 responsibilities (forcing a BFF anyway); an ADK agent adds per-turn reasoning latency/cost for open-endedness this scripted flow doesn't need. This **overrides requirements §8.3's "Agent Builder" suggestion** (discrepancy D-a).

**Production optimizations adopted from [IMPROVED-BACKEND-ARCHITECTURE.md](IMPROVED-BACKEND-ARCHITECTURE.md):**
- **Parallel-speculative routing:** the BFF fires the speculative Search/Answer call and a `gemini-2.5-flash-lite` intent classification *concurrently*; if intent resolves to `search`, the in-flight answer streams immediately (TTFT < ~1.5 s); if `post`, the search is cancelled and the posting flow begins.
- **Prompt caching** of the ~30k-token master tag taxonomy for the posting/extraction turns (~90 % input-token reduction).
- **Pre-flight PII detection** folded into the same Gemini extraction turn (no extra latency) — flags phone/address/case-id as SENSITIVE before `documents.import` (closes discrepancy D-d for posts).
- **Answer-API preamble** hard-codes the domain guardrail + the active filter, preventing off-topic and filter-drift.

```
   ┌─────────────┐   ┌─────────────┐
   │  Web SPA    │   │ Mobile app  │   Firebase Auth SDK (email/Google/Apple/guest)
   └──────┬──────┘   └──────┬──────┘
          │  HTTPS + Firebase ID token (Bearer)
          └────────┬────────┘
                   ▼
   ┌───────────────────────────────────────────────────────┐
   │  BFF — FastAPI on Cloud Run (sa-app-bff)               │
   │  verify token · parallel-speculative intent+search     │
   │  geo state machine · guardrail preamble · publish gate │
   └──┬──────────────┬───────────────┬──────────────┬───────┘
      ▼              ▼               ▼              ▼
 ┌─────────┐  ┌────────────┐  ┌────────────┐  ┌──────────────────────────┐
 │ Gemini  │  │ Vertex AI  │  │ Firestore  │  │ Ingestion contract (reuse)│
 │ 2.5     │  │ Search     │  │ + Firebase │  │ Tagger→Validator→GCS→     │
 │ flash-  │  │ Search/    │  │ Auth       │  │ documents.import          │
 │ lite/pro│  │ Answer API │  │ APP STATE  │  │ → DS-1 (channel=app)      │
 └─────────┘  └─────┬──────┘  └────────────┘  └──────────────────────────┘
                    │ blended engine + boostSpec
            ┌───────┴────────┐
            ▼                ▼
      DS-1 imm-postings   DS-2 website store
      (app, reddit, …)    (public sites, no ingest)
```

---

## 6. Firestore — what it stores, and where profile + conversation live

**Firestore (Native mode, `us-central1`) is the app-state store (D-035). It is NEVER a grounding source** — grounding is Vertex AI Search only (§4). It holds all user-scoped operational state; analytics/telemetry stays in BigQuery.

| Collection | Stores | Requirement |
|---|---|---|
| **`users/{uid}`** | **USER PROFILE** — the immigration-journey profile in **canonical-vocabulary fields** (`current_visa_or_greencard_category`, `principal_country_of_chargeability`, journey stage, …), synthetic reddit-style username, settings. **No PII** (req §5.5). Injected by the BFF as Gemini context and used to pre-fill drafts / pre-filter searches. | **Req 4 — user profile** |
| **`sessions/{session_id}`** | **CONVERSATIONAL STATE / HISTORY** — `turns[]` (the running dialogue), `active_filter`, the accumulating per-session posting-`draft` metadata JSON, `intent_state`, geo (`country`/`in_us`), the `vertex_session_name`, and a **TTL** that auto-expires stale sessions. | **Req 5 — conversation state** |
| **`saved_searches/{id}`** | `{query, filters, alert_enabled}` | Req §5.2 |
| **`alerts/{id}`** | `{saved_search_id, transport: fcm, …}` | Req §5.2 |
| **`posts/{case_id}`** | App-side **ref/mirror** of a published post (ownership, "my posts"). **Source of truth stays in the GCS sidecar** (D-031). | Req §5.3 |
| **`active_posts/{…}`** | **Shadow buffer** (IMPROVED §4): the just-published post mirrored for instant visibility while `documents.import` catches up. The BFF merges it to the top of the author's results until the global index includes it. | UX freshness |

### Direct answers to "where is X stored?"
- **User profile → `users/{uid}`** in Firestore (PII-free, canonical-vocab). This satisfies requirements §5.5's "stored in backend in GCP … accessed by the conversational system as context."
- **Conversational state/history → `sessions/{session_id}`** in Firestore, holding the turn history + draft + filter + geo. There are **two complementary session layers**: this app session (owned by the BFF) and the **Vertex Answer-API managed session** (`vertex_session_name`) that handles search-query rephrasing/follow-ups ("What about Mumbai?" → expanded automatically). The BFF reconstructs Gemini's message history from `turns[]` each turn because Cloud Run is stateless and Gemini is stateless per call.

### Access pattern & safety
- **All writes are BFF-mediated** (Admin SDK on attached SA, no key files — D-018). Optional **read-only client-direct listeners** (security-rules-guarded on `request.auth.uid`) power real-time alerts + live session updates.
- This is **app state only** — it does **not** reintroduce the ingestion pipeline's Firestore (D-013 was pipeline-scoped; D-035 app state is a separate concern).

### Could Firestore be removed?
For a stateless, single-turn, search-only MVP — yes. But requirements 4 (profile) and 5 (conversation memory), plus saved searches/alerts/posting ownership, all require a stateful app-state store, and **D-035 chose Firestore** over Cloud SQL / Identity Platform (scale-to-zero, native real-time listeners, native TTL, Firebase-Auth pairing). Removing it would reopen D-035 and require re-homing the entire app-state tier — it would **not** affect grounding/answers either way.

---

## 7. Conversation & posting flows (summary)

- **Search turn:** parallel-speculative (§5) → Answer API over the blended engine with `boostSpec` (§4) → grounded answer + citation cards + facet chips; refine turns amend `active_filter` on the same Vertex session.
- **Posting turn:** intent=post → Gemini entity extraction (+ pre-flight PII flag) into `sessions.draft` → geo-aware gap questions → draft-review card → **explicit confirm (hard gate)** → publish: compose `.md`, full Tagger, validator (master-vocab gate), mint `app`-channel identity (D-036), write GCS sidecar + `active_posts` shadow mirror, `documents.import` INCREMENTAL, mirror `posts/{case_id}`.
- **Profile:** every captured journey attribute maps to a canonical field → simultaneously enriches `users/{uid}` and pre-fills drafts/filters.

---

## 8. Decision-log anchors

D-013 (pipeline has no Firestore) · D-016 (single **managed** Vertex AI Search sink; self-managed Vector Search rejected) · D-034 (custom BFF + Gemini) · D-035 (Firebase Auth + Firestore app state) · D-036 (channel-agnostic schema) · D-038 (PII consent + Answer-API confirmations) · **D-039 (3-tier grounding; DS-2 public website store extending D-016; Vector Search retired)**.

## 9. Open / verification items
1. Blend-vs-two-call for DS-2 (§4 verification 1).
2. DS-2 indexing mode + the exact curated public-domain list (§4 verification 2).
3. Decommission plan for the Vector Search index + `qa_pairs`.
4. The `active_posts` shadow-buffer + parallel-speculative patterns from IMPROVED are adopted here but not yet logged as their own `D-NNN` — log when P1 code lands.

---

## 10. Addendum (phase-J) — multi-view searchable user content + profile↔message reconciliation

**Status:** Addendum to §4/§6. Records **D-041** (multi-view content) and **D-042** (publish-time reconciliation). Extends, does not change, the grounding/app-state split. Plan: [PHASE-J-PLAN.md](PHASE-J-PLAN.md).

### 10.1 The boundary (what may and may not be indexed)
The user now has multiple "views": **current profile**, **past experiences**, **messages**. The §6 invariant is preserved exactly:

| User view | Lives in | Searchable? | How |
|---|---|---|---|
| **Current profile / background** | Firestore `users/{id}` | **No — NEVER indexed** | App-state / Gemini context only (D-035, §6). `documents.import` is never pointed at the profile. |
| **Past experiences** | Firestore `users/{id}.journey[]` (private mirror) | **Yes, consent-gated** | Projected to a **DS-1 sidecar** (`doc_kind=experience`, in-app channel); GCS sidecar = source of truth (D-031). |
| **Messages / postings** | DS-1 sidecar (existing) | **Yes** | Tier-1 (`doc_kind=post`), unchanged. |

**Rule (D-041):** *a searchable view is always published **content** in DS-1 (a sidecar doc keyed by `channel`/`doc_kind`), never the profile record.* This is exactly the D-036 generalization ("a new source = a new channel value, zero schema work") and the sidecar contract (one `.md` + one `.json` per document → **multiple views = multiple documents**, not multiple JSONs on one document). Indexing the live profile itself would reopen D-035 and is out of scope.

### 10.2 Experience documents
A consented `journey[]` entry becomes a sidecar pair: `.md` = the experience text (PII-scrubbed); `.json` = facets **about that experience** (`milestone`, the dated event in `key_dates`, visa-at-the-time, `consulates`, `outcome`) — **never the user's current-state tags** (a past refusal is an experience facet, not a current status). Default consent **OFF**; only shared experiences are projected/indexed. These feed the future "find others in the same boat" / connect feature; `boostSpec` precedence (app > reddit > public) is unaffected.

### 10.3 Reconciliation (D-042)
Because the profile and posting schemas reuse the same controlled vocabulary and **field names**, the merge is a field-level projection performed **at publish time in the backend**, emitting the **single** posting sidecar JSON (the profile contributes context; it gets no sidecar on that document). Conflict rules (from [specs-userprofile.md](specs-userprofile.md)): same value → no-op; message-empty → pre-fill from profile; differ → message wins for the post **and** offer to update the profile; background → union. Deterministic merge + an LLM "conflict explainer" first; a full reconcile agent is a later option.

### 10.4 Decision-log anchors (phase-J)
**D-041** (multi-view = DS-1 content docs; profile never indexed) · **D-042** (publish-time profile↔message reconciliation). Both extend D-035/D-036/D-031 without altering the grounding-vs-app-state split.
