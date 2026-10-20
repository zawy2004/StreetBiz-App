import { useQuery } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/common/Icon';
import { sideApi, type RentalApplication, type RentalContract } from '@/core/api/side-api';
import { statusLabel } from '@/core/constants/status-labels';
import { useAuthStore } from '@/store/auth-store';
import { colors, fonts, radius, shadow, sign, tabular, text } from '@/theme';
import { formatVietnamDate } from '@/utils/format';
import { summarizeMySlots } from '../my-slots-summary';
import { contractProgress, countApplications } from '../my-slots-view';

const go = (href: string) => router.push(href as Href);

/** The hub's three lists, with the same keys as the list screens so opening one reuses them. */
export function useMySlotsData() {
  const userId = useAuthStore((s) => s.user?.id);
  const applications = useQuery({ queryKey: ['side', userId, 'applications'], queryFn: () => sideApi.listApplications() });
  const contracts = useQuery({ queryKey: ['side', userId, 'contracts'], queryFn: () => sideApi.listContracts() });
  const incoming = useQuery({ queryKey: ['side', userId, 'transfers', 'incoming'], queryFn: () => sideApi.listTransfers('incoming') });
  const refetch = () => Promise.all([applications.refetch(), contracts.refetch(), incoming.refetch()]);
  return { applications, contracts, incoming, refetch, refreshing: applications.isRefetching || contracts.isRefetching };
}

/**
 * V13 Ô của tôi: everything after picking a slot. First the road from a slot to a permit, each
 * stop with its live count (it sits across the signboard's edge); then the four doors, one card of
 * rows, and a door waiting on the vendor carries a mango tag and moves to the top.
 */
export function MySlotsHub({ data, onStart }: { data: ReturnType<typeof useMySlotsData>; onStart: () => void }) {
  const { applications, contracts, incoming } = data;
  const summary = summarizeMySlots({ applications: applications.data, contracts: contracts.data, incomingTransfers: incoming.data });
  const latest = applications.data?.[applications.data.length - 1];
  const expiringSoon = countExpiringSoon(contracts.data);
  const tiles = [
    {
      key: 'apps',
      icon: { sf: 'doc.text.fill', md: 'description' },
      wash: colors.brandTint,
      ink: colors.primary,
      title: 'Đơn thuê ô',
      subtitle: summary.applications.text,
      attention: summary.applications.attention,
      extra: latest ? `Đơn gần nhất #${latest.applicationId}: ${statusLabel(latest.applicationStatus).label}, nộp ${formatVietnamDate(latest.createdAt)}` : null,
      href: '/vendor/slots/rental-applications',
    },
    {
      key: 'contracts',
      icon: { sf: 'signature', md: 'contract' },
      wash: colors.leafTint,
      ink: colors.onLeaf,
      title: 'Hợp đồng & giấy phép',
      subtitle: summary.contracts.text,
      attention: expiringSoon > 0,
      extra: expiringSoon > 0 ? `${expiringSoon} hợp đồng sắp hết hạn, nên gia hạn` : null,
      href: '/vendor/slots/contracts',
    },
    {
      key: 'transfers',
      icon: { sf: 'arrow.left.arrow.right', md: 'swap_horiz' },
      wash: colors.sunken,
      ink: colors.ink,
      title: 'Chuyển nhượng ô',
      subtitle: summary.transfers.text,
      attention: summary.transfers.attention,
      extra: null,
      href: '/vendor/slots/transfers',
    },
    {
      key: 'proposal',
      icon: { sf: 'mappin.and.ellipse', md: 'add_location_alt' },
      wash: colors.mangoTint,
      ink: colors.onMango,
      title: 'Đề xuất ô mới',
      subtitle: 'Gửi vị trí chưa có trong danh sách',
      attention: false,
      extra: null,
      href: '/vendor/slots/slot-proposals/new',
    },
  ].sort((a, b) => Number(b.attention) - Number(a.attention));

  return (
    <View style={{ gap: 26 }}>
      <Journey onStart={onStart} applications={applications.data} applicationsFailed={applications.isError} contracts={contracts.data} contractsFailed={contracts.isError} />
      <View style={{ gap: 14 }}>
        <Text accessibilityRole="header" style={{ fontFamily: fonts.heavy, fontSize: 21, lineHeight: 27, letterSpacing: -0.2, color: colors.ink }}>
          Hồ sơ ô của bạn
        </Text>
        <View style={{ borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.card, boxShadow: shadow.card }}>
          {tiles.map((t, i) => (
            <Pressable
              key={t.key}
              onPress={() => go(t.href)}
              accessibilityRole="button"
              accessibilityLabel={`${t.title}. ${t.subtitle}${t.attention ? '. Cần bạn xử lý' : ''}`}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                paddingVertical: 16,
                paddingHorizontal: 16,
                minHeight: 76,
                backgroundColor: pressed ? colors.pressed : t.attention ? colors.kerbPaint : colors.card,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: colors.separator,
              })}
            >
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: t.wash, alignItems: 'center', justifyContent: 'center' }}>
                <Icon sf={t.icon.sf} md={t.icon.md} size={22} color={t.ink} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ fontFamily: fonts.heavy, fontSize: 16.5, lineHeight: 22, color: colors.ink }}>{t.title}</Text>
                <Text style={[text.footnote, { color: t.attention ? colors.onMango : colors.muted, fontFamily: t.attention ? fonts.bold : fonts.regular }]}>{t.subtitle}</Text>
                {t.extra ? (
                  <Text style={[text.caption, { color: colors.ink, fontFamily: fonts.medium }]} numberOfLines={2}>
                    {t.extra}
                  </Text>
                ) : null}
              </View>
              {t.attention ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.sticker, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: colors.sticker, transform: [{ rotate: '-3deg' }] }}>
                  <Icon sf="flag.fill" md="flag" size={11} color={colors.plate} />
                  <Text style={{ fontFamily: fonts.heavy, fontSize: 11.5, color: colors.plate }}>Cần xử lý</Text>
                </View>
              ) : (
                <Icon sf="chevron.right" md="chevron_right" size={14} color={colors.muted} />
              )}
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

function countExpiringSoon(contracts: readonly RentalContract[] | undefined): number {
  if (!contracts) return 0;
  const today = new Date();
  return contracts.filter((c) => c.contractStatus === 'ACTIVE' && !!c.startDate && !!c.endDate && contractProgress(c.startDate, c.endDate, today).expiringSoon).length;
}

/**
 * Slot, application, ward, contract + permit: four stops on one painted kerb, each with its live
 * count in sign figures ("—" when a list failed, never a made-up zero).
 */
function Journey({
  onStart,
  applications,
  applicationsFailed,
  contracts,
  contractsFailed,
}: {
  onStart: () => void;
  applications: readonly RentalApplication[] | undefined;
  applicationsFailed: boolean;
  contracts: readonly RentalContract[] | undefined;
  contractsFailed: boolean;
}) {
  const appCounts = applications ? countApplications(applications) : null;
  const active = contracts ? contracts.filter((c) => c.contractStatus === 'ACTIVE').length : null;
  const stops = [
    { label: 'Đơn đang mở', value: appCounts?.OPEN ?? null, failed: applicationsFailed },
    { label: 'Đã duyệt', value: appCounts?.APPROVED ?? null, failed: applicationsFailed },
    { label: 'Đang hiệu lực', value: active, failed: contractsFailed },
  ];
  return (
    <View style={{ padding: 18, gap: 16, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadow.raised }}>
      <Text style={{ fontFamily: fonts.heavy, fontSize: 17, lineHeight: 23, color: colors.ink }}>Từ ô vỉa hè tới giấy phép</Text>
      <View>
        {/* The kerb the stops stand on */}
        <View style={{ position: 'absolute', left: '12%', right: '12%', top: 25, height: 5, flexDirection: 'row', overflow: 'hidden' }} importantForAccessibility="no-hide-descendants">
          {Array.from({ length: 16 }, (_, i) => (
            <View key={i} style={{ flex: 1, backgroundColor: i % 2 ? colors.brandTint : colors.brand }} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <Pressable onPress={onStart} accessibilityRole="button" accessibilityLabel="Chọn ô, bắt đầu ở đây" style={{ flex: 1, alignItems: 'center', gap: 8 }}>
            <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: colors.cta, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.white, boxShadow: shadow.glow }}>
              <Icon sf="mappin" md="location_on" size={22} color={colors.white} />
            </View>
            <Text style={[text.caption, { color: colors.primary, fontFamily: fonts.heavy, textAlign: 'center' }]}>Chọn ô</Text>
          </Pressable>
          {stops.map((s) => {
            const lit = (s.value ?? 0) > 0;
            return (
              <View key={s.label} accessible accessibilityLabel={`${s.label}: ${s.failed ? 'không tải được' : (s.value ?? 'đang tải')}`} style={{ flex: 1, alignItems: 'center', gap: 8 }}>
                <View
                  style={{
                    minWidth: 54,
                    height: 54,
                    borderRadius: 27,
                    paddingHorizontal: 6,
                    backgroundColor: lit ? colors.white : colors.sunken,
                    borderWidth: 3,
                    borderColor: lit ? colors.brand : colors.white,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text maxFontSizeMultiplier={1.3} style={[sign.price, { fontSize: 22, lineHeight: 27, color: lit ? colors.primary : colors.muted }, tabular]}>
                    {s.failed ? '—' : s.value == null ? '…' : s.value}
                  </Text>
                </View>
                <Text style={[text.caption, { color: colors.ink, textAlign: 'center' }]}>{s.label}</Text>
              </View>
            );
          })}
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.control, borderCurve: 'continuous', backgroundColor: colors.leafTint }}>
        <Icon sf="checkmark.shield.fill" md="verified_user" size={17} color={colors.onLeaf} />
        <Text style={[text.footnote, { flex: 1, color: colors.onLeaf, fontFamily: fonts.semibold }]}>Phường duyệt đơn là hợp đồng và giấy phép QR được tạo tự động.</Text>
      </View>
    </View>
  );
}
