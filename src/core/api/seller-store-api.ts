import { appendFile, type PickedFile } from '@/core/api/upload';
import { apiDelete, apiGet, apiPost, apiPut, apiUpload } from './client';

export type SellerStore = {
  storefrontId: number;
  registrationId: number;
  contractId: number;
  name: string;
  description: string | null;
  availabilityStatus: string;
};
export type StoreInput = Omit<SellerStore, 'storefrontId'>;
/** Where a dish stands with ATTP; MISSING and PENDING dishes are not shown to buyers. */
export type DishFoodSafetyStatus = 'NOT_REQUIRED' | 'MISSING' | 'PENDING' | 'APPROVED';
export type SellerMenuItem = {
  menuItemId: number;
  storefrontId: number;
  categoryId: number;
  name: string;
  description: string | null;
  unitPrice: number;
  availabilityStatus: string;
  imageUrl: string | null;
  categoryName: string;
  requiresFoodSafety: boolean;
  foodSafetyStatus: DishFoodSafetyStatus;
  foodSafetyExpiresOn: string | null;
  /** English name for the price board, typed by the vendor (optional). */
  nameEn: string | null;
  /** What one price buys ("ổ", "ly", "kg"…), as posted on the price board. */
  priceUnit: string;
};
/** The stall's dishes plus how many it may sell at once. */
export type SellerMenu = { items: SellerMenuItem[]; maxItems: number };
export type MenuInput = {
  categoryId: number;
  name: string;
  description: string | null;
  unitPrice: number;
  availabilityStatus: string;
  /** From `uploadMenuImage`; required for a new dish, omit to keep the current photo. */
  imageUrl?: string | null;
  /** Required, 1–30 characters (Luật Giá 2023 Điều 29: a posted price names its unit); 422 without it. */
  priceUnit: string;
  /** Optional, at most 180 characters. */
  nameEn?: string | null;
};
/** One dish as the price board shows it. */
export type PriceBoardItem = {
  menuItemId: number;
  name: string;
  nameEn: string | null;
  priceUnit: string;
  unitPrice: number;
};
export type PriceChangeKind = 'CREATED' | 'UPDATED' | 'ARCHIVED' | 'RESTORED';
/** One append-only row of the stall's price history: the whole dish as it stood after a change. */
export type PriceHistoryEntry = {
  priceHistoryId: number;
  menuItemId: number;
  name: string;
  nameEn: string | null;
  priceUnit: string;
  unitPrice: number;
  /** The dish's price on its previous row; null for its first row. */
  previousUnitPrice: number | null;
  isListed: boolean;
  changeKind: PriceChangeKind;
  changedAt: string;
  /** The vendor's own name, or "Quản trị viên" for a moderator's hide/restore. */
  changedByName: string;
};
/**
 * BUY-06: the stall's price board as the vendor manages it. `version` is "Bản số N"; `qrUrl` is
 * what the printed board's QR encodes (`/q/{token}?v=N`) and `printUrl` the public A5 page. Both
 * are null without a live permit or without the server's public base URL.
 */
export type SellerPriceBoard = {
  storefrontId: number;
  storefrontName: string;
  slotCode: string | null;
  version: number;
  updatedAt: string | null;
  qrUrl: string | null;
  printUrl: string | null;
  items: PriceBoardItem[];
  /** The 50 latest changes, newest first. */
  history: PriceHistoryEntry[];
};
export type SellerCategory = { categoryId: number; name: string; requiresFoodSafety: boolean };
export type RentalChoice = {
  contractId: number;
  applicationId: number;
  slotCode: string;
  startDate: string;
  endDate: string;
  contractStatus: string;
};
export type ApplicationChoice = { applicationId: number; registrationId: number };

export const sellerStoreApi = {
  stores: () => apiGet<SellerStore[]>('/seller/storefronts'),
  saveStore: (id: number | null, input: StoreInput) =>
    id === null
      ? apiPost<SellerStore>('/seller/storefronts', input)
      : apiPut<SellerStore>(`/seller/storefronts/${id}`, input),
  categories: () => apiGet<SellerCategory[]>('/seller/storefronts/food-categories'),
  menu: (id: number) => apiGet<SellerMenu>(`/seller/storefronts/${id}/menu-items`),
  /** Stores a dish photo (public) and returns the URL to send as `imageUrl`. */
  uploadMenuImage: (file: PickedFile) => {
    const form = new FormData();
    appendFile(form, file);
    return apiUpload<{ fileUrl: string }>('/uploads/menu-images', form);
  },
  saveItem: (storeId: number, id: number | null, input: MenuInput) =>
    id === null
      ? apiPost<SellerMenuItem>(`/seller/storefronts/${storeId}/menu-items`, input)
      : apiPut<SellerMenuItem>(`/seller/storefronts/${storeId}/menu-items/${id}`, input),
  archiveItem: (storeId: number, id: number) =>
    apiDelete<void>(`/seller/storefronts/${storeId}/menu-items/${id}`),
  priceBoard: (storeId: number) => apiGet<SellerPriceBoard>(`/seller/storefronts/${storeId}/price-board`),
  contracts: () => apiGet<RentalChoice[]>('/vendor/rental-contracts?status=ACTIVE'),
  applications: () => apiGet<ApplicationChoice[]>('/vendor/rental-applications'),
};
