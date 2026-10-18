import type { RoleCode } from '@/core/types/role';

import type { NotificationItem } from './notifications-api';

/*
 * Who receives what (from the StreetBiz-BE writers of the Notifications table).
 *
 * VENDOR
 *   ORDER                     ORDER / OrderArrival           new paid order, buyer cancelled, buyer arrived
 *   FEE                       FeeScheduleItem                due soon, overdue, paid, adjusted, waived
 *                             RentalContract                 fees closed at contract end, deposit refunded, ward reminder
 *                             PaymentTransaction             duplicate payment refunded
 *   PENALTY, PENALTY_OVERDUE  Penalty                        paid, waived, still unpaid
 *   PENALTY_SANCTION_ISSUED   Violation                      sanction decision issued
 *   ENROLLMENT_STATUS_UPDATE  BusinessRegistration           registration reviewed
 *   PERMIT_ISSUED             RentalContract                 application approved, permit issued
 *   PERMIT_APPLICATION_REJECTED RentalApplication            application rejected
 *   PERMIT_STATUS_SUSPENDED   DigitalPermit                  permit suspended or revoked
 *   RENEWAL_APPROVED/REJECTED RenewalRequest                 renewal reviewed
 *   WARD_REVIEW               proposals / conflicts / transfers   ward decided a slot case
 *   SLOT_PRICE_CHANGED        SidewalkSlot                   price of a slot the vendor applied for
 *   ZONE_*_CHANGED            PricingZone                    price, fees or hours of the vendor's zone
 *   FOOD_SAFETY               food-safety                    food-safety application reviewed
 *   CONTENT_MODERATION        ReportedContent                the vendor's menu item or storefront was hidden
 * CUSTOMER
 *   ORDER                     ORDER / OrderArrivalAck        payment, accepted, ready, completed, cancelled
 *   ORDER_COMPLAINT           Complaint                      complaint resolved
 *   CONTENT_MODERATION        ReportedContent                the customer's report closed, or their review hidden
 * WARD_AUTHORITY
 *   WARD_REVIEW               REGISTRATION                   a filing waits for review (demo seed only;
 *                                                            no BE workflow notifies the ward yet)
 * EVERY ROLE (PLATFORM_ADMIN receives only this)
 *   SECURITY_ALERT            UserAccount                    sign-in from a new device, password changed
 *
 * The demo seed names entities in capitals (REGISTRATION, CONTRACT, PENALTY);
 * the workflows write BusinessRegistration, RentalContract, Penalty. Both are read.
 */

const ENTITY_ALIASES: Record<string, string> = {
  REGISTRATION: 'BusinessRegistration',
  CONTRACT: 'RentalContract',
  PENALTY: 'Penalty',
  VIOLATION: 'Violation',
};

function entityOf(item: NotificationItem): string | null {
  const raw = item.entityType;
  if (!raw) return null;
  return ENTITY_ALIASES[raw] ?? raw;
}

/** Where a notification leads for the signed-in role, or null when it has nowhere to open. */
export function notificationTarget(item: NotificationItem, role: RoleCode | undefined): string | null {
  const id = item.entityId;
  const entity = entityOf(item);

  if (item.type === 'SECURITY_ALERT') return '/account/sessions';

  if (role === 'WARD_AUTHORITY') {
    if (entity === 'BusinessRegistration' && id) return `/ward/inbox/registrations/${id}`;
    if (item.type === 'WARD_REVIEW') return '/ward/inbox';
    return null;
  }

  if (role === 'CUSTOMER') {
    if ((entity === 'ORDER' || entity === 'OrderArrivalAck') && id) return `/customer/orders/${id}`;
    if (item.type === 'ORDER_COMPLAINT' || item.type === 'ORDER') return '/customer/orders';
    return null;
  }

  if (role !== 'VENDOR') return null;

  switch (entity) {
    case 'ORDER':
    case 'OrderArrival':
      return id ? `/vendor/orders/${id}` : '/vendor/orders';
    case 'FeeScheduleItem':
      return '/vendor/finance';
    case 'RentalContract':
      // A fee notice about a contract opens its schedule; a permit notice opens the contract.
      if (!id) return '/vendor/slots/contracts';
      return item.type === 'PERMIT_ISSUED'
        ? `/vendor/slots/contracts/${id}`
        : `/vendor/finance/contracts/${id}`;
    case 'PaymentTransaction':
      return '/vendor/finance/payments';
    case 'Penalty':
    case 'Violation':
      return '/vendor/finance/violations';
    case 'BusinessRegistration':
      return id ? `/vendor/home/registrations/${id}` : '/vendor/home/registrations';
    case 'RentalApplication':
      return id ? `/vendor/slots/rental-applications/${id}` : '/vendor/slots/rental-applications';
    case 'RenewalRequest':
    case 'DigitalPermit':
      // Both ids belong to the contract's children; the contract list is where they show.
      return '/vendor/slots/contracts';
    case 'proposals':
    case 'SidewalkSlot':
      return id ? `/vendor/slots/${id}` : '/vendor/slots';
    case 'conflicts':
      return '/vendor/home/registrations';
    case 'transfers':
      return '/vendor/slots/transfers';
    case 'PricingZone':
      return '/vendor/slots/mine';
    case 'food-safety':
      return '/vendor/home/store/food-safety';
    case 'ReportedContent':
      return '/vendor/home/store/menu';
    default:
      if (item.type === 'ORDER') return '/vendor/orders';
      if (item.type.startsWith('FEE')) return '/vendor/finance';
      return null;
  }
}

export type NotificationTone = 'primary' | 'success' | 'warning' | 'error' | 'neutral';

/** The icon badge on a notification, chosen from its type. */
export function notificationVisual(item: NotificationItem): { icon: { sf: string; md: string }; tone: NotificationTone } {
  switch (item.type) {
    case 'ORDER':
      return { icon: { sf: 'bag.fill', md: 'shopping_bag' }, tone: 'primary' };
    case 'ORDER_COMPLAINT':
      return { icon: { sf: 'exclamationmark.bubble.fill', md: 'feedback' }, tone: 'primary' };
    case 'FEE':
    case 'FEE_DUE':
    case 'INVOICE':
      return { icon: { sf: 'doc.text.fill', md: 'receipt_long' }, tone: 'warning' };
    case 'PENALTY':
      return { icon: { sf: 'banknote.fill', md: 'payments' }, tone: 'warning' };
    case 'PENALTY_OVERDUE':
    case 'PENALTY_SANCTION_ISSUED':
      return { icon: { sf: 'exclamationmark.octagon.fill', md: 'report' }, tone: 'error' };
    case 'PERMIT_ISSUED':
    case 'RENEWAL_APPROVED':
      return { icon: { sf: 'checkmark.shield.fill', md: 'verified_user' }, tone: 'success' };
    case 'PERMIT_STATUS_SUSPENDED':
      return { icon: { sf: 'exclamationmark.shield.fill', md: 'gpp_maybe' }, tone: 'error' };
    case 'PERMIT_APPLICATION_REJECTED':
    case 'RENEWAL_REJECTED':
      return { icon: { sf: 'xmark.circle.fill', md: 'cancel' }, tone: 'error' };
    case 'ENROLLMENT_STATUS_UPDATE':
      return { icon: { sf: 'doc.fill', md: 'description' }, tone: 'primary' };
    case 'WARD_REVIEW':
      return { icon: { sf: 'mappin.circle.fill', md: 'location_on' }, tone: 'primary' };
    case 'SLOT_PRICE_CHANGED':
    case 'ZONE_PRICE_CHANGED':
    case 'ZONE_FEES_CHANGED':
      return { icon: { sf: 'tag.fill', md: 'sell' }, tone: 'warning' };
    case 'ZONE_HOURS_CHANGED':
      return { icon: { sf: 'clock.fill', md: 'schedule' }, tone: 'neutral' };
    case 'FOOD_SAFETY':
      return { icon: { sf: 'fork.knife', md: 'restaurant' }, tone: 'primary' };
    case 'CONTENT_MODERATION':
      return { icon: { sf: 'flag.fill', md: 'flag' }, tone: 'neutral' };
    case 'SECURITY_ALERT':
      return { icon: { sf: 'lock.fill', md: 'lock' }, tone: 'error' };
    default:
      return { icon: { sf: 'bell.fill', md: 'notifications' }, tone: 'neutral' };
  }
}

/** "Mới" for the last 24 hours, "Trước đó" for the rest, like a social feed. */
export function splitByRecency<T extends { sentAt: string }>(
  items: T[],
  now: Date = new Date(),
): { recent: T[]; earlier: T[] } {
  const cutoff = now.getTime() - 24 * 60 * 60 * 1000;
  const recent: T[] = [];
  const earlier: T[] = [];
  for (const item of items) {
    const at = new Date(item.sentAt).getTime();
    (Number.isFinite(at) && at >= cutoff ? recent : earlier).push(item);
  }
  return { recent, earlier };
}
