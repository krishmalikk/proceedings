import { searchPostings } from '../apiService';

// Regression: searchPostings used to default an empty `q` to the literal
// filler string "immigration visa experience" before building the request
// URL. Discovery Engine relevance-ranks against `q` IN ADDITION TO applying
// any facet filter, so that filler string silently dropped facet-matching
// documents that didn't also relevance-match it — confirmed live: a
// `tags:asylum` filter alone returned the correct 24 postings, but with the
// filler `q` attached it dropped to 3. This is the actual apiService.ts
// implementation (not the mocked module other screen tests use), since the
// bug lived inside the URL-building logic itself.
describe('apiService.searchPostings — no filler q text', () => {
  beforeEach(() => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ results: [], next_page_token: '', suggested_filters: [] }),
    })) as unknown as typeof fetch;
  });

  it('omits the q param entirely for a facet-only search (empty query)', async () => {
    await searchPostings('', { facets: ['tags:asylum'] });

    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).not.toContain('q=');
    expect(calledUrl).toContain(encodeURIComponent('tags:asylum'));
  });

  it('still sends q when the caller passes real typed text', async () => {
    await searchPostings('asylum', {});

    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).toContain('q=asylum');
  });
});

// Advanced Search's News/Cutoff controls — the same URL-building layer this
// bug lived in, so it gets the same direct (non-mocked) unit coverage.
describe('apiService.searchPostings — includeNews / maxAgeDays', () => {
  beforeEach(() => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ results: [], next_page_token: '', suggested_filters: [] }),
    })) as unknown as typeof fetch;
  });

  it('sends include_news=true when includeNews: true is passed', async () => {
    await searchPostings('', { facets: ['tags:asylum'], includeNews: true });

    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).toContain('include_news=true');
  });

  it('sends include_news=false when includeNews: false is passed', async () => {
    await searchPostings('', { facets: ['tags:asylum'], includeNews: false });

    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).toContain('include_news=false');
  });

  it('omits include_news entirely when the caller never passes it (Home/News/Discussions)', async () => {
    await searchPostings('', { facets: ['tags:asylum'] });

    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).not.toContain('include_news');
  });

  it('sends max_age_days when a positive value is passed', async () => {
    await searchPostings('', { facets: ['tags:asylum'], maxAgeDays: 30 });

    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).toContain('max_age_days=30');
  });

  it('omits max_age_days when 0 ("All time") is passed — 0 is the no-restriction sentinel, not a real window', async () => {
    await searchPostings('', { facets: ['tags:asylum'], maxAgeDays: 0 });

    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).not.toContain('max_age_days');
  });

  it('omits max_age_days entirely when the caller never passes it', async () => {
    await searchPostings('', { facets: ['tags:asylum'] });

    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).not.toContain('max_age_days');
  });

  it('combines includeNews=false and maxAgeDays together in the same request', async () => {
    await searchPostings('', { facets: ['tags:asylum'], includeNews: false, maxAgeDays: 90 });

    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).toContain('include_news=false');
    expect(calledUrl).toContain('max_age_days=90');
    expect(calledUrl).toContain(encodeURIComponent('tags:asylum'));
  });
});
