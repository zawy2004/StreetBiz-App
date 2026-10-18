/* Native animation and gesture modules have no JS runtime under Jest; use the libraries' own mocks. */
import 'react-native-gesture-handler/jestSetup';

jest.mock('react-native-worklets', () => require('react-native-worklets/lib/module/mock'));
// The library mock lacks useReducedMotion; tests run as if the OS asked for reduced motion (no running animations).
jest.mock('react-native-reanimated', () => ({
  ...require('react-native-reanimated/mock'),
  useReducedMotion: () => true,
}));
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);
