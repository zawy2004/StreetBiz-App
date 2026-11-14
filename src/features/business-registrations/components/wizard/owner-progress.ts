import type { useNewRegistrationStore } from '../../new-registration-store';

type DraftState = ReturnType<typeof useNewRegistrationStore.getState>;

export type OwnerSection = 'scan' | 'owner' | 'business' | 'members' | 'commitment';

export type OwnerRequirement = {
  /** Same key the step's `submit` uses for its error. */
  key: string;
  section: OwnerSection;
  label: string;
  filled: boolean;
};

/**
 * The twelve things step 3's "Tiếp tục" checks, with the same presence tests
 * (`submit` stays the source of truth). Used only to show "x/12" and which
 * section is complete; nothing here blocks or flags anything early.
 */
export function ownerRequirements(d: DraftState): OwnerRequirement[] {
  return [
    { key: 'ownerDateOfBirth', section: 'owner', label: 'ngày sinh', filled: !!d.ownerDateOfBirth },
    { key: 'ownerGender', section: 'owner', label: 'giới tính', filled: !!d.ownerGender },
    {
      key: 'ownerNationality',
      section: 'owner',
      label: 'quốc tịch',
      filled: !!d.ownerNationality.trim(),
    },
    { key: 'idType', section: 'owner', label: 'loại giấy tờ', filled: !!d.idType },
    { key: 'idIssuedDate', section: 'owner', label: 'ngày cấp', filled: !!d.idIssuedDate },
    { key: 'idIssuedPlace', section: 'owner', label: 'nơi cấp', filled: !!d.idIssuedPlace.trim() },
    {
      key: 'permanentAddress',
      section: 'owner',
      label: 'địa chỉ thường trú',
      filled: !!d.permanentAddress.trim(),
    },
    {
      key: 'businessLine',
      section: 'business',
      label: 'ngành nghề',
      filled: !!d.businessLine.trim(),
    },
    {
      key: 'capitalAmount',
      section: 'business',
      label: 'vốn kinh doanh',
      filled: !!d.capitalAmount.trim(),
    },
    { key: 'laborCount', section: 'business', label: 'số lao động', filled: !!d.laborCount.trim() },
    {
      key: 'plannedStartDate',
      section: 'business',
      label: 'ngày dự kiến bắt đầu',
      filled: !!d.plannedStartDate,
    },
    {
      key: 'foodSafetyCommitment',
      section: 'commitment',
      label: 'cam kết an toàn thực phẩm',
      filled: !!d.foodSafetyCommitment,
    },
  ];
}
