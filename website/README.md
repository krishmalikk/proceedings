# Proceedings Website

A professional website for Proceedings, a consulting agency that provides intake and information assistant services for law firms.

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **Fonts:** Inter (sans-serif), Source Serif 4 (serif)

## Design System

**Color Palette:**
- **Cream** (`cream-*`): Light beige/cream tones for backgrounds
- **Ink** (`ink-*`): Dark blacks and grays for text and accents

**Typography:**
- Headlines: Source Serif 4 (elegant serif)
- Body: Inter (clean sans-serif)

**Components:**
- Pill-style navigation and buttons
- Rounded cards with subtle shadows
- Overline labels with accent lines
- Modern, airy layouts with generous whitespace

## Getting Started

### Prerequisites

- Node.js 18.17 or later
- npm, yarn, or pnpm

### Installation

1. Navigate to the website directory:

```bash
cd website
```

2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
npm run build
npm start
```

## Project Structure

```
website/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout with header/footer
│   │   ├── page.tsx                # Home page
│   │   ├── globals.css             # Global styles + design system
│   │   ├── how-it-works/
│   │   │   └── page.tsx
│   │   ├── safety-privacy/
│   │   │   └── page.tsx
│   │   ├── pricing/
│   │   │   └── page.tsx
│   │   └── contact/
│   │       └── page.tsx
│   └── components/
│       ├── Header.tsx              # Navigation with pill-style links
│       ├── Footer.tsx              # Dark footer with large text
│       └── DisclaimerBanner.tsx    # Top disclaimer banner
├── public/                         # Static assets
├── tailwind.config.ts              # Color palette + custom utilities
├── tsconfig.json
└── package.json
```

## Customization

### Branding

- Logo and name are in `Header.tsx` and `Footer.tsx`
- Colors are defined in `tailwind.config.ts` under `theme.extend.colors`
- Update the email in `Footer.tsx` (currently `hello@proceedings.io`)

### Calendly Integration

Replace the placeholder Calendly link in `src/app/page.tsx`:

```tsx
<a href="https://calendly.com/your-actual-link" ...>
```

### Contact Form

The contact form in `src/app/contact/page.tsx` requires backend integration. Options:

- Formspree
- Netlify Forms
- Custom API route

### OpenGraph Image

Add an `og-image.jpg` (1200x630px) to the `public/` directory.

## Pages

| Page | Path | Description |
|------|------|-------------|
| Home | `/` | Hero with chat preview, benefits, guardrails, demo, testimonials, FAQ |
| How It Works | `/how-it-works` | Process steps, integrations, timeline |
| Safety & Privacy | `/safety-privacy` | Security measures, guardrails, PII handling |
| Pricing | `/pricing` | Pilot ($750) and ongoing service ($300-500/mo) |
| Contact | `/contact` | Contact form and information |

## Deployment

This site can be deployed to:

- **Vercel** (recommended for Next.js)
- **Netlify**
- **Any Node.js hosting provider**

For Vercel:

```bash
npm install -g vercel
vercel
```
