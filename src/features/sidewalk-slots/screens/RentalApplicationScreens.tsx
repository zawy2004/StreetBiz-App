import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { KeyValueList } from '@/components/common/Blocks';
import { Button } from '@/components/common/Button';
import { Chip } from '@/components/common/Chip';
import { Icon } from '@/components/common/Icon';
import { Skeleton } from '@/components/feedback/Skeleton';
import { ErrorState, ListSkeleton } from '@/components/feedback/States';
import { StateView } from '@/components/feedback/StateView';
import { showToast } from '@/components/feedback/Toast';
import { Screen } from '@/components/layout/Screen';
import { StatusPill } from '@/components/status/StatusPill';
import { apiAssetUrl } from '@/core/api/asset-url';
import { sideApi, SideApiError, type RentalApplication } from '@/core/api/side-api';
import { statusLabel } from '@/core/constants/status-labels';
import { useAuthStore } from '@/store/auth-store';
import { colors, fonts, radius, shadow, sign, statusTones, tabular, text } from '@/theme';
import { Pass, Plate } from '@/ui';
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
/** The band across the top of the form: the outcome's colour once decided, street orange while open. */
const FORM_ACCENT: Record<string, string> = {
  APPROVED: colors.leaf,
  REJECTED: colors.danger,
  WITHDRAWN: colors.muted,
  MORE_INFORMATION_REQUIRED: colors.mango,
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
    <Screen onRefresh={() => void applications.refetch()} refreshing={applications.isRefetching} gap={14}>
      <Stack.Screen options={{ title: 'Đơn thuê ô' }} />
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {APPLICATION_FILTERS.map((f) => {
          const on = filter === f.value;
          const n = counts[f.value];
          return (
            <Chip
              key={f.value}
              label={f.label}
              selected={on}
              onPress={() => setFilter(f.value)}
              accessibilityRole="radio"
              leading={
                n ? (
                  <View style={{ minWidth: 30, height: 30, borderRadius: 15, paddingHorizontal: 6, backgroundColor: on ? colors.white : colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={[{ fontFamily: fonts.code, fontSize: 15, color: colors.primary }, tabular]}>{n}</Text>
                  </View>
                ) : undefined
              }
            />
          );
        })}
      </View>
      {applications.isPending ? (
        <ListSkeleton rows={3} height={170} />
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
  const attention = needsMoreInformation(app.applicationStatus);
  return (
    <Pressable
      onPress={() => go(`/vendor/slots/rental-applications/${app.applicationId}`)}
      accessibilityRole="button"
      accessibilityLabel={`Đơn #${app.applicationId}, ô ${slot.data?.slotCode ?? app.slotId}, ${label}`}
      style={({ pressed }) => ({
        borderRadius: radius.card,
        borderCurve: 'continuous',
        backgroundColor: colors.card,
        boxShadow: shadow.card,
        borderWidth: attention ? 2 : 0,
        borderColor: colors.sticker,
        overflow: 'hidden',
        transform: [{ scale: pressed ? 0.985 : 1 }],
      })}
    >
      <View style={{ height: 5, backgroundColor: FORM_ACCENT[app.applicationStatus] ?? colors.brand }} />
      <View style={{ padding: 16, gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Plate code={slot.data?.slotCode ?? `#${app.slotId}`} />
          <Text style={[text.headline, { flex: 1, color: colors.ink }]} numberOfLines={2}>
            {slot.data?.zoneName ?? ' '}
          </Text>
          <StatusPill label={label} tone={tone} />
        </View>
        {stops ? <StopsLine stops={stops} compact /> : null}
        <WardNote app={app} clamp />
        <Text style={[text.caption, { color: colors.muted }, tabular]}>
          Đơn #{app.applicationId}, nộp {formatVietnamDate(app.createdAt)}, thuê {app.requestedTermDays} ngày
        </Text>
      </View>
    </Pressable>
  );
}

/** Sent, ward review, outcome: three stops on a road; the reached part is painted green. */
function StopsLine({ stops, compact }: { stops: ApplicationStop[]; compact?: boolean }) {
  const dot = (s: ApplicationStop) => {
    switch (s.state) {
      case 'done':
      case 'approved':
        return { bg: colors.leaf, ink: colors.white, sf: 'checkmark', md: 'check' };
      case 'attention':
        return { bg: colors.sticker, ink: colors.plate, sf: 'exclamationmark', md: 'priority_high' };
      case 'rejected':
        return { bg: colors.danger, ink: colors.white, sf: 'xmark', md: 'close' };
      case 'waiting':
      case 'reviewing':
        return { bg: colors.cta, ink: colors.white, sf: 'clock', md: 'schedule' };
      case 'withdrawn':
        return { bg: colors.sunken, ink: colors.muted, sf: 'arrow.uturn.left', md: 'undo' };
      default:
        return { bg: colors.sunken, ink: colors.muted, sf: 'circle', md: 'radio_button_unchecked' };
    }
  };
  const size = compact ? 28 : 36;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
      {stops.map((s, i) => {
        const d = dot(s);
        return (
          <View key={s.label} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
            <View style={{ height: size, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' }}>
              {i > 0 ? (
                <View style={{ position: 'absolute', left: 0, right: '50%', height: 4, backgroundColor: stopReached(stops, i) ? colors.leaf : colors.line }} />
              ) : null}
              {i < stops.length - 1 ? (
                <View style={{ position: 'absolute', left: '50%', right: 0, height: 4, backgroundColor: stopReached(stops, i + 1) ? colors.leaf : colors.line }} />
              ) : null}
              <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: d.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.card }}>
                <Icon sf={d.sf} md={d.md} size={compact ? 12 : 15} color={d.ink} weight="bold" />
              </View>
            </View>
            <Text style={[text.caption, { color: colors.ink, textAlign: 'center' }]}>{s.label}</Text>
            {!compact && s.note ? <Text style={[text.caption, { color: colors.muted, textAlign: 'center', fontFamily: fonts.regular }]}>{s.note}</Text> : null}
            {!compact && s.date ? <Text style={[text.caption, tabular, { color: colors.muted, textAlign: 'center', fontFamily: fonts.regular }]}>{formatVietnamDate(s.date)}</Text> : null}
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
    <View style={{ flexDirection: 'row', gap: 10, padding: 14, borderRadius: radius.control, borderCurve: 'continuous', backgroundColor: t.wash }}>
      <Icon sf={t.sf} md={t.md} size={18} color={t.ink} style={{ marginTop: 1 }} />
      <Text style={[text.footnote, { flex: 1, color: t.ink }]} numberOfLines={clamp ? 3 : undefined}>
        <Text style={{ fontFamily: fonts.bold }}>{lead}</Text>
        {body}
      </Text>
    </View>
  );
}

/**
 * V15 Chi tiết đơn thuê, v5: the application as the paper form it is, a pass with the slot's plate
 * large and the ward's stamp pressed on it (an empty dashed frame while it is still open), the
 * details under the tear; then the three stops, the slot, and withdraw.
 */
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
        <Skeleton height={300} radius={radius.pass} />
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
      gap={22}
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
      <Pass
        accent={FORM_ACCENT[app.applicationStatus] ?? colors.brand}
        head={
          <View style={{ gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <View style={{ flex: 1, gap: 8 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.muted }}>Đơn thuê ô vỉa hè</Text>
                <View
                  accessibilityLabel={`Ô ${s ? s.slotCode : `#${app.slotId}`}`}
                  style={{ alignSelf: 'flex-start', paddingHorizontal: 12, minHeight: 56, justifyContent: 'center', borderRadius: radius.plate, backgroundColor: colors.plate, borderWidth: 3, borderColor: colors.white, boxShadow: shadow.card }}
                >
                  <Text maxFontSizeMultiplier={1.2} style={[sign.title, { color: colors.white, letterSpacing: 1 }, tabular]}>
                    {s ? s.slotCode : `#${app.slotId}`}
                  </Text>
                </View>
                <StatusPill label={label} tone={tone} />
              </View>
              <DecisionStamp status={app.applicationStatus} reviewedAt={app.reviewedAt} />
            </View>
            {OUTCOME_WORDS[app.applicationStatus] ? (
              <Text style={{ fontFamily: fonts.semibold, fontSize: 15.5, lineHeight: 22, color: colors.ink }}>{OUTCOME_WORDS[app.applicationStatus]}</Text>
            ) : null}
          </View>
        }
        stub={
          <KeyValueList
            rows={[
              { label: 'Mã đơn', value: `#${app.applicationId}`, mono: true },
              { label: 'Hình thức', value: METHOD_LABEL[app.applicationMethod] ?? app.applicationMethod },
              { label: 'Ngày nộp', value: formatVietnamDate(app.createdAt) },
              { label: 'Thời hạn thuê', value: `${app.requestedTermDays} ngày` },
              app.reviewedAt ? { label: 'Phường xem xét', value: formatVietnamDate(app.reviewedAt) } : null,
            ]}
          />
        }
      />

      <WardNote app={app} />

      {stops ? (
        <View style={{ gap: 14 }}>
          <Text accessibilityRole="header" style={{ fontFamily: fonts.heavy, fontSize: 21, lineHeight: 27, color: colors.ink }}>Tiến trình</Text>
          <View style={{ padding: 18, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadow.card }}>
            <StopsLine stops={stops} />
          </View>
        </View>
      ) : null}

      {s ? (
        <View style={{ gap: 14 }}>
          <Text accessibilityRole="header" style={{ fontFamily: fonts.heavy, fontSize: 21, lineHeight: 27, color: colors.ink }}>Ô đăng ký thuê</Text>
          <Pressable
            onPress={() => go(`/vendor/slots/${s.slotId}`)}
            accessibilityRole="button"
            accessibilityLabel={`Xem ô ${s.slotCode}`}
            style={({ pressed }) => ({ flexDirection: 'row', gap: 14, padding: 12, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadow.card, transform: [{ scale: pressed ? 0.985 : 1 }] })}
          >
            <View style={{ width: 92, minHeight: 92, borderRadius: radius.photo, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
              {s.imageUrls[0] ? (
                <Image source={{ uri: apiAssetUrl(s.imageUrls[0]) }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" />
              ) : (
                <Icon sf="square.dashed" md="crop_free" size={28} color={colors.primary} />
              )}
              <Plate code={s.slotCode} style={{ position: 'absolute', left: 6, bottom: 6 }} />
            </View>
            <View style={{ flex: 1, gap: 6, paddingVertical: 2 }}>
              <SlotStateChip state={slotDisplayState(s, now)} small />
              <Text style={[text.subhead, { color: colors.ink }]} numberOfLines={2}>{s.zoneName}</Text>
              <RentFigure slot={s} size={16} />
              <Text style={[text.caption, tabular, { color: colors.muted }]}>
                {[formatSize(s.widthMeters, s.lengthMeters), formatHours(s.availableFrom, s.availableTo)].filter(Boolean).join(', ')}
              </Text>
              <AmenityRow slot={s} compact />
            </View>
            <Icon sf="chevron.right" md="chevron_right" size={14} color={colors.muted} style={{ alignSelf: 'center' }} />
          </Pressable>
        </View>
      ) : null}

      {canWithdraw ? (
        <View style={{ gap: 8, alignItems: 'center' }}>
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
    WITHDRAWN: { text: 'ĐÃ RÚT', ink: statusTones.neutral.ink, open: false },
  };
  const w = words[status];
  if (!w) return null;
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      style={{
        transform: [{ rotate: '-9deg' }],
        borderWidth: w.open ? 2 : 4,
        borderStyle: w.open ? 'dashed' : 'solid',
        borderColor: w.ink,
        borderRadius: radius.sticker,
        paddingHorizontal: 12,
        paddingVertical: 8,
        alignItems: 'center',
        opacity: w.open ? 0.75 : 0.92,
        marginTop: 18,
      }}
    >
      <Text maxFontSizeMultiplier={1.2} style={{ fontFamily: fonts.code, fontSize: 17, lineHeight: 21, color: w.ink, letterSpacing: 0.6 }}>{w.text}</Text>
      {!w.open && reviewedAt ? <Text maxFontSizeMultiplier={1.2} style={[{ fontFamily: fonts.code, fontSize: 12, color: w.ink }, tabular]}>{formatVietnamDate(reviewedAt)}</Text> : null}
    </View>
  );
}
