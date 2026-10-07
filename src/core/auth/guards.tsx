import { Redirect } from 'expo-router';
import { useState, type ReactNode } from 'react';

import { useAuthStore } from '@/store/auth-store';

import { ROLE_AREA, ROLE_HOME, WELCOME_ROUTE, signInHref, type RoleArea } from './role-routes';

/**
 * Where a visitor must be sent instead of entering `area`, or null to let them in.
 * Mirrors StreetBiz-FE's RoleGuard: guests go to the front door (or sign-in
 * when the area allows browsing but this screen does not), and a signed-in
 * account of another role goes back to its own home.
 */
export function useAreaRedirect(area: RoleArea, guest: 'welcome' | 'browse' | { signInNext: string }): string | null {
  const user = useAuthStore((s) => s.user);
  if (user) return ROLE_AREA[user.role_code] === area ? null : ROLE_HOME[user.role_code];
  if (guest === 'browse') return null;
  if (guest === 'welcome') return WELCOME_ROUTE;
  return signInHref(guest.signInNext);
}

/** For shared account screens (notifications, sessions, password): any signed-in role. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Redirect href={signInHref() as never} />;
  return <>{children}</>;
}

/**
 * Keeps signed-in users out of the front door and sign-in screens. Checked
 * once on entry only: signing in on these screens must not race the screen's
 * own navigation to wherever the guest was heading.
 */
export function RedirectIfSignedIn({ children }: { children: ReactNode }) {
  const [entryUser] = useState(() => useAuthStore.getState().user);
  if (entryUser) return <Redirect href={ROLE_HOME[entryUser.role_code] as never} />;
  return <>{children}</>;
}
