import { apiPost, apiUpload } from '@/core/api/client';

import type {
  AssistAudio,
  AssistConfirmation,
  AssistConfirmationRequest,
  AssistDraft,
  AssistLiveTicket,
  AssistTurnResult,
  QuestionKey,
} from './voice-registration.types';

/**
 * X01 voice registration assistant (StreetBiz-BE `VendorRegistrationAssistController`).
 *
 * The assistant only proposes values. Filing still goes through `submitRegistrationDraft()`
 * after the vendor taps "Đúng, nộp"; `confirm` then records that acceptance (BR-41/46).
 *
 * Shared file: the app keeps a verbatim copy. Change both together.
 */
export const voiceRegistrationApi = {
  /**
   * One interview turn: a clip, typed text, or neither (just plan the next question, e.g. after
   * a tap on a choice). A 503 with type `ai_unavailable` means speech-to-text and every model
   * are down: fall back to typing or the step-by-step wizard, keeping the draft.
   */
  turn: (input: {
    questionKey: QuestionKey;
    draft: AssistDraft;
    text?: string;
    audio?: AssistAudio;
    voiceConsent: boolean;
  }) => {
    const form = new FormData();
    form.append('questionKey', input.questionKey);
    form.append('draft', JSON.stringify(input.draft));
    form.append('voiceConsent', String(input.voiceConsent));
    if (input.text?.trim()) form.append('text', input.text.trim());
    if (input.audio) {
      // A Blob on the web; a `{ uri, name, type }` part on React Native.
      form.append('audio', input.audio.body as Blob, input.audio.fileName);
    }
    return apiUpload<AssistTurnResult>('/vendor/registrations/assist/turn', form);
  },

  /**
   * X01 v2: a ticket for the live conversation. 503 `voice_unavailable`, 429 `voice_daily_limit`
   * / `voice_busy` and 409 `voice_active` all mean "use tap-to-talk (`turn`) instead".
   */
  startLive: (draft: AssistDraft, voiceConsent: boolean) =>
    apiPost<AssistLiveTicket>('/vendor/registrations/assist/live', { draft, voiceConsent }),

  /** After filing: the vendor accepted the assistant's draft. Idempotent per registration. */
  confirm: (registrationId: number, body: AssistConfirmationRequest) =>
    apiPost<AssistConfirmation>(`/vendor/registrations/${registrationId}/assist/confirm`, body),
};
