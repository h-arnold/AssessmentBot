/** Tests for per-class rollup behaviour in the averaging analyser. */
import { describe, it, expect } from 'vitest';
import { AveragingAnalyser } from './averagingAnalyser';
import type { MetricResult } from '../dataAnalysis.zod';
import {
  buildInput,
  createAssignmentPartial,
  createSubmission,
  createSubmissionItem,
  createTaskPartial,
} from '../../../test/dataAnalysis/fixtures';
import { expectMetricResultStateAware } from '../../../test/dataAnalysis/averagingAnalyserAssertions';

describe('per-class rollup unification', () => {
  it('verifies rollupAccumulators is exported from averagingAnalyser.rows for reuse in per-class rollup', async () => {
    // Structural test: the per-class rollup in analyseClass must use the same
    // rollupAccumulators helper as buildPerStudentRows and buildPerTaskRows.
    // This eliminates the dual-path fallback (CRITICAL-2).
    //
    // In RED phase this fails because rollupAccumulators is currently private.
    // GREEN phase exports it, making the per-class path structurally identical
    // to the per-student and per-task paths.
    const rowsModule = (await import('./averagingAnalyser.rows')) as {
      rollupAccumulators?: (...arguments_: unknown[]) => unknown;
    };
    expect(typeof rowsModule.rollupAccumulators).toBe('function');
  });

  it('produces consistent per-class results via the unified rollup path', () => {
    // Regression check: once analyseClass uses rollupAccumulators for the
    // per-class rollup, the output must remain correct. This test exercises
    // a class with populated per-student-task data to verify the single path.
    const assignment = createAssignmentPartial({
      assignmentId: 'a_001',
      definitionKey: 'dk_algebra',
      tasks: [createTaskPartial('t_001')],
      submissions: [
        createSubmission('s_001', 'Alice', 'a_001', {
          t_001: createSubmissionItem('t_001', {
            completeness: { score: 3 },
            accuracy: { score: 4 },
            spag: { score: 5 },
          }),
        }),
        createSubmission('s_002', 'Bob', 'a_001', {
          t_001: createSubmissionItem('t_001', {
            completeness: { score: 5 },
            accuracy: { score: 5 },
            spag: { score: 5 },
          }),
        }),
      ],
    });
    const input = buildInput([
      {
        classId: 'c_001',
        studentIds: ['s_001', 's_002'],
        assignments: [assignment],
      },
    ]);

    const analyser = new AveragingAnalyser();
    const results = analyser.analyse(input);

    expect(results).toHaveLength(1);

    // Per-class completeness: (3+5)/2 = 4
    expectMetricResultStateAware(results[0].perClass.completeness as unknown as MetricResult, {
      state: 'computed',
      value: 4,
      totalWeight: 2,
      applicableDataPoints: 2,
      totalDataPoints: 2,
    });

    // Per-class accuracy: (4+5)/2 = 4.5
    expectMetricResultStateAware(results[0].perClass.accuracy as unknown as MetricResult, {
      state: 'computed',
      value: 4.5,
      totalWeight: 2,
      applicableDataPoints: 2,
      totalDataPoints: 2,
    });

    // Per-class spag: (5+5)/2 = 5
    expectMetricResultStateAware(results[0].perClass.spag as unknown as MetricResult, {
      state: 'computed',
      value: 5,
      totalWeight: 2,
      applicableDataPoints: 2,
      totalDataPoints: 2,
    });

    // Per-class overall: Alice(0.4*3 + 0.4*4 + 0.2*5 = 3.8), Bob(5), avg(3.8+5)/2 = 4.4
    // Metadata summed across computed criteria per CRITICAL-3 (sum not Math.max):
    // totalWeight: 2(completeness)+2(accuracy)+2(spag) = 6
    expectMetricResultStateAware(results[0].perClass.overall as unknown as MetricResult, {
      state: 'computed',
      value: 4.4,
      totalWeight: 6,
      applicableDataPoints: 6,
      totalDataPoints: 6,
    });
  });
});
