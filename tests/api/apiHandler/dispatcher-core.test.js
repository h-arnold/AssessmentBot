import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  loadApiHandlerModule,
  getApiDispatcherInstance,
  callAuthorisationStatus,
  setupDispatcherTest,
  teardownDispatcherTest,
  ABCLASS_TRANSPORT_RESULTS,
  ASSIGNMENT_DEFINITION_RESULTS,
} = require('./shared.js');

describe('Api/apiHandler dispatcher — core dispatch, validation and request ID', () => {
  let context;

  beforeEach(() => {
    context = setupDispatcherTest(vi);
  });

  afterEach(() => {
    teardownDispatcherTest(vi, context);
  });

  it('accepts a valid request and returns a success envelope for an allowlisted method', () => {
    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();

    const response = dispatcher.handle({
      method: 'hasScriptAuthorisation',
      params: {},
    });

    expect(response).toMatchObject({
      ok: true,
      data: true,
    });
  });

  it('routes hasScriptAuthorisation through ScriptAppManager and returns true when authorised', () => {
    context.scriptAppManagerInstance.isAuthorised.mockReturnValueOnce(true);

    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();

    const response = dispatcher.handle({
      method: 'hasScriptAuthorisation',
    });

    expect(context.scriptAppManagerCtor).toHaveBeenCalledTimes(1);
    expect(context.scriptAppManagerInstance.isAuthorised).toHaveBeenCalledTimes(1);
    expect(response).toMatchObject({ ok: true, data: true });
  });

  it('routes hasScriptAuthorisation through ScriptAppManager and returns false when not authorised', () => {
    context.scriptAppManagerInstance.isAuthorised.mockReturnValueOnce(false);

    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();

    const response = dispatcher.handle({
      method: 'hasScriptAuthorisation',
    });

    expect(context.scriptAppManagerCtor).toHaveBeenCalledTimes(1);
    expect(context.scriptAppManagerInstance.isAuthorised).toHaveBeenCalledTimes(1);
    expect(response).toMatchObject({ ok: true, data: false });
  });

  it.each([
    ['null request', null],
    ['number request', 42],
    ['string request', 'not-an-object'],
    ['boolean request', false],
    ['array request', []],
    ['function request', () => ({})],
    ['empty object request', {}],
  ])('rejects invalid request: %s', (_caseName, request) => {
    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();

    const response = dispatcher.handle(request);

    expect(response.ok).toBe(false);
    expect(response.error).toMatchObject({
      code: 'INVALID_REQUEST',
    });
  });

  it.each([
    ['missing method', { params: {} }],
    ['blank method', { method: '   ', params: {} }],
  ])('rejects request with %s', (_caseName, request) => {
    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();

    const response = dispatcher.handle(request);

    expect(response.ok).toBe(false);
    expect(response.error).toMatchObject({
      code: 'INVALID_REQUEST',
    });
  });

  it('returns UNKNOWN_METHOD for a non-allowlisted method', () => {
    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();

    const response = dispatcher.handle({
      method: 'deleteEverything',
    });

    expect(response).toMatchObject({
      ok: false,
      error: {
        code: 'UNKNOWN_METHOD',
      },
    });
  });

  it('rejects a real global handler when the method is not allowlisted', () => {
    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();
    const syntheticHandlerName = 'syntheticNonAllowlistedHandler';
    const originalHandler = globalThis[syntheticHandlerName];
    globalThis[syntheticHandlerName] = vi.fn(() => ({ accepted: false }));

    try {
      const response = dispatcher.handle({
        method: syntheticHandlerName,
        params: { traceId: 'synthetic-non-allowlisted' },
      });

      expect(globalThis[syntheticHandlerName]).toEqual(expect.any(Function));
      expect(globalThis[syntheticHandlerName]).not.toHaveBeenCalled();
      expect(response).toMatchObject({
        ok: false,
        error: {
          code: 'UNKNOWN_METHOD',
        },
      });
    } finally {
      if (originalHandler === undefined) {
        delete globalThis[syntheticHandlerName];
      } else {
        globalThis[syntheticHandlerName] = originalHandler;
      }
    }
  });

  it('always generates backend-owned requestIds even when caller sends one', () => {
    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();

    const response = dispatcher.handle({
      method: 'hasScriptAuthorisation',
      requestId: 'req-client-supplied',
    });

    expect(response.requestId).toEqual(expect.any(String));
    expect(response.requestId).not.toBe('req-client-supplied');
  });

  it('generates a new requestId when omitted', () => {
    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();

    const response = dispatcher.handle({
      method: 'hasScriptAuthorisation',
    });

    expect(response.ok).toBe(true);
    expect(response.requestId).toEqual(expect.any(String));
    expect(response.requestId.length).toBeGreaterThan(0);
  });

  it('calls Utilities.getUuid to generate requestId when none is provided', () => {
    const originalUtilities = globalThis.Utilities;
    globalThis.Utilities = {
      getUuid: vi.fn(() => 'uuid-fixed-001'),
    };

    try {
      const { ApiDispatcher } = loadApiHandlerModule();
      const dispatcher = ApiDispatcher.getInstance();

      const response = dispatcher.handle({
        method: 'hasScriptAuthorisation',
      });

      expect(globalThis.Utilities.getUuid).toHaveBeenCalledTimes(1);
      expect(response.requestId).toBe('uuid-fixed-001');
      expect(response.ok).toBe(true);
    } finally {
      if (originalUtilities === undefined) {
        delete globalThis.Utilities;
      } else {
        globalThis.Utilities = originalUtilities;
      }
    }
  });

  it('passes the generated requestId to the handler as a second positional argument', () => {
    const { ApiDispatcher } = loadApiHandlerModule();
    const startAssessmentRun = vi.fn(() => null);
    const originalStartAssessmentRun = globalThis.startAssessmentRun_;
    globalThis.startAssessmentRun_ = startAssessmentRun;

    try {
      vi.spyOn(globalThis.Utilities, 'getUuid').mockReturnValueOnce('req-positional-001');

      const response = ApiDispatcher.getInstance().handle({
        method: 'startAssessmentRun',
        params: {
          definitionKey: 'def-algebra-baseline',
          assignmentId: 'assign-001',
          courseId: 'course-001',
        },
      });

      expect(response.ok).toBe(true);
      expect(response.requestId).toBe('req-positional-001');
      expect(startAssessmentRun).toHaveBeenCalledTimes(1);
      expect(startAssessmentRun).toHaveBeenCalledWith(
        {
          definitionKey: 'def-algebra-baseline',
          assignmentId: 'assign-001',
          courseId: 'course-001',
        },
        'req-positional-001'
      );
      expect(startAssessmentRun.mock.calls[0][1]).toBe(response.requestId);
    } finally {
      globalThis.startAssessmentRun_ = originalStartAssessmentRun;
    }
  });

  it('generates a fresh requestId for each dispatch and passes each one to the handler', () => {
    const { ApiDispatcher } = loadApiHandlerModule();
    const startAssessmentRun = vi.fn(() => null);
    const originalStartAssessmentRun = globalThis.startAssessmentRun_;
    globalThis.startAssessmentRun_ = startAssessmentRun;

    try {
      vi.spyOn(globalThis.Utilities, 'getUuid')
        .mockReturnValueOnce('req-first')
        .mockReturnValueOnce('req-second');

      const dispatcher = ApiDispatcher.getInstance();
      const request = {
        method: 'startAssessmentRun',
        params: {
          definitionKey: 'def-algebra-baseline',
          assignmentId: 'assign-001',
          courseId: 'course-001',
        },
      };

      const firstResponse = dispatcher.handle(request);
      const secondResponse = dispatcher.handle(request);

      expect(firstResponse.requestId).toBe('req-first');
      expect(secondResponse.requestId).toBe('req-second');
      expect(startAssessmentRun).toHaveBeenCalledTimes(2);
      expect(startAssessmentRun.mock.calls.map((call) => call[1])).toEqual([
        'req-first',
        'req-second',
      ]);
    } finally {
      globalThis.startAssessmentRun_ = originalStartAssessmentRun;
    }
  });

  it('returns the correlation requestId in startAssessmentRun response data', () => {
    const { ApiDispatcher } = loadApiHandlerModule();

    // The controller still returns null; only the transport response carries the ID.
    const startAssessmentRun = vi.fn(() => null);
    const originalAssignmentController = globalThis.AssignmentController;
    globalThis.AssignmentController = vi.fn(function AssignmentControllerMock() {
      return { startAssessmentRun };
    });

    try {
      vi.spyOn(globalThis.Utilities, 'getUuid').mockReturnValueOnce('req-start-001');

      const response = ApiDispatcher.getInstance().handle({
        method: 'startAssessmentRun',
        params: {
          definitionKey: 'def-algebra-baseline',
          assignmentId: 'assign-001',
          courseId: 'course-001',
        },
      });

      expect(response.ok).toBe(true);
      expect(response.requestId).toBe('req-start-001');
      expect(response.data).toEqual({ requestId: response.requestId });
    } finally {
      if (originalAssignmentController === undefined) {
        delete globalThis.AssignmentController;
      } else {
        globalThis.AssignmentController = originalAssignmentController;
      }
    }
  });

  it('dispatches getProgress through the allowlist and returns tasks in the success envelope', () => {
    const expectedTasks = [
      {
        requestId: 'req-progress-dispatch',
        step: 1,
        message: 'Marking submission',
        completed: false,
        error: null,
        timestamp: '2026-01-01T10:00:00.000Z',
      },
    ];
    const getProgressHandler = vi.fn(() => ({ tasks: expectedTasks }));
    const originalGetProgress = globalThis.getProgress_;
    globalThis.getProgress_ = getProgressHandler;

    try {
      const { ApiDispatcher } = loadApiHandlerModule();
      const response = ApiDispatcher.getInstance().handle({ method: 'getProgress' });

      expect(response).toMatchObject({
        ok: true,
        data: { tasks: expectedTasks },
      });
      expect(getProgressHandler).toHaveBeenCalledTimes(1);
      expect(getProgressHandler).toHaveBeenCalledWith();
    } finally {
      if (originalGetProgress === undefined) {
        delete globalThis.getProgress_;
      } else {
        globalThis.getProgress_ = originalGetProgress;
      }
    }
  });
});
