# Release & Tagging Strategy

How versions get tagged and released in the `proceedings` monorepo
(`backend/`, `website/`, `mobile/`). This is the **single source of truth** —
follow it for every merge-to-`main` that reaches production, whether you're a
human or Claude acting on a human's behalf. See also [`docs/CI-CD.md`](CI-CD.md)
for how `main` gets built/tested/deployed.

## Principle: tag per component, not per repo

`backend`, `website`, and `mobile` deploy independently and on different
cadences (Cloud Run deploys are on-demand; mobile ships through Apple/Google
review). A single repo-wide version number would be misleading — e.g. tagging
`v1.5.0` when only the website changed says nothing true about the backend or
the app. Each component gets its **own SemVer line and its own tag prefix**:

| Component | Tag prefix | Version lives in |
|---|---|---|
| Backend | `backend-vX.Y.Z` | tag only (no version file in `backend/`) |
| Website | `website-vX.Y.Z` | `website/package.json` `"version"` |
| Mobile | `mobile-vX.Y.Z` | `mobile/app.config.js` (`version`, `ios.buildNumber`, `android.versionCode`) + `mobile/package.json` |

Bump rules (standard [SemVer](https://semver.org)):
- **MAJOR** — breaking change (API contract break, incompatible schema/migration)
- **MINOR** — new feature, backward-compatible
- **PATCH** — bug fix, chore, docs, CI-only change

## Tags are annotated and immutable

Always use **annotated tags** (`git tag -a`, not `git tag`) — they carry a
tagger, date, and message, unlike lightweight tags. Once pushed, **a tag is
never moved or force-updated**. If a deploy turns out bad, roll forward with a
new patch tag; don't re-point an existing one — anything (rollback scripts,
release notes, `deploy.yml` history) that already referenced the old tag stays
trustworthy.

## Process: from merged PR to tagged release

1. **Merge the PR to `main`** (squash or merge commit — either is fine; `main`
   has no linear-history requirement).
2. **Deploy** via the manual [`deploy.yml`](../.github/workflows/deploy.yml)
   `workflow_dispatch` — pick `target` (backend/website/both) and `ref` (defaults
   to `main`'s tip). This is gated on a required-reviewer approval before
   anything touches GCP (see [`docs/CI-CD.md`](CI-CD.md#deploy-workflow-manual-approval-scaffold)).
3. **After the deploy is confirmed healthy** (traffic promoted, smoke passed),
   tag the exact commit that's now live:
   ```bash
   git tag -a backend-v1.4.0 <commit-sha> -m "Backend v1.4.0"
   git push origin backend-v1.4.0
   ```
   Tag `main`'s tip directly (`HEAD`) if that's what was deployed — don't tag
   a branch, tag the resolved commit SHA so the pointer never drifts.
4. **Cut a GitHub Release from the tag**, with auto-generated notes from the
   merged PRs since the last tag of that component:
   ```bash
   gh release create backend-v1.4.0 \
     --title "Backend v1.4.0" \
     --generate-notes \
     --notes-start-tag backend-v1.3.2
   ```
   `--generate-notes` pulls PR titles/authors since the start tag — no manual
   changelog upkeep required.
5. **If it's a "both" deploy** (backend + website changed together), create
   both tags/releases — don't invent a combined tag.

### Mobile is a variant of the same flow

Mobile doesn't deploy via Cloud Run — it ships through EAS Build → App Store /
Play Store review. The version number still needs a matching git tag so
"what's live in the store" is traceable back to a commit:

1. Bump `version` in `mobile/app.config.js` **and** `mobile/package.json` together
   (keep them in sync) as part of the PR. Leave `ios.buildNumber` /
   `android.versionCode` alone — `eas.json`'s `"appVersionSource": "remote"` +
   `"autoIncrement": true` on the `production` build profile means EAS bumps
   the build number itself; hand-editing it will conflict.
2. Merge, then run the EAS production build/submit as usual.
3. Once Apple/Google accepts the build, tag the merged commit:
   ```bash
   git tag -a mobile-v1.1.0 <commit-sha> -m "Mobile v1.1.0 (build $(eas-build-number))"
   git push origin mobile-v1.1.0
   gh release create mobile-v1.1.0 --title "Mobile v1.1.0" --generate-notes --notes-start-tag mobile-v1.0.0
   ```

## Rollback

Redeploy a previous tag through the same manual `deploy.yml` dispatch — set
`ref` to the last-known-good tag (e.g. `backend-v1.3.2`) instead of `main`.
Because tags are immutable, this is guaranteed to redeploy exactly what was
running before, no guesswork.

## Finding the last tag for a component

```bash
git tag -l 'backend-v*' --sort=-v:refname | head -1
git tag -l 'website-v*' --sort=-v:refname | head -1
git tag -l 'mobile-v*'  --sort=-v:refname | head -1
```

## Current state

No tags exist yet as of this writing — `main` has no branch protection and
this monorepo has never been formally versioned. This document establishes
the process going forward; the first tag for each component should be cut the
next time that component is deployed to production.
