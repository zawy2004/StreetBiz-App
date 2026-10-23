/**
 * X01 "Kể chuyện là xong" -- types mirroring StreetBiz-BE
 * `Application/Features/VendorRegistration/AssistTurn/AssistContracts.cs`.
 *
 * Shared file: the app keeps a verbatim copy (StreetBiz-App
 * `src/features/business-registrations/voice/`). Change both together.
 */

export const QUESTION_KEYS = {
  opening: 'OPENING',
  businessLine: 'BUSINESS_LINE',
  vendorType: 'VENDOR_TYPE',
  location: 'LOCATION',
  ward: 'WARD',
  address: 'ADDRESS',
  capital: 'CAPITAL',
  labor: 'LABOR',
  startDate: 'START_DATE',
  contactAddress: 'CONTACT_ADDRESS',
  cartWidth: 'CART_WIDTH',
} as const;

export type QuestionKey = (typeof QUESTION_KEYS)[keyof typeof QUESTION_KEYS];

/** Draft field names, as the server names them in proposals and `AssistQuestion.field`. */
export const ASSIST_FIELDS = {
  businessLine: 'businessLine',
  vendorType: 'vendorType',
  locationText: 'locationText',
  declaredAddress: 'declaredAddress',
  capitalAmount: 'capitalAmount',
  laborCount: 'laborCount',
  plannedStartDate: 'plannedStartDate',
  contactSameAsPermanent: 'contactSameAsPermanent',
  hours: 'hours',
  cartWidthMeters: 'cartWidthMeters',
} as const;

export type AssistField = (typeof ASSIST_FIELDS)[keyof typeof ASSIST_FIELDS];

/** Amounts, head count and start date: read back, then confirmed with a tap (never by voice alone). */
export const TAP_CONFIRMED_FIELDS: readonly AssistField[] = [
  ASSIST_FIELDS.capitalAmount,
  ASSIST_FIELDS.laborCount,
  ASSIST_FIELDS.plannedStartDate,
];

export type Salutation = 'bạn' | 'cô' | 'chú' | 'anh' | 'chị';

/**
 * The part of the registration draft the server may see. Nothing read from the CCCD (name,
 * number, birth date, addresses) is ever in here -- those stay on the device until filing.
 */
export type AssistDraft = {
  businessLine?: string | null;
  vendorType?: 'ITINERANT' | 'FIXED_STOREFRONT' | null;
  locationText?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  locationConfirmed?: boolean;
  locationSkipped?: boolean;
  wardUnitId?: number | null;
  declaredAddress?: string | null;
  capitalAmount?: number | null;
  laborCount?: number | null;
  /** yyyy-MM-dd */
  plannedStartDate?: string | null;
  contactSameAsPermanent?: boolean | null;
  /** "HH:mm-HH:mm" or "HH:mm-"; only used to suggest slots. */
  hours?: string | null;
  cartWidthMeters?: number | null;
  cartWidthSkipped?: boolean;
  /** Tap-confirmed fields (see TAP_CONFIRMED_FIELDS). */
  confirmed?: string[] | null;
  /** Question key -> times asked without a usable answer. */
  attempts?: Record<string, number> | null;
  salutation?: Salutation;
};

export type AssistFieldProposal = {
  field: AssistField;
  /** Draft format: digits for amounts, yyyy-MM-dd, "true"/"false", or the enum code. */
  value: string;
  confidence: number;
  /** The words of the vendor this value came from. */
  evidence: string;
  readBack: string | null;
  needsConfirmation: boolean;
  /** PARSER = read by the server's deterministic parser; AI = extracted by the model. */
  source: 'PARSER' | 'AI';
};

export type AssistChoice = { value: string; label: string };

export type AssistInput = 'VOICE' | 'CHOICE' | 'CONFIRM' | 'MANUAL' | 'MAP';

export type AssistQuestion = {
  /** A QuestionKey, or "CONFIRM:{field}" for a read-back. */
  key: string;
  text: string;
  input: AssistInput;
  choices: AssistChoice[];
  field: AssistField | null;
  skippable: boolean;
};

export type AssistWardOption = {
  unitId: number;
  unitName: string;
  reason: 'SLOTS_NEARBY' | 'NAME_MATCH';
};

export type AssistLocation = {
  query: string;
  latitude: number;
  longitude: number;
  label: string;
  wardOptions: AssistWardOption[];
};

export type AssistSlotPreview = {
  slotId: number;
  slotCode: string;
  zoneName: string;
  wardUnitId: number;
  distanceMeters: number;
  widthMeters: number | null;
  lengthMeters: number | null;
  monthlyPrice: number;
  /** "HH:mm:ss" */
  availableFrom: string | null;
  availableTo: string | null;
  fitsCart: boolean | null;
  fitsHours: boolean | null;
};

export type AssistTurnResult = {
  transcript: string | null;
  proposals: AssistFieldProposal[];
  location: AssistLocation | null;
  slotPreview: AssistSlotPreview[];
  nextQuestion: AssistQuestion | null;
  warnings: string[];
  done: boolean;
  isAiGenerated: boolean;
  /** The draft with this turn applied; the client keeps it as the interview state. */
  draft: AssistDraft;
};

/** A recorded answer. On the web `body` is a Blob; on the app it is a React Native file part. */
export type AssistAudio = {
  body: Blob | { uri: string; name: string; type: string };
  fileName: string;
};

export type AssistConfirmationRequest = {
  turns: number;
  aiFields: string[];
  editedFields: string[];
  durationSeconds: number;
};

export type AssistConfirmation = {
  aiLogId: number;
  registrationId: number;
  confirmedAt: string;
};

/** X01 v2: a single-use ticket for the live conversation (Gemini Live behind the server). */
export type AssistLiveTicket = {
  sessionId: string;
  ticket: string;
  expiresAt: string;
  maxSeconds: number;
  inputSampleRate: number;
  outputSampleRate: number;
  /** "/hubs/registration-voice/{sessionId}", beside /api on the same host. */
  streamPath: string;
};

/**
 * JSON messages of the live stream. Audio comes as binary frames: [uint32 generation, little
 * endian][PCM16 mono at outputSampleRate].
 */
export type LiveServerEvent =
  | { type: 'ready'; sessionId: string; maxSeconds: number }
  | { type: 'state'; state: string; generation?: number }
  | { type: 'assist'; version: number; cause: 'voice' | 'screen'; result: AssistTurnResult }
  | { type: 'input_transcript' | 'output_transcript'; text: string; generation: number }
  | { type: 'interrupted' | 'turn_complete'; generation: number }
  | { type: 'warning'; code: string; secondsLeft?: number; message?: string }
  | { type: 'error'; code: string; message: string }
  | { type: 'ended'; reason: string };
