import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { getAuthorisationStatus } from '../services/authService';
import type { ClassPartial } from '../services/classPartialsService';
import { getABClassPartials } from '../services/classPartialsService';
import { getCohorts, getYearGroups } from '../services/referenceDataService';
import { queryKeys } from './queryKeys';

/**
 * Returns the shared auth query definition for the current session.
 *
 * @returns {ReturnType<typeof queryOptions>} Shared auth query options.
 */
export function getAuthorisationStatusQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.authorisationStatus(),
    queryFn: getAuthorisationStatus,
  });
}

/**
 * Returns the shared class-partials query definition.
 *
 * @returns {ReturnType<typeof queryOptions>} Shared class-partials query options.
 */
export function getClassPartialsQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.classPartials(),
    queryFn: getABClassPartials,
  });
}

/**
 * Returns the shared cohorts query definition.
 *
 * @returns {ReturnType<typeof queryOptions>} Shared cohorts query options.
 */
export function getCohortsQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.cohorts(),
    queryFn: getCohorts,
  });
}

/**
 * Returns the shared year-groups query definition.
 *
 * @returns {ReturnType<typeof queryOptions>} Shared year-groups query options.
 */
export function getYearGroupsQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.yearGroups(),
    queryFn: getYearGroups,
  });
}

/**
 * Warms the shared class-partials query through the provided query client.
 *
 * @param {QueryClient} queryClient Query client to warm.
 * @returns {Promise<ClassPartial[]>} The warmed class-partials response.
 */
export function warmClassPartials(queryClient: QueryClient): Promise<ClassPartial[]> {
  return queryClient.fetchQuery(getClassPartialsQueryOptions());
}
