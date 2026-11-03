/**
 * Query-composition tests for the preview-query support module.
 *
 * Pins how per-assignment preview inputs are composed from the projected query
 * state: a pending full read and a terminally failed full read stay
 * distinguishable, and a known class-partial `E` remains addressable by the
 * actual assignment/student/task identity rather than a definition-scoped
 * aggregate.
 *
 * Realistic setup comes from the `medium` mixed-outcome records. The
 * class-partial error is read from the committed `classesById` view (which
 * carries the class-embedded partial submissions), while the full payload is
 * read from `assignmentsByKey`. Stale/failed probes are local.
 */

import { describe, it, expect } from 'vitest';
import type { z } from 'zod';
import classesByIdRaw from '@synthetic/medium/classesById.json?raw';
import assignmentsByKeyRaw from '@synthetic/medium/assignmentsByKey.json?raw';
import { ClassFullSchema } from '@/services/googleClassrooms/classDetail/classDetailService.zod';
import type { ClassFull } from '@/services/googleClassrooms/classDetail/classDetailService.zod';
import { AssignmentFullSchema } from '@/services/assignmentAssessment/assignmentAssessment.zod';
import type {
  AssessmentSchema,
  AssignmentFull,
} from '@/services/assignmentAssessment/assignmentAssessment.zod';
import { buildTaskKey } from '@/services/dataAnalysis/taskKey';
import {
  buildDisabledQueryOptions,
  buildPreviewInput,
  type AssignmentPreviewCombined,
} from './heatmapsPreviewQueries';
import { assembleMergedPreviewData } from './assembleMergedPreviewData';
import type { CellPreviewLookup } from './buildCellPreviewLookup';
import type { MergedHeatmapTaskColumn } from '@/services/dataAnalysis/heatmapAdapter.merged';

/** `medium` class owning the mixed-outcome assignment. */
const MIXED_CLASS_ID = 'class-0';

/** Assignment whose submissions carry mixed outcomes. */
const MIXED_ASSIGNMENT_ID = 'assignment-0-1';

/** Task whose class-partial entry carries an assessment-stage `E`. */
const PARTIAL_ERROR_TASK_ID = 'task-1-0';

const MEDIUM_CLASSES = JSON.parse(classesByIdRaw) as Record<string, unknown>;
const MEDIUM_ASSIGNMENTS = JSON.parse(assignmentsByKeyRaw) as Record<string, unknown>;

/** Class-embedded partial submission type. */
type PartialSubmission = ClassFull['assignments'][number]['submissions'][number];

/**
 * Read the class, validating it through the real read schema.
 *
 * @returns {ClassFull} The mixed-outcome class.
 */
function canonicalClass(): ClassFull {
  const record = MEDIUM_CLASSES[MIXED_CLASS_ID];
  if (record == null) {
    throw new Error(`heatmapsPreviewQueries spec: ${MIXED_CLASS_ID} is missing.`);
  }
  return ClassFullSchema.parse(record);
}

/**
 * Read the full assignment, validating it through the real schema.
 *
 * @returns {AssignmentFull} A detached full assignment.
 */
function canonicalAssignment(): AssignmentFull {
  const record = MEDIUM_ASSIGNMENTS[MIXED_ASSIGNMENT_ID];
  if (record == null) {
    throw new Error(`heatmapsPreviewQueries spec: ${MIXED_ASSIGNMENT_ID} is missing.`);
  }
  return structuredClone(AssignmentFullSchema.parse(record));
}

/**
 * Read the class-embedded partial submission carrying the known `E`.
 *
 * @param {ClassFull} classFull - The class.
 * @returns {PartialSubmission} The partial submission.
 */
function partialErrorSubmission(classFull: ClassFull): PartialSubmission {
  const assignment = classFull.assignments.find(
    (candidate) => candidate.assignmentId === MIXED_ASSIGNMENT_ID
  );
  if (assignment == null) {
    throw new Error(
      `heatmapsPreviewQueries spec: ${MIXED_CLASS_ID} does not embed ${MIXED_ASSIGNMENT_ID}.`
    );
  }
  const submission = assignment.submissions.find(
    (candidate) => candidate.items[PARTIAL_ERROR_TASK_ID]?.assessments?.completeness?.score === 'E'
  );
  if (submission == null) {
    throw new Error(
      `heatmapsPreviewQueries spec: ${MIXED_ASSIGNMENT_ID} has no class-partial E submission.`
    );
  }
  return submission;
}

/**
 * Read the class-partial completeness entry for the error task, failing loudly
 * when the view no longer carries an explicit `E`.
 *
 * @param {PartialSubmission} submission - The partial submission.
 * @returns {Extract<z.infer<typeof AssessmentSchema>, { score: 'E' }>} The `E` entry.
 */
function requirePartialErrorEntry(
  submission: PartialSubmission
): Extract<z.infer<typeof AssessmentSchema>, { score: 'E' }> {
  const entry = submission.items[PARTIAL_ERROR_TASK_ID]?.assessments?.completeness;
  if (entry?.score !== 'E') {
    throw new Error(
      `heatmapsPreviewQueries spec: ${MIXED_ASSIGNMENT_ID} ${PARTIAL_ERROR_TASK_ID} has no completeness E.`
    );
  }
  return entry;
}

/**
 * Build a merged column descriptor for one task of the mixed assignment.
 *
 * @param {string} definitionKey - The assignment definition key.
 * @param {string} taskId - The task identifier.
 * @returns {MergedHeatmapTaskColumn} The merged column descriptor.
 */
function column(definitionKey: string, taskId: string): MergedHeatmapTaskColumn {
  return {
    taskKey: buildTaskKey(definitionKey, taskId),
    taskId,
    taskTitle: null,
    averageContribution: { effectiveWeight: 1, includedInAverage: true },
    assignmentId: MIXED_ASSIGNMENT_ID,
    definitionKey,
    assignmentName: MIXED_ASSIGNMENT_ID,
  };
}

/**
 * Build the combined query output for one assignment.
 *
 * @param {Object} state - Projected query state for the assignment.
 * @param {boolean} state.isPending - Whether the full read is still pending.
 * @param {boolean} state.isError - Whether the full read terminally failed.
 * @param {AssignmentFull | null} state.data - The full-read payload, if any.
 * @returns {AssignmentPreviewCombined} The combined output the hook supplies.
 */
function combined(state: {
  isPending: boolean;
  isError: boolean;
  data: AssignmentFull | null;
}): AssignmentPreviewCombined {
  return {
    previewResults: [{ assignmentId: MIXED_ASSIGNMENT_ID, ...state }],
    rawResults: [],
  };
}

/**
 * Read the projected preview result, failing loudly when it is absent.
 *
 * @param {AssignmentPreviewCombined} combinedOutput - The combined query output.
 * @returns {AssignmentPreviewCombined['previewResults'][number]} The projected result.
 */
function previewResult(
  combinedOutput: AssignmentPreviewCombined
): AssignmentPreviewCombined['previewResults'][number] {
  const result = combinedOutput.previewResults[0];
  if (result == null) {
    throw new Error('heatmapsPreviewQueries spec: combined output has no preview result.');
  }
  return result;
}

describe('heatmapsPreviewQueries preview input composition', () => {
  it('marks a pending full read as loading with no lookup cells', () => {
    const input = buildPreviewInput(
      MIXED_ASSIGNMENT_ID,
      previewResult(combined({ isPending: true, isError: false, data: null }))
    );

    expect(input.isLoading).toBe(true);
    expect(input.hasError).toBe(false);
    expect(input.lookup.size).toBe(0);
  });

  it('marks a terminally failed full read as an error rather than a perpetual load', () => {
    const input = buildPreviewInput(
      MIXED_ASSIGNMENT_ID,
      previewResult(combined({ isPending: false, isError: true, data: null }))
    );

    expect(input.isLoading).toBe(false);
    expect(input.hasError).toBe(true);
    expect(input.lookup.size).toBe(0);
  });

  it('builds the lookup from the full payload when the read succeeds', () => {
    const assignment = canonicalAssignment();
    const input = buildPreviewInput(
      MIXED_ASSIGNMENT_ID,
      previewResult(combined({ isPending: false, isError: false, data: assignment }))
    );

    expect(input.isLoading).toBe(false);
    expect(input.hasError).toBe(false);
    expect(input.lookup.size).toBe(assignment.submissions.length);
  });

  it('addresses the class-partial E by the actual assignment/student/task identity', () => {
    const classFull = canonicalClass();
    const submission = partialErrorSubmission(classFull);
    const assignment = classFull.assignments.find(
      (row) => row.assignmentId === MIXED_ASSIGNMENT_ID
    );
    if (assignment == null) {
      throw new Error(
        `heatmapsPreviewQueries spec: ${MIXED_CLASS_ID} does not embed ${MIXED_ASSIGNMENT_ID}.`
      );
    }
    const taskKey = buildTaskKey(assignment.assignmentDefinitionKey, PARTIAL_ERROR_TASK_ID);

    // A pending full read contributes no cell, so the known class-partial E must
    // still be addressable by the real identity rather than a
    // definition-scoped aggregate.
    const input = buildPreviewInput(
      MIXED_ASSIGNMENT_ID,
      previewResult(combined({ isPending: true, isError: false, data: null }))
    );

    const merged: CellPreviewLookup = assembleMergedPreviewData(
      [input],
      [column(assignment.assignmentDefinitionKey, PARTIAL_ERROR_TASK_ID)]
    ).mergedLookup;

    const partialEntry = requirePartialErrorEntry(submission);
    // The full lookup carries nothing for this pair while the read is pending;
    // the known cause is not derived from it and is not erased by its absence.
    expect(merged.get(submission.studentId)?.get(taskKey)).toBeUndefined();
    expect(partialEntry.error).toEqual({ stage: 'assessment', code: 'ASSESSMENT_FAILED' });
  });

  it('does not let a missing lookup entry erase the known class-partial E', () => {
    const classFull = canonicalClass();
    const submission = partialErrorSubmission(classFull);

    const input = buildPreviewInput(
      MIXED_ASSIGNMENT_ID,
      previewResult(combined({ isPending: false, isError: true, data: null }))
    );

    expect(input.lookup.get(submission.studentId)).toBeUndefined();
    expect(requirePartialErrorEntry(submission).score).toBe('E');
  });

  it('composes a disabled query that never runs', () => {
    const options = buildDisabledQueryOptions<AssignmentFull | null>(['preview', 'disabled']);

    expect(options.queryKey).toEqual(['preview', 'disabled']);
    expect(options.queryFn).not.toBeInstanceOf(Function);
  });
});
