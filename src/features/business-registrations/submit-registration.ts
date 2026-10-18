import { EVIDENCE_TYPE, vendorRegistrationApi, type ApiRegistration, type RegistrationPayload } from '@/core/api';
import { parseVndAmount, useNewRegistrationStore } from './new-registration-store';

/**
 * REG-01/02/04 submission against StreetBiz-BE, in three resumable steps:
 *
 * 1. upload every picked file (nothing is created if a file is rejected);
 * 2. create the registration — or update it when editing (REG-04);
 * 3. attach each uploaded file as evidence.
 *
 * Progress is written back to the wizard store as it happens, so if step 2 or 3
 * fails, pressing submit again skips what already succeeded. Without that a
 * retry would create a second application and hit BR-09.
 */
export async function submitRegistrationDraft(): Promise<ApiRegistration> {
  const store = useNewRegistrationStore.getState;

  for (const item of store().evidence) {
    if (item.uploadedUrl || !item.file) continue;
    const uploaded = await vendorRegistrationApi.uploadEvidenceFile(item.file);
    store().patchEvidence(item.evidenceType, { uploadedUrl: uploaded.fileUrl });
  }

  const draft = store();
  if (!draft.displayName.trim() || !draft.wardUnitId) {
    throw new Error('Vui lòng hoàn thành thông tin hộ kinh doanh và chọn phường/xã ở các bước trước.');
  }

  const payload: RegistrationPayload = {
    vendorType: draft.vendorType,
    displayName: draft.displayName.trim(),
    declaredAddress: draft.declaredAddress.trim() || null,
    addressLatitude: draft.addressLatitude,
    addressLongitude: draft.addressLongitude,
    wardUnitId: draft.wardUnitId,
    ownerDateOfBirth: draft.ownerDateOfBirth || null,
    ownerGender: draft.ownerGender || null,
    ownerEthnicity: draft.ownerEthnicity.trim() || null,
    ownerNationality: draft.ownerNationality.trim() || null,
    idType: draft.idType || null,
    idIssuedDate: draft.idIssuedDate || null,
    idIssuedPlace: draft.idIssuedPlace.trim() || null,
    permanentAddress: draft.permanentAddress.trim() || null,
    contactAddress: draft.contactAddress.trim() || null,
    businessLine: draft.businessLine.trim() || null,
    businessLineCode: draft.businessLineCode.trim() || null,
    capitalAmount: parseVndAmount(draft.capitalAmount),
    laborCount: draft.laborCount.trim() ? Number(draft.laborCount) : null,
    plannedStartDate: draft.plannedStartDate || null,
    foodSafetyCommitment: draft.foodSafetyCommitment,
    householdMembers: draft.householdMembers
      .filter((m) => m.fullName.trim())
      .map((m) => ({
        fullName: m.fullName.trim(),
        dateOfBirth: m.dateOfBirth || null,
        idNumber: m.idNumber.trim() || null,
        relationshipToOwner: m.relationshipToOwner.trim() || null,
        capitalContribution: parseVndAmount(m.capitalContribution),
      })),
  };

  // Editing, or retrying after this wizard already created the application: update
  // it, which also applies anything the user changed before retrying. Idempotent.
  const existingId = draft.registrationId ?? draft.createdRegistrationId;

  let registration: ApiRegistration;
  if (existingId !== null) {
    registration = await vendorRegistrationApi.update(existingId, payload);
  } else {
    registration = await vendorRegistrationApi.submit(payload);
    store().setField('createdRegistrationId', registration.registrationId);
  }

  for (const item of store().evidence) {
    if (item.attached || !item.uploadedUrl) continue;
    await vendorRegistrationApi.submitEvidence(registration.registrationId, {
      evidenceType: item.evidenceType,
      fileUrl: item.uploadedUrl,
      ocrExtractedData: null,
      // Only meaningful for the ID photo -- ward's AI-OCR document check reads this,
      // never inferred from other checkboxes.
      biometricConsent: item.evidenceType === EVIDENCE_TYPE.identityDocument && draft.biometricConsent,
    });
    store().patchEvidence(item.evidenceType, { attached: true });
  }

  return registration;
}
