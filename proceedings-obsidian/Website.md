# Website

**Location:** `/website/`
**Stack:** Next.js 14, React 18, Tailwind CSS, TypeScript

---

## Purpose

Marketing site for the legal intake consulting service. Separate from the RAG pipeline.

---

## Pages

| Route | File | Description |
|-------|------|-------------|
| `/` | `src/app/page.tsx` | Landing / home page |
| `/how-it-works` | `src/app/how-it-works/page.tsx` | How the service works |
| `/pricing` | `src/app/pricing/page.tsx` | Pricing information |
| `/safety-privacy` | `src/app/safety-privacy/page.tsx` | Safety and privacy details |
| `/contact` | `src/app/contact/page.tsx` | Contact form |

---

## Shared Components

| Component | Description |
|-----------|-------------|
| `Header.tsx` | Site header / navigation |
| `Footer.tsx` | Site footer |
| `DisclaimerBanner.tsx` | Legal disclaimer banner |

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
