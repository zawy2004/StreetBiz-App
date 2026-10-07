import dayjs from 'dayjs';

import { useDualMutation, useDualQuery } from '@/core/api/dual';
import { isLiveApi } from '@/core/config/env';
import { ApiError } from '@/core/api/problem';
import { registrationApi, slotsApi, type ApiApplication, type ApiContract, type ApiSlot, type ApiTransfer } from '@/core/api/vendor-api';
import { useMarketplaceGate } from '@/features/storefront/useMarketplaceGate';
import { useMockDb } from '@/mocks/db';
import type { SidewalkSlot } from '@/mocks/types';
import { useAuthStore } from '@/store/auth-store';
import { formatVnd, phoneDigits } from '@/utils/format';

/** Hải Châu 1 / Nguyễn Văn Linh pilot corridor, used when the vendor has no address on file. */
const DEFAULT_CENTER = { lat: 16.061, lng: 108.218 };

export type SlotView = {
  id: string;
  code: string;
  street: string;
  zoneId?: string;
  status: string;
  sizeLabel: string;
  priceMonthly: number;
  priceLabel: string;
  timeWindow?: string;
  lat: number;
  lng: number;
  tenantName?: string;
};

export type ZoneSlots = { name: string; slots: SlotView[] };

function fromMockSlot(s: SidewalkSlot): SlotView {
  return {
    id: s.id,
    code: s.slot_code,
    street: s.street,
    status: s.slot_status,
    sizeLabel: `${s.size_m2} m²`,
    priceMonthly: s.price_monthly,
    priceLabel: `${formatVnd(s.price_monthly)}/tháng`,
    timeWindow: s.time_window,
    lat: s.lat,
    lng: s.lng,
  };
}

function fromApiSlot(s: ApiSlot): SlotView {
  const monthly = s.pricePerMonth ?? s.pricePerDay * 30;
  const size = s.widthMeters && s.lengthMeters ? `${s.widthMeters} × ${s.lengthMeters} m` : '—';
  return {
    id: String(s.slotId),
    code: s.slotCode,
    street: s.zoneName,
    zoneId: String(s.zoneId),
    status: s.holdExpiresAt && s.slotStatus === 'AVAILABLE' ? 'PENDING' : s.slotStatus,
    sizeLabel: size,
    priceMonthly: monthly,
    priceLabel: s.priceDisplayUnit === 'MONTH' ? `${formatVnd(monthly)}/tháng` : `${formatVnd(s.pricePerDay)}/ngày`,
    timeWindow: s.availableFrom && s.availableTo ? `${s.availableFrom.slice(0, 5)} - ${s.availableTo.slice(0, 5)}` : undefined,
    lat: s.latitude,
    lng: s.longitude,
    tenantName: s.tenantName ?? undefined,
  };
}

/** SIDE-01: slots near the vendor, grouped by street (zone). */
export function useSlotMap() {
  const userId = useAuthStore((s) => s.user?.id);
  const slots = useMockDb((s) => s.slots).filter((s) => !s.proposal_review_status || s.proposal_review_status === 'APPROVED');
  const mock: ZoneSlots[] = slots.length ? [{ name: slots[0]!.street, slots: slots.map(fromMockSlot) }] : [];

  return useDualQuery({
    key: ['vendor', userId, 'slot-map'],
    live: async () => {
      const regs = await registrationApi.list().catch(() => []);
      const at = regs.find((r) => r.addressLatitude && r.addressLongitude);
      const center = at ? { lat: at.addressLatitude!, lng: at.addressLongitude! } : DEFAULT_CENTER;
      const found = (await slotsApi.near(center.lat, center.lng, 2000)).map(fromApiSlot);
      const zones = new Map<string, SlotView[]>();
      for (const s of found) zones.set(s.street, [...(zones.get(s.street) ?? []), s]);
      return [...zones.entries()].map(([name, list]): ZoneSlots => ({ name, slots: list.sort((a, b) => a.code.localeCompare(b.code)) }));
    },
    mock,
  });
}

export function useSlot(id: string | undefined) {
  const slot = useMockDb((s) => s.slots).find((s) => s.id === id);
  return useDualQuery({
    key: ['vendor', 'slot', id],
    live: async () => fromApiSlot(await slotsApi.get(id!)),
    mock: slot ? fromMockSlot(slot) : null,
    enabled: Boolean(id),
  });
}

/** Informational price for a term; the backend quotes zone fees on top of rent. */
export function useSlotQuote(id: string | undefined, months: number) {
  const slot = useMockDb((s) => s.slots).find((s) => s.id === id);
  return useDualQuery({
    key: ['vendor', 'slot-quote', id, months],
    live: async () => (await slotsApi.quote(id!, months * 30)).total,
    mock: (slot?.price_monthly ?? 0) * months,
    enabled: Boolean(id),
  });
}

/** SIDE-03A: apply for an open slot with the approved registration. Resolves with the application id. */
export function useApplyForSlot() {
  const gate = useMarketplaceGate();
  return useDualMutation<{ slotId: string; months: number }, string>({
    live: async ({ slotId, months }) => {
      if (!gate.registrationId) throw new ApiError('domain_rule', 422, 'Cần hồ sơ đăng ký kinh doanh được duyệt trước khi thuê ô.');
      const r = await slotsApi.applyOpenSlot(Number(gate.registrationId), Number(slotId), months * 30);
      return String(r.data.applicationId);
    },
    mock: ({ slotId }) => {
      const vendorId = useAuthStore.getState().user?.vendorId;
      if (!vendorId) throw new ApiError('domain_rule', 422, 'Chưa có hồ sơ hộ kinh doanh.');
      return useMockDb.getState().submitRentalApplication({ vendorId, slotIds: [slotId], application_type: 'OPEN_SLOT' }).id;
    },
    invalidate: [['vendor']],
  });
}

export type ApplicationView = { id: string; slotLabel: string; typeLabel: string; status: string; submittedAt: string; termDays?: number; reviewNote?: string };

const METHOD_LABEL: Record<string, string> = { MANUAL_SELECTED: 'Ô trống', STOREFRONT_ADJACENT: 'Liền kề địa chỉ', ADJACENT: 'Liền kề địa chỉ' };

function fromApiApplication(a: ApiApplication, codeOf: (slotId: number) => string | undefined): ApplicationView {
  return {
    id: String(a.applicationId),
    slotLabel: codeOf(a.slotId) ?? `Ô #${a.slotId}`,
    typeLabel: METHOD_LABEL[a.applicationMethod] ?? 'Ô trống',
    status: a.applicationStatus,
    submittedAt: a.createdAt,
    termDays: a.requestedTermDays,
    reviewNote: a.reviewDecisionReason ?? undefined,
  };
}

/** SIDE-04: the vendor's rental applications. Slot codes come from the vendor's contracts when known. */
export function useApplications() {
  const user = useAuthStore((s) => s.user);
  const apps = useMockDb((s) => s.applications).filter((a) => a.vendorId === user?.vendorId);
  const slots = useMockDb((s) => s.slots);
  const mock = apps.map(
    (a): ApplicationView => ({
      id: a.id,
      slotLabel: a.slotIds.map((id) => slots.find((s) => s.id === id)?.slot_code).join(', '),
      typeLabel: a.application_type === 'OPEN_SLOT' ? 'Ô trống' : 'Liền kề địa chỉ',
      status: a.application_status,
      submittedAt: a.submitted_at,
    }),
  );
  return useDualQuery({
    key: ['vendor', user?.id, 'applications'],
    live: async () => {
      const [list, contracts] = await Promise.all([slotsApi.applications(), slotsApi.contracts().catch(() => [] as ApiContract[])]);
      const codes = new Map(contracts.map((c) => [c.slotId, c.slotCode]));
      return list.map((a) => fromApiApplication(a, (id) => codes.get(id)));
    },
    mock,
  });
}

export function useApplication(id: string | undefined) {
  const list = useApplications();
  return useDualQuery({
    key: ['vendor', 'application', id],
    live: async () => {
      const a = await slotsApi.application(id!);
      const code = await slotsApi.get(a.slotId).then((s) => s.slotCode).catch(() => undefined);
      return fromApiApplication(a, () => code);
    },
    mock: list.data?.find((a) => a.id === id) ?? null,
    enabled: Boolean(id),
  });
}

export function useWithdrawApplication() {
  return useDualMutation<string, void>({
    live: async (id) => void (await slotsApi.withdrawApplication(id)),
    mock: (id) => useMockDb.getState().cancelRentalApplication(id),
    invalidate: [['vendor']],
  });
}

export type ContractView = { id: string; slotId: string; slotCode: string; street: string; startDate: string; endDate: string; status: string; feeMonthly?: number; nextDueDate?: string };

function fromApiContract(c: ApiContract): ContractView {
  return { id: String(c.contractId), slotId: String(c.slotId), slotCode: c.slotCode, street: c.zoneName, startDate: c.startDate, endDate: c.endDate, status: c.contractStatus };
}

/** SIDE-05: rental contracts, newest first. */
export function useContracts() {
  const user = useAuthStore((s) => s.user);
  const contracts = useMockDb((s) => s.contracts).filter((c) => c.vendorId === user?.vendorId);
  const slots = useMockDb((s) => s.slots);
  const fees = useMockDb((s) => s.feeItems);
  const mock = contracts.map((c): ContractView => {
    const slot = slots.find((s) => s.id === c.slotId);
    return {
      id: c.id,
      slotId: c.slotId,
      slotCode: slot?.slot_code ?? '',
      street: slot?.street ?? '',
      startDate: c.start_date,
      endDate: c.end_date,
      status: c.contract_status,
      feeMonthly: c.fee_monthly,
      nextDueDate: fees.find((f) => f.contractId === c.id && f.item_status !== 'PAID')?.due_date,
    };
  });
  return useDualQuery({
    key: ['vendor', user?.id, 'contracts'],
    live: async () => (await slotsApi.contracts()).map(fromApiContract),
    mock,
  });
}

export function useContract(id: string | undefined) {
  const list = useContracts();
  return useDualQuery({
    key: ['vendor', 'contract', id],
    live: async () => fromApiContract(await slotsApi.contract(id!)),
    mock: list.data?.find((c) => c.id === id) ?? null,
    enabled: Boolean(id),
  });
}

export type PermitView = { contractId: string; qr: string; displayCode: string; status: string; startDate: string; endDate: string; slotCode: string; street: string; vendorName: string };

/** SIDE-08: the digital permit (QR) of a contract. */
export function usePermit(contractId: string | undefined) {
  const user = useAuthStore((s) => s.user);
  const db = useMockDb();
  const permit = db.permits.find((p) => p.contractId === contractId);
  const contract = db.contracts.find((c) => c.id === contractId);
  const slot = db.slots.find((s) => s.id === contract?.slotId);
  const vendor = db.vendors.find((v) => v.id === user?.vendorId);
  const mock: PermitView | null =
    permit && contract
      ? {
          contractId: contract.id,
          qr: permit.permit_code,
          displayCode: permit.permit_code,
          status: permit.permit_status === 'VALID' && dayjs(permit.expires_at).isBefore(dayjs()) ? 'EXPIRED' : permit.permit_status,
          startDate: contract.start_date,
          endDate: permit.expires_at,
          slotCode: slot ? `${slot.slot_code} · ${slot.size_m2} m²` : '',
          street: slot?.street ?? '',
          vendorName: vendor?.business_name || vendor?.owner_name || user?.fullName || '',
        }
      : null;

  return useDualQuery({
    key: ['vendor', 'permit', contractId],
    live: () => livePermit(contractId!, user?.fullName ?? ''),
    mock,
    enabled: Boolean(contractId),
  });
}

/** Live permit of a contract, or null while the ward has not issued one (the API answers 404). */
async function livePermit(contractId: string, vendorName: string): Promise<PermitView | null> {
  try {
    const [p, c] = await Promise.all([slotsApi.permit(contractId), slotsApi.contract(contractId)]);
    return {
      contractId: String(p.contractId),
      qr: p.qrPayload,
      displayCode: `GP-${String(p.permitId).padStart(6, '0')}`,
      status: p.effectiveStatus,
      startDate: p.startDate,
      endDate: p.endDate,
      slotCode: c.slotCode,
      street: c.zoneName,
      vendorName,
    };
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

/**
 * The permit to feature on the seller's home: the first active contract that
 * actually has one (a just-approved contract may still be waiting for it).
 */
export function useActivePermit() {
  const user = useAuthStore((s) => s.user);
  const contracts = useContracts();
  const mockContract = contracts.data?.find((c) => c.status === 'ACTIVE');
  const mockPermit = usePermit(isLiveApi ? undefined : mockContract?.id);
  return useDualQuery({
    key: ['vendor', user?.id, 'active-permit'],
    live: async () => {
      const active = (await slotsApi.contracts()).filter((c) => c.contractStatus === 'ACTIVE');
      for (const c of active) {
        const permit = await livePermit(String(c.contractId), user?.fullName ?? '');
        if (permit) return { contract: fromApiContract(c), permit };
      }
      return active[0] ? { contract: fromApiContract(active[0]), permit: null } : null;
    },
    mock: mockContract ? { contract: mockContract, permit: mockPermit.data ?? null } : null,
  });
}

/** SIDE-06: ask to extend a contract by whole months (sent as days). */
export function useRequestRenewal(contractId: string) {
  return useDualMutation<number, void>({
    live: async (months) => void (await slotsApi.requestRenewal(contractId, months * 30)),
    mock: (months) => {
      const c = useMockDb.getState().contracts.find((x) => x.id === contractId);
      if (c) useMockDb.getState().requestRenewal(contractId, dayjs(c.end_date).add(months, 'month').toISOString());
    },
    invalidate: [['vendor']],
  });
}

/** SIDE-07: hand the slot back early; the permit stops being valid. */
export function useReturnSlot(contractId: string) {
  return useDualMutation<string | null, void>({
    live: async (reason) => void (await slotsApi.cancelContract(contractId, reason)),
    mock: () => useMockDb.getState().returnSlot(contractId),
    invalidate: [['vendor']],
  });
}

/** SIDE-12: offer the contract to another vendor by phone number. */
export function useRequestTransfer(contractId: string) {
  return useDualMutation<string, void>({
    live: async (phone) => void (await slotsApi.requestTransfer(Number(contractId), phoneDigits(phone))),
    mock: (phone) => {
      const user = useAuthStore.getState().user;
      const db = useMockDb.getState();
      const receiver = db.users.find((u) => u.role_code === 'VENDOR' && u.vendorId !== user?.vendorId && phoneDigits(u.phone) === phoneDigits(phone));
      if (!receiver || !user?.vendorId) throw new ApiError('not_found', 404, 'Không tìm thấy hộ kinh doanh với số này');
      db.initiateTransfer(contractId, user.vendorId, phone);
    },
    invalidate: [['vendor']],
  });
}

export type TransferView = { id: string; slotCode: string; status: string; date: string; detail?: string };

/** SIDE-13: transfers offered to me and the ones I offered. */
export function useTransfers() {
  const user = useAuthStore((s) => s.user);
  const db = useMockDb();
  const codeOf = (contractId: string) => db.slots.find((s) => s.id === db.contracts.find((c) => c.id === contractId)?.slotId)?.slot_code ?? '';
  const mine = (phone: string) => phoneDigits(phone) === phoneDigits(user?.phone ?? '');
  const mock = {
    incoming: db.transfers
      .filter((t) => mine(t.toVendorPhone) && t.fromVendorId !== user?.vendorId)
      .map((t): TransferView => ({ id: t.id, slotCode: codeOf(t.contractId), status: t.transfer_status, date: t.requested_at })),
    outgoing: db.transfers
      .filter((t) => t.fromVendorId === user?.vendorId)
      .map((t): TransferView => ({ id: t.id, slotCode: codeOf(t.contractId), status: t.transfer_status, date: t.requested_at, detail: `Cho ${t.toVendorPhone}` })),
  };
  const view = (t: ApiTransfer): TransferView => ({
    id: String(t.transferId),
    slotCode: t.slotCode,
    status: t.transferStatus,
    date: t.initiatedAt,
    detail: `${t.zoneName} · ${dayjs(t.contractEndDate).format('DD/MM/YYYY')}`,
  });
  return useDualQuery({
    key: ['vendor', user?.id, 'transfers'],
    live: async () => {
      const [incoming, outgoing] = await Promise.all([slotsApi.transfers('incoming'), slotsApi.transfers('outgoing')]);
      return { incoming: incoming.map(view), outgoing: outgoing.map(view) };
    },
    mock,
  });
}

export function useAnswerTransfer() {
  return useDualMutation<{ id: string; accept: boolean }, void>({
    live: async ({ id, accept }) => void (accept ? await slotsApi.acceptTransfer(id) : await slotsApi.declineTransfer(id)),
    mock: ({ id, accept }) => {
      const vendorId = useAuthStore.getState().user?.vendorId;
      if (accept && vendorId) useMockDb.getState().acceptTransfer(id, vendorId);
      else useMockDb.getState().reviewTransfer(id, false);
    },
    invalidate: [['vendor']],
  });
}

/** SIDE-11: propose a new slot at a spot; live it must sit inside a street the ward manages. */
export function useProposeSlot() {
  const gate = useMarketplaceGate();
  return useDualMutation<{ street: string; width: number; length: number; timeWindow?: string; lat: number; lng: number; photoUri?: string }, void>({
    live: async ({ width, length, lat, lng, photoUri }) => {
      if (!gate.registrationId) throw new ApiError('domain_rule', 422, 'Cần hồ sơ đăng ký kinh doanh được duyệt trước khi đề xuất ô.');
      if (!photoUri) throw new ApiError('validation_error', 400, 'Cần ảnh chụp vị trí đề xuất.');
      const nearest = (await slotsApi.near(lat, lng, 300))[0];
      if (!nearest) throw new ApiError('domain_rule', 422, 'Vị trí này không nằm trên tuyến phố nào phường đang quản lý.');
      const { fileUrl } = await registrationApi.uploadEvidence(photoUri);
      await slotsApi.proposeSlot({ registrationId: Number(gate.registrationId), zoneId: nearest.zoneId, latitude: lat, longitude: lng, widthMeters: width, lengthMeters: length, proposalPhotoUrl: fileUrl });
    },
    mock: ({ street, width, length, timeWindow, lat, lng }) => {
      const vendorId = useAuthStore.getState().user?.vendorId;
      if (!vendorId) return;
      useMockDb.getState().proposeSlot({
        slot_code: `ĐX-${Math.floor(100 + Math.random() * 900)}`,
        ward_unit_type: 'WARD',
        street,
        size_m2: Math.round(width * length * 10) / 10,
        price_monthly: 0,
        time_window: timeWindow ?? '',
        lat,
        lng,
        proposedByVendorId: vendorId,
      });
    },
    invalidate: [['vendor']],
  });
}
