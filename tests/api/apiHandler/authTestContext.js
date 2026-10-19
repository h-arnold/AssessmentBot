const withGlobalMocks = require('#test-helpers/globalMockManager.js').withGlobalMocks;
const AuthService = require('#backend/Utils/AuthService.js');
/** The default configured Google Groups email used by the dispatcher auth suites. */
const DEFAULT_AUTH_GROUP_EMAIL = 'teachers@school.edu';

/**
 * Provisions a mocked ConfigurationManager whose stored auth state is a
 * googleGroups install with the supplied group email. This is what the
 * dispatcher auth gate and the auth-endpoint admission phase read to decide the
 * membership lookup target and to detect broken configuration.
 * @param {typeof import('vitest')} vi - Vitest instance.
 * @param {Object} [options] - Mock configuration.
 * @param {string} [options.groupEmail=DEFAULT_AUTH_GROUP_EMAIL] - The stored group email.
 * @returns {{ configManager: Object, restore: Function }} The installed auth environment.
 */
function createDispatcherAuthEnvironment(vi, { groupEmail = DEFAULT_AUTH_GROUP_EMAIL } = {}) {
  const configManager = {
    getAuthGroupEmail: vi.fn(() => groupEmail),
    getAuthMode: vi.fn(() => 'googleGroups'),
    getAuthUsers: vi.fn(() => ''),
    getAuthRevision: vi.fn(() => ''),
    getProperty: vi.fn((key) => {
      if (key === 'authGroupEmail') return groupEmail;
      if (key === 'authMode') return 'googleGroups';
      return '';
    }),
    getAllConfigurations: vi.fn(() => ({
      authMode: 'googleGroups',
      authGroupEmail: groupEmail,
    })),
    isFreshInstall: vi.fn(() => false),
    writeConfigurationLocked: vi.fn(),
    setProperty: vi.fn(),
  };
  const mockContext = withGlobalMocks({
    ConfigurationManager: () => ({ getInstance: () => configManager }),
  });
  return { configManager, restore: mockContext.restore };
}

/**
 * Sets up the shared dispatcher test context plus the AuthService/GAS state the
 * auth suites reset around every test. The returned context carries an
 * `authEnvironment` slot for `createDispatcherAuthEnvironment`.
 * @param {typeof import('vitest')} vi - Vitest instance.
 * @param {(vi: typeof import('vitest')) => Object} setupDispatcherTest - Creates the shared dispatcher context.
 * @returns {Object} The shared dispatcher context with an authEnvironment slot.
 */
function setupDispatcherAuthTest(vi, setupDispatcherTest) {
  const context = setupDispatcherTest(vi);
  AuthService.resetForTests();
  globalThis.CacheService._resetScriptCache();
  globalThis.Session._resetActiveUserEmail?.();
  globalThis.GroupsApp._resetGroups?.();
  context.authEnvironment = undefined;
  return context;
}

/**
 * Tears down the shared dispatcher test context and any provisioned auth
 * environment.
 * @param {typeof import('vitest')} vi - Vitest instance.
 * @param {Object} context - Context from setupDispatcherAuthTest.
 * @param {(vi: typeof import('vitest'), context: Object) => void} teardownDispatcherTest - Tears down the shared dispatcher context.
 * @returns {void}
 */
function teardownDispatcherAuthTest(vi, context, teardownDispatcherTest) {
  if (context.authEnvironment) {
    context.authEnvironment.restore();
    context.authEnvironment = undefined;
  }
  teardownDispatcherTest(vi, context);
  AuthService.resetForTests();
  globalThis.Session._resetActiveUserEmail?.();
  globalThis.GroupsApp._resetGroups?.();
}
module.exports = {
  DEFAULT_AUTH_GROUP_EMAIL,
  createDispatcherAuthEnvironment,
  setupDispatcherAuthTest,
  teardownDispatcherAuthTest,
};
