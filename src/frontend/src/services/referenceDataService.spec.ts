import { afterEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

const callApiMock = vi.fn();

vi.mock('./apiService', () => ({
    callApi: callApiMock,
}));

const validCohorts = [
    { name: '2025 Cohort', active: true },
    { name: '2026 Cohort', active: false },
];

const validYearGroups = [{ name: 'Year 10' }, { name: 'Year 11' }];

const createCohortInput = {
    record: {
        name: '2025 Cohort',
    },
};

const updateCohortInput = {
    originalName: '2024 Cohort',
    record: {
        name: '2025 Cohort',
        active: true,
    },
};

const deleteCohortInput = {
    name: '2025 Cohort',
};

const createYearGroupInput = {
    record: {
        name: 'Year 10',
    },
};

const updateYearGroupInput = {
    originalName: 'Year 9',
    record: {
        name: 'Year 10',
    },
};

const deleteYearGroupInput = {
    name: 'Year 10',
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

describe('referenceDataService current legacy contracts', () => {
    afterEach(() => {
        callApiMock.mockReset();
        vi.resetModules();
    });

    it('getCohorts() calls callApi with getCohorts and parses the current list response', async () => {
        callApiMock.mockResolvedValueOnce(validCohorts);
        const { getCohorts } = await loadReferenceDataService();

        await expect(getCohorts()).resolves.toEqual(validCohorts);
        expect(callApiMock).toHaveBeenCalledWith('getCohorts');
        expect(callApiMock).toHaveBeenCalledTimes(1);
    });

    it('getYearGroups() calls callApi with getYearGroups and parses the current list response', async () => {
        callApiMock.mockResolvedValueOnce(validYearGroups);
        const { getYearGroups } = await loadReferenceDataService();

        await expect(getYearGroups()).resolves.toEqual(validYearGroups);
        expect(callApiMock).toHaveBeenCalledWith('getYearGroups');
        expect(callApiMock).toHaveBeenCalledTimes(1);
    });

    it.each([
        ['createCohort', createCohortInput, { name: '2025 Cohort', active: false }],
        ['updateCohort', updateCohortInput, { name: '2025 Cohort', active: true }],
        ['deleteCohort', deleteCohortInput, undefined],
        ['createYearGroup', createYearGroupInput, { name: 'Year 10' }],
        ['updateYearGroup', updateYearGroupInput, { name: 'Year 10' }],
        ['deleteYearGroup', deleteYearGroupInput, undefined],
    ])(
        '%s() calls callApi with the current legacy payload shape',
        async (methodName, input, response) => {
            callApiMock.mockResolvedValueOnce(response);
            const service = await loadReferenceDataService();

            await expect(
                service[methodName as keyof typeof service](input as never) as Promise<unknown>
            ).resolves.toEqual(response);
            expect(callApiMock).toHaveBeenCalledWith(methodName, input);
            expect(callApiMock).toHaveBeenCalledTimes(1);
        }
    );

    it.each([
        ['createCohort', { record: { name: '   ' } }],
        ['updateCohort', { originalName: '', record: { name: '2025 Cohort', active: true } }],
        ['deleteCohort', { name: '   ' }],
        ['createYearGroup', { record: { name: '   ' } }],
        ['updateYearGroup', { originalName: 'Year 9', record: { name: '   ' } }],
        ['deleteYearGroup', { name: '' }],
    ])('%s() rejects malformed legacy request payloads before transport', async (methodName, input) => {
        const service = await loadReferenceDataService();

        await expect(
            service[methodName as keyof typeof service](input as never) as Promise<unknown>
        ).rejects.toBeInstanceOf(ZodError);
        expect(callApiMock).not.toHaveBeenCalled();
    });

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
        ['getCohorts', validCohorts.map((cohort) => ({ ...cohort, active: 'yes' }))],
        ['createCohort', { name: '2025 Cohort' }],
        ['getYearGroups', [{ active: true }]],
        ['deleteYearGroup', { deleted: true }],
    ])('%s() rejects malformed legacy success payloads', async (methodName, response) => {
        callApiMock.mockResolvedValueOnce(response);
        const service = await loadReferenceDataService();
        const invocation = invokeServiceMethodForMalformedPayload(service, methodName);

        await expect(invocation).rejects.toBeInstanceOf(ZodError);
    });
});

describe('referenceDataService future keyed contracts', () => {
    it.todo('getCohorts() parses keyed cohort payloads with academic-year metadata before returning them');
    it.todo('createCohort() preserves academic-year metadata in the request payload and parses the keyed response');
    it.todo('updateCohort() uses key-addressed identity instead of originalName and parses keyed responses');
    it.todo('deleteCohort() sends the cohort key rather than a display name');
    it.todo('getYearGroups() parses keyed year-group payloads before returning them');
    it.todo('createYearGroup() and updateYearGroup() use keyed year-group contracts');
    it.todo('deleteYearGroup() sends the year-group key rather than the display name');
    it.todo('keyed methods reject legacy name-addressed identity payloads before calling callApi');
    it.todo('keyed methods reject malformed success payloads when the backend still returns the legacy unkeyed shape');
});
