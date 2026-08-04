/**
 * Tests for the triggerHandler entrypoint (ACTION_PLAN Section 8).
 *
 * src/backend/Triggers/triggerHandler.js has been delivered (green phase complete); the
 * top-level require below loads the production module.
 *
 * Contract under test:
 *   triggerHandler(event) validates the event first (missing/malformed event,
 *   unknown triggerUid → ABLogger.error + abort with NO cleanup), then
 *   authorises via AuthService.checkAccess({ bypassCache: true,
 *   requireConfigured: true, method: <context method> }) — denial → the
 *   handler logs the denial itself (ABLogger.warn, SPEC "If denied → log and
 *   abort") and cleans up. On success it dispatches to
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

// Module under test — created in the green phase (ACTION_PLAN Section 8).
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
      ConfigurationManager: () => ({
        getInstance: vi.fn(() => ({ getAuthGroupEmail: vi.fn(() => authGroup.value) })),
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

    it('logs the denial itself via ABLogger.warn and still cleans up when auth denies', () => {
      mockTriggerController.getTriggerContext.mockReturnValue({
        method: 'processSelectedAssignment',
        params: {
          assignmentId: 'assignment-456',
          definitionKey: 'Essay_1_defKey',
          courseId: 'course-123',
        },
      });
      // Bypass AuthService's own fail-open/fail-closed logging so the only
      // warn that can fire comes from the handler's own denial log (SPEC: "If
      // denied → log and abort").
      const checkAccessSpy = vi
        .spyOn(AuthService.getInstance(), 'checkAccess')
        .mockReturnValue({ allowed: false });

      triggerHandler({ triggerUid: 'trigger-uid-7' });

      expect(checkAccessSpy).toHaveBeenCalledTimes(1);
      expect(mockABLogger.warn).toHaveBeenCalled();
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

    it('fails closed when the auth group is unconfigured and requireConfigured is true', () => {
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

      // AuthService logs the fail-closed denial with an error for an
      // unconfigured group; the trigger must not dispatch.
      expect(mockABLogger.error).toHaveBeenCalled();
      expect(mockDispatchHandler).not.toHaveBeenCalled();
      expect(mockTriggerController.clearTriggerContext).toHaveBeenCalledWith('trigger-uid-11');
      expect(mockTriggerController.deleteTriggerById).toHaveBeenCalledWith('trigger-uid-11');
    });

    it('passes bypassCache and the context method to AuthService.checkAccess', () => {
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
        requireConfigured: true,
        method: 'processSelectedAssignment',
      });
      expect(mockDispatchHandler).toHaveBeenCalledTimes(1);
    });
  });
});
