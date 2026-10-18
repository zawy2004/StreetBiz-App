import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Card, KeyValueList } from '@/components/common/Blocks';
import { Button } from '@/components/common/Button';
import { Chip } from '@/components/common/Chip';
import { ProtectedFileTile } from '@/components/common/ProtectedFile';
import { Banner } from '@/components/feedback/Banner';
import { ErrorState, ListSkeleton } from '@/components/feedback/States';
import { StateView } from '@/components/feedback/StateView';
import { showToast } from '@/components/feedback/Toast';
import { DateField } from '@/components/forms/DateField';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { StatusPill } from '@/components/status/StatusPill';
import { errorMessage } from '@/core/api';
import { apiAssetUrl } from '@/core/api/asset-url';
import { FOOD_SAFETY_EVIDENCE_LABELS, foodSafetyApi, type FoodSafetyDecision, type FoodSafetyStatus } from '@/core/api/food-safety-api';
import { statusLabel } from '@/core/constants/status-labels';
import { colors, fonts, radius, text } from '@/theme';
import { formatVietnamDate } from '@/utils/format';
import { formatDay } from '../format';
import { waitingText } from '../view';

const DEFAULT_DEPARTMENT = 'Chi cục An toàn vệ sinh thực phẩm';
const FILTERS: { key: FoodSafetyStatus | 'ALL'; label: string }[] = [
  { key: 'SUBMITTED', label: 'Chờ phường xét' },
  { key: 'FORWARDED', label: 'Đã chuyển cục' },
  { key: 'MORE_INFORMATION_REQUIRED', label: 'Chờ bổ sung' },
  { key: 'APPROVED', label: 'Đạt' },
  { key: 'ALL', label: 'Tất cả' },
];

/** W08 Hồ sơ ATTP: the ward's queue of food-safety files, by where each one stands. */
export function WardFoodSafetyListScreen() {
  const [filter, setFilter] = useState<FoodSafetyStatus | 'ALL'>('SUBMITTED');
  const list = useQuery({ queryKey: ['food-safety', 'ward', filter], queryFn: () => foodSafetyApi.wardList(filter === 'ALL' ? undefined : filter) });
  return (
    <Screen onRefresh={() => void list.refetch()} refreshing={list.isRefetching} gap={12}>
      <Stack.Screen options={{ title: 'Hồ sơ ATTP' }} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }} style={{ marginHorizontal: -16 }}>
        {FILTERS.map((f) => (
          <Chip key={f.key} label={f.label} selected={filter === f.key} onPress={() => setFilter(f.key)} accessibilityRole="radio" />
        ))}
      </ScrollView>
      {list.isPending ? (
        <ListSkeleton rows={4} height={100} />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : list.data.length === 0 ? (
        <StateView icon={{ sf: 'checkmark.shield', md: 'verified_user' }} tone="neutral" title="Không có hồ sơ" body="Hồ sơ ATTP người bán gửi sẽ hiện ở đây." />
      ) : (
        list.data.map((a) => {
          const s = a.isExpired ? { label: 'Đã hết hạn', tone: 'danger' as const } : statusLabel(a.status);
          return (
            <Pressable key={a.applicationId} onPress={() => router.push(`/ward/inbox/food-safety/${a.applicationId}` as Href)} accessibilityRole="button" style={({ pressed }) => ({ padding: 14, gap: 8, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: pressed ? '#FBFBFC' : colors.card, borderWidth: a.actions.length ? 1.5 : 0, borderColor: colors.mango })}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[text.subhead, { color: colors.ink }]}>{a.storefrontName}</Text>
                  <Text style={[text.caption, { color: colors.muted }]}>{a.vendorName} · hồ sơ #{a.applicationId}</Text>
                </View>
                <StatusPill label={s.label} tone={s.tone} />
              </View>
              <Text style={[text.footnote, { color: colors.ink }]} numberOfLines={2}>{a.dishes.map((d) => d.name).join(', ')}</Text>
              <Text style={[text.caption, { color: colors.muted }]}>{waitingText(a) ?? `Nộp ${formatVietnamDate(a.submittedAt)}`}</Text>
            </Pressable>
          );
        })
      )}
    </Screen>
  );
}

/**
 * W09 Xét hồ sơ ATTP: check the documents, then send back / reject, or forward to the department;
 * once it has inspected, record its result. Each step is the officer's press, with a reason.
 */
export function WardFoodSafetyReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const applicationId = Number(id);
  const cache = useQueryClient();
  const detail = useQuery({ queryKey: ['food-safety', 'ward', 'detail', applicationId], queryFn: () => foodSafetyApi.wardGet(applicationId), enabled: Number.isFinite(applicationId) });
  const [reason, setReason] = useState('');
  const [department, setDepartment] = useState(DEFAULT_DEPARTMENT);
  const [certificateNumber, setCertificateNumber] = useState('');
  const [issuedOn, setIssuedOn] = useState('');
  const [expiresOn, setExpiresOn] = useState('');
  const decide = useMutation({
    mutationFn: (decision: FoodSafetyDecision) =>
      foodSafetyApi.decide(applicationId, {
        decision,
        reason: reason.trim(),
        expectedStatus: detail.data!.status,
        departmentName: decision === 'FORWARD' ? department.trim() : null,
        certificateNumber: decision === 'RECORD_APPROVED' ? certificateNumber.trim() : null,
        issuedOn: decision === 'RECORD_APPROVED' ? issuedOn : null,
        expiresOn: decision === 'RECORD_APPROVED' ? expiresOn : null,
      }),
    onSuccess: async (next) => {
      cache.setQueryData(['food-safety', 'ward', 'detail', applicationId], next);
      setReason('');
      await cache.invalidateQueries({ queryKey: ['food-safety', 'ward'] });
      showToast('Đã cập nhật hồ sơ ATTP');
    },
    onError: (e) => showToast(errorMessage(e), 'error'),
  });

  if (detail.isPending) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Xét hồ sơ ATTP' }} />
        <ListSkeleton rows={3} height={110} />
      </Screen>
    );
  }
  if (detail.isError) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Xét hồ sơ ATTP' }} />
        <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />
      </Screen>
    );
  }
  const a = detail.data;
  const can = (d: FoodSafetyDecision) => a.actions.includes(d);
  const s = a.isExpired ? { label: 'Đã hết hạn', tone: 'danger' as const } : statusLabel(a.status);
  const busy = (d: FoodSafetyDecision) => decide.isPending && decide.variables === d;
  const needReason = () => {
    if (!reason.trim()) {
      showToast('Nhập ghi chú / lý do.', 'error');
      return false;
    }
    return true;
  };

  return (
    <Screen onRefresh={() => void detail.refetch()} refreshing={detail.isRefetching}>
      <Stack.Screen options={{ title: `Hồ sơ ATTP #${a.applicationId}` }} />
      <Card style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={[text.title3, { color: colors.ink, fontFamily: fonts.heavy }]}>{a.storefrontName}</Text>
            <Text style={[text.footnote, { color: colors.muted }]}>{a.vendorName} · nộp {formatVietnamDate(a.submittedAt)}</Text>
          </View>
          <StatusPill label={s.label} tone={s.tone} />
        </View>
        {waitingText(a) ? <Text style={[text.caption, { color: colors.onMango }]}>{waitingText(a)}</Text> : null}
        {a.vendorNote ? <Text style={[text.footnote, { color: colors.ink }]}>Người bán ghi: {a.vendorNote}</Text> : null}
      </Card>
      {a.status === 'APPROVED' ? (
        <Banner tone="success" title="Đạt ATTP">Giấy số {a.certificateNumber} · hiệu lực {formatDay(a.issuedOn)} – {formatDay(a.expiresOn)}{a.departmentName ? ` · ${a.departmentName}` : ''}</Banner>
      ) : null}
      {a.status === 'REJECTED' ? <Banner tone="danger" title="Không đạt">{a.resultReason ?? a.reviewReason ?? 'Không nêu lý do.'}</Banner> : null}
      {a.forwardedAt ? <Text style={[text.footnote, { color: colors.sign }]}>Đã chuyển {a.departmentName} ngày {formatDay(a.forwardedAt)}.</Text> : null}

      <Text style={{ fontFamily: fonts.heavy, fontSize: 16, color: colors.ink }}>Món xin cấp giấy ({a.dishes.length})</Text>
      <View style={{ gap: 8 }}>
        {a.dishes.map((d) => (
          <View key={d.menuItemId} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 14, backgroundColor: colors.card }}>
            <View style={{ width: 44, height: 44, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.sunken }}>
              {d.imageUrl ? <Image source={{ uri: apiAssetUrl(d.imageUrl) }} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[text.subhead, { color: colors.ink }]}>{d.name}</Text>
              <Text style={[text.caption, { color: colors.muted }]}>{d.categoryName}</Text>
            </View>
          </View>
        ))}
      </View>
      <Text style={{ fontFamily: fonts.heavy, fontSize: 16, color: colors.ink }}>Giấy tờ ({a.evidence.length})</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {a.evidence.map((e) => (
          <ProtectedFileTile key={e.fileUrl} fileUrl={e.fileUrl} label={FOOD_SAFETY_EVIDENCE_LABELS[e.evidenceType]} />
        ))}
      </View>

      {can('FORWARD') || can('REQUEST_INFO') || can('REJECT') ? (
        <Card style={{ gap: 10 }}>
          <Text style={{ fontFamily: fonts.heavy, fontSize: 16, color: colors.ink }}>Phường xét hồ sơ</Text>
          {can('FORWARD') ? <TextField label="Cơ quan kiểm tra" value={department} onChangeText={setDepartment} /> : null}
          <TextField label="Ghi chú / lý do" value={reason} onChangeText={setReason} multiline placeholder="Bắt buộc" />
          {can('FORWARD') ? <Button label="Chuyển cục kiểm tra" variant="sign" icon={{ sf: 'paperplane.fill', md: 'send' }} loading={busy('FORWARD')} disabled={decide.isPending || !department.trim()} onPress={() => needReason() && decide.mutate('FORWARD')} /> : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {can('REQUEST_INFO') ? <Button label="Yêu cầu bổ sung" variant="secondary" loading={busy('REQUEST_INFO')} disabled={decide.isPending} onPress={() => needReason() && decide.mutate('REQUEST_INFO')} style={{ flex: 1 }} /> : null}
            {can('REJECT') ? <Button label="Từ chối" variant="secondary" loading={busy('REJECT')} disabled={decide.isPending} onPress={() => needReason() && decide.mutate('REJECT')} style={{ flex: 1 }} /> : null}
          </View>
        </Card>
      ) : null}

      {can('RECORD_APPROVED') || can('RECORD_REJECTED') ? (
        <Card style={{ gap: 10 }}>
          <Text style={{ fontFamily: fonts.heavy, fontSize: 16, color: colors.ink }}>Ghi kết quả của Chi cục</Text>
          {can('RECORD_APPROVED') ? (
            <>
              <TextField label="Số giấy chứng nhận" value={certificateNumber} onChangeText={setCertificateNumber} autoCapitalize="characters" />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <DateField label="Ngày cấp" value={issuedOn} onChange={setIssuedOn} />
                </View>
                <View style={{ flex: 1 }}>
                  <DateField label="Ngày hết hạn" value={expiresOn} onChange={setExpiresOn} />
                </View>
              </View>
            </>
          ) : null}
          <TextField label="Kết luận của cục" value={reason} onChangeText={setReason} multiline placeholder="Bắt buộc" />
          {can('RECORD_APPROVED') ? (
            <Button label="Ghi nhận: Đạt ATTP" loading={busy('RECORD_APPROVED')} disabled={decide.isPending || !certificateNumber.trim() || !issuedOn || !expiresOn} onPress={() => needReason() && decide.mutate('RECORD_APPROVED')} />
          ) : null}
          {can('RECORD_REJECTED') ? <Button label="Ghi nhận: Không đạt" variant="secondary" loading={busy('RECORD_REJECTED')} disabled={decide.isPending} onPress={() => needReason() && decide.mutate('RECORD_REJECTED')} /> : null}
        </Card>
      ) : null}
      {a.actions.length === 0 ? <Banner tone="neutral">Hồ sơ đang ở bước khác của quy trình, phường chưa có việc.</Banner> : null}
      <KeyValueList rows={[a.reviewedAt ? { label: 'Phường xét', value: formatVietnamDate(a.reviewedAt) } : null, a.resultRecordedAt ? { label: 'Ghi kết quả', value: formatVietnamDate(a.resultRecordedAt) } : null]} />
    </Screen>
  );
}
