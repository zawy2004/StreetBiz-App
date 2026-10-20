import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { apiAssetUrl } from '@/core/api/asset-url';
import type { SidewalkSlot, SidewalkZone } from '@/core/api/side-api';
import { colors, fonts, radius, shadow, sign, tabular, text } from '@/theme';
import { Plate } from '@/ui';
import { formatVnd } from '@/utils/format';
import { buildCorridor, type CorridorItem } from '../corridor-model';
import { occupancyLabel } from '../plan-labels';
import { deadlineText, formatHours, formatSize, rentPrice } from '../slot-format';
import { BUSINESS_CATEGORY_LABELS, slotDisplayState, type SlotCounts, type SlotDisplayState } from '../slot-stats';
import { SLOT_STATE } from '../slot-tones';
import { FEATURE_ICONS, FEATURE_LABELS } from '../slot-visuals';
import { buildStreetLayout, slotFootprint } from '../street-geometry';

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
        borderRadius: radius.full,
        paddingHorizontal: small ? 9 : 11,
        minHeight: small ? 24 : 30,
        backgroundColor: t.wash,
        borderWidth: state === 'HELD' ? 1.5 : 0,
        borderStyle: 'dashed',
        borderColor: t.ink,
      }}
    >
      <Icon sf={t.icon.sf} md={t.icon.md} size={small ? 12 : 14} color={t.ink} />
      <Text style={{ fontFamily: fonts.bold, fontSize: small ? 11.5 : 13, color: t.ink }}>{t.label}</Text>
    </View>
  );
}

/** Rent as the money figure in sign lettering plus its unit ("/tháng" for a fixed spot, "/ngày" for an event). */
export function RentFigure({ slot, size = 17 }: { slot: Pick<SidewalkSlot, 'rentalMode' | 'pricePerDay' | 'monthlyPrice'>; size?: number }) {
  const price = rentPrice(slot);
  const figure = Math.round(size * 1.18);
  return (
    <Text maxFontSizeMultiplier={1.4} style={[{ fontFamily: fonts.code, fontSize: figure, lineHeight: Math.round(figure * 1.25), color: colors.primary }, tabular]}>
      {formatVnd(price.amount)}
      <Text style={{ fontFamily: fonts.semibold, fontSize: Math.max(12, size * 0.72), color: colors.muted }}> /{price.unit}</Text>
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
              gap: 5,
              paddingHorizontal: compact ? 8 : 12,
              paddingVertical: compact ? 3 : 8,
              minHeight: compact ? 24 : 44,
              flex: compact ? undefined : 1,
              justifyContent: 'center',
              borderRadius: compact ? radius.sticker : radius.control,
              borderCurve: 'continuous',
              backgroundColor: on ? colors.leafTint : colors.sunken,
            }}
          >
            <Icon sf={a.sf} md={a.md} size={compact ? 12 : 16} color={on ? colors.onLeaf : colors.muted} />
            <Text
              style={{
                fontFamily: on ? fonts.bold : fonts.regular,
                fontSize: compact ? 11.5 : 14,
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

/** A small fact with its glyph: the size, the trading hours. */
function Fact({ icon, label }: { icon: { sf: string; md: string }; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <Icon sf={icon.sf} md={icon.md} size={13} color={colors.muted} />
      <Text style={[text.footnote, tabular, { color: colors.ink, fontFamily: fonts.medium }]}>{label}</Text>
    </View>
  );
}

/**
 * One slot in the route's list: its photo (or the bay drawn from above in its state's wash) with
 * the street plate on it, the rent in sign figures, size and hours, and its state. A slot the
 * caller holds is ringed in orange.
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
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Ô ${slot.slotCode}, ${t.label}${mine ? ', bạn đang giữ' : ''}, ${formatVnd(rentPrice(slot).amount)} một ${rentPrice(slot).unit}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        gap: 14,
        padding: 12,
        borderRadius: radius.card,
        borderCurve: 'continuous',
        backgroundColor: colors.card,
        borderWidth: mine ? 2 : 0,
        borderColor: colors.cta,
        boxShadow: shadow.card,
        transform: [{ scale: pressed ? 0.985 : 1 }],
      })}
    >
      <View
        style={{
          width: 96,
          minHeight: 96,
          borderRadius: radius.photo,
          borderCurve: 'continuous',
          overflow: 'hidden',
          backgroundColor: t.wash,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: cover ? 0 : 2,
          borderStyle: 'dashed',
          borderColor: t.swatch,
        }}
      >
        {cover ? (
          <Image source={{ uri: apiAssetUrl(cover) }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" transition={150} recyclingKey={cover} />
        ) : (
          <Icon sf={t.icon.sf} md={t.icon.md} size={26} color={t.ink} />
        )}
        <Plate code={slot.slotCode} style={{ position: 'absolute', left: 6, bottom: 6 }} />
      </View>
      <View style={{ flex: 1, gap: 6, paddingVertical: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
          {mine ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.full, paddingHorizontal: 9, minHeight: 24, backgroundColor: colors.cta }}>
              <Icon sf="bookmark.fill" md="bookmark" size={11} color={colors.white} />
              <Text style={{ fontFamily: fonts.heavy, fontSize: 11.5, color: colors.white }}>Bạn đang giữ</Text>
            </View>
          ) : (
            <SlotStateChip state={state} small />
          )}
        </View>
        <RentFigure slot={slot} size={16} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 2 }}>
          <Fact icon={{ sf: 'ruler', md: 'straighten' }} label={size ?? 'Chưa đo'} />
          <Fact icon={{ sf: 'clock', md: 'schedule' }} label={formatHours(slot.availableFrom, slot.availableTo)} />
        </View>
        <Text style={[text.caption, { color: colors.muted }]} numberOfLines={2}>
          {slot.businessCategory ? BUSINESS_CATEGORY_LABELS[slot.businessCategory] : 'Chưa phân ngành'}
          {slot.tenantName ? `, hộ đang thuê: ${slot.tenantName}` : ''}
        </Text>
        <AmenityRow slot={slot} compact />
      </View>
    </Pressable>
  );
}

const OCCUPANCY: { key: keyof Omit<SlotCounts, 'total'>; label: string; state: SlotDisplayState }[] = [
  { key: 'available', label: 'Còn trống', state: 'AVAILABLE' },
  { key: 'pending', label: 'Có đơn, giữ chỗ', state: 'PENDING' },
  { key: 'active', label: 'Đã thuê', state: 'ACTIVE' },
  { key: 'suspended', label: 'Tạm ngưng', state: 'SUSPENDED' },
];

/**
 * The route as its street seen from above: name, segment, price and hours, the deadline; then the
 * pavement with every slot as a bay in its state's colour, the painted kerb, the roadway (and the
 * facing pavement when slots sit on both sides); the counts under it are the colour key. With
 * `slots` the street is drawn and each bay opens its slot.
 */
export function ZonePlateCard({
  zoneName,
  zone,
  counts,
  nowMs,
  slots,
  held,
  onOpenSlot,
}: {
  zoneName: string;
  zone: SidewalkZone | undefined;
  counts: SlotCounts;
  nowMs: number;
  /** The route's slots: drawn as the street strip. */
  slots?: readonly SidewalkSlot[];
  /** Slots the caller holds (painted orange). */
  held?: ReadonlySet<number>;
  onOpenSlot?: (slotId: number) => void;
}) {
  const deadline = zone?.applicationDeadline ? deadlineText(zone.applicationDeadline, nowMs) : null;
  const closed = deadline === 'Đã hết hạn nộp';
  return (
    <View style={{ borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadow.raised }}>
      <View style={{ padding: 18, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
            <Icon sf="signpost.right.fill" md="signpost" size={21} color={colors.primary} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text accessibilityRole="header" style={{ fontFamily: fonts.heavy, fontSize: 19, lineHeight: 25, color: colors.ink }} numberOfLines={2}>
              {zoneName || 'Tuyến vỉa hè'}
            </Text>
            {zone?.segmentFrom && zone.segmentTo ? (
              <Text style={[text.footnote, { color: colors.ink }]} numberOfLines={2}>
                Từ {zone.segmentFrom} đến {zone.segmentTo}
              </Text>
            ) : null}
            {zone ? <Text style={[text.footnote, { color: colors.muted }]}>{zone.wardName}</Text> : null}
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
      </View>
      {slots && slots.length > 0 ? <StreetStrip slots={slots} zone={zone} nowMs={nowMs} held={held} onOpenSlot={onOpenSlot} /> : null}
      <View
        accessible
        accessibilityLabel={occupancyLabel(counts)}
        style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 6, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 16 }}
      >
        {OCCUPANCY.map((s) => (
          <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: SLOT_STATE[s.state].swatch }} />
            <Text style={[text.caption, { color: colors.ink }, tabular]}>
              <Text style={{ fontFamily: fonts.code, fontSize: 14 }}>{counts[s.key]}</Text> {s.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const PX_PER_METRE = 15;
const BAY_MIN = 46;
const BAY_HEIGHT = 52;

/**
 * The street from above (display only, from the slots' own coordinates): the bays in their order
 * along the street, the street furniture between them, the orange and white kerb, the roadway.
 * Bays are drawn at their recorded frontage; gaps between them are not to scale.
 */
function StreetStrip({
  slots,
  zone,
  nowMs,
  held,
  onOpenSlot,
}: {
  slots: readonly SidewalkSlot[];
  zone: SidewalkZone | undefined;
  nowMs: number;
  held?: ReadonlySet<number>;
  onOpenSlot?: (slotId: number) => void;
}) {
  const plan = useMemo(() => {
    const layout = buildStreetLayout(slots);
    if (layout.kind === 'strip') {
      const corridor = buildCorridor(layout, zone?.features ?? []);
      return { rowA: corridor.rowA, rowB: corridor.rowB, twoSides: corridor.hasTwoSides, offStreet: corridor.offStreet.length, byCode: false };
    }
    // Not a straight street (or too short to fit one): one pavement in code order, said so below.
    const rowA: CorridorItem[] = [...slots]
      .sort((a, b) => a.slotCode.localeCompare(b.slotCode, 'vi', { numeric: true }))
      .map((slot, i): CorridorItem => ({
        kind: 'slot',
        key: `slot-${slot.slotId}`,
        alongMeters: i,
        placed: { slot, footprint: slotFootprint(slot), startMeters: i, endMeters: i, centerMeters: i, crossMeters: 0, side: 'A' },
      }));
    return { rowA, rowB: [] as CorridorItem[], twoSides: false, offStreet: 0, byCode: true };
  }, [slots, zone?.features]);

  const row = (items: CorridorItem[]) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: BAY_HEIGHT + 16, paddingVertical: 8, paddingHorizontal: 18 }}>
      {items.map((item) =>
        item.kind === 'slot' ? (
          <Bay key={item.key} slot={item.placed.slot} along={item.placed.footprint.alongMeters} nowMs={nowMs} mine={held?.has(item.placed.slot.slotId) ?? false} onPress={onOpenSlot} />
        ) : (
          <View
            key={item.key}
            accessibilityLabel={item.feature.label || FEATURE_LABELS[item.feature.featureType]}
            style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: item.feature.blocksBusiness ? colors.dangerTint : colors.white, borderWidth: 1.5, borderColor: item.feature.blocksBusiness ? colors.danger : colors.line, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon sf={FEATURE_ICONS[item.feature.featureType].sf} md={FEATURE_ICONS[item.feature.featureType].md} size={14} color={item.feature.blocksBusiness ? colors.danger : colors.muted} />
          </View>
        ),
      )}
    </View>
  );

  // How long the drawn street is, so the painted kerb and the centre line run its whole length.
  const width = Math.max(rowWidth(plan.rowA), rowWidth(plan.rowB));

  return (
    <View style={{ gap: 6 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel="Sơ đồ tuyến phố, vuốt ngang để xem hết">
        <View style={{ minWidth: '100%' }}>
          <View style={{ height: 8, backgroundColor: colors.line }} />
          <View style={{ backgroundColor: colors.kerbPaint }}>{row(plan.rowA)}</View>
          <Kerb length={width} />
          <Roadway length={width} />
          {plan.twoSides ? (
            <>
              <Kerb length={width} />
              <View style={{ backgroundColor: colors.kerbPaint }}>{row(plan.rowB)}</View>
              <View style={{ height: 8, backgroundColor: colors.line }} />
            </>
          ) : null}
        </View>
      </ScrollView>
      {plan.byCode || plan.offStreet > 0 ? (
        <Text style={[text.caption, { color: colors.muted, paddingHorizontal: 18 }]}>
          {plan.byCode ? 'Các ô không nằm thẳng một dãy, sơ đồ xếp theo mã ô.' : `${plan.offStreet} ô nằm ngoài dãy chính, xem trong danh sách.`}
        </Text>
      ) : null}
    </View>
  );
}

const rowWidth = (items: CorridorItem[]) =>
  36 + items.reduce((sum, item, i) => sum + (i ? 6 : 0) + (item.kind === 'slot' ? Math.max(BAY_MIN, Math.round(item.placed.footprint.alongMeters * PX_PER_METRE)) : 30), 0);

/**
 * The painted kerb, orange and white blocks the length of the drawing. Drawn out of flow so the
 * paint never widens the street on its own.
 */
function Kerb({ length }: { length: number }) {
  return (
    <View style={{ height: 7, overflow: 'hidden', backgroundColor: colors.kerbPaint }} importantForAccessibility="no-hide-descendants">
      <View style={{ position: 'absolute', top: 0, left: 0, flexDirection: 'row' }}>
        {Array.from({ length: Math.ceil(length / 22) + 24 }, (_, i) => (
          <View key={i} style={{ width: 22, height: 7, backgroundColor: i % 2 ? colors.kerbPaint : colors.brand }} />
        ))}
      </View>
    </View>
  );
}

/** The roadway: asphalt in the cool grey of the app, a dashed white centre line. */
function Roadway({ length }: { length: number }) {
  return (
    <View style={{ height: 30, backgroundColor: colors.line, overflow: 'hidden' }} importantForAccessibility="no-hide-descendants">
      <View style={{ position: 'absolute', top: 13.5, left: 10, flexDirection: 'row', gap: 14 }}>
        {Array.from({ length: Math.ceil(length / 36) + 12 }, (_, i) => (
          <View key={i} style={{ width: 22, height: 3, borderRadius: 2, backgroundColor: colors.white }} />
        ))}
      </View>
    </View>
  );
}

/** "NVL-08" → "08"; a code without a dash stays whole. */
const bayNumber = (code: string) => code.split('-').pop() || code;

/** One bay on the pavement: its frontage to scale, its code, its state's paint (orange when it is yours). */
function Bay({ slot, along, nowMs, mine, onPress }: { slot: SidewalkSlot; along: number; nowMs: number; mine: boolean; onPress?: (slotId: number) => void }) {
  const state = slotDisplayState(slot, nowMs);
  const t = SLOT_STATE[state];
  return (
    <Pressable
      onPress={onPress ? () => onPress(slot.slotId) : undefined}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`Ô ${slot.slotCode}, ${mine ? 'bạn đang giữ' : t.label}`}
      style={({ pressed }) => ({
        width: Math.max(BAY_MIN, Math.round(along * PX_PER_METRE)),
        minHeight: BAY_HEIGHT,
        borderRadius: radius.plate,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
        backgroundColor: mine ? colors.cta : t.wash,
        borderWidth: 2,
        borderStyle: state === 'HELD' && !mine ? 'dashed' : 'solid',
        borderColor: mine ? colors.cta : t.swatch,
        transform: [{ scale: pressed ? 0.94 : 1 }],
      })}
    >
      {/* The bay is narrow: paint only the number ("08" of NVL-08); the street is named above. */}
      <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={[sign.plate, { fontSize: 15, letterSpacing: 0.5, color: mine ? colors.white : t.ink }]}>
        {bayNumber(slot.slotCode)}
      </Text>
      <Icon sf={mine ? 'bookmark.fill' : t.icon.sf} md={mine ? 'bookmark' : t.icon.md} size={12} color={mine ? colors.white : t.ink} />
    </Pressable>
  );
}

function InfoPill({ icon, label, wash = colors.sunken, ink = colors.ink }: { icon: { sf: string; md: string }; label: string; wash?: string; ink?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radius.full, paddingHorizontal: 11, paddingVertical: 4, minHeight: 30, backgroundColor: wash }}>
      <Icon sf={icon.sf} md={icon.md} size={13} color={ink} />
      <Text style={[{ fontFamily: fonts.semibold, fontSize: 13, color: ink }, tabular]}>{label}</Text>
    </View>
  );
}

/** BR-16 not met: nothing can be held or applied for until a registration is approved. */
export function EligibilityMissing() {
  return (
    <View style={{ padding: 18, gap: 14, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.mangoTint, borderWidth: 1.5, borderColor: colors.sticker }}>
      <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.sticker, alignItems: 'center', justifyContent: 'center' }}>
          <Icon sf="doc.text.fill" md="description" size={22} color={colors.plate} />
        </View>
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 15.5, lineHeight: 21, color: colors.onMango }}>
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
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.control, borderCurve: 'continuous', backgroundColor: colors.leafTint }}>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.leaf, alignItems: 'center', justifyContent: 'center' }}>
        <Icon sf="checkmark.shield.fill" md="verified_user" size={18} color={colors.white} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Plate code={code} />
        <Text style={[text.footnote, { color: colors.onLeaf }]}>
          {name ? `${name}, ` : ''}hồ sơ đã duyệt, đơn đứng tên hồ sơ này
        </Text>
      </View>
    </View>
  );
}
