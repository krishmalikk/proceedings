# Real-Time Tagger & Vertex AI Search

The real-time tagger converts raw candidate postings into canonical JSON metadata for indexing in Vertex AI Search.

## Pipeline

```
raw_text (.md)
   │
   ▼
[Tagger LLM]   ── system prompt: LLM-EXTRACTION-PROMPT.md
   │             ── vocabulary: tags-cleaned/*.csv
   ▼
JSON metadata (canonical schema)
   │
   ▼
[Validator]    ── vocabulary + dedup rules (JSON-SCHEMA-FIELD-DICTIONARY.md §3)
   │
   ▼
Vertex AI Search index
```

## Components

| Component | File / Path |
|---|---|
| Master tag vocabularies | [tags-cleaned/](../tags-cleaned/) (10 CSVs) |
| Canonical JSON schema | [JSON-SCHEMA-FIELD-DICTIONARY.md](JSON-SCHEMA-FIELD-DICTIONARY.md) |
| Tagger system prompt | [LLM-EXTRACTION-PROMPT.md](LLM-EXTRACTION-PROMPT.md) |
| Existing corpus | [postings-examples/](../postings-examples/) (72 cases) |
| Forward-looking improvements | [TAGGING-EVALUATION.md](TAGGING-EVALUATION.md) |

## Vertex AI Search integration

| Concern | Recommendation |
|---|---|
| Document ID | `case_id` |
| Primary embedding field | `embedding_text` |
| Facet fields | `current_visa_or_greencard_category`, `visa_applying_for`, `consulates`, `tags`, `concerns_or_questions_tags`, `subreddit`, `severity`, `resolution_status`, `principal_country_of_chargeability`, `employer_type`, `derived_topic_cluster` |
| Sortable fields | `posting_date`, `ingestion_timestamp`, `last_updated_timestamp`, `tagging_confidence` |
| Date-range filters | `key_dates.*` (ISO-8601 enables range queries) |

## Operational notes

- **Model**: Gemini Flash for bulk re-tagging, Gemini Pro for ambiguous cases.
- **Prompt caching**: Cache the master tag CSVs in the prompt (~30k tokens); refresh on tag-list edit.
- **Validation gate**: Block ingestion on validator failure; quarantine until manually resolved.
- **Telemetry**: Track `tagging_confidence` distribution and `severity` mix to detect drift.
