import { create } from 'zustand';

export type FoodSafetyFile = { id: string; title: string; status: string; submittedAt: string };

type State = {
  files: FoodSafetyFile[];
  submit: (title: string) => void;
};

/** Mock food-safety (ATTP) filings; the ward and department review them on the web. */
export const useFoodSafety = create<State>((set) => ({
  files: [],
  submit: (title) =>
    set((s) => ({
      files: [...s.files, { id: `ATTP-${s.files.length + 1}`, title, status: 'UNDER_REVIEW', submittedAt: new Date().toISOString() }],
    })),
}));

/** `type` is FoodSafetyEvidence.evidence_type on StreetBiz-BE. */
export const FOOD_SAFETY_DOCS = [
  { key: 'health', type: 'HEALTH_CHECK', label: 'Giấy khám sức khoẻ' },
  { key: 'training', type: 'TRAINING', label: 'Chứng nhận tập huấn ATTP' },
  { key: 'tools', type: 'PREMISES_PHOTO', label: 'Ảnh khu chế biến' },
] as const;
