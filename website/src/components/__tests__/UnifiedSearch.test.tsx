import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import UnifiedSearch from '../UnifiedSearch'

// (Vitest hoists vi.mock — only `mock`-prefixed vars may be referenced inside.)
let mockSearchParam = ''
let mockFacetParams: string[] = []

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => ({
    get: (key: string) => (key === 'q' ? mockSearchParam || null : null),
    getAll: (key: string) => (key === 'facet' ? mockFacetParams : []),
  }),
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
  mockFacetParams = []
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

  // features/ui-changes-1/changes-2-.md item 3: "Back to Search" previously
  // lost selected facets entirely (only `q` was ever synced to the URL) — a
  // remount from a URL that already carries `facet=` params must restore
  // them into the initial search, not start from an empty facet set.
  it('restores selected facets from the URL into the initial search (Back to Search)', async () => {
    mockSearchParam = 'H-1B RFE'
    mockFacetParams = ['key_stages_or_info.outcome_status:RFE']
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        results: [POSTING], total: 1, next_page_token: '',
        applied_filters: {}, relaxed: false, suggested_filters: [],
      }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    render(<UnifiedSearch />)
    await screen.findByText('H-1B RFE experience')

    const calledUrl = fetchMock.mock.calls[0][0] as string
    expect(calledUrl).toContain(encodeURIComponent('key_stages_or_info.outcome_status:RFE'))
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

// Regression: toggleFacet used to only re-run the search when a query had
// already been submitted (mode === 'search'), so clicking a "Refine by"
// filter from the default browse view highlighted the chip but never
// refetched — results stayed exactly as the unfiltered recent feed.
describe('UnifiedSearch — refining from the initial browse view (regression)', () => {
  const SUGGESTED = [{ key: 'tag', label: 'Topic', field: 'tags', values: [{ code: 'approved', label: 'Approved', count: 65 }] }]

  it('clicking a suggested filter from the default browse view actually refines the results', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('facet=')) {
        return {
          ok: true,
          json: async () => ({
            results: [{ ...POSTING, title: 'Filtered result' }], total: 1, next_page_token: '',
            applied_filters: {}, relaxed: false, suggested_filters: SUGGESTED,
          }),
        }
      }
      return {
        ok: true,
        json: async () => ({ results: [POSTING], total: 1, next_page_token: '', suggested_filters: SUGGESTED }),
      }
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<UnifiedSearch />)
    expect(await screen.findByText('H-1B RFE experience')).toBeInTheDocument()
    expect(screen.getByText('1 recent postings')).toBeInTheDocument()

    fireEvent.click(screen.getByText(/Approved/))

    expect(await screen.findByText('Filtered result')).toBeInTheDocument()
    expect(screen.getByText('1 postings')).toBeInTheDocument()
    const facetCall = fetchMock.mock.calls.find((c) => String(c[0]).includes('facet='))
    expect(facetCall).toBeTruthy()
    expect(String(facetCall![0])).toContain(encodeURIComponent('tags:approved'))
  })

  it('removing the last active filter with no typed query reverts to the recency browse feed', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('facet=')) {
        return {
          ok: true,
          json: async () => ({
            results: [{ ...POSTING, title: 'Filtered result' }], total: 1, next_page_token: '',
            applied_filters: {}, relaxed: false, suggested_filters: SUGGESTED,
          }),
        }
      }
      return {
        ok: true,
        json: async () => ({ results: [POSTING], total: 1, next_page_token: '', suggested_filters: SUGGESTED }),
      }
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<UnifiedSearch />)
    await screen.findByText('H-1B RFE experience')
    fireEvent.click(screen.getByText(/Approved/))
    await screen.findByText('Filtered result')

    fireEvent.click(screen.getByText(/Approved/))

    expect(await screen.findByText('H-1B RFE experience')).toBeInTheDocument()
    expect(screen.getByText('1 recent postings')).toBeInTheDocument()
    const lastCall = fetchMock.mock.calls[fetchMock.mock.calls.length - 1]
    expect(String(lastCall[0])).not.toContain('facet=')
    expect(String(lastCall[0])).not.toContain('q=')
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

describe('UnifiedSearch — Advanced Search entry point', () => {
  it('links to /advanced-search, next to the search box', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ results: [], total: 0, next_page_token: '', suggested_filters: [] }),
    })))

    render(<UnifiedSearch />)
    await waitFor(() => expect(screen.getByText('Advanced Search')).toBeInTheDocument())
    expect(screen.getByText('Advanced Search').closest('a')).toHaveAttribute('href', '/advanced-search')
  })
})

// Match precision (Broad/Balanced/Strict) moved to Advanced Search — main
// search has no picker of its own and always runs at "balanced".
describe('UnifiedSearch — Match precision', () => {
  it('shows no Match precision control', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ results: [], total: 0, next_page_token: '', suggested_filters: [] }),
    })))

    render(<UnifiedSearch />)
    await waitFor(() => expect(screen.getByPlaceholderText('Search a posting or ask a question…')).toBeInTheDocument())
    expect(screen.queryByText('Match precision')).not.toBeInTheDocument()
  })

  it('always searches at balanced precision', async () => {
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
    await screen.findByText('H-1B RFE experience')

    const calledUrl = fetchMock.mock.calls[0][0] as string
    expect(calledUrl).toContain('strictness=balanced')
  })
})
