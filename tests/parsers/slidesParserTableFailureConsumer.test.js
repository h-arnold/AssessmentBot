/**
 * SlidesParser malformed-table consumer and missing-placeholder contract.
 *
 * Proves a malformed table read can never become a hashable submission
 * artefact, and that missing TEXT/TABLE placeholders emit one parser-boundary
 * diagnostic with no StudentSubmission or TableTaskArtifact duplicates.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import {
  saveSlidesParserModuleGlobals,
  restoreSlidesParserModuleGlobals,
  createSlidesParserMockLogger,
  installSlidesParserGlobals,
  loadSlidesParserModules,
  createShapeElement,
  createTableElementFromMock,
  createSlide,
  buildNormalTableMock,
  buildSlidesParserHarness,
} from '../helpers/slidesParserTestHarness.js';

describe('SlidesParser malformed table consumer path', () => {
  let SlidesParser;
  let mockLogger;
  let restoreGlobals;
  const savedModuleGlobals = saveSlidesParserModuleGlobals();
  const refDocId = 'ref-doc-1';
  const studentDocId = 'student-doc-1';

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
    vi.restoreAllMocks();
  });

  it('should throw rather than store a throwing table as a submission artefact', () => {
    const failure = new Error('Student cell RPC failed');
    const refTable = buildNormalTableMock(vi, [['Reference value']]);
    const failingStudentTable = {
      getNumRows: vi.fn().mockReturnValue(1),
      getNumColumns: vi.fn().mockReturnValue(1),
      getCell: vi.fn().mockImplementation(() => {
        throw failure;
      }),
    };
    const parser = buildSlidesParserHarness(vi, SlidesParser, {
      [refDocId]: [
        createSlide(vi, 'ref-page', [createTableElementFromMock(vi, '# Task Table', refTable)]),
      ],
      [studentDocId]: [
        createSlide(vi, 'student-page', [
          createTableElementFromMock(vi, '# Task Table', failingStudentTable),
        ]),
      ],
    });
    const defs = parser.extractTaskDefinitions(refDocId);
    expect(defs).toHaveLength(1);
    let thrown = null;
    try {
      parser.extractSubmissionArtifacts(studentDocId, defs);
    } catch (error) {
      thrown = error;
    }
    // The malformed read must surface, never collapse into a hashable blank table.
    expect(thrown).toBe(failure);
    expect(mockLogger.error).toHaveBeenCalledWith(
      'extractTableCells failed',
      expect.objectContaining({ documentId: studentDocId, taskTitle: 'Task Table', error: failure })
    );
    // No artefact payload exists to hand to the model layer, so no item or hash follows.
    const submission = new globalThis.StudentSubmission(
      'student-1',
      'assignment-1',
      studentDocId,
      'Student One'
    );
    expect(Object.keys(submission.items)).toHaveLength(0);
  });

  it('should throw rather than store a null cell as legitimate blank content', () => {
    const refTable = buildNormalTableMock(vi, [['Reference value']]);
    const nullCellStudentTable = {
      getNumRows: vi.fn().mockReturnValue(1),
      getNumColumns: vi.fn().mockReturnValue(1),
      getCell: vi.fn().mockReturnValue(null),
    };
    const parser = buildSlidesParserHarness(vi, SlidesParser, {
      [refDocId]: [
        createSlide(vi, 'ref-page', [createTableElementFromMock(vi, '# Task Table', refTable)]),
      ],
      [studentDocId]: [
        createSlide(vi, 'student-page', [
          createTableElementFromMock(vi, '# Task Table', nullCellStudentTable),
        ]),
      ],
    });
    const defs = parser.extractTaskDefinitions(refDocId);
    expect(defs).toHaveLength(1);
    let thrown = null;
    try {
      parser.extractSubmissionArtifacts(studentDocId, defs);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(TypeError);
    expect(mockLogger.error).toHaveBeenCalledWith(
      'extractTableCells failed',
      expect.objectContaining({
        documentId: studentDocId,
        taskTitle: 'Task Table',
        row: 0,
        column: 0,
      })
    );
    expect(mockLogger.error.mock.calls[0][1].error).toBe(thrown);
    const submission = new globalThis.StudentSubmission(
      'student-1',
      'assignment-1',
      studentDocId,
      'Student One'
    );
    expect(Object.keys(submission.items)).toHaveLength(0);
  });

  describe('missing TEXT and TABLE placeholder single-diagnostic contract', () => {
    const missingRefDocId = 'ref-doc-missing';
    const missingStudentDocId = 'student-doc-missing';

    function buildMissingHarness() {
      const refSlides = [
        createSlide(vi, 'ref-text-page', [createShapeElement(vi, '# Task Text', 'Reference text')]),
        createSlide(vi, 'ref-table-page', [
          createTableElementFromMock(vi, '# Task Table', buildNormalTableMock(vi, [['Reference']])),
        ]),
      ];
      const studentSlides = [
        createSlide(vi, 'student-unrelated-page', [
          createShapeElement(vi, 'Unrelated heading', 'Unrelated text'),
        ]),
      ];
      const parser = buildSlidesParserHarness(vi, SlidesParser, {
        [missingRefDocId]: refSlides,
        [missingStudentDocId]: studentSlides,
      });
      const defs = parser.extractTaskDefinitions(missingRefDocId);
      expect(defs).toHaveLength(2);
      return { parser, defs };
    }

    it('should emit one parser-boundary diagnostic per missing task and keep the model silent', () => {
      const { parser, defs } = buildMissingHarness();
      const textDef = defs.find((def) => def.taskTitle === 'Task Text');
      const tableDef = defs.find((def) => def.taskTitle === 'Task Table');
      const artifacts = parser.extractSubmissionArtifacts(missingStudentDocId, defs);
      expect(artifacts).toHaveLength(2);
      for (const artefact of artifacts) {
        expect(artefact.content).toBeNull();
        expect(artefact.pageId).toBeNull();
        expect(artefact.documentId).toBe(missingStudentDocId);
        // Assignment wiring treats null content plus null page as the parser-owned path.
        expect(artefact.content == null && artefact.pageId == null).toBe(true);
      }
      expect(artifacts.map((artefact) => artefact.type).sort()).toEqual(['TABLE', 'TEXT']);
      expect(mockLogger.error).toHaveBeenCalledTimes(2);
      expect(mockLogger.error).toHaveBeenCalledWith(
        `No submission content for task "Task Text" in document ${missingStudentDocId}.`,
        expect.objectContaining({
          taskTitle: 'Task Text',
          taskId: textDef.getId(),
          documentId: missingStudentDocId,
          type: 'TEXT',
        })
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        `No submission content for task "Task Table" in document ${missingStudentDocId}.`,
        expect.objectContaining({
          taskTitle: 'Task Table',
          taskId: tableDef.getId(),
          documentId: missingStudentDocId,
          type: 'TABLE',
        })
      );
      const submission = new globalThis.StudentSubmission(
        'student-1',
        'assignment-1',
        missingStudentDocId,
        'Student One'
      );
      const errorCallsBeforeUpsert = mockLogger.error.mock.calls.length;
      artifacts.forEach((artefact) => {
        const definition = defs.find((def) => def.getId() === artefact.taskId);
        submission.upsertItemFromExtraction(definition, {
          pageId: artefact.pageId,
          content: artefact.content,
          metadata: artefact.metadata,
          documentId: artefact.documentId,
          // Same flag SlidesAssignment.processAllSubmissions supplies for placeholders.
          missingContentLogged: artefact.content == null && artefact.pageId == null,
        });
      });
      // Parser-owned placeholders stay silent downstream: no StudentSubmission warn
      // and no TableTaskArtifact warn.
      expect(mockLogger.warn).not.toHaveBeenCalled();
      expect(mockLogger.error.mock.calls.length).toBe(errorCallsBeforeUpsert);
      expect(submission.getItem(textDef.getId()).artifact.content).toBeNull();
      expect(submission.getItem(textDef.getId()).artifact.contentHash).toBeNull();
      expect(submission.getItem(tableDef.getId()).artifact.content).toBeNull();
      expect(submission.getItem(tableDef.getId()).artifact.contentHash).toBeNull();
    });

    it('should preserve direct non-parser warnings for TEXT and TABLE null content', () => {
      const { defs } = buildMissingHarness();
      const textDef = defs.find((def) => def.taskTitle === 'Task Text');
      const tableDef = defs.find((def) => def.taskTitle === 'Task Table');
      const textSubmission = new globalThis.StudentSubmission(
        'student-2',
        'assignment-1',
        missingStudentDocId,
        'Student Two'
      );
      textSubmission.upsertItemFromExtraction(textDef, { content: null });
      const tableSubmission = new globalThis.StudentSubmission(
        'student-3',
        'assignment-1',
        missingStudentDocId,
        'Student Three'
      );
      tableSubmission.upsertItemFromExtraction(tableDef, { content: null });
      expect(mockLogger.warn).toHaveBeenCalledTimes(2);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("No content found for Student Two for task 'Task Text'.")
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("No content found for Student Three for task 'Task Table'.")
      );
    });
  });
});
