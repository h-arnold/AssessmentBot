import { afterEach, describe, expect, it, vi } from 'vitest';

const callApiMock = vi.fn();

vi.mock('./apiService', () => ({
    callApi: callApiMock,
}));

describe('googleClassroomsService.getGoogleClassrooms', () => {
    afterEach(() => {
        callApiMock.mockReset();
        vi.restoreAllMocks();
    });

    it('calls callApi with getGoogleClassrooms and parses the classroom summary list', async () => {
        callApiMock.mockResolvedValueOnce([
            {
                classId: 'course-001',
                className: '10A Computer Science',
            },
        ]);

        const { getGoogleClassrooms } = await import('./googleClassroomsService');

        await expect(getGoogleClassrooms()).resolves.toEqual([
            {
                classId: 'course-001',
                className: '10A Computer Science',
            },
        ]);
        expect(callApiMock).toHaveBeenCalledWith('getGoogleClassrooms');
        expect(callApiMock).toHaveBeenCalledTimes(1);
    });

    it('rejects malformed classroom success payloads instead of caching them', async () => {
        callApiMock.mockResolvedValueOnce([
            {
                classId: 'course-001',
            },
        ]);

        const { getGoogleClassrooms } = await import('./googleClassroomsService');

        await expect(getGoogleClassrooms()).rejects.toThrow();
    });

    it('propagates transport failures unchanged', async () => {
        const transportError = new Error('Google Classrooms transport failed');
        callApiMock.mockRejectedValueOnce(transportError);

        const { getGoogleClassrooms } = await import('./googleClassroomsService');

        await expect(getGoogleClassrooms()).rejects.toBe(transportError);
    });
});
