import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { memo, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Icon } from '@/components/common/Icon';
import { PressableScale } from '@/components/common/PressableScale';
import { Skeleton } from '@/components/feedback/Skeleton';
import { StockTag } from '@/components/status/MockBadge';
import type { MarketplaceCategory, StorefrontSummary } from '@/core/api/types';
import { colors, fonts, radius, shadow, space, tabular, text } from '@/theme';
import { formatDistance, formatVnd, todayHoursText } from '@/utils/format';
import { categoryPhoto, storefrontPhotos } from '../food-photos';

/** The stall's own photo first, then a stock one labelled "Ảnh minh họa"; a dish glyph if all fail. */
function StallPhoto({
  stall,
  width,
  height,
  rounded,
  compactTag,
}: {
  stall: StorefrontSummary;
  width: number | '100%';
  height: number;
  rounded: number;
  compactTag?: boolean;
}) {
  const candidates = useMemo(() => storefrontPhotos(stall), [stall]);
  const [failed, setFailed] = useState(0);
  const photo = candidates[failed];
  return (
    <View
      style={{
        width,
        height,
        borderRadius: rounded,
        borderCurve: 'continuous',
        overflow: 'hidden',
        backgroundColor: photo ? colors.sunken : colors.brandTint,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {photo ? (
        <Image
          source={photo.source}
          style={{ width: '100%', height: '100%', opacity: stall.isOpenNow ? 1 : 0.6 }}
          contentFit="cover"
          transition={160}
          onError={() => setFailed((n) => n + 1)}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <Icon sf="fork.knife" md="restaurant" size={26} color={colors.primary} />
      )}
      {photo?.illustrative ? (
        <StockTag compact style={compactTag ? { left: 4, bottom: 4 } : { left: 10, top: 10 }} />
      ) : null}
    </View>
  );
}

function openLine(stall: StorefrontSummary) {
  const hours = todayHoursText(stall);
  if (stall.isOpenNow) {
    const close = stall.todayHours[0]?.closesAt;
    return close ? `Mở đến ${close}` : 'Đang mở';
  }
  const open = stall.todayHours[0]?.opensAt;
  return open ? `Mở lúc ${open}` : (hours ?? 'Đóng cửa');
}

/** 312, 1,2k — counts read like a product, not a database. */
function compactCount(n: number) {
  return n < 1000
    ? String(n)
    : `${(n / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}k`;
}

/** ★ 4,9 (312): the score with how many people stand behind it. */
export function Rating({ stall, size = 13 }: { stall: StorefrontSummary; size?: number }) {
  if (stall.communityRating == null) {
    return (
      <Text style={{ fontFamily: fonts.medium, fontSize: size, color: colors.muted }}>
        Quán mới
      </Text>
    );
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
      <Icon sf="star.fill" md="star" size={size} color={colors.mango} />
      <Text style={[{ fontFamily: fonts.bold, fontSize: size, color: colors.ink }, tabular]}>
        {stall.communityRating.toLocaleString('vi-VN')}
      </Text>
      <Text style={[{ fontFamily: fonts.regular, fontSize: size, color: colors.muted }, tabular]}>
        ({compactCount(stall.communityCount)})
      </Text>
    </View>
  );
}

/**
 * What sets StreetBiz apart from other food apps: the ward licensed this pavement slot.
 * Says so in words a buyer understands, with the slot code after it.
 */
export function LicensedBadge({ slotCode }: { slotCode: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        alignSelf: 'flex-start',
        backgroundColor: colors.leafTint,
        borderRadius: 999,
        paddingLeft: 6,
        paddingRight: 8,
        paddingVertical: 3,
      }}
      accessibilityLabel={`Có giấy phép của phường, ô ${slotCode}`}
    >
      <Icon sf="checkmark.seal.fill" md="verified" size={12} color={colors.leaf} />
      <Text
        style={{ fontFamily: fonts.bold, fontSize: 11.5, lineHeight: 15, color: colors.onLeaf }}
      >
        Có phép
      </Text>
      <Text
        style={{ fontFamily: fonts.medium, fontSize: 11.5, lineHeight: 15, color: colors.onLeaf }}
      >
        · Ô {slotCode}
      </Text>
    </View>
  );
}

/** Browse by craving: round dish photos, the selected one ringed in orange. */
export function CategoryRail({
  categories,
  selected,
  onSelect,
}: {
  categories: MarketplaceCategory[];
  selected: number | null;
  onSelect: (id: number | null) => void;
}) {
  const item = (id: number | null, label: string, photo?: number) => {
    const on = id === selected;
    return (
      <Pressable
        key={id ?? 'all'}
        onPress={() => {
          void Haptics.selectionAsync();
          onSelect(on && id != null ? null : id);
        }}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: on }}
        style={{ alignItems: 'center', width: 78, gap: 6 }}
      >
        <View
          style={{
            width: 66,
            height: 66,
            borderRadius: 33,
            padding: 3,
            borderWidth: 2.5,
            borderColor: on ? colors.cta : 'transparent',
          }}
        >
          {photo != null ? (
            <Image
              source={photo}
              style={{ width: '100%', height: '100%', borderRadius: 30 }}
              contentFit="cover"
            />
          ) : (
            <LinearGradient
              colors={[colors.brandLight, colors.cta]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ flex: 1, borderRadius: 30, alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon sf="fork.knife" md="restaurant" size={24} color={colors.white} />
            </LinearGradient>
          )}
        </View>
        <Text
          numberOfLines={2}
          style={{
            fontFamily: on ? fonts.bold : fonts.medium,
            fontSize: 12.5,
            lineHeight: 16,
            textAlign: 'center',
            color: on ? colors.primary : colors.ink,
          }}
        >
          {label}
        </Text>
      </Pressable>
    );
  };
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: space.md - 6, gap: 2 }}
    >
      {item(null, 'Tất cả')}
      {categories.map((c) =>
        item(c.categoryId, c.categoryName, categoryPhoto(c.categoryName) as number),
      )}
    </ScrollView>
  );
}

/** An open stall nearby: photo, name, the numbers that decide (rating, distance, price), the licence. */
export const NearbyCard = memo(function NearbyCard({
  stall,
  width,
  onPress,
}: {
  stall: StorefrontSummary;
  width: number;
  onPress: () => void;
}) {
  const photoHeight = Math.round(width * 0.56);
  const distance = formatDistance(stall.distanceMeters);
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={`${stall.storefrontName}, có phép ô ${stall.slotCode}${distance ? `, cách ${distance}` : ''}${stall.minPrice != null ? `, từ ${formatVnd(stall.minPrice)}` : ''}`}
      style={{ width }}
    >
      <View
        style={{
          borderRadius: radius.card,
          borderCurve: 'continuous',
          overflow: 'hidden',
          backgroundColor: colors.card,
          boxShadow: shadow.card,
        }}
      >
        <StallPhoto stall={stall} width="100%" height={photoHeight} rounded={0} />
        <LinearGradient
          colors={['rgba(10,14,20,0)', 'rgba(10,14,20,0.55)']}
          locations={[0.55, 1]}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, height: photoHeight }}
          pointerEvents="none"
        />
        <View
          style={{
            position: 'absolute',
            left: 10,
            top: photoHeight - 34,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {distance ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 3,
                backgroundColor: colors.white,
                borderRadius: 999,
                paddingHorizontal: 8,
                paddingVertical: 3,
              }}
            >
              <Icon sf="location.fill" md="near_me" size={10} color={colors.cta} />
              <Text style={[{ fontFamily: fonts.bold, fontSize: 12, color: colors.ink }, tabular]}>
                {distance}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={{ padding: 12, paddingTop: 10, gap: 6 }}>
          <Text
            numberOfLines={1}
            style={{ fontFamily: fonts.bold, fontSize: 16.5, color: colors.ink }}
          >
            {stall.storefrontName}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Rating stall={stall} />
            <Text style={{ color: colors.line }}>|</Text>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.leaf }} />
            <Text numberOfLines={1} style={[text.footnote, { flex: 1, color: colors.onLeaf }]}>
              {openLine(stall)}
            </Text>
          </View>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            {stall.minPrice != null ? (
              <Text
                style={[{ fontFamily: fonts.regular, fontSize: 13, color: colors.muted }, tabular]}
              >
                Từ{' '}
                <Text style={{ fontFamily: fonts.heavy, fontSize: 15.5, color: colors.primary }}>
                  {formatVnd(stall.minPrice)}
                </Text>
              </Text>
            ) : (
              <View />
            )}
            <LicensedBadge slotCode={stall.slotCode} />
          </View>
        </View>
      </View>
    </PressableScale>
  );
});

/** A list row: highlights under the finger (no scale); the price takes the right-hand column. */
export const StallRow = memo(function StallRow({
  stall,
  onPress,
}: {
  stall: StorefrontSummary;
  onPress: () => void;
}) {
  const distance = formatDistance(stall.distanceMeters);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${stall.storefrontName}, ${stall.isOpenNow ? 'đang mở' : 'đóng cửa'}${stall.minPrice != null ? `, từ ${formatVnd(stall.minPrice)}` : ''}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingHorizontal: space.md,
        paddingVertical: 12,
        backgroundColor: pressed ? colors.pressed : colors.bg,
      })}
    >
      <StallPhoto stall={stall} width={84} height={84} rounded={radius.photo} compactTag />
      <View style={{ flex: 1, gap: 5 }}>
        <Text numberOfLines={1} style={[text.headline, { color: colors.ink }]}>
          {stall.storefrontName}
        </Text>
        {/* Where to go and pick up: the street first, the licensed slot after it */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Icon sf="mappin" md="location_on" size={12} color={colors.muted} />
          <Text numberOfLines={1} style={[text.footnote, { flexShrink: 1, color: colors.muted }]}>
            {stall.zoneName} · Ô {stall.slotCode}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Rating stall={stall} size={12.5} />
          <Text style={{ color: colors.line }}>|</Text>
          <Text
            numberOfLines={1}
            style={[
              text.footnote,
              { flexShrink: 1, color: stall.isOpenNow ? colors.onLeaf : colors.muted },
            ]}
          >
            {openLine(stall)}
          </Text>
        </View>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 3, minWidth: 78 }}>
        {stall.minPrice != null ? (
          <>
            <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: colors.muted }}>
              Từ
            </Text>
            <Text
              style={[{ fontFamily: fonts.heavy, fontSize: 15, color: colors.primary }, tabular]}
            >
              {formatVnd(stall.minPrice)}
            </Text>
          </>
        ) : null}
        {distance ? (
          <Text style={[{ fontFamily: fonts.code, fontSize: 13, color: colors.muted }, tabular]}>
            {distance}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
});

export function ExploreSkeleton({ cardWidth }: { cardWidth: number }) {
  return (
    <View style={{ gap: 18 }} accessibilityLabel="Đang tải quán ăn">
      <View
        style={{ flexDirection: 'row', gap: 12, paddingHorizontal: space.md, overflow: 'hidden' }}
      >
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ gap: 8 }}>
            <Skeleton width={156} height={132} radius={radius.card} />
            <Skeleton width={80} height={14} />
            <Skeleton width={120} height={13} />
          </View>
        ))}
      </View>
      <View
        style={{ flexDirection: 'row', gap: 12, paddingHorizontal: space.md, overflow: 'hidden' }}
      >
        <Skeleton
          width={cardWidth}
          height={Math.round(cardWidth * 0.56) + 96}
          radius={radius.card}
        />
        <Skeleton
          width={cardWidth}
          height={Math.round(cardWidth * 0.56) + 96}
          radius={radius.card}
        />
      </View>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{
            flexDirection: 'row',
            gap: 14,
            alignItems: 'center',
            paddingHorizontal: space.md,
          }}
        >
          <Skeleton width={84} height={84} radius={radius.photo} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton width="65%" height={15} />
            <Skeleton width="45%" height={13} />
            <Skeleton width="35%" height={13} />
          </View>
        </View>
      ))}
    </View>
  );
}
