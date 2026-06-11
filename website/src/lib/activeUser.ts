// Active user management for the X-User-Id header.
// Uses Firebase auth when available, falls back to localStorage for dev mode.

import { auth } from './firebase';

export const USER_KEY = 'demo-user-id';

/**
 * Get the active user ID.
 * Prefers Firebase auth user, falls back to localStorage for dev mode.
 */
export function getActiveUser(): string {
  if (typeof window === 'undefined') return '';

  // Try Firebase auth first
  if (auth?.currentUser?.uid) {
    return auth.currentUser.uid;
  }

  // Fall back to localStorage for dev mode
  return localStorage.getItem(USER_KEY) || '';
}

/**
 * Set the active user ID in localStorage (for dev mode only).
 * When using Firebase auth, this is not needed.
 */
export function setActiveUser(id: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(USER_KEY, id);
  }
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
