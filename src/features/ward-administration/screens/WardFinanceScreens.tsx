import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';

import { Card, KeyValueList, Segments } from '@/components/common/Blocks';
import { Button } from '@/components/common/Button';
import { SlotPlate } from '@/components/common/SlotPlate';
import { Banner } from '@/components/feedback/Banner';
import { ErrorState, ListSkeleton } from '@/components/feedback/States';
import { StateView } from '@/components/feedback/StateView';
import { showToast } from '@/components/feedback/Toast';
import { DateField } from '@/components/forms/DateField';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { StatusPill } from '@/components/status/StatusPill';
import { errorMessage } from '@/core/api';
import { statusLabel } from '@/core/constants/status-labels';
import { colors, fonts, radius, tabular, text } from '@/theme';
import { formatVietnamDate, formatVietnamDateTime, formatVnd } from '@/utils/format';
import { violationTypeLabels } from '../ward-api';
import { wardFinanceApi, type OfflineMethod, type WardFeeItem, type WardFinanceContractDetail, type WardPenaltyItem } from '../ward-finance-api';

/** W18 Thu phí & điều chỉnh: every contract with money on it, most owed first. */
export function WardFinanceListScreen() {
  const list = useQuery({ queryKey: ['ward', 'finance', 'contracts'], queryFn: wardFinanceApi.listContracts });
  const [q, setQ] = useState('');
  const [only, setOnly] = useState<'OWING' | 'ALL'>('OWING');
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return [...(list.data ?? [])]
      .filter((c) => (only === 'ALL' || c.outstanding > 0 || c.unpaidPenalties > 0) && (!needle || c.vendorName.toLowerCase().includes(needle) || c.slotCode.toLowerCase().includes(needle)))
      .sort((a, b) => b.outstanding + b.unpaidPenalties - (a.outstanding + a.unpaidPenalties));
  }, [list.data, q, only]);
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: 'Thu phí & điều chỉnh' }} />
      <FlatList
        data={list.isPending ? [] : rows}
        keyExtractor={(c) => String(c.contractId)}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} tintColor={colors.cta} colors={[colors.cta]} />}
        ListHeaderComponent={
          <View style={{ gap: 10, paddingBottom: 4 }}>
            <TextField label="Tìm hộ hoặc ô" value={q} onChangeText={setQ} />
            <Segments<'OWING' | 'ALL'> value={only} onChange={setOnly} options={[{ key: 'OWING', label: 'Còn nợ' }, { key: 'ALL', label: 'Tất cả' }]} />
          </View>
        }
        renderItem={({ item: c }) => (
          <Pressable onPress={() => router.push(`/ward/more/finance/${c.contractId}` as Href)} accessibilityRole="button" style={({ pressed }) => ({ padding: 14, gap: 6, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: pressed ? '#FBFBFC' : colors.card, borderWidth: c.overdueCount ? 1.5 : 0, borderColor: colors.danger })}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <SlotPlate code={c.slotCode} />
              <Text style={[text.subhead, { flex: 1, color: colors.ink }]} numberOfLines={1}>{c.vendorName}</Text>
              <StatusPill label={statusLabel(c.contractStatus).label} tone={statusLabel(c.contractStatus).tone} />
            </View>
            <Text style={[text.caption, { color: colors.muted }]}>{c.zoneName} · đến {formatVietnamDate(c.endDate)}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Text style={[{ fontFamily: fonts.bold, fontSize: 14, color: c.outstanding ? colors.primary : colors.onLeaf }, tabular]}>{c.outstanding ? `Còn ${formatVnd(c.outstanding)}` : 'Đã nộp đủ phí'}</Text>
              {c.overdueCount ? <StatusPill label={`${c.overdueCount} kỳ quá hạn`} tone="danger" /> : null}
              {c.unpaidPenalties ? <StatusPill label={`Phạt ${formatVnd(c.unpaidPenalties)}`} tone="pending" /> : null}
            </View>
          </Pressable>
        )}
        ListEmptyComponent={list.isPending ? <ListSkeleton rows={4} height={100} /> : list.isError ? <ErrorState error={list.error} onRetry={() => void list.refetch()} /> : <StateView icon={{ sf: 'checkmark.seal', md: 'verified' }} tone="neutral" title="Không có hợp đồng còn nợ" body="Mọi kỳ phí và tiền phạt đã được nộp." />}
      />
    </View>
  );
}

type Target = { kind: 'fee'; item: WardFeeItem; action: 'pay' | 'adjust' | 'waive' } | { kind: 'penalty'; item: WardPenaltyItem; action: 'pay' | 'waive' } | { kind: 'deposit' } | { kind: 'price' };

/**
 * W19 Thu phí một hợp đồng: instalments and penalties with what the ward may do to each — record
 * a payment taken at the office, adjust or waive with a reason — plus the deposit refund and the
 * slot's own price. Every change carries the officer and a reason (BR-46).
 */
export function WardFinanceDetailScreen() {
  const { contractId } = useLocalSearchParams<{ contractId: string }>();
  const id = Number(contractId);
  const detail = useQuery({ queryKey: ['ward', 'finance', 'contract', id], queryFn: () => wardFinanceApi.getContract(id), enabled: Number.isFinite(id) });
  const [target, setTarget] = useState<Target | null>(null);
  if (detail.isPending) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Hợp đồng' }} />
        <ListSkeleton rows={4} height={90} />
      </Screen>
    );
  }
  if (detail.isError) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Hợp đồng' }} />
        <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />
      </Screen>
    );
  }
  const d = detail.data;
  return (
    <Screen onRefresh={() => void detail.refetch()} refreshing={detail.isRefetching}>
      <Stack.Screen options={{ title: `HĐ #${d.contractId}` }} />
      <Card style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <SlotPlate code={d.slotCode} />
          <Text style={[text.subhead, { flex: 1, color: colors.ink }]}>{d.vendorName}</Text>
          <StatusPill label={statusLabel(d.contractStatus).label} tone={statusLabel(d.contractStatus).tone} />
        </View>
        <KeyValueList
          rows={[
            { label: 'Tuyến', value: d.zoneName },
            d.vendorPhone ? { label: 'Điện thoại', value: d.vendorPhone } : null,
            { label: 'Thời hạn', value: `${formatVietnamDate(d.startDate)} – ${formatVietnamDate(d.endDate)}` },
            { label: 'Tổng lịch phí', value: formatVnd(d.scheduleTotal) },
            { label: 'Còn nợ', value: formatVnd(d.outstanding), emphasis: d.outstanding > 0 },
          ]}
        />
      </Card>
      {target ? (
        // Keyed by the target so switching row or action starts a fresh form.
        <ActionForm key={target.kind === 'fee' ? `fee-${target.item.feeItemId}-${target.action}` : target.kind === 'penalty' ? `penalty-${target.item.penaltyId}-${target.action}` : target.kind} detail={d} target={target} onDone={() => setTarget(null)} />
      ) : null}

      <Text style={{ fontFamily: fonts.heavy, fontSize: 17, color: colors.ink }}>Kỳ phí ({d.items.length})</Text>
      {d.items.map((it) => {
        const owed = it.status === 'PENDING' || it.status === 'OVERDUE';
        const s = statusLabel(it.status);
        return (
          <Card key={it.feeItemId} style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[{ fontFamily: fonts.code, fontSize: 16, color: colors.ink }, tabular]}>Kỳ {it.ordinal}</Text>
              <Text style={[text.caption, { flex: 1, color: colors.muted }]}>Hạn {formatVietnamDate(it.dueDate)}</Text>
              <StatusPill label={s.label} tone={s.tone} />
            </View>
            <Text style={[{ fontFamily: fonts.heavy, fontSize: 16, color: colors.ink }, tabular]}>
              {formatVnd(it.amount)}
              {it.depositAmount ? <Text style={[text.caption, { color: colors.muted }]}> (gồm cọc {formatVnd(it.depositAmount)})</Text> : null}
            </Text>
            {it.originalAmount != null ? <Text style={[text.caption, { color: colors.onMango }]}>Đã điều chỉnh từ {formatVnd(it.originalAmount)}{it.adjustmentReason ? `: ${it.adjustmentReason}` : ''}</Text> : null}
            {it.paidAt ? <Text style={[text.caption, { color: colors.onLeaf }]}>Đã nộp {formatVietnamDateTime(it.paidAt)}</Text> : null}
            {owed && it.canEdit ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button label="Thu tại chỗ" onPress={() => setTarget({ kind: 'fee', item: it, action: 'pay' })} style={{ flex: 1.2 }} />
                <Button label="Điều chỉnh" variant="secondary" onPress={() => setTarget({ kind: 'fee', item: it, action: 'adjust' })} style={{ flex: 1 }} />
                <Button label="Miễn" variant="secondary" onPress={() => setTarget({ kind: 'fee', item: it, action: 'waive' })} style={{ flex: 0.8 }} />
              </View>
            ) : null}
          </Card>
        );
      })}

      {d.penalties.length ? <Text style={{ fontFamily: fonts.heavy, fontSize: 17, color: colors.ink }}>Tiền phạt ({d.penalties.length})</Text> : null}
      {d.penalties.map((p) => {
        const s = statusLabel(p.status);
        return (
          <Card key={p.penaltyId} style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[text.subhead, { flex: 1, color: colors.ink }]}>{violationTypeLabels[p.violationType] ?? p.violationType}</Text>
              <StatusPill label={s.label} tone={s.tone} />
            </View>
            <Text style={[{ fontFamily: fonts.heavy, fontSize: 16, color: colors.ink }, tabular]}>{formatVnd(p.amount)}</Text>
            <Text style={[text.caption, { color: colors.muted }]}>{p.decisionNumber ? `QĐ ${p.decisionNumber} · ` : ''}{formatVietnamDate(p.createdAt)}</Text>
            {p.waiverReason ? <Text style={[text.caption, { color: colors.onMango }]}>Miễn: {p.waiverReason}</Text> : null}
            {p.status === 'UNPAID' ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button label="Thu tại chỗ" onPress={() => setTarget({ kind: 'penalty', item: p, action: 'pay' })} style={{ flex: 1 }} />
                <Button label="Miễn phạt" variant="secondary" onPress={() => setTarget({ kind: 'penalty', item: p, action: 'waive' })} style={{ flex: 1 }} />
              </View>
            ) : null}
          </Card>
        );
      })}

      <Card style={{ gap: 8 }}>
        <Text style={{ fontFamily: fonts.heavy, fontSize: 16, color: colors.ink }}>Tiền cọc</Text>
        <KeyValueList rows={[{ label: 'Đã nộp', value: formatVnd(d.depositPaid) }, d.depositRefund ? { label: 'Đã hoàn', value: `${formatVnd(d.depositRefund.amount)} · ${formatVietnamDate(d.depositRefund.refundedAt)}` } : null, d.depositRefund?.deductionReason ? { label: 'Lý do trừ', value: d.depositRefund.deductionReason } : null]} />
        {d.canRefundDeposit ? <Button label="Hoàn cọc" variant="secondary" onPress={() => setTarget({ kind: 'deposit' })} /> : d.refundBlockedReason && !d.depositRefund ? <Text style={[text.caption, { color: colors.muted }]}>{d.refundBlockedReason}</Text> : null}
      </Card>
      <Card style={{ gap: 8 }}>
        <Text style={{ fontFamily: fonts.heavy, fontSize: 16, color: colors.ink }}>Giá riêng của ô</Text>
        <Text style={[text.footnote, { color: colors.ink }]}>
          {d.slotPriceOverride != null ? `${formatVnd(d.slotPriceOverride)}/${d.rentalMode === 'STANDARD' ? 'tháng' : 'ngày'} (giá tuyến ${formatVnd(d.zonePrice)})` : `Theo giá tuyến: ${formatVnd(d.zonePrice)}/${d.rentalMode === 'STANDARD' ? 'tháng' : 'ngày'}`}
        </Text>
        <Button label="Đặt giá riêng" variant="secondary" onPress={() => setTarget({ kind: 'price' })} />
      </Card>
    </Screen>
  );
}

function ActionForm({ detail: d, target, onDone }: { detail: WardFinanceContractDetail; target: Target; onDone: () => void }) {
  const cache = useQueryClient();
  const [method, setMethod] = useState<OfflineMethod>('CASH');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  // An adjustment starts from the instalment's current amount and due date, as on the web.
  const adjusting = target.kind === 'fee' && target.action === 'adjust' ? target.item : null;
  const [amount, setAmount] = useState(target.kind === 'deposit' ? String(d.depositPaid) : adjusting ? String(adjusting.amount) : '');
  const [dueDate, setDueDate] = useState(adjusting ? adjusting.dueDate.slice(0, 10) : '');
  const run = useMutation({
    mutationFn: async () => {
      if (target.kind === 'fee' && target.action === 'pay') return wardFinanceApi.recordOfflinePayment({ target: 'FEE', targetId: target.item.feeItemId, method, reference: reference.trim(), note: note.trim() || null });
      if (target.kind === 'penalty' && target.action === 'pay') return wardFinanceApi.recordOfflinePayment({ target: 'PENALTY', targetId: target.item.penaltyId, method, reference: reference.trim(), note: note.trim() || null });
      if (target.kind === 'fee' && target.action === 'adjust') return wardFinanceApi.adjustFeeItem(target.item.feeItemId, { newAmount: amount ? Number(amount) : null, newDueDate: dueDate || null, reason: reason.trim() });
      if (target.kind === 'fee' && target.action === 'waive') return wardFinanceApi.waiveFeeItem(target.item.feeItemId, reason.trim());
      if (target.kind === 'penalty' && target.action === 'waive') return wardFinanceApi.waivePenalty(target.item.penaltyId, reason.trim());
      if (target.kind === 'deposit') return wardFinanceApi.refundDeposit(d.contractId, { amount: Number(amount), method, reference: reference.trim() || null, deductionReason: Number(amount) < d.depositPaid ? reason.trim() : null });
      return wardFinanceApi.setSlotPrice(d.slotId, amount ? Number(amount) : null, reason.trim());
    },
    onSuccess: async (r) => {
      showToast(r.message);
      await cache.invalidateQueries({ queryKey: ['ward', 'finance'] });
      await cache.invalidateQueries({ queryKey: ['ward', 'reports'] });
      onDone();
    },
    onError: (e) => showToast(errorMessage(e), 'error'),
  });
  const isPay = (target.kind === 'fee' || target.kind === 'penalty') && target.action === 'pay';
  const isWaive = (target.kind === 'fee' || target.kind === 'penalty') && target.action === 'waive';
  const isAdjust = target.kind === 'fee' && target.action === 'adjust';
  const title = isPay ? 'Ghi nhận thu tại chỗ' : isWaive ? 'Miễn khoản này' : isAdjust ? 'Điều chỉnh kỳ phí' : target.kind === 'deposit' ? 'Hoàn tiền cọc' : 'Giá riêng của ô';
  const money = target.kind === 'fee' ? target.item.amount : target.kind === 'penalty' ? target.item.amount : null;
  const valid = isPay
    ? reference.trim().length > 0
    : isWaive
      ? reason.trim().length > 0
      : isAdjust
        ? reason.trim().length > 0 && (!!amount || !!dueDate)
        : target.kind === 'deposit'
          ? Number(amount) >= 0 && Number(amount) <= d.depositPaid && (Number(amount) === d.depositPaid || reason.trim().length > 0)
          : reason.trim().length > 0;
  const confirm = () =>
    Alert.alert(title, money != null ? `Số tiền: ${formatVnd(money)}` : 'Xác nhận thao tác này?', [
      { text: 'Quay lại', style: 'cancel' },
      { text: 'Xác nhận', onPress: () => run.mutate() },
    ]);
  return (
    <View style={{ padding: 14, gap: 10, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, borderWidth: 2, borderColor: colors.cta }}>
      <Text style={{ fontFamily: fonts.heavy, fontSize: 16, color: colors.ink }}>{title}</Text>
      {money != null ? <Text style={[{ fontFamily: fonts.heavy, fontSize: 20, color: colors.primary }, tabular]}>{formatVnd(money)}</Text> : null}
      {isPay || target.kind === 'deposit' ? <Segments<OfflineMethod> value={method} onChange={setMethod} options={[{ key: 'CASH', label: 'Tiền mặt' }, { key: 'BANK_TRANSFER', label: 'Chuyển khoản' }]} /> : null}
      {isPay ? (
        <>
          <TextField label="Số biên lai / mã giao dịch" value={reference} onChangeText={setReference} />
          <TextField label="Ghi chú" optional value={note} onChangeText={setNote} />
          <Banner tone="neutral">Chỉ ghi nhận khoản phường đã thực thu tại trụ sở. Hoá đơn được xuất từ ghi nhận này.</Banner>
        </>
      ) : null}
      {isAdjust ? (
        <>
          <TextField label="Số tiền mới" optional value={amount} onChangeText={(v) => setAmount(v.replace(/[^0-9]/g, ''))} keyboardType="number-pad" />
          <DateField label="Hạn nộp mới" value={dueDate} onChange={setDueDate} />
        </>
      ) : null}
      {target.kind === 'deposit' ? (
        <>
          <TextField label="Số tiền hoàn" value={amount} onChangeText={(v) => setAmount(v.replace(/[^0-9]/g, ''))} keyboardType="number-pad" hint={`Tối đa ${formatVnd(d.depositPaid)}`} />
          <TextField label="Mã giao dịch" optional value={reference} onChangeText={setReference} />
        </>
      ) : null}
      {target.kind === 'price' ? <TextField label={`Giá riêng (/${d.rentalMode === 'STANDARD' ? 'tháng' : 'ngày'})`} optional value={amount} onChangeText={(v) => setAmount(v.replace(/[^0-9]/g, ''))} keyboardType="number-pad" hint="Để trống để dùng lại giá tuyến" /> : null}
      {!isPay ? <TextField label={target.kind === 'deposit' ? 'Lý do trừ cọc (nếu hoàn thiếu)' : 'Lý do'} value={reason} onChangeText={setReason} multiline /> : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button label="Huỷ" variant="secondary" onPress={onDone} style={{ flex: 1 }} />
        <Button label="Xác nhận" loading={run.isPending} disabled={!valid} onPress={confirm} style={{ flex: 1.4 }} />
      </View>
    </View>
  );
}
