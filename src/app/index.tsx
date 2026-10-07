import { Redirect } from 'expo-router';

import { ROLE_HOME, useAuthStore } from '@/store/auth-store';

export default function IndexScreen() {
  const user = useAuthStore((s) => s.user);
  return <Redirect href={(user ? ROLE_HOME[user.role_code] : '/(auth)/sign-in') as never} />;
}
