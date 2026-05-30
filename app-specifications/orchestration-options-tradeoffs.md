# Conversational-Orchestration Architecture — Options & Trade-offs

**Status:** ✅ **DECIDED — Option A (Cloud Run BFF + Gemini), 2026-05-29.** Recorded as **D-034** in [MEMORY.md](../MEMORY.md). The decision and the explicit reasoning for rejecting Option C are consolidated in [§8](#8-decision-2026-05-29--option-a-chosen-why-not-c) below; the comparative analysis in §1–§7 is retained as the basis for the choice. The orchestration layer in [app-backend-specs.MD](app-backend-specs.MD) is Option A.

---

## 1. What this decision is

The mobile and web apps are **chatbot-first**: a single conversational surface drives *search*, *posting*, *account/profile*, and *general Q&A* ([app-specs.MD §5.1](app-specs.MD)). Something has to sit between the client and the data tier and own the **conversation loop**:

1. **Intent recognition** — search vs post vs manage-account vs general question.
2. **NLU + multi-turn context** — remember conversation state across turns.
3. **Proactive prompting** — geo-aware question scripts (the US vs outside-US branches in §5.1) to fill missing info.
4. **Search + grounded answer** — query → hybrid retrieval over `imm-postings-datastore` → Gemini answer with citations + result cards.
5. **Conversational filtering** — "only show ones posted today" → facet/`filter` on structData.
6. **Posting flow** — extract entities → ask for gaps → show a draft/review card → on confirm, produce a canonical metadata JSON tagged against the master vocab and land it as a sidecar pair (this is the "app as another ingestion channel" requirement).
7. **Domain guardrails** — keep the bot on US-immigration topics only.

The data tier is **fixed and not in scope here** (settled): a single **Vertex AI Search** sink (`imm-postings-datastore` / `imm-postings-search-app`, D-016) consumed via the **Search + Answer** APIs, and the **Tagger → Validator → GCS-Writer → `documents.import`** ingestion contract (`schema.py`, sidecar pattern, D-031). Every option below uses *both of these the same way*. The only thing that varies is **who owns the conversation loop** (items 1–7).

> Important framing: the **Search + Answer API is a building block, not an option by itself.** All three options call it for retrieval+grounding. The real fork is whether the conversation loop lives in **your own service (A)**, in **Vertex's managed app consumed near-directly (B)**, or in **a managed ADK agent (C)**.

---

## 2. Option A — Custom Cloud Run BFF + Gemini

A stateless **FastAPI service on Cloud Run** is the single backend-for-frontend. It calls **Gemini directly** for intent/extraction/proactive-prompting, calls the **Discovery Engine Search + Answer API** for retrieval+grounding, owns the **per-session metadata JSON**, and on publish drives the **existing Tagger→Validator→GCS-Writer** path. Session/profile state lives in the app state store (Firestore or Cloud SQL — separate decision).

### How each requirement maps
| Requirement | How A handles it |
|---|---|
| Intent recognition | Your own Gemini call (function-calling / classifier prompt) — full control of the routing taxonomy |
| Multi-turn context | You persist turns + the accumulating metadata JSON in your state store; you decide the window |
| Geo-aware proactive prompting | Plain server logic: geo signal (item below) selects the §5.1 question script; you own the branching |
| Search + grounded answer | Call `servingConfigs:search` / `:answer` on `imm-postings-search-app`; render cards from results + citations |
| Conversational filtering | Translate NL → `filter` expression on structData facets in your code |
| Posting flow | Reuse `LLM-EXTRACTION-PROMPT.md` + Validator + GCS-Writer; you control the draft/review/confirm gate |
| Domain guardrails | Your system prompt + a cheap pre-classifier you fully control |

### Pros
- **Maximum control of the conversation loop** — intent taxonomy, proactive-prompt branching, draft-review gating, and the "accumulate a canonical metadata JSON across turns" behavior are all first-class app logic, not constrained by a managed product's conversation model.
- **Cleanest posting integration.** Posting needs the *exact* canonical extraction (`LLM-EXTRACTION-PROMPT.md`) + Validator vocab gate + sidecar write. A BFF reuses that contract verbatim; the app channel becomes a thin caller of code that already exists.
- **Standard, portable web backend.** FastAPI/Cloud Run matches the §6.2 stack hint, is easy to staff, test, and run in CI/CD; no agent-runtime concepts to learn.
- **Consumption-priced + scales to zero.** Cloud Run bills per request; pairs naturally with the consumption-priced Vertex AI Search sink (D-016 cost philosophy). No always-on runtime floor.
- **Per-user, low-latency chat** — direct Gemini + Search/Answer calls, no extra agent-runtime hop.
- **Auth/profile/geo are trivial to inject** — the BFF already terminates the user session, so per-user context (profile, country, saved searches) is in hand for every turn.

### Cons
- **You build the orchestration.** Intent routing, session management, prompt engineering, and guardrails are your code to write, test, and maintain (vs. inheriting a managed loop).
- **No built-in agent tracing/sessions.** You get Cloud Logging/Trace, not Agent Engine's managed session traces — you instrument observability yourself.
- **Prompt-engineering burden lives with you** — query rephrasing, follow-up handling, and answer-quality tuning that the managed Answer API does for free must be partly hand-built if you bypass it (mitigated by *using* the Answer API for the search sub-task).
- **Divergence risk from the ingestion tagger.** Two callers of `LLM-EXTRACTION-PROMPT.md` (Reddit pipeline + app) must stay in lockstep on vocab/prompt version — needs discipline (shared module + `TAG_VOCAB_VERSION`).

**Best when:** you want the app's UX (multi-turn posting, geo branching, draft/review) to be exactly as designed, and you value a conventional, portable backend you fully control.

### 2.1 Session / conversation state on Option A

**You need durable session storage, but NOT a *separate* store** — session state belongs in the same app-state store the app already requires for profiles, saved searches, and alerts (the Firebase Auth + Firestore vs Identity Platform + Cloud SQL decision). Session is just another collection/table there.

**Why durable state is unavoidable.** Cloud Run instances are **ephemeral and scale to zero**; across a multi-turn conversation (which can span minutes) requests land on different instances or hit cold starts, so **in-process memory is not reliable**. Gemini is also stateless per call — the BFF passes the message history in on every turn. So each turn the BFF must *read* prior state from a shared, persistent store and *write* the updated state back.

**What the session record holds** (one record per `session_id`):
- the conversation turn history (or a rolling window of it);
- the **accumulating per-session metadata JSON** — the posting draft built up across turns (the [app-specs.MD §5.1](app-specs.MD) "information entered by user captured as metadata json for each session" requirement);
- current intent + geo branch (US vs outside-US);
- a reference to the user/profile;
- the **Vertex AI Search Answer-API session name** (see two-layers note below).

**Two layers of "session":**
1. **Vertex AI Search Answer-API session** — the managed Search+Answer API keeps its *own* session for the *search* sub-flow (query rephrasing / follow-up context). You don't store that conversation; you persist only the **Vertex session name** as a field on your record so search follow-ups stay coherent.
2. **App conversation session** — intent state, posting-draft metadata, geo branch, account context. This is *yours* to persist, in the app-state store, keyed by the same `session_id`.

**Store choice.** Firestore fits well (document-per-session, serverless, native TTL to auto-expire stale sessions, real-time client sync); Cloud SQL works too (a `sessions` table). **Avoid Memorystore/Redis** — an always-on cost that cuts against the project's cost posture (D-016/D-020); pilot-scale chat doesn't need it.

**Relationship to other decisions.** This links the orchestration choice to the app-state-store choice: pick the app-state store once, and sessions ride along in it. It does **not** reintroduce the *pipeline's* Firestore — D-013 dropped Firestore for the **ingestion pipeline**; app state (incl. sessions) is a separate concern, so D-013 stays intact.

---

## 3. Option B — Vertex AI Agent Builder "Search + Answer" app, consumed (near-)directly

The client (or a very thin BFF) talks to the **managed Search + Answer app** over `imm-postings-datastore` for the search flow — using the built-in **Answer API** (managed query rephrasing, multi-turn sessions, citations, related questions) and optionally the **prebuilt search widget**. A thin BFF still handles auth and the write path.

### How each requirement maps
| Requirement | How B handles it |
|---|---|
| Intent recognition | **Not provided.** The app only does search/answer — you still need a separate classifier for post/account/general intents |
| Multi-turn context | Managed **Answer sessions** handle search follow-ups well; but only *within the search flow* |
| Geo-aware proactive prompting | **Not provided** — must be bolted on outside the app |
| Search + grounded answer | **Strongest here** — this is exactly what the product does, with the least code |
| Conversational filtering | Supported via `filter` + the managed query understanding |
| Posting flow | **Not provided** — entirely outside the app; needs its own service anyway |
| Domain guardrails | Partial — retrieval is corpus-bounded, but general off-topic chat isn't gated by the app |

### Pros
- **Least code for the search-and-answer half.** Managed query rephrasing, multi-turn search sessions, grounding, citations, and related-questions come for free and are well-tuned.
- **Fastest path to a working search demo** — point the widget/Answer API at the existing app and you have grounded results immediately.
- **Lowest maintenance for retrieval quality** — Google tunes the answer model and retrieval; data-driven tuning (search/click events) is built in.
- **Consumption-priced** — per-query billing on the same sink, no extra runtime.

### Cons
- **Only covers ~1 of the 7 responsibilities.** It does search+answer; it does **not** do intent routing, geo-aware proactive prompting, the posting/extraction flow, account actions, or general-purpose guardrailed chat. You end up building a BFF (Option A) *anyway* for everything else — so "B" in practice becomes "A that delegates the search sub-task to the Answer API," which is what A already recommends.
- **Conversation model is the product's, not yours.** The multi-turn behavior, rephrasing, and answer format are constrained by what the Answer API exposes; the bespoke "accumulate a canonical metadata JSON while chatting" and draft/review UX don't fit its model.
- **Weak fit for a chatbot-first, post-capable app.** The spec's centerpiece is a single conversational surface that *also posts*; a search-only managed app can't be that surface on its own.
- **Client-direct access complicates auth/abuse control** — exposing the search app to clients without a BFF leaks key/quota surface and per-user policy.

**Best when:** the near-term goal is *search only*, with posting/intent/profile deferred. Otherwise it collapses into Option A.

---

## 4. Option C — ADK agent on Vertex AI Agent Engine

The conversation loop runs as an **ADK + Gemini agent hosted on Vertex AI Agent Engine** — the same runtime family the ingestion pipeline uses (D-009). The agent has **tools**: a `search` tool (Search + Answer API), a `create_posting` tool (Tagger→Validator→GCS-Writer), profile/geo tools, etc. Managed sessions, scaling, and tracing come from Agent Engine. A thin BFF (or the Agent Engine endpoint) fronts the apps.

### How each requirement maps
| Requirement | How C handles it |
|---|---|
| Intent recognition | The agent reasons about intent and picks tools — native fit |
| Multi-turn context | **Managed sessions** — Agent Engine persists conversation state for you |
| Geo-aware proactive prompting | Encode the §5.1 scripts as agent instructions/tools; the reasoner drives the branching |
| Search + grounded answer | `search` tool wraps the Answer API; agent composes the reply |
| Conversational filtering | Agent emits `filter` via the search tool |
| Posting flow | `create_posting` tool wraps the existing contract; agent gathers fields conversationally |
| Domain guardrails | Agent instructions + tool-scoping keep it bounded |

### Pros
- **Architectural consistency** with the ingestion pipeline (D-009: ADK + Gemini 2.5 on Agent Engine). Same runtime, same Example Store / tracing concepts — one mental model, shared tooling.
- **Managed sessions + tracing + tool orchestration** out of the box — less session/observability plumbing than A.
- **Agentic tool-use is a natural fit** for "decide between search vs post vs ask-a-clarifying-question" — the reasoner does the routing instead of hand-written branches.
- **Self-learning hook** — Agent Engine's Example Store integration (already used by the pipeline) could feed dynamic few-shot for intent/extraction.

### Cons
- **Built for backend/batch agents, not high-QPS consumer chat.** The ingestion agent runs on a 30-min scheduler; a consumer-facing chat surface is a different traffic and latency profile. Agent-loop reasoning (plan → tool → observe → respond) adds **per-turn latency** vs. A's direct calls.
- **Cost profile is less favorable for interactive chat.** Agent Engine runtime + multi-step reasoning tokens per user turn, at consumer concurrency, is pricier and less predictable than a Cloud Run request that makes 1–2 direct API calls. Cuts against the project's tight cost posture (D-020).
- **Heaviest to build and operate** for this use case — ADK authoring, Agent Engine deploy/versioning, and debugging an autonomous loop are more overhead than a FastAPI handler when the control flow is largely known in advance.
- **Less deterministic UX.** The draft/review gate, exact proactive-prompt wording, and "never post without explicit confirm" are easier to *guarantee* in explicit BFF code than to *steer* an autonomous agent toward.
- **Reuse is partial, not free** — the ingestion agent is a different agent (batch tagging); you'd author a *new* conversational agent. Shared concepts, not shared code.

**Best when:** you expect the conversation to need genuinely autonomous, open-ended multi-tool reasoning, and you prioritize runtime/architecture consistency with the ingestion pipeline over per-turn latency/cost.

---

## 5. Side-by-side

| Dimension | A — Cloud Run BFF + Gemini | B — Agent Builder app direct | C — ADK on Agent Engine |
|---|---|---|---|
| Owns the conversation loop | Your code | Vertex (search only) | The agent |
| Covers all 7 responsibilities | ✅ yes | ❌ search only | ✅ yes |
| Intent routing (search/post/account/QA) | ✅ explicit | ❌ not provided | ✅ reasoned |
| Geo-aware proactive prompting | ✅ full control | ❌ bolt-on | ✅ via instructions |
| Posting / extraction / draft-review | ✅ cleanest reuse | ❌ outside the app | ✅ via tool |
| Search + grounded answer quality | ✅ (uses Answer API) | ✅✅ best, least code | ✅ (uses Answer API) |
| Per-turn latency | Low (1–2 direct calls) | Low (managed) | Higher (agent loop) |
| Cost profile | Consumption, scale-to-zero | Consumption | Runtime + reasoning tokens |
| Build / ops effort | Medium (you write orchestration) | Low for search; high overall once you add the rest | High (ADK + Agent Engine) |
| Managed sessions/tracing | ❌ you instrument | Partial (search) | ✅ built-in |
| UX determinism (confirm-before-post) | ✅ easy to guarantee | n/a | ⚠️ steer, not guarantee |
| Consistency w/ ingestion (D-009) | Neutral (new layer) | Neutral | ✅ same runtime |
| Portability / lock-in | High portability | High lock-in to the app model | Medium (ADK/Agent Engine) |
| Staffing | Standard web devs | Low (config) + web devs | Agent specialists |

---

## 6. Reading of the trade-off

Three observations, for your call — not a decision:

1. **B is not a whole-app answer.** The spec's surface is a *chatbot that also posts, profiles, and routes intent*. The managed Search+Answer app covers only retrieval+grounding, so choosing B still forces a BFF for everything else — at which point you've built A and delegated the search sub-task to the Answer API (which A does anyway). B is best read as a *capability A and C both consume*, or as a deliberate **"search-only first slice."**

2. **A vs C is the real fork** — *explicit control* vs *managed autonomy*:
   - The conversation here is **largely scripted** (the §5.1 proactive-prompt branches are enumerated; posting requires a deterministic confirm-before-publish gate). Scripted, guarantee-critical flows favor **A's explicit code** over **C's reasoned loop**.
   - The project is **cost- and latency-sensitive** (D-016/D-020) and consumer-facing chat is the higher-traffic, lower-latency profile that Agent Engine was *not* chosen for in the batch pipeline. That also favors **A**.
   - **C's main draws** — managed sessions/tracing and architecture consistency with D-009 — are real but are conveniences A can replicate with Firestore + Cloud Trace, whereas C's costs (latency, $, autonomous-UX risk) are harder to claw back.

3. **Posting reuse is identical across A and C** and not a differentiator: both wrap the existing `LLM-EXTRACTION-PROMPT.md` → Validator → GCS-Writer contract. Keep that as a **shared module** regardless, so the Reddit pipeline and the app channel never drift on vocab/prompt version.

**If forced to a default:** **Option A (Cloud Run BFF + Gemini), using the Search + Answer API for the retrieval/grounding sub-task.** It covers all seven responsibilities, keeps the scripted/guarantee-critical UX deterministic, fits the cost/latency posture, reuses the ingestion contract cleanly, and stays portable — while still getting managed answer quality where it matters. Revisit C if the conversation later needs genuinely open-ended multi-tool autonomy.

---

## 7. Note on a possible hybrid / phasing

These aren't strictly exclusive:
- **A + Answer API** is itself the recommended blend (own the loop, rent the grounding).
- A reasonable **phasing**: ship **B's search slice** first (fastest grounded-search demo on the existing index), then grow the **A BFF** around it for intent/posting/profile — the BFF subsumes the search slice without rework.
- C remains a **future swap** for the orchestration layer if autonomy needs grow; because the data tier and ingestion contract are fixed, the orchestration layer is replaceable behind the app's API.

When you pick, I'll fold the choice into [app-backend-specs.MD](app-backend-specs.MD) and add the `D-NNN` to [MEMORY.md](../MEMORY.md).

---

## 8. Decision (2026-05-29): Option A chosen; why not C

**Chosen: Option A — a custom Cloud Run BFF (FastAPI) + Gemini that owns the conversation loop, calling the Vertex AI Search "Search + Answer" API for retrieval/grounding and reusing the existing Tagger → Validator → GCS-Writer contract for posting.** Session state lives in the app-state store (§2.1), not a separate one. Recorded as **D-034** in [MEMORY.md](../MEMORY.md).

**Option B** was not chosen as a standalone architecture because it covers only ~1 of the 7 conversation responsibilities (search+answer); adding intent routing, geo-aware prompting, posting, profile, and account actions forces a BFF anyway, at which point it *is* Option A. B survives only as a **building block A consumes** (the Answer API) and as an optional **search-only first slice** during phasing (§7).

### Why Option C (ADK on Agent Engine) was not chosen

C is **deferred, not rejected** — it remains a clean future swap because the data tier and ingestion contract are fixed and the orchestration layer is replaceable behind the app's API. It loses to A *for this app's profile* for seven reasons:

1. **Agent Engine was selected for a different traffic profile.** D-009 put the *ingestion* pipeline on ADK + Agent Engine, but that agent runs on a **30-minute batch scheduler** doing autonomous multi-step tagging. A consumer chat surface is the opposite profile — high concurrency, interactive, low-latency-per-turn. Reusing the batch-agent runtime for a real-time consumer workload is not the consistency win it appears to be.
2. **Per-turn latency tax.** C reasons each turn as *plan → call tool → observe → respond*; that reasoning hop sits on the critical path of every user message. A makes **1–2 direct calls** (Gemini for intent/extraction + the Search+Answer API) with no autonomous loop in between.
3. **Cost is higher and less predictable.** C bills Agent Engine runtime + variable multi-step reasoning tokens per turn (the agent decides how many steps to take). At consumer concurrency that is pricier and harder to forecast than a scale-to-zero Cloud Run request making a fixed couple of calls — cutting against the project's cost posture (D-016 consumption pricing; D-020 hard budget + kill-switch).
4. **UX determinism — the flows here are scripted, and C steers rather than guarantees.** The §5.1 proactive-prompt branches (US vs outside-US) are enumerated, and posting requires a hard **confirm-before-publish gate**. Explicit BFF code (A) can *guarantee* "ask exactly these questions" and "never write until confirmed"; an autonomous agent (C) is *steered* toward those behaviors via instructions — harder to make airtight and harder to test. When the control flow is already known, encoding it directly beats delegating it to a reasoner.
5. **Higher build & operational overhead.** ADK authoring + Agent Engine deploy/versioning + debugging an autonomous loop is more machinery than a FastAPI handler whose control flow is readable top-to-bottom.
6. **The "reuse" benefit is partial, not free.** The ingestion agent is a *batch tagging* agent; C would still require authoring a **new conversational agent** — shared concepts (ADK, Example Store, Gemini), not shared code. Meanwhile the posting path is reused **identically by A and C**, so it is not a differentiator.
7. **C's advantages are replicable; its disadvantages are not.** C's genuine wins — managed sessions/tracing and architecture consistency with D-009 — are matched cheaply in A (Firestore for sessions, Cloud Trace/Logging for observability). The reverse is not true: A's latency, cost-predictability, and UX-determinism advantages cannot easily be retrofitted onto C.

**The assumption that would flip this:** if the conversation later needs genuinely open-ended, autonomous, many-tool reasoning (unpredictable branching, the agent planning its own steps), C's reasoning loop becomes an asset rather than a tax, and the orchestration layer can be swapped to C without touching the data tier or ingestion contract.
