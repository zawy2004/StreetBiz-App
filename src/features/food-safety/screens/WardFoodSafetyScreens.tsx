import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Card, KeyValueList } from '@/components/common/Blocks';
import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { ProtectedFileTile } from '@/components/common/ProtectedFile';
import { Skeleton } from '@/components/feedback/Skeleton';
import { ErrorState, ListSkeleton } from '@/components/feedback/States';
import { StateView } from '@/components/feedback/StateView';
import { showToast } from '@/components/feedback/Toast';
import { DateField } from '@/components/forms/DateField';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { StatusHeader } from '@/components/native/StatusHeader';
import { StatusPill } from '@/components/status/StatusPill';
import { errorMessage } from '@/core/api';
import { apiAssetUrl } from '@/core/api/asset-url';
import { FOOD_SAFETY_EVIDENCE_LABELS, foodSafetyApi, type FoodSafetyApplication, type FoodSafetyDecision, type FoodSafetyStatus } from '@/core/api/food-safety-api';
import { statusLabel } from '@/core/constants/status-labels';
import { colors, fonts, radius, shadow, sign, tabular, text } from '@/theme';
import { Pass, PhotoTile, Section } from '@/ui';
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

/**
 * The five stages as one segmented track that wraps onto a second line instead of scrolling
 * sideways (all five stay visible at any text size). Chosen = solid orange capsule.
 */
function StageFilter({ value, onChange }: { value: FoodSafetyStatus | 'ALL'; onChange: (v: FoodSafetyStatus | 'ALL') => void }) {
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, padding: 4, borderRadius: radius.photo, borderCurve: 'continuous', backgroundColor: colors.sunken }}>
      {FILTERS.map((f) => {
        const on = f.key === value;
        return (
          <Pressable
            key={f.key}
            onPress={() => onChange(f.key)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            style={{ flexGrow: 1, minHeight: 44, paddingHorizontal: 14, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.cta : 'transparent', boxShadow: on ? shadow.glow : undefined }}
          >
            <Text style={{ fontFamily: on ? fonts.heavy : fonts.semibold, fontSize: 14, color: on ? colors.white : colors.muted }}>{f.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Up to three of the file's dishes as overlapping round photos (the vendor's own pictures). */
function DishStack({ dishes }: { dishes: FoodSafetyApplication['dishes'] }) {
  const shown = dishes.slice(0, 3);
  return (
    <View style={{ flexDirection: 'row', width: 44 + Math.max(shown.length - 1, 0) * 22 }}>
      {shown.length === 0 ? (
        <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.leafTint, alignItems: 'center', justifyContent: 'center' }}>
          <Icon sf="checkmark.shield.fill" md="verified_user" size={22} color={colors.onLeaf} />
        </View>
      ) : (
        shown.map((d, i) => (
          <View key={d.menuItemId} style={{ marginLeft: i === 0 ? 0 : -22, width: 52, height: 52, borderRadius: 26, borderWidth: 3, borderColor: colors.white, overflow: 'hidden', backgroundColor: colors.sunken, alignItems: 'center', justifyContent: 'center' }}>
            {d.imageUrl ? <Image source={{ uri: apiAssetUrl(d.imageUrl) }} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : <Icon sf="fork.knife" md="restaurant" size={18} color={colors.muted} />}
          </View>
        ))
      )}
    </View>
  );
}

/** W08 Hồ sơ ATTP: the ward's queue of food-safety files, by where each one stands. */
export function WardFoodSafetyListScreen() {
  const [filter, setFilter] = useState<FoodSafetyStatus | 'ALL'>('SUBMITTED');
  const list = useQuery({ queryKey: ['food-safety', 'ward', filter], queryFn: () => foodSafetyApi.wardList(filter === 'ALL' ? undefined : filter) });
  return (
    <Screen onRefresh={() => void list.refetch()} refreshing={list.isRefetching} gap={16}>
      <Stack.Screen options={{ title: 'Hồ sơ ATTP' }} />
      <StageFilter value={filter} onChange={setFilter} />
      {list.isPending ? (
        <ListSkeleton rows={4} height={120} />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : list.data.length === 0 ? (
        <StateView
          icon={{ sf: 'checkmark.shield', md: 'verified_user' }}
          tone="neutral"
          title="Không có hồ sơ"
          body="Hồ sơ ATTP người bán gửi sẽ hiện ở đây."
          action={filter === 'ALL' ? { label: 'Tải lại', onPress: () => void list.refetch() } : { label: 'Xem tất cả hồ sơ', onPress: () => setFilter('ALL') }}
        />
      ) : (
        <View style={{ borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.card, boxShadow: shadow.card }}>
          {list.data.map((a, n) => {
            const s = a.isExpired ? { label: 'Đã hết hạn', tone: 'danger' as const } : statusLabel(a.status);
            const awaiting = a.actions.length > 0;
            return (
              <Pressable
                key={a.applicationId}
                onPress={() => router.push(`/ward/inbox/food-safety/${a.applicationId}` as Href)}
                accessibilityRole="button"
                accessibilityLabel={`${a.storefrontName}, ${a.vendorName}, hồ sơ ${a.applicationId}, ${s.label}`}
                style={({ pressed }) => ({ flexDirection: 'row', gap: 14, paddingVertical: 14, paddingLeft: 14, paddingRight: 14, backgroundColor: pressed ? colors.pressed : colors.card, borderTopWidth: n === 0 ? 0 : 1, borderTopColor: colors.separator, borderLeftWidth: 5, borderLeftColor: awaiting ? colors.mango : colors.card })}
              >
                <DishStack dishes={a.dishes} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 15.5, lineHeight: 21, color: colors.ink }} numberOfLines={2}>{a.storefrontName}</Text>
                  <Text style={[text.footnote, { color: colors.muted }]}>
                    {a.vendorName}, hồ sơ #{a.applicationId}
                  </Text>
                  <Text style={[text.footnote, { color: colors.ink }]} numberOfLines={2}>{a.dishes.map((d) => d.name).join(', ')}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 2 }}>
                    <StatusPill label={s.label} tone={s.tone} />
                    <Text style={[text.caption, tabular, { color: colors.muted }]}>{waitingText(a) ?? `Nộp ${formatVietnamDate(a.submittedAt)}`}</Text>
                  </View>
                </View>
                <Icon sf="chevron.right" md="chevron_right" size={13} color={colors.muted} style={{ marginTop: 18 }} />
              </Pressable>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

/**
 * Where a file stands on its way: the ward checks it, the department inspects it, a result is
 * recorded. Read from the status the server sent; it changes nothing.
 */
function StageRail({ a }: { a: FoodSafetyApplication }) {
  const at = a.status === 'FORWARDED' ? 1 : a.status === 'APPROVED' || a.status === 'REJECTED' ? 2 : 0;
  const closedTone = a.isExpired || a.status === 'REJECTED' ? colors.danger : colors.leaf;
  const stops = [
    { label: 'Phường xét', icon: { sf: 'building.columns.fill', md: 'account_balance' } },
    { label: 'Chi cục kiểm tra', icon: { sf: 'magnifyingglass', md: 'search' } },
    { label: 'Kết quả', icon: { sf: a.status === 'REJECTED' ? 'xmark' : 'checkmark', md: a.status === 'REJECTED' ? 'close' : 'check' } },
  ];
  const withdrawn = a.status === 'WITHDRAWN';
  return (
    <View accessible accessibilityLabel={`Tiến trình: ${stops[at]!.label}`} style={{ flexDirection: 'row', paddingVertical: 16, paddingHorizontal: 8, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadow.card }}>
      {stops.map((stop, i) => {
        const done = !withdrawn && i < at;
        const here = !withdrawn && i === at;
        const ink = here ? (i === 2 ? closedTone : a.status === 'MORE_INFORMATION_REQUIRED' ? colors.onMango : colors.sign) : done ? colors.leaf : colors.line;
        return (
          <View key={stop.label} style={{ flex: 1, alignItems: 'center', gap: 8 }}>
            <View style={{ alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1, height: 3, backgroundColor: i === 0 ? 'transparent' : done || here ? colors.leaf : colors.line }} />
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: here || done ? ink : colors.sunken, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.white }}>
                <Icon sf={done ? 'checkmark' : stop.icon.sf} md={done ? 'check' : stop.icon.md} size={17} color={here || done ? colors.white : colors.muted} />
              </View>
              <View style={{ flex: 1, height: 3, backgroundColor: i === 2 ? 'transparent' : done ? colors.leaf : colors.line }} />
            </View>
            <Text style={{ fontFamily: here ? fonts.heavy : fonts.semibold, fontSize: 13, lineHeight: 17, textAlign: 'center', color: here ? colors.ink : colors.muted }}>{stop.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

/** A decision card wearing the ward's civic blue band: this is the officer's act. */
function WardDesk({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadow.raised }}>
      <View style={{ borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden' }}>
        <View style={{ height: 8, backgroundColor: colors.sign }} />
        <View style={{ padding: 18, gap: 12 }}>
          <Text accessibilityRole="header" style={{ fontFamily: fonts.heavy, fontSize: 19, lineHeight: 25, color: colors.ink }}>{title}</Text>
          {children}
        </View>
      </View>
    </View>
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
      <Screen gap={20}>
        <Stack.Screen options={{ title: 'Xét hồ sơ ATTP' }} />
        <View style={{ gap: 8 }}>
          <Skeleton width="65%" height={30} />
          <Skeleton width="45%" height={16} />
        </View>
        <Skeleton height={100} radius={radius.card} />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Skeleton height={150} radius={radius.photo} style={{ flex: 1 }} />
          <Skeleton height={150} radius={radius.photo} style={{ flex: 1 }} />
        </View>
        <Skeleton height={220} radius={radius.card} />
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
  const dates = [a.reviewedAt ? { label: 'Phường xét', value: formatVietnamDate(a.reviewedAt) } : null, a.resultRecordedAt ? { label: 'Ghi kết quả', value: formatVietnamDate(a.resultRecordedAt) } : null];

  return (
    <Screen onRefresh={() => void detail.refetch()} refreshing={detail.isRefetching} gap={22}>
      <Stack.Screen options={{ title: `Hồ sơ ATTP #${a.applicationId}` }} />
      <View style={{ gap: 6 }}>
        <Text selectable style={[text.title1, { color: colors.ink }]}>{a.storefrontName}</Text>
        <Text style={[text.callout, { color: colors.muted }]}>{a.vendorName}</Text>
        <Text style={[text.footnote, tabular, { color: colors.muted }]}>Nộp {formatVietnamDate(a.submittedAt)}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <StatusPill label={s.label} tone={s.tone} />
          {waitingText(a) ? <Text style={[text.caption, { color: colors.onMango }]}>{waitingText(a)}</Text> : null}
        </View>
      </View>

      <StageRail a={a} />

      {a.status === 'APPROVED' ? (
        <Pass
          accent={a.isExpired ? colors.danger : colors.leaf}
          head={
            <View style={{ gap: 6 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.muted }}>Đạt ATTP, giấy chứng nhận số</Text>
              <Text selectable maxFontSizeMultiplier={1.3} adjustsFontSizeToFit numberOfLines={1} style={[sign.title, tabular, { color: colors.ink }]}>{a.certificateNumber}</Text>
              {a.departmentName ? <Text style={[text.subhead, { color: colors.ink }]}>{a.departmentName}</Text> : null}
            </View>
          }
          stub={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Icon sf="calendar" md="event" size={18} color={a.isExpired ? colors.danger : colors.onLeaf} />
              <Text style={[text.subhead, tabular, { flex: 1, color: a.isExpired ? colors.onDanger : colors.onLeaf }]}>
                Hiệu lực {formatDay(a.issuedOn)} – {formatDay(a.expiresOn)}
              </Text>
            </View>
          }
        />
      ) : null}
      {a.status === 'REJECTED' ? <StatusHeader tone="danger" title="Không đạt" detail={a.resultReason ?? a.reviewReason ?? 'Không nêu lý do.'} /> : null}
      {a.forwardedAt ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Icon sf="paperplane.fill" md="send" size={16} color={colors.sign} />
          <Text style={[text.footnote, { flex: 1, color: colors.sign, fontFamily: fonts.semibold }]}>Đã chuyển {a.departmentName} ngày {formatDay(a.forwardedAt)}.</Text>
        </View>
      ) : null}
      {a.vendorNote ? (
        <View style={{ padding: 16, gap: 4, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.kerbPaint, borderLeftWidth: 5, borderLeftColor: colors.brand }}>
          <Text style={[text.caption, { color: colors.primary }]}>Người bán ghi</Text>
          <Text style={[text.callout, { color: colors.ink }]}>{a.vendorNote}</Text>
        </View>
      ) : null}

      {/* The dishes as their own photos */}
      <Section title={`Món xin cấp giấy (${a.dishes.length})`} inset={0}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {a.dishes.map((d) => (
            <View key={d.menuItemId} style={{ width: '47.5%', flexGrow: 1, gap: 6 }}>
              <PhotoTile source={d.imageUrl ? { uri: apiAssetUrl(d.imageUrl) } : null} style={{ aspectRatio: 4 / 3 }} />
              <View style={{ gap: 1 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, lineHeight: 19, color: colors.ink }} numberOfLines={2}>{d.name}</Text>
                <Text style={[text.caption, { color: colors.muted }]}>{d.categoryName}</Text>
              </View>
            </View>
          ))}
        </View>
      </Section>

      <Section title={`Giấy tờ (${a.evidence.length})`} inset={0}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {a.evidence.map((e) => (
            <ProtectedFileTile key={e.fileUrl} fileUrl={e.fileUrl} label={FOOD_SAFETY_EVIDENCE_LABELS[e.evidenceType]} />
          ))}
        </View>
      </Section>

      {can('FORWARD') || can('REQUEST_INFO') || can('REJECT') ? (
        <WardDesk title="Phường xét hồ sơ">
          {can('FORWARD') ? <TextField label="Cơ quan kiểm tra" value={department} onChangeText={setDepartment} /> : null}
          <TextField label="Ghi chú / lý do" value={reason} onChangeText={setReason} multiline placeholder="Bắt buộc" />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {can('REQUEST_INFO') ? <Button label="Yêu cầu bổ sung" variant="secondary" loading={busy('REQUEST_INFO')} disabled={decide.isPending} onPress={() => needReason() && decide.mutate('REQUEST_INFO')} style={{ flex: 1, paddingHorizontal: 12 }} /> : null}
            {can('REJECT') ? <Button label="Từ chối" variant="secondary" loading={busy('REJECT')} disabled={decide.isPending} onPress={() => needReason() && decide.mutate('REJECT')} style={{ flex: 1, paddingHorizontal: 12 }} /> : null}
          </View>
          {can('FORWARD') ? <Button label="Chuyển cục kiểm tra" variant="sign" size={56} icon={{ sf: 'paperplane.fill', md: 'send' }} loading={busy('FORWARD')} disabled={decide.isPending || !department.trim()} onPress={() => needReason() && decide.mutate('FORWARD')} /> : null}
        </WardDesk>
      ) : null}

      {can('RECORD_APPROVED') || can('RECORD_REJECTED') ? (
        <WardDesk title="Ghi kết quả của Chi cục">
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
          {can('RECORD_REJECTED') ? <Button label="Ghi nhận: Không đạt" variant="secondary" loading={busy('RECORD_REJECTED')} disabled={decide.isPending} onPress={() => needReason() && decide.mutate('RECORD_REJECTED')} /> : null}
          {can('RECORD_APPROVED') ? (
            <Button label="Ghi nhận: Đạt ATTP" variant="sign" size={56} icon={{ sf: 'checkmark.seal.fill', md: 'verified' }} loading={busy('RECORD_APPROVED')} disabled={decide.isPending || !certificateNumber.trim() || !issuedOn || !expiresOn} onPress={() => needReason() && decide.mutate('RECORD_APPROVED')} />
          ) : null}
        </WardDesk>
      ) : null}
      {a.actions.length === 0 ? <StatusHeader tone="neutral" title="Hồ sơ đang ở bước khác của quy trình, phường chưa có việc." /> : null}
      {dates.some(Boolean) ? (
        <Card style={{ padding: 18 }}>
          <KeyValueList rows={dates} />
        </Card>
      ) : null}
    </Screen>
  );
}
