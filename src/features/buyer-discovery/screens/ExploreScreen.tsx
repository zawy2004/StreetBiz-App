import { router, Stack, type Href } from 'expo-router';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { FlatList, Keyboard, Pressable, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip } from '@/components/common/Chip';
import { Icon } from '@/components/common/Icon';
import { StateView } from '@/components/feedback/StateView';
import type { MarketplaceMenuItem, StorefrontSummary } from '@/core/api/types';
import { colors, easeOut, fonts, space, tabular } from '@/theme';
import { cartCount, useAddToCart, useCart, useSetCartQuantity } from '@/features/cart/cart-api';
import { ActiveOrderCard, CartBar, CartSheet } from '@/features/cart/components/cart-parts';
import { useCustomerOrders } from '@/features/orders/hooks/useOrders';
import { useAuthStore } from '@/store/auth-store';
import { menuItemQuery, storefrontQuery } from '../discovery-filters';
import { DishCard, DISH_WIDTH } from '../components/dish-parts';
import {
  CartButton,
  LocationButton,
  SearchField,
  SearchSuggestions,
} from '../components/explore-header';
import { AreaSheet, SortSheet } from '../components/filter-sheets';
import { HeroBanner } from '../components/hero-banner';
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

/**
 * M-C01 Khám phá — the buyer's home, built like a food marketplace:
 * - the pickup ward and the cart stay pinned at the top; a hairline appears once content
 *   scrolls under them;
 * - the search field is always in reach and suggests searches while focused;
 * - an order in progress comes first;
 * - then hand-swiped banners, categories, dishes to add straight to the cart, open stalls nearby;
 * - every stall last, with its filters, open ones before closed;
 * - the cart floats at the bottom as soon as it has something in it.
 */
export function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(300, Math.round(width * 0.72));

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
  // Dishes only from stalls open now: everything in this rail can be ordered this minute
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
  const nearbyOpen = useMemo(() => list.filter((s) => s.isOpenNow).slice(0, 5), [list]);
  const dishList = useMemo(() => dishes.data ?? [], [dishes.data]);
  const dishNames = useMemo(
    () => [...new Set(dishList.map((d) => d.itemName))].slice(0, 6),
    [dishList],
  );
  const [sheet, setSheet] = useState<'area' | 'sort' | 'cart' | null>(null);
  const [searching, setSearching] = useState(false);

  // Hairline under the pinned bar once content scrolls beneath it (UI thread, no re-render)
  const scrolled = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrolled.set(e.contentOffset.y > 4 ? 1 : 0);
  });
  const hairline = useAnimatedStyle(() => ({
    opacity: withTiming(scrolled.get(), { duration: 160, easing: easeOut }),
  }));

  const openStall = useCallback((storefrontId: number) => {
    router.push(`/customer/explore/stores/${storefrontId}` as Href);
  }, []);
  const openDish = useCallback((menuItemId: number) => {
    router.push(`/customer/explore/items/${menuItemId}` as Href);
  }, []);

  const runSearch = (q: string) => {
    setQuery(q);
    remember(q);
    Keyboard.dismiss();
  };

  const showSuggestions = searching && !text;

  const header = (
    <View style={{ gap: 20, paddingTop: 4, paddingBottom: 4 }}>
      <SearchField
        value={query}
        onChange={setQuery}
        focused={searching}
        onFocus={() => setSearching(true)}
        onBlur={() => setSearching(false)}
        onSubmit={() => remember(query)}
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

      {!text && !searching ? (
        <HeroBanner
          onMap={() => router.push('/customer/explore/map' as Href)}
          onScan={() => router.navigate('/customer/scan' as Href)}
        />
      ) : null}

      <CategoryRail
        categories={categories.data ?? []}
        selected={categoryId}
        onSelect={(id) => setFilters({ categoryId: id })}
      />

      {dishList.length ? (
        <Section
          title={text ? 'Món khớp tìm kiếm' : 'Món ngon đang bán'}
          note={text ? undefined : 'Bấm + để thêm vào giỏ, tới quầy là có món.'}
        >
          <FlatList
            horizontal
            data={dishList}
            keyExtractor={(m) => String(m.menuItemId)}
            showsHorizontalScrollIndicator={false}
            snapToInterval={DISH_WIDTH + 12}
            decelerationRate="fast"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: space.md, gap: 12 }}
            renderItem={({ item }: { item: MarketplaceMenuItem }) => (
              <DishCard
                item={item}
                quantity={qtyById.get(item.menuItemId) ?? 0}
                onAdd={() => addToCart(item)}
                onQuantity={(n) => setQty.mutate({ menuItemId: item.menuItemId, quantity: n })}
                onOpen={() => openDish(item.menuItemId)}
              />
            )}
          />
        </Section>
      ) : null}

      {!text && nearbyOpen.length > 0 ? (
        <Section
          title="Quán đang mở gần bạn"
          action={
            <Pressable
              onPress={() => router.push('/customer/explore/map' as Href)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Xem các quán trên bản đồ"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              <Icon sf="map.fill" md="map" size={14} color={colors.primary} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.primary }}>
                Bản đồ
              </Text>
            </Pressable>
          }
        >
          <FlatList
            horizontal
            data={nearbyOpen}
            keyExtractor={(s) => String(s.storefrontId)}
            showsHorizontalScrollIndicator={false}
            snapToInterval={cardWidth + 12}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: space.md, gap: 12, paddingBottom: 10 }}
            renderItem={({ item }) => (
              <NearbyCard
                stall={item}
                width={cardWidth}
                onPress={() => openStall(item.storefrontId)}
              />
            )}
          />
        </Section>
      ) : null}

      {/* Every stall, with the filters that act on this list right above it */}
      <View style={{ gap: 12 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: space.md,
            gap: 8,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <Text
              style={{ fontFamily: fonts.heavy, fontSize: 19, lineHeight: 25, color: colors.ink }}
            >
              {text ? 'Quán khớp tìm kiếm' : 'Tất cả quán'}
            </Text>
            {storefronts.isSuccess ? (
              <Text
                style={[{ fontFamily: fonts.semibold, fontSize: 15, color: colors.muted }, tabular]}
              >
                {list.length}
              </Text>
            ) : null}
          </View>
        </View>
        <View
          style={{ flexDirection: 'row', gap: 8, paddingHorizontal: space.md, flexWrap: 'wrap' }}
        >
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
                  <View
                    style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.leaf }}
                  />
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
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 8,
            paddingHorizontal: space.md,
          }}
        >
          {(categories.data ?? []).slice(0, 6).map((c) => (
            <Chip
              key={c.categoryId}
              label={c.categoryName}
              onPress={() => runSearch(c.categoryName)}
            />
          ))}
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Pinned top bar: where you pick up, and the cart */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: 10,
          paddingHorizontal: space.md,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: colors.bg,
          zIndex: 1,
        }}
      >
        <LocationButton wardName={wardName} onPress={() => setSheet('area')} />
        <CartButton count={cartCount(cart)} onPress={() => setSheet('cart')} />
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: 1,
              backgroundColor: colors.separator,
              boxShadow: '0 4px 10px rgba(17, 28, 43, 0.06)',
            },
            hairline,
          ]}
        />
      </View>

      <Animated.FlatList
        data={storefronts.isSuccess ? rows : []}
        keyExtractor={(r: Row) => (r.kind === 'stall' ? String(r.stall.storefrontId) : 'closed')}
        style={{ flex: 1 }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: cart?.items.length ? 104 : 28 }}
        ListHeaderComponent={header}
        renderItem={({ item }: { item: Row }) =>
          item.kind === 'closed' ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingHorizontal: space.md,
                paddingTop: 22,
                paddingBottom: 4,
              }}
            >
              <Icon sf="moon.zzz.fill" md="bedtime" size={15} color={colors.muted} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.muted }}>
                Đang đóng cửa · {item.count}
              </Text>
            </View>
          ) : (
            <View>
              <StallRow stall={item.stall} onPress={() => openStall(item.stall.storefrontId)} />
              {item.divider ? (
                <View
                  style={{
                    height: 1,
                    marginLeft: space.md + 84 + 14,
                    backgroundColor: colors.separator,
                  }}
                />
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

      <CartBar cart={cart} onPress={() => setSheet('cart')} />

      <AreaSheet visible={sheet === 'area'} onClose={() => setSheet(null)} />
      <SortSheet visible={sheet === 'sort'} onClose={() => setSheet(null)} />
      <CartSheet cart={cart} visible={sheet === 'cart'} onClose={() => setSheet(null)} />
    </View>
  );
}

function Section({
  title,
  note,
  action,
  children,
}: {
  title: string;
  note?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View style={{ gap: 12 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          paddingHorizontal: space.md,
          gap: 12,
        }}
      >
        <View style={{ flex: 1, gap: 1 }}>
          <Text
            style={{ fontFamily: fonts.heavy, fontSize: 19, lineHeight: 25, color: colors.ink }}
          >
            {title}
          </Text>
          {note ? (
            <Text
              style={{
                fontFamily: fonts.regular,
                fontSize: 13,
                lineHeight: 18,
                color: colors.muted,
              }}
            >
              {note}
            </Text>
          ) : null}
        </View>
        {action}
      </View>
      {children}
    </View>
  );
}
