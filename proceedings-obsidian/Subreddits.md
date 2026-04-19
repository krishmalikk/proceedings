# Subreddits Being Crawled

**Total:** 52 subreddits
**File:** `subreddits.txt`

---

## Core Immigration (6)

| Subreddit | Focus | Expected Volume |
|-----------|-------|-----------------|
| r/h1b | H-1B visa discussions, lottery, transfers, stamping | Very high |
| r/immigration | General US immigration questions and experiences | Very high |
| r/USCIS | USCIS processing times, case status, experiences | Very high |
| r/greencard | Green card processes, timelines, interviews | High |
| r/f1visa | F-1 student visa, OPT, STEM OPT, CPT | High |
| r/askimmigration | Immigration Q&A from verified attorneys | High |

---

## Work Visas (4)

| Subreddit | Focus |
|-----------|-------|
| r/h1bvisas | H-1B specific discussions |
| r/workvisas | All work visa types |
| r/h1btransfer | H-1B employer transfers |
| r/L1visa | L-1 intracompany transferee |

---

## Student / Academic (5)

| Subreddit | Focus |
|-----------|-------|
| r/internationalstudents | International student life and visa issues |
| r/StudyInTheUS | Studying in the US, university admissions |
| r/OPT | Optional Practical Training discussions |
| r/STEMOPT | STEM OPT extension specific |
| r/f1students | F-1 student experiences |

---

## Family / Marriage Immigration (4)

| Subreddit | Focus |
|-----------|-------|
| r/K1Visa | K-1 fiance visa process and timeline |
| r/immigrationmarriage | Marriage-based immigration |
| r/USimmigration | General US immigration |
| r/CR1visa | CR-1 spouse visa |

---

## Employment-Based Green Cards (4)

| Subreddit | Focus |
|-----------|-------|
| r/eb1 | EB-1 extraordinary ability / professors |
| r/eb2niw | EB-2 National Interest Waiver |
| r/EB5 | EB-5 investor visa program |
| r/PERM | PERM labor certification process |

---

## Asylum / Humanitarian (4)

| Subreddit | Focus |
|-----------|-------|
| r/asylum | Asylum application process |
| r/refugees | Refugee resettlement and status |
| r/TPS | Temporary Protected Status |
| r/DACA | Deferred Action for Childhood Arrivals |

---

## Country-Specific US Immigration (4)

| Subreddit | Focus |
|-----------|-------|
| r/IndianImmigration | Indian nationals' immigration issues (backlog, EB wait times) |
| r/ChineseImmigration | Chinese nationals' immigration topics |
| r/immigrationIndia | India-specific immigration discussions |
| r/h1bindians | H-1B issues specific to Indian applicants |

---

## Consular Processing & Visa Stamping (4)

| Subreddit | Focus |
|-----------|-------|
| r/visastamping | Visa stamping experiences at consulates |
| r/USvisa | US visa applications and interviews |
| r/VisaInterview | Visa interview preparation and experiences |
| r/dropbox | Dropbox / interview waiver experiences |

---

## Immigration Law / Legal (4)

| Subreddit | Focus |
|-----------|-------|
| r/immigrationlaw | Immigration law discussions |
| r/immigrationattorney | Finding and working with immigration lawyers |
| r/legaladvice | General legal advice (immigration threads) |
| r/legaladviceofftopic | Legal discussions (immigration relevant) |

---

## General Expat / Relocation (4)

| Subreddit | Focus |
|-----------|-------|
| r/iwantout | People wanting to leave/enter countries |
| r/expats | Expat life and relocation |
| r/digitalnomad | Digital nomad visa and work topics |
| r/AmerExit | Americans leaving / immigrants entering US |

---

## Processing Times & Experiences (4)

| Subreddit | Focus |
|-----------|-------|
| r/immigrationtimelines | Processing time tracking |
| r/casetracker | USCIS case tracking |
| r/USCIStimelines | USCIS processing timelines |
| r/i485 | I-485 adjustment of status specific |

---

## Specific Topics (5)

| Subreddit | Focus |
|-----------|-------|
| r/citizenshiptest | US citizenship test preparation |
| r/naturalization | Naturalization process |
| r/deportation | Deportation defense and experiences |
| r/EAD | Employment Authorization Document |
| r/travelban | Travel ban and entry restrictions |

---

## Label Coverage

Each subreddit maps to one or more taxonomy labels:

| Subreddit Group | Primary Labels |
|----------------|----------------|
| Core immigration | general-immigration-info, multiple |
| Work visas | h1b-visa, l1-transfer, h1b-transfer, h1b-lottery |
| Student | f1-student, change-of-status |
| Family/marriage | family-based-immigration, k1-fiance |
| Employment GC | eb1-priority, eb2-niw, eb3-skilled, eb5-investor-visa |
| Asylum | asylum-refugees, humanitarian-parole |
| Consular | consular-processing, travel-documents |
| Processing | adjustment-of-status, premium-processing, rfe-response |
| Specific | naturalization-citizenship, daca, tps, work-authorization, deportation-defense |

---

## Adding New Subreddits

Edit `subreddits.txt` — one subreddit per line, `#` for comments:

```
# New subreddit to add
newsubreddit
```

Then run:
```bash
./venv/bin/python3 reddit_ingest.py --subreddits-file subreddits.txt --checkpoint state.json --resume
```

Only new (uncompleted) subreddits will be processed.
