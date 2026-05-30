# Project — US Immigration Tag Taxonomy

A standardized tag vocabulary for labeling candidate postings and issues related to the US Immigration system.

## Overview

These tags help candidates and the platform:
- Find similar issues reported by other candidates
- Find resolutions where one was previously documented
- Power a forum / support system
- Bring in professionals (attorneys etc.) who can answer specific tagged questions
- Surface news / policy updates relevant to a candidate's situation

## Tag taxonomy

The vocabulary is split into 10 categories (sections 1.1–1.10), with one master CSV per category under [tags-cleaned/](tags-cleaned/):

| Section | File | What it tags |
|---|---|---|
| 1.1 | [1.1-non-immigration-visas.csv](tags-cleaned/1.1-non-immigration-visas.csv) | Non-immigrant visa codes |
| 1.2 | [1.2-greencard-categories.csv](tags-cleaned/1.2-greencard-categories.csv) | Green card categories |
| 1.3 | [1.3-abbreviations.csv](tags-cleaned/1.3-abbreviations.csv) | Immigration abbreviations |
| 1.4 | [1.4-consulates.csv](tags-cleaned/1.4-consulates.csv) | Country / city consulate codes |
| 1.5 | [1.5-forms.csv](tags-cleaned/1.5-forms.csv) | USCIS / State Department forms |
| 1.6 | [1.6-visa-form-actions.csv](tags-cleaned/1.6-visa-form-actions.csv) | Visa- and form-specific actions |
| 1.7 | [1.7-key-stages.csv](tags-cleaned/1.7-key-stages.csv) | Process stage attribute names |
| 1.8 | [1.8-key-dates.csv](tags-cleaned/1.8-key-dates.csv) | Date attribute names |
| 1.9 | [1.9-outcomes.csv](tags-cleaned/1.9-outcomes.csv) | Process outcomes |
| 1.10 | [1.10-common-misc.csv](tags-cleaned/1.10-common-misc.csv) | Layman / topical concerns |

Naming conventions, category rules, and exceptions are documented in [us_immigration_tag_specification.md](us_immigration_tag_specification.md).

## Maintaining the taxonomy

- To add a tag: append a row to the relevant CSV in `tags-cleaned/`.
- To revise category rules: edit [us_immigration_tag_specification.md](us_immigration_tag_specification.md).
- Tag changes should be reflected in the LLM tagger prompt cache (see [LLM-EXTRACTION-PROMPT.md](LLM-EXTRACTION-PROMPT.md)).
