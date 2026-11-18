import { ApiError, type ApiRegistration } from '@/core/api';
import { useNewRegistrationStore } from '../new-registration-store';
import { submitRegistrationDraft } from '../submit-registration';
import { interviewToWizard } from './interview-state';
import { voiceRegistrationApi } from './voice-registration-api';
import { useVoiceSessionStore } from './voice-session-store';

type WizardState = ReturnType<typeof useNewRegistrationStore.getState>;

/** Wizard fields the confirm card shows; compared before/after "Sửa" to find the vendor's edits. */
const WATCHED = [
  'vendorType',
  'displayName',
  'declaredAddress',
  'addressLatitude',
  'addressLongitude',
  'wardUnitId',
  'businessLine',
  'capitalAmount',
  'laborCount',
  'plannedStartDate',
  'contactAddress',
  'foodSafetyCommitment',
  'ownerDateOfBirth',
  'ownerGender',
  'ownerNationality',
  'ownerEthnicity',
  'idIssuedDate',
  'idIssuedPlace',
  'permanentAddress',
] as const satisfies readonly (keyof WizardState)[];

export type WatchedField = (typeof WATCHED)[number];

function snapshotOf(state: Pick<WizardState, WatchedField>): Record<string, string> {
  return Object.fromEntries(WATCHED.map((k) => [k, String(state[k] ?? '')]));
}

/**
 * The values the confirm card shows. Until the vendor taps "Sửa" the interview's own values are
 * laid over the wizard store in memory -- nothing is written (T3); afterwards the wizard store is
 * the only source, since that is where the vendor edits.
 */
export function cardValues(): Pick<WizardState, WatchedField> {
  const wizard = useNewRegistrationStore.getState();
  const session = useVoiceSessionStore.getState();
  const base = Object.fromEntries(WATCHED.map((k) => [k, wizard[k]])) as Pick<WizardState, WatchedField>;
  if (session.handedOff) return base;
  return {
    ...base,
    ...interviewToWizard(session.draft, session.displayName),
    // "Đúng, ở địa chỉ đó" leaves the wizard's "địa chỉ liên lạc (nếu khác thường trú)" empty.
    contactAddress: session.draft.contactSameAsPermanent ? '' : wizard.contactAddress,
    foodSafetyCommitment: session.foodSafety,
  };
}

/**
 * Copies the interview into the wizard store. Called only from the vendor's own tap ("Sửa" or
 * "Đúng, nộp"); numbers still waiting for their "Đúng rồi" are left out.
 */
export function copyInterviewToWizard(): void {
  const session = useVoiceSessionStore.getState();
  if (session.handedOff) return;
  const values = cardValues();
  const wizard = useNewRegistrationStore.getState();
  for (const key of WATCHED) {
    wizard.setField(key, values[key] as never);
  }
  if (!wizard.idType) wizard.setField('idType', 'CCCD');
  session.handOff(snapshotOf(values));
}

/** Wizard fields the vendor changed after "Sửa" (empty when they never left the card). */
export function editedFields(): WatchedField[] {
  const { snapshot } = useVoiceSessionStore.getState();
  if (!snapshot) return [];
  const now = snapshotOf(useNewRegistrationStore.getState());
  return WATCHED.filter((k) => snapshot[k] !== now[k]);
}

const AI_FIELD_TO_WIZARD: Record<string, WatchedField[]> = {
  businessLine: ['businessLine'],
  vendorType: ['vendorType'],
  location: ['addressLatitude', 'addressLongitude'],
  declaredAddress: ['declaredAddress'],
  capitalAmount: ['capitalAmount'],
  laborCount: ['laborCount'],
  plannedStartDate: ['plannedStartDate'],
  contactAddress: ['contactAddress'],
};

/**
 * Records that the vendor accepted the assistant's draft (AIAssistanceLogs, BR-41/46). Filing
 * already succeeded, so a failure here never undoes it: retried twice, then reported.
 */
export async function recordAcceptance(registrationId: number): Promise<boolean> {
  const session = useVoiceSessionStore.getState();
  const aiFields = Object.entries(session.sources)
    .filter(([, source]) => source === 'VOICE')
    .flatMap(([field]) => AI_FIELD_TO_WIZARD[field] ?? []);
  const body = {
    turns: session.turns,
    aiFields,
    editedFields: editedFields(),
    durationSeconds: session.startedAt ? Math.round((Date.now() - session.startedAt) / 1000) : 0,
  };
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await voiceRegistrationApi.confirm(registrationId, body);
      return true;
    } catch (err) {
      // Idempotent on the server, so a dropped connection or a busy server is worth another
      // try; a refused request (4xx) will be refused again.
      if (err instanceof ApiError && err.status >= 400 && err.status < 500) return false;
    }
  }
  return false;
}

/**
 * "Đúng, nộp": copy the interview into the wizard store, file through the wizard's own
 * `submitRegistrationDraft()` (same API calls as the step-by-step wizard, T4), then record the
 * acceptance. Resumable like the wizard: a retry after a failed step skips what succeeded.
 */
export async function fileAssistedRegistration(): Promise<{
  registration: ApiRegistration;
  labelled: boolean;
}> {
  copyInterviewToWizard();
  const registration = await submitRegistrationDraft();
  const labelled = await recordAcceptance(registration.registrationId);
  return { registration, labelled };
}

/**
 * The wizard filed a registration (Giấy tờ step). If it began as a voice interview, record the
 * acceptance too so the officer still sees the [AI] label, then close the session.
 */
export async function afterWizardFiled(registration: ApiRegistration): Promise<void> {
  const session = useVoiceSessionStore.getState();
  if (!session.active || !session.handedOff) return;
  await recordAcceptance(registration.registrationId);
  session.clear();
}
