import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import PostingCard, { type PostingCardData } from '../PostingCard'

function posting(over: Partial<PostingCardData> = {}): PostingCardData {
  return {
    case_id: 'app-1', title: 'H-1B RFE experience', description: 'desc',
    visa: ['H-1B'], consulates: [], outcome: '', subreddit: '', channel: 'app',
    tags: [], url: '', date: '2026-07-28',
    ...over,
  }
}

// features/ui-changes-1/changes-2-.md item 2: "at least one relevant/main
// tag" must always render — visa first, falling back to a general tag when
// there's no visa/status. Item 1: a distinct "News" pill for news-update.
describe('PostingCard tag/news badges', () => {
  it('renders the visa badge when present (no fallback needed)', () => {
    render(<PostingCard r={posting({ visa: ['H-1B'], tags: ['timeline'] })} />)
    expect(screen.getByText('H-1B')).toBeInTheDocument()
    // The general tag is NOT also shown as a fallback badge when visa exists.
    expect(screen.queryByText('timeline')).not.toBeInTheDocument()
  })

  it('falls back to the first general tag when there is no visa/status', () => {
    render(<PostingCard r={posting({ visa: [], tags: ['timeline', 'other'] })} />)
    expect(screen.getByText('timeline')).toBeInTheDocument()
  })

  it('shows nothing extra when there is neither visa nor tags', () => {
    render(<PostingCard r={posting({ visa: [], tags: [] })} />)
    expect(screen.queryByText('News')).not.toBeInTheDocument()
  })

  it('shows a distinct "News" pill when tags include news-update', () => {
    render(<PostingCard r={posting({ visa: [], channel: 'gov_news', tags: ['news-update', 'USCIS'] })} />)
    expect(screen.getByText('News')).toBeInTheDocument()
    // news-update itself is never used as the fallback tag badge.
    expect(screen.getByText('USCIS')).toBeInTheDocument()
  })

  it('does not show the News pill for a regular posting', () => {
    render(<PostingCard r={posting({ tags: ['timeline'] })} />)
    expect(screen.queryByText('News')).not.toBeInTheDocument()
  })
})
