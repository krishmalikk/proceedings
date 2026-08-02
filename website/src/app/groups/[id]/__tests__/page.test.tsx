import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import GroupPage from '../page'

vi.mock('next/navigation', () => ({ useParams: () => ({ id: 'g1' }) }))
vi.mock('@/lib/useRequireUser', () => ({ useRequireUser: () => {} }))
vi.mock('@/lib/activeUser', () => ({ userHeaders: vi.fn((h?: Record<string, string>) => h || {}) }))
vi.mock('@/components/GroupChat', () => ({ default: () => <div data-testid="group-chat" /> }))

const BASE_GROUP = {
  group_id: 'g1', name: 'Mumbai H-1B crew', description: 'H-1B folks near BOM',
  criteria_text: 'looking for H-1B folks at Mumbai',
  members: [
    { user_id: 'demo-arjun', username: 'arjun-h1b' },
    { user_id: 'demo-mei', username: 'mei-f1' },
  ],
  created_by: 'demo-arjun',
  is_admin: false,
  is_member: true,
  created_at: '2026-06-07T00:00:00.000Z',
  last_activity_at: '2026-06-07T00:05:00.000Z',
}

function mockGroup(overrides: Record<string, unknown> = {}) {
  global.fetch = vi.fn(async (url: string, opts?: { method?: string }) => {
    const method = opts?.method || 'GET'
    if (String(url).includes('/invite')) {
      return { ok: true, status: 200, json: async () => ({ ...BASE_GROUP, ...overrides, members: [...BASE_GROUP.members, { user_id: 'demo-omar', username: 'omar-b1b2' }] }) } as Response
    }
    if (method === 'PUT') {
      const body = JSON.parse((opts as { body?: string })?.body || '{}')
      return { ok: true, status: 200, json: async () => ({ ...BASE_GROUP, ...overrides, ...body }) } as Response
    }
    return { ok: true, status: 200, json: async () => ({ ...BASE_GROUP, ...overrides }) } as Response
  }) as unknown as typeof fetch
}

beforeEach(() => vi.restoreAllMocks())

describe('GroupPage — metadata + admin badge', () => {
  it('renders name, description, and dates', async () => {
    mockGroup()
    render(<GroupPage />)
    expect(await screen.findByText('Mumbai H-1B crew')).toBeInTheDocument()
    expect(screen.getByText('H-1B folks near BOM')).toBeInTheDocument()
    expect(screen.getByText(/Created/)).toBeInTheDocument()
    expect(screen.getByText(/Last activity/)).toBeInTheDocument()
  })

  it('shows an "Admin" badge next to the creator, not other members', async () => {
    mockGroup()
    render(<GroupPage />)
    await screen.findByText('arjun-h1b')
    const adminBadges = screen.getAllByText('Admin')
    expect(adminBadges).toHaveLength(1)
  })
})

describe('GroupPage — rename (admin-only)', () => {
  it('does not show a Rename affordance for a non-admin viewer', async () => {
    mockGroup({ is_admin: false })
    render(<GroupPage />)
    await screen.findByText('Mumbai H-1B crew')
    expect(screen.queryByText('Rename')).toBeNull()
  })

  it('lets the admin rename the group, PUTting the new name + description', async () => {
    mockGroup({ is_admin: true })
    render(<GroupPage />)
    await screen.findByText('Mumbai H-1B crew')

    fireEvent.click(screen.getByText('Rename'))
    const nameInput = screen.getByDisplayValue('Mumbai H-1B crew')
    fireEvent.change(nameInput, { target: { value: 'BOM H-1B group' } })
    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => {
      const putCall = (global.fetch as unknown as Mock).mock.calls.find((c) => c[1]?.method === 'PUT')
      expect(putCall).toBeTruthy()
    })
    const putCall = (global.fetch as unknown as Mock).mock.calls.find((c) => c[1]?.method === 'PUT')!
    expect(JSON.parse(putCall[1].body)).toEqual({ name: 'BOM H-1B group', description: 'H-1B folks near BOM' })
    expect(await screen.findByText('BOM H-1B group')).toBeInTheDocument()
  })
})

describe('GroupPage — invite by handle (any member)', () => {
  it('invites a handle and reflects the added member', async () => {
    mockGroup()
    render(<GroupPage />)
    await screen.findByText('Mumbai H-1B crew')

    const input = screen.getByPlaceholderText('their handle…')
    fireEvent.change(input, { target: { value: 'omar-b1b2' } })
    fireEvent.click(screen.getByText('Invite'))

    await waitFor(() => {
      const inviteCall = (global.fetch as unknown as Mock).mock.calls.find((c) => String(c[0]).includes('/invite'))
      expect(inviteCall).toBeTruthy()
    })
    const inviteCall = (global.fetch as unknown as Mock).mock.calls.find((c) => String(c[0]).includes('/invite'))!
    expect(JSON.parse(inviteCall[1].body)).toEqual({ handle: 'omar-b1b2' })
    expect(await screen.findByText('omar-b1b2')).toBeInTheDocument()
  })

  it('surfaces an error when the handle is not found', async () => {
    global.fetch = vi.fn(async (url: string, opts?: { method?: string }) => {
      if (String(url).includes('/invite')) {
        return { ok: false, status: 422, json: async () => ({ detail: 'No user with the handle "nope".' }) } as Response
      }
      return { ok: true, status: 200, json: async () => BASE_GROUP } as Response
    }) as unknown as typeof fetch
    render(<GroupPage />)
    await screen.findByText('Mumbai H-1B crew')

    fireEvent.change(screen.getByPlaceholderText('their handle…'), { target: { value: 'nope' } })
    fireEvent.click(screen.getByText('Invite'))
    expect(await screen.findByText(/No user with the handle/)).toBeInTheDocument()
  })

  it('clears the invite input after a successful invite', async () => {
    mockGroup()
    render(<GroupPage />)
    await screen.findByText('Mumbai H-1B crew')

    const input = screen.getByPlaceholderText('their handle…') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'omar-b1b2' } })
    fireEvent.click(screen.getByText('Invite'))

    await waitFor(() => expect(input.value).toBe(''))
  })
})

describe('GroupPage — rename cancel + validation', () => {
  it('Cancel restores the original name/description and does not call PUT', async () => {
    mockGroup({ is_admin: true })
    render(<GroupPage />)
    await screen.findByText('Mumbai H-1B crew')

    fireEvent.click(screen.getByText('Rename'))
    const nameInput = screen.getByDisplayValue('Mumbai H-1B crew')
    fireEvent.change(nameInput, { target: { value: 'Something Else' } })
    fireEvent.click(screen.getByText('Cancel'))

    expect(screen.getByText('Mumbai H-1B crew')).toBeInTheDocument()
    expect(screen.queryByText('Something Else')).toBeNull()
    expect((global.fetch as unknown as Mock).mock.calls.some((c) => c[1]?.method === 'PUT')).toBe(false)
  })

  it('disables Save when the name draft is empty/whitespace-only', async () => {
    mockGroup({ is_admin: true })
    render(<GroupPage />)
    await screen.findByText('Mumbai H-1B crew')

    fireEvent.click(screen.getByText('Rename'))
    const nameInput = screen.getByDisplayValue('Mumbai H-1B crew')
    fireEvent.change(nameInput, { target: { value: '   ' } })

    expect(screen.getByText('Save')).toBeDisabled()
  })
})

describe('GroupPage — empty description, loading, and error states', () => {
  it('renders no description paragraph when the group has none', async () => {
    mockGroup({ description: '' })
    render(<GroupPage />)
    await screen.findByText('Mumbai H-1B crew')
    expect(screen.queryByText('H-1B folks near BOM')).toBeNull()
  })

  it('shows a loading state before the fetch resolves', () => {
    global.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch
    render(<GroupPage />)
    expect(screen.getByText('Loading group…')).toBeInTheDocument()
  })

  it('surfaces an error when the group fails to load', async () => {
    global.fetch = vi.fn(async () =>
      ({ ok: false, status: 404, json: async () => ({ detail: 'Group not found' }) }) as Response
    ) as unknown as typeof fetch
    render(<GroupPage />)
    expect(await screen.findByText('Group not found')).toBeInTheDocument()
  })
})
