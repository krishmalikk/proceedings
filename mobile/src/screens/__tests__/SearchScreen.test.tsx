import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { renderScreen, fireEvent, waitFor } from '../../test/render';
import { SearchScreen } from '../SearchScreen';
import { browsePostings, searchPostings, fetchQueryTags } from '../../services/apiService';

const TEST_METRICS = { insets: { top: 0, right: 0, bottom: 0, left: 0 }, frame: { x: 0, y: 0, width: 390, height: 844 } };
async function renderSearch(navigation: { navigate: jest.Mock } = { navigate: jest.fn() }) {
  const s = await renderScreen(
    <SafeAreaProvider initialMetrics={TEST_METRICS}>
      <SearchScreen navigation={navigation} />
    </SafeAreaProvider>
  );
  // Let the mount-time loadFeed() settle before interacting, so it doesn't
  // race with the search we're about to submit.
  await waitFor(() => expect(browsePostings).toHaveBeenCalled());
  return s;
}

jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ isBlocked: () => false }) }));
jest.mock('../../services/apiService', () => {
  const actual = jest.requireActual('../../services/apiService');
  return {
    ...actual,
    browsePostings: jest.fn(),
    searchPostings: jest.fn(),
    fetchQueryTags: jest.fn(),
  };
});

const POSTING = {
  case_id: 'app-1', title: 'H-1B RFE experience', description: '', visa: ['H-1B'],
  consulates: [], outcome: '', subreddit: '', channel: 'app', tags: [], url: '',
  date: '2026-07-28',
};

beforeEach(() => {
  jest.clearAllMocks();
  (browsePostings as jest.Mock).mockResolvedValue({ results: [], next_page_token: '', suggested_filters: [] });
  (searchPostings as jest.Mock).mockResolvedValue({ results: [POSTING], next_page_token: '', suggested_filters: [] });
  (fetchQueryTags as jest.Mock).mockResolvedValue([]);
});

// features/ui-changes-1/changes-2-.md item 4: query-derived tag chips, fired
// once per search submit (not per keystroke) and toggled through the same
// selectedFacets mechanism as the "Refine by" backend facets.
describe('SearchScreen — query-derived tag chips', () => {
  it('fetches query tags on submit and renders them as toggleable chips', async () => {
    (fetchQueryTags as jest.Mock).mockResolvedValue([
      { field: 'tags', code: 'RFE', label: 'RFE' },
      { field: 'tags', code: 'POE', label: 'POE' },
    ]);

    const s = await renderSearch();
    await fireEvent.changeText(s.getByPlaceholderText('Search USA visits/migration journey…'), 'H1B RFE POE Boston');
    await fireEvent.press(s.getByText('Search'));

    await waitFor(() => expect(fetchQueryTags).toHaveBeenCalledWith('H1B RFE POE Boston'));
    expect(await s.findByText('RFE')).toBeOnTheScreen();
    expect(s.getByText('POE')).toBeOnTheScreen();
  });

  it('toggling a query-tag chip re-runs the search with that facet applied', async () => {
    (fetchQueryTags as jest.Mock).mockResolvedValue([{ field: 'tags', code: 'RFE', label: 'RFE' }]);

    const s = await renderSearch();
    await fireEvent.changeText(s.getByPlaceholderText('Search USA visits/migration journey…'), 'H1B RFE');
    await fireEvent.press(s.getByText('Search'));
    const chip = await s.findByText('RFE');

    await fireEvent.press(chip);

    await waitFor(() =>
      expect(searchPostings).toHaveBeenLastCalledWith(
        'H1B RFE',
        expect.objectContaining({ facets: ['tags:RFE'] })
      )
    );
  });

  it('does not show the query-tags row when there are none', async () => {
    const s = await renderSearch();
    await fireEvent.changeText(s.getByPlaceholderText('Search USA visits/migration journey…'), 'a plain query');
    await fireEvent.press(s.getByText('Search'));

    await s.findByText('H-1B RFE experience');
    expect(s.queryByText('Tags from your search')).toBeNull();
  });
});
