// Dev-only "active user" selection for the seed-roster impersonation mechanism.
// Persisted in localStorage and sent to the backend as the X-User-Id header.
// When real auth lands, this is replaced by a verified Firebase uid.

export const USER_KEY = 'demo-user-id'

export function getActiveUser(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem(USER_KEY) || ''
}

export function setActiveUser(id: string): void {
  if (typeof window !== 'undefined') localStorage.setItem(USER_KEY, id)
}

export function userHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const uid = getActiveUser()
  return uid ? { 'X-User-Id': uid, ...extra } : { ...extra }
}
