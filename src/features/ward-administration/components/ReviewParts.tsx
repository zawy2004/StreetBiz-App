import { useState, type ReactNode } from 'react';
import { Text, TextInput, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { Banner } from '@/components/feedback/Banner';
import { showToast } from '@/components/feedback/Toast';
import { TextField } from '@/components/forms/TextField';
import { AiTag, aiPanel } from '@/components/status/AiTag';
import { errorMessage } from '@/core/api';
import { colors, fonts, radius, text } from '@/theme';
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
    <View style={[aiPanel, { gap: 10 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <AiTag />
        <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 14.5, color: colors.onMango }}>{title}</Text>
      </View>
      {children}
      <Text style={[text.caption, { color: colors.onMango }]}>Chỉ để tham khảo. Cán bộ là người quyết định.</Text>
      {aiLogId ? (
        decision ? (
          <Text style={[text.caption, { color: colors.onMango, fontFamily: fonts.semibold }]}>
            {decision.accepted ? 'Đã chấp nhận' : 'Không chấp nhận'} gợi ý lúc {formatVietnamDateTime(decision.at)}
            {' · '}
            <Text onPress={() => setDecision(null)} accessibilityRole="button" style={{ color: colors.sign, textDecorationLine: 'underline' }}>
              Đổi ý
            </Text>
          </Text>
        ) : (
          <View style={{ gap: 8 }}>
            <TextInput
              value={note}
              onChangeText={(v) => setNote(v.slice(0, 500))}
              placeholder="Ghi chú (không bắt buộc)"
              placeholderTextColor={colors.muted}
              accessibilityLabel="Ghi chú về gợi ý AI"
              style={{ minHeight: 40, paddingHorizontal: 12, borderRadius: radius.control, borderCurve: 'continuous', backgroundColor: colors.card, borderWidth: 1, borderColor: '#FFE7A3', fontFamily: fonts.regular, fontSize: 15, color: colors.ink }}
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button label="Không chấp nhận" variant="secondary" loading={busy === 'no'} disabled={busy != null} onPress={() => void send(false)} style={{ flex: 1 }} />
              <Button label="Chấp nhận gợi ý" variant="secondary" loading={busy === 'yes'} disabled={busy != null} onPress={() => void send(true)} style={{ flex: 1 }} />
            </View>
          </View>
        )
      ) : null}
    </View>
  );
}

/** The officer's earlier decision on a record (BR-46: who and when). */
export function RecordedDecision({ status, reason, by, at }: { status: string; reason: string | null; by: string | null; at: string | null }) {
  const approved = status === 'APPROVED';
  const rejected = status === 'REJECTED';
  return (
    <View style={{ flexDirection: 'row', gap: 10, padding: 14, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: approved ? colors.leafTint : rejected ? colors.dangerTint : colors.mangoTint }}>
      <Icon sf={approved ? 'checkmark.seal.fill' : rejected ? 'xmark.seal.fill' : 'exclamationmark.bubble.fill'} md={approved ? 'verified' : rejected ? 'gpp_bad' : 'feedback'} size={20} color={approved ? colors.leaf : rejected ? colors.danger : colors.onMango} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[text.subhead, { color: colors.ink }]}>{approved ? 'Đã duyệt' : rejected ? 'Đã từ chối' : 'Đã yêu cầu bổ sung'}</Text>
        {reason ? <Text style={[text.footnote, { color: colors.ink }]}>{reason}</Text> : null}
        {by || at ? <Text style={[text.caption, { color: colors.muted }]}>{[by, at ? formatVietnamDateTime(at) : null].filter(Boolean).join(' · ')}</Text> : null}
      </View>
    </View>
  );
}

/** Blockers the server reports before an approval (BR-16 and friends). */
export function Blockers({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <Banner tone="danger" icon={{ sf: 'lock.fill', md: 'lock' }} title="Chưa đủ điều kiện duyệt">
      {items.map((b) => `• ${b}`).join('\n')}
    </Banner>
  );
}

/**
 * The decision desk at the bottom of a review: the reason (required to refuse or ask for more)
 * and the buttons. Every decision is a person pressing a button (BR-41).
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
    <View style={{ gap: 10, padding: 14, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card }}>
      <Text style={{ fontFamily: fonts.heavy, fontSize: 16, color: colors.ink }}>Quyết định của cán bộ</Text>
      <TextField label="Căn cứ / lý do" value={reason} onChangeText={setReason} multiline placeholder="Bắt buộc khi từ chối hoặc yêu cầu bổ sung" />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button label="Từ chối" variant="secondary" loading={busy === 'REJECT'} disabled={busy != null} onPress={onReject} style={{ flex: 1 }} />
        {onMoreInfo ? <Button label="Bổ sung" variant="secondary" loading={busy === 'MORE_INFO'} disabled={busy != null} onPress={onMoreInfo} style={{ flex: 1 }} /> : null}
      </View>
      <Button label={approveLabel} size={56} icon={{ sf: canApprove ? 'checkmark.seal.fill' : 'lock.fill', md: canApprove ? 'verified' : 'lock' }} loading={busy === 'APPROVE'} disabled={busy != null || !canApprove} onPress={onApprove} />
    </View>
  );
}
