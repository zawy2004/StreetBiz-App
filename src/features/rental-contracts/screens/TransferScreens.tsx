import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { Card, KeyValueList, SectionHeader } from '@/components/common/Blocks';
import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { Sheet } from '@/components/common/Sheet';
import { SheetOption } from '@/components/common/SheetOption';
import { SlotPlate } from '@/components/common/SlotPlate';
import { Banner } from '@/components/feedback/Banner';
import { ErrorState, ListSkeleton } from '@/components/feedback/States';
import { StateView } from '@/components/feedback/StateView';
import { showToast } from '@/components/feedback/Toast';
import { Screen } from '@/components/layout/Screen';
import { StatusPill } from '@/components/status/StatusPill';
import { sideApi, SideApiError, type SlotTransferRequest } from '@/core/api/side-api';
import { statusLabel } from '@/core/constants/status-labels';
import { useRegistrations } from '@/features/business-registrations/useRegistrations';
import { TRANSFER_STEP_LABELS, transferSteps } from '@/features/sidewalk-slots/my-slots-view';
import { useAuthStore } from '@/store/auth-store';
import { colors, fonts, radius, tabular, text } from '@/theme';
import { formatVietnamDate } from '@/utils/format';
import { TransferSteps } from '../components/ContractParts';
import { countOutgoingByStage, daysSince } from '../transfer-view';

const go = (href: string) => router.push(href as Href);
const agoText = (iso: string) => {
  const d = daysSince(iso, new Date());
  return d === 0 ? 'hôm nay' : `${d} ngày trước`;
};

function useTransfers() {
  const userId = useAuthStore((s) => s.user?.id);
  const incoming = useQuery({ queryKey: ['side', userId, 'transfers', 'incoming'], queryFn: () => sideApi.listTransfers('incoming') });
  const outgoing = useQuery({ queryKey: ['side', userId, 'transfers', 'outgoing'], queryFn: () => sideApi.listTransfers('outgoing') });
  return { incoming, outgoing };
}

function useDecline(onDone?: () => void) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  return useMutation({
    mutationFn: (transferId: number) => sideApi.declineTransfer(transferId),
    onSuccess: (result) => {
      showToast(result.message);
      void queryClient.invalidateQueries({ queryKey: ['side', userId, 'transfers'] });
      onDone?.();
    },
    onError: (error) => showToast(error instanceof SideApiError ? error.message : 'Không từ chối được yêu cầu.', 'error'),
  });
}

const askDecline = (onYes: () => void) =>
  Alert.alert('Từ chối yêu cầu chuyển nhượng?', 'Bên chuyển sẽ được báo là bạn không nhận ô.', [
    { text: 'Quay lại', style: 'cancel' },
    { text: 'Từ chối', style: 'destructive', onPress: onYes },
  ]);

/** V23 Chuyển nhượng ô (SIDE-12/13): requests waiting on you first, then the ones you sent. */
export function TransfersListScreen() {
  const userId = useAuthStore((s) => s.user?.id);
  const { incoming, outgoing } = useTransfers();
  const decline = useDecline();
  const [choosing, setChoosing] = useState(false);
  const contracts = useQuery({ queryKey: ['side', userId, 'contracts'], queryFn: () => sideApi.listContracts() });
  const active = (contracts.data ?? []).filter((c) => c.contractStatus === 'ACTIVE');
  const waiting = incoming.data?.filter((t) => t.transferStatus === 'PENDING') ?? [];
  const sent = [...(outgoing.data ?? [])].reverse();
  const counts = countOutgoingByStage(outgoing.data ?? []);

  const start = () => {
    if (active.length === 0) return showToast('Bạn chưa có hợp đồng đang hiệu lực để chuyển nhượng.', 'error');
    if (active.length === 1) return go(`/vendor/slots/contracts/${active[0]!.contractId}/transfer`);
    setChoosing(true);
  };

  return (
    <Screen
      onRefresh={() => void Promise.all([incoming.refetch(), outgoing.refetch()])}
      refreshing={incoming.isRefetching || outgoing.isRefetching}
      footer={<Button label="Tạo yêu cầu chuyển nhượng" size={56} icon={{ sf: 'arrow.left.arrow.right', md: 'swap_horiz' }} onPress={start} />}
    >
      <Stack.Screen options={{ title: 'Chuyển nhượng ô' }} />
      <SectionHeader title="Gửi đến bạn" note="Hộ khác muốn chuyển ô cho bạn" />
      {incoming.isPending ? (
        <ListSkeleton rows={1} height={150} />
      ) : incoming.isError ? (
        <ErrorState error={incoming.error} onRetry={() => void incoming.refetch()} />
      ) : waiting.length === 0 ? (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Icon sf="tray" md="inbox" size={20} color={colors.muted} />
          <Text style={[text.footnote, { flex: 1, color: colors.muted }]}>Không có yêu cầu nào chờ bạn.</Text>
        </Card>
      ) : (
        waiting.map((t) => (
          <View key={t.transferId} style={{ padding: 16, gap: 12, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, borderWidth: 2, borderColor: colors.mango }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.mangoTint, alignItems: 'center', justifyContent: 'center' }}>
                <Icon sf="bell.fill" md="notifications" size={18} color={colors.onMango} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <SlotPlate code={t.slotCode} />
                <Text style={[text.subhead, { color: colors.ink }]} numberOfLines={1}>{t.zoneName}</Text>
              </View>
              <StatusPill label="Chờ bạn" tone="pending" />
            </View>
            <Text style={[text.caption, { color: colors.muted }, tabular]}>
              Thời hạn {formatVietnamDate(t.contractStartDate)} – {formatVietnamDate(t.contractEndDate)} · gửi {agoText(t.initiatedAt)}
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button label="Từ chối" variant="secondary" loading={decline.isPending && decline.variables === t.transferId} onPress={() => askDecline(() => decline.mutate(t.transferId))} style={{ flex: 1 }} />
              <Button label="Xem & nhận" onPress={() => go(`/vendor/slots/transfers/${t.transferId}/accept`)} style={{ flex: 1.4 }} />
            </View>
          </View>
        ))
      )}

      <SectionHeader title="Bạn đã gửi" />
      {outgoing.data && outgoing.data.length > 0 ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[
            { label: 'Chờ bên nhận', value: counts.waitingReceiver, ink: colors.onMango, wash: colors.mangoTint },
            { label: 'Chờ Phường', value: counts.waitingWard, ink: colors.sign, wash: colors.signTint },
            { label: 'Đã duyệt', value: counts.approved, ink: colors.onLeaf, wash: colors.leafTint },
            { label: 'Từ chối', value: counts.rejected, ink: colors.onDanger, wash: colors.dangerTint },
          ].map((c) => (
            <View key={c.label} style={{ flex: 1, alignItems: 'center', gap: 2, paddingVertical: 10, borderRadius: 14, backgroundColor: c.value ? c.wash : colors.sunken }}>
              <Text style={[{ fontFamily: fonts.code, fontSize: 20, color: c.value ? c.ink : colors.muted }, tabular]}>{c.value}</Text>
              <Text style={{ fontFamily: fonts.medium, fontSize: 10.5, color: c.value ? c.ink : colors.muted, textAlign: 'center' }}>{c.label}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {outgoing.isPending ? (
        <ListSkeleton rows={2} height={130} />
      ) : outgoing.isError ? (
        <ErrorState error={outgoing.error} onRetry={() => void outgoing.refetch()} />
      ) : sent.length === 0 ? (
        <StateView icon={{ sf: 'arrow.left.arrow.right', md: 'swap_horiz' }} tone="neutral" title="Chưa gửi yêu cầu nào" body="Chuyển ô đang thuê cho hộ kinh doanh khác khi bạn không bán nữa." />
      ) : (
        sent.map((t) => <OutgoingCard key={t.transferId} transfer={t} />)
      )}

      <Sheet visible={choosing} onClose={() => setChoosing(false)} title="Chọn ô muốn chuyển nhượng">
        {active.map((c, i) => (
          <SheetOption
            key={c.contractId}
            title={`Ô ${c.slotCode}`}
            subtitle={`${c.zoneName} · đến ${formatVietnamDate(c.endDate)}`}
            selected={false}
            last={i === active.length - 1}
            onPress={() => {
              setChoosing(false);
              go(`/vendor/slots/contracts/${c.contractId}/transfer`);
            }}
          />
        ))}
      </Sheet>
    </Screen>
  );
}

function OutgoingCard({ transfer }: { transfer: SlotTransferRequest }) {
  const steps = transferSteps(transfer.transferStatus);
  const { label, tone } = statusLabel(transfer.transferStatus);
  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <SlotPlate code={transfer.slotCode} />
          <Text style={[text.subhead, { color: colors.ink }]} numberOfLines={1}>{transfer.zoneName}</Text>
        </View>
        <StatusPill label={label} tone={tone} />
      </View>
      {steps ? <TransferSteps steps={steps} labels={TRANSFER_STEP_LABELS} /> : null}
      {transfer.transferStatus === 'REJECTED' ? <Banner tone="danger" title="Lý do từ chối">{transfer.reviewDecisionReason ?? 'Yêu cầu đã bị từ chối.'}</Banner> : null}
      <Text style={[text.caption, { color: colors.muted }, tabular]}>Gửi {formatVietnamDate(transfer.initiatedAt)} · {agoText(transfer.initiatedAt)}</Text>
    </Card>
  );
}

/** V24 Nhận chuyển nhượng: the slot and term offered, whether you qualify, then accept or decline. */
export function AcceptTransferScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const transferId = Number(id);
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();
  const { incoming } = useTransfers();
  const { registrations } = useRegistrations();
  const done = (message: string) => {
    showToast(message);
    void queryClient.invalidateQueries({ queryKey: ['side', userId, 'transfers'] });
    router.back();
  };
  const accept = useMutation({
    mutationFn: () => sideApi.acceptTransfer(transferId),
    onSuccess: (result) => done(result.message),
    onError: (error) => showToast(error instanceof SideApiError ? error.message : 'Không chấp nhận được yêu cầu.', 'error'),
  });
  const decline = useDecline(() => router.back());

  if (incoming.isPending) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Nhận chuyển nhượng' }} />
        <ListSkeleton rows={1} height={220} />
      </Screen>
    );
  }
  if (incoming.isError) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Nhận chuyển nhượng' }} />
        <ErrorState error={incoming.error} onRetry={() => void incoming.refetch()} />
      </Screen>
    );
  }
  const t = incoming.data.find((x) => x.transferId === transferId);
  if (!t) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Nhận chuyển nhượng' }} />
        <StateView icon={{ sf: 'questionmark.folder', md: 'folder_off' }} tone="neutral" title="Không tìm thấy yêu cầu" body="Yêu cầu có thể đã được xử lý hoặc không gửi cho bạn." />
      </Screen>
    );
  }
  const approved = registrations.some((r) => r.registrationStatus === 'APPROVED');
  const pending = t.transferStatus === 'PENDING';
  const steps = transferSteps(t.transferStatus);
  const { label, tone } = statusLabel(t.transferStatus);

  return (
    <Screen
      footer={
        pending ? (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button label="Từ chối" variant="secondary" size={56} loading={decline.isPending} onPress={() => askDecline(() => decline.mutate(transferId))} style={{ flex: 1 }} />
            <Button label="Nhận ô" size={56} icon={{ sf: 'checkmark.circle.fill', md: 'check_circle' }} loading={accept.isPending} disabled={!approved} onPress={() => accept.mutate()} style={{ flex: 1.5 }} />
          </View>
        ) : undefined
      }
    >
      <Stack.Screen options={{ title: 'Nhận chuyển nhượng' }} />
      <View style={{ borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, padding: 16, gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 12, letterSpacing: 0.6, color: colors.muted }}>Ô ĐƯỢC CHUYỂN CHO BẠN</Text>
            <SlotPlate code={t.slotCode} size="lg" />
          </View>
          <StatusPill label={label} tone={tone} />
        </View>
        <KeyValueList
          rows={[
            { label: 'Tuyến phố', value: t.zoneName },
            { label: 'Thời hạn hợp đồng', value: `${formatVietnamDate(t.contractStartDate)} – ${formatVietnamDate(t.contractEndDate)}` },
            { label: 'Bên chuyển', value: 'Hộ kinh doanh khác' },
            { label: 'Ngày gửi', value: formatVietnamDate(t.initiatedAt) },
          ]}
        />
        {steps ? <TransferSteps steps={steps} labels={TRANSFER_STEP_LABELS} /> : null}
        {t.transferStatus === 'REJECTED' && t.reviewDecisionReason ? <Banner tone="danger" title="Lý do từ chối">{t.reviewDecisionReason}</Banner> : null}
      </View>

      <Card style={{ gap: 10 }}>
        <Text style={{ fontFamily: fonts.heavy, fontSize: 16, color: colors.ink }}>Điều kiện nhận ô</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Icon sf={approved ? 'checkmark.circle.fill' : 'xmark.circle.fill'} md={approved ? 'check_circle' : 'cancel'} size={20} color={approved ? colors.leaf : colors.danger} />
          <Text style={[text.footnote, { flex: 1, color: colors.ink }]}>Hồ sơ kinh doanh: {approved ? 'đã duyệt' : 'chưa có hồ sơ được duyệt'}</Text>
        </View>
        {t.acceptedAt ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Icon sf="checkmark.circle.fill" md="check_circle" size={20} color={colors.leaf} />
            <Text style={[text.footnote, { flex: 1, color: colors.ink }]}>Bạn đã đồng ý ngày {formatVietnamDate(t.acceptedAt)}</Text>
          </View>
        ) : null}
        {!approved ? (
          <Button label="Xem hồ sơ đăng ký" variant="secondary" onPress={() => go('/vendor/home/registrations')} />
        ) : null}
      </Card>
      <Banner tone="neutral">Sau khi bạn đồng ý, Phường duyệt thì ô và giấy phép mới chuyển sang bạn.</Banner>
    </Screen>
  );
}
