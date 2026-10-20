import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { Chip } from '@/components/common/Chip';
import { Icon } from '@/components/common/Icon';
import { KerbStrip } from '@/components/common/KerbStrip';
import { Skeleton } from '@/components/feedback/Skeleton';
import { ErrorState, ListSkeleton } from '@/components/feedback/States';
import { StateView } from '@/components/feedback/StateView';
import { showToast } from '@/components/feedback/Toast';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { LeafletMap, type MapMarker } from '@/components/map/LeafletMap';
import { Toggle } from '@/components/native/Toggle';
import { Checkbox } from '@/features/authentication/components/auth-parts';
import { DEFAULT_CENTER } from '@/features/sidewalk-slots/map-constants';
import { useAuthStore } from '@/store/auth-store';
import { colors, fonts, radius, shadow, sign, tabular, text } from '@/theme';
import {
  batchSlotCount,
  businessCategoryLabels,
  distanceMeters,
  errorMessage,
  featureTypeLabels,
  isConflict,
  MAX_BATCH_SLOTS,
  wardConfigApi,
  type BatchPreview,
  type SlotFacilities,
  type StreetFeatureType,
  type WardStreetFeature,
  type WardZone,
} from '../ward-config-api';

type Point = { latitude: number; longitude: number };

const sizeOf = (v: string) => {
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) && n > 0 && n <= 20 ? n : null;
};
const hasBlock = (issues: { severity: string }[]) => issues.some((i) => i.severity === 'BLOCK');

function useEditorData() {
  const userId = useAuthStore((s) => s.user?.id);
  const zones = useQuery({ queryKey: ['ward', userId, 'zones'], queryFn: wardConfigApi.listZones });
  const grid = useQuery({ queryKey: ['ward', userId, 'slot-grid', null], queryFn: () => wardConfigApi.slotGrid() });
  return { userId, zones, grid };
}

/** A heading inside a long form (heavy, with an optional one-line note). */
function Heading({ title, note, aside }: { title: string; note?: string; aside?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginTop: 8 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text accessibilityRole="header" style={{ fontFamily: fonts.heavy, fontSize: 19, lineHeight: 25, color: colors.ink }}>{title}</Text>
        {note ? <Text style={[text.footnote, { color: colors.muted }]}>{note}</Text> : null}
      </View>
      {aside}
    </View>
  );
}

/** A white grouped surface (map cards, settings rows). */
function Group({ children }: { children: ReactNode }) {
  return <View style={{ borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.card, boxShadow: shadow.card }}>{children}</View>;
}

/** A strip of asphalt with its dashed centre line (decorative). */
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

/** The zone chips every editor form starts with. */
function ZonePicker({ zones, value, onChange }: { zones: WardZone[]; value: number; onChange: (id: number) => void }) {
  return (
    <>
      <Heading title="Tuyến" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }} style={{ marginHorizontal: -16 }}>
        {zones.map((z) => (
          <Chip key={z.zoneId} label={z.zoneName} selected={z.zoneId === value} onPress={() => onChange(z.zoneId)} accessibilityRole="radio" />
        ))}
      </ScrollView>
    </>
  );
}

function EditorGate({ title, zones, grid, children }: { title: string; zones: ReturnType<typeof useEditorData>['zones']; grid: ReturnType<typeof useEditorData>['grid']; children: (zones: WardZone[]) => React.ReactNode }) {
  if (zones.isPending || grid.isPending) {
    return (
      <Screen>
        <Stack.Screen options={{ title }} />
        <Skeleton height={300} radius={radius.card} />
        <ListSkeleton rows={2} height={64} />
      </Screen>
    );
  }
  if (zones.isError || grid.isError) {
    return (
      <Screen>
        <Stack.Screen options={{ title }} />
        <ErrorState error={zones.error ?? grid.error} onRetry={() => void Promise.all([zones.refetch(), grid.refetch()])} />
      </Screen>
    );
  }
  if (!zones.data.length) {
    return (
      <Screen>
        <Stack.Screen options={{ title }} />
        <StateView icon={{ sf: 'signpost.right', md: 'signpost' }} tone="neutral" title="Chưa có tuyến" body="Tạo tuyến trong Biểu giá thuê trước." />
      </Screen>
    );
  }
  return <>{children(zones.data)}</>;
}

/** A figure with its words, used for the measured stretch. */
function Figure({ value, label, tone = colors.ink }: { value: string; label: string; tone?: string }) {
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`} style={{ flex: 1, gap: 2 }}>
      <Text maxFontSizeMultiplier={1.3} adjustsFontSizeToFit numberOfLines={1} style={[sign.title, tabular, { color: tone }]}>{value}</Text>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18, color: colors.muted }}>{label}</Text>
    </View>
  );
}

const UTILITIES = [
  ['hasPower', 'Có điện', { sf: 'bolt.fill', md: 'bolt' }],
  ['hasWater', 'Có nước', { sf: 'drop.fill', md: 'water_drop' }],
  ['hasTrashBin', 'Có thùng rác', { sf: 'trash.fill', md: 'delete' }],
] as const;

/**
 * W17b Rải ô hàng loạt (web BatchPanel): tap the two ends of a kerb stretch, set the slot size and
 * spacing, preview what the server would lay (each spot checked against the boundary, the street
 * features and existing slots), untick any spot, then create them in one go. Blocked spots are
 * never created; warnings need the officer's acknowledgement and a reason.
 */
export function BatchSlotsScreen() {
  const { userId, zones, grid } = useEditorData();
  return (
    <EditorGate title="Rải ô hàng loạt" zones={zones} grid={grid}>
      {(zoneList) => <BatchSlots zones={zoneList} userId={userId} existing={grid.data?.slots.map((s) => ({ id: s.slotId, zoneId: s.zoneId, latitude: s.latitude, longitude: s.longitude, code: s.slotCode })) ?? []} />}
    </EditorGate>
  );
}

function BatchSlots({ zones, userId, existing }: { zones: WardZone[]; userId: string | undefined; existing: { id: number; zoneId: number; latitude: number; longitude: number; code: string }[] }) {
  const cache = useQueryClient();
  const [pins, setPins] = useState<Point[]>([]);
  const [zoneId, setZoneId] = useState(zones[0]!.zoneId);
  const [width, setWidth] = useState('1.5');
  const [length, setLength] = useState('2');
  const [gap, setGap] = useState('1');
  const [facilities, setFacilities] = useState<SlotFacilities>({ hasPower: false, hasWater: false, hasTrashBin: false, businessCategory: null });
  const [preview, setPreview] = useState<BatchPreview | null>(null);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [ack, setAck] = useState(false);
  const [reason, setReason] = useState('');

  const w = sizeOf(width);
  const l = sizeOf(length);
  const g = Number(gap.replace(',', '.'));
  const gapValid = Number.isFinite(g) && g >= 0 && g <= 100;
  const segment = pins.length === 2 ? distanceMeters(pins[0]!, pins[1]!) : null;
  const estimate = segment != null && l != null && gapValid ? batchSlotCount(segment, l, g) : null;
  const tooShort = segment != null && l != null && segment < l;
  // A preview only holds for the stretch, size, spacing and zone it was computed with.
  const stale = () => {
    setPreview(null);
    setExcluded(new Set());
    setAck(false);
  };

  const run = useMutation({
    mutationFn: () =>
      wardConfigApi.previewBatch({
        zoneId,
        startLatitude: pins[0]!.latitude,
        startLongitude: pins[0]!.longitude,
        endLatitude: pins[1]!.latitude,
        endLongitude: pins[1]!.longitude,
        widthMeters: w!,
        lengthMeters: l!,
        gapMeters: g,
      }),
    onSuccess: (data) => {
      setPreview(data);
      setExcluded(new Set(data.candidates.filter((c) => hasBlock(c.issues)).map((c) => c.index)));
      setAck(false);
    },
    onError: (e) => showToast(errorMessage(e), 'error'),
  });
  const chosen = preview?.candidates.filter((c) => !excluded.has(c.index)) ?? [];
  const warned = chosen.some((c) => c.issues.length > 0);
  const create = useMutation({
    mutationFn: () =>
      wardConfigApi.createBatch({
        zoneId,
        positions: chosen.map((c) => ({ latitude: c.latitude, longitude: c.longitude })),
        widthMeters: w!,
        lengthMeters: l!,
        ...facilities,
        acknowledgeWarnings: warned,
        warningReason: warned ? reason.trim() : null,
      }),
    onSuccess: (slots) => {
      showToast(`Đã tạo ${slots.length} ô`, 'success');
      void cache.invalidateQueries({ queryKey: ['ward', userId] });
      router.back();
    },
    onError: (e) => showToast(errorMessage(e), 'error'),
  });

  // Only the chosen route's slots, so the map frames that street rather than the whole ward.
  const onRoute = useMemo(() => existing.filter((s) => s.zoneId === zoneId), [existing, zoneId]);
  const markers = useMemo<MapMarker[]>(() => {
    const out: MapMarker[] = onRoute.map((s) => ({ id: `s${s.id}`, latitude: s.latitude, longitude: s.longitude, label: s.code, fill: '#C9D1DA', ink: colors.ink }));
    pins.forEach((p, i) => out.push({ id: `p${i}`, latitude: p.latitude, longitude: p.longitude, label: i === 0 ? 'Đầu' : 'Cuối', fill: colors.sign, ink: colors.white, selected: true }));
    preview?.candidates.forEach((c) => {
      const blocked = hasBlock(c.issues);
      const off = excluded.has(c.index);
      out.push({ id: `c${c.index}`, latitude: c.latitude, longitude: c.longitude, label: c.proposedCode, fill: blocked ? colors.danger : c.issues.length ? colors.mango : off ? '#9AA4AF' : colors.cta, ink: c.issues.length && !blocked ? colors.ink : colors.white, dashed: off });
    });
    return out;
  }, [onRoute, pins, preview, excluded]);

  const tap = (latitude: number, longitude: number) => {
    stale();
    setPins((p) => (p.length >= 2 ? [{ latitude, longitude }] : [...p, { latitude, longitude }]));
  };
  const flagged = (preview?.candidates ?? []).filter((c) => c.issues.length > 0);

  return (
    <Screen
      footer={
        preview ? (
          <Button label={`Tạo ${chosen.length} ô`} variant="sign" size={56} icon={{ sf: 'plus', md: 'add' }} loading={create.isPending} disabled={chosen.length === 0 || (warned && (!ack || !reason.trim()))} onPress={() => create.mutate()} />
        ) : (
          <Button label="Xem trước dãy ô" size={56} variant="sign" icon={{ sf: 'eye', md: 'visibility' }} loading={run.isPending} disabled={pins.length < 2 || w == null || l == null || !gapValid || tooShort} onPress={() => run.mutate()} />
        )
      }
    >
      <Stack.Screen options={{ title: 'Rải ô hàng loạt' }} />
      <Group>
        <LeafletMap center={pins[0] ? [pins[0].latitude, pins[0].longitude] : onRoute[0] ? [onRoute[0].latitude, onRoute[0].longitude] : DEFAULT_CENTER} zoom={18} markers={markers} onMapPress={tap} style={{ height: 300 }} />
        <View style={{ padding: 14, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {['Điểm đầu', 'Điểm cuối'].map((label, i) => (
              <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 34, paddingHorizontal: 12, borderRadius: radius.full, backgroundColor: pins.length > i ? colors.sign : colors.sunken }}>
                <Icon sf={pins.length > i ? 'checkmark' : 'mappin'} md={pins.length > i ? 'check' : 'location_on'} size={13} color={pins.length > i ? colors.white : colors.muted} />
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: pins.length > i ? colors.white : colors.muted }}>{label}</Text>
              </View>
            ))}
            <View style={{ flex: 1 }} />
            {pins.length ? (
              <Pressable onPress={() => { setPins([]); stale(); }} accessibilityRole="button" hitSlop={8} style={{ minHeight: 44, justifyContent: 'center' }}>
                <Text style={{ fontFamily: fonts.heavy, fontSize: 14.5, color: colors.sign }}>Chọn lại</Text>
              </Pressable>
            ) : null}
          </View>
          <Text style={[text.footnote, { color: colors.muted }]}>{pins.length < 2 ? `Chạm bản đồ để chọn ${pins.length === 0 ? 'điểm đầu' : 'điểm cuối'} của đoạn vỉa hè. Tối đa ${MAX_BATCH_SLOTS} ô mỗi lần.` : 'Chạm lại bản đồ để chọn đoạn khác.'}</Text>
        </View>
      </Group>

      {segment != null ? (
        // The measured stretch, read like a tape: how long, and how many bays fit on it.
        <View style={{ padding: 16, gap: 10, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: tooShort ? colors.dangerTint : colors.card, boxShadow: tooShort ? undefined : shadow.card }}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Figure value={`${segment < 10 ? segment.toFixed(1).replace('.', ',') : Math.round(segment)} m`} label="Đoạn dài khoảng" tone={tooShort ? colors.onDanger : colors.ink} />
            {!tooShort && estimate != null ? <Figure value={`${estimate} ô`} label="Rải được khoảng" tone={colors.primary} /> : null}
          </View>
          {tooShort ? (
            <Text style={[text.footnote, { color: colors.onDanger }]}>{`Ngắn hơn chiều dài một ô (${l} m). Chọn điểm cuối xa hơn hoặc giảm chiều dài ô.`}</Text>
          ) : estimate === MAX_BATCH_SLOTS ? (
            <Text style={[text.footnote, { color: colors.onMango }]}>Đã chạm giới hạn, phần còn lại rải ở lượt sau.</Text>
          ) : null}
        </View>
      ) : null}

      <ZonePicker zones={zones} value={zoneId} onChange={(id) => { setZoneId(id); stale(); }} />
      <Heading title="Kích thước mỗi ô" />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <TextField label="Rộng (m)" value={width} onChangeText={(v) => { setWidth(v); stale(); }} keyboardType="decimal-pad" error={w == null ? '0–20 m' : undefined} />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Dài (m)" value={length} onChangeText={(v) => { setLength(v); stale(); }} keyboardType="decimal-pad" error={l == null ? '0–20 m' : undefined} />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Cách nhau (m)" value={gap} onChangeText={(v) => { setGap(v); stale(); }} keyboardType="decimal-pad" error={gapValid ? undefined : '0–100 m'} />
        </View>
      </View>

      <Heading title="Tiện ích cho cả dãy" />
      <Group>
        {UTILITIES.map(([k, label, icon], i) => (
          <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: colors.separator }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: facilities[k] ? colors.brandTint : colors.sunken, alignItems: 'center', justifyContent: 'center' }}>
              <Icon sf={icon.sf} md={icon.md} size={17} color={facilities[k] ? colors.primary : colors.muted} />
            </View>
            <Text style={[text.body, { flex: 1, fontFamily: fonts.semibold, color: colors.ink }]}>{label}</Text>
            <Toggle value={facilities[k]} onChange={(v) => setFacilities({ ...facilities, [k]: v })} />
          </View>
        ))}
      </Group>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }} style={{ marginHorizontal: -16 }}>
        <Chip label="Không gợi ý ngành" selected={!facilities.businessCategory} onPress={() => setFacilities({ ...facilities, businessCategory: null })} accessibilityRole="radio" />
        {Object.entries(businessCategoryLabels).map(([k, label]) => (
          <Chip key={k} label={label} selected={facilities.businessCategory === k} onPress={() => setFacilities({ ...facilities, businessCategory: k })} accessibilityRole="radio" />
        ))}
      </ScrollView>

      {preview ? (
        <>
          <Heading title="Dãy ô xem trước" note={`${preview.candidates.length} vị trí đề xuất, chọn ${chosen.length} ô. Chạm một ô để bỏ hoặc giữ.`} />
          {/* The stretch as it will be painted: road, kerb, and each proposed bay on the pavement */}
          <Group>
            <Road />
            <KerbStrip height={8} segment={20} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12, backgroundColor: colors.kerbPaint }}>
              {preview.candidates.map((c) => {
                const blocked = hasBlock(c.issues);
                const on = !excluded.has(c.index);
                const look = blocked
                  ? { wash: colors.dangerTint, edge: colors.danger, ink: colors.onDanger, word: 'Bị chặn' }
                  : !on
                    ? { wash: colors.sunken, edge: '#9AA4AF', ink: colors.muted, word: 'Bỏ qua' }
                    : c.issues.length
                      ? { wash: colors.mangoTint, edge: colors.mango, ink: colors.onMango, word: 'Có cảnh báo' }
                      : { wash: colors.leafTint, edge: colors.leaf, ink: colors.onLeaf, word: 'Sẽ tạo' };
                return (
                  <Pressable
                    key={c.index}
                    onPress={() => setExcluded((s) => { const n = new Set(s); if (on) n.add(c.index); else n.delete(c.index); return n; })}
                    disabled={blocked}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on && !blocked, disabled: blocked }}
                    accessibilityLabel={`Ô ${c.proposedCode}, ${look.word}`}
                    style={({ pressed }) => ({ width: '31.3%', minHeight: 72, paddingHorizontal: 9, paddingVertical: 8, gap: 2, borderRadius: radius.plate, borderWidth: 2, borderStyle: on && !blocked ? 'solid' : 'dashed', borderColor: look.edge, backgroundColor: look.wash, opacity: pressed ? 0.75 : 1 })}
                  >
                    <Text maxFontSizeMultiplier={1.4} adjustsFontSizeToFit numberOfLines={1} style={[sign.price, tabular, { color: colors.ink }]}>{c.proposedCode}</Text>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 12, lineHeight: 16, color: look.ink }}>{look.word}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Group>
          {!preview.boundaryVerified ? <Text style={[text.footnote, { color: colors.muted }]}>Phường chưa có ranh giới để đối chiếu.</Text> : null}
          {flagged.length ? (
            <Group>
              {flagged.map((c, i) => (
                <View key={c.index} style={{ flexDirection: 'row', gap: 12, padding: 14, borderTopWidth: i ? 1 : 0, borderTopColor: colors.separator }}>
                  <View style={{ alignSelf: 'flex-start', paddingHorizontal: 8, minHeight: 26, justifyContent: 'center', borderRadius: radius.plate, backgroundColor: colors.plate }}>
                    <Text style={[sign.plate, { color: colors.white }]}>{c.proposedCode}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    {c.issues.map((issue, j) => (
                      <Text key={j} style={[text.footnote, { color: issue.severity === 'BLOCK' ? colors.onDanger : colors.onMango }]}>{issue.message}</Text>
                    ))}
                  </View>
                </View>
              ))}
            </Group>
          ) : null}
          {warned ? (
            <View style={{ gap: 8 }}>
              <Checkbox checked={ack} onChange={setAck}>Tôi đã xem các cảnh báo và vẫn muốn tạo</Checkbox>
              {ack ? <TextField label="Lý do bỏ qua cảnh báo" value={reason} onChangeText={(v) => setReason(v.slice(0, 500))} multiline /> : null}
            </View>
          ) : null}
          <Button label="Xem trước lại" variant="secondary" icon={{ sf: 'arrow.clockwise', md: 'refresh' }} loading={run.isPending} onPress={() => run.mutate()} />
        </>
      ) : null}
    </Screen>
  );
}

const FEATURE_TYPES = Object.keys(featureTypeLabels) as StreetFeatureType[];
const FEATURE_ICONS: Record<StreetFeatureType, { sf: string; md: string }> = {
  TRANSFORMER: { sf: 'bolt.fill', md: 'electrical_services' },
  HYDRANT: { sf: 'flame.fill', md: 'fire_hydrant' },
  TREE: { sf: 'tree.fill', md: 'park' },
  LIGHT_POLE: { sf: 'lightbulb.fill', md: 'lightbulb' },
  BUS_STOP: { sf: 'bus.fill', md: 'directions_bus' },
  PARKING: { sf: 'parkingsign', md: 'local_parking' },
};

/**
 * W17c Chướng ngại vật (web FeaturePanel): hydrants, transformers, trees, poles, bus stops and
 * parking the slots must keep clear of. Tap the map to place one; edit or delete existing ones.
 * The server says which existing slots end up too close, so the officer can review them.
 */
export function StreetFeaturesScreen() {
  const { userId, zones, grid } = useEditorData();
  return (
    <EditorGate title="Chướng ngại vật" zones={zones} grid={grid}>
      {(zoneList) => <StreetFeatures zones={zoneList} userId={userId} features={grid.data?.features ?? []} />}
    </EditorGate>
  );
}

function StreetFeatures({ zones, userId, features }: { zones: WardZone[]; userId: string | undefined; features: WardStreetFeature[] }) {
  const cache = useQueryClient();
  const [point, setPoint] = useState<Point | null>(null);
  const [editing, setEditing] = useState<WardStreetFeature | null>(null);
  const [zoneId, setZoneId] = useState(zones[0]!.zoneId);
  const [type, setType] = useState<StreetFeatureType>('HYDRANT');
  const [label, setLabel] = useState('');
  const [blocks, setBlocks] = useState(true);
  const [note, setNote] = useState('');
  const [focus, setFocus] = useState<Point | null>(null);

  const reset = () => {
    setPoint(null);
    setEditing(null);
    setZoneId(zones[0]!.zoneId);
    setType('HYDRANT');
    setLabel('');
    setBlocks(true);
    setNote('');
  };
  const startEdit = (f: WardStreetFeature) => {
    // A tap made before choosing "Sửa" must not silently become the feature's new position.
    setPoint(null);
    setEditing(f);
    setZoneId(f.zoneId);
    setType(f.featureType);
    setLabel(f.label);
    setBlocks(f.blocksBusiness);
    setNote(f.note ?? '');
    setFocus({ latitude: f.latitude, longitude: f.longitude });
  };
  const position = point ?? (editing ? { latitude: editing.latitude, longitude: editing.longitude } : null);
  const refresh = () => void cache.invalidateQueries({ queryKey: ['ward', userId] });
  const onError = (e: unknown) => {
    showToast(errorMessage(e), 'error');
    if (isConflict(e)) refresh();
  };
  const done = (affected: number, verb: string) => {
    showToast(affected ? `${verb}. Lưu ý ${affected} ô hiện có nằm quá gần chướng ngại vật này — xem lại các ô đó.` : `${verb} chướng ngại vật`, affected ? 'info' : 'success');
    reset();
    refresh();
  };
  const input = () => ({ zoneId, featureType: type, label: label.trim(), latitude: position!.latitude, longitude: position!.longitude, blocksBusiness: blocks, note: note.trim() || null });
  const create = useMutation({ mutationFn: () => wardConfigApi.createFeature(input()), onSuccess: (r) => done(r.affectedSlots.length, 'Đã thêm'), onError });
  const update = useMutation({ mutationFn: () => wardConfigApi.updateFeature(editing!, input()), onSuccess: (r) => done(r.affectedSlots.length, 'Đã lưu'), onError });
  const remove = useMutation({
    mutationFn: (f: WardStreetFeature) => wardConfigApi.deleteFeature(f),
    onSuccess: (_, f) => {
      showToast('Đã xoá chướng ngại vật', 'success');
      if (editing?.featureId === f.featureId) reset();
      refresh();
    },
    onError,
  });

  const markers = useMemo<MapMarker[]>(() => {
    const out: MapMarker[] = features.map((f) => ({ id: `f${f.featureId}`, latitude: f.latitude, longitude: f.longitude, label: featureTypeLabels[f.featureType].split(' ')[0], fill: f.blocksBusiness ? colors.danger : colors.sign, ink: colors.white, selected: editing?.featureId === f.featureId }));
    if (point) out.push({ id: 'new', latitude: point.latitude, longitude: point.longitude, label: editing ? 'Vị trí mới' : 'Mới', fill: colors.cta, ink: colors.white, selected: true });
    return out;
  }, [features, point, editing]);
  const center: [number, number] = focus ? [focus.latitude, focus.longitude] : features[0] ? [features[0].latitude, features[0].longitude] : DEFAULT_CENTER;

  return (
    <Screen
      footer={
        <Button
          label={editing ? 'Lưu thay đổi' : 'Thêm chướng ngại vật'}
          variant="sign"
          size={56}
          loading={create.isPending || update.isPending}
          disabled={!position || !label.trim()}
          onPress={() => (editing ? update.mutate() : create.mutate())}
        />
      }
    >
      <Stack.Screen options={{ title: 'Chướng ngại vật' }} />
      <Group>
        <LeafletMap
          key={focus ? `${focus.latitude},${focus.longitude}` : 'map'}
          center={center}
          zoom={18}
          markers={markers}
          onMarkerPress={(id) => {
            const f = features.find((x) => `f${x.featureId}` === id);
            if (f) startEdit(f);
          }}
          onMapPress={(latitude, longitude) => setPoint({ latitude, longitude })}
          style={{ height: 280 }}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 }}>
          <Icon sf={point ? 'mappin.circle.fill' : 'hand.tap.fill'} md={point ? 'where_to_vote' : 'touch_app'} size={18} color={point ? colors.primary : colors.muted} />
          <Text style={[text.footnote, tabular, { flex: 1, color: point ? colors.ink : colors.muted }]}>
            {editing
              ? point
                ? 'Đã chọn vị trí mới; bấm Lưu để dời chướng ngại vật tới đó.'
                : 'Giữ nguyên vị trí cũ. Chạm bản đồ nếu muốn dời.'
              : point
                ? `${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`
                : 'Chạm bản đồ để chọn vị trí chướng ngại vật; chạm một ghim để sửa.'}
          </Text>
        </View>
      </Group>
      {editing ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.signTint }}>
          <Icon sf="pencil" md="edit" size={18} color={colors.sign} />
          <Text style={[text.headline, { flex: 1, color: colors.sign }]}>{`Sửa: ${editing.label}`}</Text>
          <Pressable onPress={reset} accessibilityRole="button" hitSlop={8} style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.heavy, fontSize: 14.5, color: colors.sign }}>Huỷ sửa</Text>
          </Pressable>
        </View>
      ) : null}
      <ZonePicker zones={zones} value={zoneId} onChange={setZoneId} />
      <Heading title="Loại" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {FEATURE_TYPES.map((t) => (
          <Chip key={t} label={featureTypeLabels[t]} icon={FEATURE_ICONS[t]} selected={t === type} onPress={() => setType(t)} accessibilityRole="radio" />
        ))}
      </View>
      <TextField label="Tên / mô tả ngắn" value={label} onChangeText={(v) => setLabel(v.slice(0, 150))} placeholder="VD: Trụ cứu hoả trước số 12" />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: blocks ? colors.dangerTint : colors.card, boxShadow: blocks ? undefined : shadow.card }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: blocks ? colors.danger : colors.sunken, alignItems: 'center', justifyContent: 'center' }}>
          <Icon sf="nosign" md="block" size={18} color={blocks ? colors.white : colors.muted} />
        </View>
        <Text style={[text.callout, { flex: 1, fontFamily: fonts.semibold, color: blocks ? colors.onDanger : colors.ink }]}>Cấm đặt ô sạp đè lên vị trí này</Text>
        <Toggle value={blocks} onChange={setBlocks} />
      </View>
      <TextField label="Ghi chú" optional value={note} onChangeText={(v) => setNote(v.slice(0, 200))} />

      {features.length ? (
        <View style={{ gap: 12 }}>
          <Heading title={`Chướng ngại vật hiện có (${features.length})`} />
          <Group>
            {features.map((f, i) => {
              const icon = FEATURE_ICONS[f.featureType];
              const on = editing?.featureId === f.featureId;
              return (
                <View key={f.featureId} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 14, paddingRight: 6, paddingVertical: 10, minHeight: 64, borderTopWidth: i ? 1 : 0, borderTopColor: colors.separator, backgroundColor: on ? colors.signTint : colors.card }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: f.blocksBusiness ? colors.dangerTint : colors.signTint, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon sf={icon.sf} md={icon.md} size={19} color={f.blocksBusiness ? colors.danger : colors.sign} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, color: colors.ink }} numberOfLines={2}>{f.label}</Text>
                    <Text style={[text.footnote, { color: colors.muted }]}>
                      {[featureTypeLabels[f.featureType], f.blocksBusiness ? 'cấm đặt ô' : null, f.clearanceMeters ? `chừa ${f.clearanceMeters} m` : null].filter(Boolean).join(', ')}
                    </Text>
                  </View>
                  <Pressable onPress={() => startEdit(f)} accessibilityRole="button" accessibilityLabel={`Sửa ${f.label}`} style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? colors.signTint : 'transparent' })}>
                    <Icon sf="pencil" md="edit" size={18} color={colors.sign} />
                  </Pressable>
                  <Pressable
                    onPress={() => Alert.alert(`Xoá "${f.label}"?`, 'Các ô gần đó sẽ không còn bị ràng buộc bởi chướng ngại vật này.', [{ text: 'Giữ lại', style: 'cancel' }, { text: 'Xoá', style: 'destructive', onPress: () => remove.mutate(f) }])}
                    accessibilityRole="button"
                    accessibilityLabel={`Xoá ${f.label}`}
                    style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? colors.dangerTint : 'transparent' })}
                  >
                    <Icon sf="trash" md="delete" size={18} color={colors.danger} />
                  </Pressable>
                </View>
              );
            })}
          </Group>
        </View>
      ) : (
        <StateView icon={{ sf: 'mappin.slash', md: 'location_off' }} tone="neutral" title="Chưa có chướng ngại vật" body="Chạm bản đồ ở trên để đánh dấu trụ cứu hoả, tủ điện, cây xanh mà ô sạp phải tránh." />
      )}
    </Screen>
  );
}
