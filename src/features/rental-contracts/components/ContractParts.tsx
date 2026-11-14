import { Pressable, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Icon } from '@/components/common/Icon';
import { StatusPill } from '@/components/status/StatusPill';
import type { RentalContract } from '@/core/api/side-api';
import { statusLabel } from '@/core/constants/status-labels';
import { contractProgress } from '@/features/sidewalk-slots/my-slots-view';
import { colors, fonts, radius, shadow, sign, tabular, text } from '@/theme';
import { Plate } from '@/ui';
import { formatVietnamDate } from '@/utils/format';

/** The term as a ring that fills as it is used, the days left inside in sign figures: mango in the last 14 days. */
export function TermRing({ startDate, endDate, size = 64 }: { startDate: string; endDate: string; size?: number }) {
  const p = contractProgress(startDate, endDate, new Date());
  const stroke = size > 60 ? 7 : 5.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const ink = p.expiringSoon ? colors.mango : colors.leaf;
  const big = size > 60;
  return (
    <View accessible accessibilityLabel={`Còn ${p.daysLeft} ngày, đã dùng ${p.percent}% thời hạn`} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={p.expiringSoon ? colors.mangoTint : colors.leafTint} strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={ink} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${c} ${c}`} strokeDashoffset={c * (p.percent / 100)} />
      </Svg>
      <Text maxFontSizeMultiplier={1.2} style={[{ fontFamily: fonts.code, fontSize: big ? 26 : 19, lineHeight: big ? 30 : 22, color: p.expiringSoon ? colors.onMango : colors.ink }, tabular]}>{p.daysLeft}</Text>
      <Text maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.bold, fontSize: big ? 11 : 10, color: colors.muted }}>ngày</Text>
    </View>
  );
}

/**
 * One contract as a small pass: the term ring, the slot's plate, the route and dates; under a
 * torn rule, the two things done most (permit, renew). A contract in its last 14 days is ringed
 * in mango and says "Gia hạn ngay".
 */
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
    <View style={{ borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadow.card, borderWidth: soon ? 2 : 0, borderColor: colors.sticker, overflow: 'hidden' }}>
      {live ? <View style={{ height: 5, backgroundColor: soon ? colors.mango : active ? colors.leaf : colors.danger }} /> : null}
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`Hợp đồng ô ${contract.slotCode}, ${contract.zoneName}, ${label}`}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, backgroundColor: pressed ? colors.pressed : 'transparent' })}
      >
        {live ? <TermRing startDate={contract.startDate} endDate={contract.endDate} /> : null}
        <View style={{ flex: 1, gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Plate code={contract.slotCode} />
            <StatusPill label={label} tone={tone} />
          </View>
          <Text style={[text.headline, { color: colors.ink }]} numberOfLines={2}>
            {contract.zoneName}
          </Text>
          <Text style={[text.footnote, { color: colors.muted }, tabular]}>
            {formatVietnamDate(contract.startDate)} – {formatVietnamDate(contract.endDate)}
          </Text>
        </View>
        <Icon sf="chevron.right" md="chevron_right" size={15} color={colors.muted} />
      </Pressable>
      {active ? (
        <>
          <View style={{ marginHorizontal: 16, borderTopWidth: 2, borderStyle: 'dashed', borderColor: colors.line }} />
          <View style={{ flexDirection: 'row', gap: 10, padding: 12 }}>
            <CardAction icon={{ sf: 'qrcode', md: 'qr_code_2' }} label="Giấy phép QR" onPress={onPermit} primary />
            <CardAction icon={{ sf: 'calendar.badge.plus', md: 'event_repeat' }} label={soon ? 'Gia hạn ngay' : 'Gia hạn'} onPress={onRenew} attention={soon} />
          </View>
        </>
      ) : null}
    </View>
  );
}

function CardAction({ icon, label, onPress, primary, attention }: { icon: { sf: string; md: string }; label: string; onPress: () => void; primary?: boolean; attention?: boolean }) {
  const bg = primary ? colors.cta : attention ? colors.sticker : colors.brandTint;
  const ink = primary ? colors.white : attention ? colors.plate : colors.primary;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 48,
        paddingVertical: 6,
        borderRadius: radius.full,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        backgroundColor: bg,
        boxShadow: primary ? shadow.glow : undefined,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}
    >
      <Icon sf={icon.sf} md={icon.md} size={17} color={ink} />
      <Text style={{ fontFamily: fonts.heavy, fontSize: 14, color: ink }}>{label}</Text>
    </Pressable>
  );
}

/** The contract being acted on, small, at the top of the renewal / return / transfer forms. */
export function ContractStrip({ contract }: { contract: RentalContract }) {
  const live = contract.contractStatus === 'ACTIVE' || contract.contractStatus === 'SUSPENDED';
  const { label, tone } = statusLabel(contract.contractStatus);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadow.card }}>
      {live ? <TermRing startDate={contract.startDate} endDate={contract.endDate} size={60} /> : null}
      <View style={{ flex: 1, gap: 5 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Plate code={contract.slotCode} />
          {!live ? <StatusPill label={label} tone={tone} /> : null}
        </View>
        <Text style={[text.headline, { color: colors.ink }]} numberOfLines={2}>
          {contract.zoneName}
        </Text>
        <Text style={[text.footnote, { color: colors.muted }, tabular]}>
          {formatVietnamDate(contract.startDate)} – {formatVietnamDate(contract.endDate)}
        </Text>
      </View>
    </View>
  );
}

/** Sent, receiver agrees, ward approves; the step being waited on is orange. */
export function TransferSteps({ steps, labels }: { steps: ('done' | 'current' | 'todo')[]; labels: readonly string[] }) {
  return (
    <View style={{ flexDirection: 'row' }}>
      {steps.map((s, i) => {
        const bg = s === 'done' ? colors.leaf : s === 'current' ? colors.cta : colors.sunken;
        return (
          <View key={labels[i]} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
            <View style={{ height: 30, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' }}>
              {i > 0 ? <View style={{ position: 'absolute', left: 0, right: '50%', height: 4, backgroundColor: s === 'todo' ? colors.line : colors.leaf }} /> : null}
              {i < steps.length - 1 ? <View style={{ position: 'absolute', left: '50%', right: 0, height: 4, backgroundColor: steps[i + 1] === 'todo' ? colors.line : colors.leaf }} /> : null}
              <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.card }}>
                {s === 'done' ? <Icon sf="checkmark" md="check" size={12} color={colors.white} weight="bold" /> : s === 'current' ? <Icon sf="clock" md="schedule" size={12} color={colors.white} /> : null}
              </View>
            </View>
            <Text style={[text.caption, { color: s === 'todo' ? colors.muted : colors.ink, textAlign: 'center' }]}>{labels[i]}</Text>
          </View>
        );
      })}
    </View>
  );
}

/** A slot's plate at pass size: ink, white rim, the code in sign figures. */
export function PassPlate({ code }: { code: string }) {
  return (
    <View
      accessibilityLabel={`Ô ${code}`}
      style={{ alignSelf: 'flex-start', paddingHorizontal: 14, minHeight: 60, justifyContent: 'center', borderRadius: radius.plate, backgroundColor: colors.plate, borderWidth: 3, borderColor: colors.white, boxShadow: shadow.card }}
    >
      <Text maxFontSizeMultiplier={1.2} style={[sign.figure, { fontSize: 36, lineHeight: 44, color: colors.white, letterSpacing: 1 }, tabular]}>
        {code}
      </Text>
    </View>
  );
}
