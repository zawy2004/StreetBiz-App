import * as Speech from 'expo-speech';
import { useCallback, useEffect, useState } from 'react';

type VoiceLike = Pick<Speech.Voice, 'identifier' | 'name' | 'language' | 'quality'>;

/**
 * The best Vietnamese voice on this phone, or null. Never a voice of another language: an English
 * voice reading Vietnamese is what made the assistant sound foreign.
 */
export function pickVietnameseVoice<T extends VoiceLike>(voices: readonly T[]): T | null {
  const vietnamese = voices.filter((v) => /^vi([-_]|$)/i.test(v.language));
  if (vietnamese.length === 0) return null;
  const rank = (v: T) => (v.quality === Speech.VoiceQuality.Enhanced ? 0 : 1) + (/network|online/i.test(v.identifier) ? 0 : 0.5);
  return [...vietnamese].sort((a, b) => rank(a) - rank(b))[0] ?? null;
}

/**
 * Reads the question (or a card group) aloud with the phone's own Vietnamese voice; used when the
 * live conversation is not running. Nothing leaves the device. Without a Vietnamese voice the
 * words stay on screen only (the system default would read them with a foreign accent).
 */
export function useReadAloud() {
  const [voice, setVoice] = useState<VoiceLike | null>(null);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    let alive = true;
    Speech.getAvailableVoicesAsync()
      .then((voices) => {
        if (alive) setVoice(pickVietnameseVoice(voices));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const stop = useCallback(() => {
    void Speech.stop();
    setSpeaking(false);
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!voice || !text.trim()) return;
      void Speech.stop();
      setSpeaking(true);
      Speech.speak(text.replace(/\[AI\]\s*/g, ''), {
        language: voice.language,
        voice: voice.identifier,
        rate: 0.95,
        onDone: () => setSpeaking(false),
        onStopped: () => setSpeaking(false),
        onError: () => setSpeaking(false),
      });
    },
    [voice],
  );

  useEffect(() => () => void Speech.stop(), []);

  return { supported: !!voice, speaking, speak, stop };
}
