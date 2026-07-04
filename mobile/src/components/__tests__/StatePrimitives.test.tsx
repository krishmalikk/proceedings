import React from 'react';
import { renderScreen, fireEvent } from '../../test/render';
import { AppText } from '../AppText';
import { Skeleton } from '../Skeleton';
import { EmptyState } from '../EmptyState';
import { ErrorState } from '../ErrorState';
import { ScreenHeader } from '../ScreenHeader';
import { typography } from '../../constants/theme';

const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return {
    useNavigation: () => ({ goBack: (...a: unknown[]) => mockGoBack(...a) }),
    // ScreenHeader reads NavigationContext; the default value stands in for a
    // container in component tests. goBack is a call-time closure because the
    // hoisted factory runs before `mockGoBack` is initialized.
    NavigationContext: React.createContext({ goBack: (...a: unknown[]) => mockGoBack(...a) }),
  };
});

describe('AppText', () => {
  it('applies the variant font family (brand face, not system)', async () => {
    const s = await renderScreen(<AppText variant="headlineMd">Title</AppText>);
    const node = s.getByText('Title');
    const flat = Object.assign({}, ...[node.props.style].flat(Infinity).filter(Boolean));
    expect(flat.fontFamily).toBe(typography.headlineMd.fontFamily);
    expect(flat.fontFamily).toMatch(/^Lora_/);
    // Weight must live in the family name only — never a paired fontWeight.
    expect(flat.fontWeight).toBeUndefined();
  });
});

describe('Skeleton', () => {
  it('renders card placeholders', async () => {
    const s = await renderScreen(<Skeleton.Card count={3} />);
    // 3 cards × 5 blocks each render without crashing; sanity: tree is non-empty.
    expect(s.toJSON()).toBeTruthy();
  });
});

describe('EmptyState / ErrorState', () => {
  it('renders title/body and fires the action', async () => {
    const onAction = jest.fn();
    const s = await renderScreen(
      <EmptyState title="No replies yet" body="Be first." actionLabel="Write one" onAction={onAction} />
    );
    expect(s.getByText('No replies yet')).toBeOnTheScreen();
    fireEvent.press(s.getByText('Write one'));
    expect(onAction).toHaveBeenCalled();
  });

  it('ErrorState fires retry', async () => {
    const onRetry = jest.fn();
    const s = await renderScreen(<ErrorState body="boom" onRetry={onRetry} />);
    expect(s.getByText('Something went wrong')).toBeOnTheScreen();
    fireEvent.press(s.getByText('Try again'));
    expect(onRetry).toHaveBeenCalled();
  });
});

describe('ScreenHeader', () => {
  beforeEach(() => mockGoBack.mockClear());

  it('shows centered title and back chevron that pops navigation', async () => {
    const s = await renderScreen(<ScreenHeader title="Case Details" />);
    expect(s.getByText('Case Details')).toBeOnTheScreen();
    fireEvent.press(s.getByLabelText('Back'));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('large variant hides the back chevron', async () => {
    const s = await renderScreen(<ScreenHeader title="Home" large />);
    expect(s.getByText('Home')).toBeOnTheScreen();
    expect(s.queryByLabelText('Back')).toBeNull();
  });
});
