import React from 'react';
import { renderScreen, fireEvent } from '../../test/render';
import { AuthorByHandleScreen } from '../AuthorByHandleScreen';
import { getPostingsByHandle } from '../../services/apiService';

// Navigation hooks: provide a fixed handle param + spyable nav actions.
// (jest hoists jest.mock; only `mock`-prefixed vars may be referenced inside.)
const mockNavigate = jest.fn();
const mockPush = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, push: mockPush, goBack: jest.fn() }),
  useRoute: () => ({ params: { handle: 'brave-maple-3272' } }),
}));

jest.mock('../../services/apiService', () => ({
  getPostingsByHandle: jest.fn(),
}));

const POSTINGS = [
  { case_id: 'app-1', title: 'H-1B RFE experience', visa: ['H-1B'], consulates: ['BOM'], outcome: 'approved', date: '2026-06-13' },
  { case_id: 'app-2', title: 'EB-2 timeline update', visa: ['EB-2'], consulates: [], outcome: '', date: '2026-06-01' },
];

describe('AuthorByHandleScreen', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockPush.mockClear();
  });

  it("lists the handle's postings with a count and opens a case on tap", async () => {
    (getPostingsByHandle as jest.Mock).mockResolvedValue(POSTINGS);
    const screen = await renderScreen(<AuthorByHandleScreen />);

    expect(await screen.findByText('Postings by brave-maple-3272 (2)')).toBeOnTheScreen();
    expect(screen.getByText('H-1B RFE experience')).toBeOnTheScreen();
    expect(screen.getByText('EB-2 timeline update')).toBeOnTheScreen();
    expect(getPostingsByHandle).toHaveBeenCalledWith('brave-maple-3272');

    fireEvent.press(screen.getByText('H-1B RFE experience'));
    expect(mockPush).toHaveBeenCalledWith('CaseDetails', { caseId: 'app-1' });
  });

  it('shows an empty state when the author has no postings', async () => {
    (getPostingsByHandle as jest.Mock).mockResolvedValue([]);
    const screen = await renderScreen(<AuthorByHandleScreen />);

    expect(await screen.findByText('Postings by brave-maple-3272 (0)')).toBeOnTheScreen();
    expect(screen.getByText('No postings found for this author.')).toBeOnTheScreen();
  });
});
