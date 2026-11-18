import { Linking, Text, View } from 'react-native';

import { ListGroup, ListRow } from '@/components/common/ListGroup';
import { Banner } from '@/components/feedback/Banner';
import { env } from '@/core/config/env';
import { feedbackPhoneLabel, feedbackSiteLabel, REPORT_CHOICES } from '@/features/vendor-reports/report-view';
import { colors, fonts, radius, sign, tabular, text } from '@/theme';
import { formatVnd, formatVietnamDateTime } from '@/utils/format';
import type { PermitVerification, VendorReportType } from '../community-api';

/**
 * BUY-06: the stall's price board under a live permit check, drawn like the paper board hung at
 * the counter: each dish with its English name if the vendor gave one, the price in sign figures
 * and the unit it is for, the version and when it last changed. Only for a VALID permit: an
 * invalid one shows no prices at all. Read from the answer the screen holds, never stored (BR-39).
 * Static labels carry an English line for visitors.
 */
export function VerdictPriceBoard({ result, printedVersion }: { result: PermitVerification; printedVersion: number | null }) {
  if (!result.isValid) return null;
  const board = result.priceBoard;
  if (!board) {
    return (
      <Banner tone="neutral" title="Quầy chưa đăng bảng giá trên StreetBiz">
        Bảng giá giấy tại quầy vẫn bắt buộc. Nếu quầy không treo bảng giá, bạn có thể phản ánh bên dưới.
      </Banner>
    );
  }
  const outdated = board.printedVersionIsCurrent === false;
  return (
    <View style={{ gap: 10 }}>
      <View accessibilityRole="header" style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, paddingHorizontal: 4 }}>
        <View style={{ flex: 1, gap: 1 }}>
          <Text style={{ fontFamily: fonts.heavy, fontSize: 21, lineHeight: 27, color: colors.ink }}>Bảng giá niêm yết</Text>
          <Text style={[text.footnote, { color: colors.muted }]}>Posted prices</Text>
        </View>
        <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.plate, backgroundColor: colors.plate }}>
          <Text maxFontSizeMultiplier={1.3} style={[sign.plate, tabular, { color: colors.white }]}>{`Bản số ${board.version}`}</Text>
        </View>
      </View>
      {outdated ? (
        <Banner tone="warning" title={printedVersion ? `Bảng giá tại quầy là bản ${printedVersion}, giá hiện tại là bản ${board.version}.` : `Bảng giá tại quầy không phải bản mới nhất (bản ${board.version}).`}>
          {printedVersion ? `The board at the stall is version ${printedVersion}; current prices are version ${board.version}.` : `The board at the stall is not the latest (version ${board.version}).`}
        </Banner>
      ) : null}
      <View style={{ borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, overflow: 'hidden', borderTopWidth: 6, borderTopColor: colors.sticker }}>
        {board.items.length === 0 ? (
          <Text style={[text.callout, { padding: 16, color: colors.muted }]}>Quầy chưa niêm yết món nào trên StreetBiz.</Text>
        ) : (
          board.items.map((item, i) => (
            <View
              key={item.menuItemId}
              accessible
              accessibilityLabel={`${item.name}${item.nameEn ? `, ${item.nameEn}` : ''}: ${formatVnd(item.unitPrice)} một ${item.priceUnit}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: colors.separator }}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 15.5, lineHeight: 21, color: colors.ink }}>{item.name}</Text>
                {item.nameEn ? <Text style={[text.footnote, { color: colors.muted }]}>{item.nameEn}</Text> : null}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text maxFontSizeMultiplier={1.4} style={[sign.price, tabular, { color: colors.primary }]}>{formatVnd(item.unitPrice)}</Text>
                <Text style={[text.caption, { color: colors.muted }]}>{`/ ${item.priceUnit}`}</Text>
              </View>
            </View>
          ))
        )}
        <View style={{ paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.kerbPaint, gap: 1 }}>
          <Text style={[text.caption, tabular, { color: colors.ink }]}>
            {board.updatedAt ? `Cập nhật lúc ${formatVietnamDateTime(board.updatedAt)}` : 'Chưa có thay đổi nào'}
          </Text>
          <Text style={[text.caption, { fontFamily: fonts.regular, color: colors.muted }]}>
            {board.updatedAt ? `Updated ${formatVietnamDateTime(board.updatedAt)} (Vietnam time)` : 'No changes yet'}
          </Text>
        </View>
      </View>
    </View>
  );
}

const CHOICE_TINT: Record<VendorReportType, { tint: string; tile: string }> = {
  OVERCHARGE: { tint: colors.danger, tile: colors.dangerTint },
  PRICE_NOT_POSTED: { tint: colors.onMango, tile: colors.mangoTint },
  GENERAL: { tint: colors.sign, tile: colors.signTint },
};

/** The three ways to tell the ward about this stall, under its price board. */
export function ReportChoices({ onPick, types = ['OVERCHARGE', 'PRICE_NOT_POSTED', 'GENERAL'] }: { onPick: (type: VendorReportType) => void; types?: VendorReportType[] }) {
  return (
    <ListGroup title="Có vấn đề với quầy này?" footer="Cán bộ phường xem và tự quyết định cách xử lý. Người bán không thấy tên bạn.">
      {REPORT_CHOICES.filter((c) => types.includes(c.type)).map((c) => (
        <ListRow key={c.type} title={c.label} subtitle={c.note} icon={c.icon} tint={CHOICE_TINT[c.type].tint} tileColor={CHOICE_TINT[c.type].tile} onPress={() => onPick(c.type)} />
      ))}
    </ListGroup>
  );
}

/** Đà Nẵng's own channel 1022 (number and site from config): StreetBiz links to it, never replaces it. */
export function CityFeedbackLinks() {
  const phone = env.cityFeedbackPhone;
  const site = env.cityFeedbackUrl;
  return (
    <ListGroup title="Kênh 1022 của thành phố" footer="Không muốn tạo tài khoản? Phản ánh qua tổng đài 1022 hoặc Góp ý Đà Nẵng.">
      <ListRow title={`Gọi ${feedbackPhoneLabel(phone)}`} subtitle="Tổng đài tiếp nhận phản ánh của Đà Nẵng" icon={{ sf: 'phone.fill', md: 'call' }} tint={colors.onLeaf} tileColor={colors.leafTint} onPress={() => void Linking.openURL(`tel:${phone.replace(/[^0-9+]/g, '')}`)} />
      <ListRow title="Góp ý Đà Nẵng" subtitle={feedbackSiteLabel(site)} icon={{ sf: 'globe', md: 'language' }} tint={colors.sign} tileColor={colors.signTint} onPress={() => void Linking.openURL(site)} />
    </ListGroup>
  );
}
