import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Text, View } from 'react-native';

import { Card } from '@/components/common/Blocks';
import { Button } from '@/components/common/Button';
import { Icon } from '@/components/common/Icon';
import { Banner } from '@/components/feedback/Banner';
import { showToast } from '@/components/feedback/Toast';
import { errorMessage } from '@/core/api';
import { useAuthStore } from '@/store/auth-store';
import { colors, fonts, radius, sign, tabular, text } from '@/theme';
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

const MIN_WALK = 1.5;
const meters = (value: number | null) => (value != null ? `${String(value).replace('.', ',')} m` : 'chưa ước lượng được');

/**
 * The pavement in cross-section, from the shop wall to the kerb: the stall's share in orange,
 * the walking width left in green (red under 1.5 m), a tick where 1.5 m falls. Drawn only from
 * the assessment's own two estimates; shown inside the [AI] card, so it is read as advice.
 */
function WalkGauge({ sidewalk, remaining }: { sidewalk: number; remaining: number }) {
  const total = Math.max(sidewalk, remaining, 0.1);
  const walk = Math.max(Math.min(remaining, total), 0);
  const stall = Math.max(total - walk, 0);
  const tight = walk < MIN_WALK;
  const tick = Math.min(MIN_WALK / total, 1);
  return (
    <View accessible accessibilityLabel={`Vỉa hè ${meters(sidewalk)}, lối đi còn ${meters(remaining)}, tối thiểu 1,5 m`} style={{ gap: 6, paddingVertical: 4 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={[text.caption, { color: colors.muted }]}>Tường nhà</Text>
        <Text style={[text.caption, { color: colors.muted }]}>Bó vỉa</Text>
      </View>
      <View>
        <View style={{ flexDirection: 'row', height: 22, borderRadius: radius.plate, overflow: 'hidden', backgroundColor: colors.sunken }}>
          {stall > 0 ? <View style={{ flex: stall, backgroundColor: colors.brand }} /> : null}
          {walk > 0 ? <View style={{ flex: walk, backgroundColor: tight ? colors.danger : colors.leaf }} /> : null}
        </View>
        {/* 1.5 m measured back from the kerb */}
        <View style={{ position: 'absolute', top: -4, bottom: -4, right: `${tick * 100}%`, width: 2, backgroundColor: colors.ink }} />
      </View>
      <View style={{ flexDirection: 'row', gap: 14, flexWrap: 'wrap' }}>
        <Legend color={colors.brand} label="Phần quầy" />
        <Legend color={tight ? colors.danger : colors.leaf} label={`Lối đi ${meters(remaining)}`} />
        <Legend color={colors.ink} label="Mốc 1,5 m" />
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <Text style={[text.caption, tabular, { color: colors.ink }]}>{label}</Text>
    </View>
  );
}

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
    <Card style={{ padding: 18 }}>
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.mangoTint, alignItems: 'center', justifyContent: 'center' }}>
            <Icon sf="figure.walk" md="directions_walk" size={21} color={colors.onMango} />
          </View>
          <View style={{ flex: 1, gap: 1 }}>
            <Text accessibilityRole="header" style={[text.headline, { color: colors.ink }]}>Đánh giá khả thi vị trí</Text>
            <Text style={[text.footnote, { color: colors.muted }]}>Lối đi bộ phải còn tối thiểu 1,5 m</Text>
          </View>
        </View>
        {!latest && !run.isPending ? <Text style={[text.footnote, { color: colors.muted }]}>Chưa có đánh giá nào cho đề xuất này.</Text> : null}
        {latest ? (
          <>
            {isStale ? <Banner tone="warning">Đề xuất đã đổi (vị trí, kích thước hoặc ảnh) sau lần đánh giá này. Kết quả dưới đây đã lỗi thời.</Banner> : null}
            <AiSuggestionCard
              title={latest.isAiGenerated ? `${RECOMMENDATION[latest.recommendation]} [AI]` : `${RECOMMENDATION[latest.recommendation]} [Hệ thống — chưa xác minh bằng AI]`}
              aiLogId={latest.aiLogId}
            >
              {latest.estimatedSidewalkWidthMeters != null && latest.remainingPedestrianWidthMeters != null ? (
                <WalkGauge sidewalk={latest.estimatedSidewalkWidthMeters} remaining={latest.remainingPedestrianWidthMeters} />
              ) : null}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1, gap: 1 }}>
                  <Text style={[text.caption, { color: colors.muted }]}>Bề rộng vỉa hè ước lượng</Text>
                  <Text maxFontSizeMultiplier={1.3} style={[sign.price, tabular, { color: colors.ink }]}>{meters(latest.estimatedSidewalkWidthMeters)}</Text>
                </View>
                <View style={{ flex: 1, gap: 1 }}>
                  <Text style={[text.caption, { color: colors.muted }]}>Lối đi bộ còn lại (tối thiểu 1,5 m)</Text>
                  <Text maxFontSizeMultiplier={1.3} style={[sign.price, tabular, { color: tight ? colors.onDanger : colors.ink }]}>
                    {meters(latest.remainingPedestrianWidthMeters)}
                  </Text>
                </View>
              </View>
              <Text style={[text.footnote, { color: colors.ink }]}>{`Mức cản trở: ${OBSTRUCTION[latest.obstructionLevel]}`}</Text>
              <Text style={[text.footnote, tabular, { color: colors.ink }]}>{`Độ tin cậy: ${latest.confidence}%`}</Text>
              {latest.reasons.map((reason, i) => (
                <Text key={i} style={[text.footnote, { color: colors.ink }]}>{`• ${reason}`}</Text>
              ))}
              {latest.ruleChecks.length > 0 ? (
                <View style={{ gap: 4, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 8 }}>
                  <Text style={[text.caption, { color: colors.muted }]}>Kết quả kiểm tra quy tắc</Text>
                  {latest.ruleChecks.map((issue, i) => (
                    <Text key={i} style={[text.footnote, { color: issue.severity === 'BLOCK' ? colors.onDanger : colors.ink, fontFamily: issue.severity === 'BLOCK' ? fonts.semibold : fonts.regular }]}>{`• ${issue.message}`}</Text>
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
