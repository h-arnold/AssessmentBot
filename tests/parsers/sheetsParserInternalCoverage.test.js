import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import {
  withGlobalMocks,
  saveGlobals,
  restoreGlobals as restoreSavedGlobals,
} from '../helpers/globalMockManager.js';

// Hermetic behaviour coverage for SheetsParser internals: raw extraction,
// formula comparison, bounding boxes, task definition building and student
// submission reads. All SpreadsheetApp and TaskSheet collaborators are mocked.
describe('SheetsParser internal behaviour', () => {
  let SheetsParser;
  let restoreGlobals;
  let mockLogger;
  let mockTracker;
  const savedModuleGlobals = saveGlobals(['DocumentParser', 'TaskDefinition']);

  beforeAll(async () => {
    const documentParserModule =
      await import('../../src/backend/DocumentParsers/DocumentParser.js');
    const taskDefinitionModule = await import('../../src/backend/Models/TaskDefinition.js');
    globalThis.DocumentParser = documentParserModule.DocumentParser;
    globalThis.TaskDefinition = taskDefinitionModule.TaskDefinition;
    const sheetsParserModule = await import('../../src/backend/DocumentParsers/SheetsParser.js');
    SheetsParser = sheetsParserModule.SheetsParser;
  });

  afterAll(() => {
    restoreSavedGlobals(savedModuleGlobals);
  });

  beforeEach(() => {
    mockLogger = { warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    mockTracker = { captureError: vi.fn(), logError: vi.fn() };
    const mockContext = withGlobalMocks({
      ABLogger: () => ({ getInstance: () => mockLogger }),
      ProgressTracker: () => ({ getInstance: () => mockTracker }),
      SpreadsheetApp: () => ({ openById: vi.fn() }),
      TaskSheet: () => class MockTaskSheetDefault {},
    });
    restoreGlobals = mockContext.restore;
  });

  afterEach(() => {
    restoreGlobals();
    vi.restoreAllMocks();
  });

  it('returns empty tasks when no document id is supplied', () => {
    globalThis.SpreadsheetApp = { openById: vi.fn() };
    globalThis.TaskSheet = class {
      constructor() {
        throw new Error('should not construct without a document');
      }
    };
    const parser = new SheetsParser();
    parser.progressTracker = mockTracker;
    expect(parser._extractFormulaeFromTaskSheets(null, 'reference')).toEqual({});
    expect(parser._extractFormulaeFromTaskSheets('', 'reference')).toEqual({});
    expect(globalThis.SpreadsheetApp.openById).not.toHaveBeenCalled();
  });

  it('extracts formulae from task sheets with and without helper methods', () => {
    const plainSheet = { sheetName: 'Plain', getAllFormulae: null };
    const richSheet = {
      sheetName: 'Rich',
      getAllFormulae: vi.fn(),
    };
    class MockTaskSheet {
      constructor(sheet) {
        const inner = sheet === 'plain' ? plainSheet : richSheet;
        this.sheetName = inner.sheetName;
        if (typeof inner.getAllFormulae === 'function') {
          this.getAllFormulae = inner.getAllFormulae;
        }
      }
    }
    globalThis.TaskSheet = MockTaskSheet;
    globalThis.SpreadsheetApp = {
      openById: vi.fn(() => ({ getSheets: () => ['plain', 'rich'] })),
    };
    const parser = new SheetsParser();
    parser.progressTracker = mockTracker;
    const tasks = parser._extractFormulaeFromTaskSheets('doc-one', 'reference');
    expect(Object.keys(tasks).sort()).toEqual(['Plain', 'Rich']);
    expect(richSheet.getAllFormulae).toHaveBeenCalled();
  });

  it('extracts raw sheet data and falls back on failure', () => {
    const parser = new SheetsParser();
    parser.progressTracker = mockTracker;
    parser._extractFormulaeFromTaskSheets = vi.fn((docId) => ({ [docId]: true }));
    const ok = parser._extractRawSheetData('ref-doc', 'tpl-doc');
    expect(ok.referenceTasks).toEqual({ 'ref-doc': true });
    expect(ok.templateTasks).toEqual({ 'tpl-doc': true });

    parser._extractFormulaeFromTaskSheets = vi.fn(() => {
      throw new Error('spreadsheet unavailable');
    });
    const fallback = parser._extractRawSheetData('ref-doc', 'tpl-doc');
    expect(fallback).toEqual({ referenceTasks: {}, templateTasks: {} });
    expect(mockTracker.captureError).toHaveBeenCalledWith(
      expect.any(Error),
      'Failed to extract tasks from sheets'
    );
  });

  it('compares formulae while skipping unmatched or incomplete sheets', () => {
    const parser = new SheetsParser();
    parser.progressTracker = mockTracker;
    const result = parser.compareFormulae({
      referenceTasks: {
        Keep: { sheetId: 1, formulaArray: [['=A1']] },
        MissingTemplate: { sheetId: 2, formulaArray: [['=B1']] },
        NoFormulae: { sheetId: 3 },
      },
      templateTasks: {
        Keep: { formulaArray: [['=DIFFERENT']] },
        NoFormulae: {},
      },
    });
    expect(Object.keys(result)).toEqual(['Keep']);
    expect(result.Keep.sheetId).toBe(1);
    expect(result.Keep.formulas).toEqual([{ referenceFormula: '=A1', location: [0, 0] }]);
    expect(result.Keep.boundingBox.numRows).toBe(1);
  });

  it('returns empty comparison results when inputs are malformed', () => {
    const parser = new SheetsParser();
    parser.progressTracker = mockTracker;
    expect(parser.compareFormulae(null)).toEqual({});
    expect(mockTracker.captureError).toHaveBeenCalledWith(
      expect.any(Error),
      'Failed to compare formulae between sheets'
    );
  });

  it('compares formula arrays across ragged grids', () => {
    const parser = new SheetsParser();
    parser.progressTracker = mockTracker;

    expect(parser._compareFormulaArrays([['=A1', '']], [['=A1', '']])).toEqual([]);
    expect(parser._compareFormulaArrays([['', '=B1']], [['', '']])).toEqual([
      { referenceFormula: '=B1', location: [0, 1] },
    ]);

    const ragged = parser._compareFormulaArrays([['=A1'], ['=B2', '=C2']], [['=DIFFERENT']]);
    expect(ragged).toEqual([
      { referenceFormula: '=A1', location: [0, 0] },
      { referenceFormula: '=B2', location: [1, 0] },
      { referenceFormula: '=C2', location: [1, 1] },
    ]);

    expect(parser._compareFormulaArrays([null, undefined], [])).toEqual([]);
  });

  it('processes and compares sheets with error fallback', () => {
    const parser = new SheetsParser();
    parser.progressTracker = mockTracker;
    parser._extractRawSheetData = vi.fn(() => ({ referenceTasks: {}, templateTasks: {} }));
    parser.compareFormulae = vi.fn(() => ({ SheetA: { sheetId: 1 } }));
    expect(parser.processAndCompareSheets('ref', 'tpl')).toEqual({ SheetA: { sheetId: 1 } });

    parser._extractRawSheetData = vi.fn(() => {
      throw new Error('extract failed');
    });
    expect(parser.processAndCompareSheets('ref', 'tpl')).toEqual({});
    expect(mockTracker.captureError).toHaveBeenCalledWith(
      expect.any(Error),
      'Failed to process and compare sheets'
    );
  });

  it('calculates bounding boxes for empty and populated differences', () => {
    const parser = new SheetsParser();
    parser.progressTracker = mockTracker;
    expect(parser._calculateBoundingBox(null)).toBeNull();
    expect(parser._calculateBoundingBox([])).toBeNull();
    expect(parser._calculateBoundingBox([{ location: [2, 3] }])).toEqual({
      startRow: 3,
      startColumn: 4,
      endRow: 3,
      endColumn: 4,
      numRows: 1,
      numColumns: 1,
    });
    expect(parser._calculateBoundingBox([{ location: [0, 0] }, { location: [2, 4] }])).toEqual({
      startRow: 1,
      startColumn: 1,
      endRow: 3,
      endColumn: 5,
      numRows: 3,
      numColumns: 5,
    });
  });

  it('builds task definitions with sparse grids and template mirrors', () => {
    const parser = new SheetsParser();
    parser.progressTracker = mockTracker;
    parser.processAndCompareSheets = vi.fn(() => ({
      SheetOne: {
        sheetId: 11,
        formulas: [
          { referenceFormula: '=A1', location: [0, 0] },
          { referenceFormula: '', location: [5, 5] },
        ],
        boundingBox: {
          startRow: 1,
          startColumn: 1,
          endRow: 1,
          endColumn: 2,
          numRows: 1,
          numColumns: 2,
        },
      },
      EmptySheet: { sheetId: 12, formulas: [], boundingBox: null },
    }));
    const defs = parser.extractTaskDefinitions('ref-doc', 'tpl-doc');
    expect(defs).toHaveLength(2);
    const [first, second] = defs;
    expect(first.taskTitle).toBe('SheetOne');
    expect(first.index).toBe(0);
    expect(first.getPrimaryReference().content[0][0]).toBe('=A1');
    expect(first.getPrimaryTemplate()).toBeTruthy();
    expect(first.getPrimaryReference().documentId).toBe('ref-doc');
    expect(second.getPrimaryReference().content ?? []).toEqual([]);
  });

  it('reads student submission grids and skips incomplete definitions', () => {
    const parser = new SheetsParser();
    parser.progressTracker = mockTracker;
    expect(parser.extractSubmissionArtifacts(null, [])).toEqual([]);

    const bbox = { startRow: 1, startColumn: 1, numRows: 1, numColumns: 2 };
    const reference = { content: [[null, null]], getType: () => 'spreadsheet' };
    const complete = {
      getId: () => 'task-one',
      pageId: '11',
      taskTitle: 'SheetOne',
      taskMetadata: { bbox },
      getPrimaryReference: () => reference,
    };
    const missingSheet = {
      getId: () => 'task-missing',
      pageId: '99',
      taskTitle: 'Missing',
      taskMetadata: { bbox },
      getPrimaryReference: () => reference,
    };
    const missingBbox = {
      getId: () => 'task-nobox',
      pageId: '11',
      taskTitle: 'NoBox',
      taskMetadata: {},
      getPrimaryReference: () => reference,
    };
    globalThis.SpreadsheetApp = {
      openById: vi.fn(() => ({
        getSheets: () => [{ getSheetId: () => 11 }],
      })),
    };
    globalThis.TaskSheet = class {
      getRange() {
        return [['=STUDENT', '']];
      }
    };
    const artifacts = parser.extractSubmissionArtifacts('student-doc', [
      complete,
      missingSheet,
      missingBbox,
    ]);
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]).toMatchObject({
      taskId: 'task-one',
      pageId: '11',
      documentId: 'student-doc',
      content: [['=STUDENT', null]],
    });
  });

  it('skips student sheets when formula reads fail', () => {
    const parser = new SheetsParser();
    parser.progressTracker = mockTracker;
    const bbox = { startRow: 1, startColumn: 1, numRows: 1, numColumns: 1 };
    const definition = {
      getId: () => 'task-fail',
      pageId: '11',
      taskTitle: 'Failing',
      taskMetadata: { bbox },
      getPrimaryReference: () => ({ content: [[null]], getType: () => 'spreadsheet' }),
    };
    globalThis.SpreadsheetApp = {
      openById: vi.fn(() => ({
        getSheets: () => [{ getSheetId: () => 11 }],
      })),
    };
    globalThis.TaskSheet = class {
      getRange() {
        throw new Error('range read failed');
      }
    };
    expect(parser.extractSubmissionArtifacts('student-doc', [definition])).toEqual([]);
    expect(mockTracker.logError).toHaveBeenCalledWith(
      'Failed to read formulas for sheet Failing',
      expect.any(Error)
    );
  });
});
