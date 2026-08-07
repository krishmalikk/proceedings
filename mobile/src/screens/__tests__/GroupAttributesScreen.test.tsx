import React from 'react';
import { renderScreen, fireEvent, waitFor } from '../../test/render';
import { GroupAttributesScreen } from '../GroupAttributesScreen';
import { getGroup, getMemberAttributes, getTagVocab } from '../../services/apiService';

const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: mockGoBack }),
  useRoute: () => ({ params: { groupId: 'g1', groupName: 'Fall 2026 STEM OPT' } }),
}));

jest.mock('../../services/apiService', () => ({
  getGroup: jest.fn(),
  getMemberAttributes: jest.fn(),
  getTagVocab: jest.fn(),
}));

const VOCAB = {
  post_join_attribute_templates: {
    'stem-opt-extension': [
      { label: 'Date Applied', field: 'key_dates', key: 'ead_filed_date' },
      { label: 'EAD Received', field: 'key_dates', key: 'ead_approved_date' },
    ],
  },
};

const GROUP = {
  group_id: 'g1', name: 'Fall 2026 STEM OPT', description: '', group_type: 'timeline',
  criteria_text: '', criteria_tags: { tags: ['stem-opt-extension'] },
  members: [
    { user_id: 'demo-arjun', username: 'arjun-h1b' },
    { user_id: 'demo-mei', username: 'mei-f1' },
  ],
  created_by: 'demo-arjun', is_admin: false, is_member: true,
  created_at: '', last_activity_at: '', score: 0, shared: [],
};

const ATTRS = [
  {
    user_id: 'demo-arjun', username: 'arjun-h1b', processing_type: 'stem-opt-extension',
    values: { ead_filed_date: '2026-03-01', ead_approved_date: '2026-05-20' },
    notes: 'filed early', submitted_at: '', updated_at: '',
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  (getGroup as jest.Mock).mockResolvedValue(GROUP);
  (getMemberAttributes as jest.Mock).mockResolvedValue({ attributes: ATTRS });
  (getTagVocab as jest.Mock).mockResolvedValue(VOCAB);
});

describe('GroupAttributesScreen', () => {
  it('renders a column per template row and a value per member', async () => {
    const s = await renderScreen(<GroupAttributesScreen />);

    expect(await s.findByText('DATE APPLIED')).toBeOnTheScreen();
    expect(s.getByText('EAD RECEIVED')).toBeOnTheScreen();
    expect(s.getByText('2026-03-01')).toBeOnTheScreen();
    expect(s.getByText('2026-05-20')).toBeOnTheScreen();
    expect(s.getByText('filed early')).toBeOnTheScreen();
  });

  it('lists every member, not just the ones who submitted', async () => {
    const s = await renderScreen(<GroupAttributesScreen />);

    expect(await s.findByText('arjun-h1b')).toBeOnTheScreen();
    expect(s.getByText('mei-f1')).toBeOnTheScreen();
    // mei submitted nothing — her two value cells plus notes are all dashes.
    expect(s.getAllByText('—')).toHaveLength(3);
  });

  it('shows nothing to a non-member', async () => {
    (getGroup as jest.Mock).mockResolvedValue({ ...GROUP, is_member: false });
    const s = await renderScreen(<GroupAttributesScreen />);

    expect(await s.findByText('Only members can see this.')).toBeOnTheScreen();
    expect(s.queryByText('DATE APPLIED')).toBeNull();
  });

  it('explains itself when the group collects no attributes at all', async () => {
    (getGroup as jest.Mock).mockResolvedValue({ ...GROUP, group_type: '', criteria_tags: {} });
    const s = await renderScreen(<GroupAttributesScreen />);

    expect(await s.findByText(/doesn't collect timeline attributes/)).toBeOnTheScreen();
  });

  it('surfaces a load failure instead of an empty table', async () => {
    (getGroup as jest.Mock).mockRejectedValue(new Error('No such group.'));
    const s = await renderScreen(<GroupAttributesScreen />);

    expect(await s.findByText('No such group.')).toBeOnTheScreen();
  });

  it('goes back to the group', async () => {
    const s = await renderScreen(<GroupAttributesScreen />);

    await waitFor(() => expect(getGroup).toHaveBeenCalled());
    await fireEvent.press(s.getByLabelText('Back'));
    expect(mockGoBack).toHaveBeenCalled();
  });
});
