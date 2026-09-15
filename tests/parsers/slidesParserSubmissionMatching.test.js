import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import {
  withGlobalMocks,
  saveGlobals,
  restoreGlobals as restoreSavedGlobals,
} from '../helpers/globalMockManager.js';

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
    const savedModuleGlobals = saveGlobals(['DocumentParser', 'TaskDefinition']);

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

      const slidesParserModule =
        await import('../../src/backend/DocumentParsers/SlidesParser/index.js');
      SlidesParser = slidesParserModule.SlidesParser;
    });

    afterAll(() => {
      restoreSavedGlobals(savedModuleGlobals);
    });

    beforeEach(() => {
      mockLogger = {
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      };

      const mockContext = withGlobalMocks({
        ABLogger: () => ({
          getInstance: vi.fn().mockReturnValue(mockLogger),
        }),
        SlidesApp: () => ({
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
        }),
      });
      restoreGlobals = mockContext.restore;
    });

    afterEach(() => {
      restoreGlobals();
    });

    it('prefers a tag-qualified match over an earlier bare-title element', () => {
      const refSlide = createSlide('ref-page-1', [createShapeElement('# Task 1', 'Ref text')]);
      const studentSlides = [
        createSlide('student-page-decoy', [createShapeElement('Task 1', 'Decoy text')]),
        createSlide('student-page-tagged', [createShapeElement('# Task 1', 'Tagged answer')]),
      ];
      const parser = buildSlidesParserHarness({
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
      const refSlide = createSlide('ref-page-1', [createShapeElement('# Task 1', 'Ref text')]);
      const studentSlides = [
        createSlide('student-page-draft', [createShapeElement('# Task 1', 'Draft answer')]),
        createSlide('student-page-final', [createShapeElement('# Task 1', 'Final answer')]),
      ];
      const parser = buildSlidesParserHarness({
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
      const refSlide = createSlide('ref-table-page', [
        createTableElement('# Task Table', [['Reference value']]),
      ]);
      const studentSlides = [
        createSlide('student-page-wrong-type', [
          createShapeElement('# Task Table', 'Wrong-type decoy'),
        ]),
        createSlide('student-page-table', [
          createTableElement('# Task Table', [['Student value']]),
        ]),
      ];
      const parser = buildSlidesParserHarness({
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
      const refSlide = createSlide('ref-page-1', [createShapeElement('# Task 1', 'Ref text')]);
      const unmatchedSlide = createSlide('student-page-unrelated', [
        createShapeElement('Unrelated heading', 'Unrelated text'),
      ]);
      const matchedSlide = createSlide('student-page-match', [
        createShapeElement('# Task 1', 'Student text'),
      ]);
      const parser = buildSlidesParserHarness({
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
      const parser = buildSlidesParserHarness({});

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
