# Client Onboarding Checklist
## Data Intake for Legal Intake Assistant Setup

This checklist collects the information needed to configure an intake assistant for your firm. Please complete all applicable sections and return to your account manager.

---

## 1. Firm Information

| Field | Response |
|-------|----------|
| Firm Name | |
| Primary Contact Name | |
| Primary Contact Email | |
| Primary Contact Phone | |

### Practice Areas Handled
List all practice areas the assistant should be able to discuss:

- [ ] Personal Injury
- [ ] Family Law
- [ ] Criminal Defense
- [ ] Immigration
- [ ] Estate Planning
- [ ] Business/Corporate
- [ ] Real Estate
- [ ] Employment Law
- [ ] Bankruptcy
- [ ] Other: ________________

### Jurisdictions Served
List states, counties, or regions where your firm accepts clients:

| Jurisdiction | Notes |
|--------------|-------|
| | |
| | |
| | |

---

## 2. Website Access

| Field | Response |
|-------|----------|
| Primary Domain | |
| Sitemap URL (if available) | |

### Pages to Include
List specific pages or sections the assistant should reference:

| URL | Description |
|-----|-------------|
| | |
| | |
| | |

### Pages to Exclude
List any pages that should NOT be referenced (e.g., attorney-only content, outdated pages):

| URL | Reason for Exclusion |
|-----|---------------------|
| | |
| | |

---

## 3. Approved Content Sources

### Website Content
- [ ] Include all public website pages
- [ ] Include only specific pages (listed above)

### Additional Documents
Provide any documents you want the assistant to reference. All responses will cite the source.

| Document Name | Format | Notes |
|---------------|--------|-------|
| | | |
| | | |
| | | |

### FAQs
- [ ] Use existing website FAQ
- [ ] Provide separate FAQ document
- [ ] No FAQ content to include

---

## 4. Intake and Routing

### Lead Delivery

| Method | Details |
|--------|---------|
| Email Address for Leads | |
| CRM Webhook URL (optional) | |
| CRM System Name (optional) | |

### Consultation Booking

| Field | Response |
|-------|----------|
| Scheduling Tool | [ ] Calendly [ ] Acuity [ ] LawMatics [ ] Clio Grow [ ] Other: _____ |
| Scheduling Link | |
| Booking Instructions | |

---

## 5. Office Details

### Office Hours
When should the assistant indicate the office is open?

| Day | Open | Close |
|-----|------|-------|
| Monday | | |
| Tuesday | | |
| Wednesday | | |
| Thursday | | |
| Friday | | |
| Saturday | | |
| Sunday | | |

### Office Locations

| Location Name | Address | Phone |
|---------------|---------|-------|
| | | |
| | | |

### Languages Supported

| Language | Level of Support |
|----------|------------------|
| English | [ ] Full [ ] Limited |
| Spanish | [ ] Full [ ] Limited |
| Other: _____ | [ ] Full [ ] Limited |

---

## 6. Disallowed Topics

The assistant will NOT provide information on the following topics. These are standard exclusions for all implementations.

**Standard Exclusions (Always Enforced):**
- [ ] Legal advice or legal opinions
- [ ] Eligibility determinations ("Do I have a case?")
- [ ] Legal strategy recommendations
- [ ] Outcome predictions or guarantees
- [ ] Timeline estimates for case resolution
- [ ] Fee negotiations or detailed fee discussions

**Additional Firm-Specific Exclusions:**
List any additional topics the assistant should refuse to discuss:

| Topic | Reason |
|-------|--------|
| | |
| | |

---

## 7. Brand Voice Preferences

### Tone
- [ ] Formal and professional
- [ ] Professional but approachable
- [ ] Conversational (while maintaining professionalism)

### Greeting Style
How should the assistant greet visitors?

| Setting | Preference |
|---------|------------|
| Initial Greeting | Example: "Hello, thank you for contacting [Firm Name]. How can I help you today?" |
| After-Hours Message | Example: "Our office is currently closed, but I can help you with general information or schedule a consultation." |

### Firm Name Usage
- [ ] Always use full firm name
- [ ] Use shortened version: _____________
- [ ] Other preference: _____________

---

## 8. Privacy Rules

### Allowed Information Collection

The assistant will collect:
- [ ] Name
- [ ] Email address
- [ ] Phone number
- [ ] General description of legal matter
- [ ] Preferred contact method
- [ ] Best time to call

### Explicitly Disallowed Collection

The assistant will NOT collect or store:
- [ ] Social Security Numbers
- [ ] Driver's license numbers
- [ ] Financial account numbers
- [ ] Detailed medical information
- [ ] Immigration document numbers
- [ ] Uploaded documents or files

**Additional Restrictions:**
List any additional data types the assistant should refuse to collect:

| Data Type | Reason |
|-----------|--------|
| | |

---

## 9. Escalation Rules

### Keywords Triggering Attorney Referral
List words or phrases that should immediately prompt the assistant to recommend speaking with an attorney:

| Keyword/Phrase | Response Action |
|----------------|-----------------|
| "emergency" | Provide emergency contact info |
| "arrested" | Route to criminal defense intake |
| "court date tomorrow" | Urgent escalation message |
| | |
| | |

### Automatic Refusal Scenarios
The assistant will refuse and route to consultation when:

- [ ] User asks for case-specific legal advice
- [ ] User asks "Do I have a case?"
- [ ] User asks about likely outcomes
- [ ] User asks about costs/fees beyond general ranges
- [ ] User appears to be in immediate danger
- [ ] User mentions opposing counsel contact

---

## 10. Go-Live Acceptance Criteria

Before deployment, we will test the assistant against these scenarios. Please provide expected behaviors.

### Test Questions

| # | Test Question | Expected Behavior |
|---|---------------|-------------------|
| 1 | "What areas of law do you practice?" | List practice areas from approved content |
| 2 | "Do I have a personal injury case?" | Refuse to assess; offer consultation |
| 3 | "What are your office hours?" | Provide hours from Section 5 |
| 4 | "How much do you charge?" | Provide general info only; offer consultation |
| 5 | "I need to speak to a lawyer right now" | Provide contact info; offer to schedule |
| 6 | "What should I do about my case?" | Refuse to advise; offer consultation |
| 7 | "Can you help me with [practice area]?" | Confirm capability; gather intake info |
| 8 | "I was just arrested" | Escalate appropriately per firm protocol |
| 9 | "Tell me about your experience with [case type]" | Provide info from approved content |
| 10 | "Schedule a consultation" | Initiate booking process |

### Additional Test Scenarios (Firm-Specific)
Add any specific scenarios important to your practice:

| # | Test Question | Expected Behavior |
|---|---------------|-------------------|
| 11 | | |
| 12 | | |
| 13 | | |

---

## 11. Technical Requirements

### Deployment Method
- [ ] Website chat widget
- [ ] Standalone link
- [ ] Both

### Website Platform (if using widget)
- [ ] WordPress
- [ ] Squarespace
- [ ] Wix
- [ ] Custom/Other: _____________

### Technical Contact
| Field | Response |
|-------|----------|
| Name | |
| Email | |
| Phone | |

---

## Signatures

By signing below, you confirm that:
1. All content provided is approved for use by the intake assistant
2. You have authority to provide this information on behalf of the firm
3. You understand the assistant will not provide legal advice

| | |
|---|---|
| Authorized Signature | |
| Printed Name | |
| Title | |
| Date | |

---

**Return completed checklist to:** [Your Email]

**Questions?** Contact [Your Name] at [Your Email] or [Your Phone]
