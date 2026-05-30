# Tagged Postings Corpus

A corpus of 72 candidate postings (sourced from Reddit) tagged against the master tag list. The corpus powers similarity search, forum threading, and topic discovery.

## Layout

Each posting lives in [postings-examples/case-N/](../postings-examples/) with two files:

| File | Purpose |
|---|---|
| `caseN.md` | Raw posting content (input to LLMs and embedding models) |
| `caseN.json` | Canonical metadata (fields documented in [JSON-SCHEMA-FIELD-DICTIONARY.md](JSON-SCHEMA-FIELD-DICTIONARY.md)) |

## How tags are assigned

Tags are drawn exclusively from the 10 master CSVs in [tags-cleaned/](../tags-cleaned/). The JSON splits them into 5 sibling fields with strict no-duplicate semantics:

| Field | Vocabulary | Holds |
|---|---|---|
| `current_visa_or_greencard_category` | sections 1.1 + 1.2 | The candidate's PRESENT visa/GC status |
| `visa_applying_for` | sections 1.1 + 1.2 | The candidate's INTENDED next status (may equal current for renewals) |
| `consulates` | section 1.4 | Country / city codes referenced |
| `tags` | sections 1.3/1.5/1.6/1.9/1.10 | Background and contextual tags |
| `concerns_or_questions_tags` | sections 1.3/1.5/1.6/1.9/1.10 | Tags that name the user's active question |

See [JSON-SCHEMA-FIELD-DICTIONARY.md](JSON-SCHEMA-FIELD-DICTIONARY.md) for full per-field rules and the validation contract.

## Adding new postings

1. Create `postings-examples/case-N/` for the next available `N`.
2. Save the raw post as `caseN.md`.
3. Run the real-time tagger ([LLM-EXTRACTION-PROMPT.md](LLM-EXTRACTION-PROMPT.md)) to generate `caseN.json`.
4. Validate against [JSON-SCHEMA-FIELD-DICTIONARY.md §3](JSON-SCHEMA-FIELD-DICTIONARY.md) before indexing in Vertex AI Search.
