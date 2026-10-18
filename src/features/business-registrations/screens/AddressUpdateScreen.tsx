import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Card } from '@/components/common/Blocks';
import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { Banner } from '@/components/feedback/Banner';
import { ErrorState, ListSkeleton } from '@/components/feedback/States';
import { showToast } from '@/components/feedback/Toast';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { VENDOR_TYPE } from '@/core/api';
import { sideApi, SideApiError } from '@/core/api/side-api';
import { useAuthStore } from '@/store/auth-store';
import { colors, fonts, text } from '@/theme';
import { useRegistrationDetail } from '../useRegistrations';

/** V09 Đổi địa chỉ kinh doanh (SIDE-09/10): the ward reviews the new address. */
export function AddressUpdateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const registrationId = Number(id);
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  const { registration, isLoading, isError, error, refetch } = useRegistrationDetail(registrationId);
  const [address, setAddress] = useState('');
  const [formError, setFormError] = useState<string>();
  const submit = useMutation({
    mutationFn: () => sideApi.requestAddressChange({ registrationId, newAddress: address.trim() }),
    onSuccess: (result) => {
      showToast(result.message);
      void queryClient.invalidateQueries({ queryKey: ['side', userId, 'address-changes'] });
      router.back();
    },
    onError: (err) => setFormError(err instanceof SideApiError ? err.message : 'Không gửi được yêu cầu.'),
  });

  const send = () => {
    if (!address.trim()) {
      setFormError('Vui lòng nhập địa chỉ mới.');
      return;
    }
    setFormError(undefined);
    submit.mutate();
  };

  if (isLoading) return <Screen><Stack.Screen options={{ title: 'Đổi địa chỉ kinh doanh' }} /><ListSkeleton rows={2} /></Screen>;
  if (isError || !registration) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Đổi địa chỉ kinh doanh' }} />
        <ErrorState error={error ?? new Error('Không tìm thấy hồ sơ.')} onRetry={() => void refetch()} />
      </Screen>
    );
  }
  const eligible = registration.vendorType === VENDOR_TYPE.fixedStorefront && registration.registrationStatus === 'APPROVED';

  return (
    <Screen footer={<Button label="Gửi yêu cầu" size={56} loading={submit.isPending} onPress={send} />}>
      <Stack.Screen options={{ title: 'Đổi địa chỉ kinh doanh' }} />
      <Text style={[text.title3, { color: colors.ink }]}>{registration.displayName}</Text>
      {!eligible ? (
        <Banner tone="warning">Đổi địa chỉ dành cho cửa hàng cố định đã được duyệt. Phường có thể không nhận yêu cầu cho hồ sơ này.</Banner>
      ) : null}
      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Icon sf="mappin.slash" md="location_off" size={18} color={colors.muted} />
          <View style={{ flex: 1 }}>
            <Text style={[text.caption, { color: colors.muted, fontFamily: fonts.regular }]}>Địa chỉ hiện tại</Text>
            <Text style={[text.callout, { color: colors.ink, textDecorationLine: address.trim() ? 'line-through' : 'none' }]}>
              {registration.declaredAddress ?? 'Chưa có'}
            </Text>
          </View>
        </View>
        <View style={{ height: 1, backgroundColor: colors.separator }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Icon sf="mappin.and.ellipse" md="location_on" size={18} color={colors.cta} />
          <View style={{ flex: 1 }}>
            <Text style={[text.caption, { color: colors.muted, fontFamily: fonts.regular }]}>Địa chỉ mới</Text>
            <Text style={[text.callout, { color: address.trim() ? colors.ink : colors.muted, fontFamily: fonts.semibold }]}>
              {address.trim() || 'Nhập bên dưới'}
            </Text>
          </View>
        </View>
      </Card>
      <TextField
        label="Địa chỉ kinh doanh mới"
        value={address}
        onChangeText={(v) => {
          setAddress(v);
          setFormError(undefined);
        }}
        placeholder="Số nhà, đường, phường"
        error={formError}
        multiline
      />
      <Banner tone="info" title="Sau khi gửi">
        Phường xét địa chỉ mới. Nếu ô đang thuê không còn liền kề, hợp đồng cũ có thể được trả lại và bạn sẽ thuê ô ở địa chỉ mới.
      </Banner>
    </Screen>
  );
}
