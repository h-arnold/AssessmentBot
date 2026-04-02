import { afterEach, describe, expect, it, vi } from 'vitest';

const callApiMock = vi.fn();
const omittedBackendSuccessPayload = new Map<string, never>().get('missing');

vi.mock('./apiService', () => ({
    callApi: callApiMock,
}));

async function loadReferenceDataService() {
    return import('./referenceDataService');
}

describe('referenceDataService', () => {
    afterEach(() => {
        callApiMock.mockReset();
        vi.restoreAllMocks();
    });

    it('getCohorts() parses keyed cohort payloads with academic-year metadata before returning them', async () => {
        callApiMock.mockResolvedValueOnce([
            {
                key: '  coh-2026  ',
                name: '  Cohort 2026  ',
                active: true,
                startYear: 2025,
                startMonth: 9,
            },
        ]);
        const { getCohorts } = await loadReferenceDataService();

        await expect(getCohorts()).resolves.toEqual([
            {
                key: 'coh-2026',
                name: 'Cohort 2026',
                active: true,
                startYear: 2025,
                startMonth: 9,
            },
        ]);
        expect(callApiMock).toHaveBeenCalledWith('getCohorts');
    });

    it('createCohort() preserves academic-year metadata in the request payload and parses the keyed response', async () => {
        callApiMock.mockResolvedValueOnce({
            key: 'coh-2026',
            name: 'Cohort 2026',
            active: true,
            startYear: 2025,
            startMonth: 9,
        });
        const { createCohort } = await loadReferenceDataService();

        await expect(
            createCohort({
                record: {
                    name: '  Cohort 2026  ',
                    active: true,
                    startYear: 2025,
                    startMonth: 9,
                },
            })
        ).resolves.toEqual({
            key: 'coh-2026',
            name: 'Cohort 2026',
            active: true,
            startYear: 2025,
            startMonth: 9,
        });

        expect(callApiMock).toHaveBeenCalledWith('createCohort', {
            record: {
                name: 'Cohort 2026',
                active: true,
                startYear: 2025,
                startMonth: 9,
            },
        });
    });

    it('updateCohort() uses key-addressed identity instead of originalName and parses keyed responses', async () => {
        callApiMock.mockResolvedValueOnce({
            key: 'coh-2026',
            name: 'Cohort 2027',
            active: false,
            startYear: 2026,
            startMonth: 9,
        });
        const { updateCohort } = await loadReferenceDataService();

        await expect(
            updateCohort({
                key: '  coh-2026  ',
                record: {
                    name: '  Cohort 2027  ',
                    active: false,
                    startYear: 2026,
                    startMonth: 9,
                },
            })
        ).resolves.toEqual({
            key: 'coh-2026',
            name: 'Cohort 2027',
            active: false,
            startYear: 2026,
            startMonth: 9,
        });

        expect(callApiMock).toHaveBeenCalledWith('updateCohort', {
            key: 'coh-2026',
            record: {
                name: 'Cohort 2027',
                active: false,
                startYear: 2026,
                startMonth: 9,
            },
        });
    });

    it('deleteCohort() sends the cohort key rather than a display name', async () => {
        callApiMock.mockResolvedValueOnce(omittedBackendSuccessPayload);
        const { deleteCohort } = await loadReferenceDataService();

        await expect(deleteCohort({ key: '  coh-2026  ' })).resolves.toBeUndefined();
        expect(callApiMock).toHaveBeenCalledWith('deleteCohort', { key: 'coh-2026' });
    });

    it('getYearGroups() parses keyed year-group payloads before returning them', async () => {
        callApiMock.mockResolvedValueOnce([{ key: '  yg-10  ', name: '  Year 10  ' }]);
        const { getYearGroups } = await loadReferenceDataService();

        await expect(getYearGroups()).resolves.toEqual([{ key: 'yg-10', name: 'Year 10' }]);
        expect(callApiMock).toHaveBeenCalledWith('getYearGroups');
    });

    it('createYearGroup() and updateYearGroup() use keyed year-group contracts', async () => {
        callApiMock
            .mockResolvedValueOnce({ key: 'yg-10', name: 'Year 10' })
            .mockResolvedValueOnce({ key: 'yg-11', name: 'Year 11' });
        const { createYearGroup, updateYearGroup } = await loadReferenceDataService();

        await expect(createYearGroup({ record: { name: '  Year 10  ' } })).resolves.toEqual({
            key: 'yg-10',
            name: 'Year 10',
        });
        await expect(
            updateYearGroup({
                key: '  yg-10  ',
                record: { name: '  Year 11  ' },
            })
        ).resolves.toEqual({
            key: 'yg-11',
            name: 'Year 11',
        });

        expect(callApiMock).toHaveBeenNthCalledWith(1, 'createYearGroup', {
            record: { name: 'Year 10' },
        });
        expect(callApiMock).toHaveBeenNthCalledWith(2, 'updateYearGroup', {
            key: 'yg-10',
            record: { name: 'Year 11' },
        });
    });

    it('deleteYearGroup() sends the year-group key rather than the display name', async () => {
        callApiMock.mockResolvedValueOnce(omittedBackendSuccessPayload);
        const { deleteYearGroup } = await loadReferenceDataService();

        await expect(deleteYearGroup({ key: '  yg-10  ' })).resolves.toBeUndefined();
        expect(callApiMock).toHaveBeenCalledWith('deleteYearGroup', { key: 'yg-10' });
    });

    it.each([
        [
            'updateCohort',
            () =>
                loadReferenceDataService().then(({ updateCohort }) =>
                    updateCohort({
                        originalName: 'Cohort 2026',
                        record: {
                            name: 'Cohort 2027',
                            active: false,
                            startYear: 2026,
                            startMonth: 9,
                        },
                    } as unknown as Parameters<typeof updateCohort>[0])
                ),
        ],
        [
            'deleteCohort',
            () =>
                loadReferenceDataService().then(({ deleteCohort }) =>
                    deleteCohort({ name: 'Cohort 2026' } as unknown as Parameters<typeof deleteCohort>[0])
                ),
        ],
        [
            'updateYearGroup',
            () =>
                loadReferenceDataService().then(({ updateYearGroup }) =>
                    updateYearGroup({
                        originalName: 'Year 10',
                        record: { name: 'Year 11' },
                    } as unknown as Parameters<typeof updateYearGroup>[0])
                ),
        ],
        [
            'deleteYearGroup',
            () =>
                loadReferenceDataService().then(({ deleteYearGroup }) =>
                    deleteYearGroup({ name: 'Year 10' } as unknown as Parameters<typeof deleteYearGroup>[0])
                ),
        ],
    ])('%s() rejects legacy name-addressed identity payloads before calling callApi', async (_methodName, invoke) => {
        await expect(invoke()).rejects.toThrow();
        expect(callApiMock).not.toHaveBeenCalled();
    });

    it.each([
        ['getCohorts', [{ name: 'Cohort 2026', active: true }], () => loadReferenceDataService().then(({ getCohorts }) => getCohorts())],
        [
            'createCohort',
            { name: 'Cohort 2026', active: true, startYear: 2025, startMonth: 9 },
            () =>
                loadReferenceDataService().then(({ createCohort }) =>
                    createCohort({
                        record: {
                            name: 'Cohort 2026',
                            active: true,
                            startYear: 2025,
                            startMonth: 9,
                        },
                    })
                ),
        ],
        ['getYearGroups', [{ name: 'Year 10' }], () => loadReferenceDataService().then(({ getYearGroups }) => getYearGroups())],
        [
            'createYearGroup',
            { name: 'Year 10' },
            () =>
                loadReferenceDataService().then(({ createYearGroup }) =>
                    createYearGroup({ record: { name: 'Year 10' } })
                ),
        ],
        [
            'updateYearGroup',
            { name: 'Year 11' },
            () =>
                loadReferenceDataService().then(({ updateYearGroup }) =>
                    updateYearGroup({
                        key: 'yg-10',
                        record: { name: 'Year 11' },
                    })
                ),
        ],
    ])('%s() rejects malformed success payloads when the backend still returns the legacy unkeyed shape', async (_methodName, malformedPayload, invoke) => {
        callApiMock.mockResolvedValueOnce(malformedPayload);

        await expect(invoke()).rejects.toThrow();
    });
});
