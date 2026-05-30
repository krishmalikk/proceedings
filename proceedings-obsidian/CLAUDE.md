# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a US Immigration & Visa Tagging System — a data taxonomy project for standardizing immigration-related content tagging plus a corpus of tagged candidate postings. No executable code.

## Project Structure

| Path | Contents |
|---|---|
| `us_immigration_tag_specification.md` | Authoritative specification of tag categories and naming rules |
| `tags-cleaned/` | The 10 master tag-list CSVs (one per category, sections 1.1–1.10) |
| `postings-examples/` | 72 candidate postings, each in `case-N/` with `caseN.md` (raw) + `caseN.json` (canonical metadata) |
| `JSON-SCHEMA-FIELD-DICTIONARY.md` | Field-by-field rules for the posting metadata JSON |
| `LLM-EXTRACTION-PROMPT.md` | Production system prompt for the real-time tagger (Vertex AI / Gemini) |

## Master tag lists (in `tags-cleaned/`)

| File | Tag category |
|---|---|
| `1.1-non-immigration-visas.csv` | Non-immigrant visa codes (1.1) |
| `1.2-greencard-categories.csv` | Green card categories (1.2) |
| `1.3-abbreviations.csv` | Common immigration abbreviations (1.3) |
| `1.4-consulates.csv` | U.S. embassy/consulate country and city codes (1.4) |
| `1.5-forms.csv` | USCIS / State Department forms (1.5) |
| `1.6-visa-form-actions.csv` | Visa- and form-specific actions / attributes (1.6) |
| `1.7-key-stages.csv` | Key-value stage attribute names (1.7) |
| `1.8-key-dates.csv` | Key-value date attribute names (1.8) |
| `1.9-outcomes.csv` | Process / form outcomes (1.9) |
| `1.10-common-misc.csv` | Layman / topical immigration concerns (1.10) |

## Working with this project

This is a pure data/specification project — no build system, tests, or linting. Modifications involve editing master tag CSVs in `tags-cleaned/`, the specification document, or the per-posting JSON files under `postings-examples/`.
