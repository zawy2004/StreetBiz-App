import { useQuery } from '@tanstack/react-query';
import { router, Stack, type Href } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Segments } from '@/components/common/Blocks';
import { Chip } from '@/components/common/Chip';
import { Icon } from '@/components/common/Icon';
import { Sheet } from '@/components/common/Sheet';
import { SheetOption } from '@/components/common/SheetOption';
import { ErrorState, ListSkeleton } from '@/components/feedback/States';
import { StateView } from '@/components/feedback/StateView';
import { LeafletMap, type MapBounds, type MapMarker } from '@/components/map/LeafletMap';
import { sideApi, type BusinessCategory, type SidewalkSlot } from '@/core/api/side-api';
import { useAuthStore } from '@/store/auth-store';
import { colors, fonts, radius, shadow, text } from '@/theme';
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
} from '../slot-stats';
import { SLOT_STATE } from '../slot-tones';
import { useHolds } from '../useHolds';
import { useNow } from '../useNow';
import { useWorkspaceStore, type ZoneOption } from '../workspace-store';

type Mode = 'choose' | 'mine';
const openSlot = (slotId: number) => router.push(`/vendor/slots/${slotId}` as Href);

/**
 * V11 Ô thuê: two jobs in one tab. "Chọn ô": the routes around, one route at a time as a
 * street plate with its occupancy, its slots as a list or pins on the map (a floating pill
 * switches, like a map app). "Ô của tôi": applications, contracts, transfers, proposals.
 */
export function SlotWorkspaceScreen({ initialMode = 'choose' }: { initialMode?: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const mine = useMySlotsData();
  const waiting =
    (mine.applications.data?.filter((a) => a.applicationStatus === 'MORE_INFORMATION_REQUIRED').length ?? 0) +
    (mine.incoming.data?.filter((t) => t.transferStatus === 'PENDING').length ?? 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: 'Ô thuê' }} />
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 }}>
        <Segments<Mode>
          value={mode}
          onChange={setMode}
          options={[
            { key: 'choose', label: 'Chọn ô' },
            { key: 'mine', label: 'Ô của tôi', count: waiting },
          ]}
        />
      </View>
      {mode === 'choose' ? (
        <ChooseSlots />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={mine.refreshing} onRefresh={() => void mine.refetch()} tintColor={colors.cta} colors={[colors.cta]} />}
        >
          <MySlotsHub data={mine} onStart={() => setMode('choose')} />
        </ScrollView>
      )}
    </View>
  );
}

function ChooseSlots() {
  const userId = useAuthStore((s) => s.user?.id);
  const insets = useSafeAreaInsets();
  const { registration, holds } = useHolds();
  const nowMs = useNow(holds.length ? 1000 : 15_000);
  const zoneId = useWorkspaceStore((s) => s.zoneId);
  const view = useWorkspaceStore((s) => s.view);
  const filters = useWorkspaceStore((s) => s.filters);
  const selectZone = useWorkspaceStore((s) => s.selectZone);
  const setView = useWorkspaceStore((s) => s.setView);
  const setFilters = useWorkspaceStore((s) => s.setFilters);
  const [selected, setSelected] = useState<number | null>(null);
  const [sheet, setSheet] = useState<'category' | 'shift' | null>(null);

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

  const header = (
    <View style={{ gap: 14, paddingBottom: 12 }}>
      {!registration ? <EligibilityMissing /> : null}
      <HoldBasket holds={holds} slots={[...slots, ...(nearby.data ?? [])]} nowMs={nowMs} />
      {zoneOptions.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }} style={{ marginHorizontal: -16 }}>
          {zoneOptions.map((z) => (
            <Chip key={z.zoneId} label={z.zoneName} selected={z.zoneId === activeZoneId} icon={{ sf: 'signpost.right', md: 'signpost' }} onPress={() => selectZone(z.zoneId)} accessibilityRole="radio" />
          ))}
        </ScrollView>
      ) : null}
      {activeZoneId != null ? <ZonePlateCard zoneName={zoneName} zone={zone.data} counts={counts} nowMs={nowMs} /> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }} style={{ marginHorizontal: -16 }}>
        <Chip label="Còn trống" selected={filters.state === 'AVAILABLE'} onPress={toggleState} accessibilityRole="switch" icon={{ sf: 'plus.circle', md: 'add_circle_outline' }} />
        <Chip label="Có điện" selected={filters.power} onPress={() => setFilters({ ...filters, power: !filters.power })} accessibilityRole="switch" icon={{ sf: 'bolt', md: 'bolt' }} />
        <Chip label="Có nước" selected={filters.water} onPress={() => setFilters({ ...filters, water: !filters.water })} accessibilityRole="switch" icon={{ sf: 'drop', md: 'water_drop' }} />
        <Chip label={filters.shift === 'ALL' ? 'Ca bán' : SHIFT_LABELS[filters.shift]} selected={filters.shift !== 'ALL'} onPress={() => setSheet('shift')} trailingChevron />
        <Chip label={filters.category === 'ALL' ? 'Ngành hàng' : BUSINESS_CATEGORY_LABELS[filters.category]} selected={filters.category !== 'ALL'} onPress={() => setSheet('category')} trailingChevron />
        {hasActiveFilters(filters) ? <Chip label="Bỏ lọc" onPress={() => setFilters(NO_FILTERS)} icon={{ sf: 'xmark', md: 'close' }} /> : null}
      </ScrollView>
      {zoneSlots.data ? (
        <Text style={[text.footnote, { color: colors.muted }]}>
          {hasActiveFilters(filters) ? `${visible.length} trên ${slots.length} ô khớp bộ lọc` : `${slots.length} ô trên tuyến`}
        </Text>
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      {firstLoad ? (
        <View style={{ padding: 16, gap: 14 }}>
          <ListSkeleton rows={1} height={170} />
          <ListSkeleton rows={3} height={108} />
        </View>
      ) : effectiveView === 'MAP' ? (
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
      ) : (
        <FlatList
          data={zoneSlots.data ? visible : []}
          keyExtractor={(s) => String(s.slotId)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 110 + insets.bottom, gap: 10 }}
          ListHeaderComponent={header}
          refreshing={zoneSlots.isRefetching}
          onRefresh={() => void Promise.all([zoneSlots.refetch(), zone.refetch(), nearby.refetch()])}
          renderItem={({ item }) => <SlotRowCard slot={item} state={slotDisplayState(item, nowMs)} mine={myHeld.has(item.slotId)} onPress={() => openSlot(item.slotId)} />}
          ListEmptyComponent={
            zoneSlots.isPending && activeZoneId != null ? (
              <ListSkeleton rows={4} height={108} />
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
            )
          }
        />
      )}

      {!firstLoad ? (
        <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: (effectiveView === 'MAP' && selected != null ? 196 : 22), alignItems: 'center' }}>
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
              height: 46,
              paddingHorizontal: 20,
              borderRadius: 23,
              backgroundColor: pressed ? '#24303F' : colors.plate,
              boxShadow: shadow.raised,
              transform: [{ scale: pressed ? 0.97 : 1 }],
            })}
          >
            <Icon sf={effectiveView === 'MAP' ? 'list.bullet' : 'map.fill'} md={effectiveView === 'MAP' ? 'list' : 'map'} size={17} color={colors.white} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.white }}>{effectiveView === 'MAP' ? 'Danh sách' : 'Bản đồ'}</Text>
          </Pressable>
        </View>
      ) : null}

      <Sheet visible={sheet === 'shift'} onClose={() => setSheet(null)} title="Ca bán">
        {(['ALL', 'MORNING', 'AFTERNOON_EVENING'] as const).map((s, i, all) => (
          <SheetOption
            key={s}
            title={s === 'ALL' ? 'Mọi ca' : SHIFT_LABELS[s as Shift]}
            selected={filters.shift === s}
            last={i === all.length - 1}
            onPress={() => {
              setFilters({ ...filters, shift: s });
              setSheet(null);
            }}
          />
        ))}
      </Sheet>
      <Sheet visible={sheet === 'category'} onClose={() => setSheet(null)} title="Ngành hàng" subtitle="Phường gợi ý ngành cho từng ô, không bắt buộc">
        {(['ALL', ...(Object.keys(BUSINESS_CATEGORY_LABELS) as BusinessCategory[])] as const).map((c, i, all) => (
          <SheetOption
            key={c}
            title={c === 'ALL' ? 'Mọi ngành hàng' : BUSINESS_CATEGORY_LABELS[c as BusinessCategory]}
            selected={filters.category === c}
            last={i === all.length - 1}
            onPress={() => {
              setFilters({ ...filters, category: c as BusinessCategory | 'ALL' });
              setSheet(null);
            }}
          />
        ))}
      </Sheet>
    </View>
  );
}

/** The slots the vendor is holding right now, each with its countdown: one tap back to apply. */
function HoldBasket({ holds, slots, nowMs }: { holds: { slotId: number; expiresAt: string }[]; slots: SidewalkSlot[]; nowMs: number }) {
  const live = holds.filter((h) => Date.parse(h.expiresAt) > nowMs);
  if (live.length === 0) return null;
  return (
    <View style={{ padding: 14, gap: 10, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.brandTint }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon sf="bookmark.fill" md="bookmark" size={16} color={colors.primary} />
        <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.primary, flex: 1 }}>Bạn đang giữ {live.length} ô</Text>
      </View>
      {live.map((h) => {
        const slot = slots.find((s) => s.slotId === h.slotId);
        return (
          <Pressable
            key={h.slotId}
            onPress={() => openSlot(h.slotId)}
            accessibilityRole="button"
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 14, backgroundColor: pressed ? colors.kerbPaint : colors.white })}
          >
            <Text style={{ fontFamily: fonts.code, fontSize: 17, color: colors.ink }}>Ô {slot?.slotCode ?? `#${h.slotId}`}</Text>
            <Text style={[text.caption, { flex: 1, color: colors.muted }]} numberOfLines={1}>{slot?.zoneName ?? ''}</Text>
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.primary, fontVariant: ['tabular-nums'] }}>{formatCountdown(secondsUntil(h.expiresAt, nowMs))}</Text>
            <Icon sf="chevron.right" md="chevron_right" size={14} color={colors.muted} />
          </Pressable>
        );
      })}
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
      <View pointerEvents="box-none" style={{ position: 'absolute', top: 10, left: 12, right: 12, gap: 8 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.94)', boxShadow: shadow.card }}>
          {(['AVAILABLE', 'HELD', 'ACTIVE', 'SUSPENDED'] as const).map((s) => (
            <View key={s} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: SLOT_STATE[s].swatch }} />
              <Text style={[text.caption, { color: colors.ink }]}>{s === 'HELD' ? 'Có đơn/giữ' : SLOT_STATE[s].label}</Text>
            </View>
          ))}
        </View>
        {error ? (
          <Pressable onPress={onRetry} style={{ alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: colors.dangerTint }}>
            <Text style={[text.footnote, { color: colors.onDanger }]}>Không tải được ô quanh đây. Chạm để thử lại.</Text>
          </Pressable>
        ) : empty ? (
          <View style={{ alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: colors.mangoTint }}>
            <Text style={[text.footnote, { color: colors.onMango }]}>Không có ô nào trong vùng này. Kéo bản đồ sang khu khác.</Text>
          </View>
        ) : null}
      </View>
      {slot ? (
        <View style={{ position: 'absolute', left: 12, right: 12, bottom: 16, gap: 8 }}>
          <SlotRowCard slot={slot} state={slotDisplayState(slot, nowMs)} mine={myHeld.has(slot.slotId)} onPress={() => openSlot(slot.slotId)} />
          <Pressable
            onPress={() => onShowRoute(slot.zoneId)}
            accessibilityRole="button"
            style={({ pressed }) => ({ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: pressed ? colors.sunken : colors.white, boxShadow: shadow.card })}
          >
            <Icon sf="signpost.right" md="signpost" size={14} color={colors.sign} />
            <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.sign }}>Xem cả tuyến {slot.zoneName}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
