import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';

// Slides parser matching and document ID coverage
describe('SlidesParser matching and document ID propagation', () => {
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

    const createTableElement = (description, rows) => ({
      getDescription: vi.fn(() => description),
      getPageElementType: vi.fn(() => globalThis.SlidesApp.PageElementType.TABLE),
      asTable: vi.fn(() => ({
        getNumRows: vi.fn(() => rows.length),
        getNumColumns: vi.fn(() => rows[0]?.length || 0),
        getCell: vi.fn((rowIndex, columnIndex) => ({
          getMergeState: vi.fn(() => globalThis.SlidesApp.CellMergeState.NORMAL),
          getText: vi.fn(() => ({
            asString: vi.fn(() => rows[rowIndex]?.[columnIndex] ?? ''),
          })),
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

    function buildSlidesParserHarness(slidesByDocId) {
      globalThis.SlidesApp.openById = vi.fn((id) => {
        const val = slidesByDocId[id];
        return { getSlides: typeof val === 'function' ? val : () => val || [] };
      });
      return new SlidesParser();
    }

    beforeAll(async () => {
      const documentParserModule =
        await import('../../src/backend/DocumentParsers/DocumentParser.js');
      const taskDefinitionModule = await import('../../src/backend/Models/TaskDefinition.js');

      globalThis.DocumentParser = documentParserModule.DocumentParser;
      globalThis.TaskDefinition = taskDefinitionModule.TaskDefinition;

      const slidesParserModule = await import('../../src/backend/DocumentParsers/SlidesParser.js');
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
        CellMergeState: {
          NORMAL: 'NORMAL',
          HEAD: 'HEAD',
          MERGED: 'MERGED',
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
      const parser = buildSlidesParserHarness({ [refDocId]: [refSlide], [tplDocId]: [tplSlide] });
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
      const parser = buildSlidesParserHarness({ [refDocId]: [refSlide], [tplDocId]: [tplSlide] });
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
      const parser = buildSlidesParserHarness({ [refDocId]: refSlides });
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
      const parser = buildSlidesParserHarness({
        [refDocId]: [refSlide],
        [tplDocId]: [tplSlide],
        [studentDocId]: [studentSlide],
      });
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
      const parser = buildSlidesParserHarness({
        [refDocId]: [refSlide],
        [tplDocId]: [tplSlide],
        [studentDocId]: studentSlides,
      });
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

    it('extracts a table submission when the student description is the bare task title', () => {
      const refSlide = createSlide('ref-table-page', [
        createTableElement('# Task Table', [['Reference value']]),
      ]);
      const studentSlide = createSlide('student-table-page', [
        createTableElement('Task Table', [['Student value']]),
      ]);
      const parser = buildSlidesParserHarness({
        [refDocId]: [refSlide],
        [studentDocId]: [studentSlide],
      });
      const defs = parser.extractTaskDefinitions(refDocId);
      const artifacts = parser.extractSubmissionArtifacts(studentDocId, defs);

      expect(defs).toHaveLength(1);
      expect(defs[0].getPrimaryReference().getType()).toBe('TABLE');
      expect(artifacts).toEqual([
        {
          taskId: defs[0].getId(),
          pageId: 'student-table-page',
          documentId: studentDocId,
          content: [['Student value']],
        },
      ]);
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('extracts a table submission when the student description is the stable task id', () => {
      const refSlide = createSlide('ref-table-page', [
        createTableElement('# Task Table', [['Reference value']]),
      ]);
      let studentTaskId = null;
      const parser = buildSlidesParserHarness({
        [refDocId]: [refSlide],
        [studentDocId]: () => [
          createSlide('student-table-page', [
            createTableElement(studentTaskId, [['Student value by id']]),
          ]),
        ],
      });
      const defs = parser.extractTaskDefinitions(refDocId);
      studentTaskId = defs[0].getId();
      const artifacts = parser.extractSubmissionArtifacts(studentDocId, defs);

      expect(defs).toHaveLength(1);
      expect(artifacts).toEqual([
        {
          taskId: defs[0].getId(),
          pageId: 'student-table-page',
          documentId: studentDocId,
          content: [['Student value by id']],
        },
      ]);
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('extracts image submissions by task title across the deck and uses the matched student slide pageId in sourceUrl', () => {
      const refSlide = createSlide('ref-image-page', [createTaggedElement('~ Task 1')]);
      const studentSlides = [
        createSlide('student-image-other', [createTaggedElement('| Task 2')]),
        createSlide('student-image-page', [createTaggedElement('| Task 1')]),
      ];
      const parser = buildSlidesParserHarness({
        [refDocId]: [refSlide],
        [studentDocId]: studentSlides,
      });
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

    it('does not extract image submissions when the student description is only the stable task id without an image tag', () => {
      const refSlide = createSlide('ref-image-page', [createTaggedElement('~ Task 1')]);
      let studentTaskId = null;
      const parser = buildSlidesParserHarness({
        [refDocId]: [refSlide],
        [studentDocId]: () => [
          createSlide('student-image-other', [createTaggedElement('Task 2')]),
          createSlide('student-image-page-by-id', [createTaggedElement(studentTaskId)]),
        ],
      });
      const defs = parser.extractTaskDefinitions(refDocId);
      studentTaskId = defs[0].getId();
      const artifacts = parser.extractSubmissionArtifacts(studentDocId, defs);

      expect(defs).toHaveLength(1);
      expect(artifacts).toEqual([
        {
          taskId: defs[0].getId(),
          pageId: null,
          content: null,
          documentId: studentDocId,
        },
      ]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Failed to extract artifact for task "${defs[0].taskTitle}" in document ${studentDocId}.`
      );
    });

    it('does not create task definitions from untagged plain titles in reference or template slides', () => {
      const refSlide = createSlide('ref-plain-page', [createShapeElement('Task 1', 'Ref text')]);
      const tplSlide = createSlide('tpl-plain-page', [createShapeElement('Task 1', 'Tpl text')]);
      const parser = buildSlidesParserHarness({ [refDocId]: [refSlide], [tplDocId]: [tplSlide] });
      const defs = parser.extractTaskDefinitions(refDocId, tplDocId);

      expect(defs).toHaveLength(0);
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });
});
