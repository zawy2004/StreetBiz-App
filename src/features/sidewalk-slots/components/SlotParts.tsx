import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { SlotPlate } from '@/components/common/SlotPlate';
import { apiAssetUrl } from '@/core/api/asset-url';
import type { SidewalkSlot, SidewalkZone } from '@/core/api/side-api';
import { colors, fonts, radius, tabular, text } from '@/theme';
import { formatVnd } from '@/utils/format';
import { occupancyLabel } from '../plan-labels';
import { deadlineText, formatHours, formatSize, rentPrice } from '../slot-format';
import { BUSINESS_CATEGORY_LABELS, type SlotCounts, type SlotDisplayState } from '../slot-stats';
import { SLOT_STATE } from '../slot-tones';

/** The state as a word and a glyph on the state's own wash (never colour alone). */
export function SlotStateChip({ state, small }: { state: SlotDisplayState; small?: boolean }) {
  const t = SLOT_STATE[state];
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 5,
        borderRadius: 999,
        paddingHorizontal: small ? 8 : 10,
        paddingVertical: small ? 3 : 5,
        backgroundColor: t.wash,
        borderWidth: state === 'HELD' ? 1 : 0,
        borderStyle: 'dashed',
        borderColor: t.ink,
      }}
    >
      <Icon sf={t.icon.sf} md={t.icon.md} size={small ? 12 : 14} color={t.ink} />
      <Text style={{ fontFamily: fonts.bold, fontSize: small ? 11.5 : 12.5, color: t.ink }}>{t.label}</Text>
    </View>
  );
}

/** Rent as the money figure plus its unit ("/tháng" for a fixed spot, "/ngày" for an event). */
export function RentFigure({ slot, size = 17 }: { slot: Pick<SidewalkSlot, 'rentalMode' | 'pricePerDay' | 'monthlyPrice'>; size?: number }) {
  const price = rentPrice(slot);
  return (
    <Text style={[{ fontFamily: fonts.heavy, fontSize: size, color: colors.primary }, tabular]}>
      {formatVnd(price.amount)}
      <Text style={{ fontFamily: fonts.medium, fontSize: size * 0.72, color: colors.muted }}> /{price.unit}</Text>
    </Text>
  );
}

const AMENITIES = [
  { key: 'hasPower', label: 'Điện', sf: 'bolt.fill', md: 'bolt' },
  { key: 'hasWater', label: 'Nước', sf: 'drop.fill', md: 'water_drop' },
  { key: 'hasTrashBin', label: 'Thùng rác', sf: 'trash.fill', md: 'delete' },
] as const;

/** The three utilities, each said as "có" or struck through. */
export function AmenityRow({ slot, compact }: { slot: Pick<SidewalkSlot, 'hasPower' | 'hasWater' | 'hasTrashBin'>; compact?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', gap: compact ? 6 : 8, flexWrap: 'wrap' }}>
      {AMENITIES.map((a) => {
        const on = slot[a.key];
        if (compact && !on) return null;
        return (
          <View
            key={a.key}
            accessibilityLabel={`${on ? 'Có' : 'Không có'} ${a.label.toLowerCase()}`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: compact ? 7 : 12,
              height: compact ? 24 : 40,
              flex: compact ? undefined : 1,
              justifyContent: 'center',
              borderRadius: compact ? 8 : 12,
              borderCurve: 'continuous',
              backgroundColor: on ? colors.leafTint : colors.sunken,
            }}
          >
            <Icon sf={a.sf} md={a.md} size={compact ? 12 : 15} color={on ? colors.onLeaf : colors.muted} />
            <Text
              style={{
                fontFamily: on ? fonts.semibold : fonts.regular,
                fontSize: compact ? 11.5 : 13.5,
                color: on ? colors.onLeaf : colors.muted,
                textDecorationLine: on ? 'none' : 'line-through',
              }}
            >
              {a.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/**
 * One slot in the route's list: its cover (or a state-coloured bay), the code plate, rent,
 * size and hours, and its state. A held slot gets a dashed edge.
 */
export function SlotRowCard({
  slot,
  state,
  mine,
  onPress,
}: {
  slot: SidewalkSlot;
  state: SlotDisplayState;
  /** The caller holds this slot. */
  mine?: boolean;
  onPress: () => void;
}) {
  const t = SLOT_STATE[state];
  const size = formatSize(slot.widthMeters, slot.lengthMeters);
  const cover = slot.imageUrls[0];
  const closed = state === 'ACTIVE' || state === 'SUSPENDED';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Ô ${slot.slotCode}, ${t.label}${mine ? ', bạn đang giữ' : ''}, ${formatVnd(rentPrice(slot).amount)} một ${rentPrice(slot).unit}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        gap: 12,
        padding: 10,
        borderRadius: radius.card,
        borderCurve: 'continuous',
        backgroundColor: pressed ? '#FBFBFC' : colors.card,
        borderWidth: mine ? 2 : 0,
        borderColor: colors.cta,
        boxShadow: '0 1px 2px rgba(17, 28, 43, 0.05)',
      })}
    >
      <View
        style={{
          width: 88,
          height: 88,
          borderRadius: 14,
          borderCurve: 'continuous',
          overflow: 'hidden',
          backgroundColor: t.wash,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: state === 'HELD' ? 1.5 : 0,
          borderStyle: 'dashed',
          borderColor: t.ink,
        }}
      >
        {cover ? (
          <Image source={{ uri: apiAssetUrl(cover) }} style={{ width: '100%', height: '100%', opacity: closed ? 0.55 : 1 }} contentFit="cover" transition={150} recyclingKey={cover} />
        ) : (
          <Icon sf={t.icon.sf} md={t.icon.md} size={28} color={t.ink} />
        )}
        <SlotPlate code={slot.slotCode} style={{ position: 'absolute', left: 6, bottom: 6 }} />
      </View>
      <View style={{ flex: 1, gap: 5, paddingVertical: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <RentFigure slot={slot} size={16} />
          {mine ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: colors.brandTint }}>
              <Icon sf="bookmark.fill" md="bookmark" size={11} color={colors.primary} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: colors.primary }}>Bạn giữ</Text>
            </View>
          ) : (
            <SlotStateChip state={state} small />
          )}
        </View>
        <Text style={[text.footnote, { color: colors.ink }]} numberOfLines={1}>
          {[size ?? 'Chưa đo', formatHours(slot.availableFrom, slot.availableTo)].join(' · ')}
        </Text>
        <Text style={[text.caption, { color: colors.muted }]} numberOfLines={1}>
          {slot.businessCategory ? BUSINESS_CATEGORY_LABELS[slot.businessCategory] : 'Chưa phân ngành'}
          {slot.tenantName ? ` · ${slot.tenantName}` : ''}
        </Text>
        <AmenityRow slot={slot} compact />
      </View>
    </Pressable>
  );
}

const OCCUPANCY: { key: keyof Omit<SlotCounts, 'total'>; label: string; state: SlotDisplayState }[] = [
  { key: 'available', label: 'Còn trống', state: 'AVAILABLE' },
  { key: 'pending', label: 'Có đơn / giữ', state: 'PENDING' },
  { key: 'active', label: 'Đã thuê', state: 'ACTIVE' },
  { key: 'suspended', label: 'Tạm ngưng', state: 'SUSPENDED' },
];

/**
 * The route as a street-name plate: name, segment, price and hours, the deadline, and one
 * occupancy bar that doubles as the colour legend.
 */
export function ZonePlateCard({
  zoneName,
  zone,
  counts,
  nowMs,
}: {
  zoneName: string;
  zone: SidewalkZone | undefined;
  counts: SlotCounts;
  nowMs: number;
}) {
  const deadline = zone?.applicationDeadline ? deadlineText(zone.applicationDeadline, nowMs) : null;
  const closed = deadline === 'Đã hết hạn nộp';
  const total = Math.max(counts.total, 1);
  return (
    <View style={{ borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, overflow: 'hidden' }}>
      <View style={{ padding: 16, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          <View style={{ width: 40, height: 40, borderRadius: 12, borderCurve: 'continuous', backgroundColor: colors.signTint, alignItems: 'center', justifyContent: 'center' }}>
            <Icon sf="signpost.right.fill" md="signpost" size={20} color={colors.sign} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text accessibilityRole="header" style={{ fontFamily: fonts.heavy, fontSize: 19, lineHeight: 25, color: colors.ink }} numberOfLines={2}>
              {zoneName || 'Tuyến vỉa hè'}
            </Text>
            {zone ? (
              <Text style={[text.footnote, { color: colors.muted }]} numberOfLines={2}>
                {zone.segmentFrom && zone.segmentTo ? `${zone.segmentFrom} ⇄ ${zone.segmentTo} · ` : ''}
                {zone.wardName}
              </Text>
            ) : null}
          </View>
        </View>
        {zone ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            <InfoPill icon={{ sf: 'banknote.fill', md: 'payments' }} label={`${formatVnd(rentPrice(zone).amount)}/${rentPrice(zone).unit}`} />
            <InfoPill icon={{ sf: 'clock.fill', md: 'schedule' }} label={formatHours(zone.availableFrom, zone.availableTo)} />
            {zone.rentalMode === 'EVENT' ? <InfoPill icon={{ sf: 'flag.fill', md: 'flag' }} label="Khu sự kiện" /> : null}
            {deadline ? (
              <InfoPill
                icon={{ sf: 'timer', md: 'timer' }}
                label={deadline}
                wash={closed ? colors.dangerTint : colors.mangoTint}
                ink={closed ? colors.onDanger : colors.onMango}
              />
            ) : null}
          </View>
        ) : null}
        <View style={{ gap: 8 }}>
          <View accessible accessibilityLabel={occupancyLabel(counts)} style={{ flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', backgroundColor: colors.sunken, gap: 2 }}>
            {OCCUPANCY.map((s) =>
              counts[s.key] > 0 ? (
                <View key={s.key} style={{ width: `${(counts[s.key] / total) * 100}%`, backgroundColor: SLOT_STATE[s.state].swatch }} />
              ) : null,
            )}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 4 }} importantForAccessibility="no-hide-descendants">
            {OCCUPANCY.map((s) => (
              <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: SLOT_STATE[s.state].swatch }} />
                <Text style={[text.caption, { color: colors.ink }, tabular]}>
                  <Text style={{ fontFamily: fonts.bold }}>{counts[s.key]}</Text> {s.label}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
      <View style={{ height: 5, flexDirection: 'row' }} importantForAccessibility="no-hide-descendants">
        {Array.from({ length: 24 }, (_, i) => (
          <View key={i} style={{ flex: 1, backgroundColor: i % 2 ? colors.white : colors.sign }} />
        ))}
      </View>
    </View>
  );
}

function InfoPill({ icon, label, wash = colors.sunken, ink = colors.ink }: { icon: { sf: string; md: string }; label: string; wash?: string; ink?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 10, height: 28, backgroundColor: wash }}>
      <Icon sf={icon.sf} md={icon.md} size={13} color={ink} />
      <Text style={[{ fontFamily: fonts.semibold, fontSize: 12.5, color: ink }, tabular]}>{label}</Text>
    </View>
  );
}

/** BR-16 not met: nothing can be held or applied for until a registration is approved. */
export function EligibilityMissing() {
  return (
    <View style={{ padding: 16, gap: 12, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.mangoTint }}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }}>
          <Icon sf="doc.text.fill" md="description" size={20} color={colors.onMango} />
        </View>
        <Text style={[text.callout, { flex: 1, color: colors.onMango, fontFamily: fonts.semibold }]}>
          Cần hồ sơ kinh doanh đã được duyệt để giữ chỗ hoặc nộp đơn thuê.
        </Text>
      </View>
      <Button label="Xem hồ sơ đăng ký" variant="secondary" icon={{ sf: 'folder.fill', md: 'folder' }} onPress={() => router.push('/vendor/home/registrations' as Href)} />
    </View>
  );
}

/** BR-16 met: whose approved registration the application will be filed under. */
export function EligibilityOk({ code, name }: { code: string; name: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, borderCurve: 'continuous', backgroundColor: colors.leafTint }}>
      <Icon sf="checkmark.shield.fill" md="verified_user" size={17} color={colors.onLeaf} />
      <Text style={[text.footnote, { flex: 1, color: colors.onLeaf }]}>
        Đứng tên hồ sơ <Text style={{ fontFamily: fonts.bold }}>{code}</Text>
        {name ? ` · ${name}` : ''}, đã duyệt
      </Text>
    </View>
  );
}
