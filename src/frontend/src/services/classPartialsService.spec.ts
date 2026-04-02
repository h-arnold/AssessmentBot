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
                cohort: '2025-2026',
                courseLength: 2,
                yearGroup: 10,
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
                cohort: '2025-2026',
                courseLength: 2,
                yearGroup: 10,
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

    it.todo(
        'resolves with class partials that use keyed cohort and year-group metadata plus resolved labels'
    );
    it.todo(
        'rejects malformed payloads that still use legacy cohort/yearGroup fields instead of keyed metadata'
    );
});
