/**
 * Long-press-to-copy on data text. iOS only: on Android a selectable TextView is focusable in
 * touch mode, takes initial focus when the screen opens and draws a dark highlight over itself.
 */
export const selectableText = process.env.EXPO_OS === 'ios';
