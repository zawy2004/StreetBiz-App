import { AccountScreen } from '@/features/account/AccountScreen';
import { GuestAccountScreen } from '@/features/account/GuestAccountScreen';
import { useAuthStore } from '@/store/auth-store';

export default function CustomerAccountTab() {
  const signedIn = useAuthStore((s) => !!s.user);
  return signedIn ? <AccountScreen /> : <GuestAccountScreen />;
}
