/**
 * Indexing and resolution tests for `buildCellPreviewLookup`.
 *
 * Pins how the two-level `Map<studentId, Map<taskKey, CellPreviewData>>` is
 * keyed and queried: one entry per student submission, one inner entry per
 * submission item, first-wins within a submission's items and last-wins across
 * duplicate student submissions, plus the `undefined` misses for unknown
 * students, unlisted taskIds and identifier drift against heatmap columns.
 *
 * Realistic setup comes from the canonical `small` records selected by
 * `src/test/taskHeatmap/previewFixtures.ts`. The duplicate-item,
 * duplicate-submission and identifier-drift probes are deliberate state and
 * boundary fixtures, so they stay local via the primitives in
 * `src/test/taskHeatmap/buildCellPreviewLookupTestFixtures.ts`.
 *
 * Cell-content derivation is covered by `buildCellPreviewLookup.content.spec.ts`
 * and the composite-key contract by `buildCellPreviewLookup.spec.ts`.
 */

import { describe, it, expect } from 'vitest';
import { buildTaskKey } from '../../services/dataAnalysis/taskKey';
import { buildCellPreviewLookup } from './buildCellPreviewLookup';
import type { CellPreviewLookup } from './buildCellPreviewLookup';
import {
  BASE_ARTIFACT_FIELDS,
  DEFAULT_DATE,
  createAssignment,
} from '../../test/taskHeatmap/buildCellPreviewLookupTestFixtures';
import {
  CANONICAL_READY_CELL,
  cloneCanonicalSlidesAssignment,
} from '../../test/taskHeatmap/previewFixtures';

describe('buildCellPreviewLookup indexing', () => {
  // -----------------------------------------------------------------------
  // Multiple submissions for different students
  // -----------------------------------------------------------------------

  it('indexes multiple student submissions by studentId', () => {
    const assignment = cloneCanonicalSlidesAssignment();
    const [firstSubmission, secondSubmission] = assignment.submissions;
    const firstTaskId = Object.keys(firstSubmission.items)[0];
    const secondTaskId = Object.keys(secondSubmission.items)[0];

    const lookup: CellPreviewLookup = buildCellPreviewLookup(assignment);

    const firstInner = lookup.get(firstSubmission.studentId);
    const secondInner = lookup.get(secondSubmission.studentId);
    expect(firstInner).toBeDefined();
    expect(secondInner).toBeDefined();

    expect(
      firstInner!.get(buildTaskKey(CANONICAL_READY_CELL.definitionKey, firstTaskId))!
        .artifactContent
    ).toBe(firstSubmission.items[firstTaskId].artifact.content);
    expect(
      secondInner!.get(buildTaskKey(CANONICAL_READY_CELL.definitionKey, secondTaskId))!
        .artifactContent
    ).toBe(secondSubmission.items[secondTaskId].artifact.content);
  });

  // -----------------------------------------------------------------------
  // Multiple items with different taskIds in one submission
  // -----------------------------------------------------------------------

  it('maps multiple items with different taskIds from a single submission', () => {
    const assignment = cloneCanonicalSlidesAssignment();
    const submission = assignment.submissions.find(
      (candidate) => candidate.studentId === CANONICAL_READY_CELL.studentId
    );
    if (submission == null) {
      throw new Error(
        `indexing spec: student "${CANONICAL_READY_CELL.studentId}" has no submission to index.`
      );
    }
    const items = Object.values(submission.items);
    expect(items.length).toBeGreaterThan(1);

    const lookup: CellPreviewLookup = buildCellPreviewLookup(assignment);
    const inner = lookup.get(CANONICAL_READY_CELL.studentId);

    expect(inner).toBeDefined();
    for (const item of items) {
      expect(
        inner!.get(buildTaskKey(CANONICAL_READY_CELL.definitionKey, item.taskId))!.artifactContent
      ).toBe(item.artifact.content);
    }
  });

  // -----------------------------------------------------------------------
  // Duplicate taskId items: first encountered wins (local state fixture)
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
    const cellData = lookup.get('student-1')?.get('test-def::task-dup');

    expect(cellData).toBeDefined();
    expect(cellData!.artifactContent).toBe('First encounter');
    expect(cellData!.reasoning.completeness).toBe('First version');
  });

  // -----------------------------------------------------------------------
  // Identifier drift against heatmap columns (local boundary fixture)
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
    expect(inner!.get('test-def::task_001')).toBeUndefined();
    expect(inner!.get('test-def::task_002')).toBeUndefined();
    expect(inner!.get('test-def::task_003')).toBeUndefined();

    // The submission's own taskId IS present (opposite assertion)
    expect(inner!.get('test-def::legacy-task-id')).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // Missing student
  // -----------------------------------------------------------------------

  it('returns undefined for a studentId that has no submission', () => {
    const lookup: CellPreviewLookup = buildCellPreviewLookup(cloneCanonicalSlidesAssignment());

    expect(lookup.get('unknown-student')).toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // Duplicate student submissions: last-wins (local state fixture)
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
    const cellData = lookup.get('student-1')?.get('test-def::task-1');

    expect(cellData).toBeDefined();
    expect(cellData!.artifactContent).toBe('Second submission content');
  });

  // -----------------------------------------------------------------------
  // Missing task
  // -----------------------------------------------------------------------

  it('returns undefined for a taskId not present in the submission', () => {
    const lookup: CellPreviewLookup = buildCellPreviewLookup(cloneCanonicalSlidesAssignment());
    const inner = lookup.get(CANONICAL_READY_CELL.studentId);

    expect(inner).toBeDefined();
    expect(
      inner!.get(buildTaskKey(CANONICAL_READY_CELL.definitionKey, 'nonexistent-task'))
    ).toBeUndefined();
  });
});
