import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { getAuthorisationStatus } from '../services/authService';
import type { ClassPartial } from '../services/classPartialsService';
import { getABClassPartials } from '../services/classPartialsService';
import { getCohorts, getYearGroups } from '../services/referenceDataService';
import { queryKeys } from './queryKeys';

/**
 * Returns the shared auth query definition for the current session.
 */
export function getAuthorisationStatusQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.authorisationStatus(),
    queryFn: getAuthorisationStatus,
  });
}

/**
 * Returns the shared class-partials query definition.
 */
export function getClassPartialsQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.classPartials(),
    queryFn: getABClassPartials,
  });
}

/**
 * Returns the shared cohorts query definition.
 */
export function getCohortsQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.cohorts(),
    queryFn: getCohorts,
  });
}

/**
 * Returns the shared year-groups query definition.
 */
export function getYearGroupsQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.yearGroups(),
    queryFn: getYearGroups,
  });
}

/**
 * Warms the shared class-partials query through the provided query client.
 */
export function warmClassPartials(queryClient: QueryClient): Promise<ClassPartial[]> {
  return queryClient.fetchQuery(getClassPartialsQueryOptions());
}
