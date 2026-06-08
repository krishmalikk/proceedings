import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import GroupChat, { type ChatMessage } from '../GroupChat'

vi.mock('@/lib/activeUser', () => ({
  getActiveUser: vi.fn(() => 'demo-arjun'),
  userHeaders: vi.fn(() => ({})),
}))
import { getActiveUser } from '@/lib/activeUser'

const MSGS: ChatMessage[] = [
  { id: 'm1', author_handle: 'mei-f1', text: 'hi from mei', created_at: '2026-06-07T00:00:00.000Z', deleted: false, is_author: false },
  { id: 'm2', author_handle: 'arjun-h1b', text: 'hi from me', created_at: '2026-06-07T00:00:01.000Z', deleted: false, is_author: true },
]

function mockGet(messages: ChatMessage[]) {
  global.fetch = vi.fn(async (url: string, opts?: { method?: string }) => {
    const method = opts?.method || 'GET'
    if (String(url).includes('/messages') && method === 'GET') {
      return { ok: true, status: 200, json: async () => ({ messages, total: messages.length }) } as Response
    }
    return { ok: true, status: 200, json: async () => ({}) } as Response
  }) as unknown as typeof fetch
}

beforeEach(() => {
  ;(getActiveUser as unknown as Mock).mockReturnValue('demo-arjun')
})

describe('GroupChat', () => {
  it('gates behind a user picker when no user is active', async () => {
    ;(getActiveUser as unknown as Mock).mockReturnValue('')
    mockGet([])
    render(<GroupChat groupId="g1" />)
    expect(await screen.findByText(/Select a user/i)).toBeInTheDocument()
  })

  it('renders fetched messages (own vs others)', async () => {
    mockGet(MSGS)
    render(<GroupChat groupId="g1" />)
    expect(await screen.findByText('hi from mei')).toBeInTheDocument()
    expect(screen.getByText('hi from me')).toBeInTheDocument()
    expect(screen.getByText('mei-f1')).toBeInTheDocument() // other author's handle shown
  })

  it('sends a message and appends it optimistically', async () => {
    let posted = false
    global.fetch = vi.fn(async (url: string, opts?: { method?: string }) => {
      const method = opts?.method || 'GET'
      if (String(url).includes('/messages') && method === 'POST') {
        posted = true
        return {
          ok: true, status: 200,
          json: async () => ({ id: 'm3', author_handle: 'arjun-h1b', text: 'brand new', created_at: '2026-06-07T00:00:05.000Z', deleted: false, is_author: true }),
        } as Response
      }
      return { ok: true, status: 200, json: async () => ({ messages: [], total: 0 }) } as Response
    }) as unknown as typeof fetch

    render(<GroupChat groupId="g1" />)
    const input = await screen.findByPlaceholderText(/Message your group/i)
    fireEvent.change(input, { target: { value: 'brand new' } })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))

    await waitFor(() => expect(posted).toBe(true))
    expect(await screen.findByText('brand new')).toBeInTheDocument()
    const body = JSON.parse((global.fetch as unknown as Mock).mock.calls.find((c) => (c[1]?.method) === 'POST')![1].body)
    expect(body).toEqual({ text: 'brand new' })
  })

  it('shows a not-a-member notice when the list returns 403', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 403, json: async () => ({ detail: 'denied' }) }) as Response) as unknown as typeof fetch
    render(<GroupChat groupId="g1" />)
    expect(await screen.findByText(/not a member/i)).toBeInTheDocument()
  })

  it('shows an empty state when there are no messages', async () => {
    mockGet([])
    render(<GroupChat groupId="g1" />)
    expect(await screen.findByText(/No messages yet/i)).toBeInTheDocument()
  })

  it('lets the author delete their own message (no delete control on others)', async () => {
    let deleted = false
    global.fetch = vi.fn(async (url: string, opts?: { method?: string }) => {
      const method = opts?.method || 'GET'
      if (method === 'DELETE') { deleted = true; return { ok: true, status: 200, json: async () => ({ ok: true }) } as Response }
      if (String(url).includes('/messages') && method === 'GET') {
        return { ok: true, status: 200, json: async () => ({ messages: MSGS, total: MSGS.length }) } as Response
      }
      return { ok: true, status: 200, json: async () => ({ messages: [], total: 0 }) } as Response
    }) as unknown as typeof fetch

    render(<GroupChat groupId="g1" />)
    await screen.findByText('hi from me')
    const delButtons = screen.getAllByLabelText('Delete message') // only the author's own message
    expect(delButtons).toHaveLength(1)
    fireEvent.click(delButtons[0])
    await waitFor(() => expect(deleted).toBe(true))
    expect(await screen.findByText('message deleted')).toBeInTheDocument()
  })

  it('surfaces a send error and does not append the message', async () => {
    global.fetch = vi.fn(async (url: string, opts?: { method?: string }) => {
      const method = opts?.method || 'GET'
      if (method === 'POST') return { ok: false, status: 503, json: async () => ({ detail: 'Unable to reach the chat service.' }) } as Response
      return { ok: true, status: 200, json: async () => ({ messages: [], total: 0 }) } as Response
    }) as unknown as typeof fetch

    render(<GroupChat groupId="g1" />)
    const input = await screen.findByPlaceholderText(/Message your group/i)
    fireEvent.change(input, { target: { value: 'will fail' } })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))
    expect(await screen.findByText(/Unable to reach the chat service/i)).toBeInTheDocument()
    expect(screen.queryByText('will fail')).toBeNull()
  })
})
