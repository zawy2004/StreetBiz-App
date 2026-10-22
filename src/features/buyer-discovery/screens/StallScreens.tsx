import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/common/Button';
import { Chip } from '@/components/common/Chip';
import { Icon } from '@/components/common/Icon';
import { KerbStrip } from '@/components/common/KerbStrip';
import { Banner } from '@/components/feedback/Banner';
import { Skeleton } from '@/components/feedback/Skeleton';
import { ErrorState } from '@/components/feedback/States';
import { showToast } from '@/components/feedback/Toast';
import { TextField } from '@/components/forms/TextField';
import { LeafletMap } from '@/components/map/LeafletMap';
import { StockTag } from '@/components/status/MockBadge';
import { commerceApi, errorMessage, type CommerceCart, type MarketplaceMenuItem, type StorefrontDetail } from '@/core/api';
import { useStartChat } from '@/features/chat/hooks/useChat';
import { CART_KEY, askToSignIn, cartCount, useAddToCart, useCart, useSetCartQuantity } from '@/features/cart/cart-api';
import { CartBar, CartSheet, QtyStepper } from '@/features/cart/components/cart-parts';
import { useAuthStore } from '@/store/auth-store';
import { colors, fonts, radius, shadow, sign, tabular, text } from '@/theme';
import { Plate, PriceSticker, Section, useStatusBarStyle } from '@/ui';
import { formatVnd } from '@/utils/format';
import { LicensedBadge, Rating } from '../components/stall-parts';
import { useMenuItem, useStorefrontDetail } from '../discovery-api';
import { directionsUrl, formatDistance, todayHoursText, vietnamWeekday, weeklySchedule } from '../discovery-format';
import { menuItemPhotos, storefrontPhotos } from '../food-photos';
import { todayStatus } from '../storefront-hours';

const go = (href: string) => router.push(href as Href);

/** The cart bar and sheet, shared by the stall and dish pages. */
function useCartChrome() {
  const { data: cart } = useCart();
  const [open, setOpen] = useState(false);
  return {
    cart,
    bar: <CartBar cart={cart} onPress={() => setOpen(true)} />,
    sheet: <CartSheet cart={cart} visible={open} onClose={() => setOpen(false)} />,
  };
}

/**
 * A photo page's header (v5 photo hero): transparent with a white back button over the photo,
 * then solid white with the page's name once the photo has scrolled under it. The status-bar
 * icons follow (white over the photo, dark on white), pushed only while this screen is in front.
 */
function useHeroHeader(heroHeight: number, title: string) {
  const insets = useSafeAreaInsets();
  const [solid, setSolid] = useState(false);
  // Guarded against react-native-web, which has no StatusBar stack API (see src/ui/status-bar.ts).
  useStatusBarStyle(solid ? 'dark-content' : 'light-content');
  // Flips once when the photo passes under the header, never per pixel.
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = e.nativeEvent.contentOffset.y > heroHeight - insets.top - 64;
    if (next !== solid) setSolid(next);
  };
  const options = {
    title: solid ? title : '',
    headerTransparent: true,
    headerTintColor: solid ? colors.primary : colors.white,
    headerStyle: { backgroundColor: solid ? colors.canvas : 'transparent' },
  };
  return { onScroll, options, tagTop: insets.top + 64 };
}

/** A photo that falls back to the next candidate (the stall's own, then an illustrative one). */
function FallbackPhoto({
  photos,
  style,
  dim,
  tagStyle,
  compactTag,
}: {
  photos: ReturnType<typeof storefrontPhotos>;
  style: StyleProp<ViewStyle>;
  dim?: boolean;
  tagStyle?: StyleProp<ViewStyle>;
  compactTag?: boolean;
}) {
  const [failed, setFailed] = useState(0);
  const photo = photos[failed];
  if (!photo) {
    return (
      <View style={[style, { backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }]}>
        <Icon sf="fork.knife" md="restaurant" size={28} color={colors.primary} />
      </View>
    );
  }
  return (
    <View style={[style, { backgroundColor: colors.sunken }]}>
      <Image source={photo.source} style={{ width: '100%', height: '100%', opacity: dim ? 0.45 : 1 }} contentFit="cover" transition={160} onError={() => setFailed((n) => n + 1)} accessibilityIgnoresInvertColors />
      {photo.illustrative ? <StockTag compact={compactTag} style={tagStyle ?? { right: 12, bottom: 12 }} /> : null}
    </View>
  );
}

/** A scrim under the header so the white back button reads over any photo (not decoration). */
function TopScrim() {
  return <LinearGradient colors={['rgba(17,28,43,0.55)', 'rgba(17,28,43,0)']} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 120 }} pointerEvents="none" />;
}

/** Same shapes as the loaded page: the photo, the name, the four round actions, dish rows. */
function HeroSkeleton({ heroHeight, rows = 3 }: { heroHeight: number; rows?: number }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }} accessibilityLabel="Đang tải">
      <Skeleton height={heroHeight} radius={0} />
      <View style={{ padding: 20, gap: 12 }}>
        <Skeleton width="72%" height={28} />
        <Skeleton width="48%" height={14} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} width={52} height={52} radius={26} />
          ))}
        </View>
        {Array.from({ length: rows }, (_, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 14, alignItems: 'center', paddingVertical: 6 }}>
            <Skeleton width={104} height={104} radius={radius.photo} />
            <View style={{ flex: 1, gap: 8 }}>
              <Skeleton width="70%" height={16} />
              <Skeleton width="90%" height={12} />
              <Skeleton width="40%" height={12} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * V-C06 Quán (DISC-06), v5 (screens/v5/buyer-rest.md): the stall's photo runs under the status
 * bar and stands on the painted kerb with its slot plate and a "from" price sticker; then its
 * name, score and licence, today, the ways on, its menu (each dish with a mango price sticker
 * on its photo), the pavement it stands on and its week. The cart floats as an orange ticket.
 */
export function StorefrontDetailScreen() {
  const { storefrontId } = useLocalSearchParams<{ storefrontId: string }>();
  const id = Number(storefrontId);
  const detail = useStorefrontDetail(id);
  const chrome = useCartChrome();
  const { width } = useWindowDimensions();

  if (detail.isPending) {
    return (
      <>
        <Stack.Screen options={{ title: '', headerTransparent: true, headerTintColor: colors.ink, headerStyle: { backgroundColor: 'transparent' } }} />
        <HeroSkeleton heroHeight={Math.round(width * 0.82)} />
      </>
    );
  }
  if (detail.isError || !detail.data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.canvas, padding: 16 }}>
        <Stack.Screen options={{ title: 'Quán' }} />
        <ErrorState error={detail.error ?? new Error('Không tìm thấy quán.')} onRetry={() => void detail.refetch()} />
      </View>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <StallPage detail={detail.data} cart={chrome.cart} />
      {chrome.cart?.storefrontId === id ? chrome.bar : null}
      {chrome.sheet}
    </View>
  );
}

function StallPage({ detail, cart }: { detail: StorefrontDetail; cart: CommerceCart | null | undefined }) {
  const { storefront: s, weeklyHours, menu } = detail;
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const heroHeight = Math.round(width * 0.82);
  const hero = useHeroHeader(heroHeight, s.storefrontName);
  const add = useAddToCart();
  const setQty = useSetCartQuantity();
  const photos = useMemo(() => storefrontPhotos({ storefrontId: s.storefrontId, storefrontName: s.storefrontName, description: s.description, categories: s.categories, imageUrl: s.imageUrl }), [s]);
  const status = todayStatus(weeklyHours, s.isOpenNow) ?? (todayHoursText(s) ? `Hôm nay mở ${todayHoursText(s)}` : null);
  const schedule = weeklySchedule(weeklyHours);
  const today = vietnamWeekday();
  const [category, setCategory] = useState<number | null>(null);
  const shown = category == null ? menu : menu.filter((c) => c.categoryId === category);
  const qtyOf = (menuItemId: number) => (cart?.storefrontId === s.storefrontId ? (cart.items.find((i) => i.menuItemId === menuItemId)?.quantity ?? 0) : 0);
  const markers = useMemo(() => [{ id: 's', latitude: s.latitude, longitude: s.longitude, label: `Ô ${s.slotCode}`, fill: colors.cta, ink: colors.white }], [s.latitude, s.longitude, s.slotCode]);
  const hasCart = cart?.storefrontId === s.storefrontId && cartCount(cart) > 0;
  const role = useAuthStore((st) => st.user?.role_code);
  const startChat = useStartChat();
  // Only a buyer may open a thread; a visitor is asked to sign in first.
  const openChat = () => {
    if (role !== 'CUSTOMER') {
      askToSignIn('Đăng nhập để nhắn tin với quán.');
      return;
    }
    if (startChat.isPending) return;
    startChat.mutate(s.storefrontId, {
      onSuccess: (c) => go(`/chat/${c.conversationId}`),
      onError: (e) => showToast(errorMessage(e), 'error'),
    });
  };
  const distance = formatDistance(s.distanceMeters);
  // todayStatus already says "Đang mở, đóng lúc …"; the fallback window ("Hôm nay mở …") does not.
  const openLine = status?.startsWith('Đang')
    ? status
    : `${s.isOpenNow ? 'Đang mở' : 'Đang đóng'}${status ? `, ${status.charAt(0).toLocaleLowerCase('vi-VN')}${status.slice(1)}` : ''}`;
  const dishCount = menu.reduce((n, c) => n + c.items.length, 0);

  return (
    <ScrollView onScroll={hero.onScroll} scrollEventThrottle={16} style={{ backgroundColor: colors.canvas }} contentContainerStyle={{ paddingBottom: (hasCart ? 108 : 36) + insets.bottom }}>
      <Stack.Screen options={hero.options} />

      {/* The stall's photo, standing on the painted kerb with its slot plate and cheapest dish */}
      <View>
        <FallbackPhoto photos={photos} style={{ width, height: heroHeight }} tagStyle={{ right: 16, top: hero.tagTop }} />
        <TopScrim />
        <KerbStrip height={10} segment={24} />
        <Plate code={s.slotCode} style={{ position: 'absolute', left: 20, bottom: 4, minHeight: 32, paddingHorizontal: 11 }} />
        {s.minPrice != null ? (
          <PriceSticker value={`từ ${formatVnd(s.minPrice)}`} style={{ position: 'absolute', right: 20, bottom: 22 }} />
        ) : null}
      </View>

      <View style={{ paddingHorizontal: 20, paddingTop: 18, gap: 10 }}>
        <Text accessibilityRole="header" style={[text.title1, { color: colors.ink }]}>{s.storefrontName}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
          <Rating stall={s} size={14} />
          {distance ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Icon sf="location.fill" md="near_me" size={12} color={colors.cta} />
              <Text style={[{ fontFamily: fonts.bold, fontSize: 14, color: colors.ink }, tabular]}>{distance}</Text>
            </View>
          ) : null}
          <LicensedBadge slotCode={s.slotCode} withSlot={false} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: s.isOpenNow ? colors.leaf : colors.danger }} />
          <Text style={{ flexShrink: 1, fontFamily: fonts.bold, fontSize: 14.5, lineHeight: 20, color: s.isOpenNow ? colors.onLeaf : colors.onDanger }}>
            {openLine}
          </Text>
        </View>
        {s.description ? <Text style={[text.callout, { color: colors.muted }]}>{s.description}</Text> : null}
      </View>

      <View style={{ flexDirection: 'row', paddingHorizontal: 12, paddingTop: 20, paddingBottom: 6 }}>
        <Action icon={{ sf: 'bubble.left.and.bubble.right.fill', md: 'chat' }} label={startChat.isPending ? 'Đang mở…' : 'Nhắn tin'} onPress={openChat} />
        <Action icon={{ sf: 'arrow.triangle.turn.up.right.diamond.fill', md: 'directions' }} label="Chỉ đường" onPress={() => void Linking.openURL(directionsUrl(s.latitude, s.longitude))} />
        <Action icon={{ sf: 'person.text.rectangle', md: 'badge' }} label="Hộ kinh doanh" onPress={() => go(`/customer/explore/vendors/${s.vendorId}`)} />
        <Action icon={{ sf: 'exclamationmark.bubble', md: 'report' }} label="Phản ánh" onPress={() => go(`/customer/explore/vendors/${s.vendorId}/report`)} />
      </View>

      {!s.isOpenNow ? (
        <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
          <Banner tone="warning">Quán đang đóng. Bạn vẫn xem được món, đặt khi quán mở.</Banner>
        </View>
      ) : null}

      <View style={{ paddingTop: 26, gap: 30 }}>
        <Section title="Thực đơn" note={dishCount ? `${dishCount} món, chạm + là vào giỏ` : undefined}>
          {menu.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
              {[{ categoryId: null as number | null, categoryName: 'Tất cả' }, ...menu].map((c) => (
                <Chip key={String(c.categoryId)} label={c.categoryName} selected={category === c.categoryId} onPress={() => setCategory(c.categoryId)} accessibilityRole="radio" />
              ))}
            </ScrollView>
          ) : null}
          {menu.length === 0 ? <Text style={[text.callout, { color: colors.muted, paddingHorizontal: 20 }]}>Quán chưa đăng món nào.</Text> : null}
          {shown.map((c) => (
            <View key={c.categoryId}>
              {menu.length > 1 ? (
                <Text accessibilityRole="header" style={{ fontFamily: fonts.heavy, fontSize: 16.5, lineHeight: 22, color: colors.ink, paddingHorizontal: 20, paddingTop: 6, paddingBottom: 2 }}>
                  {c.categoryName}
                </Text>
              ) : null}
              {c.items.map((item, i) => (
                <View key={item.menuItemId}>
                  <DishRow
                    item={item}
                    quantity={qtyOf(item.menuItemId)}
                    onOpen={() => go(`/customer/explore/items/${item.menuItemId}`)}
                    onAdd={() => add(item)}
                    onQuantity={(n) => setQty.mutate({ menuItemId: item.menuItemId, quantity: n })}
                  />
                  {i < c.items.length - 1 ? <View style={{ height: 1, marginLeft: 20 + 104 + 14, backgroundColor: colors.separator }} /> : null}
                </View>
              ))}
            </View>
          ))}
        </Section>

        <Section title="Lấy món tại ô" note="Ô vỉa hè do phường cấp phép">
          <View style={{ marginHorizontal: 20, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadow.card }}>
            <View style={{ borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, overflow: 'hidden' }}>
              <LeafletMap center={[s.latitude, s.longitude]} zoom={18} markers={markers} interactive={false} style={{ height: 150 }} />
            </View>
            <View style={{ padding: 16, gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Plate code={s.slotCode} />
                <Text style={[text.headline, { flex: 1, color: colors.ink }]} numberOfLines={2}>{s.zoneName}</Text>
              </View>
              <Text style={[text.footnote, { color: colors.muted }]}>{[s.address, s.wardName].filter(Boolean).join(', ')}</Text>
              <Text style={[text.caption, { color: colors.onLeaf }]}>Đến đúng ô này để lấy món.</Text>
            </View>
          </View>
        </Section>

        {schedule ? (
          <Section title="Giờ mở cửa">
            <View style={{ marginHorizontal: 20, gap: 2 }}>
              {schedule.map((d) => {
                const isToday = d.day === today;
                return (
                  <View key={d.day} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, minHeight: 40, paddingHorizontal: 14, borderRadius: radius.control, borderCurve: 'continuous', backgroundColor: isToday ? colors.brandTint : 'transparent' }}>
                    <Text style={[text.callout, { color: isToday ? colors.primary : colors.ink, fontFamily: isToday ? fonts.heavy : fonts.medium }]}>
                      {d.label}
                      {isToday ? ' (hôm nay)' : ''}
                    </Text>
                    <Text style={[text.callout, { color: d.ranges.length ? (isToday ? colors.primary : colors.ink) : colors.muted, fontFamily: isToday ? fonts.heavy : fonts.semibold }, tabular]}>
                      {d.ranges.length ? d.ranges.join(', ') : 'Nghỉ'}
                    </Text>
                  </View>
                );
              })}
            </View>
          </Section>
        ) : null}
      </View>
    </ScrollView>
  );
}

/** One of the stall's four ways on: a tinted disc and a short word under it. */
function Action({ icon, label, onPress }: { icon: { sf: string; md: string }; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={{ flex: 1, alignItems: 'center', gap: 7, minHeight: 44 }}>
      {({ pressed }) => (
        <>
          <View style={{ width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? colors.brand : colors.brandTint }}>
            <Icon sf={icon.sf} md={icon.md} size={22} color={pressed ? colors.white : colors.primary} />
          </View>
          <Text numberOfLines={2} style={[text.caption, { color: colors.ink, textAlign: 'center' }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

/** A dish on the stall's menu: the photo with its price on a mango sticker, name, ATTP mark; + or the stepper. */
function DishRow({ item, quantity, onOpen, onAdd, onQuantity }: { item: MarketplaceMenuItem; quantity: number; onOpen: () => void; onAdd: () => void; onQuantity: (n: number) => void }) {
  const photos = useMemo(() => menuItemPhotos(item), [item]);
  const soldOut = item.availabilityStatus !== 'AVAILABLE';
  return (
    <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`${item.itemName}, ${formatVnd(item.unitPrice)}${soldOut ? ', hết món' : ''}`} style={({ pressed }) => ({ flexDirection: 'row', gap: 14, paddingHorizontal: 20, paddingVertical: 14, backgroundColor: pressed ? colors.pressed : colors.canvas })}>
      <View style={{ paddingTop: 8 }}>
        <FallbackPhoto photos={photos} style={{ width: 104, height: 104, borderRadius: radius.photo, borderCurve: 'continuous', overflow: 'hidden' }} dim={soldOut} compactTag tagStyle={{ left: 6, bottom: 6 }} />
        <PriceSticker value={soldOut ? 'Hết món' : formatVnd(item.unitPrice)} tilt={-4} style={[{ position: 'absolute', top: 0, left: -6 }, soldOut ? { backgroundColor: colors.sunken } : null]} />
      </View>
      <View style={{ flex: 1, gap: 4, paddingTop: 6 }}>
        <Text style={{ fontFamily: fonts.heavy, fontSize: 16.5, lineHeight: 22, color: soldOut ? colors.muted : colors.ink }} numberOfLines={2}>{item.itemName}</Text>
        {item.description ? <Text style={[text.footnote, { color: colors.muted }]} numberOfLines={2}>{item.description}</Text> : null}
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, marginTop: 4 }}>
          {item.foodSafetyCertified ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingBottom: 4 }}>
              <Icon sf="checkmark.shield.fill" md="verified_user" size={12} color={colors.leaf} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.onLeaf }}>Đạt ATTP</Text>
            </View>
          ) : (
            <View />
          )}
          {soldOut ? null : quantity > 0 ? (
            <QtyStepper quantity={quantity} onChange={onQuantity} name={item.itemName} compact />
          ) : (
            <Pressable onPress={onAdd} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Thêm ${item.itemName} vào giỏ`} style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, backgroundColor: pressed ? colors.ctaPressed : colors.cta, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.white, boxShadow: '0 6px 14px -6px rgba(238, 85, 0, 0.7)' })}>
              <Icon sf="plus" md="add" size={20} color={colors.white} weight="bold" />
            </Pressable>
          )}
        </View>
      </View>
    </Pressable>
  );
}

/** The dish's price as a big mango sticker stuck across the hero photo. */
function HeroSticker({ value, muted }: { value: string; muted?: boolean }) {
  return (
    <View
      accessibilityLabel={`Giá ${value}`}
      style={{
        position: 'absolute',
        left: 20,
        bottom: 48,
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: radius.sticker,
        borderCurve: 'continuous',
        backgroundColor: muted ? colors.sunken : colors.sticker,
        transform: [{ rotate: '-4deg' }],
        boxShadow: '0 8px 16px -8px rgba(17, 28, 43, 0.5)',
      }}
    >
      <Text maxFontSizeMultiplier={1.3} style={[sign.price, { fontSize: 28, lineHeight: 34, color: colors.plate }, tabular]}>{value}</Text>
    </View>
  );
}

/**
 * V-C07 Món, v5: the dish runs under the status bar with its price on a big mango sticker; a
 * white sheet rises over the photo's edge with the name, where it is sold, how many and a note
 * for the cook. The footer says the total in sign figures beside the one button.
 */
export function ItemDetailScreen() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const item = useMenuItem(Number(itemId));
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const chrome = useCartChrome();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const heroHeight = Math.round(width * 0.9);
  const hero = useHeroHeader(heroHeight - 26, item.data?.itemName ?? '');
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const add = useMutation({
    mutationFn: () => commerceApi.addCartItem(item.data!.menuItemId, quantity, note.trim() || undefined),
    onSuccess: (cart) => {
      queryClient.setQueryData(CART_KEY, cart);
      showToast('Đã thêm vào giỏ');
      router.back();
    },
    onError: (err) => showToast(errorMessage(err), 'error'),
  });

  if (item.isPending) {
    return (
      <>
        <Stack.Screen options={{ title: '', headerTransparent: true, headerTintColor: colors.ink, headerStyle: { backgroundColor: 'transparent' } }} />
        <HeroSkeleton heroHeight={heroHeight} rows={1} />
      </>
    );
  }
  if (item.isError || !item.data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.canvas, padding: 16 }}>
        <Stack.Screen options={{ title: 'Món' }} />
        <ErrorState error={item.error ?? new Error('Không tìm thấy món.')} onRetry={() => void item.refetch()} />
      </View>
    );
  }
  const d = item.data;
  const soldOut = d.availabilityStatus !== 'AVAILABLE';
  const held = chrome.cart;
  const otherStall = held && held.items.length > 0 && held.storefrontId !== d.storefrontId;
  const submit = () => {
    if (!user) return askToSignIn();
    if (user.role_code !== 'CUSTOMER') return showToast('Chỉ tài khoản người mua đặt được món.', 'error');
    if (otherStall) {
      Alert.alert('Thay giỏ hàng hiện tại?', `Giỏ tại ${held.storefrontName} sẽ được thay bằng món từ ${d.storefrontName}. Mỗi đơn chỉ lấy ở một quán.`, [
        { text: 'Giữ giỏ cũ', style: 'cancel' },
        { text: 'Thay giỏ', style: 'destructive', onPress: () => add.mutate() },
      ]);
      return;
    }
    add.mutate();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Stack.Screen options={hero.options} />
      <ScrollView onScroll={hero.onScroll} scrollEventThrottle={16} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}>
        <View>
          <FallbackPhoto photos={menuItemPhotos(d)} style={{ width, height: heroHeight }} dim={soldOut} tagStyle={{ right: 16, top: hero.tagTop }} />
          <TopScrim />
          <HeroSticker value={soldOut ? 'Hết món' : formatVnd(d.unitPrice)} muted={soldOut} />
        </View>

        {/* The white sheet rising over the photo's edge */}
        <View style={{ marginTop: -26, borderTopLeftRadius: radius.pass, borderTopRightRadius: radius.pass, borderCurve: 'continuous', backgroundColor: colors.canvas, paddingHorizontal: 20, paddingTop: 24, gap: 20 }}>
          <View style={{ gap: 8 }}>
            <Text accessibilityRole="header" style={[text.title1, { color: colors.ink }]}>{d.itemName}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.muted }}>{d.categoryName}</Text>
              {d.foodSafetyCertified ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.full, paddingHorizontal: 9, paddingVertical: 4, backgroundColor: colors.leafTint }}>
                  <Icon sf="checkmark.shield.fill" md="verified_user" size={12} color={colors.leaf} />
                  <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.onLeaf }}>Đạt ATTP</Text>
                </View>
              ) : null}
              {soldOut ? (
                <View style={{ borderRadius: radius.full, paddingHorizontal: 9, paddingVertical: 4, backgroundColor: colors.dangerTint }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.onDanger }}>Hết món</Text>
                </View>
              ) : null}
            </View>
            {d.description ? <Text style={[text.body, { color: colors.ink }]}>{d.description}</Text> : null}
          </View>

          <Pressable onPress={() => go(`/customer/explore/stores/${d.storefrontId}`)} accessibilityRole="button" accessibilityLabel={`Bán tại quán ${d.storefrontName}`} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: pressed ? colors.brandTint : colors.kerbPaint, borderWidth: 1.5, borderColor: colors.brandTint })}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
              <Icon sf="storefront.fill" md="storefront" size={20} color={colors.white} />
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={[text.caption, { color: colors.muted }]}>Bán tại quán</Text>
              <Text style={[text.headline, { color: colors.ink }]}>{d.storefrontName}</Text>
            </View>
            <Icon sf="chevron.right" md="chevron_right" size={14} color={colors.primary} />
          </Pressable>

          {!soldOut ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.heavy, fontSize: 17, color: colors.ink }}>Số lượng</Text>
                  <Text style={[text.footnote, { color: colors.muted }, tabular]}>{formatVnd(d.unitPrice)} một phần</Text>
                </View>
                <QtyStepper quantity={quantity} onChange={(n) => setQuantity(Math.max(1, Math.min(99, n)))} name={d.itemName} />
              </View>
              <TextField label="Ghi chú cho quán" optional value={note} onChangeText={setNote} placeholder="VD: ít cay, không hành" maxLength={200} />
            </>
          ) : null}
          {otherStall ? <Banner tone="warning">Giỏ đang có {cartCount(held)} món của {held.storefrontName}. Thêm món này sẽ thay giỏ.</Banner> : null}
        </View>
      </ScrollView>

      {/* The total and the one button, floating above the home indicator */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.canvas, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, borderCurve: 'continuous', boxShadow: '0 -10px 28px -14px rgba(17, 28, 43, 0.22)' }}>
        <SafeAreaView edges={['bottom']} mode="padding">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 }}>
            {!soldOut ? (
              <View>
                <Text style={[text.caption, { color: colors.muted }, tabular]}>Tổng {quantity} phần</Text>
                <Text maxFontSizeMultiplier={1.3} style={[sign.price, { fontSize: 26, lineHeight: 32, color: colors.ink }, tabular]}>{formatVnd(d.unitPrice * quantity)}</Text>
              </View>
            ) : null}
            <Button
              label={soldOut ? 'Món đang hết' : user ? 'Thêm vào giỏ' : 'Đăng nhập để thêm'}
              size={56}
              icon={{ sf: 'bag.badge.plus', md: 'add_shopping_cart' }}
              disabled={soldOut}
              loading={add.isPending}
              onPress={submit}
              style={{ flex: 1 }}
            />
          </View>
        </SafeAreaView>
      </View>
      {chrome.sheet}
    </View>
  );
}
