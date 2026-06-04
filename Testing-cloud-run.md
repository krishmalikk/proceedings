# Manual Testing — Cloud Run Backend

How to manually validate the **deployed** backend (`immiguide-api` on Cloud Run). For local testing see [Testing-local.md](Testing-local.md); for the automated version of this, see [tests/test_cloud_run.py](tests/test_cloud_run.py).

```bash
BASE=https://immiguide-api-971592620882.us-central1.run.app
```

**Prerequisites:** just `curl` (the service is public — no auth/token needed). Pipe to `python -m json.tool` or `jq` for readable output.

> ⚠️ **Rate limit:** the service allows **10 requests / 60s per IP**. If you see HTTP `429 {"detail":"Rate limit exceeded…"}`, wait ~60s and continue.
> 🥶 **Cold start:** the first request after idle can take a few seconds (Cloud Run scales from zero). Use a generous `-m 60` timeout.

---

## 1. Health

```bash
curl -s $BASE/api/health
```
**Expect:** `{"status":"ok","chunks_loaded":1}`
(`chunks_loaded:1` = new datastore code. If it shows `807`, an **old** revision is serving.)

---

## 2. Ask — Reddit-grounded answer

```bash
curl -s -m 60 -X POST $BASE/api/ask -H 'Content-Type: application/json' \
  -d '{"question":"B1/B2 visa interview experience in Mumbai"}' | python3 -m json.tool
```
**Expect:**
- `is_fallback: false`
- a real answer describing a Mumbai consulate experience
- `sources[].chunk_id` starting with **`reddit-...`** (e.g. `reddit-2026-04-11-usvisascheduling-1svvi3z`)

❌ If sources look like `40_0`, `38_0` → an old revision is live (old Vector Search code).

---

## 3. Chat — intent routing

**Search intent → ranked cards:**
```bash
curl -s -m 60 -X POST $BASE/api/chat -H 'Content-Type: application/json' \
  -d '{"question":"Show me B1/B2 experiences in Mumbai"}' | python3 -m json.tool
```
**Expect:** `mode:"search"`, a `results[]` array of posting cards, and `suggested_filters[]`.

**Ask intent → synthesized answer:**
```bash
curl -s -m 60 -X POST $BASE/api/chat -H 'Content-Type: application/json' \
  -d '{"question":"What is the H-1B 60-day grace period?"}' | python3 -m json.tool
```
**Expect:** `mode:"answer"`, an `answer` string, `sources[]`.

**With precision (strictness):**
```bash
curl -s -m 60 -X POST $BASE/api/chat -H 'Content-Type: application/json' \
  -d '{"question":"Show me B1/B2 experiences in Mumbai","strictness":"strict"}' \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print('cards:',len(d['results']),'filters:',d['applied_filters'])"
```
**Expect:** far fewer cards than the default (strict = exact `consulate=BOM`).

---

## 4. Search — facets, filters, pagination, precision

**Basic search (cards + dynamic filters):**
```bash
curl -s "$BASE/api/search?q=H-1B%20experiences&strictness=broad" \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print('total:',d['total']);[print(' ',g['label'],[v['label']+'('+str(v['count'])+')' for v in g['values'][:4]]) for g in d['suggested_filters']]"
```
**Expect:** a `total`, and `suggested_filters` groups (Concern / Topic / Outcome / Consulate) with counts.

**Exact consulate filter (precision):**
```bash
curl -s "$BASE/api/search?q=B1/B2%20interview&consulate=BOM" \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print('total:',d['total'],'all_BOM:',all('BOM' in r['consulates'] for r in d['results']))"
```
**Expect:** every result has `BOM` (Mumbai) — `all_BOM: True`.

**Select a context filter chip (exact narrowing):**
```bash
curl -s "$BASE/api/search?q=H-1B%20experiences&facet=concerns_or_questions_tags:h1b-rfe" \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print('total:',d['total'])"
```
**Expect:** a small number (e.g. 3) vs ~71 unfiltered — only RFE-tagged postings.

**Pagination:**
```bash
TOK=$(curl -s "$BASE/api/search?q=visa%20experience&page_size=3" | python3 -c "import sys,json;print(json.load(sys.stdin)['next_page_token'])")
curl -s "$BASE/api/search?q=visa%20experience&page_size=3&page_token=$TOK" \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print('page2:',[r['case_id'][-8:] for r in d['results']])"
```
**Expect:** page 2 returns different `case_id`s than page 1.

---

## 5. Posting detail

```bash
curl -s "$BASE/api/postings/reddit-2026-04-11-USVisas-1socshn" \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print('title:',d['title']);print('body chars:',len(d['body']));print('url:',d['url'])"
```
**Expect:** the title, the full Markdown `body` (~3000+ chars), and the Reddit `url`.

**404 check:**
```bash
curl -s -o /dev/null -w "%{http_code}\n" "$BASE/api/postings/does-not-exist"
```
**Expect:** `404`.

---

## 6. Context-aware filters (situation-driven)

```bash
curl -s -m 60 -X POST $BASE/api/chat -H 'Content-Type: application/json' \
  -d '{"question":"I am on H-1B applying for extension with a question on RFE"}' \
  | python3 -c "import sys,json;d=json.load(sys.stdin);[print(g['label']+':',[v['label']+'('+str(v['count'])+')' for v in g['values'][:5]]) for g in d['suggested_filters']]"
```
**Expect:** the **Concern** group leads with H-1B-family tags — `H1B RFE`, `H1B Extension`, `H1B Denial`, `H1B Transfer` — each with a count (driven by the tag hierarchy + live data).

---

## 7. Pass/fail summary

| Check | Pass criteria |
|---|---|
| Health | `chunks_loaded:1` |
| Grounding | `/api/ask` → `is_fallback:false`, `reddit-*` sources |
| Chat routing | "Show me…" → `mode:search` cards; "What is…" → `mode:answer` |
| Filter precision | `consulate=BOM` → all results in BOM |
| Facet selection | `facet=…:h1b-rfe` narrows to RFE-tagged only |
| Pagination | page 2 ≠ page 1 |
| Detail / 404 | body returned; bad id → 404 |
| Context filters | H-1B query surfaces `h1b-*` concerns with counts |

---

## 8. Hosted front-ends

The deployed **website (Vercel)** and **mobile app** default to this Cloud Run URL, so testing them validates the same backend:
- **Website:** open the deployed site → **Ask** page → ask *"Show me B1/B2 experiences in Mumbai"* → expect ranked cards with refinement chips; ask *"What is the H-1B grace period?"* → expect a Markdown answer.
- **Mobile:** the app uses `EXPO_PUBLIC_API_URL` (defaults to this Cloud Run URL) — the chat should return the same grounded answers/cards.

> For **local** front-end testing against a **local** backend, point `website/.env.local` → `http://localhost:8000` (see [Testing-local.md](Testing-local.md)).

---

## 9. Automated equivalent

```bash
.venv/bin/python tests/test_cloud_run.py            # default URL
CLOUD_RUN_URL=https://your-url .venv/bin/python tests/test_cloud_run.py
```
Runs all the above as 13 checks with retry-on-429. **Expect:** `13/13 checks passed`.

---

## 10. Troubleshooting / ops

```bash
# which revision is serving + its env
gcloud run services describe immiguide-api --region=us-central1 \
  --format="value(status.latestReadyRevisionName)"

# recent logs (look for tracebacks / 500s)
gcloud run services logs read immiguide-api --region=us-central1 --limit=50
```
- **All answers are fallback / 503** → check the SA can reach Discovery Engine, and the service env has `GCP_PROJECT_ID` + `GCP_VERTEX_SEARCH_APP_ID`.
- **`chunks_loaded:807` / `40_0` sources** → an old revision is live; redeploy `main`.
- **Intermittent 500 then OK** → transient Discovery Engine blip; the backend already retries, and a persistent failure returns a clean 503.
