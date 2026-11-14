import { Linking } from 'react-native';

/** Opens the payment gateway (MoMo/ZaloPay); the gateway returns to the app by deep link. */
export function redirectToPayment(paymentUrl: string): void {
  void Linking.openURL(paymentUrl);
}

/**
 * With no real MoMo/ZaloPay merchant configured, the backend's sandbox gateway returns a
 * `streetbiz://payment/sandbox/...` link (the scheme was made for a mobile app). The app
 * handles those itself on the payment screen instead of leaving the order unpaid.
 */
export function isSandboxPaymentUrl(paymentUrl: string): boolean {
  return paymentUrl.startsWith('streetbiz://payment/sandbox/');
}
