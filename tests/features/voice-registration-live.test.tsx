import { fireEvent, render, screen } from '@testing-library/react-native';

import { InterviewTurn, type InterviewProps } from '@/features/business-registrations/voice/InterviewParts';
import * as live from '@/features/business-registrations/voice/live-interview';
import { toMic16k, wavOf } from '@/features/business-registrations/voice/useLiveInterview';
import { pickVietnameseVoice } from '@/features/business-registrations/voice/useReadAloud';
import type { AssistQuestion, AssistTurnResult } from '@/features/business-registrations/voice/voice-registration.types';

// Native audio has no runtime under Jest; these tests cover the logic around it.
jest.mock('expo-audio', () => ({
  useAudioRecorder: () => ({ prepareToRecordAsync: jest.fn(), record: jest.fn(), stop: jest.fn(), uri: null }),
  requestRecordingPermissionsAsync: jest.fn(),
  setAudioModeAsync: jest.fn(),
  createAudioPlaylist: jest.fn(),
  AudioQuality: { HIGH: 96 },
  IOSOutputFormat: { MPEG4AAC: 'aac ' },
}));
jest.mock('expo-audio/build/AudioModule', () => ({ __esModule: true, default: {} }));
jest.mock('expo-file-system', () => ({ File: jest.fn(), Paths: { cache: {} } }));
jest.mock('expo-speech', () => ({ speak: jest.fn(), stop: jest.fn(), getAvailableVoicesAsync: jest.fn().mockResolvedValue([]), VoiceQuality: { Default: 'Default', Enhanced: 'Enhanced' } }));
jest.mock('@/components/map/LeafletMap', () => ({ LeafletMap: () => null }));

const capital: AssistQuestion = { key: 'CAPITAL', text: 'Vốn bỏ ra ban đầu khoảng bao nhiêu ạ?', input: 'VOICE', choices: [], field: 'capitalAmount', skippable: false };

const result = (next: AssistQuestion | null): AssistTurnResult => ({
  transcript: null,
  proposals: [],
  location: null,
  slotPreview: [],
  nextQuestion: next,
  warnings: [],
  done: next === null,
  isAiGenerated: true,
  draft: { salutation: 'cô' },
});

function socket() {
  return { readyState: 1, sent: [] as (string | ArrayBuffer)[], send(data: string | ArrayBuffer) { this.sent.push(data); }, close: jest.fn() };
}

describe('live conversation protocol (same file as the web)', () => {
  it('a tap carries the version of the screen it was made on, and a server error ends the session once', () => {
    const s = socket();
    const reasons: string[] = [];
    const onAssist = jest.fn();
    const link = new live.LiveInterviewLink(s, { onAssist, onEnded: (r) => reasons.push(r) });
    link.receive(JSON.stringify({ type: 'assist', version: 2, cause: 'voice', result: result(capital) }));
    expect(onAssist).toHaveBeenCalledWith(expect.objectContaining({ nextQuestion: capital }), 'voice');
    link.sendDraft({ salutation: 'cô' });
    expect(JSON.parse(s.sent.at(-1) as string)).toEqual({ type: 'draft', version: 2, draft: { salutation: 'cô' } });
    link.receive(JSON.stringify({ type: 'error', code: 'voice_busy', message: 'x' }));
    link.receive(JSON.stringify({ type: 'ended', reason: 'voice_busy' }));
    expect(reasons).toEqual(['voice_busy']);
    expect(s.close).toHaveBeenCalled();
  });

  it('builds the stream address without URL setters (React Native has none)', () => {
    expect(live.liveStreamUrl('http://10.0.2.2:5023/api', '', '/hubs/registration-voice/abc', 'tk', 'jwt')).toBe(
      'ws://10.0.2.2:5023/hubs/registration-voice/abc?ticket=tk&access_token=jwt',
    );
  });
});

describe('phone audio', () => {
  it('turns a 48 kHz microphone buffer into 16 kHz mono for the server', () => {
    const input = new Int16Array(480).map((_, i) => i);
    const out = new Int16Array(toMic16k(input.buffer, 48_000, 1));
    expect(out.length).toBe(160);
    expect(out[1]).toBe(3);
    const stereo = new Int16Array([10, -1, 20, -1, 30, -1, 40, -1]);
    expect(Array.from(new Int16Array(toMic16k(stereo.buffer, 16_000, 2)))).toEqual([10, 20, 30, 40]);
  });

  it('wraps a piece of the assistant\'s voice in a playable WAV header', () => {
    const wav = wavOf(new Int16Array([1, -1, 2]), 24_000);
    const view = new DataView(wav.buffer);
    expect(String.fromCharCode(...wav.slice(0, 4))).toBe('RIFF');
    expect(String.fromCharCode(...wav.slice(8, 12))).toBe('WAVE');
    expect(view.getUint32(24, true)).toBe(24_000);
    expect(view.getUint32(40, true)).toBe(6);
    expect(wav.length).toBe(50);
  });

  it('reads aloud only with a Vietnamese voice, the enhanced one first', () => {
    const v = (identifier: string, language: string, quality = 'Default') => ({ identifier, name: identifier, language, quality }) as never;
    expect(pickVietnameseVoice([v('en-us-x-sfg-local', 'en-US'), v('vi-vn-x-gft-local', 'vi-VN'), v('vi-vn-x-gft-network', 'vi-VN', 'Enhanced')])).toEqual(
      expect.objectContaining({ identifier: 'vi-vn-x-gft-network' }),
    );
    expect(pickVietnameseVoice([v('en-us-x-sfg-local', 'en-US')])).toBeNull();
  });
});

describe('interview turn while talking', () => {
  const props = (over: Partial<InterviewProps> = {}): InterviewProps => ({
    question: capital,
    draft: { salutation: 'cô' },
    busy: false,
    transcript: 'vốn ba chục triệu',
    warnings: [],
    location: null,
    slotPreview: [],
    wardName: () => null,
    aiDown: false,
    voiceConsent: true,
    typing: false,
    onTypingChange: jest.fn(),
    reader: { supported: true, speaking: false, speak: jest.fn(), stop: jest.fn() },
    autoRead: true,
    live: true,
    onVoice: jest.fn(),
    onText: jest.fn(),
    onChoice: jest.fn(),
    onTyped: jest.fn(),
    onPin: jest.fn(),
    onSkip: jest.fn(),
    onWizard: jest.fn(),
    ...over,
  });

  it('listens instead of showing the record button, and never reads the question with the phone voice', async () => {
    const p = props();
    await render(<InterviewTurn {...p} />);
    expect(screen.getByText('Cứ nói câu trả lời — trợ lý đang nghe.')).toBeTruthy();
    expect(screen.queryByLabelText('Bấm để nói')).toBeNull();
    expect(screen.queryByLabelText('Đọc lại câu hỏi')).toBeNull();
    expect(p.reader.speak).not.toHaveBeenCalled();
  });

  it('the ward question shows the guesses as buttons and finds any other ward by name', async () => {
    const ward: AssistQuestion = {
      key: 'WARD',
      text: 'Chỗ đó thuộc phường, xã nào ạ? Trợ lý đoán là:',
      input: 'CHOICE',
      choices: [
        { value: '10', label: 'Phường Hải Châu' },
        { value: '101', label: 'Phường Hòa Cường' },
        { value: '11', label: 'Phường Thanh Khê' },
        { value: '120', label: 'Xã Hòa Vang' },
      ],
      field: null,
      skippable: false,
      suggestedCount: 2,
    };
    const p = props({ question: ward, live: false });
    await render(<InterviewTurn {...p} />);
    expect(screen.getByText('Phường Hải Châu')).toBeTruthy();
    expect(screen.getByText('Phường Hòa Cường')).toBeTruthy();
    expect(screen.queryByText('Xã Hòa Vang')).toBeNull();

    await fireEvent.changeText(screen.getByLabelText('Không phải? Tìm phường, xã khác'), 'hoa vang');
    await fireEvent.press(screen.getByText('Xã Hòa Vang'));
    expect(p.onChoice).toHaveBeenCalledWith('120');
  });

  it('"Gõ thay" sends the typed answer into the conversation', async () => {
    const p = props({ typing: true });
    await render(<InterviewTurn {...p} />);
    await fireEvent.changeText(screen.getByLabelText('Gõ câu trả lời'), 'vốn ba chục triệu');
    await fireEvent.press(screen.getByText('Gửi'));
    expect(p.onText).toHaveBeenCalledWith('vốn ba chục triệu');
  });
});
