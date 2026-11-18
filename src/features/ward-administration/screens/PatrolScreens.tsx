import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyValueList, Segments } from '@/components/common/Blocks';
import { Button } from '@/components/common/Button';
import { Chip } from '@/components/common/Chip';
import { Icon } from '@/components/common/Icon';
import { ProtectedFileTile, shareProtectedFile } from '@/components/common/ProtectedFile';
import { Sheet } from '@/components/common/Sheet';
import { SheetOption } from '@/components/common/SheetOption';
import { Banner } from '@/components/feedback/Banner';
import { Skeleton } from '@/components/feedback/Skeleton';
import { ErrorState, ListSkeleton } from '@/components/feedback/States';
import { StateView } from '@/components/feedback/StateView';
import { showToast } from '@/components/feedback/Toast';
import { useFilePicker } from '@/components/forms/FileSourceSheet';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { StatusHeader } from '@/components/native/StatusHeader';
import { StepProgress } from '@/components/native/StepFlow';
import { StatusPill } from '@/components/status/StatusPill';
import { errorMessage } from '@/core/api';
import { env } from '@/core/config/env';
import type { PickedFile } from '@/core/api/upload';
import { statusLabel } from '@/core/constants/status-labels';
import { Checkbox } from '@/features/authentication/components/auth-parts';
import { detectPosition } from '@/features/buyer-discovery/geolocation';
import { parsePermitQr } from '@/features/digital-permits/permit-qr-text';
import { useOnline } from '@/features/orders/components/order-display';
import { violationDescriptionFromReport } from '@/features/vendor-reports/report-view';
import { wardReportKeys, wardReportsApi } from '@/features/vendor-reports/ward-reports-api';
import { colors, fonts, radius, shadow, sign, tabular, text } from '@/theme';
import { Pass, Plate, RoundButton, Signboard, useLightStatusBar } from '@/ui';
import { formatVietnamDate, formatVietnamDateTime, formatVnd } from '@/utils/format';
import { GeofenceDrift } from '../components/GeofenceDrift';
import { AiSuggestionCard } from '../components/ReviewParts';
import { daysUntil, parseFineBracket, vnDateOf } from '../violation-utils';
import { complianceApi, violationTypeLabels, wardApi, type InspectPermitResult, type WardViolationDetail } from '../ward-api';

const go = (href: string) => router.push(href as Href);

async function quickPosition() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([detectPosition(), new Promise<undefined>((r) => (timer = setTimeout(() => r(undefined), 5000)))]);
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * W10 Tuần tra (WARD-11, BR-39), v5 (screens/v5/ward-patrol.md): the camera fills the top of the
 * screen under the status bar, with the patrol's sign lettering and orange corner brackets; a
 * white sheet rises over it with the typed code, the optional scene photo and "Kiểm tra". Every
 * check is a live server lookup, never cached. A scene photo lets the server's [AI] vision check
 * the bay edge; it only advises. The verdict paints the whole top of the screen green or red.
 */
export function PermitScanScreen() {
  const insets = useSafeAreaInsets();
  useLightStatusBar();
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
      // A printed price board's QR is a link wrapping the same signed token: send the token.
      return complianceApi.inspectPermit(parsePermitQr(payload).token, point?.latitude, point?.longitude, uploaded?.fileUrl);
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

  if (result) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScrollView contentContainerStyle={{ paddingBottom: 40, gap: 18 }}>
          <InspectVerdict result={result} checkedAt={checkedAt} onAgain={again} />
        </ScrollView>
      </View>
    );
  }

  const cameraHeight = 300 + insets.top;
  return (
    <View style={{ flex: 1, backgroundColor: VIEWFINDER_BG }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>
        {/* The viewfinder, full bleed */}
        <View style={{ height: cameraHeight, backgroundColor: VIEWFINDER_BG }}>
          {permission?.granted ? (
            <>
              <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={scanning ? onScanned : undefined} />
              {/* A scrim so the white title reads over any street scene */}
              <LinearGradient pointerEvents="none" colors={['rgba(14, 21, 31, 0.78)', 'rgba(14, 21, 31, 0)']} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: insets.top + 110 }} />
            </>
          ) : null}
          <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 44 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text accessibilityRole="header" maxFontSizeMultiplier={1.3} style={[sign.title, { color: colors.white }]}>
                TUẦN TRA
              </Text>
              <RoundButton icon={{ sf: 'doc.plaintext.fill', md: 'article' }} label="Biên bản vi phạm đã lập" onPress={() => go('/ward/patrol/violations')} />
            </View>
            <View pointerEvents="box-none" style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              {permission?.granted ? (
                <Brackets busy={inspect.isPending} />
              ) : !permission ? null : (
                <View style={{ alignItems: 'center', gap: 12, paddingHorizontal: 12 }}>
                  <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon sf="camera.fill" md="photo_camera" size={30} color={colors.white} />
                  </View>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 15.5, lineHeight: 22, color: colors.white, textAlign: 'center' }}>
                    Cho phép camera để quét giấy phép QR của quầy.
                  </Text>
                  {permission.canAskAgain ? (
                    <Button label="Cho phép camera" onPress={() => void requestPermission()} />
                  ) : (
                    <Button label="Mở Cài đặt" onPress={() => void Linking.openSettings()} />
                  )}
                </View>
              )}
            </View>
            {permission?.granted ? (
              <View pointerEvents="none" style={{ alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, minHeight: 34, borderRadius: 17, backgroundColor: inspect.isPending ? colors.sticker : 'rgba(17, 28, 43, 0.72)' }}>
                  {inspect.isPending ? <ActivityIndicator size="small" color={colors.plate} /> : <Icon sf="qrcode.viewfinder" md="qr_code_scanner" size={16} color={colors.white} />}
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: inspect.isPending ? colors.plate : colors.white }}>
                    {inspect.isPending ? 'Đang kiểm tra với máy chủ…' : 'Đưa QR giấy phép vào khung'}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
        </View>

        {/* The sheet that rises over the camera */}
        <View style={{ flexGrow: 1, marginTop: -26, borderTopLeftRadius: radius.pass, borderTopRightRadius: radius.pass, borderCurve: 'continuous', backgroundColor: colors.bg, padding: 20, paddingTop: 12, gap: 16 }}>
          <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.line }} />
          {!online ? <Banner tone="warning">Mất kết nối. Giấy phép chỉ được kiểm tra trực tiếp với máy chủ.</Banner> : null}
          {inspect.isError ? <Banner tone="danger" action={{ label: 'Thử lại', onPress: again }}>{errorMessage(inspect.error)}</Banner> : null}
          <TextField label="Hoặc nhập mã in trên giấy phép" value={code} onChangeText={setCode} autoCapitalize="characters" autoCorrect={false} placeholder="VD: SB-HC1-2026-0815" hint="Dán được cả mã SBP1 và đường link dưới mã QR bảng giá." icon={{ sf: 'number', md: 'tag' }} />
          <Pressable
            onPress={async () => {
              const f = await picker.pick('Ảnh hiện trường', false);
              if (f) setPhoto(f);
            }}
            accessibilityRole="button"
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: pressed ? colors.sunken : colors.card, boxShadow: shadow.card })}
          >
            <View style={{ width: 60, height: 60, borderRadius: radius.photo - 4, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.mangoTint, alignItems: 'center', justifyContent: 'center' }}>
              {photo ? <Image source={{ uri: photo.uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : <Icon sf="camera.fill" md="photo_camera" size={24} color={colors.onMango} />}
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.ink }}>{photo ? 'Đã chọn ảnh hiện trường' : 'Ảnh hiện trường (không bắt buộc)'}</Text>
              <Text style={[text.footnote, { color: colors.muted }]}>[AI] gợi ý quầy có lấn ra ngoài ô hay không. Chỉ để tham khảo.</Text>
            </View>
            <Icon sf={photo ? 'arrow.triangle.2.circlepath' : 'plus'} md={photo ? 'sync' : 'add'} size={16} color={colors.muted} />
          </Pressable>
          <Button label="Kiểm tra" variant="sign" size={56} icon={{ sf: 'checkmark.shield.fill', md: 'verified_user' }} loading={inspect.isPending} disabled={!code.trim() || !online} onPress={() => inspect.mutate(code.trim())} />
          <Button label="Lập biên bản không quét mã" variant="secondary" icon={{ sf: 'square.and.pencil', md: 'edit_document' }} onPress={() => go('/ward/patrol/violations/new')} />
          {env.enableAiCompliance ? <GeofenceDrift /> : null}
        </View>
      </ScrollView>
      {picker.sheet}
    </View>
  );
}

/** The dark of a camera that has not started yet (and around the permission prompt). */
const VIEWFINDER_BG = '#0E151F';

/** Four orange corner brackets around where the QR goes; mango while the server answers. */
function Brackets({ busy }: { busy: boolean }) {
  const c = busy ? colors.sticker : colors.brand;
  const arm = { position: 'absolute' as const, width: 46, height: 46, borderColor: c };
  return (
    <View style={{ width: 210, height: 210 }}>
      <View style={[arm, { left: 0, top: 0, borderLeftWidth: 6, borderTopWidth: 6, borderTopLeftRadius: 22 }]} />
      <View style={[arm, { right: 0, top: 0, borderRightWidth: 6, borderTopWidth: 6, borderTopRightRadius: 22 }]} />
      <View style={[arm, { left: 0, bottom: 0, borderLeftWidth: 6, borderBottomWidth: 6, borderBottomLeftRadius: 22 }]} />
      <View style={[arm, { right: 0, bottom: 0, borderRightWidth: 6, borderBottomWidth: 6, borderBottomRightRadius: 22 }]} />
    </View>
  );
}

/**
 * The server's answer, read at arm's length: the top of the screen painted in the verdict with
 * the word in sign lettering and the time the server answered; then the stall's pass (vendor,
 * slot plate, allowed size, validity, distance), the [AI] advice, and what the officer can do.
 */
function InspectVerdict({ result: r, checkedAt, onAgain }: { result: InspectPermitResult; checkedAt: number | null; onAgain: () => void }) {
  const answered = checkedAt ? `Máy chủ trả lời lúc ${new Date(checkedAt).toLocaleTimeString('vi-VN')}` : undefined;
  if (!r.found) {
    return (
      <>
        <Signboard color={colors.danger} kerb={false} line2Color={colors.white} line1="Không tìm thấy" line2="giấy phép" caption={`Mã không khớp giấy phép nào. Quầy có thể đang kinh doanh không phép.${answered ? ` ${answered}.` : ''}`} />
        <View style={{ paddingHorizontal: 20, gap: 12 }}>
          <Button label="Lập biên bản vi phạm" size={56} icon={{ sf: 'exclamationmark.triangle.fill', md: 'gavel' }} onPress={() => go('/ward/patrol/violations/new')} />
          <Button label="Quét mã khác" variant="secondary" icon={{ sf: 'qrcode.viewfinder', md: 'qr_code_scanner' }} onPress={onAgain} />
        </View>
      </>
    );
  }
  const valid = r.isValid;
  const ownWard = r.isOwnWard !== false;
  const s = statusLabel(r.effectiveStatus);
  return (
    <>
      <Signboard
        color={valid ? colors.leaf : colors.danger}
        kerb={false}
        line2Color={colors.white}
        top={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }}>
              <Icon sf={valid ? 'checkmark.seal.fill' : 'xmark.seal.fill'} md={valid ? 'verified' : 'gpp_bad'} size={30} color={valid ? colors.leaf : colors.danger} />
            </View>
            <StatusPill label={s.label} tone={s.tone} />
          </View>
        }
        line1={valid ? 'Giấy phép' : 'Không'}
        line2={valid ? 'hợp lệ' : 'hợp lệ'}
        caption={answered}
        overlap={
          <Pass
            accent={valid ? colors.leaf : colors.danger}
            head={
              <View style={{ gap: 12 }}>
                <Text style={{ fontFamily: fonts.heavy, fontSize: 19, lineHeight: 25, color: colors.ink }}>{r.vendorName ?? 'Hộ kinh doanh'}</Text>
                {r.slotCode ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Plate code={r.slotCode} />
                    <Text numberOfLines={2} style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: colors.ink }}>{r.slotStreet}</Text>
                  </View>
                ) : null}
              </View>
            }
            stub={
              <KeyValueList
                rows={[
                  r.width != null && r.length != null ? { label: 'Kích thước được phép', value: `${r.width} × ${r.length} m` } : null,
                  r.startDate && r.endDate ? { label: 'Hiệu lực', value: `${formatVietnamDate(r.startDate)} – ${formatVietnamDate(r.endDate)}` } : null,
                  r.distanceMeters != null ? { label: 'Cách ô cấp phép', value: `${Math.round(r.distanceMeters)} m` } : null,
                ]}
              />
            }
          />
        }
      />
      <View style={{ paddingHorizontal: 20, gap: 12 }}>
        {r.locationWarning ? <Banner tone={r.isLocationMatched ? 'info' : 'warning'} title="Vị trí (hệ thống, không phải AI)">{r.locationWarning}</Banner> : null}
        {!ownWard ? <Banner tone="neutral">Ô này thuộc phường khác: chỉ xem hiệu lực, việc xử lý là của phường đó.</Banner> : null}
        {r.aiVisionResult ? (
          <AiSuggestionCard title={r.aiVisionResult.detectedEncroachment ? `Có thể lấn chiếm ~${r.aiVisionResult.encroachmentDistanceCm} cm` : 'Không thấy dấu hiệu lấn chiếm'} aiLogId={r.aiVisionResult.isAiGenerated ? r.aiVisionResult.aiLogId : null}>
            <Text style={[text.footnote, { color: colors.ink }]}>{r.aiVisionResult.analysis}</Text>
            {r.aiVisionResult.visualCues.map((c) => (
              <Text key={c} style={[text.caption, { color: colors.onMango }]}>• {c}</Text>
            ))}
          </AiSuggestionCard>
        ) : null}
        {/* A valid permit usually means walk on to the next stall: scanning again leads. A
            failed one leads with the record. Both stay one tap away either way. */}
        {valid ? <Button label="Quét mã khác" variant="sign" size={56} icon={{ sf: 'qrcode.viewfinder', md: 'qr_code_scanner' }} onPress={onAgain} /> : null}
        {ownWard ? (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button label="Lập biên bản" variant={valid ? 'secondary' : 'primary'} icon={{ sf: 'exclamationmark.triangle.fill', md: 'gavel' }} onPress={() => go(`/ward/patrol/violations/new?contractId=${r.contractId ?? ''}&slotId=${r.slotId ?? ''}&vendorId=${r.vendorId ?? ''}`)} style={{ flex: 1 }} />
            {r.permitId ? <Button label="Đình chỉ / thu hồi" variant="secondary" onPress={() => go(`/ward/patrol/permits/${r.permitId}/action`)} style={{ flex: 1 }} /> : null}
          </View>
        ) : null}
        {valid ? null : <Button label="Quét mã khác" variant="secondary" icon={{ sf: 'qrcode.viewfinder', md: 'qr_code_scanner' }} onPress={onAgain} />}
      </View>
    </>
  );
}

/** A heading inside a long ward screen (heavy, with an optional one-line note). */
function Heading({ title, note }: { title: string; note?: string }) {
  return (
    <View style={{ gap: 2, marginTop: 8 }}>
      <Text accessibilityRole="header" style={{ fontFamily: fonts.heavy, fontSize: 19, lineHeight: 25, color: colors.ink }}>{title}</Text>
      {note ? <Text style={[text.footnote, { color: colors.muted }]}>{note}</Text> : null}
    </View>
  );
}

/** A white surface for one part of a record. */
function Panel({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ padding: 16, gap: 12, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadow.card }, style]}>{children}</View>;
}

/** The ward's ink stamp for the action about to be taken, pressed askew across the permit. Decorative: the words beside it carry the meaning. */
function ActionStamp({ label, ink }: { label: string; ink: string }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ transform: [{ rotate: '-8deg' }], padding: 3, borderWidth: 3, borderColor: ink, borderRadius: radius.sticker }}>
      <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1.5, borderColor: ink, borderRadius: radius.plate }}>
        <Text maxFontSizeMultiplier={1.2} style={[sign.price, { color: ink }]}>{label}</Text>
      </View>
    </View>
  );
}

/**
 * W11 Đình chỉ / thu hồi giấy phép (WARD-11, BR-35), v5 (screens/v5/ward-ops.md): the permit as
 * a pass with the ward's stamp for the chosen action across it, what the action does, a 5–500
 * character reason, and a native confirmation. The confirming button is the danger red.
 */
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
  const revoke = action === 'REVOKE';
  const ink = revoke ? colors.danger : colors.onMango;
  return (
    <Screen footer={<Button label="Xác nhận xử lý" variant="danger" size={56} icon={{ sf: revoke ? 'xmark.seal.fill' : 'pause.circle.fill', md: revoke ? 'gpp_bad' : 'pause_circle' }} loading={submit.isPending} disabled={!ok} onPress={confirm} />}>
      <Stack.Screen options={{ title: `Giấy phép #${permitId}` }} />
      <Pass
        accent={revoke ? colors.danger : colors.sticker}
        head={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.muted }}>Giấy phép vỉa hè</Text>
              <Text maxFontSizeMultiplier={1.3} adjustsFontSizeToFit numberOfLines={1} style={[sign.figure, tabular, { color: colors.ink }]}>{`#${permitId}`}</Text>
            </View>
            <ActionStamp label={revoke ? 'Thu hồi' : 'Tạm đình chỉ'} ink={ink} />
          </View>
        }
      />
      <Segments<'SUSPEND' | 'REVOKE'> value={action} onChange={setAction} options={[{ key: 'SUSPEND', label: 'Tạm đình chỉ' }, { key: 'REVOKE', label: 'Thu hồi' }]} />
      <StatusHeader
        tone={revoke ? 'danger' : 'pending'}
        icon={revoke ? { sf: 'xmark.octagon.fill', md: 'block' } : { sf: 'pause.circle.fill', md: 'pause_circle' }}
        title={revoke ? 'Vĩnh viễn' : 'Tạm thời'}
        detail={action === 'SUSPEND' ? 'Giấy phép tạm mất hiệu lực; phường có thể gỡ đình chỉ sau.' : 'Thu hồi là vĩnh viễn: hợp đồng kết thúc, ô được mở lại.'}
      />
      <Heading title="Lý do xử lý" />
      <TextField label="Lý do xử lý" value={reason} onChangeText={(v) => setReason(v.slice(0, 500))} multiline placeholder="Bắt buộc, 5–500 ký tự" hint={`${reason.trim().length}/500 ký tự`} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {['Tái phạm lấn chiếm lối đi', 'Không nộp phạt đúng hạn', 'Kinh doanh sai vị trí được cấp'].map((p) => (
          <Chip key={p} label={p} icon={{ sf: 'plus', md: 'add' }} onPress={() => setReason((r) => (r.trim() ? `${r.trim()}. ${p}` : p).slice(0, 500))} />
        ))}
      </View>
      <Panel>
        <Checkbox checked={threshold} onChange={setThreshold}>
          <Text style={[text.footnote, { color: colors.ink }]}>Căn cứ ngưỡng tuân thủ phường đã cấu hình (số vi phạm / phạt quá hạn)</Text>
        </Checkbox>
      </Panel>
    </Screen>
  );
}

const WITNESS_ROLES = [
  { key: 'WITNESS', label: 'Người chứng kiến' },
  { key: 'WARD_REPRESENTATIVE', label: 'Đại diện chính quyền' },
] as const;

const positiveParam = (value: string | undefined) => {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : undefined;
};

/**
 * W12 Lập biên bản vi phạm, bước 1 (WARD-12, Mẫu 01 NĐ 118/2021): who, what, a scene photo,
 * witnesses. v5: the two steps of the record shown up front; the household as one large row;
 * each violation type as a choice card with its fine in sign figures and its legal basis.
 * WARD-19: opened from a citizen report (`sourceReportId`), the household, slot, description,
 * photo and the rule-based suggested type come from the report; saving the record closes the
 * report in the same transaction on the server. The officer still checks and decides every field.
 */
export function RecordViolationScreen() {
  const params = useLocalSearchParams<{ contractId?: string; slotId?: string; vendorId?: string; sourceReportId?: string }>();
  const cache = useQueryClient();
  const sourceId = positiveParam(params.sourceReportId);
  const source = useQuery({ queryKey: wardReportKeys.detail(sourceId ?? 0), queryFn: () => wardReportsApi.get(sourceId!), enabled: Boolean(sourceId) });
  const report = source.data;
  const fixedVendor = params.vendorId ? Number(params.vendorId) : (report?.vendorId ?? undefined);
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
    enabled: !fixedVendor && (!sourceId || source.isFetched),
  });
  const schedules = useQuery({ queryKey: ['ward', 'penalty-schedules', 'today'], queryFn: () => complianceApi.listPenaltySchedules() });
  const [pickedVendor, setVendorId] = useState<number | undefined>();
  const vendorId = fixedVendor ?? pickedVendor;
  const [vendorSheet, setVendorSheet] = useState(false);
  const [typeCode, setTypeCode] = useState<string | null>(null);
  // Untouched (null), the description is the report's own account; once typed in, the officer's.
  const [typedDescription, setDescription] = useState<string | null>(null);
  const description = typedDescription ?? (report ? violationDescriptionFromReport(report) : '');
  const [photo, setPhoto] = useState<PickedFile | null>(null);
  const [containment, setContainment] = useState('');
  const [witness, setWitness] = useState({ name: '', role: 'WITNESS' as (typeof WITNESS_ROLES)[number]['key'], occupation: '', address: '' });
  const [explanationRequired, setExplanationRequired] = useState(false);
  const [explanationMethod, setExplanationMethod] = useState<'DIRECT' | 'WRITTEN'>('WRITTEN');
  const types = schedules.data ?? [];
  // The report's suggested type (rule-based, not AI) leads only when this ward can record it.
  const suggested = report?.suggestedViolationType;
  const suggestedAvailable = suggested ? (types.length ? types.some((t) => t.violationType === suggested) : suggested in violationTypeLabels) : false;
  const chosenType = typeCode ?? (suggestedAvailable ? suggested! : undefined) ?? types[0]?.violationType ?? 'UNAUTHORIZED_BUSINESS_USE';
  const schedule = types.find((s) => s.violationType === chosenType);
  const vendorName = report?.vendorName && report.vendorId === fixedVendor ? report.vendorName : fixedVendor ? `Mã hộ ${fixedVendor}` : vendors.data?.find((v) => v.vendorId === vendorId)?.displayName;
  const slotId = params.slotId ? Number(params.slotId) : (report?.slotId ?? undefined);

  const submit = useMutation({
    mutationFn: async () => {
      const evidence = photo ? await complianceApi.uploadEvidence(photo) : undefined;
      return complianceApi.recordViolation({
        contractId: params.contractId ? Number(params.contractId) : undefined,
        slotId,
        vendorId,
        violationType: chosenType,
        description: description.trim(),
        // A new scene photo replaces the reporter's; otherwise the report's own photo is the evidence.
        evidenceUrl: evidence?.fileUrl ?? report?.evidenceUrl ?? undefined,
        sourceReportId: sourceId,
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
      showToast(sourceId ? `Đã lập biên bản và đóng phản ánh #${sourceId}` : 'Đã lập biên bản (bước 1/2)');
      if (sourceId) void cache.invalidateQueries({ queryKey: wardReportKeys.all });
      router.replace(`/ward/patrol/violations/${v.violationId}` as Href);
    },
    onError: (e) => {
      showToast(errorMessage(e), 'error');
      // Another officer may have closed the report meanwhile: show where it stands now.
      if (sourceId) void source.refetch();
    },
  });
  const send = () => {
    if (!vendorId) return showToast('Chọn hộ kinh doanh vi phạm.', 'error');
    if (!description.trim()) return showToast('Mô tả hành vi tại hiện trường.', 'error');
    submit.mutate();
  };

  // From a report: wait for it, and never raise a second record from a closed one.
  if (sourceId && (source.isPending || source.isError || (report && report.status !== 'PENDING'))) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Lập biên bản vi phạm' }} />
        {source.isPending ? (
          <ListSkeleton rows={3} height={84} />
        ) : source.isError ? (
          <ErrorState error={source.error} onRetry={() => void source.refetch()} />
        ) : (
          <StateView
            icon={{ sf: 'checkmark.seal', md: 'verified' }}
            tone="neutral"
            title="Phản ánh đã được xử lý"
            body={report?.violationId ? 'Phản ánh này đã có biên bản. Mỗi phản ánh chỉ lập được một biên bản.' : 'Phản ánh này đã được đóng, nên không lập biên bản từ đó được nữa.'}
            action={report?.violationId ? { label: 'Xem biên bản', onPress: () => router.replace(`/ward/patrol/violations/${report.violationId}` as Href) } : { label: 'Quay lại', onPress: () => router.back() }}
          />
        )}
      </Screen>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Screen footer={<Button label="Lập biên bản (bước 1)" variant="sign" size={56} icon={{ sf: 'doc.badge.plus', md: 'note_add' }} loading={submit.isPending} onPress={send} />}>
        <Stack.Screen options={{ title: 'Lập biên bản vi phạm' }} />
        <StepProgress step={1} total={2} title="Biên bản tại hiện trường" hint="Bước 2: quyết định xử phạt, do người có thẩm quyền ký." />
        {report ? (
          <Banner tone="info" title={`Lập từ phản ánh #${report.reportId} của người dân`}>
            Đã điền sẵn người bán, ô, mô tả, ảnh và loại vi phạm gợi ý theo phản ánh; bạn kiểm tra và sửa nếu cần. Khi lưu, phản ánh được đóng là “Đã lập biên bản” trong cùng một lần lưu và người phản ánh nhận thông báo.
          </Banner>
        ) : null}

        <Heading title="Hộ kinh doanh vi phạm" />
        <Pressable
          disabled={!!fixedVendor}
          onPress={() => setVendorSheet(true)}
          accessibilityRole="button"
          accessibilityLabel={vendorName ? `Hộ kinh doanh vi phạm: ${vendorName}` : 'Chọn hộ kinh doanh vi phạm'}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 76, paddingHorizontal: 16, paddingVertical: 12, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: pressed ? colors.signTint : vendorId ? colors.card : colors.mangoTint, borderWidth: vendorId ? 0 : 2, borderStyle: 'dashed', borderColor: colors.mango, boxShadow: vendorId ? shadow.card : undefined })}
        >
          <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: vendorId ? colors.signTint : colors.white, alignItems: 'center', justifyContent: 'center' }}>
            <Icon sf="person.crop.square.fill" md="badge" size={23} color={vendorId ? colors.sign : colors.onMango} />
          </View>
          <Text style={{ flex: 1, fontFamily: fonts.heavy, fontSize: 16.5, lineHeight: 22, color: vendorId ? colors.ink : colors.onMango }}>{vendorName ?? 'Chọn hộ kinh doanh'}</Text>
          {!fixedVendor ? <Icon sf="chevron.down" md="expand_more" size={15} color={colors.muted} /> : null}
        </Pressable>

        <Heading title="Hành vi vi phạm" />
        {schedules.isPending ? (
          <ListSkeleton rows={2} height={84} />
        ) : (
          <View style={{ gap: 10 }}>
            {(types.length ? types.map((t) => ({ code: t.violationType, name: t.violationTypeName, amount: t.penaltyAmount, basis: t.legalBasis })) : Object.entries(violationTypeLabels).map(([code, name]) => ({ code, name, amount: null as number | null, basis: null as string | null }))).map((t) => {
              const on = t.code === chosenType;
              return (
                <Pressable
                  key={t.code}
                  onPress={() => setTypeCode(t.code)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  style={({ pressed }) => ({ flexDirection: 'row', gap: 12, padding: 14, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: on ? colors.dangerTint : pressed ? colors.sunken : colors.card, borderWidth: 2, borderColor: on ? colors.danger : 'transparent', boxShadow: on ? undefined : shadow.card })}
                >
                  <View style={{ width: 24, height: 24, marginTop: 1, borderRadius: 12, borderWidth: 2, borderColor: on ? colors.danger : colors.line, backgroundColor: on ? colors.danger : colors.white, alignItems: 'center', justifyContent: 'center' }}>
                    {on ? <Icon sf="checkmark" md="check" size={13} color={colors.white} weight="bold" /> : null}
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 15.5, lineHeight: 21, color: colors.ink }}>{t.name}</Text>
                    {t.basis && t.amount != null ? <Text style={[sign.price, tabular, { color: on ? colors.onDanger : colors.primary }]}>{formatVnd(t.amount)}</Text> : null}
                    <Text style={[text.caption, { color: t.basis ? colors.muted : colors.onDanger }]}>{t.basis ? t.basis : 'Chưa có căn cứ: chỉ lập được biên bản'}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
        {schedule && !schedule.legalBasis ? <Banner tone="warning">Hành vi này chưa có căn cứ pháp lý trong Khung mức phạt: lập biên bản được, nhưng chưa ra quyết định phạt tiền.</Banner> : null}

        <Heading title="Hiện trường" />
        <TextField label="Mô tả hành vi tại hiện trường" value={description} onChangeText={setDescription} multiline placeholder="Thời gian, vị trí, diện tích lấn chiếm, tang vật" />
        {report?.evidenceUrl && !photo ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <ProtectedFileTile fileUrl={report.evidenceUrl} label="Ảnh từ phản ánh" />
            <Text style={[text.footnote, { flex: 1, color: colors.muted }]}>Ảnh người phản ánh gửi được đính kèm biên bản. Chụp ảnh mới bên dưới để thay.</Text>
          </View>
        ) : null}
        <Pressable
          onPress={async () => {
            const f = await picker.pick('Ảnh hiện trường', false);
            if (f) setPhoto(f);
          }}
          accessibilityRole="button"
          accessibilityLabel={photo ? 'Đổi ảnh tang vật / hiện trường' : 'Chụp ảnh tang vật / hiện trường'}
          style={({ pressed }) => ({ minHeight: photo ? 200 : 112, borderRadius: radius.photo, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: photo ? colors.sunken : pressed ? colors.brandTint : colors.kerbPaint, borderWidth: photo ? 0 : 2, borderStyle: 'dashed', borderColor: colors.brandLight, alignItems: 'center', justifyContent: 'center', gap: 6, padding: photo ? 0 : 16 })}
        >
          {photo ? (
            <>
              <Image source={{ uri: photo.uri }} style={{ width: '100%', height: 200 }} contentFit="cover" />
              <View style={{ position: 'absolute', right: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, minHeight: 34, borderRadius: radius.full, backgroundColor: 'rgba(17,28,43,0.72)' }}>
                <Icon sf="arrow.triangle.2.circlepath" md="sync" size={14} color={colors.white} />
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.white }}>Đổi ảnh</Text>
              </View>
            </>
          ) : (
            <>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }}>
                <Icon sf="camera.fill" md="photo_camera" size={22} color={colors.primary} />
              </View>
              <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.primary, textAlign: 'center' }}>Chụp ảnh tang vật / hiện trường</Text>
            </>
          )}
        </Pressable>
        <TextField label="Biện pháp ngăn chặn" optional value={containment} onChangeText={setContainment} multiline placeholder="VD: Yêu cầu thu dọn ngay" />

        <Heading title="Người chứng kiến" note="Khi người vi phạm không ký." />
        <Panel>
          <TextField label="Họ tên" optional value={witness.name} onChangeText={(v) => setWitness({ ...witness, name: v })} />
          {witness.name.trim() ? (
            <>
              <Segments value={witness.role} onChange={(v) => setWitness({ ...witness, role: v })} options={WITNESS_ROLES.map((r) => ({ key: r.key, label: r.label }))} />
              <TextField label="Nghề nghiệp" optional value={witness.occupation} onChangeText={(v) => setWitness({ ...witness, occupation: v })} />
              <TextField label="Địa chỉ" optional value={witness.address} onChangeText={(v) => setWitness({ ...witness, address: v })} />
            </>
          ) : null}
        </Panel>
        <Heading title="Giải trình" />
        <Panel>
          <Checkbox checked={explanationRequired} onChange={setExplanationRequired}>
            <Text style={[text.footnote, { color: colors.ink }]}>Người vi phạm yêu cầu giải trình (Điều 61 Luật XLVPHC)</Text>
          </Checkbox>
          {explanationRequired ? <Segments value={explanationMethod} onChange={setExplanationMethod} options={[{ key: 'WRITTEN', label: 'Bằng văn bản' }, { key: 'DIRECT', label: 'Trực tiếp' }]} /> : null}
        </Panel>
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

/** The colour of a record's edge by where it stands: waiting for a decision, owed, settled. */
const edgeOf = (status: string) => (status === 'PENDING_SANCTION' ? colors.danger : status === 'UNPAID' ? colors.mango : status === 'PAID' ? colors.leaf : colors.line);

/**
 * W13 Biên bản đã lập, v5: the records by stage (segmented), each a row with its slot plate,
 * household, violation in red words, when and by whom, the fine; its edge coloured by stage.
 */
export function ViolationsListScreen() {
  const [stage, setStage] = useState<ViolationStage>('OPEN');
  // The server filters by stage before paging, so each tab is a complete, newest-first page.
  const list = useQuery({ queryKey: ['ward', 'violations', stage], queryFn: () => complianceApi.listViolations(VIOLATION_STAGE_STATUSES[stage]) });
  const rows = list.data ?? [];
  return (
    <Screen onRefresh={() => void list.refetch()} refreshing={list.isRefetching} gap={14}>
      <Stack.Screen options={{ title: 'Biên bản vi phạm' }} />
      <Segments<ViolationStage>
        value={stage}
        onChange={setStage}
        options={[
          { key: 'OPEN', label: 'Chờ xử phạt' },
          { key: 'DECIDED', label: 'Đã quyết định' },
          { key: 'ALL', label: 'Tất cả' },
        ]}
      />
      {list.isPending ? (
        <ListSkeleton rows={4} height={96} />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : rows.length === 0 ? (
        <StateView icon={{ sf: 'checkmark.seal', md: 'verified' }} tone="neutral" title="Không có biên bản" body="Biên bản lập khi tuần tra sẽ hiện ở đây." action={{ label: 'Lập biên bản', onPress: () => go('/ward/patrol/violations/new') }} />
      ) : (
        <View style={{ borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.card, boxShadow: shadow.card }}>
          {rows.map((v, i) => {
            const s = statusLabel(v.status);
            return (
              <Pressable
                key={v.violationId}
                onPress={() => go(`/ward/patrol/violations/${v.violationId}`)}
                accessibilityRole="button"
                accessibilityLabel={`${v.vendorName ?? 'Hộ kinh doanh'}, ${v.violationTypeName}, ${s.label}`}
                style={({ pressed }) => ({ flexDirection: 'row', borderTopWidth: i ? 1 : 0, borderTopColor: colors.separator, backgroundColor: pressed ? colors.pressed : colors.card })}
              >
                <View style={{ width: 5, backgroundColor: edgeOf(v.status) }} />
                <View style={{ flex: 1, paddingHorizontal: 14, paddingVertical: 14, gap: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {v.slotCode ? <Plate code={v.slotCode} /> : null}
                    <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 15.5, lineHeight: 21, color: colors.ink }} numberOfLines={1}>{v.vendorName ?? 'Hộ kinh doanh'}</Text>
                    <Icon sf="chevron.right" md="chevron_right" size={13} color={colors.muted} />
                  </View>
                  <Text style={[text.callout, { fontFamily: fonts.semibold, color: colors.onDanger }]}>{v.violationTypeName}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <StatusPill label={s.label} tone={s.tone} />
                    {v.penaltyAmount != null ? <Text style={[sign.price, tabular, { color: colors.ink }]}>{formatVnd(v.penaltyAmount)}</Text> : null}
                  </View>
                  <Text style={[text.footnote, tabular, { color: colors.muted }]}>{`${formatVietnamDateTime(v.recordedAt)}, ${v.recordedByName}`}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

/**
 * W14 Biên bản & quyết định xử phạt (WARD-12/13): the record, the violator's explanation and the
 * handover, then the sanction — only for an officer with signing authority, using a rate in force
 * on the violation date, inside its legal bracket. The [AI] legal suggestion only advises.
 * v5: the record is a pass (number in sign figures, household, violation, details on the stub).
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
        <Skeleton height={300} radius={radius.pass} />
        <ListSkeleton rows={2} height={110} />
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
      <Pass
        accent={pending ? colors.danger : d.status === 'PAID' ? colors.leaf : colors.sticker}
        head={
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {d.slotCode ? <Plate code={d.slotCode} /> : null}
              <View style={{ flex: 1 }} />
              <StatusPill label={s.label} tone={s.tone} />
            </View>
            <View style={{ gap: 2 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.muted }}>Biên bản vi phạm hành chính</Text>
              <Text maxFontSizeMultiplier={1.3} adjustsFontSizeToFit numberOfLines={1} style={[sign.title, tabular, { color: colors.ink }]}>{d.bienBanSo ?? `#${d.violationId}`}</Text>
            </View>
            <Text style={{ fontFamily: fonts.heavy, fontSize: 19, lineHeight: 25, color: colors.ink }}>{d.vendorName ?? d.violatorFullName ?? 'Hộ kinh doanh'}</Text>
            <Text style={[text.callout, { fontFamily: fonts.semibold, color: colors.onDanger }]}>{d.violationTypeName}</Text>
            {d.description ? <Text style={[text.footnote, { color: colors.ink }]}>{d.description}</Text> : null}
          </View>
        }
        stub={
          <View style={{ gap: 12 }}>
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
          </View>
        }
      />

      {d.complianceFlag.violationThresholdReached || d.complianceFlag.hasOverduePenalty ? (
        <Banner tone="warning" title="Ngưỡng tuân thủ của phường (chỉ để tham khảo)">
          {[
            d.complianceFlag.violationThresholdReached ? `${d.complianceFlag.sanctionedViolationCount}/${d.complianceFlag.violationThreshold} vi phạm đã xử phạt` : null,
            d.complianceFlag.hasOverduePenalty ? `Có khoản phạt quá hạn ${d.complianceFlag.overduePenaltyDays ?? ''} ngày` : null,
          ].filter(Boolean).join('\n')}
        </Banner>
      ) : null}

      {d.explanationRequired ? (
        <>
          <Heading title="Giải trình (Điều 61)" />
          <Panel>
            {d.explanationReceivedAt ? (
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Icon sf="checkmark.circle.fill" md="check_circle" size={20} color={colors.leaf} />
                <Text style={[text.footnote, { flex: 1, color: colors.ink }]}>Đã nhận {formatVietnamDateTime(d.explanationReceivedAt)}: {d.explanationContent}</Text>
              </View>
            ) : (
              <>
                {explainDays != null ? (
                  <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 5, borderRadius: radius.full, backgroundColor: explainDays > 0 ? colors.mangoTint : colors.sunken }}>
                    <Icon sf="hourglass" md="hourglass_top" size={13} color={explainDays > 0 ? colors.onMango : colors.muted} />
                    <Text style={[{ fontFamily: fonts.bold, fontSize: 13, color: explainDays > 0 ? colors.onMango : colors.muted }, tabular]}>Hạn giải trình: {explainDays > 0 ? `còn ${explainDays} ngày` : 'đã hết hạn'}</Text>
                  </View>
                ) : null}
                <TextField label="Nội dung giải trình" value={explanation} onChangeText={setExplanation} multiline />
                <Button label="Ghi nhận giải trình" variant="secondary" loading={act.isPending && act.variables === 'explain'} disabled={!explanation.trim() || act.isPending} onPress={() => act.mutate('explain')} />
              </>
            )}
          </Panel>
        </>
      ) : null}

      <Heading title="Giao biên bản" />
      <Panel>
        {d.deliveredAt || d.deliveryRefused ? (
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Icon sf={d.deliveryRefused ? 'hand.raised.fill' : 'checkmark.circle.fill'} md={d.deliveryRefused ? 'back_hand' : 'check_circle'} size={20} color={d.deliveryRefused ? colors.onMango : colors.leaf} />
            <Text style={[text.footnote, { flex: 1, color: colors.ink }]}>{d.deliveryRefused ? `Người vi phạm từ chối nhận: ${d.deliveryRefusalReason}` : `Đã giao cho ${d.deliveredToName} lúc ${formatVietnamDateTime(d.deliveredAt!)}`}</Text>
          </View>
        ) : (
          <>
            <TextField label="Người nhận biên bản" value={deliveredTo} onChangeText={setDeliveredTo} />
            <Button label="Đã giao biên bản" variant="secondary" loading={act.isPending && act.variables === 'deliver'} disabled={!deliveredTo.trim() || act.isPending} onPress={() => act.mutate('deliver')} />
            <View style={{ height: 1, backgroundColor: colors.separator, marginVertical: 4 }} />
            <TextField label="Hoặc lý do từ chối nhận" value={refusal} onChangeText={setRefusal} />
            <Button label="Ghi nhận từ chối nhận" variant="secondary" loading={act.isPending && act.variables === 'refuse'} disabled={!refusal.trim() || act.isPending} onPress={() => act.mutate('refuse')} />
          </>
        )}
      </Panel>

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
        <>
          <Heading title="Quyết định xử phạt (bước 2)" />
          <Panel>
            {me.isPending ? (
              <Skeleton height={56} radius={radius.control} />
            ) : !authority ? (
              <Banner tone="neutral">Tài khoản của bạn chưa được giao thẩm quyền ký quyết định xử phạt. Chỉ Chủ tịch, Phó Chủ tịch UBND phường hoặc người được uỷ quyền bằng văn bản mới ký.</Banner>
            ) : (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Icon sf="signature" md="draw" size={16} color={colors.sign} />
                  <Text style={[text.footnote, { flex: 1, fontFamily: fonts.semibold, color: colors.sign }]}>Ký với tư cách: {authority}</Text>
                </View>
                {rates.isPending ? <ListSkeleton rows={1} height={64} /> : ownRates.length === 0 ? <Banner tone="warning">Hành vi này chưa có mức phạt có căn cứ pháp lý hiệu lực ngày {formatVietnamDate(d.recordedAt)}.</Banner> : null}
                {ownRates.map((r) => {
                  const on = r.scheduleId === chosen?.scheduleId;
                  return (
                    <Pressable key={r.scheduleId} onPress={() => setScheduleId(r.scheduleId)} accessibilityRole="radio" accessibilityState={{ selected: on }} style={({ pressed }) => ({ flexDirection: 'row', gap: 12, padding: 14, borderRadius: radius.control, borderCurve: 'continuous', backgroundColor: on ? colors.signTint : pressed ? colors.pressed : colors.sunken, borderWidth: 2, borderColor: on ? colors.sign : 'transparent' })}>
                      <View style={{ width: 22, height: 22, marginTop: 2, borderRadius: 11, borderWidth: 2, borderColor: on ? colors.sign : colors.line, backgroundColor: on ? colors.sign : colors.white, alignItems: 'center', justifyContent: 'center' }}>
                        {on ? <Icon sf="checkmark" md="check" size={12} color={colors.white} weight="bold" /> : null}
                      </View>
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={[sign.price, tabular, { color: colors.ink }]}>{formatVnd(r.penaltyAmount)}</Text>
                        <Text style={[text.caption, { color: colors.muted }]}>{r.legalBasis}</Text>
                      </View>
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
                <Button label="Ban hành quyết định" variant="sign" size={56} icon={{ sf: 'signature', md: 'draw' }} loading={act.isPending && act.variables === 'sanction'} disabled={act.isPending || ownRates.length === 0} onPress={sanction} />
              </>
            )}
          </Panel>
        </>
      ) : null}
    </Screen>
  );
}
