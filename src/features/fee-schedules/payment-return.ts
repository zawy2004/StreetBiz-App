import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { create } from 'zustand';

import { errorMessage, financeApi } from '@/core/api';

/**
 * The app's version of the web's `useFinancePaymentReturn`. A real MoMo page opens outside the
 * app; when the vendor comes back (the app turns active again) the backend asks MoMo for the
 * real state and applies it. Nothing is marked paid from the app's side (BR-32).
 */
const usePendingPayment = create<{ transactionId: number | null; set: (id: number | null) => void }>((set) => ({
  transactionId: null,
  set: (transactionId) => set({ transactionId }),
}));

export const rememberFinancePayment = (transactionId: number) => usePendingPayment.getState().set(transactionId);

export type FinanceReturnState =
  | { phase: 'idle' }
  | { phase: 'checking' }
  | { phase: 'pending'; transactionId: number }
  | { phase: 'failed'; message: string };

export function useFinancePaymentReturn(onSuccess: () => void) {
  const [state, setState] = useState<FinanceReturnState>({ phase: 'idle' });
  const onSuccessRef = useRef(onSuccess);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
  });

  const check = useCallback(async (transactionId: number) => {
    setState({ phase: 'checking' });
    try {
      const result = await financeApi.syncPayment(transactionId);
      if (result.status === 'SUCCESS') {
        usePendingPayment.getState().set(null);
        setState({ phase: 'idle' });
        onSuccessRef.current();
      } else if (result.status === 'FAILED') {
        usePendingPayment.getState().set(null);
        setState({ phase: 'failed', message: 'MoMo báo giao dịch không thành công. Bạn có thể thanh toán lại.' });
      } else {
        setState({ phase: 'pending', transactionId });
      }
    } catch (error) {
      setState({ phase: 'failed', message: errorMessage(error) });
    }
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const id = usePendingPayment.getState().transactionId;
      if (next === 'active' && id != null) void check(id);
    });
    return () => sub.remove();
  }, [check]);

  return { state, retry: (transactionId: number) => void check(transactionId) };
}
