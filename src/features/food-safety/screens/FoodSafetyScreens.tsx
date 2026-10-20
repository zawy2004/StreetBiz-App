import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { SectionHeader } from '@/components/common/Blocks';
import { Button } from '@/components/common/Button';
import { Chip } from '@/components/common/Chip';
import { Icon } from '@/components/common/Icon';
import { KerbStrip } from '@/components/common/KerbStrip';
import { ProtectedFileTile } from '@/components/common/ProtectedFile';
import { Skeleton } from '@/components/feedback/Skeleton';
import { ErrorState, ListSkeleton } from '@/components/feedback/States';
import { StateView } from '@/components/feedback/StateView';
import { showToast } from '@/components/feedback/Toast';
import { useFilePicker } from '@/components/forms/FileSourceSheet';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { StatusHeader } from '@/components/native/StatusHeader';
import { StatusPill } from '@/components/status/StatusPill';
import { errorMessage, vendorRegistrationApi } from '@/core/api';
import { apiAssetUrl } from '@/core/api/asset-url';
import { FOOD_SAFETY_EVIDENCE_LABELS, foodSafetyApi, type FoodSafetyApplication, type FoodSafetyEvidenceType } from '@/core/api/food-safety-api';
import { sellerStoreApi } from '@/core/api/seller-store-api';
import type { PickedFile } from '@/core/api/upload';
import { statusLabel } from '@/core/constants/status-labels';
import { colors, fonts, radius, shadow, sign, tabular, text } from '@/theme';
import { PhotoTile } from '@/ui';
import { formatVietnamDate } from '@/utils/format';
import { formatDay } from '../format';
import { daysLeft, groupApplications, RECOMMENDED_EVIDENCE, stepStates, validitySpan, waitingText, type StepState } from '../view';

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_EVIDENCE = 10;
const ROUTE_STEPS = ['Gửi phường', 'Chuyển cục ATTP', 'Có kết quả'] as const;

/** The road an ATTP file travels, drawn once at the top: you, the ward, the department. */
function RouteMap() {
  const stops: { icon: { sf: string; md: string }; label: string }[] = [
    { icon: { sf: 'doc.text.fill', md: 'description' }, label: 'Bạn nộp' },
    { icon: { sf: 'building.columns.fill', md: 'account_balance' }, label: 'Phường kiểm tra' },
    { icon: { sf: 'checkmark.shield.fill', md: 'verified_user' }, label: 'Chi cục ATTP' },
  ];
  return (
    <View style={{ borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.card, boxShadow: shadow.card }}>
      <View style={{ padding: 18, gap: 14 }}>
        <Text accessibilityRole="header" style={{ fontFamily: fonts.heavy, fontSize: 18, lineHeight: 24, color: colors.ink }}>
          An toàn thực phẩm cho món của bạn
        </Text>
        <View accessible accessibilityLabel="Bạn nộp, phường kiểm tra, Chi cục ATTP ghi kết quả" style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          {stops.map((s, i) => (
            <View key={s.label} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
              <View style={{ width: '100%', flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1, height: 3, borderRadius: radius.full, backgroundColor: i === 0 ? 'transparent' : colors.brandTint }} />
                <View style={{ width: 48, height: 48, borderRadius: radius.full, backgroundColor: i === 2 ? colors.leaf : i === 0 ? colors.cta : colors.brandTint, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.white }}>
                  <Icon sf={s.icon.sf} md={s.icon.md} size={20} color={i === 1 ? colors.primary : colors.white} />
                </View>
                <View style={{ flex: 1, height: 3, borderRadius: radius.full, backgroundColor: i === stops.length - 1 ? 'transparent' : colors.brandTint }} />
              </View>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, lineHeight: 17, color: colors.ink, textAlign: 'center' }}>{s.label}</Text>
            </View>
          ))}
        </View>
        <Text style={[text.footnote, { color: colors.muted }]}>
          Bạn nộp giấy tờ, Phường kiểm tra và chuyển Chi cục ATTP, rồi ghi kết quả. Món cần giấy chỉ hiện với khách khi được duyệt.
        </Text>
      </View>
      <KerbStrip height={6} segment={20} />
    </View>
  );
}

/** V32 Giấy ATTP (FOOD-01), v5: files by what they need — to complete, under review, valid, ended. */
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
  const group = (title: string, items: FoodSafetyApplication[]) =>
    items.length ? (
      <View key={title} style={{ gap: 12 }}>
        <SectionHeader title={title} note={`${items.length} hồ sơ`} />
        {items.map(card)}
      </View>
    ) : null;

  return (
    <Screen
      gap={22}
      onRefresh={() => void list.refetch()}
      refreshing={list.isRefetching}
      footer={<Button label="Nộp hồ sơ ATTP" size={56} icon={{ sf: 'plus', md: 'add' }} onPress={() => router.push(newHref as Href)} />}
    >
      <Stack.Screen options={{ title: 'Giấy ATTP' }} />
      <RouteMap />
      {list.isPending ? (
        <ListSkeleton rows={3} height={200} />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : data.length === 0 ? (
        <StateView icon={{ sf: 'doc.badge.plus', md: 'note_add' }} title="Chưa có hồ sơ ATTP" body="Nộp giấy chứng nhận, khám sức khoẻ, tập huấn và ảnh nơi chế biến cho các món cần giấy." />
      ) : (
        <>
          {group('Cần bạn bổ sung', groups.todo)}
          {group('Đang xét', groups.reviewing)}
          {group('Giấy còn hiệu lực', groups.valid)}
          {group('Đã kết thúc', groups.closed)}
        </>
      )}
    </Screen>
  );
}

function RouteSteps({ states }: { states: StepState[] }) {
  return (
    <View style={{ flexDirection: 'row' }} accessible accessibilityLabel={ROUTE_STEPS.map((s, i) => `${s}: ${states[i] === 'done' ? 'xong' : states[i] === 'current' ? 'đang tới' : states[i] === 'failed' ? 'không đạt' : 'chưa'}`).join(', ')}>
      {states.map((s, i) => {
        const bg = s === 'done' ? colors.leaf : s === 'current' ? colors.cta : s === 'failed' ? colors.danger : colors.sunken;
        return (
          <View key={ROUTE_STEPS[i]} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
            <View style={{ height: 28, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' }}>
              {i > 0 ? <View style={{ position: 'absolute', left: 0, right: '50%', height: 4, backgroundColor: s === 'todo' ? colors.line : colors.leaf }} /> : null}
              {i < states.length - 1 ? <View style={{ position: 'absolute', left: '50%', right: 0, height: 4, backgroundColor: states[i + 1] === 'todo' ? colors.line : colors.leaf }} /> : null}
              <View style={{ width: 28, height: 28, borderRadius: radius.full, backgroundColor: bg, borderWidth: 3, borderColor: colors.card, alignItems: 'center', justifyContent: 'center', boxShadow: s === 'current' ? `0 0 0 2px ${colors.cta}` : undefined }}>
                {s === 'done' ? <Icon sf="checkmark" md="check" size={11} color={colors.white} weight="bold" /> : s === 'failed' ? <Icon sf="xmark" md="close" size={11} color={colors.white} weight="bold" /> : null}
              </View>
            </View>
            <Text style={[text.caption, { color: s === 'todo' ? colors.muted : colors.ink, fontFamily: s === 'current' ? fonts.heavy : fonts.semibold, textAlign: 'center' }]}>{ROUTE_STEPS[i]}</Text>
          </View>
        );
      })}
    </View>
  );
}

/** A word from the ward or the department, inside the card (not a banner in a card). */
function Note({ tone, title, children }: { tone: 'warn' | 'danger'; title: string; children: ReactNode }) {
  const warn = tone === 'warn';
  return (
    <View style={{ flexDirection: 'row', gap: 10, padding: 12, borderRadius: radius.control, borderCurve: 'continuous', backgroundColor: warn ? colors.mangoTint : colors.dangerTint }}>
      <Icon sf={warn ? 'text.bubble.fill' : 'xmark.octagon.fill'} md={warn ? 'chat' : 'block'} size={16} color={warn ? colors.onMango : colors.danger} style={{ marginTop: 1 }} />
      <Text style={[text.footnote, { flex: 1, color: warn ? colors.onMango : colors.onDanger }]}>
        <Text style={{ fontFamily: fonts.bold }}>{title}: </Text>
        {children}
      </Text>
    </View>
  );
}

function AttpCard({ application: a, onResubmit, onWithdraw }: { application: FoodSafetyApplication; onResubmit: () => void; onWithdraw: () => void }) {
  const s = a.isExpired ? { label: 'Đã hết hạn', tone: 'danger' as const } : statusLabel(a.status);
  const waiting = waitingText(a);
  // The helper reads "Phường cần xét · 6 ngày": the holder in words, the wait as its own figure.
  const [holder, held] = waiting ? waiting.split(' · ') : [null, null];
  const left = a.status === 'APPROVED' ? daysLeft(a.expiresOn) : null;
  const span = validitySpan(a.issuedOn, a.expiresOn);
  const todo = a.actions.includes('RESUBMIT');
  const shown = a.dishes.slice(0, 4);
  return (
    <View style={{ gap: 14, padding: 18, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadow.card, borderWidth: todo ? 2 : 0, borderColor: colors.sticker }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {/* The dishes this file covers, as overlapping photo discs */}
        <View style={{ flexDirection: 'row' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {shown.map((d, i) => (
            <View key={d.menuItemId} style={{ width: 46, height: 46, marginLeft: i ? -12 : 0, borderRadius: radius.full, overflow: 'hidden', borderWidth: 3, borderColor: colors.card, backgroundColor: colors.sunken, alignItems: 'center', justifyContent: 'center' }}>
              {d.imageUrl ? <Image source={{ uri: apiAssetUrl(d.imageUrl) }} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : <Icon sf="fork.knife" md="restaurant" size={16} color={colors.muted} />}
            </View>
          ))}
          {a.dishes.length > shown.length ? (
            <View style={{ width: 46, height: 46, marginLeft: -12, borderRadius: radius.full, borderWidth: 3, borderColor: colors.card, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={[{ fontFamily: fonts.heavy, fontSize: 13, color: colors.primary }, tabular]}>+{a.dishes.length - shown.length}</Text>
            </View>
          ) : null}
        </View>
        <View style={{ flex: 1 }} />
        <StatusPill label={s.label} tone={s.tone} />
      </View>
      <View style={{ gap: 3 }}>
        <Text style={{ fontFamily: fonts.heavy, fontSize: 16.5, lineHeight: 22, color: colors.ink }} numberOfLines={2}>
          {a.dishes.map((d) => d.name).join(', ')}
        </Text>
        <Text style={[text.footnote, tabular, { color: colors.muted }]}>
          Hồ sơ #{a.applicationId}, {a.storefrontName}
        </Text>
      </View>
      <RouteSteps states={stepStates(a)} />
      {holder ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon sf="clock.fill" md="schedule" size={14} color={colors.muted} />
          <Text style={[text.footnote, { flex: 1, color: colors.ink, fontFamily: fonts.semibold }]}>{holder}</Text>
          {held ? (
            <View style={{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.full, backgroundColor: colors.sunken }}>
              <Text style={[text.caption, tabular, { color: colors.ink }]}>{held}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
      {a.reviewReason && (todo || a.status === 'REJECTED') ? <Note tone={todo ? 'warn' : 'danger'} title={todo ? 'Phường yêu cầu' : 'Lý do'}>{a.reviewReason}</Note> : null}
      {a.resultReason && a.status === 'REJECTED' ? <Note tone="danger" title="Kết quả của Chi cục">{a.resultReason}</Note> : null}
      {a.status === 'APPROVED' ? (
        // The certificate as a seal: the number in sign figures, its validity under it
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.photo, borderCurve: 'continuous', backgroundColor: a.isExpired ? colors.dangerTint : colors.leafTint }}>
          <View style={{ width: 44, height: 44, borderRadius: radius.full, backgroundColor: a.isExpired ? colors.danger : colors.leaf, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.white }}>
            <Icon sf={a.isExpired ? 'xmark.seal.fill' : 'checkmark.seal.fill'} md={a.isExpired ? 'gpp_bad' : 'verified'} size={20} color={colors.white} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text maxFontSizeMultiplier={1.4} style={[a.certificateNumber ? { fontFamily: fonts.code, fontSize: 19, lineHeight: 24 } : text.headline, tabular, { color: a.isExpired ? colors.onDanger : colors.onLeaf }]}>
              {a.certificateNumber ? `Giấy số ${a.certificateNumber}` : 'Đạt ATTP'}
            </Text>
            {a.departmentName ? <Text style={[text.caption, { color: a.isExpired ? colors.onDanger : colors.onLeaf }]}>{a.departmentName}</Text> : null}
            {a.expiresOn ? (
              <Text style={[text.caption, tabular, { fontFamily: fonts.regular, color: a.isExpired ? colors.onDanger : colors.onLeaf }]}>
                Hiệu lực đến {formatDay(a.expiresOn)}
                {span ? ` (${span})` : ''}
              </Text>
            ) : null}
          </View>
          {left != null && !a.isExpired ? (
            <View style={{ alignItems: 'center' }}>
              <Text maxFontSizeMultiplier={1.3} style={[sign.price, tabular, { color: colors.onLeaf }]}>{left}</Text>
              <Text style={[text.caption, { color: colors.onLeaf }]}>ngày</Text>
            </View>
          ) : null}
        </View>
      ) : null}
      <Text style={[text.caption, tabular, { fontFamily: fonts.regular, color: colors.muted }]}>Nộp {formatVietnamDate(a.submittedAt)}</Text>
      {todo || a.actions.includes('WITHDRAW') ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {a.actions.includes('WITHDRAW') ? <Button label="Rút hồ sơ" variant="secondary" onPress={onWithdraw} style={{ flex: 1 }} /> : null}
          {todo ? <Button label="Bổ sung hồ sơ" icon={{ sf: 'square.and.pencil', md: 'edit_document' }} onPress={onResubmit} style={{ flex: 1.4 }} /> : null}
        </View>
      ) : null}
    </View>
  );
}

/** A numbered part of the form: the number on an orange disc, the heading, a note under it. */
function Part({ n, title, note }: { n: number; title: string; note?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
      <View style={{ width: 30, height: 30, borderRadius: radius.full, backgroundColor: colors.cta, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
        <Text style={[{ fontFamily: fonts.heavy, fontSize: 14, color: colors.white }, tabular]}>{n}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text accessibilityRole="header" style={{ fontFamily: fonts.heavy, fontSize: 18, lineHeight: 24, letterSpacing: -0.2, color: colors.ink }}>
          {title}
        </Text>
        {note ? <Text style={[text.footnote, { color: colors.muted }]}>{note}</Text> : null}
      </View>
    </View>
  );
}

type Attachment = { evidenceType: FoodSafetyEvidenceType; fileUrl: string; preview: string | null };

/** V33 Nộp / bổ sung hồ sơ ATTP, v5: pick the dishes from their photos, attach the documents, a note, send to the ward. */
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
      <Screen
        gap={18}
        footer={
          <View style={{ gap: 8 }}>
            {formError ? (
              <View accessibilityRole="alert" style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', padding: 12, borderRadius: radius.control, backgroundColor: colors.dangerTint }}>
                <Icon sf="exclamationmark.circle.fill" md="error" size={16} color={colors.danger} style={{ marginTop: 1 }} />
                <Text style={[text.footnote, { flex: 1, color: colors.onDanger }]}>{formError}</Text>
              </View>
            ) : null}
            <Button label="Gửi phường" size={56} icon={{ sf: 'paperplane.fill', md: 'send' }} loading={submit.isPending} disabled={upload.isPending} onPress={send} />
          </View>
        }
      >
        <Stack.Screen options={{ title }} />
        {existing.data?.reviewReason ? <StatusHeader tone="pending" icon={{ sf: 'text.bubble.fill', md: 'chat' }} title="Phường yêu cầu" detail={existing.data.reviewReason} /> : null}
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

        <Part n={1} title="Chọn món xin cấp giấy" note={selected.size ? `Đã chọn ${selected.size} món. Món 'Cần giấy ATTP' chưa bán được cho tới khi hồ sơ được duyệt.` : "Món 'Cần giấy ATTP' chưa bán được cho tới khi hồ sơ được duyệt."} />
        {menu.isPending ? (
          <View style={{ flexDirection: 'row', gap: 12 }} accessibilityLabel="Đang tải món">
            <Skeleton height={190} radius={radius.card} style={{ flex: 1 }} />
            <Skeleton height={190} radius={radius.card} style={{ flex: 1 }} />
          </View>
        ) : dishes.length === 0 ? (
          <Text style={[text.footnote, { color: colors.muted }]}>Gian hàng chưa có món. Thêm món ở Thực đơn trước.</Text>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {dishes.map((d) => {
              const claimed = !own.has(d.menuItemId) && (d.foodSafetyStatus === 'PENDING' || d.foodSafetyStatus === 'APPROVED');
              const on = selected.has(d.menuItemId);
              const missing = d.foodSafetyStatus === 'MISSING';
              return (
                <Pressable
                  key={d.menuItemId}
                  disabled={claimed}
                  onPress={() => toggle(d.menuItemId)}
                  accessibilityRole="checkbox"
                  accessibilityLabel={`${d.name}. ${claimed ? (d.foodSafetyStatus === 'APPROVED' ? 'Đã có giấy còn hạn' : 'Đang trong hồ sơ khác') : missing ? 'Cần giấy ATTP' : d.categoryName}`}
                  accessibilityState={{ checked: on, disabled: claimed }}
                  style={({ pressed }) => ({ width: '47%', flexGrow: 1, gap: 8, padding: 6, paddingBottom: 10, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: on ? colors.kerbPaint : colors.card, borderWidth: 2, borderColor: on ? colors.cta : 'transparent', boxShadow: on ? shadow.glow : shadow.card, opacity: claimed ? 0.5 : pressed ? 0.9 : 1 })}
                >
                  <PhotoTile source={d.imageUrl ? { uri: apiAssetUrl(d.imageUrl) } : null} style={{ width: '100%', aspectRatio: 1.25 }}>
                    <View style={{ position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: radius.full, backgroundColor: on ? colors.cta : 'rgba(255,255,255,0.92)', borderWidth: 2, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' }}>
                      {on ? <Icon sf="checkmark" md="check" size={15} color={colors.white} weight="bold" /> : null}
                    </View>
                    {missing && !claimed ? (
                      <View style={{ position: 'absolute', left: 8, bottom: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sticker, backgroundColor: colors.dangerTint }}>
                        <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: colors.onDanger }}>Cần giấy ATTP</Text>
                      </View>
                    ) : null}
                  </PhotoTile>
                  <View style={{ gap: 2, paddingHorizontal: 6 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, lineHeight: 19, color: colors.ink }} numberOfLines={2}>{d.name}</Text>
                    <Text style={[text.caption, { fontFamily: fonts.regular, color: colors.muted }]} numberOfLines={1}>
                      {claimed ? (d.foodSafetyStatus === 'APPROVED' ? 'Đã có giấy còn hạn' : 'Đang trong hồ sơ khác') : missing ? 'Chưa có giấy' : d.categoryName}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={{ height: 6 }} />
        <Part n={2} title="Giấy tờ đính kèm" note="Ảnh rõ nét hoặc file PDF, tối đa 5 MB mỗi file." />
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
        {fileError ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
            <Icon sf="exclamationmark.circle.fill" md="error" size={14} color={colors.danger} style={{ marginTop: 2 }} />
            <Text style={[text.footnote, { flex: 1, color: colors.onDanger }]}>{fileError}</Text>
          </View>
        ) : null}
        {RECOMMENDED_EVIDENCE.some((t) => !haveTypes.has(t)) ? (
          <Text style={[text.footnote, { color: colors.muted }]}>
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
                    <Text style={[text.footnote, { color: colors.ink, fontFamily: fonts.bold }]} numberOfLines={1}>{FOOD_SAFETY_EVIDENCE_LABELS[a.evidenceType]}</Text>
                  </View>
                ) : (
                  <ProtectedFileTile fileUrl={a.fileUrl} label={FOOD_SAFETY_EVIDENCE_LABELS[a.evidenceType]} />
                )}
                <Pressable
                  onPress={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                  accessibilityRole="button"
                  accessibilityLabel={`Bỏ ${FOOD_SAFETY_EVIDENCE_LABELS[a.evidenceType]}`}
                  hitSlop={8}
                  style={{ position: 'absolute', top: 6, right: 6, width: 32, height: 32, borderRadius: radius.full, backgroundColor: 'rgba(17,28,43,0.7)', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Icon sf="xmark" md="close" size={13} color={colors.white} weight="bold" />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        <View style={{ height: 6 }} />
        <Part n={3} title="Ghi chú cho Phường" />
        <TextField label="Ghi chú" optional value={note} onChangeText={setNote} multiline placeholder="VD: Giấy khám sức khoẻ của cả hai người phụ bếp" maxLength={1000} />
      </Screen>
      {picker.sheet}
    </View>
  );
}
