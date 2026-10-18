import { useQuery } from '@tanstack/react-query';

import { apiGet } from '@/core/api';

// AIC-03. Mirrors StreetBiz-BE Features/RegistrationIntegrity/RegistrationIntegrity.cs.

export type IntegritySeverity = 'LOW' | 'MEDIUM' | 'HIGH';

export type IntegrityFlagCode =
  | 'ID_SHARED_ACROSS_VENDORS'
  | 'ADDRESS_SHARED_ACROSS_VENDORS'
  | 'REGISTRATION_BURST'
  | 'MANY_OPEN_APPLICATIONS'
  | 'SLOT_CONTESTED_BY_SAME_ID';

/** A registration a finding points at. Outside the officer's ward only ward and status are given. */
export type RelatedRegistration = {
  registrationId: number | null;
  businessName: string | null;
  wardName: string;
  status: string;
  note: string | null;
};

export type IntegrityFlag = {
  code: IntegrityFlagCode;
  severity: IntegritySeverity;
  title: string;
  detail: string;
  related: RelatedRegistration[];
};

export type RegistrationIntegrity = {
  registrationId: number;
  level: 'NONE' | IntegritySeverity;
  hasIdNumber: boolean;
  flags: IntegrityFlag[];
  basis: string;
};

export const wardIntegrityApi = {
  registration: (registrationId: string | number) =>
    apiGet<RegistrationIntegrity>(`/ward/integrity/registrations/${registrationId}`),
};

export const WARD_INTEGRITY_KEYS = {
  registration: (registrationId: string | number) =>
    ['ward', 'integrity', 'registration', String(registrationId)] as const,
};

/** AIC-03 for one registration. Never blocks the review: a failure just hides the panel. */
export function useRegistrationIntegrity(registrationId: string | number | undefined) {
  return useQuery({
    queryKey: WARD_INTEGRITY_KEYS.registration(registrationId ?? ''),
    queryFn: () => wardIntegrityApi.registration(registrationId as string | number),
    enabled: registrationId !== undefined && registrationId !== '',
    staleTime: 60_000,
  });
}
