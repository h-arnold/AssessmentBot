/**
 * Tests for the triggerHandler entrypoint (ACTION_PLAN Section 2).
 *
 * src/backend/Triggers/triggerHandler.js has been delivered (green phase complete); the
 * top-level require below loads the production module.
 *
 * Contract under test:
 *   triggerHandler(event) validates the event first (missing/malformed event,
 *   unknown triggerUid → ABLogger.error + abort with NO cleanup), then
 *   authorises via AuthService.checkAccess({ bypassCache: true,
 *   neverClaim: true, method: <context method> }) — denial →
 *   AuthService.checkAccess owns the denial log (logged exactly once inside
 *   the service), so the handler does NOT duplicate it here and only cleans
 *   up and aborts. On success it dispatches to
 *   TRIGGER_METHOD_HANDLERS[method](params) and cleans up in a finally block
 *   (clearTriggerContext + deleteTriggerById) for any resolved, known
 *   triggerUid — including when the dispatched handler throws, when the
 *   resolved method is not registered, and when the resolved context is
 *   partial. Only malformed input (missing event, no triggerUid, unknown
 *   triggerUid → null context) skips cleanup. GAS discards trigger return
 *   values, so failures surface via fail-loud logging and skipping execution
 *   only — no return envelope.
 *
 * AuthService is the real singleton (registered in tests/setupGlobals.js) with
 * the shared Session/GroupsApp/CacheService stubs, mirroring
 * tests/utils/authService/authService.test.js. The pure-mock globals
 * (ABLogger, TriggerController, TRIGGER_METHOD_HANDLERS, ConfigurationManager,
 * ProgressTracker) are installed per-test through withGlobalMocks so the
 * handler's own behaviour is observed hermetically and the globals are always
 * restored (globalMockManager pattern; see
 * docs/developer/backend/backend-testing.md).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { withGlobalMocks } from '../helpers/globalMockManager.js';

const AuthService = require('../../src/backend/Utils/AuthService.js');

// ── Mock handles (the pure-mock globals are installed in beforeEach) ─────────

const mockABLogger = {
  debug: vi.fn(),
  debugUi: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  log: vi.fn(),
};

const mockTriggerController = {
  getTriggerContext: vi.fn(),
  clearTriggerContext: vi.fn(),
  deleteTriggerById: vi.fn(),
};

const mockDispatchHandler = vi.fn();

// The handler's catch routes through ProgressTracker.logAndThrowError (the same
// seam AssignmentController.processSelectedAssignment uses). The mock rethrows
// so the error still propagates after the finally cleanup has run.
const mockProgressTracker = {
  startTracking: vi.fn(),
  updateProgress: vi.fn(),
  complete: vi.fn(),
  logError: vi.fn(),
  logAndThrowError: vi.fn((message, error) => {
    throw error || new Error(message);
  }),
};

const authGroup = { value: 'teachers@school.edu' };
const authMode = { value: 'googleGroups' };
const authUsers = { value: '' };
const authRevision = { value: '' };
// Freshness probe for the target resolver: triggers never claim, so this is
// false for a configured install and irrelevant for the never-claim rows.
const isFresh = { value: false };

// Module under test — created in the green phase (ACTION_PLAN Section 2).
const { triggerHandler } = require('../../src/backend/Triggers/triggerHandler.js');

describe('triggerHandler', () => {
  let restoreTriggerGlobals;

  beforeEach(() => {
    vi.clearAllMocks();
    AuthService.resetForTests();
    globalThis.CacheService._resetScriptCache();
    globalThis.Session._resetActiveUserEmail();
    globalThis.GroupsApp._resetGroups();
    authGroup.value = 'teachers@school.edu';
    authMode.value = 'googleGroups';
    authUsers.value = '';
    authRevision.value = '';
    isFresh.value = false;
    // Default baseline: no stored context for the resolved triggerUid.
    mockTriggerController.getTriggerContext.mockReturnValue(null);

    const mockContext = withGlobalMocks({
      ABLogger: () => ({ getInstance: vi.fn(() => mockABLogger) }),
      TriggerController: () =>
        vi.fn(function () {
          return mockTriggerController;
        }),
      TRIGGER_METHOD_HANDLERS: () => ({
        processSelectedAssignment: mockDispatchHandler,
      }),
      // Forward-compatible ConfigurationManager surface for the refactored
      // AuthService resolver: the raw property reads, auth-user accessors and
      // the freshness probe are exposed so the never-claim rows exercise the
      // resolver's deny path rather than throwing on a missing method.
      ConfigurationManager: () => ({
        getInstance: vi.fn(() => ({
          getAuthGroupEmail: vi.fn(() => authGroup.value),
          getAuthMode: vi.fn(() => authMode.value),
          getAuthUsers: vi.fn(() => authUsers.value),
          getAuthRevision: vi.fn(() => authRevision.value),
          getProperty: vi.fn((key) => {
            if (key === 'authGroupEmail') return authGroup.value;
            if (key === 'authMode') return authMode.value;
            if (key === 'authUsers') return authUsers.value;
            if (key === 'authRevision') return authRevision.value;
            return '';
          }),
          getAllConfigurations: vi.fn(() => ({
            authGroupEmail: authGroup.value,
            authMode: authMode.value,
            authUsers: authUsers.value,
            authRevision: authRevision.value,
          })),
          isFreshInstall: vi.fn(() => isFresh.value),
          writeConfigurationLocked: vi.fn(),
          setProperty: vi.fn(),
        })),
      }),
      ProgressTracker: () => ({ getInstance: vi.fn(() => mockProgressTracker) }),
    });
    restoreTriggerGlobals = mockContext.restore;
  });

  afterEach(() => {
    if (restoreTriggerGlobals) restoreTriggerGlobals();
    vi.restoreAllMocks();
    globalThis.Session._resetActiveUserEmail();
    globalThis.GroupsApp._resetGroups();
  });

  describe('input validation', () => {
    it('logs an error and performs no cleanup when the event is missing', () => {
      triggerHandler(undefined);

      expect(mockABLogger.error).toHaveBeenCalled();
      expect(mockTriggerController.getTriggerContext).not.toHaveBeenCalled();
      expect(mockTriggerController.clearTriggerContext).not.toHaveBeenCalled();
      expect(mockTriggerController.deleteTriggerById).not.toHaveBeenCalled();
      expect(mockDispatchHandler).not.toHaveBeenCalled();
    });

    it('logs an error and performs no cleanup when the event lacks a triggerUid', () => {
      triggerHandler({});

      expect(mockABLogger.error).toHaveBeenCalled();
      expect(mockTriggerController.getTriggerContext).not.toHaveBeenCalled();
      expect(mockTriggerController.clearTriggerContext).not.toHaveBeenCalled();
      expect(mockTriggerController.deleteTriggerById).not.toHaveBeenCalled();
      expect(mockDispatchHandler).not.toHaveBeenCalled();
    });

    it('logs an error and aborts without dispatch or cleanup when the triggerUid is unknown', () => {
      mockTriggerController.getTriggerContext.mockReturnValue(null);

      triggerHandler({ triggerUid: 'unknown-uid' });

      expect(mockTriggerController.getTriggerContext).toHaveBeenCalledWith('unknown-uid');
      expect(mockABLogger.error).toHaveBeenCalled();
      expect(mockTriggerController.clearTriggerContext).not.toHaveBeenCalled();
      expect(mockTriggerController.deleteTriggerById).not.toHaveBeenCalled();
      expect(mockDispatchHandler).not.toHaveBeenCalled();
    });

    it('logs an error, aborts dispatch, but still cleans up when the method is not registered', () => {
      mockTriggerController.getTriggerContext.mockReturnValue({
        method: 'noSuchTriggerMethod',
        params: {
          assignmentId: 'assignment-456',
          definitionKey: 'Essay_1_defKey',
          courseId: 'course-123',
        },
      });

      triggerHandler({ triggerUid: 'known-uid' });

      expect(mockTriggerController.getTriggerContext).toHaveBeenCalledWith('known-uid');
      expect(mockABLogger.error).toHaveBeenCalled();
      expect(mockDispatchHandler).not.toHaveBeenCalled();
      // The context WAS resolved, so the triggerUid is known — cleanup MUST run
      // to prevent trigger/key accumulation (SPEC cleanup ownership).
      expect(mockTriggerController.clearTriggerContext).toHaveBeenCalledWith('known-uid');
      expect(mockTriggerController.deleteTriggerById).toHaveBeenCalledWith('known-uid');
    });

    it('logs an error, aborts dispatch, and still cleans up when the context is partial (missing params)', () => {
      mockTriggerController.getTriggerContext.mockReturnValue({
        method: 'processSelectedAssignment',
        params: null,
      });

      triggerHandler({ triggerUid: 'partial-uid-1' });

      expect(mockTriggerController.getTriggerContext).toHaveBeenCalledWith('partial-uid-1');
      expect(mockABLogger.error).toHaveBeenCalled();
      expect(mockDispatchHandler).not.toHaveBeenCalled();
      expect(mockTriggerController.clearTriggerContext).toHaveBeenCalledWith('partial-uid-1');
      expect(mockTriggerController.deleteTriggerById).toHaveBeenCalledWith('partial-uid-1');
    });

    it('logs an error, aborts dispatch, and still cleans up when the context is partial (missing method)', () => {
      mockTriggerController.getTriggerContext.mockReturnValue({
        method: null,
        params: {
          assignmentId: 'assignment-456',
          definitionKey: 'Essay_1_defKey',
          courseId: 'course-123',
        },
      });

      triggerHandler({ triggerUid: 'partial-uid-2' });

      expect(mockTriggerController.getTriggerContext).toHaveBeenCalledWith('partial-uid-2');
      expect(mockABLogger.error).toHaveBeenCalled();
      expect(mockDispatchHandler).not.toHaveBeenCalled();
      expect(mockTriggerController.clearTriggerContext).toHaveBeenCalledWith('partial-uid-2');
      expect(mockTriggerController.deleteTriggerById).toHaveBeenCalledWith('partial-uid-2');
    });
  });

  describe('authorisation and dispatch', () => {
    it('dispatches the registered handler and cleans up in finally when auth passes', () => {
      const params = {
        assignmentId: 'assignment-456',
        definitionKey: 'Essay_1_defKey',
        courseId: 'course-123',
      };
      mockTriggerController.getTriggerContext.mockReturnValue({
        method: 'processSelectedAssignment',
        params,
      });

      triggerHandler({ triggerUid: 'trigger-uid-6' });

      expect(mockTriggerController.getTriggerContext).toHaveBeenCalledWith('trigger-uid-6');
      expect(mockDispatchHandler).toHaveBeenCalledTimes(1);
      expect(mockDispatchHandler).toHaveBeenCalledWith(params);
      expect(mockTriggerController.clearTriggerContext).toHaveBeenCalledWith('trigger-uid-6');
      expect(mockTriggerController.deleteTriggerById).toHaveBeenCalledWith('trigger-uid-6');
    });

    it('still cleans up when the dispatched handler throws, routing the failure through logAndThrowError', () => {
      const params = {
        assignmentId: 'assignment-456',
        definitionKey: 'Essay_1_defKey',
        courseId: 'course-123',
      };
      mockTriggerController.getTriggerContext.mockReturnValue({
        method: 'processSelectedAssignment',
        params,
      });
      mockDispatchHandler.mockImplementationOnce(() => {
        throw new Error('handler failure');
      });

      // The catch routes through ProgressTracker.logAndThrowError (the same
      // seam AssignmentController.processSelectedAssignment uses), which
      // rethrows; the finally block still runs cleanup for the resolved
      // triggerUid before the error propagates.
      expect(() => triggerHandler({ triggerUid: 'trigger-uid-6' })).toThrow('handler failure');

      expect(mockTriggerController.getTriggerContext).toHaveBeenCalledWith('trigger-uid-6');
      expect(mockDispatchHandler).toHaveBeenCalledTimes(1);
      expect(mockDispatchHandler).toHaveBeenCalledWith(params);
      expect(mockProgressTracker.logAndThrowError).toHaveBeenCalled();
      expect(mockTriggerController.clearTriggerContext).toHaveBeenCalledWith('trigger-uid-6');
      expect(mockTriggerController.deleteTriggerById).toHaveBeenCalledWith('trigger-uid-6');
    });

    it('aborts and cleans up when auth denies without duplicating the denial log', () => {
      mockTriggerController.getTriggerContext.mockReturnValue({
        method: 'processSelectedAssignment',
        params: {
          assignmentId: 'assignment-456',
          definitionKey: 'Essay_1_defKey',
          courseId: 'course-123',
        },
      });
      // AuthService.checkAccess owns the denial log (logged exactly once
      // inside the service), so the handler must NOT duplicate it here — it
      // only cleans up the resolved trigger and aborts.
      const checkAccessSpy = vi
        .spyOn(AuthService.getInstance(), 'checkAccess')
        .mockReturnValue({ allowed: false });

      triggerHandler({ triggerUid: 'trigger-uid-7' });

      expect(checkAccessSpy).toHaveBeenCalledTimes(1);
      expect(mockABLogger.warn).not.toHaveBeenCalled();
      expect(mockDispatchHandler).not.toHaveBeenCalled();
      expect(mockTriggerController.clearTriggerContext).toHaveBeenCalledWith('trigger-uid-7');
      expect(mockTriggerController.deleteTriggerById).toHaveBeenCalledWith('trigger-uid-7');
    });

    it('aborts without dispatch and still cleans up when the real AuthService denies', () => {
      globalThis.Session._setActiveUserEmail('outsider@school.edu');
      mockTriggerController.getTriggerContext.mockReturnValue({
        method: 'processSelectedAssignment',
        params: {
          assignmentId: 'assignment-456',
          definitionKey: 'Essay_1_defKey',
          courseId: 'course-123',
        },
      });

      triggerHandler({ triggerUid: 'trigger-uid-8' });

      // Integration path: the real AuthService denies the non-member and the
      // handler logs the denial (warn) before aborting and cleaning up.
      expect(mockABLogger.warn).toHaveBeenCalled();
      expect(mockDispatchHandler).not.toHaveBeenCalled();
      expect(mockTriggerController.clearTriggerContext).toHaveBeenCalledWith('trigger-uid-8');
      expect(mockTriggerController.deleteTriggerById).toHaveBeenCalledWith('trigger-uid-8');
    });

    it('fails closed under the never-claim trigger context when the auth group is unconfigured', () => {
      authGroup.value = '';
      mockTriggerController.getTriggerContext.mockReturnValue({
        method: 'processSelectedAssignment',
        params: {
          assignmentId: 'assignment-456',
          definitionKey: 'Essay_1_defKey',
          courseId: 'course-123',
        },
      });

      triggerHandler({ triggerUid: 'trigger-uid-11' });

      // No provider can be resolved for an unconfigured install, so the
      // never-claim trigger context must fail closed: AuthService logs the
      // denial with an error and the trigger must not dispatch.
      expect(mockABLogger.error).toHaveBeenCalled();
      expect(mockDispatchHandler).not.toHaveBeenCalled();
      expect(mockTriggerController.clearTriggerContext).toHaveBeenCalledWith('trigger-uid-11');
      expect(mockTriggerController.deleteTriggerById).toHaveBeenCalledWith('trigger-uid-11');
    });

    it('denies a stored none-mode trigger and cleans up without dispatching', () => {
      authMode.value = 'none';
      mockTriggerController.getTriggerContext.mockReturnValue({
        method: 'processSelectedAssignment',
        params: {
          assignmentId: 'assignment-456',
          definitionKey: 'Essay_1_defKey',
          courseId: 'course-123',
        },
      });

      triggerHandler({ triggerUid: 'trigger-uid-none' });

      // authMode 'none' no longer exists; a stored 'none' is a broken-config
      // deny and must never resurrect the old bypass dispatch. The caller is a
      // group member, so an accidental Google Groups fallback would dispatch.
      expect(mockDispatchHandler).not.toHaveBeenCalled();
      expect(mockTriggerController.clearTriggerContext).toHaveBeenCalledWith('trigger-uid-none');
      expect(mockTriggerController.deleteTriggerById).toHaveBeenCalledWith('trigger-uid-none');
    });

    it('passes bypassCache and the never-claim trigger context to AuthService.checkAccess', () => {
      mockTriggerController.getTriggerContext.mockReturnValue({
        method: 'processSelectedAssignment',
        params: {
          assignmentId: 'assignment-456',
          definitionKey: 'Essay_1_defKey',
          courseId: 'course-123',
        },
      });
      const checkAccessSpy = vi
        .spyOn(AuthService.getInstance(), 'checkAccess')
        .mockReturnValue({ allowed: true, role: 'user' });

      triggerHandler({ triggerUid: 'trigger-uid-12' });

      expect(checkAccessSpy).toHaveBeenCalledTimes(1);
      expect(checkAccessSpy).toHaveBeenCalledWith({
        bypassCache: true,
        neverClaim: true,
        method: 'processSelectedAssignment',
      });
      // The removed requireConfigured option must not appear anywhere in the call.
      expect(checkAccessSpy.mock.calls[0][0]).not.toHaveProperty('requireConfigured');
      expect(mockDispatchHandler).toHaveBeenCalledTimes(1);
    });

    it('still cleans up when the auth check throws for a known triggerUid', () => {
      mockTriggerController.getTriggerContext.mockReturnValue({
        method: 'processSelectedAssignment',
        params: {
          assignmentId: 'assignment-456',
          definitionKey: 'Essay_1_defKey',
          courseId: 'course-123',
        },
      });
      const checkAccessSpy = vi
        .spyOn(AuthService.getInstance(), 'checkAccess')
        .mockImplementation(() => {
          throw new Error('auth boom');
        });

      // The auth gate must be protected so cleanup still runs for the resolved
      // triggerUid when checkAccess throws — the error may propagate, but the
      // trigger context and the fired trigger must never leak.
      expect(() => triggerHandler({ triggerUid: 'known-uid' })).toThrow('auth boom');

      expect(checkAccessSpy).toHaveBeenCalledTimes(1);
      expect(mockDispatchHandler).not.toHaveBeenCalled();
      expect(mockTriggerController.clearTriggerContext).toHaveBeenCalledWith('known-uid');
      expect(mockTriggerController.deleteTriggerById).toHaveBeenCalledWith('known-uid');
    });
  });
});
