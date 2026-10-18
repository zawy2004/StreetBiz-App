import { ComingSoon } from '@/components/layout/ComingSoon';

export default function CheckoutRoute() {
  return (
    <ComingSoon
      title="Thanh toán"
      icon={{ sf: 'creditcard', md: 'credit_card' }}
      body="Chọn MoMo hoặc ZaloPay và đặt trước."
      group="G4"
    />
  );
}
