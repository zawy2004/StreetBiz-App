import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { memo, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Icon } from '@/components/common/Icon';
import { PressableScale } from '@/components/common/PressableScale';
import { Skeleton } from '@/components/feedback/Skeleton';
import { StockTag } from '@/components/status/MockBadge';
import type { MarketplaceCategory, StorefrontSummary } from '@/core/api/types';
import { Plate, PriceSticker } from '@/ui';
import { colors, fonts, radius, shadow, sign, tabular, text } from '@/theme';
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
export function LicensedBadge({ slotCode, withSlot = true }: { slotCode: string; withSlot?: boolean }) {
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
        {withSlot ? 'Có phép' : 'Có phép của phường'}
      </Text>
      {withSlot ? (
        <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, lineHeight: 15, color: colors.onLeaf }}>
          , ô {slotCode}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Browse by craving: round dish-photo badges ringed in orange tint, the chosen one ringed in
 * solid orange (v5). "Tất cả" is the orange signboard disc.
 */
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
        style={{ alignItems: 'center', width: 76, gap: 8 }}
      >
        <View
          style={{
            width: 70,
            height: 70,
            borderRadius: 35,
            padding: 3,
            backgroundColor: on ? colors.cta : colors.brandTint,
            boxShadow: on ? shadow.glow : undefined,
          }}
        >
          {photo != null ? (
            <Image
              source={photo}
              style={{ width: '100%', height: '100%', borderRadius: 32, borderWidth: 2, borderColor: colors.white }}
              contentFit="cover"
            />
          ) : (
            <View
              style={{
                flex: 1,
                borderRadius: 32,
                borderWidth: 2,
                borderColor: colors.white,
                backgroundColor: colors.brand,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon sf="square.grid.2x2.fill" md="apps" size={24} color={colors.white} />
            </View>
          )}
        </View>
        <Text
          numberOfLines={2}
          style={{
            fontFamily: on ? fonts.heavy : fonts.bold,
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
      contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}
    >
      {item(null, 'Tất cả')}
      {categories.map((c) =>
        item(c.categoryId, c.categoryName, categoryPhoto(c.categoryName) as number),
      )}
    </ScrollView>
  );
}

/**
 * An open stall nearby, as it stands on the street (v5): a wide photo carrying the slot's
 * number plate and the distance, a mango sticker with the cheapest dish, then the name, the
 * score and closing time, and the ward's licence.
 */
export const NearbyCard = memo(function NearbyCard({
  stall,
  width,
  onPress,
}: {
  stall: StorefrontSummary;
  width: number;
  onPress: () => void;
}) {
  const photoHeight = Math.round(width * 0.58);
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
          backgroundColor: colors.card,
          boxShadow: shadow.card,
        }}
      >
        <View
          style={{
            borderTopLeftRadius: radius.card,
            borderTopRightRadius: radius.card,
            overflow: 'hidden',
          }}
        >
          <StallPhoto stall={stall} width="100%" height={photoHeight} rounded={0} compactTag />
        </View>
        <Plate code={stall.slotCode} style={{ position: 'absolute', top: 12, left: 12 }} />
        {distance ? (
          <View
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              backgroundColor: colors.white,
              borderRadius: 999,
              paddingHorizontal: 10,
              height: 28,
            }}
          >
            <Icon sf="location.fill" md="near_me" size={11} color={colors.cta} />
            <Text style={[{ fontFamily: fonts.heavy, fontSize: 12.5, color: colors.ink }, tabular]}>
              {distance}
            </Text>
          </View>
        ) : null}
        {stall.minPrice != null ? (
          <PriceSticker
            value={`từ ${formatVnd(stall.minPrice)}`}
            style={{ position: 'absolute', right: 12, top: photoHeight - 46 }}
          />
        ) : null}
        <View style={{ padding: 14, paddingTop: 12, gap: 6 }}>
          <Text
            numberOfLines={1}
            style={{
              fontFamily: fonts.heavy,
              fontSize: 18,
              lineHeight: 24,
              color: colors.ink,
            }}
          >
            {stall.storefrontName}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Rating stall={stall} />
            <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.line }} />
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.leaf }} />
            <Text
              numberOfLines={1}
              style={{ flex: 1, fontFamily: fonts.bold, fontSize: 13.5, color: colors.onLeaf }}
            >
              {openLine(stall)}
            </Text>
          </View>
          <LicensedBadge slotCode={stall.slotCode} withSlot={false} />
        </View>
      </View>
    </PressableScale>
  );
});

/** A list row: highlights under the finger (no scale); the slot plate sits on the photo's edge. */
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
      accessibilityLabel={`${stall.storefrontName}, ô ${stall.slotCode}, ${stall.isOpenNow ? 'đang mở' : 'đóng cửa'}${stall.minPrice != null ? `, từ ${formatVnd(stall.minPrice)}` : ''}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: pressed ? colors.pressed : colors.canvas,
      })}
    >
      <View style={{ paddingBottom: 6 }}>
        <StallPhoto stall={stall} width={88} height={88} rounded={radius.photo} />
        <Plate
          code={stall.slotCode}
          style={{ position: 'absolute', left: 6, bottom: -2, minHeight: 24, paddingHorizontal: 6 }}
        />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: fonts.heavy,
            fontSize: 16.5,
            lineHeight: 22,
            color: stall.isOpenNow ? colors.ink : colors.muted,
          }}
        >
          {stall.storefrontName}
        </Text>
        {/* Where to go and pick up */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Icon sf="mappin" md="location_on" size={12} color={colors.muted} />
          <Text numberOfLines={1} style={[text.footnote, { flexShrink: 1, color: colors.muted }]}>
            {stall.zoneName}
            {distance ? `, ${distance}` : ''}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Rating stall={stall} size={12.5} />
          <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.line }} />
          <Text
            numberOfLines={1}
            style={{
              flexShrink: 1,
              fontFamily: fonts.bold,
              fontSize: 12.5,
              color: stall.isOpenNow ? colors.onLeaf : colors.muted,
            }}
          >
            {openLine(stall)}
          </Text>
        </View>
      </View>
      {stall.minPrice != null ? (
        <View style={{ alignItems: 'flex-end', gap: 1, minWidth: 72 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 11.5, color: colors.muted }}>Từ</Text>
          <Text maxFontSizeMultiplier={1.4} style={[sign.price, { color: colors.primary }, tabular]}>
            {formatVnd(stall.minPrice)}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
});

/** Same shapes as the loaded screen under the signboard: category discs, the dish grid, rows. */
export function ExploreSkeleton({ cardWidth }: { cardWidth: number }) {
  return (
    <View style={{ gap: 22, paddingTop: 8 }} accessibilityLabel="Đang tải quán ăn">
      <View style={{ flexDirection: 'row', gap: 14, paddingHorizontal: 20, overflow: 'hidden' }}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={{ alignItems: 'center', gap: 8 }}>
            <Skeleton width={70} height={70} radius={35} />
            <Skeleton width={52} height={12} />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 14, paddingHorizontal: 20 }}>
        {[0, 1].map((i) => (
          <View key={i} style={{ flex: 1, gap: 8 }}>
            <Skeleton width="100%" height={Math.round(cardWidth * 0.55)} radius={radius.photo} />
            <Skeleton width="70%" height={15} />
            <Skeleton width="45%" height={12} />
          </View>
        ))}
      </View>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{ flexDirection: 'row', gap: 14, alignItems: 'center', paddingHorizontal: 20 }}
        >
          <Skeleton width={88} height={88} radius={radius.photo} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton width="65%" height={16} />
            <Skeleton width="45%" height={12} />
            <Skeleton width="35%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}
