import { router, type Href } from 'expo-router';

import { ROLE_HOME_ROUTE } from '@/core/auth/role-routes';
import type { RoleCode } from '@/core/types/role';

/**
 * `/auth/sign-in?back=1`: a buyer asked to sign in from a form (a complaint about a stall) goes
 * back to that form, with what they had typed, instead of landing on the home screen. Every other
 * sign-in, and any other role, lands on the role's home as before.
 */
export const COME_BACK_PARAM = 'back';

export const signInHref = (comeBack: boolean) => (comeBack ? `/auth/sign-in?${COME_BACK_PARAM}=1` : '/auth/sign-in');

/** Leaves the sign-in screens. `nested`: called from a screen pushed above the sign-in screen (OTP). */
export function leaveSignIn(role: RoleCode, comeBack: boolean, nested = false) {
  // Asked before anything moves: the form sits under the sign-in screens only when they were pushed.
  const back = comeBack && role === 'CUSTOMER' && router.canGoBack();
  if (nested) router.dismissAll();
  if (back) router.back();
  else router.replace(ROLE_HOME_ROUTE[role] as Href);
}
