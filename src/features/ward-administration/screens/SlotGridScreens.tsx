import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Segments } from '@/components/common/Blocks';
import { Button } from '@/components/common/Button';
import { Chip } from '@/components/common/Chip';
import { Icon } from '@/components/common/Icon';
import { KerbStrip } from '@/components/common/KerbStrip';
import { Sheet } from '@/components/common/Sheet';
import { Banner } from '@/components/feedback/Banner';
import { Skeleton } from '@/components/feedback/Skeleton';
import { ErrorState, ListSkeleton } from '@/components/feedback/States';
import { StateView } from '@/components/feedback/StateView';
import { showToast } from '@/components/feedback/Toast';
import { useFilePicker } from '@/components/forms/FileSourceSheet';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { LeafletMap, type LeafletMapHandle, type MapLayer, type MapMarker } from '@/components/map/LeafletMap';
import { MapAddressSearch, MapGpsButton, MapLayerSwitch, MapLegend, type LegendItem } from '@/components/map/MapTools';
import { StatusHeader } from '@/components/native/StatusHeader';
import { Toggle } from '@/components/native/Toggle';
import { errorMessage } from '@/core/api';
import { apiAssetUrl } from '@/core/api/asset-url';
import { SLOT_STATE } from '@/features/sidewalk-slots/slot-tones';
import { DEFAULT_CENTER } from '@/features/sidewalk-slots/map-constants';
import { detectPosition, LOCATE_MESSAGES, LocateError } from '@/features/buyer-discovery/geolocation';
import { useAuthStore } from '@/store/auth-store';
import { colors, fonts, radius, shadow, sign, tabular, text } from '@/theme';
import { Signboard, useLightStatusBar } from '@/ui';
import { formatVietnamDateTime } from '@/utils/format';
import { businessCategoryLabels, slotStatusLabels, wardConfigApi, type PlacementCheck, type WardSlot } from '../ward-config-api';

type Bucket = 'all' | 'AVAILABLE' | 'BUSY' | 'ACTIVE' | 'SUSPENDED';
const toneOf = (s: WardSlot['status']) => (s === 'AVAILABLE' ? SLOT_STATE.AVAILABLE : s === 'PENDING_APPLICATION' ? SLOT_STATE.PENDING : s === 'SUSPENDED' ? SLOT_STATE.SUSPENDED : SLOT_STATE.ACTIVE);
const statusWord: Record<WardSlot['status'], string> = { AVAILABLE: 'Còn trống', PENDING_APPLICATION: 'Có đơn chờ', ACTIVE: 'Đã cho thuê', SUSPENDED: 'Tạm ngưng' };
const inBucket = (s: WardSlot, b: Bucket) => b === 'all' || (b === 'BUSY' ? s.status === 'PENDING_APPLICATION' : s.status === b);
const BUCKETS = [
  { key: 'AVAILABLE', label: 'Còn trống', tone: SLOT_STATE.AVAILABLE },
  { key: 'BUSY', label: 'Có đơn', tone: SLOT_STATE.PENDING },
  { key: 'ACTIVE', label: 'Đã thuê', tone: SLOT_STATE.ACTIVE },
  { key: 'SUSPENDED', label: 'Tạm ngưng', tone: SLOT_STATE.SUSPENDED },
] as const;
const metres = (n: number) => String(n).replace('.', ',');
/** Street-feature diamonds, the web's colours: red where business is barred, mango otherwise. */
const FEATURE_BLOCK_COLOR = '#B42318';
const FEATURE_OTHER_COLOR = '#C98A04';
const LEGEND_ORDER: WardSlot['status'][] = ['AVAILABLE', 'PENDING_APPLICATION', 'ACTIVE', 'SUSPENDED'];

function useGrid() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({ queryKey: ['ward', userId, 'slot-grid', null], queryFn: () => wardConfigApi.slotGrid() });
}

type Street = { zoneId: number; zoneName: string; slots: WardSlot[] };
/** The ward's slots street by street, in the order the server lists them. */
function streetsOf(slots: WardSlot[]): Street[] {
  const by = new Map<number, Street>();
  for (const s of slots) {
    const street = by.get(s.zoneId);
    if (street) street.slots.push(s);
    else by.set(s.zoneId, { zoneId: s.zoneId, zoneName: s.zoneName, slots: [s] });
  }
  return [...by.values()];
}

/**
 * W15 Lưới ô (WARD-01/02), v5 (screens/v5/ward-ops.md): the ward's orange signboard counts the
 * slots by state (each count filters); below it every route is drawn as a strip of street seen
 * from above — the road, the painted kerb, and the slots on the pavement, each one a painted bay
 * with its code, coloured and worded by its state. Or the same slots as pins on the map.
 */
export function SlotBoardScreen() {
  const insets = useSafeAreaInsets();
  useLightStatusBar();
  const grid = useGrid();
  const [bucket, setBucket] = useState<Bucket>('all');
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'LIST' | 'MAP'>('LIST');
  const slots = useMemo(() => grid.data?.slots ?? [], [grid.data]);
  const needle = query.trim().toLowerCase();
  const shown = slots.filter((s) => inBucket(s, bucket) && (!needle || s.slotCode.toLowerCase().includes(needle) || s.zoneName.toLowerCase().includes(needle)));
  const count = (b: Bucket) => slots.filter((s) => inBucket(s, b)).length;
  const features = useMemo(() => grid.data?.features ?? [], [grid.data]);
  // Slots as coded pins, street features (obstacles) as diamonds, as on the web's grid map.
  const markers = useMemo<MapMarker[]>(
    () => [
      ...shown.map((s) => ({ id: String(s.slotId), latitude: s.latitude, longitude: s.longitude, label: s.slotCode, fill: toneOf(s.status).swatch, ink: toneOf(s.status).onSwatch })),
      ...features.map((f) => ({ id: `f${f.featureId}`, latitude: f.latitude, longitude: f.longitude, fill: f.blocksBusiness ? FEATURE_BLOCK_COLOR : FEATURE_OTHER_COLOR, ink: colors.white, shape: 'diamond' as const })),
    ],
    [shown, features],
  );
  const legend = useMemo<LegendItem[]>(
    () => [
      ...LEGEND_ORDER.map((st) => ({ key: st, label: slotStatusLabels[st], count: shown.filter((s) => s.status === st).length, color: toneOf(st).swatch, shape: 'dot' as const })),
      { key: 'features', label: 'Chướng ngại vật', count: features.length, color: features.some((f) => f.blocksBusiness) ? FEATURE_BLOCK_COLOR : FEATURE_OTHER_COLOR, shape: 'diamond' as const },
    ],
    [shown, features],
  );
  const map = useRef<LeafletMapHandle>(null);
  const [layer, setLayer] = useState<MapLayer>('street');
  const [me, setMe] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const locate = async () => {
    setLocating(true);
    try {
      const fix = await detectPosition();
      setMe(fix);
      map.current?.flyTo(fix.latitude, fix.longitude, 18);
    } catch (e) {
      showToast(e instanceof LocateError ? LOCATE_MESSAGES[e.reason] : LOCATE_MESSAGES.FAILED, 'error');
    } finally {
      setLocating(false);
    }
  };
  const open = (slotId: number) => router.push(`/ward/slots/${slotId}` as Href);
  // "Chọn nhiều" (web BulkStatusPanel): suspend or reopen a whole stretch at once.
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<number[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const toggle = (slotId: number) => setPicked((p) => (p.includes(slotId) ? p.filter((x) => x !== slotId) : [...p, slotId]));
  const stopSelecting = () => {
    setSelecting(false);
    setPicked([]);
    setBulkOpen(false);
  };
  const pickedSlots = slots.filter((s) => picked.includes(s.slotId));
  const streets = streetsOf(shown);
  const allStreets = streetsOf(slots).length;

  const header = (
    <View style={{ gap: 16, paddingBottom: 14 }}>
      <Signboard
        line1="Lưới ô"
        line2="vỉa hè"
        caption={grid.data ? `${slots.length} ô trên ${allStreets} tuyến của phường` : undefined}
        overlap={
          <View style={{ minHeight: 56, borderRadius: radius.full, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 18, paddingRight: 8, boxShadow: shadow.raised }}>
            <Icon sf="magnifyingglass" md="search" size={20} color={colors.primary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Tìm mã ô hoặc tuyến, VD: NVL-12"
              placeholderTextColor={colors.muted}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="search"
              accessibilityLabel="Tìm ô hoặc tuyến"
              style={{ flex: 1, minHeight: 48, fontFamily: fonts.medium, fontSize: 16, color: colors.ink }}
            />
            {query ? (
              <Pressable onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel="Xoá từ khoá" hitSlop={8} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
                <Icon sf="xmark.circle.fill" md="cancel" size={20} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>
        }
      >
        {/* The four states as painted counts; each one filters the strips and the map */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 18 }}>
          {BUCKETS.map((b) => {
            const on = bucket === b.key;
            const n = count(b.key);
            return (
              <Pressable
                key={b.key}
                onPress={() => setBucket(on ? 'all' : b.key)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${b.label}: ${grid.isPending ? 'đang tải' : n} ô`}
                style={({ pressed }) => ({ flex: 1, minHeight: 76, paddingVertical: 10, paddingHorizontal: 10, gap: 4, borderRadius: radius.control, borderCurve: 'continuous', backgroundColor: on ? colors.white : pressed ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.18)' })}
              >
                <Text maxFontSizeMultiplier={1.3} adjustsFontSizeToFit numberOfLines={1} style={[sign.title, tabular, { color: on ? colors.ink : colors.white }]}>
                  {grid.isPending ? '–' : n}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: b.tone.swatch, borderWidth: 1.5, borderColor: colors.white }} />
                  <Text numberOfLines={2} style={{ flexShrink: 1, fontFamily: fonts.bold, fontSize: 12.5, lineHeight: 16, color: on ? colors.ink : colors.white }}>{b.label}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </Signboard>
      <View style={{ paddingHorizontal: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <Chip label="Rải ô hàng loạt" icon={{ sf: 'square.grid.3x1.below.line.grid.1x2', md: 'view_week' }} onPress={() => router.push('/ward/slots/batch' as Href)} />
          <Chip label="Chướng ngại vật" icon={{ sf: 'exclamationmark.triangle', md: 'warning' }} onPress={() => router.push('/ward/slots/features' as Href)} />
        </View>
        <Segments<'LIST' | 'MAP'> value={view} onChange={setView} options={[{ key: 'LIST', label: 'Dải phố' }, { key: 'MAP', label: 'Bản đồ' }]} />
        {view === 'LIST' && slots.length > 1 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={[text.footnote, { flex: 1, color: colors.muted }]}>{selecting ? 'Chạm các ô cần đổi trạng thái.' : 'Chạm một ô để xem và sửa.'}</Text>
            <Pressable onPress={() => (selecting ? stopSelecting() : setSelecting(true))} accessibilityRole="button" hitSlop={6} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 }}>
              <Text style={{ fontFamily: fonts.heavy, fontSize: 14.5, color: colors.sign }}>{selecting ? 'Xong' : 'Chọn nhiều ô'}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: 'Lưới ô vỉa hè', headerShown: false }} />
      {view === 'MAP' && !grid.isPending ? (
        <View style={{ flex: 1 }}>
          {/* The map gets the screen: a slim orange band with the view switch replaces the signboard */}
          <View style={{ paddingTop: insets.top + 8, paddingBottom: 12, paddingHorizontal: 16, gap: 10, backgroundColor: colors.brand }}>
            <Text accessibilityRole="header" maxFontSizeMultiplier={1.3} style={[sign.price, { fontSize: 22, lineHeight: 28, color: colors.white }]}>
              LƯỚI Ô VỈA HÈ
            </Text>
            <Segments<'LIST' | 'MAP'> value={view} onChange={setView} options={[{ key: 'LIST', label: 'Dải phố' }, { key: 'MAP', label: 'Bản đồ' }]} />
          </View>
          <View style={{ flex: 1 }}>
            <LeafletMap
              ref={map}
              center={DEFAULT_CENTER}
              zoom={16}
              markers={markers}
              layer={layer}
              me={me}
              onMarkerPress={(id) => (id.startsWith('f') ? router.push('/ward/slots/features' as Href) : open(Number(id)))}
              style={{ flex: 1 }}
            />
            {/* Over the map, as on the web: address search and the layer switch, the legend, GPS */}
            <View pointerEvents="box-none" style={{ position: 'absolute', left: 12, right: 12, top: 12, gap: 8 }}>
              <View pointerEvents="box-none" style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <MapAddressSearch onPick={(m) => map.current?.flyTo(m.latitude, m.longitude, 18)} />
                </View>
                <MapLayerSwitch value={layer} onChange={setLayer} />
              </View>
              <View pointerEvents="box-none" style={{ alignSelf: 'flex-start', maxWidth: '100%' }}>
                <MapLegend items={legend} />
              </View>
            </View>
            {selecting ? null : (
              <View pointerEvents="box-none" style={{ position: 'absolute', left: 12, bottom: 16 }}>
                <MapGpsButton locating={locating} onPress={() => void locate()} />
              </View>
            )}
          </View>
        </View>
      ) : (
        <FlatList
          data={grid.isPending ? [] : streets}
          keyExtractor={(s) => String(s.zoneId)}
          contentContainerStyle={{ gap: 16, paddingBottom: 120 }}
          ListHeaderComponent={header}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={<RefreshControl refreshing={grid.isRefetching} onRefresh={() => void grid.refetch()} tintColor={colors.cta} colors={[colors.cta]} progressViewOffset={insets.top} />}
          renderItem={({ item }) => (
            <View style={{ paddingHorizontal: 16 }}>
              <StreetStrip street={item} picked={selecting ? picked : undefined} onTap={(s) => (selecting ? toggle(s.slotId) : open(s.slotId))} />
            </View>
          )}
          ListEmptyComponent={
            <View style={{ paddingHorizontal: 16 }}>
              {grid.isPending ? (
                <View style={{ gap: 16 }}>
                  <Skeleton height={230} radius={radius.card} />
                  <Skeleton height={150} radius={radius.card} />
                </View>
              ) : grid.isError ? (
                <ErrorState error={grid.error} onRetry={() => void grid.refetch()} />
              ) : (
                <StateView
                  icon={{ sf: 'square.grid.3x3', md: 'grid_view' }}
                  tone="neutral"
                  title={slots.length ? 'Không có ô khớp' : 'Chưa có ô vỉa hè nào'}
                  body={slots.length ? 'Đổi bộ lọc hoặc từ khoá.' : 'Thêm ô đầu tiên trên bản đồ.'}
                  action={
                    slots.length
                      ? {
                          label: 'Xem tất cả ô',
                          onPress: () => {
                            setBucket('all');
                            setQuery('');
                          },
                        }
                      : { label: 'Thêm ô', onPress: () => router.push('/ward/slots/new' as Href) }
                  }
                />
              )}
            </View>
          }
        />
      )}
      {selecting ? (
        <View style={{ position: 'absolute', left: 16, right: 16, bottom: 16, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, paddingLeft: 18, borderRadius: radius.full, backgroundColor: colors.card, boxShadow: shadow.raised }}>
          <Text style={[{ flex: 1, fontFamily: fonts.heavy, fontSize: 15.5, color: colors.ink }, tabular]}>{`Đã chọn ${picked.length} ô`}</Text>
          <Button label="Đổi trạng thái" variant="sign" disabled={picked.length === 0} onPress={() => setBulkOpen(true)} />
        </View>
      ) : (
        <View pointerEvents="box-none" style={{ position: 'absolute', right: 16, bottom: 16 }}>
          <Button label="Thêm ô" variant="sign" icon={{ sf: 'plus', md: 'add' }} onPress={() => router.push('/ward/slots/new' as Href)} />
        </View>
      )}
      <BulkStatusSheet
        visible={bulkOpen}
        slots={pickedSlots}
        onClose={() => setBulkOpen(false)}
        onDone={() => {
          stopSelecting();
          void grid.refetch();
        }}
      />
    </View>
  );
}

/** A strip of asphalt with its dashed centre line (decorative: the street the slots face). */
function Road() {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ height: 20, backgroundColor: colors.line, justifyContent: 'center', overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', gap: 12, paddingLeft: 8 }}>
        {Array.from({ length: 24 }, (_, i) => (
          <View key={i} style={{ width: 18, height: 3, borderRadius: 2, backgroundColor: colors.white }} />
        ))}
      </View>
    </View>
  );
}

/**
 * One route drawn from above: its name, the road, the painted kerb, and its slots painted on
 * the pavement. `picked` is set only while choosing several slots (each bay then ticks).
 */
function StreetStrip({ street, picked, onTap }: { street: Street; picked?: number[]; onTap: (s: WardSlot) => void }) {
  const free = street.slots.filter((s) => s.status === 'AVAILABLE').length;
  return (
    <View style={{ borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.card, boxShadow: shadow.card }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
          <Icon sf="signpost.right.fill" md="signpost" size={19} color={colors.primary} />
        </View>
        <View style={{ flex: 1, gap: 1 }}>
          <Text accessibilityRole="header" style={{ fontFamily: fonts.heavy, fontSize: 17, lineHeight: 23, color: colors.ink }}>{street.zoneName}</Text>
          <Text style={[text.footnote, tabular, { color: colors.muted }]}>{free ? `${street.slots.length} ô, ${free} còn trống` : `${street.slots.length} ô`}</Text>
        </View>
      </View>
      <Road />
      <KerbStrip height={8} segment={20} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12, backgroundColor: colors.kerbPaint }}>
        {street.slots.map((s) => (
          <SlotBay key={s.slotId} slot={s} selected={picked ? picked.includes(s.slotId) : undefined} onPress={() => onTap(s)} />
        ))}
      </View>
    </View>
  );
}

/**
 * A slot as it is painted on the pavement: an outlined bay in its state's colour (dashed while an
 * application holds it), the code in plate lettering and the state in words. While choosing,
 * a blue tick marks the picked ones.
 */
function SlotBay({ slot, onPress, selected }: { slot: WardSlot; onPress: () => void; selected?: boolean }) {
  const t = toneOf(slot.status);
  const choosing = selected !== undefined;
  const held = slot.status === 'PENDING_APPLICATION';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={choosing ? 'checkbox' : 'button'}
      accessibilityState={choosing ? { checked: selected } : undefined}
      accessibilityLabel={`Ô ${slot.slotCode}, ${statusWord[slot.status]}`}
      style={({ pressed }) => ({
        width: '31.3%',
        minHeight: 88,
        paddingHorizontal: 9,
        paddingVertical: 8,
        gap: 2,
        borderRadius: radius.plate,
        borderWidth: selected ? 3 : 2,
        borderStyle: held && !selected ? 'dashed' : 'solid',
        borderColor: selected ? colors.sign : t.swatch,
        backgroundColor: t.wash,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Text maxFontSizeMultiplier={1.4} adjustsFontSizeToFit numberOfLines={1} style={[sign.price, tabular, { color: colors.ink, paddingRight: choosing ? 20 : 0 }]}>
        {slot.slotCode}
      </Text>
      <Text style={{ fontFamily: fonts.bold, fontSize: 12, lineHeight: 16, color: t.ink }}>{statusWord[slot.status]}</Text>
      {slot.widthMeters != null && slot.lengthMeters != null ? (
        <Text style={[text.caption, tabular, { fontFamily: fonts.medium, color: colors.muted }]}>{`${metres(slot.widthMeters)} × ${metres(slot.lengthMeters)} m`}</Text>
      ) : null}
      {slot.source === 'VENDOR_PROPOSED' ? <Text style={[text.caption, { color: colors.sign }]}>Hộ đề xuất</Text> : null}
      {choosing ? (
        <View style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: selected ? colors.sign : colors.muted, backgroundColor: selected ? colors.sign : colors.white, alignItems: 'center', justifyContent: 'center' }}>
          {selected ? <Icon sf="checkmark" md="check" size={12} color={colors.white} weight="bold" /> : null}
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * Suspend or reopen several slots at once, e.g. a whole kerb stretch closed for roadworks. Runs the
 * ordinary one-slot change per slot, so each keeps its own version check, audit entry and the
 * backend's rules (no open application, no contract); slots that cannot change are skipped.
 */
function BulkStatusSheet({ visible, slots, onClose, onDone }: { visible: boolean; slots: WardSlot[]; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [failures, setFailures] = useState<{ slotCode: string; message: string }[]>([]);
  const suspendable = slots.filter((s) => s.status === 'AVAILABLE');
  const reopenable = slots.filter((s) => s.status === 'SUSPENDED');
  const skipped = slots.length - suspendable.length - reopenable.length;
  const run = useMutation({
    mutationFn: async (target: 'SUSPENDED' | 'AVAILABLE') => {
      const batch = target === 'SUSPENDED' ? suspendable : reopenable;
      const failed: { slotCode: string; message: string }[] = [];
      for (const slot of batch) {
        try {
          await wardConfigApi.setSlotStatus(slot, target, reason.trim());
        } catch (e) {
          failed.push({ slotCode: slot.slotCode, message: errorMessage(e) });
        }
      }
      return { done: batch.length - failed.length, failed };
    },
    onSuccess: ({ done, failed }) => {
      setFailures(failed);
      showToast(failed.length ? `Đã đổi ${done} ô, ${failed.length} ô không đổi được.` : `Đã đổi trạng thái ${done} ô.`, failed.length ? 'error' : 'success');
      if (failed.length === 0) {
        setReason('');
        onDone();
      }
    },
  });
  const tally = (value: number, label: string, wash: string, ink: string) => (
    <View accessible accessibilityLabel={`${value} ${label}`} style={{ flex: 1, padding: 12, gap: 2, borderRadius: radius.control, borderCurve: 'continuous', backgroundColor: wash }}>
      <Text maxFontSizeMultiplier={1.3} style={[sign.title, tabular, { color: ink }]}>{value}</Text>
      <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, lineHeight: 16, color: ink }}>{label}</Text>
    </View>
  );
  // The larger of the two groups is the likely intent: its button leads in the ward's blue.
  const suspendLeads = suspendable.length >= reopenable.length;
  return (
    <Sheet visible={visible} onClose={onClose} title={`Đổi trạng thái ${slots.length} ô`}>
      <View style={{ gap: 12, padding: 16, backgroundColor: colors.card }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {tally(suspendable.length, 'có thể tạm ngưng', SLOT_STATE.AVAILABLE.wash, SLOT_STATE.AVAILABLE.ink)}
          {tally(reopenable.length, 'có thể mở lại', SLOT_STATE.SUSPENDED.wash, SLOT_STATE.SUSPENDED.ink)}
          {tally(skipped, 'sẽ bỏ qua', colors.sunken, colors.muted)}
        </View>
        {skipped > 0 ? <Text style={[text.footnote, { color: colors.muted }]}>{`${skipped} ô đang có đơn hoặc hợp đồng sẽ được bỏ qua: xử lý đơn ở Hộp duyệt, hoặc đình chỉ giấy phép ở Tuần tra.`}</Text> : null}
        <TextField label="Lý do (áp dụng cho tất cả ô đã chọn)" value={reason} onChangeText={(v) => setReason(v.slice(0, 500))} multiline placeholder="VD: Thi công vỉa hè đoạn Hoàng Diệu đến 30/10" />
        <Button label={`Tạm ngưng ${suspendable.length} ô`} variant={suspendLeads ? 'sign' : 'secondary'} disabled={suspendable.length === 0 || !reason.trim() || run.isPending} loading={run.isPending && run.variables === 'SUSPENDED'} onPress={() => run.mutate('SUSPENDED')} />
        <Button label={`Mở lại ${reopenable.length} ô`} variant={suspendLeads ? 'secondary' : 'sign'} disabled={reopenable.length === 0 || !reason.trim() || run.isPending} loading={run.isPending && run.variables === 'AVAILABLE'} onPress={() => run.mutate('AVAILABLE')} />
        {failures.length ? (
          <Banner tone="danger" title="Không đổi được">
            {failures.map((f) => `• ${f.slotCode}: ${f.message}`).join('\n')}
          </Banner>
        ) : null}
      </View>
    </Sheet>
  );
}

/** Placement issues from the server: BLOCK stops the save; WARN needs a reason to go ahead. */
function PlacementResult({ check }: { check: PlacementCheck | null }) {
  if (!check) return null;
  if (check.issues.length === 0)
    return <StatusHeader tone="ok" title="Vị trí hợp lệ" detail={check.boundaryVerified ? 'Trong ranh giới phường.' : 'Không thấy vướng mắc (chưa có ranh giới phường để đối chiếu).'} />;
  const blocks = check.issues.filter((i) => i.severity === 'BLOCK');
  return <StatusHeader tone={blocks.length ? 'danger' : 'pending'} title={blocks.length ? 'Không đặt ô được ở đây' : 'Cần xem lại'} detail={check.issues.map((i) => `• ${i.message}`).join('\n')} />;
}

/** A heading inside a long form (heavy, with an optional one-line note). */
function Heading({ title, note }: { title: string; note?: string }) {
  return (
    <View style={{ gap: 2, marginTop: 8 }}>
      <Text accessibilityRole="header" style={{ fontFamily: fonts.heavy, fontSize: 19, lineHeight: 25, color: colors.ink }}>{title}</Text>
      {note ? <Text style={[text.footnote, { color: colors.muted }]}>{note}</Text> : null}
    </View>
  );
}

/** A white grouped surface with hairlines between its rows (settings style). */
function Group({ children }: { children: ReactNode }) {
  return <View style={{ borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.card, boxShadow: shadow.card }}>{children}</View>;
}

const UTILITIES = [
  ['hasPower', 'Có điện', { sf: 'bolt.fill', md: 'bolt' }],
  ['hasWater', 'Có nước', { sf: 'drop.fill', md: 'water_drop' }],
  ['hasTrashBin', 'Có thùng rác', { sf: 'trash.fill', md: 'delete' }],
] as const;

type Form = { slotCode: string; width: string; length: string; hasPower: boolean; hasWater: boolean; hasTrashBin: boolean; businessCategory: string | null; imageUrls: string[]; latitude: number; longitude: number; zoneId: number };
const formOf = (s: WardSlot): Form => ({ slotCode: s.slotCode, width: String(s.widthMeters ?? ''), length: String(s.lengthMeters ?? ''), hasPower: s.hasPower, hasWater: s.hasWater, hasTrashBin: s.hasTrashBin, businessCategory: s.businessCategory, imageUrls: s.imageUrls, latitude: s.latitude, longitude: s.longitude, zoneId: s.zoneId });
const num = (v: string) => Number(v.replace(',', '.'));

/** Shared slot form: size, utilities, category, photos, position on the map with a server placement check. */
function SlotForm({ form, setForm, canMove, ignoreSlotId, check, setCheck }: { form: Form; setForm: (f: Form) => void; canMove: boolean; ignoreSlotId?: number; check: PlacementCheck | null; setCheck: (c: PlacementCheck | null) => void }) {
  const picker = useFilePicker();
  const [uploading, setUploading] = useState(false);
  const verify = useMutation({
    mutationFn: () => wardConfigApi.checkPlacement({ zoneId: form.zoneId, latitude: form.latitude, longitude: form.longitude, widthMeters: num(form.width), lengthMeters: num(form.length) }, ignoreSlotId),
    onSuccess: setCheck,
    onError: (e) => showToast(errorMessage(e), 'error'),
  });
  const addPhoto = async () => {
    if (form.imageUrls.length >= 6) return showToast('Tối đa 6 ảnh.', 'error');
    const f = await picker.pick('Ảnh ô vỉa hè', false);
    if (!f) return;
    setUploading(true);
    try {
      const { fileUrl } = await wardConfigApi.uploadSlotImage(f);
      setForm({ ...form, imageUrls: [...form.imageUrls, fileUrl] });
    } catch (e) {
      showToast(errorMessage(e), 'error');
    } finally {
      setUploading(false);
    }
  };
  const markers = useMemo(() => [{ id: 'x', latitude: form.latitude, longitude: form.longitude, label: form.slotCode || 'Ô mới', fill: colors.cta, ink: colors.white, selected: true }], [form.latitude, form.longitude, form.slotCode]);
  return (
    <>
      <Heading title="Vị trí trên vỉa hè" note={canMove ? 'Chạm bản đồ để đặt ô, rồi kiểm tra với máy chủ.' : 'Ô đang có hợp đồng, không dời được.'} />
      <Group>
        <LeafletMap center={[form.latitude, form.longitude]} zoom={18} markers={markers} onMapPress={canMove ? (latitude, longitude) => { setForm({ ...form, latitude, longitude }); setCheck(null); } : undefined} style={{ height: 240 }} />
        <View style={{ padding: 14, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon sf="mappin.and.ellipse" md="location_on" size={16} color={colors.primary} />
            <Text style={[text.footnote, tabular, { flex: 1, color: colors.ink }]}>{`${form.latitude.toFixed(6)}, ${form.longitude.toFixed(6)}`}</Text>
          </View>
          <Button label="Kiểm tra vị trí" variant="secondary" icon={{ sf: 'checkmark.shield', md: 'verified_user' }} loading={verify.isPending} disabled={!(num(form.width) > 0 && num(form.length) > 0)} onPress={() => verify.mutate()} />
        </View>
      </Group>
      <PlacementResult check={check} />

      <Heading title="Mã và kích thước" />
      <TextField label="Mã ô" value={form.slotCode} onChangeText={(v) => setForm({ ...form, slotCode: v.toUpperCase() })} autoCapitalize="characters" optional={!ignoreSlotId} hint={ignoreSlotId ? undefined : 'Để trống để hệ thống tự đặt mã'} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <TextField label="Mặt tiền (m)" value={form.width} onChangeText={(v) => { setForm({ ...form, width: v }); setCheck(null); }} keyboardType="decimal-pad" editable={canMove} />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Chiều sâu (m)" value={form.length} onChangeText={(v) => { setForm({ ...form, length: v }); setCheck(null); }} keyboardType="decimal-pad" editable={canMove} />
        </View>
      </View>

      <Heading title="Tiện ích" />
      <Group>
        {UTILITIES.map(([k, l, icon], i) => (
          <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: colors.separator }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: form[k] ? colors.brandTint : colors.sunken, alignItems: 'center', justifyContent: 'center' }}>
              <Icon sf={icon.sf} md={icon.md} size={17} color={form[k] ? colors.primary : colors.muted} />
            </View>
            <Text style={[text.body, { flex: 1, fontFamily: fonts.semibold, color: colors.ink }]}>{l}</Text>
            <Toggle value={form[k]} onChange={(v) => setForm({ ...form, [k]: v })} />
          </View>
        ))}
      </Group>

      <Heading title="Ngành hàng gợi ý" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }} style={{ marginHorizontal: -16 }}>
        <Chip label="Không gợi ý" selected={!form.businessCategory} onPress={() => setForm({ ...form, businessCategory: null })} accessibilityRole="radio" />
        {Object.entries(businessCategoryLabels).map(([k, l]) => (
          <Chip key={k} label={l} selected={form.businessCategory === k} onPress={() => setForm({ ...form, businessCategory: k })} accessibilityRole="radio" />
        ))}
      </ScrollView>

      <Heading title={`Ảnh ô (${form.imageUrls.length}/6)`} note="Ảnh đầu tiên là ảnh bìa người thuê nhìn thấy." />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {form.imageUrls.map((u, i) => (
          <View key={u} style={{ width: 100, height: 100, borderRadius: radius.photo, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.sunken }}>
            <Image source={{ uri: apiAssetUrl(u) }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={150} />
            {i === 0 ? (
              <View style={{ position: 'absolute', left: 6, bottom: 6, paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.plate, backgroundColor: colors.cta }}>
                <Text style={{ fontFamily: fonts.heavy, fontSize: 11, color: colors.white }}>Bìa</Text>
              </View>
            ) : null}
            <Pressable onPress={() => setForm({ ...form, imageUrls: form.imageUrls.filter((x) => x !== u) })} accessibilityRole="button" accessibilityLabel="Bỏ ảnh" hitSlop={10} style={{ position: 'absolute', right: 5, top: 5, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(17,28,43,0.7)', alignItems: 'center', justifyContent: 'center' }}>
              <Icon sf="xmark" md="close" size={12} color={colors.white} weight="bold" />
            </Pressable>
          </View>
        ))}
        {form.imageUrls.length < 6 ? (
          <Pressable onPress={() => void addPhoto()} disabled={uploading} accessibilityRole="button" accessibilityLabel="Thêm ảnh ô" style={({ pressed }) => ({ width: 100, minHeight: 100, gap: 4, borderRadius: radius.photo, borderCurve: 'continuous', borderWidth: 2, borderStyle: 'dashed', borderColor: colors.brandLight, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? colors.brandTint : colors.kerbPaint })}>
            <Icon sf="camera.fill" md="photo_camera" size={22} color={colors.primary} />
            <Text style={[text.caption, { color: colors.primary }]}>{uploading ? 'Đang tải…' : 'Thêm ảnh'}</Text>
          </Pressable>
        ) : null}
      </View>
      {picker.sheet}
    </>
  );
}

/**
 * The slot at the top of its screen as it sits on the street: the code in plate lettering, its
 * route and state, the bay drawn to scale (frontage along the kerb, depth into the pavement),
 * its utilities; the painted kerb and the road under it.
 */
function SlotHero({ slot }: { slot: WardSlot }) {
  const t = toneOf(slot.status);
  const w = slot.widthMeters ?? 0;
  const l = slot.lengthMeters ?? 0;
  const k = w > 0 && l > 0 ? Math.min(132 / w, 84 / l, 56) : 0;
  const utilities = UTILITIES.filter(([key]) => slot[key]);
  return (
    <View style={{ borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.card, boxShadow: shadow.card }}>
      <View style={{ backgroundColor: colors.kerbPaint, padding: 20, gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 14 }}>
          <View style={{ flex: 1, gap: 6 }}>
            <Text maxFontSizeMultiplier={1.3} adjustsFontSizeToFit numberOfLines={1} style={[sign.figure, tabular, { color: colors.ink }]}>{slot.slotCode}</Text>
            <Text style={{ fontFamily: fonts.heavy, fontSize: 16, lineHeight: 21, color: colors.ink }}>{slot.zoneName}</Text>
            <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 5, borderRadius: radius.full, backgroundColor: t.wash }}>
              <Icon sf={t.icon.sf} md={t.icon.md} size={14} color={t.ink} />
              <Text style={{ fontFamily: fonts.heavy, fontSize: 13, color: t.ink }}>{statusWord[slot.status]}</Text>
            </View>
          </View>
          {k ? (
            <View style={{ alignItems: 'center', gap: 6 }}>
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: w * k, height: l * k, borderRadius: radius.plate, borderWidth: 2.5, borderStyle: slot.status === 'PENDING_APPLICATION' ? 'dashed' : 'solid', borderColor: t.swatch, backgroundColor: t.wash }} />
              <Text style={[text.caption, tabular, { color: colors.ink }]}>{`${metres(w)} × ${metres(l)} m`}</Text>
            </View>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {utilities.map(([key, label, icon]) => (
            <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full, backgroundColor: colors.white }}>
              <Icon sf={icon.sf} md={icon.md} size={13} color={colors.primary} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.ink }}>{label}</Text>
            </View>
          ))}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full, backgroundColor: colors.white }}>
            <Icon sf={slot.source === 'VENDOR_PROPOSED' ? 'person.fill' : 'building.columns.fill'} md={slot.source === 'VENDOR_PROPOSED' ? 'person' : 'account_balance'} size={13} color={colors.sign} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.ink }}>{slot.source === 'VENDOR_PROPOSED' ? 'Hộ kinh doanh đề xuất' : 'Phường tạo'}</Text>
          </View>
        </View>
      </View>
      <KerbStrip height={10} segment={22} />
      <Road />
    </View>
  );
}

/** Who changed what and when (BR-46), newest first, as a thin timeline. */
function Timeline({ title, rows }: { title: string; rows: { key: number; what: string; detail: string | null; who: string; at: string }[] }) {
  return (
    <View style={{ gap: 12 }}>
      <Heading title={title} />
      <Group>
        <View style={{ padding: 16, gap: 0 }}>
          {rows.map((r, i) => (
            <View key={r.key} style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ alignItems: 'center', width: 14 }}>
                <View style={{ width: 12, height: 12, borderRadius: 6, marginTop: 4, backgroundColor: i === 0 ? colors.sign : colors.line }} />
                {i < rows.length - 1 ? <View style={{ flex: 1, width: 2, backgroundColor: colors.line, marginVertical: 2 }} /> : null}
              </View>
              <View style={{ flex: 1, gap: 2, paddingBottom: i < rows.length - 1 ? 16 : 0 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, lineHeight: 20, color: colors.ink }}>{r.what}</Text>
                {r.detail ? <Text style={[text.footnote, { color: colors.ink }]}>{r.detail}</Text> : null}
                <Text style={[text.caption, tabular, { color: colors.muted }]}>{`${r.who}, ${r.at}`}</Text>
              </View>
            </View>
          ))}
        </View>
      </Group>
    </View>
  );
}

/** W16 Sửa ô (WARD-01/02): facilities, photos, size and position with a placement check; suspend or reopen with a reason; history. */
export function SlotEditScreen() {
  const { slotId } = useLocalSearchParams<{ slotId: string }>();
  const userId = useAuthStore((s) => s.user?.id);
  const cache = useQueryClient();
  const grid = useGrid();
  const slot = grid.data?.slots.find((s) => s.slotId === Number(slotId));
  const history = useQuery({ queryKey: ['ward', userId, 'slot-history', slotId], queryFn: () => wardConfigApi.slotHistory(Number(slotId)), enabled: Boolean(slot) });
  const zones = useQuery({ queryKey: ['ward', userId, 'zones'], queryFn: wardConfigApi.listZones });
  const [form, setForm] = useState<Form | null>(null);
  const [check, setCheck] = useState<PlacementCheck | null>(null);
  const [warnReason, setWarnReason] = useState('');
  const [statusReason, setStatusReason] = useState('');
  const refresh = () => void cache.invalidateQueries({ queryKey: ['ward', userId] });
  const save = useMutation({
    mutationFn: () => {
      const f = form!;
      const warns = check?.issues.some((i) => i.severity === 'WARN') ?? false;
      return wardConfigApi.updateSlot(slot!, { slotCode: f.slotCode.trim(), zoneId: f.zoneId, latitude: f.latitude, longitude: f.longitude, widthMeters: num(f.width), lengthMeters: num(f.length), hasPower: f.hasPower, hasWater: f.hasWater, hasTrashBin: f.hasTrashBin, businessCategory: f.businessCategory, imageUrls: f.imageUrls, acknowledgeWarnings: warns, warningReason: warns ? warnReason.trim() : null });
    },
    onSuccess: (r) => {
      setCheck(r.check);
      setForm(null);
      refresh();
      showToast('Đã lưu ô');
    },
    onError: (e) => showToast(errorMessage(e), 'error'),
  });
  const setStatus = useMutation({
    mutationFn: (status: 'AVAILABLE' | 'SUSPENDED') => wardConfigApi.setSlotStatus(slot!, status, statusReason.trim()),
    onSuccess: () => {
      setStatusReason('');
      refresh();
      showToast('Đã đổi trạng thái ô');
    },
    onError: (e) => showToast(errorMessage(e), 'error'),
  });
  const remove = useMutation({
    mutationFn: () => wardConfigApi.deleteSlot(slot!),
    onSuccess: () => {
      refresh();
      showToast('Đã xoá ô');
      router.back();
    },
    onError: (e) => showToast(errorMessage(e), 'error'),
  });

  if (grid.isPending) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Sửa ô' }} />
        <Skeleton height={220} radius={radius.card} />
        <ListSkeleton rows={2} height={120} />
      </Screen>
    );
  }
  if (!slot) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Sửa ô' }} />
        <ErrorState error={grid.error ?? new Error('Không tìm thấy ô này.')} onRetry={() => void grid.refetch()} />
      </Screen>
    );
  }
  const f = form ?? formOf(slot);
  const blocked = check?.issues.some((i) => i.severity === 'BLOCK') ?? false;
  const warns = check?.issues.some((i) => i.severity === 'WARN') ?? false;
  // A vendor-proposed slot is decided in the proposal review, never edited here (web SlotPanel).
  const readOnly = slot.source === 'VENDOR_PROPOSED';
  // Moving, resizing, renaming or re-zoning a slot must pass the server's placement check first.
  const geometryChanged =
    f.latitude !== slot.latitude || f.longitude !== slot.longitude || f.zoneId !== slot.zoneId || num(f.width) !== slot.widthMeters || num(f.length) !== slot.lengthMeters || f.slotCode.trim() !== slot.slotCode;
  const needsCheck = geometryChanged && !check;

  return (
    <Screen
      footer={
        form && !readOnly ? (
          <Button label={needsCheck ? 'Kiểm tra vị trí trước khi lưu' : 'Lưu thay đổi'} variant="sign" size={56} loading={save.isPending} disabled={needsCheck || blocked || (warns && !warnReason.trim()) || !f.slotCode.trim()} onPress={() => save.mutate()} />
        ) : undefined
      }
    >
      <Stack.Screen options={{ title: `Ô ${slot.slotCode}` }} />
      <SlotHero slot={slot} />
      {readOnly ? (
        <Banner tone="neutral">Ô do hộ kinh doanh đề xuất, được xử lý ở luồng duyệt đề xuất và không sửa tại đây.</Banner>
      ) : (
        <>
          {!slot.canEditGeometry ? <Banner tone="neutral">Ô không ở trạng thái Trống nên chỉ sửa được tiện ích, ngành hàng và ảnh.</Banner> : null}
          {slot.canEditGeometry && zones.data && zones.data.length > 1 ? (
            <>
              <Heading title="Tuyến" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }} style={{ marginHorizontal: -16 }}>
                {zones.data.map((z) => (
                  <Chip
                    key={z.zoneId}
                    label={z.zoneName}
                    selected={z.zoneId === f.zoneId}
                    onPress={() => {
                      setForm({ ...f, zoneId: z.zoneId });
                      setCheck(null);
                    }}
                    accessibilityRole="radio"
                  />
                ))}
              </ScrollView>
            </>
          ) : null}
          <SlotForm form={f} setForm={setForm} canMove={slot.canEditGeometry} ignoreSlotId={slot.slotId} check={check} setCheck={setCheck} />
          {warns ? <TextField label="Lý do vẫn đặt ô ở đây" value={warnReason} onChangeText={setWarnReason} multiline /> : null}
          {needsCheck ? <Text style={[text.footnote, { color: colors.muted }]}>Vị trí, kích thước, mã hoặc tuyến đã đổi: bấm “Kiểm tra vị trí” trước khi lưu.</Text> : null}
        </>
      )}

      {!readOnly && (slot.status === 'AVAILABLE' || slot.status === 'SUSPENDED') ? (
        <>
          <Heading title={slot.status === 'SUSPENDED' ? 'Mở lại ô' : 'Tạm ngưng ô'} note={slot.status === 'SUSPENDED' ? 'Ô trở lại danh sách cho thuê.' : 'Ô tạm rời danh sách cho thuê; mở lại được bất cứ lúc nào.'} />
          <Group>
            <View style={{ padding: 16, gap: 12 }}>
              <TextField label="Lý do" value={statusReason} onChangeText={setStatusReason} multiline placeholder="Bắt buộc" />
              <Button label={slot.status === 'SUSPENDED' ? 'Mở lại cho thuê' : 'Tạm ngưng cho thuê'} variant="secondary" loading={setStatus.isPending} disabled={!statusReason.trim()} onPress={() => setStatus.mutate(slot.status === 'SUSPENDED' ? 'AVAILABLE' : 'SUSPENDED')} />
            </View>
          </Group>
        </>
      ) : null}

      {history.data && history.data.length ? (
        <Timeline title="Lịch sử" rows={history.data.slice(0, 10).map((h) => ({ key: h.auditId, what: h.action, detail: h.details, who: h.actorName, at: formatVietnamDateTime(h.createdAt) }))} />
      ) : null}
      {slot.canHardDelete ? (
        <Pressable onPress={() => Alert.alert(`Xoá ô ${slot.slotCode}?`, 'Ô chưa từng có đơn nên xoá được hẳn.', [{ text: 'Giữ ô', style: 'cancel' }, { text: 'Xoá', style: 'destructive', onPress: () => remove.mutate() }])} accessibilityRole="button" style={{ alignSelf: 'center', minHeight: 48, justifyContent: 'center', paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon sf="trash" md="delete" size={16} color={colors.danger} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.danger }}>{remove.isPending ? 'Đang xoá…' : 'Xoá ô này'}</Text>
        </Pressable>
      ) : null}
    </Screen>
  );
}

/** W17 Thêm ô: pick the route, tap the spot, size, utilities; the server checks the placement first. */
export function NewSlotScreen() {
  const userId = useAuthStore((s) => s.user?.id);
  const cache = useQueryClient();
  const zones = useQuery({ queryKey: ['ward', userId, 'zones'], queryFn: wardConfigApi.listZones });
  const [zoneId, setZoneId] = useState<number | null>(null);
  const [form, setForm] = useState<Form>({ slotCode: '', width: '1.5', length: '2', hasPower: false, hasWater: false, hasTrashBin: false, businessCategory: null, imageUrls: [], latitude: DEFAULT_CENTER[0], longitude: DEFAULT_CENTER[1], zoneId: 0 });
  const [check, setCheck] = useState<PlacementCheck | null>(null);
  const [warnReason, setWarnReason] = useState('');
  const activeZone = zoneId ?? zones.data?.[0]?.zoneId ?? null;
  const create = useMutation({
    mutationFn: () => {
      const warns = check?.issues.some((i) => i.severity === 'WARN') ?? false;
      return wardConfigApi.createSlot({ slotCode: form.slotCode.trim() || null, zoneId: activeZone!, latitude: form.latitude, longitude: form.longitude, widthMeters: num(form.width), lengthMeters: num(form.length), hasPower: form.hasPower, hasWater: form.hasWater, hasTrashBin: form.hasTrashBin, businessCategory: form.businessCategory, imageUrls: form.imageUrls, acknowledgeWarnings: warns, warningReason: warns ? warnReason.trim() : null });
    },
    onSuccess: (r) => {
      void cache.invalidateQueries({ queryKey: ['ward', userId] });
      showToast(`Đã tạo ô ${r.slot.slotCode}`);
      router.replace(`/ward/slots/${r.slot.slotId}` as Href);
    },
    onError: (e) => showToast(errorMessage(e), 'error'),
  });
  if (zones.isPending) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Thêm ô' }} />
        <Skeleton height={44} radius={radius.full} width="70%" />
        <Skeleton height={300} radius={radius.card} />
        <ListSkeleton rows={2} height={64} />
      </Screen>
    );
  }
  if (zones.isError || !zones.data.length) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Thêm ô' }} />
        {zones.isError ? <ErrorState error={zones.error} onRetry={() => void zones.refetch()} /> : <StateView icon={{ sf: 'signpost.right', md: 'signpost' }} tone="neutral" title="Chưa có tuyến" body="Tạo tuyến trong Biểu giá thuê trước khi thêm ô." />}
      </Screen>
    );
  }
  const blocked = check?.issues.some((i) => i.severity === 'BLOCK') ?? false;
  const warns = check?.issues.some((i) => i.severity === 'WARN') ?? false;
  return (
    <Screen footer={<Button label={check ? 'Tạo ô' : 'Kiểm tra vị trí để tạo ô'} variant="sign" size={56} icon={{ sf: 'plus', md: 'add' }} loading={create.isPending} disabled={!check || blocked || (warns && !warnReason.trim())} onPress={() => create.mutate()} />}>
      <Stack.Screen options={{ title: 'Thêm ô' }} />
      <Heading title="Tuyến" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }} style={{ marginHorizontal: -16 }}>
        {zones.data.map((z) => (
          <Chip key={z.zoneId} label={z.zoneName} selected={z.zoneId === activeZone} onPress={() => { setZoneId(z.zoneId); setCheck(null); }} accessibilityRole="radio" />
        ))}
      </ScrollView>
      <SlotForm form={{ ...form, zoneId: activeZone ?? 0 }} setForm={setForm} canMove check={check} setCheck={setCheck} />
      {warns ? <TextField label="Lý do vẫn đặt ô ở đây" value={warnReason} onChangeText={setWarnReason} multiline /> : null}
      {!check ? <Text style={[text.footnote, { color: colors.muted }]}>Bấm “Kiểm tra vị trí” trước khi tạo ô.</Text> : null}
      <Heading title="Nhiều ô một lúc?" />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button label="Rải hàng loạt" variant="secondary" icon={{ sf: 'square.grid.3x1.below.line.grid.1x2', md: 'view_week' }} onPress={() => router.push('/ward/slots/batch' as Href)} style={{ flex: 1 }} />
        <Button label="Chướng ngại vật" variant="secondary" icon={{ sf: 'exclamationmark.triangle', md: 'warning' }} onPress={() => router.push('/ward/slots/features' as Href)} style={{ flex: 1 }} />
      </View>
    </Screen>
  );
}
