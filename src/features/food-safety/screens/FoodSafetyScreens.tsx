import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { Card, SectionHeader } from '@/components/common/Blocks';
import { Button } from '@/components/common/Button';
import { Chip } from '@/components/common/Chip';
import { Icon } from '@/components/common/Icon';
import { ProtectedFileTile } from '@/components/common/ProtectedFile';
import { Banner } from '@/components/feedback/Banner';
import { ErrorState, ListSkeleton } from '@/components/feedback/States';
import { StateView } from '@/components/feedback/StateView';
import { showToast } from '@/components/feedback/Toast';
import { useFilePicker } from '@/components/forms/FileSourceSheet';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { StatusPill } from '@/components/status/StatusPill';
import { errorMessage, vendorRegistrationApi } from '@/core/api';
import { apiAssetUrl } from '@/core/api/asset-url';
import { FOOD_SAFETY_EVIDENCE_LABELS, foodSafetyApi, type FoodSafetyApplication, type FoodSafetyEvidenceType } from '@/core/api/food-safety-api';
import { sellerStoreApi } from '@/core/api/seller-store-api';
import type { PickedFile } from '@/core/api/upload';
import { statusLabel } from '@/core/constants/status-labels';
import { colors, fonts, radius, tabular, text } from '@/theme';
import { formatVietnamDate } from '@/utils/format';
import { formatDay } from '../format';
import { daysLeft, groupApplications, RECOMMENDED_EVIDENCE, stepStates, validitySpan, waitingText, type StepState } from '../view';

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_EVIDENCE = 10;
const ROUTE_STEPS = ['Gửi phường', 'Chuyển cục ATTP', 'Có kết quả'] as const;

/** V32 Giấy ATTP (FOOD-01): files by what they need — to complete, under review, valid, ended. */
export function FoodSafetyListScreen() {
  const { storefrontId } = useLocalSearchParams<{ storefrontId?: string }>();
  const cache = useQueryClient();
  const list = useQuery({ queryKey: ['food-safety', 'mine'], queryFn: foodSafetyApi.mine });
  const withdraw = useMutation({
    mutationFn: (id: number) => foodSafetyApi.withdraw(id),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ['food-safety'] });
      await cache.invalidateQueries({ queryKey: ['commerce'] });
      showToast('Đã rút hồ sơ ATTP');
    },
    onError: (err) => showToast(errorMessage(err), 'error'),
  });
  const newHref = `/vendor/home/store/food-safety/new${storefrontId ? `?storefrontId=${storefrontId}` : ''}`;
  const data = (list.data ?? []).filter((a) => !storefrontId || a.storefrontId === Number(storefrontId));
  const groups = groupApplications(data);
  const card = (a: FoodSafetyApplication) => (
    <AttpCard
      key={a.applicationId}
      application={a}
      onResubmit={() => router.push(`/vendor/home/store/food-safety/${a.applicationId}/edit` as Href)}
      onWithdraw={() =>
        Alert.alert('Rút hồ sơ ATTP?', 'Phường sẽ dừng xét hồ sơ này. Món trong hồ sơ trở lại cần giấy.', [
          { text: 'Giữ hồ sơ', style: 'cancel' },
          { text: 'Rút hồ sơ', style: 'destructive', onPress: () => withdraw.mutate(a.applicationId) },
        ])
      }
    />
  );

  return (
    <Screen
      onRefresh={() => void list.refetch()}
      refreshing={list.isRefetching}
      footer={<Button label="Nộp hồ sơ ATTP" size={56} icon={{ sf: 'plus', md: 'add' }} onPress={() => router.push(newHref as Href)} />}
    >
      <Stack.Screen options={{ title: 'Giấy ATTP' }} />
      <View style={{ padding: 16, gap: 8, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.leafTint }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon sf="checkmark.shield.fill" md="verified_user" size={18} color={colors.onLeaf} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.onLeaf }}>An toàn thực phẩm cho món của bạn</Text>
        </View>
        <Text style={[text.footnote, { color: colors.onLeaf }]}>
          Bạn nộp giấy tờ, Phường kiểm tra và chuyển Chi cục ATTP, rồi ghi kết quả. Món cần giấy chỉ hiện với khách khi được duyệt.
        </Text>
      </View>
      {list.isPending ? (
        <ListSkeleton rows={3} height={140} />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : data.length === 0 ? (
        <StateView icon={{ sf: 'doc.badge.plus', md: 'note_add' }} title="Chưa có hồ sơ ATTP" body="Nộp giấy chứng nhận, khám sức khoẻ, tập huấn và ảnh nơi chế biến cho các món cần giấy." />
      ) : (
        <>
          {groups.todo.length ? <SectionHeader title="Cần bạn bổ sung" /> : null}
          {groups.todo.map(card)}
          {groups.reviewing.length ? <SectionHeader title="Đang xét" /> : null}
          {groups.reviewing.map(card)}
          {groups.valid.length ? <SectionHeader title="Giấy còn hiệu lực" /> : null}
          {groups.valid.map(card)}
          {groups.closed.length ? <SectionHeader title="Đã kết thúc" /> : null}
          {groups.closed.map(card)}
        </>
      )}
    </Screen>
  );
}

function RouteSteps({ states }: { states: StepState[] }) {
  return (
    <View style={{ flexDirection: 'row' }}>
      {states.map((s, i) => {
        const bg = s === 'done' ? colors.leaf : s === 'current' ? colors.cta : s === 'failed' ? colors.danger : colors.sunken;
        return (
          <View key={ROUTE_STEPS[i]} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            <View style={{ height: 24, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' }}>
              {i > 0 ? <View style={{ position: 'absolute', left: 0, right: '50%', height: 3, backgroundColor: s === 'todo' ? colors.line : colors.leaf }} /> : null}
              {i < states.length - 1 ? <View style={{ position: 'absolute', left: '50%', right: 0, height: 3, backgroundColor: states[i + 1] === 'todo' ? colors.line : colors.leaf }} /> : null}
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: bg, borderWidth: 3, borderColor: colors.card, alignItems: 'center', justifyContent: 'center' }}>
                {s === 'done' ? <Icon sf="checkmark" md="check" size={10} color={colors.white} weight="bold" /> : s === 'failed' ? <Icon sf="xmark" md="close" size={10} color={colors.white} weight="bold" /> : null}
              </View>
            </View>
            <Text style={[text.caption, { color: s === 'todo' ? colors.muted : colors.ink, textAlign: 'center' }]}>{ROUTE_STEPS[i]}</Text>
          </View>
        );
      })}
    </View>
  );
}

function AttpCard({ application: a, onResubmit, onWithdraw }: { application: FoodSafetyApplication; onResubmit: () => void; onWithdraw: () => void }) {
  const s = a.isExpired ? { label: 'Đã hết hạn', tone: 'danger' as const } : statusLabel(a.status);
  const waiting = waitingText(a);
  const left = a.status === 'APPROVED' ? daysLeft(a.expiresOn) : null;
  const span = validitySpan(a.issuedOn, a.expiresOn);
  const todo = a.actions.includes('RESUBMIT');
  return (
    <Card style={{ gap: 12, borderWidth: todo ? 2 : 0, borderColor: colors.mango }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[text.caption, { color: colors.muted }, tabular]}>Hồ sơ #{a.applicationId} · {a.storefrontName}</Text>
          <Text style={[text.subhead, { color: colors.ink }]} numberOfLines={2}>{a.dishes.map((d) => d.name).join(', ')}</Text>
        </View>
        <StatusPill label={s.label} tone={s.tone} />
      </View>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {a.dishes.slice(0, 5).map((d) => (
          <View key={d.menuItemId} style={{ width: 44, height: 44, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.sunken, alignItems: 'center', justifyContent: 'center' }}>
            {d.imageUrl ? <Image source={{ uri: apiAssetUrl(d.imageUrl) }} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : <Icon sf="fork.knife" md="restaurant" size={16} color={colors.muted} />}
          </View>
        ))}
      </View>
      <RouteSteps states={stepStates(a)} />
      {waiting ? <Text style={[text.caption, { color: colors.ink }]}>{waiting}</Text> : null}
      {a.reviewReason && (todo || a.status === 'REJECTED') ? (
        <Banner tone={todo ? 'warning' : 'danger'} title={todo ? 'Phường yêu cầu' : 'Lý do'}>{a.reviewReason}</Banner>
      ) : null}
      {a.resultReason && a.status === 'REJECTED' ? <Banner tone="danger" title="Kết quả của Chi cục">{a.resultReason}</Banner> : null}
      {a.status === 'APPROVED' ? (
        <View style={{ padding: 12, gap: 2, borderRadius: 14, backgroundColor: a.isExpired ? colors.dangerTint : colors.leafTint }}>
          <Text style={[text.footnote, { color: a.isExpired ? colors.onDanger : colors.onLeaf, fontFamily: fonts.semibold }]}>
            {a.certificateNumber ? `Giấy số ${a.certificateNumber}` : 'Đạt ATTP'}
            {a.departmentName ? ` · ${a.departmentName}` : ''}
          </Text>
          <Text style={[text.caption, { color: a.isExpired ? colors.onDanger : colors.onLeaf }]}>
            {a.expiresOn ? `Hiệu lực đến ${formatDay(a.expiresOn)}` : ''}
            {span ? ` (${span})` : ''}
            {left != null && !a.isExpired ? ` · còn ${left} ngày` : ''}
          </Text>
        </View>
      ) : null}
      <Text style={[text.caption, { color: colors.muted }]}>Nộp {formatVietnamDate(a.submittedAt)}</Text>
      {todo || a.actions.includes('WITHDRAW') ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {a.actions.includes('WITHDRAW') ? <Button label="Rút hồ sơ" variant="secondary" onPress={onWithdraw} style={{ flex: 1 }} /> : null}
          {todo ? <Button label="Bổ sung hồ sơ" icon={{ sf: 'square.and.pencil', md: 'edit_document' }} onPress={onResubmit} style={{ flex: 1.4 }} /> : null}
        </View>
      ) : null}
    </Card>
  );
}

type Attachment = { evidenceType: FoodSafetyEvidenceType; fileUrl: string; preview: string | null };

/** V33 Nộp / bổ sung hồ sơ ATTP: pick the dishes, attach the documents, a note, send to the ward. */
export function FoodSafetyApplyScreen() {
  const { id, storefrontId: storeParam } = useLocalSearchParams<{ id?: string; storefrontId?: string }>();
  const applicationId = id ? Number(id) : null;
  const cache = useQueryClient();
  const picker = useFilePicker();
  const existing = useQuery({ queryKey: ['food-safety', 'mine', applicationId], queryFn: () => foodSafetyApi.get(applicationId!), enabled: applicationId !== null });
  const stores = useQuery({ queryKey: ['commerce', 'stores'], queryFn: sellerStoreApi.stores });
  const [storeChoice, setStoreChoice] = useState<number | null>(null);
  const storeId = existing.data?.storefrontId ?? storeChoice ?? (Number(storeParam) || stores.data?.[0]?.storefrontId);
  const menu = useQuery({ queryKey: ['commerce', 'seller-menu', storeId], queryFn: () => sellerStoreApi.menu(storeId!), enabled: Boolean(storeId) });

  // Resubmitting starts from what the file already holds (seeded once, during render).
  const [seededFor, setSeededFor] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [note, setNote] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  if (existing.data && seededFor !== existing.data.applicationId) {
    setSeededFor(existing.data.applicationId);
    setSelected(new Set(existing.data.dishes.map((d) => d.menuItemId)));
    setNote(existing.data.vendorNote ?? '');
    setAttachments(existing.data.evidence.map((e) => ({ evidenceType: e.evidenceType, fileUrl: e.fileUrl, preview: null })));
  }
  const [evidenceType, setEvidenceType] = useState<FoodSafetyEvidenceType>('CERTIFICATE');
  const [fileError, setFileError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const upload = useMutation({
    mutationFn: (file: PickedFile) => vendorRegistrationApi.uploadEvidenceFile(file),
    onSuccess: (result, file) => setAttachments((prev) => [...prev, { evidenceType, fileUrl: result.fileUrl, preview: file.type.startsWith('image/') ? file.uri : null }]),
    onError: (error) => setFileError(errorMessage(error)),
  });
  const submit = useMutation({
    mutationFn: () => {
      const input = {
        storefrontId: storeId!,
        menuItemIds: [...selected],
        note: note.trim() || null,
        evidence: attachments.map(({ evidenceType: t, fileUrl }) => ({ evidenceType: t, fileUrl })),
      };
      return applicationId === null ? foodSafetyApi.submit(input) : foodSafetyApi.resubmit(applicationId, input);
    },
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ['food-safety'] });
      await cache.invalidateQueries({ queryKey: ['commerce'] });
      showToast('Đã gửi hồ sơ ATTP cho phường');
      router.back();
    },
    onError: (err) => setFormError(errorMessage(err)),
  });

  const title = applicationId === null ? 'Nộp hồ sơ ATTP' : `Bổ sung hồ sơ #${applicationId}`;
  if (stores.isPending || (applicationId !== null && existing.isPending)) {
    return (
      <Screen>
        <Stack.Screen options={{ title }} />
        <ListSkeleton rows={4} height={70} />
      </Screen>
    );
  }
  const failed = stores.error ?? existing.error ?? menu.error;
  if (failed) {
    return (
      <Screen>
        <Stack.Screen options={{ title }} />
        <ErrorState error={failed} onRetry={() => void Promise.all([stores.refetch(), existing.refetch(), menu.refetch()])} />
      </Screen>
    );
  }
  if (!storeId) {
    return (
      <Screen>
        <Stack.Screen options={{ title }} />
        <StateView icon={{ sf: 'storefront', md: 'storefront' }} title="Cần tạo gian hàng trước" body="Hồ sơ ATTP gắn với món của một gian hàng." />
      </Screen>
    );
  }
  const own = new Set(existing.data?.dishes.map((d) => d.menuItemId) ?? []);
  const dishes = [...(menu.data?.items ?? [])].sort((a, b) => Number(b.foodSafetyStatus === 'MISSING') - Number(a.foodSafetyStatus === 'MISSING'));
  const toggle = (dishId: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(dishId)) next.delete(dishId);
      else next.add(dishId);
      return next;
    });
  const addFile = async () => {
    setFileError(null);
    if (attachments.length >= MAX_EVIDENCE) return setFileError(`Tối đa ${MAX_EVIDENCE} giấy tờ.`);
    const file = await picker.pick(FOOD_SAFETY_EVIDENCE_LABELS[evidenceType], true);
    if (!file) return;
    if (file.size != null && file.size > MAX_FILE_BYTES) return setFileError('File lớn hơn 5 MB. Chọn file nhỏ hơn.');
    upload.mutate(file);
  };
  const send = () => {
    setFormError(null);
    if (selected.size === 0) return setFormError('Chọn ít nhất một món.');
    if (attachments.length === 0) return setFormError('Đính kèm ít nhất một giấy tờ.');
    submit.mutate();
  };
  const haveTypes = new Set(attachments.map((a) => a.evidenceType));

  return (
    <View style={{ flex: 1 }}>
      <Screen footer={<Button label="Gửi phường" size={56} icon={{ sf: 'paperplane.fill', md: 'send' }} loading={submit.isPending} disabled={upload.isPending} onPress={send} />}>
        <Stack.Screen options={{ title }} />
        {existing.data?.reviewReason ? <Banner tone="warning" title="Phường yêu cầu">{existing.data.reviewReason}</Banner> : null}
        {applicationId === null && (stores.data?.length ?? 0) > 1 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {stores.data!.map((s) => (
              <Chip
                key={s.storefrontId}
                label={s.name}
                selected={s.storefrontId === storeId}
                onPress={() => {
                  setStoreChoice(s.storefrontId);
                  setSelected(new Set());
                }}
                accessibilityRole="radio"
              />
            ))}
          </View>
        ) : null}

        <SectionHeader title="1. Chọn món xin cấp giấy" note="Món 'Cần giấy ATTP' chưa bán được cho tới khi hồ sơ được duyệt." />
        {menu.isPending ? (
          <ListSkeleton rows={2} height={64} />
        ) : dishes.length === 0 ? (
          <Text style={[text.footnote, { color: colors.muted }]}>Gian hàng chưa có món. Thêm món ở Thực đơn trước.</Text>
        ) : (
          <View style={{ gap: 8 }}>
            {dishes.map((d) => {
              const claimed = !own.has(d.menuItemId) && (d.foodSafetyStatus === 'PENDING' || d.foodSafetyStatus === 'APPROVED');
              const on = selected.has(d.menuItemId);
              return (
                <Pressable
                  key={d.menuItemId}
                  disabled={claimed}
                  onPress={() => toggle(d.menuItemId)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on, disabled: claimed }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 16, borderCurve: 'continuous', backgroundColor: on ? colors.brandTint : colors.card, borderWidth: on ? 2 : 1, borderColor: on ? colors.cta : colors.line, opacity: claimed ? 0.5 : 1 }}
                >
                  <View style={{ width: 48, height: 48, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.sunken, alignItems: 'center', justifyContent: 'center' }}>
                    {d.imageUrl ? <Image source={{ uri: apiAssetUrl(d.imageUrl) }} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : <Icon sf="fork.knife" md="restaurant" size={18} color={colors.muted} />}
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={[text.subhead, { color: colors.ink }]} numberOfLines={1}>{d.name}</Text>
                    <Text style={[text.caption, { color: d.foodSafetyStatus === 'MISSING' ? colors.onDanger : colors.muted }]}>
                      {claimed ? (d.foodSafetyStatus === 'APPROVED' ? 'Đã có giấy còn hạn' : 'Đang trong hồ sơ khác') : d.foodSafetyStatus === 'MISSING' ? 'Cần giấy ATTP' : d.categoryName}
                    </Text>
                  </View>
                  <View style={{ width: 24, height: 24, borderRadius: 7, backgroundColor: on ? colors.cta : colors.card, borderWidth: on ? 0 : 1.5, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }}>
                    {on ? <Icon sf="checkmark" md="check" size={14} color={colors.white} weight="bold" /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        <SectionHeader title="2. Giấy tờ đính kèm" note="Ảnh rõ nét hoặc file PDF, tối đa 5 MB mỗi file." />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {(Object.keys(FOOD_SAFETY_EVIDENCE_LABELS) as FoodSafetyEvidenceType[]).map((t) => (
            <Chip
              key={t}
              label={FOOD_SAFETY_EVIDENCE_LABELS[t]}
              selected={evidenceType === t}
              onPress={() => setEvidenceType(t)}
              accessibilityRole="radio"
              leading={haveTypes.has(t) ? <Icon sf="checkmark.circle.fill" md="check_circle" size={14} color={evidenceType === t ? colors.white : colors.leaf} /> : undefined}
            />
          ))}
        </View>
        <Button label={upload.isPending ? 'Đang tải lên…' : `Thêm: ${FOOD_SAFETY_EVIDENCE_LABELS[evidenceType]}`} variant="secondary" icon={{ sf: 'paperclip', md: 'attach_file' }} loading={upload.isPending} onPress={() => void addFile()} />
        {fileError ? <Text style={[text.footnote, { color: colors.onDanger }]}>{fileError}</Text> : null}
        {RECOMMENDED_EVIDENCE.some((t) => !haveTypes.has(t)) ? (
          <Text style={[text.caption, { color: colors.muted }]}>
            Phường thường cần: {RECOMMENDED_EVIDENCE.filter((t) => !haveTypes.has(t)).map((t) => FOOD_SAFETY_EVIDENCE_LABELS[t]).join(', ')}.
          </Text>
        ) : null}
        {attachments.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {attachments.map((a, i) => (
              <View key={`${a.fileUrl}-${i}`} style={{ width: '47.5%', flexGrow: 1 }}>
                {a.preview ? (
                  <View style={{ gap: 6 }}>
                    <Image source={{ uri: a.preview }} style={{ height: 116, borderRadius: radius.photo }} contentFit="cover" />
                    <Text style={[text.footnote, { color: colors.ink, fontFamily: fonts.semibold }]} numberOfLines={1}>{FOOD_SAFETY_EVIDENCE_LABELS[a.evidenceType]}</Text>
                  </View>
                ) : (
                  <ProtectedFileTile fileUrl={a.fileUrl} label={FOOD_SAFETY_EVIDENCE_LABELS[a.evidenceType]} />
                )}
                <Pressable
                  onPress={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                  accessibilityRole="button"
                  accessibilityLabel={`Bỏ ${FOOD_SAFETY_EVIDENCE_LABELS[a.evidenceType]}`}
                  hitSlop={8}
                  style={{ position: 'absolute', top: 6, right: 6, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(17,28,43,0.7)', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Icon sf="xmark" md="close" size={13} color={colors.white} weight="bold" />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        <SectionHeader title="3. Ghi chú cho Phường" />
        <TextField label="Ghi chú" optional value={note} onChangeText={setNote} multiline placeholder="VD: Giấy khám sức khoẻ của cả hai người phụ bếp" maxLength={1000} />
        {formError ? <Banner tone="danger">{formError}</Banner> : null}
      </Screen>
      {picker.sheet}
    </View>
  );
}
