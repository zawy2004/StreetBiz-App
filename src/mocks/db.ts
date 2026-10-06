import { create } from 'zustand';

import { makeId, nowIso } from './ids';
import * as seed from './seed';
import type {
  AddressChangeRequest,
  BusinessRegistration,
  Complaint,
  DigitalPermit,
  FeeItem,
  Invoice,
  MenuItem,
  MockUser,
  Order,
  Penalty,
  RentalApplication,
  RentalContract,
  RenewalRequest,
  ReportedContent,
  Review,
  SidewalkSlot,
  SlotTransferRequest,
  Storefront,
  UserSession,
  Vendor,
  VendorComment,
  VendorReport,
  Violation,
} from './types';

type State = {
  users: MockUser[];
  vendors: Vendor[];
  registrations: BusinessRegistration[];
  slots: SidewalkSlot[];
  applications: RentalApplication[];
  contracts: RentalContract[];
  permits: DigitalPermit[];
  feeItems: FeeItem[];
  penalties: Penalty[];
  invoices: Invoice[];
  violationTypes: typeof seed.VIOLATION_TYPES;
  violations: Violation[];
  renewals: RenewalRequest[];
  addressChanges: AddressChangeRequest[];
  transfers: SlotTransferRequest[];
  comments: VendorComment[];
  reports: VendorReport[];
  notifications: typeof seed.NOTIFICATIONS;
  sessions: UserSession[];
  storefronts: Storefront[];
  menuItems: MenuItem[];
  orders: Order[];
  reviews: Review[];
  complaints: Complaint[];
  reportedContent: ReportedContent[];
  foodCategories: typeof seed.FOOD_CATEGORIES;

  updatePenaltyAmount: (code: string, amount: number) => void;
  registerUser: (u: Omit<MockUser, 'id'>) => MockUser;
  registerVendor: (v: Omit<Vendor, 'id'>) => Vendor;
  updateUserPassword: (id: string, password: string) => void;
  setAccountStatus: (id: string, status: 'ACTIVE' | 'SUSPENDED') => void;

  submitRegistration: (
    r: Omit<BusinessRegistration, 'id' | 'registration_status' | 'submitted_at'>,
  ) => BusinessRegistration;
  updateRegistration: (id: string, patch: Partial<BusinessRegistration>) => void;
  withdrawRegistration: (id: string) => void;
  /** RegistrationReviewScreen's mock-mode decisions (WARD-04/05/06). Live mode decides through
   * WardComplianceController's /ward/enrollments endpoints instead (complianceApi). */
  approveRegistration: (id: string) => void;
  rejectRegistration: (id: string, note: string) => void;
  requestRegistrationEvidence: (id: string, note: string) => void;

  submitRentalApplication: (
    a: Omit<RentalApplication, 'id' | 'application_status' | 'submitted_at'>,
  ) => RentalApplication;
  approveRentalApplication: (id: string) => void;
  rejectRentalApplication: (id: string, note: string) => void;
  cancelRentalApplication: (id: string) => void;

  requestRenewal: (contractId: string, newEndDate: string) => void;
  approveRenewal: (id: string) => void;
  returnSlot: (contractId: string) => void;

  proposeSlot: (
    s: Omit<SidewalkSlot, 'id' | 'slot_status' | 'proposal_review_status'>,
  ) => SidewalkSlot;
  reviewSlotProposal: (id: string, approve: boolean) => void;
  addSlotToGrid: (
    s: Omit<SidewalkSlot, 'id' | 'slot_status' | 'proposal_review_status'>,
  ) => SidewalkSlot;
  updateSlot: (id: string, patch: Partial<SidewalkSlot>) => void;
  removeSlot: (id: string) => void;

  requestAddressChange: (
    r: Omit<AddressChangeRequest, 'id' | 'change_status' | 'requested_at'>,
  ) => void;
  resolveAddressChange: (id: string, approve: boolean) => void;

  initiateTransfer: (contractId: string, fromVendorId: string, toVendorPhone: string) => void;
  acceptTransfer: (id: string, toVendorId: string) => void;
  reviewTransfer: (id: string, approve: boolean) => void;

  payFee: (id: string) => void;
  payPenalty: (id: string) => void;
  recordViolation: (v: Omit<Violation, 'id' | 'recorded_at'>, penaltyAmount?: number) => void;
  suspendPermit: (id: string) => void;
  revokePermit: (id: string) => void;
  reactivatePermit: (id: string) => void;

  addComment: (c: Omit<VendorComment, 'id' | 'created_at'>) => void;
  addReport: (r: Omit<VendorReport, 'id' | 'report_status' | 'created_at'>) => void;
  resolveReport: (id: string) => void;

  markNotificationRead: (id: string) => void;
  revokeSession: (id: string) => void;

  createStorefront: (s: Omit<Storefront, 'id' | 'ratingAvg' | 'ratingCount'>) => Storefront;
  updateStorefront: (id: string, patch: Partial<Storefront>) => void;
  addMenuItem: (m: Omit<MenuItem, 'id'>) => void;
  updateMenuItem: (id: string, patch: Partial<MenuItem>) => void;
  removeMenuItem: (id: string) => void;

  placeOrder: (o: Omit<Order, 'id' | 'order_code' | 'order_status' | 'created_at'>) => Order;
  updateOrderStatus: (id: string, status: string) => void;
  cancelOrder: (id: string) => void;
  addReview: (r: Omit<Review, 'id' | 'created_at' | 'editable_until'>) => void;
  addComplaint: (c: Omit<Complaint, 'id' | 'status' | 'created_at'>) => void;
  resolveComplaint: (id: string) => void;
  reportContent: (r: Omit<ReportedContent, 'id' | 'status' | 'created_at'>) => void;
  moderateContent: (id: string, hide: boolean) => void;

  addFoodCategory: (name: string) => void;
  removeFoodCategory: (id: string) => void;
};

export const useMockDb = create<State>((set, get) => ({
  users: [...seed.USERS],
  vendors: [...seed.VENDORS],
  registrations: [...seed.BUSINESS_REGISTRATIONS],
  slots: [...seed.SIDEWALK_SLOTS],
  applications: [...seed.RENTAL_APPLICATIONS],
  contracts: [...seed.RENTAL_CONTRACTS],
  permits: [...seed.DIGITAL_PERMITS],
  feeItems: [...seed.FEE_ITEMS],
  penalties: [...seed.PENALTIES],
  invoices: [...seed.INVOICES],
  violationTypes: [...seed.VIOLATION_TYPES],
  violations: [...seed.VIOLATIONS],
  renewals: [...seed.RENEWAL_REQUESTS],
  addressChanges: [...seed.ADDRESS_CHANGE_REQUESTS],
  transfers: [...seed.SLOT_TRANSFER_REQUESTS],
  comments: [...seed.VENDOR_COMMENTS],
  reports: [...seed.VENDOR_REPORTS],
  notifications: [...seed.NOTIFICATIONS],
  sessions: [...seed.USER_SESSIONS],
  storefronts: [...seed.STOREFRONTS],
  menuItems: [...seed.MENU_ITEMS],
  orders: [...seed.ORDERS],
  reviews: [...seed.REVIEWS],
  complaints: [...seed.COMPLAINTS],
  reportedContent: [...seed.REPORTED_CONTENT],
  foodCategories: [...seed.FOOD_CATEGORIES],

  updatePenaltyAmount: (code, amount) =>
    set((s) => ({
      violationTypes: s.violationTypes.map((v) =>
        v.code === code ? { ...v, default_amount: amount } : v,
      ),
    })),
  registerUser: (u) => {
    const user: MockUser = { ...u, id: makeId('USR') };
    set((s) => ({ users: [...s.users, user] }));
    return user;
  },
  registerVendor: (v) => {
    const vendor: Vendor = { ...v, id: makeId('VEN') };
    set((s) => ({ vendors: [...s.vendors, vendor] }));
    return vendor;
  },
  updateUserPassword: (id, password) =>
    set((s) => ({ users: s.users.map((u) => (u.id === id ? { ...u, password } : u)) })),
  setAccountStatus: (id, status) =>
    set((s) => ({
      users: s.users.map((u) => (u.id === id ? { ...u, account_status: status } : u)),
    })),

  submitRegistration: (r) => {
    const registration: BusinessRegistration = {
      ...r,
      id: makeId('REG'),
      registration_status: 'UNDER_REVIEW',
      submitted_at: nowIso(),
    };
    set((s) => ({ registrations: [...s.registrations, registration] }));
    return registration;
  },
  updateRegistration: (id, patch) =>
    set((s) => ({
      registrations: s.registrations.map((r) =>
        r.id === id ? { ...r, ...patch, registration_status: 'UNDER_REVIEW' } : r,
      ),
    })),
  withdrawRegistration: (id) =>
    set((s) => ({
      registrations: s.registrations.map((r) =>
        r.id === id ? { ...r, registration_status: 'WITHDRAWN' } : r,
      ),
    })),
  approveRegistration: (id) =>
    set((s) => ({
      registrations: s.registrations.map((r) =>
        r.id === id ? { ...r, registration_status: 'APPROVED' } : r,
      ),
    })),
  rejectRegistration: (id, note) =>
    set((s) => ({
      registrations: s.registrations.map((r) =>
        r.id === id ? { ...r, registration_status: 'REJECTED', review_note: note } : r,
      ),
    })),
  requestRegistrationEvidence: (id, note) =>
    set((s) => ({
      registrations: s.registrations.map((r) =>
        r.id === id ? { ...r, registration_status: 'MORE_INFORMATION_REQUIRED', review_note: note } : r,
      ),
    })),

  submitRentalApplication: (a) => {
    const application: RentalApplication = {
      ...a,
      id: makeId('APP'),
      application_status: 'PENDING',
      submitted_at: nowIso(),
    };
    set((s) => ({
      applications: [...s.applications, application],
      slots: s.slots.map((slot) =>
        a.slotIds.includes(slot.id) ? { ...slot, slot_status: 'PENDING' } : slot,
      ),
    }));
    return application;
  },
  approveRentalApplication: (id) => {
    const application = get().applications.find((a) => a.id === id);
    if (!application) return;
    const slotId = application.slotIds[0];
    if (!slotId) return;
    const slot = get().slots.find((s) => s.id === slotId);
    const start = nowIso();
    const end = new Date(Date.now() + 1000 * 60 * 60 * 24 * 90).toISOString();
    const contract: RentalContract = {
      id: makeId('CON'),
      applicationId: id,
      vendorId: application.vendorId,
      slotId,
      start_date: start,
      end_date: end,
      contract_status: 'ACTIVE',
      fee_monthly: slot?.price_monthly ?? 0,
    };
    const permit: DigitalPermit = {
      id: makeId('PERMIT'),
      contractId: contract.id,
      permit_code: `SB-HC1-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      permit_status: 'VALID',
      expires_at: end,
    };
    // SYS-03: generate the first month's fee item from the contract start date.
    const firstDue = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
    const firstFee: FeeItem = {
      id: makeId('FEE'),
      contractId: contract.id,
      vendorId: application.vendorId,
      period_label: `Tháng ${new Date(start).toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' })}`,
      amount: contract.fee_monthly,
      due_date: firstDue,
      item_status: 'PENDING',
    };
    set((s) => ({
      applications: s.applications.map((a) =>
        a.id === id ? { ...a, application_status: 'APPROVED' } : a,
      ),
      contracts: [...s.contracts, contract],
      feeItems: [...s.feeItems, firstFee],
      permits: [...s.permits, permit],
      slots: s.slots.map((sl) => (sl.id === slotId ? { ...sl, slot_status: 'RENTED' } : sl)),
    }));
  },
  cancelRentalApplication: (id) => {
    const application = get().applications.find((a) => a.id === id);
    set((s) => ({
      applications: s.applications.map((a) => (a.id === id ? { ...a, application_status: 'CANCELLED' } : a)),
      slots: s.slots.map((slot) =>
        application?.slotIds.includes(slot.id) ? { ...slot, slot_status: 'AVAILABLE' } : slot,
      ),
    }));
  },
  rejectRentalApplication: (id, note) => {
    const application = get().applications.find((a) => a.id === id);
    set((s) => ({
      applications: s.applications.map((a) =>
        a.id === id ? { ...a, application_status: 'REJECTED' } : a,
      ),
      slots: s.slots.map((slot) =>
        application?.slotIds.includes(slot.id) ? { ...slot, slot_status: 'AVAILABLE' } : slot,
      ),
    }));
    void note;
  },

  requestRenewal: (contractId, newEndDate) => {
    const contract = get().contracts.find((c) => c.id === contractId);
    if (!contract) return;
    const renewal: RenewalRequest = {
      id: makeId('REN'),
      contractId,
      vendorId: contract.vendorId,
      renewal_status: 'PENDING',
      requested_at: nowIso(),
      new_end_date: newEndDate,
    };
    set((s) => ({ renewals: [...s.renewals, renewal] }));
  },
  approveRenewal: (id) => {
    const renewal = get().renewals.find((r) => r.id === id);
    if (!renewal) return;
    set((s) => ({
      renewals: s.renewals.map((r) => (r.id === id ? { ...r, renewal_status: 'APPROVED' } : r)),
      contracts: s.contracts.map((c) =>
        c.id === renewal.contractId ? { ...c, end_date: renewal.new_end_date } : c,
      ),
      permits: s.permits.map((p) =>
        p.contractId === renewal.contractId ? { ...p, expires_at: renewal.new_end_date } : p,
      ),
    }));
  },
  returnSlot: (contractId) => {
    const contract = get().contracts.find((c) => c.id === contractId);
    if (!contract) return;
    set((s) => ({
      contracts: s.contracts.map((c) =>
        c.id === contractId ? { ...c, contract_status: 'CLOSED' } : c,
      ),
      permits: s.permits.map((p) =>
        p.contractId === contractId ? { ...p, permit_status: 'EXPIRED' } : p,
      ),
      slots: s.slots.map((sl) =>
        sl.id === contract.slotId ? { ...sl, slot_status: 'AVAILABLE' } : sl,
      ),
    }));
  },

  proposeSlot: (data) => {
    const slot: SidewalkSlot = {
      ...data,
      id: makeId('SLOT'),
      slot_status: 'PENDING',
      proposal_review_status: 'PENDING',
    };
    set((s) => ({ slots: [...s.slots, slot] }));
    return slot;
  },
  reviewSlotProposal: (id, approve) =>
    set((s) => ({
      slots: s.slots.map((sl) =>
        sl.id === id
          ? {
              ...sl,
              proposal_review_status: approve ? 'APPROVED' : 'REJECTED',
              slot_status: approve ? 'AVAILABLE' : 'REJECTED',
            }
          : sl,
      ),
    })),

  addSlotToGrid: (data) => {
    const slot: SidewalkSlot = { ...data, id: makeId('SLOT'), slot_status: 'AVAILABLE' };
    set((s) => ({ slots: [...s.slots, slot] }));
    return slot;
  },
  updateSlot: (id, patch) =>
    set((s) => ({ slots: s.slots.map((sl) => (sl.id === id ? { ...sl, ...patch } : sl)) })),
  removeSlot: (id) => set((s) => ({ slots: s.slots.filter((sl) => sl.id !== id) })),

  requestAddressChange: (r) => {
    const request: AddressChangeRequest = {
      ...r,
      id: makeId('ADDR'),
      change_status: 'PENDING',
      requested_at: nowIso(),
    };
    set((s) => ({ addressChanges: [...s.addressChanges, request] }));
  },
  resolveAddressChange: (id, approve) =>
    set((s) => ({
      addressChanges: s.addressChanges.map((r) =>
        r.id === id ? { ...r, change_status: approve ? 'APPROVED' : 'REJECTED' } : r,
      ),
    })),

  initiateTransfer: (contractId, fromVendorId, toVendorPhone) => {
    const transfer: SlotTransferRequest = {
      id: makeId('TRF'),
      contractId,
      fromVendorId,
      toVendorPhone,
      transfer_status: 'PENDING',
      requested_at: nowIso(),
    };
    set((s) => ({ transfers: [...s.transfers, transfer] }));
  },
  acceptTransfer: (id, toVendorId) =>
    set((s) => ({
      transfers: s.transfers.map((t) =>
        t.id === id ? { ...t, toVendorId, transfer_status: 'UNDER_REVIEW' } : t,
      ),
    })),
  reviewTransfer: (id, approve) => {
    const transfer = get().transfers.find((t) => t.id === id);
    if (!transfer) return;
    set((s) => ({
      transfers: s.transfers.map((t) =>
        t.id === id ? { ...t, transfer_status: approve ? 'APPROVED' : 'REJECTED' } : t,
      ),
      contracts:
        approve && transfer.toVendorId
          ? s.contracts.map((c) =>
              c.id === transfer.contractId ? { ...c, vendorId: transfer.toVendorId! } : c,
            )
          : s.contracts,
    }));
  },

  payFee: (id) => {
    const fee = get().feeItems.find((f) => f.id === id);
    if (!fee) return;
    const invoice: Invoice = {
      id: makeId('INV'),
      feeItemId: id,
      vendorId: fee.vendorId,
      invoice_number: `HD-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      amount: fee.amount,
      issued_at: nowIso(),
    };
    set((s) => ({
      feeItems: s.feeItems.map((f) => (f.id === id ? { ...f, item_status: 'PAID' } : f)),
      invoices: [...s.invoices, invoice],
    }));
  },
  payPenalty: (id) =>
    set((s) => ({
      penalties: s.penalties.map((p) => (p.id === id ? { ...p, penalty_status: 'PAID' } : p)),
    })),
  recordViolation: (v, penaltyAmount) => {
    const violation = { ...v, id: makeId('VIO'), recorded_at: nowIso() };
    set((s) => ({
      violations: [...s.violations, violation],
      penalties: penaltyAmount
        ? [
            ...s.penalties,
            {
              id: makeId('PEN'),
              vendorId: v.vendorId,
              violationId: violation.id,
              reason: v.note,
              amount: penaltyAmount,
              penalty_status: 'PENDING',
              issued_at: nowIso(),
            },
          ]
        : s.penalties,
    }));
  },
  suspendPermit: (id) =>
    set((s) => ({
      permits: s.permits.map((p) => (p.id === id ? { ...p, permit_status: 'SUSPENDED' } : p)),
    })),
  revokePermit: (id) =>
    set((s) => ({
      permits: s.permits.map((p) => (p.id === id ? { ...p, permit_status: 'REVOKED' } : p)),
    })),
  reactivatePermit: (id) =>
    set((s) => ({
      permits: s.permits.map((p) => (p.id === id ? { ...p, permit_status: 'VALID' } : p)),
    })),

  addComment: (c) =>
    set((s) => ({ comments: [...s.comments, { ...c, id: makeId('CMT'), created_at: nowIso() }] })),
  addReport: (r) =>
    set((s) => ({
      reports: [
        ...s.reports,
        { ...r, id: makeId('RPT'), report_status: 'PENDING', created_at: nowIso() },
      ],
    })),
  resolveReport: (id) =>
    set((s) => ({
      reports: s.reports.map((r) => (r.id === id ? { ...r, report_status: 'RESOLVED' } : r)),
    })),

  markNotificationRead: (id) =>
    set((s) => ({
      notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    })),
  revokeSession: (id) => set((s) => ({ sessions: s.sessions.filter((sess) => sess.id !== id) })),

  createStorefront: (data) => {
    const storefront: Storefront = { ...data, id: makeId('STORE'), ratingAvg: 0, ratingCount: 0 };
    set((s) => ({ storefronts: [...s.storefronts, storefront] }));
    return storefront;
  },
  updateStorefront: (id, patch) =>
    set((s) => ({
      storefronts: s.storefronts.map((st) => (st.id === id ? { ...st, ...patch } : st)),
    })),
  addMenuItem: (m) => set((s) => ({ menuItems: [...s.menuItems, { ...m, id: makeId('ITEM') }] })),
  updateMenuItem: (id, patch) =>
    set((s) => ({ menuItems: s.menuItems.map((m) => (m.id === id ? { ...m, ...patch } : m)) })),
  removeMenuItem: (id) => set((s) => ({ menuItems: s.menuItems.filter((m) => m.id !== id) })),

  placeOrder: (o) => {
    const order: Order = {
      ...o,
      id: makeId('ORD'),
      order_code: `DH${Math.floor(1000 + Math.random() * 9000)}`,
      order_status: 'PENDING',
      created_at: nowIso(),
    };
    set((s) => ({ orders: [...s.orders, order] }));
    return order;
  },
  updateOrderStatus: (id, status) =>
    set((s) => ({
      orders: s.orders.map((o) => (o.id === id ? { ...o, order_status: status } : o)),
    })),
  cancelOrder: (id) =>
    set((s) => ({
      orders: s.orders.map((o) => (o.id === id ? { ...o, order_status: 'CANCELLED' } : o)),
    })),
  addReview: (r) =>
    set((s) => ({
      reviews: [
        ...s.reviews,
        {
          ...r,
          id: makeId('REV'),
          created_at: nowIso(),
          editable_until: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
        },
      ],
    })),
  addComplaint: (c) =>
    set((s) => ({
      complaints: [
        ...s.complaints,
        { ...c, id: makeId('CPL'), status: 'PENDING', created_at: nowIso() },
      ],
    })),
  resolveComplaint: (id) =>
    set((s) => ({
      complaints: s.complaints.map((c) => (c.id === id ? { ...c, status: 'RESOLVED' } : c)),
    })),
  reportContent: (r) =>
    set((s) => ({
      reportedContent: [
        ...s.reportedContent,
        { ...r, id: makeId('RCT'), status: 'PENDING', created_at: nowIso() },
      ],
    })),
  moderateContent: (id, hide) =>
    set((s) => ({
      reportedContent: s.reportedContent.map((r) =>
        r.id === id ? { ...r, status: hide ? 'HIDDEN' : 'RESOLVED' } : r,
      ),
    })),

  addFoodCategory: (name) =>
    set((s) => ({
      foodCategories: [...s.foodCategories, { id: makeId('CAT'), name, itemCount: 0 }],
    })),
  removeFoodCategory: (id) =>
    set((s) => ({ foodCategories: s.foodCategories.filter((c) => c.id !== id) })),
}));
