import { beforeEach, afterEach, afterAll, expect, vi } from 'vitest';
import {
  withGlobalMocks,
  withTemporaryGlobals,
  saveGlobals,
  restoreGlobals,
} from '../helpers/globalMockManager.js';

// Shared preamble for the ImageManager companion suites. Every test file still
// installs and restores its own BaseRequestManager global by calling the
// installers below at top level, so the per-file afterAll hook is registered
// against that file's own suite.

/**
 * The minimal BaseRequestManager parent used by the hermetic ImageManager
 * suites: batch sending that yields no outcomes.
 */
class DummyBaseRequestManager {
  /**
   * Sends no requests.
   *
   * @returns {Array} Always an empty outcome list.
   */
  sendRequestsInBatches() {
    return [];
  }
}

/**
 * The real BaseRequestManager parent, used by the suites that exercise the
 * shared transport.
 *
 * @returns {Function} The real BaseRequestManager class.
 */
function realBaseRequestManager() {
  return require('#backend/RequestHandlers/BaseRequestManager.js');
}

/**
 * Installs the dummy BaseRequestManager global for this test file and restores
 * the previous value after the file's tests complete.
 *
 * @returns {void}
 */
function installDummyBaseRequestManager() {
  const savedGlobals = saveGlobals(['BaseRequestManager']);
  globalThis.BaseRequestManager = globalThis.BaseRequestManager || DummyBaseRequestManager;
  afterAll(() => {
    restoreGlobals(savedGlobals);
  });
}

/**
 * Installs the real BaseRequestManager global for this test file and restores
 * the previous value after the file's tests complete.
 *
 * @returns {void}
 */
function installRealBaseRequestManager() {
  const savedGlobals = saveGlobals(['BaseRequestManager']);
  const RealBaseRequestManager = realBaseRequestManager();
  globalThis.BaseRequestManager = globalThis.BaseRequestManager || RealBaseRequestManager;
  afterAll(() => {
    restoreGlobals(savedGlobals);
  });
}

/**
 * Loads the artefact factory and the ImageManager under test.
 *
 * @returns {{ ArtifactFactory: Object, ImageManager: Function }} The backend
 *   modules required by the ImageManager suites.
 */
function loadImageManager() {
  const { ArtifactFactory } = require('#backend/Models/Artifacts/index.js');
  return {
    ArtifactFactory,
    ImageManager: require('#backend/RequestHandlers/ImageManager.js'),
  };
}

/**
 * Builds an ImageManager with the given overrides applied.
 *
 * @param {Object} [overrides] Properties assigned onto the new manager.
 * @returns {Object} The configured manager instance.
 */
function buildManager(overrides = {}) {
  const manager = new (loadImageManager().ImageManager)();
  Object.assign(manager, overrides);
  return manager;
}

/**
 * Builds an IMAGE artefact for the task-one fixture.
 *
 * @param {Function} ArtifactFactory The artefact factory.
 * @param {string} role The artefact role.
 * @param {string} sourceUrl The image source URL.
 * @param {string} [uid] An explicit artefact UID.
 * @returns {Object} The image artefact.
 */
function imageArtifact(ArtifactFactory, role, sourceUrl, uid = undefined) {
  return ArtifactFactory.image({
    type: 'image',
    taskId: 'task-one',
    role,
    metadata: { sourceUrl },
    taskIndex: 0,
    artifactIndex: 0,
    ...(uid ? { uid } : {}),
  });
}

/**
 * Builds an HTTP transport outcome for one request UID.
 *
 * @param {string} uid The request UID.
 * @param {number} status The HTTP response code.
 * @param {number} attempts The attempt count.
 * @param {Function} getBlob The native blob reader.
 * @returns {Object} The transport outcome.
 */
function httpOutcome(uid, status, attempts, getBlob) {
  return {
    uid,
    response: { getResponseCode: () => status, getBlob },
    error: null,
    attempts,
  };
}

/**
 * Builds a network-failure transport outcome for one request UID.
 *
 * @param {string} uid The request UID.
 * @param {Error} error The network error.
 * @param {number} attempts The attempt count.
 * @returns {Object} The transport outcome.
 */
function networkOutcome(uid, error, attempts) {
  return { uid, response: null, error, attempts };
}

/**
 * Installs the logger, configuration and OAuth-token globals used by the
 * transport-facing ImageManager suites.
 *
 * @returns {{ restore: Function }} The mock context restore handle.
 */
function installTransportGlobals() {
  return withGlobalMocks({
    ABLogger: () => ({
      getInstance: () => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() }),
    }),
    ConfigurationManager: () => ({
      getInstance: () => ({ getSlidesFetchBatchSize: () => 10 }),
    }),
    ScriptApp: () => ({ getOAuthToken: () => 'token' }),
  });
}

/**
 * Installs only the logger global used by the hermetic ImageManager suites.
 *
 * @returns {{ restore: Function }} The mock context restore handle.
 */
function installLoggerGlobals() {
  return withGlobalMocks({
    ABLogger: () => ({
      getInstance: () => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() }),
    }),
  });
}

/**
 * Registers the per-test global mock lifecycle for a suite: the installer runs
 * before each test and the restore handle plus all spies are released after it.
 *
 * @param {Function} installGlobals The installer returning a restore handle.
 * @returns {void}
 */
function useGlobalMockLifecycle(installGlobals) {
  let restoreGlobalsHandle;
  beforeEach(() => {
    restoreGlobalsHandle = installGlobals().restore;
  });
  afterEach(() => {
    restoreGlobalsHandle();
    vi.restoreAllMocks();
  });
}

/**
 * Registers the logger-only global mock lifecycle for a suite.
 *
 * @returns {void}
 */
function useLoggerGlobalMocks() {
  useGlobalMockLifecycle(installLoggerGlobals);
}

/**
 * Registers the transport global mock lifecycle for a suite.
 *
 * @returns {void}
 */
function useTransportGlobalMocks() {
  useGlobalMockLifecycle(installTransportGlobals);
}

/**
 * Proves the exact atomic all-three extraction IMAGE_HYDRATION_FAILED E
 * contract on a submission item.
 *
 * @param {Object} item The submission item to inspect.
 * @returns {void}
 */
function expectHydrationError(item) {
  for (const criterion of ['completeness', 'accuracy', 'spag']) {
    expect(item.getAssessment(criterion)).toMatchObject({
      score: 'E',
      reasoning: 'The submitted slide image could not be loaded.',
      error: { stage: 'extraction', code: 'IMAGE_HYDRATION_FAILED' },
    });
  }
}

/**
 * Proves the hydrated IMAGE failure stops LLM request generation for an
 * assignment.
 *
 * @param {Function} loadManager The LLM request manager harness loader.
 * @param {Object} assignment The assignment to generate requests for.
 * @returns {void}
 */
function expectLlmBypass(loadManager, assignment) {
  const context = loadManager({ fetchAll: vi.fn(), fetch: vi.fn(), sleep: vi.fn() });
  try {
    withTemporaryGlobals(context.globals, () => {
      delete require.cache[context.llmPath];
      const llm = new (require(context.llmPath))();
      expect(llm.generateRequestObjects(assignment)).toEqual([]);
      expect(context.scriptCache.get).not.toHaveBeenCalled();
    });
  } finally {
    vi.restoreAllMocks();
    context.restore();
  }
}

export {
  buildManager,
  expectHydrationError,
  expectLlmBypass,
  httpOutcome,
  imageArtifact,
  installDummyBaseRequestManager,
  installRealBaseRequestManager,
  loadImageManager,
  networkOutcome,
  useLoggerGlobalMocks,
  useTransportGlobalMocks,
};
