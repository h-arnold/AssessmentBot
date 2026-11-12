/**
 * Absolute-mode equivalence coverage for the averaging analyser.
 *
 * Pins decision 12 of the attempt-baseline specification: absolute-mode output
 * stays identical to the pre-echo behaviour apart from the
 * `appliedAnalysisMode: 'absolute'` echo.
 */

import { describe, it, expect } from 'vitest';
import { AveragingAnalyser } from './averagingAnalyser';
import type { AveragingAnalyserInput } from '../dataAnalysis.zod';
import {
  buildInput,
  createAssignmentPartial,
  createSubmission,
  createSubmissionItem,
  createTaskPartial,
} from '@/test/dataAnalysis/fixtures';

/** Alice's completeness on task `t_001`. */
const ALICE_TASK_ONE_COMPLETENESS = 4;

/** Alice's completeness on task `t_002`. */
const ALICE_TASK_TWO_COMPLETENESS = 2;

/** Bob's completeness on task `t_001`. */
const BOB_TASK_ONE_COMPLETENESS = 5;

/** Number of students in the absolute-mode fixture. */
const ABSOLUTE_FIXTURE_STUDENT_COUNT = 2;

/** Number of observed completeness scores across the fixture's students. */
const ABSOLUTE_FIXTURE_COMPLETENESS_OBSERVATIONS = 3;

/** Mean of the two students' completeness on task `t_001`. */
const EXPECTED_TASK_ONE_MEAN =
  (ALICE_TASK_ONE_COMPLETENESS + BOB_TASK_ONE_COMPLETENESS) / ABSOLUTE_FIXTURE_STUDENT_COUNT;

/** Class completeness mean over the observed completions. */
const EXPECTED_CLASS_MEAN =
  (ALICE_TASK_ONE_COMPLETENESS + ALICE_TASK_TWO_COMPLETENESS + BOB_TASK_ONE_COMPLETENESS) /
  ABSOLUTE_FIXTURE_COMPLETENESS_OBSERVATIONS;

/** Alice contributes two (student, task) pairs; Bob contributes one. */
const EXPECTED_PER_STUDENT_TASK_COUNT = 3;

/**
 * Build a two-student, two-task input whose values exercise numeric,
 * raw-`N` and partial-criterion evidence in explicit absolute mode.
 *
 * @returns {AveragingAnalyserInput} The absolute-mode input.
 */
function buildAbsoluteModeInput(): AveragingAnalyserInput {
  const assignment = createAssignmentPartial({
    assignmentId: 'a_001',
    definitionKey: 'dk_algebra',
    tasks: [createTaskPartial('t_001'), createTaskPartial('t_002')],
    submissions: [
      createSubmission('s_001', 'Alice', 'a_001', {
        t_001: createSubmissionItem('t_001', {
          completeness: { score: ALICE_TASK_ONE_COMPLETENESS },
          accuracy: { score: 3 },
          spag: { score: 5 },
        }),
        t_002: createSubmissionItem('t_002', {
          completeness: { score: ALICE_TASK_TWO_COMPLETENESS },
        }),
      }),
      createSubmission('s_002', 'Bob', 'a_001', {
        t_001: createSubmissionItem('t_001', {
          completeness: { score: BOB_TASK_ONE_COMPLETENESS },
          accuracy: { score: 'N' },
        }),
      }),
    ],
  });

  return buildInput(
    [
      {
        classId: 'c_001',
        className: 'Test Class',
        studentIds: ['s_001', 's_002'],
        assignments: [assignment],
      },
    ],
    { filter: { classIds: ['c_001'], analysisMode: 'absolute' } }
  );
}

describe('AveragingAnalyser absolute-mode analysis', () => {
  it('echoes appliedAnalysisMode absolute and omits attemptBaseline', () => {
    const [result] = new AveragingAnalyser().analyse(buildAbsoluteModeInput());

    expect(result.appliedAnalysisMode).toBe('absolute');
    expect(result).not.toHaveProperty('attemptBaseline');
  });

  it('keeps absolute-mode aggregate and task values identical to the pre-echo behaviour', () => {
    const [result] = new AveragingAnalyser().analyse(buildAbsoluteModeInput());

    // Alice: completeness (4 + 2) / 2 = 3; accuracy 3; spag 5; overall 0.4*3 + 0.4*3 + 0.2*5.
    const alice = result.perStudent.find((row) => row.studentId === 's_001');
    expect(alice).toMatchObject({
      completeness: { state: 'computed', value: 3 },
      accuracy: { state: 'computed', value: 3 },
      spag: { state: 'computed', value: 5 },
    });

    // Bob: completeness 5; accuracy is a raw N; spag has no evidence at all.
    const bob = result.perStudent.find((row) => row.studentId === 's_002');
    expect(bob).toMatchObject({
      completeness: { state: 'computed', value: 5 },
      accuracy: { state: 'notAttempted', value: 'N' },
      spag: { state: 'error', value: 'E' },
    });

    expect(result.perTask).toEqual([
      expect.objectContaining({
        definitionKey: 'dk_algebra',
        taskId: 't_001',
        completeness: expect.objectContaining({
          state: 'computed',
          value: EXPECTED_TASK_ONE_MEAN,
        }),
      }),
      expect.objectContaining({
        definitionKey: 'dk_algebra',
        taskId: 't_002',
        completeness: expect.objectContaining({ state: 'computed', value: 2 }),
      }),
    ]);

    expect(result.perClass.completeness).toMatchObject({
      state: 'computed',
      value: EXPECTED_CLASS_MEAN,
    });

    // The per-(student, task) evidence is unchanged by the mode echo.
    expect(result.perStudentTaskMetrics).toHaveLength(EXPECTED_PER_STUDENT_TASK_COUNT);
    expect(result.perStudentTaskMetrics?.map((metric) => metric.taskKey)).toEqual([
      'dk_algebra::t_001',
      'dk_algebra::t_002',
      'dk_algebra::t_001',
    ]);
  });

  it('analyses without invoking baseline selection when the class is baseline-ineligible', () => {
    // Three roster students where the two candidates attempt different tasks:
    // baseline mode would fail eligibility and then empty-intersect, so this
    // input must never reach the baseline derivation in absolute mode.
    const disjointAssignment = createAssignmentPartial({
      assignmentId: 'a_disjoint',
      definitionKey: 'dk_algebra',
      tasks: [createTaskPartial('t_001'), createTaskPartial('t_002')],
      submissions: [
        createSubmission('s_001', 'Alice', 'a_disjoint', {
          t_001: createSubmissionItem('t_001', {
            completeness: { score: ALICE_TASK_ONE_COMPLETENESS },
          }),
        }),
        createSubmission('s_002', 'Bob', 'a_disjoint', {
          t_002: createSubmissionItem('t_002', {
            completeness: { score: ALICE_TASK_TWO_COMPLETENESS },
          }),
        }),
      ],
    });
    const input = buildInput([
      {
        classId: 'c_001',
        className: 'Test Class',
        studentIds: ['s_001', 's_002', 's_003'],
        assignments: [disjointAssignment],
      },
    ]);

    const [result] = new AveragingAnalyser().analyse(input);

    expect(result.appliedAnalysisMode).toBe('absolute');
    expect(result).not.toHaveProperty('attemptBaseline');
  });
});
