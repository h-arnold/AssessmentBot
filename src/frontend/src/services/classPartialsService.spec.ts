import { afterEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

const callApiMock = vi.fn();

vi.mock('./apiService', () => ({
    callApi: callApiMock,
}));

describe('classPartialsService.getABClassPartials', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('delegates to callApi with the getABClassPartials method name', async () => {
        callApiMock.mockResolvedValueOnce([]);

        const { getABClassPartials } = await import('./classPartialsService');

        await getABClassPartials();

        expect(callApiMock).toHaveBeenCalledWith('getABClassPartials');
        expect(callApiMock).toHaveBeenCalledTimes(1);
    });

    it('resolves with class partials that use keyed cohort and year-group metadata plus resolved labels', async () => {
        const partials = [
            {
                classId: 'c1',
                className: 'Class A',
                cohortKey: 'coh-2026',
                cohortLabel: '2025-2026',
                courseLength: 2,
                yearGroupKey: 'yg-10',
                yearGroupLabel: 'Year 10',
                classOwner: {
                    userId: 'owner-1',
                    email: 'owner-1@example.com',
                    teacherName: 'Ms Owner',
                },
                teachers: [
                    {
                        userId: 'teacher-1',
                        email: 'teacher-1@example.com',
                        teacherName: 'Ms Teacher',
                    },
                ],
                active: true,
            },
            {
                classId: 'c2',
                className: 'Class B',
                cohortKey: null,
                cohortLabel: null,
                courseLength: 1,
                yearGroupKey: null,
                yearGroupLabel: null,
                classOwner: null,
                teachers: [],
                active: false,
            },
        ];
        callApiMock.mockResolvedValueOnce(partials);

        const { getABClassPartials } = await import('./classPartialsService');

        const result = await getABClassPartials();

        expect(result).toEqual(partials);
        expect(result[0]).not.toHaveProperty('cohort');
        expect(result[0]).not.toHaveProperty('yearGroup');
    });

    it('normalises omitted teacherName fields to null for valid keyed backend payloads', async () => {
        callApiMock.mockResolvedValueOnce([
            {
                classId: 'c1',
                className: 'Class A',
                cohortKey: 'coh-2026',
                cohortLabel: '2025-2026',
                courseLength: 2,
                yearGroupKey: 'yg-10',
                yearGroupLabel: 'Year 10',
                classOwner: {
                    userId: 'owner-1',
                    email: 'owner-1@example.com',
                },
                teachers: [
                    {
                        userId: 'teacher-1',
                        email: 'teacher-1@example.com',
                    },
                ],
                active: true,
            },
        ]);

        const { getABClassPartials } = await import('./classPartialsService');

        await expect(getABClassPartials()).resolves.toEqual([
            {
                classId: 'c1',
                className: 'Class A',
                cohortKey: 'coh-2026',
                cohortLabel: '2025-2026',
                courseLength: 2,
                yearGroupKey: 'yg-10',
                yearGroupLabel: 'Year 10',
                classOwner: {
                    userId: 'owner-1',
                    email: 'owner-1@example.com',
                    teacherName: null,
                },
                teachers: [
                    {
                        userId: 'teacher-1',
                        email: 'teacher-1@example.com',
                        teacherName: null,
                    },
                ],
                active: true,
            },
        ]);
    });

    it('propagates rejection when callApi rejects', async () => {
        const apiError = new Error('Transport failure');
        callApiMock.mockRejectedValueOnce(apiError);

        const { getABClassPartials } = await import('./classPartialsService');

        await expect(getABClassPartials()).rejects.toThrow('Transport failure');
    });

    it('rejects malformed payloads that still use legacy cohort/yearGroup fields instead of keyed metadata', async () => {
        callApiMock.mockResolvedValueOnce([
            {
                classId: 'c1',
                className: 'Class A',
                cohort: '2025-2026',
                courseLength: 2,
                yearGroup: 10,
                classOwner: null,
                teachers: [],
                active: true,
            },
        ]);

        const { getABClassPartials } = await import('./classPartialsService');

        await expect(getABClassPartials()).rejects.toBeInstanceOf(ZodError);
    });
});
