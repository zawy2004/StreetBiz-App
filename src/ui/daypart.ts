/** Part of the day in Đà Nẵng (Asia/Ho_Chi_Minh, UTC+7, no DST), for words that follow the clock. */
export type Daypart = 'morning' | 'noon' | 'afternoon' | 'evening' | 'night';

export function daypart(now = new Date()): Daypart {
  const h = (now.getUTCHours() + 7) % 24;
  if (h >= 5 && h < 10) return 'morning';
  if (h >= 10 && h < 14) return 'noon';
  if (h >= 14 && h < 17) return 'afternoon';
  if (h >= 17 && h < 22) return 'evening';
  return 'night';
}

/** "Trưa nay" / "Tối nay" … : the meal a buyer is thinking about right now. */
export const MEAL_WORD: Record<Daypart, string> = {
  morning: 'Sáng nay',
  noon: 'Trưa nay',
  afternoon: 'Xế chiều',
  evening: 'Tối nay',
  night: 'Khuya nay',
};
