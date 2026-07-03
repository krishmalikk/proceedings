import React from 'react';
import { renderScreen, fireEvent, waitFor } from '../../test/render';
import { ContentActionsMenu } from '../ContentActionsMenu';
import { reportContent } from '../../services/apiService';

// Isolate the menu from the real auth context + network.
// (jest hoists mock factories — only `mock*`-prefixed vars may be referenced.)
const mockBlockUser = jest.fn(async () => {});
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'me' }, blockUser: mockBlockUser }),
}));
jest.mock('../../services/apiService', () => ({
  reportContent: jest.fn(async () => ({ ok: true, report_count: 1, hidden: false })),
}));

describe('ContentActionsMenu', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders nothing on the viewer\'s own content', async () => {
    const s = await renderScreen(
      <ContentActionsMenu contentId="r1" contentType="reply" isAuthor authorId="me" />
    );
    expect(s.queryByLabelText('More actions')).toBeNull();
  });

  it('treats content authored by the current uid as own (hidden)', async () => {
    const s = await renderScreen(
      <ContentActionsMenu contentId="p1" contentType="posting" authorId="me" />
    );
    expect(s.queryByLabelText('More actions')).toBeNull();
  });

  it('opens the sheet and reports a reply with the chosen reason', async () => {
    const onActioned = jest.fn();
    const s = await renderScreen(
      <ContentActionsMenu
        contentId="r9"
        contentType="reply"
        authorId="troll"
        authorHandle="troll"
        onActioned={onActioned}
      />
    );

    fireEvent.press(s.getByLabelText('More actions'));
    // A blockable author also gets a Block action.
    expect(await s.findByText('Block @troll')).toBeOnTheScreen();

    fireEvent.press(await s.findByText('Report content'));
    fireEvent.press(await s.findByText('Hate speech or slurs'));

    await waitFor(() =>
      expect(reportContent).toHaveBeenCalledWith('r9', 'reply', 'hate', '')
    );
    await waitFor(() => expect(onActioned).toHaveBeenCalledWith('reported'));
  });
});
