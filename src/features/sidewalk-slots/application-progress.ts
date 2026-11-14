/**
 * Where a rental application stands, as three stops: sent, ward review, outcome.
 * Pure presentation of `applicationStatus` + its dates; nothing here is sent anywhere.
 */
export type ApplicationStopState =
  | 'done'
  | 'waiting'
  | 'reviewing'
  | 'attention'
  | 'approved'
  | 'rejected'
  | 'skipped'
  | 'withdrawn'
  | 'todo';

export type ApplicationStop = {
  label: string;
  /** Short words for the stop's state ("Đang chờ", "Cần bổ sung"…). */
  note: string | null;
  state: ApplicationStopState;
  /** ISO date shown under the stop, when there is one. */
  date: string | null;
};

export const APPLICATION_STOP_LABELS = ['Đã nộp', 'Phường xem xét', 'Kết quả'] as const;

export function applicationProgress(
  status: string,
  createdAt: string,
  reviewedAt: string | null,
): ApplicationStop[] | null {
  const sent: ApplicationStop = {
    label: APPLICATION_STOP_LABELS[0],
    note: null,
    state: 'done',
    date: createdAt,
  };
  const review = (state: ApplicationStopState, note: string, date: string | null = null) => ({
    label: APPLICATION_STOP_LABELS[1],
    note,
    state,
    date,
  });
  const outcome = (state: ApplicationStopState, note: string | null) => ({
    label: APPLICATION_STOP_LABELS[2],
    note,
    state,
    date: null,
  });

  switch (status) {
    case 'PENDING':
      return [sent, review('waiting', 'Đang chờ'), outcome('todo', null)];
    case 'UNDER_REVIEW':
      return [sent, review('reviewing', 'Đang xem xét'), outcome('todo', null)];
    case 'MORE_INFORMATION_REQUIRED':
      return [sent, review('attention', 'Cần bổ sung', reviewedAt), outcome('todo', null)];
    case 'APPROVED':
      return [sent, review('done', 'Đã xem xét', reviewedAt), outcome('approved', 'Đã duyệt')];
    case 'REJECTED':
      return [sent, review('done', 'Đã xem xét', reviewedAt), outcome('rejected', 'Từ chối')];
    case 'WITHDRAWN':
      return [sent, review('skipped', 'Bỏ qua'), outcome('withdrawn', 'Đã rút')];
    default:
      return null;
  }
}

/** Whether the road leading into stop `index` is already travelled. */
export function stopReached(stops: ApplicationStop[], index: number): boolean {
  const state = stops[index]?.state;
  return state !== undefined && state !== 'todo' && state !== 'skipped';
}
