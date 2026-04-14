import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';

// Slides parser docId propagation
describe('Document ID propagation across parsers', () => {
  describe('SlidesParser', () => {
    const refDocId = 'ref-doc-123';
    const tplDocId = 'tpl-doc-456';
    const studentDocId = 'student-doc-789';
    let SlidesParser;
    let originalIsValidUrl;
    let mockLogger;

    const createShapeElement = (description, text) => ({
      getDescription: vi.fn(() => description),
      getPageElementType: vi.fn(() => globalThis.SlidesApp.PageElementType.SHAPE),
      asShape: vi.fn(() => ({
        getText: vi.fn(() => ({
          asString: vi.fn(() => text),
        })),
      })),
    });

    const createTaggedElement = (description) => ({
      getDescription: vi.fn(() => description),
    });

    const createSlide = (pageId, elements) => ({
      getObjectId: vi.fn(() => pageId),
      getPageElements: vi.fn(() => elements),
    });

    beforeAll(async () => {
      const documentParserModule =
        await import('../../src/AdminSheet/DocumentParsers/DocumentParser.js');
      const taskDefinitionModule = await import('../../src/AdminSheet/Models/TaskDefinition.js');

      globalThis.DocumentParser = documentParserModule.DocumentParser;
      globalThis.TaskDefinition = taskDefinitionModule.TaskDefinition;

      const slidesParserModule =
        await import('../../src/AdminSheet/DocumentParsers/SlidesParser.js');
      SlidesParser = slidesParserModule.SlidesParser;
    });

    beforeEach(() => {
      originalIsValidUrl = globalThis.Utils.isValidUrl;
      globalThis.Utils.isValidUrl = vi.fn(() => true);

      mockLogger = {
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      };

      globalThis.ABLogger = {
        getInstance: vi.fn().mockReturnValue(mockLogger),
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

    it('merges reference and template slides with the same title into one task definition across different pageIds', () => {
      const referencePageId = 'ref-page-1';
      const templatePageId = 'tpl-page-2';
      const refSlide = createSlide(referencePageId, [createShapeElement('# Task 1', 'Ref text')]);
      const tplSlide = createSlide(templatePageId, [createShapeElement('# Task 1', 'Tpl text')]);

      globalThis.SlidesApp.openById = vi.fn((id) => {
        if (id === refDocId) return { getSlides: () => [refSlide] };
        if (id === tplDocId) return { getSlides: () => [tplSlide] };
        return { getSlides: () => [] };
      });

      const parser = new SlidesParser();
      const defs = parser.extractTaskDefinitions(refDocId, tplDocId);

      expect(defs).toHaveLength(1);

      const [def] = defs;
      expect(def.getId()).toBe(parser.buildSlidesTaskId('Task 1'));
      expect(def.pageId).toBe(referencePageId);
      expect(def.artifacts.reference).toHaveLength(1);
      expect(def.artifacts.template).toHaveLength(1);
      expect(def.getPrimaryReference().content).toBe('Ref text');
      expect(def.getPrimaryTemplate().content).toBe('Tpl text');
    });

    it('attaches notes by task title even when the note is on a different slide pageId', () => {
      const definitionPageId = 'ref-page-1';
      const notesPageId = 'ref-page-2';
      const refSlides = [
        createSlide(definitionPageId, [createShapeElement('# Task 1', 'Ref text')]),
        createSlide(notesPageId, [createShapeElement('^ Task 1', 'Notes for Task 1')]),
      ];

      globalThis.SlidesApp.openById = vi.fn((id) => {
        if (id === refDocId) return { getSlides: () => refSlides };
        return { getSlides: () => [] };
      });

      const parser = new SlidesParser();
      const defs = parser.extractTaskDefinitions(refDocId);

      expect(defs).toHaveLength(1);
      expect(defs[0].pageId).toBe(definitionPageId);
      expect(defs[0].taskNotes).toBe('Notes for Task 1');
      expect(mockLogger.warn).not.toHaveBeenCalled();
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

    it('extracts a student submission by title from a different slide pageId and preserves student identifiers', () => {
      const refSlide = createSlide('ref-page-1', [createShapeElement('# Task 1', 'Ref text')]);
      const tplSlide = createSlide('tpl-page-2', [createShapeElement('# Task 1', 'Tpl text')]);
      const studentSlides = [
        createSlide('student-page-other', [createShapeElement('# Task 2', 'Other task')]),
        createSlide('student-page-99', [createShapeElement('# Task 1', 'Student text')]),
      ];

      globalThis.SlidesApp.openById = vi.fn((id) => {
        if (id === refDocId) return { getSlides: () => [refSlide] };
        if (id === tplDocId) return { getSlides: () => [tplSlide] };
        if (id === studentDocId) return { getSlides: () => studentSlides };
        return { getSlides: () => [] };
      });

      const parser = new SlidesParser();
      const defs = parser.extractTaskDefinitions(refDocId, tplDocId);
      const artifacts = parser.extractSubmissionArtifacts(studentDocId, defs);

      expect(artifacts).toHaveLength(1);
      expect(artifacts[0]).toMatchObject({
        taskId: defs[0].getId(),
        pageId: 'student-page-99',
        documentId: studentDocId,
        content: 'Student text',
      });
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('extracts image submissions by task title across the deck and uses the matched student slide pageId in sourceUrl', () => {
      const refSlide = createSlide('ref-image-page', [createTaggedElement('~ Task 1')]);
      const studentSlides = [
        createSlide('student-image-other', [createTaggedElement('| Task 2')]),
        createSlide('student-image-page', [createTaggedElement('| Task 1')]),
      ];

      globalThis.SlidesApp.openById = vi.fn((id) => {
        if (id === refDocId) return { getSlides: () => [refSlide] };
        if (id === studentDocId) return { getSlides: () => studentSlides };
        return { getSlides: () => [] };
      });

      const parser = new SlidesParser();
      const defs = parser.extractTaskDefinitions(refDocId);
      const artifacts = parser.extractSubmissionArtifacts(studentDocId, defs);

      expect(defs).toHaveLength(1);
      expect(defs[0].getPrimaryReference().getType()).toBe('IMAGE');
      expect(artifacts).toHaveLength(1);
      expect(artifacts[0]).toMatchObject({
        taskId: defs[0].getId(),
        pageId: 'student-image-page',
        documentId: studentDocId,
        content: null,
        metadata: {
          sourceUrl:
            'https://docs.google.com/presentation/d/student-doc-789/export/png?id=student-doc-789&pageid=student-image-page',
        },
      });
      expect(mockLogger.error).not.toHaveBeenCalled();
    });
  });

  describe('SheetsParser', () => {
    const refDocId = 'sheet-ref-1';
    const tplDocId = 'sheet-tpl-2';
    const studentDocId = 'sheet-student-3';
    let SheetsParser;

    beforeAll(async () => {
      const documentParserModule =
        await import('../../src/AdminSheet/DocumentParsers/DocumentParser.js');
      const taskDefinitionModule = await import('../../src/AdminSheet/Models/TaskDefinition.js');

      globalThis.DocumentParser = documentParserModule.DocumentParser;
      globalThis.TaskDefinition = taskDefinitionModule.TaskDefinition;

      const sheetsParserModule =
        await import('../../src/AdminSheet/DocumentParsers/SheetsParser.js');
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
