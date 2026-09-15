import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { withGlobalMocks } from '../helpers/globalMockManager.js';

// Hermetic behaviour coverage for AssignmentDefinitionTaskParser dispatch and
// validation filtering without invoking GAS document services.
const AssignmentDefinitionTaskParser = require('../../src/backend/y_controllers/AssignmentDefinition/AssignmentDefinitionTaskParser.js');

describe('AssignmentDefinitionTaskParser behaviour', () => {
  let restoreGlobals;
  let mockLogger;
  let mockTracker;

  beforeEach(() => {
    mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    mockTracker = {
      logError: vi.fn(),
      logAndThrowError: vi.fn((message) => {
        throw new Error(message);
      }),
    };
    const mockContext = withGlobalMocks({
      ABLogger: () => ({ getInstance: () => mockLogger }),
      SlidesParser: () => globalThis.SlidesParser,
      SheetsParser: () => globalThis.SheetsParser,
      TaskDefinition: () => globalThis.TaskDefinition,
    });
    restoreGlobals = mockContext.restore;
  });

  afterEach(() => {
    restoreGlobals();
    vi.restoreAllMocks();
  });

  it('dispatches slides documents case insensitively', () => {
    const parser = new AssignmentDefinitionTaskParser({ progressTracker: mockTracker });
    const slidesSpy = vi.spyOn(parser, '_parseSlidesTasks').mockReturnValue({ task_one: true });
    expect(
      parser.parseTasks({
        documentType: 'slides',
        referenceDocumentId: 'ref',
        templateDocumentId: 'tpl',
      })
    ).toEqual({ task_one: true });
    expect(slidesSpy).toHaveBeenCalledWith('ref', 'tpl');
  });

  it('dispatches sheets documents and rejects unknown types', () => {
    const parser = new AssignmentDefinitionTaskParser({ progressTracker: mockTracker });
    const sheetsSpy = vi.spyOn(parser, '_parseSheetsTasks').mockReturnValue({ task_two: true });
    expect(
      parser.parseTasks({
        documentType: 'SHEETS',
        referenceDocumentId: 'ref',
        templateDocumentId: null,
      })
    ).toEqual({ task_two: true });
    expect(sheetsSpy).toHaveBeenCalledWith('ref', null);

    expect(() =>
      parser.parseTasks({
        documentType: 'DOCS',
        referenceDocumentId: 'ref',
        templateDocumentId: null,
      })
    ).toThrow("Unknown documentType 'DOCS' when parsing tasks.");
    expect(mockTracker.logAndThrowError).toHaveBeenCalledWith(
      "Unknown documentType 'DOCS' when parsing tasks."
    );
  });

  it('keeps valid slide definitions and reports invalid ones', () => {
    const valid = {
      getId: () => 'task-valid',
      validate: () => ({ ok: true }),
      toJSON: () => ({ id: 'task-valid' }),
    };
    const invalid = {
      getId: () => 'task-invalid',
      taskTitle: 'Invalid',
      validate: () => ({ ok: false, errors: ['missing artefact'] }),
      toJSON: () => ({ id: 'task-invalid' }),
    };
    globalThis.SlidesParser = class {
      extractTaskDefinitions() {
        return [valid, invalid];
      }
    };
    globalThis.TaskDefinition = { fromJSON: (data) => data };
    const parser = new AssignmentDefinitionTaskParser({ progressTracker: mockTracker });
    const result = parser._parseSlidesTasks('ref-doc', 'tpl-doc');
    expect(Object.keys(result)).toEqual(['task-valid']);
    expect(mockTracker.logError).toHaveBeenCalledWith(
      'TaskDefinition missing required slide artifacts.',
      expect.objectContaining({ taskId: 'task-invalid' })
    );
    expect(mockLogger.info).toHaveBeenCalledWith('Parsed slide task definitions', {
      parsed: 2,
      valid: 1,
    });
  });

  it('round trips sheet definitions without validation filtering', () => {
    const first = { getId: () => 'sheet-one', toJSON: () => ({ id: 'sheet-one' }) };
    const second = { getId: () => 'sheet-two', toJSON: () => ({ id: 'sheet-two' }) };
    globalThis.SheetsParser = class {
      extractTaskDefinitions() {
        return [first, second];
      }
    };
    globalThis.TaskDefinition = { fromJSON: (data) => data };
    const parser = new AssignmentDefinitionTaskParser({ progressTracker: mockTracker });
    const result = parser._parseSheetsTasks('ref-doc', 'tpl-doc');
    expect(Object.keys(result).sort()).toEqual(['sheet-one', 'sheet-two']);
    expect(mockLogger.info).toHaveBeenCalledWith('Parsed sheet task definitions', { parsed: 2 });
  });
});
