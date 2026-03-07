const apiHandlerPath = '../../src/backend/Api/apiHandler.js';

function loadApiHandlerModule() {
  delete require.cache[require.resolve(apiHandlerPath)];
  return require(apiHandlerPath);
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

module.exports = {
  loadApiHandlerModule,
  resetUserProperties,
  setAuthorisationStatusHandler,
  restoreGlobal,
  installLockServiceMock,
  installAbLoggerSpies,
};
