import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { Card, KeyValueList } from '@/components/common/Blocks';
import { Icon } from '@/components/common/Icon';
import { ListGroup, ListRow } from '@/components/common/ListGroup';
import { SlotPlate } from '@/components/common/SlotPlate';
import { Banner } from '@/components/feedback/Banner';
import { ErrorState, ListSkeleton } from '@/components/feedback/States';
import { StateView } from '@/components/feedback/StateView';
import { showToast } from '@/components/feedback/Toast';
import { Screen } from '@/components/layout/Screen';
import { StatusPill } from '@/components/status/StatusPill';
import { sideApi, SideApiError, type RenewalRequest, type RentalContract } from '@/core/api/side-api';
import { statusLabel } from '@/core/constants/status-labels';
import { AmenityRow, RentFigure } from '@/features/sidewalk-slots/components/SlotParts';
import { contractProgress, splitContracts } from '@/features/sidewalk-slots/my-slots-view';
import { formatAreaSqm, formatHours, formatSize } from '@/features/sidewalk-slots/slot-format';
import { useAuthStore } from '@/store/auth-store';
import { colors, fonts, radius, tabular, text } from '@/theme';
import { formatVietnamDate } from '@/utils/format';
import { ContractCard, TermRing } from '../components/ContractParts';

const go = (href: string) => router.push(href as Href);

export function useContract(contractId: number) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: ['side', userId, 'contract', contractId],
    queryFn: () => sideApi.getContract(contractId),
    enabled: Number.isFinite(contractId),
  });
}

/** V17 Hợp đồng thuê ô (SIDE-05): where they stand in one line, live contracts, ended ones folded. */
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
    <Screen onRefresh={() => void contracts.refetch()} refreshing={contracts.isRefetching} gap={12}>
      <Stack.Screen options={{ title: 'Hợp đồng thuê ô' }} />
      {contracts.isPending ? (
        <ListSkeleton rows={3} height={150} />
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
          <View style={{ padding: 16, gap: 4, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: soon ? colors.mangoTint : colors.leafTint }}>
            <Text style={{ fontFamily: fonts.heavy, fontSize: 17, color: soon ? colors.onMango : colors.onLeaf }}>
              {live.length > 0 ? `${live.length} hợp đồng đang hiệu lực` : 'Không có hợp đồng đang hiệu lực'}
            </Text>
            <Text style={[text.footnote, { color: soon ? colors.onMango : colors.onLeaf }]}>
              {soon > 0 ? `${soon} cần gia hạn trong 14 ngày tới. ` : ''}
              {earliest ? `Hết hạn sớm nhất: ${formatVietnamDate(earliest)}.` : 'Gia hạn trước 14 ngày để giấy phép không bị gián đoạn.'}
            </Text>
          </View>
          {live.map((c) => card(c, true))}
          {ended.length > 0 ? (
            <>
              <Pressable
                onPress={() => setShowEnded((v) => !v)}
                accessibilityRole="button"
                accessibilityState={{ expanded: showEnded }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 }}
              >
                <Text style={{ fontFamily: fonts.heavy, fontSize: 16, color: colors.ink, flex: 1 }}>Đã kết thúc · {ended.length}</Text>
                <Icon sf={showEnded ? 'chevron.up' : 'chevron.down'} md={showEnded ? 'expand_less' : 'expand_more'} size={16} color={colors.muted} />
              </Pressable>
              {showEnded ? ended.map((c) => card(c, false)) : null}
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
}

/** V18 Chi tiết hợp đồng: the contract as a pass, the four lifecycle actions, its timeline and the slot. */
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
        <ListSkeleton rows={1} height={200} />
        <ListSkeleton rows={4} height={60} />
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

  return (
    <Screen
      onRefresh={() => void Promise.all([contract.refetch(), renewals.refetch(), slot.refetch()])}
      refreshing={contract.isRefetching}
    >
      <Stack.Screen options={{ title: `Hợp đồng #${data.contractId}` }} />
      <View style={{ borderRadius: radius.pass, borderCurve: 'continuous', backgroundColor: colors.card, overflow: 'hidden' }}>
        <View style={{ height: 6, flexDirection: 'row' }}>
          {Array.from({ length: 20 }, (_, i) => (
            <View key={i} style={{ flex: 1, backgroundColor: i % 2 ? colors.white : isActive ? colors.leaf : colors.muted }} />
          ))}
        </View>
        <View style={{ padding: 18, gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            {live ? <TermRing startDate={data.startDate} endDate={data.endDate} size={84} /> : null}
            <View style={{ flex: 1, gap: 6 }}>
              <SlotPlate code={data.slotCode} size="lg" />
              <StatusPill label={label} tone={tone} />
              <Text style={[text.subhead, { color: colors.ink }]} numberOfLines={2}>
                {data.zoneName}
              </Text>
            </View>
          </View>
          {live ? (
            <View style={{ gap: 6 }}>
              <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.sunken, overflow: 'hidden' }}>
                <View style={{ width: `${progress.percent}%`, height: '100%', backgroundColor: expiringSoon ? colors.mango : colors.leaf }} />
              </View>
              <Text style={[text.caption, { color: colors.muted }, tabular]}>
                Đã dùng {progress.percent}% thời hạn · {formatVietnamDate(data.startDate)} – {formatVietnamDate(data.endDate)}
              </Text>
            </View>
          ) : null}
          <KeyValueList
            rows={[
              s ? { label: 'Giá thuê', value: <RentFigure slot={s} size={15} /> } : null,
              s && formatSize(s.widthMeters, s.lengthMeters) ? { label: 'Kích thước', value: [formatSize(s.widthMeters, s.lengthMeters), formatAreaSqm(s.widthMeters, s.lengthMeters)].filter(Boolean).join(' · ') } : null,
              s ? { label: 'Giờ bán', value: formatHours(s.availableFrom, s.availableTo) } : null,
              { label: 'Mã hợp đồng', value: `#${data.contractId}`, mono: true },
              { label: 'Lập ngày', value: formatVietnamDate(data.createdAt) },
            ]}
          />
        </View>
      </View>

      {expiringSoon && !openRenewal ? <Banner tone="warning" title="Sắp hết hạn">Gia hạn để tiếp tục thuê ô này và giữ giấy phép liên tục.</Banner> : null}
      {openRenewal ? (
        <Banner
          tone="warning"
          icon={{ sf: 'hourglass', md: 'hourglass_top' }}
          title={`Đơn gia hạn thêm ${openRenewal.requestedTermDays} ngày`}
          action={{
            label: withdrawRenewal.isPending ? 'Đang rút…' : 'Rút đơn gia hạn',
            onPress: () =>
              Alert.alert('Rút đơn gia hạn?', 'Phường sẽ không xét đơn này nữa.', [
                { text: 'Giữ đơn', style: 'cancel' },
                { text: 'Rút đơn', style: 'destructive', onPress: () => withdrawRenewal.mutate() },
              ]),
          }}
        >
          {openRenewal.renewalStatus === 'UNDER_REVIEW' ? 'Phường đang xét duyệt.' : 'Đang chờ Phường xử lý.'}
        </Banner>
      ) : null}
      {data.cancellationReason ? <Banner tone="neutral" title="Lý do huỷ">{data.cancellationReason}</Banner> : null}
      {data.contractStatus === 'SUSPENDED' ? (
        <Banner tone="danger" title="Hợp đồng đang tạm ngưng">Giấy phép, gia hạn, chuyển nhượng và trả ô tạm khoá cho đến khi Phường gỡ tạm ngưng.</Banner>
      ) : null}

      {isActive ? (
        <ListGroup title="Thao tác">
          <ListRow icon={{ sf: 'qrcode', md: 'qr_code_2' }} title="Giấy phép QR" subtitle="Xuất trình khi cán bộ kiểm tra" onPress={() => go(path('permit'))} />
          <ListRow
            icon={{ sf: 'calendar.badge.plus', md: 'event_repeat' }}
            tint={expiringSoon ? colors.onMango : colors.leaf}
            tileColor={expiringSoon ? colors.mangoTint : colors.leafTint}
            title="Gia hạn"
            subtitle={openRenewal ? 'Đã có đơn đang chờ' : 'Gửi yêu cầu kéo dài thời hạn'}
            onPress={() => go(path('renewal'))}
            disabled={!!openRenewal}
          />
          <ListRow icon={{ sf: 'arrow.left.arrow.right', md: 'swap_horiz' }} tint={colors.sign} tileColor={colors.signTint} title="Chuyển nhượng" subtitle="Chuyển ô cho hộ kinh doanh khác" onPress={() => go(path('transfer'))} />
          <ListRow icon={{ sf: 'xmark.circle', md: 'cancel' }} destructive title="Trả ô" subtitle="Kết thúc hợp đồng trước hạn" onPress={() => go(path('return'))} />
        </ListGroup>
      ) : !live ? (
        <ListGroup>
          <ListRow icon={{ sf: 'map', md: 'map' }} title="Tìm ô khác" subtitle="Hợp đồng đã kết thúc" onPress={() => router.dismissTo('/vendor/slots' as Href)} />
        </ListGroup>
      ) : null}

      <Timeline contract={data} openRenewal={openRenewal} renewals={renewals.data ?? []} />

      {s ? (
        <Pressable onPress={() => go(`/vendor/slots/${s.slotId}`)} accessibilityRole="button" accessibilityLabel={`Xem ô ${s.slotCode}`}>
          <Card style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontFamily: fonts.heavy, fontSize: 16, color: colors.ink }}>Ô đang thuê</Text>
              <Icon sf="chevron.right" md="chevron_right" size={14} color={colors.muted} />
            </View>
            <AmenityRow slot={s} />
          </Card>
        </Pressable>
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
    <Card style={{ gap: 12 }}>
      <Text style={{ fontFamily: fonts.heavy, fontSize: 16, color: colors.ink }}>Dòng thời gian</Text>
      <View>
        {marks.map((m, i) => (
          <View key={m.label} style={{ flexDirection: 'row', gap: 12, minHeight: 40 }}>
            <View style={{ alignItems: 'center', width: 16 }}>
              <View style={{ width: m.today ? 14 : 10, height: m.today ? 14 : 10, borderRadius: 7, marginTop: 4, backgroundColor: m.tone, borderWidth: m.today ? 3 : 0, borderColor: colors.brandTint }} />
              {i < marks.length - 1 || openRenewal ? <View style={{ flex: 1, width: 2, backgroundColor: m.t <= now ? colors.leaf : colors.line, marginTop: 2 }} /> : null}
            </View>
            <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 10 }}>
              <Text style={[text.footnote, { color: colors.ink, fontFamily: m.today ? fonts.bold : fonts.medium }]}>{m.label}</Text>
              {m.date ? <Text style={[text.footnote, { color: colors.muted }, tabular]}>{formatVietnamDate(m.date)}</Text> : null}
            </View>
          </View>
        ))}
        {openRenewal ? (
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ width: 16, alignItems: 'center' }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, marginTop: 4, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.mango }} />
            </View>
            <Text style={[text.footnote, { flex: 1, color: colors.onMango }]}>Chờ duyệt gia hạn thêm {openRenewal.requestedTermDays} ngày</Text>
          </View>
        ) : null}
      </View>
      {past.length > 0 ? (
        <View style={{ gap: 8 }}>
          <View style={{ height: 1, backgroundColor: colors.separator }} />
          <Text style={[text.subhead, { color: colors.ink }]}>Lịch sử gia hạn</Text>
          {past.map((r) => {
            const s = statusLabel(r.renewalStatus);
            return (
              <View key={r.renewalId} style={{ gap: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <Text style={[text.footnote, { color: colors.ink }]}>
                    +{r.requestedTermDays} ngày · gửi {formatVietnamDate(r.createdAt)}
                  </Text>
                  <StatusPill label={s.label} tone={s.tone} />
                </View>
                {r.newEndDate ? <Text style={[text.caption, { color: colors.onLeaf }]}>Hết hạn mới: {formatVietnamDate(r.newEndDate)}</Text> : null}
                {r.reviewDecisionReason ? <Text style={[text.caption, { color: colors.muted }]}>{r.reviewDecisionReason}</Text> : null}
              </View>
            );
          })}
        </View>
      ) : null}
    </Card>
  );
}
