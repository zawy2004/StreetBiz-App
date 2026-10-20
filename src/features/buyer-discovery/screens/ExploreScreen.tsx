import { router, Stack, type Href } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Keyboard, Pressable, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip } from '@/components/common/Chip';
import { Icon } from '@/components/common/Icon';
import { StateView } from '@/components/feedback/StateView';
import type { StorefrontSummary } from '@/core/api/types';
import { colors, easeOut, fonts, tabular } from '@/theme';
import { daypart, MEAL_WORD, Section, Signboard, useLightStatusBar } from '@/ui';
import { AssistantButton } from '@/features/assistant/components/AssistantButton';
import { cartCount, useAddToCart, useCart, useSetCartQuantity } from '@/features/cart/cart-api';
import { ActiveOrderCard, CartBar, CartSheet } from '@/features/cart/components/cart-parts';
import { useCustomerOrders } from '@/features/orders/hooks/useOrders';
import { useAuthStore } from '@/store/auth-store';
import { menuItemQuery, storefrontQuery } from '../discovery-filters';
import { DishTile } from '../components/dish-parts';
import {
  CartButton,
  LocationButton,
  SearchField,
  SearchSuggestions,
} from '../components/explore-header';
import { AreaSheet, SortSheet } from '../components/filter-sheets';
import { CategoryRail, ExploreSkeleton, NearbyCard, StallRow } from '../components/stall-parts';
import {
  useMarketplaceCategories,
  useMenuItems,
  useServiceAreas,
  useStorefronts,
} from '../discovery-api';
import { SORT_LABELS, useDiscoveryStore } from '../discovery-store';

/** The stall list: open stalls first, then a "closed" heading and the rest. */
type Row =
  { kind: 'stall'; stall: StorefrontSummary; divider: boolean } | { kind: 'closed'; count: number };

function toRows(list: StorefrontSummary[]): Row[] {
  const open = list.filter((s) => s.isOpenNow);
  const closed = list.filter((s) => !s.isOpenNow);
  const rows: Row[] = open.map((stall, i) => ({
    kind: 'stall',
    stall,
    divider: i < open.length - 1,
  }));
  if (closed.length) {
    rows.push({ kind: 'closed', count: closed.length });
    closed.forEach((stall, i) =>
      rows.push({ kind: 'stall', stall, divider: i < closed.length - 1 }),
    );
  }
  return rows;
}

/** Dishes shown in the grid before "Xem cả … món". */
const DISH_PREVIEW = 6;
/** Scrolled this far, the signboard is gone and the compact bar takes over. */
const SIGN_GONE = 210;

/**
 * M-C01 Khám phá — the buyer's home, v5 "Biển hiệu phố" (screens/v5/buyer-discovery.md):
 * - an orange shop sign runs under the status bar: where you pick up, the assistant and the
 *   cart on top, the meal question in sign lettering, how many licensed stalls are open;
 * - the search capsule lies across the sign's lower edge and suggests searches while focused;
 * - an order in progress, then category discs, dishes as a two-column photo grid with mango
 *   price stickers, open stalls as wide cards carrying their slot plates;
 * - every stall last, with its filters, open ones before closed;
 * - once the sign scrolls away a compact orange bar keeps the pickup ward and the cart in reach;
 *   the cart floats at the bottom as soon as it has something in it.
 */
export function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(300, Math.round(width * 0.76));
  const tileWidth = Math.floor((width - 40 - 14) / 2);
  const reduceMotion = useReducedMotion();
  useLightStatusBar();

  const filters = useDiscoveryStore((s) => s.filters);
  const position = useDiscoveryStore((s) => s.position);
  const sort = useDiscoveryStore((s) => s.sort);
  const query = useDiscoveryStore((s) => s.query);
  const recent = useDiscoveryStore((s) => s.recent);
  const { setFilters, setQuery, remember, clearRecent, resetFilters } = useDiscoveryStore.getState();
  const { wardId, categoryId, openNow } = filters;

  const isCustomer = useAuthStore((s) => s.user?.role_code === 'CUSTOMER');
  const cart = useCart().data;
  const setQty = useSetCartQuantity();
  const addToCart = useAddToCart();
  const qtyById = useMemo(
    () => new Map((cart?.items ?? []).map((l) => [l.menuItemId, l.quantity])),
    [cart],
  );
  // The newest order still in progress, for the card at the top (buyers only).
  const activeOrders = useCustomerOrders(
    { status: ['PENDING_PAYMENT', 'PLACED', 'ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP'], page: 1, pageSize: 1 },
    isCustomer,
  );
  const order = activeOrders.data?.items[0];

  const text = query.trim() || undefined;
  const storefronts = useStorefronts(storefrontQuery(filters, position, query, sort));
  // Dishes only from stalls open now: everything in this grid can be ordered this minute
  const dishes = useMenuItems(menuItemQuery({ ...filters, openNow: true }, query));
  const categories = useMarketplaceCategories();
  const areas = useServiceAreas();
  const wardName = position
    ? 'Quanh bạn'
    : wardId == null
      ? 'Tất cả khu vực'
      : (areas.data?.find((a) => a.wardId === wardId)?.wardName ?? 'Khu vực');
  const list = useMemo(() => storefronts.data ?? [], [storefronts.data]);
  const rows = useMemo(() => toRows(list), [list]);
  const openCount = useMemo(() => list.filter((s) => s.isOpenNow).length, [list]);
  const nearbyOpen = useMemo(() => list.filter((s) => s.isOpenNow).slice(0, 5), [list]);
  const dishList = useMemo(() => dishes.data ?? [], [dishes.data]);
  const dishNames = useMemo(
    () => [...new Set(dishList.map((d) => d.itemName))].slice(0, 6),
    [dishList],
  );
  const [allDishes, setAllDishes] = useState(false);
  const shownDishes = allDishes ? dishList : dishList.slice(0, DISH_PREVIEW);
  const [sheet, setSheet] = useState<'area' | 'sort' | 'cart' | null>(null);
  const [searching, setSearching] = useState(false);

  // The compact bar slides in once the signboard has scrolled away (UI thread, no re-render)
  const past = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    past.set(e.contentOffset.y > SIGN_GONE ? 1 : 0);
  });
  // Hidden, the bar sits fully above the screen so it never takes the sign's taps.
  const barHeight = insets.top + 64;
  const barStyle = useAnimatedStyle(() => {
    const v = reduceMotion ? past.get() : withTiming(past.get(), { duration: 200, easing: easeOut });
    return { opacity: v, transform: [{ translateY: (v - 1) * barHeight }] };
  });

  const openStall = useCallback((storefrontId: number) => {
    router.push(`/customer/explore/stores/${storefrontId}` as Href);
  }, []);
  const openDish = useCallback((menuItemId: number) => {
    router.push(`/customer/explore/items/${menuItemId}` as Href);
  }, []);
  const openMap = () => router.push('/customer/explore/map' as Href);

  const runSearch = (q: string) => {
    setQuery(q);
    remember(q);
    Keyboard.dismiss();
  };

  const showSuggestions = searching && !text;
  const count = cartCount(cart);

  const header = (
    <View style={{ gap: 26, paddingBottom: 4 }}>
      <Signboard
        top={
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <LocationButton wardName={wardName} onPress={() => setSheet('area')} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <AssistantButton tone="onSign" />
              <CartButton count={count} onPress={() => setSheet('cart')} />
            </View>
          </View>
        }
        line1={MEAL_WORD[daypart()]}
        line2="ăn gì?"
        caption={
          storefronts.isSuccess
            ? openCount
              ? `${openCount} quán có phép đang mở. Đặt trước, tới quầy là có món.`
              : 'Các quán đang nghỉ. Xem giờ mở và đặt trước cho bữa sau.'
            : 'Quán vỉa hè có phép của phường. Đặt trước, tới quầy là có món.'
        }
        overlap={
          <SearchField
            value={query}
            onChange={setQuery}
            focused={searching}
            onFocus={() => setSearching(true)}
            onBlur={() => setSearching(false)}
            onSubmit={() => remember(query)}
          />
        }
      />

      {showSuggestions ? (
        <SearchSuggestions
          recent={recent}
          popular={dishNames}
          onPick={runSearch}
          onClearRecent={clearRecent}
        />
      ) : null}

      {order ? <ActiveOrderCard order={order} /> : null}

      <CategoryRail
        categories={categories.data ?? []}
        selected={categoryId}
        onSelect={(id) => setFilters({ categoryId: id })}
      />

      {dishList.length ? (
        <Section
          title={text ? 'Món khớp tìm kiếm' : 'Món đang bán'}
          note={text ? undefined : 'Chạm + là vào giỏ, tới quầy là có món.'}
        >
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 20, paddingHorizontal: 20 }}>
            {shownDishes.map((item) => (
              <DishTile
                key={item.menuItemId}
                item={item}
                width={tileWidth}
                quantity={qtyById.get(item.menuItemId) ?? 0}
                onAdd={() => addToCart(item)}
                onQuantity={(n) => setQty.mutate({ menuItemId: item.menuItemId, quantity: n })}
                onOpen={() => openDish(item.menuItemId)}
              />
            ))}
          </View>
          {dishList.length > DISH_PREVIEW ? (
            <Pressable
              onPress={() => setAllDishes((v) => !v)}
              accessibilityRole="button"
              style={({ pressed }) => ({
                marginHorizontal: 20,
                minHeight: 48,
                borderRadius: 24,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 6,
                backgroundColor: pressed ? colors.brandTint : colors.kerbPaint,
                borderWidth: 1.5,
                borderColor: colors.brandTint,
              })}
            >
              <Text style={[{ fontFamily: fonts.heavy, fontSize: 15, color: colors.primary }, tabular]}>
                {allDishes ? 'Thu gọn' : `Xem cả ${dishList.length} món`}
              </Text>
              <Icon sf={allDishes ? 'chevron.up' : 'chevron.down'} md={allDishes ? 'expand_less' : 'expand_more'} size={14} color={colors.primary} />
            </Pressable>
          ) : null}
        </Section>
      ) : null}

      {!text && nearbyOpen.length > 0 ? (
        <Section title="Đang mở cửa" note={`${openCount}/${list.length} quán`} action={{ label: 'Bản đồ', onPress: openMap }}>
          <FlatList
            horizontal
            data={nearbyOpen}
            keyExtractor={(s) => String(s.storefrontId)}
            showsHorizontalScrollIndicator={false}
            snapToInterval={cardWidth + 14}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: 20, gap: 14, paddingBottom: 14 }}
            renderItem={({ item }) => (
              <NearbyCard stall={item} width={cardWidth} onPress={() => openStall(item.storefrontId)} />
            )}
          />
        </Section>
      ) : null}

      {/* Every stall, with the filters that act on this list right above it */}
      <View style={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingHorizontal: 20 }}>
          <Text accessibilityRole="header" style={{ fontFamily: fonts.heavy, fontSize: 21, lineHeight: 27, color: colors.ink }}>
            {text ? 'Quán khớp tìm kiếm' : 'Tất cả quán'}
          </Text>
          {storefronts.isSuccess ? (
            <Text style={[{ fontFamily: fonts.bold, fontSize: 15, color: colors.muted }, tabular]}>{list.length}</Text>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 20, flexWrap: 'wrap' }}>
          <Chip
            label="Đang mở"
            selected={openNow}
            onPress={() => setFilters({ openNow: !openNow })}
            accessibilityRole="switch"
            leading={
              <View style={{ width: 24, alignItems: 'center' }}>
                {openNow ? (
                  <Icon sf="checkmark" md="check" size={14} color={colors.white} weight="bold" />
                ) : (
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.leaf }} />
                )}
              </View>
            }
          />
          <Chip
            label={SORT_LABELS[sort]}
            icon={{ sf: 'arrow.up.arrow.down', md: 'swap_vert' }}
            trailingChevron
            onPress={() => setSheet('sort')}
          />
        </View>
      </View>
    </View>
  );

  const emptyState = storefronts.isPending ? (
    <ExploreSkeleton cardWidth={cardWidth} />
  ) : storefronts.isError ? (
    <StateView
      tone="danger"
      icon={{ sf: 'wifi.exclamationmark', md: 'wifi_off' }}
      title="Chưa tải được danh sách quán"
      body={storefronts.error.message}
      action={{ label: 'Thử lại', onPress: () => void storefronts.refetch() }}
    />
  ) : (
    <View style={{ gap: 4, paddingBottom: 12 }}>
      <StateView
        icon={{ sf: 'storefront', md: 'storefront' }}
        title={text ? `Không có quán nào khớp “${text}”` : `Chưa có quán nào ở ${wardName}`}
        body={
          text
            ? 'Thử một món khác bên dưới, hoặc bỏ bớt bộ lọc.'
            : 'Phường chưa cấp ô vỉa hè nào khớp bộ lọc này.'
        }
        action={
          !text && (wardId != null || categoryId != null || openNow)
            ? {
                label: 'Bỏ bộ lọc',
                onPress: () => {
                  resetFilters();
                  setFilters({ wardId: null });
                },
              }
            : undefined
        }
      />
      {text ? (
        // Never a dead end: suggest the categories that do have stalls
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, paddingHorizontal: 20 }}>
          {(categories.data ?? []).slice(0, 6).map((c) => (
            <Chip key={c.categoryId} label={c.categoryName} onPress={() => runSearch(c.categoryName)} />
          ))}
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Stack.Screen options={{ headerShown: false }} />

      <Animated.FlatList
        data={storefronts.isSuccess ? rows : []}
        keyExtractor={(r: Row) => (r.kind === 'stall' ? String(r.stall.storefrontId) : 'closed')}
        style={{ flex: 1 }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: cart?.items.length ? 112 : 32 }}
        ListHeaderComponent={header}
        renderItem={({ item }: { item: Row }) =>
          item.kind === 'closed' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 4 }}>
              <Icon sf="moon.zzz.fill" md="bedtime" size={16} color={colors.muted} />
              <Text style={[{ fontFamily: fonts.heavy, fontSize: 15.5, color: colors.muted }, tabular]}>
                Đang đóng cửa, {item.count} quán
              </Text>
            </View>
          ) : (
            <View>
              <StallRow stall={item.stall} onPress={() => openStall(item.stall.storefrontId)} />
              {item.divider ? (
                <View style={{ height: 1, marginLeft: 20 + 88 + 14, backgroundColor: colors.separator }} />
              ) : null}
            </View>
          )
        }
        ListEmptyComponent={emptyState}
        refreshing={storefronts.isRefetching}
        onRefresh={() => {
          void storefronts.refetch();
          void dishes.refetch();
        }}
      />

      {/* Compact sign: the pickup ward and the cart, once the big sign has scrolled away */}
      <Animated.View
        pointerEvents="box-none"
        style={[
          {
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            paddingTop: insets.top + 4,
            paddingBottom: 8,
            paddingHorizontal: 20,
            backgroundColor: colors.brand,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 8px 20px -12px rgba(207, 74, 11, 0.6)',
          },
          barStyle,
        ]}
      >
        <BarContent
          wardName={wardName}
          count={count}
          onArea={() => setSheet('area')}
          onCart={() => setSheet('cart')}
        />
      </Animated.View>

      <CartBar cart={cart} onPress={() => setSheet('cart')} />

      <AreaSheet visible={sheet === 'area'} onClose={() => setSheet(null)} />
      <SortSheet visible={sheet === 'sort'} onClose={() => setSheet(null)} />
      <CartSheet cart={cart} visible={sheet === 'cart'} onClose={() => setSheet(null)} />
    </View>
  );
}

function BarContent({
  wardName,
  count,
  onArea,
  onCart,
}: {
  wardName: string;
  count: number;
  onArea: () => void;
  onCart: () => void;
}) {
  return (
    <>
      <LocationButton wardName={wardName} onPress={onArea} />
      <CartButton count={count} onPress={onCart} />
    </>
  );
}
