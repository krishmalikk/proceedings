# Phase B — Implementation Plan

**Branch:** `phase-B` · **Builds on:** Phase A (postings search mode — `main` @ `27602a8`)
**Goal:** bring the "ranked posting cards" experience *into the chat* — one conversational surface that decides per turn whether to return a **synthesized grounded answer** (ask) or a **ranked list of posting cards** (search/browse), per the spec's `/v1/chat` design (D-034).

> Phase A shipped the dedicated `/search` page + `/case/{id}` detail. Phase B is the **conversational** half: cards rendered inline in the chat stream.

---

## Status — v1 SHIPPED ✅ (this branch)
- [x] **Pagination ("Load more")** on `/search` — appends via `next_page_token`.
- [x] **Intent classifier** (`classify_intent`, Gemini flash-lite + heuristic fallback) + **`POST /api/chat`** unified envelope (`mode`, `answer`/`sources` or `results`/`next_page_token`).
- [x] **Shared `PostingCard`** component (reused by `/search` and chat) + **`<Markdown>`** wrapper (`react-markdown` + `remark-gfm` + `rehype-sanitize`).
- [x] **Chat mode-branching** (`ChatInterface` → `/api/chat`): search → posting cards + "view all"; ask → Markdown answer + sources/feedback.
- [x] **Markdown applied** to the posting detail body.
- [x] Verified end-to-end + E2E Group D (search→cards, ask→answer); **14/14** checks pass.
- [ ] Deferred: multi-turn session state; streaming; mobile parity (§4); refine chips.

## 0. Prior groundwork

---

## 1. Scope

**In scope (Phase B v1):**
1. Per-turn **intent routing** in the chat: `search` vs `ask` (vs `off_topic`).
2. A unified chat response envelope returning either an answer or cards.
3. **Inline posting cards** rendered in the chat stream, each linking to `/case/{case_id}`.
4. A **shared `PostingCard` component** reused by `/search` and the chat.
5. **Markdown rendering** for answers and posting bodies (see §5).

**Deferred (later phase):**
- Multi-turn **session state** (conversation memory, `active_filter`, draft) — the full Firestore `sessions/{id}` model (D-035). Phase B v1 is stateless per turn.
- Streaming (SSE) responses; geo-aware proactive prompting; posting flow.

---

## 2. Backend

### 2.1 Intent classification
Add an intent classifier the chat turn calls first. Options (pick in §6):
- **A. LLM (recommended, spec-aligned):** one `gemini-2.5-flash-lite` call → `{intent: search|ask|off_topic}`. Robust to phrasing; ~150–250 ms; cheap. Prompt-cache the instruction.
- **B. Heuristic:** keyword/pattern rules ("show me / find / experiences / list / postings" → search; "what is / how / can I / explain" → ask). Zero latency/cost, but brittle.
- **C. Hybrid:** heuristic fast-path, LLM fallback on ambiguity.

### 2.2 Unified chat endpoint
Add `GET/POST /api/chat` (or extend `/api/ask`) returning one envelope:
```jsonc
{
  "mode": "answer" | "search",
  "answer": "…",            // mode=answer (from answer_query)
  "sources": [ {card} ],    // mode=answer  (citations)
  "results": [ {card} ],    // mode=search  (from search_postings)
  "next_page_token": "…",   // mode=search
  "id": "…"                 // firestore qa id (answer mode)
}
```
- `mode=ask`  → reuse `answer_query()` (Phase 1).
- `mode=search` → reuse `search_postings()` (Phase A).
- Keep `/api/ask` and `/api/search` as-is for the dedicated pages; `/api/chat` is the conversational front door.

**Effort:** ~3–4 h (classifier + envelope; both retrieval paths already exist).

---

## 3. Frontend (website chat)

1. **Extract `components/PostingCard.tsx`** from `/search` page (title, outcome/visa/consulate badges, tags, link to `/case/{id}`) — shared by search page + chat.
2. **`ChatInterface.tsx`**: on each response, branch on `mode`:
   - `answer` → render the answer (as Markdown, §5) + source chips (current behavior).
   - `search` → render a **stack of `PostingCard`s** inline in the chat stream, with a "View all results" link to `/search?q=…`.
3. Point the chat at `/api/chat` (new Next.js proxy route `api/chat/route.ts`).
4. (Optional) quick-reply "refine" chips (e.g. "only approved", "only Mumbai") → re-send as the next turn.

**Effort:** ~4–5 h (shared component + chat branching + proxy route).

---

## 4. Mobile (parallel, optional)
- Extract a `PostingCard` RN component; in `ChatModal`, branch on `mode` to render cards vs answer; reuse `/api/chat` via `apiService.ts`. Wire `SearchScreen`/`CaseDetailsScreen` to `/api/search` + `/api/postings/{id}` (Phase A endpoints). ~½–1 day.

---

## 5. Markdown rendering — advantages (answers + posting bodies)

Currently `case/[id]/page.tsx` renders the posting body with `whitespace-pre-wrap` (plain text). The bodies (and Gemini answers) **contain Markdown** — headings, **bold**, bullet lists, blockquotes, links. Rendering them as proper Markdown:

| # | Advantage | Why it matters here |
|---|---|---|
| 1 | **Structure renders** (headings, lists, bold) | Posting `.md` bodies start with `# Title` and use `**bold**`/`- bullets`; pre-wrap shows the raw `#`, `**`, `-` literally. |
| 2 | **Q&A transcripts become scannable** | The interview posts are "Officer: … / Me: …" with bullet lists — Markdown renders them as clean lists/quotes instead of a wall of text. |
| 3 | **Clickable links** | Reddit bodies contain URLs; Markdown auto-links them (pre-wrap leaves them inert). |
| 4 | **Consistent with answers** | The Gemini `:answer` text already uses `**bold**` and `*` bullets — today they may show literal `**` in the chat. One shared Markdown renderer fixes both the answer and the body. |
| 5 | **Better readability / professional UX** | Matches the "rich card" expectation; supports tables (form fees), code spans (form numbers like `I-130`). |
| 6 | **Safe rendering** | `react-markdown` + `rehype-sanitize` escapes/sanitizes — safe even if a body ever contains raw HTML; no `dangerouslySetInnerHTML`. |

**Cost/effort:** small — add `react-markdown` (+ `remark-gfm` for tables/strikethrough, `rehype-sanitize` for safety); render body/answer through a shared `<Markdown>` wrapper styled with Tailwind `prose`. ~1–2 h.

**Trade-offs:** small bundle increase (~30–40 KB gz); need to constrain styles (Tailwind `prose`/typography) so it matches the design system; sanitize to avoid injection. Net: clearly worth it for a content-heavy reading experience.

**Recommendation:** do the shared `<Markdown>` wrapper as part of Phase B (it benefits both the chat answers and the posting detail), and apply it in `case/[id]/page.tsx` and `ChatInterface.tsx`.

---

## 6. Decisions to confirm before building
1. **Intent classifier:** A (LLM flash-lite, recommended) vs B (heuristic) vs C (hybrid).
2. **Envelope:** new `/api/chat` (recommended, keeps `/api/ask` clean) vs extend `/api/ask` with a `mode` field.
3. **Session memory:** confirm Phase B v1 stays **stateless per turn** (multi-turn `sessions/{id}` deferred to a later phase).
4. **Markdown:** confirm adding `react-markdown` (recommended) for answers + bodies.

---

## 7. Suggested build order
1. Shared `PostingCard.tsx` + `<Markdown>` wrapper (frontend foundations).
2. Backend intent classifier + `/api/chat` envelope.
3. `ChatInterface` mode-branching + `api/chat` proxy.
4. Apply Markdown to posting detail + answers.
5. Verify end-to-end (ask → answer; "show me B1/B2 experiences in Mumbai" → cards) + extend `tests/test_grounding_e2e.py` with an intent-routing case.
6. (Optional) mobile parity.
