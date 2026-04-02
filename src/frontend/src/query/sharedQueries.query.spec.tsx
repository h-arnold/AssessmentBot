import type { QueryClient } from '@tanstack/react-query';
import { ZodError } from 'zod';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAppQueryClient } from './queryClient';
import { queryKeys } from './queryKeys';

const getAuthorisationStatusMock = vi.fn();
const getABClassPartialsMock = vi.fn();
const getCohortsMock = vi.fn();
const getYearGroupsMock = vi.fn();
const getGoogleClassroomsMock = vi.fn();

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

vi.mock('../services/googleClassroomsService', () => ({
    getGoogleClassrooms: getGoogleClassroomsMock,
}));

/**
 * Creates a deferred promise for controlled warm-up assertions.
 *
 * @returns {{ promise: Promise<T>; resolve(value: T): void }} Deferred promise controls.
 */
function createDeferredPromise<T>() {
    let resolvePromise: ((value: T | PromiseLike<T>) => void) | undefined;

    const promise = new Promise<T>((resolve) => {
        resolvePromise = resolve;
    });

    return {
        promise,
        resolve(value: T) {
            resolvePromise?.(value);
        },
    };
}

describe('shared query definitions', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('delegates the shared auth query to the existing auth service loader', async () => {
        getAuthorisationStatusMock.mockResolvedValueOnce(true);

        const { getAuthorisationStatusQueryOptions } = await import('./sharedQueries');
        const queryClient = createAppQueryClient();

        await expect(queryClient.fetchQuery(getAuthorisationStatusQueryOptions())).resolves.toBe(true);
        expect(getAuthorisationStatusMock).toHaveBeenCalledTimes(1);
    });

    it('delegates the shared class-partials, cohorts, and year-groups queries to their service loaders', async () => {
        const classPartials = [{ classId: 'class-1' }];
        const cohorts = [{ key: 'coh-2026', name: 'Cohort 2026', active: true, startYear: 2025, startMonth: 9 }];
        const yearGroups = [{ key: 'yg-10', name: 'Year 10' }];
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

    it('adds a shared Google Classrooms query definition keyed through queryKeys.googleClassrooms()', async () => {
        const googleClassrooms = [{ classId: 'course-001', className: '10A Computer Science' }];
        getGoogleClassroomsMock.mockResolvedValueOnce(googleClassrooms);

        const { getGoogleClassroomsQueryOptions } = await import('./sharedQueries');
        const queryClient = createAppQueryClient();

        expect(queryKeys.googleClassrooms()).toEqual(['googleClassrooms']);
        await expect(queryClient.fetchQuery(getGoogleClassroomsQueryOptions())).resolves.toEqual(
            googleClassrooms
        );
        expect(getGoogleClassroomsMock).toHaveBeenCalledTimes(1);
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

    it('warms classPartials, cohorts, and yearGroups in parallel through shared query options only', async () => {
        const classPartials = createDeferredPromise<readonly unknown[]>();
        const cohorts = createDeferredPromise<readonly unknown[]>();
        const yearGroups = createDeferredPromise<readonly unknown[]>();
        const queryClient = {
            fetchQuery: vi.fn((options: { queryKey: readonly string[] }) => {
                switch (options.queryKey[0]) {
                    case queryKeys.classPartials()[0]: {
                        return classPartials.promise;
                    }
                    case queryKeys.cohorts()[0]: {
                        return cohorts.promise;
                    }
                    case queryKeys.yearGroups()[0]: {
                        return yearGroups.promise;
                    }
                    default:
                        throw new Error(`Unexpected warm-up query: ${options.queryKey.join('.')}`);
                }
            }),
        } as unknown as QueryClient;

        const {
            getClassPartialsQueryOptions,
            getCohortsQueryOptions,
            getYearGroupsQueryOptions,
            warmStartupQueries,
        } = await import('./sharedQueries');
        const fetchQueryMock = vi.mocked(queryClient.fetchQuery);

        const warmupPromise = warmStartupQueries(queryClient);
        let settled = false;
        const trackedWarmupPromise = warmupPromise.then(() => {
            settled = true;
        });

        expect(fetchQueryMock).toHaveBeenCalledTimes(3);
        expect(fetchQueryMock).toHaveBeenCalledWith(
            expect.objectContaining(getClassPartialsQueryOptions())
        );
        expect(fetchQueryMock).toHaveBeenCalledWith(
            expect.objectContaining(getCohortsQueryOptions())
        );
        expect(fetchQueryMock).toHaveBeenCalledWith(
            expect.objectContaining(getYearGroupsQueryOptions())
        );
        expect(fetchQueryMock).not.toHaveBeenCalledWith(
            expect.objectContaining({ queryKey: ['googleClassrooms'] })
        );

        classPartials.resolve([]);
        cohorts.resolve([]);

        await Promise.resolve();
        expect(settled).toBe(false);

        yearGroups.resolve([]);

        await warmupPromise;
        await trackedWarmupPromise;
        expect(settled).toBe(true);
    });

    it('propagates startup warm-up failures to the caller', async () => {
        const warmupError = new Error('Warm-up failed.');
        const fetchQueryMock = vi
            .fn()
            .mockResolvedValueOnce([])
            .mockRejectedValueOnce(warmupError)
            .mockResolvedValueOnce([]);
        const queryClient = {
            fetchQuery: fetchQueryMock,
        } as unknown as QueryClient;

        const { warmStartupQueries } = await import('./sharedQueries');

        await expect(warmStartupQueries(queryClient)).rejects.toBe(warmupError);
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
        getCohortsMock.mockResolvedValue([{ key: 'coh-2026', name: 'Cohort 2026', active: true, startYear: 2025, startMonth: 9 }]);
        getYearGroupsMock.mockResolvedValue([{ key: 'yg-10', name: 'Year 10' }]);

        const { warmStartupQueries } = await import('./sharedQueries');
        const queryClient = createAppQueryClient();

        const firstWarmup = warmStartupQueries(queryClient);
        const secondWarmup = warmStartupQueries(queryClient);

        expect(getABClassPartialsMock).toHaveBeenCalledTimes(1);
        expect(getCohortsMock).toHaveBeenCalledTimes(1);
        expect(getYearGroupsMock).toHaveBeenCalledTimes(1);

        resolveClassPartials?.(classPartials);

        await expect(firstWarmup).resolves.toBeUndefined();
        await expect(secondWarmup).resolves.toBeUndefined();
        expect(getABClassPartialsMock).toHaveBeenCalledTimes(1);
        expect(getCohortsMock).toHaveBeenCalledTimes(1);
        expect(getYearGroupsMock).toHaveBeenCalledTimes(1);
    });
});
