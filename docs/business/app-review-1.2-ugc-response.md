# App Store Review — Guideline 1.2 (UGC) resubmission kit

Everything needed to clear the repeat **Guideline 1.2 – User-Generated Content** rejection.
The four required safeguards are **already implemented**; the previous submission was
rejected because no demonstration recording or reviewer notes were provided, so the
reviewer could not locate them. This kit provides the notes to paste into App Store
Connect and a shot-by-shot recording script.

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
