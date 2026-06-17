# Pre-Launch Checklist

Complete checklist for launching Meridian (web + mobile) to production.

---

## 1. Branding & Identity Updates

### App Name Change
- [x] Mobile: Change "meridianjourney.ai" to "Meridian" throughout
- [ ] Website: Update all references to "Meridian"
  - [ ] TopAppBar logo/brand text
  - [ ] Page titles and meta tags
  - [ ] Footer text
  - [ ] Legal pages (disclaimer, privacy, terms)
  - [ ] Error messages and placeholder text

### Color Scheme Alignment
The mobile app now uses **#AE0000 (Meridian Red)** as the primary accent. The website still uses the old navy/blue palette.

| Element | Website (Current) | Mobile (New) | Action |
|---------|------------------|--------------|--------|
| Primary | #15487e (Navy) | #AE0000 (Red) | Update website |
| Secondary | #2c6fb5 (Liberty Blue) | #4A4A4A (Neutral) | Update website |
| Accent | #d62828 (Flame Red) | #AE0000 (Red) | Already similar |
| Buttons | Navy background | Red background | Update website |
| Active tabs | Navy | Red | Update website |
| Links | Navy | Red | Update website |
| Badges | Navy/Blue variants | Red variants | Update website |

**Files to update:**
- `website/src/app/globals.css` - Update CSS variables and Tailwind classes
- `website/tailwind.config.js` - Update color palette

### Typography Alignment
| Element | Website (Current) | Mobile (New) | Action |
|---------|------------------|--------------|--------|
| Headings | Inter | Lora (serif) | Update website |
| Body | Inter | Nunito Sans | Update website |

**Files to update:**
- `website/src/app/layout.tsx` - Import Google Fonts (Lora, Nunito Sans)
- `website/src/app/globals.css` - Update font-family declarations

---

## 2. Feature Parity (Web vs Mobile)

### Features Mobile Has, Website Missing or Different

| Feature | Mobile | Website | Priority | Action |
|---------|--------|---------|----------|--------|
| Home Screen with AI Orb | Yes - animated orb hero | No - redirects to /search | High | Create landing page |
| AI Chat (full screen) | AIChatScreen | Disabled (AI_MODE_ENABLED=false) | High | Enable and polish |
| Precision Slider | 3 levels (Broad/Balanced/Strict) | StrictnessSlider (0-100) | Medium | Align UI |
| Navigation Cards | Visual cards for sections | Text links | Medium | Add card-based nav |
| Profile Activity | Shows user's postings/groups | ProfileActivity component exists | Low | Verify parity |
| Onboarding Wizard | 2-stage (Background + Experiences) | 2-stage exists | Low | Verify parity |
| Group Chat | Real-time messaging | GroupChat exists | Low | Verify parity |

### Features Website Has, Mobile Missing

| Feature | Website | Mobile | Priority | Action |
|---------|---------|--------|----------|--------|
| News Page | /news (minimal) | NewsScreen (placeholder) | Low | Both need content |
| Community Page | /community (minimal) | CommunityScreen exists | Low | Both need content |
| Ask a Pro | /pro (placeholder) | AskProScreen (placeholder) | Future | Post-launch |

---

## 3. Legal Pages (Critical)

### Privacy Policy
- [ ] **Website**: Update `/privacy` page with actual content
- [ ] **Mobile**: Links to `https://Meridian/privacy` - URL needs fixing
  - Current: `Linking.openURL('https://Meridian/privacy')`
  - Should be: Actual domain (e.g., `https://meridian.ai/privacy`)

**Privacy Policy Must Include:**
- What data we collect (profile info, visa status, journey data)
- How we use data (matching, AI responses, analytics)
- Third-party services (Firebase Auth, Vertex AI, GCP)
- Data retention and deletion
- User rights (access, correction, deletion)
- Contact information
- CCPA/GDPR compliance (if applicable)

### Terms of Service
- [ ] **Website**: Update `/terms` page with actual content
- [ ] **Mobile**: Links to `https://Meridian/terms` - URL needs fixing

**Terms Must Include:**
- Service description
- User responsibilities
- Prohibited uses
- Disclaimer (not legal advice)
- Limitation of liability
- Termination conditions
- Governing law

### Legal Disclaimer
- [x] **Mobile**: DisclaimerScreen exists with "not legal advice" content
- [ ] **Website**: `/disclaimer` exists - verify content matches mobile
- [ ] Both apps should show disclaimer on first use or in prominent location

---

## 4. Content & Data Needed

### Tag Vocabulary
- [x] Backend has controlled vocabulary in `tags-cleaned/`
- [ ] Verify all 10 tag categories are populated:
  - 1.1 Non-immigrant visas
  - 1.2 Green card categories
  - 1.3 Abbreviations
  - 1.4 Consulates
  - 1.5 Forms
  - 1.6 Visa/form actions
  - 1.7 Key stages
  - 1.8 Key dates
  - 1.9 Outcomes
  - 1.10 Common/misc topics

### Sample Postings
- [ ] Ensure at least 20-50 quality visa experience postings in the datastore
- [ ] Cover variety of visa types (H-1B, L-1, F-1, EB-1, EB-2, etc.)
- [ ] Cover variety of outcomes (approved, RFE, denied, etc.)
- [ ] Cover variety of consulates

### Groups
- [ ] Create 3-5 seed groups for common visa categories
  - H-1B Transfer Support
  - EB-2/EB-3 Green Card Journey
  - F-1 to H-1B Transition
  - Consular Processing Support
  - RFE Response Help

### News/Updates Content
- [ ] Create initial news items if enabling news feature
- [ ] Or remove/hide news section until ready

---

## 5. Website Beautification

### Home/Landing Page
Currently `/` redirects to `/search`. Need a proper landing page.

**Proposed Structure (matching mobile):**
```
[Header - Meridian logo + nav]

[Hero Section]
  - AI Orb graphic (animated or static)
  - "Hi there" greeting
  - "Ask me anything about your visa journey"
  - Chat input CTA

[Divider]

[Navigation Cards - 2x2 grid]
  - Visa Experiences → /search
  - Groups → /find
  - Community → /search
  - Profile → /profile

[Footer]
```

### Search Page Improvements
- [ ] Add precision level selector (Broad/Balanced/Strict) matching mobile
- [ ] Improve result card design with better visual hierarchy
- [ ] Add empty state illustrations

### Profile Page Improvements
- [ ] Match mobile layout with sections for:
  - Account info with avatar
  - Visa Status badges
  - Consulates
  - Key Information
  - Key Dates
  - Tags/Topics
  - Journey Timeline (expandable milestones)

### General UI Polish
- [ ] Add loading skeletons instead of spinners
- [ ] Add empty state illustrations
- [ ] Improve mobile responsiveness
- [ ] Add subtle animations/transitions
- [ ] Consistent card styling across all pages
- [ ] Improve error states with helpful messages

---

## 6. Mobile App Fixes

### URL Fixes
- [ ] Update Privacy Policy URL in ProfileScreen
- [ ] Update Terms of Service URL in ProfileScreen
- [ ] Ensure URLs point to actual domain

### Sign-Out Crash
- [x] Fixed race condition in AuthContext.tsx
- [ ] Verify fix works in production build

### Production Build Prep
- [ ] Test Google Sign-In in development build (not Expo Go)
- [ ] Verify all environment variables are set in EAS
- [ ] Test push notifications (if applicable)
- [ ] Verify deep linking works

---

## 7. Backend/API Verification

### Endpoints to Verify
- [ ] `/search` - Returns proper results with facets
- [ ] `/postings` - CRUD operations work
- [ ] `/profile/{uid}` - Profile operations work
- [ ] `/onboard` - Onboarding flow works
- [ ] `/groups` - Group operations work
- [ ] `/ask` - AI Q&A works with guardrails
- [ ] `/reconcile` - Profile reconciliation works

### Data Integrity
- [ ] Verify Firestore security rules
- [ ] Verify Vertex AI Search datastore is populated
- [ ] Verify GCS bucket permissions

---

## 8. Testing Checklist

### Critical User Flows
- [ ] Sign up → Onboarding → Home
- [ ] Sign in → Profile → View journey
- [ ] Search → View posting → Read details
- [ ] Create posting → AI tags → Publish
- [ ] Find users → Create group → Chat
- [ ] Sign out → Sign back in

### Cross-Platform Testing
- [ ] Website on Chrome (desktop)
- [ ] Website on Safari (desktop)
- [ ] Website on Chrome (mobile)
- [ ] Website on Safari (mobile)
- [ ] Mobile app on iOS simulator
- [ ] Mobile app on iOS device (TestFlight)
- [ ] Mobile app on Android emulator
- [ ] Mobile app on Android device

---

## 9. Launch Sequence

### Phase 1: Content & Legal (Week 1)
1. Write and publish Privacy Policy
2. Write and publish Terms of Service
3. Update legal page URLs in mobile app
4. Add seed postings and groups

### Phase 2: Web Redesign (Week 2)
1. Update color scheme to Meridian Red
2. Update typography to Lora + Nunito Sans
3. Create landing page with AI orb hero
4. Polish search and profile pages

### Phase 3: Testing & QA (Week 3)
1. Run through all critical flows
2. Cross-platform testing
3. Fix bugs and polish
4. Performance optimization

### Phase 4: Soft Launch (Week 4)
1. Deploy web to production
2. Submit mobile to TestFlight
3. Invite beta testers
4. Gather feedback

### Phase 5: Public Launch
1. Submit to App Store
2. Submit to Play Store
3. Marketing launch
4. Monitor and iterate

---

## Quick Reference: File Locations

| Item | Path |
|------|------|
| Website colors | `website/src/app/globals.css` |
| Website layout | `website/src/app/layout.tsx` |
| Mobile theme | `mobile/src/constants/theme.ts` |
| Mobile screens | `mobile/src/screens/` |
| Legal pages (web) | `website/src/app/privacy/`, `website/src/app/terms/` |
| Legal screen (mobile) | `mobile/src/screens/DisclaimerScreen.tsx` |
| Tag vocabulary | `backend/tags-cleaned/` |

---

## Related Documentation

- [[Deployment]] - Infrastructure overview
- [[Website]] - Website codebase details
- [[GCP Setup]] - Backend configuration
