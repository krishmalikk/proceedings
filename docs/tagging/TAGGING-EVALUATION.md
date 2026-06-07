# Tagging — Improvement Areas

Known gaps and forward-looking recommendations for the tagging system and the Vertex AI Search integration.

---

## 1. Validation gate

A validator MUST run between the tagger LLM and Vertex AI Search ingestion. It enforces:

1. Every element of `current_visa_or_greencard_category` ∈ [tags-cleaned/1.1-non-immigration-visas.csv](../../backend/tags-cleaned/1.1-non-immigration-visas.csv) ∪ [1.2-greencard-categories.csv](../../backend/tags-cleaned/1.2-greencard-categories.csv).
2. Every element of `visa_applying_for` ∈ same as above.
3. Every element of `consulates` ∈ [1.4-consulates.csv](../../backend/tags-cleaned/1.4-consulates.csv).
4. `primary_consulate` ∈ `consulates` (or empty).
5. Every element of `tags` ∈ union of 1.3, 1.5, 1.6, 1.9, 1.10 (plus 1.1/1.2 only when historical/prior context).
6. Every element of `concerns_or_questions_tags` ∈ same union as `tags`.
7. Every key of `key_stages_or_info` ∈ 1.7 ∪ 1.1 ∪ 1.3 ∪ 1.5 ∪ 1.6.
8. Every key of `key_dates` ∈ 1.8 AND every value matches `^\d{4}-\d{2}-\d{2}$`.
9. No tag string appears in more than one of: `current_visa_or_greencard_category`, `consulates`, `tags`, `concerns_or_questions_tags`. (`visa_applying_for` may share with `current_*`.)
10. `principal_country_of_chargeability` matches `^[A-Z]{2}$` or is empty.
11. `employer_type`, `severity`, `resolution_status` ∈ their respective enums.
12. `tagging_confidence` ∈ `[0.0, 1.0]`.

A failing document should be quarantined, not indexed.

---

## 2. Summary backfill

Today every posting's `background_summary` is the literal `"<summary_pending_llm>"`. A scheduled job should call Gemini (with a short summarization prompt) on each posting's `.md` and replace the placeholder with a 1–3 sentence factual summary. This dramatically improves snippet quality in Vertex AI Search results.

---

## 3. Vertex AI Search data store

Recommended configuration when provisioning the Vertex AI Search data store:

| Concern | Recommendation |
|---|---|
| Schema source | [JSON-SCHEMA-FIELD-DICTIONARY.md](JSON-SCHEMA-FIELD-DICTIONARY.md) |
| Document ID | `case_id` |
| Primary embedding field | `embedding_text` |
| Facets | The 5 sibling tag fields + `subreddit`, `severity`, `resolution_status`, `principal_country_of_chargeability`, `employer_type`, `derived_topic_cluster` |
| Sortable | `posting_date`, `ingestion_timestamp`, `tagging_confidence` |

---

## 4. Telemetry

Once postings are flowing through the pipeline at scale, monitor:

- **Tag-validation failure rate** — spikes indicate vocabulary drift or tagger regressions.
- **`tagging_confidence` distribution** — falling mean suggests prompt drift.
- **`severity` mix** — sharp shift may indicate the corpus is missing a class of question.
- **Master-tag usage counts** — tags never used in 90 days are candidates for retirement.

---

## 5. Open questions for product

- **Resolution status tracking**: today `resolution_status` defaults to `"open"`. To populate `"answered"` / `"resolved"` we need a downstream signal (forum-reply count, attorney-marked resolution, etc.).
- **Multi-language**: `language` defaults to `"en"`. Some Reddit posts contain non-English fragments. Decide whether to translate before tagging or handle natively.
- **Tag hierarchy in search**: parent/child relationships are documented in the spec but not encoded as data. If Vertex needs them, generate a derived `parent_tags` field.
