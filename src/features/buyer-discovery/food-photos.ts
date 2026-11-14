/**
 * Port of StreetBiz-FE `features/buyer-discovery/food-photos.ts`: stock photos
 * (assets/images/food, credits in CREDITS.md there) for a stall or dish without a
 * photo of its own. A vendor's own `imageUrl` always wins; a stock photo is flagged
 * `illustrative` so the UI labels it "Ảnh minh họa".
 */
import type { ImageSourcePropType } from 'react-native';

import { apiAssetUrl } from '@/core/api/asset-url';

export type FoodPhoto = { source: ImageSourcePropType; illustrative: boolean };

const STOCK = {
  'banh-mi': require('@/assets/images/food/banh-mi.jpg'),
  'banh-mi-thit-nuong': require('@/assets/images/food/banh-mi-thit-nuong.jpg'),
  'xoi-ga': require('@/assets/images/food/xoi-ga.jpg'),
  'xoi-xeo': require('@/assets/images/food/xoi-xeo.jpg'),
  'bun-cha': require('@/assets/images/food/bun-cha.jpg'),
  'bun-bo-hue': require('@/assets/images/food/bun-bo-hue.jpg'),
  pho: require('@/assets/images/food/pho.jpg'),
  'hu-tieu': require('@/assets/images/food/hu-tieu.jpg'),
  'com-tam': require('@/assets/images/food/com-tam.jpg'),
  chao: require('@/assets/images/food/chao.jpg'),
  'banh-xeo': require('@/assets/images/food/banh-xeo.jpg'),
  'banh-cuon': require('@/assets/images/food/banh-cuon.jpg'),
  'banh-trang-nuong': require('@/assets/images/food/banh-trang-nuong.jpg'),
  'nem-cua-be': require('@/assets/images/food/nem-cua-be.jpg'),
  'nem-nuong': require('@/assets/images/food/nem-nuong.jpg'),
  'cha-gio': require('@/assets/images/food/cha-gio.jpg'),
  'ca-phe': require('@/assets/images/food/ca-phe.jpg'),
  'tra-da': require('@/assets/images/food/tra-da.jpg'),
  'sua-dau-nanh': require('@/assets/images/food/sua-dau-nanh.jpg'),
  che: require('@/assets/images/food/che.jpg'),
  'do-nuong': require('@/assets/images/food/do-nuong.jpg'),
  'nuoc-giai-khat': require('@/assets/images/food/nuoc-giai-khat.jpg'),
} as const satisfies Record<string, ImageSourcePropType>;

type PhotoKey = keyof typeof STOCK;

/** Same rules and order as the web: the specific dish before the word it contains. */
const RULES: [RegExp, PhotoKey][] = [
  [/banh m[iy]\b.*nuong/, 'banh-mi-thit-nuong'],
  [/banh m[iy]\b/, 'banh-mi'],
  [/xoi xeo/, 'xoi-xeo'],
  [/\bxoi\b/, 'xoi-ga'],
  [/bun cha/, 'bun-cha'],
  [/bun bo|bun rieu|\bbun\b/, 'bun-bo-hue'],
  [/hu tieu|hu tiu/, 'hu-tieu'],
  [/\bpho\b|\bm[iy]\b|\bmien\b|cao lau|mon nuoc/, 'pho'],
  [/\bcom\b/, 'com-tam'],
  [/\bchao\b/, 'chao'],
  [/banh xeo|banh khot/, 'banh-xeo'],
  [/banh cuon/, 'banh-cuon'],
  [/banh trang|an vat/, 'banh-trang-nuong'],
  [/nem cua|nem vuong/, 'nem-cua-be'],
  [/nem nuong/, 'nem-nuong'],
  [/cha gio|nem ran/, 'cha-gio'],
  [/ca phe|\bcafe\b|coffee/, 'ca-phe'],
  [/\btra\b/, 'tra-da'],
  [/dau nanh/, 'sua-dau-nanh'],
  [/\bche\b|trang mieng/, 'che'],
  [/nuong|\bxien\b/, 'do-nuong'],
  [/nuoc (sam|mia|ep|ngot|chanh|dua|cam|giai khat)|sinh to|do uong/, 'nuoc-giai-khat'],
];

const STALL_FALLBACKS: PhotoKey[] = ['bun-cha', 'pho', 'com-tam', 'banh-mi', 'banh-cuon'];

const ACCENTS: [RegExp, string][] = [
  [/[àáạảãâầấậẩẫăằắặẳẵ]/g, 'a'],
  [/[èéẹẻẽêềếệểễ]/g, 'e'],
  [/[ìíịỉĩ]/g, 'i'],
  [/[òóọỏõôồốộổỗơờớợởỡ]/g, 'o'],
  [/[ùúụủũưừứựửữ]/g, 'u'],
  [/[ỳýỵỷỹ]/g, 'y'],
  [/đ/g, 'd'],
];

/**
 * Lowercase, Vietnamese accents off, punctuation to spaces. Uses an explicit map
 * instead of `String.normalize`, whose support varies across JS engines on device.
 */
export function fold(text: string): string {
  let out = text.toLowerCase();
  for (const [pattern, plain] of ACCENTS) out = out.replace(pattern, plain);
  return out.replace(/[^a-z0-9]+/g, ' ');
}

function matchKey(texts: (string | null | undefined)[]): PhotoKey | null {
  for (const text of texts) {
    if (!text) continue;
    const folded = fold(text);
    const hit = RULES.find(([pattern]) => pattern.test(folded));
    if (hit) return hit[1];
  }
  return null;
}

/** Photos to try for a stall, best first: its own, then one for the dish it is named after. */
export function storefrontPhotos(storefront: {
  storefrontId: number;
  storefrontName: string;
  description?: string | null;
  categories?: string[];
  imageUrl?: string | null;
}): FoodPhoto[] {
  const key =
    matchKey([
      storefront.storefrontName,
      storefront.description,
      ...(storefront.categories ?? []),
    ]) ?? STALL_FALLBACKS[Math.abs(storefront.storefrontId) % STALL_FALLBACKS.length]!;
  const photos: FoodPhoto[] = [];
  if (storefront.imageUrl)
    photos.push({ source: { uri: apiAssetUrl(storefront.imageUrl) }, illustrative: false });
  photos.push({ source: STOCK[key], illustrative: true });
  return photos;
}

/** Photos to try for a dish: its own, then a stock one for its name or category. */
export function menuItemPhotos(item: {
  menuItemId: number;
  itemName: string;
  categoryName: string;
  imageUrl?: string | null;
}): FoodPhoto[] {
  const key =
    matchKey([item.itemName, item.categoryName]) ??
    STALL_FALLBACKS[Math.abs(item.menuItemId) % STALL_FALLBACKS.length]!;
  const photos: FoodPhoto[] = [];
  if (item.imageUrl) photos.push({ source: { uri: apiAssetUrl(item.imageUrl) }, illustrative: false });
  photos.push({ source: STOCK[key], illustrative: true });
  return photos;
}

/** A stock photo for a category chip (always illustrative). */
export function categoryPhoto(categoryName: string): ImageSourcePropType {
  return STOCK[matchKey([categoryName]) ?? 'bun-cha'];
}
