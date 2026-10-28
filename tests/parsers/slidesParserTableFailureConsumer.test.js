/**
 * SlidesParser malformed-table consumer and missing-placeholder contract.
 *
 * Proves a malformed table read can never become a hashable submission
 * artefact, and that missing TEXT/TABLE placeholders emit one parser-boundary
 * diagnostic with no StudentSubmission or TableTaskArtifact duplicates.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import {
  registerSlidesParserSuiteLifecycle,
  createShapeElement,
  createTableElementFromMock,
  createSlide,
  buildNormalTableMock,
  buildSlidesParserHarness,
} from '../helpers/slidesParserTestHarness.js';

describe('SlidesParser malformed table consumer path', () => {
  const suite = registerSlidesParserSuiteLifecycle({
    beforeAll,
    afterAll,
    beforeEach,
    afterEach,
    vi,
    restoreMocks: true,
  });
  const refDocId = 'ref-doc-1';
  const studentDocId = 'student-doc-1';

  it('should preserve an unavailable TABLE artefact after an ordinary cell RPC failure', () => {
    const failure = new Error('Student cell RPC failed');
    const refTable = buildNormalTableMock(vi, [['Reference value']]);
    const failingStudentTable = {
      getNumRows: vi.fn().mockReturnValue(1),
      getNumColumns: vi.fn().mockReturnValue(1),
      getCell: vi.fn().mockImplementation(() => {
        throw failure;
      }),
    };
    const parser = buildSlidesParserHarness(vi, suite.SlidesParser, {
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
    const artifacts = parser.extractSubmissionArtifacts(studentDocId, defs);
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]).toMatchObject({
      taskId: defs[0].getId(),
      pageId: 'student-page',
      content: null,
      documentId: studentDocId,
      type: 'TABLE',
    });
    expect(suite.mockLogger.error).toHaveBeenCalledTimes(1);
    expect(suite.mockLogger.error).toHaveBeenCalledWith(
      'extractTableCells failed',
      expect.objectContaining({
        documentId: studentDocId,
        pageId: 'student-page',
        taskId: defs[0].getId(),
        taskTitle: 'Task Table',
        row: 0,
        column: 0,
        error: failure,
      })
    );
    expect(suite.mockLogger.error.mock.calls[0][1].error).toBe(failure);
    const submission = new globalThis.StudentSubmission(
      'student-1',
      'assignment-1',
      studentDocId,
      'Student One'
    );
    submission.upsertItemFromExtraction(defs[0], artifacts[0]);
    expect(submission.getItem(defs[0].getId()).artifact.content).toBeNull();
    expect(submission.getItem(defs[0].getId()).artifact.contentHash).toBeNull();
  });

  it('should retain a null cell as unavailable and unhashable submission content', () => {
    const refTable = buildNormalTableMock(vi, [['Reference value']]);
    const nullCellStudentTable = {
      getNumRows: vi.fn().mockReturnValue(1),
      getNumColumns: vi.fn().mockReturnValue(1),
      getCell: vi.fn().mockReturnValue(null),
    };
    const parser = buildSlidesParserHarness(vi, suite.SlidesParser, {
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
    const artifacts = parser.extractSubmissionArtifacts(studentDocId, defs);
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]).toMatchObject({
      taskId: defs[0].getId(),
      pageId: 'student-page',
      content: null,
      documentId: studentDocId,
      type: 'TABLE',
    });
    expect(suite.mockLogger.error).toHaveBeenCalledWith(
      'extractTableCells failed',
      expect.objectContaining({
        documentId: studentDocId,
        pageId: 'student-page',
        taskId: defs[0].getId(),
        taskTitle: 'Task Table',
        row: 0,
        column: 0,
      })
    );
    expect(suite.mockLogger.error).toHaveBeenCalledTimes(1);
    const submission = new globalThis.StudentSubmission(
      'student-1',
      'assignment-1',
      studentDocId,
      'Student One'
    );
    submission.upsertItemFromExtraction(defs[0], artifacts[0]);
    const item = submission.getItem(defs[0].getId());
    expect(item.artifact.content).toBeNull();
    expect(item.artifact.contentHash).toBeNull();
  });

  it.each([
    { row: 0, column: 1, label: 'next column', failureMode: 'throw' },
    { row: 1, column: 0, label: 'later row', failureMode: 'throw' },
    { row: 0, column: 1, label: 'next column', failureMode: 'null' },
    { row: 1, column: 0, label: 'later row', failureMode: 'null' },
  ])(
    'stops the whole student TABLE at its first $failureMode failure in the $label',
    ({ row, column, failureMode }) => {
      const visited = [];
      const failure = new Error('ordinary native read failure');
      const studentTable = {
        getNumRows: vi.fn().mockReturnValue(2),
        getNumColumns: vi.fn().mockReturnValue(3),
        getCell: vi.fn((readRow, readColumn) => {
          visited.push([readRow, readColumn]);
          if (readRow === row && readColumn === column) {
            if (failureMode === 'throw') throw failure;
            return null;
          }
          return {
            getMergeState: vi.fn().mockReturnValue('NOT_MERGED'),
            getText: vi.fn(() => ({ asString: () => `cell ${readRow},${readColumn}` })),
          };
        }),
      };
      const refTable = buildNormalTableMock(vi, [['Reference value']]);
      const parser = buildSlidesParserHarness(vi, suite.SlidesParser, {
        [refDocId]: [
          createSlide(vi, 'ref-page', [createTableElementFromMock(vi, '# Task Table', refTable)]),
        ],
        [studentDocId]: [
          createSlide(vi, 'student-page', [
            createTableElementFromMock(vi, '# Task Table', studentTable),
          ]),
        ],
      });
      const defs = parser.extractTaskDefinitions(refDocId);
      const result = parser.extractSubmissionArtifacts(studentDocId, defs);

      expect(result[0]).toMatchObject({ content: null, type: 'TABLE', taskId: defs[0].getId() });
      expect(visited).toEqual(
        Array.from({ length: row * 3 + column + 1 }, (_, index) => [
          Math.floor(index / 3),
          index % 3,
        ])
      );
      expect(suite.mockLogger.error).toHaveBeenCalledTimes(1);
      expect(suite.mockLogger.error).toHaveBeenCalledWith(
        'extractTableCells failed',
        expect.objectContaining({
          documentId: studentDocId,
          pageId: 'student-page',
          taskId: defs[0].getId(),
          row,
          column,
          ...(failureMode === 'throw' ? { error: failure } : { error: expect.any(TypeError) }),
        })
      );
      if (failureMode === 'throw') {
        expect(suite.mockLogger.error.mock.calls[0][1].error).toBe(failure);
      } else {
        expect(suite.mockLogger.error.mock.calls[0][1].error).toBeInstanceOf(TypeError);
        expect(suite.mockLogger.error.mock.calls[0][1].error).not.toBe(failure);
      }
      const submission = new globalThis.StudentSubmission(
        'student-1',
        'assignment-1',
        studentDocId,
        'Student One'
      );
      submission.upsertItemFromExtraction(defs[0], result[0]);
      expect(submission.getItem(defs[0].getId()).artifact.contentHash).toBeNull();
    }
  );

  it('converts an ordinary student cell-text failure and records its exact cell', () => {
    const failure = new Error('native cell text failed');
    const studentTable = {
      getNumRows: vi.fn().mockReturnValue(2),
      getNumColumns: vi.fn().mockReturnValue(2),
      getCell: vi.fn((row, column) => ({
        getMergeState: vi.fn().mockReturnValue('NOT_MERGED'),
        getText: vi.fn(() => {
          if (row === 1 && column === 0) throw failure;
          return { asString: () => 'student text' };
        }),
      })),
    };
    const refTable = buildNormalTableMock(vi, [['Reference value']]);
    const parser = buildSlidesParserHarness(vi, suite.SlidesParser, {
      [refDocId]: [
        createSlide(vi, 'ref-page', [createTableElementFromMock(vi, '# Task Table', refTable)]),
      ],
      [studentDocId]: [
        createSlide(vi, 'student-page', [
          createTableElementFromMock(vi, '# Task Table', studentTable),
        ]),
      ],
    });
    const defs = parser.extractTaskDefinitions(refDocId);
    const result = parser.extractSubmissionArtifacts(studentDocId, defs);
    expect(result[0].content).toBeNull();
    expect(studentTable.getCell.mock.calls).toEqual([
      [0, 0],
      [0, 1],
      [1, 0],
    ]);
    expect(suite.mockLogger.error).toHaveBeenCalledTimes(1);
    expect(suite.mockLogger.error).toHaveBeenCalledWith(
      'extractTableCells failed',
      expect.objectContaining({
        documentId: studentDocId,
        pageId: 'student-page',
        taskId: defs[0].getId(),
        row: 1,
        column: 0,
        error: failure,
      })
    );
    expect(suite.mockLogger.error.mock.calls[0][1].error).toBe(failure);
  });

  it('converts an ordinary merge-state read failure without reading the cell text', () => {
    const failure = new Error('native merge-state read failed');
    const cell = {
      getMergeState: vi.fn(() => {
        throw failure;
      }),
      getText: vi.fn(),
    };
    const table = {
      getNumRows: vi.fn().mockReturnValue(1),
      getNumColumns: vi.fn().mockReturnValue(1),
      getCell: vi.fn().mockReturnValue(cell),
    };
    const refTable = buildNormalTableMock(vi, [['Reference value']]);
    const parser = buildSlidesParserHarness(vi, suite.SlidesParser, {
      [refDocId]: [
        createSlide(vi, 'ref-page', [createTableElementFromMock(vi, '# Task Table', refTable)]),
      ],
      [studentDocId]: [
        createSlide(vi, 'student-page', [createTableElementFromMock(vi, '# Task Table', table)]),
      ],
    });
    const defs = parser.extractTaskDefinitions(refDocId);

    const [artifact] = parser.extractSubmissionArtifacts(studentDocId, defs);

    expect(artifact).toMatchObject({ content: null, type: 'TABLE', taskId: defs[0].getId() });
    expect(cell.getText).not.toHaveBeenCalled();
    expect(suite.mockLogger.error).toHaveBeenCalledTimes(1);
    expect(suite.mockLogger.error.mock.calls[0][1]).toMatchObject({
      documentId: studentDocId,
      pageId: 'student-page',
      taskId: defs[0].getId(),
      row: 0,
      column: 0,
      error: failure,
    });
    expect(suite.mockLogger.error.mock.calls[0][1].error).toBe(failure);
  });

  it('aborts student table extraction when the facade classifies cell text as unavailable', () => {
    const table = {
      getNumRows: vi.fn().mockReturnValue(1),
      getNumColumns: vi.fn().mockReturnValue(2),
      getCell: vi.fn((row, column) => ({
        getMergeState: vi.fn().mockReturnValue('NOT_MERGED'),
        getText: vi.fn(() => ({ asString: () => `cell ${row},${column}` })),
      })),
    };
    const parser = buildSlidesParserHarness(vi, suite.SlidesParser, {
      [refDocId]: [
        createSlide(vi, 'ref-page', [
          createTableElementFromMock(vi, '# Task Table', buildNormalTableMock(vi, [['Ref']])),
        ]),
      ],
      [studentDocId]: [
        createSlide(vi, 'student-page', [createTableElementFromMock(vi, '# Task Table', table)]),
      ],
    });
    const defs = parser.extractTaskDefinitions(refDocId);
    const extractCellText = vi.spyOn(parser, 'extractCellText').mockReturnValue(null);

    const [artifact] = parser.extractSubmissionArtifacts(studentDocId, defs);

    expect(artifact).toMatchObject({ content: null, type: 'TABLE' });
    expect(extractCellText).toHaveBeenCalledTimes(1);
    expect(table.getCell).toHaveBeenCalledTimes(1);
    expect(suite.mockLogger.error).not.toHaveBeenCalled();
  });

  it.each([
    [
      'row count',
      (failure) => ({
        getNumRows: vi.fn(() => {
          throw failure;
        }),
        getNumColumns: vi.fn(() => 2),
        getCell: vi.fn(),
      }),
    ],
    [
      'column count',
      (failure) => ({
        getNumRows: vi.fn(() => 2),
        getNumColumns: vi.fn(() => {
          throw failure;
        }),
        getCell: vi.fn(),
      }),
    ],
  ])('converts an ordinary student %s failure without attempting cells', (_label, makeTable) => {
    const failure = new Error('native dimension failed');
    const table = makeTable(failure);
    const refTable = buildNormalTableMock(vi, [['Reference value']]);
    const parser = buildSlidesParserHarness(vi, suite.SlidesParser, {
      [refDocId]: [
        createSlide(vi, 'ref-page', [createTableElementFromMock(vi, '# Task Table', refTable)]),
      ],
      [studentDocId]: [
        createSlide(vi, 'student-page', [createTableElementFromMock(vi, '# Task Table', table)]),
      ],
    });
    const defs = parser.extractTaskDefinitions(refDocId);
    const result = parser.extractSubmissionArtifacts(studentDocId, defs);
    expect(result[0].content).toBeNull();
    expect(table.getCell).not.toHaveBeenCalled();
    expect(suite.mockLogger.error).toHaveBeenCalledTimes(1);
    expect(suite.mockLogger.error.mock.calls[0][1]).toMatchObject({
      row: null,
      column: null,
      error: failure,
    });
    expect(suite.mockLogger.error.mock.calls[0][1].error).toBe(failure);
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
      const parser = buildSlidesParserHarness(vi, suite.SlidesParser, {
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
      expect(suite.mockLogger.error).toHaveBeenCalledTimes(2);
      expect(suite.mockLogger.error).toHaveBeenCalledWith(
        `No submission content for task "Task Text" in document ${missingStudentDocId}.`,
        expect.objectContaining({
          taskTitle: 'Task Text',
          taskId: textDef.getId(),
          documentId: missingStudentDocId,
          type: 'TEXT',
        })
      );
      expect(suite.mockLogger.error).toHaveBeenCalledWith(
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
      const errorCallsBeforeUpsert = suite.mockLogger.error.mock.calls.length;
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
      expect(suite.mockLogger.warn).not.toHaveBeenCalled();
      expect(suite.mockLogger.error.mock.calls.length).toBe(errorCallsBeforeUpsert);
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
      expect(suite.mockLogger.warn).toHaveBeenCalledTimes(2);
      expect(suite.mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("No content found for Student Two for task 'Task Text'.")
      );
      expect(suite.mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("No content found for Student Three for task 'Task Table'.")
      );
    });
  });
});
