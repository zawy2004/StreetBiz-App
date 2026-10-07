import { useDualMutation, useDualQuery } from '@/core/api/dual';
import { apiAssetUrl } from '@/core/api/client';
import { ApiError } from '@/core/api/problem';
import { registrationApi, sellerApi, slotsApi, type SellerMenuItem } from '@/core/api/vendor-api';
import { useFoodSafety } from '@/features/food-safety/food-safety-store';
import { useMockDb } from '@/mocks/db';
import { useAuthStore } from '@/store/auth-store';

import { useMarketplaceGate, type GateStore } from './useMarketplaceGate';

export type SellerItem = {
  id: string;
  name: string;
  price: number;
  description: string;
  categoryId: string;
  categoryName?: string;
  available: boolean;
  imageUrl?: string;
  /** Live: dishes needing an ATTP certificate stay hidden from buyers until it is approved. */
  foodSafety?: 'NOT_REQUIRED' | 'MISSING' | 'PENDING' | 'APPROVED';
};

export type SellerCategory = { id: string; name: string; requiresFoodSafety: boolean };

function fromApiItem(m: SellerMenuItem): SellerItem {
  return {
    id: String(m.menuItemId),
    name: m.name,
    price: m.unitPrice,
    description: m.description ?? '',
    categoryId: String(m.categoryId),
    categoryName: m.categoryName,
    available: m.availabilityStatus === 'AVAILABLE',
    imageUrl: apiAssetUrl(m.imageUrl),
    foodSafety: m.foodSafetyStatus,
  };
}

/** SORD/MENU: the dishes of one storefront. */
export function useSellerMenu(storeId: string | undefined) {
  const items = useMockDb((s) => s.menuItems).filter((m) => m.storefrontId === storeId);
  const categories = useMockDb((s) => s.foodCategories);
  const mock = {
    items: items.map(
      (m): SellerItem => ({
        id: m.id,
        name: m.name,
        price: m.price,
        description: m.description,
        categoryId: m.categoryId,
        categoryName: categories.find((c) => c.id === m.categoryId)?.name,
        available: m.availability_status === 'AVAILABLE',
      }),
    ),
    maxItems: 30,
  };
  return useDualQuery({
    key: ['vendor', 'menu', storeId],
    live: async () => {
      const menu = await sellerApi.menu(storeId!);
      return { items: menu.items.map(fromApiItem), maxItems: menu.maxItems };
    },
    mock,
    enabled: Boolean(storeId),
  });
}

export function useSellerCategories() {
  const mock = useMockDb((s) => s.foodCategories).map((c): SellerCategory => ({ id: c.id, name: c.name, requiresFoodSafety: false }));
  return useDualQuery({
    key: ['vendor', 'menu-categories'],
    live: async () => (await sellerApi.categories()).map((c): SellerCategory => ({ id: String(c.categoryId), name: c.name, requiresFoodSafety: c.requiresFoodSafety })),
    mock,
  });
}

export type ItemInput = { name: string; price: number; description: string; categoryId: string; available: boolean; photoUri?: string };

/** Add (id null) or edit a dish; a new photo is uploaded first and sent as `imageUrl`. */
export function useSaveMenuItem(storeId: string | undefined) {
  return useDualMutation<{ id: string | null; input: ItemInput; current?: SellerItem }, void>({
    live: async ({ id, input }) => {
      if (!storeId) throw new ApiError('validation_error', 400, 'Chưa có gian hàng.');
      const imageUrl = input.photoUri && !input.photoUri.startsWith('http') ? (await sellerApi.uploadMenuImage(input.photoUri)).fileUrl : undefined;
      await sellerApi.saveItem(storeId, id, {
        categoryId: Number(input.categoryId),
        name: input.name,
        description: input.description || null,
        unitPrice: input.price,
        availabilityStatus: input.available ? 'AVAILABLE' : 'SOLD_OUT',
        ...(imageUrl ? { imageUrl } : {}),
      });
    },
    mock: ({ id, input }) => {
      const values = {
        name: input.name,
        price: input.price,
        description: input.description,
        categoryId: input.categoryId,
        availability_status: input.available ? ('AVAILABLE' as const) : ('SOLD_OUT' as const),
      };
      if (id) useMockDb.getState().updateMenuItem(id, values);
      else if (storeId) useMockDb.getState().addMenuItem({ ...values, storefrontId: storeId });
    },
    invalidate: [['vendor', 'menu'], ['marketplace']],
  });
}

export function useArchiveMenuItem(storeId: string | undefined) {
  return useDualMutation<string, void>({
    live: async (id) => sellerApi.archiveItem(storeId!, id),
    mock: (id) => useMockDb.getState().removeMenuItem(id),
    invalidate: [['vendor', 'menu'], ['marketplace']],
  });
}

/** Create the storefront (live: tied to the approved registration and an active contract) or update it. */
export function useSaveStore() {
  const gate = useMarketplaceGate();
  const userId = useAuthStore((s) => s.user?.id);
  return useDualMutation<{ store?: GateStore; name: string; description: string; status: GateStore['status']; openTime?: string; closeTime?: string }, void>({
    live: async ({ store, name, description, status }) => {
      if (store?.registrationId && store.contractId) {
        await sellerApi.saveStore(Number(store.id), {
          registrationId: Number(store.registrationId),
          contractId: Number(store.contractId),
          name,
          description: description || null,
          availabilityStatus: status,
        });
        return;
      }
      if (!gate.registrationId) throw new ApiError('domain_rule', 422, 'Cần hồ sơ đăng ký được duyệt trước khi mở gian hàng.');
      const used = new Set(gate.storefronts.map((s) => s.contractId));
      const contract = (await slotsApi.contracts('ACTIVE')).find((c) => !used.has(String(c.contractId)));
      if (!contract) throw new ApiError('domain_rule', 422, 'Mỗi hợp đồng thuê ô đang hiệu lực chỉ mở được một gian hàng.');
      await sellerApi.saveStore(null, {
        registrationId: Number(gate.registrationId),
        contractId: contract.contractId,
        name,
        description: description || null,
        availabilityStatus: status,
      });
    },
    mock: ({ store, name, description, status, openTime, closeTime }) => {
      const db = useMockDb.getState();
      if (store) db.updateStorefront(store.id, { name, description, availability_status: status, openTime, closeTime });
      else if (gate.vendorId) db.createStorefront({ vendorId: gate.vendorId, name, description, openTime: openTime ?? '06:00', closeTime: closeTime ?? '20:00', availability_status: status });
    },
    invalidate: [['vendor', userId, 'stores'], ['vendor'], ['marketplace']],
  });
}

export type FoodSafetyView = { id: string; title: string; status: string; submittedAt: string; note?: string; dishes: string[] };

/** ATTP filings for the seller's dishes; the ward forwards them to Chi cục ATTP. */
export function useFoodSafetyList() {
  const files = useFoodSafety((s) => s.files);
  const userId = useAuthStore((s) => s.user?.id);
  return useDualQuery({
    key: ['vendor', userId, 'food-safety'],
    live: async () =>
      (await sellerApi.foodSafety()).map(
        (a): FoodSafetyView => ({
          id: String(a.applicationId),
          title: a.storefrontName,
          status: a.status,
          submittedAt: a.submittedAt,
          note: a.reviewReason ?? undefined,
          dishes: a.dishes.map((d) => d.name),
        }),
      ),
    mock: files.map((f): FoodSafetyView => ({ id: f.id, title: f.title, status: f.status, submittedAt: f.submittedAt, dishes: [] })),
  });
}

export function useSubmitFoodSafety() {
  return useDualMutation<{ storeId: string; menuItemIds: string[]; note: string; photos: { type: string; uri: string }[] }, void>({
    live: async ({ storeId, menuItemIds, note, photos }) => {
      const evidence = [];
      // Private documents go to the evidence store (token-protected), not the public dish photos.
      for (const p of photos) evidence.push({ evidenceType: p.type, fileUrl: (await registrationApi.uploadEvidence(p.uri)).fileUrl });
      await sellerApi.submitFoodSafety({ storefrontId: Number(storeId), menuItemIds: menuItemIds.map(Number), note: note || null, evidence });
    },
    mock: () => useFoodSafety.getState().submit('Hồ sơ an toàn thực phẩm'),
    invalidate: [['vendor']],
  });
}
