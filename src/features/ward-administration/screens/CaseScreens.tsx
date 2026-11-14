import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';

import { Card, KeyValueList, Segments } from '@/components/common/Blocks';
import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { KerbStrip } from '@/components/common/KerbStrip';
import { ProtectedFileTile } from '@/components/common/ProtectedFile';
import { SlotPlate } from '@/components/common/SlotPlate';
import { Skeleton } from '@/components/feedback/Skeleton';
import { ErrorState, ListSkeleton } from '@/components/feedback/States';
import { StateView } from '@/components/feedback/StateView';
import { showToast } from '@/components/feedback/Toast';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { LeafletMap } from '@/components/map/LeafletMap';
import { StatusHeader } from '@/components/native/StatusHeader';
import { StatusPill } from '@/components/status/StatusPill';
import { errorMessage } from '@/core/api';
import { env } from '@/core/config/env';
import { DEFAULT_CENTER } from '@/features/sidewalk-slots/map-constants';
import { useAuthStore } from '@/store/auth-store';
import { colors, fonts, radius, shadow, tabular, text } from '@/theme';
import { Plate } from '@/ui';
import { formatVietnamDateTime, formatVnd } from '@/utils/format';
import { ProposalAssessment } from '../components/ProposalAssessment';
import { Blockers } from '../components/ReviewParts';
import { actionLabels, caseLabels, evidenceLabels, statusLabel, wardApi, type CaseKind, type GeoPoint, type WardCase } from '../ward-api';

const KINDS: CaseKind[] = ['proposals', 'conflicts', 'transfers'];
const toneOf = (status: string): 'ok' | 'pending' | 'danger' | 'neutral' => (status === 'APPROVED' ? 'ok' : status === 'REJECTED' ? 'danger' : status === 'WITHDRAWN' ? 'neutral' : 'pending');
const utc = (iso: string) => (iso.endsWith('Z') ? iso : `${iso}Z`);

/** W06 Hồ sơ vị trí: proposals, address conflicts and transfers, each with the server's own status. */
export function WardCasesScreen() {
  const { kind: initial } = useLocalSearchParams<{ kind?: CaseKind }>();
  const userId = useAuthStore((s) => s.user?.id);
  const [kind, setKind] = useState<CaseKind>(initial && KINDS.includes(initial) ? initial : 'proposals');
  const list = useInfiniteQuery({
    queryKey: ['ward', userId, 'cases', kind],
    queryFn: ({ pageParam }) => wardApi.list(kind, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
  });
  const items = useMemo(() => list.data?.pages.flatMap((p) => p.items) ?? [], [list.data]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: 'Hồ sơ vị trí' }} />
      <FlatList
        data={list.isPending ? [] : items}
        keyExtractor={(c) => `${c.kind}-${c.id}`}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} tintColor={colors.cta} colors={[colors.cta]} />}
        ListHeaderComponent={
          <View style={{ paddingBottom: 6 }}>
            <Segments<CaseKind> value={kind} onChange={setKind} options={KINDS.map((k) => ({ key: k, label: caseLabels[k] }))} />
          </View>
        }
        onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && void list.fetchNextPage()}
        onEndReachedThreshold={0.4}
        renderItem={({ item }) => <CaseRow item={item} />}
        ListEmptyComponent={
          list.isPending ? (
            <ListSkeleton rows={4} height={124} />
          ) : list.isError ? (
            <ErrorState error={list.error} onRetry={() => void list.refetch()} />
          ) : (
            <StateView icon={{ sf: 'tray', md: 'inbox' }} tone="neutral" title={`Không có ${caseLabels[kind].toLowerCase()}`} body="Hồ sơ mới gửi tới phường sẽ hiện ở đây. Kéo xuống để tải lại." action={{ label: 'Tải lại', onPress: () => void list.refetch() }} />
          )
        }
        ListFooterComponent={list.isFetchingNextPage ? <ListSkeleton rows={1} height={124} /> : null}
      />
    </View>
  );
}

function CaseRow({ item }: { item: WardCase }) {
  const awaiting = item.actions.length > 0;
  return (
    <Pressable
      onPress={() => router.push(`/ward/inbox/cases/${item.kind}/${item.id}` as Href)}
      accessibilityRole="button"
      accessibilityLabel={`Ô ${item.slotCode}, ${item.applicant}, ${statusLabel(item.kind, item.status)}${awaiting ? ', chờ bạn quyết định' : ''}`}
      style={({ pressed }) => ({ padding: 16, gap: 10, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: pressed ? colors.kerbPaint : colors.card, boxShadow: shadow.card, borderLeftWidth: 5, borderLeftColor: awaiting ? colors.mango : colors.card })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Plate code={item.slotCode} />
        <View style={{ flex: 1 }} />
        <StatusPill label={statusLabel(item.kind, item.status)} tone={toneOf(item.status)} />
      </View>
      <View style={{ gap: 3 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 16, lineHeight: 22, color: colors.ink }} numberOfLines={2}>{item.applicant}</Text>
        <Text style={[text.footnote, { color: colors.muted }]} numberOfLines={2}>{item.summary || item.title}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        {awaiting ? <StatusPill label="Chờ bạn quyết định" tone="pending" /> : null}
        {item.fastTrack ? <StatusPill label="Ưu tiên" tone="ok" /> : null}
        <Text style={[text.caption, tabular, { color: colors.muted }]}>{formatVietnamDateTime(utc(item.createdAt))}</Text>
      </View>
    </Pressable>
  );
}

/** W07 Chi tiết hồ sơ vị trí: the facts, the location check for a proposal, documents, then the decision. */
export function WardCaseScreen() {
  const { kind, id } = useLocalSearchParams<{ kind: CaseKind; id: string }>();
  const userId = useAuthStore((s) => s.user?.id);
  const cache = useQueryClient();
  const key = ['ward', userId, kind, id];
  const record = useQuery({ queryKey: key, queryFn: () => wardApi.get(kind!, id!), enabled: Boolean(kind && id && KINDS.includes(kind)) });
  const [reason, setReason] = useState('');
  const decide = useMutation({
    mutationFn: ({ data, action }: { data: WardCase; action: string }) => wardApi.decide(data, action, reason.trim()),
    onSuccess: (data, { action }) => {
      cache.setQueryData(key, data);
      setReason('');
      void cache.invalidateQueries({ queryKey: ['ward', userId, 'cases'] });
      showToast(`Đã ghi nhận: ${actionLabels[action] ?? action}`);
    },
    onError: (e) => {
      void cache.invalidateQueries({ queryKey: key });
      showToast(errorMessage(e), 'error');
    },
  });
  const title = kind && KINDS.includes(kind) ? caseLabels[kind] : 'Hồ sơ';
  if (!kind || !KINDS.includes(kind)) {
    return (
      <Screen>
        <Stack.Screen options={{ title }} />
        <ErrorState error={new Error('Mã hồ sơ không hợp lệ.')} />
      </Screen>
    );
  }
  if (record.isPending) {
    return (
      <Screen gap={20}>
        <Stack.Screen options={{ title }} />
        <Skeleton height={170} radius={radius.card} />
        <Skeleton height={300} radius={radius.card} />
        <Skeleton height={140} radius={radius.card} />
      </Screen>
    );
  }
  if (record.isError) {
    return (
      <Screen>
        <Stack.Screen options={{ title }} />
        <ErrorState error={record.error} onRetry={() => void record.refetch()} />
      </Screen>
    );
  }
  const d = record.data;
  const awaiting = d.actions.length > 0;
  const evidence = d.evidenceUrl && (d.evidenceUrl.startsWith('/') || /^https?:\/\//i.test(d.evidenceUrl)) ? d.evidenceUrl : null;
  return (
    <Screen onRefresh={() => void record.refetch()} refreshing={record.isRefetching} gap={20}>
      <Stack.Screen options={{ title }} />
      {/* The slot's street plate, large, over the painted kerb */}
      <View style={{ borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadow.card, overflow: 'hidden' }}>
        <View style={{ padding: 18, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <SlotPlate code={d.slotCode} size="lg" />
            <View style={{ flex: 1 }} />
            <StatusPill label={statusLabel(kind, d.status)} tone={toneOf(d.status)} />
          </View>
          <Text selectable style={[text.title2, { color: colors.ink }]}>{d.applicant}</Text>
          {d.summary ? <Text style={[text.callout, { color: colors.ink }]}>{d.summary}</Text> : null}
        </View>
        <KerbStrip height={8} segment={18} />
      </View>
      {kind === 'proposals' ? <LocationCheck record={d} onSaved={(next) => cache.setQueryData(key, next)} /> : null}
      {kind === 'proposals' && env.enableAiCompliance ? <ProposalAssessment record={d} /> : null}
      <Blockers items={d.blockers} />
      <Card style={{ padding: 18 }}>
        <KeyValueList
          rows={[
            { label: 'Gửi lúc', value: formatVietnamDateTime(utc(d.createdAt)) },
            d.fastTrack ? { label: 'Ưu tiên', value: 'Xử lý nhanh' } : null,
            kind !== 'transfers' && d.contractTerm ? { label: 'Thời hạn giữ nguyên', value: d.contractTerm } : null,
            d.outstanding != null ? { label: 'Phí và phạt chưa nộp', value: formatVnd(d.outstanding), emphasis: d.outstanding > 0 } : null,
            d.queuePosition != null ? { label: 'Vị trí hàng chờ', value: String(d.queuePosition) } : null,
            d.reason ? { label: 'Lý do đã ghi nhận', value: d.reason } : null,
          ]}
        />
      </Card>
      {evidence || (d.documents && d.documents.length > 0) ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {evidence ? <ProtectedFileTile fileUrl={evidence} label="Ảnh minh chứng" /> : null}
          {d.documents?.map((doc) => (
            <ProtectedFileTile key={doc.fileUrl} fileUrl={doc.fileUrl} label={evidenceLabels[doc.evidenceType] ?? doc.evidenceType} />
          ))}
        </View>
      ) : null}
      {awaiting ? (
        <View style={{ borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadow.raised }}>
          <View style={{ borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden' }}>
            <View style={{ height: 8, backgroundColor: colors.sign }} />
            <View style={{ padding: 18, gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.signTint, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon sf="person.badge.shield.checkmark.fill" md="admin_panel_settings" size={22} color={colors.sign} />
                </View>
                <Text accessibilityRole="header" style={{ flex: 1, fontFamily: fonts.heavy, fontSize: 19, lineHeight: 25, color: colors.ink }}>Quyết định của cán bộ</Text>
              </View>
              <TextField label="Lý do quyết định" value={reason} onChangeText={(v) => setReason(v.slice(0, 500))} multiline placeholder="Bắt buộc" hint={`${reason.length}/500 ký tự`} editable={!decide.isPending} />
              <Text style={[text.footnote, { color: colors.muted }]}>Thao tác máy chủ cho phép: {d.actions.map((a) => actionLabels[a] ?? a).join(', ')}</Text>
              {d.actions.map((action) => (
                <Button
                  key={action}
                  label={actionLabels[action] ?? action}
                  variant={action === 'APPROVE' ? 'sign' : 'secondary'}
                  size={action === 'APPROVE' ? 56 : 50}
                  loading={decide.isPending && decide.variables?.action === action}
                  disabled={!reason.trim() || decide.isPending || record.isRefetching}
                  // Confirmed first, like the web's ConfirmDialog: the decision is the officer's and final.
                  onPress={() =>
                    Alert.alert(actionLabels[action] ?? action, reason.trim(), [
                      { text: 'Quay lại', style: 'cancel' },
                      { text: 'Xác nhận', style: action === 'APPROVE' ? 'default' : 'destructive', onPress: () => decide.mutate({ data: d, action }) },
                    ])
                  }
                />
              ))}
            </View>
          </View>
        </View>
      ) : (
        <StatusHeader tone="neutral" title="Hồ sơ này không còn chờ quyết định của bạn." />
      )}
    </Screen>
  );
}

/** A proposal's one question: is this point inside the ward? Tap the map, check, then save. */
function LocationCheck({ record, onSaved }: { record: WardCase; onSaved: (c: WardCase) => void }) {
  const [point, setPoint] = useState<GeoPoint | null>(record.location);
  const [address, setAddress] = useState('');
  const [verified, setVerified] = useState<{ inside: boolean; key: string } | null>(null);
  const pointKey = point ? `${point.latitude.toFixed(6)},${point.longitude.toFixed(6)}` : '';
  const search = useMutation({ mutationFn: (q: string) => wardApi.search(q), onError: (e) => showToast(errorMessage(e), 'error') });
  const verify = useMutation({
    mutationFn: (p: GeoPoint) => wardApi.verify(p),
    onSuccess: (r) => setVerified({ inside: r.inside, key: pointKey }),
    onError: (e) => showToast(errorMessage(e), 'error'),
  });
  const pin = useMutation({
    mutationFn: (p: GeoPoint) => wardApi.pin(record.id, p),
    onSuccess: (next) => {
      onSaved(next);
      showToast('Đã lưu tọa độ đề xuất');
    },
    onError: (e) => showToast(errorMessage(e), 'error'),
  });
  const fresh = verified && verified.key === pointKey ? verified : null;
  const canSave = record.status === 'PENDING';
  const markers = useMemo(() => (point ? [{ id: 'p', latitude: point.latitude, longitude: point.longitude, label: 'Vị trí đề xuất', fill: colors.cta, ink: colors.white, selected: true }] : []), [point]);
  return (
    <Card padded={false}>
      <LeafletMap center={point ? [point.latitude, point.longitude] : DEFAULT_CENTER} zoom={17} markers={markers} onMapPress={canSave ? (latitude, longitude) => setPoint({ latitude, longitude }) : undefined} style={{ height: 220 }} />
      <View style={{ padding: 16, gap: 12 }}>
        <Text style={[text.headline, { color: colors.ink }]}>Vị trí đề xuất</Text>
        <Text style={[text.caption, { color: colors.muted }, tabular]}>{point ? `${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}` : 'Chưa có tọa độ'}{canSave ? ', chạm bản đồ để chỉnh' : ''}</Text>
        {canSave ? (
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}>
              <TextField label="Tìm theo địa chỉ" value={address} onChangeText={setAddress} placeholder="Số nhà, đường" returnKeyType="search" onSubmitEditing={() => address.trim() && search.mutate(address.trim())} />
            </View>
            <Button label="Tìm" variant="secondary" loading={search.isPending} disabled={!address.trim()} onPress={() => search.mutate(address.trim())} style={{ paddingHorizontal: 18 }} />
          </View>
        ) : null}
        {search.data?.map((r) => (
          <Pressable key={`${r.point.latitude},${r.point.longitude}`} onPress={() => setPoint(r.point)} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.control, borderCurve: 'continuous', backgroundColor: pressed ? colors.brandTint : colors.sunken })}>
            <Icon sf="mappin.circle.fill" md="location_on" size={18} color={colors.primary} />
            <Text style={[text.footnote, { flex: 1, color: colors.ink }]}>{r.label}</Text>
          </Pressable>
        ))}
        {fresh ? (
          <StatusHeader tone={fresh.inside ? 'ok' : 'danger'} icon={{ sf: fresh.inside ? 'checkmark.circle.fill' : 'xmark.circle.fill', md: fresh.inside ? 'check_circle' : 'cancel' }} title={fresh.inside ? 'Điểm này nằm trong ranh giới phường.' : 'Điểm này nằm ngoài ranh giới phường.'} />
        ) : null}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button label="Kiểm tra ranh giới" variant="secondary" icon={{ sf: 'map', md: 'map' }} loading={verify.isPending} disabled={!point} onPress={() => point && verify.mutate(point)} style={{ flex: 1 }} />
          {canSave ? <Button label="Lưu tọa độ" variant="sign" loading={pin.isPending} disabled={!fresh?.inside || pin.isPending} onPress={() => point && pin.mutate(point)} style={{ flex: 1 }} /> : null}
        </View>
      </View>
    </Card>
  );
}

