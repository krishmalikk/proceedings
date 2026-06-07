# TODO — Grounding realignment & conversational backend

**Branch:** `raj-test` · **Started:** 2026-06-03 · **Design refs:** [ARCHITECTURE_GAP_reddit-grounding.md](ARCHITECTURE_GAP_reddit-grounding.md), [docs/app/FINAL-ARCHITECTURE.md](docs/app/FINAL-ARCHITECTURE.md), MEMORY.md D-039
**Convention:** `[x]` done · `[ ]` pending · `[~]` blocked/waiting. Items are crossed out as completed.

---

## Phase 1 — Grounding fix (datastore + Answer API) ✅ DONE
- [x] Add `google-cloud-discoveryengine` to `requirements.txt` + install in `.venv` (Py 3.11)
- [x] Build `search_client.py` — `answer_query()` over `imm-postings-search-app` (citations + grounding, dedupe/cap, fallback detection)
- [x] Swap `api.py` `/api/ask` from Vector Search `find_neighbors` → managed Answer API; keep `{answer, sources, is_fallback, id}` contract unchanged
- [x] Verify end-to-end: Reddit question grounds (Mumbai B1/B2), off-topic falls back cleanly, `/api/qa` + `/api/health` work

## Phase 1.5 — DS-2 public-reference tier (no-ingest) ✅ DONE (indexing async)
- [x] Pick curated public domains (orig. config): `uscis.gov`, `travel.state.gov`, `dol.gov`, `boundless.com`, `immigrationdirect.com`
- [x] Write `scripts/provision_ds2_website.py` (idempotent) — basic `PUBLIC_WEBSITE` data store + INCLUDE target sites + engine
- [x] Run provisioner → `imm-public-reference-datastore` + `imm-public-reference-search-app` created
- [x] Wire env-gated tier-3 fallback in `api.py` (`GCP_VERTEX_PUBLIC_ENGINE_ID`): DS-1 fallback → query DS-2 (precedence app > reddit > public)
- [~] **Website indexing populated** — waiting on Google's async basic crawl (all target sites currently `INDEXING_STATUS_UNSPECIFIED`)

## Search/browse postings UX — Phase A ✅ DONE (dedicated Search page)
- [x] Backend `search_client.py`: `search_postings()` (ranked cards via `:search`) + `get_posting()` (detail + GCS `.md` body); recursive struct→native fix for nested facets
- [x] Backend `api.py`: `GET /api/search` (q + visa/consulate/outcome filters + paging) and `GET /api/postings/{case_id}` (404 if missing)
- [x] Website proxy routes: `api/search/route.ts`, `api/postings/[id]/route.ts`
- [x] Website `search/page.tsx`: replaced mock with `/api/search` (cards: title, description, outcome/visa/consulate badges, tags) → link to `/case/{case_id}`
- [x] Website `case/[id]/page.tsx`: `/api/postings/{id}` detail (full Reddit body + facets + "View original on Reddit")
- [x] Verified: cards + detail render via the website proxy (200, no type errors)
- [ ] **Phase B (later):** conversational card-rendering inside the chat (intent routing search-vs-ask) — per user's "search page now, chat cards later"
- [ ] Mobile: wire SearchScreen / CaseMatchCard / CaseDetailsScreen to the same endpoints

## Answer-mode fix ✅ DONE
- [x] Fixed intermittent false-fallback: disabled the Answer API's flaky adversarial/non-answer-seeking skip classifiers; ground on reference-presence instead (verified deterministic 5/5 + E2E 12/12)

## E2E verification ✅ DONE — `tests/test_grounding_e2e.py` (12/12 passed)
- [x] **A** — Reddit-ingested content is returned (DS-1): `/api/ask` + direct client both ground on `reddit-*` docs
- [x] **B** — App posting lands in the right place for grounding: synthetic `channel="app"` doc created in `imm-postings-datastore`, grounded via the same engine, then deleted (cleanup)
- [x] **C** — Public target sites: DS-2 has exactly the 5 registered domains, and tier-3 is consulted **only when DS-1 falls back AND the gate is on** (4 orchestration cases verified)
- [ ] Re-run **B/C** content checks against DS-2 once its crawl indexes (C currently verifies gating/config; DS-2 *content* return is pending indexing)

---

## ⚠️ CAVEAT — D-039 build-time verification (MUST resolve before relying on tier-3)
- [ ] **Confirm the Answer API serves grounded answers over a *basic* `PUBLIC_WEBSITE` data store.**
  - DS-2 uses **basic** website indexing (no domain verification — required since we don't own uscis.gov etc.).
  - **Risk:** the generative **Answer API may not ground over basic website stores** (generative website grounding historically needs *advanced* website indexing).
  - **If basic does NOT support `:answer`**, fall back to one of:
    - **Advanced website indexing** — needs Search-Console **domain verification**, which we cannot do for third-party sites → ❌ not viable for these domains.
    - **Grounding with Google Search restricted to the curated domains** (Gemini grounding tool + site filter) — viable, no datastore/verification, honors "no ingestion"; soft domain enforcement.
  - **Decision to record** (new `D-NNN`) once verified: keep DS-2 website store vs switch tier-3 to Google-Search grounding.
- [ ] Verify `boostSpec` precedence across stores OR confirm the two-call tiered fallback (current impl) is the chosen pattern.

---

## Next steps — Activate & verify tier-3
- [ ] Re-check DS-2 indexing: `.venv/bin/python scripts/provision_ds2_website.py` (reprints status) until sites read `SUCCEEDED`
- [ ] Once `SUCCEEDED`: set `GCP_VERTEX_PUBLIC_ENGINE_ID=imm-public-reference-search-app` in `.env`, restart uvicorn
- [ ] Test the public-knowledge gap: "What is the current H-1B filing fee?" → should ground on uscis.gov/dol.gov (not Reddit chatter) with citations
- [ ] Resolve the ⚠️ caveat above based on that test result

## Next steps — Cleanup / cost
- [x] Remove retired Vector Search code: deleted `index.py` + local `chunk_mapping.json`; stripped dead retrieval funcs from `query.py` (`embed_query`, `retrieve_chunks`, `load_chunk_mapping`, `build_prompt`, `generate_answer`, `query()`, CLI)
- [x] Document live vs retired crawl/index processes — added "4.1 Crawling & indexing" to [FINAL-ARCHITECTURE.md](docs/app/FINAL-ARCHITECTURE.md)
- [x] Document pipeline **file map + operational runbook** (run mode: scheduled/event-driven/manual + steps) — added "4.2" to [FINAL-ARCHITECTURE.md](docs/app/FINAL-ARCHITECTURE.md)
- [x] **Decommissioned the self-managed Vertex AI Vector Search** (D-040) — undeployed both billing endpoints + deleted all 4 endpoints & 4 indexes (incl. orphans) + `chunk_mapping.json` + stale env vars. Grounding unaffected (Cloud Run 13/13). 24/7 cost recovered.
- [ ] Retire the `qa_pairs` Firestore log path (superseded by the D-035 session/profile model — Phase 2)
- [ ] `crawler.py` + `urls.txt`: decide keep (future Firecrawl non-API adapter) vs remove (legacy prototype) — **awaiting confirmation**
- [ ] Label enrichment follow-up: Answer-API references carry empty `labels`; enrich via `documents.get`/`:search` structData so `/api/qa/stats` categories repopulate

## Next steps — Phase 2 (production BFF, P1 search-first)
- [ ] New BFF skeleton: `/v1/chat` (+ stream), `/v1/search`, `/v1/profile`, `/v1/session`
- [ ] Firebase Auth (email/Google/Apple + anonymous guest); verify ID tokens via Admin SDK
- [ ] Firestore app-state: `users/{uid}` (profile) + `sessions/{session_id}` (turns, active_filter, draft, geo, vertex_session_name, TTL)
- [ ] Parallel-speculative routing (`gemini-2.5-flash-lite` intent + speculative answer); guardrail preamble
- [ ] Reuse `answer_query` for grounded search; geo state machine (US vs outside-US prompting)
- [ ] Decide BFF home dir (`app-backend/` vs `website/`) — open per D-038
- [ ] Posting flow + `active_posts` shadow buffer = later (P2)

## Phase H — "Post a new message" composer + nav cleanup (branch `phase-H-posting`) ✅ DONE
**Design ref:** [posting-specs.md](posting-specs.md). Decisions: direct `documents.import` (no Eventarc/auto-sync deployed); "Suggest tags" button (not live-typing); anonymous synthetic-handle author; GCS sidecar + datastore import + BigQuery row.
- [x] UI nav: removed `Forum` (/community) + `Ask a Pro` (/pro) from `TopAppBar`; added a **Post a new message** button (top + mobile bottom-nav `Post`)
- [x] Disabled the **AI-mode** right panel in `UnifiedSearch` behind `AI_MODE_ENABLED=false` (search is now 2-panel: refine + results)
- [x] New `/post` composer page (`website/src/app/post/page.tsx`): 2-panel — left title+description; right tag sections grouped by schema (visa_applying_for / primary_consulate / current_visa_or_greencard_category / consulates / tags / concerns_or_questions_tags) with **Suggest tags**, add/remove chips (vocab-autocomplete datalist), Submit
- [x] Backend `posting.py`: Gemini tagging engine (LLM-EXTRACTION-PROMPT, thinking disabled), vocab load + validate (JSON-SCHEMA-FIELD-DICTIONARY §3), cross-bucket dedup, canonical sidecar build, GCS write → `documents.import` (INCREMENTAL) → BigQuery row (self-provisions `postings.postings_metadata`)
- [x] Backend `api.py`: `POST /api/tag-suggest`, `GET /api/tag-vocab`, `POST /api/postings`; proxy routes `api/tag-suggest`, `api/tag-vocab`, `api/postings`
- [x] `Dockerfile` + `requirements.txt`: added `posting.py` + `google-cloud-bigquery`
- [x] Verified E2E: published 2 test posts → appeared in GCS, datastore (`get_document` + search hit within minutes), BigQuery; then cleaned up datastore+GCS (BQ rows pending streaming-buffer window)
- [ ] **Re-enable AI-mode panel** (spec item 2): flip `AI_MODE_ENABLED=true` in `UnifiedSearch.tsx` and (re)define its UX — grounded vs pure-expert, follow-ups, hide/collapse. Deferred per posting-specs.md.
- [ ] Deploy `posting.py` + new endpoints to Cloud Run (`immiguide-api`) so the hosted site can post (currently localhost-verified only)
- [ ] Purge the 2 BigQuery test rows (`case_id LIKE 'ourwebsite-%'`) once they leave the streaming buffer (~90 min)
- [ ] Spec TBD items: measure post→searchable latency (Q13) and confirm UI freshness (Q14)

## Housekeeping
- [ ] Log a `D-NNN` for the tier-3 mechanism decision + adopt IMPROVED patterns (shadow buffer, speculative routing) into MEMORY.md
- [ ] git commit/push — **handled manually by user** (do not auto-commit)
