import { useQuery } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/common/Button';
import { Chip } from '@/components/common/Chip';
import { Icon } from '@/components/common/Icon';
import { KerbStrip } from '@/components/common/KerbStrip';
import { Sheet } from '@/components/common/Sheet';
import { ErrorState, ListSkeleton } from '@/components/feedback/States';
import { Skeleton } from '@/components/feedback/Skeleton';
import { StateView } from '@/components/feedback/StateView';
import { LeafletMap, type MapBounds, type MapMarker } from '@/components/map/LeafletMap';
import { Toggle } from '@/components/native/Toggle';
import { sideApi, type BusinessCategory, type SidewalkSlot } from '@/core/api/side-api';
import { useAuthStore } from '@/store/auth-store';
import { colors, fonts, radius, shadow, sign, tabular, text } from '@/theme';
import { Plate, RoundButton, Signboard, useLightStatusBar } from '@/ui';
import { EligibilityMissing, SlotRowCard, ZonePlateCard } from '../components/SlotParts';
import { MySlotsHub, useMySlotsData } from '../components/MySlotsHub';
import { DEFAULT_CENTER, DEFAULT_SPAN } from '../map-constants';
import { formatCountdown, secondsUntil } from '../slot-format';
import {
  BUSINESS_CATEGORY_LABELS,
  countSlots,
  hasActiveFilters,
  NO_FILTERS,
  SHIFT_LABELS,
  slotDisplayState,
  slotMatchesFilters,
  type Shift,
  type SlotFilters,
} from '../slot-stats';
import { SLOT_STATE } from '../slot-tones';
import { useHolds } from '../useHolds';
import { useNow } from '../useNow';
import { useWorkspaceStore, type ZoneOption } from '../workspace-store';

type Mode = 'choose' | 'mine';
const openSlot = (slotId: number) => router.push(`/vendor/slots/${slotId}` as Href);

/** How many filters are on: the number on the filter button. */
const filterCount = (f: SlotFilters) =>
  Number(f.state !== 'ALL') + Number(f.category !== 'ALL') + Number(f.shift !== 'ALL') + Number(f.power) + Number(f.water);

/**
 * V11 Ô thuê, v5 "Biển hiệu phố" (screens/v5/vendor-slots.md): the tab's home. An orange
 * signboard runs under the status bar with the two jobs of the tab on it (choose a slot, my
 * slots) and the routes around as street-name tabs; across its edge lies the chosen route drawn
 * as the street from above (pavement, bays in their state's paint, the kerb, the roadway), each
 * bay one tap from its slot. Below: the holds counting down, one filter button, the slots. The
 * floating pill switches to the map, like a map app. "Ô của tôi": the road to a permit and the
 * four doors (applications, contracts, transfers, proposals).
 */
export function SlotWorkspaceScreen({ initialMode = 'choose' }: { initialMode?: Mode }) {
  useLightStatusBar();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>(initialMode);
  const mine = useMySlotsData();

  // Opened on a street from elsewhere (the home screen's "ô trống gần chỗ bạn bán"):
  // /vendor/slots?zone=12&slot=345 focuses that slot once, then drops the params.
  const params = useLocalSearchParams<{ zone?: string; slot?: string }>();
  useEffect(() => {
    const zone = Number(params.zone);
    if (!Number.isInteger(zone) || zone <= 0) return;
    const slot = Number(params.slot);
    if (Number.isInteger(slot) && slot > 0) useWorkspaceStore.getState().focusSlot(zone, slot);
    else useWorkspaceStore.getState().selectZone(zone);
    router.setParams({ zone: undefined, slot: undefined });
  }, [params.zone, params.slot]);
  const waiting =
    (mine.applications.data?.filter((a) => a.applicationStatus === 'MORE_INFORMATION_REQUIRED').length ?? 0) +
    (mine.incoming.data?.filter((t) => t.transferStatus === 'PENDING').length ?? 0);

  // A deep link (notification) pushes "Ô của tôi" over the tab: with the header hidden, the sign
  // carries the way back.
  const canBack = initialMode === 'mine' && router.canGoBack();
  const switcher = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      {canBack ? <RoundButton icon={{ sf: 'chevron.left', md: 'arrow_back' }} label="Quay lại" onPress={() => router.back()} /> : null}
      <View style={{ flex: 1 }}>
        <ModeSwitch value={mode} onChange={setMode} waiting={waiting} />
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: 'Ô thuê', headerShown: false }} />
      {mode === 'choose' ? (
        <ChooseSlots top={switcher} />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={mine.refreshing} onRefresh={() => void mine.refetch()} tintColor={colors.cta} colors={[colors.cta]} progressViewOffset={insets.top} />}
        >
          <Signboard top={switcher} line1="Ô thuê" line2="của tôi" overlap={<MySlotsHub data={mine} onStart={() => setMode('choose')} />} />
        </ScrollView>
      )}
    </View>
  );
}

/** The tab's two jobs painted on the sign: white capsule on the chosen one, its count on a disc. */
function ModeSwitch({ value, onChange, waiting }: { value: Mode; onChange: (m: Mode) => void; waiting: number }) {
  const options: { key: Mode; label: string; count?: number }[] = [
    { key: 'choose', label: 'Chọn ô' },
    { key: 'mine', label: 'Ô của tôi', count: waiting },
  ];
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', padding: 4, gap: 4, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.22)' }}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.count ? `${o.label}, ${o.count} việc chờ bạn` : o.label}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 44,
              borderRadius: radius.full,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              paddingHorizontal: 10,
              backgroundColor: on ? colors.white : pressed ? 'rgba(255,255,255,0.18)' : 'transparent',
            })}
          >
            <Text numberOfLines={1} style={{ fontFamily: fonts.heavy, fontSize: 15, color: on ? colors.primary : colors.white }}>
              {o.label}
            </Text>
            {o.count ? (
              <View style={{ minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 5, backgroundColor: on ? colors.cta : colors.plate, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={[{ fontFamily: fonts.heavy, fontSize: 11.5, color: colors.white }, tabular]}>{o.count}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** The routes around, as street-name tabs on the sign (they wrap, never clipped). */
function RouteTabs({ zones, active, onSelect }: { zones: ZoneOption[]; active: number | null; onSelect: (id: number) => void }) {
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
      {zones.map((z) => {
        const on = z.zoneId === active;
        return (
          <Pressable
            key={z.zoneId}
            onPress={() => onSelect(z.zoneId)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            hitSlop={4}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              minHeight: 40,
              paddingHorizontal: 14,
              borderRadius: radius.full,
              backgroundColor: on ? colors.plate : pressed ? 'rgba(255,255,255,0.34)' : 'rgba(255,255,255,0.22)',
              borderWidth: on ? 2 : 0,
              borderColor: colors.white,
            })}
          >
            <Icon sf="signpost.right.fill" md="signpost" size={14} color={colors.white} />
            <Text numberOfLines={1} style={{ fontFamily: on ? fonts.heavy : fonts.semibold, fontSize: 14, color: colors.white, maxWidth: 220 }}>
              {z.zoneName}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ChooseSlots({ top }: { top: ReactNode }) {
  const userId = useAuthStore((s) => s.user?.id);
  const insets = useSafeAreaInsets();
  const { registration, holds, release } = useHolds();
  const nowMs = useNow(holds.length ? 1000 : 15_000);
  const zoneId = useWorkspaceStore((s) => s.zoneId);
  const view = useWorkspaceStore((s) => s.view);
  const filters = useWorkspaceStore((s) => s.filters);
  const selectZone = useWorkspaceStore((s) => s.selectZone);
  const setView = useWorkspaceStore((s) => s.setView);
  const setFilters = useWorkspaceStore((s) => s.setFilters);
  const [selected, setSelected] = useState<number | null>(null);
  const [sheet, setSheet] = useState(false);

  const [bounds, setBounds] = useState<MapBounds>({
    minLat: DEFAULT_CENTER[0] - DEFAULT_SPAN,
    maxLat: DEFAULT_CENTER[0] + DEFAULT_SPAN,
    minLng: DEFAULT_CENTER[1] - DEFAULT_SPAN,
    maxLng: DEFAULT_CENTER[1] + DEFAULT_SPAN,
  });
  // What is around the viewport: the map's pins and the route chips. includeUnavailable so
  // rented and suspended slots count too.
  const nearby = useQuery({
    queryKey: ['side', userId, 'slots', { ...bounds, includeUnavailable: true }],
    queryFn: () => sideApi.searchSlots({ ...bounds, includeUnavailable: true, take: 200 }),
    placeholderData: (previous) => previous,
  });
  const nearbyZones = useMemo<ZoneOption[]>(() => {
    const byId = new Map<number, ZoneOption>();
    for (const s of nearby.data ?? []) byId.set(s.zoneId, { zoneId: s.zoneId, zoneName: s.zoneName });
    return [...byId.values()];
  }, [nearby.data]);
  const activeZoneId = zoneId ?? nearbyZones[0]?.zoneId ?? null;

  // The whole route: its own zone query, because the viewport's take-200 would clip a long street.
  const zoneSlots = useQuery({
    queryKey: ['side', userId, 'slots', { zoneId: activeZoneId, includeUnavailable: true }],
    queryFn: () => sideApi.searchSlots({ zoneId: activeZoneId!, includeUnavailable: true, take: 500 }),
    enabled: activeZoneId != null,
  });
  const zone = useQuery({
    queryKey: ['side', userId, 'zone', activeZoneId],
    queryFn: () => sideApi.getZone(activeZoneId!),
    enabled: activeZoneId != null,
  });
  const slots = useMemo(() => zoneSlots.data ?? [], [zoneSlots.data]);
  const zoneName = zone.data?.zoneName ?? slots[0]?.zoneName ?? nearbyZones.find((z) => z.zoneId === activeZoneId)?.zoneName ?? '';
  const zoneOptions = useMemo(() => {
    if (activeZoneId == null || nearbyZones.some((z) => z.zoneId === activeZoneId) || !zoneName) return nearbyZones;
    return [...nearbyZones, { zoneId: activeZoneId, zoneName }];
  }, [nearbyZones, activeZoneId, zoneName]);

  const counts = useMemo(() => countSlots(slots, nowMs), [slots, nowMs]);
  const visible = useMemo(() => slots.filter((s) => slotMatchesFilters(s, filters, nowMs)), [slots, filters, nowMs]);
  const myHeld = useMemo(() => new Set(holds.map((h) => h.slotId)), [holds]);

  const effectiveView = nearbyZones.length === 0 && activeZoneId == null && !nearby.isPending ? 'MAP' : view;
  const firstLoad = nearby.isPending && !nearby.data;

  const toggleState = () => setFilters({ ...filters, state: filters.state === 'AVAILABLE' ? 'ALL' : 'AVAILABLE' });
  const onFilters = filterCount(filters);

  const board = (overlap: ReactNode) => (
    <Signboard top={top} line1="Ô thuê" line2="chọn chỗ bán" overlap={overlap}>
      {zoneOptions.length > 1 ? <RouteTabs zones={zoneOptions} active={activeZoneId} onSelect={selectZone} /> : null}
    </Signboard>
  );

  const header = (
    <View style={{ gap: 18, paddingBottom: 6 }}>
      {board(activeZoneId != null ? <ZonePlateCard zoneName={zoneName} zone={zone.data} counts={counts} nowMs={nowMs} slots={zoneSlots.data ? slots : undefined} held={myHeld} onOpenSlot={openSlot} /> : undefined)}
      <View style={{ paddingHorizontal: 20, gap: 14 }}>
        {!registration ? <EligibilityMissing /> : null}
        <HoldBasket holds={holds} slots={[...slots, ...(nearby.data ?? [])]} nowMs={nowMs} releasing={release.isPending ? release.variables : undefined} onRelease={(slotId) => release.mutate(slotId)} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text accessibilityRole="header" style={{ fontFamily: fonts.heavy, fontSize: 21, lineHeight: 27, letterSpacing: -0.2, color: colors.ink }}>
              Ô trên tuyến
            </Text>
            {zoneSlots.data ? (
              <Text style={[text.footnote, tabular, { color: colors.muted }]}>
                {hasActiveFilters(filters) ? `${visible.length} trên ${slots.length} ô khớp bộ lọc` : `${slots.length} ô`}
              </Text>
            ) : null}
          </View>
          <Pressable
            onPress={() => setSheet(true)}
            accessibilityRole="button"
            accessibilityLabel={onFilters ? `Lọc ô, đang bật ${onFilters} điều kiện` : 'Lọc ô'}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              minHeight: 44,
              paddingHorizontal: 16,
              borderRadius: radius.full,
              backgroundColor: onFilters ? colors.cta : pressed ? colors.brandTint : colors.card,
              boxShadow: onFilters ? shadow.glow : shadow.card,
            })}
          >
            <Icon sf="slider.horizontal.3" md="tune" size={17} color={onFilters ? colors.white : colors.ink} />
            <Text style={{ fontFamily: fonts.heavy, fontSize: 14.5, color: onFilters ? colors.white : colors.ink }}>Lọc</Text>
            {onFilters ? (
              <View style={{ minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={[{ fontFamily: fonts.heavy, fontSize: 11.5, color: colors.primary }, tabular]}>{onFilters}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      {firstLoad ? (
        <ScrollView contentContainerStyle={{ gap: 20, paddingBottom: 40 }}>
          {board(<Skeleton height={230} radius={radius.card} />)}
          <View style={{ paddingHorizontal: 20 }}>
            <ListSkeleton rows={3} height={120} />
          </View>
        </ScrollView>
      ) : effectiveView === 'MAP' ? (
        <View style={{ flex: 1 }}>
          {/* The sign's top row stays over the map, so the tab's two jobs are always in reach */}
          <View style={{ backgroundColor: colors.brand, paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 12 }}>{top}</View>
          <KerbStrip height={8} segment={24} />
          <MapView
            slots={nearby.data ?? []}
            nowMs={nowMs}
            myHeld={myHeld}
            selected={selected}
            onSelect={setSelected}
            onBounds={setBounds}
            empty={nearbyZones.length === 0}
            error={nearby.error}
            onRetry={() => void nearby.refetch()}
            onShowRoute={(id) => {
              selectZone(id);
              setSelected(null);
              setView('PLAN');
            }}
          />
        </View>
      ) : (
        <FlatList
          data={zoneSlots.data ? visible : []}
          keyExtractor={(s) => String(s.slotId)}
          contentContainerStyle={{ paddingBottom: 110 + insets.bottom, gap: 12 }}
          ListHeaderComponent={header}
          refreshControl={
            <RefreshControl
              refreshing={zoneSlots.isRefetching}
              onRefresh={() => void Promise.all([zoneSlots.refetch(), zone.refetch(), nearby.refetch()])}
              tintColor={colors.cta}
              colors={[colors.cta]}
              progressViewOffset={insets.top}
            />
          }
          renderItem={({ item }) => (
            <View style={{ paddingHorizontal: 20 }}>
              <SlotRowCard slot={item} state={slotDisplayState(item, nowMs)} mine={myHeld.has(item.slotId)} onPress={() => openSlot(item.slotId)} />
            </View>
          )}
          ListEmptyComponent={
            <View style={{ paddingHorizontal: 20 }}>
              {zoneSlots.isPending && activeZoneId != null ? (
                <ListSkeleton rows={4} height={120} />
              ) : zoneSlots.isError ? (
                <ErrorState error={zoneSlots.error} onRetry={() => void zoneSlots.refetch()} />
              ) : nearbyZones.length === 0 && activeZoneId == null ? (
                <StateView icon={{ sf: 'map', md: 'map' }} title="Chưa có tuyến quanh đây" body="Mở bản đồ để tìm tuyến vỉa hè ở khu khác." action={{ label: 'Mở bản đồ', onPress: () => setView('MAP') }} />
              ) : (
                <StateView
                  icon={{ sf: 'line.3.horizontal.decrease.circle', md: 'filter_alt_off' }}
                  tone="neutral"
                  title="Không có ô khớp bộ lọc"
                  body="Bỏ bớt điều kiện lọc để xem thêm ô trên tuyến."
                  action={{ label: 'Bỏ lọc', onPress: () => setFilters(NO_FILTERS) }}
                />
              )}
            </View>
          }
        />
      )}

      {!firstLoad ? (
        <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: effectiveView === 'MAP' && selected != null ? 196 : 22, alignItems: 'center' }}>
          <Pressable
            onPress={() => {
              setSelected(null);
              setView(effectiveView === 'MAP' ? 'PLAN' : 'MAP');
            }}
            accessibilityRole="button"
            accessibilityLabel={effectiveView === 'MAP' ? 'Xem danh sách ô' : 'Xem bản đồ'}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              minHeight: 48,
              paddingHorizontal: 22,
              borderRadius: radius.full,
              backgroundColor: colors.plate,
              borderWidth: 2,
              borderColor: colors.white,
              boxShadow: shadow.raised,
              transform: [{ scale: pressed ? 0.97 : 1 }],
            })}
          >
            <Icon sf={effectiveView === 'MAP' ? 'list.bullet' : 'map.fill'} md={effectiveView === 'MAP' ? 'list' : 'map'} size={17} color={colors.white} />
            <Text style={{ fontFamily: fonts.heavy, fontSize: 15, color: colors.white }}>{effectiveView === 'MAP' ? 'Danh sách' : 'Bản đồ'}</Text>
          </Pressable>
        </View>
      ) : null}

      <Sheet
        visible={sheet}
        onClose={() => setSheet(false)}
        title="Lọc ô"
        subtitle="Phường gợi ý ngành cho từng ô, không bắt buộc"
        footer={
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {hasActiveFilters(filters) ? <Button label="Bỏ lọc" variant="secondary" onPress={() => setFilters(NO_FILTERS)} style={{ flex: 1 }} /> : null}
            <Button label={zoneSlots.data ? `Xem ${visible.length} ô` : 'Xong'} onPress={() => setSheet(false)} style={{ flex: 1.4 }} />
          </View>
        }
      >
        <View style={{ backgroundColor: colors.card }}>
          <FilterToggle icon={{ sf: 'plus.circle.fill', md: 'add_circle' }} label="Chỉ ô còn trống" value={filters.state === 'AVAILABLE'} onChange={toggleState} />
          <FilterToggle icon={{ sf: 'bolt.fill', md: 'bolt' }} label="Có điện" value={filters.power} onChange={() => setFilters({ ...filters, power: !filters.power })} />
          <FilterToggle icon={{ sf: 'drop.fill', md: 'water_drop' }} label="Có nước" value={filters.water} onChange={() => setFilters({ ...filters, water: !filters.water })} last />
        </View>
        <View style={{ backgroundColor: colors.card, padding: 16, gap: 10, marginTop: 12 }}>
          <Text style={[text.subhead, { color: colors.ink }]}>Ca bán</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(['ALL', 'MORNING', 'AFTERNOON_EVENING'] as const).map((s) => (
              <Chip
                key={s}
                label={s === 'ALL' ? 'Mọi ca' : SHIFT_LABELS[s as Shift]}
                selected={filters.shift === s}
                onPress={() => setFilters({ ...filters, shift: s })}
                accessibilityRole="radio"
              />
            ))}
          </View>
          <Text style={[text.subhead, { color: colors.ink, marginTop: 6 }]}>Ngành hàng</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(['ALL', ...(Object.keys(BUSINESS_CATEGORY_LABELS) as BusinessCategory[])] as const).map((c) => (
              <Chip
                key={c}
                label={c === 'ALL' ? 'Mọi ngành' : BUSINESS_CATEGORY_LABELS[c as BusinessCategory]}
                selected={filters.category === c}
                onPress={() => setFilters({ ...filters, category: c as BusinessCategory | 'ALL' })}
                accessibilityRole="radio"
              />
            ))}
          </View>
        </View>
      </Sheet>
    </View>
  );
}

function FilterToggle({ icon, label, value, onChange, last }: { icon: { sf: string; md: string }; label: string; value: boolean; onChange: () => void; last?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 16, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.separator }}>
      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: value ? colors.cta : colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
        <Icon sf={icon.sf} md={icon.md} size={16} color={value ? colors.white : colors.primary} />
      </View>
      <Text style={[text.body, { flex: 1, color: colors.ink, fontFamily: fonts.semibold }]}>{label}</Text>
      <Toggle value={value} onChange={() => onChange()} />
    </View>
  );
}

/**
 * The slots the vendor is holding right now, as a mango hold ticket: each slot's plate, its route
 * and the countdown in sign figures; one tap back to apply, or "Nhả" to give the slot back at once
 * (the web's hold basket) instead of waiting for it to lapse.
 */
function HoldBasket({
  holds,
  slots,
  nowMs,
  releasing,
  onRelease,
}: {
  holds: { slotId: number; expiresAt: string }[];
  slots: SidewalkSlot[];
  nowMs: number;
  releasing?: number;
  onRelease: (slotId: number) => void;
}) {
  const live = holds.filter((h) => Date.parse(h.expiresAt) > nowMs);
  if (live.length === 0) return null;
  return (
    <View style={{ borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.mangoTint, borderWidth: 1.5, borderColor: colors.sticker, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.sticker, alignItems: 'center', justifyContent: 'center' }}>
          <Icon sf="timer" md="timer" size={18} color={colors.plate} />
        </View>
        <Text style={{ fontFamily: fonts.heavy, fontSize: 16, color: colors.onMango, flex: 1 }}>Bạn đang giữ {live.length} ô</Text>
      </View>
      {live.map((h) => {
        const slot = slots.find((s) => s.slotId === h.slotId);
        return (
          <Pressable
            key={h.slotId}
            onPress={() => openSlot(h.slotId)}
            accessibilityRole="button"
            accessibilityLabel={`Ô ${slot?.slotCode ?? h.slotId}, còn ${formatCountdown(secondsUntil(h.expiresAt, nowMs))} để nộp đơn`}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, minHeight: 60, backgroundColor: pressed ? colors.sticker : 'transparent' })}
          >
            <Plate code={slot?.slotCode ?? `#${h.slotId}`} />
            <Text style={[text.footnote, { flex: 1, color: colors.onMango, fontFamily: fonts.semibold }]} numberOfLines={1}>
              {slot?.zoneName ?? ''}
            </Text>
            <Text maxFontSizeMultiplier={1.3} style={[sign.price, { fontSize: 20, lineHeight: 25, color: colors.plate }, tabular]}>
              {formatCountdown(secondsUntil(h.expiresAt, nowMs))}
            </Text>
            <Pressable
              onPress={() => onRelease(h.slotId)}
              disabled={releasing != null}
              accessibilityRole="button"
              accessibilityLabel={`Nhả ô ${slot?.slotCode ?? h.slotId}`}
              hitSlop={6}
              style={({ pressed }) => ({ paddingHorizontal: 14, minHeight: 40, borderRadius: radius.full, justifyContent: 'center', backgroundColor: pressed ? colors.mangoTint : colors.white, opacity: releasing != null && releasing !== h.slotId ? 0.5 : 1 })}
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink }}>{releasing === h.slotId ? 'Đang nhả…' : 'Nhả'}</Text>
            </Pressable>
          </Pressable>
        );
      })}
      <View style={{ height: 6 }} />
    </View>
  );
}

function MapView({
  slots,
  nowMs,
  myHeld,
  selected,
  onSelect,
  onBounds,
  empty,
  error,
  onRetry,
  onShowRoute,
}: {
  slots: SidewalkSlot[];
  nowMs: number;
  myHeld: Set<number>;
  selected: number | null;
  onSelect: (id: number | null) => void;
  onBounds: (b: MapBounds) => void;
  empty: boolean;
  error: Error | null;
  onRetry: () => void;
  onShowRoute: (zoneId: number) => void;
}) {
  const boundsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // nowMs only matters when a hold lapses; a minute is fine-grained enough for pins.
  const minute = Math.floor(nowMs / 60_000);
  const markers = useMemo<MapMarker[]>(
    () =>
      slots.map((s) => {
        const state = slotDisplayState(s, minute * 60_000);
        const t = SLOT_STATE[state];
        return {
          id: String(s.slotId),
          latitude: s.latitude,
          longitude: s.longitude,
          label: s.slotCode,
          fill: myHeld.has(s.slotId) ? colors.cta : t.swatch,
          ink: myHeld.has(s.slotId) ? colors.white : t.onSwatch,
          dashed: state === 'HELD',
          selected: s.slotId === selected,
        };
      }),
    [slots, myHeld, selected, minute],
  );
  const onBoundsChange = useCallback(
    (b: MapBounds) => {
      if (boundsTimer.current) clearTimeout(boundsTimer.current);
      boundsTimer.current = setTimeout(() => onBounds(b), 350);
    },
    [onBounds],
  );
  const slot = slots.find((s) => s.slotId === selected) ?? null;

  return (
    <View style={{ flex: 1 }}>
      <LeafletMap
        center={DEFAULT_CENTER}
        zoom={16}
        markers={markers}
        onMarkerPress={(id) => onSelect(Number(id))}
        onMapPress={() => onSelect(null)}
        onBoundsChange={onBoundsChange}
        style={{ flex: 1 }}
      />
      <View pointerEvents="box-none" style={{ position: 'absolute', top: 12, left: 12, right: 12, gap: 8 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 6, alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.control, borderCurve: 'continuous', backgroundColor: 'rgba(255,255,255,0.96)', boxShadow: shadow.card }}>
          {(['AVAILABLE', 'HELD', 'ACTIVE', 'SUSPENDED'] as const).map((s) => (
            <View key={s} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: SLOT_STATE[s].swatch }} />
              <Text style={[text.caption, { color: colors.ink }]}>{s === 'HELD' ? 'Có đơn, giữ chỗ' : SLOT_STATE[s].label}</Text>
            </View>
          ))}
        </View>
        {error ? (
          <Pressable onPress={onRetry} accessibilityRole="button" style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, minHeight: 44, borderRadius: radius.control, backgroundColor: colors.dangerTint }}>
            <Icon sf="arrow.clockwise" md="refresh" size={15} color={colors.onDanger} />
            <Text style={[text.footnote, { color: colors.onDanger, fontFamily: fonts.semibold }]}>Không tải được ô quanh đây. Chạm để thử lại.</Text>
          </Pressable>
        ) : empty ? (
          <View style={{ alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.control, backgroundColor: colors.mangoTint }}>
            <Text style={[text.footnote, { color: colors.onMango, fontFamily: fonts.semibold }]}>Không có ô nào trong vùng này. Kéo bản đồ sang khu khác.</Text>
          </View>
        ) : null}
      </View>
      {slot ? (
        <View style={{ position: 'absolute', left: 12, right: 12, bottom: 16, gap: 8 }}>
          <View style={{ borderRadius: radius.card, boxShadow: shadow.raised }}>
            <SlotRowCard slot={slot} state={slotDisplayState(slot, nowMs)} mine={myHeld.has(slot.slotId)} onPress={() => openSlot(slot.slotId)} />
          </View>
          <Pressable
            onPress={() => onShowRoute(slot.zoneId)}
            accessibilityRole="button"
            style={({ pressed }) => ({ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 16, borderRadius: radius.full, backgroundColor: pressed ? colors.brandTint : colors.white, boxShadow: shadow.card })}
          >
            <Icon sf="signpost.right.fill" md="signpost" size={14} color={colors.primary} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.primary }}>Xem cả tuyến {slot.zoneName}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
