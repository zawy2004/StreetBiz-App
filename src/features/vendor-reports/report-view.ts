import type { ReportPriceEvidence, ReportResolution, VendorReportType } from '@/features/vendor-map/community-api';
import type { StatusTone } from '@/theme';
import { formatVietnamDateTime, formatVnd } from '@/utils/format';

/**
 * Words, money and time for citizen reports (BUY-05, BUY-07, WARD-19), shared by the buyer's
 * complaint form, "Phản ánh của tôi" and the ward's screens. Money is whole VND; times are read in
 * Asia/Ho_Chi_Minh (UTC+7, no daylight saving) whatever the phone's own zone.
 */

/** VendorReportRules on the server. */
export const NOTE_MAX = 500;
export const PURCHASE_WINDOW_DAYS = 7;
export const MAX_QUANTITY = 1_000;
export const MAX_AMOUNT = 1_000_000_000;

/** What the buyer picks: the three buttons under a price board. */
export const REPORT_CHOICES: { type: VendorReportType; label: string; note: string; icon: { sf: string; md: string } }[] = [
  { type: 'OVERCHARGE', label: 'Bị tính cao hơn giá niêm yết', note: 'Chọn món, số lượng và số tiền bạn đã trả', icon: { sf: 'banknote.fill', md: 'payments' } },
  { type: 'PRICE_NOT_POSTED', label: 'Quầy không treo bảng giá', note: 'Không thấy bảng giá giấy tại quầy', icon: { sf: 'tag.slash.fill', md: 'money_off' } },
  { type: 'GENERAL', label: 'Phản ánh khác', note: 'Sai vị trí, lấn chiếm, vệ sinh…', icon: { sf: 'exclamationmark.bubble.fill', md: 'feedback' } },
];

/** The type as the ward and the reporter read it in a list. */
export const REPORT_TYPE_LABELS: Record<VendorReportType, string> = {
  OVERCHARGE: 'Bán cao hơn giá niêm yết',
  PRICE_NOT_POSTED: 'Không treo bảng giá',
  GENERAL: 'Phản ánh khác',
};

export const reportTypeLabel = (type: string) => REPORT_TYPE_LABELS[type as VendorReportType] ?? REPORT_TYPE_LABELS.GENERAL;

export const REPORT_TYPE_ICONS: Record<VendorReportType, { sf: string; md: string }> = {
  OVERCHARGE: { sf: 'banknote.fill', md: 'payments' },
  PRICE_NOT_POSTED: { sf: 'tag.slash.fill', md: 'money_off' },
  GENERAL: { sf: 'exclamationmark.bubble.fill', md: 'feedback' },
};

export const isReportType = (value: string | undefined): value is VendorReportType =>
  value === 'GENERAL' || value === 'OVERCHARGE' || value === 'PRICE_NOT_POSTED';

/** Where a report stands, in words and a tone (never colour alone). */
export function reportStatusLabel(report: { status: string; resolution?: ReportResolution | string | null; isOverdue?: boolean }): { label: string; tone: StatusTone } {
  if (report.status === 'PENDING') return report.isOverdue ? { label: 'Quá hạn xử lý', tone: 'danger' } : { label: 'Chờ phường xử lý', tone: 'pending' };
  if (report.status === 'DISMISSED') return { label: 'Đã bác', tone: 'neutral' };
  if (report.resolution === 'MEDIATED') return { label: 'Đã hòa giải', tone: 'ok' };
  if (report.resolution === 'VIOLATION_RECORDED') return { label: 'Đã lập biên bản', tone: 'ok' };
  return { label: 'Đã xem xét', tone: 'ok' };
}

export type OverchargeMath = {
  /** Posted unit price × quantity; null until a dish is chosen. */
  posted: number | null;
  /** Charged − posted; null until both are known. */
  difference: number | null;
  /** True only when the amount charged is above the posted amount: the one case this type is for. */
  above: boolean;
};

/** The figures the form shows as the buyer types. The server recomputes them at the purchase time. */
export function overchargeMath(unitPrice: number | null | undefined, quantity: number, charged: number | null | undefined): OverchargeMath {
  const posted = unitPrice != null && Number.isSafeInteger(quantity) && quantity > 0 ? unitPrice * quantity : null;
  const difference = posted != null && charged != null && Number.isFinite(charged) ? charged - posted : null;
  return { posted, difference, above: difference != null && difference > 0 };
}

/** Adds a quick phrase to what was typed ("Bán sai vị trí, lấn chiếm lối đi"). */
export const appendPhrase = (current: string, phrase: string) => (current.trim() ? `${current.trim().replace(/[.,]$/, '')}, ${phrase.toLowerCase()}` : phrase);

/** Digits typed into a money or count field, as a whole number (null when empty). */
export function wholeNumber(textValue: string): number | null {
  const digits = textValue.replace(/[^0-9]/g, '');
  if (!digits) return null;
  const n = Number(digits);
  return Number.isSafeInteger(n) ? n : null;
}

// ---- Purchase time, in Đà Nẵng's clock ----

const VN_OFFSET_MS = 7 * 3_600_000;
const DAY_MS = 86_400_000;
const pad = (n: number) => String(n).padStart(2, '0');

/** When the buyer paid: a day within the window and a time of day, both on the Vietnamese clock. */
export type PurchaseMoment = { daysAgo: number; hour: number; minute: number };

/** Now, on the Vietnamese clock (the form's default). */
export function nowMoment(now: number = Date.now()): PurchaseMoment {
  const vn = new Date(now + VN_OFFSET_MS);
  return { daysAgo: 0, hour: vn.getUTCHours(), minute: vn.getUTCMinutes() };
}

/** The instant of a moment, counted from today's midnight in Asia/Ho_Chi_Minh. */
export function purchaseInstant(moment: PurchaseMoment, now: number = Date.now()): number {
  const vn = new Date(now + VN_OFFSET_MS);
  const midnight = Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate()) - VN_OFFSET_MS;
  return midnight - moment.daysAgo * DAY_MS + (moment.hour * 60 + moment.minute) * 60_000;
}

/** `2026-10-23T12:05:00+07:00`: what the API takes as `purchasedAt`. */
export function purchaseIso(moment: PurchaseMoment, now: number = Date.now()): string {
  const vn = new Date(purchaseInstant(moment, now) + VN_OFFSET_MS);
  return `${vn.getUTCFullYear()}-${pad(vn.getUTCMonth() + 1)}-${pad(vn.getUTCDate())}T${pad(vn.getUTCHours())}:${pad(vn.getUTCMinutes())}:00+07:00`;
}

/** Why a purchase time cannot be sent, or null: not in the future, not before the 7-day window. */
export function purchaseProblem(moment: PurchaseMoment, now: number = Date.now()): string | null {
  const at = purchaseInstant(moment, now);
  // Minutes only: "now" typed a few seconds after the clock turned is still now.
  if (at > now + 60_000) return 'Giờ mua không được sau thời điểm hiện tại.';
  if (at < now - PURCHASE_WINDOW_DAYS * DAY_MS) return `Chỉ phản ánh được lần mua trong ${PURCHASE_WINDOW_DAYS} ngày gần nhất.`;
  return null;
}

const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

/** The days the buyer may pick: today and the six before it, labelled on the Vietnamese calendar. */
export function purchaseDays(now: number = Date.now()): { daysAgo: number; label: string; accessibilityLabel: string }[] {
  return Array.from({ length: PURCHASE_WINDOW_DAYS }, (_, daysAgo) => {
    const vn = new Date(now + VN_OFFSET_MS - daysAgo * DAY_MS);
    const date = `${pad(vn.getUTCDate())}/${pad(vn.getUTCMonth() + 1)}`;
    const label = daysAgo === 0 ? 'Hôm nay' : daysAgo === 1 ? 'Hôm qua' : `${WEEKDAYS[vn.getUTCDay()]} ${date}`;
    return { daysAgo, label, accessibilityLabel: daysAgo < 2 ? `${label}, ${date}` : label };
  });
}

export const timeOfDay = (moment: PurchaseMoment) => `${pad(moment.hour)}:${pad(moment.minute)}`;

// ---- The ward's decision ----

/**
 * The biên bản's description when it is raised from a report (WARD-19): what the citizen reported
 * and, for an overcharge, the server's price evidence. The officer reads and edits it before saving.
 */
export function violationDescriptionFromReport(report: {
  reportId: number;
  reportType: string;
  reason: string;
  createdAt: string;
  priceEvidence: ReportPriceEvidence | null;
}): string {
  const head = `Theo phản ánh #${report.reportId} của người dân (${reportTypeLabel(report.reportType)}, gửi ${formatVietnamDateTime(report.createdAt)})`;
  const e = report.priceEvidence;
  if (!e) return `${head}: ${report.reason.trim()}`;
  return (
    `${head}: bán ${e.quantity} ${e.priceUnit} ${e.itemName} giá ${formatVnd(e.chargedAmount)}, ` +
    `cao hơn giá niêm yết ${formatVnd(e.postedAmount)} (bảng giá bản số ${e.priceVersion}) là ${formatVnd(e.difference)}, ` +
    `lúc ${formatVietnamDateTime(e.purchasedAt)}. ${report.reason.trim()}`
  ).trim();
}

export type ResolveChoice = 'DISMISSED' | 'MEDIATED';
export type ResolveErrors = { note?: string; refund?: string };

/**
 * Checks the officer's closing before it is sent (the server checks again): a reason for "Bác",
 * which the reporter will read; a note for "Đã hòa giải", with an optional whole-VND refund that
 * is never above what the buyer was charged.
 */
export function resolveErrors(outcome: ResolveChoice, note: string, refundText: string, chargedAmount: number | null | undefined): ResolveErrors {
  const errors: ResolveErrors = {};
  const trimmed = note.trim();
  if (!trimmed) errors.note = outcome === 'DISMISSED' ? 'Nhập lý do bác. Người phản ánh sẽ đọc lý do này.' : 'Nhập ghi chú hòa giải.';
  else if (trimmed.length > NOTE_MAX) errors.note = `Tối đa ${NOTE_MAX} ký tự.`;
  if (outcome === 'MEDIATED' && refundText.trim()) {
    const refund = /^\d+$/.test(refundText.trim()) ? Number(refundText.trim()) : NaN;
    if (!Number.isSafeInteger(refund) || refund > MAX_AMOUNT) errors.refund = 'Số tiền hoàn là số nguyên VND không âm.';
    else if (chargedAmount != null && refund > chargedAmount) errors.refund = `Không được vượt số tiền khách bị tính (${chargedAmount.toLocaleString('vi-VN')} đ).`;
  }
  return errors;
}

// ---- Đà Nẵng's 1022 ----

/** "(0236) 1022" from "02361022"; any other number as it is. */
export function feedbackPhoneLabel(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, '');
  return digits.startsWith('0236') && digits.length > 4 ? `(0236) ${digits.slice(4)}` : phone;
}

/** "gopy.danang.gov.vn" from its https address. */
export const feedbackSiteLabel = (url: string) => url.replace(/^https?:\/\//i, '').replace(/\/$/, '');
