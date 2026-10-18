import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { Card, KeyValueList } from '@/components/common/Blocks';
import { Button } from '@/components/common/Button';
import { Chip } from '@/components/common/Chip';
import { Icon } from '@/components/common/Icon';
import { SlotPlate } from '@/components/common/SlotPlate';
import { ErrorState, ListSkeleton } from '@/components/feedback/States';
import { StateView } from '@/components/feedback/StateView';
import { showToast } from '@/components/feedback/Toast';
import { Screen } from '@/components/layout/Screen';
import { StatusPill } from '@/components/status/StatusPill';
import { apiAssetUrl } from '@/core/api/asset-url';
import { sideApi, SideApiError, type RentalApplication } from '@/core/api/side-api';
import { statusLabel } from '@/core/constants/status-labels';
import { useAuthStore } from '@/store/auth-store';
import { colors, fonts, radius, statusTones, tabular, text } from '@/theme';
import { formatVietnamDate } from '@/utils/format';
import { AmenityRow, RentFigure, SlotStateChip } from '../components/SlotParts';
import { applicationProgress, stopReached, type ApplicationStop } from '../application-progress';
import { APPLICATION_FILTERS, countApplications, filterApplications, needsMoreInformation, type ApplicationFilter } from '../my-slots-view';
import { formatHours, formatSize } from '../slot-format';
import { slotDisplayState } from '../slot-stats';
import { useWorkspaceStore } from '../workspace-store';

const go = (href: string) => router.push(href as Href);
const METHOD_LABEL: Record<string, string> = { AUTO_ADJACENT: 'Ô liền kề mặt tiền', MANUAL_SELECTED: 'Ô mở' };
// SIDE-04: the backend's ApplicationStatuses.Open, the only ones a withdraw still means something for.
const WITHDRAWABLE = ['PENDING', 'UNDER_REVIEW', 'MORE_INFORMATION_REQUIRED'];
const OUTCOME_WORDS: Record<string, string> = {
  PENDING: 'Đơn đã gửi tới Phường, đang chờ xem xét.',
  UNDER_REVIEW: 'Phường đang xem xét đơn của bạn.',
  MORE_INFORMATION_REQUIRED: 'Phường cần thêm thông tin, xem ý kiến của Phường bên dưới.',
  APPROVED: 'Hợp đồng và giấy phép số đã được tạo tự động.',
  REJECTED: 'Bạn có thể chọn ô khác và nộp đơn mới.',
  WITHDRAWN: 'Bạn đã rút đơn này. Có thể nộp đơn mới.',
};

function useSlot(slotId: number | undefined) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['side', userId, 'slot', slotId],
    queryFn: () => sideApi.getSlot(slotId!),
    enabled: slotId != null,
  });
}

/** V14 Đơn thuê ô (SIDE-04): every application with its stage, filterable, newest first. */
export function RentalApplicationsScreen() {
  const userId = useAuthStore((s) => s.user?.id);
  const [filter, setFilter] = useState<ApplicationFilter>('ALL');
  const applications = useQuery({ queryKey: ['side', userId, 'applications'], queryFn: () => sideApi.listApplications() });
  const all = applications.data ?? [];
  const counts = countApplications(all);
  const shown = filterApplications(all, filter).reverse();

  return (
    <Screen onRefresh={() => void applications.refetch()} refreshing={applications.isRefetching} gap={12}>
      <Stack.Screen options={{ title: 'Đơn thuê ô' }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {APPLICATION_FILTERS.map((f) => (
          <Chip key={f.value} label={counts[f.value] ? `${f.label} · ${counts[f.value]}` : f.label} selected={filter === f.value} onPress={() => setFilter(f.value)} accessibilityRole="radio" />
        ))}
      </View>
      {applications.isPending ? (
        <ListSkeleton rows={3} height={150} />
      ) : applications.isError ? (
        <ErrorState error={applications.error} onRetry={() => void applications.refetch()} />
      ) : shown.length === 0 ? (
        <StateView
          icon={{ sf: 'doc.text.magnifyingglass', md: 'plagiarism' }}
          title={all.length === 0 ? 'Chưa có đơn thuê nào' : 'Không có đơn trong mục này'}
          body={all.length === 0 ? 'Chọn một ô còn trống trên tuyến để nộp đơn thuê.' : 'Chọn mục khác để xem các đơn còn lại.'}
          action={all.length === 0 ? { label: 'Chọn ô', onPress: () => router.dismissTo('/vendor/slots' as Href) } : undefined}
        />
      ) : (
        shown.map((app) => <ApplicationCard key={app.applicationId} app={app} />)
      )}
    </Screen>
  );
}

function ApplicationCard({ app }: { app: RentalApplication }) {
  const slot = useSlot(app.slotId);
  const { label, tone } = statusLabel(app.applicationStatus);
  const stops = applicationProgress(app.applicationStatus, app.createdAt, app.reviewedAt);
  return (
    <Pressable
      onPress={() => go(`/vendor/slots/rental-applications/${app.applicationId}`)}
      accessibilityRole="button"
      accessibilityLabel={`Đơn #${app.applicationId}, ô ${slot.data?.slotCode ?? app.slotId}, ${label}`}
      style={({ pressed }) => ({ padding: 16, gap: 12, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: pressed ? '#FBFBFC' : colors.card, borderWidth: needsMoreInformation(app.applicationStatus) ? 2 : 0, borderColor: colors.mango })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <SlotPlate code={slot.data?.slotCode ?? `#${app.slotId}`} />
        <Text style={[text.subhead, { flex: 1, color: colors.ink }]} numberOfLines={1}>
          {slot.data?.zoneName ?? ' '}
        </Text>
        <StatusPill label={label} tone={tone} />
      </View>
      {stops ? <StopsLine stops={stops} compact /> : null}
      <WardNote app={app} clamp />
      <Text style={[text.caption, { color: colors.muted }, tabular]}>
        Đơn #{app.applicationId} · nộp {formatVietnamDate(app.createdAt)} · {app.requestedTermDays} ngày
      </Text>
    </Pressable>
  );
}

/** Sent → ward review → outcome, as three dots on a road; the reached part is painted. */
function StopsLine({ stops, compact }: { stops: ApplicationStop[]; compact?: boolean }) {
  const dot = (s: ApplicationStop) => {
    switch (s.state) {
      case 'done':
      case 'approved':
        return { bg: colors.leaf, ink: colors.white, sf: 'checkmark', md: 'check' };
      case 'attention':
        return { bg: colors.mango, ink: colors.onMango, sf: 'exclamationmark', md: 'priority_high' };
      case 'rejected':
        return { bg: colors.danger, ink: colors.white, sf: 'xmark', md: 'close' };
      case 'waiting':
      case 'reviewing':
        return { bg: colors.brandTint, ink: colors.primary, sf: 'clock', md: 'schedule' };
      case 'withdrawn':
        return { bg: colors.sunken, ink: colors.muted, sf: 'arrow.uturn.left', md: 'undo' };
      default:
        return { bg: colors.sunken, ink: colors.muted, sf: 'circle', md: 'radio_button_unchecked' };
    }
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
      {stops.map((s, i) => {
        const d = dot(s);
        return (
          <View key={s.label} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            <View style={{ height: compact ? 26 : 32, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' }}>
              {i > 0 ? (
                <View style={{ position: 'absolute', left: 0, right: '50%', height: 3, backgroundColor: stopReached(stops, i) ? colors.leaf : colors.line }} />
              ) : null}
              {i < stops.length - 1 ? (
                <View style={{ position: 'absolute', left: '50%', right: 0, height: 3, backgroundColor: stopReached(stops, i + 1) ? colors.leaf : colors.line }} />
              ) : null}
              <View style={{ width: compact ? 26 : 32, height: compact ? 26 : 32, borderRadius: 16, backgroundColor: d.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.card }}>
                <Icon sf={d.sf} md={d.md} size={compact ? 11 : 14} color={d.ink} weight="bold" />
              </View>
            </View>
            <Text style={[text.caption, { color: colors.ink, textAlign: 'center' }]}>{s.label}</Text>
            {!compact && (s.note || s.date) ? (
              <Text style={[text.caption, { color: colors.muted, textAlign: 'center', fontFamily: fonts.regular }]}>
                {[s.note, s.date ? formatVietnamDate(s.date) : null].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

/** What the ward said, when it said something worth showing. */
function WardNote({ app, clamp }: { app: Pick<RentalApplication, 'applicationStatus' | 'reviewDecisionReason' | 'reviewedAt'>; clamp?: boolean }) {
  let tone: keyof typeof statusTones;
  let lead: string;
  let body: string;
  if (needsMoreInformation(app.applicationStatus)) {
    tone = 'pending';
    lead = 'Phường yêu cầu: ';
    body = app.reviewDecisionReason ?? 'Bổ sung thông tin cho hồ sơ.';
  } else if (app.applicationStatus === 'REJECTED') {
    tone = 'danger';
    lead = 'Lý do từ chối: ';
    body = app.reviewDecisionReason ?? 'Phường không nêu lý do.';
  } else if (app.applicationStatus === 'APPROVED' && app.reviewedAt) {
    tone = 'ok';
    lead = '';
    body = `Phường đã duyệt đơn ngày ${formatVietnamDate(app.reviewedAt)}.`;
  } else return null;
  const t = statusTones[tone];
  return (
    <View style={{ flexDirection: 'row', gap: 10, padding: 12, borderRadius: 14, borderCurve: 'continuous', backgroundColor: t.wash }}>
      <Icon sf={t.sf} md={t.md} size={17} color={t.ink} />
      <Text style={[text.footnote, { flex: 1, color: t.ink }]} numberOfLines={clamp ? 3 : undefined}>
        <Text style={{ fontFamily: fonts.bold }}>{lead}</Text>
        {body}
      </Text>
    </View>
  );
}

/** V15 Chi tiết đơn thuê: the application as its paper form, its three stops, the slot, and withdraw. */
export function RentalApplicationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const applicationId = Number(id);
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();
  const focusSlot = useWorkspaceStore((s) => s.focusSlot);
  const [now] = useState(() => Date.now());
  const application = useQuery({
    queryKey: ['side', userId, 'application', applicationId],
    queryFn: () => sideApi.getApplication(applicationId),
    enabled: Number.isFinite(applicationId),
  });
  const slot = useSlot(application.data?.slotId);
  const withdraw = useMutation({
    mutationFn: () => sideApi.withdrawApplication(applicationId),
    onSuccess: (result) => {
      showToast(result.message);
      void queryClient.invalidateQueries({ queryKey: ['side', userId, 'applications'] });
      void queryClient.invalidateQueries({ queryKey: ['side', userId, 'application', applicationId] });
      void queryClient.invalidateQueries({ queryKey: ['side', userId, 'slots'] });
    },
    onError: (error) => showToast(error instanceof SideApiError ? error.message : 'Không rút được đơn.', 'error'),
  });

  if (application.isPending) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Chi tiết đơn thuê' }} />
        <ListSkeleton rows={1} height={260} />
        <ListSkeleton rows={1} height={120} />
      </Screen>
    );
  }
  if (application.isError) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Chi tiết đơn thuê' }} />
        <ErrorState error={application.error} onRetry={() => void application.refetch()} />
      </Screen>
    );
  }
  const app = application.data;
  const { label, tone } = statusLabel(app.applicationStatus);
  const stops = applicationProgress(app.applicationStatus, app.createdAt, app.reviewedAt);
  const canWithdraw = WITHDRAWABLE.includes(app.applicationStatus);
  const s = slot.data;
  const slotFree = s != null && slotDisplayState(s, now) === 'AVAILABLE';
  const reopen = (app.applicationStatus === 'REJECTED' || app.applicationStatus === 'WITHDRAWN') && slotFree;

  const askWithdraw = () =>
    Alert.alert('Rút đơn thuê này?', 'Đơn sẽ chuyển sang đã rút và không thể mở lại. Bạn có thể nộp đơn mới sau.', [
      { text: 'Giữ đơn', style: 'cancel' },
      { text: 'Rút đơn', style: 'destructive', onPress: () => withdraw.mutate() },
    ]);

  return (
    <Screen
      onRefresh={() => void Promise.all([application.refetch(), slot.refetch()])}
      refreshing={application.isRefetching}
      footer={
        app.applicationStatus === 'APPROVED' ? (
          <Button label="Xem hợp đồng & giấy phép" size={56} icon={{ sf: 'signature', md: 'contract' }} onPress={() => go('/vendor/slots/contracts')} />
        ) : reopen && s ? (
          <Button
            label="Nộp lại đơn cho ô này"
            size={56}
            icon={{ sf: 'arrow.clockwise', md: 'refresh' }}
            onPress={() => {
              focusSlot(s.zoneId, s.slotId);
              go(`/vendor/slots/${s.slotId}`);
            }}
          />
        ) : undefined
      }
    >
      <Stack.Screen options={{ title: `Đơn #${app.applicationId}` }} />
      <View style={{ borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, overflow: 'hidden' }}>
        <View style={{ height: 6, flexDirection: 'row' }}>
          {Array.from({ length: 20 }, (_, i) => (
            <View key={i} style={{ flex: 1, backgroundColor: i % 2 ? colors.white : colors.brand }} />
          ))}
        </View>
        <View style={{ padding: 16, gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 12, letterSpacing: 0.6, color: colors.muted }}>ĐƠN THUÊ Ô VỈA HÈ</Text>
              <Text style={[text.title2, { color: colors.ink }]}>{s ? `Ô ${s.slotCode}` : `Ô #${app.slotId}`}</Text>
              <StatusPill label={label} tone={tone} />
            </View>
            <DecisionStamp status={app.applicationStatus} reviewedAt={app.reviewedAt} />
          </View>
          {OUTCOME_WORDS[app.applicationStatus] ? <Text style={[text.callout, { color: colors.ink }]}>{OUTCOME_WORDS[app.applicationStatus]}</Text> : null}
          <WardNote app={app} />
          <KeyValueList
            rows={[
              { label: 'Mã đơn', value: `#${app.applicationId}`, mono: true },
              { label: 'Hình thức', value: METHOD_LABEL[app.applicationMethod] ?? app.applicationMethod },
              { label: 'Ngày nộp', value: formatVietnamDate(app.createdAt) },
              { label: 'Thời hạn thuê', value: `${app.requestedTermDays} ngày` },
              app.reviewedAt ? { label: 'Phường xem xét', value: formatVietnamDate(app.reviewedAt) } : null,
            ]}
          />
        </View>
      </View>

      {stops ? (
        <Card style={{ gap: 12 }}>
          <Text style={{ fontFamily: fonts.heavy, fontSize: 16, color: colors.ink }}>Tiến trình</Text>
          <StopsLine stops={stops} />
        </Card>
      ) : null}

      {s ? (
        <Pressable onPress={() => go(`/vendor/slots/${s.slotId}`)} accessibilityRole="button" accessibilityLabel={`Xem ô ${s.slotCode}`}>
          <Card style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontFamily: fonts.heavy, fontSize: 16, color: colors.ink }}>Ô đăng ký thuê</Text>
              <SlotStateChip state={slotDisplayState(s, now)} small />
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {s.imageUrls[0] ? (
                <Image source={{ uri: apiAssetUrl(s.imageUrls[0]) }} style={{ width: 84, height: 84, borderRadius: 14 }} contentFit="cover" />
              ) : null}
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[text.subhead, { color: colors.ink }]}>{s.zoneName}</Text>
                <RentFigure slot={s} size={16} />
                <Text style={[text.caption, { color: colors.muted }]}>
                  {[formatSize(s.widthMeters, s.lengthMeters), formatHours(s.availableFrom, s.availableTo)].filter(Boolean).join(' · ')}
                </Text>
              </View>
            </View>
            <AmenityRow slot={s} compact />
          </Card>
        </Pressable>
      ) : null}

      {canWithdraw ? (
        <View style={{ gap: 6, alignItems: 'center' }}>
          <Button label="Rút đơn" variant="secondary" icon={{ sf: 'arrow.uturn.backward', md: 'undo' }} loading={withdraw.isPending} onPress={askWithdraw} style={{ alignSelf: 'stretch' }} />
          <Text style={[text.caption, { color: colors.muted }]}>Rút đơn không thể hoàn tác.</Text>
        </View>
      ) : null}
    </Screen>
  );
}

/** A tilted ward stamp: an empty dashed frame while open, pressed down with its date once decided. */
function DecisionStamp({ status, reviewedAt }: { status: string; reviewedAt: string | null }) {
  const words: Record<string, { text: string; ink: string; open: boolean }> = {
    PENDING: { text: 'CHỜ XEM XÉT', ink: colors.muted, open: true },
    UNDER_REVIEW: { text: 'ĐANG XÉT', ink: colors.onMango, open: true },
    MORE_INFORMATION_REQUIRED: { text: 'CẦN BỔ SUNG', ink: colors.onMango, open: true },
    APPROVED: { text: 'ĐÃ DUYỆT', ink: colors.onLeaf, open: false },
    REJECTED: { text: 'TỪ CHỐI', ink: colors.onDanger, open: false },
    WITHDRAWN: { text: 'ĐÃ RÚT', ink: '#2B3640', open: false },
  };
  const w = words[status];
  if (!w) return null;
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      style={{
        transform: [{ rotate: '-8deg' }],
        borderWidth: w.open ? 2 : 4,
        borderStyle: w.open ? 'dashed' : 'solid',
        borderColor: w.ink,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
        alignItems: 'center',
        opacity: w.open ? 0.75 : 0.9,
        marginTop: 8,
      }}
    >
      <Text style={{ fontFamily: fonts.code, fontSize: 15, color: w.ink, letterSpacing: 0.5 }}>{w.text}</Text>
      {!w.open && reviewedAt ? <Text style={[{ fontFamily: fonts.code, fontSize: 11, color: w.ink }, tabular]}>{formatVietnamDate(reviewedAt)}</Text> : null}
    </View>
  );
}
