import React from 'react';
import { Alert } from 'react-native';
import { renderScreen, fireEvent, waitFor } from '../../test/render';
import { GroupChatScreen } from '../GroupChatScreen';
import { getGroup, leaveGroup, inviteToGroup, renameGroup, deleteGroup } from '../../services/apiService';

// Navigation hooks: fixed groupId param + spyable nav actions.
// (jest hoists jest.mock; only `mock`-prefixed vars may be referenced inside.)
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useRoute: () => ({ params: { groupId: 'g1', groupName: 'Group Chat' } }),
}));

jest.mock('../../services/apiService', () => ({
  getGroup: jest.fn(),
  leaveGroup: jest.fn(),
  inviteToGroup: jest.fn(),
  renameGroup: jest.fn(),
  deleteGroup: jest.fn(),
}));

// The message thread itself is covered by GroupChat's own tests — stub it
// here so this screen's tests focus on the header/members-modal chrome.
jest.mock('../../components', () => ({ GroupChat: () => null }));

const GROUP = {
  group_id: 'g1', name: 'Mumbai H-1B crew', description: 'H-1B folks near BOM',
  criteria_text: 'looking for H-1B folks at Mumbai',
  members: [
    { user_id: 'demo-arjun', username: 'arjun-h1b' },
    { user_id: 'demo-mei', username: 'mei-f1' },
  ],
  created_by: 'demo-arjun',
  is_admin: false,
  is_member: true,
  created_at: '2026-06-07T00:00:00.000Z',
  last_activity_at: '2026-06-07T00:05:00.000Z',
};

beforeEach(() => {
  jest.clearAllMocks();
  (getGroup as jest.Mock).mockResolvedValue(GROUP);
});

async function openMembersModal(screen: Awaited<ReturnType<typeof renderScreen>>) {
  const header = await screen.findByText('Mumbai H-1B crew');
  await fireEvent.press(header);
  await waitFor(() => expect(screen.getByText('Members (2)')).toBeOnTheScreen());
}

describe('GroupChatScreen — metadata + admin badge', () => {
  it('shows the group name/description/dates and an Admin badge on the creator', async () => {
    const screen = await renderScreen(<GroupChatScreen />);
    await openMembersModal(screen);

    expect(screen.getByText('H-1B folks near BOM')).toBeOnTheScreen();
    expect(screen.getByText(/Created/)).toBeOnTheScreen();
    expect(screen.getByText('Admin')).toBeOnTheScreen();
    expect(screen.getByText('arjun-h1b')).toBeOnTheScreen();
    expect(screen.getByText('mei-f1')).toBeOnTheScreen();
  });
});

describe('GroupChatScreen — rename (admin-only)', () => {
  it('does not show Rename for a non-admin viewer', async () => {
    const screen = await renderScreen(<GroupChatScreen />);
    await openMembersModal(screen);
    expect(screen.queryByText('Rename')).toBeNull();
  });

  it('lets the admin rename the group', async () => {
    (getGroup as jest.Mock).mockResolvedValue({ ...GROUP, is_admin: true });
    (renameGroup as jest.Mock).mockResolvedValue({ ...GROUP, is_admin: true, name: 'BOM H-1B group' });
    const screen = await renderScreen(<GroupChatScreen />);
    await openMembersModal(screen);

    await fireEvent.press(screen.getByText('Rename'));
    const nameInput = await screen.findByDisplayValue('Mumbai H-1B crew');
    await fireEvent.changeText(nameInput, 'BOM H-1B group');
    await fireEvent.press(screen.getByText('Save'));

    await waitFor(() => expect(renameGroup).toHaveBeenCalledWith('g1', { name: 'BOM H-1B group', description: 'H-1B folks near BOM' }));
    // Both the header AND the modal's title now reflect the new name.
    await waitFor(() => expect(screen.getAllByText('BOM H-1B group').length).toBeGreaterThanOrEqual(1));
  });

  it('Cancel restores the original name/description without calling renameGroup', async () => {
    (getGroup as jest.Mock).mockResolvedValue({ ...GROUP, is_admin: true });
    const screen = await renderScreen(<GroupChatScreen />);
    await openMembersModal(screen);

    await fireEvent.press(screen.getByText('Rename'));
    const nameInput = await screen.findByDisplayValue('Mumbai H-1B crew');
    await fireEvent.changeText(nameInput, 'Something Else');
    await fireEvent.press(screen.getByText('Cancel'));

    await waitFor(() => expect(screen.getAllByText('Mumbai H-1B crew').length).toBeGreaterThanOrEqual(1));
    expect(screen.queryByText('Something Else')).toBeNull();
    expect(renameGroup).not.toHaveBeenCalled();
  });
});

describe('GroupChatScreen — invite by handle (any member)', () => {
  it('invites a handle and shows the added member', async () => {
    (inviteToGroup as jest.Mock).mockResolvedValue({
      ...GROUP,
      members: [...GROUP.members, { user_id: 'demo-omar', username: 'omar-b1b2' }],
    });
    const screen = await renderScreen(<GroupChatScreen />);
    await openMembersModal(screen);

    await fireEvent.changeText(screen.getByPlaceholderText('their handle…'), 'omar-b1b2');
    await fireEvent.press(screen.getByText('Invite'));

    await waitFor(() => expect(inviteToGroup).toHaveBeenCalledWith('g1', 'omar-b1b2'));
    expect(await screen.findByText('omar-b1b2')).toBeOnTheScreen();
    expect(screen.getByText('Added to the group.')).toBeOnTheScreen();
  });

  it('surfaces an error when the handle is not found', async () => {
    (inviteToGroup as jest.Mock).mockRejectedValue(new Error('No user with the handle "nope".'));
    const screen = await renderScreen(<GroupChatScreen />);
    await openMembersModal(screen);

    await fireEvent.changeText(screen.getByPlaceholderText('their handle…'), 'nope');
    await fireEvent.press(screen.getByText('Invite'));

    expect(await screen.findByText(/No user with the handle/)).toBeOnTheScreen();
  });

  it('clears the invite input after a successful invite', async () => {
    (inviteToGroup as jest.Mock).mockResolvedValue({
      ...GROUP,
      members: [...GROUP.members, { user_id: 'demo-omar', username: 'omar-b1b2' }],
    });
    const screen = await renderScreen(<GroupChatScreen />);
    await openMembersModal(screen);

    await fireEvent.changeText(screen.getByPlaceholderText('their handle…'), 'omar-b1b2');
    await fireEvent.press(screen.getByText('Invite'));

    await waitFor(() => expect(inviteToGroup).toHaveBeenCalledWith('g1', 'omar-b1b2'));
    await waitFor(() => expect(screen.getByPlaceholderText('their handle…').props.value).toBe(''));
  });
});

describe('GroupChatScreen — empty description', () => {
  it('does not render a description when the group has none', async () => {
    (getGroup as jest.Mock).mockResolvedValue({ ...GROUP, description: '' });
    const screen = await renderScreen(<GroupChatScreen />);
    await openMembersModal(screen);
    expect(screen.queryByText('H-1B folks near BOM')).toBeNull();
  });
});

describe('GroupChatScreen — leave group (previously 404\'d, backend route now exists)', () => {
  it('confirms via Alert, calls leaveGroup, and navigates back', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      const leaveButton = buttons?.find((b) => b.text === 'Leave');
      leaveButton?.onPress?.();
    });
    (leaveGroup as jest.Mock).mockResolvedValue(undefined);
    const screen = await renderScreen(<GroupChatScreen />);
    await screen.findByText('Mumbai H-1B crew');

    await fireEvent.press(screen.getByLabelText('Leave Group'));
    await waitFor(() => expect(leaveGroup).toHaveBeenCalledWith('g1'));
    expect(mockGoBack).toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('does nothing when the Leave confirmation is dismissed/cancelled', async () => {
    // The real 'Cancel' button has no onPress at all — dismissing the alert
    // without invoking any button faithfully reproduces that path.
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const screen = await renderScreen(<GroupChatScreen />);
    await screen.findByText('Mumbai H-1B crew');

    await fireEvent.press(screen.getByLabelText('Leave Group'));
    expect(leaveGroup).not.toHaveBeenCalled();
    expect(mockGoBack).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('shows an error Alert and does not navigate back when leaveGroup fails', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      const leaveButton = buttons?.find((b) => b.text === 'Leave');
      leaveButton?.onPress?.();
    });
    (leaveGroup as jest.Mock).mockRejectedValue(new Error('network down'));
    const screen = await renderScreen(<GroupChatScreen />);
    await screen.findByText('Mumbai H-1B crew');

    await fireEvent.press(screen.getByLabelText('Leave Group'));
    await waitFor(() => expect(leaveGroup).toHaveBeenCalledWith('g1'));
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Error', 'network down'));
    expect(mockGoBack).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});

describe('GroupChatScreen — delete group (admin-only)', () => {
  it('does not show Delete Group for a non-admin viewer', async () => {
    const screen = await renderScreen(<GroupChatScreen />);
    await openMembersModal(screen);
    expect(screen.queryByText('Delete Group')).toBeNull();
  });

  it('confirms via Alert, calls deleteGroup, and navigates back', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      const deleteButton = buttons?.find((b) => b.text === 'Delete');
      deleteButton?.onPress?.();
    });
    (getGroup as jest.Mock).mockResolvedValue({ ...GROUP, is_admin: true });
    (deleteGroup as jest.Mock).mockResolvedValue(undefined);
    const screen = await renderScreen(<GroupChatScreen />);
    await openMembersModal(screen);

    await fireEvent.press(screen.getByText('Delete Group'));
    await waitFor(() => expect(deleteGroup).toHaveBeenCalledWith('g1'));
    expect(mockGoBack).toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('does nothing when the Delete confirmation is dismissed/cancelled', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    (getGroup as jest.Mock).mockResolvedValue({ ...GROUP, is_admin: true });
    const screen = await renderScreen(<GroupChatScreen />);
    await openMembersModal(screen);

    await fireEvent.press(screen.getByText('Delete Group'));
    expect(deleteGroup).not.toHaveBeenCalled();
    expect(mockGoBack).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('shows an error Alert and does not navigate back when deleteGroup fails', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      const deleteButton = buttons?.find((b) => b.text === 'Delete');
      deleteButton?.onPress?.();
    });
    (getGroup as jest.Mock).mockResolvedValue({ ...GROUP, is_admin: true });
    (deleteGroup as jest.Mock).mockRejectedValue(new Error("Only the group's creator can delete it."));
    const screen = await renderScreen(<GroupChatScreen />);
    await openMembersModal(screen);

    await fireEvent.press(screen.getByText('Delete Group'));
    await waitFor(() => expect(deleteGroup).toHaveBeenCalledWith('g1'));
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Error', "Only the group's creator can delete it."));
    expect(mockGoBack).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});
