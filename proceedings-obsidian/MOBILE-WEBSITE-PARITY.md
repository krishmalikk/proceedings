# Mobile ↔ Website Parity Tracker

**Branch:** `fix-firebase-auth-integration` (off `proceedings-app`)
**Theme:** Bring the Expo/React-Native mobile app (`mobile/`) to feature/UX parity with the Next.js website (`website/`), and finish the Firebase auth onboarding for both.
**Last updated:** 2026-06-11
**Status:** Core gaps closed; a few items deliberately deferred (product decisions).

This note tracks the **functionality gaps** — things that existed on the **website but not on mobile** — plus the auth-integration fixes that unblocked them. Use it as the running checklist of *done* vs *pending* for the mobile app.

> Backend is the shared source of truth (FastAPI on Cloud Run `immiguide-api`). Mobile and website both call the same endpoints. "Parity" means mobile calls the **same contracts** and offers the **same interactions**, not pixel-identical layout.

---

## Legend
- ✅ **Done** — implemented on this branch, type-checked, contract-verified against the deployed backend.
- 🟡 **Partial** — works, but a sub-capability is intentionally simpler than the website.
- ⏳ **Pending** — not started; needs a decision or is a larger follow-on.
- 🔵 **Product decision** — divergence is intentional; listed so it isn't mistaken for a bug.

---

## 0. Auth integration (prerequisite — unblocked everything below)

The branch's original purpose: enable **Firebase Authentication** and onboard the project into Firebase. The critical defect was that a Firebase `uid` was sent as `X-User-Id` to a backend whose gate only accepted seed-roster ids or `new-*` ids → **every authed call 404'd** once a user actually logged in.

| Item | Status | Notes / files |
|---|---|---|
| Backend accepts **registered** Firebase uids | ✅ | `backend/api.py` — `_uid_registered()` (cached Firestore `users/{uid}` check), `_uid_accepted()`; `POST /api/users` extended to **register a client-supplied uid** (idempotent, never overwrites an existing profile). |
| `PUT /api/profile` username precedence fix | ✅ | `backend/profile.py` — a PUT without a username no longer resets it (reads prior doc first). |
| Website registers uid on sign-in | ✅ | `website/src/contexts/AuthContext.tsx` — `registerBackendUser()` on `onAuthStateChanged` (localStorage-guarded). |
| Mobile registers uid on sign-in | ✅ | `mobile/src/contexts/AuthContext.tsx` + `apiService.registerBackendUser()` → stores uid as the active `X-User-Id`; cleared on sign-out. |
| Mobile Firebase type errors fixed | ✅ | `getReactNativePersistence` import + `expoClientId`→`clientId` (expo-auth-session SDK 50+). |
| Mobile vocab fetched from `/api/tag-vocab` | ✅ | `mobile/src/constants/onboardingData.ts` reduced to verified-valid **fallback** codes; screens fetch live vocab (cached, offline fallback). Consulates now store **codes** while displaying city labels. |
| Website nav/redirect fixes | ✅ | Post button shows for dev-mode users too; `/profile` redirect removed (page reachable); demo pickers hidden when Firebase-signed-in. |
| Deployed + smoke-verified | ✅ | Cloud Run rev `immiguide-api-00033`; full uid loop (register → profile → write → idempotent re-register → unknown-uid-404) verified via the website proxy. |

> **Still open (documented, not a regression):** `X-User-Id` is an **unverified** header. The Option-A end-state is server-side **Firebase ID-token verification**. Until then the gate trusts the header for any registered uid. Also `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` is absent from `mobile/.env` (Android Google sign-in unconfigured; iOS + web present).

---

## 1. Search — ✅ Done (was the biggest gap)

**Gap:** mobile `SearchScreen` rendered **hardcoded mock data** (`src/data/mockData`) and never called `/api/search`. No strictness, no filters, no real results.

**Now:** `mobile/src/screens/SearchScreen.tsx` is fully wired to the real backend, mirroring the website's `UnifiedSearch`.

| Capability | Mobile | Website |
|---|---|---|
| Real `/api/search` query | ✅ `apiService.searchPostings()` | ✅ |
| Example prompt chips (`B1/B2 Mumbai`, `H-1B RFE`, `F-1 to H-1B`) | ✅ | ✅ |
| Precision / strictness control (`broad`/`balanced`/`strict`) | ✅ segmented control, re-runs search | ✅ persisted slider |
| Suggested-filter chips from response (same `field:code` facet contract) | ✅ | ✅ |
| Results → case detail | ✅ `PostingCard` → `CaseDetails` | ✅ |
| Load-more pagination (`next_page_token`) | ✅ | ✅ |
| AI answer panel | 🔵 not ported — website's panel is `AI_MODE_ENABLED = false` (disabled there too) | (disabled) |

---

## 2. Case detail — ✅ Done (was mock)

**Gap:** mobile `CaseDetailsScreen` used `mockData.caseDetail`; layout (timeline card, stats footer) didn't match the website and had no real vote/replies.

**Now:** `mobile/src/screens/CaseDetailsScreen.tsx` rebuilt on `apiService.getPosting()`.

| Capability | Status |
|---|---|
| Real `GET /api/postings/{id}` | ✅ |
| Interactive **vote rail on the posting** (tally fed from Replies, like website) | ✅ |
| Outcome / visa / consulate badges | ✅ |
| Full Experience body (renders **Markdown** — see §7.5) | ✅ |
| Inlined **Details** tile (source, posted date, outcome) | ✅ |
| **Topics** chips | ✅ |
| Gated **"View original on Reddit"** link (same channel/subreddit/url rule) | ✅ |
| **"Coming Soon"** attorney tile | ✅ |
| **Replies** (newest-first default, vote, author-delete) via shared component | ✅ (already matched pre-branch) |

---

## 3. Find / peers / groups — ✅ Done

**Gap:** mobile `FindScreen` skipped profile **reconcile**, had no manual **status-fact / key-date** editing, and showed non-joined "Other Groups" (website is joined-only).

**Now:** `mobile/src/screens/FindScreen.tsx`.

| Capability | Status |
|---|---|
| Two-step **reconcile** offer ("Update my profile & continue" → merge offer) | ✅ |
| Apply conflicting values to the saved profile, then match | ✅ |
| Manual **status-fact** editing (form → outcome pickers) | ✅ |
| Manual **key-date** editing (date-key picker + `YYYY-MM-DD` input, validated) | ✅ |
| Groups list = **joined-only** (drop "Other Groups"; unused `joinGroup` removed) | ✅ |
| CTA wording matches website ("Did not find a group you are looking for?" / "Create your group") | ✅ |
| Match cards show username, score, summary, **background**, shared tags | ✅ (already matched) |
| Checkbox-select matches → create group → **navigate into chat** | ✅ (already matched) |

---

## 4. Group chat — ✅ Done (minor adds)

Core was already a faithful mirror (4 s polling, since-cursor, optimistic send, author-only delete, PII-scrubbed bubbles). Added the missing **members visibility**.

| Capability | Status |
|---|---|
| Group **name + members list** in header | ✅ `apiService.getGroup()`, shown in `GroupChatScreen` |
| Explicit **back** button | ✅ |
| Polling / cursor / optimistic / author-delete | ✅ (already matched) |
| Pause-poll-when-backgrounded (website parity for `document.hidden`) | ✅ RN `AppState`; resumes with an immediate catch-up poll |

---

## 5. Post composer — ✅ Done

**Gap:** mobile `PostScreen` never called `/api/reconcile`; tags were display-only.

**Now:** `mobile/src/screens/PostScreen.tsx`.

| Capability | Status |
|---|---|
| `POST /api/tag-suggest` preview | ✅ (already present) |
| **`POST /api/reconcile`** after suggest, merge profile context | ✅ |
| Conflict card + **"Update my profile to match"** + pre-filled note | ✅ |
| Submit requires ≥1 visa/status; success screen with link to new case | ✅ (already matched) |
| Inline **autocomplete-add** for every tag section (typeahead → tappable suggestions, vocab-validated) | ✅ RN typeahead = website's `<datalist>` |
| **Background tags** + **Questions / concerns** sections (mobile had been dropping these from the UI) | ✅ now rendered + editable |
| Manual **stage / key-date** add-rows | ✅ (add-row always shown so the first can be added — minor improvement over the website, which hides the row until ≥1 is detected) |

---

## 6. Profile — ✅ Done

**Gap:** no **Edit Profile** affordance, no empty state.

**Now:** `mobile/src/screens/ProfileScreen.tsx`.

| Capability | Status |
|---|---|
| **Edit Profile** button → onboarding (screens registered in all tab stacks so it's reachable) | ✅ |
| **Empty-state** card ("No profile set up yet" → "Set Up Your Profile") | ✅ |
| Same data sections (visa status, consulates, tags, stages, dates, background, journey) | ✅ (already matched) |
| Published-experience **facets** per journey entry (visa/consulate/outcome/tags badges) | ✅ shared `useExperienceFacets` hook → Profile journey **and** Experiences screen |
| Background rendered as **Markdown** | ✅ (see §7.5) |

---

## 7. AI onboarding chat — ✅ Done (latest)

**Gap (largest UX divergence):** website onboarding is a **two-stage AI chat** (`POST /api/onboard`) — stage 1 "basics" chat + background box with **Re-generate tags**, stage 2 "experiences" chat that builds the journey. Mobile was a **static form wizard** with no AI at all.

**Now:** both onboarding screens have the assistant, calling the same `/api/onboard` contract.

| Capability | Status | File |
|---|---|---|
| `apiService.onboardTurn(stage, messages, draft)` → `POST /api/onboard` | ✅ | `mobile/src/services/apiService.ts` |
| Shared `toBackendProfile` / `fromBackendProfile` mappers | ✅ | `mobile/src/constants/onboardingData.ts` |
| **Stage 1 chat** — AI replies update the tag sections below | ✅ | `BackgroundOnboardingScreen.tsx` |
| **Re-generate tags** from background free-text (one-shot) | ✅ | `BackgroundOnboardingScreen.tsx` |
| Returning-user **prefill** + "Welcome back" greeting | ✅ | `BackgroundOnboardingScreen.tsx` |
| **Save-on-continue** (PUT basics before stage 2) | ✅ | `BackgroundOnboardingScreen.tsx` |
| **Stage 2 chat** — bot infers crossed milestones, builds journey timeline | ✅ | `ExperiencesOnboardingScreen.tsx` |
| Carry through existing `journey` + `experience_case_id` (no duplicate re-publish) | ✅ | both screens + mapper |

> Manual form sections were kept as a **superset** of the chat, so users can chat *or* fill in directly (same as the website's chat-left / tags-right model, just stacked for a phone).

---

## 7.5 Markdown rendering — ✅ Done (latest)

**Gap:** the website uses its `<Markdown>` component in **6 places**; mobile had **no markdown renderer** — every long-form string was a plain `<Text>`, so Gemini replies and posting bodies showed raw `**bold**`, `-` lists, links, etc. The Find chat greeting literally rendered `**in the same boat**`.

**Now:** one shared component, mirroring `website/src/components/Markdown.tsx` element styling onto the app theme.

| Item | Status | File |
|---|---|---|
| Dependency `react-native-markdown-display@^7.0.2` (pure-JS, Expo-safe, no native build) | ✅ | `mobile/package.json` |
| Shared `<Markdown>` (theme-mapped: p/h1–3/strong/em/lists/link→`Linking`/quote/code/hr; optional `color`/`fontSize`) | ✅ | `mobile/src/components/Markdown.tsx` |
| Case-detail **Full Experience** body | ✅ | `CaseDetailsScreen.tsx` |
| Profile **background** | ✅ | `ProfileScreen.tsx` |
| Onboarding **stage-1 chat** AI replies | ✅ | `BackgroundOnboardingScreen.tsx` |
| Onboarding **stage-2 chat** AI replies | ✅ | `ExperiencesOnboardingScreen.tsx` |
| **Find chat** AI replies | ✅ | `FindScreen.tsx` |

> Links open via `Linking.openURL`. Reply/group-chat message bodies are intentionally left as plain `<Text>` (short user-typed text, PII-scrubbed — same as the website, which doesn't Markdown-render those either).

---

## 8. Navigation / information architecture

| Item | Status | Notes |
|---|---|---|
| Onboarding screens reachable from every tab stack (for Edit Profile) | ✅ | `MainNavigator.tsx` |
| Dead export `OnboardingScreen.tsx` (superseded by Background/Experiences) | ⏳ | exported but unused — safe to delete |
| **Community** tab (mobile) | 🔵 | Mock content; **removed from the website** in phase-H. Decide: restore on web or drop from mobile. |
| **Ask Pro** tab (mobile) | 🔵 | Mock attorney directory; website folds "ask" into `/search` (+ "Coming Soon" tile). Decide fate. |
| **News** tab | 🔵 | Mock content both sides; fine for now. |
| Global **floating AI chat** button (mobile only) | 🔵 | No website equivalent; harmless, keep or drop. |
| **Auth wall**: mobile requires login/dev-mode before any tab; website allows anonymous browsing | 🔵 | Intentional product divergence — decide whether mobile should allow guest browse of Search/News. |

---

## 9. Known smaller divergences (backlog)

- ✅ ~~Markdown rendering~~ — **done**, see §7.5.
- ✅ ~~Post composer autocomplete-add~~ — **done** (§5): RN typeahead per tag section + the 2 previously-dropped sections + stage/date add-rows.
- ✅ ~~Profile experience facets~~ — **done** (§6): shared `useExperienceFacets` hook lazily fetches each shared experience's posting facets; badges render in the Profile journey **and** the Experiences-onboarding list.
- ✅ ~~Group chat pause-on-hidden~~ — **done** (§4): RN `AppState` pauses the 4 s poll when backgrounded; resumes with an immediate catch-up poll.
- ⏳ **`EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`** — add to `mobile/.env` for Android Google sign-in.
- ⏳ **Delete dead `OnboardingScreen.tsx`**.

---

## 10. Verification status

| Layer | Result |
|---|---|
| Mobile `tsc --noEmit` | ✅ clean (only 2 pre-existing `main` errors in `Button.tsx` / `Input.tsx`) |
| Mock-data imports in wired screens | ✅ none remain in Search / CaseDetails / Find / Post |
| Website `tsc` + Vitest (45/45) + production build | ✅ unaffected |
| Backend suites (`test_profile_vocab` 38/38, `test_profile_edge` 28/28) | ✅ |
| Backend deployed | ✅ Cloud Run rev `immiguide-api-00033` |
| `/api/onboard` contract (live) | ✅ stage-1 turn returns reply + extracted profile |
| **Simulator run** | ⏳ **pending** — no simulator in the dev environment; needs `cd mobile && npx expo start` on a Mac. AI chat + authed calls require a registered user (Firebase sign-in or dev-mode + demo user). |

---

## 11. Files touched (mobile, this branch)

```
mobile/app.json
mobile/package.json / package-lock.json
mobile/src/config/firebase.ts
mobile/src/constants/onboardingData.ts
mobile/src/contexts/AuthContext.tsx
mobile/src/navigation/MainNavigator.tsx
mobile/src/services/apiService.ts
mobile/src/components/Markdown.tsx            (new — shared markdown renderer)
mobile/src/components/index.ts                (export Markdown)
mobile/src/hooks/useExperienceFacets.ts       (new — lazy per-experience facets)
mobile/src/screens/SearchScreen.tsx
mobile/src/screens/CaseDetailsScreen.tsx
mobile/src/screens/FindScreen.tsx
mobile/src/screens/PostScreen.tsx
mobile/src/screens/ProfileScreen.tsx
mobile/src/screens/GroupChatScreen.tsx
mobile/src/screens/BackgroundOnboardingScreen.tsx
mobile/src/screens/ExperiencesOnboardingScreen.tsx
```

Backend (shared, also on this branch): `backend/api.py`, `backend/profile.py`.

---

## 12. Next actions
1. **Run the simulator** (`cd mobile && npx expo start`) and walk each screen — the one outstanding verification.
2. Decide the **Community / Ask Pro** question (§8) — restore on web or remove from mobile.
3. Decide the **auth-wall** question (§8) — guest browsing on mobile?
4. Clear the §9 backlog as capacity allows.
5. **Option A**: server-side Firebase **ID-token verification** to replace the trusted `X-User-Id` header.
