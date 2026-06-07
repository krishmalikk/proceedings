import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import MatchCard, { type MatchData } from '../MatchCard'

function match(over: Partial<MatchData> = {}): MatchData {
  return {
    user_id: 'demo-mei',
    username: 'mei-f1',
    score: 5.5,
    shared: ['H-1B', 'BOM', 'citizen_of_country=IN'],
    summary: 'H-1B · BOM',
    ...over,
  }
}

describe('MatchCard', () => {
  it('renders the username, score, summary, and shared chips', () => {
    render(<MatchCard m={match()} checked={false} onToggle={vi.fn()} />)
    expect(screen.getByText('mei-f1')).toBeInTheDocument()
    expect(screen.getByText('match 5.5')).toBeInTheDocument()
    expect(screen.getByText('H-1B · BOM')).toBeInTheDocument()
    expect(screen.getByText('citizen_of_country=IN')).toBeInTheDocument()
  })

  it('reflects the checked state and toggles by user_id', () => {
    const onToggle = vi.fn()
    const { rerender } = render(<MatchCard m={match()} checked={false} onToggle={onToggle} />)
    const box = screen.getByLabelText('Include mei-f1') as HTMLInputElement
    expect(box.checked).toBe(false)
    fireEvent.click(box)
    expect(onToggle).toHaveBeenCalledWith('demo-mei')

    rerender(<MatchCard m={match()} checked onToggle={onToggle} />)
    expect((screen.getByLabelText('Include mei-f1') as HTMLInputElement).checked).toBe(true)
  })
})
