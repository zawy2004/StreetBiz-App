import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';

import { KeyValueList, Segments } from '@/components/common/Blocks';
import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { Banner } from '@/components/feedback/Banner';
import { Skeleton } from '@/components/feedback/Skeleton';
import { ErrorState, ListSkeleton } from '@/components/feedback/States';
import { StateView } from '@/components/feedback/StateView';
import { showToast } from '@/components/feedback/Toast';
import { DateField } from '@/components/forms/DateField';
import { TextField } from '@/components/forms/TextField';
import { Screen } from '@/components/layout/Screen';
import { StatusPill } from '@/components/status/StatusPill';
import { errorMessage } from '@/core/api';
import { statusLabel } from '@/core/constants/status-labels';
import { colors, fonts, radius, shadow, sign, tabular, text } from '@/theme';
import { Pass, Plate } from '@/ui';
import { formatVietnamDate, formatVietnamDateTime, formatVnd } from '@/utils/format';
import { violationTypeLabels } from '../ward-api';
import { wardFinanceApi, type OfflineMethod, type WardFeeItem, type WardFinanceContractDetail, type WardPenaltyItem } from '../ward-finance-api';

/** A heading inside a long screen. */
function Heading({ title, note }: { title: string; note?: string }) {
  return (
    <View style={{ gap: 2, marginTop: 8 }}>
      <Text accessibilityRole="header" style={{ fontFamily: fonts.heavy, fontSize: 19, lineHeight: 25, color: colors.ink }}>{title}</Text>
      {note ? <Text style={[text.footnote, { color: colors.muted }]}>{note}</Text> : null}
    </View>
  );
}

/** A white grouped surface with hairlines between rows. */
function Group({ children }: { children: ReactNode }) {
  return <View style={{ borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.card, boxShadow: shadow.card }}>{children}</View>;
}

/**
 * W18 Thu phí & điều chỉnh, v5 (screens/v5/ward-ops.md): what the ward still has to collect,
 * in sign figures at the top (summed from the list it already loaded), then every contract with
 * money on it, most owed first — the slot plate, the household, the amount owed large.
 */
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
  const all = list.data ?? [];
  const feesOwed = all.reduce((n, c) => n + c.outstanding, 0);
  const finesOwed = all.reduce((n, c) => n + c.unpaidPenalties, 0);
  const owing = all.filter((c) => c.outstanding > 0 || c.unpaidPenalties > 0).length;
  const overdue = all.filter((c) => c.overdueCount > 0).length;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: 'Thu phí & điều chỉnh' }} />
      <FlatList
        data={list.isPending ? [] : rows}
        keyExtractor={(c) => String(c.contractId)}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} tintColor={colors.cta} colors={[colors.cta]} />}
        ListHeaderComponent={
          <View style={{ gap: 14, paddingBottom: 4 }}>
            {list.isPending ? (
              <Skeleton height={170} radius={radius.card} />
            ) : list.data ? (
              // The ward's till: what is still to collect, summed from the contracts loaded here.
              <View accessible accessibilityLabel={`Còn phải thu ${formatVnd(feesOwed + finesOwed)}`} style={{ padding: 20, gap: 12, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadow.card }}>
                <View style={{ gap: 2 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.muted }}>Còn phải thu</Text>
                  <Text maxFontSizeMultiplier={1.3} adjustsFontSizeToFit numberOfLines={1} style={[sign.figure, tabular, { color: feesOwed + finesOwed ? colors.primary : colors.onLeaf }]}>{formatVnd(feesOwed + finesOwed)}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Tally label="Phí thuê ô" value={formatVnd(feesOwed)} wash={colors.brandTint} ink={colors.primary} />
                  <Tally label="Tiền phạt" value={formatVnd(finesOwed)} wash={finesOwed ? colors.mangoTint : colors.sunken} ink={finesOwed ? colors.onMango : colors.muted} />
                </View>
                <Text style={[text.footnote, tabular, { color: colors.ink }]}>
                  {owing ? `${owing} hợp đồng còn nợ${overdue ? `, ${overdue} có kỳ quá hạn` : ''}.` : 'Mọi hợp đồng đã nộp đủ.'}
                </Text>
              </View>
            ) : null}
            <View style={{ minHeight: 52, borderRadius: radius.full, backgroundColor: colors.card, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 16, paddingRight: 6, boxShadow: shadow.card }}>
              <Icon sf="magnifyingglass" md="search" size={18} color={colors.primary} />
              <TextInput value={q} onChangeText={setQ} placeholder="Tìm hộ hoặc ô" placeholderTextColor={colors.muted} autoCorrect={false} returnKeyType="search" accessibilityLabel="Tìm hộ hoặc ô" style={{ flex: 1, minHeight: 46, fontFamily: fonts.medium, fontSize: 16, color: colors.ink }} />
              {q ? (
                <Pressable onPress={() => setQ('')} accessibilityRole="button" accessibilityLabel="Xoá từ khoá" style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon sf="xmark.circle.fill" md="cancel" size={19} color={colors.muted} />
                </Pressable>
              ) : null}
            </View>
            <Segments<'OWING' | 'ALL'> value={only} onChange={setOnly} options={[{ key: 'OWING', label: 'Còn nợ', count: owing }, { key: 'ALL', label: 'Tất cả', count: all.length }]} />
          </View>
        }
        renderItem={({ item: c }) => {
          const s = statusLabel(c.contractStatus);
          const owed = c.outstanding + c.unpaidPenalties;
          return (
            <Pressable
              onPress={() => router.push(`/ward/more/finance/${c.contractId}` as Href)}
              accessibilityRole="button"
              accessibilityLabel={`${c.vendorName}, ô ${c.slotCode}, ${c.outstanding ? `còn ${formatVnd(c.outstanding)}` : 'đã nộp đủ phí'}`}
              style={({ pressed }) => ({ padding: 16, gap: 12, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: pressed ? colors.kerbPaint : colors.card, boxShadow: shadow.card, borderWidth: c.overdueCount ? 2 : 0, borderColor: colors.danger })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Plate code={c.slotCode} />
                <View style={{ flex: 1, gap: 1 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 15.5, lineHeight: 21, color: colors.ink }} numberOfLines={1}>{c.vendorName}</Text>
                  <Text style={[text.footnote, tabular, { color: colors.muted }]} numberOfLines={1}>{`${c.zoneName}, đến ${formatVietnamDate(c.endDate)}`}</Text>
                </View>
                <Icon sf="chevron.right" md="chevron_right" size={13} color={colors.muted} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <Text style={[sign.price, tabular, { color: owed ? colors.primary : colors.onLeaf, marginRight: 4 }]}>{c.outstanding ? `Còn ${formatVnd(c.outstanding)}` : 'Đã nộp đủ phí'}</Text>
                {c.overdueCount ? <StatusPill label={`${c.overdueCount} kỳ quá hạn`} tone="danger" /> : null}
                {c.unpaidPenalties ? <StatusPill label={`Phạt ${formatVnd(c.unpaidPenalties)}`} tone="pending" /> : null}
                {!c.overdueCount && !c.unpaidPenalties ? <StatusPill label={s.label} tone={s.tone} /> : null}
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          list.isPending ? (
            <ListSkeleton rows={4} height={110} />
          ) : list.isError ? (
            <ErrorState error={list.error} onRetry={() => void list.refetch()} />
          ) : q.trim() ? (
            <StateView icon={{ sf: 'magnifyingglass', md: 'search_off' }} tone="neutral" title="Không có hộ khớp" body="Thử tên hộ khác hoặc mã ô." action={{ label: 'Xoá từ khoá', onPress: () => setQ('') }} />
          ) : (
            <StateView icon={{ sf: 'checkmark.seal', md: 'verified' }} tone="neutral" title="Không có hợp đồng còn nợ" body="Mọi kỳ phí và tiền phạt đã được nộp." action={only === 'OWING' && all.length ? { label: 'Xem tất cả hợp đồng', onPress: () => setOnly('ALL') } : undefined} />
          )
        }
      />
    </View>
  );
}

function Tally({ label, value, wash, ink }: { label: string; value: string; wash: string; ink: string }) {
  return (
    <View style={{ flex: 1, padding: 12, gap: 2, borderRadius: radius.control, borderCurve: 'continuous', backgroundColor: wash }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, lineHeight: 16, color: ink }}>{label}</Text>
      <Text adjustsFontSizeToFit numberOfLines={1} maxFontSizeMultiplier={1.4} style={[sign.price, tabular, { color: ink }]}>{value}</Text>
    </View>
  );
}

type Target = { kind: 'fee'; item: WardFeeItem; action: 'pay' | 'adjust' | 'waive' } | { kind: 'penalty'; item: WardPenaltyItem; action: 'pay' | 'waive' } | { kind: 'deposit' } | { kind: 'price' };

/**
 * W19 Thu phí một hợp đồng: instalments and penalties with what the ward may do to each — record
 * a payment taken at the office, adjust or waive with a reason — plus the deposit refund and the
 * slot's own price. Every change carries the officer and a reason (BR-46). v5: the contract's fee
 * book as a pass (slot plate, household, the amount owed in sign figures, how much is paid).
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
        <Skeleton height={260} radius={radius.pass} />
        <ListSkeleton rows={3} height={110} />
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
  const s = statusLabel(d.contractStatus);
  const paidShare = d.scheduleTotal > 0 ? Math.min(1, Math.max(0, (d.scheduleTotal - d.outstanding) / d.scheduleTotal)) : 0;
  const unit = d.rentalMode === 'STANDARD' ? 'tháng' : 'ngày';
  return (
    <Screen onRefresh={() => void detail.refetch()} refreshing={detail.isRefetching}>
      <Stack.Screen options={{ title: `HĐ #${d.contractId}` }} />
      <Pass
        accent={d.outstanding > 0 ? colors.brand : colors.leaf}
        head={
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Plate code={d.slotCode} />
              <View style={{ flex: 1 }} />
              <StatusPill label={s.label} tone={s.tone} />
            </View>
            <View style={{ gap: 2 }}>
              <Text style={{ fontFamily: fonts.heavy, fontSize: 19, lineHeight: 25, color: colors.ink }}>{d.vendorName}</Text>
              <Text style={[text.footnote, { color: colors.muted }]}>{d.zoneName}</Text>
            </View>
            <View style={{ gap: 2 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.muted }}>Còn nợ</Text>
              <Text maxFontSizeMultiplier={1.3} adjustsFontSizeToFit numberOfLines={1} style={[sign.figure, tabular, { color: d.outstanding > 0 ? colors.primary : colors.onLeaf }]}>{formatVnd(d.outstanding)}</Text>
            </View>
            <View accessible accessibilityLabel={`Đã nộp ${Math.round(paidShare * 100)}% tổng lịch phí`} style={{ gap: 6 }}>
              <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.sunken, overflow: 'hidden' }}>
                <View style={{ width: `${Math.round(paidShare * 100)}%`, height: 8, borderRadius: 4, backgroundColor: colors.leaf }} />
              </View>
              <Text style={[text.caption, tabular, { color: colors.muted }]}>{`Đã nộp ${Math.round(paidShare * 100)}% tổng lịch phí ${formatVnd(d.scheduleTotal)}`}</Text>
            </View>
          </View>
        }
        stub={
          <KeyValueList
            rows={[
              d.vendorPhone ? { label: 'Điện thoại', value: d.vendorPhone } : null,
              { label: 'Thời hạn', value: `${formatVietnamDate(d.startDate)} – ${formatVietnamDate(d.endDate)}` },
              { label: 'Tổng lịch phí', value: formatVnd(d.scheduleTotal) },
            ]}
          />
        }
      />
      {target ? (
        // Keyed by the target so switching row or action starts a fresh form.
        <ActionForm key={target.kind === 'fee' ? `fee-${target.item.feeItemId}-${target.action}` : target.kind === 'penalty' ? `penalty-${target.item.penaltyId}-${target.action}` : target.kind} detail={d} target={target} onDone={() => setTarget(null)} />
      ) : null}

      <Heading title={`Kỳ phí (${d.items.length})`} />
      {d.items.length ? (
        <Group>
          {d.items.map((it, i) => {
            const owed = it.status === 'PENDING' || it.status === 'OVERDUE';
            const st = statusLabel(it.status);
            return (
              <View key={it.feeItemId} style={{ padding: 16, gap: 10, borderTopWidth: i ? 1 : 0, borderTopColor: colors.separator, backgroundColor: colors.card }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: it.status === 'PAID' ? colors.leafTint : it.status === 'OVERDUE' ? colors.dangerTint : colors.brandTint, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={[sign.price, tabular, { color: it.status === 'PAID' ? colors.onLeaf : it.status === 'OVERDUE' ? colors.onDanger : colors.primary }]}>{it.ordinal}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 1 }}>
                    <Text style={[{ fontFamily: fonts.heavy, fontSize: 16.5, lineHeight: 22, color: colors.ink }, tabular]}>{formatVnd(it.amount)}</Text>
                    <Text style={[text.footnote, tabular, { color: colors.muted }]}>{`Kỳ ${it.ordinal}, hạn ${formatVietnamDate(it.dueDate)}`}</Text>
                  </View>
                  <StatusPill label={st.label} tone={st.tone} />
                </View>
                {it.depositAmount ? <Text style={[text.caption, tabular, { color: colors.muted }]}>{`Gồm cọc ${formatVnd(it.depositAmount)}`}</Text> : null}
                {it.originalAmount != null ? <Text style={[text.caption, { color: colors.onMango }]}>Đã điều chỉnh từ {formatVnd(it.originalAmount)}{it.adjustmentReason ? `: ${it.adjustmentReason}` : ''}</Text> : null}
                {it.paidAt ? <Text style={[text.caption, { color: colors.onLeaf }]}>Đã nộp {formatVietnamDateTime(it.paidAt)}</Text> : null}
                {owed && it.canEdit ? (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Button label="Thu tại chỗ" variant="sign" onPress={() => setTarget({ kind: 'fee', item: it, action: 'pay' })} style={{ flex: 1.2, paddingHorizontal: 12 }} />
                    <Button label="Điều chỉnh" variant="secondary" onPress={() => setTarget({ kind: 'fee', item: it, action: 'adjust' })} style={{ flex: 1, paddingHorizontal: 12 }} />
                    <Button label="Miễn" variant="secondary" onPress={() => setTarget({ kind: 'fee', item: it, action: 'waive' })} style={{ flex: 0.8, paddingHorizontal: 12 }} />
                  </View>
                ) : null}
              </View>
            );
          })}
        </Group>
      ) : (
        <Text style={[text.footnote, { color: colors.muted }]}>Hợp đồng chưa có kỳ phí.</Text>
      )}

      {d.penalties.length ? (
        <>
          <Heading title={`Tiền phạt (${d.penalties.length})`} />
          <Group>
            {d.penalties.map((p, i) => {
              const st = statusLabel(p.status);
              return (
                <View key={p.penaltyId} style={{ padding: 16, gap: 10, borderTopWidth: i ? 1 : 0, borderTopColor: colors.separator }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.dangerTint, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon sf="exclamationmark.octagon.fill" md="report" size={21} color={colors.danger} />
                    </View>
                    <View style={{ flex: 1, gap: 1 }}>
                      <Text style={{ fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, color: colors.ink }}>{violationTypeLabels[p.violationType] ?? p.violationType}</Text>
                      <Text style={[text.footnote, tabular, { color: colors.muted }]}>{[p.decisionNumber ? `QĐ ${p.decisionNumber}` : null, formatVietnamDate(p.createdAt)].filter(Boolean).join(', ')}</Text>
                    </View>
                    <StatusPill label={st.label} tone={st.tone} />
                  </View>
                  <Text style={[sign.price, tabular, { color: p.status === 'UNPAID' ? colors.onDanger : colors.ink }]}>{formatVnd(p.amount)}</Text>
                  {p.waiverReason ? <Text style={[text.caption, { color: colors.onMango }]}>Miễn: {p.waiverReason}</Text> : null}
                  {p.status === 'UNPAID' ? (
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <Button label="Thu tại chỗ" variant="sign" onPress={() => setTarget({ kind: 'penalty', item: p, action: 'pay' })} style={{ flex: 1 }} />
                      <Button label="Miễn phạt" variant="secondary" onPress={() => setTarget({ kind: 'penalty', item: p, action: 'waive' })} style={{ flex: 1 }} />
                    </View>
                  ) : null}
                </View>
              );
            })}
          </Group>
        </>
      ) : null}

      <Heading title="Tiền cọc" />
      <Group>
        <View style={{ padding: 16, gap: 10 }}>
          <KeyValueList rows={[{ label: 'Đã nộp', value: formatVnd(d.depositPaid) }, d.depositRefund ? { label: 'Đã hoàn', value: `${formatVnd(d.depositRefund.amount)}, ${formatVietnamDate(d.depositRefund.refundedAt)}` } : null, d.depositRefund?.deductionReason ? { label: 'Lý do trừ', value: d.depositRefund.deductionReason } : null]} />
          {d.canRefundDeposit ? <Button label="Hoàn cọc" variant="secondary" icon={{ sf: 'arrow.uturn.backward', md: 'undo' }} onPress={() => setTarget({ kind: 'deposit' })} /> : d.refundBlockedReason && !d.depositRefund ? <Text style={[text.footnote, { color: colors.muted }]}>{d.refundBlockedReason}</Text> : null}
        </View>
      </Group>
      <Heading title="Giá riêng của ô" />
      <Group>
        <View style={{ padding: 16, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap', columnGap: 6 }}>
            <Text style={[sign.price, tabular, { color: colors.primary }]}>{formatVnd(d.slotPriceOverride ?? d.zonePrice)}</Text>
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, lineHeight: 22, color: colors.primary }}>{`/${unit}`}</Text>
          </View>
          <Text style={[text.footnote, tabular, { color: colors.ink }]}>
            {d.slotPriceOverride != null ? `${formatVnd(d.slotPriceOverride)}/${unit} (giá tuyến ${formatVnd(d.zonePrice)})` : `Theo giá tuyến: ${formatVnd(d.zonePrice)}/${unit}`}
          </Text>
          <Button label="Đặt giá riêng" variant="secondary" onPress={() => setTarget({ kind: 'price' })} />
        </View>
      </Group>
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
    <View style={{ padding: 16, gap: 12, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, borderWidth: 2, borderColor: colors.sign, boxShadow: shadow.raised }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.signTint, alignItems: 'center', justifyContent: 'center' }}>
          <Icon sf={isPay ? 'banknote.fill' : isWaive ? 'hand.raised.fill' : isAdjust ? 'slider.horizontal.3' : target.kind === 'deposit' ? 'arrow.uturn.backward' : 'tag.fill'} md={isPay ? 'payments' : isWaive ? 'back_hand' : isAdjust ? 'tune' : target.kind === 'deposit' ? 'undo' : 'sell'} size={19} color={colors.sign} />
        </View>
        <Text accessibilityRole="header" style={{ flex: 1, fontFamily: fonts.heavy, fontSize: 17, color: colors.ink }}>{title}</Text>
      </View>
      {money != null ? <Text maxFontSizeMultiplier={1.3} style={[sign.title, tabular, { color: colors.primary }]}>{formatVnd(money)}</Text> : null}
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
          <TextField label="Số tiền mới" optional value={amount} onChangeText={(v) => setAmount(v.replace(/[^0-9]/g, ''))} keyboardType="number-pad" hint={Number(amount) ? formatVnd(Number(amount)) : undefined} />
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
        <Button label="Xác nhận" variant="sign" loading={run.isPending} disabled={!valid} onPress={confirm} style={{ flex: 1.4 }} />
      </View>
    </View>
  );
}
