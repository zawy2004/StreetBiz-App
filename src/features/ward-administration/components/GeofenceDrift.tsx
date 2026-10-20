import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/common/Icon';
import { StatusPill } from '@/components/status/StatusPill';
import { useAuthStore } from '@/store/auth-store';
import { colors, fonts, radius, shadow, sign, tabular, text } from '@/theme';
import { Plate } from '@/ui';
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
 * v5: each slot shows its scans as a row of dots (red = farther than the tolerance).
 */
export function GeofenceDrift() {
  const userId = useAuthStore((s) => s.user?.id);
  const report = useQuery({ queryKey: ['ward', userId, 'geofence-drift'], queryFn: complianceApi.geofenceDrift });
  if (report.isPending || !report.data || report.data.items.length === 0) return null;
  const r = report.data;
  return (
    <View style={{ padding: 16, gap: 14, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadow.card }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.dangerTint, alignItems: 'center', justifyContent: 'center' }}>
          <Icon sf="location.slash.fill" md="wrong_location" size={19} color={colors.danger} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text accessibilityRole="header" style={[text.headline, { color: colors.ink }]}>Lệch vị trí khi quét giấy phép</Text>
          <Text style={[text.footnote, { color: colors.muted }]}>{`${r.items.length} ô có lượt quét lệch quá ${r.toleranceMeters} m trong ${r.windowDays} ngày qua.`}</Text>
        </View>
      </View>
      {r.items.map((item) => (
        <DriftItem key={item.permitId} item={item} tolerance={r.toleranceMeters} />
      ))}
    </View>
  );
}

function DriftItem({ item, tolerance }: { item: GeofenceDriftItem; tolerance: number }) {
  const [open, setOpen] = useState(false);
  const level = LEVEL[item.level];
  const facts = [
    item.meanOffsetMeters != null && item.meanOffsetBearingDegrees != null ? `lệch trung bình ~${Math.round(item.meanOffsetMeters)} m` : null,
    item.maxDistanceMeters ? `xa nhất ${item.maxDistanceMeters} m` : null,
  ].filter(Boolean);
  return (
    <View style={{ gap: 10, padding: 14, borderRadius: radius.control, borderCurve: 'continuous', backgroundColor: colors.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Plate code={item.slotCode} />
        <Text style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20, color: colors.ink }} numberOfLines={2}>{item.vendorName}</Text>
        <StatusPill label={level.label} tone={level.tone} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Text maxFontSizeMultiplier={1.3} style={[sign.title, tabular, { color: item.level === 'DRIFT' ? colors.onDanger : colors.onMango }]}>{`${item.offSiteCount}/${item.scanCount}`}</Text>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[text.footnote, { fontFamily: fonts.semibold, color: colors.ink }]}>lần quét lệch &gt; 25 m</Text>
          {facts.length ? <Text style={[text.caption, tabular, { color: colors.muted }]}>{facts.join(', ')}</Text> : null}
        </View>
      </View>
      {item.scans.length ? (
        // One dot per scan in this window: red when it landed farther than the tolerance.
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
          {item.scans.map((scan) => (
            <View key={scan.scanId} style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: scan.distanceMeters > tolerance ? colors.danger : colors.leaf }} />
          ))}
        </View>
      ) : null}
      <AiSuggestionCard title={item.isAiGenerated ? 'Nhận định AI [AI]' : 'Nhận định [Hệ thống — chưa xác minh bằng AI]'} aiLogId={item.aiLogId}>
        <Text style={[text.footnote, { color: colors.ink }]}>{item.explanation}</Text>
      </AiSuggestionCard>
      <Pressable onPress={() => setOpen((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: open }} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44 }}>
        <Icon sf={open ? 'chevron.up' : 'chevron.down'} md={open ? 'expand_less' : 'expand_more'} size={15} color={colors.sign} />
        <Text style={{ fontFamily: fonts.heavy, fontSize: 14.5, color: colors.sign }}>{open ? 'Thu gọn' : `Xem ${item.scans.length} lượt quét`}</Text>
      </Pressable>
      {open
        ? item.scans.map((scan) => (
            <View key={scan.scanId} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: scan.distanceMeters > tolerance ? colors.danger : colors.leaf }} />
              <Text style={[text.caption, tabular, { flex: 1, color: colors.muted }]}>
                {`${formatVietnamDateTime(scan.scannedAt)}, cách ${scan.distanceMeters} m, ${scan.scanContext === 'PUBLIC_CHECK' ? 'khách quét' : 'cán bộ quét'}`}
              </Text>
            </View>
          ))
        : null}
    </View>
  );
}
