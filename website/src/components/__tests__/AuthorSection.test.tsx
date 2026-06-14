import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import AuthorSection from '../AuthorSection'

// next/link → plain anchor so we can assert hrefs; Markdown → passthrough.
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}))
vi.mock('@/components/Markdown', () => ({ default: ({ children }: { children: string }) => <div>{children}</div> }))

// user-1's profile — the SAME shape the profile page renders, so the author
// section must show exactly these tags (item: matches user-1's own profile).
const USER1_PROFILE = {
  username: 'arjun-h1b',
  current_visa_or_greencard_category: ['H-1B'],
  visa_applying_for: ['EB-3'],
  primary_consulate: 'BOM',
  consulates: ['BOM'],
  tags: ['premium-processing'],
  key_stages_or_info: { 'I-140': 'filed' },
  key_dates: { priority_date: '2026-04-03' },
  background_text: '',
  journey: [],
}
const USER1_POSTINGS = {
  postings: [
    { case_id: 'app-c1', title: 'H-1B stamping at Mumbai', visa: ['H-1B'], consulates: ['BOM'], outcome: 'approved', date: '2026-06-13' },
    { case_id: 'app-c2', title: 'EB-3 I-485 RFE response', visa: ['EB-3'], consulates: [], outcome: 'RFE', date: '2026-06-13' },
  ],
}
const VOCAB = { consulate_options: [{ code: 'BOM', label: 'Mumbai, India (BOM)' }] }

function mockApi(opts: { profile?: unknown } = {}) {
  global.fetch = vi.fn(async (url: string) => {
    const u = String(url)
    if (u.includes('/public-profile')) {
      const p = 'profile' in opts ? opts.profile : USER1_PROFILE
      return { ok: p !== null, status: p ? 200 : 404, json: async () => p } as Response
    }
    if (u.includes('/postings')) return { ok: true, status: 200, json: async () => USER1_POSTINGS } as Response
    if (u.includes('/tag-vocab')) return { ok: true, status: 200, json: async () => VOCAB } as Response
    return { ok: true, status: 200, json: async () => ({}) } as Response
  }) as unknown as typeof fetch
}

beforeEach(() => mockApi())

describe('AuthorSection', () => {
  it('omits entirely for non-app (Reddit) postings', () => {
    const { container } = render(<AuthorSection authorId="" channel="reddit" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows an Anonymous note for an app posting with no known author', () => {
    render(<AuthorSection authorId="" channel="app" />)
    expect(screen.getByText('Anonymous author')).toBeInTheDocument()
  })

  it("renders user-1's structured profile tags matching their profile", async () => {
    render(<AuthorSection authorId="user-1" channel="app" currentCaseId="app-c1" />)
    // username
    expect(await screen.findByText('arjun-h1b')).toBeInTheDocument()
    // section headings
    expect(screen.getByText('Visa Status')).toBeInTheDocument()
    expect(screen.getByText('Consulates')).toBeInTheDocument()
    expect(screen.getByText('Tags')).toBeInTheDocument()
    expect(screen.getByText('Key Stages')).toBeInTheDocument()
    expect(screen.getByText('Key Dates')).toBeInTheDocument()
    // the EXACT tag values from user-1's profile
    expect(screen.getByText('H-1B')).toBeInTheDocument()                     // current status
    expect(screen.getAllByText('EB-3').length).toBeGreaterThanOrEqual(1)     // applying for (also a posting badge)
    expect(screen.getByText('Mumbai, India (BOM)')).toBeInTheDocument()      // consulate code → label
    expect(screen.getByText('premium-processing')).toBeInTheDocument()       // misc tag
    // key stage / date render as "key:" + a nested value span
    expect(screen.getByText(/I-140/)).toBeInTheDocument()
    expect(screen.getByText('filed')).toBeInTheDocument()
    expect(screen.getByText(/Priority Date/)).toBeInTheDocument()
    expect(screen.getByText('2026-04-03')).toBeInTheDocument()
  })

  it('links to the author profile page (user-2 can navigate to user-1)', async () => {
    render(<AuthorSection authorId="user-1" channel="app" currentCaseId="app-c1" />)
    const viewProfile = (await screen.findByText('View profile')).closest('a')
    expect(viewProfile).toHaveAttribute('href', '/author/user-1')
  })

  it("lists user-1's OTHER postings as links, excluding the current one", async () => {
    render(<AuthorSection authorId="user-1" channel="app" currentCaseId="app-c1" />)
    // current posting (app-c1) is excluded; the other (app-c2) is a clickable link
    const other = (await screen.findByText('EB-3 I-485 RFE response')).closest('a')
    expect(other).toHaveAttribute('href', '/case/app-c2')
    expect(screen.queryByText('H-1B stamping at Mumbai')).not.toBeInTheDocument()
    expect(screen.getByText(/More postings by this author/)).toBeInTheDocument()
  })

  it('handles an author who has not set up a profile', async () => {
    mockApi({ profile: null })
    render(<AuthorSection authorId="user-1" channel="app" />)
    expect(await screen.findByText(/hasn’t set up a profile yet/)).toBeInTheDocument()
  })
})
