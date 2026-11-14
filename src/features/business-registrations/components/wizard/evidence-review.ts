import { formatVnd } from '@/utils/format';
import { VENDOR_TYPE } from '@/core/api';
import { vendorTypeLabel } from '../../labels';
import {
  parseVndAmount,
  type DraftEvidence,
  type useNewRegistrationStore,
} from '../../new-registration-store';
import { ownerRequirements } from './owner-progress';

type DraftState = ReturnType<typeof useNewRegistrationStore.getState>;

export type ReviewItem = {
  key: string;
  label: string;
  /** What will be sent, as the vendor should read it; empty when nothing is filled. */
  value: string;
  missing: boolean;
  editPath: string;
};

const TYPE = '/register-business';
const DETAILS = '/register-business/details';
const OWNER = '/register-business/owner';

/**
 * "Kiểm tra lại trước khi nộp": every answer of steps 1–3, shown the way the
 * submission will carry it (VND via `parseVndAmount`, as sent). `missing` only
 * draws a "CHƯA ĐIỀN" chip — nothing here blocks the submit.
 */
export function reviewItems(d: DraftState, wardName: string | null): ReviewItem[] {
  const fixed = d.vendorType === VENDOR_TYPE.fixedStorefront;
  const owner = ownerRequirements(d).filter((r) => r.section === 'owner');
  const ownerMissing = owner.filter((r) => !r.filled).map((r) => r.label);
  const capital = parseVndAmount(d.capitalAmount);
  const members = d.householdMembers.filter((m) => m.fullName.trim()).length;

  const items: ReviewItem[] = [
    {
      key: 'type',
      label: 'Loại hình',
      value: vendorTypeLabel(d.vendorType),
      missing: false,
      editPath: TYPE,
    },
    {
      key: 'name',
      label: 'Tên hộ kinh doanh',
      value: d.displayName.trim(),
      missing: !d.displayName.trim(),
      editPath: DETAILS,
    },
    {
      key: 'ward',
      label: 'Phường/xã quản lý',
      value: d.wardUnitId ? (wardName ?? `Mã phường ${d.wardUnitId}`) : '',
      missing: !d.wardUnitId,
      editPath: DETAILS,
    },
    {
      key: 'address',
      label: 'Địa chỉ kinh doanh',
      value: d.declaredAddress.trim() || (fixed ? '' : 'Không khai báo (bán hàng lưu động)'),
      missing: fixed && !d.declaredAddress.trim(),
      editPath: DETAILS,
    },
  ];

  if (fixed) {
    items.push({
      key: 'coords',
      label: 'Toạ độ',
      value:
        d.addressLatitude != null && d.addressLongitude != null
          ? `${d.addressLatitude}, ${d.addressLongitude}`
          : 'Không có (không bắt buộc)',
      missing: false,
      editPath: DETAILS,
    });
  }

  items.push(
    {
      key: 'owner',
      label: 'Chủ hộ kinh doanh',
      value:
        ownerMissing.length === 0
          ? `Đủ ${owner.length}/${owner.length} mục bắt buộc`
          : `Thiếu: ${ownerMissing.join(', ')}`,
      missing: ownerMissing.length > 0,
      editPath: OWNER,
    },
    {
      key: 'businessLine',
      label: 'Ngành, nghề kinh doanh',
      value: d.businessLine.trim(),
      missing: !d.businessLine.trim(),
      editPath: OWNER,
    },
    {
      key: 'capital',
      label: 'Vốn kinh doanh',
      value: capital != null ? formatVnd(capital) : '',
      missing: !d.capitalAmount.trim(),
      editPath: OWNER,
    },
    {
      key: 'labor',
      label: 'Số lao động',
      value: d.laborCount.trim(),
      missing: !d.laborCount.trim(),
      editPath: OWNER,
    },
    {
      key: 'start',
      label: 'Ngày dự kiến bắt đầu',
      value: d.plannedStartDate,
      missing: !d.plannedStartDate,
      editPath: OWNER,
    },
    {
      key: 'members',
      label: 'Thành viên hộ góp vốn',
      value: members > 0 ? `${members} người` : 'Không có',
      missing: false,
      editPath: OWNER,
    },
    {
      key: 'commitment',
      label: 'Cam kết an toàn thực phẩm',
      value: d.foodSafetyCommitment ? 'Đã cam kết' : '',
      missing: !d.foodSafetyCommitment,
      editPath: OWNER,
    },
  );
  return items;
}

export type StageState = 'todo' | 'running' | 'done' | 'error';

export type Pipeline = {
  upload: { state: StageState; done: number; total: number };
  create: { state: StageState };
  attach: { state: StageState; done: number; total: number };
  /** Something already reached the server, so pressing again resumes. */
  partial: boolean;
  uploaded: number;
  created: boolean;
};

/**
 * The three real stages of `submitRegistrationDraft`, read back from what it
 * writes into the store as it goes (uploadedUrl, createdRegistrationId,
 * attached). It follows the requests; it never runs ahead of them.
 */
export function pipelineState(
  evidence: DraftEvidence[],
  createdRegistrationId: number | null,
  pending: boolean,
  failed: boolean,
): Pipeline {
  const files = evidence.filter((e) => e.file || e.uploadedUrl);
  const uploaded = files.filter((e) => e.uploadedUrl).length;
  const attached = files.filter((e) => e.attached).length;
  const uploadsDone = uploaded === files.length;
  const created = createdRegistrationId !== null || attached > 0;
  const attachDone = created && attached === files.length;

  const stage = (done: boolean, reachable: boolean): StageState =>
    done ? 'done' : reachable && pending ? 'running' : reachable && failed ? 'error' : 'todo';

  return {
    upload: { state: stage(uploadsDone, true), done: uploaded, total: files.length },
    create: { state: stage(created, uploadsDone) },
    attach: { state: stage(attachDone, created), done: attached, total: files.length },
    partial: uploaded > 0 || created,
    uploaded,
    created: createdRegistrationId !== null,
  };
}
