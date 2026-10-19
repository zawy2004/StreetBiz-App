import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, Text, View } from 'react-native';

import { Card } from '@/components/common/Blocks';
import { Button } from '@/components/common/Button';
import { Chip } from '@/components/common/Chip';
import { Icon } from '@/components/common/Icon';
import { Banner } from '@/components/feedback/Banner';
import { ErrorState, ListSkeleton } from '@/components/feedback/States';
import { StateView } from '@/components/feedback/StateView';
import { showToast } from '@/components/feedback/Toast';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { LeafletMap, type MapMarker } from '@/components/map/LeafletMap';
import { Checkbox } from '@/features/authentication/components/auth-parts';
import { DEFAULT_CENTER } from '@/features/sidewalk-slots/map-constants';
import { useAuthStore } from '@/store/auth-store';
import { colors, fonts, radius, tabular, text } from '@/theme';
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

/** The zone chips every editor form starts with. */
function ZonePicker({ zones, value, onChange }: { zones: WardZone[]; value: number; onChange: (id: number) => void }) {
  return (
    <>
      <Text style={[text.subhead, { color: colors.ink }]}>Tuyến</Text>
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
        <ListSkeleton rows={3} height={110} />
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

  return (
    <Screen
      footer={
        preview ? (
          <Button label={`Tạo ${chosen.length} ô`} size={56} icon={{ sf: 'plus', md: 'add' }} loading={create.isPending} disabled={chosen.length === 0 || (warned && (!ack || !reason.trim()))} onPress={() => create.mutate()} />
        ) : (
          <Button label="Xem trước dãy ô" size={56} variant="sign" icon={{ sf: 'eye', md: 'visibility' }} loading={run.isPending} disabled={pins.length < 2 || w == null || l == null || !gapValid || tooShort} onPress={() => run.mutate()} />
        )
      }
    >
      <Stack.Screen options={{ title: 'Rải ô hàng loạt' }} />
      <Card padded={false}>
        <LeafletMap center={pins[0] ? [pins[0].latitude, pins[0].longitude] : onRoute[0] ? [onRoute[0].latitude, onRoute[0].longitude] : DEFAULT_CENTER} zoom={18} markers={markers} onMapPress={tap} style={{ height: 300 }} />
        <View style={{ padding: 12, gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {['Điểm đầu', 'Điểm cuối'].map((label, i) => (
              <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 30, paddingHorizontal: 10, borderRadius: 15, backgroundColor: pins.length > i ? colors.sign : colors.sunken }}>
                <Icon sf={pins.length > i ? 'checkmark' : 'mappin'} md={pins.length > i ? 'check' : 'location_on'} size={13} color={pins.length > i ? colors.white : colors.muted} />
                <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: pins.length > i ? colors.white : colors.muted }}>{label}</Text>
              </View>
            ))}
            <View style={{ flex: 1 }} />
            {pins.length ? (
              <Pressable onPress={() => { setPins([]); stale(); }} accessibilityRole="button" hitSlop={8}>
                <Text style={[text.subhead, { color: colors.sign }]}>Chọn lại</Text>
              </Pressable>
            ) : null}
          </View>
          <Text style={[text.caption, { color: colors.muted }]}>{pins.length < 2 ? `Chạm bản đồ để chọn ${pins.length === 0 ? 'điểm đầu' : 'điểm cuối'} của đoạn vỉa hè. Tối đa ${MAX_BATCH_SLOTS} ô mỗi lần.` : 'Chạm lại bản đồ để chọn đoạn khác.'}</Text>
        </View>
      </Card>

      {segment != null ? (
        <Banner tone={tooShort ? 'danger' : 'neutral'}>
          {`Đoạn dài khoảng ${segment < 10 ? segment.toFixed(1).replace('.', ',') : Math.round(segment)} m${
            tooShort
              ? ` — ngắn hơn chiều dài một ô (${l} m). Chọn điểm cuối xa hơn hoặc giảm chiều dài ô.`
              : estimate != null
                ? ` → rải được khoảng ${estimate} ô${estimate === MAX_BATCH_SLOTS ? ' (đã chạm giới hạn, phần còn lại rải ở lượt sau)' : ''}.`
                : '.'
          }`}
        </Banner>
      ) : null}

      <ZonePicker zones={zones} value={zoneId} onChange={(id) => { setZoneId(id); stale(); }} />
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

      <Card style={{ gap: 4 }}>
        <Text style={[text.subhead, { color: colors.ink }]}>Tiện ích cho cả dãy</Text>
        {(
          [
            ['hasPower', 'Có điện'],
            ['hasWater', 'Có nước'],
            ['hasTrashBin', 'Có thùng rác'],
          ] as const
        ).map(([k, label]) => (
          <View key={k} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
            <Text style={[text.callout, { color: colors.ink }]}>{label}</Text>
            <Switch value={facilities[k]} onValueChange={(v) => setFacilities({ ...facilities, [k]: v })} trackColor={{ true: colors.leaf, false: colors.line }} thumbColor={colors.white} accessibilityLabel={label} />
          </View>
        ))}
      </Card>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }} style={{ marginHorizontal: -16 }}>
        <Chip label="Không gợi ý ngành" selected={!facilities.businessCategory} onPress={() => setFacilities({ ...facilities, businessCategory: null })} accessibilityRole="radio" />
        {Object.entries(businessCategoryLabels).map(([k, label]) => (
          <Chip key={k} label={label} selected={facilities.businessCategory === k} onPress={() => setFacilities({ ...facilities, businessCategory: k })} accessibilityRole="radio" />
        ))}
      </ScrollView>

      {preview ? (
        <Card style={{ gap: 10 }}>
          <Text style={[text.headline, { color: colors.ink }]}>{`${preview.candidates.length} vị trí đề xuất · chọn ${chosen.length} ô`}</Text>
          {!preview.boundaryVerified ? <Text style={[text.caption, { color: colors.muted }]}>Phường chưa có ranh giới để đối chiếu.</Text> : null}
          {preview.candidates.map((c) => {
            const blocked = hasBlock(c.issues);
            const on = !excluded.has(c.index);
            return (
              <View key={c.index} style={{ gap: 4, padding: 10, borderRadius: radius.control, borderCurve: 'continuous', backgroundColor: blocked ? colors.dangerTint : c.issues.length ? colors.mangoTint : colors.sunken }}>
                <Pressable
                  onPress={() => setExcluded((s) => { const n = new Set(s); if (on) n.add(c.index); else n.delete(c.index); return n; })}
                  disabled={blocked}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on, disabled: blocked }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 36 }}
                >
                  <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: on && !blocked ? colors.cta : colors.line, backgroundColor: on && !blocked ? colors.cta : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                    {on && !blocked ? <Icon sf="checkmark" md="check" size={12} color={colors.white} weight="bold" /> : null}
                  </View>
                  <Text style={[{ fontFamily: fonts.code, fontSize: 16, color: colors.ink }, tabular]}>{c.proposedCode}</Text>
                  <Text style={[text.caption, { color: blocked ? colors.onDanger : colors.onMango }]}>{blocked ? 'bị chặn' : c.issues.length ? 'có cảnh báo' : ''}</Text>
                </Pressable>
                {c.issues.map((issue, i) => (
                  <Text key={i} style={[text.footnote, { color: issue.severity === 'BLOCK' ? colors.onDanger : colors.onMango }]}>{`• ${issue.message}`}</Text>
                ))}
              </View>
            );
          })}
          {warned ? (
            <View style={{ gap: 8 }}>
              <Checkbox checked={ack} onChange={setAck}>Tôi đã xem các cảnh báo và vẫn muốn tạo</Checkbox>
              {ack ? <TextField label="Lý do bỏ qua cảnh báo" value={reason} onChangeText={(v) => setReason(v.slice(0, 500))} multiline /> : null}
            </View>
          ) : null}
          <Button label="Xem trước lại" variant="secondary" loading={run.isPending} onPress={() => run.mutate()} />
        </Card>
      ) : null}
    </Screen>
  );
}

const FEATURE_TYPES = Object.keys(featureTypeLabels) as StreetFeatureType[];

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
          size={56}
          loading={create.isPending || update.isPending}
          disabled={!position || !label.trim()}
          onPress={() => (editing ? update.mutate() : create.mutate())}
        />
      }
    >
      <Stack.Screen options={{ title: 'Chướng ngại vật' }} />
      <Card padded={false}>
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
        <View style={{ padding: 12 }}>
          <Text style={[text.caption, { color: point ? colors.primary : colors.muted }, tabular]}>
            {editing
              ? point
                ? 'Đã chọn vị trí mới; bấm Lưu để dời chướng ngại vật tới đó.'
                : 'Giữ nguyên vị trí cũ. Chạm bản đồ nếu muốn dời.'
              : point
                ? `${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`
                : 'Chạm bản đồ để chọn vị trí chướng ngại vật; chạm một ghim để sửa.'}
          </Text>
        </View>
      </Card>
      {editing ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={[text.headline, { flex: 1, color: colors.ink }]}>{`Sửa: ${editing.label}`}</Text>
          <Pressable onPress={reset} accessibilityRole="button" hitSlop={8}>
            <Text style={[text.subhead, { color: colors.sign }]}>Huỷ sửa</Text>
          </Pressable>
        </View>
      ) : null}
      <ZonePicker zones={zones} value={zoneId} onChange={setZoneId} />
      <Text style={[text.subhead, { color: colors.ink }]}>Loại</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {FEATURE_TYPES.map((t) => (
          <Chip key={t} label={featureTypeLabels[t]} selected={t === type} onPress={() => setType(t)} accessibilityRole="radio" />
        ))}
      </View>
      <TextField label="Tên / mô tả ngắn" value={label} onChangeText={(v) => setLabel(v.slice(0, 150))} placeholder="VD: Trụ cứu hoả trước số 12" />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48, paddingHorizontal: 12, borderRadius: radius.control, backgroundColor: colors.dangerTint }}>
        <Text style={[text.callout, { flex: 1, color: colors.onDanger }]}>Cấm đặt ô sạp đè lên vị trí này</Text>
        <Switch value={blocks} onValueChange={setBlocks} trackColor={{ true: colors.danger, false: colors.line }} thumbColor={colors.white} accessibilityLabel="Cấm đặt ô sạp đè lên vị trí này" />
      </View>
      <TextField label="Ghi chú" optional value={note} onChangeText={(v) => setNote(v.slice(0, 200))} />

      {features.length ? (
        <View style={{ gap: 8 }}>
          <Text style={[text.subhead, { color: colors.ink }]}>{`Chướng ngại vật hiện có (${features.length})`}</Text>
          {features.map((f) => (
            <View key={f.featureId} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, borderWidth: editing?.featureId === f.featureId ? 2 : 0, borderColor: colors.cta }}>
              <View style={{ width: 10, alignSelf: 'stretch', borderRadius: 5, backgroundColor: f.blocksBusiness ? colors.danger : colors.sign }} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[text.subhead, { color: colors.ink }]} numberOfLines={1}>{f.label}</Text>
                <Text style={[text.caption, { color: colors.muted }]} numberOfLines={1}>{`${featureTypeLabels[f.featureType]}${f.blocksBusiness ? ' · cấm đặt ô' : ''}${f.clearanceMeters ? ` · chừa ${f.clearanceMeters} m` : ''}`}</Text>
              </View>
              <Pressable onPress={() => startEdit(f)} accessibilityRole="button" accessibilityLabel={`Sửa ${f.label}`} hitSlop={6} style={{ padding: 8 }}>
                <Icon sf="pencil" md="edit" size={18} color={colors.sign} />
              </Pressable>
              <Pressable
                onPress={() => Alert.alert(`Xoá "${f.label}"?`, 'Các ô gần đó sẽ không còn bị ràng buộc bởi chướng ngại vật này.', [{ text: 'Giữ lại', style: 'cancel' }, { text: 'Xoá', style: 'destructive', onPress: () => remove.mutate(f) }])}
                accessibilityRole="button"
                accessibilityLabel={`Xoá ${f.label}`}
                hitSlop={6}
                style={{ padding: 8 }}
              >
                <Icon sf="trash" md="delete" size={18} color={colors.danger} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}
