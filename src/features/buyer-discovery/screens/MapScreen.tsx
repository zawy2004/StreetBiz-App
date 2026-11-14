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
import { colors, fonts, radius, shadow, tabular, text } from '@/theme';
import { Plate } from '@/ui';
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

/** A closed stall's pin: the cool grey of the app's muted ink. */
const CLOSED_PIN = colors.muted;

/**
 * The street map (DISC-04), v5 (screens/v5/buyer-rest.md): the map fills the screen under the
 * native header and a white sheet rises from the bottom with every control in thumb reach,
 * in the web's two layers:
 * - Quán ăn: stalls that sell on StreetBiz, orange when open and grey when closed;
 * - Hộ có phép: every vendor holding a live permit (the web's "Trên bản đồ"), green, with the slot code.
 * The sheet says what the layer shows (or why it cannot), then the picked pin's card with its
 * slot plate. Round white buttons (my position, show all) ride just above the sheet.
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
  // Height of the rising sheet, so the round buttons always sit just above it.
  const [sheetHeight, setSheetHeight] = useState(170);

  const stallMarkers = useMemo<MapMarker[]>(
    () =>
      stalls.map((s) => ({
        id: String(s.storefrontId),
        latitude: s.latitude,
        longitude: s.longitude,
        label: pinLabel(s.storefrontName),
        fill: s.isOpenNow ? colors.cta : CLOSED_PIN,
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
  const openCount = useMemo(() => stalls.filter((s) => s.isOpenNow).length, [stalls]);

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

      {/* Round buttons riding just above the sheet */}
      <View pointerEvents="box-none" style={{ position: 'absolute', right: 16, bottom: sheetHeight + 12, gap: 10 }}>
        <MapButton
          icon={{ sf: 'location.fill', md: 'my_location' }}
          label="Vị trí của tôi"
          busy={locateStatus === 'LOCATING'}
          onPress={async () => {
            await locate();
            const p = useDiscoveryStore.getState().position;
            if (p) map.current?.flyTo(p.latitude, p.longitude, 16);
          }}
        />
        <MapButton icon={{ sf: 'arrow.up.left.and.down.right.magnifyingglass', md: 'zoom_out_map' }} label={showVendors ? 'Xem tất cả hộ' : 'Xem tất cả quán'} onPress={() => map.current?.fitMarkers()} />
      </View>

      {/* The white sheet rising over the map */}
      <View
        onLayout={(e) => setSheetHeight(Math.round(e.nativeEvent.layout.height))}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingTop: 10,
          paddingBottom: insets.bottom + 12,
          gap: 12,
          backgroundColor: colors.canvas,
          borderTopLeftRadius: radius.pass,
          borderTopRightRadius: radius.pass,
          borderCurve: 'continuous',
          // The same upward lift as the shared Screen footer (no token for it yet).
          boxShadow: '0 -10px 28px -14px rgba(17, 28, 43, 0.22)',
        }}
      >
        <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.line }} />
        <View style={{ paddingHorizontal: 16 }}>
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

        {/* What this layer shows, or why it cannot */}
        <View style={{ paddingHorizontal: 20, gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 14, minHeight: 24 }}>
            {showVendors ? (
              <Legend color={colors.leaf} label="Giấy phép còn hiệu lực" />
            ) : (
              <>
                <Legend color={colors.cta} label="Đang mở" />
                <Legend color={CLOSED_PIN} label="Đang đóng" />
              </>
            )}
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              {active.isFetching ? (
                <ActivityIndicator size="small" color={colors.cta} />
              ) : (
                <Text style={[{ fontFamily: fonts.heavy, fontSize: 14, color: colors.ink }, tabular]}>
                  {showVendors ? `${licensed.length} hộ` : `${openCount}/${stalls.length} quán mở`}
                </Text>
              )}
            </View>
          </View>
          {active.isError ? (
            <Pressable onPress={() => void active.refetch()} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingHorizontal: 14, borderRadius: radius.control, borderCurve: 'continuous', backgroundColor: colors.dangerTint, opacity: pressed ? 0.75 : 1 })}>
              <Icon sf="arrow.clockwise" md="refresh" size={16} color={colors.onDanger} />
              <Text style={[text.footnote, { flex: 1, color: colors.onDanger, fontFamily: fonts.semibold }]}>
                {showVendors ? 'Không tải được danh sách hộ kinh doanh.' : 'Không tải được quán.'} Chạm để thử lại.
              </Text>
            </Pressable>
          ) : null}
          {showVendors && vendors.isSuccess && licensed.length === 0 ? (
            <Text style={[text.footnote, { color: colors.ink }]}>
              {position ? `Không có hộ kinh doanh trong bán kính ${VENDOR_RADIUS_METERS / 1000} km.` : 'Chưa có hộ kinh doanh đang hoạt động.'}
            </Text>
          ) : null}
          {failed ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.control, borderCurve: 'continuous', backgroundColor: colors.mangoTint }}>
              <Icon sf="location.slash.fill" md="location_off" size={16} color={colors.onMango} />
              <Text style={[text.footnote, { flex: 1, color: colors.onMango }]}>{LOCATE_MESSAGES[locateStatus as keyof typeof LOCATE_MESSAGES]}</Text>
            </View>
          ) : null}
        </View>

        {hasCard ? (
          <View style={{ borderTopWidth: 1, borderTopColor: colors.separator }}>
            {showVendors && pickedVendor ? (
              <VendorCard vendor={pickedVendor} onPress={() => router.push(`/customer/explore/vendors/${pickedVendor.vendorId}` as Href)} />
            ) : picked ? (
              <StallRow stall={picked} onPress={() => router.push(`/customer/explore/stores/${picked.storefrontId}` as Href)} />
            ) : null}
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20 }}>
            <Icon sf="hand.tap" md="touch_app" size={16} color={colors.primary} />
            <Text style={[text.footnote, { flex: 1, color: colors.muted }]}>
              {showVendors ? 'Chạm vào ghim xanh để xem hồ sơ hộ kinh doanh.' : 'Chạm vào ghim để xem quán và thực đơn.'}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

/** A licensed vendor: name, the slot's plate and zone, how long the permit runs, community rating. */
function VendorCard({ vendor: v, onPress }: { vendor: ActiveVendor; onPress: () => void }) {
  const rating = v.communityRating != null ? `${v.communityRating.toFixed(1).replace('.', ',')} (${v.communityCount})` : null;
  const until = formatVietnamDate(v.permitEndDate);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${v.displayName}, ô ${v.slotCode}, ${v.zoneName}. Có phép đến ${until}. Xem hồ sơ`}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 14, backgroundColor: pressed ? colors.pressed : colors.canvas })}
    >
      <Avatar name={v.displayName} size={52} />
      <View style={{ flex: 1, gap: 5 }}>
        <Text numberOfLines={1} style={{ fontFamily: fonts.heavy, fontSize: 16.5, lineHeight: 22, color: colors.ink }}>{v.displayName}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Plate code={v.slotCode} style={{ minHeight: 24, paddingHorizontal: 7 }} />
          <Text numberOfLines={1} style={[text.footnote, { flexShrink: 1, color: colors.muted }]}>{v.zoneName}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Icon sf="checkmark.seal.fill" md="verified" size={13} color={colors.leaf} />
            <Text style={[text.caption, { color: colors.onLeaf }]}>{`Có phép đến ${until}`}</Text>
          </View>
          {rating ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Icon sf="star.fill" md="star" size={12} color={colors.mango} />
              <Text style={[text.caption, { color: colors.ink }, tabular]}>{rating}</Text>
            </View>
          ) : (
            <Text style={[text.caption, { color: colors.muted }]}>Chưa có đánh giá</Text>
          )}
        </View>
      </View>
      <Icon sf="chevron.right" md="chevron_right" size={16} color={colors.muted} />
    </Pressable>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: color }} />
      <Text style={[text.caption, { color: colors.ink }]}>{label}</Text>
    </View>
  );
}

/** A white round map button (48, outdoors) with the orange glyph; a spinner while it works. */
function MapButton({ icon, label, onPress, busy }: { icon: { sf: string; md: string }; label: string; onPress: () => void; busy?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={busy} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => ({ width: 48, height: 48, borderRadius: 24, backgroundColor: pressed ? colors.brandTint : colors.white, alignItems: 'center', justifyContent: 'center', boxShadow: shadow.raised })}>
      {busy ? <ActivityIndicator size="small" color={colors.cta} /> : <Icon sf={icon.sf} md={icon.md} size={20} color={colors.primary} />}
    </Pressable>
  );
}
