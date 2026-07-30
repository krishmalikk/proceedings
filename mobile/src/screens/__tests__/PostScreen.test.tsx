import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { renderScreen, fireEvent } from '../../test/render';
import { PostScreen } from '../PostScreen';
import { suggestTags, createPosting } from '../../services/apiService';

// PostScreen renders the shared <Header>, which reads useSafeAreaInsets() —
// needs a real provider ancestor in the test tree (unlike screens that use
// <SafeAreaView>, which tolerates a missing provider).
const TEST_METRICS = { insets: { top: 0, right: 0, bottom: 0, left: 0 }, frame: { x: 0, y: 0, width: 390, height: 844 } };
function renderPostScreen() {
  return renderScreen(
    <SafeAreaProvider initialMetrics={TEST_METRICS}>
      <PostScreen />
    </SafeAreaProvider>
  );
}

// (jest hoists mock factories — only `mock*`-prefixed vars may be referenced.)
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
}));

jest.mock('../../services/apiService', () => ({
  getTagVocab: jest.fn(async () => null),
  suggestTags: jest.fn(),
  createPosting: jest.fn(async () => ({ case_id: 'app-1', author_handle: 'brave-maple-3272' })),
  reconcile: jest.fn(),
  getProfile: jest.fn(),
  updateProfile: jest.fn(),
  getActiveUserId: jest.fn(() => null), // no active user -> reconcile is skipped
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => {}),
  removeItem: jest.fn(async () => {}),
}));

const EMPTY_GROUPS = {
  visa_applying_for: [],
  current_visa_or_greencard_category: [],
  primary_consulate: '',
  consulates: [],
  tags: [],
  concerns_or_questions_tags: [],
};

function mockSuggest(groups: Partial<typeof EMPTY_GROUPS>) {
  (suggestTags as jest.Mock).mockResolvedValue({
    groups: { ...EMPTY_GROUPS, ...groups },
    key_stages_or_info: {},
    key_dates: {},
    relevant_sections: ['current_visa_or_greencard_category'],
    posting_type: 'general_question',
  });
}

async function previewWith(screen: Awaited<ReturnType<typeof renderScreen>>, groups: Partial<typeof EMPTY_GROUPS>) {
  mockSuggest(groups);
  await fireEvent.changeText(
    screen.getByPlaceholderText(/H-1B extension with an RFE/),
    'General I-130/I-485 question'
  );
  await fireEvent.changeText(
    screen.getByPlaceholderText(/Describe your situation/),
    'For those who filed I-130 and I-485 at the same time, how long until approval?'
  );
  await fireEvent.press(screen.getByText('Preview'));
  await screen.findByText('Review Tags');
}

// FAMILY-IMMIGRATION/EMPLOYMENT-UNSPECIFIED (backend: posting.py's
// _apply_visa_backfill(), a last-resort fallback meant for manual curation
// with no original poster to ask) must never be enough to enable Submit for
// a LIVE app user, who's right here and can always be asked directly for
// the specific category instead. Mirrors website/src/app/post/__tests__/page.test.tsx.
describe('PostScreen — generic visa-fallback gating (FAMILY-IMMIGRATION / EMPLOYMENT-UNSPECIFIED)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('a generic-only category does NOT enable Submit, and shows the "need the exact category" message', async () => {
    const screen = await renderPostScreen();
    await previewWith(screen, { current_visa_or_greencard_category: ['FAMILY-IMMIGRATION'] });

    expect(screen.getByText(/need the exact category/i)).toBeOnTheScreen();
    // The generic value is still shown as a removable chip, not hidden.
    expect(screen.getByText('FAMILY-IMMIGRATION')).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Submit Posting'));
    expect(createPosting).not.toHaveBeenCalled();
  });

  it('EMPLOYMENT-UNSPECIFIED alone also does NOT enable Submit', async () => {
    const screen = await renderPostScreen();
    await previewWith(screen, { current_visa_or_greencard_category: ['EMPLOYMENT-UNSPECIFIED'] });

    await fireEvent.press(screen.getByText('Submit Posting'));
    expect(createPosting).not.toHaveBeenCalled();
  });

  it('a SPECIFIC code (e.g. IR-1) alongside — or instead of — the generic one DOES enable Submit', async () => {
    const screen = await renderPostScreen();
    await previewWith(screen, { current_visa_or_greencard_category: ['FAMILY-IMMIGRATION', 'IR-1'] });

    expect(screen.queryByText(/need the exact category/i)).toBeNull();

    await fireEvent.press(screen.getByText('Submit Posting'));
    expect(createPosting).toHaveBeenCalled();
  });

  it('no visa signal at all still shows the ORIGINAL generic-empty message, not the fallback-specific one', async () => {
    const screen = await renderPostScreen();
    await previewWith(screen, {});

    expect(screen.getByText(/Add at least one visa\/status/i)).toBeOnTheScreen();
    expect(screen.queryByText(/need the exact category/i)).toBeNull();

    await fireEvent.press(screen.getByText('Submit Posting'));
    expect(createPosting).not.toHaveBeenCalled();
  });

  it('a specific visa_applying_for code alone (unrelated to the fallback) still enables Submit as before', async () => {
    const screen = await renderPostScreen();
    await previewWith(screen, { visa_applying_for: ['H-1B'] });

    await fireEvent.press(screen.getByText('Submit Posting'));
    expect(createPosting).toHaveBeenCalled();
  });
});
