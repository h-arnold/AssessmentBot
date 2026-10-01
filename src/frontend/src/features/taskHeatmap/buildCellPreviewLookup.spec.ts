/**
 * Contract tests for `buildCellPreviewLookup` — a pure transformation function
 * that converts `AssignmentFull` into a
 * `Map<studentId, Map<taskKey, CellPreviewData>>` keyed lookup, where `taskKey`
 * is the composite `` `${definitionKey}::${taskId}` `` derived internally from
 * the payload's embedded `assignmentDefinition.definitionKey`.
 *
 * This suite pins two behaviours:
 *
 * 1. the composite-key contract (every submission item is indexed under its
 *    `${definitionKey}::${taskId}` inner key, and a payload missing the
 *    embedded definition fails loudly rather than producing wrong keys); and
 * 2. parity with the embedded heatmap columns (lookup keys must equal the
 *    `taskKey`s that `adaptMetricsToHeatmap` derives), which is exercised
 *    directly by the co-located `buildCellPreviewLookup.parity.spec.ts`.
 *
 * The resolved cell also carries the derived `sourceUrl` for the canonical
 * ready cell; the full derivation matrix lives in
 * `buildCellPreviewLookup.sourceLink.spec.ts`.
 *
 * The wider suite is split by concern so each file stays under the line
 * budget: cell-content derivation lives in
 * `buildCellPreviewLookup.content.spec.ts`, student/task indexing and
 * resolution in `buildCellPreviewLookup.indexing.spec.ts`. All three take
 * their realistic setup from the canonical `small` records selected by
 * `src/test/taskHeatmap/previewFixtures.ts`, and keep deliberately invalid,
 * boundary and state fixtures local via the primitives in
 * `src/test/taskHeatmap/buildCellPreviewLookupTestFixtures.ts`.
 */

import { describe, it, expect } from 'vitest';
import type { AssignmentFull } from '../../services/assignmentAssessment/assignmentAssessment.zod';
import { buildTaskKey } from '../../services/dataAnalysis/taskKey';
import { buildCellPreviewLookup } from './buildCellPreviewLookup';
import type { CellPreviewLookup } from './buildCellPreviewLookup';
import {
  BASE_ARTIFACT_FIELDS,
  DEFAULT_DATE,
  buildExpectedSourceUrl,
  createAssignment,
} from '../../test/taskHeatmap/buildCellPreviewLookupTestFixtures';
import {
  CANONICAL_CLASS,
  CANONICAL_READY_CELL,
  cloneCanonicalSlidesAssignment,
} from '../../test/taskHeatmap/previewFixtures';

describe('buildCellPreviewLookup', () => {
  // -----------------------------------------------------------------------
  // Joined-fixture test: identifiers align with the canonical class roster
  // -----------------------------------------------------------------------

  it('resolves CellPreviewData for identifiers matching a ClassFull-derived heatmap', () => {
    // The canonical Slides assignment is owned by `class-2`, so its submission
    // studentId and item taskId are the identifiers a ClassFull-derived
    // heatmap for that roster carries.
    const assignment = cloneCanonicalSlidesAssignment();
    const lookup: CellPreviewLookup = buildCellPreviewLookup(assignment);

    expect(CANONICAL_CLASS.students.map((student) => student.id)).toContain(
      CANONICAL_READY_CELL.studentId
    );

    // Assert the studentId resolves
    const inner = lookup.get(CANONICAL_READY_CELL.studentId);
    expect(inner).toBeDefined();

    // Assert the taskId resolves with the expected data
    const cellData = inner!.get(CANONICAL_READY_CELL.taskKey);
    expect(cellData).toBeDefined();
    expect(cellData!.artifactType).toBe('TEXT');
    expect(cellData!.artifactContent).toBe(CANONICAL_READY_CELL.artifactContent);
    expect(cellData!.reasoning.completeness).toBe(CANONICAL_READY_CELL.completenessReasoning);

    // The derived editor source URL joins the cell's output shape, built from
    // the same submission item's stored document and page IDs.
    const submission = assignment.submissions.find(
      (candidate) => candidate.studentId === CANONICAL_READY_CELL.studentId
    );
    if (submission == null) {
      throw new Error(
        `buildCellPreviewLookup spec: student "${CANONICAL_READY_CELL.studentId}" has no submission to inspect.`
      );
    }
    const artifact = submission.items[CANONICAL_READY_CELL.taskId].artifact;
    expect(cellData!.sourceUrl).toBe(
      buildExpectedSourceUrl('SLIDES', artifact.documentId, artifact.pageId)
    );
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
  // Composite inner key shape
  // -----------------------------------------------------------------------

  it('keys the inner map by composite `${definitionKey}::${taskId}` for every submission item', () => {
    const assignment = cloneCanonicalSlidesAssignment();
    const submission = assignment.submissions.find(
      (candidate) => candidate.studentId === CANONICAL_READY_CELL.studentId
    );
    if (submission == null) {
      throw new Error(
        `buildCellPreviewLookup spec: student "${CANONICAL_READY_CELL.studentId}" has no submission to inspect.`
      );
    }
    const itemTaskIds = Object.values(submission.items).map((item) => item.taskId);

    const lookup: CellPreviewLookup = buildCellPreviewLookup(assignment);
    const inner = lookup.get(CANONICAL_READY_CELL.studentId);
    expect(inner).toBeDefined();

    const keys = [...inner!.keys()];
    expect(keys).toEqual(
      itemTaskIds.map((taskId) => buildTaskKey(CANONICAL_READY_CELL.definitionKey, taskId))
    );

    // The bare taskId must NOT leak into the inner map (collision safety).
    for (const taskId of itemTaskIds) {
      expect(inner!.has(taskId)).toBe(false);
    }
  });

  it('throws when the embedded assignmentDefinition (and its definitionKey) is absent', () => {
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
              content: 'Response',
              taskId: 'task-1',
            },
            assessments: { completeness: { score: 5, reasoning: 'Done' } },
            feedback: {},
          },
        },
        createdAt: DEFAULT_DATE,
        updatedAt: DEFAULT_DATE,
      },
    ]);

    // The composite key is derived internally from the embedded
    // assignmentDefinition.definitionKey. A payload missing that embedded
    // definition must fail loudly rather than silently producing wrong keys.
    const broken = {
      ...assignment,
      assignmentDefinition: undefined,
    } as unknown as AssignmentFull;

    expect(() => buildCellPreviewLookup(broken)).toThrow();
  });
});
