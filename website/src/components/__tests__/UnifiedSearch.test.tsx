import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import UnifiedSearch from '../UnifiedSearch'

// (Vitest hoists vi.mock — only `mock`-prefixed vars may be referenced inside.)
let mockSearchParam = ''

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => ({ get: (key: string) => (key === 'q' ? mockSearchParam || null : null) }),
}))
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }))
vi.mock('@/lib/activeUser', () => ({ USER_KEY: 'demo-user-id' }))

const POSTING = {
  case_id: 'app-1', title: 'H-1B RFE experience', description: '', visa: ['H-1B'],
  consulates: [], outcome: '', subreddit: '', channel: 'app', tags: [], url: '',
  date: '2026-07-28',
}

beforeEach(() => {
  mockSearchParam = ''
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {} })
})

describe('UnifiedSearch — default feed auto-loads on mount (features/ui-changes-1)', () => {
  it('loads and shows recent postings immediately when there is no typed query', async () => {
    const fetchMock = vi.fn(async (url: string) => ({
      ok: true,
      json: async () => ({ results: [POSTING], total: 1, next_page_token: '', suggested_filters: [] }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    render(<UnifiedSearch />)

    // Results render without the user typing or submitting anything.
    expect(await screen.findByText('H-1B RFE experience')).toBeInTheDocument()
    expect(screen.getByText('1 recent postings')).toBeInTheDocument()

    // The browse fetch never sends a `q` param — an empty q is what the
    // backend's /api/search treats as "browse most-recent-first"; sending
    // any q (even a fallback string) would route to relevance search instead.
    const calledUrl = fetchMock.mock.calls[0][0] as string
    expect(calledUrl).toContain('sort=event')
    expect(calledUrl).not.toContain('q=')
  })

  it('runs a real search instead of the recent feed when the URL already has a query', async () => {
    mockSearchParam = 'H-1B RFE'
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        results: [POSTING], total: 1, next_page_token: '',
        applied_filters: {}, relaxed: false, suggested_filters: [],
      }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    render(<UnifiedSearch />)

    expect(await screen.findByText('H-1B RFE experience')).toBeInTheDocument()
    // Search-mode header text, not the browse-mode "recent postings" label.
    expect(screen.getByText('1 postings')).toBeInTheDocument()

    const calledUrl = fetchMock.mock.calls[0][0] as string
    expect(calledUrl).toContain('q=H-1B')
  })

  it('shows a loading state and then example prompts if the initial feed comes back empty', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ results: [], total: 0, next_page_token: '', suggested_filters: [] }),
    })))

    render(<UnifiedSearch />)

    expect(await screen.findByText('No postings yet — check back soon.')).toBeInTheDocument()
    expect(screen.getByText('H-1B extension with an RFE')).toBeInTheDocument()
  })
})

describe('UnifiedSearch — single layout, no separate hero landing state', () => {
  it('the top search bar is present immediately on mount', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ results: [], total: 0, next_page_token: '', suggested_filters: [] }),
    })))

    render(<UnifiedSearch />)
    await waitFor(() => expect(screen.getByPlaceholderText('Search a posting or ask a question…')).toBeInTheDocument())
  })
})
