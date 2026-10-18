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
  contracts: () => apiGet<RentalChoice[]>('/vendor/rental-contracts?status=ACTIVE'),
  applications: () => apiGet<ApplicationChoice[]>('/vendor/rental-applications'),
};
