import { VENDOR_TYPE } from '@/core/api';

export function vendorTypeLabel(vendorType: string): string {
  return vendorType === VENDOR_TYPE.fixedStorefront ? 'Cửa hàng cố định' : 'Bán hàng lưu động';
}
