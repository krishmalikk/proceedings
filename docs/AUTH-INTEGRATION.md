# Auth integration — server-side identity verification (BLOCKER-0)

**Status:** NOT implemented. This is the single must-fix before any public multi-user
launch (see [`PROD-READINESS.md`](PROD-READINESS.md) audit). It is a self-contained
project that touches backend + web + mobile + Firebase config.

---

## 1. The issue

Identity today is an **unverified `X-User-Id` HTTP header** — the server trusts
whatever uid the client sends. There is **no credential check anywhere**.

- `backend/api.py:609` `_active_user()` (and `:622` `_optional_user()`) read the raw
  `X-User-Id` header and only check `_uid_accepted()` — i.e. that the uid is a seed
  id, starts with `new-`, or has a `users/{uid}` Firestore doc. **None of that proves
  the caller owns the uid.**
- `backend/api.py:578` `ALLOW_USER_IMPERSONATION` defaults to `"1"` and is **not set
  to `0` in any deploy config**, so impersonation ships **enabled**.
- Both clients send the Firebase uid as a plaintext header that the server never
  verifies: web `lib/activeUser.ts` `userHeaders()` → `X-User-Id`; mobile
  `services/apiService.ts:37` `userHeaders()` → `X-User-Id`. Firebase sign-in exists
  on the clients, but the **ID token it issues is never sent or verified**.
- `firebase-admin` is **not** a backend dependency (no token-verification path exists).
- The dev bypasses make it worse: web **auto-adopts a seed persona** for anonymous
  visitors (`onboarding/page.tsx`) and renders a demo-user picker in prod; mobile
  ships a **"Skip Authentication (Dev Mode)"** button (`LoginScreen.tsx:196`,
  `SignupScreen.tsx:252`) with no `__DEV__` guard.

uids are **public** (returned as `author_id` on `/api/postings/{id}` and in
`/api/users/{uid}/…` URLs), so an attacker can trivially discover a victim's uid.

## 2. Threat model — what an attacker can do today

With one header (`curl -H "X-User-Id: <victim-uid>" …`) against the public Cloud Run
URL, an anonymous attacker can act fully as any user:

| Capability | Endpoint |
|---|---|
| Post / delete content as the victim | `POST/DELETE /api/postings/*/replies`, `/api/postings` |
| Vote as the victim | `POST /api/votes` |
| Read & send **private group-chat messages** (membership is checked against the *spoofed* uid) | `/api/groups/{id}/messages` |
| **Overwrite the victim's profile** | `PUT /api/profile` |
| Read the victim's full profile / activity | `/api/users/{uid}/*` |

There is **no ownership proof on any write endpoint.** The API is effectively open.

## 3. Risk if we DON'T implement this

> **Key point:** nothing *breaks functionally* if we skip it — the app keeps working.
> The risk is that the product is **unsafe to expose publicly**. This is a latent,
> catastrophic vulnerability, not a visible bug. Shipping without it means:

| Risk | Severity | Consequence |
|---|---|---|
| **Account takeover / impersonation** | Critical | Anyone can act as anyone — post, vote, delete, edit profiles. Zero accountability. |
| **Private data exposure** | Critical | Members-only group chats readable by spoofing a member uid; profiles overwritable. PII platform → breach. |
| **Data integrity / vandalism** | High | Mass content/profile tampering or deletion; spam/bot accounts at scale (compounded by the weak in-memory rate limiter). |
| **Legal / compliance** | High | Immigration PII with no access control → GDPR/CCPA exposure, breach-notification liability, loss of trust. |
| **App Store / Play rejection** | Blocking (mobile) | "Skip Authentication" + no real auth → guaranteed rejection; the mobile app cannot ship at all. |
| **Business** | High | Cannot safely run a real multi-user community; one disclosure could be reputationally fatal. |

## 4. Target design

Verify a **Firebase ID token** server-side; keep the `X-User-Id` path only as a
**dev/test escape hatch** gated by `ALLOW_USER_IMPERSONATION` (which is `0` in prod).

```
Client (web/mobile, signed in)
  └─ Authorization: Bearer <firebase ID token>   ── every request
        │
Backend  _resolve_user(request):
  1. if Authorization: Bearer present → firebase_admin.auth.verify_id_token(tok) → uid   [PROD path]
  2. elif ALLOW_USER_IMPERSONATION → fall back to X-User-Id (dev/test/local only)
  3. else → 401
  └─ first verified token with no users/{uid} doc → auto-create it
```

Prod Cloud Run sets `ALLOW_USER_IMPERSONATION=0`, so only step 1 is allowed.
Local/CI keep it `=1` so the seed-user `X-User-Id` workflow and the existing test
suites keep working unchanged.

## 5. Implementation steps

### A. Backend (`backend/`) — ✅ IMPLEMENTED (commit on `prepare-for-prod`)
1. ✅ Added **`firebase-admin`** to `requirements.txt` (Dockerfile already `pip install`s it; no new module → COPY unchanged).
2. ✅ Lazy Admin-SDK init via **ADC** (`_firebase_ready()`, `api.py`) — `initialize_app(projectId=GCP_PROJECT_ID)`, no key file.
3. ✅ `_verify_bearer(request) -> (uid, name) | None` — parses `Authorization: Bearer`, `auth.verify_id_token` (expired/invalid → `None`).
4. ✅ `_resolve_uid(request, required)` — **prefers the verified token**; falls back to `X-User-Id` **only when `ALLOW_USER_IMPERSONATION`**; else `401`. `_active_user`/`_optional_user` now delegate to it.
5. ✅ `_ensure_registered(uid, name)` — auto-creates the `users/{uid}` profile on first verified uid (idempotent; no-op when `_db` is None).
   - **Test:** `tests/test_auth_gate.py` (8/8, wired into the no-GCP CI gate) covers all branches; existing unit suites still green.
6. ⏳ Deferred (hardening): move the rate limiter to keyed-by-uid + honor `X-Forwarded-For`.

> The backend is ready: with `ALLOW_USER_IMPERSONATION=1` (dev/CI/local, the default) the X-User-Id flow is unchanged; setting `=0` in prod makes it **token-only**. **Do NOT flip `=0` until the clients send bearer tokens (B1/C1)** or the apps lock out.

### B. Website (`website/`) — ✅ IMPLEMENTED
1. ✅ Token attached **synchronously**: `lib/activeUser.ts` caches the ID token (`setIdToken`, kept fresh by AuthContext's `onIdTokenChanged`) and `userHeaders()` adds `Authorization: Bearer`. All 14 identity-forwarding proxy routes now forward the `Authorization` header (no async refactor / call-site churn).
2. ✅ Dev impersonation **gated off in prod**: `DEMO_PICKER_ENABLED = NODE_ENV !== 'production'` gates the seed-persona auto-adopt **and** the demo `<select>` in `onboarding`/`find` (stays on in dev + test). Prod visitors are never silently impersonated.
3. ✅ Sign-in guards: `useRequireUser()` hook (`lib/useRequireUser.ts`) on `/post`,`/onboarding`,`/find`,`/groups/[id]` — redirects to `/login` in prod when there's no Firebase session; **no-op in dev/test** (the demo picker supplies identity there). `/profile` keeps its existing guard.

### C. Mobile (`mobile/`)
1. `services/apiService.ts` `userHeaders()` → attach `Authorization: Bearer <idToken>` (cache + refresh).
2. **Remove the "Skip Authentication (Dev Mode)" button** (`LoginScreen.tsx`, `SignupScreen.tsx`) and the `isDevMode` branch in `MainNavigator.tsx` for prod builds (gate behind `__DEV__` if kept for local).
3. **Sign in with Apple** (Apple Guideline 4.8 — required alongside Google sign-in).

### D. Firebase / Google config
1. OAuth consent screen: app name, **support email `support@usajourney.ai`**, privacy/terms URLs; promote to "in production".
2. Auth → Authorized domains: add `usajourney.ai`, `www.usajourney.ai`.
3. Mobile: iOS/Android Google client IDs + Android SHA-1/256 (from the EAS keystore); iOS reversed-client-id URL scheme.

### E. CI / tests / deploy
1. Keep `ALLOW_USER_IMPERSONATION=1` for **local dev + CI + the seed-user E2E suites** (they rely on `X-User-Id`); **set `=0` on the prod Cloud Run service.**
2. `test_cloud_run.py` / the deployed E2E target a backend with impersonation **on** — point them at a staging/non-prod revision, or add a token-minting test fixture. Document the chosen approach.
3. Add backend tests for the gate: token verified → uid; missing/expired/invalid → 401; `X-User-Id` rejected when impersonation off.

## 6. Migration / what changes when we DO implement it
- **Dev workflow:** the demo-user picker stops working in prod (intended). Local dev keeps it via `ALLOW_USER_IMPERSONATION=1`.
- **E2E suites:** the deployed `test_cloud_run.py` must run against an impersonation-on environment (or mint tokens) — see E.2.
- **Token latency:** every client request now awaits `getIdToken()` (cached, ~0ms warm; refreshes hourly).
- **`POST /api/users`** becomes optional once auto-register lands (keep it for back-compat).

## 7. Acceptance criteria
- [ ] Backend rejects an unverified `X-User-Id` with `401` when `ALLOW_USER_IMPERSONATION=0`.
- [ ] A valid Firebase ID token resolves to the correct uid; expired/invalid → 401.
- [ ] Spoofing another uid via header is impossible in prod (write + group-chat read).
- [ ] Web + mobile attach the bearer token on every authed request; sign-in enforced.
- [ ] Prod Cloud Run env has `ALLOW_USER_IMPERSONATION=0`.
- [ ] Mobile has no dev-mode bypass and offers Sign in with Apple.

## 8. Effort / sequencing
Backend token verification (A) is ~½ day and the highest-leverage piece — do it first;
flip `ALLOW_USER_IMPERSONATION=0` only after both clients send tokens (B1/C1) to avoid
locking out the apps. Mobile Apple sign-in + the store items (C3) can land in the
mobile phase. Net: a focused multi-day effort, gated on the Firebase-config decisions (D).
