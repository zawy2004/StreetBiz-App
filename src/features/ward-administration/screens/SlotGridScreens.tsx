import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, ScrollView, Switch, Text, View } from 'react-native';

import { Card, KeyValueList, Segments } from '@/components/common/Blocks';
import { Button } from '@/components/common/Button';
import { Chip } from '@/components/common/Chip';
import { Icon } from '@/components/common/Icon';
import { SlotPlate } from '@/components/common/SlotPlate';
import { Banner } from '@/components/feedback/Banner';
import { ErrorState, ListSkeleton } from '@/components/feedback/States';
import { StateView } from '@/components/feedback/StateView';
import { showToast } from '@/components/feedback/Toast';
import { useFilePicker } from '@/components/forms/FileSourceSheet';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { LeafletMap, type MapMarker } from '@/components/map/LeafletMap';
import { errorMessage } from '@/core/api';
import { apiAssetUrl } from '@/core/api/asset-url';
import { SLOT_STATE } from '@/features/sidewalk-slots/slot-tones';
import { DEFAULT_CENTER } from '@/features/sidewalk-slots/map-constants';
import { useAuthStore } from '@/store/auth-store';
import { colors, fonts, radius, shadow, tabular, text } from '@/theme';
import { formatVietnamDateTime } from '@/utils/format';
import { businessCategoryLabels, wardConfigApi, type PlacementCheck, type WardSlot } from '../ward-config-api';

type Bucket = 'all' | 'AVAILABLE' | 'BUSY' | 'ACTIVE' | 'SUSPENDED';
const toneOf = (s: WardSlot['status']) => (s === 'AVAILABLE' ? SLOT_STATE.AVAILABLE : s === 'PENDING_APPLICATION' ? SLOT_STATE.PENDING : s === 'SUSPENDED' ? SLOT_STATE.SUSPENDED : SLOT_STATE.ACTIVE);
const statusWord: Record<WardSlot['status'], string> = { AVAILABLE: 'Còn trống', PENDING_APPLICATION: 'Có đơn chờ', ACTIVE: 'Đã cho thuê', SUSPENDED: 'Tạm ngưng' };
const inBucket = (s: WardSlot, b: Bucket) => b === 'all' || (b === 'BUSY' ? s.status === 'PENDING_APPLICATION' : s.status === b);

function useGrid() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({ queryKey: ['ward', userId, 'slot-grid', null], queryFn: () => wardConfigApi.slotGrid() });
}

/** W15 Lưới ô (WARD-01/02): every slot of the ward by state, as a list grouped by route or pins on the map. */
export function SlotBoardScreen() {
  const grid = useGrid();
  const [bucket, setBucket] = useState<Bucket>('all');
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'LIST' | 'MAP'>('LIST');
  const slots = useMemo(() => grid.data?.slots ?? [], [grid.data]);
  const needle = query.trim().toLowerCase();
  const shown = slots.filter((s) => inBucket(s, bucket) && (!needle || s.slotCode.toLowerCase().includes(needle) || s.zoneName.toLowerCase().includes(needle)));
  const count = (b: Bucket) => slots.filter((s) => inBucket(s, b)).length;
  const markers = useMemo<MapMarker[]>(() => shown.map((s) => ({ id: String(s.slotId), latitude: s.latitude, longitude: s.longitude, label: s.slotCode, fill: toneOf(s.status).swatch, ink: toneOf(s.status).onSwatch })), [shown]);
  const open = (slotId: number) => router.push(`/ward/slots/${slotId}` as Href);

  const header = (
    <View style={{ gap: 12, paddingBottom: 8 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['AVAILABLE', 'BUSY', 'ACTIVE', 'SUSPENDED'] as const).map((b) => {
          const t = b === 'BUSY' ? SLOT_STATE.PENDING : b === 'AVAILABLE' ? SLOT_STATE.AVAILABLE : b === 'ACTIVE' ? SLOT_STATE.ACTIVE : SLOT_STATE.SUSPENDED;
          const on = bucket === b;
          return (
            <Pressable key={b} onPress={() => setBucket(on ? 'all' : b)} accessibilityRole="radio" accessibilityState={{ selected: on }} style={{ flex: 1, padding: 10, gap: 2, borderRadius: 14, backgroundColor: t.wash, borderWidth: on ? 2 : 0, borderColor: t.ink }}>
              <Text style={[{ fontFamily: fonts.code, fontSize: 22, color: t.ink }, tabular]}>{count(b)}</Text>
              <Text style={[text.caption, { color: t.ink }]} numberOfLines={1}>{b === 'BUSY' ? 'Có đơn' : t.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <TextField label="Tìm ô hoặc tuyến" value={query} onChangeText={setQuery} placeholder="VD: NVL-12" autoCapitalize="characters" />
      <Segments<'LIST' | 'MAP'> value={view} onChange={setView} options={[{ key: 'LIST', label: 'Danh sách' }, { key: 'MAP', label: 'Bản đồ' }]} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: 'Lưới ô vỉa hè' }} />
      {view === 'MAP' && !grid.isPending ? (
        <View style={{ flex: 1 }}>
          <View style={{ padding: 16, paddingBottom: 0 }}>{header}</View>
          <LeafletMap center={DEFAULT_CENTER} zoom={16} markers={markers} onMarkerPress={(id) => open(Number(id))} style={{ flex: 1 }} />
        </View>
      ) : (
        <FlatList
          data={grid.isPending ? [] : shown}
          keyExtractor={(s) => String(s.slotId)}
          contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 110 }}
          ListHeaderComponent={header}
          refreshControl={<RefreshControl refreshing={grid.isRefetching} onRefresh={() => void grid.refetch()} tintColor={colors.cta} colors={[colors.cta]} />}
          renderItem={({ item }) => <SlotRow slot={item} onPress={() => open(item.slotId)} />}
          ListEmptyComponent={
            grid.isPending ? <ListSkeleton rows={5} height={68} /> : grid.isError ? <ErrorState error={grid.error} onRetry={() => void grid.refetch()} /> : <StateView icon={{ sf: 'square.grid.3x3', md: 'grid_view' }} tone="neutral" title={slots.length ? 'Không có ô khớp' : 'Chưa có ô vỉa hè nào'} body={slots.length ? 'Đổi bộ lọc hoặc từ khoá.' : 'Thêm ô đầu tiên trên bản đồ.'} />
          }
        />
      )}
      <View pointerEvents="box-none" style={{ position: 'absolute', right: 16, bottom: 16 }}>
        <Pressable onPress={() => router.push('/ward/slots/new' as Href)} accessibilityRole="button" accessibilityLabel="Thêm ô mới" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, height: 52, paddingHorizontal: 20, borderRadius: 26, backgroundColor: pressed ? colors.ctaPressed : colors.cta, boxShadow: shadow.raised })}>
          <Icon sf="plus" md="add" size={18} color={colors.white} weight="bold" />
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.white }}>Thêm ô</Text>
        </Pressable>
      </View>
    </View>
  );
}

function SlotRow({ slot, onPress }: { slot: WardSlot; onPress: () => void }) {
  const t = toneOf(slot.status);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Ô ${slot.slotCode}, ${statusWord[slot.status]}`} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: pressed ? '#FBFBFC' : colors.card })}>
      <View style={{ width: 10, alignSelf: 'stretch', borderRadius: 5, backgroundColor: t.swatch }} />
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <SlotPlate code={slot.slotCode} />
          {slot.source === 'VENDOR_PROPOSED' ? <Text style={[text.caption, { color: colors.sign }]}>Hộ đề xuất</Text> : null}
        </View>
        <Text style={[text.caption, { color: colors.muted }]} numberOfLines={1}>
          {slot.zoneName}
          {slot.widthMeters != null && slot.lengthMeters != null ? ` · ${slot.widthMeters}×${slot.lengthMeters} m` : ''}
        </Text>
      </View>
      <View style={{ paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, backgroundColor: t.wash }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: t.ink }}>{statusWord[slot.status]}</Text>
      </View>
    </Pressable>
  );
}

/** Placement issues from the server: BLOCK stops the save; WARN needs a reason to go ahead. */
function PlacementResult({ check }: { check: PlacementCheck | null }) {
  if (!check) return null;
  if (check.issues.length === 0) return <Banner tone="success">{check.boundaryVerified ? 'Vị trí hợp lệ, trong ranh giới phường.' : 'Không thấy vướng mắc (chưa có ranh giới phường để đối chiếu).'}</Banner>;
  const blocks = check.issues.filter((i) => i.severity === 'BLOCK');
  return (
    <Banner tone={blocks.length ? 'danger' : 'warning'} title={blocks.length ? 'Không đặt ô được ở đây' : 'Cần xem lại'}>
      {check.issues.map((i) => `• ${i.message}`).join('\n')}
    </Banner>
  );
}

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
      <Card padded={false}>
        <LeafletMap center={[form.latitude, form.longitude]} zoom={18} markers={markers} onMapPress={canMove ? (latitude, longitude) => { setForm({ ...form, latitude, longitude }); setCheck(null); } : undefined} style={{ height: 220 }} />
        <View style={{ padding: 12, gap: 8 }}>
          <Text style={[text.caption, { color: colors.muted }, tabular]}>{form.latitude.toFixed(6)}, {form.longitude.toFixed(6)}{canMove ? ' · chạm bản đồ để dời ô' : ' · ô đang có hợp đồng, không dời được'}</Text>
          <Button label="Kiểm tra vị trí" variant="secondary" icon={{ sf: 'checkmark.shield', md: 'verified_user' }} loading={verify.isPending} disabled={!(num(form.width) > 0 && num(form.length) > 0)} onPress={() => verify.mutate()} />
        </View>
      </Card>
      <PlacementResult check={check} />
      <TextField label="Mã ô" value={form.slotCode} onChangeText={(v) => setForm({ ...form, slotCode: v.toUpperCase() })} autoCapitalize="characters" optional={!ignoreSlotId} hint={ignoreSlotId ? undefined : 'Để trống để hệ thống tự đặt mã'} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <TextField label="Mặt tiền (m)" value={form.width} onChangeText={(v) => { setForm({ ...form, width: v }); setCheck(null); }} keyboardType="decimal-pad" editable={canMove} />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Chiều sâu (m)" value={form.length} onChangeText={(v) => { setForm({ ...form, length: v }); setCheck(null); }} keyboardType="decimal-pad" editable={canMove} />
        </View>
      </View>
      <Card style={{ gap: 6 }}>
        {(
          [
            ['hasPower', 'Có điện'],
            ['hasWater', 'Có nước'],
            ['hasTrashBin', 'Có thùng rác'],
          ] as const
        ).map(([k, l]) => (
          <View key={k} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
            <Text style={[text.callout, { color: colors.ink }]}>{l}</Text>
            <Switch value={form[k]} onValueChange={(v) => setForm({ ...form, [k]: v })} trackColor={{ true: colors.leaf, false: colors.line }} thumbColor={colors.white} accessibilityLabel={l} />
          </View>
        ))}
      </Card>
      <Text style={[text.subhead, { color: colors.ink }]}>Ngành hàng gợi ý</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }} style={{ marginHorizontal: -16 }}>
        <Chip label="Không gợi ý" selected={!form.businessCategory} onPress={() => setForm({ ...form, businessCategory: null })} accessibilityRole="radio" />
        {Object.entries(businessCategoryLabels).map(([k, l]) => (
          <Chip key={k} label={l} selected={form.businessCategory === k} onPress={() => setForm({ ...form, businessCategory: k })} accessibilityRole="radio" />
        ))}
      </ScrollView>
      <Text style={[text.subhead, { color: colors.ink }]}>Ảnh ô ({form.imageUrls.length}/6)</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {form.imageUrls.map((u, i) => (
          <View key={u} style={{ width: 96, height: 96, borderRadius: 14, overflow: 'hidden' }}>
            <Image source={{ uri: apiAssetUrl(u) }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
            {i === 0 ? <Text style={{ position: 'absolute', left: 6, top: 6, fontFamily: fonts.bold, fontSize: 10, color: colors.white, backgroundColor: 'rgba(17,28,43,0.6)', paddingHorizontal: 5, borderRadius: 4 }}>Bìa</Text> : null}
            <Pressable onPress={() => setForm({ ...form, imageUrls: form.imageUrls.filter((x) => x !== u) })} accessibilityRole="button" accessibilityLabel="Bỏ ảnh" hitSlop={6} style={{ position: 'absolute', right: 4, top: 4, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(17,28,43,0.7)', alignItems: 'center', justifyContent: 'center' }}>
              <Icon sf="xmark" md="close" size={12} color={colors.white} weight="bold" />
            </Pressable>
          </View>
        ))}
        <Pressable onPress={() => void addPhoto()} disabled={uploading} accessibilityRole="button" style={{ width: 96, height: 96, borderRadius: 14, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.brandLight, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.kerbPaint }}>
          <Icon sf="camera.fill" md="photo_camera" size={22} color={colors.primary} />
          <Text style={[text.caption, { color: colors.primary }]}>{uploading ? 'Đang tải…' : 'Thêm ảnh'}</Text>
        </Pressable>
      </View>
      {picker.sheet}
    </>
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
        <ListSkeleton rows={3} height={120} />
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
  const t = toneOf(slot.status);

  return (
    <Screen footer={form ? <Button label="Lưu thay đổi" size={56} loading={save.isPending} disabled={blocked || (warns && !warnReason.trim()) || !f.slotCode.trim()} onPress={() => save.mutate()} /> : undefined}>
      <Stack.Screen options={{ title: `Ô ${slot.slotCode}` }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <SlotPlate code={slot.slotCode} size="lg" />
        <View style={{ flex: 1 }}>
          <Text style={[text.subhead, { color: colors.ink }]}>{slot.zoneName}</Text>
          <View style={{ alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, backgroundColor: t.wash, marginTop: 4 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: t.ink }}>{statusWord[slot.status]}</Text>
          </View>
        </View>
      </View>
      <SlotForm form={f} setForm={setForm} canMove={slot.canEditGeometry} ignoreSlotId={slot.slotId} check={check} setCheck={setCheck} />
      {warns ? <TextField label="Lý do vẫn đặt ô ở đây" value={warnReason} onChangeText={setWarnReason} multiline /> : null}

      {slot.status === 'AVAILABLE' || slot.status === 'SUSPENDED' ? (
        <Card style={{ gap: 10 }}>
          <Text style={{ fontFamily: fonts.heavy, fontSize: 16, color: colors.ink }}>{slot.status === 'SUSPENDED' ? 'Mở lại ô' : 'Tạm ngưng ô'}</Text>
          <TextField label="Lý do" value={statusReason} onChangeText={setStatusReason} multiline placeholder="Bắt buộc" />
          <Button label={slot.status === 'SUSPENDED' ? 'Mở lại cho thuê' : 'Tạm ngưng cho thuê'} variant="secondary" loading={setStatus.isPending} disabled={!statusReason.trim()} onPress={() => setStatus.mutate(slot.status === 'SUSPENDED' ? 'AVAILABLE' : 'SUSPENDED')} />
        </Card>
      ) : null}

      {history.data && history.data.length ? (
        <Card style={{ gap: 8 }}>
          <Text style={{ fontFamily: fonts.heavy, fontSize: 16, color: colors.ink }}>Lịch sử</Text>
          {history.data.slice(0, 10).map((h) => (
            <View key={h.auditId} style={{ gap: 1 }}>
              <Text style={[text.footnote, { color: colors.ink }]}>{h.action}{h.details ? ` · ${h.details}` : ''}</Text>
              <Text style={[text.caption, { color: colors.muted }]}>{h.actorName} · {formatVietnamDateTime(h.createdAt)}</Text>
            </View>
          ))}
        </Card>
      ) : null}
      {slot.canHardDelete ? (
        <Pressable onPress={() => Alert.alert(`Xoá ô ${slot.slotCode}?`, 'Ô chưa từng có đơn nên xoá được hẳn.', [{ text: 'Giữ ô', style: 'cancel' }, { text: 'Xoá', style: 'destructive', onPress: () => remove.mutate() }])} accessibilityRole="button" style={{ alignSelf: 'center', padding: 10 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.danger }}>{remove.isPending ? 'Đang xoá…' : 'Xoá ô này'}</Text>
        </Pressable>
      ) : null}
      <KeyValueList rows={[{ label: 'Nguồn', value: slot.source === 'VENDOR_PROPOSED' ? 'Hộ kinh doanh đề xuất' : 'Phường tạo' }]} />
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
        <ListSkeleton rows={3} height={100} />
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
    <Screen footer={<Button label="Tạo ô" size={56} icon={{ sf: 'plus', md: 'add' }} loading={create.isPending} disabled={!check || blocked || (warns && !warnReason.trim())} onPress={() => create.mutate()} />}>
      <Stack.Screen options={{ title: 'Thêm ô' }} />
      <Text style={[text.subhead, { color: colors.ink }]}>Tuyến</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }} style={{ marginHorizontal: -16 }}>
        {zones.data.map((z) => (
          <Chip key={z.zoneId} label={z.zoneName} selected={z.zoneId === activeZone} onPress={() => { setZoneId(z.zoneId); setCheck(null); }} accessibilityRole="radio" />
        ))}
      </ScrollView>
      <SlotForm form={{ ...form, zoneId: activeZone ?? 0 }} setForm={setForm} canMove check={check} setCheck={setCheck} />
      {warns ? <TextField label="Lý do vẫn đặt ô ở đây" value={warnReason} onChangeText={setWarnReason} multiline /> : null}
      {!check ? <Text style={[text.caption, { color: colors.muted }]}>Bấm “Kiểm tra vị trí” trước khi tạo ô.</Text> : null}
      <Banner tone="neutral">Vẽ hàng loạt ô và vật cản trên tuyến (cột điện, trụ cứu hoả…) làm trên bản web, nơi có màn hình lớn.</Banner>
    </Screen>
  );
}
