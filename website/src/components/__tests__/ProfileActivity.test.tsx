import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ProfileActivity from '../ProfileActivity'

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}))
vi.mock('@/lib/activeUser', () => ({
  userHeaders: vi.fn(() => ({ 'X-User-Id': 'syn-01' })),
}))

const POSTINGS = {
  postings: [
    { case_id: 'app-c1', title: 'H-1B stamping at Mumbai', visa: ['H-1B'], consulates: ['BOM'], outcome: 'approved', date: '2026-06-13' },
  ],
}
const REPLIES = {
  replies: [
    { id: 'r1', parent_case_id: 'app-c9', body: 'Great write-up, thanks!', created_at: '2026-06-12T00:00:00Z' },
  ],
}
const GROUPS = {
  groups: [
    { group_id: 'g1', name: 'H-1B Mumbai 2026', criteria_text: 'H-1B · BOM', members: [{ username: 'a' }, { username: 'b' }] },
  ],
}

function mockApi(opts: { empty?: boolean } = {}) {
  global.fetch = vi.fn(async (url: string) => {
    const u = String(url)
    const e = opts.empty
    if (u.includes('/postings')) return { ok: true, status: 200, json: async () => (e ? { postings: [] } : POSTINGS) } as Response
    if (u.includes('/replies')) return { ok: true, status: 200, json: async () => (e ? { replies: [] } : REPLIES) } as Response
    if (u.includes('/api/groups')) return { ok: true, status: 200, json: async () => (e ? { groups: [] } : GROUPS) } as Response
    return { ok: true, status: 200, json: async () => ({}) } as Response
  }) as unknown as typeof fetch
}

beforeEach(() => mockApi())

describe('ProfileActivity — the user’s postings, replies and groups', () => {
  it('renders all three sections with their items and links', async () => {
    render(<ProfileActivity uid="syn-01" />)

    // 1) postings → links to the case
    expect(await screen.findByText('H-1B stamping at Mumbai')).toBeInTheDocument()
    expect(screen.getByText('H-1B stamping at Mumbai').closest('a')).toHaveAttribute('href', '/case/app-c1')

    // 2) activity (replies) → links to the parent posting
    expect(screen.getByText('Great write-up, thanks!').closest('a')).toHaveAttribute('href', '/case/app-c9')

    // 3) groups → links to the group page, with member count
    expect(screen.getByText('H-1B Mumbai 2026').closest('a')).toHaveAttribute('href', '/groups/g1')
    expect(screen.getByText(/2 members/)).toBeInTheDocument()

    // section headers with counts
    expect(screen.getByText('Your Postings')).toBeInTheDocument()
    expect(screen.getByText('Your Activity')).toBeInTheDocument()
    expect(screen.getByText('Your Groups')).toBeInTheDocument()
  })

  it('shows empty-state copy for each section when there is no activity', async () => {
    mockApi({ empty: true })
    render(<ProfileActivity uid="syn-01" />)
    expect(await screen.findByText(/haven’t posted anything/)).toBeInTheDocument()
    expect(screen.getByText(/haven’t replied to any postings/)).toBeInTheDocument()
    expect(screen.getByText(/not part of any group/)).toBeInTheDocument()
  })

  it('fetches nothing when there is no uid', async () => {
    mockApi()
    render(<ProfileActivity uid="" />)
    await waitFor(() => expect(global.fetch).not.toHaveBeenCalled())
  })
})
