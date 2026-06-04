# Architecture Gap — Reddit Content Not Grounded in RAG Answers

**Status:** Recommended solution proposed (see §"Recommended solution") — pending team sign-off and the build-time verifications. Recorded in MEMORY.md as **D-039** (DS-2 website store extending D-016) + handoff **S-001**. ⚠️ The current Vector Search RAG stack **deviates from settled decisions D-016, D-034, D-035** with no authorizing `D-NNN` — see §"Deviations from prior decisions"; the recommendation realigns to them.
**Date:** 2026-06-03
**Branch:** `raj-test`
**Reported symptom:** Backend answers are not grounded in the Reddit content that was ingested from GCS; responses come from law-firm / government sources instead.

---

## TL;DR

The project has **two separate retrieval systems**, and the RAG endpoint (`/api/ask`) queries the one that contains **no Reddit content**.

- **Reddit content IS ingested** into the Vertex AI **Search (Discovery Engine)** datastore `imm-postings-datastore` — **81 documents**, fully indexed and searchable.
- **The RAG path never queries that datastore.** `query.py` / `api.py` ground answers exclusively on a Vertex AI **Vector Search** index that was built from an **older crawled gov/law-firm corpus** and contains **0 Reddit chunks**.

The ingestion path and the retrieval path point at **two different stores that never meet.**

---

## The two systems

### System A — Vertex AI **Vector Search** (what `/api/ask` actually uses)

- `query.py` grounds answers exclusively via `endpoint.find_neighbors(...)` against index endpoint `245914571645124608`.
  - Reference: `query.py:126-133` (`MatchingEngineIndexEndpoint`, `deployed_index_id="legal_intake_deployed_v2"`).
- The index + its `chunk_mapping.json` (**807 chunks**) were built by `index.py` from the `labeled/` folder.
- Content is **only old crawled gov/law-firm pages**: `uscis.gov`, `dol.gov`, `travel.state.gov`, `visaguide.world`, `immigrationdirect.com`, `findlaw.com`, etc.
- **Reddit chunks in this index: 0.** This is why every answer is grounded on law-firm/government sites, never Reddit.

### System B — Vertex AI **Search / Discovery Engine** datastore `imm-postings-datastore` (where Reddit actually landed)

- **81 Reddit documents** fully ingested and indexed (confirmed via the Discovery Engine REST API).
  - Example doc id: `reddit-2026-04-11-USVisas-1socshn`.
  - Each carries rich `structData`: `background_summary`, `gcs_path`, `derived_topic_cluster`, consulate/outcome `key_stages_or_info`, `subreddit`, `reddit_post_id`, etc.
- Matches the **71 + 10 = 81** `.md` files in the dated `reddit/` folders in the bucket.
- **No code in `query.py` / `api.py` ever queries this datastore.** There is no Discovery Engine `SearchService` call anywhere in the RAG path.

---

## Evidence collected (GCS bucket `imm-postings-ingestion`)

### Bucket layout
```
gs://imm-postings-ingestion/
├── chunk_mapping.json          # 807 chunks — ALL law-firm/gov, ZERO reddit
├── 2026-04-11/reddit/          # 71 reddit .md (+ .json) posts
├── 2026-05-21/reddit/          # 10 reddit .md (+ .json) posts
├── 2026-05-22/reddit/_manifest/  # Discovery Engine import manifest (jsonl)
├── 2026-05-28/reddit/_manifest/  # Discovery Engine import manifest (jsonl)
├── _manifests/                 # reimport manifests (jsonl)
└── labeled/labeled/1..82       # Label Studio annotation-export JSON (NOT markdown)
```

### `chunk_mapping.json` source breakdown (top sources)
- 807 chunks total, 241 distinct source files — all `.md` from gov/law-firm domains.
- Top: `dol-gov-...` (30), `travel-state-gov-...fees...` (29), `uscis-gov-...tps` (24), `uscis-gov-forms-all-forms` (20), ... `visaguide-world-...h1b` (10), `immigrationdirect-com-...h1b-visa-guide` (13).
- **No `reddit` source files present.**

### Discovery Engine datastore document count
- REST query against `projects/proceedings-490601/locations/global/dataStores/imm-postings-datastore/branches/default_branch/documents`:
  - **Total documents: 81** (all Reddit).

### The `labeled/` folder is malformed for `index.py`
- `index.py` reads prefix `labeled/` (`index.py:46-63`) expecting markdown to chunk.
- Actual contents are nested `labeled/labeled/1..82` files in **Label Studio annotation-export JSON** shape:
  ```json
  { "task": { "data": { "text": "..." } },
    "result": [ { "value": { "choices": [ ... ] } } ] }
  ```
- These are Reddit posts, but in annotation format, not the clean markdown the indexer expects. Re-running `index.py` today would **not** correctly pick up Reddit content even though the folder name suggests it would.

---

## Root cause

**The retrieval path and the ingestion path point at two different stores.**

- The Reddit ingestion pipeline writes to the **Discovery Engine datastore** (`imm-postings-datastore`).
- The RAG reader (`query.py` → `find_neighbors`) queries the **Vector Search index** (`VERTEX_AI_INDEX_ENDPOINT_ID=245914571645124608`).
- The live Vector Search index was built from a **prior law-firm corpus**, and its source folder (`labeled/`) does not contain Reddit markdown.

So Reddit content can never appear in `/api/ask` answers, regardless of how well it is ingested into the datastore.

---

## Remediation options (decision pending)

### Option 1 — Point RAG at the Discovery Engine datastore
Replace/augment `retrieve_chunks()` to call the Discovery Engine **SearchService** on `imm-postings-datastore`.

- **Pros:** Reddit content is *already* ingested — no re-indexing; gains rich `structData` (filters, topic clusters, stages).
- **Cons:** New retrieval code; must set a **quota project** for `discoveryengine.googleapis.com`; install `google-cloud-discoveryengine`; two stores to maintain (law-firm in Vector Search, Reddit in datastore) unless consolidated.

### Option 2 — Add Reddit content to the Vector Search index
Copy `YYYY-MM-DD/reddit/*.md` into a clean `labeled/` (markdown, not Label Studio JSON), then re-run `index.py` to embed (`text-embedding-005`) and rebuild `chunk_mapping.json` + the index.

- **Pros:** Keeps the existing RAG/embedding path unchanged; one unified, homogeneous index.
- **Cons:** Re-embeds the corpus; **requires fixing the `labeled/` folder first** (currently Label Studio JSON, not markdown); ongoing Reddit batches must be normalized to markdown before indexing.

| Dimension | Option 1 (datastore search) | Option 2 (vector index) |
|---|---|---|
| Reuses existing ingestion | ✅ Yes (81 docs ready) | ❌ Must re-index |
| Code change surface | Retrieval layer (`query.py`) | Data prep + re-run `index.py` |
| Stores to maintain | 2 (unless consolidated) | 1 |
| Extra setup | Quota project + DE client lib | Normalize `labeled/` to markdown |
| Metadata richness | High (structData filters) | Chunk labels only |

---

## Secondary cleanup (applies to either option)

- The `labeled/` folder is malformed for `index.py`: nested `labeled/labeled/` containing annotation JSON instead of markdown. This should be corrected regardless of which option is chosen.
- Decide whether the law-firm Vector Search index and the Reddit datastore should be **consolidated into one retrieval store** long-term, or intentionally kept as two with a merge step at query time.

---

## Suggested next step

Before committing to an option, reproduce a query directly against `imm-postings-datastore` (Discovery Engine search) to confirm the Reddit docs return relevant results for a representative question. That validates Option 1's quality and de-risks the decision.

---

## Spec alignment — the specs already mandate the datastore

The two approved design specs settle what the *intended* architecture is, and the implemented `query.py`/`api.py` diverges from it.

### Both specs target Vertex AI **Search (Discovery Engine)**, not Vector Search

- `app-specifications/APP-BACKEND-ARCHITECTURE.md`:
  - §2 diagram + §3 component table (line 60): grounding = Vertex AI **Search** `imm-postings-search-app` / `imm-postings-datastore` (location `global`) via the **Search + Answer API**.
  - §8 "Vertex AI Search query contract" → `:search` (ranked results + facets) and `:answer` (grounded NL answer + citations + multi-turn session).
  - §17: "single sink (D-016)… No second index, no schema fork."
- `app-specifications/APP-FRONTEND-INTEGRATION.md`:
  - Line 5: "against the `imm-postings-datastore` index"; citations resolve to `case_id` (e.g. `reddit-…`).

Neither spec mentions Vertex AI **Vector Search**, `find_neighbors`, `chunk_mapping.json`, or `text-embedding-005`. **The implemented RAG stack is a parallel design that was never in the specs** — this is the root of the gap.

### Where *posted* (app/website) content is supposed to go

Per `APP-BACKEND-ARCHITECTURE.md` §10 (lines 181-206), a confirmed post follows the **same ingestion contract as Reddit**:

```
compose .md → Tagger → Validator → GCS sidecar
  gs://imm-postings-ingestion/<date>/app/<case_id>.{md,json}
  → BigQuery upsert → documents.import INCREMENTAL → imm-postings-datastore
  → mirror a ref in Firestore posts/{case_id}
```

- The post becomes a first-class faceted doc in the **same datastore** with `channel="app"`, `source_system="unclesamcalling"`.
- **GCS sidecar pair = source of truth** for posting content (§12, line 233); `posts/{case_id}` in Firestore is only an app-side ref for "my posts" + ownership.
- **Grounding sink = the datastore.** Firestore is NOT a grounding store.

**As-built reality:** the current `api.py` implements **none** of this posting flow — no `/v1/posts:*`, no GCS write, no `documents.import`. The only write path is `save_qa_pair()` → Firestore (question + answer + sources). So today, app/website "posts" do not exist and nothing the app writes reaches a grounding store.

---

## Constrained variant — two-store hybrid with datastore precedence

**Context (new constraint, 2026-06-03):** Public reference content (the 807 gov/law-firm chunks) will **NOT** be re-ingested into the datastore. It stays in the existing **Vector Search** index. Only Reddit (and later app posts) live in the datastore. Desired ranking: **datastore content = higher precedence; Vector Search public content = lower precedence / fallback.**

This is a deliberate deviation from the specs' D-016 "single index" invariant. It is workable, but it moves the **merge + ranking responsibility into the BFF**, because the datastore's managed `:answer` endpoint can only ground over the datastore — it cannot see the Vector Search index. So "datastore-primary, public-fallback" cannot be one managed call.

### Trade-off accepted
- Lose *unified* faceting/citations across both corpora.
- Gain: no re-ingestion of public content; keep the existing Vector Search index untouched.
- Cost: a custom retrieval/merge layer in the BFF.

### Pattern 1 — Tiered fallback (recommended starting point)
```
BFF → datastore :answer   (experiences; managed grounding + citations)
  ├─ confident grounded answer?  → return it            ← experiences win = higher precedence
  └─ low/no grounding?           → Vector Search find_neighbors + Gemini compose over public content
```
- Precedence is literal and obvious; minimal new code; keeps the managed Answer API for the primary path.
- Weakness: any single answer is sourced from **one** store at a time — no blending of experiences + public law in the same answer.

### Pattern 2 — Blended retrieval (richer, more work)
```
BFF → datastore :search  +  Vector Search find_neighbors   (parallel)
    → merge candidates, weight datastore scores above public (precedence)
    → Gemini composes one grounded answer citing both, labeled
      "community experience" vs "public reference"
```
- True blended answers; precedence implemented as a score boost / slot cap.
- Cost: re-implements the grounding + citation assembly the Answer API gives for free, over two heterogeneous result shapes.

### Alternative — two **datastores** + blended search (fully managed)
If the real goal is to avoid building a merge layer (rather than to avoid re-ingestion):
- Make the public content a **second Discovery Engine datastore**, put both under one engine, use **blended search + `boostSpec`** to rank `channel ∈ {reddit, app}` above `channel = public`.
- Stays inside the managed Search/Answer API (one call, built-in precedence via boost, unified citations) — **no custom merge code**.
- Catch: requires moving public content off Vector Search into a datastore (one-time re-ingestion).

### Decision reduces to one question

| Hard constraint | Recommended design |
|---|---|
| **"Don't re-ingest public content"** | **Two stores + Pattern 1 hybrid in the BFF.** Datastore primary, Vector Search fallback. *(Current stated scenario.)* |
| **"Don't build a merge layer"** | **Two datastores + blended search with `boostSpec`.** Fully managed, public content re-ingested once. |

**Recommendation under the stated constraint:** datastore remains the **primary** grounding store; add the Vector Search index as a **secondary/fallback** source via **Pattern 1**. Graduate to Pattern 2 only if the product needs experiences + public law woven into a single answer. Either way, the existing `find_neighbors` path is *reused as the fallback*, not the primary — and the app posting flow (§10) must still be implemented to write into the datastore.

---

## Firestore — role, conversational state, and removal impact (as-built vs spec)

### What Firestore does in the current build
- **One collection only: `qa_pairs`** — a flat, **anonymous, single-turn Q&A log**. Written *after* an answer is generated; never read during grounding.
- Document shape ([query.py:398-406](query.py)): `question`, `answer`, `retrieved_chunks`, `sources`, `created_at`, `is_fallback`, `helpful`. **No `uid`, no `session_id`, no `turns`.**
- Used at exactly four touch points in `api.py`:
  - `POST /api/ask` → `save_qa_pair()` (write, after answer)
  - `GET /api/qa` → `get_recent_qa()` (global feed, newest-first, no user filter)
  - `POST /api/qa/{id}/feedback` → `update_feedback()` (set `helpful`)
  - `GET /api/qa/stats` → in-Python aggregation of the last 200 docs
- **Optional/non-fatal:** startup wraps the client in try/except (`_db = None`); answering still works without it.

### Is Firestore the grounding truth? — No (confirmed in code)
Retrieval/answer generation read only from Vector Search + `chunk_mapping.json`; the prompt is built solely from the question + retrieved chunks. Firestore is written to afterward and never feeds an answer. **This is true in both the current build and the specs.**

### Where is per-user conversational state stored today? — Nowhere durable
There is **no user identity and no conversation memory** anywhere (verified: zero `uid`/`auth`/`session`/`turns` in `api.py`/`query.py`). What exists:

| Location | Content | Lifetime |
|---|---|---|
| Client UI React `useState` (website `messages`, mobile `chatItems`) | the visible thread, for display | ephemeral — lost on close/refresh; never sent to backend |
| Request payload | `{ "question": "..." }` only | no history/session/prior turns transmitted |
| Backend | `qa_pairs` log | anonymous, global, single-turn — not a conversation |

**Every `POST /api/ask` is fully independent / stateless** — no multi-turn memory. The per-user `sessions/{session_id}` multi-turn model is **spec-only (D-035 / §5) and unimplemented.**

### Impact of removing Firestore

| | **Current build** | **Target architecture (specs)** |
|---|---|---|
| Grounding/answers | **No impact** — never a grounding source | No impact |
| What breaks | `GET /api/qa`, feedback capture, `GET /api/qa/stats` (history + analytics) | The entire **app-state tier**: auth/profiles, multi-turn sessions, posting drafts, saved searches, alerts, post-ownership refs |
| Severity | Low — code already degrades gracefully (`if not _db`) | High — removes memory/identity/personalization; needs a replacement stateful store; **contradicts D-035** (see deviations) |

**Bottom line:** removing Firestore is harmless for a stateless, single-turn grounded-search MVP. It becomes necessary the moment you want conversation memory, user identity, or posting — which is exactly the product the specs describe, and is a **settled decision (D-035)**.

---

## Deviations from prior decisions (MEMORY.md) — ⚠️ RAISED

The implemented `api.py`/`query.py`/Vector Search stack **diverges from three settled decisions** in [MEMORY.md](MEMORY.md). There is **no `D-NNN` entry authorizing** the Vector Search RAG approach — it appears to have been added (commit "Add RAG pipeline support…") outside the decision log.

### ⚠️ Deviation 1 — violates **D-016** ("Single sink = Vertex AI Search; streaming Vector Search REJECTED")
- **D-016 (2026-05-18):** one sink = **Vertex AI Search** (Discovery Engine datastore) via event-driven `documents.import`; **"Streaming Vertex AI Vector Search is not adopted."** Rejected because the Vector Search index endpoint is an **always-on node billed 24/7 (~$48–$500+/mo)** for seconds-fresh recall not needed, and "standalone Vector Search only — loses managed grounding/citations."
- **Current build:** grounds answers on exactly that **rejected** Vertex AI **Vector Search** index (`find_neighbors`, `deployed_index_id="legal_intake_deployed_v2"`, `VERTEX_AI_INDEX_ENDPOINT_ID`).
- **Consequences:** (1) it incurs the always-on cost D-016 rejected; (2) it queries the *wrong store* — the datastore (with the Reddit content) is never hit — **this is the root cause of the grounding bug**; (3) it forgoes the managed Answer-API grounding/citations the specs rely on.

### ⚠️ Deviation 2 — diverges from **D-034** (BFF calls the Search + Answer API over the datastore)
- **D-034 (2026-05-29):** the app BFF retrieves via the **Vertex AI Search "Search + Answer" API** over `imm-postings-datastore`; data tier "unchanged: single Vertex AI Search sink (D-016)."
- **Current build:** the FastAPI service matches the Option-A *shell* (Cloud-Run-style FastAPI + Gemini), but performs retrieval via Vector Search `find_neighbors` and a self-built prompt → Gemini, **not** the Discovery Engine `:answer` API. Retrieval contract not followed.

### ⚠️ Deviation 3 — `qa_pairs` is not the **D-035** app-state model
- **D-035 (2026-05-29):** Firebase Auth + Firestore hold **profiles, multi-turn conversation sessions (turns + draft + intent + geo), saved searches, alerts, posting history**.
- **Current build:** Firestore holds only an anonymous `qa_pairs` log (a collection in **no** spec); none of the D-035 collections, no Firebase Auth, no sessions exist.
- *Not a D-013 violation:* D-013 ("no Firestore") was scoped to the **ingestion pipeline**; D-034/D-035 deliberately re-introduced Firestore for **app state** as a separate concern. So Firestore-for-app-state is *required*, just unimplemented.

### Decision-log implications for the options under review

- **"Remove Firestore" (earlier question):** harmless for the current log, but **removing it from the app architecture contradicts D-035**, which explicitly chose Firestore over Cloud SQL / Identity Platform for sessions/auth/alerts. Reopening it needs a new superseding `D-NNN`.
- **Two-store hybrid / "keep public content in Vector Search with lower precedence" (current discussion):** this **conflicts with D-016's single-sink invariant** and keeps alive the very always-on Vector Search endpoint D-016 rejected on cost. The decision-log-conformant path is the opposite: bring public gov/law content into the **same datastore as a new `channel`** (D-036 already generalized the schema for exactly this — "future website channels drop in with no further schema change"; cf. the Firecrawl web channel, D-012), and ground via the Answer API. **If the two-store hybrid is still chosen, it should be recorded as a new `D-NNN` that explicitly supersedes/qualifies D-016**, with the cost trade-off acknowledged.

**Recommendation:** treat the current Vector Search RAG stack as an **un-logged prototype that diverged from D-016/D-034/D-035**, and either (a) realign to the decided architecture (datastore + Answer API + the D-035 app-state model), or (b) if the team genuinely wants to keep Vector Search and/or a two-store hybrid, **write the superseding decisions into MEMORY.md first** so the log stops lying about the system.

---

## ✅ Recommended solution (full requirement set)

**Requirements (confirmed 2026-06-03):**
Grounding sources, in priority order — (1) **app/web postings**, (2) **Reddit ingestion** (+ future sources), (3) **specific public sites, NO ingestion**. Plus (4) **user profile storage** and (5) **user conversational history/state**.

**Key insight:** requirement 3's *"no ingestion"* settles the earlier two-store debate. The existing Vector Search index only exists *because* public content was crawled→chunked→embedded — i.e. ingested. "No ingestion" therefore rules that index *out* on requirements grounds (not just decision-log grounds), and points to a Google-crawled managed source.

### Target architecture — one grounding system (Vertex AI Search), two data stores, three priority tiers, + Firestore

```
                         ┌──────────────────────────────────────────┐
   web / mobile  ──────► │  BFF (Cloud Run, FastAPI + Gemini)        │
   (Firebase ID token)   │  intent · sessions · guardrails · publish │
                         └───┬───────────────┬───────────────┬───────┘
                grounding ◄──┘  app state ◄──┘  identity ◄────┘
                     │                │                │
        ┌────────────▼─────────────┐  │          Firebase Auth
        │  Vertex AI Search engine │  │
        │  (Search + Answer API)   │  ▼
        │  blended + boostSpec     │  Firestore (Native)
        │                          │   • users/{uid} ............. (4) profile
        │  ┌────────────────────┐  │   • sessions/{id} turns,draft  (5) conversation
        │  │ DS-1 structured    │  │   • saved_searches / alerts / posts
        │  │ imm-postings-      │  │
        │  │  datastore         │  │   Precedence (boostSpec):
        │  │  channel=app   ◄── (1) highest      app > reddit > public
        │  │  channel=reddit◄── (2)
        │  │  +future channels  │  │
        │  └────────────────────┘  │
        │  ┌────────────────────┐  │
        │  │ DS-2 website store │◄── (3) public sites, NO ingestion (Google-crawled)
        │  └────────────────────┘  │
        └──────────────────────────┘
```

### Requirement → component mapping

| # | Requirement | Where it lives | Basis |
|---|---|---|---|
| 1 | App/web postings (highest grounding priority) | **DS-1** `imm-postings-datastore`, `channel="app"`, via Tagger→Validator→GCS→`documents.import` | D-034 / D-036 / D-038 |
| 2 | Reddit ingestion (+ future sources) | **DS-1**, `channel="reddit"`; future sources = new `channel` values, **no schema change** | D-036 |
| 3 | Specific public sites, **no ingestion** | **DS-2 = Vertex AI Search *website* data store**, scoped to those domains' URL patterns; Google crawls/indexes | NEW — D-039 (below) |
| 4 | User profile | **Firestore** `users/{uid}` + Firebase Auth | D-035 |
| 5 | Conversational history/state | **Firestore** `sessions/{session_id}` (turns, draft, intent, geo) + Vertex Answer-API managed session | D-035 / D-034 §2.1 |

### Precedence is a managed feature, not custom code
One `:answer` call against the blended engine with a `boostSpec`: boost `channel="app"` highest, `channel="reddit"` next (both DS-1), DS-2 (public) baseline → ranks lowest. Result: the exact 1>2>3 order with **unified citations in a single managed answer** — no BFF merge layer, no always-on serving node.

### What this retires
- **The self-managed Vertex AI Vector Search index** (`legal_intake_deployed_v2`, 807 chunks): violates D-016, bills 24/7, and contradicts requirement 3. Its public source sites (uscis.gov, dol.gov, travel.state.gov, …) become **DS-2's URL patterns**.
- **The `qa_pairs` log**: superseded by the D-035 Firestore session/profile model.

### Decision-log conformance
- **D-016** (single managed Vertex AI Search sink; self-managed Vector Search rejected) → ✅ honored; Vector Search retired.
- **D-034** (BFF + Gemini + Search/Answer API) → ✅ honored.
- **D-035** (Firebase Auth + Firestore for profiles/sessions) → ✅ honored (req 4 & 5).
- **D-036** (channel-agnostic schema; app first; future channels free) → ✅ honored (req 1, 2, future).
- The one new element — **DS-2 public website data store** — is recorded as **D-039**, which *extends* (does not contradict) D-016: it stays fully inside managed Vertex AI Search and preserves D-016's no-always-on-node cost/ops reasoning.

### Build-time verification items (per D-038's "confirm against live Google docs" practice)
1. **Blend + cross-store boost:** confirm a website data store can be blended with the structured datastore in one engine and that `boostSpec` ranks across stores. **Fallback if not:** a thin **two-call BFF merge** (`:answer` over DS-1 primary + secondary query over DS-2, merged by precedence) — both halves still managed Vertex AI Search (citations, no Vector Search node).
2. **Public indexing mode:** advanced website indexing needs domain verification (you don't own uscis.gov), so third-party public sites use **basic website search** (URL-pattern scoped, no verification) or, if coverage is thin, **Grounding with Google Search restricted to those domains**. Either keeps "no ingestion" intact.

### One-line summary
Put req 1 & 2 in `imm-postings-datastore` as `channel`s with `app > reddit` boost; put req 3 in a Google-crawled **website data store** (no ingestion) ranked lowest; blend both under one Answer-API engine; keep Firestore for req 4 & 5 — retiring the Vector Search index and realigning with D-016/D-034/D-035/D-036.

---

## Reference: key files & identifiers

- RAG retrieval: `query.py:126-133` (`find_neighbors`, `deployed_index_id="legal_intake_deployed_v2"`)
- API endpoint: `api.py` (`POST /api/ask`)
- Indexer: `index.py:46-63` (reads `labeled/` prefix), `index.py` (writes `chunk_mapping.json`)
- Env (`.env`):
  - `VERTEX_AI_INDEX_ID=8958040089863127040`
  - `VERTEX_AI_INDEX_ENDPOINT_ID=245914571645124608`
  - `GCP_VERTEX_DATASTORE_ID=imm-postings-datastore`
  - `GCP_VERTEX_DATASTORE_LOCATION=global`
  - `GCP_PROJECT_ID=proceedings-490601`
  - `GCP_BUCKET_NAME=imm-postings-ingestion`
