import { isFeeOpen, isPenaltyOpen, useFees, usePenalties } from '@/features/finance/use-finance';
import { useRegistrations } from '@/features/registration/use-registrations';
import { useActivePermit } from '@/features/slots/use-rentals';
import { useAuthStore } from '@/store/auth-store';
import { formatVnd } from '@/utils/format';

export type TodoItem = {
  id: string;
  kind: 'registration' | 'fee' | 'penalty';
  title: string;
  subtitle: string;
  chip?: string;
  danger?: boolean;
  href: string;
};

/** What the seller's home screen needs, from whichever source is active. */
export function useVendorHome() {
  const user = useAuthStore((s) => s.user);
  const registrations = useRegistrations();
  const active = useActivePermit();
  const fees = useFees();
  const penalties = usePenalties();

  const contract = active.data?.contract;
  const permit = active.data?.permit ?? undefined;

  const openFees = (fees.data ?? []).filter(isFeeOpen);
  const openPenalties = (penalties.data ?? []).filter(isPenaltyOpen);

  const todos: TodoItem[] = [
    ...(registrations.data ?? [])
      .filter((r) => r.status === 'MORE_INFORMATION_REQUIRED')
      .map((r): TodoItem => ({ id: `reg-${r.id}`, kind: 'registration', title: 'Bổ sung giấy tờ', subtitle: r.reviewNote ?? r.name, href: `/vendor/registrations/${r.id}` })),
    ...openFees.map(
      (f): TodoItem => ({
        id: `fee-${f.id}`,
        kind: 'fee',
        title: `Đóng phí thuê ô ${f.period}`,
        subtitle: [formatVnd(f.amount), f.slotCode].filter(Boolean).join(' · '),
        chip: f.status === 'OVERDUE' ? 'OVERDUE' : 'PENDING_PAYMENT',
        href: `/vendor/finance/fees/${f.id}`,
      }),
    ),
    ...openPenalties.map(
      (p): TodoItem => ({ id: `pen-${p.id}`, kind: 'penalty', title: 'Biên bản vi phạm', subtitle: p.reason, danger: true, href: `/vendor/finance/penalties/${p.id}` }),
    ),
  ];

  const dueTotal = openFees.reduce((n, f) => n + f.amount, 0) + openPenalties.reduce((n, p) => n + p.amount, 0);
  const loading = registrations.isLoading || active.isLoading || fees.isLoading || penalties.isLoading;
  const refetch = () => {
    registrations.refetch();
    active.refetch();
    fees.refetch();
    penalties.refetch();
  };

  return { user, contract, permit, todos, dueTotal, loading, refetch };
}
