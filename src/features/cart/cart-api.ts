import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback } from 'react';
import { Alert } from 'react-native';

import { showToast } from '@/components/feedback/Toast';
import {
  commerceApi,
  errorMessage,
  type CommerceCart,
  type MarketplaceMenuItem,
} from '@/core/api';
import { useAuthStore } from '@/store/auth-store';

/**
 * The buyer's cart on the server (`/api/cart`, the web's `['commerce', 'cart']`). The backend
 * holds one stall per cart: adding a dish from another stall abandons the old cart, so the
 * app asks first. Guests are asked to sign in before anything is added.
 */
export const CART_KEY = ['commerce', 'cart'] as const;

export function useCart() {
  const isCustomer = useAuthStore((s) => s.user?.role_code === 'CUSTOMER');
  return useQuery({
    queryKey: CART_KEY,
    queryFn: () => commerceApi.cart(),
    enabled: isCustomer,
  });
}

export const cartCount = (cart: CommerceCart | null | undefined) =>
  cart?.items.reduce((n, i) => n + i.quantity, 0) ?? 0;

/** Sends a guest to sign in, explaining why (the web's "Đăng nhập để đặt món"). */
export function askToSignIn(reason = 'Đăng nhập để thêm món vào giỏ và đặt trước.') {
  Alert.alert('Cần đăng nhập', reason, [
    { text: 'Để sau', style: 'cancel' },
    { text: 'Đăng nhập', onPress: () => router.push('/auth/sign-in') },
  ]);
}

export function useAddToCart() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const add = useMutation({
    mutationFn: (item: MarketplaceMenuItem) => commerceApi.addCartItem(item.menuItemId, 1),
    onSuccess: (cart) => {
      queryClient.setQueryData(CART_KEY, cart);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    onError: (err) => showToast(errorMessage(err), 'error'),
  });

  return useCallback(
    (item: MarketplaceMenuItem) => {
      if (!user) {
        askToSignIn();
        return;
      }
      const held = queryClient.getQueryData<CommerceCart | null>(CART_KEY);
      if (held && held.items.length > 0 && held.storefrontId !== item.storefrontId) {
        Alert.alert(
          'Đổi sang quán khác?',
          `Giỏ đang có ${cartCount(held)} món của ${held.storefrontName}. Mỗi đơn chỉ lấy ở một quán, nên món của ${item.storefrontName} sẽ thay cho giỏ hiện tại.`,
          [
            { text: 'Giữ giỏ cũ', style: 'cancel' },
            { text: 'Thay giỏ', style: 'destructive', onPress: () => add.mutate(item) },
          ],
        );
        return;
      }
      add.mutate(item);
    },
    [user, queryClient, add],
  );
}

/** − n + on a cart line; 0 removes it. Results replace the cached cart. */
export function useSetCartQuantity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ menuItemId, quantity }: { menuItemId: number; quantity: number }) =>
      quantity <= 0
        ? commerceApi.removeCartItem(menuItemId)
        : commerceApi.updateCartItem(menuItemId, Math.min(99, quantity)),
    onSuccess: (cart) => queryClient.setQueryData(CART_KEY, cart ?? null),
    onError: (err) => showToast(errorMessage(err), 'error'),
  });
}

export function useClearCart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => commerceApi.clearCart(),
    onSuccess: () => queryClient.setQueryData(CART_KEY, null),
    onError: (err) => showToast(errorMessage(err), 'error'),
  });
}
