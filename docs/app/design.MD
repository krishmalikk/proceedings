# Design System Specification: Project Quantum

This document defines the unified visual identity and design tokens for Project Quantum. The Stitch AI design agent must apply these tokens consistently across all generated Web and Mobile layouts.

---

## 1. Brand Identity & Vibe
* **Core Aesthetic:** Clean, high-frequency, dark-mode data platform.
* **Tone:** Professional, minimalist, highly glanceable, geometric.
* **Target Audience:** Technical developers and data engineers monitoring cloud resources on the go or at a multi-monitor workstation.

---

## 2. Color Palette (Tokens)
The AI should use these absolute hex values for semantic elements. Do not introduce raw unmapped colors.

### Base Themes
* `color-bg-main`: `#0F172A` (Deep Slate Blue / Midnight)
* `color-bg-surface`: `#1E293B` (Dark Slate Gray for cards and panels)
* `color-border`: `#334155` (Subtle boundary lines)

### Brand Accent & Semantics
* `color-brand-primary`: `#38BDF8` (Vibrant Electric Sky Blue)
* `color-brand-secondary`: `#818CF8` (Soft Indigo)
* `color-status-success`: `#34D399` (Mint Green for positive trends/active status)
* `color-status-error`: `#F87171` (Coral Red for hot spotting or system alerts)

### Typography Colors
* `color-text-primary`: `#F8FAFC` (Pure white-silver for headers)
* `color-text-secondary`: `#94A3B8` (Muted gray for labels, subtitles, and secondary data)

---

## 3. Typography & Scale
* **Font Family:** `Inter, system-ui, sans-serif` (Universal, geometric sans-serif)

### Scaling Matrix
Stitch will automatically choose the appropriate token based on target viewports:

| Token Name | Weight | Web Target (Desktop) | Mobile Target (iOS/Android) |
| :--- | :--- | :--- | :--- |
| `font-size-h1` | 700 (Bold) | `32px` | `24px` |
| `font-size-h2` | 600 (Semi-Bold) | `24px` | `20px` |
| `font-size-body` | 400 (Regular) | `16px` | `15px` |
| `font-size-caption` | 500 (Medium) | `13px` | `12px` |

---

## 4. UI Component Geometry
Enforce these structural constraints to maintain spatial consistency.

* `radius-card`: `12px` (Applies to dashboard panels, info cards, and bottom sheets)
* `radius-button`: `8px` (Applies to interactive elements, primary, and secondary CTAs)
* `interactive-min-target`: Web = `32px`, Mobile = `48px` (Ensures thumb-accessibility on mobile screens)

---

## 5. Platform-Specific Layout Layout Rules

### When Generating Web Apps (`viewport: desktop`)
* **Layout Structure:** Utilize a fixed left-hand navigation rail (`width: 240px`) using `color-bg-surface`. 
* **Data Presentation:** Maximize horizontal density. Use multi-column split views for dashboard details. Charts should scale horizontally.
* **Navigation:** Global search bar inside a top header bar; tertiary settings exposed via contextual drop-down menus on click.

### When Generating Mobile Apps (`viewport: mobile`)
* **Layout Structure:** Convert horizontal views into a single vertical scrolling column stacked layout. Use full-bleed widths for critical charts.
* **Data Presentation:** Group dense metrics into a swipeable horizontal card carousel instead of multi-column tables.
* **Navigation:** Implement a sticky bottom navigation bar with exactly 4 icon actions (`Home`, `Analytics`, `Alerts`, `Profile`). Primary focus items must stay within the lower 40% thumb-zone of the screen.
* **Modals:** Use slide-up bottom sheets anchored at the base of the viewport for action confirmations instead of center-screen popups.