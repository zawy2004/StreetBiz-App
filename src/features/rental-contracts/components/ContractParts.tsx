import { Pressable, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Icon } from '@/components/common/Icon';
import { SlotPlate } from '@/components/common/SlotPlate';
import { StatusPill } from '@/components/status/StatusPill';
import type { RentalContract } from '@/core/api/side-api';
import { statusLabel } from '@/core/constants/status-labels';
import { contractProgress } from '@/features/sidewalk-slots/my-slots-view';
import { colors, fonts, radius, tabular, text } from '@/theme';
import { formatVietnamDate } from '@/utils/format';

/** The term as a ring that fills as it is used, the days left inside: mango in the last 14 days. */
export function TermRing({ startDate, endDate, size = 64 }: { startDate: string; endDate: string; size?: number }) {
  const p = contractProgress(startDate, endDate, new Date());
  const stroke = size > 60 ? 6 : 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const ink = p.expiringSoon ? colors.mango : colors.leaf;
  return (
    <View accessible accessibilityLabel={`Còn ${p.daysLeft} ngày, đã dùng ${p.percent}% thời hạn`} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.sunken} strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={ink} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${c} ${c}`} strokeDashoffset={c * (p.percent / 100)} />
      </Svg>
      <Text style={[{ fontFamily: fonts.code, fontSize: size > 60 ? 22 : 17, lineHeight: size > 60 ? 24 : 19, color: p.expiringSoon ? colors.onMango : colors.ink }, tabular]}>{p.daysLeft}</Text>
      <Text style={{ fontFamily: fonts.medium, fontSize: 10, color: colors.muted }}>ngày</Text>
    </View>
  );
}

/** One contract: its plate, route, term ring and the two things done most (permit, renew). */
export function ContractCard({
  contract,
  live,
  onOpen,
  onPermit,
  onRenew,
}: {
  contract: RentalContract;
  live: boolean;
  onOpen: () => void;
  onPermit: () => void;
  onRenew: () => void;
}) {
  const { label, tone } = statusLabel(contract.contractStatus);
  const active = contract.contractStatus === 'ACTIVE';
  const soon = active && contractProgress(contract.startDate, contract.endDate, new Date()).expiringSoon;
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`Hợp đồng ô ${contract.slotCode}, ${contract.zoneName}, ${label}`}
      style={({ pressed }) => ({ padding: 16, gap: 14, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: pressed ? '#FBFBFC' : colors.card, borderWidth: soon ? 2 : 0, borderColor: colors.mango, opacity: live ? 1 : 0.85 })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        {live ? <TermRing startDate={contract.startDate} endDate={contract.endDate} /> : null}
        <View style={{ flex: 1, gap: 5 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <SlotPlate code={contract.slotCode} />
            <StatusPill label={label} tone={tone} />
          </View>
          <Text style={[text.subhead, { color: colors.ink }]} numberOfLines={1}>
            {contract.zoneName}
          </Text>
          <Text style={[text.caption, { color: colors.muted }, tabular]}>
            {formatVietnamDate(contract.startDate)} – {formatVietnamDate(contract.endDate)}
          </Text>
        </View>
        <Icon sf="chevron.right" md="chevron_right" size={16} color={colors.muted} />
      </View>
      {active ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <CardAction icon={{ sf: 'qrcode', md: 'qr_code_2' }} label="Giấy phép QR" onPress={onPermit} primary />
          <CardAction icon={{ sf: 'calendar.badge.plus', md: 'event_repeat' }} label={soon ? 'Gia hạn ngay' : 'Gia hạn'} onPress={onRenew} attention={soon} />
        </View>
      ) : null}
    </Pressable>
  );
}

function CardAction({ icon, label, onPress, primary, attention }: { icon: { sf: string; md: string }; label: string; onPress: () => void; primary?: boolean; attention?: boolean }) {
  const bg = primary ? colors.brandTint : attention ? colors.mangoTint : colors.sunken;
  const ink = primary ? colors.primary : attention ? colors.onMango : colors.ink;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({ flex: 1, height: 44, borderRadius: 14, borderCurve: 'continuous', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: bg, opacity: pressed ? 0.75 : 1 })}
    >
      <Icon sf={icon.sf} md={icon.md} size={16} color={ink} />
      <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: ink }}>{label}</Text>
    </Pressable>
  );
}

/** The contract being acted on, small, at the top of the renewal / return / transfer forms. */
export function ContractStrip({ contract }: { contract: RentalContract }) {
  const live = contract.contractStatus === 'ACTIVE' || contract.contractStatus === 'SUSPENDED';
  const { label, tone } = statusLabel(contract.contractStatus);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card }}>
      {live ? <TermRing startDate={contract.startDate} endDate={contract.endDate} size={56} /> : null}
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <SlotPlate code={contract.slotCode} />
          {!live ? <StatusPill label={label} tone={tone} /> : null}
        </View>
        <Text style={[text.subhead, { color: colors.ink }]} numberOfLines={1}>
          {contract.zoneName}
        </Text>
        <Text style={[text.caption, { color: colors.muted }, tabular]}>
          {formatVietnamDate(contract.startDate)} – {formatVietnamDate(contract.endDate)}
        </Text>
      </View>
    </View>
  );
}

/** Sent → receiver agrees → ward approves; the step being waited on is orange. */
export function TransferSteps({ steps, labels }: { steps: ('done' | 'current' | 'todo')[]; labels: readonly string[] }) {
  return (
    <View style={{ flexDirection: 'row' }}>
      {steps.map((s, i) => {
        const bg = s === 'done' ? colors.leaf : s === 'current' ? colors.cta : colors.sunken;
        return (
          <View key={labels[i]} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            <View style={{ height: 26, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' }}>
              {i > 0 ? <View style={{ position: 'absolute', left: 0, right: '50%', height: 3, backgroundColor: s === 'todo' ? colors.line : colors.leaf }} /> : null}
              {i < steps.length - 1 ? <View style={{ position: 'absolute', left: '50%', right: 0, height: 3, backgroundColor: steps[i + 1] === 'todo' ? colors.line : colors.leaf }} /> : null}
              <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.card }}>
                {s === 'done' ? <Icon sf="checkmark" md="check" size={11} color={colors.white} weight="bold" /> : s === 'current' ? <Icon sf="clock" md="schedule" size={11} color={colors.white} /> : null}
              </View>
            </View>
            <Text style={[text.caption, { color: s === 'todo' ? colors.muted : colors.ink, textAlign: 'center' }]}>{labels[i]}</Text>
          </View>
        );
      })}
    </View>
  );
}
