import { notificationTarget, notificationVisual } from '@/features/notifications/notification-routing';
import type { NotificationItem } from '@/features/notifications/notifications-api';

const notice = (type: string, entityId: number | null = 41, entityType: string | null = 'VendorReport'): NotificationItem =>
  ({ id: 1, type, title: 't', body: 'b', entityType, entityId, read: false, sentAt: '2026-10-23T05:00:00Z' }) as NotificationItem;

describe('notification routing for citizen reports (WARD-19)', () => {
  it('a new report opens the report for the ward officer', () => {
    expect(notificationTarget(notice('VENDOR_REPORT_NEW'), 'WARD_AUTHORITY')).toBe('/ward/inbox/reports/41');
    expect(notificationTarget(notice('VENDOR_REPORT_NEW', null, null), 'WARD_AUTHORITY')).toBe('/ward/inbox/reports');
  });

  it('the result opens the right report in "Phản ánh của tôi" for the buyer', () => {
    expect(notificationTarget(notice('VENDOR_REPORT_RESOLVED'), 'CUSTOMER')).toBe('/customer/account/reports/41');
    expect(notificationTarget(notice('VENDOR_REPORT_RESOLVED', null, null), 'CUSTOMER')).toBe('/customer/account/reports');
  });

  it('the vendor never opens the report itself, only the stall price board and history', () => {
    expect(notificationTarget(notice('VENDOR_REPORT_AGAINST_YOU'), 'VENDOR')).toBe('/vendor/home/store/prices');
    expect(notificationTarget(notice('VENDOR_REPORT_RESOLVED'), 'VENDOR')).toBe('/vendor/home/store/prices');
  });

  it('a platform administrator has nowhere to go (no compliance authority, BR-44)', () => {
    expect(notificationTarget(notice('VENDOR_REPORT_NEW'), 'PLATFORM_ADMIN')).toBeNull();
  });

  it('keeps the existing routes', () => {
    expect(notificationTarget(notice('ORDER', 7, 'ORDER'), 'CUSTOMER')).toBe('/customer/orders/7');
    expect(notificationTarget(notice('WARD_REVIEW', 5, 'REGISTRATION'), 'WARD_AUTHORITY')).toBe('/ward/inbox/registrations/5');
  });

  it('gives the three types their own badge', () => {
    expect(notificationVisual(notice('VENDOR_REPORT_NEW')).tone).toBe('warning');
    expect(notificationVisual(notice('VENDOR_REPORT_AGAINST_YOU')).tone).toBe('warning');
    expect(notificationVisual(notice('VENDOR_REPORT_RESOLVED')).icon.md).toBe('mark_chat_read');
  });
});
