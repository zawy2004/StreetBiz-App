import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Linking, Text, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { Chip } from '@/components/common/Chip';
import { Icon } from '@/components/common/Icon';
import { PermitQr } from '@/components/common/PermitQr';
import { Banner } from '@/components/feedback/Banner';
import { Skeleton } from '@/components/feedback/Skeleton';
import { ErrorState, ListSkeleton } from '@/components/feedback/States';
import { StateView } from '@/components/feedback/StateView';
import { showToast } from '@/components/feedback/Toast';
import { Screen } from '@/components/layout/Screen';
import { sellerStoreApi } from '@/core/api/seller-store-api';
import { colors, fonts, radius, shadow, sign, tabular, text } from '@/theme';
import { Pass, Plate } from '@/ui';
import { formatVietnamDateTime, formatVnd } from '@/utils/format';
import { historyLine } from '../price-board-view';

/**
 * Bảng giá (BUY-06), in "Gian hàng → Thực đơn": the board as it hangs at the counter (each dish
 * with its unit and English name, "Bản số N", the QR that opens the live board), "In bảng giá"
 * opening the public A5 print page in the browser (no sign-in there), and the append-only history
 * of every change: when, the price before and after, who. The paper board stays required by law;
 * the QR only adds to it. A business renting several slots hangs one board at each: same prices,
 * that slot's own permit QR, picked with the slot chips.
 */
export function PriceBoardScreen() {
  const { storefrontId } = useLocalSearchParams<{ storefrontId?: string }>();
  const stores = useQuery({ queryKey: ['commerce', 'stores'], queryFn: sellerStoreApi.stores });
  const storeId = Number(storefrontId) || stores.data?.[0]?.storefrontId;
  const board = useQuery({ queryKey: ['commerce', 'price-board', storeId], queryFn: () => sellerStoreApi.priceBoard(storeId!), enabled: Boolean(storeId) });
  const [slotCode, setSlotCode] = useState<string | null>(null);

  if (stores.isPending || (storeId && board.isPending)) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Bảng giá' }} />
        <Skeleton height={320} radius={radius.pass} />
        <ListSkeleton rows={3} height={64} />
      </Screen>
    );
  }
  const failed = stores.error ?? board.error;
  if (failed) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Bảng giá' }} />
        <ErrorState error={failed} onRetry={() => void Promise.all([stores.refetch(), board.refetch()])} />
      </Screen>
    );
  }
  if (!storeId || !board.data) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Bảng giá' }} />
        <StateView icon={{ sf: 'storefront', md: 'storefront' }} title="Cần tạo gian hàng trước" body="Bảng giá lấy từ thực đơn của gian hàng trên ô bạn đã thuê." action={{ label: 'Quay lại', onPress: () => router.back() }} />
      </Screen>
    );
  }
  const b = board.data;
  const slots = (b.boards ?? []).filter((x) => x.printUrl);
  // The board being looked at and printed: the chosen slot, else the storefront's own (the first).
  const slot = slots.find((x) => x.slotCode === slotCode) ?? slots[0];
  const qrUrl = slot?.qrUrl ?? b.qrUrl;
  const printUrl = slot?.printUrl ?? b.printUrl;
  const print = () => {
    if (!printUrl) return;
    Linking.openURL(printUrl).catch(() => showToast('Không mở được trang in. Kiểm tra trình duyệt trên máy.', 'error'));
  };

  return (
    <Screen
      onRefresh={() => void board.refetch()}
      refreshing={board.isRefetching}
      gap={18}
      footer={<Button label={slots.length > 1 && slot ? `In bảng ô ${slot.slotCode}` : 'In bảng giá'} size={56} icon={{ sf: 'printer.fill', md: 'print' }} disabled={!printUrl || b.items.length === 0} onPress={print} accessibilityHint="Mở trang in khổ A5 trong trình duyệt" />}
    >
      <Stack.Screen options={{ title: 'Bảng giá' }} />
      {stores.data!.length > 1 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {stores.data!.map((s) => (
            <Chip key={s.storefrontId} label={s.name} selected={s.storefrontId === storeId} onPress={() => router.setParams({ storefrontId: String(s.storefrontId) })} accessibilityRole="radio" />
          ))}
        </View>
      ) : null}
      {slots.length > 1 ? (
        <View style={{ gap: 8 }}>
          <Text style={[text.footnote, { color: colors.muted, paddingHorizontal: 4 }]}>Mỗi ô treo một bảng: cùng giá, mã QR riêng của giấy phép ô đó.</Text>
          <View accessibilityRole="radiogroup" accessibilityLabel="Bảng cho ô" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {slots.map((x) => (
              <Chip key={x.slotCode} label={`Ô ${x.slotCode}`} selected={x.slotCode === slot?.slotCode} onPress={() => setSlotCode(x.slotCode)} accessibilityRole="radio" />
            ))}
          </View>
        </View>
      ) : null}

      {/* The board as it will hang at the counter */}
      <Pass
        accent={colors.sticker}
        head={
          <View style={{ gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text accessibilityRole="header" style={{ flex: 1, fontFamily: fonts.heavy, fontSize: 19, lineHeight: 25, color: colors.ink }}>{b.storefrontName}</Text>
              {slot?.slotCode ?? b.slotCode ? <Plate code={slot?.slotCode ?? b.slotCode!} /> : null}
            </View>
            <Text style={[text.footnote, tabular, { color: colors.muted }]}>
              {b.updatedAt ? `Bản số ${b.version} — cập nhật ${formatVietnamDateTime(b.updatedAt)}` : `Bản số ${b.version}`}
            </Text>
            {b.items.length === 0 ? (
              <Text style={[text.callout, { color: colors.muted }]}>Chưa có món nào đang bán. Thêm món ở Thực đơn để có bảng giá.</Text>
            ) : (
              <View style={{ borderRadius: radius.photo, borderCurve: 'continuous', borderWidth: 1, borderColor: colors.line, overflow: 'hidden' }}>
                {b.items.map((item, i) => (
                  <View key={item.menuItemId} accessible accessibilityLabel={`${item.name}${item.nameEn ? `, ${item.nameEn}` : ''}: ${formatVnd(item.unitPrice)} một ${item.priceUnit}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: colors.separator }}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, color: colors.ink }}>{item.name}</Text>
                      {item.nameEn ? <Text style={[text.footnote, { color: colors.muted }]}>{item.nameEn}</Text> : null}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[sign.price, tabular, { color: colors.primary }]}>{formatVnd(item.unitPrice)}</Text>
                      <Text style={[text.caption, { color: colors.muted }]}>{`/ ${item.priceUnit}`}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        }
        stub={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            {qrUrl ? (
              <View style={{ padding: 8, borderRadius: radius.sticker, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line }} accessibilityLabel="Mã QR in trên bảng giá">
                <PermitQr value={qrUrl} size={96} />
              </View>
            ) : null}
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ fontFamily: fonts.heavy, fontSize: 15, color: colors.ink }}>Treo bảng này tại quầy</Text>
              <Text style={[text.footnote, { color: colors.muted }]}>
                {qrUrl ? 'Khách quét mã bằng camera điện thoại để xem giấy phép và giá hiện tại, không cần cài ứng dụng.' : 'Bảng in ra có mã QR để khách kiểm tra giấy phép và giá.'}
              </Text>
            </View>
          </View>
        }
      />

      {!printUrl ? (
        <Banner tone="warning" title="Chưa in được bảng giá có mã QR">
          Cần giấy phép còn hiệu lực cho ô của gian hàng này. Nếu giấy phép vẫn còn hiệu lực, máy chủ chưa có địa chỉ trang công khai: báo quản trị viên.
        </Banner>
      ) : null}
      <Banner tone="neutral" icon={{ sf: 'building.columns', md: 'account_balance' }}>
        Luật Giá 2023 (Điều 29) yêu cầu niêm yết giá tại nơi bán, ghi rõ đơn vị tính, và không bán cao hơn giá niêm yết. Mã QR chỉ bổ sung, không thay bảng giấy. Đổi giá thì in lại bảng mới.
      </Banner>

      <View style={{ gap: 10 }}>
        <View style={{ gap: 2, paddingHorizontal: 4 }}>
          <Text accessibilityRole="header" style={{ fontFamily: fonts.heavy, fontSize: 20, lineHeight: 26, color: colors.ink }}>Lịch sử giá</Text>
          <Text style={[text.footnote, { color: colors.muted }]}>Mỗi lần thêm, đổi giá, đổi tên, đơn vị hay gỡ món đều được ghi lại và không sửa được.</Text>
        </View>
        {b.history.length === 0 ? (
          <Text style={[text.callout, { color: colors.muted, paddingHorizontal: 4 }]}>Chưa có thay đổi nào.</Text>
        ) : (
          <View style={{ borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.card, boxShadow: shadow.card }}>
            {b.history.map((h, i) => {
              const line = historyLine(h);
              return (
                <View key={h.priceHistoryId} accessible style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: colors.separator }}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, marginTop: 2, backgroundColor: h.changeKind === 'ARCHIVED' ? colors.sunken : colors.mangoTint, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon sf={h.changeKind === 'CREATED' ? 'plus' : h.changeKind === 'ARCHIVED' ? 'minus' : 'tag.fill'} md={h.changeKind === 'CREATED' ? 'add' : h.changeKind === 'ARCHIVED' ? 'remove' : 'sell'} size={14} color={h.changeKind === 'ARCHIVED' ? colors.muted : colors.onMango} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                      <Text style={{ flexShrink: 1, fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, color: colors.ink }}>{h.name}</Text>
                      <Text style={[text.caption, tabular, { color: colors.muted }]}>{formatVietnamDateTime(h.changedAt)}</Text>
                    </View>
                    <Text style={[text.footnote, tabular, { color: colors.ink, fontFamily: fonts.semibold }]}>{`${line.title}: ${line.price}`}</Text>
                    <Text style={[text.caption, { color: colors.muted }]}>{`Bởi ${h.changedByName}`}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </Screen>
  );
}
