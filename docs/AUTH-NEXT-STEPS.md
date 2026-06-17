# Auth — remaining steps in detail: login verification + mobile (step C)

Companion to [`AUTH-INTEGRATION.md`](AUTH-INTEGRATION.md). Two paused workstreams,
documented in full so they can be picked up cleanly.

**Context:** prod backend `immiguide-api` is **token-only** (`ALLOW_USER_IMPERSONATION=0`,
rev 00043); website `immiguide-web` (rev 00006) sends the Firebase ID token and guards
authed pages. Backend verification (step A) and website token plumbing (step B) are
**done and deployed**. What remains: (1) *prove* a real Firebase login round-trips to a
backend 200, and (2) bring the mobile app onto the token model (step C).

---

# Part 1 — Firebase-login verification (website)

We've unit-tested the gate and confirmed a **bogus** token is rejected (401) and
`firebase-admin` initializes on Cloud Run. What's unverified: a **real** signed-in user's
token → backend **200** end-to-end. Firebase project = **`proceedings-490601`** (web client
config in `website/.env.local` `NEXT_PUBLIC_FIREBASE_*`; backend verifies with `projectId=GCP_PROJECT_ID`).

## 1.1 Firebase / Google console prerequisites (one-time)
- [ ] **Authentication → Sign-in method:** enable **Email/Password** and **Google** (and **Apple** for iOS, Part 2).
- [ ] **Authentication → Settings → Authorized domains:** add `meridianjourney.ai`, `www.meridianjourney.ai`, and the live web origin `immiguide-web-971592620882.us-central1.run.app` (Google sign-in popups are blocked on un-listed domains).
- [ ] **Google Cloud → OAuth consent screen:** app name, **support email `support@meridianjourney.ai`**, app domain `meridianjourney.ai`, privacy (`/privacy`) + terms (`/terms`) URLs; **publish to "In production"** (while in "Testing", only allow-listed test users can sign in).
- [ ] **OAuth 2.0 Web client:** Authorized JS origins + redirect URIs include the web origin(s) above.

## 1.2 Automated verification (no browser — recommended; also the E2E token fixture)
Mint a real ID token via the Firebase Auth REST API for a throwaway test account, then call the backend:

```bash
API_KEY=<NEXT_PUBLIC_FIREBASE_API_KEY>           # from website/.env.local
B=https://immiguide-api-971592620882.us-central1.run.app
# 1) create the test user once (or use signUp):
#    POST identitytoolkit accounts:signUp  {email,password,returnSecureToken:true}
# 2) sign in → ID token:
ID_TOKEN=$(curl -s "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"email":"e2e-auth@meridianjourney.test","password":"<pw>","returnSecureToken":true}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['idToken'])")
# 3) call the backend with the Bearer token (prod, impersonation off):
curl -s -o /dev/null -w "profile: %{http_code}\n" -H "Authorization: Bearer $ID_TOKEN" "$B/api/profile"   # expect 200
curl -s -X PUT "$B/api/profile" -H "Authorization: Bearer $ID_TOKEN" -H 'Content-Type: application/json' \
  -d '{"username":"e2e-auth"}' -o /dev/null -w "put profile: %{http_code}\n"                              # expect 200
# 4) negative: no token → 401; tampered token → 401
curl -s -o /dev/null -w "no-token: %{http_code}\n" "$B/api/profile"                                       # expect 401
```
- [ ] **Wire this into `backend/tests/test_cloud_run.py`** as the token fixture (resolves `AUTH-INTEGRATION.md §5.E.2`): a `--auth` mode that mints a token and runs the suite with `Authorization: Bearer` instead of `X-User-Id`, so the deployed token-only backend can be E2E-tested. Keep the X-User-Id mode for a local impersonation-on backend.

## 1.3 Manual verification (the live site, real browser)
1. Open `https://immiguide-web-…run.app` (or `meridianjourney.ai` once mapped) **incognito**.
2. Anonymous: `/search`, `/case/*`, `/privacy` load; visiting `/post` or `/profile` **redirects to `/login`** (the `useRequireUser` guard).
3. **Sign up / sign in** (Email and Google). Expect to land back in the app, header shows "Signed in as …".
4. Authed action: post a reply / save a profile → **succeeds (200)**. (Network tab: the request to `/api/*` carries `Authorization: Bearer …`; the proxy forwards it.)
5. **Sign out** → an authed action → redirected to `/login`.
6. **Token refresh:** keep the tab open >1h (or revoke+refresh) → authed actions still 200 (`onIdTokenChanged` refreshes the cached token in `AuthContext` → `setIdToken`).

## 1.4 Acceptance
- [ ] Real Email + Google sign-in → backend 200 on an authed write.
- [ ] No-token / tampered-token → 401.
- [ ] Sign-out enforced by the guard; token refresh keeps sessions working.
- [ ] Token fixture added to the E2E suite.

## 1.5 Rollback / safety valve
If login isn't ready and the live site must be usable without it:
`gcloud run services update immiguide-api --region us-central1 --update-env-vars ALLOW_USER_IMPERSONATION=1`
(re-enables the X-User-Id path; the prod website still hides the demo picker, so it mainly unblocks the E2E suite + dev).

---

# Part 2 — Mobile (step C), in detail

Mirrors website step B, plus the iOS store requirement (Sign in with Apple). The mobile
app uses the **Firebase JS SDK** (`src/config/firebase.ts`, `initializeAuth` +
`getReactNativePersistence`), `AuthContext` already does Email + Google
(`GoogleAuthProvider.credential` → `signInWithCredential`) and `registerBackendUser`.
**Until C1 ships, every mobile request 401s against the token-only prod.**

## C1 — Send the Firebase ID token (the unblocker)
Mirror the website's synchronous-cache approach (no async churn).
- [ ] `src/services/apiService.ts`: add a module-level `let idToken: string | null = null` + `export function setIdToken(t)`. In `userHeaders()` (currently adds only `X-User-Id`), also add `headers['Authorization'] = 'Bearer ' + idToken` when set. *(All API calls already route through `userHeaders()`.)*
- [ ] `src/contexts/AuthContext.tsx`: alongside the existing `onAuthStateChanged`, add
  `onIdTokenChanged(auth, u => u ? u.getIdToken().then(setIdToken) : setIdToken(null))`
  (fires on sign-in/out **and** hourly refresh). Import `onIdTokenChanged` from `firebase/auth` and `setIdToken` from `apiService`.
- [ ] Verify: signed-in app → an authed call (post/profile) against prod → **200**.

## C2 — Remove the dev-mode bypass (security + store rejection risk)
- [ ] Delete / `__DEV__`-gate the **"Skip Authentication (Dev Mode)"** button: `src/screens/LoginScreen.tsx:198`, `src/screens/SignupScreen.tsx:252` (wrap in `{__DEV__ && (…)}`).
- [ ] `src/navigation/MainNavigator.tsx`: the gate `if (!user && !isDevMode) return <AuthNavigator/>` must require a real `user` in prod — gate `isDevMode` behind `__DEV__` so a production build can never enter dev mode (keep it for local dev only).
- [ ] `AuthContext.enableDevMode` / `isDevMode` / `DEV_MODE_KEY`: keep for local dev, but ensure no production path reaches them.

## C3 — Sign in with Apple (iOS; Apple Guideline 4.8 — required with Google sign-in)
- [ ] Add **`expo-apple-authentication`** dep + plugin; `app.json` → `"ios": { "usesAppleSignIn": true }`.
- [ ] **Apple Developer:** create a **Services ID** + **Sign in with Apple key**; configure the Apple provider in **Firebase → Authentication → Apple** (Services ID, key id, team id, private key).
- [ ] `AuthContext`: add `signInWithApple()` — `AppleAuthentication.signInAsync({requestedScopes:[FULL_NAME,EMAIL]})` → `new OAuthProvider('apple.com').credential({ idToken, rawNonce })` → `signInWithCredential(auth, credential)`. Handle the nonce (Apple requires a SHA256 nonce).
- [ ] `LoginScreen`/`SignupScreen`: render the **Apple button on iOS only** (`Platform.OS === 'ios'`).

## C4 — Firebase / native config & store prerequisites
- [ ] **Authorized domains** (Part 1.1) cover Firebase; for native, the OAuth redirect uses the app **`scheme`** (`app.json` `"scheme"`, currently `proceedings`).
- [ ] **Google sign-in:** iOS + Android OAuth client IDs (`EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` / `…_WEB_CLIENT_ID` in `.env`); Android **SHA-1/256** fingerprints from the **EAS keystore** added to the Firebase Android app; iOS **reversed-client-id** URL scheme.
- [ ] These are EAS build secrets, not committed.

## C5 — Build & verify (ties to `eas.json` from the quick-win pass)
- [ ] `eas build --profile preview` (internal) → install on a device → sign in (Email/Google/Apple) → confirm an authed action hits prod and returns **200**, and that **no "Skip Auth" button** is present.
- [ ] The token fixture (Part 1.2) validates the backend independently of the app build.

## C6 — Acceptance
- [ ] Mobile attaches `Authorization: Bearer` on every authed request; works against token-only prod.
- [ ] No dev-mode bypass in a production build.
- [ ] Email + Google + **Apple** sign-in all work on a real iOS build.

---

## Sequencing summary
1. **Part 1** (login verification + token fixture) — do first; it proves the backend cutover is correct and unblocks E2E.
2. **C1** — unblocks the mobile app against prod (highest priority in C).
3. **C2** — remove dev bypass (before any store build).
4. **C3 + C4 + C5** — Apple sign-in, native config, EAS build → TestFlight/Play internal.

---

# Part 3 — Review findings & remaining fixes (2026-06-17)

Code review of the mobile Firebase work (commits `e23cab7`…`6ab0c31`). Builds clean
(`tsc`) and tests pass (`jest` 18/18).

## Done ✅
- **C1 token flow** — `AuthContext` `onIdTokenChanged` → `getIdToken()` → `apiService.setIdToken()`; `userHeaders()` sends `Authorization: Bearer` (+ `X-User-Id` fallback). Correct.
- **C2 dev bypass** — "Skip Authentication" is now `{__DEV__ && …}`-gated in `LoginScreen`/`SignupScreen` (absent in production builds).
- **Native Google Sign-In** — `@react-native-google-signin` → `GoogleAuthProvider.credential` → `signInWithCredential`; Email/password; `getReactNativePersistence` session persistence; `registerBackendUser` on sign-in. Config via `app.config.js` (replaced `app.json`): `googleServicesFile`, iOS reversed-client-id URL scheme, google-signin plugin, bundle id/package + version codes, `ITSAppUsesNonExemptEncryption=false`.

## 🔴 F1 — iOS Google OAuth client-ID mismatch (will likely break iOS Google sign-in)
Two **different** iOS OAuth clients are referenced:
| Where | iOS client id |
|---|---|
| `mobile/config/GoogleService-Info.plist` (`CLIENT_ID`/`REVERSED_CLIENT_ID`) | `…-s40vq9s0j2dskitsk4g0n7sshpioek7g` |
| `mobile/app.config.js` (`iosUrlScheme` + `CFBundleURLSchemes`) **and** `.env EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | `…-mvj696meur8j54ibu82egpl2dmvha0nf` |

The registered iOS **URL scheme must match the iOS client used for sign-in**; these differ, so the OAuth redirect can fail on iOS.
- [ ] **Fix:** choose ONE iOS OAuth client (most safely the one in the Firebase-issued plist) and make **all three identical** — `GoogleService-Info.plist` `CLIENT_ID`/`REVERSED_CLIENT_ID`, `app.config.js` `iosUrlScheme` + `infoPlist.CFBundleURLTypes[].CFBundleURLSchemes`, and `.env EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`. Confirm the chosen iOS client exists under the Firebase iOS app (`com.krishmalik.proceedings`, project `proceedings-490601`).
- *(Note: the web client `…el3u8…` and the differing per-platform `API_KEY`s are expected — not a bug.)*

## 🔴 F2 — Sign in with Apple still missing (iOS App Store blocker)
Offering Google sign-in on iOS **requires** Sign in with Apple (Apple Guideline 4.8) → guaranteed rejection without it. Implement per **§C3** (expo-apple-authentication, Apple Services ID + key, Firebase Apple provider, `OAuthProvider('apple.com')` + nonce, iOS-only button).

## 🟠 F3 — Runtime caveats (verify before trusting it works)
- [ ] **Won't run in Expo Go** — `@react-native-google-signin` is native. Use an **EAS dev/prod build** (`eas build --profile development` / `expo run:ios`) to exercise Google sign-in. (Email/password works in Expo Go.)
- [ ] **Firebase console:** Google provider **enabled**; **Android SHA-1/256** fingerprints (from the EAS keystore: `eas credentials`) added to the Firebase Android app — Android Google sign-in fails silently without them.
- [ ] **Prove the round-trip** with Part 1.2's token-mint check (signs in via REST → `Authorization: Bearer` → backend **200**), independent of a device build.

## 🟡 F4 — Repo hygiene (stray files committed in `d8b159f`)
- [ ] `git rm -r --cached labeled/` — 82 legacy training-data files swept in by `git add -A`.
- [ ] `git rm -r --cached proceedings-mobile/` — 4-file stray Expo dir (`proceedings-mobile` ≠ `mobile`; a wrong-directory artifact).
- [ ] Reconcile the **two** committed plists (`mobile/config/GoogleService-Info.plist` + `mobile/ios/GoogleService-Info.plist`) — keep one; `app.config.js` already supports the `GOOGLE_SERVICES_PLIST` EAS secret, so the committed copy can be dropped in favor of the secret.
- [ ] Add `labeled/`, `proceedings-mobile/`, `proceedings-mobile/.expo/` to `.gitignore`.
- [ ] Remove the now-unused `expo-auth-session` dep (replaced by native google-signin).

## Priority order
**F1** (else iOS Google login is broken) → **F4** (clean the branch) → **F3** (console config + EAS build to actually test) → **F2** (Apple sign-in, required before any iOS store submission).
