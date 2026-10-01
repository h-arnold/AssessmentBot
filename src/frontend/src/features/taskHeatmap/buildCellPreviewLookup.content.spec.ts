/**
 * Cell-content derivation tests for `buildCellPreviewLookup`.
 *
 * Pins what each `CellPreviewData` carries once an artifact has been indexed:
 * `artifactType` / `artifactContent` for every supported artifact shape
 * (TEXT, TABLE, IMAGE, SPREADSHEET) and the per-criterion `reasoning` text
 * derived from the item's assessments, including the `null` pattern when only
 * completeness is assessed.
 *
 * Realistic setup comes from the canonical `small` records selected by
 * `src/test/taskHeatmap/previewFixtures.ts`. The corpus only emits TEXT
 * submission bodies and never assesses `accuracy`, so the TABLE, IMAGE and
 * SPREADSHEET bodies and the accuracy-bearing variant stay local: each is a
 * narrow mutation of a cloned canonical record under the capability
 * exceptions recorded in `ACTION_PLAN.md`.
 *
 * Key construction and resolution are covered by the siblings
 * `buildCellPreviewLookup.spec.ts` (contract/key invariants) and
 * `buildCellPreviewLookup.indexing.spec.ts`.
 */

import { describe, it, expect } from 'vitest';
import type { AssignmentFull } from '../../services/assignmentAssessment/assignmentAssessment.zod';
import { buildCellPreviewLookup } from './buildCellPreviewLookup';
import type { CellPreviewLookup, CellPreviewData } from './buildCellPreviewLookup';
import {
  CANONICAL_READY_CELL,
  cloneCanonicalSlidesAssignment,
} from '../../test/taskHeatmap/previewFixtures';

/** Submission-item shape carried by an `AssignmentFull` submission. */
type AssignmentSubmissionItem = AssignmentFull['submissions'][number]['items'][string];

/** Locally supplied accuracy rationale; the corpus never assesses `accuracy`. */
const LOCAL_ACCURACY_REASONING = 'Locally supplied accuracy rationale';

/** Locally supplied TABLE body; the corpus only emits TEXT submission bodies. */
const LOCAL_TABLE_BODY = '| Header | Value |\n|--------|-------|\n| A      | 1     |';

/** Locally supplied IMAGE body; the corpus only emits TEXT submission bodies. */
const LOCAL_IMAGE_BODY = 'data:image/png;base64,iVBORw0KGgo=';

/** Locally supplied SPREADSHEET body; the corpus only emits TEXT submission bodies. */
const LOCAL_SPREADSHEET_BODY: Array<Array<string | number | null>> = [
  ['Name', 'Score', 'Grade'],
  ['Alice', '95', 'A'],
  ['Bob', '78', 'B'],
  [null, null, null],
];

/**
 * Read the canonical ready cell's submission item from a cloned assignment.
 *
 * @param {AssignmentFull} assignment - The cloned canonical assignment.
 * @returns {AssignmentSubmissionItem} The ready cell's submission item.
 */
function canonicalSubmissionItem(assignment: AssignmentFull): AssignmentSubmissionItem {
  const submission = assignment.submissions.find(
    (candidate) => candidate.studentId === CANONICAL_READY_CELL.studentId
  );
  if (submission == null) {
    throw new Error(
      `content spec: student "${CANONICAL_READY_CELL.studentId}" has no submission to mutate.`
    );
  }
  const item = submission.items[CANONICAL_READY_CELL.taskId];
  if (item == null) {
    throw new Error(
      `content spec: task "${CANONICAL_READY_CELL.taskId}" has no submission item to mutate.`
    );
  }
  return item;
}

describe('buildCellPreviewLookup cell content', () => {
  // -----------------------------------------------------------------------
  // Canonical TEXT artifact with the record's own assessments
  // -----------------------------------------------------------------------

  it('builds CellPreviewData for the canonical TEXT submission artifact', () => {
    const lookup: CellPreviewLookup = buildCellPreviewLookup(cloneCanonicalSlidesAssignment());
    const cellData: CellPreviewData | undefined = lookup
      .get(CANONICAL_READY_CELL.studentId)
      ?.get(CANONICAL_READY_CELL.taskKey);

    expect(cellData).toBeDefined();
    expect(cellData!.artifactType).toBe('TEXT');
    expect(cellData!.artifactContent).toBe(CANONICAL_READY_CELL.artifactContent);
    expect(cellData!.reasoning.completeness).toBe(CANONICAL_READY_CELL.completenessReasoning);
    expect(cellData!.reasoning.accuracy).toBe(CANONICAL_READY_CELL.accuracyReasoning);
    expect(cellData!.reasoning.spag).toBe(CANONICAL_READY_CELL.spagReasoning);
  });

  // -----------------------------------------------------------------------
  // TABLE artifact — local capability exception on a cloned canonical record
  // -----------------------------------------------------------------------

  it('builds CellPreviewData for a TABLE artifact body', () => {
    const assignment = cloneCanonicalSlidesAssignment();
    const item = canonicalSubmissionItem(assignment);
    item.artifact = { ...item.artifact, type: 'TABLE', content: LOCAL_TABLE_BODY };

    const lookup: CellPreviewLookup = buildCellPreviewLookup(assignment);
    const cellData = lookup.get(CANONICAL_READY_CELL.studentId)?.get(CANONICAL_READY_CELL.taskKey);

    expect(cellData).toBeDefined();
    expect(cellData!.artifactType).toBe('TABLE');
    expect(cellData!.artifactContent).toBe(LOCAL_TABLE_BODY);
  });

  // -----------------------------------------------------------------------
  // IMAGE artifact — local capability exception on a cloned canonical record
  // -----------------------------------------------------------------------

  it('builds CellPreviewData for an IMAGE artifact body', () => {
    const assignment = cloneCanonicalSlidesAssignment();
    const item = canonicalSubmissionItem(assignment);
    item.artifact = { ...item.artifact, type: 'IMAGE', content: LOCAL_IMAGE_BODY };

    const lookup: CellPreviewLookup = buildCellPreviewLookup(assignment);
    const cellData = lookup.get(CANONICAL_READY_CELL.studentId)?.get(CANONICAL_READY_CELL.taskKey);

    expect(cellData).toBeDefined();
    expect(cellData!.artifactType).toBe('IMAGE');
    expect(cellData!.artifactContent).toBe(LOCAL_IMAGE_BODY);
  });

  // -----------------------------------------------------------------------
  // All three reasoning fields populated (accuracy is a local addition)
  // -----------------------------------------------------------------------

  it('extracts reasoning text for completeness, accuracy, and spag from assessments', () => {
    const assignment = cloneCanonicalSlidesAssignment();
    const item = canonicalSubmissionItem(assignment);
    item.assessments.accuracy = { score: 4, reasoning: LOCAL_ACCURACY_REASONING };

    const lookup: CellPreviewLookup = buildCellPreviewLookup(assignment);
    const cellData = lookup.get(CANONICAL_READY_CELL.studentId)?.get(CANONICAL_READY_CELL.taskKey);

    expect(cellData).toBeDefined();
    expect(cellData!.reasoning.completeness).toBe(CANONICAL_READY_CELL.completenessReasoning);
    expect(cellData!.reasoning.accuracy).toBe(LOCAL_ACCURACY_REASONING);
    expect(cellData!.reasoning.spag).toBe(CANONICAL_READY_CELL.spagReasoning);
  });

  // -----------------------------------------------------------------------
  // Only completeness assessed, accuracy / spag are null
  // -----------------------------------------------------------------------

  it('sets accuracy and spag reasoning to null when only completeness is assessed', () => {
    const assignment = cloneCanonicalSlidesAssignment();
    const item = canonicalSubmissionItem(assignment);
    delete item.assessments.spag;

    const lookup: CellPreviewLookup = buildCellPreviewLookup(assignment);
    const cellData = lookup.get(CANONICAL_READY_CELL.studentId)?.get(CANONICAL_READY_CELL.taskKey);

    expect(cellData).toBeDefined();
    expect(cellData!.reasoning.completeness).toBe(CANONICAL_READY_CELL.completenessReasoning);
    expect(cellData!.reasoning.accuracy).toBeNull();
    expect(cellData!.reasoning.spag).toBeNull();
  });

  // -----------------------------------------------------------------------
  // SPREADSHEET artifact — local capability exception on a cloned record
  // -----------------------------------------------------------------------

  it('exposes artifactType SPREADSHEET and artifactContent as a 2D array', () => {
    const assignment = cloneCanonicalSlidesAssignment();
    const item = canonicalSubmissionItem(assignment);
    item.artifact = { ...item.artifact, type: 'SPREADSHEET', content: LOCAL_SPREADSHEET_BODY };

    const lookup: CellPreviewLookup = buildCellPreviewLookup(assignment);
    const cellData = lookup.get(CANONICAL_READY_CELL.studentId)?.get(CANONICAL_READY_CELL.taskKey);

    expect(cellData).toBeDefined();
    expect(cellData!.artifactType).toBe('SPREADSHEET');
    expect(cellData!.artifactContent).toEqual(LOCAL_SPREADSHEET_BODY);
  });
});
