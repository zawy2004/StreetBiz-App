import { router } from 'expo-router';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/common/Icon';
import { PermitQr } from '@/components/common/PermitQr';
import { statusLabel } from '@/core/constants/status-labels';
import { colors, fonts, statusTones, text } from '@/theme';
import { useContract, usePermit } from '../permit-api';

/**
 * The QR alone, as large as the screen allows, on white, for scanning from a step away
 * (web V19 fullscreen). A full-screen cover with an explicit close; the permit is asked
 * of the server again on open, never reused from a cache.
 */
export function PermitQrScreen({ contractId }: { contractId: number }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const permit = usePermit(contractId);
  const contract = useContract(contractId);
  const size = Math.max(200, Math.min(width - 48, height - 340));
  const data = permit.data;
  const valid = data?.effectiveStatus === 'VALID';
  const verdict = data ? statusTones[statusLabel(data.effectiveStatus).tone] : null;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.white,
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 24,
        alignItems: 'center',
      }}
      accessibilityViewIsModal
    >
      <View
        style={{
          alignSelf: 'stretch',
          flexDirection: 'row',
          justifyContent: 'flex-end',
          paddingHorizontal: 16,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Đóng"
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: colors.sunken,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon sf="xmark" md="close" size={18} color={colors.ink} weight="bold" />
        </Pressable>
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 22 }}>
        {contract.data ? (
          <View style={{ alignItems: 'center', gap: 4 }}>
            <Text
              style={{
                fontFamily: fonts.code,
                fontSize: 48,
                lineHeight: 52,
                color: colors.ink,
                letterSpacing: 1,
              }}
            >
              {contract.data.slotCode}
            </Text>
            <Text style={[text.footnote, { color: colors.muted }]}>{contract.data.zoneName}</Text>
          </View>
        ) : null}
        {data && verdict ? (
          <>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                backgroundColor: verdict.wash,
                borderRadius: 999,
                paddingHorizontal: 16,
                paddingVertical: 8,
              }}
            >
              <Icon sf={verdict.sf} md={verdict.md} size={20} color={verdict.ink} />
              <Text style={[text.title3, { color: verdict.ink }]}>
                {statusLabel(data.effectiveStatus).label}
              </Text>
            </View>
            <View style={{ opacity: valid ? 1 : 0.3 }}>
              <PermitQr value={data.qrPayload} size={size} />
            </View>
          </>
        ) : (
          <View
            style={{ width: size, height: size, borderRadius: 18, backgroundColor: colors.sunken }}
          />
        )}
      </View>

      <Text
        style={[text.footnote, { color: colors.muted, textAlign: 'center', paddingHorizontal: 32 }]}
      >
        Tăng độ sáng màn hình nếu cán bộ quét chưa được.
      </Text>
    </View>
  );
}
