import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { getApplicationAccessQueryOptions } from '../../query/sharedQueries';
import type { ApplicationAccess } from '../../services/authService/authService.zod';

/**
 * Resolves the caller's application access state for the active session.
 *
 * @remarks
 * Wraps `getApplicationAccess` in a React Query call keyed by the shared
 * `queryKeys.applicationAccess()` factory entry so the auth gate owns a single query
 * instance. The gate consumes the resolved `reason` to decide admission; this hook
 * returns the full React Query result so callers can observe loading and error states.
 *
 * The optional `enabled` flag lets the gate defer the access query until OAuth admission
 * resolves, so `getApplicationAccess` only fires after authorisation rather than on the
 * first render.
 *
 * @param {boolean} enabled Whether the access query should run. Defaults to `true`.
 * @returns {UseQueryResult<ApplicationAccess>} The application access query result.
 */
export function useApplicationAccess(enabled = true): UseQueryResult<ApplicationAccess> {
  return useQuery({ ...getApplicationAccessQueryOptions(), enabled });
}
