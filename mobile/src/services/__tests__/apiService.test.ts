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
