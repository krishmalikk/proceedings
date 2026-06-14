import React from 'react';
import { renderScreen, fireEvent } from '../../test/render';
import { FilterChip } from '../FilterChip';

describe('FilterChip', () => {
  it('renders its label', async () => {
    const screen = await renderScreen(<FilterChip label="H-1B" />);
    expect(screen.getByText('H-1B')).toBeOnTheScreen();
  });

  it('fires onPress when tapped', async () => {
    const onPress = jest.fn();
    const screen = await renderScreen(<FilterChip label="EB-3" onPress={onPress} />);
    fireEvent.press(screen.getByText('EB-3'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
