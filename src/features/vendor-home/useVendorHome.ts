import { useMemo } from 'react';

import { feeStatus, isFeeDue } from '@/features/finance/utils';
import { useMockDb } from '@/mocks/db';
import { useAuthStore } from '@/store/auth-store';

export type TodoItem = {
  id: string;
  kind: 'registration' | 'fee' | 'penalty';
  title: string;
  subtitle: string;
  chip?: string;
  danger?: boolean;
  href: string;
};

export function useVendorHome() {
  const user = useAuthStore((s) => s.user);
  const db = useMockDb();

  return useMemo(() => {
    const vendorId = user?.vendorId;
    const contract = db.contracts.find((c) => c.vendorId === vendorId && c.contract_status === 'ACTIVE');
    const permit = contract ? db.permits.find((p) => p.contractId === contract.id) : undefined;
    const slot = contract ? db.slots.find((s) => s.id === contract.slotId) : undefined;

    const todos: TodoItem[] = [];

    for (const r of db.registrations) {
      if (r.vendorId === vendorId && r.registration_status === 'MORE_INFORMATION_REQUIRED') {
        todos.push({
          id: r.id,
          kind: 'registration',
          title: 'Bổ sung giấy tờ',
          subtitle: r.review_note ?? r.business_name,
          href: `/vendor/registrations/${r.id}`,
        });
      }
    }
    for (const f of db.feeItems) {
      if (f.vendorId === vendorId && isFeeDue(f)) {
        todos.push({
          id: f.id,
          kind: 'fee',
          title: `Đóng phí thuê ô ${f.period_label}`,
          subtitle: `${new Intl.NumberFormat('vi-VN').format(f.amount)} đ`,
          chip: feeStatus(f) === 'OVERDUE' ? 'OVERDUE' : 'PENDING_PAYMENT',
          href: `/vendor/finance/fees/${f.id}`,
        });
      }
    }
    for (const p of db.penalties) {
      if (p.vendorId === vendorId && p.penalty_status === 'PENDING') {
        todos.push({
          id: p.id,
          kind: 'penalty',
          title: 'Biên bản vi phạm',
          subtitle: p.reason,
          danger: true,
          href: `/vendor/finance/penalties/${p.id}`,
        });
      }
    }

    const unreadCount = db.notifications.filter((n) => n.userId === user?.id && !n.read).length;
    return { user, permit, slot, todos, unreadCount };
  }, [db, user]);
}
