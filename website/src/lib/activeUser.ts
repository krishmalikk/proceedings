// Active user management for the X-User-Id header.
//
// A Firebase session and the dev-mode demo-user picker are MUTUALLY EXCLUSIVE:
// - While signed in via Firebase, the uid is the identity and the demo picker is
//   ignored (and cleared on sign-in by AuthContext) — so the two never coexist.
// - With no Firebase session, the picker's localStorage value is the identity.
// This prevents the (previously seen) flip between a stale demo selection and a
// restored Firebase session.

import { auth } from './firebase';

export const USER_KEY = 'demo-user-id';

/** True when a real Firebase user is signed in. */
export function isFirebaseAuthed(): boolean {
  return !!auth?.currentUser?.uid;
}

/**
 * Get the active user ID. The Firebase uid wins whenever a session exists;
 * otherwise the demo-picker value is used.
 */
export function getActiveUser(): string {
  if (typeof window === 'undefined') return '';
  if (auth?.currentUser?.uid) return auth.currentUser.uid;
  return localStorage.getItem(USER_KEY) || '';
}

/**
 * Select a demo (dev-mode) user. No-op while a Firebase user is signed in — the
 * two identities are mutually exclusive, so a demo selection can never shadow or
 * race a real session.
 */
export function setActiveUser(id: string): void {
  if (typeof window === 'undefined') return;
  if (auth?.currentUser?.uid) {
    // eslint-disable-next-line no-console
    console.warn('setActiveUser ignored: a Firebase user is signed in (demo picker disabled).');
    return;
  }
  localStorage.setItem(USER_KEY, id);
}

/**
 * Clear the active user ID from localStorage.
 */
export function clearActiveUser(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(USER_KEY);
  }
}

/**
 * Generate headers with the X-User-Id for API calls.
 */
export function userHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const uid = getActiveUser();
  return uid ? { 'X-User-Id': uid, ...extra } : { ...extra };
}
