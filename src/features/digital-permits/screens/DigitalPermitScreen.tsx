import * as Haptics from 'expo-haptics';
import { router, Stack } from 'expo-router';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { Skeleton } from '@/components/feedback/Skeleton';
import { StateView } from '@/components/feedback/StateView';
import { colors, radius, space, text } from '@/theme';
import { formatVietnamTime } from '@/utils/format';
import { PermitPass } from '../components/PermitPass';
import { useContract, usePermit } from '../permit-api';

const TIPS: { icon: { sf: string; md: string }; text: string }[] = [
  { icon: { sf: 'sun.max.fill', md: 'light_mode' }, text: 'Tăng độ sáng màn hình.' },
  {
    icon: { sf: 'qrcode.viewfinder', md: 'qr_code_scanner' },
    text: 'Giữ máy thẳng, cách camera của cán bộ một gang tay.',
  },
  {
    icon: { sf: 'number', md: 'pin' },
    text: 'Không quét được thì đọc mã in dưới QR để cán bộ nhập tay.',
  },
];

/**
 * M-V19 Giấy phép số — what a vendor shows a ward officer on the pavement. The pass is the
 * whole screen; pull down or tap refresh to ask the server again (it is never read from a
 * cache), and "Phóng to mã" opens the QR alone, full screen.
 */
export function DigitalPermitScreen({ contractId }: { contractId: number }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const permit = usePermit(contractId);
  const contract = useContract(contractId);
  const qrSize = Math.min(220, width - 2 * space.md - 2 * 20 - 24 - 40);

  const refresh = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void permit.refetch();
  };

  const header = (
    <Stack.Screen
      options={{
        title: 'Giấy phép số',
        headerRight: () => (
          <Pressable
            onPress={refresh}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Kiểm tra lại với máy chủ"
          >
            <Icon sf="arrow.clockwise" md="refresh" size={19} color={colors.primary} />
          </Pressable>
        ),
      }}
    />
  );

  if (permit.isPending || contract.isPending) {
    return (
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: colors.bg }}
        contentContainerStyle={{ padding: space.md, gap: 16 }}
      >
        {header}
        <View
          accessibilityLabel="Đang tải giấy phép"
          style={{
            borderRadius: radius.pass,
            borderCurve: 'continuous',
            overflow: 'hidden',
            backgroundColor: colors.card,
          }}
        >
          <Skeleton height={140} radius={0} />
          <View style={{ padding: 20, gap: 16, alignItems: 'center' }}>
            <Skeleton height={46} radius={23} />
            <Skeleton width={qrSize + 24} height={qrSize + 24} radius={18} />
            <Skeleton width="70%" height={14} />
          </View>
        </View>
      </ScrollView>
    );
  }

  if (permit.isError) {
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: colors.bg }}>
        {header}
        <StateView
          tone="danger"
          icon={{ sf: 'doc.text.magnifyingglass', md: 'find_in_page' }}
          title="Chưa xác minh được giấy phép"
          body={`${permit.error.message}
Giấy phép luôn được kiểm tra trực tiếp với máy chủ phường, nên cần có mạng.`}
          action={{ label: 'Thử lại', onPress: refresh }}
        />
      </ScrollView>
    );
  }

  const valid = permit.data.effectiveStatus === 'VALID';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {header}
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          padding: space.md,
          paddingBottom: (valid ? 110 : 24) + insets.bottom,
          gap: 14,
        }}
        refreshControl={
          <RefreshControl
            refreshing={permit.isRefetching}
            onRefresh={refresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <PermitPass
          permit={permit.data}
          contract={contract.data}
          qrSize={qrSize}
        />

        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          <Icon
            sf={permit.isRefetching ? 'arrow.triangle.2.circlepath' : 'checkmark.icloud.fill'}
            md={permit.isRefetching ? 'sync' : 'cloud_done'}
            size={15}
            color={colors.muted}
          />
          <Text style={[text.footnote, { color: colors.muted }]}>
            {permit.isRefetching
              ? 'Đang kiểm tra lại với máy chủ…'
              : `Kiểm tra với máy chủ lúc ${formatVietnamTime(permit.dataUpdatedAt)}`}
          </Text>
        </View>

        <Text style={[text.footnote, { color: colors.muted, marginTop: 10, marginLeft: 4 }]}>
          KHI CÁN BỘ KIỂM TRA
        </Text>
        <View
          style={{
            borderRadius: radius.card,
            borderCurve: 'continuous',
            overflow: 'hidden',
            backgroundColor: colors.card,
          }}
        >
          {TIPS.map((tip, i) => (
            <View
              key={tip.text}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingHorizontal: 16,
                paddingVertical: 13,
              }}
            >
              <View
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  borderCurve: 'continuous',
                  backgroundColor: colors.brandTint,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon sf={tip.icon.sf} md={tip.icon.md} size={16} color={colors.primary} />
              </View>
              <Text style={[text.callout, { flex: 1, color: colors.ink }]}>{tip.text}</Text>
              {i < TIPS.length - 1 ? (
                <View
                  style={{
                    position: 'absolute',
                    left: 58,
                    right: 0,
                    bottom: 0,
                    height: 1,
                    backgroundColor: colors.separator,
                  }}
                />
              ) : null}
            </View>
          ))}
        </View>
      </ScrollView>

      {/* The one action this screen exists for, under the thumb; an invalid QR is not worth enlarging */}
      {valid ? (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: space.md,
            paddingTop: 12,
            paddingBottom: insets.bottom + 12,
            backgroundColor: 'rgba(247,248,250,0.96)',
            borderTopWidth: 1,
            borderTopColor: colors.separator,
          }}
        >
          <Button
            label="Phóng to mã"
            size={56}
            icon={{ sf: 'qrcode', md: 'qr_code_2' }}
            onPress={() =>
              router.push({ pathname: '/permit-qr', params: { contractId: String(contractId) } })
            }
            accessibilityHint="Mở mã QR to hết màn hình cho cán bộ quét"
          />
        </View>
      ) : null}
    </View>
  );
}
