/**
 * Tests for SlidesParser merged cell handling
 *
 * Tests the extractCellText and extractTableCells methods to ensure correct
 * handling of merged cells in Google Slides tables. Merged cells have three states:
 * - NORMAL: Regular unmerged cell
 * - HEAD: Top-left cell of a merged region (contains the content)
 * - MERGED: Non-head cells in a merged region (should return empty string)
 *
 * The implementation prevents the exception "This operation is only allowed on
 * the head (upper left) cell of the merged cells" by checking merge state before
 * calling getText() on cells.
 *
 * Note: The test dynamically loads the production SlidesParser class after
 * seeding required globals so we exercise the real implementation without
 * reproducing it inline.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { createMockABLogger } from '../helpers/mockFactories.js';

describe('SlidesParser - Merged Cell Handling', () => {
  let SlidesParser;
  let mockLogger;

  beforeAll(async () => {
    const documentParserModule = await import(
      '../../src/AdminSheet/DocumentParsers/DocumentParser.js'
    );
    const taskDefinitionModule = await import('../../src/AdminSheet/Models/TaskDefinition.js');

    const documentParser =
      documentParserModule.DocumentParser || documentParserModule.default?.DocumentParser;
    const taskDefinition =
      taskDefinitionModule.TaskDefinition || taskDefinitionModule.default?.TaskDefinition;

    if (!documentParser || !taskDefinition) {
      throw new Error('Failed to load DocumentParser or TaskDefinition for SlidesParser tests');
    }

    global.DocumentParser = documentParser;
    global.TaskDefinition = taskDefinition;

    const slidesParserModule = await import('../../src/AdminSheet/DocumentParsers/SlidesParser.js');
    SlidesParser = slidesParserModule.SlidesParser || slidesParserModule.default?.SlidesParser;

    if (!SlidesParser) {
      throw new Error('Failed to load SlidesParser for tests');
    }
  });

  afterAll(() => {
    delete global.DocumentParser;
    delete global.TaskDefinition;
  });

  beforeEach(() => {
    // Setup mock ABLogger
    mockLogger = createMockABLogger(vi);
    global.ABLogger = {
      getInstance: vi.fn().mockReturnValue(mockLogger),
    };

    // Setup mock SlidesApp with CellMergeState enum
    global.SlidesApp = {
      CellMergeState: {
        NORMAL: 'NORMAL',
        HEAD: 'HEAD',
        MERGED: 'MERGED',
      },
    };
  });

  afterEach(() => {
    delete global.ABLogger;
    delete global.SlidesApp;
  });

  describe('extractCellText', () => {
    let parser;

    beforeEach(() => {
      parser = new SlidesParser();
    });

    it('should extract text from NORMAL cell', () => {
      const mockCell = {
        getMergeState: vi.fn().mockReturnValue(global.SlidesApp.CellMergeState.NORMAL),
        getText: vi.fn().mockReturnValue({
          asString: vi.fn().mockReturnValue('  Normal Cell Content  '),
        }),
      };

      const result = parser.extractCellText(mockCell);

      expect(result).toBe('Normal Cell Content');
      expect(mockCell.getMergeState).toHaveBeenCalledTimes(1);
      expect(mockCell.getText).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    it('should extract text from HEAD cell', () => {
      const mockCell = {
        getMergeState: vi.fn().mockReturnValue(global.SlidesApp.CellMergeState.HEAD),
        getText: vi.fn().mockReturnValue({
          asString: vi.fn().mockReturnValue('Head Cell Content'),
        }),
      };

      const result = parser.extractCellText(mockCell);

      expect(result).toBe('Head Cell Content');
      expect(mockCell.getMergeState).toHaveBeenCalledTimes(1);
      expect(mockCell.getText).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    it('should return empty string for MERGED cell without calling getText', () => {
      const mockCell = {
        getMergeState: vi.fn().mockReturnValue(global.SlidesApp.CellMergeState.MERGED),
        getText: vi.fn().mockReturnValue({
          asString: vi.fn().mockReturnValue('This should not be called'),
        }),
      };

      const result = parser.extractCellText(mockCell);

      expect(result).toBe('');
      expect(mockCell.getMergeState).toHaveBeenCalledTimes(1);
      expect(mockCell.getText).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith('Merged cell skipped', {
        message: 'Non-head merged cell returned as empty string',
        mergeState: 'MERGED',
      });
    });

    it('should handle empty cell content from NORMAL cell', () => {
      const mockCell = {
        getMergeState: vi.fn().mockReturnValue(global.SlidesApp.CellMergeState.NORMAL),
        getText: vi.fn().mockReturnValue({
          asString: vi.fn().mockReturnValue(''),
        }),
      };

      const result = parser.extractCellText(mockCell);

      expect(result).toBe('');
      expect(mockCell.getText).toHaveBeenCalledTimes(1);
    });

    it('should handle whitespace-only content from HEAD cell', () => {
      const mockCell = {
        getMergeState: vi.fn().mockReturnValue(global.SlidesApp.CellMergeState.HEAD),
        getText: vi.fn().mockReturnValue({
          asString: vi.fn().mockReturnValue('   \n\t  '),
        }),
      };

      const result = parser.extractCellText(mockCell);

      expect(result).toBe('');
    });

    it('should trim whitespace from cell content', () => {
      const mockCell = {
        getMergeState: vi.fn().mockReturnValue(global.SlidesApp.CellMergeState.NORMAL),
        getText: vi.fn().mockReturnValue({
          asString: vi.fn().mockReturnValue('\n  Content with spaces  \t'),
        }),
      };

      const result = parser.extractCellText(mockCell);

      expect(result).toBe('Content with spaces');
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
        getCell: vi.fn((r, c) => ({
          getMergeState: vi.fn().mockReturnValue(global.SlidesApp.CellMergeState.NORMAL),
          getText: vi.fn().mockReturnValue({
            asString: vi.fn().mockReturnValue(`Cell ${r},${c}`),
          }),
        })),
      };

      const result = parser.extractTableCells(mockTable);

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
          // Simulate a 2x2 merge at position (0,0)
          if (r === 0 && c === 0) {
            return {
              getMergeState: vi.fn().mockReturnValue(global.SlidesApp.CellMergeState.HEAD),
              getText: vi.fn().mockReturnValue({
                asString: vi.fn().mockReturnValue('Merged Header'),
              }),
            };
          }
          if ((r === 0 && c === 1) || (r === 1 && c === 0) || (r === 1 && c === 1)) {
            return {
              getMergeState: vi.fn().mockReturnValue(global.SlidesApp.CellMergeState.MERGED),
              getText: vi.fn().mockReturnValue({
                asString: vi.fn().mockReturnValue('Should not be called'),
              }),
            };
          }
          return {
            getMergeState: vi.fn().mockReturnValue(global.SlidesApp.CellMergeState.NORMAL),
            getText: vi.fn().mockReturnValue({
              asString: vi.fn().mockReturnValue(`Cell ${r},${c}`),
            }),
          };
        }),
      };

      const result = parser.extractTableCells(mockTable);

      expect(result).toEqual([
        ['Merged Header', '', 'Cell 0,2'],
        ['', '', 'Cell 1,2'],
        ['Cell 2,0', 'Cell 2,1', 'Cell 2,2'],
      ]);
      expect(mockLogger.debug).toHaveBeenCalledTimes(3);
    });

    it('should handle table with multiple separate merged regions', () => {
      const mockTable = {
        getNumRows: vi.fn().mockReturnValue(2),
        getNumColumns: vi.fn().mockReturnValue(4),
        getCell: vi.fn((r, c) => {
          // First merge: (0,0) to (0,1)
          if (r === 0 && c === 0) {
            return {
              getMergeState: vi.fn().mockReturnValue(global.SlidesApp.CellMergeState.HEAD),
              getText: vi.fn().mockReturnValue({
                asString: vi.fn().mockReturnValue('Merge 1'),
              }),
            };
          }
          if (r === 0 && c === 1) {
            return {
              getMergeState: vi.fn().mockReturnValue(global.SlidesApp.CellMergeState.MERGED),
              getText: vi.fn(),
            };
          }
          // Second merge: (1,2) to (1,3)
          if (r === 1 && c === 2) {
            return {
              getMergeState: vi.fn().mockReturnValue(global.SlidesApp.CellMergeState.HEAD),
              getText: vi.fn().mockReturnValue({
                asString: vi.fn().mockReturnValue('Merge 2'),
              }),
            };
          }
          if (r === 1 && c === 3) {
            return {
              getMergeState: vi.fn().mockReturnValue(global.SlidesApp.CellMergeState.MERGED),
              getText: vi.fn(),
            };
          }
          return {
            getMergeState: vi.fn().mockReturnValue(global.SlidesApp.CellMergeState.NORMAL),
            getText: vi.fn().mockReturnValue({
              asString: vi.fn().mockReturnValue(`Cell ${r},${c}`),
            }),
          };
        }),
      };

      const result = parser.extractTableCells(mockTable);

      expect(result).toEqual([
        ['Merge 1', '', 'Cell 0,2', 'Cell 0,3'],
        ['Cell 1,0', 'Cell 1,1', 'Merge 2', ''],
      ]);
    });

    it('should return empty array for null table', () => {
      const result = parser.extractTableCells(null);
      expect(result).toEqual([]);
    });

    it('should return empty array for table without required methods', () => {
      const mockTable = {};
      const result = parser.extractTableCells(mockTable);
      expect(result).toEqual([]);
    });

    it('should handle empty table (0 rows)', () => {
      const mockTable = {
        getNumRows: vi.fn().mockReturnValue(0),
        getNumColumns: vi.fn().mockReturnValue(3),
        getCell: vi.fn(),
      };

      const result = parser.extractTableCells(mockTable);

      expect(result).toEqual([]);
      expect(mockTable.getCell).not.toHaveBeenCalled();
    });

    it('should handle table with 0 columns', () => {
      const mockTable = {
        getNumRows: vi.fn().mockReturnValue(3),
        getNumColumns: vi.fn().mockReturnValue(0),
        getCell: vi.fn(),
      };

      const result = parser.extractTableCells(mockTable);

      expect(result).toEqual([[], [], []]);
      expect(mockTable.getCell).not.toHaveBeenCalled();
    });

    it('should catch and log errors during extraction', () => {
      const mockTable = {
        getNumRows: vi.fn().mockReturnValue(1),
        getNumColumns: vi.fn().mockReturnValue(1),
        getCell: vi.fn().mockImplementation(() => {
          throw new Error('Unexpected error during cell access');
        }),
      };

      const result = parser.extractTableCells(mockTable);

      expect(result).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith('extractTableCells failed', expect.any(Error));
    });

    it('should handle mixed content with trimming in merged table', () => {
      const mockTable = {
        getNumRows: vi.fn().mockReturnValue(2),
        getNumColumns: vi.fn().mockReturnValue(2),
        getCell: vi.fn((r, c) => {
          if (r === 0 && c === 0) {
            return {
              getMergeState: vi.fn().mockReturnValue(global.SlidesApp.CellMergeState.HEAD),
              getText: vi.fn().mockReturnValue({
                asString: vi.fn().mockReturnValue('  Trimmed Header  '),
              }),
            };
          }
          if (r === 0 && c === 1) {
            return {
              getMergeState: vi.fn().mockReturnValue(global.SlidesApp.CellMergeState.MERGED),
              getText: vi.fn(),
            };
          }
          return {
            getMergeState: vi.fn().mockReturnValue(global.SlidesApp.CellMergeState.NORMAL),
            getText: vi.fn().mockReturnValue({
              asString: vi.fn().mockReturnValue(`  Content ${r},${c}  `),
            }),
          };
        }),
      };

      const result = parser.extractTableCells(mockTable);

      expect(result).toEqual([
        ['Trimmed Header', ''],
        ['Content 1,0', 'Content 1,1'],
      ]);
    });
  });
});
