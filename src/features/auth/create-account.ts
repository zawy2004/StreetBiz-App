import type { RoleCode } from '@/core/types/role';
import { useMockDb } from '@/mocks/db';
import type { MockUser } from '@/mocks/types';

export type NewAccount = { fullName: string; phone: string; password: string; role: Extract<RoleCode, 'CUSTOMER' | 'VENDOR'> };

export function phoneExists(phone: string) {
  const digits = phone.replace(/\D/g, '');
  return useMockDb.getState().users.some((u) => u.phone.replace(/\D/g, '') === digits);
}

/** Creates the mock account (and an empty vendor profile for vendors) and returns it linked. */
export function createAccount({ fullName, phone, password, role }: NewAccount): MockUser {
  const db = useMockDb.getState();
  const user = db.registerUser({ fullName, phone, password, role_code: role, account_status: 'ACTIVE' });
  if (role !== 'VENDOR') return user;

  const vendor = db.registerVendor({
    userId: user.id,
    vendor_type: 'ITINERANT',
    business_name: '',
    owner_name: fullName,
    phone,
    ward_unit_type: 'WARD',
  });
  const linked = { ...user, vendorId: vendor.id };
  useMockDb.setState((s) => ({ users: s.users.map((u) => (u.id === user.id ? linked : u)) }));
  return linked;
}
