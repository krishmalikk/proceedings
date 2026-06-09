import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import FindPage from '../page'

// Keep the regression test focused on the data-shape guard; stub the heavy bits.
vi.mock('@/lib/activeUser', () => ({
  getActiveUser: vi.fn(() => ''),
  setActiveUser: vi.fn(),
  userHeaders: vi.fn((h?: Record<string, string>) => h || {}),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/components/Markdown', () => ({
  default: ({ children }: { children: string }) => <div>{children}</div>,
}))

describe('FindPage — resilience to a bad /api/users response', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('does NOT crash when /api/users returns an error object (non-array)', async () => {
    // This is exactly what the misconfigured proxy returned in production:
    // a FastAPI 404 body {detail:"Not Found"} instead of the SeedUser[] array.
    global.fetch = vi.fn(async () => ({
      ok: false, status: 404, json: async () => ({ detail: 'Not Found' }),
    })) as unknown as typeof fetch

    render(<FindPage />)
    // The page renders (heading present) with an empty picker — no white-screen.
    expect(await screen.findByText(/Find users in the same boat/i)).toBeInTheDocument()
    expect(screen.queryAllByRole('option')).toHaveLength(0)
  })

  it('renders the persona options when /api/users returns a proper array', async () => {
    global.fetch = vi.fn(async () => ({
      ok: true, status: 200,
      json: async () => [{ id: 'demo-arjun', username: 'arjun-h1b', label: 'Arjun (H-1B)' }],
    })) as unknown as typeof fetch

    render(<FindPage />)
    expect(await screen.findByText(/Find users in the same boat/i)).toBeInTheDocument()
    expect(await screen.findByRole('option', { name: 'Arjun (H-1B)' })).toBeInTheDocument()
  })
})
