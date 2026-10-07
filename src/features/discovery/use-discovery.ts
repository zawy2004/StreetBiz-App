import { useQuery } from '@tanstack/react-query';

import { communityApi } from '@/core/api/community-api';
import { marketplaceApi, type StorefrontSummary } from '@/core/api/commerce-api';
import { useDualMutation, useDualQuery } from '@/core/api/dual';
import { isLiveApi } from '@/core/config/env';
import { useMockDb } from '@/mocks/db';
import { useAuthStore } from '@/store/auth-store';
import { daysUntil } from '@/utils/format';

import { useActiveVendors } from './useActiveVendors';

/** A licensed vendor as buyers see it on Explore (BUY-01), whichever source supplied it. */
export type VendorListItem = {
  key: string;
  vendorId: string;
  name: string;
  slotCode: string;
  street: string;
  latitude: number;
  longitude: number;
  distanceM: number | null;
  rating: number | null;
  ratingCount: number;
  storefrontId?: string;
  isOpen?: boolean;
  categories: string[];
  /** Position on the schematic map, 0..1 from the top-left. */
  pin: { x: number; y: number };
};

export type CategoryItem = { id: string; name: string };

export type MenuItemView = {
  id: string;
  storefrontId: string;
  storefrontName: string;
  name: string;
  description: string;
  price: number;
  soldOut: boolean;
  imageUrl?: string;
  categoryName?: string;
};

export type StoreView = {
  id: string;
  vendorId: string;
  name: string;
  description: string;
  status: 'OPEN' | 'CLOSED' | 'PAUSED';
  hours: string;
  address?: string;
  slotCode?: string;
  rating: number | null;
  ratingCount: number;
  menu: { category: string; items: MenuItemView[] }[];
};

export type ReviewView = { id: string; author?: string; rating: number | null; text: string; createdAt: string };

export type VendorProfileView = {
  vendorId: string;
  name: string;
  ownerName?: string;
  address?: string;
  slotId?: string;
  slotCode: string;
  street: string;
  permitId: string;
  permitCode: string;
  permitStatus: string;
  permitEndDate: string;
  hours?: string;
  rating: number | null;
  ratingCount: number;
  distanceM: number | null;
  storefrontId?: string;
  comments: ReviewView[];
};

/** Spreads real coordinates over the schematic map's 0..1 square, with a margin. */
function pins<T extends { latitude: number; longitude: number }>(items: T[]): (T & { pin: { x: number; y: number } })[] {
  if (!items.length) return [];
  const lats = items.map((i) => i.latitude);
  const lngs = items.map((i) => i.longitude);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  const span = (lo: number, hi: number, v: number) => (hi - lo < 1e-9 ? 0.5 : 0.1 + ((v - lo) / (hi - lo)) * 0.72);
  return items.map((i) => ({ ...i, pin: { x: span(minLng, maxLng, i.longitude), y: 1 - span(minLat, maxLat, i.latitude) - 0.08 } }));
}

const hoursOf = (s: StorefrontSummary) => (s.todayHours[0] ? `${s.todayHours[0].opensAt} - ${s.todayHours[0].closesAt}` : '');

/**
 * Marketplace storefronts. The marketplace catalog can fail on its own (it is
 * a Phase 2 module), so discovery treats it as optional and still lists the
 * licensed vendors without it.
 */
function useStorefrontIndex() {
  return useQuery({
    queryKey: ['marketplace', 'storefronts'],
    queryFn: () => marketplaceApi.storefronts({ take: 100 }),
    enabled: isLiveApi,
    retry: false,
  });
}

/** Licensed vendors for Explore, joined with their storefront (open now, categories) when one exists. */
export function useVendorList() {
  const mockVendors = useActiveVendors();
  const menuItems = useMockDb((s) => s.menuItems);
  const categories = useMockDb((s) => s.foodCategories);
  const stores = useStorefrontIndex();

  const mock: VendorListItem[] = mockVendors.map((v) => {
    const catIds = new Set(menuItems.filter((m) => m.storefrontId === v.storefront?.id).map((m) => m.categoryId));
    return {
      key: v.vendor.id,
      vendorId: v.vendor.id,
      name: v.storefront?.name ?? v.vendor.business_name,
      slotCode: v.slot.slot_code,
      street: v.slot.street,
      latitude: v.slot.lat,
      longitude: v.slot.lng,
      distanceM: v.distanceM,
      rating: v.rating || null,
      ratingCount: v.ratingCount,
      storefrontId: v.storefront?.id,
      isOpen: v.storefront ? v.storefront.availability_status === 'OPEN' : undefined,
      categories: categories.filter((c) => catIds.has(c.id)).map((c) => c.name),
      pin: v.pin,
    };
  });

  const storeList = stores.data;
  return useDualQuery({
    key: ['community', 'vendors', storeList?.length ?? 0],
    live: async () => {
      const vendors = await communityApi.activeVendors();
      const rows = vendors.map((v) => {
        const store = storeList?.find((s) => s.vendorId === v.vendorId && s.slotCode === v.slotCode);
        return {
          key: `${v.vendorId}-${v.permitId}`,
          vendorId: String(v.vendorId),
          name: store?.storefrontName ?? v.displayName,
          slotCode: v.slotCode,
          street: v.zoneName,
          latitude: v.latitude,
          longitude: v.longitude,
          distanceM: v.distanceMeters,
          rating: v.communityRating ?? v.verifiedRating,
          ratingCount: v.communityCount || v.verifiedCount,
          storefrontId: store ? String(store.storefrontId) : undefined,
          isOpen: store?.isOpenNow,
          categories: store?.categories ?? [],
        };
      });
      return pins(rows);
    },
    mock,
    enabled: !isLiveApi || !stores.isLoading,
  });
}

export function useCategories() {
  const mock = useMockDb((s) => s.foodCategories).map((c): CategoryItem => ({ id: c.id, name: c.name }));
  return useDualQuery({
    key: ['marketplace', 'categories'],
    live: async () => {
      try {
        return (await marketplaceApi.categories()).map((c): CategoryItem => ({ id: String(c.categoryId), name: c.categoryName }));
      } catch {
        return [];
      }
    },
    mock,
  });
}

/** BUY-03: a vendor's public profile with community reviews. */
export function useVendorProfile(vendorId: string | undefined) {
  const item = useActiveVendors().find((v) => v.vendor.id === vendorId);
  const comments = useMockDb((s) => s.comments).filter((c) => c.vendorId === vendorId);
  const stores = useStorefrontIndex();

  const mock: VendorProfileView | null = item
    ? {
        vendorId: item.vendor.id,
        name: item.storefront?.name ?? item.vendor.business_name,
        ownerName: item.vendor.owner_name,
        address: item.vendor.address,
        slotId: item.slot.id,
        slotCode: item.slot.slot_code,
        street: item.slot.street,
        permitId: item.permit.id,
        permitCode: item.permit.permit_code,
        permitStatus: item.permit.permit_status,
        permitEndDate: item.permit.expires_at,
        hours: item.storefront ? `${item.storefront.openTime} - ${item.storefront.closeTime}` : item.slot.time_window,
        rating: item.rating || null,
        ratingCount: item.ratingCount,
        distanceM: item.distanceM,
        storefrontId: item.storefront?.id,
        comments: comments.map((c) => ({ id: c.id, author: c.authorName, rating: c.rating, text: c.text, createdAt: c.created_at })),
      }
    : null;

  return useDualQuery({
    key: ['community', 'vendor', vendorId, stores.data?.length ?? 0],
    live: async (): Promise<VendorProfileView | null> => {
      const p = await communityApi.profile(vendorId!);
      const store = stores.data?.find((s) => s.vendorId === p.vendorId && s.slotCode === p.slotCode);
      return {
        vendorId: String(p.vendorId),
        name: store?.storefrontName ?? p.displayName,
        address: p.address ?? undefined,
        slotId: String(p.slotId),
        slotCode: p.slotCode,
        street: p.zoneName,
        permitId: String(p.permitId),
        // The API exposes no printed permit number, only its id.
        permitCode: `#${p.permitId}`,
        permitStatus: p.permitStatus,
        permitEndDate: p.permitEndDate,
        hours: store ? hoursOf(store) || undefined : undefined,
        rating: p.communityRating ?? p.verifiedRating,
        ratingCount: p.communityCount || p.verifiedCount,
        distanceM: null,
        storefrontId: store ? String(store.storefrontId) : undefined,
        comments: p.comments.map((c) => ({ id: String(c.commentId), author: c.authorName, rating: c.rating, text: c.commentText ?? '', createdAt: c.createdAt })),
      };
    },
    mock,
    enabled: Boolean(vendorId) && (!isLiveApi || !stores.isLoading),
  });
}

/** BUY-04: rate and review a vendor (one review per buyer; saving again edits it). */
export function useCommentVendor(vendorId: string) {
  return useDualMutation<{ rating: number; text: string }, void>({
    live: async ({ rating, text }) => void (await communityApi.comment(vendorId, rating, text)),
    mock: ({ rating, text }) => {
      const user = useAuthStore.getState().user;
      if (user) useMockDb.getState().addComment({ vendorId, authorId: user.id, authorName: user.fullName, rating, text });
    },
    invalidate: [['community']],
  });
}

/** BUY-05: report a vendor, optionally with a photo. */
export function useReportVendor(vendorId: string) {
  return useDualMutation<{ reason: string; photoUri?: string; slotId?: string }, void>({
    live: async ({ reason, photoUri, slotId }) => {
      const evidenceUrl = photoUri ? (await communityApi.uploadEvidence(photoUri)).fileUrl : undefined;
      await communityApi.report(vendorId, { reason, evidenceUrl, slotId: slotId ? Number(slotId) : undefined });
    },
    mock: ({ reason, photoUri }) => {
      const user = useAuthStore.getState().user;
      if (user) useMockDb.getState().addReport({ vendorId, reporterId: user.id, reason, photoUri });
    },
  });
}

function mockMenuItem(
  m: { id: string; storefrontId: string; name: string; description: string; price: number; availability_status: string; categoryId: string },
  storeName: string,
  categoryName?: string,
): MenuItemView {
  return {
    id: m.id,
    storefrontId: m.storefrontId,
    storefrontName: storeName,
    name: m.name,
    description: m.description,
    price: m.price,
    soldOut: m.availability_status === 'SOLD_OUT',
    categoryName,
  };
}

/** CART-01's storefront page: details and menu grouped by category. */
export function useStorefront(storefrontId: string | undefined) {
  const store = useMockDb((s) => s.storefronts).find((s) => s.id === storefrontId);
  const items = useMockDb((s) => s.menuItems).filter((m) => m.storefrontId === storefrontId);
  const categories = useMockDb((s) => s.foodCategories);

  const mock: StoreView | null = store
    ? {
        id: store.id,
        vendorId: store.vendorId,
        name: store.name,
        description: store.description,
        status: store.availability_status,
        hours: `${store.openTime} - ${store.closeTime}`,
        rating: store.ratingAvg,
        ratingCount: store.ratingCount,
        menu: [
          {
            category: 'Thực đơn',
            items: items.map((m) => mockMenuItem(m, store.name, categories.find((c) => c.id === m.categoryId)?.name)),
          },
        ],
      }
    : null;

  return useDualQuery({
    key: ['marketplace', 'storefront', storefrontId],
    live: async (): Promise<StoreView | null> => {
      const d = await marketplaceApi.storefront(storefrontId!);
      const s = d.storefront;
      return {
        id: String(s.storefrontId),
        vendorId: String(s.vendorId),
        name: s.storefrontName,
        description: s.description ?? '',
        status: s.isOpenNow ? 'OPEN' : 'CLOSED',
        hours: hoursOf(s),
        address: s.address ?? undefined,
        slotCode: s.slotCode,
        rating: s.communityRating,
        ratingCount: s.communityCount,
        menu: d.menu.map((group) => ({
          category: group.categoryName,
          items: group.items.map(toMenuItemView),
        })),
      };
    },
    mock,
    enabled: Boolean(storefrontId),
  });
}

export function toMenuItemView(m: import('@/core/api/commerce-api').MarketplaceMenuItem): MenuItemView {
  return {
    id: String(m.menuItemId),
    storefrontId: String(m.storefrontId),
    storefrontName: m.storefrontName,
    name: m.itemName,
    description: m.description ?? '',
    price: m.unitPrice,
    soldOut: m.availabilityStatus !== 'AVAILABLE',
    imageUrl: m.imageUrl ?? undefined,
    categoryName: m.categoryName,
  };
}

/** Reviews shown on a storefront page: order reviews in the demo, the vendor's community reviews live. */
export function useStoreReviews(storefrontId: string | undefined, vendorId: string | undefined) {
  const mock = useMockDb((s) => s.reviews)
    .filter((r) => r.storefrontId === storefrontId)
    .map((r): ReviewView => ({ id: r.id, rating: r.rating, text: r.text, createdAt: r.created_at }));
  return useDualQuery({
    key: ['community', 'vendor-reviews', vendorId],
    live: async () =>
      (await communityApi.profile(vendorId!)).comments.map(
        (c): ReviewView => ({ id: String(c.commentId), author: c.authorName, rating: c.rating, text: c.commentText ?? '', createdAt: c.createdAt }),
      ),
    mock,
    enabled: Boolean(storefrontId) && (!isLiveApi || Boolean(vendorId)),
  });
}

export function useMenuItem(itemId: string | undefined) {
  const item = useMockDb((s) => s.menuItems).find((m) => m.id === itemId);
  const store = useMockDb((s) => s.storefronts).find((s) => s.id === item?.storefrontId);
  return useDualQuery({
    key: ['marketplace', 'item', itemId],
    live: async () => toMenuItemView(await marketplaceApi.menuItem(itemId!)),
    mock: item ? mockMenuItem(item, store?.name ?? '') : null,
    enabled: Boolean(itemId),
  });
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase();

/** DISC search: places (vendors) and dishes matching the text. */
export function useSearch(text: string) {
  const q = fold(text.trim());
  const vendors = useVendorList();
  const items = useMockDb((s) => s.menuItems);
  const stores = useMockDb((s) => s.storefronts);

  const places = q ? (vendors.data ?? []).filter((v) => fold(`${v.name} ${v.street} ${v.slotCode}`).includes(q)) : [];
  const openStoreIds = new Set((vendors.data ?? []).map((v) => v.storefrontId).filter(Boolean));
  const mockDishes = q
    ? items
        .filter((i) => openStoreIds.has(i.storefrontId) && fold(i.name).includes(q))
        .map((i) => mockMenuItem(i, stores.find((s) => s.id === i.storefrontId)?.name ?? ''))
    : [];

  const dishes = useDualQuery({
    key: ['marketplace', 'search', q],
    live: async () => {
      try {
        return (await marketplaceApi.menuItems(text.trim())).map(toMenuItemView);
      } catch {
        return [];
      }
    },
    mock: mockDishes,
    enabled: q.length >= 2,
  });

  return { query: q, places, dishes: dishes.data ?? [], isLoading: vendors.isLoading || dishes.isLoading };
}

export type PermitCheck = {
  valid: boolean;
  status: string;
  vendorId?: string;
  name?: string;
  slotCode?: string;
  street?: string;
  validUntil?: string;
  found: boolean;
};

/** BUY-02: check a scanned permit QR. Live, the backend verifies the signed payload. */
export function useVerifyPermit(code: string | undefined) {
  const db = useMockDb();
  const permit = db.permits.find((p) => p.permit_code.toLowerCase() === (code ?? '').toLowerCase());
  const contract = db.contracts.find((c) => c.id === permit?.contractId);
  const vendor = db.vendors.find((v) => v.id === contract?.vendorId);
  const slot = db.slots.find((s) => s.id === contract?.slotId);
  const expired = permit ? daysUntil(permit.expires_at) < 0 : false;

  const mock: PermitCheck = {
    found: Boolean(permit && vendor),
    valid: Boolean(permit && vendor && permit.permit_status === 'VALID' && !expired),
    status: permit ? (permit.permit_status === 'VALID' && expired ? 'EXPIRED' : permit.permit_status) : 'NOT_FOUND',
    vendorId: vendor?.id,
    name: vendor ? vendor.business_name || vendor.owner_name : undefined,
    slotCode: slot?.slot_code,
    street: slot?.street,
    validUntil: permit?.expires_at,
  };

  return useDualQuery({
    key: ['community', 'permit-check', code],
    live: async (): Promise<PermitCheck> => {
      const r = await communityApi.verifyPermit(code!);
      return {
        found: r.permitId !== null,
        valid: r.isValid,
        status: r.status,
        vendorId: r.vendorId !== null ? String(r.vendorId) : undefined,
        name: r.displayName ?? undefined,
        slotCode: r.slotCode ?? undefined,
        validUntil: r.validUntil ?? undefined,
      };
    },
    mock,
    enabled: Boolean(code),
  });
}
