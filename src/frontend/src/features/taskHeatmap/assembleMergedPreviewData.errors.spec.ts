/**
 * Merged error-identity tests for `assembleMergedPreviewData`.
 *
 * Pins that a merged preview's error cause and reasoning always come from the
 * same first-selected assignment instance that supplies its content and source
 * link. Two assignment instances sharing one definition key collapse onto one
 * composite `taskKey`; the second instance's reasoning and cause must never leak
 * into the merged cell, and a first instance with no recorded cause must not be
 * "upgraded" by a later instance that has one.
 *
 * The fixtures are local probes: this module merges already-built lookups, so no
 * corpus record is needed to describe the merge identity contract.
 */

import { describe, it, expect } from 'vitest';
import { assembleMergedPreviewData } from './assembleMergedPreviewData';
import type { AssignmentPreviewInput } from './assembleMergedPreviewData';
import type { AssessmentError, CellPreviewData, CellPreviewLookup } from './buildCellPreviewLookup';
import type { MergedHeatmapTaskColumn } from '@/services/dataAnalysis/heatmapAdapter.merged';

/** Shared definition key for the two collapsed assignment instances. */
const SHARED_DEFINITION_KEY = 'def-shared';
/** Task identifier shared by both instances. */
const SHARED_TASK_ID = 'task-shared';
/** Composite key both instances collapse onto. */
const SHARED_TASK_KEY = `${SHARED_DEFINITION_KEY}::${SHARED_TASK_ID}`;

/** First-selected assignment identifier. */
const FIRST_ASSIGNMENT_ID = 'assignment-first';
/** Later assignment identifier sharing the definition key. */
const LATER_ASSIGNMENT_ID = 'assignment-later';

/** Cause recorded by the first-selected instance. */
const FIRST_CAUSE: AssessmentError = {
  stage: 'extraction',
  code: 'SOURCE_CONTENT_UNAVAILABLE',
};
/** Cause recorded by the later instance only. */
const LATER_CAUSE: AssessmentError = { stage: 'assessment', code: 'LLM_INVALID_RESPONSE' };

/** Reasoning recorded by the first-selected instance. */
const FIRST_REASONING = 'No source content could be extracted for this task.';
/** Reasoning recorded by the later instance only. */
const LATER_REASONING = 'The assessment service returned an invalid result.';

/**
 * Build a TEXT cell fixture tagged with an instance identity.
 *
 * @param {string} tag - Instance marker carried in `artifactContent`.
 * @param {string|null} reasoning - Reasoning the instance records for completeness.
 * @param {AssessmentError|null} error - Cause the instance records for completeness.
 * @returns {CellPreviewData} The cell fixture.
 */
function cell(
  tag: string,
  reasoning: string | null,
  error: AssessmentError | null
): CellPreviewData {
  return {
    artifactType: 'TEXT',
    artifactContent: tag,
    reasoning: { completeness: reasoning, accuracy: null, spag: null },
    errors: { completeness: error, accuracy: null, spag: null },
    sourceUrl: null,
  };
}

/**
 * Build a single-entry lookup for the shared task key.
 *
 * @param {CellPreviewData} previewCell - The cell to index.
 * @returns {CellPreviewLookup} The lookup.
 */
function lookupWith(previewCell: CellPreviewData): CellPreviewLookup {
  return new Map([['student-1', new Map([[SHARED_TASK_KEY, previewCell]])]]);
}

/**
 * Build a merged column descriptor for one assignment instance.
 *
 * @param {string} assignmentId - The contributing assignment identifier.
 * @returns {MergedHeatmapTaskColumn} The merged column descriptor.
 */
function column(assignmentId: string): MergedHeatmapTaskColumn {
  return {
    taskKey: SHARED_TASK_KEY,
    taskId: SHARED_TASK_ID,
    taskTitle: null,
    averageContribution: { effectiveWeight: 1, includedInAverage: true },
    includedInAttemptBaseline: true,
    assignmentId,
    definitionKey: SHARED_DEFINITION_KEY,
    assignmentName: assignmentId,
  };
}

/**
 * Build the two preview inputs, later instance first in the input array so the
 * assertion proves the merge follows column order rather than input order.
 *
 * @param {CellPreviewData} firstCell - Cell carried by the first-selected instance.
 * @param {CellPreviewData} laterCell - Cell carried by the later instance.
 * @returns {ReadonlyArray<AssignmentPreviewInput>} The preview inputs.
 */
function inputs(
  firstCell: CellPreviewData,
  laterCell: CellPreviewData
): ReadonlyArray<AssignmentPreviewInput> {
  return [
    {
      assignmentId: LATER_ASSIGNMENT_ID,
      lookup: lookupWith(laterCell),
      isLoading: false,
      hasError: false,
    },
    {
      assignmentId: FIRST_ASSIGNMENT_ID,
      lookup: lookupWith(firstCell),
      isLoading: false,
      hasError: false,
    },
  ];
}

describe('assembleMergedPreviewData error identity', () => {
  it('takes the error cause and reasoning from the first-selected instance', () => {
    const result = assembleMergedPreviewData(
      inputs(
        cell('first', FIRST_REASONING, FIRST_CAUSE),
        cell('later', LATER_REASONING, LATER_CAUSE)
      ),
      [column(FIRST_ASSIGNMENT_ID), column(LATER_ASSIGNMENT_ID)]
    );

    const merged = result.mergedLookup.get('student-1')?.get(SHARED_TASK_KEY);

    // Content, reasoning and cause must all come from the same winning instance.
    expect(merged?.artifactContent).toBe('first');
    expect(merged?.reasoning.completeness).toBe(FIRST_REASONING);
    expect(merged?.errors.completeness).toEqual(FIRST_CAUSE);
  });

  it('never attaches the later instance reasoning to a first instance that records none', () => {
    const result = assembleMergedPreviewData(
      inputs(cell('first', null, null), cell('later', LATER_REASONING, LATER_CAUSE)),
      [column(FIRST_ASSIGNMENT_ID), column(LATER_ASSIGNMENT_ID)]
    );

    const merged = result.mergedLookup.get('student-1')?.get(SHARED_TASK_KEY);

    expect(merged?.artifactContent).toBe('first');
    expect(merged?.reasoning.completeness).toBeNull();
    expect(merged?.errors.completeness).toBeNull();
  });

  it('keeps a first instance cause when the later instance is healthy', () => {
    const result = assembleMergedPreviewData(
      inputs(cell('first', FIRST_REASONING, FIRST_CAUSE), cell('later', null, null)),
      [column(FIRST_ASSIGNMENT_ID), column(LATER_ASSIGNMENT_ID)]
    );

    const merged = result.mergedLookup.get('student-1')?.get(SHARED_TASK_KEY);

    expect(merged?.errors.completeness).toEqual(FIRST_CAUSE);
    expect(merged?.reasoning.completeness).toBe(FIRST_REASONING);
  });

  it('keeps distinct task keys as separate error entries', () => {
    const otherTaskKey = `${SHARED_DEFINITION_KEY}::other-task`;
    const firstLookup: CellPreviewLookup = new Map([
      ['student-1', new Map([[SHARED_TASK_KEY, cell('first', FIRST_REASONING, FIRST_CAUSE)]])],
    ]);
    const laterLookup: CellPreviewLookup = new Map([
      ['student-1', new Map([[otherTaskKey, cell('later', LATER_REASONING, LATER_CAUSE)]])],
    ]);

    const result = assembleMergedPreviewData(
      [
        {
          assignmentId: FIRST_ASSIGNMENT_ID,
          lookup: firstLookup,
          isLoading: false,
          hasError: false,
        },
        {
          assignmentId: LATER_ASSIGNMENT_ID,
          lookup: laterLookup,
          isLoading: false,
          hasError: false,
        },
      ],
      [
        column(FIRST_ASSIGNMENT_ID),
        {
          ...column(LATER_ASSIGNMENT_ID),
          taskKey: otherTaskKey,
          taskId: 'other-task',
        },
      ]
    );

    expect(result.mergedLookup.get('student-1')?.get(SHARED_TASK_KEY)?.errors.completeness).toEqual(
      FIRST_CAUSE
    );
    expect(result.mergedLookup.get('student-1')?.get(otherTaskKey)?.errors.completeness).toEqual(
      LATER_CAUSE
    );
  });
});
