import { Redirect, type Href } from 'expo-router';

import { GUEST_HOME_ROUTE, ROLE_HOME_ROUTE } from '@/core/auth/role-routes';
import { useAuthStore } from '@/store/auth-store';

/**
 * Where the app opens: a signed-in user lands on their role's home; a guest browses stalls
 * (as on the web, buying needs no account to look); an expired session goes to sign-in.
 */
export default function Index() {
  const user = useAuthStore((s) => s.user);
  const expired = useAuthStore((s) => s.sessionExpired);
  if (user) return <Redirect href={ROLE_HOME_ROUTE[user.role_code] as Href} />;
  if (expired) return <Redirect href="/auth/sign-in" />;
  return <Redirect href={GUEST_HOME_ROUTE as Href} />;
}
