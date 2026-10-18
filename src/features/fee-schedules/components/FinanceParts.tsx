import * as Haptics from 'expo-haptics';
import { Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/common/Icon';
import { SlotPlate } from '@/components/common/SlotPlate';
import { Skeleton } from '@/components/feedback/Skeleton';
import { StatusPill } from '@/components/status/StatusPill';
import type { FeeItemDto, FinanceSummaryDto, InvoiceDto, PaymentProvider, PenaltyListDto, VendorContractFinanceDto } from '@/core/api';
import { statusLabel } from '@/core/constants/status-labels';
import { colors, fonts, radius, statusTones, tabular, text } from '@/theme';
import { formatVietnamDate, formatVnd } from '@/utils/format';
import { feeUrgency, invoiceKindLine } from '../finance-view';
import type { FinanceReturnState } from '../payment-return';
import { formatDay, paidShare } from '../schedule-progress';

/** "How much do I owe" first: the total, split fee / penalty, the next due date. Green when clear. */
export function DebtBoard({ summary, isLoading, isError }: { summary: FinanceSummaryDto | undefined; isLoading: boolean; isError: boolean }) {
  const loaded = !isLoading && !isError && !!summary;
  const clear = loaded && summary.totalDue === 0;
  const total = loaded ? Math.max(summary.feeDue + summary.penaltyDue, 1) : 1;
  return (
    <View
      style={{
        padding: 20,
        gap: 12,
        borderRadius: radius.pass,
        borderCurve: 'continuous',
        backgroundColor: clear ? colors.leafTint : colors.brandTint,
        overflow: 'hidden',
      }}
    >
      <View style={{ position: 'absolute', right: -24, top: -24, width: 120, height: 120, borderRadius: 60, backgroundColor: clear ? 'rgba(11,127,67,0.08)' : 'rgba(255,106,31,0.12)' }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon sf={clear ? 'checkmark.seal.fill' : 'banknote.fill'} md={clear ? 'verified' : 'payments'} size={18} color={clear ? colors.onLeaf : colors.primary} />
        <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: clear ? colors.onLeaf : colors.primary }}>Tổng cần thanh toán</Text>
      </View>
      {isLoading ? (
        <Skeleton width={180} height={40} />
      ) : !loaded ? (
        <Text style={[text.callout, { color: colors.ink }]}>Chưa tải được tổng số tiền cần thanh toán.</Text>
      ) : (
        <Text accessibilityRole="header" style={[{ fontFamily: fonts.heavy, fontSize: 34, lineHeight: 40, color: clear ? colors.onLeaf : colors.ink }, tabular]} adjustsFontSizeToFit numberOfLines={1}>
          {formatVnd(summary.totalDue)}
        </Text>
      )}
      {loaded && clear ? <Text style={[text.footnote, { color: colors.onLeaf }]}>Không còn khoản nào cần thanh toán.</Text> : null}
      {loaded && !clear ? (
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: colors.white, gap: 2 }}>
            {summary.feeDue > 0 ? <View style={{ width: `${(summary.feeDue / total) * 100}%`, backgroundColor: colors.brand }} /> : null}
            {summary.penaltyDue > 0 ? <View style={{ flex: 1, backgroundColor: colors.danger }} /> : null}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 4 }}>
            <Legend color={colors.brand} label="Phí thuê ô" value={formatVnd(summary.feeDue)} />
            <Legend color={colors.danger} label="Tiền phạt" value={formatVnd(summary.penaltyDue)} />
          </View>
          {summary.overdueCount > 0 || summary.nextDueDate ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {summary.overdueCount > 0 ? <StatusPill label={`${summary.overdueCount} khoản quá hạn`} tone="danger" /> : null}
              {summary.nextDueDate ? <StatusPill label={`Hạn gần nhất ${formatVietnamDate(summary.nextDueDate)}`} tone="pending" /> : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color }} />
      <Text style={[text.footnote, { color: colors.ink }]}>
        {label} <Text style={[{ fontFamily: fonts.bold }, tabular]}>{value}</Text>
      </Text>
    </View>
  );
}

/** A row on a white card: leading tile, two lines, an amount and a state on the right. */
function MoneyRow({
  tile,
  tileWash,
  title,
  lines,
  amount,
  pill,
  onPress,
  emphasis,
}: {
  tile: { sf: string; md: string; ink: string };
  tileWash: string;
  title: React.ReactNode;
  lines: string[];
  amount: number;
  pill?: { label: string; tone: keyof typeof statusTones } | null;
  onPress?: () => void;
  emphasis?: boolean;
}) {
  const body = (pressed: boolean) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: pressed ? '#FBFBFC' : colors.card, borderWidth: emphasis ? 1.5 : 0, borderColor: colors.danger }}>
      <View style={{ width: 42, height: 42, borderRadius: 13, borderCurve: 'continuous', backgroundColor: tileWash, alignItems: 'center', justifyContent: 'center' }}>
        <Icon sf={tile.sf} md={tile.md} size={19} color={tile.ink} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        {title}
        {lines.map((l) => (
          <Text key={l} style={[text.caption, { color: colors.muted }]} numberOfLines={1}>
            {l}
          </Text>
        ))}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 5 }}>
        <Text style={[{ fontFamily: fonts.heavy, fontSize: 15.5, color: colors.ink }, tabular]}>{formatVnd(amount)}</Text>
        {pill ? <StatusPill label={pill.label} tone={pill.tone} /> : null}
      </View>
      {onPress ? <Icon sf="chevron.right" md="chevron_right" size={14} color={colors.muted} /> : null}
    </View>
  );
  if (!onPress) return body(false);
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      {({ pressed }) => body(pressed)}
    </Pressable>
  );
}

export function FeeRow({ fee, onPress }: { fee: FeeItemDto; onPress?: () => void }) {
  const urgency = feeUrgency(fee);
  const paid = fee.itemStatus === 'PAID';
  const s = statusLabel(fee.itemStatus);
  return (
    <MoneyRow
      tile={paid ? { sf: 'checkmark', md: 'check', ink: colors.onLeaf } : { sf: 'calendar', md: 'calendar_month', ink: colors.primary }}
      tileWash={paid ? colors.leafTint : colors.brandTint}
      title={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <SlotPlate code={fee.slotCode} />
          <Text style={[text.subhead, { color: colors.ink, flexShrink: 1 }]} numberOfLines={1}>{fee.periodLabel}</Text>
        </View>
      }
      lines={[paid && fee.paidAt ? `Đã trả ${formatVietnamDate(fee.paidAt)}` : `Hạn ${formatDay(fee.dueDate)}`]}
      amount={fee.amount}
      pill={urgency ? { label: urgency.text, tone: urgency.tone === 'danger' ? 'danger' : urgency.tone === 'pending' ? 'pending' : 'neutral' } : { label: s.label, tone: s.tone }}
      onPress={onPress}
      emphasis={urgency?.tone === 'danger'}
    />
  );
}

export function PenaltyRow({ penalty, onPress }: { penalty: PenaltyListDto; onPress?: () => void }) {
  const s = statusLabel(penalty.penaltyStatus);
  const unpaid = penalty.penaltyStatus === 'UNPAID';
  return (
    <MoneyRow
      tile={{ sf: 'exclamationmark.octagon.fill', md: 'report', ink: unpaid ? colors.danger : colors.muted }}
      tileWash={unpaid ? colors.dangerTint : colors.sunken}
      title={<Text style={[text.subhead, { color: colors.ink }]} numberOfLines={2}>{penalty.violationLabel}</Text>}
      lines={[[penalty.slotCode ? `Ô ${penalty.slotCode}` : null, `Lập ${formatVietnamDate(penalty.issuedAt)}`].filter(Boolean).join(' · ')]}
      amount={penalty.amount}
      pill={{ label: s.label, tone: s.tone }}
      onPress={onPress}
    />
  );
}

export function InvoiceRow({ invoice, onPress }: { invoice: InvoiceDto; onPress: () => void }) {
  const penalty = invoice.kind === 'PENALTY';
  return (
    <MoneyRow
      tile={{ sf: 'doc.text.fill', md: 'receipt_long', ink: penalty ? colors.onDanger : colors.sign }}
      tileWash={penalty ? colors.dangerTint : colors.signTint}
      title={<Text style={[{ fontFamily: fonts.code, fontSize: 15, color: colors.ink }]}>{invoice.invoiceNumber}</Text>}
      lines={[invoiceKindLine(invoice), formatVietnamDate(invoice.issuedAt)]}
      amount={invoice.amount}
      onPress={onPress}
    />
  );
}

/** One contract's schedule progress: paid / total instalments, what is left, the next due one. */
export function ContractFinanceCard({ contract, onPress }: { contract: VendorContractFinanceDto; onPress: () => void }) {
  const share = paidShare(contract);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Lịch đóng phí ô ${contract.slotCode}`}>
      {({ pressed }) => (
        <View style={{ padding: 16, gap: 10, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: pressed ? '#FBFBFC' : colors.card }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <SlotPlate code={contract.slotCode} />
            <Text style={[text.subhead, { flex: 1, color: colors.ink }]} numberOfLines={1}>
              {contract.zoneName ?? ''}
            </Text>
            <Icon sf="chevron.right" md="chevron_right" size={14} color={colors.muted} />
          </View>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.sunken, overflow: 'hidden' }}>
            <View style={{ width: `${Math.round(share * 100)}%`, height: '100%', backgroundColor: colors.leaf }} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={[text.caption, { color: colors.ink }, tabular]}>
              Đã nộp {contract.paidCount}/{contract.instalmentCount} kỳ
            </Text>
            <Text style={[text.caption, { color: contract.outstandingAmount > 0 ? colors.primary : colors.onLeaf, fontFamily: fonts.bold }, tabular]}>
              {contract.outstandingAmount > 0 ? `Còn ${formatVnd(contract.outstandingAmount)}` : 'Đã nộp đủ'}
            </Text>
          </View>
          {contract.nextDue ? (
            <Text style={[text.caption, { color: colors.muted }]}>
              Kỳ tới: {contract.nextDue.periodLabel} · hạn {formatDay(contract.nextDue.dueDate)} · {formatVnd(contract.nextDue.amount)}
            </Text>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

const WALLETS: { value: PaymentProvider; label: string; note: string; color: string }[] = [
  { value: 'MOMO', label: 'MoMo', note: 'Thanh toán qua ví MoMo', color: '#A50064' },
  { value: 'ZALOPAY', label: 'ZaloPay', note: 'Thanh toán qua ví ZaloPay', color: '#0068FF' },
];

/** The two wallets as radio cards, MoMo first (the default). */
export function WalletPicker({ value, onChange, disabled }: { value: PaymentProvider; onChange: (v: PaymentProvider) => void; disabled?: boolean }) {
  return (
    <View style={{ gap: 8 }} accessibilityRole="radiogroup">
      <Text style={[text.subhead, { color: colors.ink }]}>Ví thanh toán</Text>
      {WALLETS.map((w) => {
        const on = w.value === value;
        return (
          <Pressable
            key={w.value}
            disabled={disabled}
            onPress={() => {
              void Haptics.selectionAsync();
              onChange(w.value);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected: on, disabled }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, minHeight: 64, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: on ? colors.kerbPaint : colors.card, borderWidth: on ? 2 : 1, borderColor: on ? colors.cta : colors.line }}
          >
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: w.color, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: fonts.heavy, fontSize: 12, color: colors.white }}>{w.label === 'MoMo' ? 'MoMo' : 'Zalo'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 15.5, color: colors.ink }}>{w.label}</Text>
              <Text style={[text.caption, { color: colors.muted }]}>{w.note}</Text>
            </View>
            <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: on ? 7 : 2, borderColor: on ? colors.cta : colors.line, backgroundColor: colors.white }} />
          </Pressable>
        );
      })}
    </View>
  );
}

const SAFE_STEPS = [
  { sf: 'wallet.pass', md: 'account_balance_wallet', text: 'Chọn ví và bấm thanh toán.' },
  { sf: 'paperplane', md: 'send', text: 'Xác nhận trong ứng dụng ví.' },
  { sf: 'checkmark.icloud', md: 'cloud_done', text: 'Quay lại StreetBiz: hệ thống hỏi lại ví rồi mới ghi nhận và xuất hoá đơn.' },
];

export function SafePaySteps() {
  return (
    <View style={{ padding: 16, gap: 10, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.leafTint }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon sf="checkmark.shield.fill" md="verified_user" size={17} color={colors.onLeaf} />
        <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.onLeaf }}>Thanh toán an toàn trong 3 bước</Text>
      </View>
      {SAFE_STEPS.map((s, i) => (
        <View key={s.text} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.onLeaf }}>{i + 1}</Text>
          </View>
          <Text style={[text.footnote, { flex: 1, color: colors.onLeaf }]}>{s.text}</Text>
        </View>
      ))}
    </View>
  );
}

/** What happened when the vendor came back from the wallet: checking, still pending, or failed. */
export function ReturnCheck({ state, onRetry }: { state: FinanceReturnState; onRetry: (id: number) => void }) {
  if (state.phase === 'idle') return null;
  const look =
    state.phase === 'checking'
      ? { wash: colors.signTint, ink: colors.sign, sf: 'arrow.triangle.2.circlepath', md: 'sync', text: 'Đang hỏi lại ví xem giao dịch đã thành công chưa…' }
      : state.phase === 'pending'
        ? { wash: colors.mangoTint, ink: colors.onMango, sf: 'hourglass', md: 'hourglass_top', text: 'Ví chưa xác nhận giao dịch. Chạm để kiểm tra lại.' }
        : { wash: colors.dangerTint, ink: colors.onDanger, sf: 'xmark.octagon.fill', md: 'error', text: state.message };
  return (
    <Pressable
      disabled={state.phase !== 'pending'}
      onPress={() => state.phase === 'pending' && onRetry(state.transactionId)}
      accessibilityRole={state.phase === 'pending' ? 'button' : 'text'}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: look.wash }}
    >
      <Icon sf={look.sf} md={look.md} size={18} color={look.ink} />
      <Text style={[text.footnote, { flex: 1, color: look.ink }]}>{look.text}</Text>
    </Pressable>
  );
}
