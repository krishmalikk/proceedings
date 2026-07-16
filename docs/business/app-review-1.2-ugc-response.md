# App Store Review — resubmission kit

Notes + demo scripts for the App Review rejections. Guideline 1.2 (UGC) is covered first;
the Guideline 5.1.1(i)/5.1.2(i) (AI privacy) and 2.3.6 (age rating) items from the
build 11 review follow at the bottom.

---

## Build 11 review — Guideline 5.1.1(i) / 5.1.2(i) (third-party AI) and 2.3.6 (age rating)

### 5.1.1(i) / 5.1.2(i) — AI data-sharing consent (code fix, build 12)
The app sends user-entered text (questions + onboarding profile details) to Google's Gemini
(Google Cloud AI). Build 12 adds the required **in-app disclosure + affirmative permission
before any data is sent**:
- A one-time **AI consent screen** (`AIConsentScreen`) shown after sign-in, before onboarding
  — states *what* is sent (your questions + profile details), *who* it goes to (Google's
  Gemini / Google Cloud AI), and *how* it's used, with **Agree & continue** / **Not now** and
  a Privacy Policy link.
- Enforcement is global: `askQuestion` (AI chat), `onboardTurn` (AI onboarding), and
  `reconcile` refuse to transmit until consent is granted (`assertAIConsent`). Declining keeps
  the rest of the app usable with AI off.
- A **Profile → "AI answers"** toggle lets users enable/disable anytime.
- The **Privacy Policy** (meridianjourney.ai/privacy, Section 1 + Section 6) now names Google's
  Gemini and the exact data shared, and the in-app consent + opt-out.

**Reviewer note to paste:** *"Before any data is sent to our AI provider, the app shows an AI
data-sharing consent screen (after sign-in) that discloses what is sent (your questions and
profile details), who it is sent to (Google's Gemini / Google Cloud AI), and how it is used,
and requires an explicit 'Agree & continue'. Users can decline and still use the app, and can
toggle AI in Profile → 'AI answers' at any time. Our Privacy Policy (Sections 1 and 6) details
this."*

### 2.3.6 — Age Rating "In-App Controls" (App Store Connect, no code)
App Store Connect → the app → **App Information** → **Age Rating** → **Edit** → set
**Age Assurance** (and any Parental/In-App Controls) to **None** → Save. Applies to the
existing submission; no rebuild required for this item.

---

## 1. Reviewer notes — paste into *App Store Connect → App Review Information → Notes*

> **Re: Guideline 1.2 — User-Generated Content**
>
> This app includes all required UGC safeguards. Where to find each:
>
> **EULA / Terms before registering or logging in.** The Sign-Up screen has a required
> "I agree to the Terms of Use (EULA) and Privacy Policy … zero tolerance for
> objectionable content or abusive behavior" checkbox that must be checked before an
> account can be created (email, Google, or Apple). The Login screen also shows a "By
> continuing you agree to our Terms of Use (EULA) and Privacy Policy" notice. Both link to
> the full EULA, whose Section 4 ("Community Guidelines — Zero Tolerance for Objectionable
> Content") states our moderation policy.
>
> **Filtering objectionable content.** All user posts, replies, and group messages are
> screened on submission server-side (slur/sexual/violence wordlist + an AI safety
> classifier). Content that fails is rejected before it is ever stored or shown.
>
> **Flag / report content.** Every posting, reply, and group message from another user has
> a "•••" (more) control. Tap it → "Report content" → choose a reason (harassment, hate
> speech, violence, sexual/explicit, spam, other). The item is hidden from the reporter
> immediately, our moderation team is emailed, and content is auto-hidden once multiple
> users report it.
>
> **Block abusive users.** The same "•••" menu has "Block @user". Blocking removes all of
> that user's posts, replies, and messages from your feed instantly and emails our
> moderators to review them.
>
> **Acting within 24 hours.** Reports and blocks notify moderators
> (moderation@meridianjourney.ai / krrishess@gmail.com). We remove violating content and
> disable the offending account within 24 hours via an admin takedown tool.
>
> **Where to see it fastest:** open the **Community** tab, tap the **•••** on any experience
> card to Report or Block. It is also available inside a posting's detail view, on each
> reply, and on each group-chat message.
>
> **Demo account:** email `__________`  password `__________` (already email-verified).
> A screen recording captured on a physical device is attached below, showing the EULA,
> the report flow, and the block flow.

**Before submitting, fill in:** the demo account email/password, and confirm the
moderation email address(es) match what is set on the backend (`MODERATION_ALERT_EMAIL`).

---

## 2. Demo account (do this once)

1. Create an account in the app (or reuse one) and complete the 6-digit email
   verification so the reviewer is not blocked at `EmailVerificationScreen`.
2. Make sure the account can see UGC: the **Community** tab should return experiences.
   If needed, publish one posting from a *second* account so the demo account has
   someone else's content to Report/Block (the "•••" menu never appears on your own
   content — this is required so you can demonstrate blocking another user).
3. Put the credentials in *App Review Information → Sign-In Information* (check
   "Sign-in required") **and** in the Notes above.

---

## 3. Screen recording script (capture on a physical iPhone)

Record one continuous video (~60–90s). Apple requires a physical device, not the
simulator.

**A. EULA before sign-up/login**
1. Launch the app → **Sign Up**.
2. Point out the "I agree to the Terms of Use (EULA)…" checkbox; tap the **Terms of Use
   (EULA)** link → scroll to **Section 4 (Zero Tolerance)** → go back.
3. (Optional) Go to **Login** and show the "By continuing you agree to our Terms of
   Use (EULA) and Privacy Policy" line, tapping the EULA link.

**B. Flag / report**
4. Sign in with the demo account → open the **Community** tab.
5. On an experience card by another user, tap **•••** → **Report content** → pick a
   reason (e.g. "Harassment or bullying").
6. Show the "reviewed within 24 hours" confirmation and that the card disappears from the
   feed.

**C. Block a user**
7. On another user's card, tap **•••** → **Block @user** → confirm **Block**.
8. Show the confirmation and that the user's content is gone from the feed.

**D. (optional) Deeper surfaces**
9. Open a posting's detail view and show the **•••** on a reply, and in a group chat show
   the **•••** on a message — same Report/Block.

Save the video and attach it in the reply to the rejection in **Resolution Center** and in
the **App Review Information → Notes** attachment for future submissions.

---

## 4. Pre-submit checklist

- [ ] Uploaded binary is a **fresh EAS `production` build** that includes the moderation
      code (commit `5b69654` and the discoverability follow-ups on `app-store-revisions`).
- [ ] Demo account created + email-verified; credentials in Sign-In Information + Notes.
- [ ] Second account posted UGC so the demo account has content to report/block.
- [ ] Physical-device screen recording captured (EULA + report + block).
- [ ] Reviewer notes pasted; moderation email confirmed against backend
      `MODERATION_ALERT_EMAIL`.
- [ ] Resubmit and reply to the 1.2 message in Resolution Center with the recording.
