export const ORDER_STEPS = [
  { status: 'PLACED', label: 'Đã đặt' },
  { status: 'PREPARING', label: 'Đang làm' },
  { status: 'READY_FOR_PICKUP', label: 'Sẵn sàng' },
  { status: 'COMPLETED', label: 'Đã lấy' },
] as const;

/** Index of the current step, or -1 for orders outside the normal flow (cancelled, awaiting payment). */
export const stepIndex = (status: string) => ORDER_STEPS.findIndex((s) => s.status === status);

export const isActiveOrder = (status: string) => ['PENDING_PAYMENT', 'PLACED', 'PREPARING', 'READY_FOR_PICKUP'].includes(status);

export const PAY_METHODS = [
  { value: 'MOMO', label: 'MoMo' },
  { value: 'ZALOPAY', label: 'ZaloPay' },
];
