import { render, screen, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import MembersPage from '../page'

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(), useParams: () => ({ id: 'g1' }) }))
vi.mock('@/lib/useRequireUser', () => ({ useRequireUser: () => {} }))
vi.mock('@/lib/activeUser', () => ({
  userHeaders: vi.fn((h?: Record<string, string>) => h || {}),
  getActiveUser: vi.fn(() => 'demo-arjun'),
}))

const TEMPLATES = {
  'stem-opt-extension': [
    { kind: 'date', label: 'Date Applied', field: 'key_dates', key: 'ead_filed_date' },
    { kind: 'date', label: 'EAD Received', field: 'key_dates', key: 'ead_approved_date' },
    { kind: 'checkbox', label: 'Premium Processing', field: 'key_stages_or_info', key: 'premium_processing' },
  ],
}

const GROUP = {
  group_id: 'g1', name: 'Fall 2026 STEM OPT', group_type: 'timeline',
  criteria_tags: { tags: ['stem-opt-extension'] },
  members: [
    { user_id: 'demo-arjun', username: 'arjun-h1b' },
    { user_id: 'demo-mei', username: 'mei-f1' },
  ],
  is_member: true,
}

const ATTRS = [
  {
    user_id: 'demo-arjun', username: 'arjun-h1b', processing_type: 'stem-opt-extension',
    values: { ead_filed_date: '2026-03-01', ead_approved_date: '2026-05-20', premium_processing: 'yes' },
    notes: 'filed early', submitted_at: '', updated_at: '',
  },
]

function mockFetch(group: Record<string, unknown> = GROUP, attributes = ATTRS) {
  global.fetch = vi.fn(async (url: string) => {
    if (String(url).includes('/api/tag-vocab')) {
      return { ok: true, status: 200, json: async () => ({ post_join_attribute_templates: TEMPLATES }) } as Response
    }
    if (String(url).includes('/attributes')) {
      return { ok: true, status: 200, json: async () => ({ attributes }) } as Response
    }
    return { ok: true, status: 200, json: async () => group } as Response
  }) as unknown as typeof fetch
}

beforeEach(() => { vi.restoreAllMocks() })

describe('GroupMembersPage', () => {
  it('renders one row per member, with a dash where nothing was submitted', async () => {
    mockFetch()
    render(<MembersPage />)

    await screen.findByText('Fall 2026 STEM OPT')
    const table = screen.getByRole('table')
    const rows = within(table).getAllByRole('row')
    // header + one row per member
    expect(rows).toHaveLength(1 + GROUP.members.length)

    const arjun = within(table).getByText('arjun-h1b').closest('tr')!
    expect(within(arjun).getByText('2026-03-01')).toBeInTheDocument()
    expect(within(arjun).getByText('2026-05-20')).toBeInTheDocument()
    expect(within(arjun).getByText('filed early')).toBeInTheDocument()

    // mei submitted nothing — every cell falls back to an em dash
    // (3 attribute columns + notes).
    const mei = within(table).getByText('mei-f1').closest('tr')!
    expect(within(mei).getAllByText('—')).toHaveLength(4)
  })

  it('takes its columns from the matched attribute template', async () => {
    mockFetch()
    render(<MembersPage />)

    await screen.findByText('Fall 2026 STEM OPT')
    const headers = within(screen.getByRole('table')).getAllByRole('columnheader').map((h) => h.textContent)
    expect(headers).toEqual(['Member', 'Date Applied', 'EAD Received', 'Premium Processing', 'Notes'])
  })

  it('links back to the group', async () => {
    mockFetch()
    render(<MembersPage />)

    await screen.findByText('Fall 2026 STEM OPT')
    expect(screen.getByText('Back to group').closest('a')).toHaveAttribute('href', '/groups/g1')
  })

  it('shows nothing to a non-member', async () => {
    mockFetch({ ...GROUP, is_member: false })
    render(<MembersPage />)

    expect(await screen.findByText('Only members can see this.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('explains itself when the group collects no attributes at all', async () => {
    mockFetch({ ...GROUP, group_type: '', criteria_tags: {} })
    render(<MembersPage />)

    expect(await screen.findByText(/doesn.t collect timeline attributes/)).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('surfaces a load failure instead of rendering an empty table', async () => {
    global.fetch = vi.fn(async (url: string) => {
      if (String(url).includes('/api/tag-vocab')) return { ok: true, status: 200, json: async () => ({}) } as Response
      if (String(url).includes('/attributes')) return { ok: false, status: 403, json: async () => ({}) } as Response
      return { ok: false, status: 404, json: async () => ({ detail: 'No such group.' }) } as Response
    }) as unknown as typeof fetch
    render(<MembersPage />)

    expect(await screen.findByText('No such group.')).toBeInTheDocument()
  })
})

describe('GroupMembersPage — compact, kind-aware columns', () => {
  it('lets long headers wrap to two lines instead of forcing a scroll', async () => {
    mockFetch()
    render(<MembersPage />)

    await screen.findByText('Fall 2026 STEM OPT')
    const header = screen.getByText('Premium Processing')
    // The clamp sits on an inner span so the <th> keeps table-cell layout.
    expect(header.tagName).toBe('SPAN')
    expect(header).toHaveClass('line-clamp-2')
    expect(header.closest('th')).not.toHaveClass('whitespace-nowrap')
    // Full text stays reachable when it clips.
    expect(header.closest('th')).toHaveAttribute('title', 'Premium Processing')
  })

  it('shows a checkbox column as a tick, never the raw stored "yes"', async () => {
    mockFetch()
    render(<MembersPage />)

    await screen.findByText('Fall 2026 STEM OPT')
    const arjun = screen.getByText('arjun-h1b').closest('tr')!
    expect(within(arjun).getByTitle('Yes')).toBeInTheDocument()
    expect(within(arjun).queryByText('yes')).toBeNull()
  })
})
