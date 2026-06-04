import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  loadApiHandlerModule,
  handleApiRequest,
  setupDispatcherTest,
  teardownDispatcherTest,
  ABCLASS_TRANSPORT_API_METHOD_NAMES,
  ABCLASS_TRANSPORT_PARAMS,
  ABCLASS_TRANSPORT_RESULTS,
  ASSIGNMENT_DEFINITION_API_METHOD_NAMES,
  ASSIGNMENT_DEFINITION_PARAMS,
  ASSIGNMENT_DEFINITION_RESULTS,
  REFERENCE_DATA_API_METHOD_NAMES,
  REFERENCE_DATA_PARAMS,
  REFERENCE_DATA_RESULTS,
  INVALID_REQUEST_FAILURE_CASES,
  IN_USE_FAILURE_CASES,
  ApiValidationError,
  getReferenceDataControllerMethodSpy,
  getAllowlistedHandlerSpy,
  expectFailureEnvelope,
  expectBoundaryFailureLog,
} = require('./shared.js');

describe('Api/apiHandler dispatcher — method routing', () => {
  let context;

  beforeEach(() => {
    context = setupDispatcherTest(vi);
  });

  afterEach(() => {
    teardownDispatcherTest(vi, context);
  });

  describe('reference data routing', () => {
    it.each(REFERENCE_DATA_API_METHOD_NAMES)(
      'routes %s to the matching allowlisted handler',
      (methodName) => {
        const { ApiDispatcher } = loadApiHandlerModule();
        const dispatcher = ApiDispatcher.getInstance();
        const params = REFERENCE_DATA_PARAMS[methodName];
        const expectedData = REFERENCE_DATA_RESULTS[methodName];
        const controllerMethodSpy = getReferenceDataControllerMethodSpy(context, methodName);

        controllerMethodSpy.mockImplementation(() => expectedData);

        const response = dispatcher.handle({
          method: methodName,
          params,
        });

        expect(context.referenceDataControllerCtor).toHaveBeenCalledTimes(1);
        expect(controllerMethodSpy).toHaveBeenCalledTimes(1);
        if (
          methodName === 'createCohort' ||
          methodName === 'createYearGroup' ||
          methodName === 'createAssignmentTopic'
        ) {
          expect(controllerMethodSpy).toHaveBeenCalledWith(params.record);
        } else if (
          methodName === 'deleteCohort' ||
          methodName === 'deleteYearGroup' ||
          methodName === 'deleteAssignmentTopic'
        ) {
          expect(controllerMethodSpy).toHaveBeenCalledWith(params.key);
        } else if (params === undefined) {
          expect(controllerMethodSpy).toHaveBeenCalledWith();
        } else {
          expect(controllerMethodSpy).toHaveBeenCalledWith(params);
        }
        expect(response.ok).toBe(true);
        expect(response.data).toEqual(expectedData);
        expect(response.data?.ok).toBeUndefined();
        expect(response.data?.error).toBeUndefined();
      }
    );

    it.each([
      [
        'createCohort',
        REFERENCE_DATA_PARAMS.createCohort,
        REFERENCE_DATA_PARAMS.createCohort.record,
      ],
      ['updateCohort', REFERENCE_DATA_PARAMS.updateCohort, REFERENCE_DATA_PARAMS.updateCohort],
      ['deleteCohort', REFERENCE_DATA_PARAMS.deleteCohort, REFERENCE_DATA_PARAMS.deleteCohort.key],
      [
        'createYearGroup',
        REFERENCE_DATA_PARAMS.createYearGroup,
        REFERENCE_DATA_PARAMS.createYearGroup.record,
      ],
      [
        'updateYearGroup',
        REFERENCE_DATA_PARAMS.updateYearGroup,
        REFERENCE_DATA_PARAMS.updateYearGroup,
      ],
      [
        'deleteYearGroup',
        REFERENCE_DATA_PARAMS.deleteYearGroup,
        REFERENCE_DATA_PARAMS.deleteYearGroup.key,
      ],
      [
        'createAssignmentTopic',
        REFERENCE_DATA_PARAMS.createAssignmentTopic,
        REFERENCE_DATA_PARAMS.createAssignmentTopic.record,
      ],
      [
        'updateAssignmentTopic',
        REFERENCE_DATA_PARAMS.updateAssignmentTopic,
        REFERENCE_DATA_PARAMS.updateAssignmentTopic,
      ],
      [
        'deleteAssignmentTopic',
        REFERENCE_DATA_PARAMS.deleteAssignmentTopic,
        REFERENCE_DATA_PARAMS.deleteAssignmentTopic.key,
      ],
    ])(
      'passes expected parameters to ReferenceDataController.%s',
      (methodName, params, expectedArgument) => {
        const controllerMethodSpy = getReferenceDataControllerMethodSpy(context, methodName);
        const { ApiDispatcher } = loadApiHandlerModule();
        const dispatcher = ApiDispatcher.getInstance();

        dispatcher.handle({
          method: methodName,
          params,
        });

        expect(controllerMethodSpy).toHaveBeenCalledTimes(1);
        expect(controllerMethodSpy).toHaveBeenCalledWith(expectedArgument);
      }
    );

    it.each([
      'getAssignmentTopics',
      'createAssignmentTopic',
      'updateAssignmentTopic',
      'deleteAssignmentTopic',
    ])('maps %s failures to the standard API envelope', (methodName) => {
      const params = REFERENCE_DATA_PARAMS[methodName];
      const controllerMethodSpy = getReferenceDataControllerMethodSpy(context, methodName);
      const thrownError = new ApiValidationError('Invalid assignment-topic payload');
      controllerMethodSpy.mockImplementation(() => {
        throw thrownError;
      });

      const response = handleApiRequest(methodName, params);

      expectBoundaryFailureLog(context.errorSpy, {
        response,
        methodName,
        thrownValue: thrownError,
      });
      expectFailureEnvelope(response, {
        code: 'INVALID_REQUEST',
        message: 'Invalid assignment-topic payload',
        withRequestId: true,
      });
    });
  });

  describe('transport helper routing', () => {
    it.each(ABCLASS_TRANSPORT_API_METHOD_NAMES)(
      'routes %s to the matching allowlisted handler',
      (methodName) => {
        const { ApiDispatcher } = loadApiHandlerModule();
        const dispatcher = ApiDispatcher.getInstance();
        const params = ABCLASS_TRANSPORT_PARAMS[methodName];
        const expectedData = ABCLASS_TRANSPORT_RESULTS[methodName];

        const transportHelperSpy = context[`${methodName}_`];
        expect(globalThis[methodName]).toBeUndefined();
        transportHelperSpy.mockImplementation(() => expectedData);

        const response = dispatcher.handle({
          method: methodName,
          params,
        });

        expect(transportHelperSpy).toHaveBeenCalledTimes(1);
        expect(transportHelperSpy).toHaveBeenCalledWith(params);
        expect(response).toEqual({
          ok: true,
          requestId: response.requestId,
          data: expectedData,
        });
        expect(response.requestId).toEqual(expect.any(String));
      }
    );

    it.each(ASSIGNMENT_DEFINITION_API_METHOD_NAMES)(
      'routes %s to the matching allowlisted handler',
      (methodName) => {
        const { ApiDispatcher } = loadApiHandlerModule();
        const dispatcher = ApiDispatcher.getInstance();
        const params = ASSIGNMENT_DEFINITION_PARAMS[methodName];
        const expectedData = ASSIGNMENT_DEFINITION_RESULTS[methodName];

        const transportHelperSpy = context[`${methodName}_`];
        expect(globalThis[methodName]).toBeUndefined();
        transportHelperSpy.mockImplementation(() => expectedData);

        const response = dispatcher.handle({
          method: methodName,
          ...(params === undefined ? {} : { params }),
        });

        expect(transportHelperSpy).toHaveBeenCalledTimes(1);
        expect(transportHelperSpy).toHaveBeenCalledWith(params);
        expect(response).toEqual({
          ok: true,
          requestId: response.requestId,
          data: expectedData,
        });
        expect(response.requestId).toEqual(expect.any(String));
      }
    );

    it('returns canonical full-definition read data for getAssignmentDefinition through apiHandler', () => {
      const expectedData = ASSIGNMENT_DEFINITION_RESULTS.getAssignmentDefinition;
      context.getAssignmentDefinition_.mockReturnValue(expectedData);

      const response = handleApiRequest('getAssignmentDefinition', {
        definitionKey: 'algebra-baseline',
      });

      expect(response).toEqual({
        ok: true,
        requestId: response.requestId,
        data: expectedData,
      });
      expect(response.data).toMatchObject({
        definitionKey: 'algebra-baseline',
        referenceDocumentId: 'ref-doc-001',
        templateDocumentId: 'tpl-doc-001',
        tasks: [expect.objectContaining({ taskId: 'task-1', taskWeighting: 1 })],
      });
      expect(response.data).not.toHaveProperty('referenceDocumentUrl');
      expect(response.data).not.toHaveProperty('templateDocumentUrl');
    });

    it('dispatches backend-config methods through trailing-underscore helpers in vm runtime', () => {
      const { loadApiHandlerInVmContext, makeVmGlobals } = require('./shared.js');

      const getBackendConfig_ = vi.fn(() => ({ backendUrl: 'https://example.test' }));
      const setBackendConfig_ = vi.fn((params) => ({ success: true, params }));
      const { ApiDispatcher } = loadApiHandlerInVmContext({
        globals: makeVmGlobals({
          getBackendConfig_,
          setBackendConfig_,
        }),
      });
      const dispatcher = ApiDispatcher.getInstance();

      const getResponse = dispatcher.handle({ method: 'getBackendConfig' });

      expect(getBackendConfig_).toHaveBeenCalledTimes(1);
      expect(getResponse).toMatchObject({
        ok: true,
        data: { backendUrl: 'https://example.test' },
      });

      const params = { backendUrl: 'https://updated.example.test' };
      const setResponse = dispatcher.handle({
        method: 'setBackendConfig',
        params,
      });

      expect(setBackendConfig_).toHaveBeenCalledTimes(1);
      expect(setBackendConfig_).toHaveBeenCalledWith(params);
      expect(setResponse).toMatchObject({
        ok: true,
        data: { success: true, params },
      });
    });

    it('returns plain handler data for successful reference-data requests without re-enveloping it', () => {
      const { ApiDispatcher } = loadApiHandlerModule();
      const dispatcher = ApiDispatcher.getInstance();
      const expectedData = [
        { key: 'coh-2026', name: 'Cohort 2026', active: true, startYear: 2025, startMonth: 9 },
      ];

      context.referenceDataControllerInstance.listCohorts.mockImplementation(() => expectedData);

      const response = dispatcher.handle({
        method: 'getCohorts',
      });

      expect(response.ok).toBe(true);
      expect(response.data).toEqual(expectedData);
      expect(response.data.ok).toBeUndefined();
      expect(response.data.error).toBeUndefined();
    });
  });

  describe('upsertAssignmentDefinition', () => {
    it('delegates successful upsertAssignmentDefinition requests and returns the standard success envelope', () => {
      const originalUpsertAssignmentDefinition = globalThis.upsertAssignmentDefinition_;
      const params = {
        primaryTitle: 'Algebra Baseline',
        primaryTopicKey: 'topic-algebra',
        yearGroupKey: 'year-group-10',
        referenceDocumentId: 'ref-doc-001',
        templateDocumentId: 'tpl-doc-001',
        taskWeightings: [{ taskId: 'task-1', taskWeighting: 25 }],
      };
      const expectedData = ASSIGNMENT_DEFINITION_RESULTS.getAssignmentDefinition;
      const upsertAssignmentDefinition_ = vi.fn(() => expectedData);

      globalThis.upsertAssignmentDefinition_ = upsertAssignmentDefinition_;

      try {
        const response = handleApiRequest('upsertAssignmentDefinition', params);

        expect(upsertAssignmentDefinition_).toHaveBeenCalledTimes(1);
        expect(upsertAssignmentDefinition_).toHaveBeenCalledWith(params);
        expect(response).toEqual({
          ok: true,
          requestId: response.requestId,
          data: expectedData,
        });
        expect(response.requestId).toEqual(expect.any(String));
      } finally {
        if (originalUpsertAssignmentDefinition === undefined) {
          delete globalThis.upsertAssignmentDefinition_;
        } else {
          globalThis.upsertAssignmentDefinition_ = originalUpsertAssignmentDefinition;
        }
      }
    });

    it('maps controller-thrown ApiValidationError from upsertAssignmentDefinition to INVALID_REQUEST', () => {
      const originalUpsertAssignmentDefinition = globalThis.upsertAssignmentDefinition_;
      const thrownError = new ApiValidationError('Invalid assignment-definition payload');
      const upsertAssignmentDefinition_ = vi.fn(() => {
        throw thrownError;
      });

      globalThis.upsertAssignmentDefinition_ = upsertAssignmentDefinition_;

      try {
        const response = handleApiRequest('upsertAssignmentDefinition', {
          primaryTitle: 'Algebra Baseline',
          primaryTopicKey: 'topic-algebra',
          yearGroupKey: 'year-group-10',
          referenceDocumentId: 'ref-doc-001',
          templateDocumentId: 'tpl-doc-001',
        });

        expectFailureEnvelope(response, {
          code: 'INVALID_REQUEST',
          message: 'Invalid assignment-definition payload',
          withRequestId: true,
        });
        expect(upsertAssignmentDefinition_).toHaveBeenCalledTimes(1);
        expectBoundaryFailureLog(context.errorSpy, {
          response,
          methodName: 'upsertAssignmentDefinition',
          thrownValue: thrownError,
        });
      } finally {
        if (originalUpsertAssignmentDefinition === undefined) {
          delete globalThis.upsertAssignmentDefinition_;
        } else {
          globalThis.upsertAssignmentDefinition_ = originalUpsertAssignmentDefinition;
        }
      }
    });
  });
});
