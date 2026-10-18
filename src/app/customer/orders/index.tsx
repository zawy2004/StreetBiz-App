import { ComingSoon } from '@/components/layout/ComingSoon';

export default function Route() {
  return (
    <ComingSoon
      title="Đơn hàng"
      icon={{ sf: 'bag', md: 'receipt_long' }}
      body="Đơn đặt trước và mã lấy món."
      group="G4"
    />
  );
}
