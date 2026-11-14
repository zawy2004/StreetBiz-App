import type { RegistrationStatus } from '@/core/api';
import type { StatusTone } from '@/theme';

/**
 * Where a registration stands, drawn as a three-stop parcel-tracking line:
 * "Đã nộp" → "Phường xét" → "Kết quả". Presentation only: it reads the status
 * the backend already returned and changes nothing.
 */
export type TrackStepState =
  | 'done'
  | 'current'
  | 'todo'
  /** The ward sent it back (MORE_INFORMATION_REQUIRED): the arrow returns to stop 1. */
  | 'returned'
  | 'paused'
  | 'approved'
  | 'rejected'
  | 'withdrawn';

export type TrackStep = {
  key: 'submitted' | 'review' | 'result';
  label: string;
  /** Short line under the stop, e.g. a date or "Bạn cần bổ sung". */
  note?: string;
  state: TrackStepState;
};

export type RegistrationTrackModel = {
  steps: TrackStep[];
  /** Index of the stop the file is at now (the one with aria-current="step"). */
  currentIndex: number;
  /** Colour family of the stop the file is at. */
  tone: StatusTone;
  /** How far the painted line runs, 0..1, left to right. */
  progress: number;
};

const dayMonth = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) : undefined;

/** Pure mapping from a registration status (+ its dates) to the three stops. */
export function registrationTrack(
  status: RegistrationStatus | string,
  createdAt: string | null | undefined,
  reviewedAt: string | null | undefined,
): RegistrationTrackModel {
  const submittedOn = dayMonth(createdAt);
  const reviewedOn = dayMonth(reviewedAt);
  const step = (key: TrackStep['key'], state: TrackStepState, note?: string): TrackStep => ({
    key,
    label: key === 'submitted' ? 'Đã nộp' : key === 'review' ? 'Phường xét' : 'Kết quả',
    note,
    state,
  });

  switch (status) {
    case 'DRAFT':
      return {
        steps: [
          step('submitted', 'current', 'Nháp'),
          step('review', 'todo'),
          step('result', 'todo'),
        ],
        currentIndex: 0,
        tone: 'neutral',
        progress: 0,
      };
    case 'SUBMITTED':
      return {
        steps: [
          step('submitted', 'done', submittedOn),
          step('review', 'current', 'Chờ xét'),
          step('result', 'todo'),
        ],
        currentIndex: 1,
        tone: 'pending',
        progress: 0.5,
      };
    case 'UNDER_REVIEW':
      return {
        steps: [
          step('submitted', 'done', submittedOn),
          step('review', 'current', 'Đang xét'),
          step('result', 'todo'),
        ],
        currentIndex: 1,
        tone: 'pending',
        progress: 0.5,
      };
    case 'MORE_INFORMATION_REQUIRED':
      return {
        steps: [
          step('submitted', 'returned', 'Bạn cần bổ sung'),
          step('review', 'paused', 'Tạm dừng'),
          step('result', 'todo'),
        ],
        currentIndex: 0,
        tone: 'pending',
        progress: 0.5,
      };
    case 'APPROVED':
      return {
        steps: [
          step('submitted', 'done', submittedOn),
          step('review', 'done'),
          step('result', 'approved', reviewedOn ? `Đã duyệt ${reviewedOn}` : 'Đã duyệt'),
        ],
        currentIndex: 2,
        tone: 'ok',
        progress: 1,
      };
    case 'REJECTED':
      return {
        steps: [
          step('submitted', 'done', submittedOn),
          step('review', 'done'),
          step('result', 'rejected', reviewedOn ? `Từ chối ${reviewedOn}` : 'Từ chối'),
        ],
        currentIndex: 2,
        tone: 'danger',
        progress: 1,
      };
    case 'WITHDRAWN':
      return {
        steps: [
          step('submitted', 'withdrawn', 'Đã rút'),
          step('review', 'withdrawn'),
          step('result', 'withdrawn'),
        ],
        currentIndex: 0,
        tone: 'neutral',
        progress: 0,
      };
    default:
      return {
        steps: [step('submitted', 'current'), step('review', 'todo'), step('result', 'todo')],
        currentIndex: 0,
        tone: 'neutral',
        progress: 0,
      };
  }
}
