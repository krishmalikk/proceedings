// Jest setup for the Expo/React-Native app (runs before each test file).
//
// React Native Testing Library v12.4+ registers its jest matchers automatically,
// so no extend-expect import is needed. Add native-module mocks here for modules
// that have no JS implementation under the test (node) environment.

// AsyncStorage - use the official in-memory jest mock.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// @expo/vector-icons pulls native font/asset modules that don't resolve under
// jest. Mock every icon family with a lightweight text host component.
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return new Proxy(
    {},
    { get: () => (props) => React.createElement(Text, props, props.name || null) }
  );
});

// react-native-worklets (Reanimated 4's worklets runtime) has no native part
// under the jest (node) environment, so any suite importing a Reanimated-backed
// component crashed at import with "[Worklets] Native part of Worklets doesn't
// seem to be initialized". Use the library's official jest mock (TS source
// entrypoint, transformed via the react-native-* allowlist in
// transformIgnorePatterns). See the React Native Worklets testing guide.
jest.mock('react-native-worklets', () =>
  require('react-native-worklets/src/mock')
);
