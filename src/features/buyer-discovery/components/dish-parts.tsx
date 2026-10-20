import { Image } from 'expo-image';
import { memo, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/common/Icon';
import { PressableScale } from '@/components/common/PressableScale';
import { StockTag } from '@/components/status/MockBadge';
import type { MarketplaceMenuItem } from '@/core/api/types';
import { colors, fonts, radius } from '@/theme';
import { formatVnd } from '@/utils/format';
import { PriceSticker } from '@/ui';
import { QtyStepper } from '@/features/cart/components/cart-parts';
import { menuItemPhotos } from '../food-photos';

/**
 * A dish you can add without leaving Khám phá (v5 "Biển hiệu phố"): a big square photo that
 * sells it, the price on a mango sticker stuck to the photo's corner like on a stall's glass,
 * and the orange + under the thumb. Once in the cart the + becomes a − n + stepper in place.
 * `width` is the grid column (two per row).
 */
export const DishTile = memo(function DishTile({
  item,
  width,
  quantity,
  onAdd,
  onQuantity,
  onOpen,
}: {
  item: MarketplaceMenuItem;
  width: number;
  quantity: number;
  onAdd: () => void;
  onQuantity: (n: number) => void;
  onOpen: () => void;
}) {
  const photos = useMemo(() => menuItemPhotos(item), [item]);
  const [failed, setFailed] = useState(0);
  const photo = photos[failed];
  const soldOut = item.availabilityStatus !== 'AVAILABLE';
  const photoHeight = Math.round(width * 0.92);

  return (
    <View style={{ width, gap: 8 }}>
      <View style={{ paddingTop: 8 }}>
        <PressableScale
          onPress={onOpen}
          accessibilityLabel={`${item.itemName}, ${soldOut ? 'hết món' : formatVnd(item.unitPrice)}, quán ${item.storefrontName}`}
          style={{
            width,
            height: photoHeight,
            borderRadius: radius.photo,
            borderCurve: 'continuous',
            overflow: 'hidden',
            backgroundColor: colors.sunken,
          }}
        >
          {photo ? (
            <Image
              source={photo.source}
              recyclingKey={String(item.menuItemId)}
              style={{ width: '100%', height: '100%', opacity: soldOut ? 0.45 : 1 }}
              contentFit="cover"
              transition={160}
              onError={() => setFailed((n) => n + 1)}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Icon sf="fork.knife" md="restaurant" size={28} color={colors.muted} />
            </View>
          )}
          {item.foodSafetyCertified ? (
            <View
              style={{
                position: 'absolute',
                right: 8,
                top: 8,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 3,
                backgroundColor: colors.white,
                borderRadius: 999,
                paddingHorizontal: 7,
                height: 24,
              }}
            >
              <Icon sf="checkmark.shield.fill" md="verified_user" size={12} color={colors.leaf} />
              <Text style={{ fontFamily: fonts.heavy, fontSize: 11, color: colors.onLeaf }}>ATTP</Text>
            </View>
          ) : null}
          {photo?.illustrative ? <StockTag compact style={{ left: 8, bottom: 8 }} /> : null}
        </PressableScale>

        {/* The price, stuck on by hand across the photo's top edge */}
        <PriceSticker
          value={soldOut ? 'Hết món' : formatVnd(item.unitPrice)}
          tilt={-4}
          style={[{ position: 'absolute', top: 0, left: 8 }, soldOut ? { backgroundColor: colors.sunken } : null]}
        />

        {/* Add, or the stepper once it is in the cart, on the photo's lower corner */}
        <View style={{ position: 'absolute', right: 8, bottom: 8 }}>
          {soldOut ? null : quantity > 0 ? (
            <QtyStepper quantity={quantity} onChange={onQuantity} name={item.itemName} />
          ) : (
            <Pressable
              onPress={onAdd}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={`Thêm ${item.itemName} vào giỏ`}
              style={({ pressed }) => ({
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: pressed ? colors.ctaPressed : colors.cta,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 3,
                borderColor: colors.white,
                boxShadow: '0 6px 14px -6px rgba(238, 85, 0, 0.7)',
              })}
            >
              <Icon sf="plus" md="add" size={20} color={colors.white} weight="bold" />
            </Pressable>
          )}
        </View>
      </View>

      <View style={{ gap: 1, paddingHorizontal: 2 }}>
        <Text
          numberOfLines={2}
          style={{ fontFamily: fonts.heavy, fontSize: 15.5, lineHeight: 20, color: colors.ink }}
        >
          {item.itemName}
        </Text>
        <Text
          numberOfLines={1}
          style={{ fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 17, color: colors.muted }}
        >
          {item.storefrontName}
        </Text>
      </View>
    </View>
  );
});
