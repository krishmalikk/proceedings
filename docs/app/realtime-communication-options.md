# Real-time group communication — channel options & trade-offs (phase-N)

**Status:** Evaluation / options doc (pre-spec). Feeds the phase-N "connect & communicate within a group" feature (deferred from phase-M, D-052). Anchored to [FINAL-ARCHITECTURE.md](../../proceedings-obsidian/FINAL-ARCHITECTURE.md) — **must not deviate** from its grounding-vs-app-state split, all-GCP posture, Firestore app-state store, Firebase Auth, FCM-for-alerts, no-PII rule, and BFF-mediated writes.
**Date:** 2026-06-07

---

## 1. The question

Phase-M produces **groups** (`groups/{id}` in Firestore: members, criteria, generated name). Phase-N lets a group's members **communicate in real time**. This doc evaluates **which real-time transport "channel"** to use, its **prerequisites**, what we must **provision**, and the **web + mobile** implications — then recommends one, with pros/cons for each option.

This is transport-channel selection, **not** the message data model or product spec (those come next).

---

## 2. Hard constraints (from FINAL-ARCHITECTURE.md — non-negotiable)

| Constraint | Source | Implication for real-time chat |
|---|---|---|
| **All GCP, `us-central1`** (data store `global`) | D-g, D-016/034/035 | Prefer a GCP-native channel; a third-party realtime vendor is a deviation to justify. |
| **Firestore (Native) is the app-state store** — chosen *for* scale-to-zero, **native real-time listeners**, native **TTL**, Firebase-Auth pairing | D-035, §6 | Firestore listeners are the *named* real-time mechanism: §6 already says *"read-only client-direct listeners (security-rules-guarded on `request.auth.uid`) power real-time alerts + live session updates."* Chat is the same pattern. |
| **Firebase Auth** (email/Google/Apple + guest), ID-token Bearer | D-035, §5 | Identity for membership + security rules. **Today this is NOT live** — the app uses dev impersonation (`X-User-Id` + seed roster). Real client-direct listeners require real Firebase Auth (see §4 gap). |
| **FCM** for alerts/notifications (`alerts.transport: fcm`) | §6 | FCM is the push/notify layer for offline + mobile — the companion to whatever live transport we pick, **not** a chat transport itself. |
| **No PII** — profile is PII-free canonical vocab; **synthetic reddit-style usernames** | §2, D-d/§5.5 | Chat is free text → highest PII-leak surface in the product. Must enforce at write time. |
| **BFF-mediated writes** (Admin SDK, no key files); client-direct is **read-only** | §6 access pattern | Messages should be **written through the BFF** so PII pre-flight + guardrails run; clients **subscribe** (read) directly for the live stream. |
| **Web SPA + Mobile app**, mobile = **Expo / React Native** | §5, `mobile/` | The chosen channel must have first-class **web JS** and **React Native** SDKs. |
| **Stateless Cloud Run BFF** | §5 | The BFF can't hold long-lived per-client connections at scale without a broker — argues against self-managed WebSockets. |

---

## 3. Prerequisites common to *any* real-time channel

1. **Real Firebase Auth** (close the current `X-User-Id` dev-impersonation gap). Needed so (a) membership is a verified `uid`, (b) Firestore/realtime security rules can authorize on `request.auth.uid`, (c) FCM tokens bind to a user. *This is the single biggest prerequisite and is already the chosen direction (D-035) — phase-N forces it to finally land.*
2. **Group-membership authorization** — read/write allowed only to `uid ∈ groups/{id}.members`. Enforced in security rules (client-direct reads) **and** in the BFF (writes).
3. **No-PII enforcement on messages** — reuse the posting **Gemini pre-flight PII flag** (IMPROVED §6 / D-d) on the BFF write path; block/redact phone, email, address, A-number, passport, SSN; show only **synthetic handles**, never profile fields.
4. **FCM provisioning** — Cloud Messaging enabled; **APNs auth key** for iOS; per-device tokens stored per `uid`; a fan-out trigger (BFF or Cloud Function) on new message → notify offline members.
5. **Mobile push entitlements** — Expo push (or React Native Firebase) config; iOS APNs; Android FCM; notification permission UX.
6. **Message data model + retention** — a `groups/{id}/messages/{msgId}` subcollection (or equivalent), `created_at`, author `uid`+handle, ordering, and a **TTL/retention** policy (Firestore native TTL).

---

## 4. Options (the real-time "channels")

### Option A — Firestore real-time listeners  ★ recommended
Clients `onSnapshot()` a `groups/{id}/messages` subcollection (ordered by `created_at`); the BFF writes messages (Admin SDK) after PII pre-flight; security rules grant **read** to members only.

**Pros**
- **Zero new infrastructure** — Firestore is already the provisioned app-state store (D-035). No broker, no connection server, **scale-to-zero**, pay-per-use.
- **Exactly the pattern FINAL-ARCHITECTURE already names** (§6 client-direct read-only listeners) — no architectural deviation.
- **First-class web + React Native SDKs**; **offline cache + automatic reconnect/resync** handled by the SDK (great for flaky mobile).
- **Security-rules authorization** on `request.auth.uid` ∈ members — declarative, testable.
- **History is the store** — messages, read receipts (`lastRead/{uid}`), and membership all live together; native **TTL** for retention.
- Clean split: **BFF-mediated writes** (PII/guardrails) + **client-direct reads** (live) — matches §6 exactly.

**Cons / watch-outs**
- **Requires real Firebase Auth** (the §3.1 prerequisite) for client-direct listeners.
- **Presence / "typing…" not native** — approximate with a `presence/{uid}` heartbeat doc + TTL (or a small RTDB island, Option B) if needed. Acceptable to defer for v1.
- **Cost scales with document reads** — every listener pays per changed doc; fine for small groups, watch for very large/high-frequency rooms (mitigate: pagination, debounced writes).
- Sub-second latency (excellent for chat) but not sub-100ms (not needed here).

### Option B — Firebase Realtime Database (RTDB)
The *other* Firebase real-time DB; purpose-built for high-frequency small updates + **native presence** (`onDisconnect`).

**Pros:** lowest-latency fan-out; **native presence/typing**; cheaper for chatty small writes; same Firebase Auth + security rules; web + RN SDKs; still GCP/Firebase.
**Cons:** **a second datastore** alongside Firestore (app state is Firestore by D-035) → split data model, two rule sets, two mental models; weaker querying; **deviates** from "Firestore = app state" unless scoped strictly to ephemeral presence/typing. *Best used only as a thin presence sidecar to Option A, not as the message store.*

### Option C — Self-managed WebSockets on Cloud Run
A WebSocket server (BFF or a sibling service) holds member connections and fans out.

**Pros:** full control of the wire protocol; true bidirectional push; vendor-neutral.
**Cons:** **fights the architecture** — Cloud Run is **stateless/auto-scaled**, so connections land on different instances → you need a **shared broker** (Pub/Sub + Memorystore/Redis) for fan-out, plus connection registry, reconnection, backpressure, and presence — **you're building a chat server**. Loses scale-to-zero; adds always-warm cost and ops. Mobile must own reconnection/resync. **High effort, high risk, clear deviation.** Not recommended.

### Option D — SSE (server-sent events) streamed by the BFF + Pub/Sub fan-out
Clients open an SSE stream to the BFF; sends go via HTTP POST; the BFF fans out via Pub/Sub to per-group subscribers.

**Pros:** **no client-direct DB access** → could ship **before** Firebase Auth lands (BFF keeps mediating reads *and* writes); one-way streaming is simple; all-GCP.
**Cons:** still need a **fan-out broker** (Pub/Sub) and per-instance subscription routing on a stateless BFF (same multi-instance problem as C, smaller); SSE holds a connection per client → Cloud Run concurrency/billing; **no offline cache/replay** (must page history from Firestore anyway); reinvents what Firestore listeners give for free. Reasonable **only** if we must avoid client-direct auth short-term — otherwise strictly worse than A.

### Option E — Third-party realtime / chat platform (Ably, Pusher, PubNub, Stream Chat)
A managed realtime/chat SaaS with SDKs, presence, history, moderation (Stream is purpose-built chat).

**Pros:** **fastest path to a rich chat** (channels, threads, read state, typing, presence, moderation out of the box); excellent web + RN SDKs; offloads scaling.
**Cons:** **deviates from all-GCP** (D-g); **message data egresses to an external vendor** — even with no-PII intent, free-text chat is the worst place to send user content off-platform (data-residency/compliance/contract); recurring **per-MAU cost**; another auth integration + vendor lock-in. Justifiable only if product wants a heavy chat experience fast and accepts the vendor + egress trade-off. **Default: no**, given the no-PII posture and all-GCP anchor.

### Companion (all options) — FCM for notifications
Not a transport. On a new message, notify **offline/backgrounded** members (esp. mobile) via **FCM** (already the alert transport, §6). Live, foregrounded clients get the message over the chosen channel (A–E); FCM covers the rest. Required for the mobile experience regardless of the live channel.

---

## 5. Comparison at a glance

| Dimension | A. Firestore listeners | B. RTDB | C. Cloud Run WS | D. SSE + Pub/Sub | E. 3rd-party |
|---|---|---|---|---|---|
| New infra to run | **None** | Enable RTDB | WS server + broker + Redis | Broker + stream routing | Vendor account |
| Matches FINAL-ARCH | **Yes (§6 named)** | Partial (2nd store) | **No (stateful)** | Partial | **No (off-GCP)** |
| Web + React Native SDK | **Yes** | Yes | DIY client | DIY client | Yes |
| Offline/reconnect resync | **SDK-handled** | SDK-handled | DIY | DIY | SDK-handled |
| Presence / typing | Add-on doc | **Native** | DIY | DIY | **Native** |
| Auth model | Firebase Auth + rules | Firebase Auth + rules | BFF token | BFF token | Vendor + Firebase |
| Needs real Firebase Auth now | **Yes** | Yes | No (BFF) | No (BFF) | Yes/Vendor |
| Data stays in GCP | **Yes** | Yes | Yes | Yes | **No** |
| Scale-to-zero / cost shape | **Yes / per-read** | Yes / per-bandwidth | Always-warm | Per-connection | Per-MAU |
| Effort to v1 | **Low** | Low–Med | High | Med–High | Low (but vendor) |

---

## 6. Recommendation

**Option A — Firestore real-time listeners — for the live message stream, + FCM for notifications, + Firebase Auth as the gating prerequisite, with writes BFF-mediated (PII pre-flight) and reads client-direct (security-rules-guarded).**

Why it's the on-architecture answer:
- It is **literally the mechanism FINAL-ARCHITECTURE §6 already specifies** for real-time, on the store D-035 already chose *because* of its native listeners + TTL — **zero deviation, zero new infra, scale-to-zero**.
- **Web + Expo/React Native** both have first-class Firestore SDKs with offline/reconnect — best fit for the upcoming mobile phase.
- Keeps **all data in GCP** and honors **BFF-mediated writes** (so the **no-PII** Gemini pre-flight runs on every message) while clients get the live stream via guarded read-only listeners.
- **FCM** (already the §6 alert transport) handles offline/mobile push.
- Presence/"typing" can be deferred; if wanted later, add a **thin RTDB (Option B) presence island** — without moving the message store off Firestore.

**Sequencing note:** if product wants to ship chat *before* standing up real Firebase Auth, the only on-architecture interim is **Option D (BFF-streamed SSE)** with BFF-mediated reads — but that's throwaway plumbing. Better to **land Firebase Auth now** (it's already the chosen direction and is a phase-N prerequisite regardless) and go straight to A.

---

## 7. What we must provision (for the recommended path)

| Resource | Purpose | New? |
|---|---|---|
| **Firebase Auth** (enable email/Google/Apple + anonymous guest) | Verified `uid` for membership, rules, FCM binding | **Yes — closes the dev-impersonation gap** |
| **Firestore security rules** for `groups/{id}/messages`, `presence`, `lastRead` | Member-only read; writes denied to clients (BFF-only) | Yes |
| **Firestore collections** `groups/{id}/messages/{msgId}`, `…/lastRead/{uid}`, optional `…/presence/{uid}` (+ **TTL** policy) | Message store, read receipts, retention | Yes (schema) |
| **FCM** — Cloud Messaging API + **APNs auth key (iOS)** + device-token store per `uid` | Push to offline/mobile members | Yes |
| **Fan-out trigger** — BFF on-write, or a **Cloud Function/Eventarc** on new message → FCM to offline members | Deliver notifications | Yes |
| **BFF endpoints** — `POST /v1/groups/{id}/messages` (PII pre-flight + write), membership guards | Mediated writes + guardrails | Yes |
| **Mobile Firebase SDK** (React Native Firebase or Expo + JS SDK) + push permission UX | Live listeners + push on mobile | Yes |
| **SA / IAM** — BFF Admin SDK already has Firestore; add FCM send role | Writes + notifications | Small |

No new datastore, no broker, no always-on serving node, no third-party contract.

---

## 8. Open questions for the spec (next step)

1. **Auth timing** — land Firebase Auth now (enables Option A) vs. interim BFF-SSE (Option D)? *(Recommend: land auth now.)*
2. **Presence/typing in v1?** (defer, or add the RTDB presence island.)
3. **Message retention/TTL** window; edit/delete/moderation rules; max group size.
4. **PII handling** — block-and-ask vs. silent redact on the pre-flight flag.
5. **Notification policy** — per-message vs. batched; mute; unread badges.
6. **Group lifecycle** — leave/remove members, who can post, archived groups.
