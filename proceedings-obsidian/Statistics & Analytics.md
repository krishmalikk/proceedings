# Statistics & Analytics

**Last updated:** 2026-04-12

---

## Q&A Performance

| Metric | Value |
|--------|-------|
| Total Q&A pairs | 13 |
| Successful answers | 11 |
| Fallback answers | 2 |
| **Fallback rate** | **15.4%** |
| Helpful votes | 0 |
| Not helpful votes | 0 |
| No feedback | 13 |

*Fallback rate was 54.5% before guardrail fixes. Now consistently under 20%.*

---

## URL Registry

| Metric | Value |
|--------|-------|
| Total URLs registered | 231 |
| Successfully crawled | 179 (77.5%) |
| Failed (DNS/JS/404) | 50 (21.6%) |
| Skipped (low content) | 2 (0.9%) |

### By Source Type

| Type | Count |
|------|-------|
| Law firm / resource sites | 102 |
| Government | 98 |
| Organization | 31 |

### By Domain (Top 20)

| Domain | URLs |
|--------|------|
| uscis.gov | 59 |
| nolo.com | 30 |
| law.cornell.edu | 27 |
| visaguide.world | 13 |
| justia.com | 13 |
| findlaw.com | 12 |
| travel.state.gov | 9 |
| dol.gov | 7 |
| boundless.com | 7 |
| alllaw.com | 6 |
| citizenpath.com | 6 |
| wegreened.com | 5 |
| uscourts.gov | 4 |
| irs.gov | 4 |
| immigrationdirect.com | 3 |
| eeoc.gov | 3 |
| ftc.gov | 3 |
| murthy.com | 2 |
| visaplace.com | 2 |
| immigrationhelp.org | 2 |

---

## GCS Bucket (`law-firm-knowledge-base`)

| Metric | Value |
|--------|-------|
| Crawled files (`/crawled/`) | 183 |
| Labeled files (`/labeled/`) | 183 |
| All files labeled | Yes (100%) |

---

## Vector Search Index

| Metric | Value |
|--------|-------|
| **Total chunks indexed** | **725** |
| Unique source files | 159 |
| Embedding model | text-embedding-005 (768-dim) |
| Index algorithm | Tree-AH, DOT_PRODUCT |
| Index ID | 8958040089863127040 |
| Endpoint ID | 245914571645124608 |
| Deployed index | legal_intake_deployed_v2 |

---

## Label Distribution (20 Immigration Categories)

| Label | Chunks | % of Total |
|-------|--------|-----------|
| general-immigration-info | 322 | 44.4% |
| visa-fees-filing | 195 | 26.9% |
| consular-processing | 148 | 20.4% |
| family-based-immigration | 134 | 18.5% |
| employment-green-cards | 134 | 18.5% |
| adjustment-of-status | 123 | 17.0% |
| temporary-work-visas | 119 | 16.4% |
| work-authorization | 117 | 16.1% |
| h1b-visa | 77 | 10.6% |
| asylum-refugees | 65 | 9.0% |
| diversity-visa-lottery | 48 | 6.6% |
| naturalization-citizenship | 40 | 5.5% |
| deportation-defense | 38 | 5.2% |
| humanitarian-parole | 37 | 5.1% |
| tps | 30 | 4.1% |
| student-visas | 27 | 3.7% |
| eb5-investor-visa | 26 | 3.6% |
| daca | 20 | 2.8% |
| immigration-court | 19 | 2.6% |
| travel-documents | 15 | 2.1% |

*Note: Chunks can have multiple labels (multi-label classification), so percentages total >100%.*

---

## Top Sources by Chunk Count

| Source | Chunks |
|--------|--------|
| DOL Foreign Labor | 30 |
| State Dept Visa Fees | 29 |
| USCIS TPS | 24 |
| USCIS All Forms | 20 |
| USCIS Humanitarian Parole | 19 |
| USCIS DACA | 16 |
| USCIS I-765 | 15 |
| ImmigrationDirect H-1B Guide | 13 |
| USCIS H-1B | 13 |
| FindLaw Immigration | 13 |

---

## Infrastructure

| Service | Status | Details |
|---------|--------|---------|
| Cloud Run API | Live (rev 7) | `https://proceedings-api-971592620882.us-central1.run.app` |
| Vercel Website | Live | Auto-deploys from `main` branch |
| Agent Engine | Live | `reasoningEngines/1295286819927097344` (20 categories) |
| Vector Search | Live | 725 chunks, 768-dim embeddings |
| Firestore | Active | `qa_pairs` collection |
| GCS Bucket | Active | `law-firm-knowledge-base` |

---

## Quality Improvements Timeline

| Date | Change | Impact |
|------|--------|--------|
| Mar 24 | Initial deployment | 21 chunks, 7 pages |
| Mar 25 | Expanded to 45 pages | 328 chunks |
| Mar 25 | Fixed Gemini model (Vertex AI) | Answers work consistently |
| Mar 30 | Agent Engine + 20 immigration labels | Better categorization |
| Apr 6 | Firecrawl restored, 177 pages | 719 chunks |
| Apr 6 | Loosened guardrails | Fallback rate 54.5% → ~15% |
| Apr 6 | Junk chunk filter | 70-80 garbage chunks removed |
| Apr 6 | Improved fallback detection | Catches paraphrased refusals |
| Apr 12 | Immigration-only taxonomy | 20 focused categories |
| Apr 12 | Firecrawl retry (44 recovered) | 725 chunks, 181 pages |
| Apr 12 | EB-5 knowledge gap fixed | 10/10 test questions answered |

---

## How to Refresh These Stats

```bash
./venv/bin/python3 monitor_qa.py           # Q&A performance
curl localhost:8000/api/health              # Chunk count
curl localhost:8000/api/qa/stats            # Full stats via API
```
