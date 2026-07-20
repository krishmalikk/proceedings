# Release & Tagging Strategy

How versions get tagged and released in the `proceedings` monorepo
(`backend/`, `website/`, `mobile/`). This is the **single source of truth** —
follow it for every merge-to-`main` that reaches production, whether you're a
human or Claude acting on a human's behalf. See also [`docs/CI-CD.md`](CI-CD.md)
for how `main` gets built/tested/deployed.

## Releases are explicit, not automatic

**Not every merge to `main`, and not every deploy, produces a tag or a
release.** There is no automation that tags on push or on a successful
`deploy.yml` run — tagging is a deliberate, manual decision, made only when a
human explicitly asks for a new version to be cut (e.g. "tag this as
backend-v1.2.0" / "cut a release for the website deploy that just went out").
Most day-to-day merges and deploys are untagged; that's expected, not a gap.
Claude must never tag or create a release on its own initiative just because
a PR merged or a deploy succeeded — always wait to be asked.

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

Deploying and releasing happen in **one dispatch** of
[`deploy.yml`](../.github/workflows/deploy.yml) — tagging is an *optional
input on the same workflow run*, not a separate manual step performed
afterward.

1. **Merge the PR to `main`** (squash or merge commit — either is fine; `main`
   has no linear-history requirement).
2. **Dispatch the deploy** — Actions tab → `Deploy (manual approval)` → Run
   workflow, and set:
   - `target`: `backend` / `website` / `both`
   - `ref`: what to deploy (defaults to `main`'s tip)
   - `cut_release`: **leave `false` for most deploys.** Set to `true` only
     when this specific deploy is worth marking as a version (see
     [Releases are explicit, not automatic](#releases-are-explicit-not-automatic)
     — this is still a human decision, just made at dispatch time instead of
     after the fact).
   - `bump`: `patch` / `minor` / `major` (only read when `cut_release=true`)
3. The run is gated on a required-reviewer approval before anything touches
   GCP (see [`docs/CI-CD.md`](CI-CD.md#deploy-workflow-manual-approval-scaffold)).
   It deploys, smoke-tests, and promotes traffic.
4. **If `cut_release=true`**, the workflow's last step computes the next
   SemVer per target (reading the last `<prefix>-v*` tag, applying `bump`),
   then tags the exact deployed commit and runs
   `gh release create --generate-notes` — for `both`, it cuts `backend-v*`
   *and* `website-v*` independently (never a combined tag).

No GitHub UI access, or want it from the CLI instead? Same effect:
```bash
gh workflow run deploy.yml -f target=backend -f ref=main -f cut_release=true -f bump=patch
```

### Known limitation

The `gcloud run deploy` / traffic-promotion steps in `deploy.yml` are still
`TODO` placeholders (GCP auth isn't wired up yet — see the workflow's header
comment). Until that's filled in, a dispatch with `cut_release=true` would
create a *real* tag/release against a deploy that didn't actually touch GCP.
**Don't use `cut_release=true` on a real dispatch until those TODOs are
done.**

### Interim checklist — next release, until GCP auth is wired up

Until the workflow can deploy for real, do this instead:

1. **Deploy manually** — run the `gcloud run deploy` command from `CLAUDE.md`
   by hand for whichever component(s) changed (backend and/or website).
2. **Confirm it's healthy** — smoke-test / spot-check the live URL before
   treating it as done.
3. **Ask for the tag/release explicitly** — tell Claude (or run the commands
   yourself) which component(s) shipped and the bump type, e.g. *"cut a patch
   release for backend."* Claude finds the last `<prefix>-v*` tag, computes
   the next SemVer, tags the deployed commit, and runs
   `gh release create --generate-notes` — the same logic `deploy.yml`'s
   `cut_release` step runs, just invoked by hand instead of by the workflow.

Once the GCP TODOs are filled in, steps 1–3 collapse into a single dispatch:
merge → Run workflow with `cut_release: true` + `bump` set → approve. See
[Process: from merged PR to tagged release](#process-from-merged-pr-to-tagged-release)
above.

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

`main` has no branch protection. The first tags — `backend-v1.0.0`,
`website-v1.0.0`, `mobile-v1.0.0` — were cut on `aebb303` (the PR #35 merge),
the first deploy this process was formally applied to. Not every commit after
it will get a tag — only ask for one when a specific deploy needs to be
version-pinned or is worth marking as a release (see
[Releases are explicit, not automatic](#releases-are-explicit-not-automatic)).
