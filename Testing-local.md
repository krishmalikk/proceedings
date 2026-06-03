# Testing Local — Website Smoke Test

Quick, copy-pasteable steps to smoke-test the stack locally and confirm the website returns **Reddit-grounded** answers from the `imm-postings-datastore`.

> Full setup/troubleshooting: [Environment Setup](proceedings-obsidian/Environment%20Setup.md). This doc is the short "is it working?" checklist.

**Prerequisites (one-time):** `.venv` built on Python 3.11+, `pip install -r requirements.txt`, `gcloud auth application-default login`, and a populated root `.env` (see Environment Setup §3). Run all commands from the project root: `cd /Users/KW98T6E/Projects/krish/proceedings`.

You'll need **3 terminals** (backend, website, mobile).

---

## 1. Activate the Python environment

```bash
cd /Users/KW98T6E/Projects/krish/proceedings
source .venv/bin/activate
python --version          # must be 3.11+
```

---

## 2. Start the local servers

### 2a. Backend API — Terminal 1 (required; the website proxies to it)

```bash
python -m uvicorn api:app --reload --port 8000
```

Wait for: `API ready: grounding=enabled (engine=imm-postings-search-app, ...)`. Verify in another shell:

```bash
curl http://localhost:8000/api/health
# {"status":"ok","chunks_loaded":1}
```

### 2b. Website (Next.js) — Terminal 2

```bash
cd website

# point the site at the LOCAL backend (one-time; restart needed if changed)
grep -q 'localhost:8000' .env.local 2>/dev/null || \
  printf 'PYTHON_API_URL=http://localhost:8000\n' > .env.local

npm install      # first time only
npm run dev      # serves http://localhost:3000
```

Wait for: `✓ Ready` and `Local: http://localhost:3000`.

### 2c. Mobile (Expo) — Terminal 3 (optional)

```bash
cd proceedings-mobile
npm install      # first time only
EXPO_PUBLIC_API_URL=http://localhost:8000 npx expo start
```

> iOS simulator: `localhost` works. Android emulator: use `http://10.0.2.2:8000`. Physical device: use your Mac's LAN IP + start the backend with `--host 0.0.0.0`.

---

## 3. Open the browser

Go to: **http://localhost:3000/ask**

(Or open http://localhost:3000 and click **Ask** / the chat entry point.)

If a tab was already open before you (re)started the servers, **hard-refresh** it (the chat thread is held in the page's state).

---

## 4. Enter the test question and check the response

In the chat box, type:

```
What was the B1/B2 visa interview experience in Mumbai?
```

### ✅ Expected response (grounded on Reddit content)

- The answer describes a **real applicant experience at the Mumbai consulate** — e.g. documents checked on entry, seating by language section (English/Hindi/Marathi/**Gujarati**), the officer's questions, and an approval/outcome.
- **Source/citation chips appear** referencing Reddit posts — IDs of the form **`reddit-2026-04-11-...`** (e.g. `reddit-2026-04-11-usvisascheduling-1svvi3z`).
- It is **not** the fallback message ("I don't have that information…").

### ❌ If you instead get
- A generic textbook answer with **no Reddit sources**, or sources like `40_0`, `38_0` → the site is hitting the **old Cloud Run** backend, not your local one. Fix `website/.env.local` → `PYTHON_API_URL=http://localhost:8000` and **restart** `npm run dev` (step 2b).
- "I don't have that information…" for everything → check backend health is `chunks_loaded:1` and ADC is valid.

---

## 5. (Optional) One-shot CLI smoke test — no browser

Confirms the whole chain website → local backend → datastore:

```bash
# backend directly
curl -s -X POST http://localhost:8000/api/ask -H "Content-Type: application/json" \
  -d '{"question":"B1/B2 visa interview experience in Mumbai"}' \
  | python -c "import sys,json;d=json.load(sys.stdin);print('fallback:',d['is_fallback']);print('sources:',[s['chunk_id'] for s in d['sources'][:3]])"

# through the website's API route (Next.js must be running)
curl -s -X POST http://localhost:3000/api/ask -H "Content-Type: application/json" \
  -d '{"question":"B1/B2 visa interview experience in Mumbai"}' \
  | python -c "import sys,json;d=json.load(sys.stdin);print('fallback:',d['is_fallback']);print('sources:',[s['chunk_id'] for s in d['sources'][:3]])"
```

**PASS** = both show `fallback: False` and `reddit-*` source ids.

---

## 6. More test questions (all Reddit-covered)

| Question | Expect |
|---|---|
| "What questions did the officer ask at the consulate?" | Reddit interview experiences, `reddit-*` sources |
| "Experiences with H-1B extension under regular processing in Texas" | Reddit H-1B extension posts |
| "What was the wait time at the visa interview?" | Reddit timeline experiences |
| "What is the best pizza topping?" *(negative test)* | Fallback message, 0 sources |

---

## Pass/fail summary

| Check | Pass criteria |
|---|---|
| Backend up | `/api/health` → `{"status":"ok","chunks_loaded":1}` |
| Website wired to local backend | `website/.env.local` = `http://localhost:8000`, dev server restarted |
| Grounded answer | Browser/CLI returns `is_fallback:false` with `reddit-*` sources |
| Negative test | Off-topic question returns the fallback message |

To stop everything: `Ctrl-C` in each terminal (or `lsof -ti tcp:8000 | xargs kill` for the backend).
