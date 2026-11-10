/**
 * Baseline-mode behaviour of the averaging analyser.
 *
 * Pins the attempt-baseline specification's analyser handoff: aggregate
 * restriction to the baseline task set, per-task row flags that keep absolute
 * values, the `attemptBaseline` transparency block, mode-invariant
 * per-(student, task) evidence, per-class independence, all-accumulator rollup
 * scope in both modes, and the empty-intersection throw propagated by the
 * analyser.
 *
 * The counterpart absolute-mode pins live in `averagingAnalyser.absoluteMode.spec.ts`.
 */

import { describe, it, expect } from 'vitest';
import { AveragingAnalyser } from './averagingAnalyser';
import type { AveragingAnalyserInput, AnalysisMode } from '../dataAnalysis.zod';
import {
  buildInput,
  createAssignmentPartial,
  createSubmission,
  createSubmissionItem,
} from '@/test/dataAnalysis/fixtures';
import { expectMetricResultStateAware } from '@/test/dataAnalysis/averagingAnalyserAssertions';

const CLASS_ID = 'c_001';
const SECOND_CLASS_ID = 'c_002';
const ASSIGNMENT_ID = 'a_001';
const SECOND_ASSIGNMENT_ID = 'a_101';
const DEFINITION_KEY = 'dk_algebra';
const SECOND_DEFINITION_KEY = 'dk_beta';
const TASK_KEY_ONE = 'dk_algebra::t_001';
const SECOND_TASK_KEY_ONE = 'dk_beta::v_001';

/** Alice's completeness on the baseline task `t_001`. */
const ALICE_BASELINE_COMPLETENESS = 4;

/** Alice's completeness on the outside-baseline task `t_002`. */
const ALICE_OUTSIDE_COMPLETENESS = 2;

/** Bob's completeness on the baseline task `t_001`. */
const BOB_BASELINE_COMPLETENESS = 5;

/** Carol's completeness on the outside-baseline task `t_002`. */
const CAROL_OUTSIDE_COMPLETENESS = 1;

/** Completeness of the submission from the student outside the roster. */
const OUTSIDE_ROSTER_COMPLETENESS = 3;

/** Observation count behind the baseline mean that includes the outside-roster submission. */
const BASELINE_WITH_OUTSIDE_ROSTER_OBSERVATION_COUNT = 3;

/** Mean baseline completeness over Alice, Bob and the outside-roster student. */
const EXPECTED_BASELINE_CLASS_MEAN_WITH_OUTSIDE_ROSTER =
  (ALICE_BASELINE_COMPLETENESS + BOB_BASELINE_COMPLETENESS + OUTSIDE_ROSTER_COMPLETENESS) /
  BASELINE_WITH_OUTSIDE_ROSTER_OBSERVATION_COUNT;

/** Observation count behind the absolute mean that includes the outside-roster submission. */
const ABSOLUTE_WITH_OUTSIDE_ROSTER_OBSERVATION_COUNT = 5;

/** Mean absolute completeness over all five observed (student, task) pairs. */
const EXPECTED_ABSOLUTE_CLASS_MEAN_WITH_OUTSIDE_ROSTER =
  (ALICE_BASELINE_COMPLETENESS +
    ALICE_OUTSIDE_COMPLETENESS +
    BOB_BASELINE_COMPLETENESS +
    CAROL_OUTSIDE_COMPLETENESS +
    OUTSIDE_ROSTER_COMPLETENESS) /
  ABSOLUTE_WITH_OUTSIDE_ROSTER_OBSERVATION_COUNT;

/** Observation count behind the core fixture's baseline mean (Alice and Bob on `t_001`). */
const CORE_BASELINE_OBSERVATION_COUNT = 2;

/** Mean baseline completeness over Alice's and Bob's baseline observations. */
const EXPECTED_BASELINE_CLASS_MEAN =
  (ALICE_BASELINE_COMPLETENESS + BOB_BASELINE_COMPLETENESS) / CORE_BASELINE_OBSERVATION_COUNT;

/** Observation count behind the core fixture's absolute mean. */
const CORE_ABSOLUTE_OBSERVATION_COUNT = 4;

/** Mean absolute completeness over the core fixture's four observations. */
const EXPECTED_ABSOLUTE_CLASS_MEAN =
  (ALICE_BASELINE_COMPLETENESS +
    ALICE_OUTSIDE_COMPLETENESS +
    BOB_BASELINE_COMPLETENESS +
    CAROL_OUTSIDE_COMPLETENESS) /
  CORE_ABSOLUTE_OBSERVATION_COUNT;

/** Observation count behind Alice's absolute two-task mean. */
const ALICE_ABSOLUTE_OBSERVATION_COUNT = 2;

/** Observation count behind the outside-baseline task's absolute mean (Alice and Carol on `t_002`). */
const OUTSIDE_TASK_ABSOLUTE_OBSERVATION_COUNT = 2;

/** Number of class results the two-class fixture produces. */
const EXPECTED_CLASS_RESULT_COUNT = 2;

/** Options controlling which optional fixture regions are included. */
interface ClassroomFixtureOptions {
  /** Include a submission from a student outside the class roster. */
  includeOutsideRosterSubmission?: boolean;
  /** Include a second class whose pool and baseline are derived independently. */
  includeSecondClass?: boolean;
  /** Replace the core submissions with two candidates attempting disjoint tasks. */
  useDisjointAttemptSets?: boolean;
}

/**
 * Build the core class submissions: two pool candidates and one student whose
 * only observation falls outside the derived baseline.
 *
 * @returns {ReturnType<typeof createSubmission>[]} The submission fixtures.
 */
function buildCoreSubmissions() {
  return [
    createSubmission('s_001', 'Alice', ASSIGNMENT_ID, {
      t_001: createSubmissionItem('t_001', {
        completeness: { score: ALICE_BASELINE_COMPLETENESS },
        accuracy: { score: 4 },
        spag: { score: 5 },
      }),
      t_002: createSubmissionItem('t_002', {
        completeness: { score: ALICE_OUTSIDE_COMPLETENESS },
      }),
    }),
    createSubmission('s_002', 'Bob', ASSIGNMENT_ID, {
      t_001: createSubmissionItem('t_001', {
        completeness: { score: BOB_BASELINE_COMPLETENESS },
      }),
    }),
    createSubmission('s_003', 'Carol', ASSIGNMENT_ID, {
      t_002: createSubmissionItem('t_002', {
        completeness: { score: CAROL_OUTSIDE_COMPLETENESS },
      }),
    }),
  ];
}

/**
 * Build submissions where the two pool candidates attempt different tasks, so
 * the pool intersection is empty.
 *
 * @returns {ReturnType<typeof createSubmission>[]} The disjoint submission fixtures.
 */
function buildDisjointSubmissions() {
  return [
    createSubmission('s_001', 'Alice', ASSIGNMENT_ID, {
      t_001: createSubmissionItem('t_001', {
        completeness: { score: ALICE_BASELINE_COMPLETENESS },
      }),
    }),
    createSubmission('s_002', 'Bob', ASSIGNMENT_ID, {
      t_002: createSubmissionItem('t_002', { completeness: { score: 3 } }),
    }),
  ];
}

/**
 * Build the second class's submissions: two pool candidates and one student
 * whose only observation falls outside that class's derived baseline.
 *
 * @returns {ReturnType<typeof createSubmission>[]} The second-class submission fixtures.
 */
function buildSecondClassSubmissions() {
  return [
    createSubmission('u_001', 'Una', SECOND_ASSIGNMENT_ID, {
      v_001: createSubmissionItem('v_001', { completeness: { score: 4 } }),
      v_002: createSubmissionItem('v_002', { completeness: { score: 3 } }),
    }),
    createSubmission('u_002', 'Umar', SECOND_ASSIGNMENT_ID, {
      v_001: createSubmissionItem('v_001', { completeness: { score: 5 } }),
    }),
    createSubmission('u_003', 'Ulla', SECOND_ASSIGNMENT_ID, {
      v_002: createSubmissionItem('v_002', { completeness: { score: 2 } }),
    }),
  ];
}

/**
 * Build the analysis input for this suite's hand-built classroom fixture.
 *
 * The core class has three roster students; Alice attempts both tasks, Bob
 * only `t_001` and Carol only `t_002`, so the derived pool is
 * `['s_001', 's_002']` and the baseline is `dk_algebra::t_001`.
 *
 * @param {AnalysisMode} analysisMode - The analysis mode under test.
 * @param {ClassroomFixtureOptions} [options] - Optional fixture regions.
 * @returns {AveragingAnalyserInput} The analysis input.
 */
function buildAnalysisInput(
  analysisMode: AnalysisMode,
  options: ClassroomFixtureOptions = {}
): AveragingAnalyserInput {
  const submissions = options.useDisjointAttemptSets
    ? buildDisjointSubmissions()
    : buildCoreSubmissions();
  if (options.includeOutsideRosterSubmission) {
    submissions.push(
      createSubmission('s_009', 'Oliver Outside', ASSIGNMENT_ID, {
        t_001: createSubmissionItem('t_001', {
          completeness: { score: OUTSIDE_ROSTER_COMPLETENESS },
        }),
      })
    );
  }

  const classOverrides = [
    {
      classId: CLASS_ID,
      className: 'Baseline Class',
      studentIds: ['s_001', 's_002', 's_003'],
      assignments: [
        createAssignmentPartial({
          assignmentId: ASSIGNMENT_ID,
          definitionKey: DEFINITION_KEY,
          submissions,
        }),
      ],
    },
  ];

  if (options.includeSecondClass) {
    classOverrides.push({
      classId: SECOND_CLASS_ID,
      className: 'Second Class',
      studentIds: ['u_001', 'u_002', 'u_003'],
      assignments: [
        createAssignmentPartial({
          assignmentId: SECOND_ASSIGNMENT_ID,
          definitionKey: SECOND_DEFINITION_KEY,
          submissions: buildSecondClassSubmissions(),
        }),
      ],
    });
  }

  return buildInput(classOverrides, {
    filter: {
      classIds: classOverrides.map((classOverride) => classOverride.classId),
      analysisMode,
    },
  });
}

describe('AveragingAnalyser', () => {
  describe('analyse — baseline mode', () => {
    it('restricts per-student aggregates to the baseline task set', () => {
      const absolute = new AveragingAnalyser().analyse(buildAnalysisInput('absolute'));
      const baseline = new AveragingAnalyser().analyse(buildAnalysisInput('topDecileBaseline'));

      // Alice's baseline aggregates come from t_001 only, not from both tasks.
      const baselineAlice = baseline[0].perStudent.find((row) => row.studentId === 's_001');
      expectMetricResultStateAware(baselineAlice!.completeness, {
        state: 'computed',
        value: ALICE_BASELINE_COMPLETENESS,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });

      // The absolute mode keeps today's two-task mean for the same input.
      const absoluteAlice = absolute[0].perStudent.find((row) => row.studentId === 's_001');
      expectMetricResultStateAware(absoluteAlice!.completeness, {
        state: 'computed',
        value:
          (ALICE_BASELINE_COMPLETENESS + ALICE_OUTSIDE_COMPLETENESS) /
          ALICE_ABSOLUTE_OBSERVATION_COUNT,
        totalWeight: 2,
        applicableDataPoints: 2,
        totalDataPoints: 2,
      });
    });

    it('restricts the per-class aggregate to the baseline task set', () => {
      const absolute = new AveragingAnalyser().analyse(buildAnalysisInput('absolute'));
      const baseline = new AveragingAnalyser().analyse(buildAnalysisInput('topDecileBaseline'));

      expectMetricResultStateAware(baseline[0].perClass.completeness, {
        state: 'computed',
        value: EXPECTED_BASELINE_CLASS_MEAN,
        totalWeight: 2,
        applicableDataPoints: 2,
        totalDataPoints: 2,
      });
      expectMetricResultStateAware(absolute[0].perClass.completeness, {
        state: 'computed',
        value: EXPECTED_ABSOLUTE_CLASS_MEAN,
        totalWeight: 4,
        applicableDataPoints: 4,
        totalDataPoints: 4,
      });
    });

    it('echoes topDecileBaseline and carries the attemptBaseline block', () => {
      const [result] = new AveragingAnalyser().analyse(buildAnalysisInput('topDecileBaseline'));

      expect(result.appliedAnalysisMode).toBe('topDecileBaseline');
      expect(result.attemptBaseline).toEqual({
        poolStudentIds: ['s_001', 's_002'],
        baselineTaskKeys: [TASK_KEY_ONE],
      });
    });

    it('marks per-task rows with baseline membership while keeping absolute values', () => {
      const [result] = new AveragingAnalyser().analyse(buildAnalysisInput('topDecileBaseline'));

      const baselineTaskRow = result.perTask.find((row) => row.taskId === 't_001');
      const outsideTaskRow = result.perTask.find((row) => row.taskId === 't_002');
      expect(baselineTaskRow?.includedInAttemptBaseline).toBe(true);
      expect(outsideTaskRow?.includedInAttemptBaseline).toBe(false);

      // Row values stay absolute in both modes: t_002 aggregates both of its
      // observers (Alice 2, Carol 1), so the row keeps the absolute mean.
      expectMetricResultStateAware(outsideTaskRow!.completeness, {
        state: 'computed',
        value:
          (ALICE_OUTSIDE_COMPLETENESS + CAROL_OUTSIDE_COMPLETENESS) /
          OUTSIDE_TASK_ABSOLUTE_OBSERVATION_COUNT,
        totalWeight: 2,
        applicableDataPoints: 2,
        totalDataPoints: 2,
      });
    });

    it('keeps perStudentTaskMetrics byte-identical across the two modes', () => {
      const absolute = new AveragingAnalyser().analyse(buildAnalysisInput('absolute'));
      const baseline = new AveragingAnalyser().analyse(buildAnalysisInput('topDecileBaseline'));

      // Baseline filtering restricts only the aggregation step, so the
      // heatmap-facing evidence is identical for the same input.
      expect(baseline[0].perStudentTaskMetrics).toEqual(absolute[0].perStudentTaskMetrics);
    });

    it('keeps all-accumulator rollup scope in both modes', () => {
      const options = { includeOutsideRosterSubmission: true };
      const absolute = new AveragingAnalyser().analyse(buildAnalysisInput('absolute', options));
      const baseline = new AveragingAnalyser().analyse(
        buildAnalysisInput('topDecileBaseline', options)
      );

      // Per-student rows keep every submitting student — including the
      // submission student id outside the roster — in both modes.
      const expectedStudentIds = ['s_001', 's_002', 's_003', 's_009'];
      expect(baseline[0].perStudent.map((row) => row.studentId)).toEqual(expectedStudentIds);
      expect(absolute[0].perStudent.map((row) => row.studentId)).toEqual(expectedStudentIds);

      // The per-class rollup keeps the outside-roster evidence in both modes;
      // only the task-key restriction differs.
      expectMetricResultStateAware(baseline[0].perClass.completeness, {
        state: 'computed',
        value: EXPECTED_BASELINE_CLASS_MEAN_WITH_OUTSIDE_ROSTER,
        totalWeight: 3,
        applicableDataPoints: 3,
        totalDataPoints: 3,
      });
      expectMetricResultStateAware(absolute[0].perClass.completeness, {
        state: 'computed',
        value: EXPECTED_ABSOLUTE_CLASS_MEAN_WITH_OUTSIDE_ROSTER,
        totalWeight: 5,
        applicableDataPoints: 5,
        totalDataPoints: 5,
      });

      // The pool is the only roster-scoped step: the outside-roster submitter
      // never enters it.
      expect(baseline[0].attemptBaseline?.poolStudentIds).toEqual(['s_001', 's_002']);
    });

    it('derives each class pool and baseline independently', () => {
      const results = new AveragingAnalyser().analyse(
        buildAnalysisInput('topDecileBaseline', { includeSecondClass: true })
      );

      expect(results).toHaveLength(EXPECTED_CLASS_RESULT_COUNT);
      const [first, second] = results;
      expect(first.classId).toBe(CLASS_ID);
      expect(first.attemptBaseline).toEqual({
        poolStudentIds: ['s_001', 's_002'],
        baselineTaskKeys: [TASK_KEY_ONE],
      });
      expect(second.classId).toBe(SECOND_CLASS_ID);
      expect(second.attemptBaseline).toEqual({
        poolStudentIds: ['u_001', 'u_002'],
        baselineTaskKeys: [SECOND_TASK_KEY_ONE],
      });

      // Each class marks its own outside-baseline task.
      expect(first.perTask.find((row) => row.taskId === 't_002')?.includedInAttemptBaseline).toBe(
        false
      );
      expect(second.perTask.find((row) => row.taskId === 'v_002')?.includedInAttemptBaseline).toBe(
        false
      );
    });

    it('throws a descriptive error when the pool attempt sets are disjoint', () => {
      const analyser = new AveragingAnalyser();

      expect(() => {
        return analyser.analyse(
          buildAnalysisInput('topDecileBaseline', { useDisjointAttemptSets: true })
        );
      }).toThrow(/c_001/);
    });
  });
});
