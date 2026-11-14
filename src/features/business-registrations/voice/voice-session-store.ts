import { create } from 'zustand';

import type { KycIdCardExtraction } from '@/core/api';
import {
  sourcesAfterTurn,
  todayInVietnam,
  salutationFor,
  type CardField,
  type FieldSource,
} from './interview-state';
import type {
  AssistDraft,
  AssistQuestion,
  AssistSlotPreview,
  AssistTurnResult,
  AssistWardOption,
} from './voice-registration.types';

export type VoicePhase = 'consent' | 'identity' | 'interview' | 'photos' | 'card' | 'done';

/** What the CCCD scan told us that the interview uses -- kept on this device only. */
export type KycSummary = {
  fullName: string | null;
  confidencePercent: number;
  needsManualVerification: boolean;
  /** Wizard fields the scan filled (same set IdCardScanner writes). */
  filled: string[];
};

export type VoiceResult = {
  registrationId: number;
  displayName: string;
  nearbySlots: number;
  labelled: boolean;
};

type VoiceSession = {
  /** True from "Bắt đầu" until the registration is filed or the vendor leaves the flow. */
  active: boolean;
  phase: VoicePhase;
  voiceConsent: boolean;
  startedAt: number | null;
  /** Answers given by voice or typing (T1 counts these). */
  turns: number;
  draft: AssistDraft;
  question: AssistQuestion | null;
  transcript: string | null;
  warnings: string[];
  location: { label: string; latitude: number; longitude: number } | null;
  wardOptions: AssistWardOption[];
  slotPreview: AssistSlotPreview[];
  sources: Partial<Record<CardField, FieldSource>>;
  lowConfidence: CardField[];
  kyc: KycSummary | null;
  /** Suggested on reaching the card; the vendor changes it in the wizard. */
  displayName: string;
  foodSafety: boolean;
  /**
   * Set when the vendor tapped "Sửa": the interview's values were copied into the wizard store
   * and the wizard is their home from then on. `snapshot` is what was copied, to tell edits apart.
   */
  handedOff: boolean;
  snapshot: Record<string, string> | null;
  result: VoiceResult | null;
};

export type VoiceSessionState = VoiceSession;

type VoiceSessionActions = {
  start: (voiceConsent: boolean) => void;
  setPhase: (phase: VoicePhase) => void;
  applyTurn: (result: AssistTurnResult, answered: boolean) => void;
  setDraft: (draft: AssistDraft, sources?: Partial<Record<CardField, FieldSource>>) => void;
  setKyc: (extraction: KycIdCardExtraction) => void;
  setDisplayName: (name: string) => void;
  setFoodSafety: (value: boolean) => void;
  handOff: (snapshot: Record<string, string>) => void;
  finish: (result: VoiceResult) => void;
  clear: () => void;
};

const initial: VoiceSession = {
  active: false,
  phase: 'consent',
  voiceConsent: false,
  startedAt: null,
  turns: 0,
  draft: { salutation: 'bạn' },
  question: null,
  transcript: null,
  warnings: [],
  location: null,
  wardOptions: [],
  slotPreview: [],
  sources: {},
  lowConfidence: [],
  kyc: null,
  displayName: '',
  foodSafety: false,
  handedOff: false,
  snapshot: null,
  result: null,
};

/**
 * The X01 interview, held in memory across the voice screen and the wizard steps "Sửa" opens.
 * Nothing here is filed: the wizard store and `submitRegistrationDraft()` do that, after the
 * vendor's own tap (BR-41).
 */
export const useVoiceSessionStore = create<VoiceSession & VoiceSessionActions>((set) => ({
  ...initial,
  start: (voiceConsent) =>
    set({ ...initial, active: true, phase: 'identity', voiceConsent, startedAt: Date.now() }),
  setPhase: (phase) => set({ phase }),
  applyTurn: (result, answered) =>
    set((s) => {
      const { sources, lowConfidence } = sourcesAfterTurn(s.sources, s.lowConfidence, result.proposals);
      return {
        turns: s.turns + (answered ? 1 : 0),
        draft: { ...result.draft, salutation: s.draft.salutation ?? 'bạn' },
        question: result.nextQuestion,
        transcript: answered ? result.transcript : s.transcript,
        warnings: result.warnings,
        location: result.location
          ? {
              label: result.location.label,
              latitude: result.location.latitude,
              longitude: result.location.longitude,
            }
          : result.draft.latitude == null
            ? null
            : s.location,
        wardOptions: result.location?.wardOptions.length
          ? result.location.wardOptions
          : s.wardOptions,
        slotPreview: result.slotPreview,
        sources,
        lowConfidence,
      };
    }),
  setDraft: (draft, sources) =>
    set((s) => ({ draft, sources: sources ? { ...s.sources, ...sources } : s.sources })),
  setKyc: (extraction) =>
    set((s) => ({
      kyc: {
        fullName: extraction.fullName,
        confidencePercent: extraction.confidencePercent,
        needsManualVerification: extraction.needsManualVerification,
        filled: Object.entries({
          ownerDateOfBirth: extraction.dateOfBirth,
          ownerGender: extraction.gender,
          ownerNationality: extraction.nationality,
          ownerEthnicity: extraction.ethnicity,
          permanentAddress: extraction.permanentAddress,
          idIssuedDate: extraction.idIssuedDate,
          idIssuedPlace: extraction.idIssuedPlace,
        })
          .filter(([, value]) => !!value)
          .map(([key]) => key),
      },
      draft: {
        ...s.draft,
        salutation: salutationFor(extraction.gender, extraction.dateOfBirth, todayInVietnam()),
      },
    })),
  setDisplayName: (displayName) => set({ displayName }),
  setFoodSafety: (foodSafety) => set({ foodSafety }),
  handOff: (snapshot) => set({ handedOff: true, snapshot }),
  finish: (result) => set({ ...initial, phase: 'done', result }),
  clear: () => set(initial),
}));
