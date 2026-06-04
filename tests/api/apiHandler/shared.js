/**
 * Shared constants and helper functions for apiHandler test files.
 * Loaded via require() by each split test file.
 */

const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');

const apiHandlerPath = '../../../src/backend/z_Api/z_apiHandler.js';
const googleClassroomsHandlerPath = '../../../src/backend/z_Api/googleClassrooms.js';
const assignmentDefinitionPartialsPath = '../../../src/backend/z_Api/assignmentDefinitionPartials';
const apiConfigPath = '../../../src/backend/z_Api/apiConfig.js';
const abclassMutationsPath = '../../../src/backend/z_Api/abclassMutations.js';

const {
  callAuthorisationStatus,
  getApiDispatcherInstance,
  loadApiHandlerModule,
  readPersistedUserRequestStore,
  REFERENCE_DATA_API_METHOD_NAMES,
  setupApiHandlerTestContext,
  teardownApiHandlerTestContext,
} = require('../../helpers/apiHandlerTestUtils.js');
const ApiValidationError = require('../../../src/backend/Utils/ErrorTypes/ApiValidationError.js');

const ABCLASS_TRANSPORT_API_METHOD_NAMES = Object.freeze([
  'getGoogleClassroomAssignments',
  'getGoogleClassrooms',
  'upsertABClass',
  'updateABClass',
  'deleteABClass',
]);

const BACKEND_CONFIG_API_METHOD_NAMES = Object.freeze(['getBackendConfig', 'setBackendConfig']);

const ASSIGNMENT_DEFINITION_API_METHOD_NAMES = Object.freeze([
  'getAssignmentDefinitionPartials',
  'getAssignmentDefinition',
  'deleteAssignmentDefinition',
]);

const EXPECTED_ALLOWLISTED_METHOD_HANDLER_KEYS = Object.freeze([
  'getAuthorisationStatus',
  'getABClassPartials',
  ...ASSIGNMENT_DEFINITION_API_METHOD_NAMES,
  'upsertAssignmentDefinition',
  ...ABCLASS_TRANSPORT_API_METHOD_NAMES,
  ...BACKEND_CONFIG_API_METHOD_NAMES,
  ...REFERENCE_DATA_API_METHOD_NAMES,
]);

const ABCLASS_TRANSPORT_PARAMS = Object.freeze({
  getGoogleClassroomAssignments: { classId: 'course-001' },
  getGoogleClassrooms: {},
  upsertABClass: {
    classId: 'class-upsert-001',
    cohortKey: 'coh-2026',
    yearGroupKey: 'yg-10',
    courseLength: 2,
  },
  updateABClass: {
    classId: 'class-update-001',
    cohortKey: 'coh-2027',
    yearGroupKey: 'yg-11',
    courseLength: 2,
    active: true,
  },
  deleteABClass: {
    classId: 'class-delete-001',
  },
});

const ABCLASS_TRANSPORT_RESULTS = Object.freeze({
  getGoogleClassroomAssignments: [{ assignmentId: 'a1', title: 'Essay' }],
  getGoogleClassrooms: [{ classId: 'course-001', className: '10A Computer Science' }],
  upsertABClass: { classId: 'class-upsert-001', saved: true },
  updateABClass: { classId: 'class-update-001', updated: true },
  deleteABClass: { classId: 'class-delete-001', deleted: true },
});

const REFERENCE_DATA_RESULTS = Object.freeze({
  getCohorts: [
    { key: 'coh-2026', name: 'Cohort 2026', active: true, startYear: 2025, startMonth: 9 },
  ],
  createCohort: {
    key: 'coh-2026',
    name: 'Cohort 2026',
    active: true,
    startYear: 2025,
    startMonth: 9,
  },
  updateCohort: {
    key: 'coh-2025',
    name: 'Cohort 2026',
    active: false,
    startYear: 2025,
    startMonth: 9,
  },
  getYearGroups: [{ key: 'yg-10', name: 'Year 10' }],
  createYearGroup: { key: 'yg-10', name: 'Year 10' },
  updateYearGroup: { key: 'yg-9', name: 'Year 10' },
  getAssignmentTopics: [{ key: 'topic-algebra', name: 'Algebra' }],
  createAssignmentTopic: { key: 'topic-algebra', name: 'Algebra' },
  updateAssignmentTopic: { key: 'topic-algebra', name: 'Advanced Algebra' },
  // Delete handlers are intentionally transport-void; keep explicit nulls to avoid implicit undefined stubs.
  deleteCohort: null,
  deleteYearGroup: null,
  deleteAssignmentTopic: null,
});

const ASSIGNMENT_DEFINITION_RESULTS = Object.freeze({
  getAssignmentDefinitionPartials: [
    {
      primaryTitle: 'Algebra Baseline',
      primaryTopic: 'Algebra',
      courseId: 'course-001',
      yearGroupKey: 'year-group-10',
      alternateTitles: ['Algebra Starter'],
      alternateTopics: ['Linear Equations'],
      documentType: 'SLIDES',
      referenceDocumentId: 'ref-doc-001',
      templateDocumentId: 'tpl-doc-001',
      assignmentWeighting: null,
      definitionKey: 'algebra-baseline',
      tasks: null,
      createdAt: '2026-01-05T10:00:00.000Z',
      updatedAt: '2026-01-06T12:30:00.000Z',
    },
  ],
  getAssignmentDefinition: {
    definitionKey: 'algebra-baseline',
    primaryTitle: 'Algebra Baseline',
    primaryTopicKey: 'topic-algebra',
    primaryTopic: 'Algebra',
    yearGroupKey: 'year-group-10',
    yearGroupLabel: 'Year 10',
    alternateTitles: ['Algebra Starter'],
    alternateTopics: ['Linear Equations'],
    documentType: 'SLIDES',
    referenceDocumentId: 'ref-doc-001',
    templateDocumentId: 'tpl-doc-001',
    assignmentWeighting: 1,
    tasks: [{ taskId: 'task-1', taskTitle: 'Task 1', taskWeighting: 1 }],
    createdAt: '2026-01-05T10:00:00.000Z',
    updatedAt: '2026-01-06T12:30:00.000Z',
  },
  // deleteAssignmentDefinition handler returns undefined, which is coerced to null by _success()
  deleteAssignmentDefinition: null,
});

const ASSIGNMENT_DEFINITION_PARAMS = Object.freeze({
  getAssignmentDefinition: {
    definitionKey: 'algebra-baseline',
  },
  deleteAssignmentDefinition: {
    definitionKey: 'algebra-baseline',
  },
});

const REFERENCE_DATA_PARAMS = Object.freeze({
  createCohort: { record: { name: 'Cohort 2026', active: true } },
  updateCohort: {
    key: 'coh-2025',
    record: { key: 'coh-2025', name: 'Cohort 2026', active: false },
  },
  deleteCohort: { key: 'coh-2026' },
  createYearGroup: { record: { name: 'Year 10' } },
  updateYearGroup: {
    key: 'yg-9',
    record: { key: 'yg-9', name: 'Year 10' },
  },
  deleteYearGroup: { key: 'yg-10' },
  createAssignmentTopic: { record: { name: 'Algebra' } },
  updateAssignmentTopic: {
    key: 'topic-algebra',
    record: { key: 'topic-algebra', name: 'Advanced Algebra' },
  },
  deleteAssignmentTopic: { key: 'topic-algebra' },
});

const REFERENCE_DATA_CONTROLLER_METHODS_BY_API_METHOD = Object.freeze({
  getCohorts: 'listCohorts',
  getYearGroups: 'listYearGroups',
  getAssignmentTopics: 'listAssignmentTopics',
});

function getReferenceDataControllerMethodName(methodName) {
  return REFERENCE_DATA_CONTROLLER_METHODS_BY_API_METHOD[methodName] || methodName;
}

function getReferenceDataControllerMethodSpy(context, methodName) {
  return context.referenceDataControllerInstance[getReferenceDataControllerMethodName(methodName)];
}

function getAllowlistedHandlerSpy(context, handlerName) {
  if (REFERENCE_DATA_API_METHOD_NAMES.includes(handlerName)) {
    return getReferenceDataControllerMethodSpy(context, handlerName);
  }

  return context[`${handlerName}_`];
}

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
        retriable: false,
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
      retriable: false,
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

const INVALID_REQUEST_FAILURE_CASES = Object.freeze([
  {
    description:
      'maps controller validation failures for reference-data handlers to the existing API failure envelope',
    methodName: 'createCohort',
    params: REFERENCE_DATA_PARAMS.createCohort,
    handlerName: 'createCohort',
    errorMessage: 'Invalid cohort payload',
    requestId: 'req-create-cohort',
    withRequestId: false,
  },
  {
    description:
      'maps ApiValidationError from upsertABClass to INVALID_REQUEST and preserves the failure envelope shape',
    methodName: 'upsertABClass',
    params: ABCLASS_TRANSPORT_PARAMS.upsertABClass,
    handlerName: 'upsertABClass',
    errorMessage: 'Invalid ABClass payload',
    requestId: 'req-upsert-abclass',
    withRequestId: true,
  },
  {
    description:
      'maps ApiValidationError from updateABClass to INVALID_REQUEST and preserves the failure envelope shape',
    methodName: 'updateABClass',
    params: ABCLASS_TRANSPORT_PARAMS.updateABClass,
    handlerName: 'updateABClass',
    errorMessage: 'Invalid ABClass update payload',
    requestId: 'req-update-abclass',
    withRequestId: true,
  },
]);

const IN_USE_FAILURE_CASES = Object.freeze([
  {
    description:
      'maps a plain Error with reason = IN_USE from deleteCohort to error.code = IN_USE (delete-blocked contract)',
    methodName: 'deleteCohort',
    params: REFERENCE_DATA_PARAMS.deleteCohort,
    handlerName: 'deleteCohort',
    errorMessage: 'Cohort record is referenced by one or more classes',
  },
  {
    description:
      'maps a plain Error with reason = IN_USE from deleteYearGroup to error.code = IN_USE (delete-blocked contract)',
    methodName: 'deleteYearGroup',
    params: REFERENCE_DATA_PARAMS.deleteYearGroup,
    handlerName: 'deleteYearGroup',
    errorMessage: 'Year group record is referenced by one or more classes',
  },
  {
    description:
      'maps a plain Error with reason = IN_USE from deleteAssignmentTopic to error.code = IN_USE (delete-blocked contract)',
    methodName: 'deleteAssignmentTopic',
    params: REFERENCE_DATA_PARAMS.deleteAssignmentTopic,
    handlerName: 'deleteAssignmentTopic',
    errorMessage: 'Assignment topic record is referenced by one or more assignment definitions',
  },
]);

function clearGoogleClassroomsHandlerModuleCache() {
  delete require.cache[require.resolve(googleClassroomsHandlerPath)];
}

function loadRealGoogleClassroomsHandlerWithGlobals({ classroomApiClient } = {}) {
  clearGoogleClassroomsHandlerModuleCache();
  globalThis.ClassroomApiClient = classroomApiClient;
  return require(googleClassroomsHandlerPath).getGoogleClassrooms_;
}

function loadApiHandlerInVmContext({ globals = {} } = {}) {
  const source = fs.readFileSync(require.resolve(apiHandlerPath), 'utf8');
  const sandbox = { ...globals };

  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(`${source}\nthis.__exports = { apiHandler, ApiDispatcher };`, sandbox, {
    filename: 'apiHandler.js',
  });

  return {
    ...sandbox.__exports,
    context: sandbox,
  };
}

function loadModuleGlobalsInVmContext(modulePath, { globals = {} } = {}) {
  const source = fs.readFileSync(require.resolve(modulePath), 'utf8');
  const sandbox = { ...globals };

  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: modulePath });

  return sandbox;
}

function makeVmGlobals(overrides = {}) {
  const store = {};
  return {
    BaseSingleton: require('../../../src/backend/00_BaseSingleton.js'),
    LOCK_TIMEOUT_MS: 1000,
    LOCK_WAIT_WARN_THRESHOLD_MS: 300,
    ACTIVE_LIMIT: 25,
    LockService: {
      getUserLock() {
        return { tryLock: () => true, releaseLock: () => {} };
      },
    },
    PropertiesService: {
      getUserProperties() {
        return {
          getProperty: (k) => (Object.hasOwn(store, k) ? store[k] : null),
          setProperty: (k, v) => {
            store[k] = v;
          },
        };
      },
    },
    ABLogger: {
      getInstance: () => ({ warn: () => {}, info: () => {}, error: () => {}, debug: () => {} }),
    },
    Utilities: { getUuid: () => 'uuid-vm-default' },
    Validate:
      require('../../../src/backend/Utils/Validate.js').Validate ||
      require('../../../src/backend/Utils/Validate.js'),
    loadStore: () => ({}),
    saveStore: () => {},
    createStartedRecord: (id, method) => ({
      requestId: id,
      method,
      status: 'started',
      startedAtMs: Date.now(),
    }),
    markSuccess: (s, id) => {
      if (s[id]) s[id].status = 'success';
      return s;
    },
    markError: (s, id, msg) => {
      if (s[id]) {
        s[id].status = 'error';
        s[id].errorMessage = msg;
      }
      return s;
    },
    compactStore: (s) => s,
    STALE_REQUEST_AGE_MS: 15 * 60 * 1000,
    pruneStaleEntries: (s) => s,
    ApiRateLimitError: function ApiRateLimitError() {},
    ApiValidationError: function ApiValidationError() {},
    ApiDisabledError: function ApiDisabledError() {},
    ScriptAppManager: function ScriptAppManager() {
      this.isAuthorised = () => true;
    },
    ...overrides,
  };
}

/**
 * Shared behaviour configuration for dispatcher test setup.
 * Provides default transport behaviours for all allowed handlers.
 */
const DEFAULT_DISPATCHER_BEHAVIOUR = Object.freeze({
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

module.exports = {
  // Re-exports from apiHandlerTestUtils
  callAuthorisationStatus,
  getApiDispatcherInstance,
  loadApiHandlerModule,
  readPersistedUserRequestStore,
  REFERENCE_DATA_API_METHOD_NAMES,
  setupApiHandlerTestContext,
  teardownApiHandlerTestContext,
  ApiValidationError,

  // Paths
  apiHandlerPath,
  googleClassroomsHandlerPath,
  assignmentDefinitionPartialsPath,
  apiConfigPath,
  abclassMutationsPath,

  // Constants
  ABCLASS_TRANSPORT_API_METHOD_NAMES,
  BACKEND_CONFIG_API_METHOD_NAMES,
  ASSIGNMENT_DEFINITION_API_METHOD_NAMES,
  EXPECTED_ALLOWLISTED_METHOD_HANDLER_KEYS,
  ABCLASS_TRANSPORT_PARAMS,
  ABCLASS_TRANSPORT_RESULTS,
  REFERENCE_DATA_RESULTS,
  ASSIGNMENT_DEFINITION_RESULTS,
  ASSIGNMENT_DEFINITION_PARAMS,
  REFERENCE_DATA_PARAMS,
  REFERENCE_DATA_CONTROLLER_METHODS_BY_API_METHOD,
  INVALID_REQUEST_FAILURE_CASES,
  IN_USE_FAILURE_CASES,

  // Helper functions
  getReferenceDataControllerMethodName,
  getReferenceDataControllerMethodSpy,
  getAllowlistedHandlerSpy,
  handleApiRequest,
  expectFailureEnvelope,
  expectBoundaryFailureLog,
  expectBoundaryFailureConsoleErrorLog,
  clearGoogleClassroomsHandlerModuleCache,
  loadRealGoogleClassroomsHandlerWithGlobals,
  loadApiHandlerInVmContext,
  loadModuleGlobalsInVmContext,
  makeVmGlobals,

  // Shared dispatcher test lifecycle
  DEFAULT_DISPATCHER_BEHAVIOUR,
  setupDispatcherTest,
  teardownDispatcherTest,
};
