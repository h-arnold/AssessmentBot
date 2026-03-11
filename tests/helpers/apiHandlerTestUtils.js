const apiHandlerPath = '../../src/backend/z_Api/apiHandler.js';
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

function installApiMethodHandlers(vi, handlers) {
  const originals = {};

  Object.entries(handlers).forEach(([handlerName, handler]) => {
    originals[handlerName] = globalThis[handlerName];
    globalThis[handlerName] = vi.fn(handler);
  });

  return originals;
}

function restoreApiMethodHandlers(originals) {
  Object.entries(originals).forEach(([handlerName, originalValue]) => {
    restoreGlobal(handlerName, originalValue);
  });
}

function resetUserProperties() {
  globalThis.PropertiesService._resetUserProperties();
}

function setAuthorisationStatusHandler(vi, handler = () => ({ authorised: true })) {
  const originalGetAuthorisationStatus = globalThis.getAuthorisationStatus;
  globalThis.getAuthorisationStatus = vi.fn(handler);
  return originalGetAuthorisationStatus;
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
  const mockLoggerInstance = {
    debug: () => {},
    debugUi: () => {},
    info: infoSpy,
    warn: warnSpy,
    error: () => {},
    log: () => {},
  };
  globalThis.ABLogger = {
    getInstance: () => mockLoggerInstance,
  };
  return { originalABLogger, infoSpy, warnSpy };
}

/**
 * Sets up the common API handler test context and returns restoration handles.
 */
function setupApiHandlerTestContext(
  vi,
  {
    installLogger = false,
    installLock = false,
    handler = () => ({ authorised: true }),
    additionalHandlers = {},
  } = {}
) {
  resetUserProperties();

  const context = {
    originalApiMethodHandlers: installApiMethodHandlers(vi, {
      getAuthorisationStatus: handler,
      ...additionalHandlers,
    }),
  };

  if (installLogger) {
    Object.assign(context, installAbLoggerSpies(vi));
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

  restoreApiMethodHandlers(context.originalApiMethodHandlers);

  if ('originalABLogger' in context) {
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
  installApiMethodHandlers,
  restoreApiMethodHandlers,
  resetUserProperties,
  setAuthorisationStatusHandler,
  restoreGlobal,
  installLockServiceMock,
  installAbLoggerSpies,
  setupApiHandlerTestContext,
  teardownApiHandlerTestContext,
  buildStartedStore,
  persistUserRequestStore,
  readPersistedUserRequestStore,
  REFERENCE_DATA_API_METHOD_NAMES,
};
