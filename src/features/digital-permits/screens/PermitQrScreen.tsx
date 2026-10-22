import { router } from 'expo-router';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { KerbStrip } from '@/components/common/KerbStrip';
import { PermitQr } from '@/components/common/PermitQr';
import { Skeleton } from '@/components/feedback/Skeleton';
import { statusLabel } from '@/core/constants/status-labels';
import { colors, fonts, radius, sign, statusTones, tabular, text } from '@/theme';
import { formatVietnamTime } from '@/utils/format';
import { useContract, usePermit } from '../permit-api';

const BRACKET = 34;
const BRACKET_WIDTH = 5;

/** The four orange corners of a viewfinder, framing what the officer's camera should aim at. */
function Brackets() {
  const base = { position: 'absolute' as const, width: BRACKET, height: BRACKET, borderColor: colors.cta };
  return (
    <>
      <View pointerEvents="none" style={[base, { top: 0, left: 0, borderTopWidth: BRACKET_WIDTH, borderLeftWidth: BRACKET_WIDTH, borderTopLeftRadius: radius.control }]} />
      <View pointerEvents="none" style={[base, { top: 0, right: 0, borderTopWidth: BRACKET_WIDTH, borderRightWidth: BRACKET_WIDTH, borderTopRightRadius: radius.control }]} />
      <View pointerEvents="none" style={[base, { bottom: 0, left: 0, borderBottomWidth: BRACKET_WIDTH, borderLeftWidth: BRACKET_WIDTH, borderBottomLeftRadius: radius.control }]} />
      <View pointerEvents="none" style={[base, { bottom: 0, right: 0, borderBottomWidth: BRACKET_WIDTH, borderRightWidth: BRACKET_WIDTH, borderBottomRightRadius: radius.control }]} />
    </>
  );
}

/**
 * The QR alone (v5), as large as the screen allows, on bright white, framed by orange viewfinder
 * corners for scanning from a step away (web V19 fullscreen). A full-screen cover with an
 * explicit close; the permit is asked of the server again on open, never reused from a cache,
 * and the time the server answered is shown under the code (BR-39).
 */
export function PermitQrScreen({ contractId }: { contractId: number }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const permit = usePermit(contractId);
  const contract = useContract(contractId);
  const size = Math.max(200, Math.min(width - 88, height - 400));
  const data = permit.data;
  const valid = data?.effectiveStatus === 'VALID';
  const verdict = data ? statusTones[statusLabel(data.effectiveStatus).tone] : null;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.white,
        paddingTop: insets.top + 12,
      }}
      accessibilityViewIsModal
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon sf="building.columns.fill" md="account_balance" size={16} color={colors.primary} />
          <Text style={{ fontFamily: fonts.heavy, fontSize: 15, color: colors.ink }}>Giấy phép vỉa hè</Text>
        </View>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Đóng"
          style={({ pressed }) => ({
            width: 44,
            height: 44,
            borderRadius: radius.full,
            backgroundColor: pressed ? colors.line : colors.sunken,
            alignItems: 'center',
            justifyContent: 'center',
          })}
        >
          <Icon sf="xmark" md="close" size={18} color={colors.ink} weight="bold" />
        </Pressable>
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, paddingHorizontal: 20 }}>
        {/* The code inside the viewfinder corners */}
        <View style={{ width: size + 44, height: size + 44, alignItems: 'center', justifyContent: 'center' }}>
          <Brackets />
          {data ? (
            <View style={{ opacity: valid ? 1 : 0.3 }}>
              <PermitQr value={data.qrPayload} size={size} />
            </View>
          ) : permit.isError ? (
            <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16, borderRadius: radius.photo, backgroundColor: colors.dangerTint }}>
              <Icon sf="wifi.exclamationmark" md="wifi_off" size={30} color={colors.danger} />
              <Text style={{ fontFamily: fonts.heavy, fontSize: 17, color: colors.onDanger, textAlign: 'center' }}>Chưa xác minh được giấy phép</Text>
              <Text style={[text.footnote, { color: colors.onDanger, textAlign: 'center' }]}>Giấy phép luôn được kiểm tra trực tiếp với máy chủ phường, nên cần có mạng.</Text>
              <Button label="Thử lại" variant="secondary" onPress={() => void permit.refetch()} />
            </View>
          ) : (
            <Skeleton width={size} height={size} radius={radius.photo} />
          )}
        </View>

        {contract.data ? (
          <View style={{ alignItems: 'center', gap: 6 }}>
            <View
              accessibilityLabel={`Ô ${contract.data.slotCode}`}
              style={{ paddingHorizontal: 16, paddingVertical: 2, borderRadius: radius.plate, backgroundColor: valid || !data ? colors.plate : colors.muted, borderWidth: 3, borderColor: colors.white, boxShadow: `0 0 0 2px ${valid || !data ? colors.plate : colors.muted}` }}
            >
              <Text maxFontSizeMultiplier={1.3} style={[sign.figure, tabular, { color: colors.white, letterSpacing: 1 }]}>
                {contract.data.slotCode}
              </Text>
            </View>
            <Text style={[text.footnote, { color: colors.muted, textAlign: 'center' }]}>{contract.data.zoneName}</Text>
          </View>
        ) : null}

        {data && verdict ? (
          <View style={{ alignItems: 'center', gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: verdict.wash, borderRadius: radius.full, paddingHorizontal: 18, paddingVertical: 8 }}>
              <Icon sf={verdict.sf} md={verdict.md} size={20} color={verdict.ink} />
              <Text style={{ fontFamily: fonts.heavy, fontSize: 18, lineHeight: 24, color: verdict.ink }}>{statusLabel(data.effectiveStatus).label}</Text>
            </View>
            <Text style={[text.footnote, tabular, { color: colors.muted }]}>
              {permit.isRefetching ? 'Đang kiểm tra lại với máy chủ…' : `Kiểm tra với máy chủ lúc ${formatVietnamTime(permit.dataUpdatedAt)}`}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 32, paddingBottom: 14 }}>
        <Icon sf="sun.max.fill" md="light_mode" size={16} color={colors.primary} />
        <Text style={[text.footnote, { color: colors.muted, textAlign: 'center', flexShrink: 1 }]}>Tăng độ sáng màn hình nếu cán bộ quét chưa được.</Text>
      </View>
      <View style={{ paddingBottom: insets.bottom, backgroundColor: colors.kerbPaint }}>
        <KerbStrip height={12} segment={26} />
      </View>
    </View>
  );
}
