import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mutable mock of the Firebase auth singleton so we can toggle currentUser.
vi.mock('@/lib/firebase', () => ({ auth: { currentUser: null as null | { uid: string } } }))

import { auth } from '@/lib/firebase'
import {
  getActiveUser,
  setActiveUser,
  clearActiveUser,
  isFirebaseAuthed,
  userHeaders,
  USER_KEY,
} from '@/lib/activeUser'

const setFirebaseUser = (uid: string | null) => {
  ;(auth as unknown as { currentUser: null | { uid: string } }).currentUser = uid ? { uid } : null
}

// The jsdom localStorage in this setup is a partial stub — provide a real
// in-memory one so get/set/remove behave.
function installLocalStorage() {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  })
}

describe('activeUser — Firebase session and demo picker are mutually exclusive', () => {
  beforeEach(() => {
    installLocalStorage()
    setFirebaseUser(null)
  })

  it('with no Firebase session, the demo picker value is the active user', () => {
    setActiveUser('demo-arjun')
    expect(getActiveUser()).toBe('demo-arjun')
    expect(isFirebaseAuthed()).toBe(false)
  })

  it('a Firebase session wins over any demo value', () => {
    localStorage.setItem(USER_KEY, 'demo-arjun') // stale demo value
    setFirebaseUser('fb-uid-123')
    expect(getActiveUser()).toBe('fb-uid-123')
    expect(isFirebaseAuthed()).toBe(true)
  })

  it('setActiveUser is a no-op while a Firebase user is signed in', () => {
    setFirebaseUser('fb-uid-123')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    setActiveUser('demo-mei')
    expect(localStorage.getItem(USER_KEY)).toBeNull() // demo selection rejected
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('clearActiveUser removes the demo value', () => {
    setActiveUser('demo-arjun')
    clearActiveUser()
    expect(getActiveUser()).toBe('')
  })

  it('userHeaders carries X-User-Id only when there is an active user', () => {
    expect(userHeaders()).toEqual({})
    setActiveUser('demo-arjun')
    expect(userHeaders()).toEqual({ 'X-User-Id': 'demo-arjun' })
    expect(userHeaders({ 'Content-Type': 'application/json' })).toEqual({
      'X-User-Id': 'demo-arjun',
      'Content-Type': 'application/json',
    })
  })
})
