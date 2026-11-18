import { createAudioPlaylist, requestRecordingPermissionsAsync, setAudioModeAsync, type AudioPlaylist, type AudioStreamBuffer } from 'expo-audio';
// The stream class itself, created on demand so a phone without it falls back instead of crashing.
import AudioModule from 'expo-audio/build/AudioModule';
import { File, Paths } from 'expo-file-system';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { ApiError } from '@/core/api';
import { getAccessToken } from '@/core/api/token-storage';
import { env } from '@/core/config/env';
import { appendLiveCaption, closeLiveCaption, LiveInterviewLink, liveStreamUrl, type LiveCaption, type LiveStatus } from './live-interview';
import { voiceRegistrationApi } from './voice-registration-api';
import type { AssistDraft, AssistTurnResult } from './voice-registration.types';

type Options = {
  onAssist: (result: AssistTurnResult, cause: 'voice' | 'screen') => void;
  /** The assistant finished what it was saying. */
  onTurnComplete?: () => void;
  /** Stopped before the interview was done; `message` is the server's own refusal text, if any. */
  onStopped: (reason: string, message?: string) => void;
};

type MicStream = InstanceType<typeof AudioModule.AudioStream>;

/** The server takes 16 kHz mono PCM16. */
const MIC_RATE = 16_000;
/** The first piece of a reply is short so it starts quickly; later pieces are longer, so fewer seams. */
const FIRST_PIECE_MS = 400;
const PIECE_MS = 1200;
/**
 * The phone's loudspeaker reaches its own microphone (expo-audio streams the plain MIC source, no
 * echo cancelling): while the assistant speaks, and this long after, nothing is sent -- otherwise it
 * would hear itself and talk over itself.
 */
const ECHO_TAIL_MS = 450;

/** True when this build of Expo Go has the streaming microphone. */
export function canTalkLive() {
  return typeof AudioModule?.AudioStream === 'function' && typeof AudioModule?.AudioPlaylist === 'function';
}

/** 16-bit little-endian PCM at `rate` → mono 16 kHz, by linear interpolation (phones may not record at 16 kHz). */
export function toMic16k(data: ArrayBuffer, rate: number, channels: number): ArrayBuffer {
  const input = new Int16Array(data);
  const frames = Math.floor(input.length / Math.max(1, channels));
  if (rate === MIC_RATE && channels === 1) return data.slice(0);
  const outLength = Math.floor((frames * MIC_RATE) / rate);
  const out = new Int16Array(outLength);
  const step = rate / MIC_RATE;
  for (let i = 0; i < outLength; i++) {
    const at = i * step;
    const left = Math.floor(at);
    const right = Math.min(frames - 1, left + 1);
    const t = at - left;
    out[i] = Math.round(input[left * channels]! * (1 - t) + input[right * channels]! * t);
  }
  return out.buffer;
}

/** A playable WAV for one piece of the assistant's voice (PCM16 mono). */
export function wavOf(pcm: Int16Array, rate: number): Uint8Array {
  const bytes = new Uint8Array(44 + pcm.byteLength);
  const view = new DataView(bytes.buffer);
  const ascii = (at: number, s: string) => [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  ascii(0, 'RIFF');
  view.setUint32(4, 36 + pcm.byteLength, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, 'data');
  view.setUint32(40, pcm.byteLength, true);
  bytes.set(new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength), 44);
  return bytes;
}

/**
 * X01 v2 on the phone: the interview as one conversation. The microphone streams to the server
 * (never stored), the assistant's voice plays in pieces as it arrives, and every value still comes
 * back as a server-checked `assist` result. Half duplex: the vendor speaks after the assistant, or
 * taps "Ngắt lời" to cut in. Ends on unmount or after 30 s in the background.
 */
export function useLiveInterview({ onAssist, onTurnComplete, onStopped }: Options) {
  const [status, setStatus] = useState<LiveStatus>('idle');
  const [captions, setCaptions] = useState<LiveCaption[]>([]);
  const [notice, setNotice] = useState('');
  const [muted, setMutedState] = useState(false);
  const [pending, setPending] = useState(false);

  const link = useRef<LiveInterviewLink | undefined>(undefined);
  const mic = useRef<MicStream | undefined>(undefined);
  const micListener = useRef<{ remove: () => void } | undefined>(undefined);
  const playlist = useRef<AudioPlaylist | undefined>(undefined);
  const pieces = useRef<File[]>([]);
  const piece = useRef<{ generation: number; chunks: Int16Array[]; samples: number; first: boolean }>({ generation: 0, chunks: [], samples: 0, first: true });
  const pieceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const dropThrough = useRef(0);
  const playingUntil = useRef(0);
  const outRate = useRef(24_000);
  const mutedRef = useRef(false);
  const callbacks = useRef({ onAssist, onTurnComplete, onStopped });
  useEffect(() => {
    callbacks.current = { onAssist, onTurnComplete, onStopped };
  });

  /** Drops queued speech and the files behind it. */
  const silence = useCallback(() => {
    clearTimeout(pieceTimer.current);
    piece.current = { generation: piece.current.generation, chunks: [], samples: 0, first: true };
    try {
      playlist.current?.clear();
    } catch {
      // Already released.
    }
    for (const file of pieces.current.splice(0)) {
      try {
        file.delete();
      } catch {
        // Already gone; the OS clears its cache anyway.
      }
    }
    playingUntil.current = 0;
  }, []);

  const flush = useCallback(() => {
    clearTimeout(pieceTimer.current);
    const current = piece.current;
    if (current.samples === 0 || !playlist.current) return;
    piece.current = { generation: current.generation, chunks: [], samples: 0, first: false };
    const pcm = new Int16Array(current.samples);
    let at = 0;
    for (const chunk of current.chunks) {
      pcm.set(chunk, at);
      at += chunk.length;
    }
    try {
      const file = new File(Paths.cache, `x01-live-${Date.now()}-${pieces.current.length}.wav`);
      file.write(wavOf(pcm, outRate.current));
      pieces.current.push(file);
      const now = Date.now();
      const idle = now >= playingUntil.current - 30;
      playingUntil.current = Math.max(playingUntil.current, now) + (current.samples / outRate.current) * 1000;
      playlist.current.add({ uri: file.uri });
      if (idle) {
        playlist.current.skipTo(playlist.current.trackCount - 1);
        playlist.current.play();
      }
    } catch {
      // A piece that cannot be written is skipped; the caption still shows what was said.
    }
  }, []);

  const teardown = useCallback(() => {
    micListener.current?.remove();
    micListener.current = undefined;
    try {
      mic.current?.stop();
      mic.current?.release();
    } catch {
      // Already released.
    }
    mic.current = undefined;
    silence();
    try {
      playlist.current?.release();
    } catch {
      // Already released.
    }
    playlist.current = undefined;
    void setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
  }, [silence]);

  const stopped = useCallback(
    (reason: string, message?: string) => {
      link.current = undefined;
      teardown();
      setPending(false);
      setStatus('ended');
      callbacks.current.onStopped(reason, message);
    },
    [teardown],
  );

  const start = useCallback(
    async (draft: AssistDraft, voiceConsent: boolean) => {
      if (link.current || mic.current) return;
      setCaptions([]);
      setNotice('');
      setMutedState(false);
      mutedRef.current = false;
      setStatus('connecting');

      try {
        const permission = await requestRecordingPermissionsAsync();
        if (!permission.granted || !canTalkLive()) {
          stopped('mic');
          return;
        }
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, shouldRouteThroughEarpiece: false });
        playlist.current = createAudioPlaylist({ updateInterval: 250 });
        mic.current = new AudioModule.AudioStream({ sampleRate: MIC_RATE, channels: 1, encoding: 'int16' });
      } catch {
        stopped('mic');
        return;
      }

      let ticket;
      try {
        ticket = await voiceRegistrationApi.startLive(draft, voiceConsent);
      } catch (err) {
        // 503/429/409 carry a sentence written for this screen ("…bấm để nói"); show it as is.
        const refused = err instanceof ApiError && [409, 429, 503].includes(err.status);
        stopped(err instanceof ApiError ? err.code : 'voice_unavailable', refused ? err.message : undefined);
        return;
      }
      if (!mic.current) return;
      outRate.current = ticket.outputSampleRate;

      let socket: WebSocket;
      try {
        socket = new WebSocket(liveStreamUrl(env.apiBaseUrl, '', ticket.streamPath, ticket.ticket, getAccessToken() ?? ''));
      } catch {
        stopped('disconnected');
        return;
      }
      socket.binaryType = 'arraybuffer';
      const current = new LiveInterviewLink(socket, {
        onAssist: (result, cause) => {
          setPending(false);
          callbacks.current.onAssist(result, cause);
        },
        onStatus: (next) => {
          if (next !== 'ended') setStatus(next);
        },
        onCaption: (who, text) => setCaptions((c) => appendLiveCaption(c, who, text)),
        onAudio: (generation, pcm) => {
          if (generation <= dropThrough.current) return;
          if (generation !== piece.current.generation) {
            flush();
            piece.current = { generation, chunks: [], samples: 0, first: true };
          }
          piece.current.chunks.push(pcm);
          piece.current.samples += pcm.length;
          const target = ((piece.current.first ? FIRST_PIECE_MS : PIECE_MS) / 1000) * outRate.current;
          if (piece.current.samples >= target) flush();
          else {
            clearTimeout(pieceTimer.current);
            pieceTimer.current = setTimeout(flush, 150);
          }
        },
        onInterrupted: (generation) => {
          dropThrough.current = Math.max(dropThrough.current, generation);
          silence();
          setCaptions(closeLiveCaption);
        },
        onTurnComplete: () => {
          flush();
          setCaptions(closeLiveCaption);
          callbacks.current.onTurnComplete?.();
        },
        onNotice: setNotice,
        onEnded: (reason) => {
          if (link.current === current) stopped(reason);
        },
      });
      socket.onmessage = (message) => current.receive(message.data);
      socket.onclose = () => current.closed();
      link.current = current;

      const stream = mic.current;
      micListener.current = stream.addListener('audioStreamBuffer', (buffer: AudioStreamBuffer) => {
        if (mutedRef.current || Date.now() < playingUntil.current + ECHO_TAIL_MS) return;
        const pcm = toMic16k(buffer.data, buffer.sampleRate, buffer.channels);
        // The server takes frames of at most 32 KB (1 s at 16 kHz).
        for (let at = 0; at < pcm.byteLength; at += 32_000) link.current?.sendAudio(pcm.slice(at, at + 32_000));
      });
      try {
        await stream.start();
      } catch {
        current.close('mic');
        stopped('mic');
      }
    },
    [flush, silence, stopped],
  );

  const end = useCallback(() => {
    const current = link.current;
    if (!current) return;
    current.end();
    // The server answers "ended"; never keep the microphone open if it does not.
    setTimeout(() => {
      if (link.current === current) current.close('ended');
    }, 1500);
  }, []);

  /** "Ngắt lời": stop the assistant's voice now and listen (the phone cannot hear over itself). */
  const interrupt = useCallback(() => {
    dropThrough.current = Math.max(dropThrough.current, piece.current.generation);
    silence();
    setCaptions(closeLiveCaption);
  }, [silence]);

  const setMuted = useCallback((value: boolean) => {
    mutedRef.current = value;
    setMutedState(value);
    link.current?.setMuted(value);
  }, []);

  const sendDraft = useCallback((draft: AssistDraft) => {
    const sent = link.current?.sendDraft(draft) ?? false;
    setPending(sent);
    return sent;
  }, []);

  const sendText = useCallback((text: string) => link.current?.sendText(text) ?? false, []);

  useEffect(() => {
    let away: ReturnType<typeof setTimeout> | undefined;
    const subscription = AppState.addEventListener('change', (state) => {
      clearTimeout(away);
      if (state !== 'active' && link.current) away = setTimeout(() => link.current?.close('hidden'), 30_000);
    });
    return () => {
      clearTimeout(away);
      subscription.remove();
    };
  }, []);

  useEffect(
    () => () => {
      const current = link.current;
      link.current = undefined;
      current?.close('ended');
      teardown();
    },
    [teardown],
  );

  return {
    status,
    captions,
    notice,
    muted,
    pending,
    active: status !== 'idle' && status !== 'ended',
    start,
    end,
    interrupt,
    setMuted,
    sendDraft,
    sendText,
  };
}
