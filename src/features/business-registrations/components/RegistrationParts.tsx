import { Text, View } from 'react-native';

import { Icon } from '@/components/common/Icon';
import { PressableScale } from '@/components/common/PressableScale';
import { StatusPill } from '@/components/status/StatusPill';
import type { ApiRegistration } from '@/core/api';
import { statusLabel } from '@/core/constants/status-labels';
import { hkdCode } from '@/features/sidewalk-slots/slot-format';
import { colors, fonts, radius, statusTones, text } from '@/theme';
import { vendorTypeLabel } from '../labels';
import { registrationTrack, type TrackStep } from '../registration-track';

const STOP_COLOR: Record<TrackStep['state'], { fill: string; ink: string; icon?: { sf: string; md: string } }> = {
  done: { fill: colors.leaf, ink: colors.white, icon: { sf: 'checkmark', md: 'check' } },
  current: { fill: colors.cta, ink: colors.white },
  todo: { fill: colors.sunken, ink: colors.muted },
  returned: { fill: colors.mango, ink: colors.onMango, icon: { sf: 'arrow.uturn.backward', md: 'undo' } },
  paused: { fill: colors.mangoTint, ink: colors.onMango, icon: { sf: 'pause.fill', md: 'pause' } },
  approved: { fill: colors.leaf, ink: colors.white, icon: { sf: 'checkmark.seal.fill', md: 'verified' } },
  rejected: { fill: colors.danger, ink: colors.white, icon: { sf: 'xmark', md: 'close' } },
  withdrawn: { fill: colors.line, ink: colors.muted, icon: { sf: 'minus', md: 'remove' } },
};

/** "Đã nộp → Phường xét → Kết quả", the parcel-tracking line of a registration. */
export function TrackLine({ registration }: { registration: Pick<ApiRegistration, 'registrationStatus' | 'createdAt' | 'reviewedAt'> }) {
  const model = registrationTrack(registration.registrationStatus, registration.createdAt, registration.reviewedAt);
  const lineInk = statusTones[model.tone].ink;
  return (
    <View
      accessibilityLabel={model.steps.map((s) => `${s.label}${s.note ? ` ${s.note}` : ''}`).join(', ')}
      style={{ flexDirection: 'row', alignItems: 'flex-start' }}
    >
      {model.steps.map((s, i) => {
        const c = STOP_COLOR[s.state];
        const isCurrent = i === model.currentIndex;
        return (
          <View key={s.key} style={{ flex: 1, alignItems: 'center', gap: 5 }}>
            <View style={{ width: '100%', flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i === 0 ? 'transparent' : model.progress >= i / 2 ? lineInk : colors.line }} />
              <View
                style={{
                  width: isCurrent ? 26 : 22,
                  height: isCurrent ? 26 : 22,
                  borderRadius: 13,
                  backgroundColor: c.fill,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: isCurrent ? 3 : 0,
                  borderColor: colors.card,
                  boxShadow: isCurrent ? `0 0 0 2px ${c.fill}` : undefined,
                }}
              >
                {c.icon ? <Icon sf={c.icon.sf} md={c.icon.md} size={11} color={c.ink} weight="bold" /> : null}
              </View>
              <View style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i === model.steps.length - 1 ? 'transparent' : model.progress > i / 2 ? lineInk : colors.line }} />
            </View>
            <Text style={{ fontFamily: isCurrent ? fonts.bold : fonts.medium, fontSize: 12.5, color: isCurrent ? colors.ink : colors.muted }}>
              {s.label}
            </Text>
            {s.note ? <Text style={[text.caption, { color: colors.muted, fontFamily: fonts.regular }]}>{s.note}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

/** A registration as a folder: name, type, HKD code, status, and where it stands. */
export function RegistrationCard({ registration, onPress }: { registration: ApiRegistration; onPress: () => void }) {
  const { label, tone } = statusLabel(registration.registrationStatus);
  const needsAction = registration.registrationStatus === 'MORE_INFORMATION_REQUIRED';
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={`${registration.displayName}, ${vendorTypeLabel(registration.vendorType)}, ${label}`}
      style={{
        borderRadius: radius.card,
        borderCurve: 'continuous',
        backgroundColor: colors.card,
        overflow: 'hidden',
        borderWidth: needsAction ? 1.5 : 0,
        borderColor: colors.mango,
      }}
    >
      <View style={{ height: 5, backgroundColor: statusTones[tone].ink, opacity: 0.85 }} />
      <View style={{ padding: 16, gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          <View style={{ width: 44, height: 44, borderRadius: 13, borderCurve: 'continuous', backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
            <Icon
              sf={registration.vendorType === 'FIXED_STOREFRONT' ? 'storefront.fill' : 'cart.fill'}
              md={registration.vendorType === 'FIXED_STOREFRONT' ? 'storefront' : 'shopping_cart'}
              size={21}
              color={colors.primary}
            />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={[text.headline, { color: colors.ink }]} numberOfLines={2}>
              {registration.displayName}
            </Text>
            <Text style={[text.footnote, { color: colors.muted }]}>
              {vendorTypeLabel(registration.vendorType)}, {hkdCode(registration.registrationId)}
            </Text>
          </View>
          <StatusPill label={label} tone={tone} />
        </View>
        <TrackLine registration={registration} />
        {needsAction && registration.reviewDecisionReason ? (
          <View style={{ flexDirection: 'row', gap: 8, padding: 12, borderRadius: 12, backgroundColor: colors.mangoTint }}>
            <Icon sf="text.bubble.fill" md="chat" size={15} color={colors.onMango} style={{ marginTop: 2 }} />
            <Text style={[text.footnote, { flex: 1, color: colors.onMango }]} numberOfLines={3}>
              Phường: {registration.reviewDecisionReason}
            </Text>
          </View>
        ) : null}
      </View>
    </PressableScale>
  );
}
