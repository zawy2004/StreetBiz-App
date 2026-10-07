import { router } from 'expo-router';

/** Navigates by a runtime-built path (mock ids), which typed routes cannot check. */
export const goTo = (href: string) => router.push(href as never);
export const goReplace = (href: string) => router.replace(href as never);

/** Clears the stack (when there is one) and lands on `href`, e.g. after finishing a flow. */
export function goRoot(href: string) {
  if (router.canDismiss()) router.dismissAll();
  router.replace(href as never);
}
