import { useQuery } from '@tanstack/react-query';
import { router, Stack, type Href } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/common/Avatar';
import { Segments } from '@/components/common/Blocks';
import { Icon } from '@/components/common/Icon';
import { LeafletMap, type LeafletMapHandle, type MapMarker } from '@/components/map/LeafletMap';
import type { StorefrontSummary } from '@/core/api/types';
import { DEFAULT_CENTER } from '@/features/sidewalk-slots/map-constants';
import { communityApi, type ActiveVendor } from '@/features/vendor-map/community-api';
import { colors, radius, shadow, text } from '@/theme';
import { formatVietnamDate } from '@/utils/format';
import { StallRow } from '../components/stall-parts';
import { useStorefronts } from '../discovery-api';
import { useDiscoveryStore } from '../discovery-store';
import { LOCATE_MESSAGES } from '../geolocation';

/** Same radius as the web's "Trên bản đồ" tab once the buyer's position is known. */
const VENDOR_RADIUS_METERS = 5_000;

type Layer = 'STALLS' | 'VENDORS';

/** "Bún chả Hải Châu" → "Bún chả Hải…": short enough for a pin. */
const pinLabel = (name: string) => (name.length > 16 ? `${name.slice(0, 15)}…` : name);

const vendorKey = (v: ActiveVendor) => `${v.vendorId}-${v.slotId}`;

/**
 * The street map (DISC-04), in the web's two layers:
 * - Quán ăn: stalls that sell on StreetBiz, orange when open and grey when closed;
 * - Hộ có phép: every vendor holding a live permit (the web's "Trên bản đồ"), green, with the slot code.
 * The buyer's blue dot when known. Tapping a pin raises its card above the home indicator.
 */
export function MapScreen() {
  const insets = useSafeAreaInsets();
  const map = useRef<LeafletMapHandle>(null);
  const wardId = useDiscoveryStore((s) => s.filters.wardId);
  const position = useDiscoveryStore((s) => s.position);
  const locateStatus = useDiscoveryStore((s) => s.locateStatus);
  const locate = useDiscoveryStore((s) => s.locate);
  const [layer, setLayer] = useState<Layer>('STALLS');
  const showVendors = layer === 'VENDORS';
  const storefronts = useStorefronts({ wardId: wardId ?? undefined, position: position ?? undefined, sort: position ? 'distance' : 'name' });
  const stalls = useMemo(() => storefronts.data ?? [], [storefronts.data]);
  const vendors = useQuery({
    queryKey: ['community', 'vendors', position],
    queryFn: () => communityApi.activeVendors(position ? { ...position, radiusMeters: VENDOR_RADIUS_METERS } : undefined),
    enabled: showVendors,
  });
  const licensed = useMemo(() => vendors.data ?? [], [vendors.data]);
  const [picked, setPicked] = useState<StorefrontSummary | null>(null);
  const [pickedVendor, setPickedVendor] = useState<ActiveVendor | null>(null);

  const stallMarkers = useMemo<MapMarker[]>(
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
  const vendorMarkers = useMemo<MapMarker[]>(
    () =>
      licensed.map((v) => ({
        id: vendorKey(v),
        latitude: v.latitude,
        longitude: v.longitude,
        label: v.slotCode,
        fill: colors.leaf,
        ink: colors.white,
        selected: pickedVendor ? vendorKey(pickedVendor) === vendorKey(v) : false,
      })),
    [licensed, pickedVendor],
  );
  const failed = locateStatus === 'DENIED' || locateStatus === 'UNAVAILABLE' || locateStatus === 'FAILED';
  const active = showVendors ? vendors : storefronts;
  const hasCard = showVendors ? Boolean(pickedVendor) : Boolean(picked);

  return (
    <View style={{ flex: 1, backgroundColor: '#EEF3EF' }}>
      <Stack.Screen options={{ title: 'Bản đồ' }} />
      <LeafletMap
        ref={map}
        center={position ? [position.latitude, position.longitude] : DEFAULT_CENTER}
        zoom={15}
        markers={showVendors ? vendorMarkers : stallMarkers}
        me={position}
        onMarkerPress={(id) =>
          showVendors
            ? setPickedVendor(licensed.find((v) => vendorKey(v) === id) ?? null)
            : setPicked(stalls.find((s) => String(s.storefrontId) === id) ?? null)
        }
        onMapPress={() => {
          setPicked(null);
          setPickedVendor(null);
        }}
        style={{ flex: 1 }}
      />
      <View pointerEvents="box-none" style={{ position: 'absolute', top: 12, left: 12, right: 12, gap: 8 }}>
        <View style={{ borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.96)', boxShadow: shadow.card }}>
          <Segments<Layer>
            value={layer}
            onChange={(next) => {
              setLayer(next);
              setPicked(null);
              setPickedVendor(null);
            }}
            options={[
              { key: 'STALLS', label: 'Quán ăn' },
              { key: 'VENDORS', label: 'Hộ có phép' },
            ]}
          />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.94)', boxShadow: shadow.card }}>
          {showVendors ? (
            <Legend color={colors.leaf} label="Giấy phép còn hiệu lực" />
          ) : (
            <>
              <Legend color={colors.cta} label="Đang mở" />
              <Legend color="#7B8794" label="Đang đóng" />
            </>
          )}
          {active.isFetching ? (
            <ActivityIndicator size="small" color={colors.cta} />
          ) : (
            <Text style={[text.caption, { color: colors.muted }]}>{showVendors ? `${licensed.length} hộ` : `${stalls.length} quán`}</Text>
          )}
        </View>
        {active.isError ? (
          <Pressable onPress={() => void active.refetch()} style={{ alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: colors.dangerTint }}>
            <Text style={[text.footnote, { color: colors.onDanger }]}>
              {showVendors ? 'Không tải được danh sách hộ kinh doanh.' : 'Không tải được quán.'} Chạm để thử lại.
            </Text>
          </Pressable>
        ) : null}
        {showVendors && vendors.isSuccess && licensed.length === 0 ? (
          <View style={{ alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: colors.card }}>
            <Text style={[text.footnote, { color: colors.ink }]}>
              {position ? `Không có hộ kinh doanh trong bán kính ${VENDOR_RADIUS_METERS / 1000} km.` : 'Chưa có hộ kinh doanh đang hoạt động.'}
            </Text>
          </View>
        ) : null}
        {failed ? (
          <View style={{ alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: colors.mangoTint }}>
            <Text style={[text.footnote, { color: colors.onMango }]}>{LOCATE_MESSAGES[locateStatus as keyof typeof LOCATE_MESSAGES]}</Text>
          </View>
        ) : null}
      </View>
      <View pointerEvents="box-none" style={{ position: 'absolute', right: 12, bottom: (hasCard ? 130 : 20) + insets.bottom, gap: 10 }}>
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
        <RoundButton icon={{ sf: 'arrow.up.left.and.down.right.magnifyingglass', md: 'zoom_out_map' }} label={showVendors ? 'Xem tất cả hộ' : 'Xem tất cả quán'} onPress={() => map.current?.fitMarkers()} />
      </View>
      {hasCard ? (
        <View style={{ position: 'absolute', left: 12, right: 12, bottom: 12 + insets.bottom, borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden', boxShadow: shadow.raised }}>
          {showVendors && pickedVendor ? (
            <VendorCard vendor={pickedVendor} onPress={() => router.push(`/customer/explore/vendors/${pickedVendor.vendorId}` as Href)} />
          ) : picked ? (
            <StallRow stall={picked} onPress={() => router.push(`/customer/explore/stores/${picked.storefrontId}` as Href)} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** A licensed vendor: name, slot and zone, how long the permit runs, community rating. */
function VendorCard({ vendor: v, onPress }: { vendor: ActiveVendor; onPress: () => void }) {
  const rating = v.communityRating != null ? `★ ${v.communityRating.toFixed(1).replace('.', ',')} (${v.communityCount})` : 'Chưa có đánh giá';
  const until = formatVietnamDate(v.permitEndDate);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${v.displayName}, ô ${v.slotCode}, ${v.zoneName}. Có phép đến ${until}. Xem hồ sơ`}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: pressed ? colors.sunken : colors.card })}
    >
      <Avatar name={v.displayName} size={48} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text numberOfLines={1} style={[text.headline, { color: colors.ink }]}>{v.displayName}</Text>
        <Text numberOfLines={1} style={[text.footnote, { color: colors.muted }]}>{`Ô ${v.slotCode} · ${v.zoneName}`}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Icon sf="checkmark.seal.fill" md="verified" size={13} color={colors.onLeaf} />
          <Text style={[text.caption, { color: colors.onLeaf }]}>{`Có phép đến ${until}`}</Text>
          <Text style={[text.caption, { color: colors.muted }]}>{`· ${rating}`}</Text>
        </View>
      </View>
      <Icon sf="chevron.right" md="chevron_right" size={16} color={colors.muted} />
    </Pressable>
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
