import { describe, expect, it } from 'vitest';
import { AveragingAnalyser } from './averagingAnalyser';
import { buildPerTaskRows } from './averagingAnalyser.rows';
import { createDataPointAccumulator } from './averagingAnalyser.accumulatorRegistry';
import type { AveragingAnalyserInput } from '../dataAnalysis.zod';
import {
  buildInput,
  createAssignmentPartial,
  createDefinitionPartial,
  createSubmission,
  createSubmissionItem,
  createTaskPartial,
} from '@/test/dataAnalysis/fixtures';
import { expectMetricResultStateAware } from '@/test/dataAnalysis/averagingAnalyserAssertions';

describe('per-task display fallback boundaries', () => {
  it('retains the display overall when the composite resolves excluded', () => {
    const accumulator = createDataPointAccumulator();
    for (const criterion of ['completeness', 'accuracy', 'spag', 'overall'] as const) {
      accumulator[criterion].displaySum = 6;
      accumulator[criterion].displayCount = 1;
      accumulator[criterion].displayTotalDataPoints = 1;
    }

    const rows = buildPerTaskRows(
      new Map([
        [
          'dk_boundary::task',
          {
            definitionKey: 'dk_boundary',
            taskId: 'task',
            ...accumulator,
          },
        ],
      ]),
      { completeness: 0.4, accuracy: 0.4, spag: 0.2 },
      new Map([['dk_boundary::task', { effectiveWeight: 0, includedInAverage: false }]])
    );

    expect(rows[0].overall).toMatchObject({ state: 'computed', value: 6 });
    expect(rows[0].completeness).toMatchObject({ state: 'computed', value: 6 });
  });
});

/**
 * Fixture constants and builders for the baseline-mode excluded conversion
 * matrix: a three-student class where Carol's only observation (`t_002`) falls
 * outside the derived baseline (`dk_algebra::t_001`), so her aggregate metrics
 * take the observed-evidence excluded conversion in baseline mode.
 */

const CLASS_ID = 'c_001';
const ASSIGNMENT_ID = 'a_001';
const DEFINITION_KEY = 'dk_algebra';

/** Alice's completeness on the baseline task `t_001`. */
const ALICE_BASELINE_COMPLETENESS = 4;

/** Carol's observed completeness on the outside-baseline task `t_002`. */
const CAROL_OUTSIDE_COMPLETENESS = 3;

/** Carol's observed accuracy on the outside-baseline task `t_002`. */
const CAROL_OUTSIDE_ACCURACY = 3;

/** Explicit `E` assessment entry (the analyser input's known-error variant). */
const ASSESSMENT_FAILED_ENTRY = {
  score: 'E',
  reasoning: 'Assessment failed.',
  error: { stage: 'assessment', code: 'ASSESSMENT_FAILED' },
} as const;

/** Options controlling the conversion-matrix fixture shape. */
interface OutsideStudentFixtureOptions {
  /** Carol's `t_002` submission item — her only observation. */
  carolItem: ReturnType<typeof createSubmissionItem>;
  /** Live task weighting for `t_002` (defaults to 1). */
  taskTwoWeighting?: number;
  /** Add a roster student whose only submission item is absent from the live partial. */
  includeDroppedItemStudent?: boolean;
}

/**
 * Build a submission item whose three criterion assessments all carry the
 * assessment-failed `E` cause.
 *
 * @param {string} taskId - The item's task identifier.
 * @returns {ReturnType<typeof createSubmissionItem>} The all-error item.
 */
function createAllErrorItem(taskId: string): ReturnType<typeof createSubmissionItem> {
  const item = createSubmissionItem(taskId);
  return {
    ...item,
    assessments: Object.fromEntries(
      ['completeness', 'accuracy', 'spag'].map((criterion) => [criterion, ASSESSMENT_FAILED_ENTRY])
    ),
  } as unknown as ReturnType<typeof createSubmissionItem>;
}

/**
 * Build the baseline-mode analysis input for the conversion matrix.
 *
 * Alice attempts both tasks, Bob only `t_001`, so the derived pool is
 * `['s_001', 's_002']` and the baseline is `dk_algebra::t_001`. Carol's only
 * observation (`t_002`) falls entirely outside the baseline.
 *
 * @param {OutsideStudentFixtureOptions} options - Fixture overrides.
 * @returns {AveragingAnalyserInput} The baseline-mode analysis input.
 */
function buildBaselineModeInput(options: OutsideStudentFixtureOptions): AveragingAnalyserInput {
  const submissions = [
    createSubmission('s_001', 'Alice', ASSIGNMENT_ID, {
      t_001: createSubmissionItem('t_001', {
        completeness: { score: ALICE_BASELINE_COMPLETENESS },
        accuracy: { score: 4 },
        spag: { score: 5 },
      }),
      t_002: createSubmissionItem('t_002', { completeness: { score: 2 } }),
    }),
    createSubmission('s_002', 'Bob', ASSIGNMENT_ID, {
      t_001: createSubmissionItem('t_001', { completeness: { score: 5 } }),
    }),
    createSubmission('s_003', 'Carol', ASSIGNMENT_ID, { t_002: options.carolItem }),
  ];
  const rosterStudentIds = ['s_001', 's_002', 's_003'];
  if (options.includeDroppedItemStudent) {
    rosterStudentIds.push('s_004');
    submissions.push(
      createSubmission('s_004', 'Dave', ASSIGNMENT_ID, {
        t_missing: createSubmissionItem('t_missing', {
          completeness: { score: CAROL_OUTSIDE_COMPLETENESS },
        }),
      })
    );
  }

  return buildInput(
    [
      {
        classId: CLASS_ID,
        className: 'Baseline Class',
        studentIds: rosterStudentIds,
        assignments: [
          createAssignmentPartial({
            assignmentId: ASSIGNMENT_ID,
            definitionKey: DEFINITION_KEY,
            submissions,
          }),
        ],
      },
    ],
    {
      filter: { classIds: [CLASS_ID], analysisMode: 'topDecileBaseline' },
      assignmentDefinitionPartials: [
        createDefinitionPartial({
          definitionKey: DEFINITION_KEY,
          tasks: [
            createTaskPartial('t_001'),
            createTaskPartial('t_002', options.taskTwoWeighting ?? 1),
          ],
        }),
      ],
    }
  );
}

/**
 * Return the per-student row for the requested student, failing loudly when
 * the analyser produced no row for them.
 *
 * @param {ReturnType<AveragingAnalyser['analyse']>[number]} result - The analysed class result.
 * @param {string} studentId - The student id to locate.
 * @returns {ReturnType<AveragingAnalyser['analyse']>[number]['perStudent'][number]} The student's row.
 */
function findStudentRow(
  result: ReturnType<AveragingAnalyser['analyse']>[number],
  studentId: string
) {
  const studentRow = result.perStudent.find((row) => row.studentId === studentId);
  if (!studentRow) {
    throw new Error(`conversion-matrix fixture: row for ${studentId} is missing from the result`);
  }
  return studentRow;
}

describe('baseline-mode excluded conversion (student entirely outside the baseline)', () => {
  it('converts computed criteria to excluded preserving the resolved totalDataPoints', () => {
    const input = buildBaselineModeInput({
      carolItem: createSubmissionItem('t_002', {
        completeness: { score: CAROL_OUTSIDE_COMPLETENESS },
      }),
    });

    const [result] = new AveragingAnalyser().analyse(input);
    const carol = findStudentRow(result, 's_003');

    // The observed evidence is preserved: one observed data point converts,
    // the criteria without observed evidence stay error and are never
    // converted, and the composite converges on excluded.
    expectMetricResultStateAware(carol.completeness, {
      state: 'excluded',
      totalDataPoints: 1,
    });
    expectMetricResultStateAware(carol.accuracy, {
      state: 'error',
      totalWeight: 0,
      totalDataPoints: 0,
    });
    expectMetricResultStateAware(carol.spag, {
      state: 'error',
      totalWeight: 0,
      totalDataPoints: 0,
    });
    expectMetricResultStateAware(carol.overall, { state: 'excluded', totalDataPoints: 1 });
  });

  it('converts notAttempted criteria to excluded preserving the resolved totalDataPoints', () => {
    const input = buildBaselineModeInput({
      carolItem: createSubmissionItem('t_002', { completeness: { score: 'N' } }),
    });

    const [result] = new AveragingAnalyser().analyse(input);
    const carol = findStudentRow(result, 's_003');

    expectMetricResultStateAware(carol.completeness, {
      state: 'excluded',
      totalDataPoints: 1,
    });
    expectMetricResultStateAware(carol.overall, { state: 'excluded', totalDataPoints: 1 });
  });

  it('leaves an already-excluded zero-weight rollup untouched', () => {
    const input = buildBaselineModeInput({
      carolItem: createSubmissionItem('t_002', {
        completeness: { score: CAROL_OUTSIDE_COMPLETENESS },
      }),
      taskTwoWeighting: 0,
    });

    const [result] = new AveragingAnalyser().analyse(input);
    const carol = findStudentRow(result, 's_003');

    // The zero-weight cause survives: the conversion never launders an
    // existing excluded rollup, and the observed data point count is kept.
    expectMetricResultStateAware(carol.completeness, {
      state: 'excluded',
      totalDataPoints: 1,
    });
    expectMetricResultStateAware(carol.overall, { state: 'excluded', totalDataPoints: 1 });
  });

  it('keeps an all-error student in the error state', () => {
    const input = buildBaselineModeInput({ carolItem: createAllErrorItem('t_002') });

    const [result] = new AveragingAnalyser().analyse(input);
    const carol = findStudentRow(result, 's_003');

    // No excluded result is synthesised without observed non-error evidence.
    expectMetricResultStateAware(carol.completeness, {
      state: 'error',
      totalWeight: 0,
      totalDataPoints: 0,
    });
    expectMetricResultStateAware(carol.accuracy, {
      state: 'error',
      totalWeight: 0,
      totalDataPoints: 0,
    });
    expectMetricResultStateAware(carol.spag, {
      state: 'error',
      totalWeight: 0,
      totalDataPoints: 0,
    });
    expectMetricResultStateAware(carol.overall, {
      state: 'error',
      totalWeight: 0,
      totalDataPoints: 0,
    });
  });

  it('keeps the studentAccums fallback path for a student with no per-(student, task) accumulators', () => {
    const input = buildBaselineModeInput({
      carolItem: createSubmissionItem('t_002', {
        completeness: { score: CAROL_OUTSIDE_COMPLETENESS },
      }),
      includeDroppedItemStudent: true,
    });

    const [result] = new AveragingAnalyser().analyse(input);

    // Dave's only submission item is absent from the live partial, so no
    // per-(student, task) accumulator exists and today's absolute-mode
    // fallback path resolves his row to error metrics.
    const dave = findStudentRow(result, 's_004');
    expectMetricResultStateAware(dave.completeness, {
      state: 'error',
      totalWeight: 0,
      totalDataPoints: 0,
    });
    expectMetricResultStateAware(dave.accuracy, {
      state: 'error',
      totalWeight: 0,
      totalDataPoints: 0,
    });
    expectMetricResultStateAware(dave.spag, { state: 'error', totalWeight: 0, totalDataPoints: 0 });
    expectMetricResultStateAware(dave.overall, {
      state: 'error',
      totalWeight: 0,
      totalDataPoints: 0,
    });
  });

  it('derives the overall composite from the converted criteria with totalDataPoints summed', () => {
    const input = buildBaselineModeInput({
      carolItem: createSubmissionItem('t_002', {
        completeness: { score: CAROL_OUTSIDE_COMPLETENESS },
        accuracy: { score: CAROL_OUTSIDE_ACCURACY },
      }),
    });

    const [result] = new AveragingAnalyser().analyse(input);
    const carol = findStudentRow(result, 's_003');

    // Both observed criteria convert (one data point each) and the composite's
    // resolved count is their sum; the criterion without observed evidence
    // stays error.
    expectMetricResultStateAware(carol.completeness, {
      state: 'excluded',
      totalDataPoints: 1,
    });
    expectMetricResultStateAware(carol.accuracy, { state: 'excluded', totalDataPoints: 1 });
    expectMetricResultStateAware(carol.spag, {
      state: 'error',
      totalWeight: 0,
      totalDataPoints: 0,
    });
    expectMetricResultStateAware(carol.overall, { state: 'excluded', totalDataPoints: 2 });
  });
});
