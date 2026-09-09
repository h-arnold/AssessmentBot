/**
 * Trigger execution-context contract tests.
 *
 * The trigger path must call AuthService.checkAccess with bypassCache: true and
 * the explicit never-claim flag (named `neverClaim`) — the removed
 * `requireConfigured` option must not appear anywhere in the call. Never-claim
 * semantics are exercised through the real AuthService singleton: triggers
 * never bootstrap an admin and never dispatch from a fresh install or from a
 * stored 'none' mode.
 *
 * checkAccess options contract encoded here and in
 * authServiceProviderResolution.test.js:
 *   { bypassCache?: boolean, neverClaim?: boolean, method?: string }
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { provisionAuthContext, createAbLoggerSpy } from './authServiceTestHarness.js';

const AuthService = require('../../../src/backend/Utils/AuthService.js');
const { triggerHandler } = require('../../../src/backend/Triggers/triggerHandler.js');

const RESOLVED_TRIGGER_CONTEXT = {
  method: 'processSelectedAssignment',
  params: {
    assignmentId: 'assignment-456',
    definitionKey: 'Essay_1_defKey',
    courseId: 'course-123',
  },
};

describe('AuthService trigger execution context', () => {
  let ctx;
  let mockTriggerController;
  let mockDispatchHandler;
  let mockProgressTracker;
  let mockABLogger;

  beforeEach(() => {
    AuthService.resetForTests();
    globalThis.CacheService._resetScriptCache();
    globalThis.Session._resetActiveUserEmail?.();
    globalThis.GroupsApp._resetGroups?.();
    mockABLogger = createAbLoggerSpy();
    mockTriggerController = {
      getTriggerContext: vi.fn(() => RESOLVED_TRIGGER_CONTEXT),
      clearTriggerContext: vi.fn(),
      deleteTriggerById: vi.fn(),
    };
    mockDispatchHandler = vi.fn();
    mockProgressTracker = {
      logError: vi.fn(),
      logAndThrowError: vi.fn((message, error) => {
        throw error || new Error(message);
      }),
    };
  });

  afterEach(() => {
    if (ctx) {
      ctx.restore();
      ctx = undefined;
    }
    vi.restoreAllMocks();
    AuthService.resetForTests();
    globalThis.Session._resetActiveUserEmail?.();
    globalThis.GroupsApp._resetGroups?.();
  });

  /**
   * Provisions the auth globals plus the trigger-handler globals.
   * @param {Object} options - Options forwarded to provisionAuthContext.
   * @returns {void}
   */
  function provisionTriggerContext(options) {
    ctx = provisionAuthContext({
      ...options,
      abLogger: mockABLogger,
      extraGlobals: {
        TriggerController: () =>
          vi.fn(function () {
            return mockTriggerController;
          }),
        TRIGGER_METHOD_HANDLERS: () => ({ processSelectedAssignment: mockDispatchHandler }),
        ProgressTracker: () => ({ getInstance: () => mockProgressTracker }),
      },
    });
  }

  it('passes bypassCache and the explicit never-claim flag to checkAccess, without requireConfigured', () => {
    provisionTriggerContext({
      config: { authMode: 'googleGroups', authGroupEmail: 'teachers@school.edu' },
    });
    const checkAccessSpy = vi
      .spyOn(AuthService.getInstance(), 'checkAccess')
      .mockReturnValue({ allowed: true, role: 'user' });

    triggerHandler({ triggerUid: 'trigger-uid-1' });

    expect(checkAccessSpy).toHaveBeenCalledTimes(1);
    expect(checkAccessSpy).toHaveBeenCalledWith({
      bypassCache: true,
      neverClaim: true,
      method: 'processSelectedAssignment',
    });
    expect(checkAccessSpy.mock.calls[0][0]).not.toHaveProperty('requireConfigured');
    expect(mockDispatchHandler).toHaveBeenCalledTimes(1);
  });

  it('denies a fresh-install trigger without claiming or dispatching', () => {
    provisionTriggerContext({
      config: {},
      fresh: true,
      members: { 'teacher@school.edu': 'MEMBER' },
    });

    triggerHandler({ triggerUid: 'trigger-uid-2' });

    expect(mockDispatchHandler).not.toHaveBeenCalled();
    expect(ctx.configManager.writeConfigurationLocked).not.toHaveBeenCalled();
    expect(ctx.configManager.setProperty).not.toHaveBeenCalled();
  });

  it('denies a stored none-mode trigger and never falls back to Google Groups', () => {
    provisionTriggerContext({
      config: { authMode: 'none', authGroupEmail: 'teachers@school.edu' },
      members: { 'teacher@school.edu': 'MEMBER' },
    });

    triggerHandler({ triggerUid: 'trigger-uid-3' });

    expect(mockDispatchHandler).not.toHaveBeenCalled();
    expect(ctx.groupsApp.getGroupByEmail).not.toHaveBeenCalled();
  });

  it('still dispatches a configured googleGroups trigger (never-claim does not affect configured providers)', () => {
    provisionTriggerContext({
      config: { authMode: 'googleGroups', authGroupEmail: 'teachers@school.edu' },
      members: { 'teacher@school.edu': 'MEMBER' },
    });

    triggerHandler({ triggerUid: 'trigger-uid-4' });

    expect(mockDispatchHandler).toHaveBeenCalledTimes(1);
  });
});
