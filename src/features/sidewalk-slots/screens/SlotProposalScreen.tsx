import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, Stack, type Href } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Chip } from '@/components/common/Chip';
import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { Banner } from '@/components/feedback/Banner';
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
import { colors, fonts, radius, tabular, text } from '@/theme';
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

/**
 * V16 Đề xuất ô mới (SIDE-11): a field survey of a spot not yet on the grid. The map sits on
 * top (tap to drive the stake, or use GPS), the form below: route, size, a photo of the spot.
 * The ward reviews it; nothing becomes a slot until it approves.
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
      <Screen>
        <Stack.Screen options={{ title: 'Đề xuất ô mới' }} />
        <ListSkeleton rows={1} height={260} />
        <ListSkeleton rows={3} height={64} />
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
        <View pointerEvents="box-none" style={{ position: 'absolute', left: 12, right: 12, bottom: 12, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
          <View style={{ flexShrink: 1, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.94)' }}>
            <Text style={[text.caption, { color: colors.ink }, tabular]}>
              {position ? `${position.latitude.toFixed(5)}, ${position.longitude.toFixed(5)}` : 'Chạm vào bản đồ để cắm cọc'}
            </Text>
          </View>
          <Pressable
            onPress={() => void locate()}
            disabled={locating}
            accessibilityRole="button"
            accessibilityLabel="Dùng vị trí hiện tại của tôi"
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: pressed ? colors.signTint : colors.white, opacity: locating ? 0.6 : 1, boxShadow: '0 4px 14px -6px rgba(17,28,43,0.35)' })}
          >
            <Icon sf="location.fill" md="my_location" size={16} color={colors.sign} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.sign }}>{locating ? 'Đang định vị…' : 'Vị trí của tôi'}</Text>
          </Pressable>
        </View>
      </View>
      <Screen footer={<Button label="Gửi đề xuất" size={56} icon={{ sf: 'paperplane.fill', md: 'send' }} loading={submit.isPending} onPress={send} />}>
        {errors.position ? <Banner tone="warning">{errors.position}</Banner> : null}
        <Banner tone="info" title="Phường xét đề xuất">
          Vị trí chỉ thành ô cho thuê khi Phường duyệt. Bạn sẽ nhận thông báo kết quả.
        </Banner>

        <View style={{ gap: 8 }}>
          <Text style={[text.subhead, { color: colors.ink }]}>Tuyến phố</Text>
          {zonesQuery.isPending ? (
            <ListSkeleton rows={1} height={40} />
          ) : zones.length === 0 ? (
            <Text style={[text.footnote, { color: colors.muted }]}>Chưa có tuyến nào mở trong thành phố.</Text>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {zones.map((z) => (
                <Chip
                  key={z.zoneId}
                  label={z.zoneId === nearestZoneId && zoneId == null ? `${z.zoneName} · gần nhất` : z.zoneName}
                  selected={z.zoneId === activeZoneId}
                  onPress={() => {
                    setZoneId(z.zoneId);
                    setErrors((e) => ({ ...e, zone: undefined }));
                  }}
                  accessibilityRole="radio"
                />
              ))}
            </View>
          )}
          {errors.zone ? <Text style={[text.footnote, { color: colors.onDanger }]}>{errors.zone}</Text> : null}
        </View>

        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <TextField label="Mặt tiền (m)" value={width} onChangeText={setWidth} keyboardType="decimal-pad" placeholder="1,5" optional />
            </View>
            <View style={{ flex: 1 }}>
              <TextField label="Chiều sâu (m)" value={length} onChangeText={setLength} keyboardType="decimal-pad" placeholder="2" optional />
            </View>
          </View>
          {errors.size ? (
            <Text style={[text.footnote, { color: colors.onDanger }]}>{errors.size}</Text>
          ) : sizeW && sizeL ? (
            <Text style={[text.footnote, { color: colors.muted }, tabular]}>Diện tích khoảng {(sizeW * sizeL).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} m²</Text>
          ) : null}
        </View>

        <View style={{ gap: 8 }}>
          <Text style={[text.subhead, { color: colors.ink }]}>Ảnh hiện trạng</Text>
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
            style={{
              height: 180,
              borderRadius: radius.card,
              borderCurve: 'continuous',
              overflow: 'hidden',
              backgroundColor: photo ? colors.card : colors.kerbPaint,
              borderWidth: photo ? 0 : 2,
              borderStyle: 'dashed',
              borderColor: errors.photo ? colors.danger : colors.brandLight,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            {photo ? (
              <>
                <Image source={{ uri: photo.uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                <View style={{ position: 'absolute', right: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: 'rgba(17,28,43,0.7)' }}>
                  <Icon sf="arrow.triangle.2.circlepath.camera" md="flip_camera_ios" size={13} color={colors.white} />
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.white }}>Đổi ảnh</Text>
                </View>
              </>
            ) : (
              <>
                <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon sf="camera.fill" md="photo_camera" size={24} color={colors.primary} />
                </View>
                <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.primary }}>Chụp ảnh vị trí</Text>
                <Text style={[text.caption, { color: colors.muted }]}>Thấy rõ vỉa hè và lối đi chung</Text>
              </>
            )}
          </Pressable>
          {errors.photo ? <Text style={[text.footnote, { color: colors.onDanger }]}>{errors.photo}</Text> : null}
        </View>

        {errors.form ? <Banner tone="danger">{errors.form}</Banner> : null}
      </Screen>
      {picker.sheet}
    </View>
  );
}
