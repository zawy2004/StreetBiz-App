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

export const FOOD_SAFETY_DOCS = [
  { key: 'health', label: 'Giấy khám sức khoẻ' },
  { key: 'training', label: 'Chứng nhận tập huấn' },
  { key: 'tools', label: 'Ảnh dụng cụ chế biến' },
] as const;
