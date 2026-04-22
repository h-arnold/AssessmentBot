const apiHandlerPath = '../../src/backend/z_Api/z_apiHandler.js';
const { USER_REQUEST_STORE_KEY } = require('../../src/backend/z_Api/apiConstants.js');

const REFERENCE_DATA_API_METHOD_NAMES = Object.freeze([
  'getCohorts',
  'createCohort',
  'updateCohort',
  'deleteCohort',
  'getYearGroups',
  'createYearGroup',
  'updateYearGroup',
  'deleteYearGroup',
  'getAssignmentTopics',
  'createAssignmentTopic',
  'updateAssignmentTopic',
  'deleteAssignmentTopic',
]);

function loadApiHandlerModule() {
  delete require.cache[require.resolve(apiHandlerPath)];
  return require(apiHandlerPath);
}

function getApiDispatcherInstance() {
  const { ApiDispatcher } = loadApiHandlerModule();
  return ApiDispatcher.getInstance();
}

function callAuthorisationStatus(dispatcher, request = {}) {
  return dispatcher.handle({
    method: 'getAuthorisationStatus',
    ...request,
  });
}

function installTransportHelperMocks(
  vi,
  {
    googleClassroomsBehaviour = () => undefined,
    abclassMutationsBehaviour = {},
    assignmentDefinitionBehaviour = {},
  } = {}
) {
  const originals = {
    getGoogleClassrooms_: globalThis.getGoogleClassrooms_,
    upsertABClass_: globalThis.upsertABClass_,
    updateABClass_: globalThis.updateABClass_,
    deleteABClass_: globalThis.deleteABClass_,
    getAssignmentDefinitionPartials_: globalThis.getAssignmentDefinitionPartials_,
    deleteAssignmentDefinition_: globalThis.deleteAssignmentDefinition_,
  };

  const getGoogleClassrooms_ = vi.fn(googleClassroomsBehaviour);
  const upsertABClass_ = vi.fn(abclassMutationsBehaviour.upsertABClass_ || (() => undefined));
  const updateABClass_ = vi.fn(abclassMutationsBehaviour.updateABClass_ || (() => undefined));
  const deleteABClass_ = vi.fn(abclassMutationsBehaviour.deleteABClass_ || (() => undefined));
  const getAssignmentDefinitionPartials_ = vi.fn(
    assignmentDefinitionBehaviour.getAssignmentDefinitionPartials_ || (() => undefined)
  );
  const deleteAssignmentDefinition_ = vi.fn(
    assignmentDefinitionBehaviour.deleteAssignmentDefinition_ || (() => undefined)
  );

  globalThis.getGoogleClassrooms_ = getGoogleClassrooms_;
  globalThis.upsertABClass_ = upsertABClass_;
  globalThis.updateABClass_ = updateABClass_;
  globalThis.deleteABClass_ = deleteABClass_;
  globalThis.getAssignmentDefinitionPartials_ = getAssignmentDefinitionPartials_;
  globalThis.deleteAssignmentDefinition_ = deleteAssignmentDefinition_;

  return {
    originals,
    getGoogleClassrooms_,
    upsertABClass_,
    updateABClass_,
    deleteABClass_,
    getAssignmentDefinitionPartials_,
    deleteAssignmentDefinition_,
  };
}

function restoreTransportHelperMocks(originals) {
  restoreGlobal('getGoogleClassrooms_', originals.getGoogleClassrooms_);
  restoreGlobal('upsertABClass_', originals.upsertABClass_);
  restoreGlobal('updateABClass_', originals.updateABClass_);
  restoreGlobal('deleteABClass_', originals.deleteABClass_);
  restoreGlobal('getAssignmentDefinitionPartials_', originals.getAssignmentDefinitionPartials_);
  restoreGlobal('deleteAssignmentDefinition_', originals.deleteAssignmentDefinition_);
}

function installControllerMocks(
  vi,
  {
    handler = () => true,
    scriptAppManagerBehaviour = {},
    abClassControllerBehaviour = {},
    referenceDataControllerBehaviour = {},
  } = {}
) {
  const originals = {
    ScriptAppManager: globalThis.ScriptAppManager,
    ABClassController: globalThis.ABClassController,
    ReferenceDataController: globalThis.ReferenceDataController,
  };

  const scriptAppManagerInstance = {
    isAuthorised: vi.fn(handler),
    ...scriptAppManagerBehaviour,
  };
  const scriptAppManagerCtor = vi.fn(function ScriptAppManagerMock() {
    return scriptAppManagerInstance;
  });

  const abClassControllerInstance = {
    getAllClassPartials: vi.fn(),
    ...abClassControllerBehaviour,
  };
  const abClassControllerCtor = vi.fn(function ABClassControllerMock() {
    return abClassControllerInstance;
  });

  const referenceDataControllerInstance = {
    listCohorts: vi.fn(),
    createCohort: vi.fn(),
    updateCohort: vi.fn(),
    deleteCohort: vi.fn(),
    listYearGroups: vi.fn(),
    createYearGroup: vi.fn(),
    updateYearGroup: vi.fn(),
    deleteYearGroup: vi.fn(),
    listAssignmentTopics: vi.fn(),
    createAssignmentTopic: vi.fn(),
    updateAssignmentTopic: vi.fn(),
    deleteAssignmentTopic: vi.fn(),
    ...referenceDataControllerBehaviour,
  };
  const referenceDataControllerCtor = vi.fn(function ReferenceDataControllerMock() {
    return referenceDataControllerInstance;
  });

  globalThis.ScriptAppManager = scriptAppManagerCtor;
  globalThis.ABClassController = abClassControllerCtor;
  globalThis.ReferenceDataController = referenceDataControllerCtor;

  return {
    originals,
    scriptAppManagerCtor,
    scriptAppManagerInstance,
    abClassControllerCtor,
    abClassControllerInstance,
    referenceDataControllerCtor,
    referenceDataControllerInstance,
  };
}

function restoreControllerMocks(originals) {
  restoreGlobal('ScriptAppManager', originals.ScriptAppManager);
  restoreGlobal('ABClassController', originals.ABClassController);
  restoreGlobal('ReferenceDataController', originals.ReferenceDataController);
}

function resetUserProperties() {
  globalThis.PropertiesService._resetUserProperties();
}

function restoreGlobal(globalKey, originalValue) {
  if (originalValue === undefined) {
    delete globalThis[globalKey];
    return;
  }
  globalThis[globalKey] = originalValue;
}

function installLockServiceMock(vi) {
  const originalLockService = globalThis.LockService;
  const mockLock = { tryLock: vi.fn(() => true), releaseLock: vi.fn() };
  globalThis.LockService = {
    getUserLock: vi.fn(() => mockLock),
  };
  return { originalLockService, mockLock };
}

function installAbLoggerSpies(vi) {
  const originalABLogger = globalThis.ABLogger;
  const infoSpy = vi.fn();
  const warnSpy = vi.fn();
  const errorSpy = vi.fn();
  const mockLoggerInstance = {
    debug: () => {},
    debugUi: () => {},
    info: infoSpy,
    warn: warnSpy,
    error: errorSpy,
    log: () => {},
  };
  globalThis.ABLogger = {
    getInstance: () => mockLoggerInstance,
  };
  return { originalABLogger, infoSpy, warnSpy, errorSpy };
}

function installRealAbLoggerSpies(vi) {
  const originalABLogger = globalThis.ABLogger;
  const ABLogger = require('../../src/backend/Utils/ABLogger.js');

  if (typeof ABLogger.resetForTests === 'function') {
    ABLogger.resetForTests();
  }

  globalThis.ABLogger = ABLogger;

  const loggerInstance = ABLogger.getInstance();
  const errorSpy = vi.spyOn(loggerInstance, 'error');
  const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
  const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

  return {
    originalABLogger,
    errorSpy,
    consoleErrorSpy,
    consoleInfoSpy,
    consoleWarnSpy,
  };
}

/**
 * Sets up the common API handler test context and returns restoration handles.
 */
function setupApiHandlerTestContext(
  vi,
  {
    installLogger = false,
    installLock = false,
    handler = () => true,
    googleClassroomsBehaviour,
    abclassMutationsBehaviour,
    assignmentDefinitionBehaviour,
  } = {}
) {
  resetUserProperties();

  const controllerMocks = installControllerMocks(vi, { handler });
  const transportHelperMocks = installTransportHelperMocks(vi, {
    googleClassroomsBehaviour,
    abclassMutationsBehaviour,
    assignmentDefinitionBehaviour,
  });

  const context = {
    ...controllerMocks,
    ...transportHelperMocks,
    originalControllerMocks: controllerMocks.originals,
    originalTransportHelperMocks: transportHelperMocks.originals,
  };

  const loggerMode = installLogger === true ? 'mock' : installLogger;

  if (loggerMode === 'mock') {
    Object.assign(context, installAbLoggerSpies(vi));
  }

  if (loggerMode === 'real') {
    Object.assign(context, installRealAbLoggerSpies(vi));
  }

  if (installLock) {
    Object.assign(context, installLockServiceMock(vi));
  }

  return context;
}

/**
 * Restores globals and mock state created by setupApiHandlerTestContext.
 */
function teardownApiHandlerTestContext(vi, context) {
  resetUserProperties();

  restoreControllerMocks(context.originalControllerMocks);
  restoreTransportHelperMocks(context.originalTransportHelperMocks);

  if ('originalABLogger' in context) {
    if (typeof globalThis.ABLogger?.resetForTests === 'function') {
      globalThis.ABLogger.resetForTests();
    }
    restoreGlobal('ABLogger', context.originalABLogger);
  }

  if ('originalLockService' in context) {
    restoreGlobal('LockService', context.originalLockService);
  }

  vi.restoreAllMocks();
}

/**
 * Builds a request-store object containing started entries.
 */
function buildStartedStore(count, prefix, startedAtMs, method = 'getAuthorisationStatus') {
  const store = {};
  for (let index = 0; index < count; index++) {
    const id = `${prefix}-${index}`;
    store[id] = {
      requestId: id,
      method,
      status: 'started',
      startedAtMs,
    };
  }
  return store;
}

/**
 * Reads the persisted user request store used by apiHandler admission/completion flow.
 * Returns the parsed store object, or an empty object if nothing has been persisted.
 */
function readPersistedUserRequestStore() {
  const raw = globalThis.PropertiesService.getUserProperties().getProperty(USER_REQUEST_STORE_KEY);
  return raw ? JSON.parse(raw) : {};
}

/**
 * Persists the user request store used by apiHandler admission/completion flow.
 */
function persistUserRequestStore(store) {
  globalThis.PropertiesService.getUserProperties().setProperty(
    USER_REQUEST_STORE_KEY,
    JSON.stringify(store)
  );
}

module.exports = {
  loadApiHandlerModule,
  getApiDispatcherInstance,
  callAuthorisationStatus,
  setupApiHandlerTestContext,
  teardownApiHandlerTestContext,
  buildStartedStore,
  persistUserRequestStore,
  readPersistedUserRequestStore,
  REFERENCE_DATA_API_METHOD_NAMES,
};
