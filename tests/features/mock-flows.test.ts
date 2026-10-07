import { createAccount, phoneExists } from '@/features/auth/create-account';
import { feeStatus, isFeeDue } from '@/features/finance/utils';
import { useMockDb } from '@/mocks/db';
import { useAuthStore } from '@/store/auth-store';

describe('sign in', () => {
  afterEach(() => useAuthStore.setState({ user: null }));

  it('accepts a seeded account regardless of phone formatting', async () => {
    const user = await useAuthStore.getState().signIn('0905 000 002', '123456');
    expect(user.role_code).toBe('VENDOR');
    expect(useAuthStore.getState().user?.role_code).toBe('VENDOR');
  });

  it('rejects a wrong password with a readable message', async () => {
    await expect(useAuthStore.getState().signIn('0905000002', 'wrong')).rejects.toThrow('Sai số điện thoại hoặc mật khẩu');
    expect(useAuthStore.getState().user).toBeNull();
  });
});

describe('sign up', () => {
  it('creates a vendor account linked to an empty vendor profile', () => {
    const user = createAccount({ fullName: 'Hộ Mới', phone: '0911111111', password: 'abc123', role: 'VENDOR' });
    expect(user.vendorId).toBeDefined();
    expect(useMockDb.getState().vendors.some((v) => v.id === user.vendorId)).toBe(true);
    expect(phoneExists('0911 111 111')).toBe(true);
  });
});

describe('rental, payment and violation flows', () => {
  it('approving an application issues a contract, permit and first fee', () => {
    const db = useMockDb.getState();
    const application = db.submitRentalApplication({ vendorId: 'VEN-001', slotIds: ['SLOT-025'], application_type: 'OPEN_SLOT' });
    expect(useMockDb.getState().slots.find((s) => s.id === 'SLOT-025')?.slot_status).toBe('PENDING');

    db.approveRentalApplication(application.id);
    const after = useMockDb.getState();
    const contract = after.contracts.find((c) => c.applicationId === application.id);
    expect(contract?.contract_status).toBe('ACTIVE');
    expect(after.permits.some((p) => p.contractId === contract?.id && p.permit_status === 'VALID')).toBe(true);
    expect(after.feeItems.some((f) => f.contractId === contract?.id && f.item_status === 'PENDING')).toBe(true);
  });

  it('cancelling a pending application frees the slot again', () => {
    const db = useMockDb.getState();
    const application = db.submitRentalApplication({ vendorId: 'VEN-001', slotIds: ['SLOT-027'], application_type: 'OPEN_SLOT' });
    db.cancelRentalApplication(application.id);
    const after = useMockDb.getState();
    expect(after.applications.find((a) => a.id === application.id)?.application_status).toBe('CANCELLED');
    expect(after.slots.find((s) => s.id === 'SLOT-027')?.slot_status).toBe('AVAILABLE');
  });

  it('paying a fee marks it paid and issues an invoice', () => {
    useMockDb.getState().payFee('FEE-001');
    const after = useMockDb.getState();
    expect(after.feeItems.find((f) => f.id === 'FEE-001')?.item_status).toBe('PAID');
    expect(after.invoices.some((i) => i.feeItemId === 'FEE-001')).toBe(true);
  });

  it('recording a violation with an amount creates a pending penalty', () => {
    const before = useMockDb.getState().penalties.length;
    useMockDb.getState().recordViolation(
      { vendorId: 'VEN-001', violation_type: 'OVER_BOUNDARY', note: 'Vượt vạch', photoUris: [], reportedBy: 'WARD' },
      300000,
    );
    const penalties = useMockDb.getState().penalties;
    expect(penalties).toHaveLength(before + 1);
    expect(penalties[penalties.length - 1]?.penalty_status).toBe('PENDING');
  });
});

describe('fee status', () => {
  const fee = { id: 'F', contractId: 'C', vendorId: 'V', period_label: 'T1', amount: 1, due_date: '2020-01-01T00:00:00.000Z' };

  it('shows a past-due pending fee as overdue and a paid fee as paid', () => {
    expect(feeStatus({ ...fee, item_status: 'PENDING' })).toBe('OVERDUE');
    expect(feeStatus({ ...fee, item_status: 'PAID' })).toBe('PAID');
    expect(isFeeDue({ ...fee, item_status: 'PAID' })).toBe(false);
  });
});
