# Changes — `phase-C` branch

**Branch:** `phase-C` (branched from `phase-B`, which branched from `main`)
**Theme:** Search/discovery UX — conversational posting search, precision control, and **context-aware dynamic filters**.
**Date:** 2026-06-03

This branch contains the **Phase B** work (committed) plus the in-progress **Phase C** work (context-aware filters — backend done, UI pending).

---

## Phase C — Context-aware dynamic filters (NEW on this branch)

**Goal:** replace the static `visaType`/`outcome` filter lists with filters that are **dynamic, driven by the conversation/situation and the tag hierarchy, scoped to live data counts.**
Example: *"I'm in the USA on H-1B applying for an extension and have a question on RFE"* → surface **H1B RFE, H1B Extension, H1B Denial, Premium Processing** (not consulate), each with a real count.

### How it works
1. **Situation extraction** — `extract_filters()` (Phase B) detects the situation facets from the query (visa, consulate, outcome, tags, category).
2. **Tag hierarchy** — `_tag_hierarchy()` loads `tags-cleaned/1.6-visa-form-actions.csv` (`Associated Visa/Form` column) into `{visa → related concern/action tags}` (e.g. `H-1B → {h1b-rfe, h1b-extension, h1b-transfer, h1b-denial, …}`).
3. **Live counts** — `suggested_filters()` anchors on the situation's visa, runs a Discovery Engine **`FacetSpec`** query scoped to that subset over `concerns_or_questions_tags`, `tags`, `key_stages_or_info.outcome_status`, `consulates`, and ranks values **hierarchy-related-first, then by count**, excluding already-applied values.
4. **Friendly labels** — `_humanize()` for tag codes (with acronyms: RFE/AOS/H-1B…), `_consulate_label()` maps codes → city/country names (BOM → Mumbai).

### Backend changes — `search_client.py` (+126 lines)
| Symbol | Purpose |
|---|---|
| `_tag_hierarchy()` / `_hierarchy_related(code)` | Load `{visa → related tags}` from 1.6; lookup |
| `_humanize(code)` | Code → readable label (acronym-aware) |
| `_consulate_label(code)` / `_value_label(field, code)` | Consulate code → city name; field-aware labeling |
| `_SUGGEST_FIELDS` | The refinement dimensions surfaced (Concern/Topic/Outcome/Consulate) |
| `suggested_filters(query, …)` | Returns `[{key, label, field, values:[{code, label, count}]}]` — hierarchy + live counts |

### Backend changes — `api.py` (+39 lines)
- New models `FacetValue`, `SuggestedFilter`.
- `suggested_filters` field added to `SearchResponse` **and** `ChatResponse`.
- `_suggest(query)` helper (best-effort; never breaks search).
- Populated in **`/api/search`**, **`/api/chat` (search mode)**, and **`/api/chat` (answer mode)** — so situation-relevant refinements appear regardless of whether the turn returns cards or an answer.

### API contract additions
```jsonc
// /api/search and /api/chat responses now include:
"suggested_filters": [
  { "key": "concern", "label": "Concern", "field": "concerns_or_questions_tags",
    "values": [ { "code": "h1b-rfe", "label": "H1B RFE", "count": 3 }, … ] },
  { "key": "outcome", "label": "Outcome", "field": "key_stages_or_info.outcome_status",
    "values": [ { "code": "approved", "label": "Approved", "count": 1 }, … ] }
]
```

### UI — dynamic contextual filter chips (`9392748`)
- **`SuggestedFilters` component** — renders the facet groups (Concern/Topic/Outcome/Consulate) as clickable chips with **live counts**, ranked hierarchy-related-first.
- **Search page** — replaced the static "Outcome" pills with the dynamic suggestions; selecting a chip applies that facet as an **exact** filter and re-searches (kept the Visa dropdown + precision slider).
- **Chat** — refinement chips ("Refine to related experiences") appear under the latest reply; clicking re-asks the last question with the facet applied. Works on answer and search turns.
- **Exact selection backend** — `/api/search?facet=field:value` + `/api/chat {facets:[…]}`; `_facets_filter()` (whitelisted fields) → hard AND/OR filter; `search_with_strictness(extra_filter)` applies selected chips as an exact filter regardless of the strictness slider. Chat proxy forwards `facets`.

### Resilience fix (`26852e2`)
A transient gRPC blip to Discovery Engine (`ServiceUnavailable: Handshake read failed`) had surfaced as a **500** on Ask AI. Fixed:
- `search_client._retry()` wraps the `:search`/`:answer` gRPC calls — retries `ServiceUnavailable`/`DeadlineExceeded`/`InternalServerError` with backoff (3×), so blips self-heal.
- `api._guard()` turns a persistent GCP error into a clean **503** ("temporarily unavailable, please try again") instead of a 500 traceback, on `/api/ask` + `/api/chat`.

### Tests (`9392748`)
- `tests/test_search_features.py` **Group K** — hierarchy ranking, counted facets, exact narrowing (71→3 on `h1b-rfe`), chat honors selected facets.
- Suites green: **`test_grounding_e2e.py` 17/17** + **`test_search_features.py` 24/24** (41 total).

### Status — ✅ Phase C COMPLETE
All tasks (18–21) done, verified live + automated, committed and pushed.

### Phase C commits
| Commit | Summary |
|---|---|
| `4da306a` | Backend: tag hierarchy + `suggested_filters` (hierarchy + live counts) |
| `9392748` | UI: dynamic contextual filter chips + exact facet selection + Group K tests |
| `26852e2` | Resilience: retry transient Discovery Engine errors; 503 not 500 |

---

## Phase B — Search/discovery features (committed on this branch)

| Commit | Summary |
|---|---|
| `27602a8` | **Postings search mode** — `:search` ranked cards (`/api/search`) + detail (`/api/postings/{id}`); website `/search` + `/case/[id]` wired; answer-mode fallback fix (disable flaky skip classifiers → ground on reference presence) |
| `a0ad48f` | Search **pagination** ("Load more") + Phase B plan |
| `3ee0842` | **Conversational cards + Markdown** — `classify_intent` + `/api/chat` envelope (answer vs cards); shared `PostingCard`; `react-markdown` rendering for answers + posting bodies |
| `9430f5c` | **Precision slider** — Broad/Balanced/Strict (filter / boost / semantic), persisted; applied-filter chips; relax fallback |
| `29c22d0` | **Generic facet extraction** — registry-driven over all tag vocabularies (consulate/visa/category/outcome/tag), not just consulate |
| `bdccf0f` | **Test suite** — `tests/test_search_features.py` (20 checks) |

### Phase B highlights
- **Two chat modes:** ask → grounded answer (Markdown); search → ranked posting cards → `/case/{id}` detail.
- **User-controlled precision:** strictness slider tunes filter vs boost vs semantic, using the already-tagged facets; chips show what was applied; "no exact matches — showing related" relax fallback.
- **Generic, vocabulary-driven** facet extraction + a single registry (`_FACET_SPECS`) — add a facet = one line.

---

## Files changed on this branch (vs `main`)

**Backend (Python)**
- `search_client.py` — search/answer client, `:search` cards + detail, generic facet extraction, strictness, **Phase C hierarchy + `suggested_filters`**
- `api.py` — `/api/search`, `/api/postings/{id}`, `/api/chat`, strictness, **Phase C `suggested_filters`**
- `query.py` — `classify_intent` (+ heuristic fallback)
- `tests/test_search_features.py` — 20-check suite *(Phase C group still to add)*
- `tests/test_grounding_e2e.py` — Groups D (chat routing) + E (strictness)

**Website (Next.js)**
- `src/app/api/{search,chat,postings/[id]}/route.ts` — proxy routes
- `src/app/search/page.tsx` — live search + filters + pagination
- `src/app/case/[id]/page.tsx` — live detail + Markdown body
- `src/components/{PostingCard,Markdown,StrictnessSlider}.tsx`
- `src/components/ChatInterface.tsx` — mode branching + slider + chips
- `package.json` — `react-markdown`, `remark-gfm`, `rehype-sanitize`

**Docs**
- `PHASE-B-PLAN.md`, `CHANGES-phase-C.md` (this file)

---

## How to test (local)

```bash
# backend
.venv/bin/python -m uvicorn api:app --reload --port 8000
# website (points at localhost:8000 via website/.env.local)
cd website && npm run dev

# automated
.venv/bin/python tests/test_grounding_e2e.py     # 17/17
.venv/bin/python tests/test_search_features.py   # 20/20

# Phase C suggested_filters (backend)
curl -s -X POST localhost:8000/api/chat -H 'Content-Type: application/json' \
  -d '{"question":"I am in USA on H-1B applying for extension and have a question on RFE"}' \
  | python -c "import sys,json;[print(g['label'],[v['label']+'('+str(v['count'])+')' for v in g['values']]) for g in json.load(sys.stdin)['suggested_filters']]"
```

---

## Phase C — done ✅
Backend (hierarchy + `suggested_filters`), UI (dynamic chips + exact selection), tests (Group K), and the resilience fix are all complete, verified, committed, and pushed.

### Optional future enhancements (not blocking)
- Update chip **counts as you select** (scope `suggested_filters` to the current selection).
- Extend the hierarchy anchor to **green-card categories** (1.2) and a **status** dimension (in-US/outside-US).
- Merge the facet-suggestion `FacetSpec` into the main search call to avoid the extra request.
- Frontend component tests (no JS test runner wired up yet).
