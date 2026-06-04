import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalClassroomApiClient = globalThis.ClassroomApiClient;

const {
  loadApiHandlerModule,
  handleApiRequest,
  setupApiHandlerTestContext,
  teardownApiHandlerTestContext,
  clearGoogleClassroomsHandlerModuleCache,
  loadRealGoogleClassroomsHandlerWithGlobals,
  loadApiHandlerInVmContext,
  makeVmGlobals,
  expectFailureEnvelope,
  ABCLASS_TRANSPORT_RESULTS,
  ASSIGNMENT_DEFINITION_RESULTS,
} = require('./shared.js');

describe('Api/apiHandler dispatcher — integration, VM context and delegation', () => {
  let context;

  beforeEach(() => {
    context = setupApiHandlerTestContext(vi, {
      installLogger: true,
      googleClassroomsBehaviour: () => ABCLASS_TRANSPORT_RESULTS.getGoogleClassrooms,
      googleClassroomAssignmentsBehaviour: () =>
        ABCLASS_TRANSPORT_RESULTS.getGoogleClassroomAssignments,
      abclassMutationsBehaviour: {
        upsertABClass_: () => ABCLASS_TRANSPORT_RESULTS.upsertABClass,
        updateABClass_: () => ABCLASS_TRANSPORT_RESULTS.updateABClass,
        deleteABClass_: () => ABCLASS_TRANSPORT_RESULTS.deleteABClass,
      },
      assignmentDefinitionBehaviour: {
        getAssignmentDefinitionPartials_: () =>
          ASSIGNMENT_DEFINITION_RESULTS.getAssignmentDefinitionPartials,
        getAssignmentDefinition_: () => ASSIGNMENT_DEFINITION_RESULTS.getAssignmentDefinition,
        deleteAssignmentDefinition_: () => ASSIGNMENT_DEFINITION_RESULTS.deleteAssignmentDefinition,
      },
    });
  });

  afterEach(() => {
    teardownApiHandlerTestContext(vi, context);
    clearGoogleClassroomsHandlerModuleCache();
    if (originalClassroomApiClient === undefined) {
      delete globalThis.ClassroomApiClient;
    } else {
      globalThis.ClassroomApiClient = originalClassroomApiClient;
    }
  });

  describe('real getGoogleClassrooms handler integration', () => {
    it('keeps the success envelope unchanged for getGoogleClassrooms when using the real handler', () => {
      globalThis.getGoogleClassrooms_ = loadRealGoogleClassroomsHandlerWithGlobals({
        classroomApiClient: {
          fetchAllActiveClassrooms: vi.fn(() => [
            {
              id: 'course-001',
              name: '10A Computer Science',
              enrollmentCode: 'ABC123',
            },
          ]),
        },
      });

      const { ApiDispatcher } = loadApiHandlerModule();
      const dispatcher = ApiDispatcher.getInstance();

      const response = dispatcher.handle({
        method: 'getGoogleClassrooms',
        params: { includeArchived: true },
      });

      expect(response).toEqual({
        ok: true,
        requestId: response.requestId,
        data: [{ classId: 'course-001', className: '10A Computer Science' }],
      });
      expect(response.requestId).toEqual(expect.any(String));
    });

    it('maps getGoogleClassrooms validation failures from the real handler to INVALID_REQUEST', () => {
      globalThis.getGoogleClassrooms_ = loadRealGoogleClassroomsHandlerWithGlobals({
        classroomApiClient: {
          fetchAllActiveClassrooms: vi.fn(() => [{ name: '10A Computer Science' }]),
        },
      });

      const { ApiDispatcher } = loadApiHandlerModule();
      const dispatcher = ApiDispatcher.getInstance();

      const response = dispatcher.handle({
        method: 'getGoogleClassrooms',
        params: {},
      });

      expect(response).toEqual({
        ok: false,
        requestId: expect.any(String),
        error: {
          code: 'INVALID_REQUEST',
          message: expect.any(String),
          retriable: false,
        },
      });
    });

    it('maps malformed getGoogleClassrooms records from the real handler to INVALID_REQUEST and preserves requestId', () => {
      const originalUtilities = globalThis.Utilities;
      globalThis.Utilities = {
        getUuid: vi.fn(() => 'req-google-classrooms-null-record'),
      };

      try {
        globalThis.getGoogleClassrooms_ = loadRealGoogleClassroomsHandlerWithGlobals({
          classroomApiClient: {
            fetchAllActiveClassrooms: vi.fn(() => [null]),
          },
        });

        const { ApiDispatcher } = loadApiHandlerModule();
        const dispatcher = ApiDispatcher.getInstance();

        const response = dispatcher.handle({
          method: 'getGoogleClassrooms',
          params: {},
        });

        expect(response).toEqual({
          ok: false,
          requestId: 'req-google-classrooms-null-record',
          error: {
            code: 'INVALID_REQUEST',
            message: expect.any(String),
            retriable: false,
          },
        });
      } finally {
        if (originalUtilities === undefined) {
          delete globalThis.Utilities;
        } else {
          globalThis.Utilities = originalUtilities;
        }
      }
    });

    it('maps unexpected getGoogleClassrooms failures through the existing internal-error envelope path', () => {
      globalThis.getGoogleClassrooms_ = loadRealGoogleClassroomsHandlerWithGlobals({
        classroomApiClient: {
          fetchAllActiveClassrooms: vi.fn(() => {
            throw new Error('Classroom client exploded');
          }),
        },
      });

      const { ApiDispatcher } = loadApiHandlerModule();
      const dispatcher = ApiDispatcher.getInstance();

      const response = dispatcher.handle({
        method: 'getGoogleClassrooms',
        params: {},
      });

      expect(response).toEqual({
        ok: false,
        requestId: expect.any(String),
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal API error.',
          retriable: false,
        },
      });
    });
  });

  describe('getABClassPartials', () => {
    it('keeps existing getABClassPartials dispatch behaviour unchanged', () => {
      const expectedData = [{ classId: 'ab-class-001', className: 'Existing transport method' }];
      context.abClassControllerInstance.getAllClassPartials.mockImplementation(() => expectedData);

      const { ApiDispatcher } = loadApiHandlerModule();
      const dispatcher = ApiDispatcher.getInstance();

      const response = dispatcher.handle({
        method: 'getABClassPartials',
        params: { pageSize: 10 },
      });

      expect(context.abClassControllerCtor).toHaveBeenCalledTimes(1);
      expect(context.abClassControllerInstance.getAllClassPartials).toHaveBeenCalledTimes(1);
      expect(context.abClassControllerInstance.getAllClassPartials).toHaveBeenCalledWith();
      expect(response).toEqual({
        ok: true,
        requestId: response.requestId,
        data: expectedData,
      });
      expect(response.requestId).toEqual(expect.any(String));
    });

    it('maps getABClassPartials controller errors to INTERNAL_ERROR', () => {
      context.abClassControllerInstance.getAllClassPartials.mockImplementation(() => {
        throw new Error('DB read failure');
      });

      const response = handleApiRequest('getABClassPartials');

      expectFailureEnvelope(response, {
        code: 'INTERNAL_ERROR',
        message: 'Internal API error.',
        withRequestId: true,
      });
    });
  });

  describe('VM context', () => {
    it('operates correctly via BaseSingleton in a GAS-like VM context', () => {
      const { ApiDispatcher } = loadApiHandlerInVmContext({
        globals: makeVmGlobals({
          ScriptAppManager: function ScriptAppManager() {
            this.isAuthorised = () => true;
          },
          Utilities: {
            getUuid: () => 'uuid-vm-singleton',
          },
        }),
      });

      const first = ApiDispatcher.getInstance();
      const second = ApiDispatcher.getInstance();

      expect(first).toBe(second);
      expect(
        first.handle({
          method: 'getAuthorisationStatus',
        })
      ).toMatchObject({ ok: true, requestId: 'uuid-vm-singleton' });
    });

    it('returns INTERNAL_ERROR when an allowlisted method handler throws in vm context', () => {
      const { ApiDispatcher } = loadApiHandlerInVmContext({
        globals: makeVmGlobals({
          ScriptAppManager: function ScriptAppManager() {
            this.isAuthorised = () => {
              throw new Error('vm handler exploded');
            };
          },
          Utilities: {
            getUuid: () => 'uuid-vm-dispatch-error',
          },
        }),
      });
      const dispatcher = ApiDispatcher.getInstance();

      const response = dispatcher.handle({
        method: 'getAuthorisationStatus',
      });

      expect(response).toMatchObject({
        ok: false,
        requestId: 'uuid-vm-dispatch-error',
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal API error.',
          retriable: false,
        },
      });
    });
  });

  describe('GAS-global apiHandler', () => {
    it('GAS-global apiHandler delegates to ApiDispatcher.getInstance().handle(request)', () => {
      const { apiHandler, ApiDispatcher } = loadApiHandlerModule();

      const request = {
        method: 'getAuthorisationStatus',
      };
      const handle = vi.fn(() => ({
        ok: true,
        requestId: 'req-wrapper-generated',
        data: { delegated: true },
      }));
      const getInstance = vi.spyOn(ApiDispatcher, 'getInstance').mockReturnValue({ handle });

      const response = apiHandler(request);

      expect(getInstance).toHaveBeenCalledTimes(1);
      expect(handle).toHaveBeenCalledWith(request);
      expect(response).toEqual({
        ok: true,
        requestId: 'req-wrapper-generated',
        data: { delegated: true },
      });
    });
  });
});
