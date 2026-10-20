import { Text, View } from 'react-native';

import { Icon } from '@/components/common/Icon';
import { PressableScale } from '@/components/common/PressableScale';
import { StatusPill } from '@/components/status/StatusPill';
import type { ApiRegistration } from '@/core/api';
import { statusLabel } from '@/core/constants/status-labels';
import { hkdCode } from '@/features/sidewalk-slots/slot-format';
import { colors, fonts, radius, shadow, statusTones, text } from '@/theme';
import { Plate } from '@/ui';
import { vendorTypeLabel } from '../labels';
import { registrationTrack, type TrackStep } from '../registration-track';

const STOP_COLOR: Record<TrackStep['state'], { fill: string; ink: string; icon?: { sf: string; md: string } }> = {
  done: { fill: colors.leaf, ink: colors.white, icon: { sf: 'checkmark', md: 'check' } },
  current: { fill: colors.cta, ink: colors.white, icon: { sf: 'ellipsis', md: 'more_horiz' } },
  todo: { fill: colors.sunken, ink: colors.muted },
  returned: { fill: colors.sticker, ink: colors.plate, icon: { sf: 'arrow.uturn.backward', md: 'undo' } },
  paused: { fill: colors.mangoTint, ink: colors.onMango, icon: { sf: 'pause.fill', md: 'pause' } },
  approved: { fill: colors.leaf, ink: colors.white, icon: { sf: 'checkmark.seal.fill', md: 'verified' } },
  rejected: { fill: colors.danger, ink: colors.white, icon: { sf: 'xmark', md: 'close' } },
  withdrawn: { fill: colors.line, ink: colors.muted, icon: { sf: 'minus', md: 'remove' } },
};

/**
 * "Đã nộp → Phường xét → Kết quả", the parcel-tracking line of a registration (v5): three round
 * stops on a painted line, the stop the file is at ringed and larger, its date under it.
 */
export function TrackLine({ registration }: { registration: Pick<ApiRegistration, 'registrationStatus' | 'createdAt' | 'reviewedAt'> }) {
  const model = registrationTrack(registration.registrationStatus, registration.createdAt, registration.reviewedAt);
  const lineInk = statusTones[model.tone].ink;
  return (
    <View
      accessible
      accessibilityLabel={model.steps.map((s) => `${s.label}${s.note ? ` ${s.note}` : ''}`).join(', ')}
      style={{ flexDirection: 'row', alignItems: 'flex-start' }}
    >
      {model.steps.map((s, i) => {
        const c = STOP_COLOR[s.state];
        const isCurrent = i === model.currentIndex;
        const size = isCurrent ? 32 : 26;
        return (
          <View key={s.key} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
            <View style={{ width: '100%', height: 32, flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1, height: 4, borderRadius: radius.full, backgroundColor: i === 0 ? 'transparent' : model.progress >= i / 2 ? lineInk : colors.line }} />
              <View
                style={{
                  width: size,
                  height: size,
                  borderRadius: radius.full,
                  backgroundColor: c.fill,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: isCurrent ? 3 : 0,
                  borderColor: colors.card,
                  boxShadow: isCurrent ? `0 0 0 2px ${c.fill}` : undefined,
                }}
              >
                {c.icon ? <Icon sf={c.icon.sf} md={c.icon.md} size={isCurrent ? 13 : 12} color={c.ink} weight="bold" /> : null}
              </View>
              <View style={{ flex: 1, height: 4, borderRadius: radius.full, backgroundColor: i === model.steps.length - 1 ? 'transparent' : model.progress > i / 2 ? lineInk : colors.line }} />
            </View>
            <Text style={{ fontFamily: isCurrent ? fonts.heavy : fonts.semibold, fontSize: 13, lineHeight: 17, color: isCurrent ? colors.ink : colors.muted, textAlign: 'center' }}>
              {s.label}
            </Text>
            {s.note ? <Text style={[text.caption, { color: isCurrent ? lineInk : colors.muted, fontFamily: isCurrent ? fonts.bold : fonts.regular, textAlign: 'center', marginTop: -4 }]}>{s.note}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

/**
 * A registration as a folder (v5): a band in the status colour, the HKD street plate and the
 * verdict, the household's name, where it stands on the tracking line, and the ward's words
 * when it asks for more.
 */
export function RegistrationCard({ registration, onPress }: { registration: ApiRegistration; onPress: () => void }) {
  const { label, tone } = statusLabel(registration.registrationStatus);
  const needsAction = registration.registrationStatus === 'MORE_INFORMATION_REQUIRED';
  const fixed = registration.vendorType === 'FIXED_STOREFRONT';
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={`${registration.displayName}, ${vendorTypeLabel(registration.vendorType)}, ${hkdCode(registration.registrationId)}, ${label}`}
      style={{
        borderRadius: radius.card,
        borderCurve: 'continuous',
        backgroundColor: colors.card,
        overflow: 'hidden',
        borderWidth: needsAction ? 2 : 0,
        borderColor: colors.sticker,
        boxShadow: shadow.card,
      }}
    >
      <View style={{ height: 6, backgroundColor: statusTones[tone].ink }} />
      <View style={{ padding: 18, gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Plate code={hkdCode(registration.registrationId)} />
          <View style={{ flex: 1 }} />
          <StatusPill label={label} tone={tone} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 48, height: 48, borderRadius: radius.full, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
            <Icon sf={fixed ? 'storefront.fill' : 'cart.fill'} md={fixed ? 'storefront' : 'shopping_cart'} size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontFamily: fonts.heavy, fontSize: 17.5, lineHeight: 23, color: colors.ink }} numberOfLines={2}>
              {registration.displayName}
            </Text>
            <Text style={[text.footnote, { color: colors.muted }]}>{vendorTypeLabel(registration.vendorType)}</Text>
          </View>
          <Icon sf="chevron.right" md="chevron_right" size={13} color={colors.muted} />
        </View>
        <TrackLine registration={registration} />
        {needsAction && registration.reviewDecisionReason ? (
          <View style={{ flexDirection: 'row', gap: 10, padding: 12, borderRadius: radius.control, borderCurve: 'continuous', backgroundColor: colors.mangoTint }}>
            <Icon sf="text.bubble.fill" md="chat" size={16} color={colors.onMango} style={{ marginTop: 1 }} />
            <Text style={[text.footnote, { flex: 1, color: colors.onMango }]} numberOfLines={3}>
              <Text style={{ fontFamily: fonts.bold }}>Phường: </Text>
              {registration.reviewDecisionReason}
            </Text>
          </View>
        ) : null}
      </View>
    </PressableScale>
  );
}
