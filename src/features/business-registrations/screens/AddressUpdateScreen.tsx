import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { Banner } from '@/components/feedback/Banner';
import { Skeleton } from '@/components/feedback/Skeleton';
import { ErrorState } from '@/components/feedback/States';
import { showToast } from '@/components/feedback/Toast';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { VENDOR_TYPE } from '@/core/api';
import { sideApi, SideApiError } from '@/core/api/side-api';
import { hkdCode } from '@/features/sidewalk-slots/slot-format';
import { useAuthStore } from '@/store/auth-store';
import { colors, fonts, radius, shadow, text } from '@/theme';
import { Plate } from '@/ui';
import { useRegistrationDetail } from '../useRegistrations';

/** One end of the move: a pin disc and the address in words (struck through once it is being replaced). */
function AddressStop({ label, address, tone, struck }: { label: string; address: string; tone: 'old' | 'new'; struck?: boolean }) {
  const isNew = tone === 'new';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
      <View style={{ width: 44, height: 44, borderRadius: radius.full, backgroundColor: isNew ? colors.cta : colors.sunken, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.white, boxShadow: isNew ? shadow.glow : undefined }}>
        <Icon sf={isNew ? 'mappin.and.ellipse' : 'mappin.slash'} md={isNew ? 'location_on' : 'location_off'} size={19} color={isNew ? colors.white : colors.muted} />
      </View>
      <View style={{ flex: 1, gap: 2, paddingTop: 2 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: isNew ? colors.primary : colors.muted }}>{label}</Text>
        <Text style={[text.callout, { color: isNew ? colors.ink : colors.muted, fontFamily: isNew ? fonts.bold : fonts.regular, textDecorationLine: struck ? 'line-through' : 'none' }]}>{address}</Text>
      </View>
    </View>
  );
}

/** V09 Đổi địa chỉ kinh doanh (SIDE-09/10), v5: the move drawn as two pins on a path; the ward reviews the new address. */
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

  if (isLoading) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Đổi địa chỉ kinh doanh' }} />
        <View style={{ gap: 14 }} accessibilityLabel="Đang tải">
          <Skeleton width="60%" height={26} />
          <Skeleton height={168} radius={radius.card} />
          <Skeleton height={130} radius={radius.control} />
        </View>
      </Screen>
    );
  }
  if (isError || !registration) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Đổi địa chỉ kinh doanh' }} />
        <ErrorState error={error ?? new Error('Không tìm thấy hồ sơ.')} onRetry={() => void refetch()} />
      </Screen>
    );
  }
  const eligible = registration.vendorType === VENDOR_TYPE.fixedStorefront && registration.registrationStatus === 'APPROVED';
  const typed = address.trim();

  return (
    <Screen gap={18} footer={<Button label="Gửi yêu cầu" size={56} icon={{ sf: 'paperplane.fill', md: 'send' }} loading={submit.isPending} onPress={send} />}>
      <Stack.Screen options={{ title: 'Đổi địa chỉ kinh doanh' }} />
      <View style={{ gap: 8 }}>
        <Plate code={hkdCode(registration.registrationId)} />
        <Text style={[text.title2, { color: colors.ink }]}>{registration.displayName}</Text>
      </View>
      {!eligible ? (
        <Banner tone="warning">Đổi địa chỉ dành cho cửa hàng cố định đã được duyệt. Phường có thể không nhận yêu cầu cho hồ sơ này.</Banner>
      ) : null}

      {/* The move: the current address, a dashed path, the new one filling in as it is typed */}
      <View
        accessible
        accessibilityLabel={`Địa chỉ hiện tại: ${registration.declaredAddress ?? 'chưa có'}. Địa chỉ mới: ${typed || 'chưa nhập'}`}
        style={{ padding: 18, gap: 4, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadow.card }}
      >
        <AddressStop label="Địa chỉ hiện tại" address={registration.declaredAddress ?? 'Chưa có'} tone="old" struck={!!typed} />
        <View style={{ marginLeft: 21, gap: 4, paddingVertical: 2 }}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ width: 2, height: 5, backgroundColor: typed ? colors.cta : colors.line }} />
          ))}
        </View>
        <AddressStop label="Địa chỉ mới" address={typed || 'Nhập bên dưới'} tone="new" />
      </View>

      <TextField
        label="Địa chỉ kinh doanh mới"
        value={address}
        onChangeText={(v) => {
          setAddress(v);
          setFormError(undefined);
        }}
        placeholder="Số nhà, đường, phường"
        error={formError}
        icon={{ sf: 'mappin.and.ellipse', md: 'location_on' }}
        multiline
      />
      <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 4 }}>
        <Icon sf="info.circle.fill" md="info" size={16} color={colors.muted} style={{ marginTop: 2 }} />
        <Text style={[text.footnote, { flex: 1, color: colors.muted }]}>
          Sau khi gửi, phường xét địa chỉ mới. Nếu ô đang thuê không còn liền kề, hợp đồng cũ có thể được trả lại và bạn sẽ thuê ô ở địa chỉ mới.
        </Text>
      </View>
    </Screen>
  );
}
