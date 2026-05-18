/**
 * Shared test helpers for sharedQueries.query.spec.tsx
 *
 * Extracts common patterns for testing warmStartupQueries to reduce duplication.
 */

import type { AssignmentStartupDeferreds } from './testDeferredPromise';

/**
 * Standard test data for class partials dataset.
 */
export const standardClassPartialsData = [{ classId: 'class-1' }];

/**
 * Standard test data for assignment definition partials dataset.
 */
export const standardAssignmentDefinitionPartialsData = [{ definitionKey: 'algebra-baseline' }];

/**
 * Standard test data for cohorts dataset.
 */
export const standardCohortsData = [{ key: 'cohort-2026', name: 'Cohort 2026', active: true }];

/**
 * Standard test data for assignment topics dataset.
 */
export const standardAssignmentTopicsData = [
  { key: 'topic-algebra', name: 'Algebra', yearGroupKeys: [] },
];

/**
 * Standard test data for year groups dataset.
 */
export const standardYearGroupsData = [{ key: 'year-10', name: 'Year 10' }];

/**
 * Standard expected warmup result combining all standard datasets.
 */
export const standardWarmupResult = {
  classPartials: standardClassPartialsData,
  assignmentDefinitionPartials: standardAssignmentDefinitionPartialsData,
  assignmentTopics: standardAssignmentTopicsData,
  cohorts: standardCohortsData,
  yearGroups: standardYearGroupsData,
};

/**
 * Asserts that all warmup mocks have been called exactly once using the direct mock references.
 *
 * @param {object} mocks - The mock functions to check.
 * @param {ReturnType<typeof vi.fn>} mocks.getABClassPartialsMock - Mock for getABClassPartials service.
 * @param {ReturnType<typeof vi.fn>} mocks.getAssignmentDefinitionPartialsMock - Mock for getAssignmentDefinitionPartials service.
 * @param {ReturnType<typeof vi.fn>} mocks.getCohortsMock - Mock for getCohorts service.
 * @param {ReturnType<typeof vi.fn>} mocks.getAssignmentTopicsMock - Mock for getAssignmentTopics service.
 * @param {ReturnType<typeof vi.fn>} mocks.getYearGroupsMock - Mock for getYearGroups service.
 */
export function assertWarmupMocksCalledOnce({
  getABClassPartialsMock,
  getAssignmentDefinitionPartialsMock,
  getCohortsMock,
  getAssignmentTopicsMock,
  getYearGroupsMock,
}: {
  getABClassPartialsMock: ReturnType<typeof vi.fn>;
  getAssignmentDefinitionPartialsMock: ReturnType<typeof vi.fn>;
  getCohortsMock: ReturnType<typeof vi.fn>;
  getAssignmentTopicsMock: ReturnType<typeof vi.fn>;
  getYearGroupsMock: ReturnType<typeof vi.fn>;
}): void {
  expect(getABClassPartialsMock).toHaveBeenCalledTimes(1);
  expect(getAssignmentDefinitionPartialsMock).toHaveBeenCalledTimes(1);
  expect(getCohortsMock).toHaveBeenCalledTimes(1);
  expect(getAssignmentTopicsMock).toHaveBeenCalledTimes(1);
  expect(getYearGroupsMock).toHaveBeenCalledTimes(1);
}

/**
 * Resolves all deferred promises with standard test data.
 *
 * @param {AssignmentStartupDeferreds} deferreds - The deferred promises to resolve.
 */
export function resolveAllWarmupDeferreds(deferreds: AssignmentStartupDeferreds): void {
  deferreds.classPartialsDeferred.resolvePromise(standardClassPartialsData);
  deferreds.assignmentDefinitionPartialsDeferred.resolvePromise(
    standardAssignmentDefinitionPartialsData
  );
  deferreds.cohortsDeferred.resolvePromise(standardCohortsData);
  deferreds.assignmentTopicsDeferred.resolvePromise(standardAssignmentTopicsData);
  deferreds.yearGroupsDeferred.resolvePromise(standardYearGroupsData);
}
