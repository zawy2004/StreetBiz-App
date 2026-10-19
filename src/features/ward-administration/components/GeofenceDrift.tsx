import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Card } from '@/components/common/Blocks';
import { Icon } from '@/components/common/Icon';
import { StatusPill } from '@/components/status/StatusPill';
import { useAuthStore } from '@/store/auth-store';
import { colors, fonts, radius, tabular, text } from '@/theme';
import { formatVietnamDateTime } from '@/utils/format';
import { complianceApi, type GeofenceDriftItem } from '../ward-api';
import { AiSuggestionCard } from './ReviewParts';

const LEVEL: Record<GeofenceDriftItem['level'], { label: string; tone: 'danger' | 'pending' }> = {
  WATCH: { label: 'Theo dõi', tone: 'pending' },
  DRIFT: { label: 'Lệch vị trí', tone: 'danger' },
};

/**
 * AIC-06 (web GeofenceDriftPanel): permits whose QR scans keep landing away from their licensed
 * slot over the last 30 days. Level, distances and counts are plain geometry; only the DRIFT
 * narrative may be AI-written, and it is advice for the patrol (BR-41), never a decision.
 */
export function GeofenceDrift() {
  const userId = useAuthStore((s) => s.user?.id);
  const report = useQuery({ queryKey: ['ward', userId, 'geofence-drift'], queryFn: complianceApi.geofenceDrift });
  if (report.isPending || !report.data || report.data.items.length === 0) return null;
  const r = report.data;
  return (
    <Card>
      <View style={{ gap: 10 }}>
        <View style={{ gap: 2 }}>
          <Text style={[text.headline, { color: colors.ink }]}>Lệch vị trí khi quét giấy phép</Text>
          <Text style={[text.footnote, { color: colors.muted }]}>{`${r.items.length} ô có lượt quét lệch quá ${r.toleranceMeters} m trong ${r.windowDays} ngày qua.`}</Text>
        </View>
        {r.items.map((item) => (
          <DriftItem key={item.permitId} item={item} />
        ))}
      </View>
    </Card>
  );
}

function DriftItem({ item }: { item: GeofenceDriftItem }) {
  const [open, setOpen] = useState(false);
  const level = LEVEL[item.level];
  const offset = item.meanOffsetMeters != null && item.meanOffsetBearingDegrees != null ? ` · lệch trung bình ~${Math.round(item.meanOffsetMeters)} m` : '';
  return (
    <View style={{ gap: 8, padding: 12, borderRadius: radius.control, borderCurve: 'continuous', borderWidth: 1, borderColor: colors.line }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: colors.ink }} numberOfLines={2}>{`${item.slotCode} · ${item.vendorName}`}</Text>
        <StatusPill label={level.label} tone={level.tone} />
      </View>
      <Text style={[text.footnote, tabular, { color: colors.ink }]}>
        {`${item.offSiteCount}/${item.scanCount} lần quét lệch > 25 m${offset}${item.maxDistanceMeters ? ` · xa nhất ${item.maxDistanceMeters} m` : ''}`}
      </Text>
      <AiSuggestionCard title={item.isAiGenerated ? 'Nhận định AI [AI]' : 'Nhận định [Hệ thống — chưa xác minh bằng AI]'} aiLogId={item.aiLogId}>
        <Text style={[text.footnote, { color: colors.ink }]}>{item.explanation}</Text>
      </AiSuggestionCard>
      <Pressable onPress={() => setOpen((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: open }} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32 }}>
        <Icon sf={open ? 'chevron.up' : 'chevron.down'} md={open ? 'expand_less' : 'expand_more'} size={15} color={colors.sign} />
        <Text style={[text.subhead, { color: colors.sign }]}>{open ? 'Thu gọn' : `Xem ${item.scans.length} lượt quét`}</Text>
      </Pressable>
      {open
        ? item.scans.map((scan) => (
            <Text key={scan.scanId} style={[text.caption, tabular, { color: colors.muted }]}>
              {`${formatVietnamDateTime(scan.scannedAt)} · cách ${scan.distanceMeters} m · ${scan.scanContext === 'PUBLIC_CHECK' ? 'khách quét' : 'cán bộ quét'}`}
            </Text>
          ))
        : null}
    </View>
  );
}
