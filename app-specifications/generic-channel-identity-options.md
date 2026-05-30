# Generic Multi-Channel Identity & Provenance — Options & Trade-offs

**Status:** ✅ **DECIDED — recommended model adopted (Opt 1-A + 2-A + 3-A), 2026-05-29.** Recorded as **D-036** in [MEMORY.md](../MEMORY.md); the canonical schema ([schema.py](../content-ingestion-specifications/schema.py)) and the field dictionary ([JSON-SCHEMA-FIELD-DICTIONARY.md](../tagging-specifications/JSON-SCHEMA-FIELD-DICTIONARY.md) v2.3) have been updated and verified backward-compatible (all 71 batch-2 + batch-1 sidecars validate unchanged). See [§9](#9-decision-2026-05-29) for the decision + adopted defaults + the deferred follow-ups. Goal: **the canonical schema is generic across all channels and ingestion websites, not just reddit.com**, with the **app** as the first new channel (D-034).

---

## 1. What this decision covers

The app posting flow reuses the **existing ingestion contract** unchanged (Tagger `LLM-EXTRACTION-PROMPT.md` → Validator vocab gate → GCS-Writer sidecar pair → `documents.import`), per D-034 and the universal tagging rule (D-025). The metadata still tags **only** against `tags-cleaned/`. **What is *not* yet generic is the identity + provenance layer** of the schema — it is hardcoded to Reddit. This decision generalizes it so:
- the **app** channel can mint valid `case_id`s and provenance,
- future **website** channels (via Firecrawl, D-012) drop in with no further schema change,
- the **81 live docs + 72 frozen seed docs** keep validating (no forced re-tag).

---

## 2. Current Reddit-coupling inventory (what must generalize)

From `schema.py` + the field dictionary, these are Reddit-specific today:

| Element | Today (Reddit-coupled) | Generic concept it represents |
|---|---|---|
| `CASE_ID_RE` | `^reddit-\d{4}-\d{2}-\d{2}-[A-Za-z0-9_]+-[a-z0-9]+(__c_…)?$` — **prefix literal `reddit-`** | `<channel>-<date>-<container>-<native_id>` |
| `reddit_post_id` (field) | "Reddit submission base-36 id; dedup key" | source-native item id / dedup key |
| `subreddit` (field) | "subreddit name; facet" | source community / board / section / topic |
| `source_uri` + `SOURCE_URI_RE` | must match `^r/<sub>$` | channel-native locator |
| `source_system` | free string, "reddit" today | originating platform (already generic enough) |
| `source_url` / `full_url` | base URL / permalink | already generic |
| `gcs_path` channel segment | `[a-z0-9_-]+` | **already generic** ✓ (D-011) |
| BQ clustering | `cluster subreddit, severity` | cluster on `channel`/container |

Also note **provenance redundancy** (worth rationalizing while we're here): `source_system`, `source_url`, `source_uri`, `subreddit`, `full_url`, and `source_metadata` overlap heavily. Generalization is a chance to give each a crisp, channel-agnostic meaning.

---

## 3. Dimension 1 — `case_id` scheme

`case_id` is the Vertex doc id, the GCS basename, the dedup key, and (D-010) deterministic/human-readable. Keep all four properties; only generalize the prefix.

**Opt 1-A — Generalize the prefix to `<channel>` (Recommended).**
`case_id = <channel>-<YYYY-MM-DD>-<container>-<native_id>[__c_<comment_id>]`, regex `^[a-z][a-z0-9]*-\d{4}-\d{2}-\d{2}-[A-Za-z0-9_]+-[a-z0-9]+(__c_[a-z0-9]+)?$`.
- ✅ Every existing `reddit-…` id still matches; legacy `case-N` still exempt. Human-readable, deterministic, channel-self-describing. App → `app-2026-05-29-<container>-<id>`; web → `web-2026-05-29-<site>-<id>`.
- ⚠️ Channel token must agree with the `channel` field (add a cross-field validator).

**Opt 1-B — Opaque/UUID id + channel as a separate field only.**
- ✅ Fully decoupled. ❌ Loses human-readability + source-deterministic idempotency — **already rejected in D-010**; no reason to revisit.

**Opt 1-C — Keep `reddit-` and add per-channel literal prefixes by enumerating each.**
- ❌ Every new website needs a schema code change (a new literal). Defeats "generic across ingestion websites." Rejected.

---

## 4. Dimension 2 — Provenance / identity field model

**Opt 2-A — Channel-agnostic field names + an explicit `channel` field (Recommended).**

| Canonical field | Meaning | reddit | app | web (Firecrawl) |
|---|---|---|---|---|
| `channel` *(new)* | ingestion pathway; == case_id prefix == GCS segment | `reddit` | `app` | `web` |
| `source_system` | originating platform/site (fine-grained) | `reddit` | `<app-name>` | `immihelp.com` |
| `source_container` *(← `subreddit`)* | community / board / section / topic | `h1b` | username or topic | site section |
| `source_native_id` *(← `reddit_post_id`)* | platform-native or app-minted item id; **dedup key** | `1srn4ab` | Firestore post id | site item id/hash |
| `source_url` | base URL of the source system | reddit.com | app base URL | site root |
| `full_url` | canonical URL of *this* item | permalink | app deep link / `""` | page URL |
| `source_uri` | short channel-native locator (relaxed regex) | `r/h1b` | `app://…`/`""` | URL/path |
| `ingestion_method` | how it was ingested | `api_crawl` | `app_conversational_post` | `firecrawl` |
| `source_metadata` | free-form upstream blob | — | — | — |

- `channel` (coarse pathway) vs `source_system` (precise origin) is a deliberate split: `channel` drives the GCS segment, the case_id prefix, and a clean "only app posts" facet; `source_system` enables per-site analytics.
- ✅ Truly generic; new websites need **zero** schema change. ✅ Adds a first-class `channel` search facet.
- ⚠️ Renames two fields (`subreddit`, `reddit_post_id`) → needs a back-compat story (Dimension 3).

**Opt 2-B — Keep Reddit field names, just relax regexes + add `channel`.**
- ✅ Smallest change, zero rename. ❌ Field names stay Reddit-flavored (`subreddit`, `reddit_post_id`) for app/web data — semantically muddy, and **directly against the user's "generic, not just reddit" ask.** Acceptable only as a stopgap.

---

## 5. Dimension 3 — Backward-compatibility strategy (the real sub-decision)

Renaming under Pydantic `extra="forbid"` would break the 81 live + 72 frozen seed JSONs unless handled. Three ways:

**Opt 3-A — Generic names + read aliases (Recommended).**
Canonical generic names, with Pydantic `validation_alias = AliasChoices("source_container","subreddit")` etc. + `populate_by_name=True`. Old JSONs (which carry `subreddit`/`reddit_post_id`) still parse unchanged; new docs (all channels, **including Reddit going forward**) write generic names. The GCS sidecar SoT is untouched for existing docs (D-031); derived projections (BQ columns, Vertex `structData`) standardize on generic names.
- ✅ Generic schema now; **no migration, frozen seed corpus untouched**; reversible. ✅ Optional later: a **deterministic, no-LLM** key-rename migration of the 81 live docs for uniformity (a field rename needs no re-tagging — only the expensive tagging step is non-deterministic).
- ⚠️ Transition period with two accepted names; must update `ingest_batch.py`, `gen_diff_report.py`, `BIGQUERY_SCHEMA`, and the field dictionary.

**Opt 3-B — Full rename + deterministic re-emit of the corpus.**
Rename fields and regenerate all sidecars + BQ + data store with generic names (no re-tag — just key renames + re-import).
- ✅ Cleanest end-state, no alias debt. ❌ Touches frozen seed corpus (conflicts with D-030's "leave `postings-examples/` untouched") + re-imports 81 live docs; higher risk; against the project's additive norm.

**Opt 3-C — Relax-only, no rename (pairs with Opt 2-B).**
Keep `subreddit`/`reddit_post_id`, just generalize regexes + add `channel`.
- ✅ Trivial, zero risk. ❌ Not actually generic (Reddit field names persist for all channels).

---

## 6. Recommended coherent model

**Opt 1-A + Opt 2-A + Opt 3-A**: generalize the `case_id` prefix to `<channel>`, adopt channel-agnostic field names plus a new explicit `channel` field, and keep the existing corpus valid via read-aliases (with an optional deterministic rename migration later).

### How the **app** channel maps (concrete)
```
channel            = "app"
source_system      = "unclesamcalling"                 # the app name (D-038)
source_container   = "<synthetic_username>"            # stable at creation, non-PII (sub-Q: username vs topic vs fixed)
source_native_id   = "<firestore_posting_doc_id>"      # minted at draft creation = dedup/idempotency key
source_url         = "https://<app-domain>"
full_url           = "https://<app-domain>/p/<id>"     # or "" until published
source_uri         = "app://post/<id>"  (or "")
ingestion_method   = "app_conversational_post"
doc_kind           = "post"   # replies → "comment" + __c_<id> (if app supports replies)
case_id            = "app-2026-05-29-<username>-<firestore_id>"
```
The metadata JSON itself is produced by the **BFF + Gemini** conversation (the same `LLM-EXTRACTION-PROMPT.md` extraction), validated against the master vocab, written as a sidecar pair under `gs://imm-postings-ingestion/<date>/app/`, and imported — identical contract to Reddit, only identity/provenance differ.

### Why this model
1. **Genuinely generic** — a new website is just a new `channel`/`source_system` value; no schema code change (satisfies the explicit ask).
2. **Preserves every D-010 property** of `case_id` (deterministic, human-readable, idempotency key) while dropping the Reddit literal.
3. **No forced migration** — existing 81 live + 72 frozen seed docs keep validating via aliases (respects D-030's frozen baseline and D-031's SoT model).
4. **Adds a clean `channel` facet** the apps will want ("show only community/app posts vs crawled web").
5. **Rationalizes provenance** with crisp channel-agnostic meanings instead of Reddit-specific ones.

### Honest caveats
- Aliases create a transition period with two accepted field names; the optional deterministic rename migration (Opt 3-B-style, but no re-tag) closes that later if uniformity matters.
- BQ clustering should change from `subreddit, severity` to `channel, severity` (or add `channel`); that's a projection-layer change, not a SoT change.

---

## 7. Side-by-side

| | Recommended (1-A/2-A/3-A) | Stopgap (1-A/2-B/3-C) | Clean break (1-A/2-A/3-B) |
|---|---|---|---|
| Generic across websites | ✅ | ⚠️ regex-only; Reddit field names persist | ✅ |
| New website needs schema change | ❌ no | ❌ no | ❌ no |
| Existing 81 live docs | valid via alias | valid as-is | re-emitted |
| Frozen seed corpus (D-030) | untouched | untouched | **touched** ❌ |
| Field-name cleanliness | ✅ generic | ❌ Reddit-flavored | ✅ generic (no aliases) |
| Migration effort/risk | low (aliases) + optional later | trivial | medium (re-emit + re-import) |
| Adds `channel` facet | ✅ | ✅ | ✅ |
| Alias debt | yes (closable) | none | none |

---

## 8. Open sub-questions (flag before the `D-NNN`)

1. **App-content PII posture (important, channel-specific).** D-017 dropped Cloud DLP because *public Reddit* posts aren't treated as sensitive. **First-person app posts may carry more PII** (real names, A-numbers, receipt/case numbers, employer names) and are authored by an identifiable (if synonymous) user. Decide whether the **app channel** needs a PII step (DLP / scrub / pre-publish guidance / the draft-review card surfacing "this will be public") before GCS write + indexing. Recommend at least: explicit pre-publish consent + a light PII nudge in the review card; full DLP reconsidered if needed. **Does not change the identity model**, but should be decided alongside it.
2. **`source_container` value for app** — synthetic username (groups by author, stable at creation, recommended) vs derived topic (needs classification before id mint) vs a fixed token. 
3. **`source_native_id` source for app** — Firestore posting doc id (recommended; minted at draft creation, natural idempotency key) vs a ULID.
4. **`channel` typing** — permissive lowercase-token string with a documented known set (`reddit|app|web|…`, recommended, so new sites need no code change) vs a closed Pydantic enum (stricter but each new site edits code).
5. **Keep a derived `subreddit` on output?** for any existing Reddit-only consumer, or drop it from serialized output once generic names land.
6. **Deterministic rename migration of the 81 live docs — now or later?** (no re-tag needed; aliases make it deferrable).
7. **BQ projection** — change clustering to `channel, severity` and add `channel`/`source_container`/`source_native_id` columns.
8. **App name** — the `source_system` value (and app domain) — product naming, TBD.

When these are settled (or accepted as defaults), I'll record the choice as a `D-NNN` and update `schema.py` + the field dictionary accordingly.

---

## 9. Decision (2026-05-29)

**Adopted: the recommended coherent model (Opt 1-A + 2-A + 3-A).** Recorded as **D-036** in [MEMORY.md](../MEMORY.md).

**Implemented this session (verified):**
- [schema.py](../content-ingestion-specifications/schema.py): `CASE_ID_RE` generalized to `^[a-z][a-z0-9]*-…` (any channel prefix); new `channel` field (derived from the `case_id` prefix when omitted; cross-checked against it; legacy `case-N` → `reddit`); `subreddit`→`source_container` and `reddit_post_id`→`source_native_id` with `AliasChoices` so the old keys still parse + read-only back-compat properties; `source_uri` relaxed (`r/<sub>` | `<scheme>://…` | `""`); `BIGQUERY_SCHEMA` adds `channel`/`source_container`/`source_native_id`.
- [JSON-SCHEMA-FIELD-DICTIONARY.md](../tagging-specifications/JSON-SCHEMA-FIELD-DICTIONARY.md) → v2.3 (identifier convention, JSON example, field table, validation rules, change log).
- **Verified:** smoke test passes; **all 71 batch-2 + the batch-1 sidecars (old `subreddit`/`reddit_post_id` keys) validate unchanged**; an app-channel post validates; a channel/prefix mismatch is correctly rejected.

**Adopted defaults for the §8 sub-questions:** (2) app `source_container` = **synthetic username**; (3) app `source_native_id` = **Firestore posting doc id**; (4) `channel` = **permissive lowercase token** (not a closed enum); (5) keep read-only back-compat accessors, generic names are canonical on output; (8) app `source_system` name = **`unclesamcalling`** (set in D-038).

**Follow-ups:**
- **Live-pipeline code sync — DONE (D-037).** `ingest_batch.py` / `provision_gcp.py` / `decommission_gcp.py` now emit + write the generic names (`channel`, `source_container`, `source_native_id`) and cluster BQ on `channel,severity`; `gen_diff_report.py` needed no change. Verified offline (compile + MERGE-columns-match-`BIGQUERY_SCHEMA` + stub→validate→`model_dump`).
  - **One remaining ops step (not code):** the existing live BigQuery table must be **recreated** (drop + re-provision), not altered — columns were renamed/added and clustering changed, and the MERGE `INSERT ROW` needs source columns to match the target exactly. Path: `decommission --full` → `provision` → re-run `ingest`. BQ is a derived projection (D-031); GCS SoT + data store are unaffected (case_ids unchanged).
- **§8.1 App-content PII posture** — still open; a separate decision the identity model does not depend on.
- **Optional deterministic key-rename migration** of the already-committed sidecars in `postings-batch-1/2-tagged/` — cosmetic only (they validate via aliases).
