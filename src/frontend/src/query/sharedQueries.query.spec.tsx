import type { QueryClient } from '@tanstack/react-query';
import { ZodError } from 'zod';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAppQueryClient } from './queryClient';
import { queryKeys } from './queryKeys';

const getAuthorisationStatusMock = vi.fn();
const getABClassPartialsMock = vi.fn();
const getCohortsMock = vi.fn();
const getYearGroupsMock = vi.fn();

vi.mock('../services/authService', () => ({
  getAuthorisationStatus: getAuthorisationStatusMock,
}));

vi.mock('../services/classPartialsService', () => ({
  getABClassPartials: getABClassPartialsMock,
}));

vi.mock('../services/referenceDataService', () => ({
  getCohorts: getCohortsMock,
  getYearGroups: getYearGroupsMock,
}));

describe('shared query definitions', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('delegates the shared auth query to the existing auth service loader', async () => {
    getAuthorisationStatusMock.mockResolvedValueOnce(true);

    const { getAuthorisationStatusQueryOptions } = await import('./sharedQueries');

    await expect(getAuthorisationStatusQueryOptions().queryFn()).resolves.toBe(true);
    expect(getAuthorisationStatusMock).toHaveBeenCalledTimes(1);
  });

  it('delegates the shared class-partials query to the class-partials service loader', async () => {
    const classPartials = [{ classId: 'class-1' }];
    getABClassPartialsMock.mockResolvedValueOnce(classPartials);

    const { getClassPartialsQueryOptions } = await import('./sharedQueries');

    await expect(getClassPartialsQueryOptions().queryFn()).resolves.toEqual(classPartials);
    expect(getABClassPartialsMock).toHaveBeenCalledTimes(1);
  });

  it('delegates the shared cohorts and year-groups queries to reference-data services', async () => {
    const cohorts = [{ name: '2025', active: true }];
    const yearGroups = [{ name: '10' }];
    getCohortsMock.mockResolvedValueOnce(cohorts);
    getYearGroupsMock.mockResolvedValueOnce(yearGroups);

    const { getCohortsQueryOptions, getYearGroupsQueryOptions } = await import('./sharedQueries');

    await expect(getCohortsQueryOptions().queryFn()).resolves.toEqual(cohorts);
    await expect(getYearGroupsQueryOptions().queryFn()).resolves.toEqual(yearGroups);
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

    await expect(getClassPartialsQueryOptions().queryFn()).rejects.toBe(queryError);
  });

  it('warms class partials through the shared query key contract', async () => {
    const fetchQueryMock = vi.fn().mockResolvedValueOnce([]);
    const queryClient = {
      fetchQuery: fetchQueryMock,
    } as unknown as QueryClient;

    const { warmClassPartials } = await import('./sharedQueries');

    await warmClassPartials(queryClient);

    expect(fetchQueryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.classPartials(),
      })
    );
  });

  it('propagates startup warm-up failures to the caller', async () => {
    const warmupError = new Error('Warm-up failed.');
    const fetchQueryMock = vi.fn().mockRejectedValueOnce(warmupError);
    const queryClient = {
      fetchQuery: fetchQueryMock,
    } as unknown as QueryClient;

    const { warmClassPartials } = await import('./sharedQueries');

    await expect(warmClassPartials(queryClient)).rejects.toBe(warmupError);
  });

  it('reuses React Query in-flight deduplication for repeated startup warm-up calls', async () => {
    const classPartials = [{ classId: 'class-1' }];
    let resolveClassPartials: ((value: typeof classPartials) => void) | undefined;

    getABClassPartialsMock.mockImplementation(
      () =>
        new Promise<typeof classPartials>((resolve) => {
          resolveClassPartials = resolve;
        })
    );

    const { warmClassPartials } = await import('./sharedQueries');
    const queryClient = createAppQueryClient();

    const firstWarmup = warmClassPartials(queryClient);
    const secondWarmup = warmClassPartials(queryClient);

    expect(getABClassPartialsMock).toHaveBeenCalledTimes(1);

    resolveClassPartials?.(classPartials);

    await expect(firstWarmup).resolves.toEqual(classPartials);
    await expect(secondWarmup).resolves.toEqual(classPartials);
    expect(getABClassPartialsMock).toHaveBeenCalledTimes(1);
  });
});
