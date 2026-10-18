import { router, Stack, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { SlotPlate } from '@/components/common/SlotPlate';
import { MockBadge } from '@/components/status/MockBadge';
import type { StorefrontSummary } from '@/core/api/types';
import { env } from '@/core/config/env';
import { colors, fonts, radius, shadow, text } from '@/theme';
import { formatDistance } from '@/utils/format';
import { useStorefronts } from '../discovery-api';
import { useDiscoveryStore } from '../discovery-store';

/**
 * The stalls on a map, as its own screen (the web's "Trên bản đồ" tab). The web draws a street
 * sketch rather than tiles, and so does this until the map library is chosen; tapping a pin
 * raises the stall's card above the home indicator.
 */
export function MapScreen() {
  const insets = useSafeAreaInsets();
  const wardId = useDiscoveryStore((s) => s.filters.wardId);
  const position = useDiscoveryStore((s) => s.position);
  const storefronts = useStorefronts({
    wardId: wardId ?? undefined,
    position: position ?? undefined,
    sort: position ? 'distance' : 'name',
  });
  const stalls = useMemo(() => storefronts.data ?? [], [storefronts.data]);
  const [picked, setPicked] = useState<StorefrontSummary | null>(null);

  const bounds = useMemo(() => {
    const lats = stalls.map((s) => s.latitude);
    const lngs = stalls.map((s) => s.longitude);
    return {
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
      minLng: Math.min(...lngs),
      maxLng: Math.max(...lngs),
    };
  }, [stalls]);
  const pos = (s: StorefrontSummary) => ({
    left: `${10 + ((s.longitude - bounds.minLng) / (bounds.maxLng - bounds.minLng || 1)) * 70}%` as const,
    top: `${14 + (1 - (s.latitude - bounds.minLat) / (bounds.maxLat - bounds.minLat || 1)) * 56}%` as const,
  });

  return (
    <View style={{ flex: 1, backgroundColor: '#EEF3EF' }}>
      <Stack.Screen options={{ title: 'Bản đồ quán' }} />
      {/* Street sketch */}
      <View
        style={{
          position: 'absolute',
          top: '28%',
          left: -40,
          right: -40,
          height: 16,
          backgroundColor: colors.white,
          transform: [{ rotate: '-8deg' }],
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: '62%',
          left: -40,
          right: -40,
          height: 16,
          backgroundColor: colors.white,
          transform: [{ rotate: '5deg' }],
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: '36%',
          top: -40,
          bottom: -40,
          width: 16,
          backgroundColor: colors.white,
          transform: [{ rotate: '6deg' }],
        }}
      />
      <View
        style={{
          position: 'absolute',
          right: -40,
          top: -40,
          bottom: -40,
          width: 110,
          backgroundColor: '#CFE6F5',
          transform: [{ rotate: '4deg' }],
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            fontFamily: fonts.semibold,
            fontSize: 13,
            color: '#2E6A93',
            transform: [{ rotate: '-90deg' }],
            width: 100,
            textAlign: 'center',
          }}
        >
          Sông Hàn
        </Text>
      </View>

      {stalls.map((s) => {
        const on = picked?.storefrontId === s.storefrontId;
        const tint = s.isOpenNow ? colors.primary : colors.muted;
        return (
          <Pressable
            key={s.storefrontId}
            onPress={() => {
              void Haptics.selectionAsync();
              setPicked(s);
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`${s.storefrontName}, ô ${s.slotCode}, ${s.isOpenNow ? 'đang mở' : 'đóng cửa'}`}
            style={[
              { position: 'absolute', alignItems: 'center', marginLeft: -30, marginTop: -34 },
              pos(s),
            ]}
          >
            <View
              style={{
                paddingHorizontal: 9,
                paddingVertical: 5,
                borderRadius: 11,
                borderCurve: 'continuous',
                backgroundColor: on ? colors.ink : tint,
                borderWidth: 2,
                borderColor: colors.white,
                minWidth: 60,
                alignItems: 'center',
                boxShadow: shadow.card,
              }}
            >
              <Text style={{ fontFamily: fonts.code, fontSize: 14, color: colors.white }}>
                {s.slotCode}
              </Text>
            </View>
            <View
              style={{
                width: 0,
                height: 0,
                borderLeftWidth: 6,
                borderRightWidth: 6,
                borderTopWidth: 7,
                borderLeftColor: 'transparent',
                borderRightColor: 'transparent',
                borderTopColor: on ? colors.ink : tint,
              }}
            />
          </Pressable>
        );
      })}

      <View
        style={{
          position: 'absolute',
          left: '46%',
          top: '45%',
          width: 18,
          height: 18,
          borderRadius: 9,
          backgroundColor: colors.sign,
          borderWidth: 3,
          borderColor: colors.white,
          boxShadow: shadow.card,
        }}
        accessibilityLabel="Vị trí của bạn"
      />

      <View style={{ position: 'absolute', left: 16, top: 12, gap: 8 }}>
        {env.useMockApi ? <MockBadge /> : null}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: colors.card,
            borderRadius: 999,
            paddingHorizontal: 12,
            paddingVertical: 6,
            alignSelf: 'flex-start',
          }}
        >
          <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary }} />
          <Text style={[text.caption, { color: colors.ink }]}>Đang mở</Text>
          <View
            style={{
              width: 9,
              height: 9,
              borderRadius: 5,
              backgroundColor: colors.muted,
              marginLeft: 8,
            }}
          />
          <Text style={[text.caption, { color: colors.ink }]}>Đóng cửa</Text>
        </View>
      </View>

      {picked ? (
        <Animated.View
          key={picked.storefrontId}
          entering={FadeInDown.duration(220)}
          exiting={FadeOutDown.duration(150)}
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: insets.bottom + 16,
            backgroundColor: colors.card,
            borderRadius: radius.card,
            borderCurve: 'continuous',
            padding: 16,
            gap: 12,
            boxShadow: shadow.raised,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={[text.title3, { color: colors.ink }]}>{picked.storefrontName}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <SlotPlate code={picked.slotCode} />
                <Text style={[text.footnote, { color: colors.muted }]}>
                  {picked.zoneName}, {formatDistance(picked.distanceMeters)}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={() => setPicked(null)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Đóng thẻ quán"
            >
              <Icon sf="xmark.circle.fill" md="cancel" size={24} color={colors.muted} />
            </Pressable>
          </View>
          <Button
            label="Xem quán"
            onPress={() =>
              router.push(`/customer/explore/stores/${picked.storefrontId}` as Href)
            }
          />
        </Animated.View>
      ) : null}
    </View>
  );
}
