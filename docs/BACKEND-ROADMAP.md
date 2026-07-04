# Backend & Product Roadmap — deferred improvements

Follow-ups from the July 2026 full-codebase audit. The critical fixes and quick
wins already landed on `app-store-revisions` (see commits `3c0623b` B1 and
`43a0449` B2); this file tracks what was **deliberately deferred**, with enough
context to pick each item up cold.

## Backend — deferred infrastructure

| # | Item | Why it matters | Sketch |
|---|------|----------------|--------|
| R1 | **Structured logging + request IDs** | ~60 bare `print()`s across api/posting/moderation land in Cloud Run stdout with no severity — can't filter ERROR vs INFO or trace one request through the pipeline. | `google-cloud-logging` (or std `logging` + JSON formatter), middleware stamping a request ID + method/path/status/latency; route exceptions to Error Reporting. |
| R2 | **Shared-store rate limiting** | `check_rate_limit` (api.py:131) is an in-memory per-instance dict: N Cloud Run instances ⇒ N× the limit, unbounded memory growth, and `request.client.host` behind the LB may collapse all users to one IP. `/api/ask` (the expensive Gemini path) isn't limited at all. | Firestore/Redis-backed window or Cloud Armor; parse `X-Forwarded-For`; gate `/api/ask`, `/api/expert`, `/api/chat`. |
| R3 | **`delete_account` groups reverse-index** | api.py deletion scans EVERY group in the system plus a per-group message sub-query — O(all groups) per deletion. | Keep `users/{uid}.group_ids` (or query `groups` with `array_contains` on member uid); consider moving deletion to a Cloud Tasks background job. |
| R4 | **`list_user_replies` / `user_postings` query pushdown** | Both fetch all matching docs then sort/slice in Python. | Push `.order_by(created_at DESC).limit(n)` into Firestore. Requires composite indexes: `replies(user_id ASC, created_at DESC)` and `posting_authors(author_uid ASC, created_at DESC)`. Create the indexes FIRST, then ship the code change (missing index = runtime error). |
| R5 | **Dependency pinning** | `requirements.txt` is all `>=` lower bounds — non-reproducible builds; a transitive bump can break prod. Also `firecrawl-py`/`bigquery`/`tiktoken` inflate the runtime image if only the offline scripts need them. | `pip-tools`/`uv` lockfile; split runtime vs scripts requirements. |
| R6 | **Server concurrency** | Dockerfile runs bare `uvicorn` (single process). B2's sync-handler conversion moved work to the threadpool, but multi-worker still helps CPU-bound JSON work. | `gunicorn -k uvicorn.workers.UvicornWorker --workers 2-4`, tune Cloud Run `--concurrency`. |
| R7 | **Test gaps** | No dedicated `test_query.py` (classify_intent / generate_direct_answer fallback paths) and no `test_api.py` for `check_rate_limit`, `_filter_feed`, `delete_account`, `_require_admin`. | Unit-tier tests following the existing `check()` runner pattern. |
| R8 | **Moderation LLM-path test** | `moderation._gemini_flag` is only exercised with `MODERATION_DISABLE_LLM=1` (fail-open + wordlist branches). | Integration-tier test with a stubbed genai client. |

## Mobile — deferred polish

| # | Item | Notes |
|---|------|-------|
| M1 | **Search/VisaExperiences dedupe** | The two screens are near-identical implementations; extract a shared `ExperienceList` (list + filters + skeleton + empty) consumed by both. Pure hygiene — both already have identical polish, so no visual gain; do it before the next feature touches either. |
| M2 | **Full AppText migration** | ~300 inline `fontSize:` literals remain outside the screens touched in A1–A5. Migrate screen-by-screen as each is next edited (ratchet: `grep -c "fontSize:" src/screens`). New code must use AppText (AGENTS.md). |
| M3 | **Dark mode** | Deferred until M2 lands — then it's a palette swap behind a `useTheme()` hook. `#AE0000` fails contrast on dark surfaces; needs a real dark ramp design. |
| M4 | **Dead mock screens** | AskPro / News / Community(mock) / Onboarding(old) kept as-is per owner decision (unreachable; mockData.ts only feeds them now). Delete or ship them — don't restyle them. |
| M5 | **AI chat markdown** | Assistant bubbles render plain text; the `Markdown` component exists — wire it into `ChatMessage` so lists/bold/links in answers render. |

## Product gaps (the engagement layer)

The scaffolding (onboarding, AI chat, search, groups, posting, profile) is real
and API-backed. What's missing is the reason to RETURN to the app:

1. **Notifications** — none of any kind (no push, no in-app, no badges). Replies,
   votes, and group messages happen silently. Biggest retention gap.
2. **Journey dashboard on Home** — onboarding collects `key_dates`/`key_stages`
   but they surface only on the Profile. A Home card with upcoming-date
   countdowns ("Interview in 12 days") would make the app a daily tool.
3. **Saved/bookmarked postings** — no way to save an experience for later; no
   Saved list. Cheap win (Firestore `saves` collection mirrors votes).
4. **Attorney pillar** — AskPro screen is dead, the CaseDetails teaser is
   flag-gated off (`ATTORNEY_GUIDANCE_TEASER`). Ship or cut.
5. **News/policy feed** — NewsScreen is dead mock; onboarding captures visa
   categories that could drive a real tailored policy feed.
