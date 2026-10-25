/**
 * Cell-content derivation tests for `buildCellPreviewLookup`.
 *
 * Pins what each `CellPreviewData` carries once an artifact has been indexed:
 * `artifactType` / `artifactContent` for every supported artifact shape
 * (TEXT, TABLE, IMAGE, SPREADSHEET) and the per-criterion `reasoning` text
 * derived from the item's assessments, including the `null` pattern when only
 * completeness is assessed. The canonical cell also carries the derived
 * `sourceUrl`; the full derivation matrix lives in
 * `buildCellPreviewLookup.sourceLink.spec.ts`.
 *
 * Realistic setup comes from the canonical `small` records selected by
 * `src/test/taskHeatmap/previewFixtures.ts`. The accuracy-bearing variant is a
 * deliberate local boundary. TABLE remains unsupported by the corpus; IMAGE
 * and SPREADSHEET bodies are selected from canonical generated records.
 *
 * Key construction and resolution are covered by the siblings
 * `buildCellPreviewLookup.spec.ts` (contract/key invariants) and
 * `buildCellPreviewLookup.indexing.spec.ts`.
 */

import { describe, it, expect } from 'vitest';
import assignmentsByKeyRaw from '@synthetic/small/assignmentsByKey.json?raw';
import type { AssignmentFull } from '@/services/assignmentAssessment/assignmentAssessment.zod';
import { buildCellPreviewLookup } from './buildCellPreviewLookup';
import type { CellPreviewLookup, CellPreviewData } from './buildCellPreviewLookup';
import {
  CANONICAL_READY_CELL,
  cloneCanonicalSlidesAssignment,
} from '@/test/taskHeatmap/previewFixtures';
import { buildExpectedSourceUrl } from '@/test/taskHeatmap/buildCellPreviewLookupTestFixtures';

/** Submission-item shape carried by an `AssignmentFull` submission. */
type AssignmentSubmissionItem = AssignmentFull['submissions'][number]['items'][string];

/** Deliberate local accuracy override for the reasoning-presence boundary. */
const LOCAL_ACCURACY_REASONING = 'Locally supplied accuracy rationale';

/** Local unsupported TABLE body. */
const LOCAL_TABLE_BODY = '| Header | Value |\n|--------|-------|\n| A      | 1     |';
const CANONICAL_ASSIGNMENTS = JSON.parse(assignmentsByKeyRaw) as Record<string, AssignmentFull>;

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
    const assignment = cloneCanonicalSlidesAssignment();
    const submissionItem = canonicalSubmissionItem(assignment);
    const lookup: CellPreviewLookup = buildCellPreviewLookup(assignment);
    const cellData: CellPreviewData | undefined = lookup
      .get(CANONICAL_READY_CELL.studentId)
      ?.get(CANONICAL_READY_CELL.taskKey);

    expect(cellData).toBeDefined();
    expect(cellData!.artifactType).toBe('TEXT');
    expect(cellData!.artifactContent).toBe(CANONICAL_READY_CELL.artifactContent);
    expect(cellData!.reasoning.completeness).toBe(CANONICAL_READY_CELL.completenessReasoning);
    expect(cellData!.reasoning.accuracy).toBe(CANONICAL_READY_CELL.accuracyReasoning);
    expect(cellData!.reasoning.spag).toBe(CANONICAL_READY_CELL.spagReasoning);
    expect(cellData!.sourceUrl).toBe(
      buildExpectedSourceUrl(
        'SLIDES',
        submissionItem.artifact.documentId,
        submissionItem.artifact.pageId
      )
    );
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
  // Canonical IMAGE artifact body on a cloned ready record
  // -----------------------------------------------------------------------

  it('builds CellPreviewData for an IMAGE artifact body', () => {
    const assignment = cloneCanonicalSlidesAssignment();
    const item = canonicalSubmissionItem(assignment);
    const canonical = Object.values(CANONICAL_ASSIGNMENTS)
      .flatMap((assignment) =>
        assignment.submissions.flatMap((submission) => Object.values(submission.items))
      )
      .find(
        (candidate) =>
          candidate.artifact.type === 'IMAGE' && typeof candidate.artifact.content === 'string'
      );
    if (canonical == null) throw new Error('Canonical IMAGE submission item is missing.');
    const canonicalArtifactTaskId = canonical.artifact.taskId;
    const canonicalArtifact = structuredClone(canonical.artifact);
    const canonicalArtifactSnapshot = structuredClone(canonical.artifact);
    const canonicalUidTaskSuffix = `-${canonicalArtifactTaskId}`;
    item.artifact = {
      ...canonicalArtifact,
      taskId: item.taskId,
      uid: `${canonicalArtifact.uid.slice(0, -canonicalUidTaskSuffix.length)}-${item.taskId}`,
    };

    const lookup: CellPreviewLookup = buildCellPreviewLookup(assignment);
    const cellData = lookup.get(CANONICAL_READY_CELL.studentId)?.get(CANONICAL_READY_CELL.taskKey);

    expect(cellData).toBeDefined();
    expect(cellData!.artifactType).toBe('IMAGE');
    expect(cellData!.artifactContent).toBe(canonical.artifact.content);
    expect(item.artifact.taskId).toBe(item.taskId);
    expect(canonicalArtifact.uid.endsWith(canonicalUidTaskSuffix)).toBe(true);
    expect(item.artifact.uid).toBe(
      `${canonicalArtifact.uid.slice(0, -canonicalUidTaskSuffix.length)}-${item.taskId}`
    );
    expect(canonical.artifact).toEqual(canonicalArtifactSnapshot);
  });

  // -----------------------------------------------------------------------
  // All three reasoning fields populated from the canonical record
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
    delete item.assessments.accuracy;
    delete item.assessments.spag;

    const lookup: CellPreviewLookup = buildCellPreviewLookup(assignment);
    const cellData = lookup.get(CANONICAL_READY_CELL.studentId)?.get(CANONICAL_READY_CELL.taskKey);

    expect(cellData).toBeDefined();
    expect(cellData!.reasoning.completeness).toBe(CANONICAL_READY_CELL.completenessReasoning);
    expect(cellData!.reasoning.accuracy).toBeNull();
    expect(cellData!.reasoning.spag).toBeNull();
  });

  // -----------------------------------------------------------------------
  // Canonical SPREADSHEET artifact body on a cloned ready record
  // -----------------------------------------------------------------------

  it('exposes artifactType SPREADSHEET and artifactContent as a 2D array', () => {
    const assignment = cloneCanonicalSlidesAssignment();
    const item = canonicalSubmissionItem(assignment);
    const canonical = Object.values(CANONICAL_ASSIGNMENTS)
      .flatMap((assignment) =>
        assignment.submissions.flatMap((submission) => Object.values(submission.items))
      )
      .find(
        (candidate) =>
          candidate.artifact.type === 'SPREADSHEET' && Array.isArray(candidate.artifact.content)
      );
    if (canonical == null) throw new Error('Canonical SPREADSHEET submission item is missing.');
    const canonicalArtifactTaskId = canonical.artifact.taskId;
    const canonicalArtifact = structuredClone(canonical.artifact);
    const canonicalArtifactSnapshot = structuredClone(canonical.artifact);
    const canonicalUidTaskSuffix = `-${canonicalArtifactTaskId}`;
    item.artifact = {
      ...canonicalArtifact,
      taskId: item.taskId,
      uid: `${canonicalArtifact.uid.slice(0, -canonicalUidTaskSuffix.length)}-${item.taskId}`,
    };

    const lookup: CellPreviewLookup = buildCellPreviewLookup(assignment);
    const cellData = lookup.get(CANONICAL_READY_CELL.studentId)?.get(CANONICAL_READY_CELL.taskKey);

    expect(cellData).toBeDefined();
    expect(cellData!.artifactType).toBe('SPREADSHEET');
    expect(cellData!.artifactContent).toEqual(canonical.artifact.content);
    expect(item.artifact.taskId).toBe(item.taskId);
    expect(canonicalArtifact.uid.endsWith(canonicalUidTaskSuffix)).toBe(true);
    expect(item.artifact.uid).toBe(
      `${canonicalArtifact.uid.slice(0, -canonicalUidTaskSuffix.length)}-${item.taskId}`
    );
    expect(canonical.artifact).toEqual(canonicalArtifactSnapshot);
  });
});
