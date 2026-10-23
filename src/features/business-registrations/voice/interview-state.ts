import {
  ASSIST_FIELDS,
  QUESTION_KEYS,
  TAP_CONFIRMED_FIELDS,
  type AssistChoice,
  type AssistDraft,
  type AssistField,
  type AssistFieldProposal,
  type AssistQuestion,
  type QuestionKey,
  type Salutation,
} from './voice-registration.types';

/**
 * Pure rules of the X01 interview on the client: what a tap does to the draft, how the vendor is
 * addressed, and how the finished interview maps onto the wizard's own fields. No I/O here.
 *
 * Shared file: the app keeps a verbatim copy. Change both together.
 */

/** Mirrors the server's limits (RegistrationFieldLimits / AssistGuards). */
export const LIMITS = {
  displayName: 180,
  businessLine: 300,
  declaredAddress: 500,
  maxCapital: 100_000_000_000,
  maxLabor: 100,
  maxStartDaysAhead: 366,
} as const;

/** AI values under this confidence are tinted on the confirm card for a second look. */
export const LOW_CONFIDENCE = 0.7;

/** Where a value on the confirm card came from (BR-42: AI-made values are labelled). */
export type FieldSource = 'CCCD' | 'VOICE' | 'TYPED' | 'CHOSEN' | 'DEFAULT' | 'EDITED';

export const SOURCE_LABELS: Record<FieldSource, string> = {
  CCCD: 'Từ CCCD',
  VOICE: '[AI] từ lời kể',
  TYPED: 'Bạn đã nhập',
  CHOSEN: 'Bạn đã chọn',
  DEFAULT: 'Mặc định',
  EDITED: 'Bạn đã sửa',
};

const KEY_BY_FIELD: Record<string, QuestionKey> = {
  [ASSIST_FIELDS.businessLine]: QUESTION_KEYS.businessLine,
  [ASSIST_FIELDS.vendorType]: QUESTION_KEYS.vendorType,
  [ASSIST_FIELDS.locationText]: QUESTION_KEYS.location,
  [ASSIST_FIELDS.declaredAddress]: QUESTION_KEYS.address,
  [ASSIST_FIELDS.capitalAmount]: QUESTION_KEYS.capital,
  [ASSIST_FIELDS.laborCount]: QUESTION_KEYS.labor,
  [ASSIST_FIELDS.plannedStartDate]: QUESTION_KEYS.startDate,
  [ASSIST_FIELDS.contactSameAsPermanent]: QUESTION_KEYS.contactAddress,
  [ASSIST_FIELDS.cartWidthMeters]: QUESTION_KEYS.cartWidth,
};

const ALL_KEYS = new Set<string>(Object.values(QUESTION_KEYS));

/** The key to send for a question: a read-back ("CONFIRM:capitalAmount") answers CAPITAL. */
export function baseQuestionKey(question: AssistQuestion | null): QuestionKey {
  if (!question) return QUESTION_KEYS.opening;
  if (ALL_KEYS.has(question.key)) return question.key as QuestionKey;
  return (question.field && KEY_BY_FIELD[question.field]) || QUESTION_KEYS.opening;
}

/** Today's date in Việt Nam (yyyy-MM-dd), whatever the device's own time zone. */
export function todayInVietnam(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function ageOn(dateOfBirth: string, today: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) return null;
  const [by, bm, bd] = dateOfBirth.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  let age = ty! - by!;
  if (tm! < bm! || (tm === bm && td! < bd!)) age -= 1;
  return age;
}

/**
 * How the assistant addresses the vendor, from the CCCD: 45 or older is "cô"/"chú", younger is
 * "chị"/"anh". Without a readable gender and birth date it stays the neutral "bạn".
 */
export function salutationFor(
  gender: string | null | undefined,
  dateOfBirth: string | null | undefined,
  today: string = todayInVietnam(),
): Salutation {
  const age = dateOfBirth ? ageOn(dateOfBirth, today) : null;
  if (age === null || (gender !== 'MALE' && gender !== 'FEMALE')) return 'bạn';
  if (age >= 45) return gender === 'FEMALE' ? 'cô' : 'chú';
  return gender === 'FEMALE' ? 'chị' : 'anh';
}

const capitalise = (s: string) => (s ? s.charAt(0).toLocaleUpperCase('vi-VN') + s.slice(1) : s);

/** "NGUYỄN THỊ HOA" -> "Hoa" (Vietnamese names end with the given name). */
export function givenName(fullName: string | null | undefined): string | null {
  const words = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  const last = words[words.length - 1];
  return last ? capitalise(last.toLocaleLowerCase('vi-VN')) : null;
}

/** "Chào cô Nguyễn Thị Hoa" -- the full name in title case, as on a shop sign. */
export function greeting(salutation: Salutation, fullName: string | null | undefined): string {
  const name = (fullName ?? '')
    .trim()
    .toLocaleLowerCase('vi-VN')
    .split(/\s+/)
    .filter(Boolean)
    .map(capitalise)
    .join(' ');
  return name ? `Chào ${salutation} ${name}` : `Chào ${salutation}`;
}

/** Suggested shop name: the first dish + how the vendor is called, e.g. "Bún bò Cô Hoa". */
export function suggestDisplayName(
  businessLine: string | null | undefined,
  salutation: Salutation,
  fullName: string | null | undefined,
): string {
  const dish = capitalise((businessLine ?? '').split(/[,;]| và | với /)[0]?.trim() ?? '');
  const name = givenName(fullName);
  const owner = salutation !== 'bạn' && name ? `${capitalise(salutation)} ${name}` : '';
  return [dish, owner].filter(Boolean).join(' ').slice(0, LIMITS.displayName);
}

export function isConfirmed(draft: AssistDraft, field: AssistField): boolean {
  return (draft.confirmed ?? []).includes(field);
}

/** Numbers and dates still waiting for their "Đúng rồi" tap. */
export function unconfirmedFields(draft: AssistDraft): AssistField[] {
  const value: Record<string, unknown> = {
    [ASSIST_FIELDS.capitalAmount]: draft.capitalAmount,
    [ASSIST_FIELDS.laborCount]: draft.laborCount,
    [ASSIST_FIELDS.plannedStartDate]: draft.plannedStartDate,
  };
  return TAP_CONFIRMED_FIELDS.filter(
    (f) => value[f] !== null && value[f] !== undefined && !isConfirmed(draft, f),
  );
}

function bump(draft: AssistDraft, key: QuestionKey): Record<string, number> {
  const attempts = { ...(draft.attempts ?? {}) };
  attempts[key] = (attempts[key] ?? 0) + 1;
  return attempts;
}

/** A tap on one of the question's buttons. The server then plans the next question. */
export function answerChoice(draft: AssistDraft, question: AssistQuestion, value: string): AssistDraft {
  if (question.input === 'CONFIRM' && question.field) {
    const field = question.field;
    const confirmed = new Set(draft.confirmed ?? []);
    if (value === 'yes') {
      confirmed.add(field);
      return { ...draft, confirmed: [...confirmed] };
    }
    // "Nói lại": drop the misheard value and count the try, so a value misheard twice
    // moves to typing instead of looping.
    confirmed.delete(field);
    return {
      ...draft,
      [field]: null,
      confirmed: [...confirmed],
      attempts: bump(draft, baseQuestionKey(question)),
    };
  }

  switch (question.key) {
    case QUESTION_KEYS.vendorType:
      return { ...draft, vendorType: value === 'FIXED_STOREFRONT' ? 'FIXED_STOREFRONT' : 'ITINERANT' };
    case QUESTION_KEYS.ward:
      return { ...draft, wardUnitId: Number(value) };
    case QUESTION_KEYS.contactAddress:
      return { ...draft, contactSameAsPermanent: value === 'true' };
    default:
      return draft;
  }
}

/** The vendor accepted the pin (moved or not): coordinates are theirs from now on. */
export function confirmPin(draft: AssistDraft, latitude: number, longitude: number): AssistDraft {
  const moved = draft.latitude !== latitude || draft.longitude !== longitude;
  return {
    ...draft,
    latitude,
    longitude,
    locationConfirmed: true,
    locationSkipped: false,
    // A new spot may be in another ward: let the vendor pick again.
    wardUnitId: moved ? null : (draft.wardUnitId ?? null),
  };
}

/** "Bỏ qua" on an optional question. */
export function skipQuestion(draft: AssistDraft, question: AssistQuestion): AssistDraft {
  if (question.key === QUESTION_KEYS.location) {
    return { ...draft, locationSkipped: true, locationConfirmed: false, latitude: null, longitude: null };
  }
  if (question.key === QUESTION_KEYS.cartWidth) return { ...draft, cartWidthSkipped: true };
  return draft;
}

/**
 * A value typed into the box shown after two misheard answers (input MANUAL). The vendor typed it
 * themselves, so it is taken as is (no AI) and needs no read-back.
 */
export function typedAnswer(
  draft: AssistDraft,
  question: AssistQuestion,
  text: string,
  today: string = todayInVietnam(),
): { draft: AssistDraft } | { error: string } {
  const value = text.trim();
  const confirm = (field: AssistField) => [...new Set([...(draft.confirmed ?? []), field])];
  switch (question.field) {
    case ASSIST_FIELDS.businessLine:
      if (!value) return { error: 'Vui lòng nhập món hoặc mặt hàng bạn bán.' };
      if (value.length > LIMITS.businessLine) return { error: 'Tối đa 300 ký tự.' };
      return { draft: { ...draft, businessLine: value } };
    case ASSIST_FIELDS.declaredAddress:
      if (!value) return { error: 'Vui lòng nhập số nhà, tên đường.' };
      if (value.length > LIMITS.declaredAddress) return { error: 'Tối đa 500 ký tự.' };
      return { draft: { ...draft, declaredAddress: value } };
    case ASSIST_FIELDS.capitalAmount: {
      const digits = value.replace(/[^\d]/g, '');
      const amount = digits ? Number(digits) : NaN;
      if (!Number.isFinite(amount) || amount <= 0 || amount > LIMITS.maxCapital)
        return { error: 'Nhập số tiền bằng chữ số, ví dụ 30000000.' };
      return { draft: { ...draft, capitalAmount: amount, confirmed: confirm(ASSIST_FIELDS.capitalAmount) } };
    }
    case ASSIST_FIELDS.laborCount: {
      const people = /^\d{1,3}$/.test(value) ? Number(value) : NaN;
      if (!Number.isInteger(people) || people < 1 || people > LIMITS.maxLabor)
        return { error: 'Nhập số người từ 1 đến 100.' };
      return { draft: { ...draft, laborCount: people, confirmed: confirm(ASSIST_FIELDS.laborCount) } };
    }
    case ASSIST_FIELDS.plannedStartDate:
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return { error: 'Chọn ngày bắt đầu bán.' };
      if (value < today || value > addDays(today, LIMITS.maxStartDaysAhead))
        return { error: 'Ngày bắt đầu phải từ hôm nay đến trong vòng một năm.' };
      return {
        draft: { ...draft, plannedStartDate: value, confirmed: confirm(ASSIST_FIELDS.plannedStartDate) },
      };
    default:
      return { error: 'Câu này cần trả lời bằng nút.' };
  }
}

/** Field on the confirm card -> where its value came from, updated after a turn. */
export type CardField =
  | 'vendorType'
  | 'displayName'
  | 'location'
  | 'wardUnitId'
  | 'declaredAddress'
  | 'businessLine'
  | 'hours'
  | 'capitalAmount'
  | 'laborCount'
  | 'plannedStartDate'
  | 'contactAddress';

const CARD_FIELD: Partial<Record<AssistField, CardField>> = {
  [ASSIST_FIELDS.businessLine]: 'businessLine',
  [ASSIST_FIELDS.vendorType]: 'vendorType',
  [ASSIST_FIELDS.locationText]: 'location',
  [ASSIST_FIELDS.declaredAddress]: 'declaredAddress',
  [ASSIST_FIELDS.capitalAmount]: 'capitalAmount',
  [ASSIST_FIELDS.laborCount]: 'laborCount',
  [ASSIST_FIELDS.plannedStartDate]: 'plannedStartDate',
  [ASSIST_FIELDS.contactSameAsPermanent]: 'contactAddress',
  [ASSIST_FIELDS.hours]: 'hours',
};

export function cardFieldOf(field: AssistField | null | undefined): CardField | null {
  return (field && CARD_FIELD[field]) || null;
}

/** Fields the vendor's words filled this turn, and which of them the model was unsure of. */
export function sourcesAfterTurn(
  sources: Partial<Record<CardField, FieldSource>>,
  lowConfidence: CardField[],
  proposals: AssistFieldProposal[],
): { sources: Partial<Record<CardField, FieldSource>>; lowConfidence: CardField[] } {
  const next = { ...sources };
  const low = new Set(lowConfidence);
  for (const p of proposals) {
    const field = cardFieldOf(p.field);
    if (!field) continue;
    next[field] = 'VOICE';
    if (p.source === 'AI' && p.confidence < LOW_CONFIDENCE) low.add(field);
    else low.delete(field);
  }
  return { sources: next, lowConfidence: [...low] };
}

/** The interview's values in the wizard store's own format. Unconfirmed numbers stay out. */
export type WizardInterviewFields = {
  vendorType: 'ITINERANT' | 'FIXED_STOREFRONT';
  displayName: string;
  declaredAddress: string;
  addressLatitude: number | null;
  addressLongitude: number | null;
  wardUnitId: number | null;
  businessLine: string;
  capitalAmount: string;
  laborCount: string;
  plannedStartDate: string;
};

export function interviewToWizard(draft: AssistDraft, displayName: string): WizardInterviewFields {
  const ok = (field: AssistField) => isConfirmed(draft, field);
  const pinned = draft.locationConfirmed && draft.latitude != null && draft.longitude != null;
  return {
    vendorType: draft.vendorType === 'FIXED_STOREFRONT' ? 'FIXED_STOREFRONT' : 'ITINERANT',
    displayName: displayName.trim().slice(0, LIMITS.displayName),
    declaredAddress: draft.declaredAddress?.trim() ?? '',
    addressLatitude: pinned ? draft.latitude! : null,
    addressLongitude: pinned ? draft.longitude! : null,
    wardUnitId: draft.wardUnitId ?? null,
    businessLine: draft.businessLine?.trim() ?? '',
    capitalAmount:
      draft.capitalAmount != null && ok(ASSIST_FIELDS.capitalAmount) ? String(draft.capitalAmount) : '',
    laborCount: draft.laborCount != null && ok(ASSIST_FIELDS.laborCount) ? String(draft.laborCount) : '',
    plannedStartDate:
      draft.plannedStartDate && ok(ASSIST_FIELDS.plannedStartDate) ? draft.plannedStartDate : '',
  };
}

const WEEKDAYS = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

/** "2026-10-26" -> "Thứ Hai, 26/10/2026". */
export function formatStartDate(iso: string | null | undefined): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay()];
  return `${weekday}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

/** "06:00-10:00" -> "6:00 – 10:00"; "18:00-" -> "từ 18:00". */
export function formatHours(hours: string | null | undefined): string {
  const match = /^(\d{2}):(\d{2})-(?:(\d{2}):(\d{2}))?$/.exec(hours ?? '');
  if (!match) return '';
  const from = `${Number(match[1])}:${match[2]}`;
  return match[3] ? `${from} – ${Number(match[3])}:${match[4]}` : `từ ${from}`;
}

/** Lower case, no accents, đ → d, single spaces: "Phường Hòa Cường" → "phuong hoa cuong". */
export function foldVietnamese(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The ward question lists every phường, xã and đặc khu (94 in Đà Nẵng): find the ones the vendor
 * types, accents optional ("hoa cuong", "Hòa Cường"), matching the start of a word -- names that
 * start with it first ("an" finds An Hải before Hội An, and never Hòa Vang).
 */
export function searchWardChoices(choices: AssistChoice[], query: string, limit = 8): AssistChoice[] {
  const q = foldVietnamese(query).replace(/^(phuong|xa|dac khu) /, '');
  if (!q) return [];
  return choices
    .map((choice) => {
      const name = foldVietnamese(choice.label).replace(/^(phuong|xa|dac khu) /, '');
      return { choice, rank: name.startsWith(q) ? 0 : ` ${name}`.includes(` ${q}`) ? 1 : -1 };
    })
    .filter((s) => s.rank >= 0)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, limit)
    .map((s) => s.choice);
}
