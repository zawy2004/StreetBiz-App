import { useState, type ReactNode } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { showToast } from '@/components/feedback/Toast';
import { TextField } from '@/components/forms/TextField';
import { AiTag, aiPanel } from '@/components/status/AiTag';
import { errorMessage } from '@/core/api';
import { colors, fonts, radius, shadow, text } from '@/theme';
import { formatVietnamDateTime } from '@/utils/format';
import { complianceApi } from '../ward-api';

/**
 * An AI suggestion, labelled [AI] (BR-42), in the advisory mango tone. The officer may say
 * whether it helped; that only logs feedback (BR-41) — it never approves or saves anything.
 */
export function AiSuggestionCard({ title, aiLogId, children }: { title: string; aiLogId?: number | null; children: ReactNode }) {
  const [decision, setDecision] = useState<{ accepted: boolean; at: string } | null>(null);
  const [busy, setBusy] = useState<'yes' | 'no' | null>(null);
  const [note, setNote] = useState('');
  const send = async (accepted: boolean) => {
    if (!aiLogId) return;
    setBusy(accepted ? 'yes' : 'no');
    try {
      const r = await complianceApi.aiFeedback(aiLogId, accepted, note.trim() || undefined);
      setDecision({ accepted: r.accepted, at: r.reviewedAt });
      showToast(accepted ? 'Đã ghi nhận chấp nhận gợi ý AI' : 'Đã ghi nhận không chấp nhận gợi ý AI');
    } catch (e) {
      showToast(errorMessage(e), 'error');
    } finally {
      setBusy(null);
    }
  };
  return (
    <View style={[aiPanel, { gap: 10, padding: 16, borderRadius: radius.photo }]}>
      <View style={{ gap: 6 }}>
        <AiTag />
        <Text style={{ fontFamily: fonts.heavy, fontSize: 16, lineHeight: 22, color: colors.onMango }}>{title}</Text>
      </View>
      {children}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon sf="person.fill.checkmark" md="how_to_reg" size={14} color={colors.onMango} />
        <Text style={[text.caption, { flex: 1, color: colors.onMango }]}>Chỉ để tham khảo. Cán bộ là người quyết định.</Text>
      </View>
      {aiLogId ? (
        decision ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Text style={[text.caption, { flexShrink: 1, color: colors.onMango, fontFamily: fonts.semibold }]}>
              {decision.accepted ? 'Đã chấp nhận' : 'Không chấp nhận'} gợi ý lúc {formatVietnamDateTime(decision.at)}
            </Text>
            <Pressable onPress={() => setDecision(null)} accessibilityRole="button" hitSlop={8} style={{ minHeight: 44, justifyContent: 'center' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13.5, color: colors.sign, textDecorationLine: 'underline' }}>Đổi ý</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            <TextInput
              value={note}
              onChangeText={(v) => setNote(v.slice(0, 500))}
              placeholder="Ghi chú (không bắt buộc)"
              placeholderTextColor={colors.muted}
              accessibilityLabel="Ghi chú về gợi ý AI"
              style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: radius.control, borderCurve: 'continuous', backgroundColor: colors.card, borderWidth: 1, borderColor: '#FFE7A3', fontFamily: fonts.regular, fontSize: 15, color: colors.ink }}
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button label="Không chấp nhận" variant="secondary" loading={busy === 'no'} disabled={busy != null} onPress={() => void send(false)} style={{ flex: 1, paddingHorizontal: 12 }} />
              <Button label="Chấp nhận gợi ý" variant="secondary" loading={busy === 'yes'} disabled={busy != null} onPress={() => void send(true)} style={{ flex: 1, paddingHorizontal: 12 }} />
            </View>
          </View>
        )
      ) : null}
    </View>
  );
}

/** The ward's round seal: a solid disc in the verdict's ink, a white rim, the verdict's mark. */
export function WardSeal({ ink, icon, size = 52 }: { ink: string; icon: { sf: string; md: string }; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: ink, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.white, boxShadow: shadow.card }}>
      <Icon sf={icon.sf} md={icon.md} size={Math.round(size * 0.44)} color={colors.white} />
    </View>
  );
}

/** The officer's earlier decision on a record (BR-46: who and when), stamped like a ward seal. */
export function RecordedDecision({ status, reason, by, at }: { status: string; reason: string | null; by: string | null; at: string | null }) {
  const approved = status === 'APPROVED';
  const rejected = status === 'REJECTED';
  const look = approved
    ? { wash: colors.leafTint, ink: colors.onLeaf, seal: colors.leaf, icon: { sf: 'checkmark.seal.fill', md: 'verified' }, title: 'Đã duyệt' }
    : rejected
      ? { wash: colors.dangerTint, ink: colors.onDanger, seal: colors.danger, icon: { sf: 'xmark.seal.fill', md: 'gpp_bad' }, title: 'Đã từ chối' }
      : { wash: colors.mangoTint, ink: colors.onMango, seal: colors.onMango, icon: { sf: 'exclamationmark.bubble.fill', md: 'feedback' }, title: 'Đã yêu cầu bổ sung' };
  return (
    <View accessible style={{ flexDirection: 'row', gap: 14, padding: 18, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: look.wash }}>
      <WardSeal ink={look.seal} icon={look.icon} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ fontFamily: fonts.heavy, fontSize: 18, lineHeight: 24, color: look.ink }}>{look.title}</Text>
        {reason ? <Text style={[text.callout, { color: colors.ink }]}>{reason}</Text> : null}
        {by ? <Text style={[text.footnote, { color: look.ink, fontFamily: fonts.semibold }]}>{by}</Text> : null}
        {at ? <Text style={[text.footnote, { color: look.ink }]}>{formatVietnamDateTime(at)}</Text> : null}
      </View>
    </View>
  );
}

/** Blockers the server reports before an approval (BR-16 and friends). */
export function Blockers({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <View accessible accessibilityLabel={`Chưa đủ điều kiện duyệt. ${items.join('. ')}`} style={{ flexDirection: 'row', gap: 14, padding: 16, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.dangerTint }}>
      <WardSeal ink={colors.onDanger} icon={{ sf: 'lock.fill', md: 'lock' }} size={44} />
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={{ fontFamily: fonts.heavy, fontSize: 16, lineHeight: 22, color: colors.onDanger }}>Chưa đủ điều kiện duyệt</Text>
        {items.map((b) => (
          <View key={b} style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, marginTop: 7, backgroundColor: colors.onDanger }} />
            <Text style={[text.footnote, { flex: 1, color: colors.onDanger }]}>{b}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * The decision desk at the bottom of a review: the reason (required to refuse or ask for more)
 * and the buttons. Every decision is a person pressing a button (BR-41). The desk wears the
 * ward's civic blue band: what happens here is the officer's act, not the app's.
 */
export function DecisionDesk({
  reason,
  setReason,
  onApprove,
  onReject,
  onMoreInfo,
  approveLabel = 'Duyệt',
  canApprove = true,
  busy,
}: {
  reason: string;
  setReason: (v: string) => void;
  onApprove: () => void;
  onReject: () => void;
  onMoreInfo?: () => void;
  approveLabel?: string;
  canApprove?: boolean;
  busy: 'APPROVE' | 'REJECT' | 'MORE_INFO' | null;
}) {
  return (
    <View style={{ borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadow.raised }}>
      <View style={{ borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden' }}>
        <View style={{ height: 8, backgroundColor: colors.sign }} />
        <View style={{ padding: 18, gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.signTint, alignItems: 'center', justifyContent: 'center' }}>
              <Icon sf="person.badge.shield.checkmark.fill" md="admin_panel_settings" size={22} color={colors.sign} />
            </View>
            <Text accessibilityRole="header" style={{ flex: 1, fontFamily: fonts.heavy, fontSize: 19, lineHeight: 25, color: colors.ink }}>Quyết định của cán bộ</Text>
          </View>
          <TextField label="Căn cứ / lý do" value={reason} onChangeText={setReason} multiline placeholder="Bắt buộc khi từ chối hoặc yêu cầu bổ sung" />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button label="Từ chối" variant="secondary" loading={busy === 'REJECT'} disabled={busy != null} onPress={onReject} style={{ flex: 1 }} />
            {onMoreInfo ? <Button label="Bổ sung" variant="secondary" loading={busy === 'MORE_INFO'} disabled={busy != null} onPress={onMoreInfo} style={{ flex: 1 }} /> : null}
          </View>
          <Button label={approveLabel} variant="sign" size={56} icon={{ sf: canApprove ? 'checkmark.seal.fill' : 'lock.fill', md: canApprove ? 'verified' : 'lock' }} loading={busy === 'APPROVE'} disabled={busy != null || !canApprove} onPress={onApprove} />
        </View>
      </View>
    </View>
  );
}
