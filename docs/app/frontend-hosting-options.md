# Frontend hosting — options & trade-offs (Vercel vs. GCP)

> Status: **evaluation / decision doc.** No infra is changed by this document.
> It exists to decide *where the Next.js website (`website/`) should run* and to
> give a concrete migration plan if we move it onto GCP.

## 1. The question

The website (`website/`, Next.js 14.1, App Router) is currently hosted on
**Vercel** (`https://proceedings.vercel.app`). The backend
(`immiguide-api`) already runs on **Cloud Run** in GCP project
`proceedings-490601` / `us-central1`, alongside Firestore, GCS and Vertex AI
Search. The frontend is therefore the *only* part of the stack outside GCP.

> **Should we move the frontend onto GCP to remove the Vercel dependency?**

Two motivations are in play, and they are **not** the same:

1. **Reliability** — we have repeatedly hit a *stuck production promotion* on
   Vercel (PR #16 sat "pending" ~8 h; PR #17 built successfully but the
   `proceedings.vercel.app` alias did not switch to the new deployment). See §9.
2. **Consolidation** — one cloud, one IAM model, one billing account, one
   logging/monitoring plane, one region (frontend ↔ backend co-located).

⚠️ **Reliability alone is a weak reason to migrate.** The stuck-promotion issue
is a ~30-second dashboard fix (Deployments → latest → *Promote to Production*).
Migrate for **consolidation and control**, with reliability as a bonus — not as
a panic response to one bad deploy.

## 2. What the frontend actually needs from a host (hard requirements)

The app is **not** a static site. A host must support all of:

| Need | Why | Source |
|---|---|---|
| **Node SSR runtime** | App Router pages render server-side. | `website/src/app/**` |
| **Route handlers (`/api/*`)** | 26 BFF proxy routes inject `X-User-Id`, keep `PYTHON_API_URL` server-side, normalize the backend base URL (`apiBase()`), and centralize CORS. | `website/src/app/api/**`, `src/lib/apiBase.ts` |
| **ISR / revalidation** | e.g. `/api/users` uses `next: { revalidate: 300 }`. | `src/app/api/users/route.ts` |
| **Server env vars** | `PYTHON_API_URL` (backend origin) must stay server-only; never shipped to the browser. | `docs/DEPLOYMENT.md` |
| **HTTPS + custom domain (later)** | Public site; will move to a registered domain (D-055 provenance). | CLAUDE.md env section |

➡️ **A pure static export (GCS bucket / Firebase Hosting static) is ruled out** —
the `/api/*` route handlers and ISR require a running Node server.

## 3. Options

### Option V — Stay on Vercel (status quo)  ·  *baseline*
Keep `website/` on Vercel's Git integration. Auto-build + preview URLs per PR +
global edge CDN + image optimization, all zero-config. The recurring
stuck-promotion is the open risk; mitigations: manually promote, or set the
project's *Production* branch + *auto-assign production domains* correctly, or
attach a custom domain (custom domains follow the latest production deploy and
sidestep the `*.vercel.app` alias quirk).

### Option F — Firebase App Hosting  ★ recommended if we move
Google's managed host **purpose-built for SSR frameworks (Next.js/Angular)**.
Git-integrated (GitHub) auto-deploy, **preview channels per PR**, a built-in
**CDN**, and it **runs on Cloud Run + Cloud Build under the hood** — so it is
"Vercel-like DX, but inside GCP." We already use Firebase (Firestore), so it's
the same project, IAM, and billing. Config is a single `apphosting.yaml`.
Trade-off: newer product (GA 2024); fewer knobs than raw Cloud Run; less
battle-tested than Vercel.

### Option R — Next.js container on Cloud Run  ·  *max control / consolidation*
Dockerize Next with `output: 'standalone'`, push to Artifact Registry, run on
**Cloud Run** in the *same project/region as the backend*. Deploy via a
**Cloud Build trigger** on `main` (mirrors how `immiguide-api` already ships).
You own everything: CI, scaling, and — if you want global edge caching + a
custom domain — an **external HTTPS Load Balancer + Cloud CDN** in front.
Biggest consolidation win (frontend ↔ backend hop becomes intra-region, even
service-to-service), biggest setup cost.

### Option A — App Engine (Flexible/Standard)  ·  *not recommended*
Works for Node SSR but is the legacy path; weaker Next.js story than App
Hosting/Cloud Run, slower deploys, less community tooling for Next 14. Listed
for completeness; no advantage here.

## 4. Comparison at a glance

| Dimension | V · Vercel | F · Firebase App Hosting | R · Cloud Run | A · App Engine |
|---|---|---|---|---|
| SSR + route handlers + ISR | ✅ first-class | ✅ (managed Next.js) | ✅ (you run `next start`) | ✅ (manual) |
| Auto-deploy on `git push` | ✅ built-in | ✅ built-in (GitHub) | ⚙️ Cloud Build trigger | ⚙️ Cloud Build trigger |
| **PR preview URLs** | ✅ | ✅ preview channels | ❌ (DIY per-branch service) | ❌ |
| Global CDN / edge | ✅ automatic | ✅ included | ➕ add LB + Cloud CDN | ➕ add LB + Cloud CDN |
| Image optimization | ✅ built-in | ✅ | ⚙️ self/host or 3rd-party | ⚙️ |
| Inside GCP (1 IAM/billing/logs) | ❌ separate vendor | ✅ | ✅ | ✅ |
| Co-located w/ backend (latency) | ❌ cross-network | ✅ same region | ✅ same region (or S2S) | ✅ |
| Rollbacks | ✅ instant | ✅ | ✅ (revision pin) | ✅ (version split) |
| Control / tunability | ⚙️ limited | ⚙️ medium | ✅ full | ⚙️ medium |
| Setup effort (from today) | none | **~1–2 h** | **~½ day** | ~½–1 day |
| Vendor-lock removed | — | ✅ | ✅ | ✅ |

## 5. Cost comparison

> Orders of magnitude for a **pilot-scale** app (low, bursty traffic). Verify
> against current GCP/Vercel price sheets before committing — these move.

| Option | Cost shape | Pilot-scale estimate |
|---|---|---|
| **V · Vercel** | Hobby tier free; Pro is **$20/user/mo** (needed for commercial use / team features). | **$0** (Hobby) → **$20/mo** (Pro, if required for ToS/teams). |
| **F · Firebase App Hosting** | Pay for the underlying Cloud Run compute + Cloud Build minutes + CDN egress. Generous free tiers. | **~$0–5/mo** at pilot traffic; scales with usage. |
| **R · Cloud Run** (URL only) | Cloud Run: pay per request/CPU-sec, scales to zero. Artifact Registry + Cloud Build minutes are pennies at this scale. **No LB** if you serve from the `run.app` URL or a Cloud Run domain mapping. | **~$0–5/mo**. |
| **R · Cloud Run + global CDN** | Adds an **external HTTPS Load Balancer** (has an hourly floor, ~**$18–25/mo**) + Cloud CDN egress. | **~$20–30/mo** baseline. |
| **A · App Engine** | Instance-hours; Standard scales to zero, Flexible has a min instance (costlier). | **~$0–10/mo** (Standard). |

**Take-away:** at pilot scale the dollar differences are small. The real cost is
**effort + DX**, not the monthly bill. A global LB is the only line item that
meaningfully moves the number, and you only need it for Option R *with* a custom
domain + edge caching (App Hosting bundles equivalent CDN without you running an
LB).

## 6. What we give up leaving Vercel (eyes open)

- **Zero-config DX**: automatic per-PR preview URLs, instant rollbacks, edge
  image optimization, and a global CDN — "free" on Vercel. **Firebase App
  Hosting keeps most of this**; **Cloud Run makes you assemble it** (Cloud Build
  for CI, LB+CDN for edge).
- **Maturity**: Vercel is the reference Next.js host; the newest Next features
  land there first. App Hosting tracks closely; raw Cloud Run is "whatever
  `next start` supports," which is fine for our App-Router + route-handler usage.
- **One-click everything**: on GCP you trade clicks for IaC/CLI — which is also
  the upside (reproducible, reviewable, version-controlled deploys).

## 7. Recommendation

**Tiered, low-regret:**

1. **Now (unblock):** Stay on Vercel; **promote the latest deployment** to fix
   the stuck alias, and **attach the real custom domain when registered** —
   custom domains auto-follow the production deployment and make the
   stuck-`*.vercel.app`-alias class of bug go away. This needs no migration.
2. **Strategic (when ready to consolidate for launch):** Move to
   **Firebase App Hosting (Option F)**. It's the sweet spot for us — Vercel-like
   auto-deploy + preview channels + CDN, but inside the same GCP project as the
   backend, Firestore, and IAM. Lowest DX loss of any GCP option.
3. **Choose Cloud Run (Option R) instead only if** you want maximum control or
   intend to put the frontend behind the *same* load balancer / VPC / service-to-
   service auth as the backend, and are willing to own the CI + CDN setup.

> Net: **F is the recommended destination; R is the power-user alternative; V is
> a perfectly fine place to stay** if the custom-domain move resolves the
> promotion flakiness.

---

## 8. Migration plan A — Firebase App Hosting (Option F)

> Outcome: `git push` to `main` → App Hosting builds the Next app on Cloud Build
> → rolls out on managed Cloud Run with a CDN, in `proceedings-490601`.

### 8.1 Prerequisites
- Firebase project linked to GCP `proceedings-490601` (Firestore already is).
- `firebase-tools` CLI (`npm i -g firebase-tools`), authenticated.
- Roles for the human/SA running setup: App Hosting Admin, Cloud Build Editor,
  Artifact Registry Admin, Service Account User. **No SA key files** — use ADC
  / attached SA (org policy `iam.disableServiceAccountKeyCreation`, D-018).

### 8.2 Steps
1. **Enable** App Hosting + required APIs (`firebase init apphosting`, or
   Console → Build → App Hosting). Connect the GitHub repo `krishmalikk/proceedings`,
   set **root directory = `website/`**, **live branch = `main`**.
2. **`website/apphosting.yaml`** (committed) — runtime config + env. Secrets via
   Cloud Secret Manager, not plaintext:
   ```yaml
   # website/apphosting.yaml
   runConfig:
     minInstances: 0
     maxInstances: 2
     cpu: 1
     memoryMiB: 512
   env:
     - variable: PYTHON_API_URL
       value: https://immiguide-api-fbtmilucfq-uc.a.run.app   # bare origin, NO trailing /api
       availability: [RUNTIME]            # server-only; never exposed to the browser bundle
     - variable: APP_SOURCE_SYSTEM
       value: unclesamcalling
       availability: [RUNTIME]
     - variable: APP_BASE_URL
       value: https://proceedings.app
       availability: [RUNTIME]
   ```
   > Note: with the `apiBase()` normalizer (PR #17) the trailing-`/api` footgun
   > is already neutralized, but set the **bare origin** here anyway — clean source.
3. **First rollout**: push to `main` (or trigger a rollout in the Console).
   App Hosting builds with Cloud Build and serves behind its CDN.
4. **Preview channels**: enable so each PR gets a temporary URL (the Vercel-style
   review flow).
5. **Custom domain**: add it in App Hosting → Domains once registered; update
   `APP_BASE_URL` / `APP_SOURCE_SYSTEM` (D-055) and the backend CORS allow-list.
6. **Cut over**: point DNS at App Hosting; keep Vercel up until verified; then
   disable the Vercel Git integration (or delete the project).

### 8.3 Effort: ~1–2 h. Reversible (Vercel stays until DNS flips).

---

## 9. Migration plan B — Cloud Run container (Option R)

> Outcome: `git push` to `main` → Cloud Build builds a standalone Next image →
> deploys a new Cloud Run revision `immiguide-web`, same project/region as the API.

### 9.1 Enable standalone output
```js
// website/next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',   // emits .next/standalone with a minimal node server
}
module.exports = nextConfig
```

### 9.2 `website/Dockerfile` (multi-stage, standalone)
```dockerfile
# ---- deps ----
FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- build ----
FROM node:20-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build          # produces .next/standalone + .next/static

# ---- run ----
FROM node:20-slim AS run
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080              # Cloud Run injects $PORT; Next standalone honors it
# Standalone server + static assets + public/
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 8080
CMD ["node", "server.js"]
```
`website/.dockerignore`:
```
node_modules
.next
.git
.env*
**/__tests__
```

### 9.3 Manual first deploy (smoke test)
```bash
gcloud run deploy immiguide-web \
  --source website \
  --project proceedings-490601 --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars PYTHON_API_URL=https://immiguide-api-fbtmilucfq-uc.a.run.app,APP_SOURCE_SYSTEM=unclesamcalling,APP_BASE_URL=https://proceedings.app
```
> `PYTHON_API_URL` = **bare origin, no trailing `/api`**. Env vars are
> server-side only on Cloud Run (not baked into the client bundle).
> Optional hardening: make the API service require auth and have the web service
> call it **service-to-service** (ID token), since the proxy is the only caller.

### 9.4 `website/cloudbuild.yaml` (CI on push to `main`)
```yaml
steps:
  - name: gcr.io/cloud-builders/docker
    args: ['build', '-t', 'us-central1-docker.pkg.dev/$PROJECT_ID/web/immiguide-web:$SHORT_SHA',
           '-t', 'us-central1-docker.pkg.dev/$PROJECT_ID/web/immiguide-web:latest', '.']
    dir: website
  - name: gcr.io/cloud-builders/docker
    args: ['push', '--all-tags', 'us-central1-docker.pkg.dev/$PROJECT_ID/web/immiguide-web']
  - name: gcr.io/google.com/cloudsdktool/cloud-sdk
    entrypoint: gcloud
    args: ['run', 'deploy', 'immiguide-web',
           '--image', 'us-central1-docker.pkg.dev/$PROJECT_ID/web/immiguide-web:$SHORT_SHA',
           '--region', 'us-central1', '--allow-unauthenticated']
images:
  - 'us-central1-docker.pkg.dev/$PROJECT_ID/web/immiguide-web:$SHORT_SHA'
```
Wire a **Cloud Build trigger**: repo `krishmalikk/proceedings`, branch `^main$`,
included files filter `website/**`, config `website/cloudbuild.yaml`. (Create an
Artifact Registry repo `web` first.) **No key files** — the trigger runs as a
Cloud Build SA with `run.admin` + `iam.serviceAccountUser` (D-018).

### 9.5 (Optional) custom domain + global CDN
Either a **Cloud Run domain mapping** (simple, regional, no LB) or an
**external HTTPS Load Balancer + Cloud CDN** (global edge, the ~$18–25/mo line
item). Add the domain to the backend CORS allow-list and set `APP_BASE_URL` /
`APP_SOURCE_SYSTEM` (D-055).

### 9.6 PR previews (the gap vs. Vercel/App Hosting)
No built-in preview URLs. If needed, add a second trigger on PR branches that
deploys a tagged revision with `--no-traffic` + a `--tag` (gives a stable
`https://<tag>---immiguide-web-...run.app` preview URL). This is the main DX
cost of Option R.

### 9.7 Effort: ~½ day. Reversible (Vercel stays until DNS flips).

---

## 10. The Vercel stuck-promotion issue (context for "why are we even asking")

Observed twice:
- **PR #16**: deployment sat *pending* ~8 h; resolved by pushing an empty commit
  (fresh SHA → clean build).
- **PR #17**: Vercel reported **build success** and created a *Production*
  deployment for the merge commit, but `proceedings.vercel.app` kept serving the
  **previous** deployment (old code; `x-vercel-cache: HIT`, 404 from the old
  `/api/api/...` path). The production **alias did not switch**.

Likely causes: *auto-assign production domains* disabled, or a `*.vercel.app`
alias once pinned to a specific deployment. **Fix without migrating**: manually
*Promote to Production* in the dashboard, and/or attach a **custom domain**
(custom domains follow the latest production deploy, eliminating this class of
bug). This issue is a *nudge* toward consolidation, **not** a forcing function.

## 11. Decision checklist (fill in when deciding)

- [ ] Do we want everything under one GCP roof for launch? → favors **F/R**.
- [ ] Do we rely on per-PR preview URLs? → **F** keeps them; **R** needs DIY.
- [ ] Will we run a custom domain + want global edge caching? → **F** bundles it;
      **R** needs an LB (+cost).
- [ ] Is the team comfortable owning CI/CDN, or do we want managed? → managed → **F**.
- [ ] Is the Vercel custom-domain move enough to resolve the flakiness? → if yes,
      **V** is acceptable to keep.

> **Recommended path:** unblock on Vercel now (promote + custom domain), and plan
> a move to **Firebase App Hosting (Option F)** as the consolidation step for
> launch. Cloud Run (Option R) is the documented alternative if we need full
> control.
