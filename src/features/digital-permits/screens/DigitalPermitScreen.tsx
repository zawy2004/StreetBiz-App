import * as Haptics from 'expo-haptics';
import { router, Stack } from 'expo-router';
import { RefreshControl, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { Skeleton } from '@/components/feedback/Skeleton';
import { StateView } from '@/components/feedback/StateView';
import { colors, fonts, radius, shadow, tabular, text } from '@/theme';
import { FloatingBar, RoundButton, Section, Signboard, useLightStatusBar } from '@/ui';
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
 * M-V19 Giấy phép số, v5 — what a vendor shows a ward officer on the pavement. The stall's orange
 * signboard runs under the status bar and paints the server's answer time (BR-39: the permit is
 * never read from a cache); the permit pass lies across its edge. Pull down or tap the round
 * refresh to ask the server again; "Phóng to mã" opens the QR alone, full screen.
 */
export function DigitalPermitScreen({ contractId }: { contractId: number }) {
  const insets = useSafeAreaInsets();
  useLightStatusBar();
  const { width } = useWindowDimensions();
  const permit = usePermit(contractId);
  const contract = useContract(contractId);
  // Sign gutter 20 + pass padding 20 + QR paper padding 12 and rim, both sides.
  const qrSize = Math.min(240, width - 2 * 20 - 2 * 20 - 2 * 14);

  const refresh = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void permit.refetch();
  };

  const loading = permit.isPending || contract.isPending;
  const valid = !loading && !permit.isError && permit.data.effectiveStatus === 'VALID';

  // BR-39: say when the server answered, not when the screen was drawn.
  const answered = loading
    ? 'Đang hỏi máy chủ phường…'
    : permit.isError
      ? 'Chưa xác minh được với máy chủ.'
      : permit.isRefetching
        ? 'Đang kiểm tra lại với máy chủ…'
        : `Kiểm tra với máy chủ lúc ${formatVietnamTime(permit.dataUpdatedAt)}`;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ headerShown: false, title: 'Giấy phép số' }} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: (valid ? 104 : 32) + insets.bottom, gap: 28 }}
        refreshControl={
          <RefreshControl
            refreshing={permit.isRefetching}
            onRefresh={refresh}
            tintColor={colors.cta}
            colors={[colors.cta]}
            progressViewOffset={insets.top}
          />
        }
      >
        <Signboard
          top={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <RoundButton icon={{ sf: 'chevron.left', md: 'arrow_back' }} label="Quay lại" onPress={() => router.back()} />
              <View style={{ flex: 1 }} />
              <RoundButton icon={{ sf: 'arrow.clockwise', md: 'refresh' }} label="Kiểm tra lại với máy chủ" onPress={refresh} />
            </View>
          }
          line1="Giấy phép"
          line2="vỉa hè"
          overlap={
            loading ? (
              <View accessibilityLabel="Đang tải giấy phép" style={{ borderRadius: radius.pass, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.card, boxShadow: shadow.raised }}>
                <View style={{ height: 8, backgroundColor: colors.brandTint }} />
                <View style={{ padding: 20, gap: 18, alignItems: 'center' }}>
                  <Skeleton height={20} width="60%" style={{ alignSelf: 'flex-start' }} />
                  <Skeleton height={64} width="55%" radius={radius.plate} style={{ alignSelf: 'flex-start' }} />
                  <Skeleton width={qrSize + 24} height={qrSize + 24} radius={radius.photo} />
                  <Skeleton width="70%" height={14} />
                </View>
              </View>
            ) : permit.isError ? undefined : (
              <PermitPass permit={permit.data} contract={contract.data} qrSize={qrSize} />
            )
          }
        >
          {/* The server's answer time, painted on the sign */}
          <View accessibilityRole="text" style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', minHeight: 34, paddingHorizontal: 12, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.22)' }}>
            <Icon
              sf={permit.isRefetching || loading ? 'arrow.triangle.2.circlepath' : permit.isError ? 'icloud.slash.fill' : 'checkmark.icloud.fill'}
              md={permit.isRefetching || loading ? 'sync' : permit.isError ? 'cloud_off' : 'cloud_done'}
              size={16}
              color={colors.white}
            />
            <Text style={[{ fontFamily: fonts.bold, fontSize: 14, lineHeight: 19, color: colors.white }, tabular]}>{answered}</Text>
          </View>
        </Signboard>

        {permit.isError ? (
          <StateView
            tone="danger"
            icon={{ sf: 'doc.text.magnifyingglass', md: 'find_in_page' }}
            title="Chưa xác minh được giấy phép"
            body={`${permit.error.message}
Giấy phép luôn được kiểm tra trực tiếp với máy chủ phường, nên cần có mạng.`}
            action={{ label: 'Thử lại', onPress: refresh }}
          />
        ) : null}

        {!loading && !permit.isError ? (
          <Section title="Khi cán bộ kiểm tra">
            <View style={{ marginHorizontal: 20, borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.card, boxShadow: shadow.card }}>
              {TIPS.map((tip, i) => (
                <View key={tip.text} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: i ? 1 : 0, borderTopColor: colors.separator }}>
                  <View style={{ width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon sf={tip.icon.sf} md={tip.icon.md} size={18} color={colors.primary} />
                  </View>
                  <Text style={[text.callout, { flex: 1, color: colors.ink }]}>{tip.text}</Text>
                </View>
              ))}
            </View>
          </Section>
        ) : null}
      </ScrollView>

      {/* The one action this screen exists for, under the thumb; an invalid QR is not worth enlarging */}
      {valid ? (
        <FloatingBar>
          <Button
            label="Phóng to mã"
            size={56}
            icon={{ sf: 'qrcode', md: 'qr_code_2' }}
            onPress={() => router.push({ pathname: '/permit-qr', params: { contractId: String(contractId) } })}
            accessibilityHint="Mở mã QR to hết màn hình cho cán bộ quét"
          />
        </FloatingBar>
      ) : null}
    </View>
  );
}
