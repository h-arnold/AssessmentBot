import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';

// Slides parser docId propagation
describe('Document ID propagation across parsers', () => {
  describe('SlidesParser', () => {
    const refDocId = 'ref-doc-123';
    const tplDocId = 'tpl-doc-456';
    const studentDocId = 'student-doc-789';
    let SlidesParser;
    let originalIsValidUrl;

    const createShapeElement = (description, text) => ({
      getDescription: vi.fn(() => description),
      getPageElementType: vi.fn(() => globalThis.SlidesApp.PageElementType.SHAPE),
      asShape: vi.fn(() => ({
        getText: vi.fn(() => ({
          asString: vi.fn(() => text),
        })),
      })),
    });

    const createSlide = (pageId, elements) => ({
      getObjectId: vi.fn(() => pageId),
      getPageElements: vi.fn(() => elements),
    });

    beforeAll(async () => {
      const documentParserModule = await import(
        '../../src/AdminSheet/DocumentParsers/DocumentParser.js'
      );
      const taskDefinitionModule = await import('../../src/AdminSheet/Models/TaskDefinition.js');

      globalThis.DocumentParser = documentParserModule.DocumentParser;
      globalThis.TaskDefinition = taskDefinitionModule.TaskDefinition;

      const slidesParserModule = await import(
        '../../src/AdminSheet/DocumentParsers/SlidesParser.js'
      );
      SlidesParser = slidesParserModule.SlidesParser;
    });

    beforeEach(() => {
      originalIsValidUrl = globalThis.Utils.isValidUrl;
      globalThis.Utils.isValidUrl = vi.fn(() => true);

      globalThis.ABLogger = {
        getInstance: vi.fn().mockReturnValue({ warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
      };

      globalThis.SlidesApp = {
        PageElementType: {
          SHAPE: 'SHAPE',
          TABLE: 'TABLE',
          IMAGE: 'IMAGE',
        },
      };
    });

    afterEach(() => {
      globalThis.Utils.isValidUrl = originalIsValidUrl;
      delete globalThis.SlidesApp;
      delete globalThis.ABLogger;
    });

    it('sets documentId for reference and template artifacts', () => {
      const refSlide = createSlide('page-1', [createShapeElement('# Task 1', 'Ref text')]);
      const tplSlide = createSlide('page-1', [createShapeElement('# Task 1', 'Tpl text')]);

      globalThis.SlidesApp.openById = vi.fn((id) => {
        if (id === refDocId) return { getSlides: () => [refSlide] };
        if (id === tplDocId) return { getSlides: () => [tplSlide] };
        return { getSlides: () => [] };
      });

      const parser = new SlidesParser();
      const defs = parser.extractTaskDefinitions(refDocId, tplDocId);
      const [def] = defs;
      const refArtifact = def.getPrimaryReference();
      const tplArtifact = def.getPrimaryTemplate();

      expect(refArtifact.documentId).toBe(refDocId);
      expect(tplArtifact.documentId).toBe(tplDocId);
    });

    it('sets documentId on submission artifacts', () => {
      const refSlide = createSlide('page-1', [createShapeElement('# Task 1', 'Ref text')]);
      const tplSlide = createSlide('page-1', [createShapeElement('# Task 1', 'Tpl text')]);
      const studentSlide = createSlide('page-1', [createShapeElement('# Task 1', 'Student text')]);

      globalThis.SlidesApp.openById = vi.fn((id) => {
        if (id === refDocId) return { getSlides: () => [refSlide] };
        if (id === tplDocId) return { getSlides: () => [tplSlide] };
        if (id === studentDocId) return { getSlides: () => [studentSlide] };
        return { getSlides: () => [] };
      });

      const parser = new SlidesParser();
      const defs = parser.extractTaskDefinitions(refDocId, tplDocId);
      const artifacts = parser.extractSubmissionArtifacts(studentDocId, defs);

      expect(artifacts).toHaveLength(1);
      expect(artifacts[0].documentId).toBe(studentDocId);
    });
  });

  describe('SheetsParser', () => {
    const refDocId = 'sheet-ref-1';
    const tplDocId = 'sheet-tpl-2';
    const studentDocId = 'sheet-student-3';
    let SheetsParser;

    beforeAll(async () => {
      const documentParserModule = await import(
        '../../src/AdminSheet/DocumentParsers/DocumentParser.js'
      );
      const taskDefinitionModule = await import('../../src/AdminSheet/Models/TaskDefinition.js');

      globalThis.DocumentParser = documentParserModule.DocumentParser;
      globalThis.TaskDefinition = taskDefinitionModule.TaskDefinition;

      const sheetsParserModule = await import(
        '../../src/AdminSheet/DocumentParsers/SheetsParser.js'
      );
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
    });

    afterEach(() => {
      delete globalThis.SpreadsheetApp;
      delete globalThis.TaskSheet;
      delete globalThis.ABLogger;
    });

    const boundingBox = {
      startRow: 1,
      startColumn: 1,
      endRow: 1,
      endColumn: 1,
      numRows: 1,
      numColumns: 1,
    };

    it('sets documentId for reference and template spreadsheet artifacts', () => {
      const parser = new SheetsParser();
      parser.processAndCompareSheets = vi.fn(() => ({
        SheetOne: {
          sheetId: 11,
          formulas: [
            {
              referenceFormula: '=A1',
              location: [0, 0],
            },
          ],
          boundingBox,
        },
      }));

      const defs = parser.extractTaskDefinitions(refDocId, tplDocId);
      const [def] = defs;
      const refArtifact = def.getPrimaryReference();
      const tplArtifact = def.getPrimaryTemplate();

      expect(refArtifact.documentId).toBe(refDocId);
      expect(tplArtifact.documentId).toBe(tplDocId);
    });

    it('sets documentId on spreadsheet submission artifacts', () => {
      const parser = new SheetsParser();
      parser.processAndCompareSheets = vi.fn(() => ({
        SheetOne: {
          sheetId: 11,
          formulas: [
            {
              referenceFormula: '=A1',
              location: [0, 0],
            },
          ],
          boundingBox,
        },
      }));

      const defs = parser.extractTaskDefinitions(refDocId, tplDocId);
      const artifacts = parser.extractSubmissionArtifacts(studentDocId, defs);

      expect(artifacts).toHaveLength(1);
      expect(artifacts[0].documentId).toBe(studentDocId);
    });
  });
});
