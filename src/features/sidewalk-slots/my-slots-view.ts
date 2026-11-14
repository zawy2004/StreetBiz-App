import type { RentalApplication, RentalContract } from '@/core/api/side-api';

// ---- Rental applications (SIDE-04) ----

export type ApplicationFilter = 'ALL' | 'OPEN' | 'APPROVED' | 'CLOSED';

export const APPLICATION_FILTERS: { value: ApplicationFilter; label: string }[] = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'OPEN', label: 'Đang chờ' },
  { value: 'APPROVED', label: 'Đã duyệt' },
  { value: 'CLOSED', label: 'Từ chối/Rút' },
];

const APPLICATION_GROUPS: Record<Exclude<ApplicationFilter, 'ALL'>, readonly string[]> = {
  OPEN: ['PENDING', 'UNDER_REVIEW', 'MORE_INFORMATION_REQUIRED'],
  APPROVED: ['APPROVED'],
  CLOSED: ['REJECTED', 'WITHDRAWN'],
};

/** Which chip an application belongs to; a status this list does not know shows under "Tất cả" only. */
export function applicationGroup(status: string): Exclude<ApplicationFilter, 'ALL'> | null {
  for (const [group, statuses] of Object.entries(APPLICATION_GROUPS)) {
    if (statuses.includes(status)) return group as Exclude<ApplicationFilter, 'ALL'>;
  }
  return null;
}

export function filterApplications(
  applications: readonly RentalApplication[],
  filter: ApplicationFilter,
): RentalApplication[] {
  return filter === 'ALL'
    ? [...applications]
    : applications.filter((a) => applicationGroup(a.applicationStatus) === filter);
}

export function countApplications(applications: readonly RentalApplication[]): Record<ApplicationFilter, number> {
  const counts: Record<ApplicationFilter, number> = { ALL: applications.length, OPEN: 0, APPROVED: 0, CLOSED: 0 };
  for (const application of applications) {
    const group = applicationGroup(application.applicationStatus);
    if (group) counts[group] += 1;
  }
  return counts;
}

export const needsMoreInformation = (status: string) => status === 'MORE_INFORMATION_REQUIRED';

// ---- Rental contracts (SIDE-05) ----

/** A suspended contract has not ended: the ward can lift the suspension. */
const LIVE_CONTRACT_STATUSES = ['ACTIVE', 'SUSPENDED'];

export const isLiveContract = (status: string) => LIVE_CONTRACT_STATUSES.includes(status);

/** A contract this close to its end date is flagged so the vendor can renew in time. */
export const EXPIRING_SOON_DAYS = 14;

const DAY_MS = 86_400_000;

/** "2026-12-01" as local midnight, so day counts do not shift with the time zone. */
function localDate(isoDate: string): number {
  const [year, month, day] = isoDate.slice(0, 10).split('-').map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1).getTime();
}

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

export function splitContracts<T extends Pick<RentalContract, 'contractStatus'>>(
  contracts: readonly T[],
): { live: T[]; ended: T[] } {
  const live: T[] = [];
  const ended: T[] = [];
  for (const contract of contracts) {
    (isLiveContract(contract.contractStatus) ? live : ended).push(contract);
  }
  return { live, ended };
}

export type ContractProgress = { percent: number; daysLeft: number; expiringSoon: boolean };

/** How much of the term has passed and how many days remain; the end date itself still counts as a day. */
export function contractProgress(startDate: string, endDate: string, today: Date): ContractProgress {
  const start = localDate(startDate);
  const end = localDate(endDate);
  const now = startOfDay(today);
  const total = end - start;
  const percent = total <= 0 ? 100 : Math.min(100, Math.max(0, Math.round(((now - start) / total) * 100)));
  const daysLeft = Math.max(0, Math.round((end - now) / DAY_MS));
  return { percent, daysLeft, expiringSoon: daysLeft <= EXPIRING_SOON_DAYS };
}

/** The last day of a contract if it were extended by `days` (a request the ward may still shorten or refuse). */
export function extendedEndDate(endDate: string, days: number): Date {
  const [year, month, day] = endDate.slice(0, 10).split('-').map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, (day ?? 1) + days);
}

// ---- Slot transfers (SIDE-12/13) ----

export type TransferStepState = 'done' | 'current' | 'todo';

export const TRANSFER_STEP_LABELS = ['Đã gửi', 'Bên nhận đồng ý', 'Phường duyệt'] as const;

/**
 * Where a transfer stands on its way from sent, to accepted by the receiver, to approved by the ward.
 * "current" is the step it is waiting on. Null for a rejected transfer, which has no progress to show.
 */
export function transferSteps(status: string): TransferStepState[] | null {
  switch (status) {
    case 'PENDING':
      return ['done', 'current', 'todo'];
    case 'ACCEPTED_BY_RECEIVER':
      return ['done', 'done', 'current'];
    case 'APPROVED':
      return ['done', 'done', 'done'];
    default:
      return null;
  }
}
