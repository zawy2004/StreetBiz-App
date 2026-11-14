import { formatVnd } from '@/utils/format';
import { EVIDENCE_TYPE, type ApiEvidenceType } from '@/core/api';
import { formatHours, formatStartDate, type CardField, type FieldSource } from './interview-state';
import type { WatchedField } from './voice-filing';
import type { VoiceSessionState } from './voice-session-store';

export type CardValues = Record<WatchedField, string | number | boolean | null>;

export type EditTarget = 'owner-person' | 'owner-business' | 'details' | 'photos';

export type CardRow = {
  key: string;
  label: string;
  /** null = still missing. */
  value: string | null;
  required: boolean;
  source?: FieldSource;
  /** Tint for a second look: low OCR/AI confidence, or a value the vendor must still add. */
  warn?: boolean;
  note?: string;
};

export type CardGroup = {
  key: 'owner' | 'place' | 'goods' | 'scale' | 'documents';
  title: string;
  rows: CardRow[];
  edit: EditTarget;
};

const GENDER: Record<string, string> = { MALE: 'Nam', FEMALE: 'Nữ', OTHER: 'Khác' };

const text = (v: unknown): string | null => {
  const s = v === null || v === undefined ? '' : String(v).trim();
  return s ? s : null;
};

const dmy = (iso: unknown): string | null => {
  const s = text(iso);
  const m = s ? /^(\d{4})-(\d{2})-(\d{2})/.exec(s) : null;
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
};

/**
 * The confirm card, as data: five groups in the order the vendor reads them, plus the documents.
 * Every row says where its value came from; nothing here changes a value.
 */
export function buildCardGroups(input: {
  values: CardValues;
  session: Pick<VoiceSessionState, 'kyc' | 'lowConfidence' | 'sources' | 'draft' | 'location'>;
  evidence: ApiEvidenceType[];
  wardName: string | null;
  edited: string[];
}): CardGroup[] {
  const { values: v, session, evidence, edited } = input;
  const fixed = v.vendorType === 'FIXED_STOREFRONT';
  const kycShaky = !!session.kyc && (session.kyc.needsManualVerification || session.kyc.confidencePercent < 80);
  const lowAi = new Set<CardField>(session.lowConfidence);

  const fromCccd = (key: WatchedField): Pick<CardRow, 'source' | 'warn'> => {
    if (edited.includes(key)) return { source: 'EDITED' };
    if (session.kyc?.filled.includes(key)) return { source: 'CCCD', warn: kycShaky };
    return {};
  };
  const fromInterview = (field: CardField, keys: WatchedField[]): Pick<CardRow, 'source' | 'warn'> => {
    if (keys.some((k) => edited.includes(k))) return { source: 'EDITED' };
    const source = session.sources[field];
    return source ? { source, warn: source === 'VOICE' && lowAi.has(field) } : {};
  };

  const contact =
    text(v.contactAddress) ??
    (session.draft.contactSameAsPermanent === false ? null : session.draft.contactSameAsPermanent ? 'Như địa chỉ thường trú' : null);

  const owner: CardGroup = {
    key: 'owner',
    title: 'Chủ hộ',
    edit: 'owner-person',
    rows: [
      { key: 'ownerDateOfBirth', label: 'Ngày sinh', value: dmy(v.ownerDateOfBirth), required: true, ...fromCccd('ownerDateOfBirth') },
      { key: 'ownerGender', label: 'Giới tính', value: GENDER[String(v.ownerGender)] ?? null, required: true, ...fromCccd('ownerGender') },
      { key: 'ownerNationality', label: 'Quốc tịch', value: text(v.ownerNationality), required: true, ...fromCccd('ownerNationality') },
      { key: 'ownerEthnicity', label: 'Dân tộc', value: text(v.ownerEthnicity), required: false, ...fromCccd('ownerEthnicity') },
      { key: 'idIssuedDate', label: 'Ngày cấp CCCD', value: dmy(v.idIssuedDate), required: true, ...fromCccd('idIssuedDate') },
      { key: 'idIssuedPlace', label: 'Nơi cấp', value: text(v.idIssuedPlace), required: true, ...fromCccd('idIssuedPlace') },
      { key: 'permanentAddress', label: 'Thường trú', value: text(v.permanentAddress), required: true, ...fromCccd('permanentAddress') },
      {
        key: 'contactAddress',
        label: 'Nơi ở hiện tại',
        value: contact,
        required: false,
        ...fromInterview('contactAddress', ['contactAddress']),
        ...(contact === null && session.draft.contactSameAsPermanent === false
          ? { warn: true, note: 'Bạn nói đang ở chỗ khác — bấm Sửa để ghi địa chỉ.' }
          : {}),
      },
    ],
  };

  const place: CardGroup = {
    key: 'place',
    title: 'Điểm bán',
    edit: 'details',
    rows: [
      {
        key: 'displayName',
        label: 'Tên điểm bán',
        value: text(v.displayName),
        required: true,
        ...(edited.includes('displayName') ? { source: 'EDITED' as const } : { source: 'DEFAULT' as const }),
        note: edited.includes('displayName') ? undefined : 'Gợi ý từ món bạn bán — sửa nếu muốn.',
      },
      {
        key: 'vendorType',
        label: 'Cách bán',
        value: fixed ? 'Cửa hàng, ki-ốt cố định' : 'Xe đẩy, gánh, bán rong',
        required: true,
        ...fromInterview('vendorType', ['vendorType']),
      },
      {
        key: 'location',
        label: 'Chỗ bán',
        value:
          v.addressLatitude != null && v.addressLongitude != null
            ? (session.location?.label ?? `${v.addressLatitude}, ${v.addressLongitude}`)
            : null,
        required: false,
        ...(session.draft.locationConfirmed ? { source: 'CHOSEN' as const } : {}),
        note:
          v.addressLatitude == null ? 'Chưa ghim — bạn chọn ô vỉa hè sau khi được duyệt.' : undefined,
      },
      {
        key: 'wardUnitId',
        label: 'Phường',
        value: input.wardName,
        required: true,
        ...(edited.includes('wardUnitId') ? { source: 'EDITED' as const } : session.draft.wardUnitId ? { source: 'CHOSEN' as const } : {}),
      },
      ...(fixed
        ? [
            {
              key: 'declaredAddress',
              label: 'Địa chỉ cửa hàng',
              value: text(v.declaredAddress),
              required: true,
              ...fromInterview('declaredAddress', ['declaredAddress']),
            },
          ]
        : []),
    ],
  };

  const goods: CardGroup = {
    key: 'goods',
    title: 'Mặt hàng',
    edit: 'owner-business',
    rows: [
      { key: 'businessLine', label: 'Món bán', value: text(v.businessLine), required: true, ...fromInterview('businessLine', ['businessLine']) },
      ...(session.draft.hours
        ? [
            {
              key: 'hours',
              label: 'Giờ bán',
              value: formatHours(session.draft.hours) || null,
              required: false,
              ...fromInterview('hours', []),
              note: 'Chỉ dùng để gợi ý ô hợp giờ, không ghi vào hồ sơ.',
            },
          ]
        : []),
    ],
  };

  const capital = text(v.capitalAmount);
  const scale: CardGroup = {
    key: 'scale',
    title: 'Quy mô',
    edit: 'owner-business',
    rows: [
      {
        key: 'capitalAmount',
        label: 'Vốn ban đầu',
        value: capital ? formatVnd(Number(capital)) : null,
        required: true,
        ...fromInterview('capitalAmount', ['capitalAmount']),
      },
      {
        key: 'laborCount',
        label: 'Số người cùng bán',
        value: text(v.laborCount) ? `${v.laborCount} người` : null,
        required: true,
        ...fromInterview('laborCount', ['laborCount']),
      },
      {
        key: 'plannedStartDate',
        label: 'Ngày bắt đầu bán',
        value: formatStartDate(text(v.plannedStartDate)) || text(v.plannedStartDate),
        required: true,
        ...fromInterview('plannedStartDate', ['plannedStartDate']),
      },
    ],
  };

  const has = (type: ApiEvidenceType) => evidence.includes(type);
  const documents: CardGroup = {
    key: 'documents',
    title: 'Giấy tờ',
    edit: 'photos',
    rows: [
      {
        key: 'idCard',
        label: 'Ảnh CCCD',
        value:
          has(EVIDENCE_TYPE.identityDocument) && has(EVIDENCE_TYPE.identityDocumentBack)
            ? 'Đủ 2 mặt'
            : null,
        required: true,
      },
      ...(fixed
        ? [
            {
              key: 'license',
              label: 'Giấy phép kinh doanh',
              value: has(EVIDENCE_TYPE.businessLicense) ? 'Đã chụp' : null,
              required: true,
            },
          ]
        : []),
      {
        key: 'stall',
        label: 'Ảnh xe hoặc quầy',
        value: has(EVIDENCE_TYPE.other) ? 'Đã chụp' : 'Không có',
        required: false,
      },
    ],
  };

  return [owner, place, goods, scale, documents];
}

/** Rows still blocking "Đúng, nộp", as the words shown under the button. */
export function missingRows(groups: CardGroup[]): CardRow[] {
  return groups.flatMap((g) => g.rows).filter((r) => r.required && r.value === null);
}

/** What the speaker button of a group reads out. */
export function speakableGroup(group: CardGroup): string {
  return `${group.title}. ${group.rows
    .map((r) => `${r.label}: ${r.value ?? 'còn thiếu'}`)
    .join('. ')}.`;
}
