import type { PriceHistoryEntry } from '@/core/api/seller-store-api';
import { formatVnd } from '@/utils/format';

/** Units of sale offered as one-tap choices in the dish form; anything else can be typed. */
export const COMMON_UNITS = ['phần', 'ổ', 'ly', 'tô', 'đĩa', 'chén', 'cái', 'xiên', 'chai', 'kg'];
/** PriceBoardRules on the server. */
export const PRICE_UNIT_MAX = 30;
export const NAME_EN_MAX = 180;

/** "25.000 đ / ổ": a posted price always names what it is for (Luật Giá 2023 Điều 29). */
export const priceWithUnit = (price: number, unit: string) => `${formatVnd(price)} / ${unit}`;

/**
 * One row of the price history in the vendor's words: what changed, and the price before and
 * after when it moved. The rows are append-only on the server; this only reads them.
 */
export function historyLine(entry: PriceHistoryEntry): { title: string; price: string } {
  const moved = entry.previousUnitPrice != null && entry.previousUnitPrice !== entry.unitPrice;
  const title =
    entry.changeKind === 'CREATED'
      ? 'Thêm món'
      : entry.changeKind === 'ARCHIVED'
        ? 'Gỡ khỏi bảng giá'
        : entry.changeKind === 'RESTORED'
          ? 'Hiện lại trên bảng giá'
          : moved
            ? 'Đổi giá'
            : 'Sửa tên hoặc đơn vị';
  const price = moved
    ? `${formatVnd(entry.previousUnitPrice!)} → ${priceWithUnit(entry.unitPrice, entry.priceUnit)}`
    : priceWithUnit(entry.unitPrice, entry.priceUnit);
  return { title, price };
}
