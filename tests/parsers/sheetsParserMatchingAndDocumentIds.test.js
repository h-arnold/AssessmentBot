import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';

// Sheets parser matching and document ID coverage
describe('SheetsParser matching and document ID propagation', () => {
  describe('SheetsParser', () => {
    const refDocId = 'sheet-ref-1';
    const tplDocId = 'sheet-tpl-2';
    const studentDocId = 'sheet-student-3';
    let SheetsParser;
    let parser;

    beforeAll(async () => {
      const documentParserModule =
        await import('../../src/backend/DocumentParsers/DocumentParser.js');
      const taskDefinitionModule = await import('../../src/backend/Models/TaskDefinition.js');

      globalThis.DocumentParser = documentParserModule.DocumentParser;
      globalThis.TaskDefinition = taskDefinitionModule.TaskDefinition;

      const sheetsParserModule = await import('../../src/backend/DocumentParsers/SheetsParser.js');
      SheetsParser = sheetsParserModule.SheetsParser;
    });

    beforeEach(() => {
      globalThis.ABLogger = {
        getInstance: vi.fn().mockReturnValue({ warn: vi.fn(), error: vi.fn() }),
      };

      globalThis.SpreadsheetApp = {
        openById: vi.fn(() => ({
          getSheets: () => [
            {
              getSheetId: vi.fn(() => 11),
            },
          ],
        })),
      };

      globalThis.TaskSheet = class TaskSheet {
        constructor() {
          this.formulaArray = [['=REF']];
        }
        getAllFormulae() {
          return this.formulaArray;
        }
        getRange() {
          return [['=STUDENT']];
        }
      };
      parser = new SheetsParser();
    });

    afterEach(() => {
      delete globalThis.SpreadsheetApp;
      delete globalThis.TaskSheet;
      delete globalThis.ABLogger;
    });

    function buildSheetsParserHarness() {
      const parser = new SheetsParser();
      parser.processAndCompareSheets = vi.fn(() => ({
        SheetOne: {
          sheetId: 11,
          formulas: [{ referenceFormula: '=A1', location: [0, 0] }],
          boundingBox: {
            startRow: 1,
            startColumn: 1,
            endRow: 1,
            endColumn: 1,
            numRows: 1,
            numColumns: 1,
          },
        },
      }));
      return parser;
    }

    it('sets documentId on reference, template and submission artifacts', () => {
      const p = buildSheetsParserHarness();
      const defs = p.extractTaskDefinitions(refDocId, tplDocId);
      const artifacts = p.extractSubmissionArtifacts(studentDocId, defs);

      expect(defs[0].getPrimaryReference().documentId).toBe(refDocId);
      expect(defs[0].getPrimaryTemplate().documentId).toBe(tplDocId);
      expect(artifacts).toHaveLength(1);
      expect(artifacts[0].documentId).toBe(studentDocId);
    });

    it('keeps raw reference formulas unchanged when building referenceFormula entries', () => {
      const rawReferenceFormula = '=sum( \'Challenge 6\'!c11, "Mi xed" )';

      const differences = parser._compareFormulaArrays([[rawReferenceFormula]], [['=DIFFERENT']]);

      expect(differences).toEqual([
        {
          referenceFormula: rawReferenceFormula,
          location: [0, 0],
        },
      ]);
    });

    describe('_createReferenceLocationsMap', () => {
      it('creates a map from formula locations to indices', () => {
        const formulas = [{ location: [0, 0] }, { location: [1, 2] }, { location: [3, 4] }];
        const map = parser._createReferenceLocationsMap(formulas);
        expect(map).toEqual({
          '0,0': 0,
          '1,2': 1,
          '3,4': 2,
        });
      });

      it('handles single formula entry', () => {
        const map = parser._createReferenceLocationsMap([{ location: [5, 10] }]);
        expect(map).toEqual({ '5,10': 0 });
      });

      it('overwrites duplicate locations with last index', () => {
        const formulas = [{ location: [0, 0] }, { location: [0, 0] }, { location: [1, 1] }];
        const map = parser._createReferenceLocationsMap(formulas);
        expect(map['0,0']).toBe(1); // last index wins
        expect(map['1,1']).toBe(2);
      });

      it('handles empty formulas array', () => {
        const map = parser._createReferenceLocationsMap([]);
        expect(map).toEqual({});
      });
    });

    describe('_compareFormulaArrays', () => {
      it('returns empty array for identical formula arrays', () => {
        const result = parser._compareFormulaArrays(
          [['=A1', '=B1'], ['=A2']],
          [['=A1', '=B1'], ['=A2']]
        );
        expect(result).toEqual([]);
      });

      it('detects differences between reference and template arrays', () => {
        const result = parser._compareFormulaArrays([['=A1', '=B1']], [['=A1', '=DIFFERENT']]);
        expect(result).toEqual([{ referenceFormula: '=B1', location: [0, 1] }]);
      });

      it('handles template array with fewer rows', () => {
        const result = parser._compareFormulaArrays([['=A1'], ['=B1']], [['=A1']]);
        expect(result).toEqual([{ referenceFormula: '=B1', location: [1, 0] }]);
      });

      it('handles empty reference arrays', () => {
        const result = parser._compareFormulaArrays([], [['=A1']]);
        expect(result).toEqual([]);
      });

      it('handles reference with empty formula cells', () => {
        const result = parser._compareFormulaArrays([['', '=A1']], [['', '=A1']]);
        // Empty strings in reference are skipped
        expect(result).toEqual([]);
      });

      it('reports differences when template has shorter row', () => {
        const result = parser._compareFormulaArrays([['=A1', '=B1', '=C1']], [['=A1', '=B1']]);
        expect(result).toEqual([{ referenceFormula: '=C1', location: [0, 2] }]);
      });
    });

    describe('_calculateBoundingBox', () => {
      it.each([
        ['empty array', []],
        ['null', null],
        ['undefined', undefined],
      ])('returns null for %s input', (_, input) => {
        expect(parser._calculateBoundingBox(input)).toBeNull();
      });

      it('calculates bounding box for single cell', () => {
        const bbox = parser._calculateBoundingBox([{ location: [0, 0] }]);
        expect(bbox).toEqual({
          startRow: 1,
          startColumn: 1,
          endRow: 1,
          endColumn: 1,
          numRows: 1,
          numColumns: 1,
        });
      });

      it('calculates bounding box for multiple cells', () => {
        const bbox = parser._calculateBoundingBox([{ location: [1, 2] }, { location: [4, 6] }]);
        expect(bbox).toEqual({
          startRow: 2,
          startColumn: 3,
          endRow: 5,
          endColumn: 7,
          numRows: 4,
          numColumns: 5,
        });
      });

      it('uses 1-based indexing for row and column', () => {
        const bbox = parser._calculateBoundingBox([{ location: [0, 0] }, { location: [2, 3] }]);
        expect(bbox.startRow).toBe(1);
        expect(bbox.startColumn).toBe(1);
        expect(bbox.endRow).toBe(3);
        expect(bbox.endColumn).toBe(4);
      });

      it('handles non-contiguous cells', () => {
        const bbox = parser._calculateBoundingBox([
          { location: [0, 0] },
          { location: [0, 5] },
          { location: [3, 0] },
        ]);
        expect(bbox.numRows).toBe(4);
        expect(bbox.numColumns).toBe(6);
      });
    });
  });
});
