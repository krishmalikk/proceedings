# Posting Metadata — JSON Field Dictionary & Extraction Rules

Authoritative spec for every field in the canonical posting-metadata JSON.
For each field: type, source, extraction rule, allowed values / vocabulary, and an example.

The companion file [LLM-EXTRACTION-PROMPT.md](LLM-EXTRACTION-PROMPT.md) embeds these rules as an LLM system prompt.

> **Identifier convention (v2.3, generic multi-channel — D-036)**: New pipeline-ingested documents use the
> channel-prefixed `case_id` `<channel>-<YYYY-MM-DD>-<container>-<native_id>` (and `…__c_<comment_id>` for
> comment documents), where `<channel>` is the ingestion channel (`reddit` | `app` | `web` | …). Reddit ids
> (`reddit-<date>-<subreddit>-<post_id>`) are the Reddit instance of this generic form and remain valid.
> The original 72-document seed corpus under `postings-examples/case-N/` predates this convention and
> retains its legacy `case-N` ids (which derive `channel="reddit"`); it is not rewritten.
> **Generic provenance fields**: `channel`, `source_container` (formerly `subreddit`), and `source_native_id`
> (formerly `reddit_post_id`) are the canonical channel-agnostic names; the old Reddit-named keys are still
> accepted on input as aliases for backward-compatibility, so the existing corpus validates unchanged.

---

## 1. Canonical schema (target shape)

```jsonc
{
  // ── IDENTITY ──────────────────────────────────────────────────────────
  "case_id": "reddit-2026-05-17-h1b-1srn4ab",
  "channel": "reddit",                      // reddit | app | web | … (== case_id prefix == GCS segment)
  "doc_kind": "post",                       // "post" | "comment"
  "parent_case_id": "",                     // set only when doc_kind == "comment"
  "source_native_id": "1srn4ab",            // source-native / app-minted item id (dedup key); alias: reddit_post_id

  // ── SOURCE / PROVENANCE ──────────────────────────────────────────────
  "ingestion_method": "web_crawl",
  "source_system": "reddit",
  "source_url": "https://reddit.com",
  "source_uri": "r/h1b",                    // channel-native locator: r/<sub>, <scheme>://…, or ""
  "source_container": "h1b",                // community/board/section/topic; alias: subreddit
  "full_url": "https://www.reddit.com/r/h1b/comments/...",
  "post_title": "I94 overstay by 13 months",
  "language": "en",

  // ── TIMESTAMPS (all ISO-8601) ────────────────────────────────────────
  "posting_date": "2026-04-11",
  "ingestion_timestamp": "2026-04-13T14:30:05Z",
  "last_updated_timestamp": "2026-05-14T00:00:00Z",

  // ── QUALITY METADATA ─────────────────────────────────────────────────
  "tagging_confidence": 0.92,
  "source_metadata": "<some metadata information about source url>",
  "gcs_path": "gs://imm-postings-ingestion/2026-05-17/reddit/reddit-2026-05-17-h1b-1srn4ab.md",

  // ── FREE-TEXT SUMMARIES ──────────────────────────────────────────────
  "background_summary": "<summary_pending_llm>",
  "concerns_or_questions_summary": "Free-text paraphrase of the questions asked",

  // ── STATUS (5 sibling tag fields — NO duplicates across them) ────────
  "current_visa_or_greencard_category": ["H-1B"],
  "visa_applying_for": ["H-1B"],
  "primary_consulate": "IN",
  "consulates": ["IN"],
  "tags": ["I-94", "passport-expired", "re-entry"],
  "concerns_or_questions_tags": ["overstay", "NPT", "pardon", "h1b-extension"],

  // ── CASE CONTEXT (LLM- or heuristic-derived for Vertex faceting) ────
  "principal_country_of_chargeability": "IN",
  "employer_type": "unknown",
  "severity": "high",
  "resolution_status": "open",
  "derived_topic_cluster": ["h1b-status-issue", "overstay-recovery"],

  // ── STRUCTURED KEY-VALUE STAGES & DATES ─────────────────────────────
  "key_stages_or_info": { "spouse_status": "H-1B" },
  "key_dates": {
    "visa_expire_date": "2026-07-30",
    "i94_expire_date": "2025-03-31"
  },

  // ── EMBEDDING TEXT (computed) ───────────────────────────────────────
  "embedding_text": "H-1B overstay 13 months. Passport expired. NPT pardon ...",
  "index_state": null                       // import_requested|indexed|failed (set by event-driven importer)
}
```

---

## 2. Field-by-field rules

### 2.1 Identity

| Field | Type | Required | Extraction rule |
|---|---|---|---|
| `case_id` | string | yes | Primary document ID in Vertex AI Search and the GCS object basename. **Format (v2.3, generic — D-036)**: `<channel>-<YYYY-MM-DD>-<container>-<native_id>` where `<channel>` is the ingestion channel (`reddit`/`app`/`web`/…), the date is the post's `posting_date`, `<container>` is the source grouping (Reddit: subreddit; app: synthetic username; web: site/section), and `<native_id>` is the source-native or app-minted item id (e.g. `reddit-2026-05-17-h1b-1srn4ab`, `app-2026-05-29-quiet_falcon_42-7h3k9q2`). For a comment document append `__c_<comment_id>`. Deterministic — recomputable from the source, so it doubles as the idempotency key. **Seed corpus exception**: the 72 files under `postings-examples/case-N/` keep their legacy `case-<integer>` ids. |
| `channel` | string | yes (new ingestion) | Ingestion channel token (lowercase): `reddit` \| `app` \| `web` \| … . Equals the `case_id` prefix and the GCS path `<channel>` segment. **Derived from the `case_id` prefix when omitted** (legacy `case-N` → `reddit`); a supplied value must match the prefix. Primary search facet for "which channel". |
| `doc_kind` | string enum | yes (new ingestion) | `"post"` for an original submission, `"comment"` for a qualifying top-level comment (> 5 upvotes; app replies if enabled). Seed corpus: omit or `"post"`. |
| `parent_case_id` | string | yes when `doc_kind=="comment"` | The `case_id` of the parent post. Empty string for posts. |
| `source_native_id` | string | yes (new ingestion) | The source-native item id (Reddit base-36 submission id, e.g. `1srn4ab`) or app-minted id (e.g. the Firestore posting doc id). Dedup/idempotency key. **Back-compat alias**: the legacy key `reddit_post_id` is still accepted on input. |

### 2.2 Source / provenance

| Field | Type | Required | Extraction rule |
|---|---|---|---|
| `ingestion_method` | string | yes | How the document was ingested: `api_crawl` (Reddit PRAW), `firecrawl` (web channels), `app_conversational_post` (app channel), `manual_upload`. Pass-through where a source provides it. |
| `source_system` | string | yes | Originating platform/site (fine-grained): `reddit`, the app name, or a website domain (e.g. `immihelp.com`). Distinct from `channel` (coarse pathway). |
| `source_url` | string | yes | Base URL of the source system/community. Pass-through. |
| `source_uri` | string | no | Channel-native short locator: Reddit subreddit path `r/<sub>`, any `<scheme>://…` URI (e.g. `app://post/<id>`), or `""` for channels with no native locator. |
| `source_container` | string | yes (new ingestion) | Source community / board / section / topic — Reddit: subreddit name (no `r/`); app: synthetic username (or topic); web: site section. Supports Vertex facet filtering. **Back-compat alias**: the legacy key `subreddit` is still accepted on input. |
| `full_url` | string | yes | Full canonical URL of this specific item (Reddit permalink, web page URL, or app deep link; `""` if none yet). Pass-through from input. |
| `post_title` | string | yes | The post's title. Extract from the `.md` content: typically the second line if the first line is a URL header; otherwise the first non-empty line that is not a URL. Strip Markdown heading hashes. Trim. |
| `language` | string ISO-639-1 | yes | Detect from the posting text. Default `"en"` for English. Use detection model if available. |

### 2.3 Timestamps (all ISO-8601 `YYYY-MM-DDTHH:MM:SSZ`)

| Field | Type | Required | Extraction rule |
|---|---|---|---|
| `posting_date` | string `YYYY-MM-DD` | yes | Date the post was created at the source. Pass-through from input. |
| `ingestion_timestamp` | string ISO-8601 with `T...Z` | yes | When the posting was crawled. Format: `"YYYY-MM-DDTHH:MM:SSZ"` (UTC). |
| `last_updated_timestamp` | string ISO-8601 with `T...Z` | yes | When THIS JSON document was last written. Set to the current UTC time at write. |

### 2.4 Quality metadata

| Field | Type | Required | Extraction rule |
|---|---|---|---|
| `tagging_confidence` | number 0.0–1.0 | yes | Overall confidence in tag correctness. Default `0.90`. |
| `source_metadata` | string | yes | Free-form upstream metadata. Pass-through. |
| `gcs_path` | string | yes | GCS URI of **this document's `.md` file** (D-027). Format: `gs://imm-postings-ingestion/<YYYY-MM-DD>/<channel>/<case_id>.md` where `<channel>` is `reddit` (future: other source channels). The companion `<case_id>.json` lives at the same prefix with the same basename. (The seed corpus and any legacy documents may still carry the folder form `gs://imm-postings-ingestion/<YYYY-MM-DD>/<channel>/`; the validator accepts both.) |

### 2.5 Free-text summaries

| Field | Type | Required | Extraction rule |
|---|---|---|---|
| `background_summary` | string | yes | 1–3 sentence factual paraphrase of the candidate's background (current status, prior visas, key facts). If LLM not available, use literal `"<summary_pending_llm>"`. |
| `concerns_or_questions_summary` | string | yes | 1–3 sentence factual paraphrase of the questions/concerns being asked. Must be present even if `background_summary` is a placeholder. |

### 2.6 Status — the 5 sibling tag fields (NO duplicates across them)

A given tag string MUST appear in exactly one of these arrays per document. Exception: `visa_applying_for` and `current_visa_or_greencard_category` may both carry the same tag for renewal/extension cases (since they encode distinct dimensions).

| Field | Vocabulary | Extraction rule |
|---|---|---|
| `current_visa_or_greencard_category` | section 1.1 + 1.2 tags | The candidate's PRESENT status. Empty array if no current US status (e.g., applicant abroad with no prior status). |
| `visa_applying_for` | section 1.1 + 1.2 tags | The candidate's INTENDED next status. Empty if not seeking change. For renewals/extensions, may equal `current_visa_or_greencard_category`. For an option being seriously considered (e.g., "switching to F-1"), include it. |
| `primary_consulate` | single string from section 1.4 | First/primary U.S. consulate involved. Country code (2 letters) or City code (3 letters). Empty string if no consulate is involved. |
| `consulates` | section 1.4 tags | Every consulate referenced (country + city codes). Always includes `primary_consulate`. Order: primary first, secondary after. |
| `tags` | union of sections 1.3, 1.5, 1.6, 1.7, 1.9, 1.10 (plus 1.1/1.2 codes only when historical) | Background / contextual tags: forms (1.5), abbreviations (1.3), prior-state context, common-misc topics, outcome tags only when they describe a stable state and aren't in `key_stages_or_info`. **Do not** put visa/GC tags here UNLESS they represent a *prior/historical* status (e.g. someone who held F-1 in the past but isn't currently and isn't applying); pair with `prior-visa` tag. **Do not** put consulate codes here. |
| `concerns_or_questions_tags` | same vocabulary as `tags` | Tags that name what the user is actively asking about or worried about RIGHT NOW. Subset is disjoint from `tags` — same tag never in both. |

Decision rule for `tags` vs `concerns_or_questions_tags`:
> If removing the tag would not change a reader's understanding of the *question*, put it in `tags`. If the tag IS the question or its central object, put it in `concerns_or_questions_tags`.

### 2.7 Case context (LLM- or heuristic-derived for Vertex faceting)

| Field | Type / Vocabulary | Extraction rule |
|---|---|---|
| `principal_country_of_chargeability` | string (ISO-2 country code) | Country to which the candidate's immigrant visa is charged. Often equal to country of birth. Derive from text mentions of country of birth or origin. Empty string if not inferable. |
| `employer_type` | enum: `bigtech`, `consulting`, `startup`, `academic`, `healthcare`, `government`, `nonprofit`, `other`, `unknown` | Derive from any employer/industry mention. Default `"unknown"`. |
| `severity` | enum: `critical`, `high`, `medium`, `low` | Heuristic. `critical` if removal/deportation/loss of status imminent. `high` if status expires soon or unlawful presence accrued. `medium` if process delay. `low` if information request. |
| `resolution_status` | enum: `open`, `answered`, `resolved`, `unknown` | `open` if the post is a question with no captured answer (default for crawled questions). |
| `derived_topic_cluster` | array of strings | 1–3 short topic-cluster labels (kebab-case) summarizing the case. Used as a high-level facet. Examples: `h1b-layoff`, `k1-fiance-visa`, `consular-delays`, `cap-gap-issue`, `overstay-recovery`. |

### 2.8 Structured key-value stages & dates

| Field | Type | Vocabulary | Extraction rule |
|---|---|---|---|
| `key_stages_or_info` | object | keys from section 1.7; values are short strings | Captures discrete state facts (e.g., `"I-140": "approved"`, `"spouse_status": "H-1B"`, `"travel_country": "IN"`). |
| `key_dates` | object | keys from section 1.8; values **must be `YYYY-MM-DD`** | ISO-8601 calendar dates only. |

### 2.9 Embedding text & ingestion status

| Field | Type | Required | Extraction rule |
|---|---|---|---|
| `embedding_text` | string | yes | Concatenation built at write time. Vertex AI Search embeds this internally (single sink — no pipeline-owned embedding). Format: `"<post_title>. <background_summary>. <concerns_or_questions_summary>. Tags: <comma-joined union of all 5 sibling tag fields>. Stages: <comma-joined key:value of key_stages_or_info>. Dates: <comma-joined key:value of key_dates>."`. |
| `index_state` | string | no (nullable) | Ingestion/index status for observability & reconciliation: `import_requested` / `indexed` / `failed`. Set by the event-driven `search-importer` (PIPELINE-ARCHITECTURE-WORKFLOW.md §17); null until the document is imported. |

---

## 3. Vocabulary validation rules (block ingestion on failure)

Implemented at ingestion time, before indexing in Vertex:

1. Every element of `current_visa_or_greencard_category` ∈ `tags-cleaned/1.1-non-immigration-visas.csv` ∪ `1.2-greencard-categories.csv`.
2. Every element of `visa_applying_for` ∈ same as above.
3. Every element of `consulates` ∈ `tags-cleaned/1.4-consulates.csv`.
4. `primary_consulate` ∈ `consulates` (or empty).
5. Every element of `tags` ∈ union of `1.3`, `1.5`, `1.6`, `1.9`, `1.10`.
6. Every element of `concerns_or_questions_tags` ∈ same union as `tags`.
7. Every key of `key_stages_or_info` ∈ `tags-cleaned/1.7-key-stages.csv` ∪ `1.1` ∪ `1.3` ∪ `1.5` ∪ `1.6` (per spec 1.7, stage keys may be form/visa/abbreviation/action names).
8. Every key of `key_dates` ∈ `tags-cleaned/1.8-key-dates.csv` AND every value matches regex `^\d{4}-\d{2}-\d{2}$`.
9. No tag string appears in more than one of: `current_visa_or_greencard_category`, `consulates`, `tags`, `concerns_or_questions_tags`. (`visa_applying_for` is allowed to share with `current_visa_or_greencard_category`.)
10. `principal_country_of_chargeability` matches `^[A-Z]{2}$` or is empty.
11. `employer_type` ∈ allowed enum (case 2.7).
12. `severity` ∈ allowed enum.
13. `resolution_status` ∈ allowed enum.
14. `tagging_confidence` is a number in `[0.0, 1.0]`.
15. `doc_kind` ∈ {`post`, `comment`}.
16. If `doc_kind == "comment"` then `parent_case_id` is non-empty and matches an existing post `case_id`; if `doc_kind == "post"` then `parent_case_id` is `""`.
17. `case_id` matches `^[a-z][a-z0-9]*-\d{4}-\d{2}-\d{2}-[A-Za-z0-9_]+-[a-z0-9]+(__c_[a-z0-9]+)?$` for new ingestion — any channel prefix (seed corpus `case-<int>` is exempt).
18. `source_native_id` (alias `reddit_post_id`) is non-empty for new ingestion and is unique per `doc_kind`+comment-id (the dedup key).
19. `channel` is a lowercase token matching `^[a-z][a-z0-9]*$`; it equals the `case_id` prefix (derived from it when omitted; legacy `case-N` → `reddit`).
20. `source_uri` is `r/<sub>`, a `<scheme>://…` URI, or `""`.

---

## 4. Worked example (case-3 — I-94 overstay)

Input free-text excerpt:
> "wife had her h1b till sept 2026 ... visit to India ... passport expired ... 13 months overstay ... lawyers prepping for an NPT application requesting for pardon ... about to file for h1b extension"

| Field | Extracted value | Rule applied |
|---|---|---|
| `current_visa_or_greencard_category` | `["H-1B"]` | "her h1b till sept 2026" → present holder of H-1B |
| `visa_applying_for` | `["H-1B"]` | "about to file for h1b extension" → intent to renew same visa |
| `primary_consulate` | `""` | No consulate is being interacted with (event was past travel) |
| `consulates` | `["IN"]` | "visit to India" |
| `tags` | `["I-94", "passport-expired", "re-entry"]` | Form (1.5), state facts (1.10) |
| `concerns_or_questions_tags` | `["overstay", "NPT", "pardon", "h1b-extension", "unlawful-presence"]` | The active questions |
| `principal_country_of_chargeability` | `"IN"` | India connection + likely chargeability |
| `severity` | `"high"` | 13-month overstay, unlawful presence |
| `resolution_status` | `"open"` | Question post |
| `derived_topic_cluster` | `["overstay-recovery", "h1b-status-repair"]` | Topic inference |
| `key_stages_or_info` | `{"spouse_status": "H-1B", "travel_country": "IN"}` | Section 1.7 keys |
| `key_dates` | `{"visa_expire_date": "2026-07-30", "i94_expire_date": "2025-03-31"}` | ISO-8601 normalized |

---

## 5. Change log

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-05-14 | Initial canonical schema (this document) |
| 2.0 | 2026-05-18 | Source-prefixed `case_id` (`reddit-<date>-<sub>-<post_id>`); added `doc_kind`, `parent_case_id`, `reddit_post_id`; `gcs_path` is now the `gs://imm-postings-ingestion/<date>/<channel>/` prefix; comment-as-document model. Seed corpus retains legacy `case-N` ids. |
| 2.2 | 2026-05-21 | `gcs_path` updated (D-027) — now points to the document's `.md` file (`gs://…/<date>/<channel>/<case_id>.md`), not the folder. The validator accepts both forms (legacy folder form still valid for the seed corpus). |
| 2.1 | 2026-05-18 | Added nullable `index_state` (ingestion/index status, set by the event-driven importer). Streaming Vertex AI Vector Search was rejected on cost grounds, so the earlier `embedding_model`/`embedding_version` lineage fields were dropped (single Vertex AI Search sink — embeddings are managed, not pipeline-owned). |
| 2.3 | 2026-05-29 | **Generic multi-channel identity (D-036).** `case_id` prefix generalized from the literal `reddit-` to `<channel>-` (regex `^[a-z][a-z0-9]*-…`). Added the `channel` field (derived from the prefix when omitted). Renamed `subreddit`→`source_container` and `reddit_post_id`→`source_native_id` as channel-agnostic canonical names, with the old keys accepted as **input aliases** (existing corpus validates unchanged). `source_uri` relaxed to accept `r/<sub>`, any `<scheme>://…` URI, or `""`. `ingestion_method`/`source_system` re-documented as channel-agnostic. BigQuery projection adds `channel`/`source_container`/`source_native_id`. App is the first non-Reddit channel. |
