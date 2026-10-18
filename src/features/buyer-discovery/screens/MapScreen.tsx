import { router, Stack, type Href } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/common/Icon';
import { LeafletMap, type LeafletMapHandle, type MapMarker } from '@/components/map/LeafletMap';
import type { StorefrontSummary } from '@/core/api/types';
import { DEFAULT_CENTER } from '@/features/sidewalk-slots/map-constants';
import { colors, radius, shadow, text } from '@/theme';
import { StallRow } from '../components/stall-parts';
import { useStorefronts } from '../discovery-api';
import { useDiscoveryStore } from '../discovery-store';
import { LOCATE_MESSAGES } from '../geolocation';

/** "Bún chả Hải Châu" → "Bún chả Hải…": short enough for a pin. */
const pinLabel = (name: string) => (name.length > 16 ? `${name.slice(0, 15)}…` : name);

/**
 * The stalls on a real street map (DISC-04): orange pins for open stalls, grey for closed, the
 * buyer's blue dot when known. Tapping a pin raises the stall's card above the home indicator.
 */
export function MapScreen() {
  const insets = useSafeAreaInsets();
  const map = useRef<LeafletMapHandle>(null);
  const wardId = useDiscoveryStore((s) => s.filters.wardId);
  const position = useDiscoveryStore((s) => s.position);
  const locateStatus = useDiscoveryStore((s) => s.locateStatus);
  const locate = useDiscoveryStore((s) => s.locate);
  const storefronts = useStorefronts({ wardId: wardId ?? undefined, position: position ?? undefined, sort: position ? 'distance' : 'name' });
  const stalls = useMemo(() => storefronts.data ?? [], [storefronts.data]);
  const [picked, setPicked] = useState<StorefrontSummary | null>(null);

  const markers = useMemo<MapMarker[]>(
    () =>
      stalls.map((s) => ({
        id: String(s.storefrontId),
        latitude: s.latitude,
        longitude: s.longitude,
        label: pinLabel(s.storefrontName),
        fill: s.isOpenNow ? colors.cta : '#7B8794',
        ink: colors.white,
        selected: picked?.storefrontId === s.storefrontId,
      })),
    [stalls, picked],
  );
  const failed = locateStatus === 'DENIED' || locateStatus === 'UNAVAILABLE' || locateStatus === 'FAILED';

  return (
    <View style={{ flex: 1, backgroundColor: '#EEF3EF' }}>
      <Stack.Screen options={{ title: 'Bản đồ quán' }} />
      <LeafletMap
        ref={map}
        center={position ? [position.latitude, position.longitude] : DEFAULT_CENTER}
        zoom={15}
        markers={markers}
        me={position}
        onMarkerPress={(id) => setPicked(stalls.find((s) => String(s.storefrontId) === id) ?? null)}
        onMapPress={() => setPicked(null)}
        style={{ flex: 1 }}
      />
      <View pointerEvents="box-none" style={{ position: 'absolute', top: 12, left: 12, right: 12, gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.94)', boxShadow: shadow.card }}>
          <Legend color={colors.cta} label="Đang mở" />
          <Legend color="#7B8794" label="Đang đóng" />
          {storefronts.isFetching ? <ActivityIndicator size="small" color={colors.cta} /> : <Text style={[text.caption, { color: colors.muted }]}>{stalls.length} quán</Text>}
        </View>
        {storefronts.isError ? (
          <Pressable onPress={() => void storefronts.refetch()} style={{ alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: colors.dangerTint }}>
            <Text style={[text.footnote, { color: colors.onDanger }]}>Không tải được quán. Chạm để thử lại.</Text>
          </Pressable>
        ) : null}
        {failed ? (
          <View style={{ alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: colors.mangoTint }}>
            <Text style={[text.footnote, { color: colors.onMango }]}>{LOCATE_MESSAGES[locateStatus as keyof typeof LOCATE_MESSAGES]}</Text>
          </View>
        ) : null}
      </View>
      <View pointerEvents="box-none" style={{ position: 'absolute', right: 12, bottom: (picked ? 130 : 20) + insets.bottom, gap: 10 }}>
        <RoundButton
          icon={{ sf: 'location.fill', md: 'my_location' }}
          label="Vị trí của tôi"
          busy={locateStatus === 'LOCATING'}
          onPress={async () => {
            await locate();
            const p = useDiscoveryStore.getState().position;
            if (p) map.current?.flyTo(p.latitude, p.longitude, 16);
          }}
        />
        <RoundButton icon={{ sf: 'arrow.up.left.and.down.right.magnifyingglass', md: 'zoom_out_map' }} label="Xem tất cả quán" onPress={() => map.current?.fitMarkers()} />
      </View>
      {picked ? (
        <View style={{ position: 'absolute', left: 12, right: 12, bottom: 12 + insets.bottom, borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden', boxShadow: shadow.raised }}>
          <StallRow stall={picked} onPress={() => router.push(`/customer/explore/stores/${picked.storefrontId}` as Href)} />
        </View>
      ) : null}
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color }} />
      <Text style={[text.caption, { color: colors.ink }]}>{label}</Text>
    </View>
  );
}

function RoundButton({ icon, label, onPress, busy }: { icon: { sf: string; md: string }; label: string; onPress: () => void; busy?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={busy} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => ({ width: 48, height: 48, borderRadius: 24, backgroundColor: pressed ? colors.sunken : colors.white, alignItems: 'center', justifyContent: 'center', boxShadow: shadow.card })}>
      {busy ? <ActivityIndicator size="small" color={colors.sign} /> : <Icon sf={icon.sf} md={icon.md} size={20} color={colors.sign} />}
    </Pressable>
  );
}

