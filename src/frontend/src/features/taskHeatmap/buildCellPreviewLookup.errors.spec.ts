/**
 * Error-cause derivation tests for `buildCellPreviewLookup`.
 *
 * Pins the per-criterion `errors` map the lookup attaches to every
 * `CellPreviewData`: an explicit `E` assessment contributes its validated
 * `{ stage, code }` cause, while a numeric, `N` or absent assessment
 * contributes `null`. The map is derived from the read payload's own
 * assessments, so an `E` whose source content survived extraction keeps its
 * cause.
 *
 * Realistic setup comes from the `medium` mixed-outcome records selected here
 * with the frontend raw-JSON import convention. The record is cloned before any
 * deliberate mutation, because the loader's frozen views are shared.
 */

import { describe, it, expect } from 'vitest';
import assignmentsByKeyRaw from '@synthetic/medium/assignmentsByKey.json?raw';
import { AssignmentFullSchema } from '@/services/assignmentAssessment/assignmentAssessment.zod';
import type { AssignmentFull } from '@/services/assignmentAssessment/assignmentAssessment.zod';
import { buildTaskKey } from '@/services/dataAnalysis/taskKey';
import { HEATMAP_METRIC_KEYS } from '@/services/dataAnalysis/metricDisplay/metricDisplayMeta';
import {
  buildCellPreviewLookup,
  type AssessmentError,
  type CellPreviewLookup,
} from './buildCellPreviewLookup';

/** `medium` assignment whose submissions carry mixed outcomes. */
const MIXED_ASSIGNMENT_ID = 'assignment-0-1';

/** Task whose assessment-stage `E` kept usable source content. */
const ASSESSMENT_ERROR_TASK_ID = 'task-1-1';

/** Task whose acquisition-stage `E` has no usable source. */
const ACQUISITION_ERROR_TASK_ID = 'task-1-0';

const MEDIUM_ASSIGNMENTS = JSON.parse(assignmentsByKeyRaw) as Record<string, unknown>;

/**
 * Clone the mixed-outcome assignment so a spec can mutate it without touching
 * the frozen committed view.
 *
 * @returns {AssignmentFull} A detached, schema-validated assignment.
 */
function cloneMixedAssignment(): AssignmentFull {
  const record = MEDIUM_ASSIGNMENTS[MIXED_ASSIGNMENT_ID];
  if (record == null) {
    throw new Error(
      `buildCellPreviewLookup errors spec: ${MIXED_ASSIGNMENT_ID} is absent from the medium view.`
    );
  }
  return structuredClone(AssignmentFullSchema.parse(record));
}

/**
 * Read the submission whose items carry the mixed outcomes.
 *
 * @param {AssignmentFull} assignment - The cloned assignment.
 * @returns {AssignmentFull['submissions'][number]} The mixed-outcome submission.
 */
function mixedSubmission(assignment: AssignmentFull): AssignmentFull['submissions'][number] {
  const submission = assignment.submissions.find((candidate) => {
    const assessmentItem = candidate.items[ASSESSMENT_ERROR_TASK_ID];
    const acquisitionItem = candidate.items[ACQUISITION_ERROR_TASK_ID];
    return (
      assessmentItem?.assessments.completeness?.score === 'E' &&
      acquisitionItem?.assessments.completeness?.score === 'E'
    );
  });
  if (submission == null) {
    throw new Error(
      `buildCellPreviewLookup errors spec: ${MIXED_ASSIGNMENT_ID} has no mixed-outcome submission.`
    );
  }
  return submission;
}

/**
 * Read the submission whose items carry the acquisition-stage `E`.
 *
 * @param {AssignmentFull} assignment - The cloned assignment.
 * @returns {AssignmentFull['submissions'][number]} The acquisition-outcome submission.
 */
function acquisitionSubmission(assignment: AssignmentFull): AssignmentFull['submissions'][number] {
  const submission = assignment.submissions.find((candidate) => {
    const assessment = candidate.items[ACQUISITION_ERROR_TASK_ID]?.assessments.completeness;
    return assessment?.score === 'E' && assessment.error.stage === 'acquisition';
  });
  if (submission == null) {
    throw new Error(
      `buildCellPreviewLookup errors spec: ${MIXED_ASSIGNMENT_ID} has no acquisition-outcome submission.`
    );
  }
  return submission;
}

/**
 * Read the item's own assessment-stage cause, failing loudly when the view no
 * longer carries one.
 *
 * @param {AssignmentFull['submissions'][number]} submission - The mixed submission.
 * @param {string} taskId - Task whose completeness assessment must be an `E`.
 * @returns {AssessmentError} The recorded cause.
 */
function requireCompletenessCause(
  submission: AssignmentFull['submissions'][number],
  taskId: string
): AssessmentError {
  const assessment = submission.items[taskId]?.assessments.completeness;
  if (assessment?.score !== 'E') {
    throw new Error(
      `buildCellPreviewLookup errors spec: ${taskId} has no completeness E assessment.`
    );
  }
  return assessment.error;
}

/**
 * Compare two criterion keys alphabetically, for order-insensitive set checks.
 *
 * @param {string} a - First key.
 * @param {string} b - Second key.
 * @returns {number} The locale comparison result.
 */
function compareKeys(a: string, b: string): number {
  return a.localeCompare(b);
}

describe('buildCellPreviewLookup error causes', () => {
  it('records the assessment-stage cause for an E criterion that kept usable source content', () => {
    const assignment = cloneMixedAssignment();
    const submission = mixedSubmission(assignment);
    const expectedCause = requireCompletenessCause(submission, ASSESSMENT_ERROR_TASK_ID);

    const cell = buildCellPreviewLookup(assignment)
      .get(submission.studentId)
      ?.get(buildTaskKey(assignment.assignmentDefinition.definitionKey, ASSESSMENT_ERROR_TASK_ID));

    expect(cell?.errors.completeness).toEqual(expectedCause);
    expect(cell?.errors.completeness?.stage).toBe('assessment');
    // The cause travels beside the surviving source content, so an
    // assessment-only error never implies an unavailable source.
    expect(typeof cell?.artifactContent).not.toBe('undefined');
  });

  it('records the acquisition-stage cause for an E criterion with no usable source', () => {
    const assignment = cloneMixedAssignment();
    const submission = acquisitionSubmission(assignment);
    const expectedCause = requireCompletenessCause(submission, ACQUISITION_ERROR_TASK_ID);

    const cell = buildCellPreviewLookup(assignment)
      .get(submission.studentId)
      ?.get(buildTaskKey(assignment.assignmentDefinition.definitionKey, ACQUISITION_ERROR_TASK_ID));

    expect(cell?.errors.completeness).toEqual(expectedCause);
    expect(cell?.errors.completeness?.stage).toBe('acquisition');
  });

  it('gives every criterion an entry and leaves non-E criteria null', () => {
    const assignment = cloneMixedAssignment();
    const submission = mixedSubmission(assignment);

    const lookup = buildCellPreviewLookup(assignment);
    const definitionKey = assignment.assignmentDefinition.definitionKey;

    for (const item of Object.values(submission.items)) {
      const cell = lookup.get(submission.studentId)?.get(buildTaskKey(definitionKey, item.taskId));
      expect(cell).toBeDefined();
      expect(Object.keys(cell!.errors).toSorted(compareKeys)).toEqual(
        [...HEATMAP_METRIC_KEYS].toSorted(compareKeys)
      );

      for (const metricKey of HEATMAP_METRIC_KEYS) {
        const assessment = item.assessments[metricKey];
        const expected = assessment?.score === 'E' ? assessment.error : null;
        expect(cell!.errors[metricKey]).toEqual(expected);
      }
    }
  });

  it('leaves every criterion null for a healthy numeric/N item', () => {
    const assignment = cloneMixedAssignment();
    const submission = assignment.submissions.find((candidate) => {
      const item = candidate.items[ASSESSMENT_ERROR_TASK_ID];
      return item != null && Object.values(item.assessments).every((entry) => entry.score !== 'E');
    });
    if (submission == null) {
      throw new Error(
        'buildCellPreviewLookup errors spec: the mixed assignment has no healthy submission.'
      );
    }

    const cell = buildCellPreviewLookup(assignment)
      .get(submission.studentId)
      ?.get(buildTaskKey(assignment.assignmentDefinition.definitionKey, ASSESSMENT_ERROR_TASK_ID));

    expect(cell).toBeDefined();
    for (const metricKey of HEATMAP_METRIC_KEYS) {
      expect(cell!.errors[metricKey]).toBeNull();
    }
  });

  it('derives the cause from the assessment itself, not from the artefact type', () => {
    const assignment = cloneMixedAssignment();
    const submission = mixedSubmission(assignment);
    const item = submission.items[ASSESSMENT_ERROR_TASK_ID];
    item.artifact = { ...item.artifact, type: 'TEXT', content: 'Locally supplied text body' };

    const cell = buildCellPreviewLookup(assignment)
      .get(submission.studentId)
      ?.get(buildTaskKey(assignment.assignmentDefinition.definitionKey, ASSESSMENT_ERROR_TASK_ID));

    expect(cell?.artifactType).toBe('TEXT');
    expect(cell?.errors.completeness).toEqual(
      requireCompletenessCause(submission, ASSESSMENT_ERROR_TASK_ID)
    );
  });

  it('keeps a known E cause reachable when the full lookup has no entry for the pair', () => {
    // A missing lookup entry must never be read as "no error". The known cause
    // is addressed by the actual assignment/student/task identity, so an absent
    // or failed full read cannot erase it.
    const assignment = cloneMixedAssignment();
    const submission = mixedSubmission(assignment);
    const taskKey = buildTaskKey(
      assignment.assignmentDefinition.definitionKey,
      ASSESSMENT_ERROR_TASK_ID
    );

    const fullCell = buildCellPreviewLookup(assignment).get(submission.studentId)?.get(taskKey);
    expect(fullCell?.errors.completeness?.stage).toBe('assessment');

    const lookupMissingThePair: CellPreviewLookup = new Map([[submission.studentId, new Map()]]);
    expect(lookupMissingThePair.get(submission.studentId)?.get(taskKey) ?? null).toBeNull();
    expect(requireCompletenessCause(submission, ASSESSMENT_ERROR_TASK_ID)).toEqual(
      fullCell?.errors.completeness
    );
  });
});
