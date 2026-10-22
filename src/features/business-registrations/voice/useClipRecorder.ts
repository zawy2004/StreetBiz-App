import {
  AudioQuality,
  IOSOutputFormat,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  type RecordingOptions,
} from 'expo-audio';
import { File } from 'expo-file-system';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { AssistAudio } from './voice-registration.types';

export type ClipRecorderState = 'idle' | 'requesting' | 'recording' | 'error';

/** Mono AAC in an .m4a: ~240 KB for 30 s, well inside the server's 2 MB clip limit. */
const OPTIONS: RecordingOptions = {
  extension: '.m4a',
  sampleRate: 44100,
  numberOfChannels: 1,
  bitRate: 64000,
  isMeteringEnabled: true,
  android: { outputFormat: 'mpeg4', audioEncoder: 'aac' },
  ios: { outputFormat: IOSOutputFormat.MPEG4AAC, audioQuality: AudioQuality.HIGH },
  web: { mimeType: 'audio/webm', bitsPerSecond: 64000 },
};

/** Shorter than this is a stray tap, not an answer. */
const MIN_MS = 500;

/** Deletes a recording once it has been sent: answers are never kept on the phone either. */
export function discardClip(clip: AssistAudio | null | undefined) {
  const uri = clip && 'uri' in clip.body ? clip.body.uri : null;
  if (!uri) return;
  try {
    new File(uri).delete();
  } catch {
    // Already gone, or the OS cleans its cache anyway.
  }
}

/**
 * Records one answer with the phone's microphone: tap to start, tap to stop, or it stops by itself
 * at `maxSeconds`. The clip goes to `onClip` as a multipart file part (null when too short).
 */
export function useClipRecorder(onClip: (clip: AssistAudio | null) => void, maxSeconds = 30) {
  const recorder = useAudioRecorder(OPTIONS);
  const [state, setState] = useState<ClipRecorderState>('idle');
  const [error, setError] = useState<string>();
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const active = useRef(false);
  const onClipRef = useRef(onClip);
  useEffect(() => {
    onClipRef.current = onClip;
  });

  const finish = useCallback(
    async (deliver: boolean) => {
      if (!active.current) return;
      active.current = false;
      clearInterval(timer.current);
      const duration = Date.now() - startedAt.current;
      try {
        await recorder.stop();
      } catch {
        // Stopping a recorder that never started throws; nothing to deliver then.
      }
      // Back to playback mode, so the question read aloud next uses the loudspeaker on iOS.
      void setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
      setState('idle');
      setElapsed(0);
      const uri = recorder.uri;
      const clip: AssistAudio | null = uri ? { body: { uri, name: 'answer.m4a', type: 'audio/m4a' }, fileName: 'answer.m4a' } : null;
      if (!deliver || duration < MIN_MS) {
        discardClip(clip);
        if (deliver) onClipRef.current(null);
        return;
      }
      onClipRef.current(clip);
    },
    [recorder],
  );

  const start = useCallback(async () => {
    if (active.current) return;
    setError(undefined);
    setState('requesting');
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setError('Chưa có quyền dùng micro. Mở Cài đặt để cho phép micro, hoặc bấm "Gõ thay".');
        setState('error');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      active.current = true;
      startedAt.current = Date.now();
      setElapsed(0);
      setState('recording');
      timer.current = setInterval(() => {
        const seconds = (Date.now() - startedAt.current) / 1000;
        setElapsed(Math.floor(seconds));
        if (seconds >= maxSeconds) void finish(true);
      }, 250);
    } catch {
      active.current = false;
      setError('Không mở được micro. Thử lại, hoặc bấm "Gõ thay".');
      setState('error');
    }
  }, [finish, maxSeconds, recorder]);

  /** Stops and hands the clip to `onClip`. */
  const stop = useCallback(() => void finish(true), [finish]);
  /** Stops and throws the recording away. */
  const cancel = useCallback(() => void finish(false), [finish]);

  useEffect(
    () => () => {
      clearInterval(timer.current);
      if (active.current) {
        active.current = false;
        void recorder.stop().catch(() => undefined);
      }
    },
    [recorder],
  );

  return { state, error, elapsed, maxSeconds, start, stop, cancel };
}
