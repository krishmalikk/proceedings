# Business Documents

**Location:** `/documents/`

---

## Documents

### [[Data Intake Checklist]]
`data-intake-checklist.md` — Client onboarding form that collects everything needed to configure the assistant for a law firm: firm info, practice areas, URLs, lead routing, office details, brand voice, privacy rules, escalation rules, and go-live test scenarios.

### [[Launch Requirements]]
`launch-requirements.md` — V1 vs Later prioritization of what's needed to launch the consulting service. V1 includes: demo site, Loom video, legal docs (privacy policy, ToS, disclaimer, service agreement), hosting, data isolation, logging, rate limiting, backups, and escalation workflow.

### [[Pilot Offer]]
`pilot-offer.md` — Client-facing one-pager for the 30-day pilot at $750. Covers what's included (content training, lead capture, consultation booking, guardrails, light tuning) and what's explicitly excluded (legal advice, eligibility, strategy, predictions). Ongoing service: $300–$500/month.

### Email Version
`data-intake-checklist-email.md` — Email-formatted version of the intake checklist.

---

## Key Guardrails (from all documents)

These are enforced at every level — in the Gemini prompt, the pilot offer, and the onboarding checklist:

- No legal advice or opinions
- No eligibility determinations
- No strategy recommendations
- No outcome predictions
- No timeline estimates for case resolution
- No fee negotiations
