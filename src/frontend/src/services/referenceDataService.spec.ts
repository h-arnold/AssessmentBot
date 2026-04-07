import { afterEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';
import { ApiTransportError } from '../errors/apiTransportError';

const callApiMock = vi.fn();

vi.mock('./apiService', () => ({
    callApi: callApiMock,
}));

const validCohorts = [
    { key: 'cohort-2025', name: '2025 Cohort', active: true, startYear: 2025, startMonth: 9 },
    { key: 'cohort-2026', name: '2026 Cohort', active: false, startYear: 2026, startMonth: 9 },
];

const validYearGroups = [
    { key: 'year-10', name: 'Year 10' },
    { key: 'year-11', name: 'Year 11' },
];

const createCohortInput = {
    record: {
        name: '2025 Cohort',
    },
};

const updateCohortInput = {
    key: 'cohort-2024',
    record: {
        name: '2025 Cohort',
        active: true,
    },
};

const deleteCohortInput = {
    key: 'cohort-2025',
};

const createYearGroupInput = {
    record: {
        name: 'Year 10',
    },
};

const updateYearGroupInput = {
    key: 'year-9',
    record: {
        name: 'Year 10',
    },
};

const deleteYearGroupInput = {
    key: 'year-10',
};

/**
 * Loads the reference-data service module under test.
 *
 * @returns {Promise<typeof import('./referenceDataService')>} The imported service module.
 */
async function loadReferenceDataService() {
    return import('./referenceDataService');
}

/**
 * Invokes the selected service method with the fixture used by the malformed-payload tests.
 *
 * @param {Awaited<ReturnType<typeof loadReferenceDataService>>} service Imported service module.
 * @param {string} methodName Service method name under test.
 * @returns {Promise<unknown>} The invocation promise.
 */
function invokeServiceMethodForMalformedPayload(
    service: Awaited<ReturnType<typeof loadReferenceDataService>>,
    methodName: string
): Promise<unknown> {
    switch (methodName) {
        case 'getCohorts': {
            return service.getCohorts();
        }
        case 'createCohort': {
            return service.createCohort(createCohortInput);
        }
        case 'getYearGroups': {
            return service.getYearGroups();
        }
        case 'deleteYearGroup': {
            return service.deleteYearGroup(deleteYearGroupInput);
        }
        default: {
            throw new Error(`Unsupported service method for malformed payload test: ${methodName}`);
        }
    }
}

describe('referenceDataService keyed contracts', () => {
    afterEach(() => {
        callApiMock.mockReset();
        vi.resetModules();
    });

    it('getCohorts() parses keyed cohort payloads with academic-year metadata before returning them', async () => {
        callApiMock.mockResolvedValueOnce(validCohorts);
        const { getCohorts } = await loadReferenceDataService();

        await expect(getCohorts()).resolves.toEqual(validCohorts);
        expect(callApiMock).toHaveBeenCalledWith('getCohorts');
        expect(callApiMock).toHaveBeenCalledTimes(1);
    });

    it('getYearGroups() parses keyed year-group payloads before returning them', async () => {
        callApiMock.mockResolvedValueOnce(validYearGroups);
        const { getYearGroups } = await loadReferenceDataService();

        await expect(getYearGroups()).resolves.toEqual(validYearGroups);
        expect(callApiMock).toHaveBeenCalledWith('getYearGroups');
        expect(callApiMock).toHaveBeenCalledTimes(1);
    });

    it.each([
        [
            'createCohort',
            createCohortInput,
            { key: 'cohort-2025', name: '2025 Cohort', active: false, startYear: 2025, startMonth: 9 },
        ],
        [
            'updateCohort',
            updateCohortInput,
            { key: 'cohort-2024', name: '2025 Cohort', active: true, startYear: 2025, startMonth: 9 },
        ],
        ['createYearGroup', createYearGroupInput, { key: 'year-10', name: 'Year 10' }],
        ['updateYearGroup', updateYearGroupInput, { key: 'year-9', name: 'Year 10' }],
    ])('%s() calls callApi with keyed input and parses keyed response', async (methodName, input, response) => {
        callApiMock.mockResolvedValueOnce(response);
        const service = await loadReferenceDataService();

        await expect(
            service[methodName as keyof typeof service](input as never) as Promise<unknown>
        ).resolves.toEqual(response);
        expect(callApiMock).toHaveBeenCalledWith(methodName, input);
        expect(callApiMock).toHaveBeenCalledTimes(1);
    });

    it.each([
        ['deleteCohort', deleteCohortInput],
        ['deleteYearGroup', deleteYearGroupInput],
    ])(
        '%s() calls callApi and handles void response',
        async (methodName, input) => {
            const service = await loadReferenceDataService();

            await service[methodName as keyof typeof service](input as never);
            expect(callApiMock).toHaveBeenCalledWith(methodName, input);
            expect(callApiMock).toHaveBeenCalledTimes(1);
        }
    );

    it('createCohort() preserves academic-year metadata in the request payload and parses the keyed response', async () => {
        const inputWithMetadata = {
            record: {
                name: '2025 Cohort',
                active: true,
                startYear: 2025,
                startMonth: 9,
            },
        };
        const response = {
            key: 'cohort-2025',
            name: '2025 Cohort',
            active: true,
            startYear: 2025,
            startMonth: 9,
        };
        callApiMock.mockResolvedValueOnce(response);
        const { createCohort } = await loadReferenceDataService();

        await expect(createCohort(inputWithMetadata)).resolves.toEqual(response);
        expect(callApiMock).toHaveBeenCalledWith('createCohort', inputWithMetadata);
    });

    it('updateCohort() uses key-addressed identity instead of originalName and parses keyed responses', async () => {
        const response = {
            key: 'cohort-2024',
            name: '2025 Cohort',
            active: true,
            startYear: 2024,
            startMonth: 9,
        };
        callApiMock.mockResolvedValueOnce(response);
        const { updateCohort } = await loadReferenceDataService();

        await expect(updateCohort(updateCohortInput)).resolves.toEqual(response);
        expect(callApiMock).toHaveBeenCalledWith('updateCohort', updateCohortInput);
    });

    it('deleteCohort() sends the cohort key rather than a display name', async () => {
        const { deleteCohort } = await loadReferenceDataService();

        await deleteCohort(deleteCohortInput);
        expect(callApiMock).toHaveBeenCalledWith('deleteCohort', deleteCohortInput);
    });

    it('deleteYearGroup() sends the year-group key rather than the display name', async () => {
        const { deleteYearGroup } = await loadReferenceDataService();

        await deleteYearGroup(deleteYearGroupInput);
        expect(callApiMock).toHaveBeenCalledWith('deleteYearGroup', deleteYearGroupInput);
    });

    it.each([
        ['createCohort', { record: { name: '   ' } }],
        ['updateCohort', { key: '', record: { name: '2025 Cohort', active: true } }],
        ['deleteCohort', { key: '   ' }],
        ['createYearGroup', { record: { name: '   ' } }],
        ['updateYearGroup', { key: 'year-9', record: { name: '   ' } }],
        ['deleteYearGroup', { key: '' }],
    ])(
        '%s() rejects malformed request payloads before calling callApi',
        async (methodName, input) => {
            const service = await loadReferenceDataService();

            await expect(
                service[methodName as keyof typeof service](input as never) as Promise<unknown>
            ).rejects.toBeInstanceOf(ZodError);
            expect(callApiMock).not.toHaveBeenCalled();
        }
    );

    it.each(['getCohorts', 'createYearGroup'])(
        '%s() propagates transport failures unchanged',
        async (methodName) => {
            const transportFailure = new Error('Transport failure');
            callApiMock.mockRejectedValueOnce(transportFailure);
            const service = await loadReferenceDataService();
            const invocation =
                methodName === 'getCohorts'
                    ? service.getCohorts()
                    : service.createYearGroup(createYearGroupInput);

            await expect(invocation).rejects.toBe(transportFailure);
        }
    );

    it.each([
        [
            'getCohorts',
            validCohorts.map((cohort) => ({ ...cohort, active: 'yes' })),
        ],
        ['createCohort', { key: 'cohort-2025', name: '2025 Cohort' }],
        ['getYearGroups', [{ active: true }]],
        ['deleteYearGroup', { deleted: true }],
    ])(
        'keyed methods reject malformed success payloads: %s()',
        async (methodName, response) => {
            callApiMock.mockResolvedValueOnce(response);
            const service = await loadReferenceDataService();
            const invocation = invokeServiceMethodForMalformedPayload(service, methodName);

            await expect(invocation).rejects.toBeInstanceOf(ZodError);
        }
    );

    describe('delete-blocked IN_USE transport propagation', () => {
        it('deleteCohort() propagates an ApiTransportError with code IN_USE unchanged to callers', async () => {
            const inUseError = new ApiTransportError({
                requestId: 'req-delete-blocked-cohort',
                error: {
                    code: 'IN_USE',
                    message: 'Cohort is in use by one or more classes and cannot be deleted.',
                    retriable: false,
                },
            });
            callApiMock.mockRejectedValueOnce(inUseError);
            const { deleteCohort } = await loadReferenceDataService();

            await expect(deleteCohort(deleteCohortInput)).rejects.toBe(inUseError);
        });

        it('deleteYearGroup() propagates an ApiTransportError with code IN_USE unchanged to callers', async () => {
            const inUseError = new ApiTransportError({
                requestId: 'req-delete-blocked-year-group',
                error: {
                    code: 'IN_USE',
                    message: 'Year group is in use by one or more classes and cannot be deleted.',
                    retriable: false,
                },
            });
            callApiMock.mockRejectedValueOnce(inUseError);
            const { deleteYearGroup } = await loadReferenceDataService();

            await expect(deleteYearGroup(deleteYearGroupInput)).rejects.toBe(inUseError);
        });


    });
});
