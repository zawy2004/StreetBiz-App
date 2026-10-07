import { Redirect } from 'expo-router';

import { ROLE_HOME, WELCOME_ROUTE } from '@/core/auth/role-routes';
import { useAuthStore } from '@/store/auth-store';

/** Guests land on the welcome screen; signed-in users go straight to their role home. */
export default function IndexScreen() {
  const user = useAuthStore((s) => s.user);
  return <Redirect href={(user ? ROLE_HOME[user.role_code] : WELCOME_ROUTE) as never} />;
}
