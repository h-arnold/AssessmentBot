/**
 * Tests for SlidesParser merged cell handling
 *
 * Covers extractCellText and extractTableCells, including merged-cell states,
 * table failure boundaries with contextual log-and-rethrow, and the
 * count-based merged-cell logging contract.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { createMockABLogger } from '../helpers/mockFactories.js';
import {
  withGlobalMocks,
  saveGlobals,
  restoreGlobals as restoreSavedGlobals,
} from '../helpers/globalMockManager.js';

describe('SlidesParser - Merged Cell Handling', () => {
  let SlidesParser;
  let mockLogger;
  let restoreGlobals;
  const savedModuleGlobals = saveGlobals(['DocumentParser', 'TaskDefinition']);

  // Local helper kept off globalThis; builds a mock cell for the given merge state.
  function makeCell(mergeState, rawText) {
    const cell = { getMergeState: vi.fn().mockReturnValue(mergeState) };
    cell.getText =
      rawText === undefined
        ? vi.fn()
        : vi.fn().mockReturnValue({ asString: vi.fn().mockReturnValue(rawText) });
    return cell;
  }

  beforeAll(async () => {
    const documentParserModule =
      await import('../../src/backend/DocumentParsers/DocumentParser.js');
    const taskDefinitionModule = await import('../../src/backend/Models/TaskDefinition.js');
    const documentParser =
      documentParserModule.DocumentParser || documentParserModule.default?.DocumentParser;
    const taskDefinition =
      taskDefinitionModule.TaskDefinition || taskDefinitionModule.default?.TaskDefinition;
    if (!documentParser || !taskDefinition) {
      throw new Error('Failed to load DocumentParser or TaskDefinition for SlidesParser tests');
    }
    globalThis.DocumentParser = documentParser;
    globalThis.TaskDefinition = taskDefinition;
    const slidesParserModule =
      await import('../../src/backend/DocumentParsers/SlidesParser/index.js');
    SlidesParser = slidesParserModule.SlidesParser || slidesParserModule.default?.SlidesParser;
    if (!SlidesParser) throw new Error('Failed to load SlidesParser for tests');
  });

  afterAll(() => {
    restoreSavedGlobals(savedModuleGlobals);
  });

  beforeEach(() => {
    mockLogger = createMockABLogger(vi);
    const mockContext = withGlobalMocks({
      ABLogger: () => ({ getInstance: vi.fn().mockReturnValue(mockLogger) }),
      SlidesApp: () => ({
        PageElementType: { SHAPE: 'SHAPE', TABLE: 'TABLE', IMAGE: 'IMAGE' },
        CellMergeState: { NORMAL: 'NORMAL', HEAD: 'HEAD', MERGED: 'MERGED' },
        openById: vi.fn(),
      }),
    });
    restoreGlobals = mockContext.restore;
  });

  afterEach(() => {
    restoreGlobals();
    vi.restoreAllMocks();
  });

  describe('extractCellText', () => {
    let parser;
    beforeEach(() => {
      parser = new SlidesParser();
    });

    it('should extract text from NORMAL cell', () => {
      const mockCell = makeCell(
        globalThis.SlidesApp.CellMergeState.NORMAL,
        '  Normal Cell Content  '
      );
      const result = parser.extractCellText(mockCell, globalThis.SlidesApp.CellMergeState.NORMAL);
      expect(result).toBe('Normal Cell Content');
      expect(mockCell.getMergeState).not.toHaveBeenCalled();
      expect(mockCell.getText).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    it('should extract text from HEAD cell', () => {
      const mockCell = makeCell(globalThis.SlidesApp.CellMergeState.HEAD, 'Head Cell Content');
      const result = parser.extractCellText(mockCell, globalThis.SlidesApp.CellMergeState.HEAD);
      expect(result).toBe('Head Cell Content');
      expect(mockCell.getMergeState).not.toHaveBeenCalled();
      expect(mockCell.getText).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    it('should return empty string for MERGED cell without calling getText or logging per cell', () => {
      const mockCell = makeCell(globalThis.SlidesApp.CellMergeState.MERGED);
      const result = parser.extractCellText(mockCell, globalThis.SlidesApp.CellMergeState.MERGED);
      expect(result).toBe('');
      expect(mockCell.getMergeState).not.toHaveBeenCalled();
      expect(mockCell.getText).not.toHaveBeenCalled();
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    it('should handle empty cell content from NORMAL cell', () => {
      const mockCell = makeCell(globalThis.SlidesApp.CellMergeState.NORMAL, '');
      const result = parser.extractCellText(mockCell, globalThis.SlidesApp.CellMergeState.NORMAL);
      expect(result).toBe('');
      expect(mockCell.getText).toHaveBeenCalledTimes(1);
    });

    it('should handle whitespace-only content from HEAD cell', () => {
      const mockCell = makeCell(globalThis.SlidesApp.CellMergeState.HEAD, '   \n\t  ');
      const result = parser.extractCellText(mockCell, globalThis.SlidesApp.CellMergeState.HEAD);
      expect(result).toBe('');
    });

    it('should trim whitespace from cell content', () => {
      const mockCell = makeCell(
        globalThis.SlidesApp.CellMergeState.NORMAL,
        '\n  Content with spaces  \t'
      );
      const result = parser.extractCellText(mockCell, globalThis.SlidesApp.CellMergeState.NORMAL);
      expect(result).toBe('Content with spaces');
    });

    it('should reject missing explicit helper inputs without touching the table', () => {
      const mockCell = makeCell(globalThis.SlidesApp.CellMergeState.NORMAL, 'Value');
      const table = { getNumRows: vi.fn(), getNumColumns: vi.fn(), getCell: vi.fn() };
      expect(() =>
        parser.extractCellText(null, globalThis.SlidesApp.CellMergeState.NORMAL)
      ).toThrow(/cell is required/);
      expect(() => parser.extractCellText(mockCell, undefined)).toThrow(/mergeState is required/);
      expect(() => parser.extractTableCells(table, undefined)).toThrow(/context is required/);
      expect(() => parser.extractTableCells(table, null)).toThrow(/context is required/);
      expect(mockLogger.error).not.toHaveBeenCalled();
      expect(table.getCell).not.toHaveBeenCalled();
    });
  });

  describe('extractTableCells', () => {
    let parser;
    beforeEach(() => {
      parser = new SlidesParser();
    });

    it('should extract table with no merged cells', () => {
      const mockTable = {
        getNumRows: vi.fn().mockReturnValue(2),
        getNumColumns: vi.fn().mockReturnValue(2),
        getCell: vi.fn((r, c) => makeCell('NORMAL', `Cell ${r},${c}`)),
      };
      const result = parser.extractTableCells(mockTable, {
        documentId: 'doc-1',
        pageId: 'page-1',
        taskTitle: 'Task 1',
      });
      expect(result).toEqual([
        ['Cell 0,0', 'Cell 0,1'],
        ['Cell 1,0', 'Cell 1,1'],
      ]);
      expect(mockTable.getCell).toHaveBeenCalledTimes(4);
    });

    it('should handle table with merged cells correctly', () => {
      const mockTable = {
        getNumRows: vi.fn().mockReturnValue(3),
        getNumColumns: vi.fn().mockReturnValue(3),
        getCell: vi.fn((r, c) => {
          if (r === 0 && c === 0) return makeCell('HEAD', 'Merged Header');
          if ((r === 0 && c === 1) || (r === 1 && c === 0) || (r === 1 && c === 1)) {
            return makeCell('MERGED');
          }
          return makeCell('NORMAL', `Cell ${r},${c}`);
        }),
      };
      const result = parser.extractTableCells(mockTable, {
        documentId: 'doc-1',
        pageId: 'page-1',
        taskTitle: 'Task 1',
      });
      expect(result).toEqual([
        ['Merged Header', '', 'Cell 0,2'],
        ['', '', 'Cell 1,2'],
        ['Cell 2,0', 'Cell 2,1', 'Cell 2,2'],
      ]);
      expect(mockLogger.debug).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Merged cells skipped in table extraction',
        expect.objectContaining({ mergedCellCount: 3 })
      );
    });

    it('should handle table with multiple separate merged regions', () => {
      const mockTable = {
        getNumRows: vi.fn().mockReturnValue(2),
        getNumColumns: vi.fn().mockReturnValue(4),
        getCell: vi.fn((r, c) => {
          if (r === 0 && c === 0) return makeCell('HEAD', 'Merge 1');
          if (r === 0 && c === 1) return makeCell('MERGED');
          if (r === 1 && c === 2) return makeCell('HEAD', 'Merge 2');
          if (r === 1 && c === 3) return makeCell('MERGED');
          return makeCell('NORMAL', `Cell ${r},${c}`);
        }),
      };
      const result = parser.extractTableCells(mockTable, {
        documentId: 'doc-1',
        pageId: 'page-1',
        taskTitle: 'Task 1',
      });
      expect(result).toEqual([
        ['Merge 1', '', 'Cell 0,2', 'Cell 0,3'],
        ['Cell 1,0', 'Cell 1,1', 'Merge 2', ''],
      ]);
      expect(mockLogger.debug).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Merged cells skipped in table extraction',
        expect.objectContaining({ mergedCellCount: 2, pageId: 'page-1' })
      );
    });

    it('should throw for a null table now that feature detection was removed', () => {
      const context = { documentId: 'doc-1', pageId: 'page-9', taskTitle: 'Task 1' };
      expect(() => parser.extractTableCells(null, context)).toThrow();
      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'extractTableCells failed',
        expect.objectContaining({ documentId: 'doc-1', row: null, column: null })
      );
    });

    it('should throw for a table without the known GAS table methods', () => {
      const context = { documentId: 'doc-1', pageId: 'page-9', taskTitle: 'Task 1' };
      expect(() => parser.extractTableCells({}, context)).toThrow();
      expect(mockLogger.error).toHaveBeenCalledTimes(1);
    });

    it('should handle empty table (0 rows)', () => {
      const mockTable = {
        getNumRows: vi.fn().mockReturnValue(0),
        getNumColumns: vi.fn().mockReturnValue(3),
        getCell: vi.fn(),
      };
      const result = parser.extractTableCells(mockTable, {
        documentId: 'doc-1',
        pageId: 'page-1',
        taskTitle: 'Task 1',
      });
      expect(result).toEqual([]);
      expect(mockTable.getCell).not.toHaveBeenCalled();
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    it('should handle table with 0 columns', () => {
      const mockTable = {
        getNumRows: vi.fn().mockReturnValue(3),
        getNumColumns: vi.fn().mockReturnValue(0),
        getCell: vi.fn(),
      };
      const result = parser.extractTableCells(mockTable, {
        documentId: 'doc-1',
        pageId: 'page-1',
        taskTitle: 'Task 1',
      });
      expect(result).toEqual([[], [], []]);
      expect(mockTable.getCell).not.toHaveBeenCalled();
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    it('should log with context and rethrow when cell extraction fails', () => {
      const failure = new Error('Unexpected error during cell access');
      const mockTable = {
        getNumRows: vi.fn().mockReturnValue(2),
        getNumColumns: vi.fn().mockReturnValue(2),
        getCell: vi.fn().mockImplementation((rowIndex, columnIndex) => {
          if (rowIndex === 1 && columnIndex === 0) throw failure;
          return makeCell('NORMAL', `Cell ${rowIndex},${columnIndex}`);
        }),
      };
      let thrown = null;
      try {
        parser.extractTableCells(mockTable, {
          documentId: 'doc-1',
          pageId: 'page-9',
          taskTitle: 'Task 1',
        });
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBe(failure);
      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'extractTableCells failed',
        expect.objectContaining({
          documentId: 'doc-1',
          pageId: 'page-9',
          taskTitle: 'Task 1',
          row: 1,
          column: 0,
          error: failure,
        })
      );
      expect(mockLogger.error.mock.calls[0][1].error).toBe(failure);
    });

    it('should log with context and rethrow when getCell returns null', () => {
      const mockTable = {
        getNumRows: vi.fn().mockReturnValue(1),
        getNumColumns: vi.fn().mockReturnValue(2),
        getCell: vi.fn().mockImplementation((rowIndex, columnIndex) => {
          if (rowIndex === 0 && columnIndex === 1) return null;
          return makeCell('NORMAL', 'Head value');
        }),
      };
      let thrown = null;
      try {
        parser.extractTableCells(mockTable, {
          documentId: 'doc-null',
          pageId: 'page-null',
          taskTitle: 'Task Null',
        });
      } catch (error) {
        thrown = error;
      }
      // A null cell must fail loudly so it can never become blank content.
      expect(thrown).toBeInstanceOf(TypeError);
      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'extractTableCells failed',
        expect.objectContaining({
          documentId: 'doc-null',
          pageId: 'page-null',
          taskTitle: 'Task Null',
          row: 0,
          column: 1,
        })
      );
      expect(mockLogger.error.mock.calls[0][1].error).toBe(thrown);
    });

    it.each([
      ['getNumRows', 'Rows RPC failed'],
      ['getNumColumns', 'Columns RPC failed'],
    ])(
      'should log once with unset coordinates and rethrow when %s fails',
      (failingMethod, message) => {
        const failure = new Error(message);
        const mockTable = {
          getNumRows: vi.fn().mockReturnValue(2),
          getNumColumns: vi.fn().mockReturnValue(2),
          getCell: vi.fn(),
        };
        mockTable[failingMethod].mockImplementation(() => {
          throw failure;
        });
        let thrown = null;
        try {
          parser.extractTableCells(mockTable, {
            documentId: 'doc-1',
            pageId: 'page-9',
            taskTitle: 'Task 1',
          });
        } catch (error) {
          thrown = error;
        }
        expect(thrown).toBe(failure);
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(
          'extractTableCells failed',
          expect.objectContaining({
            documentId: 'doc-1',
            pageId: 'page-9',
            taskTitle: 'Task 1',
            row: null,
            column: null,
            error: failure,
          })
        );
        expect(mockLogger.error.mock.calls[0][1].error).toBe(failure);
        expect(mockTable.getCell).not.toHaveBeenCalled();
      }
    );

    it('should not emit merged-cell debug for tables without merged cells', () => {
      const mockTable = {
        getNumRows: vi.fn().mockReturnValue(2),
        getNumColumns: vi.fn().mockReturnValue(2),
        getCell: vi.fn((r, c) => makeCell('NORMAL', `Cell ${r},${c}`)),
      };
      const result = parser.extractTableCells(mockTable, {
        documentId: 'doc-1',
        pageId: 'page-1',
        taskTitle: 'Task 1',
      });
      expect(result).toEqual([
        ['Cell 0,0', 'Cell 0,1'],
        ['Cell 1,0', 'Cell 1,1'],
      ]);
      expect(mockLogger.debug).not.toHaveBeenCalled();
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should emit exactly one count-based debug record per table', () => {
      const firstTable = {
        getNumRows: vi.fn().mockReturnValue(1),
        getNumColumns: vi.fn().mockReturnValue(2),
        getCell: vi.fn((r, c) => (c === 0 ? makeCell('HEAD', 'First') : makeCell('MERGED'))),
      };
      const secondTable = {
        getNumRows: vi.fn().mockReturnValue(1),
        getNumColumns: vi.fn().mockReturnValue(3),
        getCell: vi.fn((r, c) => {
          if (c === 0) return makeCell('HEAD', 'Second');
          if (c === 1) return makeCell('MERGED');
          return makeCell('NORMAL', 'Plain');
        }),
      };
      expect(
        parser.extractTableCells(firstTable, {
          documentId: 'doc-1',
          pageId: 'page-first',
          taskTitle: 'Task 1',
        })
      ).toEqual([['First', '']]);
      expect(
        parser.extractTableCells(secondTable, {
          documentId: 'doc-1',
          pageId: 'page-second',
          taskTitle: 'Task 1',
        })
      ).toEqual([['Second', '', 'Plain']]);
      expect(mockLogger.debug).toHaveBeenCalledTimes(2);
      expect(mockLogger.debug).toHaveBeenNthCalledWith(
        1,
        'Merged cells skipped in table extraction',
        expect.objectContaining({ mergedCellCount: 1, pageId: 'page-first' })
      );
      expect(mockLogger.debug).toHaveBeenNthCalledWith(
        2,
        'Merged cells skipped in table extraction',
        expect.objectContaining({ mergedCellCount: 1, pageId: 'page-second' })
      );
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should handle mixed content with trimming in merged table', () => {
      const mockTable = {
        getNumRows: vi.fn().mockReturnValue(2),
        getNumColumns: vi.fn().mockReturnValue(2),
        getCell: vi.fn((r, c) => {
          if (r === 0 && c === 0) return makeCell('HEAD', '  Trimmed Header  ');
          if (r === 0 && c === 1) return makeCell('MERGED');
          return makeCell('NORMAL', `  Content ${r},${c}  `);
        }),
      };
      const result = parser.extractTableCells(mockTable, {
        documentId: 'doc-1',
        pageId: 'page-1',
        taskTitle: 'Task 1',
      });
      expect(result).toEqual([
        ['Trimmed Header', ''],
        ['Content 1,0', 'Content 1,1'],
      ]);
    });
  });
});
