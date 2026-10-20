import type {
  FoodSafetyApplication,
  FoodSafetyEvidenceType,
  FoodSafetyStatus,
} from '@/core/api/food-safety-api';

/**
 * Display helpers for ATTP files. Pure functions over data the screens have
 * already loaded: nothing here asks the server for anything or decides a file.
 * Day counts are taken on the Asia/Ho_Chi_Minh calendar.
 */

const VN_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** "yyyy-mm-dd" of an instant on the Vietnamese calendar. */
export function vnDay(value: string | number | Date): string {
  return VN_DAY.format(new Date(value));
}

/** A date-only value stays as written; a timestamp becomes its Vietnamese calendar day. */
export function calendarDay(value: string): string {
  return DATE_ONLY.test(value) ? value : vnDay(value);
}

function dayNumber(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return Math.round(Date.UTC(y!, m! - 1, d!) / 86_400_000);
}

/** Whole calendar days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return dayNumber(calendarDay(to)) - dayNumber(calendarDay(from));
}

/** Days left on a certificate; negative once it has lapsed, null when no end date. */
export function daysLeft(expiresOn: string | null, now: number = Date.now()): number | null {
  if (!expiresOn) return null;
  return daysBetween(vnDay(now), expiresOn);
}

/** How far through its validity a certificate is, 0..1 (null without both dates). */
export function validityProgress(
  issuedOn: string | null,
  expiresOn: string | null,
  now: number = Date.now(),
): number | null {
  if (!issuedOn || !expiresOn) return null;
  const span = daysBetween(issuedOn, expiresOn);
  if (span <= 0) return 1;
  return Math.min(1, Math.max(0, daysBetween(issuedOn, vnDay(now)) / span));
}

/** "1.092" — day counts read with Vietnamese thousands dots. */
export const formatCount = (value: number) => value.toLocaleString('vi-VN');

export type ApplicationGroups = {
  /** The vendor has something to do: the ward asked for more (RESUBMIT). */
  todo: FoodSafetyApplication[];
  /** With the ward or the department. */
  reviewing: FoodSafetyApplication[];
  /** Approved and still in date. */
  valid: FoodSafetyApplication[];
  /** Rejected, withdrawn or lapsed. */
  closed: FoodSafetyApplication[];
};

/** Sorts the vendor's files by what they need, keeping the server's order within a group. */
export function groupApplications(list: FoodSafetyApplication[]): ApplicationGroups {
  const groups: ApplicationGroups = { todo: [], reviewing: [], valid: [], closed: [] };
  for (const application of list) {
    if (application.actions.includes('RESUBMIT')) groups.todo.push(application);
    else if (application.isExpired) groups.closed.push(application);
    else if (application.status === 'APPROVED') groups.valid.push(application);
    else if (application.status === 'REJECTED' || application.status === 'WITHDRAWN')
      groups.closed.push(application);
    else groups.reviewing.push(application);
  }
  return groups;
}

export type WaitingOn = {
  who: 'WARD' | 'VENDOR' | 'DEPARTMENT' | null;
  since: string | null;
  days: number | null;
};

/** Who holds a file now and since when: the ward, the vendor (asked for more) or the department. */
export function waitingOn(application: FoodSafetyApplication, now: number = Date.now()): WaitingOn {
  const hold = (who: WaitingOn['who'], since: string | null): WaitingOn => ({
    who,
    since,
    days: since ? Math.max(0, daysBetween(since, vnDay(now))) : null,
  });
  switch (application.status) {
    case 'SUBMITTED':
      return hold('WARD', application.submittedAt);
    case 'MORE_INFORMATION_REQUIRED':
      return hold('VENDOR', application.reviewedAt);
    case 'FORWARDED':
      return hold('DEPARTMENT', application.forwardedAt);
    default:
      return { who: null, since: null, days: null };
  }
}

const daysText = (days: number | null) =>
  days === null ? '' : days === 0 ? ' · hôm nay' : ` · ${formatCount(days)} ngày`;

/** "Phường cần xét · 6 ngày", "Đang ở Chi cục … · 3 ngày"; null when nobody holds it. */
export function waitingText(application: FoodSafetyApplication, now: number = Date.now()) {
  const waiting = waitingOn(application, now);
  switch (waiting.who) {
    case 'WARD':
      return `Phường cần xét${daysText(waiting.days)}`;
    case 'VENDOR':
      return `Chờ người bán bổ sung${daysText(waiting.days)}`;
    case 'DEPARTMENT':
      return `Đang ở ${application.departmentName || 'Chi cục ATTP'}${daysText(waiting.days)}`;
    default:
      return null;
  }
}

export type StationCounts = Record<FoodSafetyStatus, number> & { total: number };

/** How many files sit at each status, for the ward's route board. */
export function countByStation(list: FoodSafetyApplication[]): StationCounts {
  const counts: StationCounts = {
    SUBMITTED: 0,
    MORE_INFORMATION_REQUIRED: 0,
    FORWARDED: 0,
    APPROVED: 0,
    REJECTED: 0,
    WITHDRAWN: 0,
    total: list.length,
  };
  for (const application of list) counts[application.status] += 1;
  return counts;
}

/** Lowercase, accents off, "đ" → "d", punctuation to spaces (same folding as the food photos). */
export function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Typed search over the files already on screen: stall, vendor or dish. */
export function matchesQuickFilter(application: FoodSafetyApplication, text: string): boolean {
  const needle = fold(text);
  if (!needle) return true;
  return [
    application.storefrontName,
    application.vendorName,
    ...application.dishes.map((d) => d.name),
  ]
    .map(fold)
    .some((hay) => hay.includes(needle));
}

/** The four documents the ward usually wants (the fifth type is "other"). */
export const RECOMMENDED_EVIDENCE: FoodSafetyEvidenceType[] = [
  'CERTIFICATE',
  'HEALTH_CHECK',
  'TRAINING',
  'PREMISES_PHOTO',
];

export type MilestoneState = 'done' | 'current' | 'failed' | 'stopped' | 'todo';
export type Milestone = { key: string; label: string; date: string | null; state: MilestoneState };

/**
 * The five marks of a file as the ward reads it: lodged, reviewed by the ward,
 * sent to the department, result recorded, valid until.
 */
export function journeyMilestones(application: FoodSafetyApplication): Milestone[] {
  const { status, forwardedAt } = application;
  const department = application.departmentName
    ? `Chuyển ${application.departmentName}`
    : 'Chuyển cục';
  const marks: Milestone[] = [
    { key: 'submitted', label: 'Nộp hồ sơ', date: application.submittedAt, state: 'done' },
    { key: 'reviewed', label: 'Phường xét', date: application.reviewedAt, state: 'todo' },
    { key: 'forwarded', label: department, date: forwardedAt, state: 'todo' },
    { key: 'result', label: 'Kết quả', date: application.resultRecordedAt, state: 'todo' },
    {
      key: 'valid',
      label: application.isExpired ? 'Đã hết hạn' : 'Hiệu lực đến',
      date: application.expiresOn,
      state: 'todo',
    },
  ];
  const set = (index: number, state: MilestoneState) => (marks[index]!.state = state);
  switch (status) {
    case 'SUBMITTED':
      set(1, 'current');
      break;
    case 'MORE_INFORMATION_REQUIRED':
      set(1, 'current');
      break;
    case 'FORWARDED':
      set(1, 'done');
      set(2, 'done');
      set(3, 'current');
      break;
    case 'APPROVED':
      [1, 2, 3].forEach((i) => set(i, 'done'));
      set(4, application.isExpired ? 'failed' : 'done');
      break;
    case 'REJECTED':
      if (forwardedAt) {
        set(1, 'done');
        set(2, 'done');
        set(3, 'failed');
      } else set(1, 'failed');
      break;
    case 'WITHDRAWN':
      set(1, 'stopped');
      break;
  }
  return marks;
}

/** "3 năm", "1 năm 6 tháng", "45 ngày" between two "yyyy-mm-dd" dates; null if missing or reversed. */
export function validitySpan(issuedOn: string | null, expiresOn: string | null): string | null {
  if (!issuedOn || !expiresOn || !DATE_ONLY.test(issuedOn) || !DATE_ONLY.test(expiresOn))
    return null;
  const days = daysBetween(issuedOn, expiresOn);
  if (days <= 0) return null;
  const [y1, m1, d1] = issuedOn.split('-').map(Number);
  const [y2, m2, d2] = expiresOn.split('-').map(Number);
  const months = (y2! - y1!) * 12 + (m2! - m1!) - (d2! < d1! ? 1 : 0);
  if (months < 1) return `${days} ngày`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (!years) return `${rest} tháng`;
  return rest ? `${years} năm ${rest} tháng` : `${years} năm`;
}

/** How far along the vendor → ward → department → result route a file has come (0..2). */
export function reachedStep(application: FoodSafetyApplication): number {
  switch (application.status) {
    case 'FORWARDED':
      return 1;
    case 'APPROVED':
      return 2;
    case 'REJECTED':
      // Rejected by the ward (never forwarded) or by the department.
      return application.forwardedAt ? 2 : 0;
    default:
      return 0;
  }
}

export type StepState = 'done' | 'current' | 'failed' | 'todo';

/** The three route steps of a file: passed, the one it waits at, the one it failed at. */
export function stepStates(application: FoodSafetyApplication): StepState[] {
  const reached = reachedStep(application);
  const failed = application.status === 'REJECTED';
  const moving = ['SUBMITTED', 'MORE_INFORMATION_REQUIRED', 'FORWARDED'].includes(
    application.status,
  );
  return [0, 1, 2].map((index) =>
    failed && index === reached
      ? 'failed'
      : index <= reached
        ? 'done'
        : moving && index === reached + 1
          ? 'current'
          : 'todo',
  );
}
