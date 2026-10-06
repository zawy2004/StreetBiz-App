import dayjs from 'dayjs';

import type { FeeItem } from '@/mocks/types';

/** A PENDING fee whose due date has passed is shown as overdue. */
export function feeStatus(fee: FeeItem): string {
  if (fee.item_status === 'PENDING' && dayjs(fee.due_date).isBefore(dayjs(), 'day')) return 'OVERDUE';
  return fee.item_status;
}

export const isFeeDue = (fee: FeeItem) => fee.item_status === 'PENDING' || fee.item_status === 'OVERDUE';

export function transactionCode() {
  return `TXN-${dayjs().format('YYYYMMDD')}-${Math.floor(1000 + Math.random() * 9000)}`;
}
