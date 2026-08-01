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

  // Phase D: Discussions tab — same badge pattern as News, for the two
  // tags (discussion/blog) that scope the new tab's content.
  it('shows a distinct "Discussion" pill when tags include discussion', () => {
    render(<PostingCard r={posting({ visa: [], tags: ['discussion', 'family-based-immigration'] })} />)
    expect(screen.getByText('Discussion')).toBeInTheDocument()
    // discussion itself is never used as the fallback tag badge.
    expect(screen.getByText('family-based-immigration')).toBeInTheDocument()
  })

  it('shows a distinct "Blog" pill when tags include blog', () => {
    render(<PostingCard r={posting({ visa: [], tags: ['blog', 'h1b-lottery'] })} />)
    expect(screen.getByText('Blog')).toBeInTheDocument()
    expect(screen.getByText('h1b-lottery')).toBeInTheDocument()
  })

  // discussion/blog/news-update aren't mutually exclusive (Phase B: a
  // link-share reacting to news gets both news-update and discussion) — all
  // applicable pills must render together, and the fallback tag badge must
  // skip all three, not just whichever one happens to be present.
  it('shows News, Discussion, and Blog pills together when a card carries all three tags', () => {
    render(<PostingCard r={posting({ visa: [], tags: ['news-update', 'discussion', 'blog', 'OPT'] })} />)
    expect(screen.getByText('News')).toBeInTheDocument()
    expect(screen.getByText('Discussion')).toBeInTheDocument()
    expect(screen.getByText('Blog')).toBeInTheDocument()
    expect(screen.getByText('OPT')).toBeInTheDocument()
  })

  it('the fallback tag badge skips news-update, discussion, AND blog, not just one of them', () => {
    render(<PostingCard r={posting({ visa: [], tags: ['news-update', 'discussion', 'blog'] })} />)
    // No fourth "general tag" badge exists to fall back to here — all three
    // present tags are exemption tags, each with its own dedicated pill;
    // none of them should also render as the generic fallback badge text.
    expect(screen.getAllByText('News')).toHaveLength(1)
    expect(screen.getAllByText('Discussion')).toHaveLength(1)
    expect(screen.getAllByText('Blog')).toHaveLength(1)
  })
})
