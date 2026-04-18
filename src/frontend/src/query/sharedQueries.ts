import { queryOptions, type QueryClient } from '@tanstack/react-query';
import { getAuthorisationStatus } from '../services/authService';
import { getBackendConfig } from '../services/backendConfigurationService';
import {
  getAssignmentDefinitionPartials,
  type AssignmentDefinitionPartialsResponse,
} from '../services/assignmentDefinitionPartialsService';
import type { ClassPartial } from '../services/classPartialsService';
import { getABClassPartials } from '../services/classPartialsService';
import { getGoogleClassrooms } from '../services/googleClassroomsService';
import { getCohorts, getYearGroups } from '../services/referenceDataService';
import type {
  CohortListResponse,
  YearGroupListResponse,
} from '../services/referenceData.zod';
import { queryKeys } from './queryKeys';

const startupWarmupPromises = new WeakMap<QueryClient, Promise<StartupWarmupQueriesResult>>();

export type StartupWarmupQueriesResult = Readonly<{
  classPartials: ClassPartial[];
  assignmentDefinitionPartials: AssignmentDefinitionPartialsResponse;
  cohorts: CohortListResponse;
  yearGroups: YearGroupListResponse;
}>;

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
 * Returns the shared assignment-definition partials query definition.
 *
 * @returns {ReturnType<typeof queryOptions>} Shared assignment-definition partials query options.
 */
export function getAssignmentDefinitionPartialsQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.assignmentDefinitionPartials(),
    queryFn: getAssignmentDefinitionPartials,
  });
}

/**
 * Returns the shared backend-configuration query definition.
 *
 * @returns {ReturnType<typeof queryOptions>} Shared backend-configuration query options.
 */
export function getBackendConfigQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.backendConfig(),
    queryFn: getBackendConfig,
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
 * Returns the shared Google Classrooms query definition.
 *
 * @returns {ReturnType<typeof queryOptions>} Shared Google Classrooms query options.
 */
export function getGoogleClassroomsQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.googleClassrooms(),
    queryFn: getGoogleClassrooms,
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
 * Warms the shared startup datasets in parallel through the provided query client.
 *
 * Repeated calls reuse the same in-flight warm-up promise for a given query client.
 * Once the cycle settles, future callers can start a new cycle, but failed cycles are not
 * retried automatically by the shared app-level orchestration.
 *
 * @param {QueryClient} queryClient Query client to warm.
 * @returns {Promise<StartupWarmupQueriesResult>} Promise resolving when startup datasets are warm.
 */
export function warmStartupQueries(
  queryClient: QueryClient
): Promise<StartupWarmupQueriesResult> {
  const existingWarmupPromise = startupWarmupPromises.get(queryClient);

  if (existingWarmupPromise) {
    return existingWarmupPromise;
  }

  const warmupPromise = Promise.allSettled([
    queryClient.fetchQuery(getClassPartialsQueryOptions()),
    queryClient.fetchQuery(getAssignmentDefinitionPartialsQueryOptions()),
    queryClient.fetchQuery(getCohortsQueryOptions()),
    queryClient.fetchQuery(getYearGroupsQueryOptions()),
  ])
    .then((results) => {
      const rejectedResult = results.find((result) => result.status === 'rejected');

      if (rejectedResult) {
        throw rejectedResult.reason;
      }

      const fulfilledResults = results as [
        PromiseFulfilledResult<ClassPartial[]>,
        PromiseFulfilledResult<AssignmentDefinitionPartialsResponse>,
        PromiseFulfilledResult<CohortListResponse>,
        PromiseFulfilledResult<YearGroupListResponse>,
      ];
      const [classPartials, assignmentDefinitionPartials, cohorts, yearGroups] = fulfilledResults;

      return {
        classPartials: classPartials.value,
        assignmentDefinitionPartials: assignmentDefinitionPartials.value,
        cohorts: cohorts.value,
        yearGroups: yearGroups.value,
      };
    })
    .finally(() => {
      startupWarmupPromises.delete(queryClient);
    });

  startupWarmupPromises.set(queryClient, warmupPromise);

  return warmupPromise;
}
