import type { RoleCode } from '@/core/types/role';

/**
 * Mock domain types. Field names mirror StreetBiz-BE's scaffolded model /
 * column names (see docs/database-reverse-engineering.md) so a real API
 * client can replace `src/mocks` without renaming screen-level props.
 */

export type VendorType = 'FIXED_STOREFRONT' | 'ITINERANT';

export type MockUser = {
  id: string;
  fullName: string;
  phone: string;
  password: string;
  role_code: RoleCode;
  avatarUrl?: string;
  wardUnitType?: string;
  /** AdministrativeUnits.unit_id the account belongs to (UserAccounts.ward_unit_id). */
  wardUnitId?: number;
  vendorId?: string;
  account_status: 'ACTIVE' | 'SUSPENDED';
};

export type AdministrativeUnit = {
  id: string;
  unit_type: string;
  name: string;
};

export type Vendor = {
  id: string;
  userId: string;
  vendor_type: VendorType;
  business_name: string;
  owner_name: string;
  phone: string;
  address?: string;
  ward_unit_type: string;
};

export type EvidenceFile = { type: string; uri: string; label: string };

export type BusinessRegistration = {
  id: string;
  vendorId: string;
  vendor_type: VendorType;
  business_name: string;
  owner_name: string;
  id_number: string;
  address: string;
  ward_unit_type: string;
  registration_status: string;
  submitted_at: string;
  fast_track: boolean;
  evidence: EvidenceFile[];
  review_note?: string;
  ai_flags?: string[];
};

export type SidewalkSlot = {
  id: string;
  slot_code: string;
  ward_unit_type: string;
  street: string;
  size_m2: number;
  price_monthly: number;
  time_window: string;
  lat: number;
  lng: number;
  slot_status: string;
  proposal_review_status?: string;
  proposedByVendorId?: string;
};

export type RentalApplication = {
  id: string;
  vendorId: string;
  slotIds: string[];
  application_type: 'STOREFRONT_ADJACENT' | 'OPEN_SLOT';
  application_status: string;
  submitted_at: string;
};

export type RentalContract = {
  id: string;
  applicationId: string;
  vendorId: string;
  slotId: string;
  start_date: string;
  end_date: string;
  contract_status: string;
  fee_monthly: number;
};

export type DigitalPermit = {
  id: string;
  contractId: string;
  permit_code: string;
  permit_status: string;
  expires_at: string;
};

export type FeeItem = {
  id: string;
  contractId: string;
  vendorId: string;
  period_label: string;
  amount: number;
  due_date: string;
  item_status: string;
};

export type Penalty = {
  id: string;
  vendorId: string;
  violationId?: string;
  reason: string;
  amount: number;
  penalty_status: string;
  issued_at: string;
};

export type Invoice = {
  id: string;
  feeItemId: string;
  vendorId: string;
  invoice_number: string;
  amount: number;
  issued_at: string;
};

export type ViolationType = { code: string; label: string; default_amount: number };

export type Violation = {
  id: string;
  vendorId: string;
  slotId?: string;
  violation_type: string;
  note: string;
  photoUris: string[];
  recorded_at: string;
  reportedBy: 'WARD' | 'CUSTOMER';
};

export type RenewalRequest = {
  id: string;
  contractId: string;
  vendorId: string;
  renewal_status: string;
  requested_at: string;
  new_end_date: string;
};

export type AddressChangeRequest = {
  id: string;
  vendorId: string;
  registrationId: string;
  new_address: string;
  change_status: string;
  requested_at: string;
};

export type SlotTransferRequest = {
  id: string;
  contractId: string;
  fromVendorId: string;
  toVendorPhone: string;
  toVendorId?: string;
  transfer_status: string;
  requested_at: string;
};

export type VendorComment = {
  id: string;
  vendorId: string;
  authorId: string;
  authorName: string;
  rating: number;
  text: string;
  created_at: string;
};

export type VendorReport = {
  id: string;
  vendorId?: string;
  reporterId: string;
  reason: string;
  photoUri?: string;
  report_status: string;
  created_at: string;
};

export type FoodCategory = { id: string; name: string; itemCount: number };

export type AppNotification = {
  id: string;
  userId: string;
  notification_type: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
};

export type UserSession = {
  id: string;
  userId: string;
  device: string;
  location: string;
  last_active: string;
  current: boolean;
};

// Phase 2 ---------------------------------------------------------------

export type Storefront = {
  id: string;
  vendorId: string;
  name: string;
  description: string;
  imageUri?: string;
  openTime: string;
  closeTime: string;
  availability_status: 'OPEN' | 'PAUSED' | 'CLOSED';
  ratingAvg: number;
  ratingCount: number;
};

export type MenuItem = {
  id: string;
  storefrontId: string;
  name: string;
  price: number;
  description: string;
  imageUri?: string;
  categoryId: string;
  availability_status: 'AVAILABLE' | 'SOLD_OUT';
};

export type CartItem = {
  menuItemId: string;
  storefrontId: string;
  quantity: number;
  note?: string;
};

export type OrderItem = { menuItemId: string; name: string; price: number; quantity: number };

export type Order = {
  id: string;
  order_code: string;
  customerId: string;
  storefrontId: string;
  items: OrderItem[];
  total: number;
  order_status: string;
  created_at: string;
  pickup_time?: string;
  note?: string;
  payment_method?: string;
};

export type Review = {
  id: string;
  orderId: string;
  customerId: string;
  storefrontId: string;
  rating: number;
  text: string;
  created_at: string;
  editable_until: string;
};

export type Complaint = {
  id: string;
  orderId: string;
  customerId: string;
  complaint_type: string;
  description: string;
  status: string;
  created_at: string;
};

export type ReportedContent = {
  id: string;
  content_type: 'STOREFRONT' | 'MENU_ITEM' | 'REVIEW';
  targetId: string;
  reason: string;
  status: string;
  created_at: string;
};
