import type { StorefrontHour } from '@/core/api/commerce-api';

/** Lower-case weekday names for use inside a sentence (ISO order, Monday first). */
const IN_SENTENCE = ['thứ hai', 'thứ ba', 'thứ tư', 'thứ năm', 'thứ sáu', 'thứ bảy', 'chủ nhật'];

const VIETNAM_OFFSET_MS = 7 * 3_600_000;

/** "10:00" or "10:00:00" → minutes after midnight. */
export function minutesOf(time: string): number {
  const [h, m] = time.split(':');
  return Number(h) * 60 + Number(m ?? 0);
}

const hhmm = (time: string) => time.slice(0, 5);

/** Weekday (ISO, Monday = 1) and minutes after midnight on the clock in Vietnam (UTC+7). */
export function vietnamClock(now: Date): { day: number; minutes: number } {
  const local = new Date(now.getTime() + VIETNAM_OFFSET_MS);
  const day = local.getUTCDay();
  return { day: day === 0 ? 7 : day, minutes: local.getUTCHours() * 60 + local.getUTCMinutes() };
}

type Window = Pick<StorefrontHour, 'dayOfWeek' | 'opensAt' | 'closesAt'>;

/** The window (today's, or last night's running past midnight) that covers this minute. */
function coveringWindow(
  hours: readonly Window[],
  day: number,
  minutes: number,
): Window | undefined {
  const yesterday = day === 1 ? 7 : day - 1;
  return hours.find((h) => {
    const opens = minutesOf(h.opensAt);
    const closes = minutesOf(h.closesAt);
    const overnight = closes <= opens;
    if (h.dayOfWeek === day)
      return overnight ? minutes >= opens : minutes >= opens && minutes < closes;
    if (h.dayOfWeek === yesterday && overnight) return minutes < closes;
    return false;
  });
}

const firstOpening = (hours: readonly Window[], day: number, after = -1) =>
  hours
    .filter((h) => h.dayOfWeek === day && minutesOf(h.opensAt) > after)
    .sort((a, b) => minutesOf(a.opensAt) - minutesOf(b.opensAt))[0];

/**
 * A one-line answer to "can I still eat there?": "Đang mở, đóng lúc 21:00" or
 * "Đang đóng, mở lại 10:00 thứ bảy". The server's `isOpenNow` is the truth: when
 * the published hours disagree with it, this says nothing (null) and the screen
 * falls back to today's window. Null too when no hours are published.
 */
export function todayStatus(
  hours: readonly Window[],
  isOpenNow: boolean,
  now: Date = new Date(),
): string | null {
  if (hours.length === 0) return null;
  const { day, minutes } = vietnamClock(now);
  const covering = coveringWindow(hours, day, minutes);

  if (isOpenNow) return covering ? `Đang mở, đóng lúc ${hhmm(covering.closesAt)}` : null;
  if (covering) return null;

  const later = firstOpening(hours, day, minutes);
  if (later) return `Đang đóng, mở lại ${hhmm(later.opensAt)} hôm nay`;
  for (let ahead = 1; ahead <= 7; ahead += 1) {
    const next = ((day - 1 + ahead) % 7) + 1;
    const opening = firstOpening(hours, next);
    if (!opening) continue;
    const when =
      ahead === 1
        ? 'ngày mai'
        : ahead === 7
          ? `${IN_SENTENCE[next - 1]} tuần sau`
          : IN_SENTENCE[next - 1];
    return `Đang đóng, mở lại ${hhmm(opening.opensAt)} ${when}`;
  }
  return null;
}

/** Where a day's windows sit on the ruler, as fractions of the axis (overnight windows run to its end). */
export function rulerSpans(
  hours: readonly Window[],
  day: number,
  axis: { start: number; end: number },
): { left: number; width: number }[] {
  const span = axis.end - axis.start;
  return hours
    .filter((h) => h.dayOfWeek === day)
    .map((h) => {
      const opens = Math.max(minutesOf(h.opensAt), axis.start);
      const rawClose = minutesOf(h.closesAt);
      const closes = Math.min(rawClose <= minutesOf(h.opensAt) ? axis.end : rawClose, axis.end);
      return { left: (opens - axis.start) / span, width: Math.max(closes - opens, 0) / span };
    })
    .filter((s) => s.width > 0);
}

/** The ruler runs 05:00–24:00, starting earlier when a stall opens before five. */
export function rulerAxis(hours: readonly Window[]): { start: number; end: number } {
  const earliest = Math.min(300, ...hours.map((h) => Math.floor(minutesOf(h.opensAt) / 60) * 60));
  return { start: earliest, end: 1440 };
}
