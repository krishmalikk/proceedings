import React from 'react';
import { renderScreen, fireEvent } from '../../test/render';
import { CaseDetailsScreen } from '../CaseDetailsScreen';
import { getPosting } from '../../services/apiService';

jest.mock('../../services/apiService', () => ({ getPosting: jest.fn() }));
// Stub the heavy children that fetch on their own - isolate the screen's own UI.
jest.mock('../../components/VoteControl', () => ({ VoteControl: () => null }));
jest.mock('../../components/Replies', () => ({ Replies: () => null }));
jest.mock('../../components/AuthorCard', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return { AuthorCard: ({ authorId }: any) => React.createElement(Text, null, 'AUTHORCARD:' + authorId) };
});

const BASE = {
  case_id: 'app-1', title: 'My H-1B experience', description: '', visa: ['H-1B'],
  consulates: [], outcome: '', subreddit: '', channel: 'app', tags: [], url: '',
  date: '2026-06-13', body: '', author_id: '', author_handle: '', tag_sections: [],
};

function mockPosting(over: Record<string, unknown>) {
  (getPosting as jest.Mock).mockResolvedValue({ ...BASE, ...over });
}

const makeNav = () => ({ navigate: jest.fn(), push: jest.fn(), goBack: jest.fn() });
const route = { params: { caseId: 'app-1' } };

describe('CaseDetailsScreen', () => {
  it('renders every tag category as its own labeled section', async () => {
    mockPosting({
      tag_sections: [
        { label: 'Applying for', tags: ['EB-2'] },
        { label: 'Concerns & questions', tags: ['rfe', 'wage-compliance'] },
      ],
    });
    const screen = await renderScreen(<CaseDetailsScreen navigation={makeNav()} route={route} />);

    expect(await screen.findByText('Applying for')).toBeOnTheScreen();
    expect(screen.getByText('Concerns & questions')).toBeOnTheScreen();
    expect(screen.getByText('EB-2')).toBeOnTheScreen();
    expect(screen.getByText('rfe')).toBeOnTheScreen();
  });

  it('first-party posting (handle, no uid): shows a tappable author → AuthorByHandle', async () => {
    mockPosting({ author_id: '', author_handle: 'brave-maple-3272' });
    const navigation = makeNav();
    const screen = await renderScreen(<CaseDetailsScreen navigation={navigation} route={route} />);

    const handle = await screen.findByText('brave-maple-3272');
    fireEvent.press(handle);
    expect(navigation.navigate).toHaveBeenCalledWith('AuthorByHandle', { handle: 'brave-maple-3272' });
    // the rich uid-based card must NOT render here
    expect(screen.queryByText(/AUTHORCARD:/)).toBeNull();
  });

  it('in-app author (real uid): renders the rich AuthorCard, not the handle card', async () => {
    mockPosting({ author_id: 'user-9', author_handle: 'brave-maple-3272' });
    const screen = await renderScreen(<CaseDetailsScreen navigation={makeNav()} route={route} />);

    expect(await screen.findByText('AUTHORCARD:user-9')).toBeOnTheScreen();
    expect(screen.queryByText('brave-maple-3272')).toBeNull();
  });
});
