import { afterEach, describe, expect, it, vi } from 'vitest';

const callApiMock = vi.fn();
const omittedBackendSuccessPayload = new Map<string, never>().get('missing');
const SECOND_CALL = 2;
const THIRD_CALL = 3;

vi.mock('./apiService', () => ({
    callApi: callApiMock,
}));

/**
 * Loads the reference-data service module under test.
 */
async function loadReferenceDataService() {
    return import('./referenceDataService');
}

describe('referenceDataService', () => {
    afterEach(() => {
        callApiMock.mockReset();
        vi.restoreAllMocks();
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
        callApiMock.mockResolvedValueOnce(omittedBackendSuccessPayload);
        const { deleteCohort } = await loadReferenceDataService();

        await deleteCohort({ name: '  Year 7  ' });

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
        callApiMock.mockResolvedValueOnce(omittedBackendSuccessPayload);
        const { deleteYearGroup } = await loadReferenceDataService();

        await deleteYearGroup({ name: '  Year 10  ' });

        expect(callApiMock).toHaveBeenCalledWith('deleteYearGroup', { name: 'Year 10' });
        expect(callApiMock).toHaveBeenCalledTimes(1);
    });

    it('getCohorts() parses the resolved backend payload with the cohort list response schema before returning it', async () => {
        callApiMock.mockResolvedValueOnce([{ name: '  Year 7  ', active: true }]);
        const { getCohorts } = await loadReferenceDataService();

        await expect(getCohorts()).resolves.toEqual([{ name: 'Year 7', active: true }]);
    });

    it('createCohort(), updateCohort(), and deleteCohort() parse the resolved backend payload with the appropriate response schema before returning it', async () => {
        callApiMock
            .mockResolvedValueOnce({ name: '  Year 7  ', active: true })
            .mockResolvedValueOnce({ name: '  Year 8  ', active: false })
            .mockResolvedValueOnce(omittedBackendSuccessPayload);
        const { createCohort, updateCohort, deleteCohort } = await loadReferenceDataService();

        await expect(createCohort({ record: { name: 'Year 7' } })).resolves.toEqual({
            name: 'Year 7',
            active: true,
        });
        await expect(
            updateCohort({
                originalName: 'Year 7',
                record: { name: 'Year 8', active: false },
            })
        ).resolves.toEqual({ name: 'Year 8', active: false });
        await expect(deleteCohort({ name: 'Year 8' })).resolves.toBeUndefined();
    });

    it('getYearGroups(), createYearGroup(), updateYearGroup(), and deleteYearGroup() parse the resolved backend payload with the appropriate response schema before returning it', async () => {
        callApiMock
            .mockResolvedValueOnce([{ name: '  Year 10  ' }])
            .mockResolvedValueOnce({ name: '  Year 10  ' })
            .mockResolvedValueOnce({ name: '  Year 11  ' })
            .mockResolvedValueOnce(omittedBackendSuccessPayload);
        const { getYearGroups, createYearGroup, updateYearGroup, deleteYearGroup } =
            await loadReferenceDataService();

        await expect(getYearGroups()).resolves.toEqual([{ name: 'Year 10' }]);
        await expect(createYearGroup({ record: { name: 'Year 10' } })).resolves.toEqual({
            name: 'Year 10',
        });
        await expect(
            updateYearGroup({
                originalName: 'Year 10',
                record: { name: 'Year 11' },
            })
        ).resolves.toEqual({ name: 'Year 11' });
        await expect(deleteYearGroup({ name: 'Year 11' })).resolves.toBeUndefined();
    });

    it('parses valid request payloads locally before calling create/update/delete cohort endpoints', async () => {
        const createInput = { record: { name: 'Year 7' } };
        const updateInput = {
            originalName: 'Year 7',
            record: { name: 'Year 8', active: false },
        };
        const deleteInput = { name: 'Year 8' };
        callApiMock
            .mockResolvedValueOnce({ name: 'Year 7', active: true })
            .mockResolvedValueOnce({ name: 'Year 8', active: false })
            .mockResolvedValueOnce(omittedBackendSuccessPayload);
        const { createCohort, updateCohort, deleteCohort } = await loadReferenceDataService();

        await createCohort({ record: { name: '  Year 7  ' } });
        await updateCohort({
            originalName: '  Year 7  ',
            record: { name: '  Year 8  ', active: false },
        });
        await deleteCohort({ name: '  Year 8  ' });

        expect(callApiMock).toHaveBeenNthCalledWith(1, 'createCohort', createInput);
        expect(callApiMock).toHaveBeenNthCalledWith(SECOND_CALL, 'updateCohort', updateInput);
        expect(callApiMock).toHaveBeenNthCalledWith(THIRD_CALL, 'deleteCohort', deleteInput);
    });

    it('parses valid request payloads locally before calling create/update/delete year-group endpoints', async () => {
        const createInput = { record: { name: 'Year 10' } };
        const updateInput = {
            originalName: 'Year 10',
            record: { name: 'Year 11' },
        };
        const deleteInput = { name: 'Year 11' };
        callApiMock
            .mockResolvedValueOnce({ name: 'Year 10' })
            .mockResolvedValueOnce({ name: 'Year 11' })
            .mockResolvedValueOnce(omittedBackendSuccessPayload);
        const { createYearGroup, updateYearGroup, deleteYearGroup } = await loadReferenceDataService();

        await createYearGroup({ record: { name: '  Year 10  ' } });
        await updateYearGroup({
            originalName: '  Year 10  ',
            record: { name: '  Year 11  ' },
        });
        await deleteYearGroup({ name: '  Year 11  ' });

        expect(callApiMock).toHaveBeenNthCalledWith(1, 'createYearGroup', createInput);
        expect(callApiMock).toHaveBeenNthCalledWith(SECOND_CALL, 'updateYearGroup', updateInput);
        expect(callApiMock).toHaveBeenNthCalledWith(THIRD_CALL, 'deleteYearGroup', deleteInput);
    });

    it.each([
        ['createCohort', () => loadReferenceDataService().then(({ createCohort }) => createCohort({ record: { name: '   ' } }))],
        [
            'updateCohort',
            () =>
                loadReferenceDataService().then(({ updateCohort }) =>
                    updateCohort(
                        {
                            originalName: 'Year 7',
                            record: { name: 'Year 8' },
                        } as unknown as Parameters<typeof updateCohort>[0]
                    )
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
        ['getCohorts', [{ name: 'Year 7' }], () => loadReferenceDataService().then(({ getCohorts }) => getCohorts())],
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
        ['deleteCohort', { deleted: true }, () => loadReferenceDataService().then(({ deleteCohort }) => deleteCohort({ name: 'Year 8' }))],
        ['deleteYearGroup', { deleted: true }, () => loadReferenceDataService().then(({ deleteYearGroup }) => deleteYearGroup({ name: 'Year 11' }))],
    ])('%s() rejects malformed success payloads when response parsing fails', async (_methodName, malformedPayload, invoke) => {
        callApiMock.mockResolvedValueOnce(malformedPayload);

        await expect(invoke()).rejects.toThrow();
    });
});