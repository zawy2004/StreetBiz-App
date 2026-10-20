import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { KeyValueList, StatTile } from '@/components/common/Blocks';
import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { ListGroup, ListRow } from '@/components/common/ListGroup';
import { Skeleton } from '@/components/feedback/Skeleton';
import { ErrorState, ListSkeleton } from '@/components/feedback/States';
import { StateView } from '@/components/feedback/StateView';
import { showToast } from '@/components/feedback/Toast';
import { Screen } from '@/components/layout/Screen';
import { StatusHeader } from '@/components/native/StatusHeader';
import { StatusPill } from '@/components/status/StatusPill';
import { sideApi, SideApiError, type RenewalRequest, type RentalContract } from '@/core/api/side-api';
import { statusLabel } from '@/core/constants/status-labels';
import { AmenityRow, RentFigure } from '@/features/sidewalk-slots/components/SlotParts';
import { contractProgress, splitContracts } from '@/features/sidewalk-slots/my-slots-view';
import { formatAreaSqm, formatHours, formatSize } from '@/features/sidewalk-slots/slot-format';
import { useAuthStore } from '@/store/auth-store';
import { colors, fonts, radius, shadow, tabular, text } from '@/theme';
import { Pass } from '@/ui';
import { formatVietnamDate } from '@/utils/format';
import { ContractCard, PassPlate, TermRing } from '../components/ContractParts';

const go = (href: string) => router.push(href as Href);

export function useContract(contractId: number) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['side', userId, 'contract', contractId],
    queryFn: () => sideApi.getContract(contractId),
    enabled: Number.isFinite(contractId),
  });
}

/** Heavy section title in the v5 rhythm. */
function Heading({ children, aside }: { children: string; aside?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Text accessibilityRole="header" style={{ flex: 1, fontFamily: fonts.heavy, fontSize: 21, lineHeight: 27, letterSpacing: -0.2, color: colors.ink }}>
        {children}
      </Text>
      {aside}
    </View>
  );
}

/**
 * V17 Hợp đồng thuê ô (SIDE-05), v5: where they stand in two sign figures (live, to renew), the
 * earliest end date, the live contracts as small passes with their term rings, ended ones folded.
 */
export function ContractsListScreen() {
  const userId = useAuthStore((s) => s.user?.id);
  const [showEnded, setShowEnded] = useState(false);
  const contracts = useQuery({ queryKey: ['side', userId, 'contracts'], queryFn: () => sideApi.listContracts() });
  const { live, ended } = splitContracts(contracts.data ?? []);
  const today = new Date();
  const soon = live.filter((c) => c.contractStatus === 'ACTIVE' && contractProgress(c.startDate, c.endDate, today).expiringSoon).length;
  const earliest = live.map((c) => c.endDate).filter(Boolean).sort()[0];
  const card = (c: RentalContract, isLive: boolean) => (
    <ContractCard
      key={c.contractId}
      contract={c}
      live={isLive}
      onOpen={() => go(`/vendor/slots/contracts/${c.contractId}`)}
      onPermit={() => go(`/vendor/slots/contracts/${c.contractId}/permit`)}
      onRenew={() => go(`/vendor/slots/contracts/${c.contractId}/renewal`)}
    />
  );

  return (
    <Screen onRefresh={() => void contracts.refetch()} refreshing={contracts.isRefetching} gap={14}>
      <Stack.Screen options={{ title: 'Hợp đồng thuê ô' }} />
      {contracts.isPending ? (
        <>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Skeleton height={120} radius={radius.card} style={{ flex: 1 }} />
            <Skeleton height={120} radius={radius.card} style={{ flex: 1 }} />
          </View>
          <ListSkeleton rows={2} height={170} />
        </>
      ) : contracts.isError ? (
        <ErrorState error={contracts.error} onRetry={() => void contracts.refetch()} />
      ) : (contracts.data ?? []).length === 0 ? (
        <StateView
          icon={{ sf: 'signature', md: 'contract' }}
          title="Chưa có hợp đồng nào"
          body="Khi Phường duyệt đơn thuê, hợp đồng và giấy phép QR được tạo tự động."
          action={{ label: 'Chọn ô để thuê', onPress: () => router.dismissTo('/vendor/slots' as Href) }}
        />
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <StatTile value={String(live.length)} label={live.length > 0 ? 'hợp đồng đang hiệu lực' : 'không có hợp đồng đang hiệu lực'} tone={live.length > 0 ? 'ok' : 'ink'} icon={{ sf: 'checkmark.seal.fill', md: 'verified' }} />
            <StatTile value={String(soon)} label="cần gia hạn trong 14 ngày tới" tone={soon > 0 ? 'warn' : 'ink'} icon={{ sf: 'calendar.badge.exclamationmark', md: 'event_upcoming' }} />
          </View>
          <Text style={[text.footnote, tabular, { color: soon ? colors.onMango : colors.muted, fontFamily: soon ? fonts.semibold : fonts.regular, marginBottom: 6 }]}>
            {earliest ? `Hết hạn sớm nhất: ${formatVietnamDate(earliest)}.` : 'Gia hạn trước 14 ngày để giấy phép không bị gián đoạn.'}
          </Text>
          {live.map((c) => card(c, true))}
          {ended.length > 0 ? (
            <>
              <Pressable
                onPress={() => setShowEnded((v) => !v)}
                accessibilityRole="button"
                accessibilityState={{ expanded: showEnded }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, marginTop: 8 }}
              >
                <Text style={[{ fontFamily: fonts.heavy, fontSize: 19, color: colors.ink, flex: 1 }, tabular]}>Đã kết thúc ({ended.length})</Text>
                <Icon sf={showEnded ? 'chevron.up' : 'chevron.down'} md={showEnded ? 'expand_less' : 'expand_more'} size={16} color={colors.primary} />
              </Pressable>
              {showEnded ? ended.map((c) => card(c, false)) : null}
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
}

/**
 * V18 Chi tiết hợp đồng, v5: where it stands said once on top (suspended, ending, a renewal
 * waiting), then the contract as a pass (the slot's plate large, the term ring, how much of the
 * term is used; the terms under the tear). The permit is the one action, in thumb reach; renew,
 * transfer, return below; then its timeline and the slot.
 */
export function ContractDetailScreen() {
  const { contractId: raw } = useLocalSearchParams<{ contractId: string }>();
  const contractId = Number(raw);
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();
  const contract = useContract(contractId);
  const slot = useQuery({
    queryKey: ['side', userId, 'slot', contract.data?.slotId],
    queryFn: () => sideApi.getSlot(contract.data!.slotId),
    enabled: !!contract.data,
  });
  const renewals = useQuery({
    queryKey: ['side', userId, 'contract', contractId, 'renewals'],
    queryFn: () => sideApi.listRenewals(contractId),
    enabled: Number.isFinite(contractId),
  });
  const openRenewal = renewals.data?.find((r) => r.renewalStatus === 'PENDING' || r.renewalStatus === 'UNDER_REVIEW');
  const withdrawRenewal = useMutation({
    mutationFn: () => sideApi.withdrawRenewal(contractId, openRenewal!.renewalId),
    onSuccess: (result) => {
      showToast(result.message);
      void queryClient.invalidateQueries({ queryKey: ['side', userId, 'contract', contractId, 'renewals'] });
    },
    onError: (err) => showToast(err instanceof SideApiError ? err.message : 'Không rút được đơn gia hạn.', 'error'),
  });

  if (contract.isPending) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Hợp đồng' }} />
        <Skeleton height={320} radius={radius.pass} />
        <ListSkeleton rows={3} height={60} />
      </Screen>
    );
  }
  if (contract.isError) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Hợp đồng' }} />
        <ErrorState error={contract.error} onRetry={() => void contract.refetch()} />
      </Screen>
    );
  }
  const data = contract.data;
  const isActive = data.contractStatus === 'ACTIVE';
  const live = isActive || data.contractStatus === 'SUSPENDED';
  const progress = contractProgress(data.startDate, data.endDate, new Date());
  const expiringSoon = isActive && progress.expiringSoon;
  const { label, tone } = statusLabel(data.contractStatus);
  const s = slot.data;
  const path = (p: string) => `/vendor/slots/contracts/${data.contractId}/${p}`;
  const accent = data.contractStatus === 'SUSPENDED' ? colors.danger : expiringSoon ? colors.mango : isActive ? colors.leaf : colors.muted;

  return (
    <Screen
      onRefresh={() => void Promise.all([contract.refetch(), renewals.refetch(), slot.refetch()])}
      refreshing={contract.isRefetching}
      gap={22}
      footer={
        isActive ? (
          <Button label="Mở giấy phép QR" size={56} icon={{ sf: 'qrcode', md: 'qr_code_2' }} onPress={() => go(path('permit'))} accessibilityHint="Xuất trình khi cán bộ kiểm tra" />
        ) : !live ? (
          <Button label="Tìm ô khác" size={56} icon={{ sf: 'map', md: 'map' }} onPress={() => router.dismissTo('/vendor/slots' as Href)} />
        ) : undefined
      }
    >
      <Stack.Screen options={{ title: `Hợp đồng #${data.contractId}` }} />

      {data.contractStatus === 'SUSPENDED' ? (
        <StatusHeader tone="danger" title="Hợp đồng đang tạm ngưng" detail="Giấy phép, gia hạn, chuyển nhượng và trả ô tạm khoá cho đến khi Phường gỡ tạm ngưng." />
      ) : null}
      {expiringSoon && !openRenewal ? (
        <StatusHeader tone="pending" icon={{ sf: 'calendar.badge.exclamationmark', md: 'event_upcoming' }} title="Sắp hết hạn" detail="Gia hạn để tiếp tục thuê ô này và giữ giấy phép liên tục." />
      ) : null}
      {openRenewal ? (
        <StatusHeader
          tone="pending"
          icon={{ sf: 'hourglass', md: 'hourglass_top' }}
          title={`Đơn gia hạn thêm ${openRenewal.requestedTermDays} ngày`}
          detail={openRenewal.renewalStatus === 'UNDER_REVIEW' ? 'Phường đang xét duyệt.' : 'Đang chờ Phường xử lý.'}
          action={{
            label: withdrawRenewal.isPending ? 'Đang rút…' : 'Rút đơn gia hạn',
            onPress: () =>
              Alert.alert('Rút đơn gia hạn?', 'Phường sẽ không xét đơn này nữa.', [
                { text: 'Giữ đơn', style: 'cancel' },
                { text: 'Rút đơn', style: 'destructive', onPress: () => withdrawRenewal.mutate() },
              ]),
          }}
        />
      ) : null}
      {data.cancellationReason ? <StatusHeader tone="neutral" title="Lý do huỷ" detail={data.cancellationReason} /> : null}

      <Pass
        accent={accent}
        head={
          <View style={{ gap: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={{ flex: 1, gap: 8 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.muted }}>Hợp đồng thuê ô vỉa hè</Text>
                <PassPlate code={data.slotCode} />
                <StatusPill label={label} tone={tone} />
              </View>
              {live ? <TermRing startDate={data.startDate} endDate={data.endDate} size={92} /> : null}
            </View>
            <Text style={[text.title3, { color: colors.ink }]} numberOfLines={3}>
              {data.zoneName}
            </Text>
            {live ? (
              <View style={{ gap: 8 }}>
                <View style={{ height: 10, borderRadius: 5, backgroundColor: colors.sunken, overflow: 'hidden' }}>
                  <View style={{ width: `${progress.percent}%`, height: '100%', borderRadius: 5, backgroundColor: expiringSoon ? colors.mango : colors.leaf }} />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
                  <Text style={[text.caption, { color: colors.ink }, tabular]}>{formatVietnamDate(data.startDate)}</Text>
                  <Text style={[text.caption, { color: colors.muted }, tabular]}>Đã dùng {progress.percent}% thời hạn</Text>
                  <Text style={[text.caption, { color: colors.ink }, tabular]}>{formatVietnamDate(data.endDate)}</Text>
                </View>
              </View>
            ) : (
              <Text style={[text.footnote, { color: colors.muted }, tabular]}>
                {formatVietnamDate(data.startDate)} – {formatVietnamDate(data.endDate)}
              </Text>
            )}
          </View>
        }
        stub={
          <KeyValueList
            rows={[
              s ? { label: 'Giá thuê', value: <RentFigure slot={s} size={15} /> } : null,
              s && formatSize(s.widthMeters, s.lengthMeters) ? { label: 'Kích thước', value: [formatSize(s.widthMeters, s.lengthMeters), formatAreaSqm(s.widthMeters, s.lengthMeters)].filter(Boolean).join(', ') } : null,
              s ? { label: 'Giờ bán', value: formatHours(s.availableFrom, s.availableTo) } : null,
              { label: 'Mã hợp đồng', value: `#${data.contractId}`, mono: true },
              { label: 'Lập ngày', value: formatVietnamDate(data.createdAt) },
            ]}
          />
        }
      />

      {isActive ? (
        <ListGroup title="Thao tác">
          <ListRow
            icon={{ sf: 'calendar.badge.plus', md: 'event_repeat' }}
            tint={expiringSoon ? colors.onMango : colors.leaf}
            tileColor={expiringSoon ? colors.mangoTint : colors.leafTint}
            title="Gia hạn"
            subtitle={openRenewal ? 'Đã có đơn đang chờ' : 'Gửi yêu cầu kéo dài thời hạn'}
            onPress={() => go(path('renewal'))}
            disabled={!!openRenewal}
          />
          <ListRow icon={{ sf: 'arrow.left.arrow.right', md: 'swap_horiz' }} tint={colors.ink} tileColor={colors.sunken} title="Chuyển nhượng" subtitle="Chuyển ô cho hộ kinh doanh khác" onPress={() => go(path('transfer'))} />
          <ListRow icon={{ sf: 'xmark.circle', md: 'cancel' }} destructive title="Trả ô" subtitle="Kết thúc hợp đồng trước hạn" onPress={() => go(path('return'))} />
        </ListGroup>
      ) : null}

      <Timeline contract={data} openRenewal={openRenewal} renewals={renewals.data ?? []} />

      {s ? (
        <View style={{ gap: 14 }}>
          <Heading>Ô đang thuê</Heading>
          <Pressable
            onPress={() => go(`/vendor/slots/${s.slotId}`)}
            accessibilityRole="button"
            accessibilityLabel={`Xem ô ${s.slotCode}`}
            style={({ pressed }) => ({ padding: 16, gap: 12, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadow.card, transform: [{ scale: pressed ? 0.985 : 1 }] })}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={[text.headline, { flex: 1, color: colors.ink }]} numberOfLines={2}>{s.zoneName}</Text>
              <Icon sf="chevron.right" md="chevron_right" size={14} color={colors.muted} />
            </View>
            <AmenityRow slot={s} />
          </Pressable>
        </View>
      ) : null}
    </Screen>
  );
}

/** The contract's dates in order on one rail (drawn up, start, today, end or cancellation), then its renewals. */
function Timeline({ contract, openRenewal, renewals }: { contract: RentalContract; openRenewal: RenewalRequest | undefined; renewals: RenewalRequest[] }) {
  const [now] = useState(() => Date.now());
  const marks: { label: string; date: string | null; t: number; today?: boolean; tone: string }[] = [];
  if (contract.createdAt && !Number.isNaN(Date.parse(contract.createdAt))) marks.push({ label: 'Lập hợp đồng', date: contract.createdAt, t: Date.parse(contract.createdAt), tone: colors.muted });
  if (contract.startDate) marks.push({ label: 'Bắt đầu', date: contract.startDate, t: Date.parse(contract.startDate), tone: colors.leaf });
  if (contract.cancelledAt && !Number.isNaN(Date.parse(contract.cancelledAt))) marks.push({ label: 'Đã huỷ', date: contract.cancelledAt, t: Date.parse(contract.cancelledAt), tone: colors.danger });
  else if (contract.endDate) marks.push({ label: 'Hết hạn', date: contract.endDate, t: Date.parse(contract.endDate), tone: colors.onDanger });
  marks.push({ label: 'Hôm nay', date: null, t: now, today: true, tone: colors.cta });
  marks.sort((a, b) => a.t - b.t);
  const past = renewals.filter((r) => r !== openRenewal);
  return (
    <View style={{ gap: 14 }}>
      <Heading>Dòng thời gian</Heading>
      <View style={{ padding: 18, gap: 14, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadow.card }}>
        <View>
          {marks.map((m, i) => (
            <View key={m.label} style={{ flexDirection: 'row', gap: 14, minHeight: 44 }}>
              <View style={{ alignItems: 'center', width: 18 }}>
                <View style={{ width: m.today ? 18 : 12, height: m.today ? 18 : 12, borderRadius: 9, marginTop: m.today ? 2 : 5, backgroundColor: m.tone, borderWidth: m.today ? 4 : 0, borderColor: colors.brandTint }} />
                {i < marks.length - 1 || openRenewal ? <View style={{ flex: 1, width: 3, borderRadius: 2, backgroundColor: m.t <= now ? colors.leaf : colors.line, marginTop: 3 }} /> : null}
              </View>
              <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingBottom: 12 }}>
                <Text style={[text.callout, { color: m.today ? colors.primary : colors.ink, fontFamily: m.today ? fonts.heavy : fonts.medium }]}>{m.label}</Text>
                {m.date ? <Text style={[text.callout, { color: colors.ink, fontFamily: fonts.semibold }, tabular]}>{formatVietnamDate(m.date)}</Text> : null}
              </View>
            </View>
          ))}
          {openRenewal ? (
            <View style={{ flexDirection: 'row', gap: 14 }}>
              <View style={{ width: 18, alignItems: 'center' }}>
                <View style={{ width: 12, height: 12, borderRadius: 6, marginTop: 4, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.mango }} />
              </View>
              <Text style={[text.footnote, { flex: 1, color: colors.onMango, fontFamily: fonts.semibold }]}>Chờ duyệt gia hạn thêm {openRenewal.requestedTermDays} ngày</Text>
            </View>
          ) : null}
        </View>
        {past.length > 0 ? (
          <View style={{ gap: 12 }}>
            <View style={{ borderTopWidth: 2, borderStyle: 'dashed', borderColor: colors.line }} />
            <Text style={[text.headline, { color: colors.ink }]}>Lịch sử gia hạn</Text>
            {past.map((r) => {
              const st = statusLabel(r.renewalStatus);
              return (
                <View key={r.renewalId} style={{ gap: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <Text style={[text.footnote, { flex: 1, color: colors.ink }, tabular]}>
                      <Text style={{ fontFamily: fonts.code, fontSize: 16 }}>+{r.requestedTermDays}</Text> ngày, gửi {formatVietnamDate(r.createdAt)}
                    </Text>
                    <StatusPill label={st.label} tone={st.tone} />
                  </View>
                  {r.newEndDate ? <Text style={[text.caption, { color: colors.onLeaf }, tabular]}>Hết hạn mới: {formatVietnamDate(r.newEndDate)}</Text> : null}
                  {r.reviewDecisionReason ? <Text style={[text.caption, { color: colors.muted }]}>{r.reviewDecisionReason}</Text> : null}
                </View>
              );
            })}
          </View>
        ) : null}
      </View>
    </View>
  );
}
