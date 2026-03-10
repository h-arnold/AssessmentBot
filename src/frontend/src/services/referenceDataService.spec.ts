import { afterEach, describe, expect, it, vi } from 'vitest';

const callApiMock = vi.fn();

vi.mock('./apiService', () => ({
    callApi: callApiMock,
}));

type ReferenceDataServiceModule = typeof import('./referenceDataService');

async function loadReferenceDataService(): Promise<ReferenceDataServiceModule> {
    try {
        return await import('./referenceDataService');
    } catch (error) {
        throw new Error(
            'Expected ./referenceDataService.ts to exist and export cohort/year-group CRUD callers for Section 4.',
            { cause: error as Error }
        );
    }
}

describe('referenceDataService', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('getCohorts() calls callApi with getCohorts', async () => {
        callApiMock.mockResolvedValueOnce([]);
        const { getCohorts } = await loadReferenceDataService();

        await getCohorts();

        expect(callApiMock).toHaveBeenCalledWith('getCohorts');
        expect(callApiMock).toHaveBeenCalledTimes(1);
    });

    it('createCohort() calls callApi with createCohort and the parsed payload', async () => {
        callApiMock.mockResolvedValueOnce({ name: 'Year 7', active: true });
        const { createCohort } = await loadReferenceDataService();

        await createCohort({ record: { name: 'Year 7' } });

        expect(callApiMock).toHaveBeenCalledWith('createCohort', {
            record: { name: 'Year 7' },
        });
        expect(callApiMock).toHaveBeenCalledTimes(1);
    });

    it('updateCohort() calls callApi with updateCohort and the parsed payload', async () => {
        callApiMock.mockResolvedValueOnce({ name: 'Year 8', active: false });
        const { updateCohort } = await loadReferenceDataService();

        await updateCohort({
            originalName: 'Year 7',
            record: { name: 'Year 8', active: false },
        });

        expect(callApiMock).toHaveBeenCalledWith('updateCohort', {
            originalName: 'Year 7',
            record: { name: 'Year 8', active: false },
        });
        expect(callApiMock).toHaveBeenCalledTimes(1);
    });

    it('deleteCohort() calls callApi with deleteCohort and the parsed payload', async () => {
        callApiMock.mockResolvedValueOnce(undefined);
        const { deleteCohort } = await loadReferenceDataService();

        await deleteCohort({ name: 'Year 7' });

        expect(callApiMock).toHaveBeenCalledWith('deleteCohort', { name: 'Year 7' });
        expect(callApiMock).toHaveBeenCalledTimes(1);
    });

    it('getYearGroups() calls callApi with getYearGroups', async () => {
        callApiMock.mockResolvedValueOnce([]);
        const { getYearGroups } = await loadReferenceDataService();

        await getYearGroups();

        expect(callApiMock).toHaveBeenCalledWith('getYearGroups');
        expect(callApiMock).toHaveBeenCalledTimes(1);
    });

    it('createYearGroup() calls callApi with createYearGroup and the parsed payload', async () => {
        callApiMock.mockResolvedValueOnce({ name: 'Year 10' });
        const { createYearGroup } = await loadReferenceDataService();

        await createYearGroup({ record: { name: 'Year 10' } });

        expect(callApiMock).toHaveBeenCalledWith('createYearGroup', {
            record: { name: 'Year 10' },
        });
        expect(callApiMock).toHaveBeenCalledTimes(1);
    });

    it('updateYearGroup() calls callApi with updateYearGroup and the parsed payload', async () => {
        callApiMock.mockResolvedValueOnce({ name: 'Year 11' });
        const { updateYearGroup } = await loadReferenceDataService();

        await updateYearGroup({
            originalName: 'Year 10',
            record: { name: 'Year 11' },
        });

        expect(callApiMock).toHaveBeenCalledWith('updateYearGroup', {
            originalName: 'Year 10',
            record: { name: 'Year 11' },
        });
        expect(callApiMock).toHaveBeenCalledTimes(1);
    });

    it('deleteYearGroup() calls callApi with deleteYearGroup and the parsed payload', async () => {
        callApiMock.mockResolvedValueOnce(undefined);
        const { deleteYearGroup } = await loadReferenceDataService();

        await deleteYearGroup({ name: 'Year 10' });

        expect(callApiMock).toHaveBeenCalledWith('deleteYearGroup', { name: 'Year 10' });
        expect(callApiMock).toHaveBeenCalledTimes(1);
    });

    it('getCohorts() parses the resolved backend payload with the cohort list response schema before returning it', async () => {
        const cohorts = [{ name: 'Year 7', active: true }];
        callApiMock.mockResolvedValueOnce(cohorts);
        const { getCohorts } = await loadReferenceDataService();

        await expect(getCohorts()).resolves.toEqual(cohorts);
    });

    it('createCohort(), updateCohort(), and deleteCohort() parse the resolved backend payload with the appropriate response schema before returning it', async () => {
        const createdCohort = { name: 'Year 7', active: true };
        const updatedCohort = { name: 'Year 8', active: false };
        callApiMock
            .mockResolvedValueOnce(createdCohort)
            .mockResolvedValueOnce(updatedCohort)
            .mockResolvedValueOnce(undefined);
        const { createCohort, updateCohort, deleteCohort } = await loadReferenceDataService();

        await expect(createCohort({ record: { name: 'Year 7' } })).resolves.toEqual(createdCohort);
        await expect(
            updateCohort({
                originalName: 'Year 7',
                record: { name: 'Year 8', active: false },
            })
        ).resolves.toEqual(updatedCohort);
        await expect(deleteCohort({ name: 'Year 8' })).resolves.toBeUndefined();
    });

    it('getYearGroups(), createYearGroup(), updateYearGroup(), and deleteYearGroup() parse the resolved backend payload with the appropriate response schema before returning it', async () => {
        const yearGroups = [{ name: 'Year 10' }];
        const createdYearGroup = { name: 'Year 10' };
        const updatedYearGroup = { name: 'Year 11' };
        callApiMock
            .mockResolvedValueOnce(yearGroups)
            .mockResolvedValueOnce(createdYearGroup)
            .mockResolvedValueOnce(updatedYearGroup)
            .mockResolvedValueOnce(undefined);
        const { getYearGroups, createYearGroup, updateYearGroup, deleteYearGroup } =
            await loadReferenceDataService();

        await expect(getYearGroups()).resolves.toEqual(yearGroups);
        await expect(createYearGroup({ record: { name: 'Year 10' } })).resolves.toEqual(
            createdYearGroup
        );
        await expect(
            updateYearGroup({
                originalName: 'Year 10',
                record: { name: 'Year 11' },
            })
        ).resolves.toEqual(updatedYearGroup);
        await expect(deleteYearGroup({ name: 'Year 11' })).resolves.toBeUndefined();
    });

    it.each([
        ['createCohort', () => loadReferenceDataService().then(({ createCohort }) => createCohort({ record: { name: '   ' } }))],
        [
            'updateCohort',
            () =>
                loadReferenceDataService().then(({ updateCohort }) =>
                    updateCohort({
                        originalName: 'Year 7',
                        record: { name: '', active: true },
                    })
                ),
        ],
        ['deleteCohort', () => loadReferenceDataService().then(({ deleteCohort }) => deleteCohort({ name: '   ' }))],
        [
            'createYearGroup',
            () =>
                loadReferenceDataService().then(({ createYearGroup }) =>
                    createYearGroup({ record: { name: '   ' } })
                ),
        ],
        [
            'updateYearGroup',
            () =>
                loadReferenceDataService().then(({ updateYearGroup }) =>
                    updateYearGroup({
                        originalName: 'Year 10',
                        record: { name: '' },
                    })
                ),
        ],
        ['deleteYearGroup', () => loadReferenceDataService().then(({ deleteYearGroup }) => deleteYearGroup({ name: '' }))],
    ])('%s() fails locally when payload schema parsing rejects malformed input', async (_methodName, invoke) => {
        await expect(invoke()).rejects.toThrow();
        expect(callApiMock).not.toHaveBeenCalled();
    });

    it.each([
        ['getCohorts', [{ name: 'Year 7', active: true }], () => loadReferenceDataService().then(({ getCohorts }) => getCohorts())],
        [
            'createCohort',
            { name: 'Year 7', active: true },
            () => loadReferenceDataService().then(({ createCohort }) => createCohort({ record: { name: 'Year 7' } })),
        ],
        [
            'updateCohort',
            { name: 'Year 8', active: false },
            () =>
                loadReferenceDataService().then(({ updateCohort }) =>
                    updateCohort({
                        originalName: 'Year 7',
                        record: { name: 'Year 8', active: false },
                    })
                ),
        ],
        ['deleteCohort', undefined, () => loadReferenceDataService().then(({ deleteCohort }) => deleteCohort({ name: 'Year 8' }))],
        ['getYearGroups', [{ name: 'Year 10' }], () => loadReferenceDataService().then(({ getYearGroups }) => getYearGroups())],
        [
            'createYearGroup',
            { name: 'Year 10' },
            () => loadReferenceDataService().then(({ createYearGroup }) => createYearGroup({ record: { name: 'Year 10' } })),
        ],
        [
            'updateYearGroup',
            { name: 'Year 11' },
            () =>
                loadReferenceDataService().then(({ updateYearGroup }) =>
                    updateYearGroup({
                        originalName: 'Year 10',
                        record: { name: 'Year 11' },
                    })
                ),
        ],
        ['deleteYearGroup', undefined, () => loadReferenceDataService().then(({ deleteYearGroup }) => deleteYearGroup({ name: 'Year 11' }))],
    ])('%s() returns the parsed backend data unchanged on success', async (_methodName, backendData, invoke) => {
        callApiMock.mockResolvedValueOnce(backendData);

        await expect(invoke()).resolves.toEqual(backendData);
    });

    it.each([
        ['getCohorts', () => loadReferenceDataService().then(({ getCohorts }) => getCohorts())],
        [
            'createCohort',
            () => loadReferenceDataService().then(({ createCohort }) => createCohort({ record: { name: 'Year 7' } })),
        ],
        [
            'updateCohort',
            () =>
                loadReferenceDataService().then(({ updateCohort }) =>
                    updateCohort({
                        originalName: 'Year 7',
                        record: { name: 'Year 8', active: false },
                    })
                ),
        ],
        ['deleteCohort', () => loadReferenceDataService().then(({ deleteCohort }) => deleteCohort({ name: 'Year 8' }))],
        ['getYearGroups', () => loadReferenceDataService().then(({ getYearGroups }) => getYearGroups())],
        [
            'createYearGroup',
            () =>
                loadReferenceDataService().then(({ createYearGroup }) =>
                    createYearGroup({ record: { name: 'Year 10' } })
                ),
        ],
        [
            'updateYearGroup',
            () =>
                loadReferenceDataService().then(({ updateYearGroup }) =>
                    updateYearGroup({
                        originalName: 'Year 10',
                        record: { name: 'Year 11' },
                    })
                ),
        ],
        ['deleteYearGroup', () => loadReferenceDataService().then(({ deleteYearGroup }) => deleteYearGroup({ name: 'Year 11' }))],
    ])('%s() propagates callApi rejections unchanged', async (_methodName, invoke) => {
        const transportError = new Error(`${_methodName} transport failed`);
        callApiMock.mockRejectedValueOnce(transportError);

        await expect(invoke()).rejects.toBe(transportError);
    });

    it.each([
        ['getCohorts', [{ name: '   ', active: true }], () => loadReferenceDataService().then(({ getCohorts }) => getCohorts())],
        [
            'createCohort',
            { name: '   ', active: true },
            () => loadReferenceDataService().then(({ createCohort }) => createCohort({ record: { name: 'Year 7' } })),
        ],
        [
            'updateCohort',
            { name: '', active: false },
            () =>
                loadReferenceDataService().then(({ updateCohort }) =>
                    updateCohort({
                        originalName: 'Year 7',
                        record: { name: 'Year 8', active: false },
                    })
                ),
        ],
        ['deleteCohort', { deleted: true }, () => loadReferenceDataService().then(({ deleteCohort }) => deleteCohort({ name: 'Year 8' }))],
        ['getYearGroups', [{ name: '   ' }], () => loadReferenceDataService().then(({ getYearGroups }) => getYearGroups())],
        [
            'createYearGroup',
            { name: '' },
            () =>
                loadReferenceDataService().then(({ createYearGroup }) =>
                    createYearGroup({ record: { name: 'Year 10' } })
                ),
        ],
        [
            'updateYearGroup',
            { name: '   ' },
            () =>
                loadReferenceDataService().then(({ updateYearGroup }) =>
                    updateYearGroup({
                        originalName: 'Year 10',
                        record: { name: 'Year 11' },
                    })
                ),
        ],
        ['deleteYearGroup', { deleted: true }, () => loadReferenceDataService().then(({ deleteYearGroup }) => deleteYearGroup({ name: 'Year 11' }))],
    ])('%s() rejects malformed success payloads when response parsing fails', async (_methodName, malformedPayload, invoke) => {
        callApiMock.mockResolvedValueOnce(malformedPayload);

        await expect(invoke()).rejects.toThrow();
    });
});