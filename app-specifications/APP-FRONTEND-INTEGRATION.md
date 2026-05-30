# Frontend ↔ Backend Integration Spec — web & mobile apps ↔ the conversational Vertex AI Search backend

**Status:** Integration/interface spec (the **client-side wire contract**). Complements the server-side [APP-BACKEND-ARCHITECTURE.md](APP-BACKEND-ARCHITECTURE.md). Anchored on D-034 (Cloud Run BFF + Gemini), D-035 (Firebase Auth + Firestore), D-036/D-038 (generic `app` channel, `source_system="unclesamcalling"`). Design tokens (dark mode, layout rules) come from [design.MD](design.MD).

This document tells a **frontend engineer** exactly how the web SPA and mobile app talk to the backend to deliver the conversational search + posting experience against the `imm-postings-datastore` index.

---

## 1. Integration model & principles

```
 Web SPA / Mobile app
   │  1. Firebase Auth SDK  → ID token (email / Google / Apple / anonymous-guest)
   │  2. HTTPS + Bearer <id-token>  →  BFF REST/SSE API  (the ONLY backend the client calls)
   │  3. (optional) read-only Firestore listeners  →  live alerts / session updates
   ▼
 BFF (Cloud Run)  ──►  Gemini · Vertex AI Search (Search/Answer) · Firestore · ingestion contract
```

**Hard rules for the client:**
- The client calls **only** (a) Firebase Auth (SDK) and (b) the **BFF HTTPS API**. It **never** calls Vertex AI Search, Gemini, GCS, or BigQuery directly, and holds **no GCP credentials or API keys**.
- All backend mutations go through the BFF. The **only** direct-to-Firestore access allowed is **read-only listeners** for alerts/session live-updates, guarded by Firebase security rules (D-035).
- The client is "thin conversation UI + state rendering"; intent routing, tagging, grounding, and the publish gate live in the BFF.

---

## 2. Transport & conventions

| Concern | Convention |
|---|---|
| Protocol | HTTPS only (TLS 1.2+). JSON request/response (`Content-Type: application/json`). |
| Base URL | `https://api.unclesamcalling.app` (TBD); all routes under **`/v1`**. |
| Auth | `Authorization: Bearer <firebase-id-token>` on every request (anonymous token allowed for search). |
| Streaming | The conversational turn supports **Server-Sent Events (SSE)** for token-by-token answers (`POST /v1/chat:stream`, `Accept: text/event-stream`) **and** a non-streaming `POST /v1/chat` fallback. |
| Idempotency | Mutations that create content (`/v1/posts:publish`) require a client-generated `Idempotency-Key` header (UUID) — safe retries; the BFF also dedups on `case_id`. |
| Pagination | Cursor-based: responses return `next_page_token`; client passes it back as `page_token`. |
| Localization | `Accept-Language` header; `language` echoed in responses. |
| Client info | `X-Client: web|ios|android`, `X-Client-Version`, optional `X-Request-Id` (client UUID for tracing/log correlation). |
| Rate limits | Per-user; `429` with `Retry-After`. Client must back off. |
| Versioning | URI-versioned (`/v1`). Additive changes are non-breaking; breaking → `/v2`. |

### 2.1 Standard error envelope
Every non-2xx returns:
```jsonc
{ "error": { "code": "VALIDATION_FAILED",     // stable machine code
             "message": "Human-readable summary",
             "details": [ {"field":"visa_applying_for","issue":"unknown tag 'H1B-xyz'"} ],
             "retryable": false,
             "request_id": "..." } }
```
Codes the client must handle: `UNAUTHENTICATED` (401 → refresh token & retry once), `PERMISSION_DENIED` (403), `RATE_LIMITED` (429), `VALIDATION_FAILED` (422, used by posting), `OFF_TOPIC` (200-level soft reject in chat — render as a normal bot message), `UNAVAILABLE` (503 → backoff+retry), `INTERNAL` (500).

---

## 3. Authentication & session

### 3.1 Sign-in
1. Client uses the **Firebase Auth SDK** for email / Google / Apple, or **anonymous** sign-in (guest "search before sign-up").
2. SDK returns an **ID token (JWT)**; client sends it as `Bearer` on every BFF call. The SDK auto-refreshes; on a `401 UNAUTHENTICATED`, force-refresh the token and retry once.
3. **Guest → permanent:** link the anonymous account to a provider via the Firebase SDK; the `uid` is preserved, so the guest's session/draft carry over.
4. The **synthetic username** (reddit-style) is created server-side on first sign-in and returned by `GET /v1/profile`; the client displays it and never collects/shows email or real name on public content.

### 3.2 Conversation session
- A **session** is server-side (Firestore). The client obtains a `session_id` from the first `/v1/chat` (or `POST /v1/session`) and **persists it locally** (per device) to continue the conversation across app launches.
- The client passes `session_id` on every chat turn. It does **not** hold the conversation state — it renders what the BFF returns. (The BFF assembles history + draft + filter + geo, D-034 §2.1.)
- Starting a new conversation = omit `session_id` (or call `POST /v1/session`); the old one expires server-side via TTL.

---

## 4. The conversational turn — `/v1/chat` (the core)

### 4.1 Request
```jsonc
POST /v1/chat            // or /v1/chat:stream  with Accept: text/event-stream
{
  "session_id": "sess_abc",         // omit to start a new conversation
  "message": "experiences from B-1/B-2 applicants at the Mumbai consulate",
  "location_hint": { "country": "IN", "in_us": false },   // optional; see §10
  "client_context": { "tz": "Asia/Kolkata" }              // optional
}
```

### 4.2 Non-streaming response
```jsonc
{
  "session_id": "sess_abc",
  "intent": "search",                       // search|refine_filter|post|confirm_publish|profile|account|general_question|off_topic
  "reply": "Here are recent Mumbai B-1/B-2 interview experiences …",  // grounded answer text
  "cards": [ { /* result card, §5.1 */ } ],
  "citations": [ { "case_id":"reddit-…","title":"…","snippet":"…","uri":"/v1/posts/reddit-…" } ],
  "active_filter": { "consulates":["MUM"], "visa_applying_for":["B-1","B-2"] },
  "facet_chips": [ { "field":"severity","value":"high","count":12 } ],   // refinement suggestions
  "suggested_followups": [ "Only show ones from this month", "Refusals only" ],
  "draft_preview": null                     // populated only during the posting flow (§7)
}
```

### 4.3 Streaming response (SSE)
`POST /v1/chat:stream` emits typed events so the UI can show a typing indicator then stream the answer, and attach cards when ready:
```
event: meta      data: {"session_id":"sess_abc","intent":"search"}
event: token     data: {"text":"Here are recent "}
event: token     data: {"text":"Mumbai B-1/B-2 …"}
event: cards     data: {"cards":[ … ]}
event: citations data: {"citations":[ … ]}
event: followups data: {"suggested_followups":[ … ],"facet_chips":[ … ],"active_filter":{ … }}
event: done      data: {"finish_reason":"stop"}
```
The client renders `token` deltas incrementally; `cards`/`citations` arrive once retrieval completes. On `error` event, render the error envelope (§2.1).

---

## 5. Rendering contract (what the client draws)

The chat stream is the primary surface; the BFF returns structured objects the client renders as rich UI (per [app-specs.MD §5.2](app-specs.MD)).

### 5.1 Result card (search hit)
```jsonc
{
  "case_id": "reddit-2026-04-11-h1b-1srn4ab",
  "title": "Mumbai B-2 interview — 221(g) then approved",
  "snippet": "Asked for …",
  "channel": "reddit",                          // reddit | app  (badge)
  "facets": { "consulates":["MUM"], "visa_applying_for":["B-2"],
              "tags":["experience-posting","221g"], "severity":"high" },
  "posting_date": "2026-04-11",
  "uri": "/v1/posts/reddit-2026-04-11-h1b-1srn4ab"   // open full posting
}
```
Render as a **carousel/list of cards** alongside/within the chat (mobile: swipeable horizontal carousel; web: multi-column — design.MD §5).

### 5.2 Other render objects
- **Citations** → inline numbered references under the answer, each linking to its card/posting.
- **`facet_chips`** → tappable refinement chips ("severity: high (12)") → on tap, client sends a `refine_filter` chat turn (e.g. message `"only high severity"`) or calls `/v1/search` with the merged filter.
- **`suggested_followups`** → quick-reply chips that, when tapped, send that text as the next `/v1/chat` message.
- **`draft_preview`** → the growing **Post Preview card** during posting (§7).
- **`off_topic` intent** → render `reply` as a normal bot message (domain-restriction notice); no cards.

---

## 6. Direct search — `/v1/search` (optional, non-conversational)

For a classic search box / filter UI (or to power chip refinement) without a chat turn:
```jsonc
POST /v1/search
{ "query": "layoff grace period",
  "filters": { "channel":["reddit","app"], "consulates":["MUM"], "severity":["high"],
               "posting_date_from":"2026-01-01" },
  "sort": "posting_date desc",          // or "relevance" (default)
  "page_size": 20, "page_token": null }
→
{ "answer": "…optional grounded summary…",
  "results": [ { /* result card §5.1 */ } ],
  "facet_counts": { "consulates": {"MUM":12,"HYD":8}, "channel": {"reddit":60,"app":11} },
  "next_page_token": "…" }
```
**Conversational filtering** is the same `filters` object — the chat path maintains it as `active_filter`; the search path lets the client set it explicitly. Filter keys map 1:1 to the facet fields in [APP-BACKEND-ARCHITECTURE.md §8](APP-BACKEND-ARCHITECTURE.md) (`channel`, `current_visa_or_greencard_category`, `visa_applying_for`, `consulates`, `tags`, `source_container`, `principal_country_of_chargeability`, `employer_type`, `severity`, `resolution_status`, …).

---

## 7. Posting flow (client side)

The app is an ingestion channel; posting is conversational with a **mandatory review + confirm gate** ([app-specs.MD §5.3](app-specs.MD)).

```
1. User: "I want to post my H-1B stamping experience…"
2. Client → /v1/chat. Response intent=post, draft_preview = partial parsed metadata.
3. Client renders the growing "Post Preview" card (title, visa, consulate, key dates, tags)
   AND the bot's next gap question (geo-aware). User answers via more /v1/chat turns;
   each response updates draft_preview → client re-renders the card.
4. When draft is complete, bot asks to confirm. Client shows an explicit
   "Publish" button + a "This will be public" consent notice (D-038 PII).      ◄ HARD GATE
5. On tap → POST /v1/posts:publish  (Idempotency-Key: <uuid>, body uses session draft).
6. Response: { "case_id":"app-2026-05-29-quiet_falcon_42-…", "full_url":"…", "status":"published" }.
   Client shows success + a link to the new posting; it becomes searchable in minutes.
```

`draft_preview` shape (what the card renders):
```jsonc
{ "post_title":"H-1B visa stamping — Hyderabad",
  "summary":"…", "missing_fields":["primary_consulate"],
  "next_question":"Which consulate was your interview at?",
  "parsed": { "visa_applying_for":["H-1B"], "consulates":["HYD"],
              "tags":["experience-posting"], "key_dates":{"interview_date":"2026-04-27"} },
  "ready_to_publish": false }
```

**Validation/moderation errors** (422 `VALIDATION_FAILED` or a moderation block on publish) → client surfaces `error.details` against the relevant draft fields and lets the user correct, then re-publish. The client must **never** publish without the explicit user tap in step 4.

---

## 8. Profile & account

- `GET /v1/profile` → `{ synthetic_username, country, profile:{ <canonical-aligned facets> }, settings }`.
- `PUT /v1/profile` → update journey fields (canonical vocabulary, D-035) — these **seed posting drafts and pre-filter searches**, so prompt users to fill them (app-specs §5.5).
- `GET /v1/me/posts` → the user's posting history (refs).
- Account actions (sign-out, delete account, link provider) are Firebase-SDK + a BFF `/v1/account` call for server-side cleanup.

---

## 9. Saved searches, alerts & push

- `POST /v1/saved-searches` `{query, filters, alert_enabled}` ; `GET` / `DELETE`.
- `POST /v1/alerts` `{saved_search_id, transport:"fcm"}` (D-038).
- **FCM registration:** the client obtains an FCM token (web: VAPID; mobile: native FCM/APNs) and registers it via `POST /v1/alerts:device {fcm_token}`. The BFF sends a push when a newly-ingested posting matches a saved search ([APP-BACKEND-ARCHITECTURE.md §11](APP-BACKEND-ARCHITECTURE.md)).
- **Optional live UI (D-035):** the client may attach a **read-only Firestore listener** to its own `users/{uid}/notifications` (or `sessions/{id}`) for instant in-app "new match" updates without polling — guarded by security rules (a user reads only its own docs). This is the *only* sanctioned direct-Firestore use; **all writes still go via the BFF**.

---

## 10. Geo-detection handshake (US vs outside)

The proactive-prompt script branches on US vs outside-US ([app-specs.MD §5.1](app-specs.MD)).
- The client **may** send `location_hint {country, in_us}` (from device locale / coarse GPS with consent). If omitted, the BFF infers from the request IP at the edge.
- The BFF stores `in_us` on the session and returns geo-appropriate `reply`/`next_question`. The user can override in chat ("I'm currently in the US"), which the BFF honors.
- The client should not hardcode the question scripts — it renders whatever `reply`/`next_question` the BFF sends (server owns the branching).

---

## 11. Error handling & resilience (client)

- **Token expiry:** on `401`, force-refresh the Firebase token and retry once; if still failing, route to sign-in.
- **Retryable errors** (`429`, `503`): exponential backoff honoring `Retry-After`; show a non-blocking "reconnecting" state for chat.
- **Streaming drop:** if the SSE connection breaks mid-answer, fall back to non-streaming `/v1/chat` with the same `session_id` (idempotent for reads).
- **Offline:** queue the user's message locally; disable Publish offline (never optimistic-publish). Cached cards may render read-only.
- **Idempotent publish:** reuse the same `Idempotency-Key` on retry so a dropped response can't double-post.

---

## 12. Security (client responsibilities)

- Store the Firebase token only in secure storage (web: in-memory / `httpOnly` where possible, not `localStorage` for long-lived secrets; mobile: Keychain/Keystore). Tokens are short-lived; rely on SDK refresh.
- **No GCP API keys or service-account material in the client**, ever (D-018). The only client credential is the user's Firebase token.
- Treat all posting content as **public** — surface the "this will be public" notice (D-038) and discourage PII entry in the compose UI.
- Pin to HTTPS; reject mixed content.

---

## 13. Platform specifics

| | Web app | Mobile app |
|---|---|---|
| Framework | React + Tailwind SPA (design.MD §6) | React Native / native; same BFF contract |
| Chat UI | Persistent chat surface + result cards (multi-column) | Single-column chat; **bottom nav (Home/Search/Alerts/Profile)**; swipeable card carousel; slide-up sheets (design.MD §5) |
| Streaming | SSE via `fetch`/EventSource | SSE via native HTTP streaming |
| Push | Web Push (FCM + VAPID) | FCM (Android) / APNs-via-FCM (iOS) |
| Deep links | `/p/<case_id>` → posting view | universal/app links → posting view |
| Design tokens | dark-mode tokens, radii, type scale from [design.MD](design.MD) | same tokens, mobile scale |

---

## 14. Phasing alignment

| Phase | Client surfaces / endpoints |
|---|---|
| **P1 — Search-first** | Sign-in (incl. guest) · `/v1/chat`(+stream) search & Q&A · `/v1/search` · result cards/citations/chips · `/v1/profile` |
| **P2 — Posting** | `/v1/posts:draft`/`:publish` · Post Preview card · consent gate · validation/moderation error surfacing |
| **P3 — Alerts & social** | `/v1/saved-searches` · `/v1/alerts` · FCM registration · read-only Firestore listeners · (V2) messaging |

---

## 15. Open items
1. **Base URL / domain** for the BFF (`api.unclesamcalling.app` placeholder).
2. **Streaming transport** — SSE is specified; confirm acceptable on all target mobile stacks (else chunked-JSON fallback).
3. **Exact filter key names** in the public API mirror the backend facets — freeze the public names alongside the date/recency typing decision (D-038 §2 / backend §18.2).
4. **Auth providers at launch** — email + Google + Apple + guest assumed; confirm the launch subset.
5. The concrete OpenAPI/JSON-schema for every endpoint is produced with the BFF skeleton (P1), recorded with its own `D-NNN`.

This contract is intentionally **transport-stable**: the BFF can change how it talks to Vertex AI Search / Gemini without changing this client interface.
