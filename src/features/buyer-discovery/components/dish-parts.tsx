import { Image } from 'expo-image';
import { memo, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/common/Icon';
import { PressableScale } from '@/components/common/PressableScale';
import { StockTag } from '@/components/status/MockBadge';
import type { MarketplaceMenuItem } from '@/core/api/types';
import { colors, fonts, radius, tabular } from '@/theme';
import { formatVnd } from '@/utils/format';
import { QtyStepper } from '@/features/cart/components/cart-parts';
import { menuItemPhotos } from '../food-photos';

export const DISH_WIDTH = 156;

/**
 * A dish you can add without leaving Khám phá (DoorDash, Wolt): the photo sells it, the price
 * is the loudest text, and the orange + sits on the photo's corner under the thumb. Once in
 * the cart the + becomes a − n + stepper in place.
 */
export const DishCard = memo(function DishCard({
  item,
  quantity,
  onAdd,
  onQuantity,
  onOpen,
}: {
  item: MarketplaceMenuItem;
  quantity: number;
  onAdd: () => void;
  onQuantity: (n: number) => void;
  onOpen: () => void;
}) {
  const photos = useMemo(() => menuItemPhotos(item), [item]);
  const [failed, setFailed] = useState(0);
  const photo = photos[failed];
  const soldOut = item.availabilityStatus !== 'AVAILABLE';
  const photoSize = DISH_WIDTH;

  return (
    <View style={{ width: DISH_WIDTH, gap: 8 }}>
      <PressableScale
        onPress={onOpen}
        accessibilityLabel={`${item.itemName}, ${formatVnd(item.unitPrice)}, quán ${item.storefrontName}`}
        style={{
          width: photoSize,
          height: photoSize - 24,
          borderRadius: radius.card,
          borderCurve: 'continuous',
          overflow: 'hidden',
          backgroundColor: colors.sunken,
        }}
      >
        {photo ? (
          <Image
            source={photo.source}
            style={{ width: '100%', height: '100%', opacity: soldOut ? 0.45 : 1 }}
            contentFit="cover"
            transition={160}
            onError={() => setFailed((n) => n + 1)}
            accessibilityIgnoresInvertColors
          />
        ) : null}
        {item.foodSafetyCertified ? (
          <View
            style={{
              position: 'absolute',
              left: 8,
              top: 8,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 3,
              backgroundColor: colors.white,
              borderRadius: 999,
              paddingHorizontal: 7,
              paddingVertical: 3,
            }}
          >
            <Icon sf="checkmark.shield.fill" md="verified_user" size={11} color={colors.leaf} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 10.5, color: colors.onLeaf }}>
              ATTP
            </Text>
          </View>
        ) : null}
        {photo?.illustrative ? <StockTag compact style={{ left: 8, bottom: 8 }} /> : null}
      </PressableScale>

      {/* Add, or the stepper once it is in the cart; overlaps the photo's corner */}
      <View style={{ position: 'absolute', right: 8, top: photoSize - 24 - 42 }}>
        {soldOut ? null : quantity > 0 ? (
          <QtyStepper quantity={quantity} onChange={onQuantity} name={item.itemName} compact />
        ) : (
          <Pressable
            onPress={onAdd}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Thêm ${item.itemName} vào giỏ`}
            style={({ pressed }) => ({
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: pressed ? colors.ctaPressed : colors.cta,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 2,
              borderColor: colors.white,
              boxShadow: '0 4px 10px -4px rgba(238, 85, 0, 0.6)',
            })}
          >
            <Icon sf="plus" md="add" size={17} color={colors.white} weight="bold" />
          </Pressable>
        )}
      </View>

      <View style={{ gap: 2, paddingHorizontal: 2 }}>
        <Text style={[{ fontFamily: fonts.heavy, fontSize: 16, color: colors.primary }, tabular]}>
          {soldOut ? 'Hết món' : formatVnd(item.unitPrice)}
        </Text>
        <Text
          numberOfLines={1}
          style={{ fontFamily: fonts.semibold, fontSize: 14.5, lineHeight: 19, color: colors.ink }}
        >
          {item.itemName}
        </Text>
        <Text
          numberOfLines={1}
          style={{ fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 16, color: colors.muted }}
        >
          {item.storefrontName}
        </Text>
      </View>
    </View>
  );
});
