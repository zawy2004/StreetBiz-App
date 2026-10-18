import { useQuery } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/common/Icon';
import { sideApi, type RentalApplication, type RentalContract } from '@/core/api/side-api';
import { statusLabel } from '@/core/constants/status-labels';
import { useAuthStore } from '@/store/auth-store';
import { colors, fonts, radius, tabular, text } from '@/theme';
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
 * V13 Ô của tôi: everything after picking a slot. The journey from a slot to a permit with
 * live counts on top, then four signposts; one waiting on the vendor carries a flag and
 * moves to the top.
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
      wash: colors.signTint,
      ink: colors.sign,
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
    <View style={{ gap: 14 }}>
      <Journey onStart={onStart} applications={applications.data} applicationsFailed={applications.isError} contracts={contracts.data} contractsFailed={contracts.isError} />
      {tiles.map((t) => (
        <Pressable
          key={t.key}
          onPress={() => go(t.href)}
          accessibilityRole="button"
          accessibilityLabel={`${t.title}. ${t.subtitle}${t.attention ? '. Cần bạn xử lý' : ''}`}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            padding: 16,
            borderRadius: radius.card,
            borderCurve: 'continuous',
            backgroundColor: pressed ? '#FBFBFC' : colors.card,
            borderWidth: t.attention ? 2 : 0,
            borderColor: colors.mango,
            transform: [{ scale: pressed ? 0.985 : 1 }],
          })}
        >
          <View style={{ width: 52, height: 52, borderRadius: 16, borderCurve: 'continuous', backgroundColor: t.wash, alignItems: 'center', justifyContent: 'center' }}>
            <Icon sf={t.icon.sf} md={t.icon.md} size={24} color={t.ink} />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            {t.attention ? (
              <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: colors.mangoTint }}>
                <Icon sf="flag.fill" md="flag" size={11} color={colors.onMango} />
                <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.onMango }}>Cần bạn xử lý</Text>
              </View>
            ) : null}
            <Text style={{ fontFamily: fonts.heavy, fontSize: 16.5, color: colors.ink }}>{t.title}</Text>
            <Text style={[text.footnote, { color: colors.muted }]}>{t.subtitle}</Text>
            {t.extra ? <Text style={[text.caption, { color: colors.ink }]} numberOfLines={2}>{t.extra}</Text> : null}
          </View>
          <Icon sf="chevron.right" md="chevron_right" size={16} color={colors.muted} />
        </Pressable>
      ))}
    </View>
  );
}

function countExpiringSoon(contracts: readonly RentalContract[] | undefined): number {
  if (!contracts) return 0;
  const today = new Date();
  return contracts.filter((c) => c.contractStatus === 'ACTIVE' && !!c.startDate && !!c.endDate && contractProgress(c.startDate, c.endDate, today).expiringSoon).length;
}

/** Slot → application → ward → contract + permit, each stop with its live count ("—" when a list failed, never a made-up zero). */
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
    <View style={{ padding: 16, gap: 14, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <Pressable onPress={onStart} accessibilityRole="button" accessibilityLabel="Chọn ô, bắt đầu ở đây" style={{ flex: 1, alignItems: 'center', gap: 6 }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.cta, alignItems: 'center', justifyContent: 'center' }}>
            <Icon sf="mappin" md="location_on" size={20} color={colors.white} />
          </View>
          <Text style={[text.caption, { color: colors.ink, textAlign: 'center' }]}>Chọn ô</Text>
        </Pressable>
        {stops.map((s) => {
          const lit = (s.value ?? 0) > 0;
          return (
            <View key={s.label} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
              <View
                style={{
                  minWidth: 44,
                  height: 44,
                  borderRadius: 22,
                  paddingHorizontal: 6,
                  backgroundColor: lit ? colors.brandTint : colors.sunken,
                  borderWidth: lit ? 2 : 0,
                  borderColor: colors.brand,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={[{ fontFamily: fonts.code, fontSize: 22, color: lit ? colors.primary : colors.muted }, tabular]}>
                  {s.failed ? '—' : s.value == null ? '·' : s.value}
                </Text>
              </View>
              <Text style={[text.caption, { color: colors.ink, textAlign: 'center' }]}>{s.label}</Text>
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 12, backgroundColor: colors.leafTint }}>
        <Icon sf="checkmark.shield.fill" md="verified_user" size={16} color={colors.onLeaf} />
        <Text style={[text.caption, { flex: 1, color: colors.onLeaf }]}>Phường duyệt đơn là hợp đồng và giấy phép QR được tạo tự động.</Text>
      </View>
    </View>
  );
}
