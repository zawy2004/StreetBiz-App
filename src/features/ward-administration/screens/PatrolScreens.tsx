import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';

import { Card, KeyValueList, Segments } from '@/components/common/Blocks';
import { Button } from '@/components/common/Button';
import { Chip } from '@/components/common/Chip';
import { Icon } from '@/components/common/Icon';
import { ProtectedFileTile, shareProtectedFile } from '@/components/common/ProtectedFile';
import { Sheet } from '@/components/common/Sheet';
import { SheetOption } from '@/components/common/SheetOption';
import { SlotPlate } from '@/components/common/SlotPlate';
import { Banner } from '@/components/feedback/Banner';
import { ErrorState, ListSkeleton } from '@/components/feedback/States';
import { StateView } from '@/components/feedback/StateView';
import { showToast } from '@/components/feedback/Toast';
import { useFilePicker } from '@/components/forms/FileSourceSheet';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { StatusPill } from '@/components/status/StatusPill';
import { errorMessage } from '@/core/api';
import { env } from '@/core/config/env';
import type { PickedFile } from '@/core/api/upload';
import { statusLabel } from '@/core/constants/status-labels';
import { Checkbox } from '@/features/authentication/components/auth-parts';
import { detectPosition } from '@/features/buyer-discovery/geolocation';
import { useOnline } from '@/features/orders/components/order-display';
import { colors, fonts, radius, tabular, text } from '@/theme';
import { formatVietnamDate, formatVietnamDateTime, formatVnd } from '@/utils/format';
import { GeofenceDrift } from '../components/GeofenceDrift';
import { AiSuggestionCard } from '../components/ReviewParts';
import { daysUntil, parseFineBracket, vnDateOf } from '../violation-utils';
import { complianceApi, violationTypeLabels, wardApi, type InspectPermitResult, type WardViolationDetail } from '../ward-api';

const go = (href: string) => router.push(href as Href);

async function quickPosition() {
  try {
    return await Promise.race([detectPosition(), new Promise<undefined>((r) => setTimeout(() => r(undefined), 5000))]);
  } catch {
    return undefined;
  }
}

/**
 * W10 Tuần tra (WARD-11, BR-39): scan the stall's permit QR (or type its code) — every check is a
 * live server lookup, never cached. A scene photo lets the server's [AI] vision check the bay
 * edge; it only advises. From the verdict: record a violation, or suspend/revoke.
 */
export function PermitScanScreen() {
  const online = useOnline();
  const [permission, requestPermission] = useCameraPermissions();
  const picker = useFilePicker();
  const [code, setCode] = useState('');
  const [photo, setPhoto] = useState<PickedFile | null>(null);
  const [checkedAt, setCheckedAt] = useState<number | null>(null);
  const last = useRef<{ v: string; at: number } | null>(null);
  const inspect = useMutation({
    mutationFn: async (payload: string) => {
      const [point, uploaded] = await Promise.all([quickPosition(), photo ? complianceApi.uploadEvidence(photo) : Promise.resolve(undefined)]);
      return complianceApi.inspectPermit(payload, point?.latitude, point?.longitude, uploaded?.fileUrl);
    },
    onSuccess: (r) => {
      setCheckedAt(Date.now());
      void Haptics.notificationAsync(r.found && r.isValid ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error);
    },
  });
  const result = inspect.data;
  const scanning = !result && !inspect.isPending && online;
  const onScanned = ({ data }: { data: string }) => {
    const now = Date.now();
    if (!scanning || (last.current?.v === data && now - last.current.at < 3000)) return;
    last.current = { v: data, at: now };
    setCode(data);
    inspect.mutate(data);
  };
  const again = () => {
    inspect.reset();
    setCode('');
    setPhoto(null);
    last.current = null;
  };

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <Stack.Screen options={{ title: 'Tuần tra' }} />
        {!online ? <Banner tone="warning">Mất kết nối. Giấy phép chỉ được kiểm tra trực tiếp với máy chủ.</Banner> : null}
        {result ? (
          <InspectVerdict result={result} checkedAt={checkedAt} onAgain={again} />
        ) : (
          <>
            {!permission ? (
              <ListSkeleton rows={1} height={280} />
            ) : !permission.granted ? (
              <View style={{ padding: 20, gap: 12, alignItems: 'center', borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card }}>
                <Icon sf="camera.fill" md="photo_camera" size={32} color={colors.sign} />
                <Text style={[text.callout, { color: colors.ink, textAlign: 'center' }]}>Cho phép camera để quét giấy phép QR của quầy.</Text>
                {permission.canAskAgain ? <Button label="Cho phép camera" variant="sign" onPress={() => void requestPermission()} /> : <Button label="Mở Cài đặt" variant="secondary" onPress={() => void Linking.openSettings()} />}
              </View>
            ) : (
              <View style={{ height: 300, borderRadius: radius.pass, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: '#0B0F14' }}>
                <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={scanning ? onScanned : undefined} />
                <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
                  <View style={{ width: 200, height: 200, borderRadius: 24, borderWidth: 3, borderColor: inspect.isPending ? colors.mango : colors.white }} />
                </View>
                <View style={{ position: 'absolute', left: 12, right: 12, bottom: 12, alignItems: 'center' }}>
                  <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(17,28,43,0.72)' }}>
                    <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.white }}>{inspect.isPending ? 'Đang kiểm tra với máy chủ…' : 'Đưa QR giấy phép vào khung'}</Text>
                  </View>
                </View>
              </View>
            )}
            {inspect.isError ? <Banner tone="danger" action={{ label: 'Thử lại', onPress: again }}>{errorMessage(inspect.error)}</Banner> : null}
            <TextField label="Hoặc nhập mã in trên giấy phép" value={code} onChangeText={setCode} autoCapitalize="characters" autoCorrect={false} placeholder="VD: SB-HC1-2026-0815" />
            <Pressable
              onPress={async () => {
                const f = await picker.pick('Ảnh hiện trường', false);
                if (f) setPhoto(f);
              }}
              accessibilityRole="button"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card }}
            >
              <View style={{ width: 56, height: 56, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.sunken, alignItems: 'center', justifyContent: 'center' }}>
                {photo ? <Image source={{ uri: photo.uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : <Icon sf="camera" md="photo_camera" size={22} color={colors.muted} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[text.subhead, { color: colors.ink }]}>{photo ? 'Đã chọn ảnh hiện trường' : 'Ảnh hiện trường (không bắt buộc)'}</Text>
                <Text style={[text.caption, { color: colors.muted }]}>[AI] gợi ý quầy có lấn ra ngoài ô hay không. Chỉ để tham khảo.</Text>
              </View>
            </Pressable>
            <Button label="Kiểm tra" variant="sign" size={56} icon={{ sf: 'checkmark.shield.fill', md: 'verified_user' }} loading={inspect.isPending} disabled={!code.trim() || !online} onPress={() => inspect.mutate(code.trim())} />
          </>
        )}
        <Pressable onPress={() => go('/ward/patrol/violations')} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: pressed ? colors.sunken : colors.card })}>
          <Icon sf="doc.plaintext.fill" md="article" size={20} color={colors.danger} />
          <Text style={[text.subhead, { flex: 1, color: colors.ink }]}>Biên bản vi phạm đã lập</Text>
          <Icon sf="chevron.right" md="chevron_right" size={14} color={colors.muted} />
        </Pressable>
        <Button label="Lập biên bản không quét mã" variant="secondary" icon={{ sf: 'square.and.pencil', md: 'edit_document' }} onPress={() => go('/ward/patrol/violations/new')} />
        {env.enableAiCompliance && !result ? <GeofenceDrift /> : null}
      </Screen>
      {picker.sheet}
    </View>
  );
}

function InspectVerdict({ result: r, checkedAt, onAgain }: { result: InspectPermitResult; checkedAt: number | null; onAgain: () => void }) {
  if (!r.found) {
    return (
      <View style={{ gap: 12 }}>
        <View style={{ padding: 22, gap: 8, alignItems: 'center', borderRadius: radius.pass, borderCurve: 'continuous', backgroundColor: colors.dangerTint }}>
          <Icon sf="questionmark.diamond.fill" md="help" size={40} color={colors.danger} />
          <Text style={[text.title3, { color: colors.onDanger, fontFamily: fonts.heavy }]}>Không tìm thấy giấy phép</Text>
          <Text style={[text.footnote, { color: colors.onDanger, textAlign: 'center' }]}>Mã không khớp giấy phép nào. Quầy có thể đang kinh doanh không phép.</Text>
        </View>
        <Button label="Lập biên bản vi phạm" icon={{ sf: 'exclamationmark.triangle.fill', md: 'gavel' }} onPress={() => go('/ward/patrol/violations/new')} />
        <Button label="Quét mã khác" variant="secondary" onPress={onAgain} />
      </View>
    );
  }
  const valid = r.isValid;
  const ownWard = r.isOwnWard !== false;
  const s = statusLabel(r.effectiveStatus);
  return (
    <View style={{ gap: 12 }}>
      <View style={{ borderRadius: radius.pass, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.card }}>
        <View style={{ padding: 18, gap: 6, alignItems: 'center', backgroundColor: valid ? colors.leafTint : colors.dangerTint }}>
          <Icon sf={valid ? 'checkmark.seal.fill' : 'xmark.seal.fill'} md={valid ? 'verified' : 'gpp_bad'} size={44} color={valid ? colors.leaf : colors.danger} />
          <Text style={[text.title2, { color: valid ? colors.onLeaf : colors.onDanger, fontFamily: fonts.heavy }]}>{valid ? 'Giấy phép hợp lệ' : 'Không hợp lệ'}</Text>
          <StatusPill label={s.label} tone={s.tone} />
          {checkedAt ? <Text style={[text.caption, { color: valid ? colors.onLeaf : colors.onDanger }]}>Máy chủ trả lời lúc {new Date(checkedAt).toLocaleTimeString('vi-VN')}</Text> : null}
        </View>
        <View style={{ padding: 16, gap: 10 }}>
          <Text style={[text.headline, { color: colors.ink }]}>{r.vendorName ?? 'Hộ kinh doanh'}</Text>
          {r.slotCode ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <SlotPlate code={r.slotCode} />
              <Text style={[text.footnote, { color: colors.ink }]}>{r.slotStreet}</Text>
            </View>
          ) : null}
          <KeyValueList
            rows={[
              r.width != null && r.length != null ? { label: 'Kích thước được phép', value: `${r.width} × ${r.length} m` } : null,
              r.startDate && r.endDate ? { label: 'Hiệu lực', value: `${formatVietnamDate(r.startDate)} – ${formatVietnamDate(r.endDate)}` } : null,
              r.distanceMeters != null ? { label: 'Cách ô cấp phép', value: `${Math.round(r.distanceMeters)} m` } : null,
            ]}
          />
          {r.locationWarning ? <Banner tone={r.isLocationMatched ? 'info' : 'warning'} title="Vị trí (hệ thống, không phải AI)">{r.locationWarning}</Banner> : null}
          {!ownWard ? <Banner tone="neutral">Ô này thuộc phường khác: chỉ xem hiệu lực, việc xử lý là của phường đó.</Banner> : null}
        </View>
      </View>
      {r.aiVisionResult ? (
        <AiSuggestionCard title={r.aiVisionResult.detectedEncroachment ? `Có thể lấn chiếm ~${r.aiVisionResult.encroachmentDistanceCm} cm` : 'Không thấy dấu hiệu lấn chiếm'} aiLogId={r.aiVisionResult.isAiGenerated ? r.aiVisionResult.aiLogId : null}>
          <Text style={[text.footnote, { color: colors.ink }]}>{r.aiVisionResult.analysis}</Text>
          {r.aiVisionResult.visualCues.map((c) => (
            <Text key={c} style={[text.caption, { color: colors.onMango }]}>• {c}</Text>
          ))}
        </AiSuggestionCard>
      ) : null}
      {ownWard ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button label="Lập biên bản" icon={{ sf: 'exclamationmark.triangle.fill', md: 'gavel' }} onPress={() => go(`/ward/patrol/violations/new?contractId=${r.contractId ?? ''}&slotId=${r.slotId ?? ''}&vendorId=${r.vendorId ?? ''}`)} style={{ flex: 1 }} />
          {r.permitId ? <Button label="Đình chỉ / thu hồi" variant="secondary" onPress={() => go(`/ward/patrol/permits/${r.permitId}/action`)} style={{ flex: 1 }} /> : null}
        </View>
      ) : null}
      <Button label="Quét mã khác" variant="secondary" icon={{ sf: 'qrcode.viewfinder', md: 'qr_code_scanner' }} onPress={onAgain} />
    </View>
  );
}

/** W11 Đình chỉ / thu hồi giấy phép (WARD-11, BR-35): the action, a 5–500 character reason, a confirmation. */
export function PermitActionScreen() {
  const { permitId } = useLocalSearchParams<{ permitId: string }>();
  const cache = useQueryClient();
  const [action, setAction] = useState<'SUSPEND' | 'REVOKE'>('SUSPEND');
  const [reason, setReason] = useState('');
  const [threshold, setThreshold] = useState(false);
  const submit = useMutation({
    mutationFn: () => complianceApi.permitAction(Number(permitId), action, reason.trim(), threshold),
    onSuccess: async () => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      showToast(action === 'SUSPEND' ? 'Đã tạm đình chỉ giấy phép' : 'Đã thu hồi giấy phép');
      await cache.invalidateQueries({ queryKey: ['ward'] });
      router.back();
    },
    onError: (e) => showToast(errorMessage(e), 'error'),
  });
  const ok = reason.trim().length >= 5 && reason.trim().length <= 500;
  const confirm = () =>
    Alert.alert(action === 'SUSPEND' ? 'Tạm đình chỉ giấy phép?' : 'Thu hồi giấy phép vĩnh viễn?', `Giấy phép #${permitId} sẽ không còn hiệu lực${action === 'SUSPEND' ? ' cho tới khi phường gỡ đình chỉ' : ''}. Hộ kinh doanh được thông báo.`, [
      { text: 'Quay lại', style: 'cancel' },
      { text: action === 'SUSPEND' ? 'Đình chỉ' : 'Thu hồi', style: 'destructive', onPress: () => submit.mutate() },
    ]);
  return (
    <Screen footer={<Button label="Xác nhận xử lý" size={56} loading={submit.isPending} disabled={!ok} onPress={confirm} />}>
      <Stack.Screen options={{ title: `Giấy phép #${permitId}` }} />
      <Segments<'SUSPEND' | 'REVOKE'> value={action} onChange={setAction} options={[{ key: 'SUSPEND', label: 'Tạm đình chỉ' }, { key: 'REVOKE', label: 'Thu hồi' }]} />
      <Banner tone={action === 'REVOKE' ? 'danger' : 'warning'}>{action === 'SUSPEND' ? 'Giấy phép tạm mất hiệu lực; phường có thể gỡ đình chỉ sau.' : 'Thu hồi là vĩnh viễn: hợp đồng kết thúc, ô được mở lại.'}</Banner>
      <TextField label="Lý do xử lý" value={reason} onChangeText={(v) => setReason(v.slice(0, 500))} multiline placeholder="Bắt buộc, 5–500 ký tự" hint={`${reason.trim().length}/500 ký tự`} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {['Tái phạm lấn chiếm lối đi', 'Không nộp phạt đúng hạn', 'Kinh doanh sai vị trí được cấp'].map((p) => (
          <Chip key={p} label={p} onPress={() => setReason((r) => (r.trim() ? `${r.trim()}. ${p}` : p).slice(0, 500))} />
        ))}
      </View>
      <Checkbox checked={threshold} onChange={setThreshold}>
        <Text style={[text.footnote, { color: colors.ink }]}>Căn cứ ngưỡng tuân thủ phường đã cấu hình (số vi phạm / phạt quá hạn)</Text>
      </Checkbox>
    </Screen>
  );
}

const WITNESS_ROLES = [
  { key: 'WITNESS', label: 'Người chứng kiến' },
  { key: 'WARD_REPRESENTATIVE', label: 'Đại diện chính quyền' },
] as const;

/** W12 Lập biên bản vi phạm, bước 1 (WARD-12, Mẫu 01 NĐ 118/2021): who, what, a scene photo, witnesses. */
export function RecordViolationScreen() {
  const params = useLocalSearchParams<{ contractId?: string; slotId?: string; vendorId?: string }>();
  const fixedVendor = params.vendorId ? Number(params.vendorId) : undefined;
  const picker = useFilePicker();
  const vendors = useQuery({
    queryKey: ['ward', 'violation-vendors'],
    queryFn: () => complianceApi.listEnrollments('APPROVED'),
    // A violation is recorded against the household, and one household may hold several
    // approved registrations: list each household once, with all its business names.
    select: (items) => {
      const byVendor = new Map<number, (typeof items)[number]>();
      for (const i of items) {
        const seen = byVendor.get(i.vendorId);
        byVendor.set(i.vendorId, seen ? { ...seen, displayName: `${seen.displayName} · ${i.displayName}` } : i);
      }
      return [...byVendor.values()];
    },
    enabled: !fixedVendor,
  });
  const schedules = useQuery({ queryKey: ['ward', 'penalty-schedules', 'today'], queryFn: () => complianceApi.listPenaltySchedules() });
  const [vendorId, setVendorId] = useState<number | undefined>(fixedVendor);
  const [vendorSheet, setVendorSheet] = useState(false);
  const [typeCode, setTypeCode] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<PickedFile | null>(null);
  const [containment, setContainment] = useState('');
  const [witness, setWitness] = useState({ name: '', role: 'WITNESS' as (typeof WITNESS_ROLES)[number]['key'], occupation: '', address: '' });
  const [explanationRequired, setExplanationRequired] = useState(false);
  const [explanationMethod, setExplanationMethod] = useState<'DIRECT' | 'WRITTEN'>('WRITTEN');
  const types = schedules.data ?? [];
  const chosenType = typeCode ?? types[0]?.violationType ?? 'UNAUTHORIZED_BUSINESS_USE';
  const schedule = types.find((s) => s.violationType === chosenType);
  const vendorName = fixedVendor ? `Mã hộ ${fixedVendor}` : vendors.data?.find((v) => v.vendorId === vendorId)?.displayName;

  const submit = useMutation({
    mutationFn: async () => {
      const evidence = photo ? await complianceApi.uploadEvidence(photo) : undefined;
      return complianceApi.recordViolation({
        contractId: params.contractId ? Number(params.contractId) : undefined,
        slotId: params.slotId ? Number(params.slotId) : undefined,
        vendorId,
        violationType: chosenType,
        description: description.trim(),
        evidenceUrl: evidence?.fileUrl,
        witnessName: witness.name.trim() || undefined,
        witnessRole: witness.name.trim() ? witness.role : undefined,
        witnessOccupation: witness.occupation.trim() || undefined,
        witnessAddress: witness.address.trim() || undefined,
        containmentMeasures: containment.trim() || undefined,
        explanationRequired,
        explanationMethod: explanationRequired ? explanationMethod : undefined,
      });
    },
    onSuccess: (v) => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast('Đã lập biên bản (bước 1/2)');
      router.replace(`/ward/patrol/violations/${v.violationId}` as Href);
    },
    onError: (e) => showToast(errorMessage(e), 'error'),
  });
  const send = () => {
    if (!vendorId) return showToast('Chọn hộ kinh doanh vi phạm.', 'error');
    if (!description.trim()) return showToast('Mô tả hành vi tại hiện trường.', 'error');
    submit.mutate();
  };

  return (
    <View style={{ flex: 1 }}>
      <Screen footer={<Button label="Lập biên bản (bước 1)" size={56} icon={{ sf: 'doc.badge.plus', md: 'note_add' }} loading={submit.isPending} onPress={send} />}>
        <Stack.Screen options={{ title: 'Lập biên bản vi phạm' }} />
        <Pressable disabled={!!fixedVendor} onPress={() => setVendorSheet(true)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, borderWidth: vendorId ? 0 : 1.5, borderColor: colors.mango }}>
          <Icon sf="person.crop.square.fill" md="badge" size={22} color={colors.sign} />
          <View style={{ flex: 1 }}>
            <Text style={[text.caption, { color: colors.muted }]}>Hộ kinh doanh vi phạm</Text>
            <Text style={[text.subhead, { color: colors.ink }]}>{vendorName ?? 'Chọn hộ kinh doanh'}</Text>
          </View>
          {!fixedVendor ? <Icon sf="chevron.down" md="expand_more" size={14} color={colors.muted} /> : null}
        </Pressable>

        <Text style={[text.subhead, { color: colors.ink }]}>Hành vi vi phạm</Text>
        {schedules.isPending ? (
          <ListSkeleton rows={2} height={56} />
        ) : (
          <View style={{ gap: 8 }}>
            {(types.length ? types.map((t) => ({ code: t.violationType, name: t.violationTypeName, amount: t.penaltyAmount, basis: t.legalBasis })) : Object.entries(violationTypeLabels).map(([code, name]) => ({ code, name, amount: null as number | null, basis: null as string | null }))).map((t) => {
              const on = t.code === chosenType;
              return (
                <Pressable key={t.code} onPress={() => setTypeCode(t.code)} accessibilityRole="radio" accessibilityState={{ selected: on }} style={{ padding: 12, gap: 2, borderRadius: 14, borderCurve: 'continuous', backgroundColor: on ? colors.dangerTint : colors.card, borderWidth: on ? 2 : 1, borderColor: on ? colors.danger : colors.line }}>
                  <Text style={[text.subhead, { color: colors.ink }]}>{t.name}</Text>
                  <Text style={[text.caption, { color: t.basis ? colors.muted : colors.onDanger }]}>{t.basis ? `${t.amount != null ? `${formatVnd(t.amount)} · ` : ''}${t.basis}` : 'Chưa có căn cứ: chỉ lập được biên bản'}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
        {schedule && !schedule.legalBasis ? <Banner tone="warning">Hành vi này chưa có căn cứ pháp lý trong Khung mức phạt: lập biên bản được, nhưng chưa ra quyết định phạt tiền.</Banner> : null}

        <TextField label="Mô tả hành vi tại hiện trường" value={description} onChangeText={setDescription} multiline placeholder="Thời gian, vị trí, diện tích lấn chiếm, tang vật" />
        <Pressable
          onPress={async () => {
            const f = await picker.pick('Ảnh hiện trường', false);
            if (f) setPhoto(f);
          }}
          accessibilityRole="button"
          style={{ height: photo ? 180 : 96, borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: photo ? colors.card : colors.kerbPaint, borderWidth: photo ? 0 : 2, borderStyle: 'dashed', borderColor: colors.brandLight, alignItems: 'center', justifyContent: 'center', gap: 4 }}
        >
          {photo ? <Image source={{ uri: photo.uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : (
            <>
              <Icon sf="camera.fill" md="photo_camera" size={22} color={colors.primary} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.primary }}>Chụp ảnh tang vật / hiện trường</Text>
            </>
          )}
        </Pressable>
        <TextField label="Biện pháp ngăn chặn" optional value={containment} onChangeText={setContainment} multiline placeholder="VD: Yêu cầu thu dọn ngay" />

        <Card style={{ gap: 10 }}>
          <Text style={[text.subhead, { color: colors.ink }]}>Người chứng kiến (khi người vi phạm không ký)</Text>
          <TextField label="Họ tên" optional value={witness.name} onChangeText={(v) => setWitness({ ...witness, name: v })} />
          {witness.name.trim() ? (
            <>
              <Segments value={witness.role} onChange={(v) => setWitness({ ...witness, role: v })} options={WITNESS_ROLES.map((r) => ({ key: r.key, label: r.label }))} />
              <TextField label="Nghề nghiệp" optional value={witness.occupation} onChangeText={(v) => setWitness({ ...witness, occupation: v })} />
              <TextField label="Địa chỉ" optional value={witness.address} onChangeText={(v) => setWitness({ ...witness, address: v })} />
            </>
          ) : null}
        </Card>
        <Card style={{ gap: 10 }}>
          <Checkbox checked={explanationRequired} onChange={setExplanationRequired}>
            <Text style={[text.footnote, { color: colors.ink }]}>Người vi phạm yêu cầu giải trình (Điều 61 Luật XLVPHC)</Text>
          </Checkbox>
          {explanationRequired ? <Segments value={explanationMethod} onChange={setExplanationMethod} options={[{ key: 'WRITTEN', label: 'Bằng văn bản' }, { key: 'DIRECT', label: 'Trực tiếp' }]} /> : null}
        </Card>
      </Screen>
      <Sheet visible={vendorSheet} onClose={() => setVendorSheet(false)} title="Hộ kinh doanh">
        {vendors.isPending ? <ListSkeleton rows={3} height={52} /> : null}
        {(vendors.data ?? []).map((v, i, all) => (
          <SheetOption key={v.vendorId} title={v.displayName} subtitle={v.ownerName} selected={v.vendorId === vendorId} last={i === all.length - 1} onPress={() => { setVendorId(v.vendorId); setVendorSheet(false); }} />
        ))}
      </Sheet>
      {picker.sheet}
    </View>
  );
}

type ViolationStage = 'OPEN' | 'DECIDED' | 'ALL';
/** The `status` filter of GET /ward/violations for each tab: pending, any decided penalty, or everything. */
const VIOLATION_STAGE_STATUSES: Record<ViolationStage, string | undefined> = {
  OPEN: 'PENDING_SANCTION',
  DECIDED: 'UNPAID,PAID,WAIVED,CANCELLED',
  ALL: undefined,
};

/** W13 Biên bản đã lập: violations by stage. */
export function ViolationsListScreen() {
  const [stage, setStage] = useState<ViolationStage>('OPEN');
  // The server filters by stage before paging, so each tab is a complete, newest-first page.
  const list = useQuery({ queryKey: ['ward', 'violations', stage], queryFn: () => complianceApi.listViolations(VIOLATION_STAGE_STATUSES[stage]) });
  const rows = list.data ?? [];
  return (
    <Screen onRefresh={() => void list.refetch()} refreshing={list.isRefetching} gap={12}>
      <Stack.Screen options={{ title: 'Biên bản vi phạm' }} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }} style={{ marginHorizontal: -16 }}>
        {(
          [
            { k: 'OPEN', l: 'Chờ xử phạt' },
            { k: 'DECIDED', l: 'Đã ra quyết định' },
            { k: 'ALL', l: 'Tất cả' },
          ] as const
        ).map((f) => (
          <Chip key={f.k} label={f.l} selected={stage === f.k} onPress={() => setStage(f.k)} accessibilityRole="radio" />
        ))}
      </ScrollView>
      {list.isPending ? (
        <ListSkeleton rows={4} height={90} />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : rows.length === 0 ? (
        <StateView icon={{ sf: 'checkmark.seal', md: 'verified' }} tone="neutral" title="Không có biên bản" body="Biên bản lập khi tuần tra sẽ hiện ở đây." />
      ) : (
        rows.map((v) => {
          const s = statusLabel(v.status);
          return (
            <Pressable key={v.violationId} onPress={() => go(`/ward/patrol/violations/${v.violationId}`)} accessibilityRole="button" style={({ pressed }) => ({ padding: 14, gap: 6, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: pressed ? '#FBFBFC' : colors.card })}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {v.slotCode ? <SlotPlate code={v.slotCode} /> : null}
                <Text style={[text.subhead, { flex: 1, color: colors.ink }]} numberOfLines={1}>{v.vendorName ?? 'Hộ kinh doanh'}</Text>
                <StatusPill label={s.label} tone={s.tone} />
              </View>
              <Text style={[text.footnote, { color: colors.ink }]}>{v.violationTypeName}</Text>
              <Text style={[text.caption, { color: colors.muted }]}>{formatVietnamDateTime(v.recordedAt)} · {v.recordedByName}{v.penaltyAmount != null ? ` · ${formatVnd(v.penaltyAmount)}` : ''}</Text>
            </Pressable>
          );
        })
      )}
    </Screen>
  );
}

/**
 * W14 Biên bản & quyết định xử phạt (WARD-12/13): the record, the violator's explanation and the
 * handover, then the sanction — only for an officer with signing authority, using a rate in force
 * on the violation date, inside its legal bracket. The [AI] legal suggestion only advises.
 */
export function ViolationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const violationId = Number(id);
  const cache = useQueryClient();
  const key = ['ward', 'violation', violationId];
  const detail = useQuery({ queryKey: key, queryFn: () => complianceApi.getViolation(violationId), enabled: Number.isFinite(violationId) });
  const me = useQuery({ queryKey: ['ward', 'me'], queryFn: wardApi.me });
  const recordedDay = detail.data ? vnDateOf(detail.data.recordedAt) : undefined;
  const rates = useQuery({ queryKey: ['ward', 'penalty-schedules', recordedDay], queryFn: () => complianceApi.listPenaltySchedules(recordedDay), enabled: Boolean(recordedDay) });
  const [explanation, setExplanation] = useState('');
  const [deliveredTo, setDeliveredTo] = useState('');
  const [refusal, setRefusal] = useState('');
  const [decisionNumber, setDecisionNumber] = useState('');
  const [scheduleId, setScheduleId] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [fine, setFine] = useState('');
  const [fineReason, setFineReason] = useState('');
  const [early, setEarly] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);
  const apply = (next: WardViolationDetail) => cache.setQueryData(key, next);
  const act = useMutation({
    mutationFn: async (kind: 'explain' | 'deliver' | 'refuse' | 'sanction') => {
      const d = detail.data!;
      if (kind === 'explain') return complianceApi.recordExplanation(d.violationId, explanation.trim());
      if (kind === 'deliver') return complianceApi.deliverViolation(d.violationId, deliveredTo.trim(), false, null);
      if (kind === 'refuse') return complianceApi.deliverViolation(d.violationId, null, true, refusal.trim());
      // Same default as the form shows: the first in-force rate of this type with a legal basis.
      const own = (rates.data ?? []).filter((r) => r.violationType === d.violationType && r.legalBasis);
      const rate = own.find((r) => r.scheduleId === (scheduleId ?? own[0]?.scheduleId));
      const moved = fine ? Number(fine) : null;
      return moved != null && rate && moved !== rate.penaltyAmount
        ? complianceApi.sanctionViolation(d.violationId, rate.scheduleId, decisionNumber.trim(), notes.trim() || undefined, early, { amount: moved, reason: fineReason.trim() })
        : complianceApi.sanctionViolation(d.violationId, rate!.scheduleId, decisionNumber.trim(), notes.trim() || undefined, early);
    },
    onSuccess: (next, kind) => {
      apply(next);
      void cache.invalidateQueries({ queryKey: ['ward', 'violations'] });
      setBlocked(null);
      showToast(kind === 'sanction' ? 'Đã ban hành quyết định xử phạt' : kind === 'explain' ? 'Đã ghi nhận giải trình' : kind === 'deliver' ? 'Đã ghi nhận giao biên bản' : 'Đã ghi nhận từ chối nhận biên bản');
    },
    onError: (e, kind) => {
      const m = errorMessage(e);
      if (kind === 'sanction' && m.includes('quyền giải trình')) setBlocked(m);
      else showToast(m, 'error');
    },
  });

  if (detail.isPending) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Biên bản' }} />
        <ListSkeleton rows={3} height={110} />
      </Screen>
    );
  }
  if (detail.isError) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Biên bản' }} />
        <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />
      </Screen>
    );
  }
  const d = detail.data;
  const s = statusLabel(d.status);
  const pending = d.status === 'PENDING_SANCTION';
  const ownRates = (rates.data ?? []).filter((r) => r.violationType === d.violationType && r.legalBasis);
  // The default is the first in-force rate of this type, never the AI's pick: the AI rate is applied
  // only when the officer presses "Áp dụng khung này" on the [AI] card (BR-41).
  const chosen = ownRates.find((r) => r.scheduleId === (scheduleId ?? ownRates[0]?.scheduleId));
  const aiRate = ownRates.find((r) => r.scheduleId === d.aiSuggestion?.penaltyScheduleId);
  const bracket = parseFineBracket(chosen?.legalBasis);
  const authority = me.data?.sanctionAuthorityTitle;
  const explainDays = d.explanationDeadlineAt ? daysUntil(d.explanationDeadlineAt) : null;
  const sanction = () => {
    if (!decisionNumber.trim()) return showToast('Nhập số quyết định xử phạt.', 'error');
    if (!chosen) return showToast('Hành vi này chưa có mức phạt có căn cứ pháp lý hiệu lực. Cấu hình Khung mức phạt trước.', 'error');
    if (fine) {
      const n = Number(fine);
      if (bracket && (n < bracket.min || n > bracket.max)) return showToast(`Mức phạt phải trong khung ${formatVnd(bracket.min)} – ${formatVnd(bracket.max)}.`, 'error');
      if (n !== chosen.penaltyAmount && !fineReason.trim()) return showToast('Nhập lý do khi đổi mức phạt.', 'error');
    }
    Alert.alert('Ban hành quyết định xử phạt?', `${d.violationTypeName} · ${formatVnd(fine ? Number(fine) : chosen.penaltyAmount)}. Quyết định ký bằng tài khoản của bạn (${authority}).`, [
      { text: 'Quay lại', style: 'cancel' },
      { text: 'Ban hành', onPress: () => act.mutate('sanction') },
    ]);
  };

  return (
    <Screen onRefresh={() => void detail.refetch()} refreshing={detail.isRefetching}>
      <Stack.Screen options={{ title: d.bienBanSo ? `Biên bản ${d.bienBanSo}` : `Biên bản #${d.violationId}` }} />
      <Card style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {d.slotCode ? <SlotPlate code={d.slotCode} /> : null}
          <View style={{ flex: 1 }} />
          <StatusPill label={s.label} tone={s.tone} />
        </View>
        <Text style={[text.title3, { color: colors.ink, fontFamily: fonts.heavy }]}>{d.vendorName ?? d.violatorFullName ?? 'Hộ kinh doanh'}</Text>
        <Text style={[text.callout, { color: colors.onDanger }]}>{d.violationTypeName}</Text>
        {d.description ? <Text style={[text.footnote, { color: colors.ink }]}>{d.description}</Text> : null}
        <KeyValueList
          rows={[
            { label: 'Lập lúc', value: formatVietnamDateTime(d.recordedAt) },
            { label: 'Người lập', value: d.recordedByName },
            d.preparedLocation ? { label: 'Nơi lập', value: d.preparedLocation } : null,
            d.containmentMeasures ? { label: 'Ngăn chặn', value: d.containmentMeasures } : null,
            d.witnessName ? { label: d.witnessRole === 'WARD_REPRESENTATIVE' ? 'Đại diện chính quyền' : 'Người chứng kiến', value: d.witnessName } : null,
            { label: 'Vi phạm 90 ngày qua', value: String(d.recentViolationCount90Days) },
            d.penaltyAmount != null ? { label: 'Mức phạt', value: formatVnd(d.penaltyAmount), emphasis: true } : null,
            d.sanctionDecisionNumber ? { label: 'Quyết định số', value: d.sanctionDecisionNumber } : null,
            d.signerName ? { label: 'Người ký', value: `${d.signerName}${d.signerTitle ? ` (${d.signerTitle})` : ''}` } : null,
          ]}
        />
        {d.evidenceUrl ? (
          <View style={{ flexDirection: 'row' }}>
            <ProtectedFileTile fileUrl={d.evidenceUrl} label="Ảnh hiện trường" />
          </View>
        ) : null}
        <Button label="Tải biên bản Mẫu 01 (Word)" variant="secondary" icon={{ sf: 'square.and.arrow.down', md: 'download' }} onPress={() => void shareProtectedFile(`/ward/violations/${d.violationId}/document`, `BienBan_${(d.bienBanSo ?? String(d.violationId)).replace(/\//g, '-')}.docx`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')} />
      </Card>

      {d.complianceFlag.violationThresholdReached || d.complianceFlag.hasOverduePenalty ? (
        <Banner tone="warning" title="Ngưỡng tuân thủ của phường (chỉ để tham khảo)">
          {[
            d.complianceFlag.violationThresholdReached ? `${d.complianceFlag.sanctionedViolationCount}/${d.complianceFlag.violationThreshold} vi phạm đã xử phạt` : null,
            d.complianceFlag.hasOverduePenalty ? `Có khoản phạt quá hạn ${d.complianceFlag.overduePenaltyDays ?? ''} ngày` : null,
          ].filter(Boolean).join(' · ')}
        </Banner>
      ) : null}

      {d.explanationRequired ? (
        <Card style={{ gap: 10 }}>
          <Text style={{ fontFamily: fonts.heavy, fontSize: 16, color: colors.ink }}>Giải trình (Điều 61)</Text>
          {d.explanationReceivedAt ? (
            <Text style={[text.footnote, { color: colors.ink }]}>Đã nhận {formatVietnamDateTime(d.explanationReceivedAt)}: {d.explanationContent}</Text>
          ) : (
            <>
              {explainDays != null ? <Text style={[text.caption, { color: explainDays > 0 ? colors.onMango : colors.muted }]}>Hạn giải trình: {explainDays > 0 ? `còn ${explainDays} ngày` : 'đã hết hạn'}</Text> : null}
              <TextField label="Nội dung giải trình" value={explanation} onChangeText={setExplanation} multiline />
              <Button label="Ghi nhận giải trình" variant="secondary" loading={act.isPending && act.variables === 'explain'} disabled={!explanation.trim() || act.isPending} onPress={() => act.mutate('explain')} />
            </>
          )}
        </Card>
      ) : null}

      <Card style={{ gap: 10 }}>
        <Text style={{ fontFamily: fonts.heavy, fontSize: 16, color: colors.ink }}>Giao biên bản</Text>
        {d.deliveredAt || d.deliveryRefused ? (
          <Text style={[text.footnote, { color: colors.ink }]}>{d.deliveryRefused ? `Người vi phạm từ chối nhận: ${d.deliveryRefusalReason}` : `Đã giao cho ${d.deliveredToName} lúc ${formatVietnamDateTime(d.deliveredAt!)}`}</Text>
        ) : (
          <>
            <TextField label="Người nhận biên bản" value={deliveredTo} onChangeText={setDeliveredTo} />
            <Button label="Đã giao biên bản" variant="secondary" loading={act.isPending && act.variables === 'deliver'} disabled={!deliveredTo.trim() || act.isPending} onPress={() => act.mutate('deliver')} />
            <TextField label="Hoặc lý do từ chối nhận" value={refusal} onChangeText={setRefusal} />
            <Button label="Ghi nhận từ chối nhận" variant="secondary" loading={act.isPending && act.variables === 'refuse'} disabled={!refusal.trim() || act.isPending} onPress={() => act.mutate('refuse')} />
          </>
        )}
      </Card>

      {d.aiSuggestion ? (
        <AiSuggestionCard title="Gợi ý căn cứ xử phạt" aiLogId={d.aiSuggestion.isAiGenerated ? d.aiSuggestion.aiLogId : null}>
          <Text style={[text.footnote, { color: colors.ink }]}>{d.aiSuggestion.hanhViViPham}</Text>
          {d.aiSuggestion.legalBasis ? <Text style={[text.caption, { color: colors.onMango }]}>Căn cứ (chép từ Khung mức phạt của phường): {d.aiSuggestion.legalBasis}</Text> : null}
          {d.aiSuggestion.suggestedPenaltyAmount != null ? <Text style={[text.caption, { color: colors.onMango }]}>Mức gợi ý: {formatVnd(d.aiSuggestion.suggestedPenaltyAmount)}</Text> : null}
          {d.aiSuggestion.bienPhapKhacPhuc ? <Text style={[text.caption, { color: colors.onMango }]}>Biện pháp khắc phục: {d.aiSuggestion.bienPhapKhacPhuc}</Text> : null}
          {pending && authority && aiRate ? (
            <Button
              label={chosen?.scheduleId === aiRate.scheduleId ? 'Đang dùng khung này' : 'Áp dụng khung này'}
              variant="secondary"
              disabled={chosen?.scheduleId === aiRate.scheduleId}
              onPress={() => {
                setScheduleId(aiRate.scheduleId);
                showToast('Đã áp dụng khung xử phạt vào quyết định');
              }}
            />
          ) : null}
        </AiSuggestionCard>
      ) : null}

      {pending ? (
        <Card style={{ gap: 10 }}>
          <Text style={{ fontFamily: fonts.heavy, fontSize: 16, color: colors.ink }}>Quyết định xử phạt (bước 2)</Text>
          {me.isPending ? null : !authority ? (
            <Banner tone="neutral">Tài khoản của bạn chưa được giao thẩm quyền ký quyết định xử phạt. Chỉ Chủ tịch, Phó Chủ tịch UBND phường hoặc người được uỷ quyền bằng văn bản mới ký.</Banner>
          ) : (
            <>
              <Text style={[text.caption, { color: colors.muted }]}>Ký với tư cách: {authority}</Text>
              {rates.isPending ? <ListSkeleton rows={1} height={56} /> : ownRates.length === 0 ? <Banner tone="warning">Hành vi này chưa có mức phạt có căn cứ pháp lý hiệu lực ngày {formatVietnamDate(d.recordedAt)}.</Banner> : null}
              {ownRates.map((r) => {
                const on = r.scheduleId === chosen?.scheduleId;
                return (
                  <Pressable key={r.scheduleId} onPress={() => setScheduleId(r.scheduleId)} accessibilityRole="radio" accessibilityState={{ selected: on }} style={{ padding: 12, gap: 2, borderRadius: 14, backgroundColor: on ? colors.brandTint : colors.sunken, borderWidth: on ? 2 : 0, borderColor: colors.cta }}>
                    <Text style={[{ fontFamily: fonts.heavy, fontSize: 15, color: colors.ink }, tabular]}>{formatVnd(r.penaltyAmount)}</Text>
                    <Text style={[text.caption, { color: colors.muted }]}>{r.legalBasis}</Text>
                  </Pressable>
                );
              })}
              <TextField label="Số quyết định" value={decisionNumber} onChangeText={setDecisionNumber} placeholder={`VD: 01/QĐ-XPHC-${new Date().getFullYear()}`} />
              {bracket ? (
                <>
                  <TextField label="Mức phạt khác (trong khung)" optional value={fine} onChangeText={(v) => setFine(v.replace(/[^0-9]/g, ''))} keyboardType="number-pad" hint={`Khung ${formatVnd(bracket.min)} – ${formatVnd(bracket.max)}`} />
                  {fine && chosen && Number(fine) !== chosen.penaltyAmount ? <TextField label="Lý do đổi mức phạt" value={fineReason} onChangeText={setFineReason} multiline placeholder="Tình tiết giảm nhẹ / tăng nặng" /> : null}
                </>
              ) : null}
              <TextField label="Ghi chú" optional value={notes} onChangeText={setNotes} multiline />
              {blocked ? (
                <View style={{ gap: 8 }}>
                  <Banner tone="warning">{blocked}</Banner>
                  <Checkbox checked={early} onChange={setEarly}>
                    <Text style={[text.footnote, { color: colors.ink }]}>Tôi vẫn ra quyết định trước khi hết hạn giải trình (ghi vào hồ sơ)</Text>
                  </Checkbox>
                </View>
              ) : null}
              <Button label="Ban hành quyết định" size={56} icon={{ sf: 'signature', md: 'draw' }} loading={act.isPending && act.variables === 'sanction'} disabled={act.isPending || ownRates.length === 0} onPress={sanction} />
            </>
          )}
        </Card>
      ) : null}
    </Screen>
  );
}
