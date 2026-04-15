import { afterEach, describe, expect, it, vi } from 'vitest';

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

    it('normalises omitted teacherName fields to null for valid backend payloads', async () => {
        callApiMock.mockResolvedValueOnce([
            {
                classId: 'c1',
                className: 'Class A',
                cohortKey: 'cohort-2025',
                courseLength: 2,
                yearGroupKey: 'year-10',
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
                cohortKey: 'cohort-2025',
                courseLength: 2,
                yearGroupKey: 'year-10',
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

    it('resolves with class partials that use keyed cohort and year-group metadata without label fields', async () => {
        callApiMock.mockResolvedValueOnce([
            {
                classId: 'c2',
                className: 'Class B',
                cohortKey: 'cohort-2026',
                courseLength: 3,
                yearGroupKey: 'year-11',
                classOwner: null,
                teachers: [],
                active: false,
            },
        ]);

        const { getABClassPartials } = await import('./classPartialsService');

        await expect(getABClassPartials()).resolves.toEqual([
            {
                classId: 'c2',
                className: 'Class B',
                cohortKey: 'cohort-2026',
                courseLength: 3,
                yearGroupKey: 'year-11',
                classOwner: null,
                teachers: [],
                active: false,
            },
        ]);
    });

    it('accepts the live persisted partial shape without cohortLabel or yearGroupLabel fields', async () => {
        callApiMock.mockResolvedValueOnce([
            {
                classId: '619359134808',
                className: 'Test Class 2',
                cohortKey: 'b1555f77-1a48-45de-bf7c-c3e93ecf96c8',
                courseLength: 1,
                yearGroupKey: '3e7e1598-721f-4a2a-bcf1-52acba53b440',
                classOwner: {
                    email: 'info@assessmentbot.com',
                    userId: '111627089605158006298',
                    teacherName: 'Hamish Arnold',
                },
                teachers: [],
                active: null,
            },
        ]);

        const { getABClassPartials } = await import('./classPartialsService');

        await expect(getABClassPartials()).resolves.toEqual([
            {
                classId: '619359134808',
                className: 'Test Class 2',
                cohortKey: 'b1555f77-1a48-45de-bf7c-c3e93ecf96c8',
                courseLength: 1,
                yearGroupKey: '3e7e1598-721f-4a2a-bcf1-52acba53b440',
                classOwner: {
                    email: 'info@assessmentbot.com',
                    userId: '111627089605158006298',
                    teacherName: 'Hamish Arnold',
                },
                teachers: [],
                active: null,
            },
        ]);
    });

    it('rejects malformed payloads that still use legacy cohort/yearGroup fields instead of keyed metadata', async () => {
        callApiMock.mockResolvedValueOnce([
            {
                classId: 'c3',
                className: 'Class C',
                cohort: '2025-2026',
                courseLength: 2,
                yearGroup: 10,
                classOwner: null,
                teachers: [],
                active: true,
            },
        ]);

        const { getABClassPartials } = await import('./classPartialsService');

        await expect(getABClassPartials()).rejects.toThrow();
    });
});
