import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createParsedTaskDefinition,
  createUpsertPayload,
  createDocumentChangePayload,
  captureThrownError,
  seedExistingDefinition,
  setupUpsertControllerTestBed,
} from './assignmentDefinitionUpsertTestHelpers.js';
import { withGlobalMocks } from '../helpers/globalMockManager.js';
import { loadApiHandlerModule } from '../helpers/apiHandlerTestUtils.js';

const ApiValidationError = require('../../src/backend/Utils/ErrorTypes/ApiValidationError.js');
const ApiRateLimitError = require('../../src/backend/Utils/ErrorTypes/ApiRateLimitError.js');
const PersistError = require('../../src/backend/Utils/ErrorTypes/PersistError.js');

const extractSlidesTaskDefinitionsMock = vi.fn();
const extractSheetsTaskDefinitionsMock = vi.fn();

vi.mock('../../src/backend/DbManager/DbManager.js');
vi.mock('../../src/backend/GoogleDriveManager/DriveManager/index.js');
vi.mock('../../src/backend/DocumentParsers/SlidesParser/index.js', () => ({
  default: class {
    extractTaskDefinitions = (...a) => extractSlidesTaskDefinitionsMock(...a);
  },
}));
vi.mock('../../src/backend/DocumentParsers/SheetsParser.js', () => ({
  SheetsParser: class {
    extractTaskDefinitions = (...a) => extractSheetsTaskDefinitionsMock(...a);
  },
}));

// Recovery error classification and safe diagnostics (issue #301): only recognised
// content parsing failures map to DEFINITION_PARSE_FAILED while authorisation,
// rate-limit and persistence failures keep their original classifications. Logger
// seams carry only allow-listed diagnostic context with the original parser error
// preserved for developer logs; user-facing errors carry safe copy only.
describe('AssignmentDefinitionController upsert — recovery error classification and diagnostics', () => {
  let controller;
  let mockRegistryCollection;
  let mockFullCollection;
  let mockLogger;
  let restoreGlobals;

  beforeEach(() => {
    const ctx = setupUpsertControllerTestBed(
      extractSlidesTaskDefinitionsMock,
      extractSheetsTaskDefinitionsMock
    );
    controller = ctx.controller;
    mockRegistryCollection = ctx.mockRegistryCollection;
    mockFullCollection = ctx.mockFullCollection;
    mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), debugUi: vi.fn() };
    ({ restore: restoreGlobals } = withGlobalMocks({
      ABLogger: () => ({ getInstance: () => mockLogger }),
    }));
  });

  afterEach(() => {
    restoreGlobals();
  });

  function runDocumentChangeUpsert() {
    return controller.upsertDefinition(createDocumentChangePayload());
  }

  it('maps a recognised document parsing failure to DEFINITION_PARSE_FAILED', () => {
    seedExistingDefinition({ mockFullCollection, mockRegistryCollection });
    const parserError = new Error('Slides read failed');
    extractSlidesTaskDefinitionsMock.mockImplementationOnce(() => {
      throw parserError;
    });

    const thrown = captureThrownError(runDocumentChangeUpsert);

    expect(thrown).toBeInstanceOf(ApiValidationError);
    expect(thrown.code).toBe('DEFINITION_PARSE_FAILED');
  });

  it('preserves a rate-limit classification instead of mapping to parse failure', () => {
    seedExistingDefinition({ mockFullCollection, mockRegistryCollection });
    const rateError = new ApiRateLimitError('Rate limited', {});
    extractSlidesTaskDefinitionsMock.mockImplementationOnce(() => {
      throw rateError;
    });

    const thrown = captureThrownError(runDocumentChangeUpsert);

    expect(thrown).toBe(rateError);
    expect(mockFullCollection.insertOne).not.toHaveBeenCalled();
    expect(mockFullCollection.replaceOne).not.toHaveBeenCalled();
  });

  it('preserves a persistence classification instead of mapping to parse failure', () => {
    seedExistingDefinition({ mockFullCollection, mockRegistryCollection });
    const persistError = new PersistError('Persistence unavailable', {});
    extractSlidesTaskDefinitionsMock.mockImplementationOnce(() => {
      throw persistError;
    });

    const thrown = captureThrownError(runDocumentChangeUpsert);

    expect(thrown).toBe(persistError);
    expect(mockFullCollection.insertOne).not.toHaveBeenCalled();
    expect(mockFullCollection.replaceOne).not.toHaveBeenCalled();
  });

  it('preserves an authorisation classification instead of mapping to parse failure', () => {
    seedExistingDefinition({ mockFullCollection, mockRegistryCollection });
    const authError = new Error('Drive access denied');
    authError.name = 'AuthorisationError';
    extractSlidesTaskDefinitionsMock.mockImplementationOnce(() => {
      throw authError;
    });

    const thrown = captureThrownError(runDocumentChangeUpsert);

    expect(thrown).toBe(authError);
    expect(mockFullCollection.insertOne).not.toHaveBeenCalled();
    expect(mockFullCollection.replaceOne).not.toHaveBeenCalled();
  });

  it('logs safe diagnostic context with the original parser error on parse failure', () => {
    seedExistingDefinition({ mockFullCollection, mockRegistryCollection });
    const parserError = new Error('Slides read failed');
    extractSlidesTaskDefinitionsMock.mockImplementationOnce(() => {
      throw parserError;
    });

    const thrown = captureThrownError(runDocumentChangeUpsert);

    expect(thrown).toBeInstanceOf(ApiValidationError);
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    const [message, context] = mockLogger.error.mock.calls[0];
    expect(message).toMatch(/could not be parsed/i);
    expect(context).toMatchObject({
      documentType: 'SLIDES',
      referenceDocumentId: 'new-ref-doc-id',
      templateDocumentId: 'new-tpl-doc-id',
      err: parserError,
    });
    expect(context).not.toHaveProperty('primaryTitle');
    expect(context).not.toHaveProperty('taskWeightings');
    expect(context).not.toHaveProperty('forceReparse');
    expect(thrown.cause).toBe(parserError);
    expect(thrown.message).toMatch(/could not be parsed/i);
  });

  it('logs safe diagnostic context when parsing yields zero tasks', () => {
    seedExistingDefinition({ mockFullCollection, mockRegistryCollection });
    extractSlidesTaskDefinitionsMock.mockReturnValueOnce([]);

    const thrown = captureThrownError(runDocumentChangeUpsert);

    expect(thrown).toBeInstanceOf(ApiValidationError);
    expect(thrown.code).toBe('DEFINITION_PARSE_FAILED');
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    const [message, context] = mockLogger.error.mock.calls[0];
    expect(message).toMatch(/zero tasks/i);
    expect(context).toMatchObject({
      documentType: 'SLIDES',
      referenceDocumentId: 'new-ref-doc-id',
      templateDocumentId: 'new-tpl-doc-id',
    });
    expect(context).not.toHaveProperty('primaryTitle');
    expect(context).not.toHaveProperty('taskWeightings');
  });

  it('logs invalid tasks rather than zero tasks when valid tasks were also parsed', () => {
    seedExistingDefinition({ mockFullCollection, mockRegistryCollection });
    const validTask = createParsedTaskDefinition({ id: 't_task_1', taskTitle: 'Task A', index: 0 });
    const invalidTask = {
      getId: () => 't_task_bad',
      validate: () => ({ ok: false, errors: ['missing template artefact'] }),
      toJSON: () => ({
        id: 't_task_bad',
        taskTitle: 'Bad task',
        taskWeighting: null,
        index: 1,
        artifacts: { reference: [], template: [] },
      }),
    };
    extractSlidesTaskDefinitionsMock.mockReturnValueOnce([validTask, invalidTask]);

    const thrown = captureThrownError(runDocumentChangeUpsert);

    expect(thrown).toBeInstanceOf(ApiValidationError);
    expect(thrown.code).toBe('DEFINITION_PARSE_FAILED');
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    const [message, context] = mockLogger.error.mock.calls[0];
    expect(message).toMatch(/invalid tasks/i);
    expect(message).not.toMatch(/zero tasks/i);
    expect(context).toMatchObject({
      documentType: 'SLIDES',
      referenceDocumentId: 'new-ref-doc-id',
      templateDocumentId: 'new-tpl-doc-id',
    });
  });

  it('logs a safe warning with only the definition key on a stale baseline', () => {
    seedExistingDefinition({
      mockFullCollection,
      mockRegistryCollection,
      overrides: { updatedAt: '2026-01-06T12:30:00.000Z' },
    });

    const thrown = captureThrownError(() =>
      controller.upsertDefinition(
        createUpsertPayload({
          definitionKey: 'existing-stable-key',
          updatedAt: '2026-01-01T00:00:00.000Z',
        })
      )
    );

    expect(thrown).not.toBeNull();
    expect(thrown.code).toBe('DEFINITION_STALE');
    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    const [message, context] = mockLogger.warn.mock.calls[0];
    expect(message).toMatch(/stale/i);
    expect(context).toEqual({ definitionKey: 'existing-stable-key' });
  });

  it('maps a recovery precondition failure to INVALID_REQUEST at the envelope', () => {
    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();
    const preconditionError = new ApiValidationError(
      'forceReparse requires an existing definitionKey for recovery reparses.',
      { method: 'upsertAssignmentDefinition' }
    );

    const response = dispatcher._mapErrorToFailureEnvelope('req-recovery-001', preconditionError);

    expect(response).toMatchObject({
      ok: false,
      requestId: 'req-recovery-001',
      error: { code: 'INVALID_REQUEST', retriable: false },
    });
  });

  it('surfaces DEFINITION_PARSE_FAILED at the envelope for recognised content failures', () => {
    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();
    const parseError = new ApiValidationError(
      'The assignment documents could not be parsed. Check the reference and template documents, then try again.',
      { method: 'upsertAssignmentDefinition', code: 'DEFINITION_PARSE_FAILED' }
    );

    const response = dispatcher._mapErrorToFailureEnvelope('req-recovery-002', parseError);

    expect(response).toMatchObject({
      ok: false,
      error: { code: 'DEFINITION_PARSE_FAILED', retriable: false },
    });
  });

  it('keeps the rate-limit classification at the envelope instead of parse failure', () => {
    const { ApiDispatcher } = loadApiHandlerModule();
    const dispatcher = ApiDispatcher.getInstance();

    const response = dispatcher._mapErrorToFailureEnvelope(
      'req-recovery-003',
      new ApiRateLimitError('Rate limited', {})
    );

    expect(response).toMatchObject({
      ok: false,
      error: { code: 'RATE_LIMITED', retriable: true },
    });
  });
});
