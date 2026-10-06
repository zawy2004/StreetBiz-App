import { create } from 'zustand';

import type { VendorType } from '@/mocks/types';

export type EvidenceKind = 'ID_FRONT' | 'ID_BACK' | 'SCENE_PHOTO' | 'BUSINESS_LICENSE';

export const EVIDENCE_LABELS: Record<EvidenceKind, string> = {
  ID_FRONT: 'CCCD mặt trước',
  ID_BACK: 'CCCD mặt sau',
  SCENE_PHOTO: 'Ảnh nơi bán hàng',
  BUSINESS_LICENSE: 'Giấy phép kinh doanh',
};

export const requiredEvidence = (type: VendorType): EvidenceKind[] =>
  type === 'FIXED_STOREFRONT'
    ? ['ID_FRONT', 'ID_BACK', 'BUSINESS_LICENSE', 'SCENE_PHOTO']
    : ['ID_FRONT', 'ID_BACK', 'SCENE_PHOTO'];

type Draft = {
  vendorType: VendorType;
  businessName: string;
  category: string;
  address: string;
  ownerName: string;
  idNumber: string;
  birthDate: string;
  evidence: Partial<Record<EvidenceKind, string>>;
  patch: (values: Partial<Omit<Draft, 'patch' | 'reset'>>) => void;
  reset: () => void;
};

const empty = {
  vendorType: 'ITINERANT' as VendorType,
  businessName: '',
  category: '',
  address: '',
  ownerName: '',
  idNumber: '',
  birthDate: '',
  evidence: {},
};

/** Holds the four wizard steps until the registration is submitted. */
export const useRegistrationDraft = create<Draft>((set) => ({
  ...empty,
  patch: (values) => set(values),
  reset: () => set(empty),
}));
