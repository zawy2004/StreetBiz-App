import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useState, type ReactNode } from 'react';
import { FlatList, Text, View, useWindowDimensions } from 'react-native';

import { Icon } from '@/components/common/Icon';
import { KerbStrip } from '@/components/common/KerbStrip';
import { PressableScale } from '@/components/common/PressableScale';
import { colors, fonts, radius, space } from '@/theme';

const HEIGHT = 140;
const GAP = 12;

type Slide = { key: string; label: string; onPress: () => void; render: () => ReactNode };

/**
 * Three honest banners, swiped by hand (nothing rotates by itself): the slogan over the
 * project's own street photo, how ordering works (order ahead, pick up), and why a stall can
 * be trusted. No promotions: the backend has none, so the app never pretends to.
 */
export function HeroBanner({ onMap, onScan }: { onMap: () => void; onScan: () => void }) {
  const { width } = useWindowDimensions();
  const cardWidth = width - 2 * space.md;
  const [index, setIndex] = useState(0);

  const slides: Slide[] = [
    {
      key: 'slogan',
      label: 'Món ngon vỉa hè, quán có phép. Xem quán trên bản đồ',
      onPress: onMap,
      render: () => (
        <>
          <Image
            source={require('@/assets/images/hero/hanoi-street-960.webp')}
            style={{ position: 'absolute', width: '100%', height: '100%' }}
            contentFit="cover"
            contentPosition={{ right: 0, top: '40%' }}
            accessibilityIgnoresInvertColors
          />
          <LinearGradient
            colors={['rgba(232,80,0,0.97)', 'rgba(238,85,0,0.82)', 'rgba(255,106,31,0)']}
            locations={[0, 0.48, 0.92]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
          />
          <View
            style={{ flex: 1, padding: 16, paddingBottom: 18, justifyContent: 'space-between' }}
          >
            <Pill text="Ẩm thực vỉa hè có phép" />
            <View style={{ gap: 4, width: '68%' }}>
              <Text
                style={{
                  fontFamily: fonts.heavy,
                  fontSize: 21,
                  lineHeight: 26,
                  color: colors.white,
                }}
              >
                Món ngon vỉa hè,{'\n'}quán có phép.
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 13.5, color: colors.white }}>
                  Xem quán quanh bạn
                </Text>
                <Icon
                  sf="arrow.right"
                  md="arrow_forward"
                  size={13}
                  color={colors.white}
                  weight="bold"
                />
              </View>
            </View>
          </View>
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
            <KerbStrip height={6} segment={22} />
          </View>
        </>
      ),
    },
    {
      key: 'how',
      label: 'Đặt trước, đến lấy, khỏi chờ: chọn món, trả trước, đến quầy lấy',
      onPress: onMap,
      render: () => (
        <>
          <LinearGradient
            colors={[colors.cta, colors.brand, colors.brandLight]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
          />
          {/* Mango sun, the second colour of the brand, kept to a corner */}
          <View
            style={{
              position: 'absolute',
              right: -46,
              top: -52,
              width: 170,
              height: 170,
              borderRadius: 85,
              backgroundColor: 'rgba(255,183,3,0.55)',
            }}
          />
          <View style={{ flex: 1, padding: 16, justifyContent: 'space-between' }}>
            <View style={{ gap: 2 }}>
              <Text
                style={{
                  fontFamily: fonts.heavy,
                  fontSize: 19,
                  lineHeight: 24,
                  color: colors.white,
                }}
              >
                Đặt trước, đến lấy
              </Text>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 13.5, color: colors.white }}>
                Món làm sẵn khi bạn tới, khỏi đứng chờ.
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Step icon={{ sf: 'fork.knife', md: 'restaurant' }} label="Chọn món" />
              <Dash />
              <Step icon={{ sf: 'creditcard.fill', md: 'credit_card' }} label="Trả trước" />
              <Dash />
              <Step icon={{ sf: 'bag.fill', md: 'shopping_bag' }} label="Đến lấy" />
            </View>
          </View>
        </>
      ),
    },
    {
      key: 'trust',
      label: 'Quán nào cũng có giấy phép của phường. Quét QR ở quầy để kiểm tra',
      onPress: onScan,
      render: () => (
        <View
          style={{
            flex: 1,
            backgroundColor: colors.signTint,
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <View style={{ flex: 1, gap: 6 }}>
            <Text
              style={{ fontFamily: fonts.heavy, fontSize: 18, lineHeight: 23, color: colors.ink }}
            >
              Quán nào cũng có phép
            </Text>
            <Text
              style={{
                fontFamily: fonts.regular,
                fontSize: 13.5,
                lineHeight: 18,
                color: '#2B3640',
              }}
            >
              Quét QR ở quầy để kiểm tra với phường.
            </Text>
            <View
              style={{
                alignSelf: 'flex-start',
                marginTop: 4,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                backgroundColor: colors.sign,
                borderRadius: 999,
                paddingHorizontal: 12,
                paddingVertical: 6,
              }}
            >
              <Icon sf="qrcode.viewfinder" md="qr_code_scanner" size={14} color={colors.white} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.white }}>
                Quét QR
              </Text>
            </View>
          </View>
          <View
            style={{
              width: 78,
              height: 78,
              borderRadius: 39,
              backgroundColor: colors.white,
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 10px 24px -12px rgba(10, 95, 168, 0.45)',
            }}
          >
            <Icon sf="checkmark.seal.fill" md="verified" size={40} color={colors.sign} />
          </View>
        </View>
      ),
    },
  ];

  return (
    <View style={{ gap: 10 }}>
      <FlatList
        horizontal
        data={slides}
        keyExtractor={(s) => s.key}
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardWidth + GAP}
        decelerationRate="fast"
        disableIntervalMomentum
        contentContainerStyle={{ paddingHorizontal: space.md, gap: GAP }}
        onMomentumScrollEnd={(e) =>
          setIndex(Math.round(e.nativeEvent.contentOffset.x / (cardWidth + GAP)))
        }
        renderItem={({ item }) => (
          <PressableScale
            onPress={item.onPress}
            accessibilityLabel={item.label}
            style={{
              width: cardWidth,
              height: HEIGHT,
              borderRadius: radius.card,
              borderCurve: 'continuous',
              overflow: 'hidden',
            }}
          >
            {item.render()}
          </PressableScale>
        )}
      />
      <View
        style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {slides.map((s, i) => (
          <View
            key={s.key}
            style={{
              width: i === index ? 18 : 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: i === index ? colors.cta : colors.line,
            }}
          />
        ))}
      </View>
    </View>
  );
}

function Pill({ text }: { text: string }) {
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: 'rgba(255,255,255,0.22)',
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
      }}
    >
      <Icon sf="checkmark.seal.fill" md="verified" size={12} color={colors.white} />
      <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.white }}>{text}</Text>
    </View>
  );
}

function Step({ icon, label }: { icon: { sf: string; md: string }; label: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 4, width: 70 }}>
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: colors.white,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon sf={icon.sf} md={icon.md} size={17} color={colors.cta} />
      </View>
      <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: colors.white }}>{label}</Text>
    </View>
  );
}

function Dash() {
  return (
    <View
      style={{
        flex: 1,
        height: 2,
        marginBottom: 18,
        borderRadius: 1,
        backgroundColor: 'rgba(255,255,255,0.55)',
      }}
    />
  );
}
