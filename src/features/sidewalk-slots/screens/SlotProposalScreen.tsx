import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, Stack, type Href } from 'expo-router';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Chip } from '@/components/common/Chip';
import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { KerbStrip } from '@/components/common/KerbStrip';
import { Banner } from '@/components/feedback/Banner';
import { Skeleton } from '@/components/feedback/Skeleton';
import { ListSkeleton } from '@/components/feedback/States';
import { StateView } from '@/components/feedback/StateView';
import { showToast } from '@/components/feedback/Toast';
import { useFilePicker } from '@/components/forms/FileSourceSheet';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { LeafletMap, type LeafletMapHandle } from '@/components/map/LeafletMap';
import { errorMessage } from '@/core/api';
import { sideApi } from '@/core/api/side-api';
import type { PickedFile } from '@/core/api/upload';
import { vendorRegistrationApi } from '@/core/api/vendor-registration-api';
import { useRegistrations } from '@/features/business-registrations/useRegistrations';
import { detectPosition, LocateError } from '@/features/buyer-discovery/geolocation';
import { colors, fonts, radius, shadow, sign, tabular, text } from '@/theme';
import { DEFAULT_CENTER } from '../map-constants';

// There is no zones-list endpoint: a zone shows up once it has a slot, so search city-wide.
const DA_NANG_CENTER = { lat: 16.047, lng: 108.206 };
const DA_NANG_RADIUS_METERS = 20_000;

type Position = { latitude: number; longitude: number };

/** A typed size as metres, or null when it is not a positive number. */
const metres = (value: string) => {
  const n = Number(value.trim().replace(',', '.'));
  return value.trim() && Number.isFinite(n) && n > 0 ? n : null;
};

/** A part of the survey: heavy title, its field, the field's own error right under it. */
function Part({ title, note, error, children }: { title: string; note?: string; error?: string; children: ReactNode }) {
  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 2 }}>
        <Text accessibilityRole="header" style={{ fontFamily: fonts.heavy, fontSize: 19, lineHeight: 25, color: colors.ink }}>{title}</Text>
        {note ? <Text style={[text.footnote, { color: colors.muted }]}>{note}</Text> : null}
      </View>
      {children}
      {error ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon sf="exclamationmark.circle.fill" md="error" size={15} color={colors.danger} />
          <Text style={[text.footnote, { flex: 1, color: colors.onDanger, fontFamily: fonts.semibold }]}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * V16 Đề xuất ô mới (SIDE-11), v5: a field survey of a spot not yet on the grid. The map runs
 * full width on top with the orange stake (tap to drive it, or use GPS); below, the route, the
 * spot's size drawn live as a bay on the pavement, and a photo of the spot. The ward reviews it;
 * nothing becomes a slot until it approves.
 */
export function SlotProposalScreen() {
  const queryClient = useQueryClient();
  const { registrations, isLoading } = useRegistrations();
  const registration = registrations.find((r) => r.registrationStatus === 'APPROVED') ?? registrations[0];
  const zonesQuery = useQuery({
    queryKey: ['side', 'zones-for-proposal'],
    queryFn: () => sideApi.searchSlots({ ...DA_NANG_CENTER, radiusMeters: DA_NANG_RADIUS_METERS, take: 500 }),
  });
  const zoneStats = useMemo(() => {
    const stats = new Map<number, { name: string; count: number; lat: number; lng: number }>();
    for (const s of zonesQuery.data ?? []) {
      const e = stats.get(s.zoneId) ?? { name: s.zoneName, count: 0, lat: 0, lng: 0 };
      e.count += 1;
      e.lat += s.latitude;
      e.lng += s.longitude;
      stats.set(s.zoneId, e);
    }
    return stats;
  }, [zonesQuery.data]);
  const zones = useMemo(() => [...zoneStats.entries()].map(([zoneId, s]) => ({ zoneId, zoneName: s.name, count: s.count })), [zoneStats]);

  const [position, setPosition] = useState<Position | null>(null);
  const [zoneId, setZoneId] = useState<number | null>(null);
  const [width, setWidth] = useState('');
  const [length, setLength] = useState('');
  const [photo, setPhoto] = useState<PickedFile | null>(null);
  const [locating, setLocating] = useState(false);
  const [errors, setErrors] = useState<{ position?: string; zone?: string; photo?: string; size?: string; form?: string }>({});
  const picker = useFilePicker();
  const map = useRef<LeafletMapHandle>(null);

  // Display only: the route whose slots sit nearest the stake, offered as the likely one.
  const nearestZoneId = useMemo(() => {
    if (!position) return null;
    let best: { id: number; d: number } | null = null;
    for (const [id, s] of zoneStats) {
      const d = Math.hypot(s.lat / s.count - position.latitude, s.lng / s.count - position.longitude);
      if (!best || d < best.d) best = { id, d };
    }
    return best?.id ?? null;
  }, [position, zoneStats]);
  const activeZoneId = zoneId ?? nearestZoneId;

  const locate = async () => {
    setLocating(true);
    try {
      const p = await detectPosition();
      setPosition(p);
      map.current?.flyTo(p.latitude, p.longitude, 18);
      setErrors((e) => ({ ...e, position: undefined }));
    } catch (err) {
      const reason = err instanceof LocateError ? err.reason : 'FAILED';
      setErrors((e) => ({
        ...e,
        position:
          reason === 'DENIED'
            ? 'Bạn chưa cho phép định vị. Chạm vào bản đồ để chọn vị trí.'
            : reason === 'UNAVAILABLE'
              ? 'Định vị đang tắt. Bật định vị hoặc chạm vào bản đồ.'
              : 'Không lấy được vị trí. Chạm vào bản đồ để chọn.',
      }));
    } finally {
      setLocating(false);
    }
  };

  const submit = useMutation({
    mutationFn: async () => {
      const { fileUrl } = await vendorRegistrationApi.uploadEvidenceFile(photo!);
      return sideApi.proposeSlot({
        registrationId: registration!.registrationId,
        zoneId: activeZoneId!,
        latitude: position!.latitude,
        longitude: position!.longitude,
        widthMeters: metres(width) ?? undefined,
        lengthMeters: metres(length) ?? undefined,
        proposalPhotoUrl: fileUrl,
      });
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['side'] });
      showToast(result.message);
      router.back();
    },
    onError: (err) => setErrors((e) => ({ ...e, form: errorMessage(err) })),
  });

  const send = () => {
    const next: typeof errors = {};
    if (!position) next.position = 'Chọn vị trí ô trên bản đồ hoặc dùng vị trí hiện tại.';
    if (activeZoneId == null) next.zone = 'Chọn tuyến phố của vị trí.';
    if (!photo) next.photo = 'Chụp một ảnh hiện trạng vị trí.';
    if ((width.trim() && metres(width) == null) || (length.trim() && metres(length) == null)) next.size = 'Kích thước phải là số mét lớn hơn 0.';
    setErrors(next);
    if (Object.keys(next).length === 0) submit.mutate();
  };

  const markers = useMemo(
    () => (position ? [{ id: 'stake', latitude: position.latitude, longitude: position.longitude, label: 'Ô đề xuất', fill: colors.cta, ink: colors.white, selected: true }] : []),
    [position],
  );

  if (isLoading) {
    return (
      <Screen padded={false}>
        <Stack.Screen options={{ title: 'Đề xuất ô mới' }} />
        <Skeleton height={270} radius={0} />
        <View style={{ paddingHorizontal: 16, gap: 14 }}>
          <ListSkeleton rows={3} height={72} />
        </View>
      </Screen>
    );
  }
  if (!registration) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Đề xuất ô mới' }} />
        <StateView
          icon={{ sf: 'mappin.slash', md: 'location_off' }}
          title="Cần có hồ sơ đăng ký kinh doanh"
          body="Nộp hồ sơ đăng ký trước khi đề xuất ô mới."
          action={{ label: 'Đăng ký kinh doanh', onPress: () => router.push('/register-business' as Href) }}
        />
      </Screen>
    );
  }

  const sizeW = metres(width);
  const sizeL = metres(length);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: 'Đề xuất ô mới' }} />
      <View>
        <LeafletMap
          ref={map}
          center={DEFAULT_CENTER}
          zoom={16}
          markers={markers}
          onMapPress={(latitude, longitude) => {
            setPosition({ latitude, longitude });
            setErrors((e) => ({ ...e, position: undefined }));
          }}
          style={{ height: 270 }}
        />
        <View pointerEvents="box-none" style={{ position: 'absolute', left: 12, right: 12, bottom: 14, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
          <View style={{ flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.full, backgroundColor: position ? colors.plate : 'rgba(255,255,255,0.96)', boxShadow: shadow.card }}>
            <Icon sf={position ? 'mappin' : 'hand.tap.fill'} md={position ? 'location_on' : 'touch_app'} size={14} color={position ? colors.white : colors.primary} />
            <Text style={[text.caption, { color: position ? colors.white : colors.ink }, tabular]}>
              {position ? `${position.latitude.toFixed(5)}, ${position.longitude.toFixed(5)}` : 'Chạm vào bản đồ để cắm cọc'}
            </Text>
          </View>
          <Pressable
            onPress={() => void locate()}
            disabled={locating}
            accessibilityRole="button"
            accessibilityLabel="Dùng vị trí hiện tại của tôi"
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 16, borderRadius: radius.full, backgroundColor: pressed ? colors.brandTint : colors.white, opacity: locating ? 0.6 : 1, boxShadow: shadow.raised })}
          >
            <Icon sf="location.fill" md="my_location" size={16} color={colors.primary} />
            <Text style={{ fontFamily: fonts.heavy, fontSize: 13.5, color: colors.primary }}>{locating ? 'Đang định vị…' : 'Vị trí của tôi'}</Text>
          </Pressable>
        </View>
      </View>
      <KerbStrip height={8} segment={24} />
      <Screen gap={26} footer={<Button label="Gửi đề xuất" size={56} icon={{ sf: 'paperplane.fill', md: 'send' }} loading={submit.isPending} onPress={send} />}>
        {errors.position ? <Banner tone="warning">{errors.position}</Banner> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.signTint, alignItems: 'center', justifyContent: 'center' }}>
            <Icon sf="building.columns.fill" md="account_balance" size={18} color={colors.sign} />
          </View>
          <Text style={[text.footnote, { flex: 1, color: colors.ink }]}>
            <Text style={{ fontFamily: fonts.bold }}>Phường xét đề xuất. </Text>
            Vị trí chỉ thành ô cho thuê khi Phường duyệt. Bạn sẽ nhận thông báo kết quả.
          </Text>
        </View>

        <Part title="Tuyến phố" error={errors.zone}>
          {zonesQuery.isPending ? (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Skeleton width={120} height={40} radius={radius.full} />
              <Skeleton width={150} height={40} radius={radius.full} />
            </View>
          ) : zones.length === 0 ? (
            <Text style={[text.footnote, { color: colors.muted }]}>Chưa có tuyến nào mở trong thành phố.</Text>
          ) : (
            <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {zones.map((z) => (
                <Chip
                  key={z.zoneId}
                  label={z.zoneId === nearestZoneId && zoneId == null ? `${z.zoneName}, gần nhất` : z.zoneName}
                  selected={z.zoneId === activeZoneId}
                  icon={{ sf: 'signpost.right.fill', md: 'signpost' }}
                  onPress={() => {
                    setZoneId(z.zoneId);
                    setErrors((e) => ({ ...e, zone: undefined }));
                  }}
                  accessibilityRole="radio"
                />
              ))}
            </View>
          )}
        </Part>

        <Part title="Kích thước" note="Không bắt buộc, đo bằng thước dây nếu có" error={errors.size}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <TextField label="Mặt tiền (m)" value={width} onChangeText={setWidth} keyboardType="decimal-pad" placeholder="1,5" optional />
            </View>
            <View style={{ flex: 1 }}>
              <TextField label="Chiều sâu (m)" value={length} onChangeText={setLength} keyboardType="decimal-pad" placeholder="2" optional />
            </View>
          </View>
          {sizeW && sizeL && !errors.size ? <BayPreview width={sizeW} length={sizeL} /> : null}
        </Part>

        <Part title="Ảnh hiện trạng" error={errors.photo}>
          <Pressable
            onPress={async () => {
              const file = await picker.pick('Ảnh hiện trạng vị trí', false);
              if (file) {
                setPhoto(file);
                setErrors((e) => ({ ...e, photo: undefined }));
              }
            }}
            accessibilityRole="button"
            accessibilityLabel={photo ? 'Đổi ảnh hiện trạng' : 'Chụp ảnh hiện trạng'}
            style={({ pressed }) => ({
              minHeight: 190,
              borderRadius: radius.card,
              borderCurve: 'continuous',
              overflow: 'hidden',
              backgroundColor: photo ? colors.card : pressed ? colors.brandTint : colors.kerbPaint,
              borderWidth: photo ? 0 : 2,
              borderStyle: 'dashed',
              borderColor: errors.photo ? colors.danger : colors.brandLight,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: photo ? 0 : 16,
            })}
          >
            {photo ? (
              <>
                <Image source={{ uri: photo.uri }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" />
                <View style={{ position: 'absolute', right: 12, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.full, paddingHorizontal: 12, minHeight: 36, backgroundColor: 'rgba(17,28,43,0.72)' }}>
                  <Icon sf="arrow.triangle.2.circlepath.camera" md="flip_camera_ios" size={14} color={colors.white} />
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.white }}>Đổi ảnh</Text>
                </View>
              </>
            ) : (
              <>
                <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: colors.cta, alignItems: 'center', justifyContent: 'center', boxShadow: shadow.glow }}>
                  <Icon sf="camera.fill" md="photo_camera" size={26} color={colors.white} />
                </View>
                <Text style={{ fontFamily: fonts.heavy, fontSize: 16, color: colors.primary }}>Chụp ảnh vị trí</Text>
                <Text style={[text.footnote, { color: colors.muted }]}>Thấy rõ vỉa hè và lối đi chung</Text>
              </>
            )}
          </Pressable>
        </Part>

        {errors.form ? <Banner tone="danger">{errors.form}</Banner> : null}
      </Screen>
      {picker.sheet}
    </View>
  );
}

/** The proposed spot drawn on the pavement to its proportions, its area in sign figures. */
function BayPreview({ width, length }: { width: number; length: number }) {
  const scale = Math.min(140 / width, 72 / length);
  const area = (width * length).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
  return (
    <View
      accessible
      accessibilityLabel={`Ô dự kiến, diện tích khoảng ${area} mét vuông`}
      style={{ flexDirection: 'row', alignItems: 'stretch', borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.card, boxShadow: shadow.card }}
    >
      <View style={{ width: 172, backgroundColor: colors.kerbPaint, justifyContent: 'flex-end' }}>
        <View style={{ alignItems: 'center', justifyContent: 'flex-end', paddingTop: 14, paddingBottom: 8 }}>
          <View style={{ width: Math.max(28, width * scale), height: Math.max(24, length * scale), borderRadius: radius.plate, borderWidth: 2.5, borderStyle: 'dashed', borderColor: colors.cta, backgroundColor: colors.brandTint }} />
        </View>
        <KerbStrip height={7} segment={14} />
        <View style={{ height: 14, backgroundColor: colors.line }} />
      </View>
      <View style={{ flex: 1, padding: 16, justifyContent: 'center', gap: 2 }}>
        <Text maxFontSizeMultiplier={1.3} adjustsFontSizeToFit numberOfLines={1} style={[sign.title, { color: colors.ink }, tabular]}>
          {area} m²
        </Text>
        <Text style={[text.footnote, { color: colors.muted }]}>Diện tích khoảng</Text>
      </View>
    </View>
  );
}
