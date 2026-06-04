import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  loadApiHandlerModule,
  getApiDispatcherInstance,
  callAuthorisationStatus,
  handleApiRequest,
  setupApiHandlerTestContext,
  teardownApiHandlerTestContext,
  expectFailureEnvelope,
  expectBoundaryFailureLog,
  expectBoundaryFailureConsoleErrorLog,
  readPersistedUserRequestStore,
  ABCLASS_TRANSPORT_RESULTS,
  ASSIGNMENT_DEFINITION_RESULTS,
  REFERENCE_DATA_PARAMS,
} = require('./shared.js');

describe('Api/apiHandler dispatcher — error handling, boundary logging and error type mapping', () => {
  let context;

  beforeEach(() => {
    context = setupApiHandlerTestContext(vi, {
      installLogger: true,
      googleClassroomsBehaviour: () => ABCLASS_TRANSPORT_RESULTS.getGoogleClassrooms,
      googleClassroomAssignmentsBehaviour: () =>
        ABCLASS_TRANSPORT_RESULTS.getGoogleClassroomAssignments,
      abclassMutationsBehaviour: {
        upsertABClass_: () => ABCLASS_TRANSPORT_RESULTS.upsertABClass,
        updateABClass_: () => ABCLASS_TRANSPORT_RESULTS.updateABClass,
        deleteABClass_: () => ABCLASS_TRANSPORT_RESULTS.deleteABClass,
      },
      assignmentDefinitionBehaviour: {
        getAssignmentDefinitionPartials_: () =>
          ASSIGNMENT_DEFINITION_RESULTS.getAssignmentDefinitionPartials,
        getAssignmentDefinition_: () => ASSIGNMENT_DEFINITION_RESULTS.getAssignmentDefinition,
        deleteAssignmentDefinition_: () => ASSIGNMENT_DEFINITION_RESULTS.deleteAssignmentDefinition,
      },
    });
  });

  afterEach(() => {
    teardownApiHandlerTestContext(vi, context);
  });

  describe('unexpected handler errors', () => {
    it('returns INTERNAL_ERROR when an allowlisted handler throws an unexpected error', () => {
      context.scriptAppManagerInstance.isAuthorised.mockImplementation(() => {
        throw new Error('dispatch exploded');
      });

      const { ApiDispatcher } = loadApiHandlerModule();
      const dispatcher = ApiDispatcher.getInstance();

      const response = dispatcher.handle({
        method: 'getAuthorisationStatus',
      });

      expect(response).toMatchObject({
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal API error.',
          retriable: false,
        },
      });
    });

    it('captures boundary error diagnostics for unexpected handler failures through the shared logger harness', () => {
      const thrownError = new Error('dispatch exploded');
      context.scriptAppManagerInstance.isAuthorised.mockImplementation(() => {
        throw thrownError;
      });

      const dispatcher = getApiDispatcherInstance();

      const response = callAuthorisationStatus(dispatcher);

      expect(response).toMatchObject({
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal API error.',
          retriable: false,
        },
      });
      expect(context.errorSpy).toHaveBeenCalledTimes(1);
      expect(context.errorSpy).toHaveBeenCalledWith(
        'API request failed.',
        expect.objectContaining({
          requestId: response.requestId,
          method: 'getAuthorisationStatus',
        }),
        thrownError
      );
    });
  });

  describe('real ABLogger integration', () => {
    it('preserves top-level Error details at the console.error seam when using the real ABLogger path', () => {
      teardownApiHandlerTestContext(vi, context);
      context = setupApiHandlerTestContext(vi, { installLogger: 'real' });

      const thrownError = new TypeError('dispatch exploded');
      context.scriptAppManagerInstance.isAuthorised.mockImplementation(() => {
        throw thrownError;
      });

      const dispatcher = getApiDispatcherInstance();

      const response = callAuthorisationStatus(dispatcher);

      expect(response).toMatchObject({
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal API error.',
          retriable: false,
        },
      });
      expect(context.consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(context.consoleErrorSpy).toHaveBeenCalledWith(
        'API request failed.',
        expect.objectContaining({
          requestId: response.requestId,
          method: 'getAuthorisationStatus',
        }),
        expect.objectContaining({
          name: thrownError.name,
          message: thrownError.message,
          stack: thrownError.stack,
        })
      );
    });

    it.each([
      ['info', 'consoleInfoSpy', 'Controlled downstream info before failure.'],
      ['warn', 'consoleWarnSpy', 'Controlled downstream warning before failure.'],
    ])(
      'preserves controlled downstream ABLogger.%s activity when the handler later fails',
      (loggerMethod, consoleSpyName, downstreamMessage) => {
        teardownApiHandlerTestContext(vi, context);
        context = setupApiHandlerTestContext(vi, {
          installLogger: 'real',
        });

        const thrownError = new Error('controlled downstream ' + loggerMethod + ' failure');
        context.scriptAppManagerInstance.isAuthorised.mockImplementation(() => {
          ABLogger.getInstance()[loggerMethod](downstreamMessage, {
            source: 'controlled-downstream-stub',
          });
          throw thrownError;
        });

        const dispatcher = getApiDispatcherInstance();

        const response = callAuthorisationStatus(dispatcher);

        expectFailureEnvelope(response, {
          code: 'INTERNAL_ERROR',
          message: 'Internal API error.',
          withRequestId: true,
        });
        expect(context[consoleSpyName]).toHaveBeenCalledWith(downstreamMessage, {
          source: 'controlled-downstream-stub',
        });

        expectBoundaryFailureConsoleErrorLog(context.consoleErrorSpy, {
          response,
          methodName: 'getAuthorisationStatus',
          thrownError,
        });
      }
    );

    it('preserves controlled downstream error traffic shaped like ProgressTracker developer logging when the request fails', () => {
      teardownApiHandlerTestContext(vi, context);
      context = setupApiHandlerTestContext(vi, {
        installLogger: 'real',
      });

      const thrownError = new Error('controlled downstream request-path failure');
      context.referenceDataControllerInstance.updateYearGroup.mockImplementation(() => {
        ABLogger.getInstance().error('ProgressTracker logged a user-facing error.', {
          errorMessage: 'Could not update the year group.',
        });
        ABLogger.getInstance().error('Developer details - Stack trace:', thrownError.stack);
        ABLogger.getInstance().error('Developer details - Message:', thrownError.message);
        ABLogger.getInstance().error('Developer details - Error type:', thrownError.name);
        throw thrownError;
      });

      const response = handleApiRequest('updateYearGroup', REFERENCE_DATA_PARAMS.updateYearGroup);

      expectFailureEnvelope(response, {
        code: 'INTERNAL_ERROR',
        message: 'Internal API error.',
        withRequestId: true,
      });

      expect(context.consoleErrorSpy).toHaveBeenCalledWith(
        'ProgressTracker logged a user-facing error.',
        { errorMessage: 'Could not update the year group.' }
      );
      expect(context.consoleErrorSpy).toHaveBeenCalledWith(
        'Developer details - Stack trace:',
        thrownError.stack
      );
      expect(context.consoleErrorSpy).toHaveBeenCalledWith(
        'Developer details - Message:',
        thrownError.message
      );
      expect(context.consoleErrorSpy).toHaveBeenCalledWith(
        'Developer details - Error type:',
        thrownError.name
      );

      const lastDownstreamLogIndex = context.consoleErrorSpy.mock.calls
        .map((args, index) => ({ args, index }))
        .findLast(({ args }) => args[0] !== 'API request failed.')?.index;
      const boundaryLogIndex = context.consoleErrorSpy.mock.calls.findIndex(
        (args) => args[0] === 'API request failed.'
      );

      expect(lastDownstreamLogIndex).toBeGreaterThanOrEqual(0);
      expect(boundaryLogIndex).toBeGreaterThan(lastDownstreamLogIndex);
      expectBoundaryFailureConsoleErrorLog(context.consoleErrorSpy, {
        response,
        methodName: 'updateYearGroup',
        thrownError,
      });
    });
  });

  describe('error type mapping', () => {
    it('maps ApiRateLimitError to RATE_LIMITED with retriable true', () => {
      const ApiRateLimitError = require('../../../src/backend/Utils/ErrorTypes/ApiRateLimitError.js');
      context.scriptAppManagerInstance.isAuthorised.mockImplementation(() => {
        throw new ApiRateLimitError('Rate limit exceeded', { requestId: 'req-map-rl' });
      });

      const { ApiDispatcher } = loadApiHandlerModule();
      const dispatcher = ApiDispatcher.getInstance();

      const response = dispatcher.handle({
        method: 'getAuthorisationStatus',
      });

      expect(response).toMatchObject({
        ok: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Rate limit exceeded',
          retriable: true,
        },
      });
    });

    it('maps ApiValidationError to INVALID_REQUEST with retriable false', () => {
      const ApiValidationError = require('../../../src/backend/Utils/ErrorTypes/ApiValidationError.js');
      context.scriptAppManagerInstance.isAuthorised.mockImplementation(() => {
        throw new ApiValidationError('Validation failed', { requestId: 'req-map-val' });
      });

      const { ApiDispatcher } = loadApiHandlerModule();
      const dispatcher = ApiDispatcher.getInstance();

      const response = dispatcher.handle({
        method: 'getAuthorisationStatus',
      });

      expect(response).toMatchObject({
        ok: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Validation failed',
          retriable: false,
        },
      });
    });

    it('maps ApiDisabledError to UNKNOWN_METHOD with retriable false', () => {
      const ApiDisabledError = require('../../../src/backend/Utils/ErrorTypes/ApiDisabledError.js');
      context.scriptAppManagerInstance.isAuthorised.mockImplementation(() => {
        throw new ApiDisabledError('Method is disabled', { requestId: 'req-map-dis' });
      });

      const { ApiDispatcher } = loadApiHandlerModule();
      const dispatcher = ApiDispatcher.getInstance();

      const response = dispatcher.handle({
        method: 'getAuthorisationStatus',
      });

      expect(response).toMatchObject({
        ok: false,
        error: {
          code: 'UNKNOWN_METHOD',
          message: 'Method is disabled',
          retriable: false,
        },
      });
    });

    it('maps known custom error names with missing message to INTERNAL_ERROR', () => {
      context.scriptAppManagerInstance.isAuthorised.mockImplementation(() => {
        const error = new Error('placeholder message');
        error.name = 'ApiValidationError';
        error.message = undefined;
        throw error;
      });

      const { ApiDispatcher } = loadApiHandlerModule();
      const dispatcher = ApiDispatcher.getInstance();

      const response = dispatcher.handle({
        method: 'getAuthorisationStatus',
      });

      expect(response).toMatchObject({
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal API error.',
          retriable: false,
        },
      });
    });

    it.each([
      ['ApiRateLimitError', '../../../src/backend/Utils/ErrorTypes/ApiRateLimitError.js'],
      ['ApiValidationError', '../../../src/backend/Utils/ErrorTypes/ApiValidationError.js'],
      ['ApiDisabledError', '../../../src/backend/Utils/ErrorTypes/ApiDisabledError.js'],
    ])('maps %s with a blank message to INTERNAL_ERROR', (_errorName, errorModulePath) => {
      const ApiErrorType = require(errorModulePath);
      context.scriptAppManagerInstance.isAuthorised.mockImplementation(() => {
        throw new ApiErrorType('   ', { requestId: 'req-blank-message' });
      });

      const dispatcher = getApiDispatcherInstance();

      const response = callAuthorisationStatus(dispatcher);

      expect(response).toMatchObject({
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal API error.',
          retriable: false,
        },
      });
    });

    it('logs non-Error thrown values deterministically while preserving the INTERNAL_ERROR envelope', () => {
      const thrownValue = { detail: 'plain-object-failure', severity: 'high' };
      context.scriptAppManagerInstance.isAuthorised.mockImplementation(() => {
        throw thrownValue;
      });

      const dispatcher = getApiDispatcherInstance();

      const response = callAuthorisationStatus(dispatcher);

      expect(response).toMatchObject({
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal API error.',
          retriable: false,
        },
      });
      expectBoundaryFailureLog(context.errorSpy, {
        response,
        methodName: 'getAuthorisationStatus',
        thrownValue,
      });
    });

    it('maps thrown errors to INTERNAL_ERROR', () => {
      context.scriptAppManagerInstance.isAuthorised.mockImplementation(() => {
        throw new Error('Simulated authorisation failure');
      });

      const { ApiDispatcher } = loadApiHandlerModule();
      const dispatcher = ApiDispatcher.getInstance();

      const response = dispatcher.handle({
        method: 'getAuthorisationStatus',
      });

      expect(response).toMatchObject({
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal API error.',
          retriable: false,
        },
      });
    });
  });

  describe('boundary logging order', () => {
    it('records the failed request during completion after boundary logging has run', () => {
      const requestId = 'req-boundary-before-completion';
      const callOrder = [];
      const hadUtilities = Object.hasOwn(globalThis, 'Utilities');
      const originalUtilities = globalThis.Utilities;
      const originalGetUserProperties = globalThis.PropertiesService.getUserProperties;
      const baseUserProperties = originalGetUserProperties.call(globalThis.PropertiesService);

      globalThis.Utilities = {
        getUuid: vi.fn(() => requestId),
      };
      globalThis.PropertiesService.getUserProperties = () => ({
        getProperty(key) {
          return baseUserProperties.getProperty(key);
        },
        setProperty(key, value) {
          const parsed = JSON.parse(value);
          if (parsed[requestId]?.status === 'started') {
            callOrder.push('admissionSave');
          }
          if (parsed[requestId]?.status === 'error') {
            callOrder.push('completionSave');
          }
          return baseUserProperties.setProperty(key, value);
        },
      });
      context.errorSpy.mockImplementation(() => {
        callOrder.push('boundaryLog');
      });
      context.scriptAppManagerInstance.isAuthorised.mockImplementation(() => {
        throw new Error('completion should follow boundary logging');
      });

      try {
        const dispatcher = getApiDispatcherInstance();

        const response = callAuthorisationStatus(dispatcher);

        expect(response).toMatchObject({
          ok: false,
          requestId,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Internal API error.',
            retriable: false,
          },
        });
        expect(readPersistedUserRequestStore()[requestId]).toMatchObject({
          status: 'error',
          errorMessage: 'Error: completion should follow boundary logging',
        });
        expect(callOrder).toEqual(expect.arrayContaining(['boundaryLog', 'completionSave']));
        expect(callOrder.indexOf('boundaryLog')).toBeLessThan(callOrder.indexOf('completionSave'));
      } finally {
        globalThis.PropertiesService.getUserProperties = originalGetUserProperties;
        if (hadUtilities) {
          globalThis.Utilities = originalUtilities;
        } else {
          delete globalThis.Utilities;
        }
      }
    });
  });
});
