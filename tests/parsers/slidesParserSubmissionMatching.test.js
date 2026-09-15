import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import {
  saveSlidesParserModuleGlobals,
  restoreSlidesParserModuleGlobals,
  createSlidesParserMockLogger,
  installSlidesParserGlobals,
  loadSlidesParserModules,
  createShapeElement,
  createTableElement,
  createSlide,
  buildSlidesParserHarness,
} from '../helpers/slidesParserTestHarness.js';

// Pass B submission-phase coverage: tag-preferred matching, ambiguity warnings,
// type probing before extraction, lazy page id resolution, and requireParams
// rejection on the submission entry point.
describe('SlidesParser submission matching', () => {
  describe('SlidesParser', () => {
    const refDocId = 'ref-doc-123';
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

    it('prefers a tag-qualified match over an earlier bare-title element', () => {
      const refSlide = createSlide(vi, 'ref-page-1', [
        createShapeElement(vi, '# Task 1', 'Ref text'),
      ]);
      const studentSlides = [
        createSlide(vi, 'student-page-decoy', [createShapeElement(vi, 'Task 1', 'Decoy text')]),
        createSlide(vi, 'student-page-tagged', [
          createShapeElement(vi, '# Task 1', 'Tagged answer'),
        ]),
      ];
      const parser = buildSlidesParserHarness(vi, SlidesParser, {
        [refDocId]: [refSlide],
        [studentDocId]: studentSlides,
      });
      const defs = parser.extractTaskDefinitions(refDocId);
      const artifacts = parser.extractSubmissionArtifacts(studentDocId, defs);

      expect(artifacts).toEqual([
        {
          taskId: defs[0].getId(),
          pageId: 'student-page-tagged',
          content: 'Tagged answer',
          metadata: {},
          documentId: studentDocId,
          type: 'TEXT',
        },
      ]);
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('warns with candidate, page, and bucket size when a candidate bucket holds several entries', () => {
      const refSlide = createSlide(vi, 'ref-page-1', [
        createShapeElement(vi, '# Task 1', 'Ref text'),
      ]);
      const studentSlides = [
        createSlide(vi, 'student-page-draft', [createShapeElement(vi, '# Task 1', 'Draft answer')]),
        createSlide(vi, 'student-page-final', [createShapeElement(vi, '# Task 1', 'Final answer')]),
      ];
      const parser = buildSlidesParserHarness(vi, SlidesParser, {
        [refDocId]: [refSlide],
        [studentDocId]: studentSlides,
      });
      const defs = parser.extractTaskDefinitions(refDocId);
      const artifacts = parser.extractSubmissionArtifacts(studentDocId, defs);

      expect(artifacts[0]).toMatchObject({
        pageId: 'student-page-draft',
        content: 'Draft answer',
      });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Multiple submission candidates'),
        expect.objectContaining({
          candidate: 'Task 1',
          matchedPageId: 'student-page-draft',
          bucketSize: 2,
          taskId: defs[0].getId(),
        })
      );
    });

    it('probes element type before content extraction when scanning submission buckets', () => {
      const refSlide = createSlide(vi, 'ref-table-page', [
        createTableElement(vi, '# Task Table', [['Reference value']]),
      ]);
      const studentSlides = [
        createSlide(vi, 'student-page-wrong-type', [
          createShapeElement(vi, '# Task Table', 'Wrong-type decoy'),
        ]),
        createSlide(vi, 'student-page-table', [
          createTableElement(vi, '# Task Table', [['Student value']]),
        ]),
      ];
      const parser = buildSlidesParserHarness(vi, SlidesParser, {
        [refDocId]: [refSlide],
        [studentDocId]: studentSlides,
      });
      const defs = parser.extractTaskDefinitions(refDocId);
      const extractSpy = vi.spyOn(parser, 'extractDefinitionContent');
      const artifacts = parser.extractSubmissionArtifacts(studentDocId, defs);

      expect(artifacts).toEqual([
        {
          taskId: defs[0].getId(),
          pageId: 'student-page-table',
          content: [['Student value']],
          metadata: {},
          documentId: studentDocId,
          type: 'TABLE',
        },
      ]);
      expect(extractSpy).toHaveBeenCalledTimes(1);
      expect(extractSpy).toHaveBeenCalledWith(
        expect.objectContaining({ getPageElementType: expect.any(Function) }),
        expect.objectContaining({ elementType: 'TABLE' })
      );
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('resolves page ids lazily only for slides with matching entries', () => {
      const refSlide = createSlide(vi, 'ref-page-1', [
        createShapeElement(vi, '# Task 1', 'Ref text'),
      ]);
      const unmatchedSlide = createSlide(vi, 'student-page-unrelated', [
        createShapeElement(vi, 'Unrelated heading', 'Unrelated text'),
      ]);
      const matchedSlide = createSlide(vi, 'student-page-match', [
        createShapeElement(vi, '# Task 1', 'Student text'),
      ]);
      const parser = buildSlidesParserHarness(vi, SlidesParser, {
        [refDocId]: [refSlide],
        [studentDocId]: [unmatchedSlide, matchedSlide],
      });
      const defs = parser.extractTaskDefinitions(refDocId);
      const artifacts = parser.extractSubmissionArtifacts(studentDocId, defs);

      expect(artifacts[0].pageId).toBe('student-page-match');
      expect(unmatchedSlide.getObjectId).not.toHaveBeenCalled();
      expect(matchedSlide.getObjectId).toHaveBeenCalledTimes(1);
    });

    it('rejects submission extraction when document id or task definitions are missing', () => {
      const parser = buildSlidesParserHarness(vi, SlidesParser, {});

      expect(() => parser.extractSubmissionArtifacts(undefined, [])).toThrow(
        /documentId is required/
      );
      expect(() => parser.extractSubmissionArtifacts('doc-1', null)).toThrow(
        /taskDefs is required/
      );
      expect(() => parser.extractSubmissionArtifacts(null, undefined)).toThrow(/is required/);
      expect(globalThis.SlidesApp.openById).not.toHaveBeenCalled();
    });
  });
});
