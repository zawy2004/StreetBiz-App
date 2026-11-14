/**
 * Port of StreetBiz-FE `features/buyer-discovery/food-photos.ts`: stock photos
 * (served by the API from /static/food; credits in StreetBiz-BE wwwroot/static/food/CREDITS.md) for a stall or dish without a
 * photo of its own. A vendor's own `imageUrl` always wins; a stock photo is flagged
 * `illustrative` so the UI labels it "Ảnh minh họa".
 */
import type { ImageSourcePropType } from 'react-native';

import { apiAssetUrl, staticPhotoUrl } from '@/core/api/asset-url';

export type FoodPhoto = { source: ImageSourcePropType; illustrative: boolean };

const STOCK_KEYS = [
  'banh-mi',
  'banh-mi-thit-nuong',
  'xoi-ga',
  'xoi-xeo',
  'bun-cha',
  'bun-bo-hue',
  'pho',
  'hu-tieu',
  'com-tam',
  'chao',
  'banh-xeo',
  'banh-cuon',
  'banh-trang-nuong',
  'nem-cua-be',
  'nem-nuong',
  'cha-gio',
  'ca-phe',
  'tra-da',
  'sua-dau-nanh',
  'che',
  'do-nuong',
  'nuoc-giai-khat',
] as const;

type PhotoKey = (typeof STOCK_KEYS)[number];

/** A stock photo, served by the API from the VPS (/static/food), cached on the phone by expo-image. */
const stock = (key: PhotoKey): ImageSourcePropType => ({ uri: staticPhotoUrl(`food/${key}.jpg`) });

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
  photos.push({ source: stock(key), illustrative: true });
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
  if (item.imageUrl)
    photos.push({ source: { uri: apiAssetUrl(item.imageUrl) }, illustrative: false });
  photos.push({ source: stock(key), illustrative: true });
  return photos;
}

/** A stock photo for a category chip (always illustrative). */
export function categoryPhoto(categoryName: string): ImageSourcePropType {
  return stock(matchKey([categoryName]) ?? 'bun-cha');
}
