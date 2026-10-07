import { create } from 'zustand';

type Draft = {
  violationType: string;
  note: string;
  photos: (string | undefined)[];
  patch: (values: Partial<Omit<Draft, 'patch' | 'reset'>>) => void;
  reset: () => void;
};

const empty = { violationType: '', note: '', photos: [undefined, undefined, undefined] as (string | undefined)[] };

/** Step 1 of the violation report, kept until the decision on step 2 is issued. */
export const useViolationDraft = create<Draft>((set) => ({
  ...empty,
  patch: (values) => set(values),
  reset: () => set(empty),
}));
