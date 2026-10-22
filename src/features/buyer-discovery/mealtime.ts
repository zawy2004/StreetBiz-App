import type { StorefrontHour } from '@/core/api/commerce-api';

/** A hint about which meal a stall serves, read off today's opening windows. */
export type MealTag = 'EARLY' | 'LATE';

export const MEAL_TAG_LABELS: Record<MealTag, string> = {
  EARLY: 'Mở sáng sớm',
  LATE: 'Bán khuya',
};

const hhmm = (time: string) => time.slice(0, 5);

/**
 * "Mở sáng sớm" when a window opens at 06:00 or earlier, "Bán khuya" when one
 * closes at 22:00 or later (or runs past midnight). Display only: derived from
 * the hours the listing already carries.
 */
export function mealTags(
  hours: readonly Pick<StorefrontHour, 'opensAt' | 'closesAt'>[],
): MealTag[] {
  const tags: MealTag[] = [];
  if (hours.some((h) => hhmm(h.opensAt) <= '06:00')) tags.push('EARLY');
  if (hours.some((h) => hhmm(h.closesAt) >= '22:00' || hhmm(h.closesAt) < hhmm(h.opensAt))) {
    tags.push('LATE');
  }
  return tags;
}
