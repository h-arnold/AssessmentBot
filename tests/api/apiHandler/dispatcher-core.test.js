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

  it('exposes the generated requestId to handlers through ApiRequestContext', () => {
    const { ApiDispatcher, ApiRequestContext } = loadApiHandlerModule();
    expect(
      ApiRequestContext,
      'ApiRequestContext must be exported from z_apiHandler.js for Node tests'
    ).toBeDefined();
    ApiRequestContext.resetForTests();

    // The handler reads the accessor while dispatch is in flight, so the success
    // payload proves the ID was available before the handler was invoked.
    context.scriptAppManagerInstance.isAuthorised.mockImplementation(() => ApiRequestContext.get());

    const response = ApiDispatcher.getInstance().handle({
      method: 'hasScriptAuthorisation',
    });

    expect(response.ok).toBe(true);
    expect(response.data).toBe(response.requestId);
    expect(ApiRequestContext.get()).toBe(response.requestId);
  });

  it('overwrites the stored requestId on each dispatch and clears it on resetForTests', () => {
    const { ApiDispatcher, ApiRequestContext } = loadApiHandlerModule();
    expect(
      ApiRequestContext,
      'ApiRequestContext must be exported from z_apiHandler.js for Node tests'
    ).toBeDefined();
    ApiRequestContext.resetForTests();
    expect(ApiRequestContext.get()).toBeFalsy();

    const getUuidSpy = vi
      .spyOn(globalThis.Utilities, 'getUuid')
      .mockReturnValueOnce('req-context-first')
      .mockReturnValueOnce('req-context-second');
    const dispatcher = ApiDispatcher.getInstance();

    const firstResponse = dispatcher.handle({ method: 'hasScriptAuthorisation' });
    expect(firstResponse.requestId).toBe('req-context-first');
    expect(ApiRequestContext.get()).toBe(firstResponse.requestId);

    const secondResponse = dispatcher.handle({ method: 'hasScriptAuthorisation' });
    expect(secondResponse.requestId).toBe('req-context-second');
    expect(ApiRequestContext.get()).toBe(secondResponse.requestId);
    expect(getUuidSpy).toHaveBeenCalledTimes(2);
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
});
