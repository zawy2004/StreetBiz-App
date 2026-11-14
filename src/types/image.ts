import type { ImageProps } from 'expo-image';

/**
 * Anything expo-image can show: a `{ uri }`, a bundled `require()`, or a list of candidates.
 * expo-image 58 has its own source type, no longer React Native's ImageSourcePropType.
 */
export type PhotoSource = NonNullable<ImageProps['source']>;
