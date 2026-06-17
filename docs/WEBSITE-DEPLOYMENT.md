# Website deployment runbook (`immiguide-web`)

Steps to ship a website release to production. Follow this **every release**.

| Fact | Value |
|---|---|
| Cloud Run service | `immiguide-web` |
| Region / Project | `us-central1` / `proceedings-490601` |
| Live URLs | `https://meridianjourney.ai`, `https://www.meridianjourney.ai` |
| Backend it talks to | `immiguide-api` (`https://immiguide-api-971592620882.us-central1.run.app`) |
| Source dir | `website/` |
| Build | `website/Dockerfile` (Next.js standalone) |

> **DNS / domain mapping is one-time and already done.** Routine releases never
> touch Network Solutions or the Cloud Run domain mappings. You only revisit DNS
> when changing the domain or adding a subdomain (see `PROD-READINESS.md`).

---

## 0. Pre-flight (once per release, from `website/`)

```bash
cd website
npm ci                 # clean install matching package-lock
npm run lint           # ESLint
npx tsc --noEmit       # type-check
npm test               # vitest — INCLUDES the build-config guard (see §note)
npm run build          # prove a production build succeeds locally
```
All four must be green before deploying. `npm test` includes
`src/__tests__/build-config.test.ts`, which fails if the Dockerfile stops baking
the `NEXT_PUBLIC_FIREBASE_*` values into the build (the bug that caused the
"Application error: a client-side exception" outage — see PR #29).

**If the backend changed in the same release**, deploy/verify `immiguide-api`
first (see `DEPLOYMENT.md`) so the website builds/prerenders against the new API.

---

## 1. Environment & secrets — what's baked vs runtime

Nothing to set per release; this is here so you know what the build depends on.

- **`NEXT_PUBLIC_FIREBASE_*`** (6 vars) — **build-time**, inlined into the client
  bundle. Provided as `ARG` defaults in `website/Dockerfile`. Public by design
  (they ship in client JS; secured by Firebase Auth rules + Authorized domains).
  To change them, edit the Dockerfile `ARG` defaults (or pass `--build-arg`).
- **`PYTHON_API_URL`** — backend origin. Set as `ENV` in the Dockerfile (build +
  runtime). Update it there if the backend URL ever changes.
- **Backend** holds the auth/runtime secrets, not the website. Confirm the
  backend still has `ALLOW_USER_IMPERSONATION=0` (prod is token-only).

---

## 2. Deploy

```bash
# from repo root (use an absolute --source to avoid wrong-dir deploys)
gcloud run deploy immiguide-web \
  --source "$(pwd)/website" \
  --region us-central1 --project proceedings-490601
```
Wait for `…revision immiguide-web-XXXXX has been deployed and is serving 100%`.

> ⚠️ **Always pass an explicit `--source …/website`.** Deploying from the wrong
> directory once deployed the Next.js app over the backend service. Never run a
> bare `gcloud run deploy --source .` from another folder.

---

## 3. Post-deploy verification (REQUIRED — gates the release)

```bash
cd website
npm run smoke        # scans https://www.meridianjourney.ai
```
Must print **`SMOKE PASSED`**. It checks: `/` 200, brand title, `/search` 200,
and — critically — that the **Firebase apiKey + authDomain are present in the
live client bundle** (no `apiKey:undefined`). A failure here means the browser
will crash even though SSR returns 200; **do not consider the release done.**

Then a 10-second human check:
1. Open `https://www.meridianjourney.ai` in an **incognito** window (avoids cached
   old bundle) → `/search` loads, **no** "Application error" overlay.
2. Sign in (Email/Password) → an authed action (post / save profile) succeeds.
3. Anonymous visit to `/post` → redirects to `/login`.

---

## 4. Rollback (if §3 fails)

Traffic-shift back to the last good revision — instant, no rebuild:
```bash
gcloud run revisions list --service immiguide-web --region us-central1
gcloud run services update-traffic immiguide-web \
  --region us-central1 --to-revisions <LAST_GOOD_REVISION>=100
```
Then fix forward on a branch, redeploy, and re-run §3.

**Safer pattern for risky releases** — deploy as a no-traffic candidate, smoke it,
then promote:
```bash
gcloud run deploy immiguide-web --source "$(pwd)/website" \
  --region us-central1 --no-traffic --tag candidate
SMOKE_BASE_URL="https://candidate---immiguide-web-971592620882.us-central1.run.app" \
  npm run smoke   # from website/
gcloud run services update-traffic immiguide-web --region us-central1 --to-latest
```

---

## 5. Source control

- Land the release via PR into the integration branch (`prepare-for-prod` →
  `main`); don't deploy long-lived work straight off a throwaway branch.
- Cloud Run builds from your **local working tree**, not from git — so make sure
  what you deployed matches what you merged.

---

## Checklist (copy per release)

- [ ] `npm ci && npm run lint && npx tsc --noEmit && npm test && npm run build` green
- [ ] Backend deployed/verified first (if it changed)
- [ ] `gcloud run deploy immiguide-web --source "$(pwd)/website" --region us-central1`
- [ ] `npm run smoke` → **SMOKE PASSED**
- [ ] Incognito: site loads, no client error; login → authed write works; `/post` gated
- [ ] PR merged; deployed tree matches merged code
- [ ] (If anything failed) rolled back to last good revision

---

### Related docs
- `DEPLOYMENT.md` — backend (`immiguide-api`) deploy.
- `PROD-READINESS.md` — domain/DNS, env swaps, monitoring (GCS + BigQuery).
- `AUTH-NEXT-STEPS.md` — auth verification state + remaining Google/mobile work.
