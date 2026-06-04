import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  handleApiRequest,
  setupDispatcherTest,
  teardownDispatcherTest,
  ABCLASS_TRANSPORT_PARAMS,
  ABCLASS_TRANSPORT_RESULTS,
  ASSIGNMENT_DEFINITION_RESULTS,
  REFERENCE_DATA_PARAMS,
  INVALID_REQUEST_FAILURE_CASES,
  IN_USE_FAILURE_CASES,
  ApiValidationError,
  getReferenceDataControllerMethodSpy,
  getAllowlistedHandlerSpy,
  expectFailureEnvelope,
  expectBoundaryFailureLog,
} = require('./shared.js');

describe('Api/apiHandler dispatcher — envelope errors (IN_USE and INVALID_REQUEST)', () => {
  let context;

  beforeEach(() => {
    context = setupDispatcherTest(vi);
  });

  afterEach(() => {
    teardownDispatcherTest(vi, context);
  });

  describe('IN_USE failure cases', () => {
    it.each(IN_USE_FAILURE_CASES)(
      '$description',
      ({ methodName, params, handlerName, errorMessage }) => {
        const blockedError = new Error(errorMessage);
        blockedError.reason = 'IN_USE';
        const handlerSpy = getAllowlistedHandlerSpy(context, handlerName);
        handlerSpy.mockImplementation(() => {
          throw blockedError;
        });

        const response = handleApiRequest(methodName, params);

        expectFailureEnvelope(response, {
          code: 'IN_USE',
          message: expect.any(String),
          withRequestId: true,
        });
      }
    );

    it.each(IN_USE_FAILURE_CASES)(
      'emits one boundary diagnostic for $methodName delete-blocked failures while preserving the IN_USE envelope',
      ({ methodName, params, handlerName, errorMessage }) => {
        const blockedError = new Error(errorMessage);
        blockedError.reason = 'IN_USE';
        const handlerSpy = getAllowlistedHandlerSpy(context, handlerName);
        handlerSpy.mockImplementation(() => {
          throw blockedError;
        });

        const response = handleApiRequest(methodName, params);

        expectFailureEnvelope(response, {
          code: 'IN_USE',
          message: expect.any(String),
          withRequestId: true,
        });
        expectBoundaryFailureLog(context.errorSpy, {
          response,
          methodName,
          thrownValue: blockedError,
        });
      }
    );

    it('does not map a plain Error without reason = IN_USE to IN_USE (generic errors remain INTERNAL_ERROR)', () => {
      context.referenceDataControllerInstance.deleteCohort.mockImplementation(() => {
        throw new Error('Something else exploded');
      });

      const response = handleApiRequest('deleteCohort', REFERENCE_DATA_PARAMS.deleteCohort);

      expect(response).toMatchObject({
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          retriable: false,
        },
      });
    });

    it('maps unexpected controller failures for reference-data handlers to the existing API failure envelope', () => {
      context.referenceDataControllerInstance.updateYearGroup.mockImplementation(() => {
        throw new Error('year-group update exploded');
      });

      const response = handleApiRequest('updateYearGroup', REFERENCE_DATA_PARAMS.updateYearGroup);

      expectFailureEnvelope(response, {
        code: 'INTERNAL_ERROR',
        message: 'Internal API error.',
      });
    });

    it('maps unexpected failures from deleteABClass to INTERNAL_ERROR and preserves the failure envelope shape', () => {
      context.deleteABClass_.mockImplementation(() => {
        throw new Error('delete exploded');
      });

      const response = handleApiRequest('deleteABClass', ABCLASS_TRANSPORT_PARAMS.deleteABClass);

      expectFailureEnvelope(response, {
        code: 'INTERNAL_ERROR',
        message: 'Internal API error.',
        withRequestId: true,
      });
    });
  });

  describe('INVALID_REQUEST failure cases', () => {
    it.each(INVALID_REQUEST_FAILURE_CASES)(
      '$description',
      ({ methodName, params, handlerName, errorMessage, requestId, withRequestId }) => {
        const handlerSpy = getAllowlistedHandlerSpy(context, handlerName);
        handlerSpy.mockImplementation(() => {
          throw new ApiValidationError(errorMessage, { requestId });
        });

        const response = handleApiRequest(methodName, params);

        expectFailureEnvelope(response, {
          code: 'INVALID_REQUEST',
          message: errorMessage,
          withRequestId,
        });
      }
    );

    it.each(INVALID_REQUEST_FAILURE_CASES)(
      'emits one boundary diagnostic for $methodName validation failures while preserving the INVALID_REQUEST envelope',
      ({ methodName, params, handlerName, errorMessage, requestId, withRequestId }) => {
        const thrownError = new ApiValidationError(errorMessage, { requestId });
        const handlerSpy = getAllowlistedHandlerSpy(context, handlerName);
        handlerSpy.mockImplementation(() => {
          throw thrownError;
        });

        const response = handleApiRequest(methodName, params);

        expectFailureEnvelope(response, {
          code: 'INVALID_REQUEST',
          message: errorMessage,
          withRequestId,
        });
        expectBoundaryFailureLog(context.errorSpy, {
          response,
          methodName,
          thrownValue: thrownError,
        });
      }
    );
  });
});
