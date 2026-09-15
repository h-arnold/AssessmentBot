import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import {
  saveSlidesParserModuleGlobals,
  restoreSlidesParserModuleGlobals,
  createSlidesParserMockLogger,
  installSlidesParserGlobals,
  loadSlidesParserModules,
  createShapeElement,
  createTableElement,
  createTaggedElement,
  createSlide,
  buildSlidesParserHarness,
} from '../helpers/slidesParserTestHarness.js';

// Slides parser matching and document ID coverage.
describe('SlidesParser matching and document ID propagation', () => {
  describe('SlidesParser', () => {
    const refDocId = 'ref-doc-123';
    const tplDocId = 'tpl-doc-456';
    const studentDocId = 'student-doc-789';
    let SlidesParser;
    let mockLogger;
    let restoreGlobals;
    const savedModuleGlobals = saveSlidesParserModuleGlobals();

    beforeAll(async () => {
      SlidesParser = await loadSlidesParserModules();
    });

    afterAll(() => {
      restoreSlidesParserModuleGlobals(savedModuleGlobals);
    });

    beforeEach(() => {
      mockLogger = createSlidesParserMockLogger(vi);
      restoreGlobals = installSlidesParserGlobals(vi, mockLogger);
    });

    afterEach(() => {
      restoreGlobals();
    });

    it('sets documentId for reference and template artifacts', () => {
      const refSlide = createSlide(vi, 'page-1', [createShapeElement(vi, '# Task 1', 'Ref text')]);
      const tplSlide = createSlide(vi, 'page-1', [createShapeElement(vi, '# Task 1', 'Tpl text')]);
      const parser = buildSlidesParserHarness(vi, SlidesParser, {
        [refDocId]: [refSlide],
        [tplDocId]: [tplSlide],
      });
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
      const refSlide = createSlide(vi, referencePageId, [
        createShapeElement(vi, '# Task 1', 'Ref text'),
      ]);
      const tplSlide = createSlide(vi, templatePageId, [
        createShapeElement(vi, '# Task 1', 'Tpl text'),
      ]);
      const parser = buildSlidesParserHarness(vi, SlidesParser, {
        [refDocId]: [refSlide],
        [tplDocId]: [tplSlide],
      });
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

    it('sets documentId on submission artifacts', () => {
      const refSlide = createSlide(vi, 'page-1', [createShapeElement(vi, '# Task 1', 'Ref text')]);
      const tplSlide = createSlide(vi, 'page-1', [createShapeElement(vi, '# Task 1', 'Tpl text')]);
      const studentSlide = createSlide(vi, 'page-1', [
        createShapeElement(vi, '# Task 1', 'Student text'),
      ]);
      const parser = buildSlidesParserHarness(vi, SlidesParser, {
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
      const refSlide = createSlide(vi, 'ref-page-1', [
        createShapeElement(vi, '# Task 1', 'Ref text'),
      ]);
      const tplSlide = createSlide(vi, 'tpl-page-2', [
        createShapeElement(vi, '# Task 1', 'Tpl text'),
      ]);
      const studentSlides = [
        createSlide(vi, 'student-page-other', [createShapeElement(vi, '# Task 2', 'Other task')]),
        createSlide(vi, 'student-page-99', [createShapeElement(vi, '# Task 1', 'Student text')]),
      ];
      const parser = buildSlidesParserHarness(vi, SlidesParser, {
        [refDocId]: [refSlide],
        [tplDocId]: [tplSlide],
        [studentDocId]: studentSlides,
      });
      const defs = parser.extractTaskDefinitions(refDocId, tplDocId);
      const artifacts = parser.extractSubmissionArtifacts(studentDocId, defs);

      expect(artifacts).toHaveLength(1);
      expect(artifacts[0]).toEqual({
        taskId: defs[0].getId(),
        pageId: 'student-page-99',
        content: 'Student text',
        metadata: {},
        documentId: studentDocId,
        type: 'TEXT',
      });
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('extracts a table submission when the student description is the bare task title', () => {
      const refSlide = createSlide(vi, 'ref-table-page', [
        createTableElement(vi, '# Task Table', [['Reference value']]),
      ]);
      const studentSlide = createSlide(vi, 'student-table-page', [
        createTableElement(vi, 'Task Table', [['Student value']]),
      ]);
      const parser = buildSlidesParserHarness(vi, SlidesParser, {
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
          content: [['Student value']],
          metadata: {},
          documentId: studentDocId,
          type: 'TABLE',
        },
      ]);
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('extracts a table submission when the student description is the stable task id', () => {
      const refSlide = createSlide(vi, 'ref-table-page', [
        createTableElement(vi, '# Task Table', [['Reference value']]),
      ]);
      let studentTaskId = null;
      const parser = buildSlidesParserHarness(vi, SlidesParser, {
        [refDocId]: [refSlide],
        [studentDocId]: () => [
          createSlide(vi, 'student-table-page', [
            createTableElement(vi, studentTaskId, [['Student value by id']]),
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
          content: [['Student value by id']],
          metadata: {},
          documentId: studentDocId,
          type: 'TABLE',
        },
      ]);
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('extracts image submissions by task title across the deck and uses the matched student slide pageId in sourceUrl', () => {
      const refSlide = createSlide(vi, 'ref-image-page', [createTaggedElement(vi, '~ Task 1')]);
      const studentSlides = [
        createSlide(vi, 'student-image-other', [createTaggedElement(vi, '| Task 2')]),
        createSlide(vi, 'student-image-page', [createTaggedElement(vi, '| Task 1')]),
      ];
      const parser = buildSlidesParserHarness(vi, SlidesParser, {
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
        type: 'IMAGE',
        metadata: {
          sourceUrl:
            'https://docs.google.com/presentation/d/student-doc-789/export/png?id=student-doc-789&pageid=student-image-page',
        },
      });
      expect(Object.keys(artifacts[0]).sort()).toEqual([
        'content',
        'documentId',
        'metadata',
        'pageId',
        'taskId',
        'type',
      ]);
      expect(artifacts[0]).not.toHaveProperty('contentHash');
      expect(artifacts[0]).not.toHaveProperty('role');
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('does not extract image submissions when the student description is only the stable task id without an image tag', () => {
      const refSlide = createSlide(vi, 'ref-image-page', [createTaggedElement(vi, '~ Task 1')]);
      let studentTaskId = null;
      const parser = buildSlidesParserHarness(vi, SlidesParser, {
        [refDocId]: [refSlide],
        [studentDocId]: () => [
          createSlide(vi, 'student-image-other', [createTaggedElement(vi, 'Task 2')]),
          createSlide(vi, 'student-image-page-by-id', [createTaggedElement(vi, studentTaskId)]),
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
          metadata: {},
          documentId: studentDocId,
          type: 'IMAGE',
        },
      ]);
      expect(artifacts[0]).not.toHaveProperty('contentHash');
      expect(artifacts[0]).not.toHaveProperty('role');
      expect(mockLogger.error).toHaveBeenCalledWith(
        `No submission content for task "${defs[0].taskTitle}" in document ${studentDocId}.`,
        expect.objectContaining({
          taskTitle: defs[0].taskTitle,
          taskId: defs[0].getId(),
          documentId: studentDocId,
          type: 'IMAGE',
        })
      );
    });
  });
});
