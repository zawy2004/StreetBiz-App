import * as Speech from 'expo-speech';
import { useCallback, useEffect, useState } from 'react';

/**
 * Reads the assistant's question (or a card group) aloud with the phone's own Vietnamese voice.
 * Nothing leaves the device. Without a Vietnamese voice installed the OS reads with its default.
 */
export function useReadAloud() {
  const [speaking, setSpeaking] = useState(false);

  const stop = useCallback(() => {
    void Speech.stop();
    setSpeaking(false);
  }, []);

  const speak = useCallback((text: string) => {
    if (!text.trim()) return;
    void Speech.stop();
    setSpeaking(true);
    Speech.speak(text.replace(/\[AI\]\s*/g, ''), {
      language: 'vi-VN',
      rate: 0.95,
      onDone: () => setSpeaking(false),
      onStopped: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  }, []);

  useEffect(() => () => void Speech.stop(), []);

  return { supported: true, speaking, speak, stop };
}
