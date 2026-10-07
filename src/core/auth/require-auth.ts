import { goTo } from '@/core/navigation/go';
import { useAuthStore } from '@/store/auth-store';

/** Guests can browse; anything that writes data sends them to sign in first. */
export function requireAuth(): boolean {
  if (useAuthStore.getState().user) return true;
  goTo('/(auth)/sign-in');
  return false;
}
