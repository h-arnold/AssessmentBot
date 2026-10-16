/**
 * Compatibility facade for shared apiHandler test fixtures and helpers.
 * Keep this CommonJS path and its public exports stable for all dispatcher suites.
 */
const {
  callAuthorisationStatus,
  getApiDispatcherInstance,
  installLockServiceMock,
  loadApiHandlerModule,
  readPersistedUserRequestStore,
  REFERENCE_DATA_API_METHOD_NAMES,
  setupApiHandlerTestContext,
  teardownApiHandlerTestContext,
} = require('#test-helpers/apiHandlerTestUtils.js');
const ApiValidationError = require('#backend/Utils/ErrorTypes/ApiValidationError.js');
const fixtures = require('./sharedFixtures');
const vmHelpers = require('./vmHelpers');
const auth = require('./authTestContext');
const {
  apiHandlerPath,
  googleClassroomsHandlerPath,
  assignmentDefinitionTransportPath,
  apiConfigPath,
  abclassMutationsPath,
} = fixtures;

function handleApiRequest(method, params) {
  const { ApiDispatcher } = loadApiHandlerModule();
  return ApiDispatcher.getInstance().handle({
    method,
    ...(params === undefined ? {} : { params }),
  });
}

function expectFailureEnvelope(response, { code, message, withRequestId = false }) {
  if (withRequestId) {
    expect(response).toEqual({
      ok: false,
      requestId: response.requestId,
      error: {
        code,
        message,
        isRetriable: false,
      },
    });
    expect(response.requestId).toEqual(expect.any(String));
    return;
  }

  expect(response).toMatchObject({
    ok: false,
    error: {
      code,
      message,
      isRetriable: false,
    },
  });
}

function expectBoundaryFailureLog(errorSpy, { response, methodName, thrownValue }) {
  expect(errorSpy).toHaveBeenCalledTimes(1);
  expect(errorSpy).toHaveBeenCalledWith(
    'API request failed.',
    expect.objectContaining({
      requestId: response.requestId,
      method: methodName,
    }),
    thrownValue
  );
}

function expectBoundaryFailureConsoleErrorLog(
  consoleErrorSpy,
  { response, methodName, thrownError }
) {
  const boundaryCall = consoleErrorSpy.mock.calls.find(
    (args) =>
      args[0] === 'API request failed.' &&
      args[1]?.requestId === response.requestId &&
      args[1]?.method === methodName
  );

  expect(boundaryCall).toBeDefined();
  expect(boundaryCall[2]).toEqual(
    expect.objectContaining({
      name: thrownError.name,
      message: thrownError.message,
      stack: thrownError.stack,
    })
  );

  return boundaryCall;
}

/**
 * Shared behaviour configuration for dispatcher test setup.
 * Provides default transport behaviours for all allowed handlers.
 */
const DEFAULT_DISPATCHER_BEHAVIOUR = Object.freeze({
  installLogger: true,
  googleClassroomsBehaviour: () => fixtures.ABCLASS_TRANSPORT_RESULTS.getGoogleClassrooms,
  googleClassroomAssignmentsBehaviour: () =>
    fixtures.ABCLASS_TRANSPORT_RESULTS.getGoogleClassroomAssignments,
  abclassMutationsBehaviour: {
    upsertABClass_: () => fixtures.ABCLASS_TRANSPORT_RESULTS.upsertABClass,
    updateABClass_: () => fixtures.ABCLASS_TRANSPORT_RESULTS.updateABClass,
    deleteABClass_: () => fixtures.ABCLASS_TRANSPORT_RESULTS.deleteABClass,
    getABClass_: () => fixtures.ABCLASS_TRANSPORT_RESULTS.getABClass,
  },
  assignmentDefinitionBehaviour: {
    getAssignmentDefinitionPartials_: () =>
      fixtures.ASSIGNMENT_DEFINITION_RESULTS.getAssignmentDefinitionPartials,
    getAssignmentDefinition_: () => fixtures.ASSIGNMENT_DEFINITION_RESULTS.getAssignmentDefinition,
    deleteAssignmentDefinition_: () =>
      fixtures.ASSIGNMENT_DEFINITION_RESULTS.deleteAssignmentDefinition,
  },
});

/**
 * Creates the shared dispatcher test context with default behaviours.
 * Call inside beforeEach.
 *
 * @param {typeof import('vitest')} vi - Vitest instance
 * @returns {object} Test context
 */
function setupDispatcherTest(vi) {
  return setupApiHandlerTestContext(vi, DEFAULT_DISPATCHER_BEHAVIOUR);
}

/**
 * Tears down the shared dispatcher test context.
 * Call inside afterEach.
 *
 * @param {typeof import('vitest')} vi - Vitest instance
 * @param {object} context - Test context from setupDispatcherTest
 */
function teardownDispatcherTest(vi, context) {
  teardownApiHandlerTestContext(vi, context);
}

/**
 * Sets up the shared dispatcher test context plus the AuthService/GAS state the
 * auth suites reset around every test. The returned context carries an
 * `authEnvironment` slot for `createDispatcherAuthEnvironment`.
 * @param {typeof import('vitest')} vi - Vitest instance.
 * @returns {Object} The shared dispatcher context with an authEnvironment slot.
 */
function setupDispatcherAuthTest(vi) {
  return auth.setupDispatcherAuthTest(vi, setupDispatcherTest);
}

/**
 * Tears down the shared dispatcher test context and any provisioned auth
 * environment.
 * @param {typeof import('vitest')} vi - Vitest instance.
 * @param {Object} context - Context from setupDispatcherAuthTest.
 * @returns {void}
 */
function teardownDispatcherAuthTest(vi, context) {
  auth.teardownDispatcherAuthTest(vi, context, teardownDispatcherTest);
}

module.exports = {
  // Re-exports from apiHandlerTestUtils
  callAuthorisationStatus,
  getApiDispatcherInstance,
  installLockServiceMock,
  loadApiHandlerModule,
  readPersistedUserRequestStore,
  REFERENCE_DATA_API_METHOD_NAMES,
  setupApiHandlerTestContext,
  teardownApiHandlerTestContext,
  ApiValidationError,
  // Constants and fixture helpers
  ...fixtures,
  ...vmHelpers,
  // Dispatcher auth-environment lifecycle
  createDispatcherAuthEnvironment: auth.createDispatcherAuthEnvironment,
  setupDispatcherAuthTest,
  teardownDispatcherAuthTest,
  // Paths
  apiHandlerPath,
  googleClassroomsHandlerPath,
  assignmentDefinitionTransportPath,
  apiConfigPath,
  abclassMutationsPath,
  // Helper functions
  handleApiRequest,
  expectFailureEnvelope,
  expectBoundaryFailureLog,
  expectBoundaryFailureConsoleErrorLog,
  // Shared dispatcher test lifecycle
  DEFAULT_DISPATCHER_BEHAVIOUR,
  setupDispatcherTest,
  teardownDispatcherTest,
};
