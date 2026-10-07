import { StackHeader } from '@/components/layout/StackHeader';
import { AccountScreen } from '@/features/account/AccountScreen';

export default function WardAccountScreen() {
  return (
    <>
      <StackHeader title="Tài khoản" />
      <AccountScreen />
    </>
  );
}
