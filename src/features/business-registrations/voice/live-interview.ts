import type { AssistDraft, AssistTurnResult, LiveServerEvent } from './voice-registration.types';

/**
 * X01 v2 "Trò chuyện": the live conversation's wire protocol, without the audio devices (each
 * platform brings its own microphone and speaker). The server checks everything the model hears;
 * this side only keeps the screen in step and decides when to fall back to tap-to-talk.
 *
 * Shared file: the app keeps a verbatim copy. Change both together.
 */

export type LiveStatus =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'muted'
  | 'reconnecting'
  | 'ended';

/** `closed`: that turn is over, so the next words of the same speaker start a new line. */
export type LiveCaption = { id: number; who: 'vendor' | 'assistant'; text: string; closed?: boolean };

/**
 * The part of a WebSocket the link uses (browser and React Native alike). The platform opens it
 * with `binaryType = 'arraybuffer'` and forwards `onmessage` to `receive` and `onclose` to `closed`.
 */
export type LiveSocket = {
  readonly readyState: number;
  send(data: string | ArrayBuffer): void;
  close(code?: number, reason?: string): void;
};

const OPEN = 1;

export type LiveCallbacks = {
  onReady?: (maxSeconds: number) => void;
  /** The server's checked result: draft, next question, location, slots (BR-41: nothing filed). */
  onAssist: (result: AssistTurnResult, cause: 'voice' | 'screen') => void;
  onStatus?: (status: LiveStatus) => void;
  onCaption?: (who: LiveCaption['who'], text: string) => void;
  onAudio?: (generation: number, pcm: Int16Array) => void;
  onInterrupted?: (generation: number) => void;
  onTurnComplete?: (generation: number) => void;
  onNotice?: (text: string) => void;
  /** The session is over; `reason` is a server end/error code or one of this file's own. */
  onEnded: (reason: string) => void;
};

/** No "ready" this long after the socket opened: Gemini is slow or out of quota, use tap-to-talk. */
export const READY_TIMEOUT_MS = 8000;

/**
 * 16 kHz PCM16 is 32 KB/s; at most 1.5x that goes out per second. A device that stalled (keyboard
 * opening, busy app) hands its backlog over at once -- stale speech, so the excess is dropped.
 */
export const MIC_BYTES_PER_SECOND = 48_000;

/**
 * Hub paths sit beside /api; the upgrade is authenticated with access_token like SignalR. Built
 * as a string: React Native's URL cannot set a protocol or path.
 */
export function liveStreamUrl(apiBaseUrl: string, origin: string, streamPath: string, ticket: string, accessToken: string) {
  const absolute = /^https?:\/\//i.test(apiBaseUrl)
    ? apiBaseUrl
    : `${origin.replace(/\/$/, '')}/${apiBaseUrl.replace(/^\//, '')}`;
  const host = absolute.split(/[?#]/)[0]!.replace(/\/$/, '').replace(/\/api$/, '');
  const query = `ticket=${encodeURIComponent(ticket)}&access_token=${encodeURIComponent(accessToken)}`;
  return `${host.replace(/^http/i, 'ws')}${streamPath}?${query}`;
}

/** Server audio frames are [uint32 generation, little-endian][PCM16 mono]. */
export function parseLiveAudio(data: ArrayBuffer): { generation: number; pcm: Int16Array } | null {
  if (data.byteLength < 6 || (data.byteLength - 4) % 2 !== 0) return null;
  const generation = new DataView(data).getUint32(0, true);
  return { generation, pcm: new Int16Array(data.slice(4)) };
}

/** Fragments from the same speaker extend one caption; only the last few lines are kept. */
export function appendLiveCaption(captions: LiveCaption[], who: LiveCaption['who'], text: string, max = 4): LiveCaption[] {
  if (!text) return captions;
  const last = captions.at(-1);
  if (last && last.who === who && !last.closed) return [...captions.slice(0, -1), { ...last, text: last.text + text }];
  return [...captions, { id: (last?.id ?? 0) + 1, who, text: text.trimStart() }].slice(-max);
}

/** A turn ended (or was cut off): its line is finished. */
export function closeLiveCaption(captions: LiveCaption[]): LiveCaption[] {
  const last = captions.at(-1);
  return last && !last.closed ? [...captions.slice(0, -1), { ...last, closed: true }] : captions;
}

/** What to tell the vendor when the conversation stops before the interview is done. */
export function fallbackNotice(reason: string): string {
  switch (reason) {
    case 'ended':
      return 'Đã dừng trò chuyện. Bạn bấm micro để trả lời từng câu — phần đã kể vẫn giữ.';
    case 'voice_daily_limit':
      return 'Hôm nay đã hết thời lượng trò chuyện trực tiếp. Bạn bấm micro để trả lời từng câu — phần đã kể vẫn giữ.';
    case 'voice_active':
      return 'Bạn đang mở một phiên giọng nói khác (ví dụ trợ lý hỏi đáp). Chuyển sang bấm micro để trả lời từng câu.';
    case 'time_limit':
      return 'Đã hết thời gian trò chuyện. Bạn bấm micro để trả lời tiếp — phần đã kể vẫn giữ.';
    case 'idle':
      return 'Trợ lý dừng nghe vì lâu không có tiếng. Bạn bấm micro để trả lời tiếp.';
    case 'hidden':
      return 'Trò chuyện đã dừng khi bạn rời trang. Bạn bấm micro để trả lời tiếp.';
    case 'session_expired':
      return 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại để tiếp tục.';
    case 'mic':
      return 'Chưa mở được micro để trò chuyện. Bạn bấm micro để trả lời từng câu, hoặc bấm "Gõ thay".';
    default:
      return 'Trò chuyện trực tiếp đang bận. Chuyển sang bấm micro để trả lời từng câu — phần đã kể vẫn giữ.';
  }
}

const STATUSES: readonly LiveStatus[] = ['connecting', 'listening', 'thinking', 'speaking', 'muted', 'reconnecting'];

/**
 * One live interview over an open-or-opening socket. Keeps the version of the last screen the
 * server sent, so a tap made on an out-of-date screen is refused instead of overwriting a newer
 * spoken answer; ends itself if the server is not ready in time.
 */
export class LiveInterviewLink {
  private version = 0;
  private muted = false;
  private micWindowStart = 0;
  private micWindowBytes = 0;
  private done = false;
  private readyTimer: ReturnType<typeof setTimeout> | undefined;
  /** A tap was sent and its result has not come back yet. */
  pending = false;

  constructor(
    private readonly socket: LiveSocket,
    private readonly callbacks: LiveCallbacks,
    readyTimeoutMs = READY_TIMEOUT_MS,
  ) {
    this.readyTimer = setTimeout(() => this.finish('ready_timeout'), readyTimeoutMs);
  }

  get open() {
    return !this.done && this.socket.readyState === OPEN;
  }

  sendAudio(pcm: ArrayBuffer, now = Date.now()) {
    if (!this.open || this.muted) return;
    if (now - this.micWindowStart >= 1000) {
      this.micWindowStart = now;
      this.micWindowBytes = 0;
    }
    if (this.micWindowBytes + pcm.byteLength > MIC_BYTES_PER_SECOND) return;
    this.micWindowBytes += pcm.byteLength;
    this.socket.send(pcm);
  }

  /** The draft after a tap, built with the same rules as tap-to-talk (interview-state.ts). */
  sendDraft(draft: AssistDraft) {
    if (!this.open) return false;
    this.pending = true;
    this.socket.send(JSON.stringify({ type: 'draft', version: this.version, draft }));
    return true;
  }

  /** "Gõ thay": typed words count as the vendor's own answer. */
  sendText(text: string) {
    const value = text.trim();
    if (!this.open || !value) return false;
    this.socket.send(JSON.stringify({ type: 'text', text: value.slice(0, 500) }));
    return true;
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.open) this.socket.send(JSON.stringify({ type: 'mute', muted }));
  }

  /** Ask the server to end; it answers "ended", which closes the session here. */
  end() {
    if (this.open) this.socket.send(JSON.stringify({ type: 'end' }));
    else this.finish('ended');
  }

  /** Close without waiting (unmount, leaving the screen); the server is told the vendor ended it. */
  close(reason = 'ended') {
    if (this.open) {
      try {
        this.socket.send(JSON.stringify({ type: 'end' }));
      } catch {
        // Closing anyway.
      }
    }
    this.finish(reason);
  }

  /** The socket closed without the server saying why. */
  closed() {
    this.finish('disconnected');
  }

  /** One message from the socket: a binary audio frame or a JSON event. */
  receive(data: unknown) {
    if (this.done) return;
    if (data instanceof ArrayBuffer) {
      const frame = parseLiveAudio(data);
      if (frame) this.callbacks.onAudio?.(frame.generation, frame.pcm);
      return;
    }

    let event: LiveServerEvent;
    try {
      event = JSON.parse(String(data)) as LiveServerEvent;
    } catch {
      return;
    }

    switch (event.type) {
      case 'ready':
        clearTimeout(this.readyTimer);
        this.callbacks.onReady?.(event.maxSeconds);
        break;
      case 'state':
        if ((STATUSES as readonly string[]).includes(event.state))
          this.callbacks.onStatus?.(event.state === 'listening' && this.muted ? 'muted' : (event.state as LiveStatus));
        break;
      case 'assist':
        this.version = event.version;
        this.pending = false;
        this.callbacks.onAssist(event.result, event.cause);
        break;
      case 'input_transcript':
        this.callbacks.onCaption?.('vendor', event.text);
        break;
      case 'output_transcript':
        this.callbacks.onCaption?.('assistant', event.text);
        break;
      case 'interrupted':
        this.callbacks.onInterrupted?.(event.generation);
        break;
      case 'turn_complete':
        this.callbacks.onTurnComplete?.(event.generation);
        break;
      case 'warning':
        if (event.code === 'stale_draft') this.pending = false;
        this.callbacks.onNotice?.(
          event.code === 'time_limit'
            ? `Còn ${event.secondsLeft ?? 30} giây trò chuyện.`
            : event.code === 'idle'
              ? 'Trợ lý chưa nghe thấy bạn. Cuộc trò chuyện sẽ dừng nếu bạn không nói tiếp.'
              : (event.message ?? ''),
        );
        break;
      case 'error':
        this.finish(event.code);
        break;
      case 'ended':
        this.finish(event.reason);
        break;
    }
  }

  private finish(reason: string) {
    if (this.done) return;
    this.done = true;
    this.pending = false;
    clearTimeout(this.readyTimer);
    if (this.socket.readyState <= OPEN) {
      try {
        this.socket.close(1000, 'ended');
      } catch {
        // Already closing.
      }
    }
    this.callbacks.onStatus?.('ended');
    this.callbacks.onEnded(reason);
  }
}
