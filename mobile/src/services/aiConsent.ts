/**
 * Central enforcement for third-party AI data-sharing consent (App Store
 * Guideline 5.1.1(i) / 5.1.2(i)). The app sends user-entered text (questions and
 * profile/background details) to Google's Gemini (Google Cloud AI) to generate
 * answers and onboarding. Apple requires an affirmative in-app permission BEFORE
 * that data is sent — see `AIConsentContext` / `AIConsentScreen`.
 *
 * This module holds a synchronous mirror of the user's decision so the plain
 * (non-React) API functions in `apiService` can refuse to transmit personal data
 * to the AI backend until consent is granted. `AIConsentContext` keeps it in sync.
 */

let _granted = false;

export function setAIConsentGranted(granted: boolean): void {
  _granted = granted;
}

export function isAIConsentGranted(): boolean {
  return _granted;
}

/** Thrown by AI-backed API calls when consent has not been granted. */
export class AIConsentError extends Error {
  constructor() {
    super('AI_CONSENT_REQUIRED');
    this.name = 'AIConsentError';
  }
}

/** Throw if the user has not agreed to share data with the third-party AI. */
export function assertAIConsent(): void {
  if (!_granted) throw new AIConsentError();
}
