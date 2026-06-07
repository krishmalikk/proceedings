# What Else Is Needed to Launch

This document outlines additional assets and infrastructure required to operate the legal intake consulting service. Items are prioritized into V1 (must have before first client) and Later (do not build yet).

---

## V1 – Must Have

These items are required before accepting your first paying client.

### Sales Assets

| Asset | Purpose | Status |
|-------|---------|--------|
| **Demo site** | A working demo instance with sample law firm content that prospects can interact with during sales calls | Required |
| **Loom demo script** | A 3-5 minute recorded walkthrough showing the assistant handling typical intake scenarios; used for async outreach | Required |
| **One-page overview** | PDF or single-page document summarizing the service for email attachments; see pilot-offer.md | Complete |

### Legal & Policy

| Asset | Purpose | Status |
|-------|---------|--------|
| **Website privacy policy** | Discloses data collection on your consulting website (visitor analytics, contact form data) | Required |
| **Terms of service** | Governs use of your consulting website | Required |
| **Standard disclaimer language** | Consistent disclaimer text for all client-facing materials stating the service does not provide legal advice | Required |
| **Client service agreement** | Contract template for pilot and ongoing service engagements | Required |

### Technical Operations

| Component | Purpose | Status |
|-----------|---------|--------|
| **Hosting** | Reliable hosting for the intake assistant backend; recommend managed service (Vercel, Railway, or similar) | Required |
| **Per-firm data isolation** | Logical separation ensuring each firm's content and conversations are isolated; can be database-level initially | Required |
| **Basic logging** | Conversation logs accessible to clients; error logging for debugging | Required |
| **Rate limiting** | Prevent abuse; basic per-IP and per-firm limits | Required |
| **Daily backups** | Automated backups of conversation data and firm configurations | Required |

### Support Process

| Process | Purpose | Status |
|---------|---------|--------|
| **Escalation workflow** | Documented process for when the assistant encounters edge cases or errors; how clients report issues | Required |
| **Onboarding checklist** | Standardized checklist for gathering client information; see data-intake-checklist.md | Complete |
| **Go-live testing protocol** | Standard set of test questions run before every deployment | Required |

---

## Later – Do Not Build Yet

These items are valuable but should wait until after initial traction. Building them now would delay launch without proportional benefit.

### Sales Assets (Later)

| Asset | Why Wait |
|-------|----------|
| **Case studies** | Need real client results first |
| **Video testimonials** | Need satisfied clients first |
| **Comparison guides** | Market positioning can come after initial sales |
| **ROI calculator** | Requires data from live deployments |
| **Slide deck** | One-page PDF is sufficient for early sales |

### Legal & Policy (Later)

| Asset | Why Wait |
|-------|----------|
| **BAA template** | Only needed if handling PHI; most intake doesn't require this initially |
| **SOC 2 compliance** | Expensive; pursue only after enterprise demand |
| **Formal security audit** | Valuable but premature for early stage |

### Technical Operations (Later)

| Component | Why Wait |
|-----------|----------|
| **Multi-region deployment** | Single region is fine for early clients |
| **Real-time analytics dashboard** | Basic logs and email reports are sufficient |
| **Client self-service portal** | You can handle updates manually initially |
| **Automated content refresh** | Manual updates are fine at low volume |
| **Advanced monitoring/alerting** | Basic error logging is sufficient |
| **Load testing** | Early volume won't require this |

### Support Process (Later)

| Process | Why Wait |
|---------|----------|
| **SLA documentation** | Informal response times are fine initially |
| **Knowledge base** | Direct support is more valuable early on |
| **Automated monthly reports** | Manual summaries are sufficient |
| **Client training materials** | Handle via onboarding calls initially |

### Features (Later)

| Feature | Why Wait |
|---------|----------|
| **Multi-language support** | English-only is fine for V1 |
| **Voice/phone integration** | Text-based is sufficient initially |
| **Advanced analytics** | Basic lead counts and conversation logs are enough |
| **A/B testing** | Premature optimization |
| **Custom branding options** | Standard presentation is fine |
| **API access for clients** | No demand yet |

---

## V1 Checklist Summary

Before accepting your first client, confirm:

- [ ] Demo site is live and functional
- [ ] Loom demo video is recorded
- [ ] Website privacy policy is published
- [ ] Website terms of service is published
- [ ] Standard disclaimer language is documented
- [ ] Client service agreement template is ready
- [ ] Hosting is configured and stable
- [ ] Per-firm data isolation is implemented
- [ ] Basic logging is functional
- [ ] Rate limiting is in place
- [ ] Daily backups are running
- [ ] Escalation workflow is documented
- [ ] Go-live testing protocol is documented

---

## Notes

- **Resist feature creep.** The goal is to close one paying client, deliver value, and learn. Everything else can wait.
- **Manual processes are fine.** If you can handle something manually for 5-10 clients, don't automate it yet.
- **Legal docs can be simple.** Use standard templates adapted for your service. Don't over-engineer.
- **Sales assets should be minimal.** A working demo and clear one-pager are more effective than polished materials.
