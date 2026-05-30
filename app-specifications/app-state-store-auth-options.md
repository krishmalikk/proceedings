# App-State Store + Auth — Options & Trade-offs

**Status:** ✅ **DECIDED — Firebase Authentication + Firestore (Native mode), 2026-05-29.** Recorded as **D-035** in [MEMORY.md](../MEMORY.md). The choice, rationale, and the adopted defaults for the §7 open sub-questions are consolidated in [§8](#8-decision-2026-05-29--firebase-auth--firestore) below; §1–§7 are retained as the basis. Folded into [app-backend-specs.MD](app-backend-specs.MD).

---

## 1. What this decision covers

Option A (D-034) put a Cloud Run BFF in charge of the conversation loop, and §2.1 of the orchestration doc established that **session state must be persisted in a durable, shared store** — the same store that holds the app's other user-scoped data. This decision picks **(a) where that app state lives** and **(b) how users authenticate**.

### Data domains the app-state store must hold
| Domain | Shape | Notes / source |
|---|---|---|
| **User account** | identity record | auth provider owns credentials; app stores profile + synthetic username (reddit-style) |
| **User profile** | structured, evolving | immigration-journey attributes ([app-specs.MD §5.5](app-specs.MD)); overlaps canonical schema facets |
| **Conversation sessions** | document / nested JSON | turn history + the **accumulating per-session posting-draft metadata JSON** + intent + geo branch (D-034 §2.1) |
| **Saved searches & alerts** | filter spec + subscription | "notify me when a posting like this is posted" ([§5.2](app-specs.MD)) |
| **Posting history / drafts** | per-user list | "my postings", in-progress drafts before publish |
| **(V2) In-app messaging** | threaded messages | optional, AI-moderated ([§5.4](app-specs.MD)) |

### Auth requirements ([app-specs.MD §5.4](app-specs.MD))
- Sign up / login via **email, Google, and Apple**.
- A **synthetic, made-up username** (reddit.com style) — app-generated, not the real name/email.
- Mobile **and** web clients.
- Issues a token the BFF can verify on every request (Option A is BFF-mediated).
- Nice-to-have: **anonymous / guest** sessions so a user can search (and start the proactive-prompt flow) before committing to sign-up.

### Cross-cutting constraints (from settled decisions)
- **Cost posture** — consumption pricing, scale-to-zero preferred (D-016); hard budget + kill-switch (D-020).
- **No SA key files; ADC/attached SA only** (D-018); org policy blocks SA keys.
- **D-013 scope** — Firestore was dropped from the *ingestion pipeline*. App state is a **separate concern**; using Firestore here does not violate D-013. (Worth an explicit note in whatever `D-NNN` we write.)

> The two sub-decisions interact (auth identity is the key app-state records hang off, and some providers pair naturally with some stores), so they're presented together with a recommended **pairing** at the end.

---

## 2. Sub-decision A — Auth provider

### A1 — Firebase Authentication
Google's managed identity service: email/password, Google, Apple, phone, and anonymous sign-in; client SDKs for iOS/Android/Web; issues JWT **ID tokens** the BFF verifies with the Admin SDK.

**Pros**
- **All three required providers + Apple + anonymous out of the box**; minimal code.
- **First-class mobile + web SDKs**, token refresh handled client-side.
- **Anonymous → permanent account upgrade** supports "search before sign-up" and carrying a guest session forward.
- **Pairs natively with Firestore** (security rules reference `request.auth.uid`).
- **Generous free tier**; most providers free (phone auth is the paid exception, which we don't need).
- ADC-friendly: BFF verifies tokens via the Admin SDK on an attached SA — no key files (D-018).

**Cons**
- **Consumer-grade**, not enterprise-federation oriented (no SAML/multi-tenancy) — not needed here.
- Tied to the Google/Firebase ecosystem (acceptable — the whole stack is GCP).

### A2 — GCP Identity Platform
The GCP productization of the same underlying tech as Firebase Auth, adding multi-tenancy, SAML/OIDC enterprise federation, audit logging, and an SLA. Same SDKs/tokens.

**Pros**
- Superset of Firebase Auth — **same DX**, plus enterprise features and a formal SLA.
- GCP-native billing/IAM/audit integration.

**Cons**
- **Priced per monthly active user** beyond a free tier — a recurring cost that scales with growth, for features (multi-tenancy, SAML) this consumer app doesn't need at pilot.
- No functional advantage over Firebase Auth for email/Google/Apple. **Easy to "upgrade" into later** if enterprise needs appear — so adopting it now is premature.

### A3 — Roll-your-own (FastAPI + OAuth libs)
Implement password hashing + OAuth2 (Google/Apple) + session/JWT issuance in the BFF.

**Pros**
- Total control; no provider lock-in; everything in one service.

**Cons**
- **You own auth security** — password storage, token rotation, account recovery, social-login OAuth dances, abuse/rate-limiting. High effort, high risk, low differentiation.
- Re-implements what Firebase Auth gives free. **Not justified.**

### A4 — Third-party (Auth0 / Clerk / Supabase Auth)
External managed identity vendors with strong DX.

**Pros**
- Polished SDKs and dashboards; fast to wire up.

**Cons**
- **Off-GCP vendor + extra bill + identity data residency outside GCP**; another integration to operate and secure. No advantage over Firebase Auth on this stack. **Not aligned** with the all-GCP, cost-disciplined posture.

---

## 3. Sub-decision B — App-state datastore

### B1 — Firestore (Native mode)
Serverless NoSQL document store: real-time listeners, offline mobile cache, TTL policies, security rules, scales to zero, consumption-priced (per read/write/delete + storage).

**Pros**
- **Document model fits the data** — a session is a document holding the nested, accumulating posting-draft JSON; profiles and saved searches are documents. No object-relational mapping.
- **Real-time listeners** are a strong fit for **alerts** and live UI ("a new matching posting appeared") and for streaming the draft/review card as it grows.
- **Native TTL** auto-expires stale conversation sessions — no cleanup job.
- **Scales to zero, consumption-priced** — matches D-016/D-020; no idle floor.
- **Pairs natively with Firebase Auth** (security rules on `request.auth.uid`) and has the same mobile/web SDKs, enabling optional client-direct reads (see §4).
- ADC/Admin-SDK access from Cloud Run; no key files (D-018).

**Cons**
- **Query model is limited** vs SQL — no joins, compound queries need composite indexes, no ad-hoc analytical queries. (Mitigated: heavy analytics already live in **BigQuery**; Firestore holds operational app state only.)
- Cost can creep with very chatty per-keystroke writes — controllable by batching turn writes.
- Eventual consistency on some query paths (fine for this workload).

### B2 — Cloud SQL (PostgreSQL)
Managed relational DB: full SQL, joins, transactions, JSONB columns; familiar relational modeling.

**Pros**
- **Relational integrity + rich queries/joins** across users/sessions/saved-searches.
- **JSONB** can still hold the per-session draft blob when needed.
- Already **present in the stack for Label Studio** (PREREQUISITES-IAM-INFRASTRUCTURE) — familiarity, one DB engine to operate.
- Strong consistency; mature tooling/migrations.

**Cons**
- **Always-on instance** — no scale-to-zero; pays an idle floor 24/7, cutting against D-016/D-020 (even a small tier has a standing monthly cost).
- **No native real-time push** to clients — alerts/live updates need polling or a separate Pub/Sub + WebSocket layer the BFF must build.
- **Cloud Run → Cloud SQL needs connection management** (Cloud SQL connector / pooling); connection limits matter under bursty serverless concurrency.
- More ops: backups, version upgrades, sizing, failover config.
- No client SDK for direct mobile/web access — everything must route through the BFF (not necessarily bad, but removes the real-time option).

### B3 — Hybrid (Firestore for live state + BigQuery for analytics)
Not really an alternative to B1/B2 — it's the **natural end-state**: Firestore (or Cloud SQL) for operational app state, **BigQuery** for analytics/telemetry (§9 intent/drop-off/zero-result tracking). Listed to make explicit that **analytics is not a reason to pick Cloud SQL** — that workload belongs in BigQuery regardless.

---

## 4. Cross-cutting: how clients reach the store (BFF-mediated vs client-direct)

Option A is **BFF-mediated**, so the default is: **clients never touch the store directly; the BFF (Admin SDK on an attached SA) is the single choke point.** This is cleanest for enforcing business logic, the confirm-before-publish gate, and hiding the schema.

Firestore (B1) additionally *enables an optional hybrid*: keep **writes + business logic in the BFF**, but allow **client-direct, read-only Firestore listeners** (guarded by security rules) for **live alerts and session updates** — getting real-time UX without the BFF holding WebSocket connections. Cloud SQL (B2) cannot offer this; it would require a custom push layer. This is a meaningful tilt toward Firestore given the **saved-searches/alerts** requirement, but it's optional — the BFF-only model works for both stores.

**Alert matching** ("notify me when a posting like this is posted") is store-independent at its core: when a new posting is ingested, its tags/facets are matched against stored saved-search filters, then a notification is pushed. This naturally **reuses the existing event-driven ingestion trigger** (the `.json` finalize event, §17 of the pipeline architecture) → a matcher (Cloud Run/Function) → write a notification doc / send push. Firestore makes the "client sees it instantly" last step free; Cloud SQL needs a push layer.

**Synthetic username** is app logic on top of any auth provider: generate a unique reddit-style handle at first sign-in, store it on the profile, never expose email/real name. Not a differentiator between options.

---

## 5. Side-by-side

### Auth
| Dimension | A1 Firebase Auth | A2 Identity Platform | A3 Roll-your-own | A4 Third-party |
|---|---|---|---|---|
| Email/Google/Apple | ✅ built-in | ✅ built-in | ⚠️ you build | ✅ built-in |
| Anonymous → upgrade | ✅ | ✅ | ⚠️ | varies |
| Mobile + web SDKs | ✅ | ✅ | ❌ | ✅ |
| Cost at pilot | free | per-MAU | infra only | extra vendor bill |
| Security ownership | managed | managed | **you** | vendor |
| GCP-native / ADC | ✅ | ✅ | ✅ | ❌ off-GCP |
| Enterprise federation | ❌ (not needed) | ✅ | ⚠️ | ✅ |
| Effort | low | low | high | low-med |

### State store
| Dimension | B1 Firestore | B2 Cloud SQL (Postgres) |
|---|---|---|
| Data-model fit (sessions/draft JSON) | ✅ document-native | ⚠️ JSONB in a relational table |
| Real-time alerts/updates to clients | ✅ native listeners | ❌ needs custom push layer |
| Session TTL / expiry | ✅ native | ⚠️ cleanup job |
| Scale-to-zero / consumption price | ✅ | ❌ always-on floor |
| Rich queries / joins | ⚠️ limited | ✅ full SQL |
| Pairs with Firebase Auth (rules) | ✅ | n/a |
| Cloud Run connectivity | SDK, simple | connector + pooling |
| Already in stack | no | yes (Label Studio) |
| Ops burden | low (serverless) | medium |
| Analytics | use BigQuery | use BigQuery |

---

## 6. Recommended pairing

**Firebase Authentication + Firestore (Native mode).**

Reasoning:
1. **Auth requirements are exactly Firebase Auth's sweet spot** — email/Google/Apple + anonymous-guest + mobile/web SDKs, free at pilot, GCP-native, no SA keys. Identity Platform is a drop-in upgrade later *if* enterprise federation/multi-tenancy is ever needed, so starting on Firebase Auth costs nothing in optionality.
2. **The data is document-shaped** — the per-session accumulating posting-draft JSON, profiles, and saved searches map directly to Firestore documents with no impedance mismatch.
3. **Alerts + live UX** — Firestore's real-time listeners make the saved-search/alert and draft-review experiences cheap; Cloud SQL would need a bespoke push layer.
4. **Cost posture** — serverless, scale-to-zero, consumption-priced; no idle DB floor (D-016/D-020). Cloud SQL's always-on cost is hard to justify for pilot-scale app state.
5. **Native pairing with Firebase Auth** — security rules + shared SDKs enable the optional client-direct real-time read path (§4) while keeping writes BFF-mediated.
6. **D-013 stays intact** — this is *app state*, explicitly out of the ingestion pipeline's scope.

**Honest caveats / when the other options win:**
- If the app-state model turned out to be **heavily relational with ad-hoc cross-entity queries**, Cloud SQL's SQL/joins would matter more — but operational app state here is user-scoped document data, and analytics belongs in BigQuery anyway.
- If **enterprise SSO/SAML or multi-tenancy** becomes a requirement (e.g. a B2B angle), move auth to **Identity Platform** — same SDKs, minimal migration.
- The team **already runs Cloud SQL for Label Studio**; if minimizing the number of distinct datastores were the top priority over real-time + scale-to-zero, B2 is defensible. The recommendation weighs real-time alerts + cost posture higher.

---

## 7. Open sub-questions (flag before writing the `D-NNN`)

1. **Client-direct Firestore reads or strictly BFF-mediated?** (§4) — affects security-rules scope and how alerts reach clients. Recommend: **writes BFF-only; optional read-only client listeners** for alerts/session live-updates.
2. **Profile ↔ canonical schema overlap.** The profile captures immigration-journey attributes that mirror canonical facets (`current_visa_or_greencard_category`, `principal_country_of_chargeability`, etc.). Decide whether the profile **reuses the canonical field names/vocab** (so a profile can seed a posting draft and pre-filter searches) — recommended — or is a looser separate shape.
3. **Push-notification transport for alerts** (FCM vs email vs in-app only) — affects the matcher's last step; can be deferred to the alerts design.
4. **Region** — Firestore location (and any client-direct latency) should match the `us-central1` colocation the rest of the system uses.

When these are settled (or accepted as defaults), I'll record the choice as a `D-NNN` in [MEMORY.md](../MEMORY.md) and fold it into [app-backend-specs.MD](app-backend-specs.MD).

---

## 8. Decision (2026-05-29): Firebase Auth + Firestore

**Chosen: Firebase Authentication (email / Google / Apple + anonymous-guest, synthetic reddit-style usernames) for identity, and Firestore (Native mode) as the app-state store** for the Option-A BFF (D-034). Recorded as **D-035** in [MEMORY.md](../MEMORY.md).

**Why (summary of §6):**
1. Auth requirements (email/Google/Apple + guest + mobile/web SDKs) are exactly Firebase Auth's sweet spot — free at pilot, GCP-native, ADC-verified by the BFF, no SA keys (D-018).
2. The app data is document-shaped — the per-session accumulating posting-draft JSON, profiles, and saved searches map directly to Firestore documents.
3. Firestore real-time listeners make the saved-search/alert and draft-review live UX cheap; Cloud SQL would need a bespoke push layer.
4. Serverless, scale-to-zero, consumption-priced — matches the cost posture (D-016/D-020); no idle DB floor.
5. Native pairing with Firebase Auth (security rules + shared SDKs) enables the optional client-direct real-time read path while writes stay BFF-mediated.
6. D-013 stays intact — this is *app state*, explicitly outside the ingestion-pipeline scope.

**Rejected:** Identity Platform (per-MAU cost for enterprise features not needed; a drop-in upgrade later if SSO/multi-tenancy ever appears), roll-your-own auth (owns auth-security risk for no differentiation), third-party auth (off-GCP vendor + extra bill), Cloud SQL as the app-state store (always-on cost cuts against D-016/D-020; no native client push; recommendation weighed real-time alerts + scale-to-zero above reusing the Label-Studio Postgres instance).

**Adopted defaults for the §7 open sub-questions (revisable):**
1. **Access pattern:** writes are **BFF-mediated only** (Admin SDK on an attached SA); **optional read-only client-direct Firestore listeners** (guarded by security rules) for alerts + session live-updates.
2. **Profile ↔ canonical schema:** the user profile **reuses the canonical field names/vocabulary** (`current_visa_or_greencard_category`, `principal_country_of_chargeability`, etc.) so a profile can seed a posting draft and pre-filter searches.
3. **Alert push transport:** lean **FCM** (Firebase Cloud Messaging), since we're on Firebase; final transport choice deferred to the alerts design.
4. **Region:** Firestore in **`us-central1`** to colocate with Vertex AI Search / BigQuery / GCS.
