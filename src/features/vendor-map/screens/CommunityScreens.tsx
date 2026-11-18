import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/common/Avatar';
import { Card, KeyValueList } from '@/components/common/Blocks';
import { Button } from '@/components/common/Button';
import { Chip } from '@/components/common/Chip';
import { Icon } from '@/components/common/Icon';
import { Banner } from '@/components/feedback/Banner';
import { Skeleton } from '@/components/feedback/Skeleton';
import { ErrorState } from '@/components/feedback/States';
import { showToast } from '@/components/feedback/Toast';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { LeafletMap } from '@/components/map/LeafletMap';
import { errorMessage } from '@/core/api';
import { detectPosition } from '@/features/buyer-discovery/geolocation';
import { directionsUrl } from '@/features/buyer-discovery/discovery-format';
import { askToSignIn } from '@/features/cart/cart-api';
import { parsePermitQr } from '@/features/digital-permits/permit-qr-text';
import { useOnline } from '@/features/orders/components/order-display';
import { distanceLabel, haversineMeters } from '@/features/orders/pickup/pickup-range';
import { useAuthStore } from '@/store/auth-store';
import { colors, fonts, radius, shadow, sign, tabular, text } from '@/theme';
import { Pass, Plate, Section, Signboard, useLightStatusBar } from '@/ui';
import { formatVietnamDate, formatVietnamDateTime } from '@/utils/format';
import { communityApi, CommunityApiError, type PermitVerification, type VendorReportType } from '../community-api';
import { CityFeedbackLinks, ReportChoices, VerdictPriceBoard } from '../components/PriceBoardPanel';

const go = (href: string) => router.push(href as Href);
type Point = { latitude: number; longitude: number };

/** The dark of a camera that has not started yet (and around the permission prompt). */
const VIEWFINDER_BG = '#0E151F';

/** Where the buyer is, when the phone can say quickly; a check never waits on it. */
async function currentPoint(): Promise<Point | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([detectPosition(), new Promise<undefined>((r) => (timer = setTimeout(() => r(undefined), 7000)))]);
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * V-C08 Quét QR (BUY-01, BUY-06, BR-39), v5 (screens/v5/buyer-rest.md): the camera fills the top
 * of the screen under the status bar with sign lettering and orange corner brackets; a white sheet
 * rises over it with one sentence, the paste field and "Kiểm tra". It reads the bare permit token
 * and the link a printed price board carries (`…/q/<token>?v=N`). Every check is a fresh POST to
 * the server; the answer, price board included, lives only on this screen, never stored. The
 * verdict paints the top of the screen green or red with the time the ward's server answered.
 */
export function PublicScanScreen() {
  const insets = useSafeAreaInsets();
  useLightStatusBar();
  const online = useOnline();
  const [permission, requestPermission] = useCameraPermissions();
  const [code, setCode] = useState('');
  const [point, setPoint] = useState<Point>();
  const [checkedAt, setCheckedAt] = useState<number | null>(null);
  const last = useRef<{ value: string; at: number } | null>(null);
  const verify = useMutation({
    mutationFn: async (text: string) => {
      const scanned = parsePermitQr(text);
      const p = await currentPoint();
      setPoint(p);
      const answer = await communityApi.verifyPermit(scanned.token, p, scanned.printedVersion);
      return { answer, scanned };
    },
    onSuccess: ({ answer }) => {
      setCheckedAt(Date.now());
      void Haptics.notificationAsync(answer.isValid ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error);
    },
  });
  const result = verify.data?.answer;
  const scanned = verify.data?.scanned;
  const scanning = !result && !verify.isPending && online;
  const onScanned = ({ data }: { data: string }) => {
    const now = Date.now();
    if (!scanning || (last.current && last.current.value === data && now - last.current.at < 3000)) return;
    last.current = { value: data, at: now };
    setCode(data);
    verify.mutate(data);
  };
  const again = () => {
    verify.reset();
    setCode('');
    last.current = null;
  };

  if (result && scanned) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Stack.Screen options={{ headerShown: false }} />
        <ScrollView contentContainerStyle={{ paddingBottom: 40, gap: 18 }}>
          <Verdict result={result} token={scanned.token} printedVersion={scanned.printedVersion} point={point} checkedAt={checkedAt} onAgain={again} />
        </ScrollView>
      </View>
    );
  }

  const cameraHeight = 330 + insets.top;
  return (
    <View style={{ flex: 1, backgroundColor: VIEWFINDER_BG }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>
        {/* The viewfinder, full bleed */}
        <View style={{ height: cameraHeight, backgroundColor: VIEWFINDER_BG }}>
          {permission?.granted ? (
            <>
              <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={scanning ? onScanned : undefined} />
              {/* A scrim so the white lettering reads over any street scene */}
              <LinearGradient pointerEvents="none" colors={['rgba(14, 21, 31, 0.78)', 'rgba(14, 21, 31, 0)']} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: insets.top + 110 }} />
            </>
          ) : null}
          <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 44 }}>
            <Text accessibilityRole="header" accessibilityLabel="Quét giấy phép" maxFontSizeMultiplier={1.3} style={[sign.title, { color: colors.white }]}>
              QUÉT GIẤY PHÉP
            </Text>
            <View pointerEvents="box-none" style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              {permission?.granted ? (
                <Brackets busy={verify.isPending} />
              ) : !permission ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <View style={{ alignItems: 'center', gap: 12, paddingHorizontal: 12 }}>
                  <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon sf="camera.fill" md="photo_camera" size={30} color={colors.white} />
                  </View>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 15.5, lineHeight: 22, color: colors.white, textAlign: 'center' }}>
                    Cho phép dùng camera để quét mã giấy phép của quán.
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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, minHeight: 34, borderRadius: radius.full, backgroundColor: verify.isPending ? colors.sticker : 'rgba(17, 28, 43, 0.72)' }}>
                  {verify.isPending ? <ActivityIndicator size="small" color={colors.plate} /> : <Icon sf="qrcode.viewfinder" md="qr_code_scanner" size={16} color={colors.white} />}
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: verify.isPending ? colors.plate : colors.white }}>
                    {verify.isPending ? 'Đang hỏi máy chủ phường…' : 'Đưa mã QR giấy phép vào khung'}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
        </View>

        {/* The sheet that rises over the camera */}
        <View style={{ flexGrow: 1, marginTop: -26, borderTopLeftRadius: radius.pass, borderTopRightRadius: radius.pass, borderCurve: 'continuous', backgroundColor: colors.bg, padding: 20, paddingTop: 12, paddingBottom: 28, gap: 16 }}>
          <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.line }} />
          {!online ? <Banner tone="warning">Mất kết nối. Giấy phép luôn được kiểm tra trực tiếp với máy chủ phường, nên cần có mạng.</Banner> : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.leafTint, alignItems: 'center', justifyContent: 'center' }}>
              <Icon sf="checkmark.seal.fill" md="verified" size={22} color={colors.leaf} />
            </View>
            <Text style={[text.callout, { flex: 1, color: colors.ink }]}>Quét mã QR treo ở quầy để biết quán có được phường cấp phép bán ở ô này không.</Text>
          </View>
          {verify.isError ? <Banner tone="danger" action={{ label: 'Thử lại', onPress: again }}>{verify.error instanceof CommunityApiError ? verify.error.message : errorMessage(verify.error)}</Banner> : null}
          <TextField label="Hoặc dán mã giấy phép" value={code} onChangeText={(v) => setCode(v.slice(0, 1000))} autoCapitalize="none" autoCorrect={false} placeholder="SBP1.… hoặc đường link" hint="Nhận cả mã SBP1 và đường link dưới mã QR của bảng giá." icon={{ sf: 'number', md: 'tag' }} />
          <Button label="Kiểm tra" size={56} icon={{ sf: 'checkmark.shield', md: 'verified_user' }} loading={verify.isPending} disabled={!code.trim() || !online} onPress={() => verify.mutate(code.trim())} />
        </View>
      </ScrollView>
    </View>
  );
}

/** Four orange corner brackets around where the QR goes; mango while the server answers. */
function Brackets({ busy }: { busy: boolean }) {
  const c = busy ? colors.sticker : colors.brand;
  const arm = { position: 'absolute' as const, width: 46, height: 46, borderColor: c };
  return (
    <View style={{ width: 210, height: 210 }}>
      <View style={[arm, { left: 0, top: 0, borderLeftWidth: 6, borderTopWidth: 6, borderTopLeftRadius: radius.card }]} />
      <View style={[arm, { right: 0, top: 0, borderRightWidth: 6, borderTopWidth: 6, borderTopRightRadius: radius.card }]} />
      <View style={[arm, { left: 0, bottom: 0, borderLeftWidth: 6, borderBottomWidth: 6, borderBottomLeftRadius: radius.card }]} />
      <View style={[arm, { right: 0, bottom: 0, borderRightWidth: 6, borderBottomWidth: 6, borderBottomRightRadius: radius.card }]} />
    </View>
  );
}

/**
 * The server's answer, read at arm's length: the top of the screen painted in the verdict with
 * the word in sign lettering and when the ward's server answered; the stall's permit as a pass
 * across the sign's edge (vendor, slot plate, validity, distance); for a valid permit the price
 * board; then what the buyer can do, and the city's 1022 channel for those without an account.
 */
function Verdict({
  result,
  token,
  printedVersion,
  point,
  checkedAt,
  onAgain,
}: {
  result: PermitVerification;
  token: string;
  printedVersion: number | null;
  point?: Point;
  checkedAt: number | null;
  onAgain: () => void;
}) {
  const answered = checkedAt ? `Máy chủ phường trả lời lúc ${new Date(checkedAt).toLocaleTimeString('vi-VN')}` : undefined;
  if (!result.permitId) {
    return (
      <>
        <Signboard
          color={colors.danger}
          kerb={false}
          line2Color={colors.white}
          top={<VerdictSeal valid={false} icon={{ sf: 'questionmark.diamond.fill', md: 'help' }} />}
          line1="Không tìm thấy"
          line2="giấy phép"
          caption="Mã này không phải giấy phép StreetBiz hợp lệ. Hãy cẩn trọng với quầy này."
        >
          {answered ? <Text style={[text.caption, { marginTop: 8, color: colors.white }]}>{answered}</Text> : null}
        </Signboard>
        <View style={{ paddingHorizontal: 20, gap: 18 }}>
          <Button label="Quét mã khác" size={56} icon={{ sf: 'qrcode.viewfinder', md: 'qr_code_scanner' }} onPress={onAgain} />
          <CityFeedbackLinks />
        </View>
      </>
    );
  }
  const valid = result.isValid;
  const distance = point && result.latitude != null && result.longitude != null ? haversineMeters(point, { latitude: result.latitude, longitude: result.longitude }) : null;
  const rows = [
    result.validFrom && result.validUntil ? { label: 'Hiệu lực', value: `${formatVietnamDate(result.validFrom)} – ${formatVietnamDate(result.validUntil)}` } : null,
    distance != null ? { label: 'Bạn cách ô cấp phép', value: distanceLabel(distance) } : null,
  ];
  // The complaint form asks the server for the board again with this token (BR-39): nothing of
  // this answer is handed on but the ids and the token the server checks again.
  const reportAs = (type: VendorReportType) => {
    const board = valid ? `&qr=${encodeURIComponent(token)}${printedVersion ? `&v=${printedVersion}` : ''}` : '';
    go(`/customer/explore/vendors/${result.vendorId}/report?type=${type}&permitId=${result.permitId}&slotId=${result.slotId ?? ''}${board}`);
  };
  const report = result.vendorId ? () => reportAs('GENERAL') : null;
  return (
    <>
      <Signboard
        color={valid ? colors.leaf : colors.danger}
        kerb={false}
        line2Color={colors.white}
        top={<VerdictSeal valid={valid} />}
        line1={valid ? 'Giấy phép' : 'Không có'}
        line2={valid ? 'hợp lệ' : 'hiệu lực'}
        caption={answered}
        overlap={
          <Pass
            accent={valid ? colors.leaf : colors.danger}
            head={
              <View style={{ gap: 12 }}>
                <Text style={{ fontFamily: fonts.heavy, fontSize: 19, lineHeight: 25, color: colors.ink }}>{result.displayName ?? 'Hộ kinh doanh'}</Text>
                {result.slotCode ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Plate code={result.slotCode} />
                    <Text style={[text.footnote, { flex: 1, color: colors.muted }]}>Ô vỉa hè do phường cấp</Text>
                  </View>
                ) : null}
              </View>
            }
            stub={rows.some(Boolean) ? <KeyValueList rows={rows} /> : undefined}
          />
        }
      />
      <View style={{ paddingHorizontal: 20, gap: 12 }}>
        {distance != null && distance > 100 ? <Banner tone="warning">Quầy bạn đang đứng có thể không đúng ô được cấp phép.</Banner> : null}
        {/* Prices only under a valid permit (BUY-06); an invalid one shows no board at all. */}
        <VerdictPriceBoard result={result} printedVersion={printedVersion} />
        {/* A valid permit usually means buy or move on: scanning again leads. A failed one
            leads with telling the ward. Every way stays one tap away. */}
        {valid || !report ? <Button label="Quét mã khác" size={56} icon={{ sf: 'qrcode.viewfinder', md: 'qr_code_scanner' }} onPress={onAgain} /> : null}
        {!valid && report ? <Button label="Phản ánh tới Phường" size={56} icon={{ sf: 'exclamationmark.bubble', md: 'report' }} onPress={report} /> : null}
        {result.vendorId ? (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button label="Hồ sơ quán" variant="secondary" icon={{ sf: 'person.text.rectangle', md: 'badge' }} onPress={() => go(`/customer/explore/vendors/${result.vendorId}`)} style={{ flex: 1 }} />
            {!valid && report ? <Button label="Quét mã khác" variant="secondary" icon={{ sf: 'qrcode.viewfinder', md: 'qr_code_scanner' }} onPress={onAgain} style={{ flex: 1 }} /> : null}
          </View>
        ) : null}
      </View>
      <View style={{ paddingHorizontal: 20, gap: 18, marginTop: 6 }}>
        {valid && result.vendorId ? <ReportChoices onPick={reportAs} /> : null}
        <CityFeedbackLinks />
      </View>
    </>
  );
}

/** The verdict's white seal on the painted sign. */
function VerdictSeal({ valid, icon }: { valid: boolean; icon?: { sf: string; md: string } }) {
  const glyph = icon ?? (valid ? { sf: 'checkmark.seal.fill', md: 'verified' } : { sf: 'xmark.seal.fill', md: 'gpp_bad' });
  return (
    <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }}>
      <Icon sf={glyph.sf} md={glyph.md} size={32} color={valid ? colors.leaf : colors.danger} />
    </View>
  );
}

function useProfile(vendorId: string | undefined) {
  return useQuery({ queryKey: ['community', 'vendor', vendorId], queryFn: () => communityApi.profile(vendorId!), enabled: Boolean(vendorId) });
}

/**
 * Hồ sơ hộ kinh doanh (BUY-02), v5: the public permit as a pass (green band while it runs, red
 * when not) with the slot's plate, the community's two scores in sign figures, the slot on the
 * map with the way there, then reviews.
 */
export function VendorProfileScreen() {
  const { vendorId } = useLocalSearchParams<{ vendorId: string }>();
  const profile = useProfile(vendorId);
  if (profile.isPending) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Hộ kinh doanh' }} />
        <Skeleton height={220} radius={radius.pass} />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Skeleton height={112} radius={radius.card} style={{ flex: 1 }} />
          <Skeleton height={112} radius={radius.card} style={{ flex: 1 }} />
        </View>
        <Skeleton height={200} radius={radius.card} />
      </Screen>
    );
  }
  if (profile.isError || !profile.data) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Hộ kinh doanh' }} />
        <ErrorState error={profile.error ?? new Error('Không tìm thấy hộ kinh doanh.')} onRetry={() => void profile.refetch()} />
      </Screen>
    );
  }
  const v = profile.data;
  const valid = v.permitStatus === 'ACTIVE' || v.permitStatus === 'VALID';
  return (
    <Screen
      onRefresh={() => void profile.refetch()}
      refreshing={profile.isRefetching}
      gap={18}
      footer={
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button label="Viết đánh giá" size={56} icon={{ sf: 'star.fill', md: 'star' }} onPress={() => go(`/customer/explore/vendors/${v.vendorId}/comment`)} style={{ flex: 1.3 }} />
          <Button label="Phản ánh" variant="secondary" size={56} onPress={() => go(`/customer/explore/vendors/${v.vendorId}/report?slotId=${v.slotId}`)} style={{ flex: 1 }} />
        </View>
      }
    >
      <Stack.Screen options={{ title: v.displayName }} />
      {/* The permit as the buyer would see it hung at the stall */}
      <Pass
        accent={valid ? colors.leaf : colors.danger}
        head={
          <View style={{ gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <Avatar name={v.displayName} size={56} />
              <Text accessibilityRole="header" style={[text.title2, { flex: 1, color: colors.ink }]}>{v.displayName}</Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
              <Plate code={v.slotCode} style={{ minHeight: 32, paddingHorizontal: 11 }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radius.full, paddingHorizontal: 10, minHeight: 30, backgroundColor: valid ? colors.leafTint : colors.dangerTint }}>
                <Icon sf={valid ? 'checkmark.seal.fill' : 'xmark.seal.fill'} md={valid ? 'verified' : 'gpp_bad'} size={14} color={valid ? colors.leaf : colors.danger} />
                <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: valid ? colors.onLeaf : colors.onDanger }}>{valid ? `Có phép đến ${formatVietnamDate(v.permitEndDate)}` : 'Giấy phép không hiệu lực'}</Text>
              </View>
            </View>
          </View>
        }
        stub={
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Icon sf="mappin.and.ellipse" md="location_on" size={16} color={colors.primary} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[text.subhead, { color: colors.ink }]}>{v.zoneName}</Text>
              <Text style={[text.footnote, { color: colors.muted }]}>{[v.wardName, v.address].filter(Boolean).join(', ')}</Text>
            </View>
          </View>
        }
      />

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Score label="Cộng đồng" value={v.communityRating} count={v.communityCount} />
        <Score label="Đã mua tại quán" value={v.verifiedRating} count={v.verifiedCount} verified />
      </View>

      <View style={{ borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadow.card }}>
        <View style={{ borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, overflow: 'hidden' }}>
          <LeafletMap center={[v.latitude, v.longitude]} zoom={18} interactive={false} markers={[{ id: 'v', latitude: v.latitude, longitude: v.longitude, label: `Ô ${v.slotCode}`, fill: colors.cta, ink: colors.white }]} style={{ height: 150 }} />
        </View>
        <Pressable onPress={() => void Linking.openURL(directionsUrl(v.latitude, v.longitude))} accessibilityRole="link" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 14, borderBottomLeftRadius: radius.card, borderBottomRightRadius: radius.card, backgroundColor: pressed ? colors.pressed : colors.card })}>
          <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
            <Icon sf="arrow.triangle.turn.up.right.diamond.fill" md="directions" size={18} color={colors.white} />
          </View>
          <Text style={{ flex: 1, fontFamily: fonts.heavy, fontSize: 15, color: colors.ink }}>Chỉ đường đến ô {v.slotCode}</Text>
          <Icon sf="chevron.right" md="chevron_right" size={14} color={colors.muted} />
        </Pressable>
      </View>

      <Section title="Đánh giá" note={v.comments.length ? `${v.comments.length} đánh giá` : undefined} inset={4}>
        {v.comments.length === 0 ? (
          <View style={{ alignItems: 'center', gap: 6, padding: 20, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.line }}>
            <Icon sf="star.bubble" md="reviews" size={24} color={colors.mango} />
            <Text style={[text.callout, { color: colors.muted, textAlign: 'center' }]}>Chưa có đánh giá. Bạn là người đầu tiên?</Text>
          </View>
        ) : (
          <View style={{ borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, overflow: 'hidden' }}>
            {v.comments.map((c, i) => (
              <View key={c.commentId} style={{ flexDirection: 'row', gap: 12, padding: 14, borderTopWidth: i ? 1 : 0, borderTopColor: colors.separator }}>
                <Avatar name={c.authorName} size={38} />
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <Text numberOfLines={1} style={[text.subhead, { flexShrink: 1, color: colors.ink, fontFamily: fonts.bold }]}>{c.authorName}</Text>
                    {c.rating ? (
                      <View style={{ flexDirection: 'row', gap: 1 }} accessibilityLabel={`${c.rating} sao`}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Icon key={n} sf={n <= c.rating! ? 'star.fill' : 'star'} md="star" size={13} color={n <= c.rating! ? colors.mango : colors.line} />
                        ))}
                      </View>
                    ) : null}
                  </View>
                  {c.commentText ? <Text style={[text.callout, { color: colors.ink }]}>{c.commentText}</Text> : null}
                  <Text style={[text.caption, { color: colors.muted }]}>{formatVietnamDateTime(c.createdAt)}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </Section>
    </Screen>
  );
}

/** A community score in sign figures, with how many people stand behind it. */
function Score({ label, value, count, verified }: { label: string; value: number | null; count: number; verified?: boolean }) {
  return (
    <View style={{ flex: 1, padding: 16, gap: 2, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadow.card }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Icon sf={verified ? 'checkmark.circle.fill' : 'star.fill'} md={verified ? 'check_circle' : 'star'} size={13} color={verified ? colors.leaf : colors.mango} />
        <Text style={[text.caption, { flexShrink: 1, color: colors.muted }]}>{label}</Text>
      </View>
      <Text maxFontSizeMultiplier={1.3} style={[sign.figure, { color: value == null ? colors.muted : colors.ink }, tabular]}>{value == null ? '—' : value.toFixed(1).replace('.', ',')}</Text>
      <Text style={[text.caption, { color: colors.muted }]}>{count > 0 ? `${count} lượt` : 'Chưa có'}</Text>
    </View>
  );
}

const PROMPTS = ['Món ngon', 'Bán đúng ô', 'Sạch sẽ', 'Giá hợp lý', 'Phục vụ nhanh'];
const appendPhrase = (current: string, phrase: string) => (current.trim() ? `${current.trim().replace(/[.,]$/, '')}, ${phrase.toLowerCase()}` : phrase);

/** Viết đánh giá quán (BUY-03): stars and a few words, with quick phrases to start from. */
export function VendorCommentScreen() {
  const { vendorId } = useLocalSearchParams<{ vendorId: string }>();
  const user = useAuthStore((s) => s.user);
  const cache = useQueryClient();
  const profile = useProfile(vendorId);
  const [rating, setRating] = useState(5);
  const [note, setNote] = useState('');
  const save = useMutation({
    mutationFn: () => communityApi.comment(vendorId!, rating, note.trim()),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ['community', 'vendor', vendorId] });
      showToast('Đã lưu đánh giá');
      router.back();
    },
  });
  const send = () => {
    if (user?.role_code !== 'CUSTOMER') return askToSignIn('Đăng nhập bằng tài khoản người mua để đánh giá quán.');
    save.mutate();
  };
  return (
    <Screen gap={18} footer={<Button label="Gửi đánh giá" size={56} loading={save.isPending} disabled={!note.trim()} onPress={send} />}>
      <Stack.Screen options={{ title: 'Viết đánh giá' }} />
      {profile.data ? (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Avatar name={profile.data.displayName} size={44} />
          <Text style={[text.headline, { flex: 1, color: colors.ink }]}>{profile.data.displayName}</Text>
          <Plate code={profile.data.slotCode} />
        </Card>
      ) : null}
      <Text accessibilityRole="header" style={[text.title2, { color: colors.ink, textAlign: 'center' }]}>Bạn thấy quán thế nào?</Text>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => setRating(n)} hitSlop={4} accessibilityRole="button" accessibilityLabel={`${n} sao`} accessibilityState={{ selected: n === rating }}>
            <Icon sf={n <= rating ? 'star.fill' : 'star'} md="star" size={46} color={n <= rating ? colors.mango : colors.line} />
          </Pressable>
        ))}
      </View>
      <View style={{ gap: 8 }}>
        <Text style={[text.subhead, { color: colors.muted }]}>Chạm để thêm vào nhận xét</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {PROMPTS.map((p) => (
            <Chip key={p} label={p} icon={{ sf: 'plus', md: 'add' }} onPress={() => setNote((t) => appendPhrase(t, p).slice(0, 1000))} />
          ))}
        </View>
      </View>
      <TextField label="Nhận xét" value={note} onChangeText={(v) => setNote(v.slice(0, 1000))} multiline placeholder="Chia sẻ trải nghiệm của bạn" hint={`${note.length}/1000 ký tự`} error={save.isError ? (save.error instanceof CommunityApiError ? save.error.message : errorMessage(save.error)) : undefined} />
    </Screen>
  );
}
