# Mobile testing (Jest + React Native Testing Library)

The Expo/React-Native app uses **`jest-expo`** (the Expo Jest preset) with
**`@testing-library/react-native`** (RNTL) for unit and component tests. Tests
run in Node — no simulator or device needed.

> Stack: Expo SDK 54 · React 19.1 · React Native 0.81 · `jest-expo@54` ·
> `@testing-library/react-native@14` · `react-test-renderer@19.1`.

---

## Quick start

From the `mobile/` directory:

```bash
npm test                 # run all tests once
npm run test:watch       # watch mode (re-runs on change)
npm run test:coverage    # run with a coverage report
npx jest path/to/file    # run a single test file
npx jest -t "renders"    # run tests whose name matches a pattern
```

First run after a fresh clone: `npm install` (installs the test deps too).

---

## ⚠️ Rendering is async — use `renderScreen`

On this stack (React 19 + RNTL v14) the library's `render` is **asynchronous**
(it awaits React's concurrent `act`). This is inherent: an older RNTL with a
synchronous `render` does **not** support React 19, and downgrading React would
break the Expo 54 app. So there is no sync-render option — embrace the async one.

To keep this from being a footgun, **always render through the project helper**
[`src/test/render.tsx`](src/test/render.tsx), which is async by name and returns
the global `screen`:

```tsx
import { renderScreen, fireEvent } from '../../test/render';

it('renders', async () => {
  const screen = await renderScreen(<FilterChip label="H-1B" />);   // await!
  expect(screen.getByText('H-1B')).toBeOnTheScreen();
});
```

Forgetting `await` yields a cryptic `getByText is not a function` /
`render has not been called`. Event helpers (`fireEvent.press`,
`fireEvent.changeText`) are synchronous and need no `await`.

> `renderScreen` re-exports everything from `@testing-library/react-native`, so
> import `fireEvent`, `within`, etc. from `../../test/render` too — one import site.

---

## Where tests live

Co-locate tests in a `__tests__/` folder next to the code, named `*.test.ts(x)`:

```
src/constants/__tests__/onboardingData.test.ts   # pure-logic example
src/components/__tests__/FilterChip.test.tsx      # simple component example
src/components/__tests__/AuthorCard.test.tsx      # component + mocked services
```

Jest auto-discovers any `**/__tests__/**` or `*.test.*` file.

---

## Writing a pure-logic test (no UI)

Best for mappers, validators, formatters — fast and dependency-free. Example
([onboardingData.test.ts](src/constants/__tests__/onboardingData.test.ts)):

```ts
import { toBackendProfile, fromBackendProfile } from '../onboardingData';

it('round-trips form → backend → form', () => {
  const form = { /* … */ };
  expect(fromBackendProfile(toBackendProfile(form))).toEqual(form);
});
```

## Writing a component test

Use `renderScreen` from the project helper. Built-in matchers like
`toBeOnTheScreen()`, `toHaveTextContent()` are auto-registered.
Example ([FilterChip.test.tsx](src/components/__tests__/FilterChip.test.tsx)):

```tsx
import { renderScreen, fireEvent } from '../../test/render';
import { FilterChip } from '../FilterChip';

it('fires onPress when tapped', async () => {
  const onPress = jest.fn();
  const screen = await renderScreen(<FilterChip label="EB-3" onPress={onPress} />);
  fireEvent.press(screen.getByText('EB-3'));
  expect(onPress).toHaveBeenCalledTimes(1);
});
```

## Testing a component that calls the API

Mock the service module so the component renders deterministically offline.
Example ([AuthorCard.test.tsx](src/components/__tests__/AuthorCard.test.tsx)):

```tsx
import { renderScreen } from '../../test/render';

jest.mock('../../services/apiService', () => ({
  getPublicProfile: jest.fn(async () => ({ username: 'arjun-h1b', /* … */ })),
  getUserPostings: jest.fn(async () => []),
  getTagVocab: jest.fn(async () => ({ consulate_options: [] })),
}));

it("renders the author's profile", async () => {
  const screen = await renderScreen(<AuthorCard authorId="demo-arjun" channel="app" onOpenPosting={jest.fn()} />);
  // data arrives via useEffect → use findBy* (waits for the next render)
  expect(await screen.findByText('arjun-h1b')).toBeOnTheScreen();
});
```

Tips:
- Use `findByText` (awaits) for content that appears after a `useEffect` fetch.
- Pass required callback props as `jest.fn()`.

---

## Global mocks (already configured)

`jest.setup.js` (wired via `setupFilesAfterEnv`) provides app-wide mocks so most
tests need no per-file setup:

| Module | Why it's mocked |
|---|---|
| `@react-native-async-storage/async-storage` | native module → official in-memory jest mock |
| `@expo/vector-icons` | pulls native font/asset modules that don't resolve under jest → rendered as a plain text host |

Add more here as needed. Common ones for screens:

```js
// Firebase (avoid initializeApp during import of an auth-dependent screen)
jest.mock('../config/firebase', () => ({ auth: {} }));

// React Navigation hooks (when testing a screen in isolation)
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn(), push: jest.fn() }),
  useRoute: () => ({ params: {} }),
}));
```

---

## Configuration reference

All config lives in **`mobile/package.json`** under `"jest"`:

```jsonc
"jest": {
  "preset": "jest-expo",
  "setupFilesAfterEnv": ["<rootDir>/jest.setup.js"],
  "transformIgnorePatterns": [ "node_modules/(?!(... RN/Expo/firebase/markdown ...))" ]
}
```

- **`preset: jest-expo`** — sets the transformer (Babel), the RN environment, and
  default mocks for Expo modules.
- **`transformIgnorePatterns`** — Jest ignores `node_modules` by default, but RN
  ships untranspiled ESM. This allowlist forces transpilation of `react-native`,
  `expo-*`, `@react-navigation/*`, `firebase`, `react-native-markdown-display`,
  `@react-native-async-storage/*`, etc. **If a new dependency throws
  `SyntaxError: Unexpected token 'export'` in a test, add it to this list.**
- **`jest.setup.js`** — global mocks (see above).

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `getByText is not a function` / `render has not been called` | `await renderScreen(...)` — rendering is async on this stack (see top). |
| `Cannot find module 'expo-asset'` (via an icon import) | Already handled by the `@expo/vector-icons` mock; if a new native module appears, mock it in `jest.setup.js`. |
| `SyntaxError: Unexpected token 'export'` from a dependency | Add that package to `transformIgnorePatterns`. |
| Content that loads after a fetch isn't found | Use `await screen.findByText(...)` instead of `getByText`. |

---

## What to test

- **High value, easy:** pure logic — the `onboardingData` mappers, vocab
  validity, any formatting/validation helpers.
- **Medium:** presentational components and their prop-driven branches
  (e.g. `AuthorCard` omits for Reddit, shows "Anonymous", renders profile tags).
- **Out of scope for jest:** full navigation flows and anything needing a real
  device/Firebase — those are validated by the deployed-backend E2E suite
  (`backend/tests/test_cloud_run.py`) and a manual `npx expo start` pass.
