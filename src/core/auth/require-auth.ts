import { goTo } from '@/core/navigation/go';
import { useAuthStore } from '@/store/auth-store';

import { signInHref } from './role-routes';

/**
 * Guests can browse; anything that writes data sends them to sign in first.
 * `next` is where to continue once signed in (e.g. checkout after the cart).
 */
export function requireAuth(next?: string): boolean {
  if (useAuthStore.getState().user) return true;
  goTo(signInHref(next));
  return false;
}
