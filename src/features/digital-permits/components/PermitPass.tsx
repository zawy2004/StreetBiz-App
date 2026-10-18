import { LinearGradient } from 'expo-linear-gradient';
import { Text, View } from 'react-native';

import { Icon } from '@/components/common/Icon';
import { KerbStrip } from '@/components/common/KerbStrip';
import { PermitQr } from '@/components/common/PermitQr';
import { PermitStamp } from '@/components/status/PermitStamp';
import type { DigitalPermit, RentalContract } from '@/core/api/types';
import { statusLabel } from '@/core/constants/status-labels';
import { colors, fonts, radius, shadow, statusTones, tabular, text } from '@/theme';
import { contractProgress, formatDate } from '@/utils/format';
import { selectableText } from '@/utils/platform';

type Props = {
  permit: DigitalPermit;
  contract: RentalContract | undefined;
  qrSize: number;
};

/**
 * The permit as a pass in a wallet: an orange header band with the slot code as the big
 * figure, the verdict in words, the QR on white, a tear line, then boarding-pass fields.
 * Nothing moves except the ward stamp, pressed once when a valid permit first appears.
 */
export function PermitPass({ permit, contract, qrSize }: Props) {
  const valid = permit.effectiveStatus === 'VALID';
  const { label, tone } = statusLabel(permit.effectiveStatus);
  const verdict = statusTones[tone];
  const progress = contractProgress(permit.startDate, permit.endDate, new Date());
  const band = valid ? colors.cta : '#5F6B7A';

  return (
    <View
      accessibilityLabel={`Giấy phép vỉa hè số ${permit.permitId}, ô ${contract?.slotCode ?? ''}, ${label}`}
      style={{
        borderRadius: radius.pass,
        borderCurve: 'continuous',
        backgroundColor: colors.card,
        boxShadow: shadow.raised,
      }}
    >
      {/* Header band */}
      <View
        style={{
          backgroundColor: band,
          borderTopLeftRadius: radius.pass,
          borderTopRightRadius: radius.pass,
          borderCurve: 'continuous',
          overflow: 'hidden',
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: 18,
          gap: 10,
        }}
      >
        {valid ? (
          // Vivid orange, deepest behind the small labels at the top left
          <LinearGradient
            colors={[colors.cta, colors.brand, colors.brandLight]}
            locations={[0, 0.6, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
          />
        ) : null}
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon sf="building.columns.fill" md="account_balance" size={15} color={colors.white} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.white }}>
              Giấy phép vỉa hè
            </Text>
          </View>
          <Text style={[{ fontFamily: fonts.code, fontSize: 16, color: colors.white }, tabular]}>
            Số {permit.permitId}
          </Text>
        </View>
        {contract ? (
          <View style={{ gap: 2 }}>
            <Text
              selectable={selectableText}
              style={{
                fontFamily: fonts.code,
                fontSize: 56,
                lineHeight: 60,
                color: colors.white,
                letterSpacing: 1,
              }}
            >
              {contract.slotCode}
            </Text>
            <Text style={[text.callout, { color: 'rgba(255,255,255,0.92)' }]}>
              {contract.zoneName}
            </Text>
          </View>
        ) : null}
      </View>
      <KerbStrip />

      {/* Verdict */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 18,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <View
          style={{
            width: 46,
            height: 46,
            borderRadius: 23,
            backgroundColor: verdict.wash,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon sf={verdict.sf} md={verdict.md} size={24} color={verdict.ink} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[text.title1, { color: verdict.ink }]} accessibilityRole="header">
            {label}
          </Text>
          <Text style={[text.footnote, { color: colors.muted }]}>
            {valid
              ? `Còn ${progress.daysLeft} ngày hiệu lực`
              : `Hợp đồng: ${statusLabel(permit.contractStatus).label}`}
          </Text>
        </View>
        {valid ? (
          <View style={{ position: 'absolute', right: 10, top: 2 }}>
            <PermitStamp key={permit.permitId} size={88} ink={verdict.ink} animate />
          </View>
        ) : null}
      </View>

      {/* QR */}
      <View style={{ alignItems: 'center', paddingTop: 18, paddingBottom: 16, gap: 10 }}>
        <View
          style={{
            padding: 12,
            borderRadius: 18,
            borderCurve: 'continuous',
            backgroundColor: colors.white,
            borderWidth: 1,
            borderColor: colors.line,
          }}
        >
          <View style={{ opacity: valid ? 1 : 0.3 }}>
            <PermitQr value={permit.qrPayload} size={qrSize} />
          </View>
          {valid ? null : (
            <View
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                borderRadius: 18,
              }}
            >
              <View
                style={{
                  width: '150%',
                  transform: [{ rotate: '-24deg' }],
                  backgroundColor: verdict.wash,
                  paddingVertical: 7,
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    fontFamily: fonts.heavy,
                    fontSize: 15,
                    letterSpacing: 1.5,
                    color: verdict.ink,
                  }}
                >
                  KHÔNG CÓ HIỆU LỰC
                </Text>
              </View>
            </View>
          )}
        </View>
        <Text style={[text.footnote, { color: colors.ink, textAlign: 'center' }]}>
          {valid ? 'Đưa mã này cho cán bộ phường quét.' : 'Giấy phép này hiện không có hiệu lực.'}
        </Text>
        <Text
          selectable={selectableText}
          style={[
            {
              fontFamily: fonts.code,
              fontSize: 13,
              color: colors.ink,
              paddingHorizontal: 20,
              textAlign: 'center',
            },
          ]}
        >
          {permit.qrPayload}
        </Text>
        <Text style={[text.caption, { color: colors.muted, textAlign: 'center', paddingHorizontal: 24 }]}>
          Mã dự phòng: nếu không quét được, cán bộ nhập dãy ký tự trên.
        </Text>
      </View>

      {/* Tear line */}
      <View style={{ height: 22, justifyContent: 'center' }}>
        <View
          style={{
            position: 'absolute',
            left: -11,
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: colors.bg,
          }}
        />
        <View
          style={{
            position: 'absolute',
            right: -11,
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: colors.bg,
          }}
        />
        <View
          style={{
            marginHorizontal: 20,
            borderTopWidth: 1.5,
            borderStyle: 'dashed',
            borderColor: colors.line,
          }}
        />
      </View>

      {/* Boarding-pass fields */}
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20, gap: 14 }}>
        <View style={{ flexDirection: 'row' }}>
          <Field label="Hiệu lực từ" value={formatDate(permit.startDate)} />
          <Field label="Đến hết" value={formatDate(permit.endDate)} alignEnd />
        </View>
        {valid ? (
          <View
            accessibilityRole="progressbar"
            accessibilityLabel="Thời hạn đã dùng"
            accessibilityValue={{ min: 0, max: 100, now: progress.percent }}
            style={{
              height: 6,
              borderRadius: 3,
              backgroundColor: colors.sunken,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${progress.percent}%`,
                height: 6,
                borderRadius: 3,
                backgroundColor: progress.expiringSoon ? colors.mango : colors.leaf,
              }}
            />
          </View>
        ) : null}
        <View style={{ flexDirection: 'row' }}>
          <Field label="Hợp đồng" value={`#${permit.contractId}`} />
          <Field
            label="Trạng thái hợp đồng"
            value={statusLabel(permit.contractStatus).label}
            alignEnd
          />
        </View>
      </View>
    </View>
  );
}

function Field({ label, value, alignEnd }: { label: string; value: string; alignEnd?: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: alignEnd ? 'flex-end' : 'flex-start', gap: 2 }}>
      <Text style={[text.caption, { color: colors.muted }]}>{label}</Text>
      <Text selectable={selectableText} style={[text.headline, tabular, { color: colors.ink }]}>
        {value}
      </Text>
    </View>
  );
}
