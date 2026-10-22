import { useMutation } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Keyboard, Pressable, Text, TextInput, View } from 'react-native';

import { Icon } from '@/components/common/Icon';
import { colors, fonts, radius, shadow, sign, tabular } from '@/theme';
import { searchAddress, type AddressMatch } from './forward-geocode';
import type { MapLayer } from './LeafletMap';

/** A white capsule floating over the map (search, legend, buttons). */
const floating = { backgroundColor: 'rgba(255,255,255,0.97)', boxShadow: shadow.raised } as const;

/**
 * Type an address, pick one of the matches, the map flies there (web `AddressSearch`).
 * It only moves the view; it never places a slot.
 */
export function MapAddressSearch({ onPick }: { onPick: (match: AddressMatch) => void }) {
  const [text, setText] = useState('');
  const search = useMutation({ mutationFn: (query: string) => searchAddress(query) });
  const submit = () => {
    if (!text.trim()) return;
    Keyboard.dismiss();
    search.mutate(text);
  };
  return (
    <View style={{ gap: 6 }}>
      <View style={[floating, { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 50, borderRadius: radius.full, paddingLeft: 16, paddingRight: 5 }]}>
        <Icon sf="mappin.and.ellipse" md="location_on" size={18} color={colors.primary} />
        <TextInput
          value={text}
          onChangeText={(t) => {
            setText(t);
            if (search.data || search.isError) search.reset();
          }}
          onSubmitEditing={submit}
          placeholder="Nhập địa chỉ, VD: 14 Phan Thanh"
          placeholderTextColor={colors.muted}
          returnKeyType="search"
          maxLength={120}
          autoCorrect={false}
          accessibilityLabel="Tìm địa chỉ trên bản đồ"
          style={{ flex: 1, minHeight: 44, fontFamily: fonts.semibold, fontSize: 15, color: colors.ink, paddingVertical: 0 }}
        />
        <Pressable
          onPress={submit}
          disabled={!text.trim() || search.isPending}
          accessibilityRole="button"
          accessibilityLabel="Tìm"
          style={({ pressed }) => ({ minHeight: 40, minWidth: 64, paddingHorizontal: 14, borderRadius: radius.full, flexDirection: 'row', gap: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? colors.ctaPressed : colors.cta, opacity: text.trim() ? 1 : 0.45 })}
        >
          {search.isPending ? <ActivityIndicator size="small" color={colors.white} /> : <Icon sf="magnifyingglass" md="search" size={15} color={colors.white} />}
          <Text style={{ fontFamily: fonts.heavy, fontSize: 14, color: colors.white }}>Tìm</Text>
        </Pressable>
      </View>
      {search.isError ? <Note tone="danger">Không tìm được địa chỉ lúc này. Thử lại sau.</Note> : null}
      {search.isSuccess && search.data.length === 0 ? <Note>Không thấy địa chỉ này ở Đà Nẵng. Thử ghi ngắn hơn, hoặc kéo bản đồ.</Note> : null}
      {search.isSuccess && search.data.length > 0 ? (
        <View style={[floating, { borderRadius: radius.photo, overflow: 'hidden' }]}>
          {search.data.map((m, i) => (
            <Pressable
              key={`${m.latitude},${m.longitude}`}
              onPress={() => {
                onPick(m);
                search.reset();
              }}
              accessibilityRole="button"
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'flex-start', gap: 10, minHeight: 48, paddingHorizontal: 14, paddingVertical: 11, backgroundColor: pressed ? colors.brandTint : 'transparent', borderTopWidth: i ? 1 : 0, borderTopColor: colors.separator })}
            >
              <Icon sf="mappin" md="location_on" size={16} color={colors.muted} style={{ marginTop: 2 }} />
              <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 14.5, lineHeight: 20, color: colors.ink }}>{m.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Note({ children, tone }: { children: ReactNode; tone?: 'danger' }) {
  return (
    <View style={[floating, { borderRadius: radius.control, paddingHorizontal: 12, paddingVertical: 8 }]}>
      <Text style={{ fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: tone === 'danger' ? colors.onDanger : colors.muted }}>{children}</Text>
    </View>
  );
}

/** Street map or satellite imagery (web "Bản đồ đường phố / Ảnh vệ tinh"). */
export function MapLayerSwitch({ value, onChange }: { value: MapLayer; onChange: (layer: MapLayer) => void }) {
  const item = (key: MapLayer, label: string, i: number) => {
    const on = value === key;
    return (
      <Pressable
        key={key}
        onPress={() => {
          if (on) return;
          void Haptics.selectionAsync();
          onChange(key);
        }}
        accessibilityRole="radio"
        accessibilityState={{ selected: on }}
        style={{ minHeight: 40, justifyContent: 'center', paddingHorizontal: 12, backgroundColor: on ? colors.brandTint : 'transparent', borderTopWidth: i ? 1 : 0, borderTopColor: colors.separator }}
      >
        <Text style={{ fontFamily: on ? fonts.heavy : fonts.semibold, fontSize: 13, color: on ? colors.primary : colors.ink }}>{label}</Text>
      </Pressable>
    );
  };
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Lớp bản đồ" style={[floating, { borderRadius: radius.control, overflow: 'hidden' }]}>
      {item('street', 'Đường phố', 0)}
      {item('satellite', 'Vệ tinh', 1)}
    </View>
  );
}

/** "Vị trí của tôi (GPS)": asks for the phone's position; the screen flies there and draws the blue dot. */
export function MapGpsButton({ locating, onPress }: { locating: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={locating}
      accessibilityRole="button"
      accessibilityLabel="Vị trí của tôi"
      style={({ pressed }) => [floating, { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 46, paddingHorizontal: 16, borderRadius: radius.full, backgroundColor: pressed ? colors.signTint : floating.backgroundColor }]}
    >
      {locating ? <ActivityIndicator size="small" color={colors.sign} /> : <Icon sf="location.fill" md="my_location" size={17} color={colors.sign} />}
      <Text style={{ fontFamily: fonts.heavy, fontSize: 14, color: colors.ink }}>{locating ? 'Đang định vị…' : 'Vị trí của tôi (GPS)'}</Text>
    </Pressable>
  );
}

export type LegendItem = { key: string; label: string; count: number; color: string; shape: 'dot' | 'diamond' };

/** The map's key with live counts (web `MapLegend`): only what is on the map is listed. */
export function MapLegend({ items }: { items: LegendItem[] }) {
  const shown = items.filter((i) => i.count > 0);
  if (shown.length === 0) return null;
  // Wraps onto a second line instead of scrolling, so every count stays in view.
  return (
    <View accessibilityLabel="Chú giải bản đồ" style={[floating, { flexDirection: 'row', flexWrap: 'wrap', alignSelf: 'flex-start', padding: 4, borderRadius: radius.photo }]}>
      {shown.map((i) => (
        <View key={i.key} accessible accessibilityLabel={`${i.label}: ${i.count}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 30, paddingHorizontal: 9 }}>
          <View style={{ width: 12, height: 12, borderRadius: i.shape === 'dot' ? 6 : 2, backgroundColor: i.color, borderWidth: 2, borderColor: colors.white, transform: i.shape === 'diamond' ? [{ rotate: '45deg' }] : undefined, boxShadow: '0 0 0 1px rgba(17,28,43,0.18)' }} />
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.ink }}>{i.label}</Text>
          <Text style={[sign.price, { fontSize: 15, lineHeight: 18, color: colors.ink }, tabular]}>{i.count}</Text>
        </View>
      ))}
    </View>
  );
}
