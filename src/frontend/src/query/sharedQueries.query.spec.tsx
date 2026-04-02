import { ZodError } from 'zod';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAppQueryClient } from './queryClient';

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
        const queryClient = createAppQueryClient();

        await expect(queryClient.fetchQuery(getAuthorisationStatusQueryOptions())).resolves.toBe(true);
        expect(getAuthorisationStatusMock).toHaveBeenCalledTimes(1);
    });

    it('delegates the shared class-partials, cohorts, and year-groups queries to their service loaders', async () => {
        const classPartials = [{ classId: 'class-1' }];
        const cohorts = [{ name: 'Cohort 2026', active: true }];
        const yearGroups = [{ name: 'Year 10' }];
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

    it('warms the shared class-partials query through the provided query client', async () => {
        const classPartials = [{ classId: 'class-1' }];
        getABClassPartialsMock.mockResolvedValueOnce(classPartials);

        const { warmClassPartials } = await import('./sharedQueries');
        const queryClient = createAppQueryClient();

        await expect(warmClassPartials(queryClient)).resolves.toEqual(classPartials);
        expect(getABClassPartialsMock).toHaveBeenCalledTimes(1);
    });

    it.todo('adds a shared Google Classrooms query definition keyed through queryKeys.googleClassrooms()');
    it.todo('warms classPartials, cohorts, and yearGroups in parallel through shared query options only');
    it.todo('propagates startup warm-up failures to the caller');
    it.todo('reuses React Query in-flight deduplication for repeated startup warm-up calls');
});
