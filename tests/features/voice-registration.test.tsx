import { fireEvent, render, screen } from '@testing-library/react-native';

import type { ApiRegistration } from '@/core/api';
import { useNewRegistrationStore } from '@/features/business-registrations/new-registration-store';
import { submitRegistrationDraft } from '@/features/business-registrations/submit-registration';
import { InterviewTurn, type InterviewProps } from '@/features/business-registrations/voice/InterviewParts';
import * as state from '@/features/business-registrations/voice/interview-state';
import { afterWizardFiled, cardValues, copyInterviewToWizard, fileAssistedRegistration } from '@/features/business-registrations/voice/voice-filing';
import { voiceRegistrationApi } from '@/features/business-registrations/voice/voice-registration-api';
import type { AssistDraft, AssistQuestion } from '@/features/business-registrations/voice/voice-registration.types';
import { useVoiceSessionStore } from '@/features/business-registrations/voice/voice-session-store';

// Native recording and speech have no runtime under Jest; the confirm turn never records.
jest.mock('expo-audio', () => ({
  useAudioRecorder: () => ({ prepareToRecordAsync: jest.fn(), record: jest.fn(), stop: jest.fn(), uri: null }),
  requestRecordingPermissionsAsync: jest.fn(),
  setAudioModeAsync: jest.fn(),
  AudioQuality: { HIGH: 96 },
  IOSOutputFormat: { MPEG4AAC: 'aac ' },
}));
jest.mock('expo-file-system', () => ({ File: jest.fn().mockImplementation(() => ({ delete: jest.fn() })) }));
jest.mock('expo-speech', () => ({ speak: jest.fn(), stop: jest.fn() }));
jest.mock('@/components/map/LeafletMap', () => ({ LeafletMap: () => null }));
jest.mock('@/features/business-registrations/submit-registration', () => ({ submitRegistrationDraft: jest.fn() }));
jest.mock('@/features/business-registrations/voice/voice-registration-api', () => ({
  voiceRegistrationApi: { turn: jest.fn(), confirm: jest.fn() },
}));

const submit = submitRegistrationDraft as jest.Mock;
const confirm = voiceRegistrationApi.confirm as jest.Mock;

/** Everything the interview collects, all numbers confirmed. */
const finished: AssistDraft = {
  businessLine: 'Bún bò, bánh mì',
  vendorType: 'ITINERANT',
  locationText: 'chợ Cồn',
  latitude: 16.06864,
  longitude: 108.219763,
  locationConfirmed: true,
  wardUnitId: 10,
  capitalAmount: 30_000_000,
  laborCount: 2,
  plannedStartDate: '2026-10-26',
  contactSameAsPermanent: true,
  confirmed: ['capitalAmount', 'laborCount', 'plannedStartDate'],
  salutation: 'cô',
};

function startSession(draft: AssistDraft = finished) {
  useVoiceSessionStore.setState({
    active: true,
    phase: 'card',
    voiceConsent: true,
    startedAt: Date.now() - 90_000,
    turns: 4,
    draft,
    sources: { businessLine: 'VOICE', capitalAmount: 'VOICE', laborCount: 'VOICE', plannedStartDate: 'VOICE' },
    displayName: 'Bún bò Cô Hoa',
    foodSafety: true,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  useNewRegistrationStore.getState().reset();
  useVoiceSessionStore.getState().clear();
});

describe('shared interview rules (same file as the web)', () => {
  it('addresses the vendor from the CCCD and suggests a shop name', () => {
    expect(state.salutationFor('FEMALE', '1975-03-02', '2026-10-23')).toBe('cô');
    expect(state.salutationFor('MALE', '1995-05-05', '2026-10-23')).toBe('anh');
    expect(state.suggestDisplayName('bún bò, bánh mì', 'cô', 'NGUYỄN THỊ HOA')).toBe('Bún bò Cô Hoa');
  });

  it('keeps unconfirmed amounts and dates out of the wizard', () => {
    const fields = state.interviewToWizard({ ...finished, confirmed: [] }, 'Bún bò Cô Hoa');
    expect(fields.capitalAmount).toBe('');
    expect(fields.laborCount).toBe('');
    expect(fields.plannedStartDate).toBe('');
    expect(fields.businessLine).toBe('Bún bò, bánh mì');
  });
});

describe('filing a voice draft', () => {
  it('shows the interview on the card without writing it into the wizard (T3)', () => {
    startSession();
    const values = cardValues();
    expect(values.capitalAmount).toBe('30000000');
    expect(useNewRegistrationStore.getState().capitalAmount).toBe('');
    expect(useNewRegistrationStore.getState().businessLine).toBe('');
  });

  it('"Đúng, nộp" files through the wizard\'s own submit, then records the acceptance (T4)', async () => {
    startSession();
    let filed: Record<string, unknown> = {};
    submit.mockImplementation(async () => {
      filed = { ...useNewRegistrationStore.getState() };
      return { registrationId: 77, displayName: 'Bún bò Cô Hoa', registrationStatus: 'SUBMITTED' } as ApiRegistration;
    });
    confirm.mockResolvedValue({ aiLogId: 1, registrationId: 77, confirmedAt: '' });

    const { registration, labelled } = await fileAssistedRegistration();

    expect(registration.registrationId).toBe(77);
    expect(labelled).toBe(true);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(filed).toMatchObject({ businessLine: 'Bún bò, bánh mì', capitalAmount: '30000000', laborCount: '2', plannedStartDate: '2026-10-26', wardUnitId: 10, contactAddress: '', foodSafetyCommitment: true, idType: 'CCCD' });
    expect(confirm).toHaveBeenCalledWith(77, expect.objectContaining({ turns: 4, editedFields: [], aiFields: expect.arrayContaining(['businessLine', 'capitalAmount']) }));
  });

  it('records what the vendor changed in the wizard after "Sửa"', async () => {
    startSession();
    copyInterviewToWizard();
    useNewRegistrationStore.getState().setField('laborCount', '3');
    submit.mockResolvedValue({ registrationId: 78, displayName: 'x', registrationStatus: 'SUBMITTED' });
    confirm.mockResolvedValue({});

    await afterWizardFiled({ registrationId: 78 } as ApiRegistration);

    expect(confirm).toHaveBeenCalledWith(78, expect.objectContaining({ editedFields: ['laborCount'] }));
    expect(useVoiceSessionStore.getState().active).toBe(false);
  });

  it('a filing that never began as a voice interview records nothing', async () => {
    await afterWizardFiled({ registrationId: 79 } as ApiRegistration);
    expect(confirm).not.toHaveBeenCalled();
  });
});

describe('interview turn', () => {
  const confirmQuestion: AssistQuestion = {
    key: 'CONFIRM:capitalAmount',
    text: 'Ba mươi triệu đồng, đúng không ạ?',
    input: 'CONFIRM',
    choices: [
      { value: 'yes', label: 'Đúng rồi' },
      { value: 'no', label: 'Nói lại' },
    ],
    field: 'capitalAmount',
    skippable: false,
  };
  const props = (over: Partial<InterviewProps> = {}): InterviewProps => ({
    question: confirmQuestion,
    draft: { businessLine: 'Bún bò', capitalAmount: 30_000_000 },
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
    onVoice: jest.fn(),
    onText: jest.fn(),
    onChoice: jest.fn(),
    onTyped: jest.fn(),
    onPin: jest.fn(),
    onSkip: jest.fn(),
    onWizard: jest.fn(),
    ...over,
  });

  it('reads the amount back and waits for a tap before it counts', async () => {
    const p = props();
    await render(<InterviewTurn {...p} />);
    expect(screen.getByText('Ba mươi triệu đồng, đúng không ạ?')).toBeTruthy();
    expect(screen.getByText('chờ bạn xác nhận')).toBeTruthy();
    expect(p.reader.speak).toHaveBeenCalledWith('Ba mươi triệu đồng, đúng không ạ?');
    await fireEvent.press(screen.getByText('Đúng rồi'));
    expect(p.onChoice).toHaveBeenCalledWith('yes');
  });

  it('AI down: offers manual entry instead of the microphone (T7)', async () => {
    const p = props({ question: { key: 'OPENING', text: 'Bạn bán món gì?', input: 'VOICE', choices: [], field: null, skippable: false }, aiDown: true });
    await render(<InterviewTurn {...p} />);
    await fireEvent.press(screen.getByText('Điền tiếp bằng tay'));
    expect(p.onWizard).toHaveBeenCalled();
  });
});
