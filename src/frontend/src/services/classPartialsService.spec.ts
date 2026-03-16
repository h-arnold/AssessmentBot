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

    it('resolves with the array of class partials returned by the backend', async () => {
        const partials = [
            {
                classId: 'c1',
                className: 'Class A',
                cohort: '2025',
                courseLength: 2,
                yearGroup: 10,
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
                cohort: '2024',
                courseLength: 1,
                yearGroup: 9,
                classOwner: null,
                teachers: [],
                active: false,
            },
        ];
        callApiMock.mockResolvedValueOnce(partials);

        const { getABClassPartials } = await import('./classPartialsService');

        const result = await getABClassPartials();

        expect(result).toEqual(partials);
    });

    it('propagates rejection when callApi rejects', async () => {
        const apiError = new Error('Transport failure');
        callApiMock.mockRejectedValueOnce(apiError);

        const { getABClassPartials } = await import('./classPartialsService');

        await expect(getABClassPartials()).rejects.toThrow('Transport failure');
    });

    it('rejects malformed payloads with incorrect field types through the dedicated schema', async () => {
        callApiMock.mockResolvedValueOnce([
            {
                classId: 'c1',
                className: 'Class A',
                cohort: '2025',
                courseLength: '2',
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
