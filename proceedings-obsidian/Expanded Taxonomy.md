# Expanded Taxonomy (39 Categories)

**Source:** Imm Categories Excel + Reddit-specific tags
**File:** `labeling_agent/taxonomy.py`

---

## Overview

Expanded from the original 20 immigration-only categories to 39 categories covering visa types, green card categories, process/status tags, and H-1B specific topics popular on Reddit.

---

## Visa Categories (11)

| ID | Name | Description |
|----|------|-------------|
| `b1-b2-visitor` | B-1/B-2 Visitor | Business visitors, tourism, ESTA, VWP |
| `f1-student` | F-1 Student | Academic students, OPT, STEM OPT, CPT, SEVP, DSO |
| `j1-exchange` | J-1 Exchange Visitor | Exchange programs, scholars, au pairs, 2-year rule |
| `h1b-visa` | H-1B Specialty Occupation | Cap, lottery, LCA, prevailing wage, 6-year rule |
| `l1-transfer` | L-1 Intracompany Transferee | L-1A managers, L-1B specialized knowledge |
| `o1-extraordinary` | O-1 Extraordinary Ability | O-1A sciences/business, O-1B arts |
| `e1-e2-treaty` | E-1/E-2 Treaty Trader/Investor | Treaty trade, substantial investment |
| `tn-usmca` | TN/TD USMCA Professional | Canadian/Mexican professionals |
| `k1-fiance` | K-1 Fiance(e) | Fiance of US citizen, 90-day marriage |
| `p-visa-athlete` | P Visa Athletes & Entertainers | P-1/P-2/P-3 |
| `r1-religious` | R-1 Religious Worker | Ministers, religious vocations |

---

## Green Card Categories (9)

| ID | Name | Description |
|----|------|-------------|
| `family-based-immigration` | Family-Based | IR-1/2/5, F1-F4 preference, I-130 |
| `eb1-priority` | EB-1 Priority Workers | Extraordinary ability, professors, multinational managers |
| `eb2-niw` | EB-2 Professionals / NIW | Advanced degree, National Interest Waiver, PERM |
| `eb3-skilled` | EB-3 Skilled Workers | Skilled workers, professionals, other workers |
| `eb4-special` | EB-4 Special Immigrants | Religious workers, SIJ |
| `eb5-investor-visa` | EB-5 Immigrant Investor | $800K-$1.05M investment, regional center, TEA |
| `diversity-visa-lottery` | Diversity Visa Lottery | DV lottery, 55,000 annual limit |
| `special-immigrant-visa` | Special Immigrant Visa (SIV) | Iraqi/Afghan translators |

---

## Process & Status Categories (12)

| ID | Name | Description |
|----|------|-------------|
| `adjustment-of-status` | Adjustment of Status | I-485, concurrent filing, AOS |
| `consular-processing` | Consular Processing | NVC, DS-260, 221(g), visa stamping |
| `visa-fees-filing` | Visa Fees & Filing | Filing fees, fee waivers, I-907 |
| `work-authorization` | Work Authorization / EAD | I-765, EAD categories, H4 EAD |
| `deportation-defense` | Deportation Defense | Removal proceedings, NTA, bond hearings |
| `asylum-refugees` | Asylum & Refugees | I-589, credible fear, CAT |
| `naturalization-citizenship` | Naturalization & Citizenship | N-400, civics test, oath |
| `daca` | DACA | Renewals, advance parole, work permits |
| `tps` | Temporary Protected Status | Designation, re-registration, EAD |
| `humanitarian-parole` | Humanitarian Parole | Parole-in-place, CHNV |
| `immigration-court` | Immigration Court / EOIR | BIA appeals, motions to reopen |
| `travel-documents` | Travel Documents | Advance parole, re-entry permits, AVR |

---

## H-1B Specific Tags (7)

*Added for high-volume Reddit topics:*

| ID | Name | Description |
|----|------|-------------|
| `h1b-lottery` | H-1B Lottery & Registration | Cap registration, selection rule, cap-gap |
| `h1b-transfer` | H-1B Transfer / Portability | Employer transfer, portability rule |
| `premium-processing` | Premium Processing | I-907, 15 business day adjudication |
| `rfe-response` | RFE / NOID Response | Request for Evidence, NOID, rebuttals |
| `grace-period` | Grace Period & Status Gap | 60-day grace period, maintaining status |
| `change-of-status` | Change of Status (COS) | F-1→H-1B, L-1→H-1B, B-1→F-1 |
| `layoff-immigration` | Layoff & Immigration Impact | Job loss on visa, bench policy, new sponsor |

---

## Granular Tags (100+)

The full tag list from the Imm Categories Excel is stored in `taxonomy.py` as `GRANULAR_TAGS` for future secondary metadata use. Not used in primary classification.

Examples: `221g`, `cap-gap`, `PERM`, `PWD`, `LCA`, `NOID`, `CSPA`, `NIW`, `EAD`, `CPT`, `OPT`, `stem-opt`, `visa-stamping`, `AVR`, `FBAR`, `fdns-visit`, `h1b-6-year-rule`, `h4-work-auth`, etc.

---

## Comparison: Old vs New Taxonomy

| Aspect | Old (20 labels) | New (39 labels) |
|--------|----------------|-----------------|
| Visa types | Combined into broad categories | 11 specific visa types (B, F, J, H, L, O, E, TN, K, P, R) |
| Green cards | 1 label (family + employment) | 9 specific categories (IR, F1-F4, EB-1 through EB-5, DV, SIV) |
| H-1B topics | 1 label for everything | 7 specific tags (lottery, transfer, premium, RFE, grace, COS, layoff) |
| Process tags | 8 labels | 12 labels (added premium processing, RFE, grace period, COS, layoff) |
| Source | Internal | Imm Categories Excel + Reddit topic analysis |
