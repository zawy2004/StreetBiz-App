module.exports = {
  preset: 'jest-expo',
  // Reanimated 4.7+ resolves its web-only modules for Jest (and chains the worklets resolver).
  resolver: 'react-native-reanimated/jest/resolver',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  setupFiles: ['<rootDir>/tests/setup.ts'],
  testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
