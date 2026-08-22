/**
 * Red-phase tests for `buildCellPreviewLookup` — a pure transformation
 * function that converts `AssignmentFull` into a
 * `Map<studentId, Map<taskId, CellPreviewData>>` keyed lookup.
 *
 * These tests WILL fail at import time because the implementation module
 * does not yet exist (TDD red phase).
 */

import { describe, it, expect } from 'vitest';
import type { AssignmentFull } from '../../services/assignmentAssessment/assignmentAssessment.zod';
import { buildCellPreviewLookup } from './buildCellPreviewLookup';
import type { CellPreviewLookup, CellPreviewData } from './buildCellPreviewLookup';

// ---------------------------------------------------------------------------
// Shared fixture primitives
// ---------------------------------------------------------------------------

const DEFAULT_DATE = '2024-01-01T00:00:00.000Z';

/**
 * Base artifact fields shared by all artifact types (BaseTaskArtifactFields).
 * `taskId` is intentionally excluded here because it varies per item and is
 * always supplied inline.
 */
const BASE_ARTIFACT_FIELDS = {
  role: 'student',
  pageId: 'pg-1',
  documentId: 'doc-1',
  uid: 'uid-1',
  contentHash: null as string | null,
  metadata: {},
};

/**
 * Minimal AssignmentDefinition that satisfies the Zod-mandated required
 * fields.  Most optional / nullable fields are set to `null` or default
 * values.
 */
const MINIMAL_ASSIGNMENT_DEFINITION = {
  primaryTitle: 'Test Assignment',
  primaryTopic: null,
  primaryTopicKey: null,
  yearGroupKey: 'yg-10',
  yearGroupLabel: null,
  alternateTitles: [],
  alternateTopics: [],
  documentType: null,
  referenceDocumentId: null,
  templateDocumentId: null,
  referenceLastModified: null,
  templateLastModified: null,
  assignmentWeighting: 1,
  definitionKey: 'test-def',
  tasks: {},
  createdAt: DEFAULT_DATE,
  updatedAt: DEFAULT_DATE,
};

/**
 * Build a minimal `AssignmentFull` with the given submissions.
 * All other fields get sensible defaults so each test only
 * specifies the data it cares about.
 *
 * @param {AssignmentFull['submissions']} submissions - The submissions to include in the assignment.
 * @returns {AssignmentFull} A minimal AssignmentFull object.
 */
function createAssignment(submissions: AssignmentFull['submissions']): AssignmentFull {
  return {
    courseId: 'course-1',
    assignmentId: 'assignment-1',
    assignmentName: 'Test Assignment',
    dueDate: null,
    updatedAt: null,
    createdAt: DEFAULT_DATE,
    documentType: null,
    referenceDocumentId: null,
    templateDocumentId: null,
    tasks: null,
    submissions,
    assignmentDefinition: MINIMAL_ASSIGNMENT_DEFINITION,
  } as AssignmentFull;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildCellPreviewLookup', () => {
  // -----------------------------------------------------------------------
  // Test 1 — TEXT artifact with all three assessments
  // -----------------------------------------------------------------------

  it('builds CellPreviewData for a TEXT artifact with all three assessments', () => {
    const assignment = createAssignment([
      {
        studentId: 'student-1',
        studentName: 'Alice',
        assignmentId: 'assignment-1',
        documentId: null,
        items: {
          'item-1': {
            id: 'item-1',
            taskId: 'task-1',
            artifact: {
              ...BASE_ARTIFACT_FIELDS,
              type: 'TEXT' as const,
              content: 'Alice wrote this response.',
              taskId: 'task-1',
            },
            assessments: {
              completeness: { score: 5, reasoning: 'Full coverage of all points' },
              accuracy: { score: 4, reasoning: 'Minor factual errors' },
              spag: { score: 3, reasoning: 'Several spelling mistakes' },
            },
            feedback: {},
          },
        },
        createdAt: DEFAULT_DATE,
        updatedAt: DEFAULT_DATE,
      },
    ]);

    const lookup: CellPreviewLookup = buildCellPreviewLookup(assignment);
    const cellData: CellPreviewData | undefined = lookup.get('student-1')?.get('task-1');

    expect(cellData).toBeDefined();
    expect(cellData!.artifactType).toBe('TEXT');
    expect(cellData!.artifactContent).toBe('Alice wrote this response.');
  });

  // -----------------------------------------------------------------------
  // Test 1a — TABLE artifact
  // -----------------------------------------------------------------------

  it('builds CellPreviewData for a TABLE artifact with all three assessments', () => {
    const assignment = createAssignment([
      {
        studentId: 'student-1',
        studentName: 'Alice',
        assignmentId: 'assignment-1',
        documentId: null,
        items: {
          'item-1': {
            id: 'item-1',
            taskId: 'task-1',
            artifact: {
              ...BASE_ARTIFACT_FIELDS,
              type: 'TABLE' as const,
              content: '| Header | Value |\n|--------|-------|\n| A      | 1     |',
              taskId: 'task-1',
            },
            assessments: {
              completeness: { score: 5, reasoning: 'Full table' },
              accuracy: { score: 5, reasoning: 'All correct' },
              spag: { score: 4, reasoning: 'Minor formatting' },
            },
            feedback: {},
          },
        },
        createdAt: DEFAULT_DATE,
        updatedAt: DEFAULT_DATE,
      },
    ]);

    const lookup: CellPreviewLookup = buildCellPreviewLookup(assignment);
    const cellData = lookup.get('student-1')?.get('task-1');

    expect(cellData).toBeDefined();
    expect(cellData!.artifactType).toBe('TABLE');
    expect(cellData!.artifactContent).toBe(
      '| Header | Value |\n|--------|-------|\n| A      | 1     |'
    );
  });

  // -----------------------------------------------------------------------
  // Test 1b — IMAGE artifact
  // -----------------------------------------------------------------------

  it('builds CellPreviewData for an IMAGE artifact with all three assessments', () => {
    const assignment = createAssignment([
      {
        studentId: 'student-1',
        studentName: 'Alice',
        assignmentId: 'assignment-1',
        documentId: null,
        items: {
          'item-1': {
            id: 'item-1',
            taskId: 'task-1',
            artifact: {
              ...BASE_ARTIFACT_FIELDS,
              type: 'IMAGE' as const,
              content: 'data:image/png;base64,iVBORw0KGgo=', // non-empty renderable source
              taskId: 'task-1',
            },
            assessments: {
              completeness: { score: 4, reasoning: 'Mostly complete' },
              accuracy: { score: 5, reasoning: 'Accurate diagram' },
              spag: { score: 3, reasoning: 'Labels messy' },
            },
            feedback: {},
          },
        },
        createdAt: DEFAULT_DATE,
        updatedAt: DEFAULT_DATE,
      },
    ]);

    const lookup: CellPreviewLookup = buildCellPreviewLookup(assignment);
    const cellData = lookup.get('student-1')?.get('task-1');

    expect(cellData).toBeDefined();
    expect(cellData!.artifactType).toBe('IMAGE');
    expect(cellData!.artifactContent).toBe('data:image/png;base64,iVBORw0KGgo=');
  });

  // -----------------------------------------------------------------------
  // Test 1c — all three reasoning fields populated (locks accuracy/spag pattern)
  // -----------------------------------------------------------------------

  it('extracts reasoning text for completeness, accuracy, and spag from assessments', () => {
    const assignment = createAssignment([
      {
        studentId: 'student-1',
        studentName: 'Alice',
        assignmentId: 'assignment-1',
        documentId: null,
        items: {
          'item-1': {
            id: 'item-1',
            taskId: 'task-1',
            artifact: {
              ...BASE_ARTIFACT_FIELDS,
              type: 'TEXT' as const,
              content: 'Full response',
              taskId: 'task-1',
            },
            assessments: {
              completeness: { score: 5, reasoning: 'Everything present' },
              accuracy: { score: 4, reasoning: 'Mostly correct work' },
              spag: { score: 3, reasoning: 'Needs proofreading' },
            },
            feedback: {},
          },
        },
        createdAt: DEFAULT_DATE,
        updatedAt: DEFAULT_DATE,
      },
    ]);

    const lookup: CellPreviewLookup = buildCellPreviewLookup(assignment);
    const cellData = lookup.get('student-1')?.get('task-1');

    expect(cellData).toBeDefined();
    expect(cellData!.reasoning.completeness).toBe('Everything present');
    expect(cellData!.reasoning.accuracy).toBe('Mostly correct work');
    expect(cellData!.reasoning.spag).toBe('Needs proofreading');
  });

  // -----------------------------------------------------------------------
  // Test 2 — only completeness assessed, accuracy / spag are null
  // -----------------------------------------------------------------------

  it('sets accuracy and spag reasoning to null when only completeness is assessed', () => {
    const assignment = createAssignment([
      {
        studentId: 'student-1',
        studentName: 'Alice',
        assignmentId: 'assignment-1',
        documentId: null,
        items: {
          'item-1': {
            id: 'item-1',
            taskId: 'task-1',
            artifact: {
              ...BASE_ARTIFACT_FIELDS,
              type: 'TEXT' as const,
              content: 'Partial answer',
              taskId: 'task-1',
            },
            assessments: {
              completeness: { score: 3, reasoning: 'Some points covered' },
            },
            feedback: {},
          },
        },
        createdAt: DEFAULT_DATE,
        updatedAt: DEFAULT_DATE,
      },
    ]);

    const lookup: CellPreviewLookup = buildCellPreviewLookup(assignment);
    const cellData = lookup.get('student-1')?.get('task-1');

    expect(cellData).toBeDefined();
    expect(cellData!.reasoning.completeness).toBe('Some points covered');
    expect(cellData!.reasoning.accuracy).toBeNull();
    expect(cellData!.reasoning.spag).toBeNull();
  });

  // -----------------------------------------------------------------------
  // Test 3 — multiple submissions for different students
  // -----------------------------------------------------------------------

  it('indexes multiple student submissions by studentId', () => {
    const assignment = createAssignment([
      {
        studentId: 'student-1',
        studentName: 'Alice',
        assignmentId: 'assignment-1',
        documentId: null,
        items: {
          'item-1': {
            id: 'item-1',
            taskId: 'task-1',
            artifact: {
              ...BASE_ARTIFACT_FIELDS,
              type: 'TEXT' as const,
              content: 'Alice answer',
              taskId: 'task-1',
            },
            assessments: {
              completeness: { score: 5, reasoning: 'Good' },
            },
            feedback: {},
          },
        },
        createdAt: DEFAULT_DATE,
        updatedAt: DEFAULT_DATE,
      },
      {
        studentId: 'student-2',
        studentName: 'Bob',
        assignmentId: 'assignment-1',
        documentId: null,
        items: {
          'item-2': {
            id: 'item-2',
            taskId: 'task-2',
            artifact: {
              ...BASE_ARTIFACT_FIELDS,
              type: 'TEXT' as const,
              content: 'Bob answer',
              taskId: 'task-2',
            },
            assessments: {
              completeness: { score: 4, reasoning: 'Decent' },
            },
            feedback: {},
          },
        },
        createdAt: DEFAULT_DATE,
        updatedAt: DEFAULT_DATE,
      },
    ]);

    const lookup: CellPreviewLookup = buildCellPreviewLookup(assignment);

    expect(lookup.get('student-1')).toBeDefined();
    expect(lookup.get('student-2')).toBeDefined();
    expect(lookup.get('student-1')!.get('task-1')!.artifactContent).toBe('Alice answer');
    expect(lookup.get('student-2')!.get('task-2')!.artifactContent).toBe('Bob answer');
  });

  // -----------------------------------------------------------------------
  // Test 4 — multiple items with different taskIds in one submission
  // -----------------------------------------------------------------------

  it('maps multiple items with different taskIds from a single submission', () => {
    const assignment = createAssignment([
      {
        studentId: 'student-1',
        studentName: 'Alice',
        assignmentId: 'assignment-1',
        documentId: null,
        items: {
          'item-1': {
            id: 'item-1',
            taskId: 'task-a',
            artifact: {
              ...BASE_ARTIFACT_FIELDS,
              type: 'TEXT' as const,
              content: 'Task A response',
              taskId: 'task-a',
            },
            assessments: {
              completeness: { score: 5, reasoning: 'Task A complete' },
            },
            feedback: {},
          },
          'item-2': {
            id: 'item-2',
            taskId: 'task-b',
            artifact: {
              ...BASE_ARTIFACT_FIELDS,
              type: 'TEXT' as const,
              content: 'Task B response',
              taskId: 'task-b',
            },
            assessments: {
              completeness: { score: 4, reasoning: 'Task B partial' },
            },
            feedback: {},
          },
        },
        createdAt: DEFAULT_DATE,
        updatedAt: DEFAULT_DATE,
      },
    ]);

    const lookup: CellPreviewLookup = buildCellPreviewLookup(assignment);
    const inner = lookup.get('student-1');

    expect(inner).toBeDefined();
    expect(inner!.get('task-a')!.artifactContent).toBe('Task A response');
    expect(inner!.get('task-b')!.artifactContent).toBe('Task B response');
  });

  // -----------------------------------------------------------------------
  // Test 5 — duplicate taskId items: first encountered wins
  // -----------------------------------------------------------------------

  it('applies first-wins semantics when multiple items share the same taskId', () => {
    const assignment = createAssignment([
      {
        studentId: 'student-1',
        studentName: 'Alice',
        assignmentId: 'assignment-1',
        documentId: null,
        items: {
          // First item in iteration order (item-1)
          'item-1': {
            id: 'item-1',
            taskId: 'task-dup',
            artifact: {
              ...BASE_ARTIFACT_FIELDS,
              type: 'TEXT' as const,
              content: 'First encounter',
              taskId: 'task-dup',
            },
            assessments: {
              completeness: { score: 5, reasoning: 'First version' },
            },
            feedback: {},
          },
          // Second item with the same taskId (item-2) — should be ignored
          'item-2': {
            id: 'item-2',
            taskId: 'task-dup',
            artifact: {
              ...BASE_ARTIFACT_FIELDS,
              type: 'TEXT' as const,
              content: 'Should NOT win',
              taskId: 'task-dup',
            },
            assessments: {
              completeness: { score: 2, reasoning: 'Dupe version' },
            },
            feedback: {},
          },
        },
        createdAt: DEFAULT_DATE,
        updatedAt: DEFAULT_DATE,
      },
    ]);

    const lookup: CellPreviewLookup = buildCellPreviewLookup(assignment);
    const cellData = lookup.get('student-1')?.get('task-dup');

    expect(cellData).toBeDefined();
    expect(cellData!.artifactContent).toBe('First encounter');
    expect(cellData!.reasoning.completeness).toBe('First version');
  });

  // -----------------------------------------------------------------------
  // Test 6 — joined-fixture test: identifiers align with ClassFull-derived heatmap
  // -----------------------------------------------------------------------

  it('resolves CellPreviewData for identifiers matching a ClassFull-derived heatmap', () => {
    // Construct an AssignmentFull whose submission.studentId and item.taskId
    // match the identifiers that would appear in a realistic ClassFull
    // (students[].id = 'student-100000000005') and heatmap
    // (HeatmapTaskColumn.taskId = 'task_001').
    const assignment = createAssignment([
      {
        studentId: '100000000005', // Matches ClassFull.students[].id
        studentName: 'Student Two',
        assignmentId: 'assignment-1',
        documentId: null,
        items: {
          'item-1': {
            id: 'item-1',
            taskId: 'task_001', // Matches HeatmapTaskColumn.taskId
            artifact: {
              ...BASE_ARTIFACT_FIELDS,
              type: 'IMAGE' as const,
              content: 'data:image/png;base64,realisticImageData',
              taskId: 'task_001',
            },
            assessments: {
              completeness: { score: 5, reasoning: 'Complete work' },
              accuracy: { score: 4, reasoning: 'Good accuracy' },
              spag: { score: 3, reasoning: 'Needs revision' },
            },
            feedback: {},
          },
        },
        createdAt: DEFAULT_DATE,
        updatedAt: DEFAULT_DATE,
      },
    ]);

    const lookup: CellPreviewLookup = buildCellPreviewLookup(assignment);

    // Assert the studentId resolves
    const inner = lookup.get('100000000005');
    expect(inner).toBeDefined();

    // Assert the taskId resolves with the expected data
    const cellData = inner!.get('task_001');
    expect(cellData).toBeDefined();
    expect(cellData!.artifactType).toBe('IMAGE');
    expect(cellData!.artifactContent).toBe('data:image/png;base64,realisticImageData');
    expect(cellData!.reasoning.completeness).toBe('Complete work');
  });

  // -----------------------------------------------------------------------
  // Test 7 — empty submissions array
  // -----------------------------------------------------------------------

  it('returns an empty Map when submissions array is empty', () => {
    const assignment = createAssignment([]);

    const lookup: CellPreviewLookup = buildCellPreviewLookup(assignment);

    expect(lookup.size).toBe(0);
  });

  // -----------------------------------------------------------------------
  // Test 8 — SPREADSHEET artifact
  // -----------------------------------------------------------------------

  // Score‑range constants for SPREADSHEET fixture data
  const ALICE_SCORE = 95;
  const BOB_SCORE = 78;

  it('exposes artifactType SPREADSHEET and artifactContent as a 2D array', () => {
    const spreadsheetContent: Array<Array<string | number | null>> = [
      ['Name', 'Score', 'Grade'],
      ['Alice', ALICE_SCORE, 'A'],
      ['Bob', BOB_SCORE, 'B'],
      [null, null, null],
    ];

    const assignment = createAssignment([
      {
        studentId: 'student-1',
        studentName: 'Alice',
        assignmentId: 'assignment-1',
        documentId: null,
        items: {
          'item-1': {
            id: 'item-1',
            taskId: 'task-sheet',
            artifact: {
              ...BASE_ARTIFACT_FIELDS,
              type: 'SPREADSHEET' as const,
              content: spreadsheetContent,
              taskId: 'task-sheet',
            },
            assessments: {
              completeness: { score: 5, reasoning: 'All rows present' },
            },
            feedback: {},
          },
        },
        createdAt: DEFAULT_DATE,
        updatedAt: DEFAULT_DATE,
      },
    ]);

    const lookup: CellPreviewLookup = buildCellPreviewLookup(assignment);
    const cellData = lookup.get('student-1')?.get('task-sheet');

    expect(cellData).toBeDefined();
    expect(cellData!.artifactType).toBe('SPREADSHEET');
    expect(cellData!.artifactContent).toEqual(spreadsheetContent);
  });

  // -----------------------------------------------------------------------
  // Test 9 — negative identifier-drift test
  // -----------------------------------------------------------------------

  it('returns undefined when taskId does not match any heatmap column key', () => {
    // The submission has items with taskIds that do NOT align with the
    // heatmap's task column identifiers.
    const assignment = createAssignment([
      {
        studentId: 'student-1',
        studentName: 'Alice',
        assignmentId: 'assignment-1',
        documentId: null,
        items: {
          'item-1': {
            id: 'item-1',
            taskId: 'legacy-task-id', // Does NOT match any heatmap taskId
            artifact: {
              ...BASE_ARTIFACT_FIELDS,
              type: 'TEXT' as const,
              content: 'Some response',
              taskId: 'legacy-task-id',
            },
            assessments: {
              completeness: { score: 5, reasoning: 'OK' },
            },
            feedback: {},
          },
        },
        createdAt: DEFAULT_DATE,
        updatedAt: DEFAULT_DATE,
      },
    ]);

    const lookup: CellPreviewLookup = buildCellPreviewLookup(assignment);

    // The studentId resolves but the heatmap column taskIds are different
    const inner = lookup.get('student-1');
    expect(inner).toBeDefined();

    // Looking up by any taskId that the heatmap expects returns undefined
    expect(inner!.get('task_001')).toBeUndefined();
    expect(inner!.get('task_002')).toBeUndefined();
    expect(inner!.get('task_003')).toBeUndefined();

    // The submission's own taskId IS present (opposite assertion)
    expect(inner!.get('legacy-task-id')).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // Additional acceptance: missing student returns undefined
  // -----------------------------------------------------------------------

  it('returns undefined for a studentId that has no submission', () => {
    const assignment = createAssignment([
      {
        studentId: 'student-1',
        studentName: 'Alice',
        assignmentId: 'assignment-1',
        documentId: null,
        items: {
          'item-1': {
            id: 'item-1',
            taskId: 'task-1',
            artifact: {
              ...BASE_ARTIFACT_FIELDS,
              type: 'TEXT' as const,
              content: 'Alice response',
              taskId: 'task-1',
            },
            assessments: {
              completeness: { score: 4, reasoning: 'OK' },
            },
            feedback: {},
          },
        },
        createdAt: DEFAULT_DATE,
        updatedAt: DEFAULT_DATE,
      },
    ]);

    const lookup: CellPreviewLookup = buildCellPreviewLookup(assignment);

    expect(lookup.get('unknown-student')).toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // Additional acceptance: missing task returns undefined
  // -----------------------------------------------------------------------

  // -----------------------------------------------------------------------
  // Test 10 — duplicate student submissions: last-wins
  // -----------------------------------------------------------------------

  it('overwrites (last-wins) when same studentId appears in two submissions', () => {
    const assignment = createAssignment([
      {
        studentId: 'student-1',
        studentName: 'Alice',
        assignmentId: 'assignment-1',
        documentId: null,
        items: {
          'item-1': {
            id: 'item-1',
            taskId: 'task-1',
            artifact: {
              ...BASE_ARTIFACT_FIELDS,
              type: 'TEXT' as const,
              content: 'First submission content',
              taskId: 'task-1',
            },
            assessments: {
              completeness: { score: 4, reasoning: 'First version' },
            },
            feedback: {},
          },
        },
        createdAt: DEFAULT_DATE,
        updatedAt: DEFAULT_DATE,
      },
      {
        studentId: 'student-1',
        studentName: 'Alice',
        assignmentId: 'assignment-1',
        documentId: null,
        items: {
          'item-2': {
            id: 'item-2',
            taskId: 'task-1',
            artifact: {
              ...BASE_ARTIFACT_FIELDS,
              type: 'TEXT' as const,
              content: 'Second submission content',
              taskId: 'task-1',
            },
            assessments: {
              completeness: { score: 5, reasoning: 'Second version' },
            },
            feedback: {},
          },
        },
        createdAt: DEFAULT_DATE,
        updatedAt: DEFAULT_DATE,
      },
    ]);

    const lookup: CellPreviewLookup = buildCellPreviewLookup(assignment);
    const cellData = lookup.get('student-1')?.get('task-1');

    expect(cellData).toBeDefined();
    expect(cellData!.artifactContent).toBe('Second submission content');
  });

  it('returns undefined for a taskId not present in the submission', () => {
    const assignment = createAssignment([
      {
        studentId: 'student-1',
        studentName: 'Alice',
        assignmentId: 'assignment-1',
        documentId: null,
        items: {
          'item-1': {
            id: 'item-1',
            taskId: 'task-a',
            artifact: {
              ...BASE_ARTIFACT_FIELDS,
              type: 'TEXT' as const,
              content: 'Task A only',
              taskId: 'task-a',
            },
            assessments: {
              completeness: { score: 5, reasoning: 'Done' },
            },
            feedback: {},
          },
        },
        createdAt: DEFAULT_DATE,
        updatedAt: DEFAULT_DATE,
      },
    ]);

    const lookup: CellPreviewLookup = buildCellPreviewLookup(assignment);
    const inner = lookup.get('student-1');

    expect(inner).toBeDefined();
    expect(inner!.get('nonexistent-task')).toBeUndefined();
  });
});
