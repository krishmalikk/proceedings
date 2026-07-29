import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import TopAppBar from '../TopAppBar'

// (Vitest hoists vi.mock — only `mock`-prefixed vars may be referenced inside.)
let mockUser: { displayName?: string; email?: string } | null = null

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}))
vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mockUser, loading: false, signOut: vi.fn() }) }))
vi.mock('@/lib/activeUser', () => ({ USER_KEY: 'demo-user-id', userHeaders: vi.fn(() => ({})) }))

// jsdom here has no localStorage; TopAppBar reads it for the dev-mode uid.
beforeEach(() => {
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} })
  mockUser = null
})

describe('TopAppBar nav (Home added, Community removed — features/ui-changes-1)', () => {
  it('shows Home, Groups, and News; Community is gone (search moved to "/")', () => {
    render(<TopAppBar />)
    expect(screen.queryByText('Community')).not.toBeInTheDocument()
    // scoped to <nav> — the brand mark also links to "/" but isn't labeled "Home"
    expect(document.querySelector('nav')).toHaveTextContent('Home')
    expect(screen.getByText('Groups')).toBeInTheDocument()
    // News re-enabled once the tab had real content behind it (gov-news
    // ingestion) — see docs/ingestion/GOV-NEWS-INGESTION-PLAN.md.
    expect(screen.getByText('News')).toBeInTheDocument()
    // old labels renamed even earlier
    expect(screen.queryByText('Case Search')).not.toBeInTheDocument()
    expect(screen.queryByText('Find Peers')).not.toBeInTheDocument()
  })

  it('Home points at /, Groups at /find, News at /news, no nav item points at /search', () => {
    render(<TopAppBar />)
    const homeLink = Array.from(document.querySelectorAll('nav a')).find((a) => a.textContent === 'Home')
    expect(homeLink).toHaveAttribute('href', '/')
    expect(screen.getByText('Groups').closest('a')).toHaveAttribute('href', '/find')
    expect(screen.getByText('News').closest('a')).toHaveAttribute('href', '/news')
    expect(document.querySelector('nav a[href="/search"]')).not.toBeInTheDocument()
  })
})

describe('TopAppBar identity (never leaks real name/email — features/ui-changes-1)', () => {
  it('shows the anonymized handle from /api/profile, not Firebase displayName/email', async () => {
    mockUser = { displayName: 'Real Name', email: 'real@example.com' }
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ username: 'brave-maple-3272' }) }))
    )

    render(<TopAppBar />)
    fireEvent.click(screen.getByLabelText('User menu'))

    expect(await screen.findByText('brave-maple-3272')).toBeInTheDocument()
    expect(screen.queryByText('Real Name')).not.toBeInTheDocument()
    expect(screen.queryByText('real@example.com')).not.toBeInTheDocument()
  })
})
