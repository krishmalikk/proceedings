import React from 'react';
import { renderScreen } from '../../test/render';
import { PostingCard, type PostingCardData } from '../PostingCard';

function posting(over: Partial<PostingCardData> = {}): PostingCardData {
  return {
    case_id: 'app-1', title: 'H-1B RFE experience', description: 'desc',
    visa: ['H-1B'], consulates: [], outcome: '', subreddit: '', channel: 'app',
    tags: [], url: '', date: '2026-07-28',
    ...over,
  };
}

// features/ui-changes-1/changes-2-.md item 2: "at least one relevant/main
// tag" must always render — visa first, falling back to a general tag when
// there's no visa/status. Item 1: a distinct "News" pill for news-update.
describe('PostingCard tag/news badges', () => {
  it('renders the visa badge when present (no fallback needed)', async () => {
    const s = await renderScreen(<PostingCard posting={posting({ visa: ['H-1B'], tags: ['timeline'] })} />);
    expect(s.getByText('H-1B')).toBeOnTheScreen();
    expect(s.queryByText('timeline')).toBeNull();
  });

  it('falls back to the first general tag when there is no visa/status', async () => {
    const s = await renderScreen(<PostingCard posting={posting({ visa: [], tags: ['timeline', 'other'] })} />);
    expect(s.getByText('timeline')).toBeOnTheScreen();
  });

  it('shows a distinct "News" pill when tags include news-update', async () => {
    const s = await renderScreen(
      <PostingCard posting={posting({ visa: [], channel: 'gov_news', tags: ['news-update', 'USCIS'] })} />
    );
    expect(s.getByText('News')).toBeOnTheScreen();
    expect(s.getByText('USCIS')).toBeOnTheScreen();
  });

  it('does not show the News pill for a regular posting', async () => {
    const s = await renderScreen(<PostingCard posting={posting({ tags: ['timeline'] })} />);
    expect(s.queryByText('News')).toBeNull();
  });
});
