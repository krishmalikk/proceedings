import type { ReactElement } from 'react';
import { render, screen } from '@testing-library/react-native';

// Re-export everything from RNTL so tests have a single import site.
export * from '@testing-library/react-native';

/**
 * Canonical render for component tests.
 *
 * With Expo SDK 54 / React 19 / @testing-library/react-native v14, the library's
 * `render` is **asynchronous** (it awaits React's concurrent `act`). There is no
 * synchronous-render option on this stack — an older RNTL with sync render does
 * not support React 19. So ALWAYS:
 *
 *     const s = await renderScreen(<MyComponent />);
 *     expect(s.getByText('hello')).toBeOnTheScreen();
 *
 * Forgetting `await` yields a cryptic "render has not been called" /
 * "getByText is not a function". This helper makes the async contract explicit
 * at every call site (and returns the global `screen` for convenience).
 */
export async function renderScreen(ui: ReactElement): Promise<typeof screen> {
  await render(ui);
  return screen;
}
