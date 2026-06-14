import React from 'react';
import { renderScreen, fireEvent } from '../../test/render';
import { ProfileActivity } from '../ProfileActivity';

jest.mock('../../services/apiService', () => ({
  getUserPostings: jest.fn(async () => [
    { case_id: 'app-c1', title: 'H-1B stamping at Mumbai', visa: ['H-1B'], consulates: ['BOM'], outcome: 'approved', date: '2026-06-13' },
  ]),
  getUserReplies: jest.fn(async () => [
    { id: 'r1', parent_case_id: 'app-c9', body: 'Great write-up, thanks!', created_at: '2026-06-12T00:00:00Z' },
  ]),
  getAllGroups: jest.fn(async () => ({
    groups: [
      { group_id: 'g1', name: 'H-1B Mumbai 2026', criteria_text: 'H-1B · BOM', members: [{ user_id: 'a', username: 'a' }, { user_id: 'b', username: 'b' }], is_member: true },
      { group_id: 'g2', name: 'Not My Group', criteria_text: '', members: [], is_member: false },
    ],
  })),
}));

describe('ProfileActivity (mobile)', () => {
  it("renders the user's postings, replies, and member-only groups", async () => {
    const screen = await renderScreen(
      <ProfileActivity uid="syn-01" onOpenPosting={jest.fn()} onOpenGroup={jest.fn()} />
    );
    expect(await screen.findByText('H-1B stamping at Mumbai')).toBeOnTheScreen();
    expect(screen.getByText('Great write-up, thanks!')).toBeOnTheScreen();
    expect(screen.getByText('H-1B Mumbai 2026')).toBeOnTheScreen(); // is_member group shown
    expect(screen.queryByText('Not My Group')).toBeNull();          // non-member group filtered out
    expect(screen.getByText('Your Postings')).toBeOnTheScreen();
    expect(screen.getByText('Your Activity')).toBeOnTheScreen();
    expect(screen.getByText('Your Groups')).toBeOnTheScreen();
  });

  it('navigates when a posting and a group are tapped', async () => {
    const onOpenPosting = jest.fn();
    const onOpenGroup = jest.fn();
    const screen = await renderScreen(
      <ProfileActivity uid="syn-01" onOpenPosting={onOpenPosting} onOpenGroup={onOpenGroup} />
    );
    fireEvent.press(await screen.findByText('H-1B stamping at Mumbai'));
    expect(onOpenPosting).toHaveBeenCalledWith('app-c1');
    fireEvent.press(screen.getByText('H-1B Mumbai 2026'));
    expect(onOpenGroup).toHaveBeenCalledWith('g1', 'H-1B Mumbai 2026');
  });
});
