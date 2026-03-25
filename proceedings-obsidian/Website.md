# Website

**Location:** `/website/`
**Stack:** Next.js 14, React 18, Tailwind CSS, TypeScript
**Deployed:** Vercel (auto-deploys on push to `main`)

---

## Purpose

Marketing site + public Q&A interface for immigration questions. Connects to the FastAPI backend on Cloud Run via API routes.

---

## Pages

| Route | File | Description |
|-------|------|-------------|
| `/` | `src/app/page.tsx` | Landing / home page |
| `/ask` | `src/app/ask/page.tsx` | **Public Q&A interface** — ask questions, see answers with sources, browse recent Q&A |
| `/how-it-works` | `src/app/how-it-works/page.tsx` | How the service works |
| `/pricing` | `src/app/pricing/page.tsx` | Pricing information |
| `/safety-privacy` | `src/app/safety-privacy/page.tsx` | Safety and privacy details |
| `/contact` | `src/app/contact/page.tsx` | Contact form |

---

## API Routes (proxy to Python backend)

| Route | Method | Proxies To |
|-------|--------|-----------|
| `/api/ask` | POST | `$PYTHON_API_URL/api/ask` |
| `/api/qa` | GET | `$PYTHON_API_URL/api/qa` |
| `/api/qa/[id]/feedback` | POST | `$PYTHON_API_URL/api/qa/{id}/feedback` |

---

## Components

| Component | Description |
|-----------|-------------|
| `Header.tsx` | Site header / navigation (includes "Ask" link) |
| `Footer.tsx` | Site footer (includes "Ask a Question" link) |
| `DisclaimerBanner.tsx` | Legal disclaimer banner |
| `AskForm.tsx` | Q&A input form with loading state, answer display, source citations, feedback |
| `QAList.tsx` | Expandable list of recent Q&A pairs with pagination |
| `SourceCitation.tsx` | Pill component showing source name |

---

## Commands

```bash
cd website/
npm install
npm run dev      # Local dev server
npm run build    # Production build
npm run lint     # ESLint
```

---

## Dependencies

| Package | Version |
|---------|---------|
| `next` | 14.1.0 |
| `react` | ^18.2.0 |
| `lucide-react` | ^0.312.0 |
| `tailwindcss` | ^3.4.1 |
| `typescript` | ^5.3.3 |
