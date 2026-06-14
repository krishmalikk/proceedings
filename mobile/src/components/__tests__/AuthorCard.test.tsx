import React from 'react';
import { renderScreen } from '../../test/render';
import { AuthorCard } from '../AuthorCard';

// Stub the network layer so the component renders deterministically offline.
jest.mock('../../services/apiService', () => ({
  getPublicProfile: jest.fn(async () => ({
    username: 'arjun-h1b',
    current_visa_or_greencard_category: ['H-1B'],
    visa_applying_for: ['EB-3'],
    primary_consulate: 'BOM',
    consulates: ['BOM'],
    tags: ['premium-processing'],
    key_stages_or_info: { 'I-140': 'filed' },
    key_dates: {},
    background_text: '',
    journey: [],
  })),
  getUserPostings: jest.fn(async () => []),
  getTagVocab: jest.fn(async () => ({ consulate_options: [{ code: 'BOM', label: 'Mumbai, India (BOM)' }] })),
}));

const noop = jest.fn();

describe('AuthorCard', () => {
  it('renders nothing for non-app (Reddit) postings', async () => {
    const screen = await renderScreen(<AuthorCard authorId="" channel="reddit" onOpenPosting={noop} />);
    expect(screen.toJSON()).toBeNull();
  });

  it('shows an Anonymous note for an app posting with no known author', async () => {
    const screen = await renderScreen(<AuthorCard authorId="" channel="app" onOpenPosting={noop} />);
    expect(screen.getByText('Anonymous author')).toBeOnTheScreen();
  });

  it("renders the author's profile tags for an app posting", async () => {
    const screen = await renderScreen(<AuthorCard authorId="demo-arjun" channel="app" onOpenPosting={noop} />);
    expect(await screen.findByText('arjun-h1b')).toBeOnTheScreen();
    expect(screen.getByText('Visa Status')).toBeOnTheScreen();
    expect(screen.getByText('H-1B')).toBeOnTheScreen();
    expect(screen.getByText('Mumbai, India (BOM)')).toBeOnTheScreen(); // consulate code → label
    expect(screen.getByText('premium-processing')).toBeOnTheScreen();
  });
});
