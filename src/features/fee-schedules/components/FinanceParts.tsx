import * as Haptics from 'expo-haptics';
import { Children, Fragment, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/common/Icon';
import { StatusPill } from '@/components/status/StatusPill';
import type { FeeItemDto, FinanceSummaryDto, InvoiceDto, PaymentProvider, PenaltyListDto, VendorContractFinanceDto } from '@/core/api';
import { statusLabel } from '@/core/constants/status-labels';
import { colors, fonts, radius, shadow, sign, statusTones, tabular, text } from '@/theme';
import { Plate } from '@/ui';
import { formatVietnamDate, formatVnd } from '@/utils/format';
import { feeUrgency } from '../finance-view';
import type { FinanceReturnState } from '../payment-return';
import { formatDay, paidShare } from '../schedule-progress';

/**
 * "How much do I owe", painted on the finance signboard (v5): the total in sign figures, the
 * split fee / penalty as a two-colour bar, overdue and the next due date. White on the orange
 * sign; the screen turns the sign leaf green when nothing is owed.
 */
export function DebtBoard({ summary, isLoading, isError }: { summary: FinanceSummaryDto | undefined; isLoading: boolean; isError: boolean }) {
  const loaded = !isLoading && !isError && !!summary;
  const clear = loaded && summary.totalDue === 0;
  const total = loaded ? Math.max(summary.feeDue + summary.penaltyDue, 1) : 1;
  return (
    <View style={{ gap: 12, marginTop: 6 }}>
      {isLoading ? (
        <View style={{ height: 50, width: 210, borderRadius: radius.sticker, backgroundColor: 'rgba(255,255,255,0.28)' }} accessibilityLabel="Đang tải tổng cần thanh toán" />
      ) : !loaded ? (
        <Text style={{ fontFamily: fonts.semibold, fontSize: 15, lineHeight: 21, color: colors.white }}>Chưa tải được tổng số tiền cần thanh toán.</Text>
      ) : (
        <Text
          accessibilityLabel={`Tổng cần thanh toán ${formatVnd(summary.totalDue)}`}
          maxFontSizeMultiplier={1.3}
          adjustsFontSizeToFit
          numberOfLines={1}
          style={[sign.figure, { color: colors.white }, tabular]}
        >
          {formatVnd(summary.totalDue)}
        </Text>
      )}
      {loaded && clear ? <Text style={{ fontFamily: fonts.semibold, fontSize: 15, lineHeight: 21, color: colors.white }}>Không còn khoản nào cần thanh toán.</Text> : null}
      {loaded && !clear ? (
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.3)', gap: 2 }}>
            {summary.feeDue > 0 ? <View style={{ width: `${(summary.feeDue / total) * 100}%`, backgroundColor: colors.white }} /> : null}
            {summary.penaltyDue > 0 ? <View style={{ flex: 1, backgroundColor: colors.plate }} /> : null}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 4 }}>
            <Legend color={colors.white} label="Phí thuê ô" value={formatVnd(summary.feeDue)} />
            <Legend color={colors.plate} label="Tiền phạt" value={formatVnd(summary.penaltyDue)} />
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
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color, borderWidth: 1.5, borderColor: colors.white }} />
      <Text style={{ fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 19, color: colors.white }}>
        {label} <Text style={[{ fontFamily: fonts.heavy }, tabular]}>{value}</Text>
      </Text>
    </View>
  );
}

/** One white block holding a list of money rows with hairlines between them (no card per row). */
export function RowGroup({ children }: { children: ReactNode }) {
  const rows = Children.toArray(children);
  return (
    <View style={{ borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadow.card, overflow: 'hidden' }}>
      {rows.map((row, i) => (
        <Fragment key={i}>
          {i > 0 ? <View style={{ height: 1, marginLeft: 72, backgroundColor: colors.separator }} /> : null}
          {row}
        </Fragment>
      ))}
    </View>
  );
}

/** A flat row: a round tile, two lines, the amount in sign figures and its state on the right. */
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
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 72, paddingVertical: 14, paddingLeft: 16, paddingRight: onPress ? 12 : 16, backgroundColor: pressed ? colors.pressed : colors.card }}>
      {emphasis ? <View style={{ position: 'absolute', left: 0, top: 10, bottom: 10, width: 4, borderTopRightRadius: 2, borderBottomRightRadius: 2, backgroundColor: colors.danger }} /> : null}
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: tileWash, alignItems: 'center', justifyContent: 'center' }}>
        <Icon sf={tile.sf} md={tile.md} size={19} color={tile.ink} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        {title}
        {lines.map((l) => (
          <Text key={l} style={[text.footnote, { color: colors.muted }, tabular]} numberOfLines={2}>
            {l}
          </Text>
        ))}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        <Text maxFontSizeMultiplier={1.4} style={[sign.price, { color: colors.ink }, tabular]}>{formatVnd(amount)}</Text>
        {pill ? <StatusPill label={pill.label} tone={pill.tone} /> : null}
      </View>
      {onPress ? <Icon sf="chevron.right" md="chevron_right" size={13} color={colors.muted} /> : null}
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Plate code={fee.slotCode} prefix="Ô" />
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, color: colors.ink, flexShrink: 1 }} numberOfLines={2}>{fee.periodLabel}</Text>
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
      title={<Text style={{ fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, color: colors.ink }} numberOfLines={2}>{penalty.violationLabel}</Text>}
      lines={[[penalty.slotCode ? `Ô ${penalty.slotCode}` : null, `Lập ${formatVietnamDate(penalty.issuedAt)}`].filter(Boolean).join(', ')]}
      amount={penalty.amount}
      pill={{ label: s.label, tone: s.tone }}
      onPress={onPress}
    />
  );
}

export function InvoiceRow({ invoice, onPress }: { invoice: InvoiceDto; onPress: () => void }) {
  const penalty = invoice.kind === 'PENALTY';
  const what = penalty ? 'Tiền phạt' : invoice.periodLabel ? `Phí thuê ô, ${invoice.periodLabel}` : 'Phí thuê ô';
  return (
    <MoneyRow
      tile={{ sf: 'doc.text.fill', md: 'receipt_long', ink: penalty ? colors.onDanger : colors.primary }}
      tileWash={penalty ? colors.dangerTint : colors.brandTint}
      title={<Text style={[{ fontFamily: fonts.code, fontSize: 16, lineHeight: 20, color: colors.ink }, tabular]}>{invoice.invoiceNumber}</Text>}
      lines={[what, formatVietnamDate(invoice.issuedAt)]}
      amount={invoice.amount}
      onPress={onPress}
    />
  );
}

/**
 * One contract's schedule: its slot plate and street, a tick for every instalment (filled green
 * once paid), what is left, the next due one.
 */
export function ContractFinanceCard({ contract, onPress }: { contract: VendorContractFinanceDto; onPress: () => void }) {
  const share = paidShare(contract);
  const ticks = contract.instalmentCount > 0 && contract.instalmentCount <= 24;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Lịch đóng phí ô ${contract.slotCode}`}>
      {({ pressed }) => (
        <View style={{ padding: 18, gap: 12, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: pressed ? colors.kerbPaint : colors.card, boxShadow: shadow.card }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Plate code={contract.slotCode} prefix="Ô" />
            <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, color: colors.ink }} numberOfLines={2}>
              {contract.zoneName ?? ''}
            </Text>
            <Icon sf="chevron.right" md="chevron_right" size={13} color={colors.muted} />
          </View>
          {ticks ? (
            <View style={{ flexDirection: 'row', gap: 4 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {Array.from({ length: contract.instalmentCount }, (_, i) => (
                <View key={i} style={{ flex: 1, height: 10, borderRadius: 5, backgroundColor: i < contract.paidCount ? colors.leaf : colors.sunken }} />
              ))}
            </View>
          ) : (
            <View style={{ height: 10, borderRadius: 5, backgroundColor: colors.sunken, overflow: 'hidden' }}>
              <View style={{ width: `${Math.round(share * 100)}%`, height: '100%', backgroundColor: colors.leaf }} />
            </View>
          )}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
            <Text style={[text.subhead, { color: colors.ink }, tabular]}>
              Đã nộp {contract.paidCount}/{contract.instalmentCount} kỳ
            </Text>
            <Text style={[text.subhead, { color: contract.outstandingAmount > 0 ? colors.primary : colors.onLeaf, fontFamily: fonts.heavy }, tabular]}>
              {contract.outstandingAmount > 0 ? `Còn ${formatVnd(contract.outstandingAmount)}` : 'Đã nộp đủ'}
            </Text>
          </View>
          {contract.nextDue ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: radius.control, borderCurve: 'continuous', backgroundColor: colors.kerbPaint }}>
              <Icon sf="calendar" md="calendar_month" size={15} color={colors.primary} />
              <Text style={[text.footnote, { flex: 1, color: colors.ink }, tabular]}>
                Kỳ tới: {contract.nextDue.periodLabel}, hạn {formatDay(contract.nextDue.dueDate)}, {formatVnd(contract.nextDue.amount)}
              </Text>
            </View>
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
    <View style={{ gap: 10 }} accessibilityRole="radiogroup">
      <Text accessibilityRole="header" style={{ fontFamily: fonts.heavy, fontSize: 18, lineHeight: 24, color: colors.ink }}>Ví thanh toán</Text>
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
            style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, minHeight: 68, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: on ? colors.kerbPaint : colors.card, borderWidth: 2, borderColor: on ? colors.cta : colors.line, opacity: disabled ? 0.6 : 1 }}
          >
            <View style={{ width: 44, height: 44, borderRadius: radius.control, borderCurve: 'continuous', backgroundColor: w.color, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: fonts.heavy, fontSize: 12, color: colors.white }}>{w.label === 'MoMo' ? 'MoMo' : 'Zalo'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.heavy, fontSize: 16, color: colors.ink }}>{w.label}</Text>
              <Text style={[text.footnote, { color: colors.muted }]}>{w.note}</Text>
            </View>
            <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: on ? 7 : 2, borderColor: on ? colors.cta : colors.line, backgroundColor: colors.white }} />
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
    <View style={{ padding: 16, gap: 12, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.leafTint }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.leaf, alignItems: 'center', justifyContent: 'center' }}>
          <Icon sf="checkmark.shield.fill" md="verified_user" size={16} color={colors.white} />
        </View>
        <Text style={{ flex: 1, fontFamily: fonts.heavy, fontSize: 15, color: colors.onLeaf }}>Thanh toán an toàn trong 3 bước</Text>
      </View>
      {SAFE_STEPS.map((s, i) => (
        <View key={s.text} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }}>
            <Text maxFontSizeMultiplier={1.3} style={[{ fontFamily: fonts.code, fontSize: 15, color: colors.onLeaf }, tabular]}>{i + 1}</Text>
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
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, minHeight: 56, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: look.wash }}
    >
      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }}>
        <Icon sf={look.sf} md={look.md} size={17} color={look.ink} />
      </View>
      <Text style={[text.subhead, { flex: 1, color: look.ink }]}>{look.text}</Text>
    </Pressable>
  );
}
