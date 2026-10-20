import { useQuery } from '@tanstack/react-query';

import { referenceApi, vendorRegistrationApi, type ApiRegistration, type Ward } from '@/core/api';
import { useWards } from '@/core/auth/useWards';
import { isLiveApi } from '@/core/config/env';
import { REGISTRATIONS_KEY, useRegistrations } from '../useRegistrations';

/*
 * Read-only views of data another part of the vendor shell has already loaded.
 *
 * Live, these subscribe to the existing React Query entries with `enabled: false`,
 * so they never fetch, refetch on mount, or change when a request is sent: a screen
 * that did not load this data before still sends exactly the same requests. They
 * show what is in the cache (VendorTopBar keeps the registrations list warm; the
 * ward list is cached by step 2 of the wizard) and nothing when it is not there.
 *
 * In mock mode the original hooks already run without any request, so they are
 * used as they are. `isLiveApi` is fixed for the app's lifetime, so picking the
 * hook once at module load keeps the hook order stable.
 */

function useLiveCachedRegistrations(): ApiRegistration[] {
  const query = useQuery({
    queryKey: REGISTRATIONS_KEY,
    queryFn: () => vendorRegistrationApi.list(),
    enabled: false,
  });
  return query.data ?? [];
}

function useMockRegistrationList(): ApiRegistration[] {
  return useRegistrations().registrations;
}

/** The vendor's registrations as already cached; never triggers a request. */
export const useCachedRegistrations = isLiveApi
  ? useLiveCachedRegistrations
  : useMockRegistrationList;

function useLiveCachedWards(): Ward[] {
  const query = useQuery({
    queryKey: ['wards'],
    queryFn: () => referenceApi.listWards(),
    enabled: false,
  });
  return query.data ?? [];
}

function useMockWardList(): Ward[] {
  return useWards().wards;
}

/** The ward list as already cached; never triggers a request. */
export const useCachedWards = isLiveApi ? useLiveCachedWards : useMockWardList;
