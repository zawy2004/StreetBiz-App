import { reserveId } from './ids';
import type {
  AddressChangeRequest,
  AdministrativeUnit,
  AppNotification,
  BusinessRegistration,
  Complaint,
  DigitalPermit,
  FeeItem,
  FoodCategory,
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
  ViolationType,
} from './types';

export const WARD: AdministrativeUnit = {
  id: 'WARD-HC1',
  unit_type: 'Phường Hải Châu 1',
  name: 'Phường Hải Châu 1, Đà Nẵng',
};

export const USERS: MockUser[] = [
  {
    id: 'USR-CUS',
    fullName: 'Trần Hồng Anh',
    phone: '0905000001',
    password: '123456',
    role_code: 'CUSTOMER',
    account_status: 'ACTIVE',
  },
  {
    id: 'USR-VEN-1',
    fullName: 'Nguyễn Thị Hoa',
    phone: '0905000002',
    password: '123456',
    role_code: 'VENDOR',
    vendorId: 'VEN-001',
    account_status: 'ACTIVE',
  },
  {
    id: 'USR-VEN-2',
    fullName: 'Lê Văn Minh',
    phone: '0905000003',
    password: '123456',
    role_code: 'VENDOR',
    vendorId: 'VEN-002',
    account_status: 'ACTIVE',
  },
  {
    id: 'USR-WARD',
    fullName: 'Phạm Văn Sơn',
    phone: '0905000004',
    password: '123456',
    role_code: 'WARD_AUTHORITY',
    wardUnitType: WARD.unit_type,
    account_status: 'ACTIVE',
  },
  {
    id: 'USR-ADM',
    fullName: 'Đỗ Quốc Anh',
    phone: '0905000005',
    password: '123456',
    role_code: 'PLATFORM_ADMIN',
    account_status: 'ACTIVE',
  },
];

export const VENDORS: Vendor[] = [
  {
    id: 'VEN-001',
    userId: 'USR-VEN-1',
    vendor_type: 'ITINERANT',
    business_name: 'Xôi gà Bà Năm',
    owner_name: 'Nguyễn Thị Hoa',
    phone: '0905000002',
    ward_unit_type: WARD.unit_type,
  },
  {
    id: 'VEN-002',
    userId: 'USR-VEN-2',
    vendor_type: 'FIXED_STOREFRONT',
    business_name: 'Bánh mì Hội An',
    owner_name: 'Lê Văn Minh',
    phone: '0905000003',
    address: '112 Nguyễn Văn Linh, P. Hải Châu 1',
    ward_unit_type: WARD.unit_type,
  },
  {
    id: 'VEN-003',
    userId: 'USR-VEN-3',
    vendor_type: 'ITINERANT',
    business_name: 'Bún chả cá Bà Phiến',
    owner_name: 'Trần Thị Phiến',
    phone: '0905000011',
    ward_unit_type: WARD.unit_type,
  },
  {
    id: 'VEN-004',
    userId: 'USR-VEN-4',
    vendor_type: 'ITINERANT',
    business_name: 'Cà phê vỉa hè Chú Long',
    owner_name: 'Phạm Văn Long',
    phone: '0905000012',
    ward_unit_type: WARD.unit_type,
  },
];

export const BUSINESS_REGISTRATIONS: BusinessRegistration[] = [
  {
    id: 'REG-001',
    vendorId: 'VEN-001',
    vendor_type: 'ITINERANT',
    business_name: 'Xôi gà Bà Năm',
    owner_name: 'Nguyễn Thị Hoa',
    id_number: '048099000111',
    address: 'Lưu trú tại P. Hải Châu 1',
    ward_unit_type: WARD.unit_type,
    registration_status: 'APPROVED',
    submitted_at: '2026-08-01T08:00:00.000Z',
    fast_track: false,
    evidence: [{ type: 'ID_CARD', uri: '', label: 'CCCD gắn chip' }],
  },
  {
    id: 'REG-002',
    vendorId: 'VEN-002',
    vendor_type: 'FIXED_STOREFRONT',
    business_name: 'Bánh mì Hội An',
    owner_name: 'Lê Văn Minh',
    id_number: '048099000222',
    address: '112 Nguyễn Văn Linh, P. Hải Châu 1',
    ward_unit_type: WARD.unit_type,
    registration_status: 'APPROVED',
    submitted_at: '2026-09-10T08:00:00.000Z',
    fast_track: true,
    evidence: [
      { type: 'ID_CARD', uri: '', label: 'CCCD gắn chip' },
      { type: 'BUSINESS_LICENCE', uri: '', label: 'Giấy phép kinh doanh hộ cá thể' },
    ],
    ai_flags: [],
  },
];

export const SIDEWALK_SLOTS: SidewalkSlot[] = [
  {
    id: 'SLOT-022',
    slot_code: 'NVL-022',
    ward_unit_type: WARD.unit_type,
    street: 'Nguyễn Văn Linh',
    size_m2: 3.75,
    price_monthly: 450000,
    time_window: '05:30 - 10:30',
    lat: 16.0601,
    lng: 108.2198,
    slot_status: 'RENTED',
  },
  {
    id: 'SLOT-023',
    slot_code: 'NVL-023',
    ward_unit_type: WARD.unit_type,
    street: 'Nguyễn Văn Linh',
    size_m2: 3.0,
    price_monthly: 400000,
    time_window: '05:30 - 10:30',
    lat: 16.0602,
    lng: 108.2199,
    slot_status: 'AVAILABLE',
  },
  {
    id: 'SLOT-024',
    slot_code: 'NVL-024',
    ward_unit_type: WARD.unit_type,
    street: 'Nguyễn Văn Linh',
    size_m2: 3.0,
    price_monthly: 450000,
    time_window: '06:00 - 10:30',
    lat: 16.0603,
    lng: 108.22,
    slot_status: 'RENTED',
  },
  {
    id: 'SLOT-025',
    slot_code: 'NVL-025',
    ward_unit_type: WARD.unit_type,
    street: 'Nguyễn Văn Linh',
    size_m2: 2.5,
    price_monthly: 350000,
    time_window: '05:30 - 10:30',
    lat: 16.0604,
    lng: 108.2201,
    slot_status: 'AVAILABLE',
  },
  {
    id: 'SLOT-026',
    slot_code: 'NVL-026',
    ward_unit_type: WARD.unit_type,
    street: 'Nguyễn Văn Linh',
    size_m2: 1.5,
    price_monthly: 300000,
    time_window: '05:30 - 10:30',
    lat: 16.0605,
    lng: 108.2202,
    slot_status: 'RENTED',
  },
  {
    id: 'SLOT-027',
    slot_code: 'NVL-027',
    ward_unit_type: WARD.unit_type,
    street: 'Nguyễn Văn Linh',
    size_m2: 2.0,
    price_monthly: 350000,
    time_window: '05:30 - 10:30',
    lat: 16.0606,
    lng: 108.2203,
    slot_status: 'AVAILABLE',
  },
  {
    id: 'SLOT-018',
    slot_code: 'NVL-018',
    ward_unit_type: WARD.unit_type,
    street: 'Nguyễn Văn Linh',
    size_m2: 3.0,
    price_monthly: 400000,
    time_window: '10:00 - 14:00',
    lat: 16.0599,
    lng: 108.2196,
    slot_status: 'RENTED',
  },
  {
    id: 'SLOT-030',
    slot_code: 'NVL-030',
    ward_unit_type: WARD.unit_type,
    street: 'Nguyễn Văn Linh',
    size_m2: 2.5,
    price_monthly: 350000,
    time_window: '16:00 - 22:00',
    lat: 16.061,
    lng: 108.2207,
    slot_status: 'RENTED',
  },
];

export const RENTAL_APPLICATIONS: RentalApplication[] = [
  {
    id: 'APP-001',
    vendorId: 'VEN-001',
    slotIds: ['SLOT-022'],
    application_type: 'OPEN_SLOT',
    application_status: 'APPROVED',
    submitted_at: '2026-08-05T08:00:00.000Z',
  },
  {
    id: 'APP-002',
    vendorId: 'VEN-002',
    slotIds: ['SLOT-024'],
    application_type: 'STOREFRONT_ADJACENT',
    application_status: 'APPROVED',
    submitted_at: '2026-09-12T08:00:00.000Z',
  },
  {
    id: 'APP-003',
    vendorId: 'VEN-003',
    slotIds: ['SLOT-018'],
    application_type: 'OPEN_SLOT',
    application_status: 'APPROVED',
    submitted_at: '2026-08-10T08:00:00.000Z',
  },
  {
    id: 'APP-004',
    vendorId: 'VEN-004',
    slotIds: ['SLOT-030'],
    application_type: 'OPEN_SLOT',
    application_status: 'APPROVED',
    submitted_at: '2026-08-12T08:00:00.000Z',
  },
];

export const RENTAL_CONTRACTS: RentalContract[] = [
  {
    id: 'CON-001',
    applicationId: 'APP-001',
    vendorId: 'VEN-001',
    slotId: 'SLOT-022',
    start_date: '2026-08-06T00:00:00.000Z',
    end_date: '2026-12-31T00:00:00.000Z',
    contract_status: 'ACTIVE',
    fee_monthly: 450000,
  },
  {
    id: 'CON-002',
    applicationId: 'APP-002',
    vendorId: 'VEN-002',
    slotId: 'SLOT-024',
    start_date: '2026-09-15T00:00:00.000Z',
    end_date: '2026-12-31T00:00:00.000Z',
    contract_status: 'ACTIVE',
    fee_monthly: 450000,
  },
  {
    id: 'CON-003',
    applicationId: 'APP-003',
    vendorId: 'VEN-003',
    slotId: 'SLOT-018',
    start_date: '2026-08-15T00:00:00.000Z',
    end_date: '2026-12-31T00:00:00.000Z',
    contract_status: 'ACTIVE',
    fee_monthly: 400000,
  },
  {
    id: 'CON-004',
    applicationId: 'APP-004',
    vendorId: 'VEN-004',
    slotId: 'SLOT-030',
    start_date: '2026-08-15T00:00:00.000Z',
    end_date: '2026-12-31T00:00:00.000Z',
    contract_status: 'ACTIVE',
    fee_monthly: 350000,
  },
];

export const DIGITAL_PERMITS: DigitalPermit[] = [
  {
    id: 'PERMIT-001',
    contractId: 'CON-001',
    permit_code: 'SB-HC1-2026-0815',
    permit_status: 'VALID',
    expires_at: '2026-12-31T00:00:00.000Z',
  },
  { id: 'PERMIT-002', contractId: 'CON-002', permit_code: 'SB-HC1-2026-0816', permit_status: 'VALID', expires_at: '2026-12-31T00:00:00.000Z' },
  { id: 'PERMIT-003', contractId: 'CON-003', permit_code: 'SB-HC1-2026-0817', permit_status: 'VALID', expires_at: '2026-12-31T00:00:00.000Z' },
  { id: 'PERMIT-004', contractId: 'CON-004', permit_code: 'SB-HC1-2026-0818', permit_status: 'VALID', expires_at: '2026-12-31T00:00:00.000Z' },
];

export const FEE_ITEMS: FeeItem[] = [
  {
    id: 'FEE-001',
    contractId: 'CON-001',
    vendorId: 'VEN-001',
    period_label: 'Tháng 09/2026',
    amount: 450000,
    due_date: '2026-09-15T00:00:00.000Z',
    item_status: 'PENDING',
  },
  {
    id: 'FEE-002',
    contractId: 'CON-001',
    vendorId: 'VEN-001',
    period_label: 'Tháng 08/2026',
    amount: 450000,
    due_date: '2026-08-15T00:00:00.000Z',
    item_status: 'PAID',
  },
];

export const VIOLATION_TYPES: ViolationType[] = [
  { code: 'OVER_BOUNDARY', label: 'Bày hàng vượt vạch quy định', default_amount: 300000 },
  { code: 'BLOCK_WALKWAY', label: 'Cản trở lối đi bộ', default_amount: 400000 },
  { code: 'NO_PERMIT', label: 'Kinh doanh không phép', default_amount: 600000 },
];

export const PENALTIES: Penalty[] = [
  {
    id: 'PEN-001',
    vendorId: 'VEN-001',
    reason: 'Bày biện bàn ghế vượt quá vạch sơn quy định 0.4m',
    amount: 300000,
    penalty_status: 'PENDING',
    issued_at: '2026-09-14T08:30:00.000Z',
  },
];

export const INVOICES: Invoice[] = [
  {
    id: 'INV-001',
    feeItemId: 'FEE-002',
    vendorId: 'VEN-001',
    invoice_number: 'HD-2026-0812',
    amount: 450000,
    issued_at: '2026-08-15T00:05:00.000Z',
  },
];

export const VIOLATIONS: Violation[] = [
  {
    id: 'VIO-001',
    vendorId: 'VEN-001',
    slotId: 'SLOT-022',
    violation_type: 'OVER_BOUNDARY',
    note: 'Bày biện bàn ghế vượt quá vạch sơn quy định 0.4m về phía lòng hè đi bộ.',
    photoUris: [],
    recorded_at: '2026-09-14T08:30:00.000Z',
    reportedBy: 'WARD',
  },
];

export const RENEWAL_REQUESTS: RenewalRequest[] = [];

export const ADDRESS_CHANGE_REQUESTS: AddressChangeRequest[] = [];

export const SLOT_TRANSFER_REQUESTS: SlotTransferRequest[] = [];

export const VENDOR_COMMENTS: VendorComment[] = [
  {
    id: 'CMT-001',
    vendorId: 'VEN-001',
    authorId: 'USR-CUS',
    authorName: 'Trần Hồng Anh',
    rating: 5,
    text: 'Xôi gà ngon, cô Năm bán đúng chỗ có phép, yên tâm mua.',
    created_at: '2026-09-10T07:00:00.000Z',
  },
];

export const VENDOR_REPORTS: VendorReport[] = [];

export const FOOD_CATEGORIES: FoodCategory[] = [
  { id: 'CAT-01', name: 'Bánh mì', itemCount: 34 },
  { id: 'CAT-02', name: 'Cà phê / Trà', itemCount: 58 },
  { id: 'CAT-03', name: 'Nước mát / Nước mía', itemCount: 42 },
  { id: 'CAT-04', name: 'Ăn vặt (Bánh tráng, Hồ lô)', itemCount: 29 },
  { id: 'CAT-05', name: 'Xôi / Cơm', itemCount: 21 },
];

export const NOTIFICATIONS: AppNotification[] = [
  {
    id: 'NOTI-001',
    userId: 'USR-VEN-1',
    notification_type: 'FEE_DUE',
    title: 'Phí thuê ô sắp đến hạn',
    body: 'Ô NVL-022 cần thanh toán 450.000đ trước 15/09/2026.',
    read: false,
    created_at: '2026-09-12T08:00:00.000Z',
  },
  {
    id: 'NOTI-002',
    userId: 'USR-VEN-1',
    notification_type: 'NEW_ORDER',
    title: 'Có đơn mới',
    body: 'Đơn DH1001 · 2 phần xôi gà xé đang chờ quán xác nhận.',
    read: false,
    created_at: '2026-09-15T06:40:00.000Z',
  },
  {
    id: 'NOTI-003',
    userId: 'USR-CUS',
    notification_type: 'ORDER_PLACED',
    title: 'Đã gửi đơn DH1001',
    body: 'Xôi gà Bà Năm sẽ báo khi món sẵn sàng để bạn tới lấy.',
    read: false,
    created_at: '2026-09-15T06:40:00.000Z',
  },
  {
    id: 'NOTI-004',
    userId: 'USR-CUS',
    notification_type: 'REVIEW_REMINDER',
    title: 'Món hôm qua thế nào?',
    body: 'Đánh giá đơn DH1002 để giúp người mua khác chọn quán.',
    read: true,
    created_at: '2026-09-14T12:00:00.000Z',
  },
];

export const USER_SESSIONS: UserSession[] = [
  {
    id: 'SES-001',
    userId: 'USR-VEN-1',
    device: 'Chrome trên Windows',
    location: 'Đà Nẵng, Việt Nam',
    last_active: '2026-09-15T07:00:00.000Z',
    current: true,
  },
];

// Phase 2 -----------------------------------------------------------------

export const STOREFRONTS: Storefront[] = [
  {
    id: 'STORE-001',
    vendorId: 'VEN-001',
    name: 'Xôi gà Bà Năm',
    description: 'Xôi gà xé, xôi mặn kiểu Đà Nẵng, bán từ 5h30 sáng.',
    openTime: '05:30',
    closeTime: '09:30',
    availability_status: 'OPEN',
    ratingAvg: 4.8,
    ratingCount: 85,
  },
  {
    id: 'STORE-002',
    vendorId: 'VEN-002',
    name: 'Bánh mì Hội An',
    description: 'Bánh mì giòn rụm, pa-tê tự làm gia truyền.',
    openTime: '06:00',
    closeTime: '20:00',
    availability_status: 'OPEN',
    ratingAvg: 4.7,
    ratingCount: 64,
  },
  {
    id: 'STORE-003',
    vendorId: 'VEN-003',
    name: 'Bún chả cá Bà Phiến',
    description: 'Bún chả cá nước dùng ngọt thanh, cá tươi mỗi ngày.',
    openTime: '10:00',
    closeTime: '14:00',
    availability_status: 'OPEN',
    ratingAvg: 4.6,
    ratingCount: 41,
  },
  {
    id: 'STORE-004',
    vendorId: 'VEN-004',
    name: 'Cà phê vỉa hè Chú Long',
    description: 'Cà phê phin truyền thống, bạc xỉu, trà đá.',
    openTime: '16:00',
    closeTime: '22:00',
    availability_status: 'OPEN',
    ratingAvg: 4.5,
    ratingCount: 29,
  },
];

export const MENU_ITEMS: MenuItem[] = [
  {
    id: 'ITEM-001',
    storefrontId: 'STORE-001',
    name: 'Xôi gà xé',
    price: 25000,
    description: 'Xôi nếp dẻo, gà xé, hành phi, ruốc.',
    categoryId: 'CAT-05',
    availability_status: 'AVAILABLE',
  },
  {
    id: 'ITEM-002',
    storefrontId: 'STORE-001',
    name: 'Xôi mặn thập cẩm',
    price: 30000,
    description: 'Xôi, chả, trứng cút, lạp xưởng.',
    categoryId: 'CAT-05',
    availability_status: 'AVAILABLE',
  },
  { id: 'ITEM-003', storefrontId: 'STORE-002', name: 'Bánh mì thịt nướng', price: 25000, description: 'Thịt nướng sả, rau thơm, nước sốt đặc biệt.', categoryId: 'CAT-01', availability_status: 'AVAILABLE' },
  { id: 'ITEM-004', storefrontId: 'STORE-002', name: 'Bánh mì pa-tê', price: 20000, description: 'Pa-tê gan tự làm, dưa leo, ngò.', categoryId: 'CAT-01', availability_status: 'AVAILABLE' },
  { id: 'ITEM-005', storefrontId: 'STORE-002', name: 'Cà phê sữa đá', price: 15000, description: 'Cà phê phin pha sữa đặc.', categoryId: 'CAT-02', availability_status: 'SOLD_OUT' },
  { id: 'ITEM-006', storefrontId: 'STORE-003', name: 'Bún chả cá', price: 35000, description: 'Chả cá chiên, nước dùng cà chua, rau sống.', categoryId: 'CAT-04', availability_status: 'AVAILABLE' },
  { id: 'ITEM-007', storefrontId: 'STORE-003', name: 'Bún chả cá đặc biệt', price: 45000, description: 'Thêm giò, chả cá và nem.', categoryId: 'CAT-04', availability_status: 'AVAILABLE' },
  { id: 'ITEM-008', storefrontId: 'STORE-004', name: 'Cà phê đen đá', price: 12000, description: 'Cà phê phin đậm vị.', categoryId: 'CAT-02', availability_status: 'AVAILABLE' },
  { id: 'ITEM-009', storefrontId: 'STORE-004', name: 'Bạc xỉu', price: 18000, description: 'Nhiều sữa, ít cà phê.', categoryId: 'CAT-02', availability_status: 'AVAILABLE' },
];

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

export const ORDERS: Order[] = [
  {
    id: 'ORD-001',
    order_code: 'DH1001',
    customerId: 'USR-CUS',
    storefrontId: 'STORE-001',
    items: [{ menuItemId: 'ITEM-001', name: 'Xôi gà xé', price: 25000, quantity: 2 }],
    total: 50000,
    order_status: 'PLACED',
    created_at: hoursAgo(0.2),
    pickup_time: '07:30',
  },
  {
    id: 'ORD-002',
    order_code: 'DH1002',
    customerId: 'USR-CUS',
    storefrontId: 'STORE-001',
    items: [
      { menuItemId: 'ITEM-002', name: 'Xôi mặn thập cẩm', price: 30000, quantity: 1 },
      { menuItemId: 'ITEM-001', name: 'Xôi gà xé', price: 25000, quantity: 1 },
    ],
    total: 55000,
    order_status: 'COMPLETED',
    created_at: hoursAgo(2),
    pickup_time: '06:30',
  },
  {
    id: 'ORD-003',
    order_code: 'DH1003',
    customerId: 'USR-CUS',
    storefrontId: 'STORE-001',
    items: [{ menuItemId: 'ITEM-001', name: 'Xôi gà xé', price: 25000, quantity: 3 }],
    total: 75000,
    order_status: 'COMPLETED',
    created_at: hoursAgo(30),
    pickup_time: '06:00',
  },
];
export const REVIEWS: Review[] = [];
export const COMPLAINTS: Complaint[] = [];
export const REPORTED_CONTENT: ReportedContent[] = [];

// Reserve every hardcoded seed id (REG-002, CON-001, ...) so makeId() below
// never reissues one — see the collision this caught in tests/features/mock-db.test.ts.
[
  ...USERS,
  ...VENDORS,
  ...BUSINESS_REGISTRATIONS,
  ...SIDEWALK_SLOTS,
  ...RENTAL_APPLICATIONS,
  ...RENTAL_CONTRACTS,
  ...DIGITAL_PERMITS,
  ...FEE_ITEMS,
  ...PENALTIES,
  ...INVOICES,
  ...VIOLATIONS,
  ...VENDOR_COMMENTS,
  ...VENDOR_REPORTS,
  ...FOOD_CATEGORIES,
  ...NOTIFICATIONS,
  ...USER_SESSIONS,
  ...STOREFRONTS,
  ...MENU_ITEMS,
  ...ORDERS,
  ...REVIEWS,
  ...COMPLAINTS,
  ...REPORTED_CONTENT,
].forEach((entity) => reserveId(entity.id));
