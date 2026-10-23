import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { useMutation, useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { Card, KeyValueList } from '@/components/common/Blocks';
import { Button } from '@/components/common/Button';
import { Chip } from '@/components/common/Chip';
import { Icon } from '@/components/common/Icon';
import { Sheet } from '@/components/common/Sheet';
import { SheetOption } from '@/components/common/SheetOption';
import { Banner } from '@/components/feedback/Banner';
import { Skeleton } from '@/components/feedback/Skeleton';
import { showToast } from '@/components/feedback/Toast';
import { useFilePicker } from '@/components/forms/FileSourceSheet';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { errorMessage } from '@/core/api';
import type { PickedFile } from '@/core/api/upload';
import { askToSignIn } from '@/features/cart/cart-api';
import { communityApi, CommunityApiError, type PriceBoardItem, type VendorReportRequest, type VendorReportType } from '@/features/vendor-map/community-api';
import { useAuthStore } from '@/store/auth-store';
import { colors, fonts, radius, shadow, sign, tabular, text } from '@/theme';
import { Plate } from '@/ui';
import { formatVietnamDateTime, formatVnd } from '@/utils/format';
import {
  appendPhrase,
  isReportType,
  MAX_AMOUNT,
  MAX_QUANTITY,
  NOTE_MAX,
  nowMoment,
  overchargeMath,
  purchaseDays,
  purchaseIso,
  purchaseProblem,
  REPORT_CHOICES,
  timeOfDay,
  wholeNumber,
  type PurchaseMoment,
} from '../report-view';

const GENERAL_ISSUES = ['Bán sai vị trí', 'Lấn chiếm lối đi', 'Không treo giấy phép', 'Giấy phép không khớp quầy', 'Mất vệ sinh'];
const positiveId = (value: string | undefined) => {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : undefined;
};

const PHOTO_LABEL: Record<VendorReportType, string> = {
  OVERCHARGE: 'Ảnh hóa đơn hoặc chứng từ thanh toán',
  PRICE_NOT_POSTED: 'Ảnh quầy',
  GENERAL: 'Ảnh hiện trường',
};

/**
 * Phản ánh tới Phường (BUY-05, BUY-07): what went wrong at the stall, sent to the officer of its
 * ward, who decides; nothing is automatic and the vendor never sees who sent it.
 * - "Bị tính cao hơn giá niêm yết": the dish from the stall's price board, how many, what was
 *   paid and when (default now, within 7 days). The posted amount and the difference show as the
 *   buyer types; when the amount paid is not above the posted price this type cannot be sent.
 *   The board is asked of the server again with the scanned token (BR-39), and the server judges
 *   the complaint at the price in force when the buyer paid, whatever this screen showed.
 * - "Quầy không treo bảng giá" and "Phản ánh khác": a few words, a photo if there is one.
 * A buyer account files it (so there is someone to send the result to); signing in comes back here.
 */
export function VendorReportScreen() {
  const params = useLocalSearchParams<{ vendorId: string; slotId?: string; permitId?: string; type?: string; qr?: string }>();
  const vendorId = params.vendorId;
  const user = useAuthStore((s) => s.user);
  const profile = useQuery({ queryKey: ['community', 'vendor', vendorId], queryFn: () => communityApi.profile(vendorId!), enabled: Boolean(vendorId) });
  const picker = useFilePicker();
  const [type, setType] = useState<VendorReportType>(isReportType(params.type) ? params.type : 'GENERAL');
  const [reason, setReason] = useState('');
  const [photo, setPhoto] = useState<PickedFile | null>(null);
  const [itemId, setItemId] = useState<number | null>(null);
  const [dishSheet, setDishSheet] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [charged, setCharged] = useState('');
  const [moment, setMoment] = useState<PurchaseMoment>(() => nowMoment());
  const [timeOpen, setTimeOpen] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  // The board for an overcharge: a fresh, live answer for this screen only, dropped when it closes.
  const board = useQuery({
    queryKey: ['community', 'report-board', params.qr],
    queryFn: () => communityApi.verifyPermit(params.qr!),
    enabled: Boolean(params.qr) && type === 'OVERCHARGE',
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  const sameVendor = board.data?.vendorId != null && String(board.data.vendorId) === String(vendorId);
  const items: PriceBoardItem[] = board.data?.isValid && sameVendor ? (board.data.priceBoard?.items ?? []) : [];
  const item = items.find((i) => i.menuItemId === itemId);
  const chargedAmount = wholeNumber(charged);
  const math = overchargeMath(item?.unitPrice, quantity, chargedAmount);
  const timeProblem = purchaseProblem(moment);

  const ready =
    type === 'GENERAL' ? reason.trim().length > 0 : type === 'PRICE_NOT_POSTED' ? true : Boolean(item) && chargedAmount != null && chargedAmount > 0 && math.above && !timeProblem;
  // The one hard stop: an "overcharge" whose amount is not above the posted price is not sent.
  const blocked = type === 'OVERCHARGE' && item != null && chargedAmount != null && !math.above;

  const submit = useMutation({
    mutationFn: async () => {
      const evidence = photo ? await communityApi.uploadEvidence(photo) : undefined;
      const base = { evidenceUrl: evidence?.fileUrl, slotId: positiveId(params.slotId), scannedPermitId: positiveId(params.permitId) };
      const note = reason.trim() || undefined;
      const request: VendorReportRequest =
        type === 'OVERCHARGE'
          ? { ...base, reportType: type, reason: note, menuItemId: item!.menuItemId, quantity, chargedAmount: chargedAmount!, purchasedAt: purchaseIso(moment) }
          : { ...base, reportType: type, reason: note };
      return communityApi.report(vendorId!, request);
    },
    onSuccess: (receipt) => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast(receipt.dueAt ? `Đã gửi phản ánh #${receipt.reportId}. Hạn xử lý ${formatVietnamDateTime(receipt.dueAt)}` : `Đã gửi phản ánh #${receipt.reportId} tới Phường`);
      router.back();
    },
  });
  const send = () => {
    if (user?.role_code !== 'CUSTOMER') return askToSignIn('Đăng nhập bằng tài khoản người mua để gửi phản ánh. Xong bạn quay lại đúng trang này.', true);
    setShowErrors(true);
    if (ready && !blocked) submit.mutate();
  };
  const failure = submit.error instanceof CommunityApiError ? submit.error : null;

  return (
    <View style={{ flex: 1 }}>
      <Screen gap={18} footer={<Button label="Gửi phản ánh" size={56} icon={{ sf: 'paperplane.fill', md: 'send' }} loading={submit.isPending} disabled={blocked} onPress={send} />}>
        <Stack.Screen options={{ title: 'Phản ánh tới Phường' }} />
        {/* Addressed like an envelope: to the ward officer, about this slot */}
        <Card style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
              <Icon sf="building.columns.fill" md="account_balance" size={17} color={colors.primary} />
            </View>
            <Text style={[text.subhead, { flex: 1, color: colors.muted }]}>Gửi: Cán bộ phường quản lý vỉa hè</Text>
          </View>
          <View style={{ height: 1, backgroundColor: colors.separator }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={[text.headline, { flex: 1, color: colors.ink }]}>{profile.data?.displayName ?? 'Hộ kinh doanh'}</Text>
            {profile.data ? <Plate code={profile.data.slotCode} /> : null}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon sf="eye.slash.fill" md="visibility_off" size={13} color={colors.muted} />
            <Text style={[text.caption, { flex: 1, color: colors.muted }]}>Người bán không thấy tên, số điện thoại hay ảnh của bạn.</Text>
          </View>
        </Card>

        {/* What happened: one choice */}
        <View style={{ gap: 10 }}>
          <Text accessibilityRole="header" style={{ fontFamily: fonts.heavy, fontSize: 17, color: colors.ink }}>Bạn muốn phản ánh gì?</Text>
          <View accessibilityRole="radiogroup" style={{ borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.card, boxShadow: shadow.card }}>
            {REPORT_CHOICES.map((c, i) => {
              const on = c.type === type;
              return (
                <Pressable
                  key={c.type}
                  onPress={() => setType(c.type)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${c.label}. ${c.note}`}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: on ? colors.kerbPaint : pressed ? colors.pressed : colors.card, borderTopWidth: i ? 1 : 0, borderTopColor: colors.separator })}
                >
                  <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: on ? colors.cta : colors.line, backgroundColor: on ? colors.cta : colors.white, alignItems: 'center', justifyContent: 'center' }}>
                    {on ? <Icon sf="checkmark" md="check" size={13} color={colors.white} weight="bold" /> : null}
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ fontFamily: on ? fonts.heavy : fonts.bold, fontSize: 15.5, lineHeight: 21, color: colors.ink }}>{c.label}</Text>
                    <Text style={[text.footnote, { color: colors.muted }]}>{c.note}</Text>
                  </View>
                  <Icon sf={c.icon.sf} md={c.icon.md} size={18} color={on ? colors.primary : colors.muted} />
                </Pressable>
              );
            })}
          </View>
        </View>

        {type === 'OVERCHARGE' ? (
          <OverchargeFields
            hasBoard={Boolean(params.qr)}
            loading={board.isLoading}
            failed={board.isError ? errorMessage(board.error) : null}
            onRetry={() => void board.refetch()}
            boardReadable={Boolean(board.data?.isValid && sameVendor && board.data.priceBoard)}
            version={board.data?.priceBoard?.version ?? null}
            items={items}
            item={item}
            onOpenDishes={() => setDishSheet(true)}
            quantity={quantity}
            onQuantity={setQuantity}
            charged={charged}
            onCharged={setCharged}
            moment={moment}
            onMoment={setMoment}
            onOpenTime={() => setTimeOpen(true)}
            timeProblem={timeProblem}
            math={math}
            chargedAmount={chargedAmount}
            showErrors={showErrors}
            onOther={() => setType('GENERAL')}
          />
        ) : null}

        {type === 'GENERAL' ? (
          <View style={{ gap: 10 }}>
            <Text style={{ fontFamily: fonts.heavy, fontSize: 17, color: colors.ink }}>Vấn đề bạn thấy</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {GENERAL_ISSUES.map((v) => (
                <Chip key={v} label={v} selected={reason.includes(v)} onPress={() => setReason((r) => (r.includes(v) ? r : appendPhrase(r, v)).slice(0, NOTE_MAX))} />
              ))}
            </View>
          </View>
        ) : null}
        <TextField
          label={type === 'GENERAL' ? 'Mô tả' : 'Ghi chú'}
          optional={type !== 'GENERAL'}
          value={reason}
          onChangeText={(v) => setReason(v.slice(0, NOTE_MAX))}
          multiline
          placeholder={type === 'GENERAL' ? 'Ở đâu, lúc nào, chuyện gì' : type === 'OVERCHARGE' ? 'VD: Quầy nói giá khác giá trên bảng' : 'VD: Hỏi giá thì người bán chỉ nói miệng'}
          hint={`${reason.length}/${NOTE_MAX} ký tự`}
          error={showErrors && type === 'GENERAL' && !reason.trim() ? 'Mô tả điều bạn thấy.' : undefined}
        />
        <Pressable
          onPress={async () => {
            const f = await picker.pick(PHOTO_LABEL[type], false);
            if (f) setPhoto(f);
          }}
          accessibilityRole="button"
          accessibilityLabel={photo ? `Đổi ${PHOTO_LABEL[type].toLowerCase()}` : `Thêm ${PHOTO_LABEL[type].toLowerCase()}, không bắt buộc`}
          style={({ pressed }) => ({ minHeight: photo ? 180 : 96, borderRadius: radius.photo, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: photo ? colors.card : pressed ? colors.brandTint : colors.kerbPaint, borderWidth: photo ? 0 : 2, borderStyle: 'dashed', borderColor: colors.brandLight, alignItems: 'center', justifyContent: 'center', gap: 6, padding: photo ? 0 : 14 })}
        >
          {photo ? (
            <Image source={{ uri: photo.uri }} style={{ width: '100%', height: 180 }} contentFit="cover" />
          ) : (
            <>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }}>
                <Icon sf={type === 'OVERCHARGE' ? 'doc.text.image' : 'camera.fill'} md={type === 'OVERCHARGE' ? 'receipt_long' : 'photo_camera'} size={20} color={colors.primary} />
              </View>
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.primary, textAlign: 'center' }}>{`${PHOTO_LABEL[type]} (không bắt buộc)`}</Text>
              <Text style={[text.caption, { color: colors.muted, textAlign: 'center' }]}>Chỉ cán bộ phường xem ảnh này.</Text>
            </>
          )}
        </Pressable>
        {failure?.status === 409 ? (
          <Banner tone="warning" title="Bạn đã có phản ánh đang chờ về quầy này" action={{ label: 'Xem phản ánh của tôi', onPress: () => router.navigate('/customer/account/reports' as Href) }}>
            {failure.message}
          </Banner>
        ) : submit.isError ? (
          <Banner tone="danger">{failure ? failure.message : errorMessage(submit.error)}</Banner>
        ) : null}
        <Banner tone="neutral" title="Sau khi gửi">
          Cán bộ phường xem phản ánh và tự quyết định cách xử lý, thường trong 7 ngày làm việc (hạn nội bộ của phường). Bạn nhận thông báo khi có kết quả và xem lại trong “Phản ánh của tôi”.
        </Banner>
      </Screen>

      <Sheet visible={dishSheet} onClose={() => setDishSheet(false)} title="Món bạn đã mua" subtitle={board.data?.priceBoard ? `Bảng giá bản số ${board.data.priceBoard.version}` : undefined}>
        {items.map((i, n) => (
          <SheetOption
            key={i.menuItemId}
            title={i.name}
            subtitle={`${formatVnd(i.unitPrice)} / ${i.priceUnit}${i.nameEn ? ` · ${i.nameEn}` : ''}`}
            selected={i.menuItemId === itemId}
            last={n === items.length - 1}
            onPress={() => {
              setItemId(i.menuItemId);
              setDishSheet(false);
            }}
          />
        ))}
      </Sheet>
      {timeOpen && Platform.OS === 'android' ? (
        <DateTimePicker
          value={new Date(2000, 0, 1, moment.hour, moment.minute)}
          mode="time"
          presentation="dialog"
          is24Hour
          accentColor={colors.cta}
          positiveButton={{ label: 'Chọn' }}
          negativeButton={{ label: 'Huỷ' }}
          onValueChange={(_, d) => {
            setTimeOpen(false);
            setMoment((m) => ({ ...m, hour: d.getHours(), minute: d.getMinutes() }));
          }}
          onDismiss={() => setTimeOpen(false)}
        />
      ) : null}
      {picker.sheet}
    </View>
  );
}

/** The overcharge part of the form: dish, quantity, amount paid, when, and the live comparison. */
function OverchargeFields(props: {
  hasBoard: boolean;
  loading: boolean;
  failed: string | null;
  onRetry: () => void;
  boardReadable: boolean;
  version: number | null;
  items: PriceBoardItem[];
  item: PriceBoardItem | undefined;
  onOpenDishes: () => void;
  quantity: number;
  onQuantity: (n: number) => void;
  charged: string;
  onCharged: (v: string) => void;
  moment: PurchaseMoment;
  onMoment: (m: PurchaseMoment) => void;
  onOpenTime: () => void;
  timeProblem: string | null;
  math: ReturnType<typeof overchargeMath>;
  chargedAmount: number | null;
  showErrors: boolean;
  onOther: () => void;
}) {
  const { item, math, quantity } = props;
  if (!props.hasBoard) {
    return (
      <Banner tone="info" title="Cần bảng giá của quầy" action={{ label: 'Quét mã QR', onPress: () => router.navigate('/customer/scan' as Href) }}>
        Quét mã QR treo ở quầy để mở bảng giá, rồi chọn món bạn đã mua.
      </Banner>
    );
  }
  if (props.loading) return <Skeleton height={180} radius={radius.card} />;
  if (props.failed) return <Banner tone="danger" action={{ label: 'Thử lại', onPress: props.onRetry }}>{props.failed}</Banner>;
  if (!props.boardReadable || props.items.length === 0) {
    return (
      <Banner tone="warning" title="Chưa đối chiếu được giá" action={{ label: 'Phản ánh khác', onPress: props.onOther }}>
        Quầy chưa có món nào trên bảng giá StreetBiz, hoặc giấy phép không còn hiệu lực. Bạn vẫn có thể gửi “Quầy không treo bảng giá” hoặc “Phản ánh khác”.
      </Banner>
    );
  }
  const days = purchaseDays();
  return (
    <View style={{ gap: 16 }}>
      {/* The dish, from the board */}
      <View style={{ gap: 6 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.ink }}>Món đã mua</Text>
        <Pressable
          onPress={props.onOpenDishes}
          accessibilityRole="button"
          accessibilityLabel={item ? `Món đã mua: ${item.name}, ${formatVnd(item.unitPrice)} một ${item.priceUnit}. Đổi món` : 'Chọn món đã mua'}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.control, borderCurve: 'continuous', backgroundColor: pressed ? colors.pressed : item ? colors.card : colors.sunken, borderWidth: 1.5, borderColor: props.showErrors && !item ? colors.danger : item ? colors.line : 'transparent' })}
        >
          <Icon sf="fork.knife" md="restaurant" size={18} color={item ? colors.primary : colors.muted} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 15.5, color: item ? colors.ink : colors.muted }}>{item ? item.name : 'Chọn món trên bảng giá'}</Text>
            {item ? <Text style={[text.footnote, tabular, { color: colors.muted }]}>{`${formatVnd(item.unitPrice)} / ${item.priceUnit}`}</Text> : null}
          </View>
          <Icon sf="chevron.down" md="expand_more" size={15} color={colors.muted} />
        </Pressable>
        {props.showErrors && !item ? <Text style={[text.footnote, { color: colors.onDanger }]}>Chọn món bạn đã mua.</Text> : null}
      </View>

      {/* How many */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.ink }}>Số lượng</Text>
          {item ? <Text style={[text.footnote, { color: colors.muted }]}>{`Tính theo ${item.priceUnit}`}</Text> : null}
        </View>
        <Stepper value={quantity} min={1} max={MAX_QUANTITY} onChange={props.onQuantity} unit={item?.priceUnit} />
      </View>

      <TextField
        label="Số tiền bạn đã trả"
        value={props.charged}
        onChangeText={(v) => props.onCharged(v.replace(/[^0-9]/g, '').slice(0, String(MAX_AMOUNT).length))}
        keyboardType="number-pad"
        trailing={<Text style={{ fontFamily: fonts.semibold, color: colors.muted }}>đ</Text>}
        hint={props.chargedAmount ? formatVnd(props.chargedAmount) : 'Tổng số tiền cho món này, đúng như quầy tính'}
        error={props.showErrors && !props.chargedAmount ? 'Nhập số tiền bạn đã trả.' : undefined}
      />

      {/* When: a day of the last week and a time, on the Vietnamese clock */}
      <View style={{ gap: 8 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.ink }}>Lúc mua</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }} style={{ marginHorizontal: -4 }}>
          {days.map((d) => (
            <Chip key={d.daysAgo} label={d.label} selected={d.daysAgo === props.moment.daysAgo} accessibilityRole="radio" onPress={() => props.onMoment({ ...props.moment, daysAgo: d.daysAgo })} />
          ))}
        </ScrollView>
        {Platform.OS === 'ios' ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingHorizontal: 14, borderRadius: radius.control, borderCurve: 'continuous', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line }}>
            <Icon sf="clock" md="schedule" size={18} color={colors.muted} />
            <Text style={[text.callout, { flex: 1, color: colors.ink }]}>Giờ mua</Text>
            <DateTimePicker
              value={new Date(2000, 0, 1, props.moment.hour, props.moment.minute)}
              mode="time"
              display="compact"
              locale="vi-VN"
              accentColor={colors.cta}
              onValueChange={(_, d) => props.onMoment({ ...props.moment, hour: d.getHours(), minute: d.getMinutes() })}
            />
          </View>
        ) : (
          <Pressable
            onPress={props.onOpenTime}
            accessibilityRole="button"
            accessibilityLabel={`Giờ mua: ${timeOfDay(props.moment)}. Đổi giờ`}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingHorizontal: 14, borderRadius: radius.control, borderCurve: 'continuous', backgroundColor: pressed ? colors.pressed : colors.card, borderWidth: 1, borderColor: props.timeProblem ? colors.danger : colors.line })}
          >
            <Icon sf="clock" md="schedule" size={18} color={colors.muted} />
            <Text style={[text.callout, { flex: 1, color: colors.ink }]}>Giờ mua</Text>
            <Text style={[sign.price, tabular, { color: colors.ink }]}>{timeOfDay(props.moment)}</Text>
          </Pressable>
        )}
        {props.timeProblem ? <Text style={[text.footnote, { color: colors.onDanger }]}>{props.timeProblem}</Text> : <Text style={[text.footnote, { color: colors.muted }]}>Giờ Việt Nam. Chỉ nhận lần mua trong 7 ngày gần nhất.</Text>}
      </View>

      {/* The comparison, live */}
      {item ? (
        <View style={{ padding: 16, gap: 4, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadow.card }}>
          <Text style={{ fontFamily: fonts.heavy, fontSize: 16, color: colors.ink }}>Đối chiếu với giá niêm yết</Text>
          <KeyValueList
            rows={[
              { label: 'Giá niêm yết', value: `${formatVnd(item.unitPrice)} × ${quantity} ${item.priceUnit}` },
              { label: 'Thành tiền niêm yết', value: math.posted != null ? formatVnd(math.posted) : '—' },
              { label: 'Bạn đã trả', value: props.chargedAmount != null ? formatVnd(props.chargedAmount) : '—' },
              math.difference != null
                ? {
                    label: 'Chênh lệch',
                    emphasis: true,
                    value: (
                      <Text accessibilityLabel={`Chênh lệch ${formatVnd(math.difference)}`} style={[sign.price, tabular, { color: math.above ? colors.danger : colors.onLeaf }]}>
                        {`${math.difference > 0 ? '+' : ''}${formatVnd(math.difference)}`}
                      </Text>
                    ),
                  }
                : null,
            ]}
          />
          <Text style={[text.caption, { fontFamily: fonts.regular, color: colors.muted }]}>
            {`Theo bảng giá hiện tại${props.version ? ` (bản số ${props.version})` : ''}. Máy chủ phường đối chiếu với giá niêm yết đúng lúc bạn mua.`}
          </Text>
        </View>
      ) : null}
      {item && props.chargedAmount != null && !math.above ? (
        <Banner tone="warning" title="Không cao hơn giá niêm yết" action={{ label: 'Phản ánh khác', onPress: props.onOther }}>
          Số tiền bạn trả không cao hơn giá niêm yết nên không gửi được loại phản ánh này. Nếu có vấn đề khác, chọn “Phản ánh khác”.
        </Banner>
      ) : null}
    </View>
  );
}

/** − n + with 44 pt buttons; the count is read out with its unit. */
function Stepper({ value, min, max, onChange, unit }: { value: number; min: number; max: number; onChange: (n: number) => void; unit?: string }) {
  const button = (label: string, icon: { sf: string; md: string }, next: number, disabled: boolean) => (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync();
        onChange(next);
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? colors.brandTint : colors.card, borderWidth: 1.5, borderColor: colors.line, opacity: disabled ? 0.4 : 1 })}
    >
      <Icon sf={icon.sf} md={icon.md} size={18} color={colors.ink} weight="bold" />
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {button('Giảm số lượng', { sf: 'minus', md: 'remove' }, Math.max(min, value - 1), value <= min)}
      <Text accessibilityLabel={`${value}${unit ? ` ${unit}` : ''}`} maxFontSizeMultiplier={1.3} style={[sign.price, tabular, { minWidth: 40, textAlign: 'center', color: colors.ink }]}>
        {value}
      </Text>
      {button('Tăng số lượng', { sf: 'plus', md: 'add' }, Math.min(max, value + 1), value >= max)}
    </View>
  );
}
