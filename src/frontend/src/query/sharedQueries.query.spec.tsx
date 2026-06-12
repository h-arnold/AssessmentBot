import { ZodError } from 'zod';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAppQueryClient } from './queryClient';
import { queryKeys } from './queryKeys';
import {
  createDeferredPromise,
  configureDeferredWarmupDatasets,
} from '../test/shared/testDeferredPromise';
import {
  assertWarmupMocksCalledOnce,
  resolveAllWarmupDeferreds,
  standardWarmupResult,
} from '../test/shared/sharedQueriesTestHelpers';

const getAuthorisationStatusMock = vi.fn();
const getABClassPartialsMock = vi.fn();
const getAssignmentDefinitionPartialsMock = vi.fn();
const getCohortsMock = vi.fn();
const getGoogleClassroomsMock = vi.fn();
const getAssignmentTopicsMock = vi.fn();
const getYearGroupsMock = vi.fn();

vi.mock('../services/authService/authService', () => ({
  getAuthorisationStatus: getAuthorisationStatusMock,
}));

vi.mock('../services/googleClassrooms/classPartialsService', () => ({
  getABClassPartials: getABClassPartialsMock,
}));

vi.mock('../services/assignmentDefinition/assignmentDefinitionPartialsService', () => ({
  getAssignmentDefinitionPartials: getAssignmentDefinitionPartialsMock,
}));

vi.mock('../services/googleClassrooms/googleClassroomsService', () => ({
  getGoogleClassrooms: getGoogleClassroomsMock,
}));

vi.mock('../services/assignmentDefinition/assignmentTopicsService', () => ({
  getAssignmentTopics: getAssignmentTopicsMock,
}));

vi.mock('../services/referenceData/referenceDataService', () => ({
  getCohorts: getCohortsMock,
  getYearGroups: getYearGroupsMock,
}));

// The configureDeferredWarmupDatasets function is imported from the shared module

describe('shared query definitions', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('delegates the shared auth query to the existing auth service loader', async () => {
    getAuthorisationStatusMock.mockResolvedValueOnce(true);

    const { getAuthorisationStatusQueryOptions } = await import('./sharedQueries');
    const queryClient = createAppQueryClient();

    await expect(queryClient.fetchQuery(getAuthorisationStatusQueryOptions())).resolves.toBe(true);
    expect(getAuthorisationStatusMock).toHaveBeenCalledTimes(1);
  });

  it('delegates the shared assignment-definition partials query to its service loader', async () => {
    const assignmentDefinitionPartials = [{ definitionKey: 'algebra-baseline' }];
    getAssignmentDefinitionPartialsMock.mockResolvedValueOnce(assignmentDefinitionPartials);

    const { getAssignmentDefinitionPartialsQueryOptions } = await import('./sharedQueries');
    const queryClient = createAppQueryClient();
    const queryOptions = getAssignmentDefinitionPartialsQueryOptions();

    expect(queryOptions.queryKey).toEqual(queryKeys.assignmentDefinitionPartials());
    await expect(queryClient.fetchQuery(queryOptions)).resolves.toEqual(assignmentDefinitionPartials);
    expect(getAssignmentDefinitionPartialsMock).toHaveBeenCalledTimes(1);
  });

  it('delegates the shared class-partials, cohorts, and year-groups queries to their service loaders', async () => {
    const classPartials = [{ classId: 'class-1' }];
    const cohorts = [{ key: 'cohort-2026', name: 'Cohort 2026', active: true }];
    const yearGroups = [{ key: 'year-10', name: 'Year 10' }];
    getABClassPartialsMock.mockResolvedValueOnce(classPartials);
    getCohortsMock.mockResolvedValueOnce(cohorts);
    getYearGroupsMock.mockResolvedValueOnce(yearGroups);

    const {
      getClassPartialsQueryOptions,
      getCohortsQueryOptions,
      getYearGroupsQueryOptions,
    } = await import('./sharedQueries');
    const queryClient = createAppQueryClient();

    await expect(queryClient.fetchQuery(getClassPartialsQueryOptions())).resolves.toEqual(classPartials);
    await expect(queryClient.fetchQuery(getCohortsQueryOptions())).resolves.toEqual(cohorts);
    await expect(queryClient.fetchQuery(getYearGroupsQueryOptions())).resolves.toEqual(yearGroups);
    expect(getABClassPartialsMock).toHaveBeenCalledTimes(1);
    expect(getCohortsMock).toHaveBeenCalledTimes(1);
    expect(getYearGroupsMock).toHaveBeenCalledTimes(1);
  });

  it('propagates shared query failures without interception', async () => {
    const queryError = new ZodError([
      {
        code: 'custom',
        message: 'Malformed class partial payload.',
        path: ['0', 'classId'],
      },
    ]);
    getABClassPartialsMock.mockRejectedValueOnce(queryError);

    const { getClassPartialsQueryOptions } = await import('./sharedQueries');
    const queryClient = createAppQueryClient();

    await expect(queryClient.fetchQuery(getClassPartialsQueryOptions())).rejects.toBe(queryError);
  });

  it('adds a shared Google Classrooms query definition keyed through queryKeys.googleClassrooms()', async () => {
    const classrooms = [{ classId: 'course-001', className: '10A Computer Science' }];
    getGoogleClassroomsMock.mockResolvedValueOnce(classrooms);

    const { getGoogleClassroomsQueryOptions } = await import('./sharedQueries');
    const queryClient = createAppQueryClient();
    const queryOptions = getGoogleClassroomsQueryOptions();

    expect(queryOptions.queryKey).toEqual(queryKeys.googleClassrooms());
    await expect(queryClient.fetchQuery(queryOptions)).resolves.toEqual(classrooms);
    expect(getGoogleClassroomsMock).toHaveBeenCalledTimes(1);
  });

  it('warms classPartials, assignmentDefinitionPartials, assignmentTopics, cohorts, and yearGroups in parallel through shared query options only', async () => {
    const {
      classPartialsDeferred,
      assignmentDefinitionPartialsDeferred,
      cohortsDeferred,
      assignmentTopicsDeferred,
      yearGroupsDeferred,
    } = configureDeferredWarmupDatasets({
      getABClassPartialsMock,
      getAssignmentDefinitionPartialsMock,
      getCohortsMock,
      getAssignmentTopicsMock,
      getYearGroupsMock,
    });

    const { warmStartupQueries } = await import('./sharedQueries');
    const queryClient = createAppQueryClient();
    const warmupPromise = warmStartupQueries(queryClient);

    assertWarmupMocksCalledOnce({
      getABClassPartialsMock,
      getAssignmentDefinitionPartialsMock,
      getCohortsMock,
      getAssignmentTopicsMock,
      getYearGroupsMock,
    });

    resolveAllWarmupDeferreds({
      classPartialsDeferred,
      assignmentDefinitionPartialsDeferred,
      cohortsDeferred,
      assignmentTopicsDeferred,
      yearGroupsDeferred,
    });

    await expect(warmupPromise).resolves.toEqual(standardWarmupResult);
  });

  it('propagates assignment-definition startup warm-up failures only after all startup datasets settle', async () => {
    const warmupError = new Error('Assignment definition warm-up failed');
    const classPartialsDeferred = createDeferredPromise<Array<{ classId: string }>>();
    const cohortsDeferred = createDeferredPromise<
      Array<{ key: string; name: string; active: boolean }>
    >();
    const assignmentTopicsDeferred = createDeferredPromise<
      Array<{ key: string; name: string; yearGroupKeys: string[] }>
    >();
    const yearGroupsDeferred = createDeferredPromise<Array<{ key: string; name: string }>>();
    let hasSettled = false;
    getABClassPartialsMock.mockImplementationOnce(() => classPartialsDeferred.promise);
    getAssignmentDefinitionPartialsMock.mockRejectedValueOnce(warmupError);
    getCohortsMock.mockImplementationOnce(() => cohortsDeferred.promise);
    getAssignmentTopicsMock.mockImplementationOnce(() => assignmentTopicsDeferred.promise);
    getYearGroupsMock.mockImplementationOnce(() => yearGroupsDeferred.promise);

    const { warmStartupQueries } = await import('./sharedQueries');
    const queryClient = createAppQueryClient();
    const warmupPromise = warmStartupQueries(queryClient).finally(() => {
      hasSettled = true;
    });

    await Promise.resolve();
    expect(hasSettled).toBe(false);

    classPartialsDeferred.resolvePromise([{ classId: 'class-1' }]);
    cohortsDeferred.resolvePromise([{ key: 'cohort-2026', name: 'Cohort 2026', active: true }]);
    assignmentTopicsDeferred.resolvePromise([{ key: 'topic-algebra', name: 'Algebra', yearGroupKeys: [] }]);
    yearGroupsDeferred.resolvePromise([{ key: 'year-10', name: 'Year 10' }]);

    await expect(warmupPromise).rejects.toBe(warmupError);
    expect(hasSettled).toBe(true);
  });

  it('reuses React Query in-flight deduplication for repeated startup warm-up calls including assignmentDefinitionPartials and assignmentTopics', async () => {
    const {
      classPartialsDeferred,
      assignmentDefinitionPartialsDeferred,
      cohortsDeferred,
      assignmentTopicsDeferred,
      yearGroupsDeferred,
    } = configureDeferredWarmupDatasets({
      getABClassPartialsMock,
      getAssignmentDefinitionPartialsMock,
      getCohortsMock,
      getAssignmentTopicsMock,
      getYearGroupsMock,
    });

    const { warmStartupQueries } = await import('./sharedQueries');
    const queryClient = createAppQueryClient();
    const firstWarmupPromise = warmStartupQueries(queryClient);
    const secondWarmupPromise = warmStartupQueries(queryClient);

    expect(firstWarmupPromise).toBe(secondWarmupPromise);
    assertWarmupMocksCalledOnce({
      getABClassPartialsMock,
      getAssignmentDefinitionPartialsMock,
      getCohortsMock,
      getAssignmentTopicsMock,
      getYearGroupsMock,
    });

    resolveAllWarmupDeferreds({
      classPartialsDeferred,
      assignmentDefinitionPartialsDeferred,
      cohortsDeferred,
      assignmentTopicsDeferred,
      yearGroupsDeferred,
    });

    await expect(firstWarmupPromise).resolves.toEqual(standardWarmupResult);
  });
});
