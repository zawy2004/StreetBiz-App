import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Text, View } from 'react-native';

import { Card } from '@/components/common/Blocks';
import { Button } from '@/components/common/Button';
import { Banner } from '@/components/feedback/Banner';
import { showToast } from '@/components/feedback/Toast';
import { errorMessage } from '@/core/api';
import { useAuthStore } from '@/store/auth-store';
import { colors, fonts, text } from '@/theme';
import { wardApi, type AiProposalAssessment, type WardCase } from '../ward-api';
import { AiSuggestionCard } from './ReviewParts';

const OBSTRUCTION: Record<AiProposalAssessment['obstructionLevel'], string> = {
  LOW: 'Thấp',
  MEDIUM: 'Trung bình',
  HIGH: 'Cao',
  UNKNOWN: 'Chưa rõ',
};
const RECOMMENDATION: Record<AiProposalAssessment['recommendation'], string> = {
  LIKELY_FEASIBLE: 'Có thể bố trí được',
  NEEDS_SURVEY: 'Cần khảo sát thực địa',
  LIKELY_INFEASIBLE: 'Khó bố trí được',
};

const meters = (value: number | null) => (value != null ? `${String(value).replace('.', ',')} m` : 'chưa ước lượng được');

/**
 * AIC-04 (web ProposalAssessmentPanel): does a vendor-proposed slot leave at least 1.5 m of
 * pedestrian width? Advisory only (BR-41): the officer runs it on request, and approving or
 * rejecting the proposal still goes through the case's own decision buttons, never this panel.
 */
export function ProposalAssessment({ record }: { record: WardCase }) {
  const userId = useAuthStore((s) => s.user?.id);
  const cache = useQueryClient();
  const queryKey = ['ward', userId, 'proposal-assessment', record.id];
  const view = useQuery({ queryKey, queryFn: () => wardApi.proposalAssessment(record.id) });
  const run = useMutation({
    mutationFn: () => wardApi.runProposalAssessment(record.id),
    onSuccess: (latest) => cache.setQueryData(queryKey, { latest, isStale: false }),
    onError: (e) => showToast(errorMessage(e), 'error'),
  });

  if (view.isPending) return null;
  const latest = view.data?.latest;
  const isStale = view.data?.isStale ?? false;
  const canRun = record.status === 'PENDING';
  const tight = latest?.remainingPedestrianWidthMeters != null && latest.remainingPedestrianWidthMeters < 1.5;

  return (
    <Card>
      <View style={{ gap: 10 }}>
        <Text style={[text.headline, { color: colors.ink }]}>Đánh giá khả thi vị trí</Text>
        {!latest && !run.isPending ? <Text style={[text.footnote, { color: colors.muted }]}>Chưa có đánh giá nào cho đề xuất này.</Text> : null}
        {latest ? (
          <>
            {isStale ? <Banner tone="warning">Đề xuất đã đổi (vị trí, kích thước hoặc ảnh) sau lần đánh giá này. Kết quả dưới đây đã lỗi thời.</Banner> : null}
            <AiSuggestionCard
              title={latest.isAiGenerated ? `${RECOMMENDATION[latest.recommendation]} [AI]` : `${RECOMMENDATION[latest.recommendation]} [Hệ thống — chưa xác minh bằng AI]`}
              aiLogId={latest.aiLogId}
            >
              <Text style={[text.footnote, { color: colors.ink }]}>{`Bề rộng vỉa hè ước lượng: ${meters(latest.estimatedSidewalkWidthMeters)}`}</Text>
              <Text style={[text.footnote, { color: tight ? colors.onDanger : colors.ink, fontFamily: tight ? fonts.semibold : fonts.regular }]}>
                {`Lối đi bộ còn lại: ${meters(latest.remainingPedestrianWidthMeters)} (tối thiểu 1,5 m)`}
              </Text>
              <Text style={[text.footnote, { color: colors.ink }]}>{`Mức cản trở: ${OBSTRUCTION[latest.obstructionLevel]} · Độ tin cậy: ${latest.confidence}%`}</Text>
              {latest.reasons.map((reason, i) => (
                <Text key={i} style={[text.footnote, { color: colors.ink }]}>{`• ${reason}`}</Text>
              ))}
              {latest.ruleChecks.length > 0 ? (
                <View style={{ gap: 4, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 8 }}>
                  <Text style={[text.caption, { color: colors.muted }]}>KẾT QUẢ KIỂM TRA QUY TẮC</Text>
                  {latest.ruleChecks.map((issue, i) => (
                    <Text key={i} style={[text.footnote, { color: issue.severity === 'BLOCK' ? colors.onDanger : colors.ink }]}>{`• ${issue.message}`}</Text>
                  ))}
                </View>
              ) : null}
            </AiSuggestionCard>
          </>
        ) : null}
        {canRun ? (
          <Button
            label={run.isPending ? 'Đang đánh giá…' : latest ? 'Đánh giá lại' : 'Chạy đánh giá AI'}
            variant="secondary"
            icon={{ sf: 'sparkles', md: 'auto_awesome' }}
            loading={run.isPending}
            onPress={() => run.mutate()}
          />
        ) : null}
      </View>
    </Card>
  );
}
