import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import ReplyItem, { type ReplyCardData } from '../ReplyItem'

// VoteControl (a child) reads activeUser on click only; stub it for isolation.
vi.mock('@/lib/activeUser', () => ({
  getActiveUser: vi.fn(() => 'demo-arjun'),
  userHeaders: vi.fn(() => ({})),
}))

function makeReply(over: Partial<ReplyCardData> = {}): ReplyCardData {
  return {
    id: 'r1',
    parent_case_id: 'p1',
    body: 'A helpful reply about H-1B stamping.',
    author_handle: 'arjun-h1b',
    created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
    deleted: false,
    up: 3,
    down: 1,
    score: 2,
    your_vote: 0,
    is_author: false,
    ...over,
  }
}

beforeEach(() => {
  global.fetch = vi.fn()
})

describe('ReplyItem', () => {
  it('renders the author, body, and score', () => {
    render(<ReplyItem r={makeReply()} onDelete={vi.fn()} />)
    expect(screen.getByText('arjun-h1b')).toBeInTheDocument()
    expect(screen.getByText('A helpful reply about H-1B stamping.')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument() // score from the VoteControl rail
    expect(screen.getByText('5m ago')).toBeInTheDocument()
  })

  it('shows the delete control only to the author and calls onDelete', () => {
    const onDelete = vi.fn()
    render(<ReplyItem r={makeReply({ is_author: true })} onDelete={onDelete} />)
    const del = screen.getByLabelText('Delete reply')
    fireEvent.click(del)
    expect(onDelete).toHaveBeenCalledWith('r1')
  })

  it('hides the delete control from non-authors', () => {
    render(<ReplyItem r={makeReply({ is_author: false })} onDelete={vi.fn()} />)
    expect(screen.queryByLabelText('Delete reply')).toBeNull()
  })

  it('renders "just now" for a fresh reply', () => {
    render(<ReplyItem r={makeReply({ created_at: new Date().toISOString() })} onDelete={vi.fn()} />)
    expect(screen.getByText('just now')).toBeInTheDocument()
  })
})
