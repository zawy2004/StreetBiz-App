import { Text, View } from 'react-native';

import { Icon } from '@/components/common/Icon';
import { PermitQr } from '@/components/common/PermitQr';
import { PermitStamp } from '@/components/status/PermitStamp';
import { StatusPill } from '@/components/status/StatusPill';
import type { DigitalPermit, RentalContract } from '@/core/api/types';
import { statusLabel } from '@/core/constants/status-labels';
import { colors, fonts, radius, sign, statusTones, tabular, text } from '@/theme';
import { Pass } from '@/ui';
import { contractProgress, formatDate } from '@/utils/format';
import { selectableText } from '@/utils/platform';

type Props = {
  permit: DigitalPermit;
  contract: RentalContract | undefined;
  qrSize: number;
};

/**
 * The permit as the pass a vendor hands the officer (v5 `Pass`): an orange band, the slot code
 * as a street plate in sign lettering with the ward's stamp pressed beside it, the real QR on
 * white paper, the fallback code; under the tear line, the boarding-pass fields. Only the
 * stamp moves, once, when a valid permit first appears. An invalid permit keeps a grey band,
 * no stamp, and a faded QR across which it says so.
 */
export function PermitPass({ permit, contract, qrSize }: Props) {
  const valid = permit.effectiveStatus === 'VALID';
  const { label, tone } = statusLabel(permit.effectiveStatus);
  const verdict = statusTones[tone];
  const progress = contractProgress(permit.startDate, permit.endDate, new Date());

  return (
    <Pass
      accent={valid ? colors.brand : colors.line}
      head={
        <View style={{ gap: 18 }}>
          {/* Whose paper this is */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 30, height: 30, borderRadius: radius.full, backgroundColor: valid ? colors.brandTint : colors.sunken, alignItems: 'center', justifyContent: 'center' }}>
              <Icon sf="building.columns.fill" md="account_balance" size={15} color={valid ? colors.primary : colors.muted} />
            </View>
            <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.ink }}>Giấy phép vỉa hè</Text>
            <Text selectable={selectableText} style={[{ fontFamily: fonts.code, fontSize: 16, lineHeight: 20, color: colors.muted }, tabular]}>
              Số {permit.permitId}
            </Text>
          </View>

          {/* The slot's plate, sign-sized, and the ward's stamp beside it */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 92 }}>
            <View style={{ flex: 1, gap: 8 }}>
              {contract ? (
                <>
                  <View
                    accessibilityLabel={`Ô ${contract.slotCode}`}
                    style={{ alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 4, borderRadius: radius.plate, backgroundColor: valid ? colors.plate : colors.muted, borderWidth: 3, borderColor: colors.white, boxShadow: `0 0 0 2px ${valid ? colors.plate : colors.muted}` }}
                  >
                    <Text selectable={selectableText} maxFontSizeMultiplier={1.3} style={[sign.figure, tabular, { color: colors.white, letterSpacing: 1 }]}>
                      {contract.slotCode}
                    </Text>
                  </View>
                  <Text numberOfLines={2} style={{ fontFamily: fonts.semibold, fontSize: 14.5, lineHeight: 20, color: colors.ink }}>
                    {contract.zoneName}
                  </Text>
                </>
              ) : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <StatusPill label={label} tone={tone} />
                <Text style={[text.footnote, tabular, { color: valid ? verdict.ink : colors.muted, fontFamily: fonts.bold }]}>
                  {valid ? `Còn ${progress.daysLeft} ngày hiệu lực` : `Hợp đồng: ${statusLabel(permit.contractStatus).label}`}
                </Text>
              </View>
            </View>
            {valid ? <PermitStamp key={permit.permitId} size={92} ink={verdict.ink} animate /> : null}
          </View>

          {/* The real, signed QR on white paper */}
          <View style={{ alignItems: 'center', gap: 10 }}>
            <View style={{ padding: 12, borderRadius: radius.photo, borderCurve: 'continuous', backgroundColor: colors.white, borderWidth: 1.5, borderColor: valid ? colors.brandTint : colors.line }}>
              <View style={{ opacity: valid ? 1 : 0.3 }}>
                <PermitQr value={permit.qrPayload} size={qrSize} />
              </View>
              {valid ? null : (
                <View
                  pointerEvents="none"
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: radius.photo }}
                >
                  <View style={{ width: '150%', transform: [{ rotate: '-24deg' }], backgroundColor: verdict.wash, paddingVertical: 8, alignItems: 'center', borderTopWidth: 2, borderBottomWidth: 2, borderColor: verdict.ink }}>
                    <Text style={{ fontFamily: fonts.heavy, fontSize: 16, color: verdict.ink }}>Không có hiệu lực</Text>
                  </View>
                </View>
              )}
            </View>
            <Text style={[text.callout, { color: colors.ink, fontFamily: fonts.semibold, textAlign: 'center' }]}>
              {valid ? 'Đưa mã này cho cán bộ phường quét.' : 'Giấy phép này hiện không có hiệu lực.'}
            </Text>
            <Text selectable={selectableText} style={{ fontFamily: fonts.code, fontSize: 13, lineHeight: 17, color: colors.ink, textAlign: 'center' }}>
              {permit.qrPayload}
            </Text>
            <Text style={[text.caption, { fontFamily: fonts.regular, color: colors.muted, textAlign: 'center', paddingHorizontal: 8 }]}>
              Mã dự phòng: nếu không quét được, cán bộ nhập dãy ký tự trên.
            </Text>
          </View>
        </View>
      }
      stub={
        <View style={{ gap: 14 }}>
          <View style={{ flexDirection: 'row' }}>
            <Field label="Hiệu lực từ" value={formatDate(permit.startDate)} mono />
            <Field label="Đến hết" value={formatDate(permit.endDate)} alignEnd mono />
          </View>
          {valid ? (
            <View
              accessibilityRole="progressbar"
              accessibilityLabel="Thời hạn đã dùng"
              accessibilityValue={{ min: 0, max: 100, now: progress.percent }}
              style={{ height: 8, borderRadius: radius.full, backgroundColor: colors.sunken, overflow: 'hidden' }}
            >
              <View style={{ width: `${progress.percent}%`, height: 8, borderRadius: radius.full, backgroundColor: progress.expiringSoon ? colors.mango : colors.leaf }} />
            </View>
          ) : null}
          <View style={{ flexDirection: 'row' }}>
            <Field label="Hợp đồng" value={`#${permit.contractId}`} mono />
            <Field label="Trạng thái hợp đồng" value={statusLabel(permit.contractStatus).label} alignEnd />
          </View>
        </View>
      }
    />
  );
}

function Field({ label, value, alignEnd, mono }: { label: string; value: string; alignEnd?: boolean; mono?: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: alignEnd ? 'flex-end' : 'flex-start', gap: 2 }}>
      <Text style={[text.caption, { color: colors.muted }]}>{label}</Text>
      <Text selectable={selectableText} style={[mono ? { fontFamily: fonts.code, fontSize: 19, lineHeight: 24 } : text.headline, tabular, { color: colors.ink, textAlign: alignEnd ? 'right' : 'left' }]}>
        {value}
      </Text>
    </View>
  );
}
