const fs = require('node:fs');
const vm = require('node:vm');
const { apiHandlerPath, googleClassroomsHandlerPath } = require('./sharedFixtures');

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
    BaseSingleton: require('#backend/00_BaseSingleton.js'),
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
      require('#backend/Utils/Validate.js').Validate || require('#backend/Utils/Validate.js'),
    loadStore_: () => ({}),
    saveStore_: () => {},
    createStartedRecord_: (id, method) => ({
      requestId: id,
      method,
      status: 'started',
      startedAtMs: Date.now(),
    }),
    markSuccess_: (s, id) => {
      if (s[id]) s[id].status = 'success';
      return s;
    },
    markError_: (s, id, msg) => {
      if (s[id]) {
        s[id].status = 'error';
        s[id].errorMessage = msg;
      }
      return s;
    },
    compactStore_: (s) => s,
    STALE_REQUEST_AGE_MS: 15 * 60 * 1000,
    pruneStaleEntries_: (s) => ({ store: s, prunedIds: [] }),
    ApiRateLimitError: function ApiRateLimitError() {},
    ApiValidationError: function ApiValidationError() {},
    ApiDisabledError: function ApiDisabledError() {},
    DefinitionStaleError: function DefinitionStaleError() {},
    ScriptAppManager: function ScriptAppManager() {
      this.isAuthorised = () => true;
    },
    // GAS globals required by the ApiDispatcher auth gate (z_apiHandler.js) in the
    // vm-simulated concatenated runtime. Defaults fail open so non-auth dispatch
    // tests proceed normally.
    AuthService: {
      getInstance() {
        return { checkAccess: () => ({ allowed: true, role: 'user' }) };
      },
    },
    ConfigurationManager: {
      getInstance() {
        return { getAuthGroupEmail: () => '' };
      },
    },
    ...overrides,
  };
}
module.exports = {
  clearGoogleClassroomsHandlerModuleCache,
  loadRealGoogleClassroomsHandlerWithGlobals,
  loadApiHandlerInVmContext,
  loadModuleGlobalsInVmContext,
  makeVmGlobals,
};
