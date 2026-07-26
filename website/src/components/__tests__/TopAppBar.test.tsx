import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import TopAppBar from '../TopAppBar'

// jsdom here has no localStorage; TopAppBar reads it for the dev-mode uid.
beforeEach(() => {
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} })
})

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}))
vi.mock('next/navigation', () => ({ usePathname: () => '/', useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: null, loading: false, signOut: vi.fn() }) }))
vi.mock('@/lib/activeUser', () => ({ USER_KEY: 'demo-user-id' }))

describe('TopAppBar nav (consistency renames)', () => {
  it('shows Community, Groups, and News; not the old renamed labels', () => {
    render(<TopAppBar />)
    expect(screen.getByText('Community')).toBeInTheDocument()
    expect(screen.getByText('Groups')).toBeInTheDocument()
    // News re-enabled once the tab had real content behind it (gov-news
    // ingestion) — see docs/ingestion/GOV-NEWS-INGESTION-PLAN.md.
    expect(screen.getByText('News')).toBeInTheDocument()
    // old labels renamed
    expect(screen.queryByText('Case Search')).not.toBeInTheDocument()
    expect(screen.queryByText('Find Peers')).not.toBeInTheDocument()
  })

  it('Community points at /search, Groups at /find, News at /news', () => {
    render(<TopAppBar />)
    expect(screen.getByText('Community').closest('a')).toHaveAttribute('href', '/search')
    expect(screen.getByText('Groups').closest('a')).toHaveAttribute('href', '/find')
    expect(screen.getByText('News').closest('a')).toHaveAttribute('href', '/news')
  })
})
