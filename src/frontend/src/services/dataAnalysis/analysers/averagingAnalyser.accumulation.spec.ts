import { describe, it, expect } from 'vitest';
import { AveragingAnalyser } from './averagingAnalyser';
import {
  buildInput,
  createAssignmentPartial,
  createComputedMetricResult,
  createDefinitionPartial,
  createErrorMetricResult,
  createNotAttemptedMetricResult,
  createSubmission,
  createSubmissionItem,
  createTaskPartial,
} from '../../../test/dataAnalysis/fixtures';
import type { MetricResult } from '../dataAnalysis.zod';
import { expectMetricResultStateAware } from '../../../test/dataAnalysis/averagingAnalyserAssertions';
import {
  accumulateCriterion,
  accumulateMetricsToTarget,
  computeOverall,
  processSubmissionItem,
  processItemAssessments,
} from './averagingAnalyser.criterionAccumulation';
import { computeOverallComposite } from './averagingAnalyser.accumulation';

// ---------------------------------------------------------------------------
// Helper: run accumToMetric through the analyser's build path
// ---------------------------------------------------------------------------

/**
 * Build a minimal input that produces an accumulator with the desired state.
 *
 * In the Green phase, tests will import `accumToMetric` and `createAccumulator`
 * directly. For the Red phase, we construct inputs that exercise the analyser
 * to produce specific accumulator states, then read the output.
 *
 * @param {{ hasNumeric: boolean; hasN: boolean }} parameters - Accumulator state configuration.
 * @param {boolean} parameters.hasNumeric - Whether to include a numeric score.
 * @param {boolean} parameters.hasN - Whether to include an 'N' score.
 * @returns {MetricResult} The completeness metric from the analyser output.
 */
function runAccumToMetricViaAnalyse(parameters: {
  hasNumeric: boolean;
  hasN: boolean;
}): MetricResult {
  const items: Record<string, unknown> = {};

  if (parameters.hasNumeric) {
    items.t_001 = createSubmissionItem('t_001', {
      completeness: { score: 5 },
    });
  } else if (parameters.hasN) {
    items.t_001 = createSubmissionItem('t_001', {
      completeness: { score: 'N' },
    });
  }

  const input = buildInput([
    {
      classId: 'c_001',
      studentIds: ['s_001'],
      assignments: [
        createAssignmentPartial({
          assignmentId: 'a_001',
          definitionKey: 'dk_001',
          tasks: [createTaskPartial('t_001')],
          assignmentWeighting: 1,
          submissions: [
            createSubmission(
              's_001',
              'Alice',
              'a_001',
              items as Record<string, ReturnType<typeof createSubmissionItem>>
            ),
          ],
        }),
      ],
    },
  ]);

  const analyser = new AveragingAnalyser();
  const results = analyser.analyse(input);
  return results[0].perClass.completeness as unknown as MetricResult;
}

// ---------------------------------------------------------------------------
// Direct accumToMetric tests — test the conversion function in isolation
// ---------------------------------------------------------------------------

describe('accumToMetric', () => {
  it('returns computed when applicableDataPoints > 0', () => {
    // Provide one numeric score → applicableDataPoints = 1 > 0 → computed
    const result = runAccumToMetricViaAnalyse({ hasNumeric: true, hasN: false });

    expect(result.state).toBe('computed');
    // Note: this will FAIL in the Red phase because the current code still
    // produces { value: number | null } without a `state` field.
  });

  it('returns notAttempted (value: "N") when nCount > 0 and applicableDataPoints === 0', () => {
    const result = runAccumToMetricViaAnalyse({ hasNumeric: false, hasN: true });

    // Expect state: 'notAttempted' with value: 'N'
    // This will FAIL in the Red phase.
    expect(result.state).toBe('notAttempted');
    if (result.state === 'notAttempted') {
      expect(result.value).toBe('N');
    }
  });

  it('returns error (value: "E") when nCount === 0 and applicableDataPoints === 0', () => {
    const result = runAccumToMetricViaAnalyse({ hasNumeric: false, hasN: false });

    // Expect state: 'error' with value: 'E'
    // This will FAIL in the Red phase.
    expect(result.state).toBe('error');
    if (result.state === 'error') {
      expect(result.value).toBe('E');
    }
  });

  it('mixed (numeric + "N") produces computed', () => {
    // This test requires BOTH a numeric and 'N' score.
    // We need two submission items: one with numeric, one with 'N'.
    // Use the analyser directly with a multi-item submission.
    const input = buildInput([
      {
        classId: 'c_001',
        studentIds: ['s_001'],
        assignments: [
          createAssignmentPartial({
            assignmentId: 'a_001',
            definitionKey: 'dk_001',
            tasks: [createTaskPartial('t_001'), createTaskPartial('t_002')],
            submissions: [
              createSubmission('s_001', 'Alice', 'a_001', {
                t_001: createSubmissionItem('t_001', {
                  completeness: { score: 3 },
                }),
                t_002: createSubmissionItem('t_002', {
                  completeness: { score: 'N' },
                }),
              }),
            ],
          }),
        ],
      },
    ]);

    const analyser = new AveragingAnalyser();
    const results = analyser.analyse(input);
    const student = results[0].perStudent[0];
    const result = student.completeness as unknown as MetricResult;

    // Mixed: numeric score and 'N' → computed
    // This will FAIL in the Red phase.
    expect(result.state).toBe('computed');
  });
});

// ---------------------------------------------------------------------------
// accumulateMetricsToTarget nCount tracking
// ---------------------------------------------------------------------------

describe('accumulateMetricsToTarget nCount tracking', () => {
  it('tracks nCount correctly when "N" is encountered for completeness', () => {
    const input = buildInput([
      {
        classId: 'c_001',
        studentIds: ['s_001'],
        assignments: [
          createAssignmentPartial({
            assignmentId: 'a_001',
            definitionKey: 'dk_001',
            tasks: [createTaskPartial('t_001')],
            submissions: [
              createSubmission('s_001', 'Alice', 'a_001', {
                t_001: createSubmissionItem('t_001', {
                  completeness: { score: 'N' },
                  accuracy: { score: 'N' },
                  spag: { score: 'N' },
                }),
              }),
            ],
          }),
        ],
      },
    ]);

    const analyser = new AveragingAnalyser();
    const results = analyser.analyse(input);

    expect(results).toHaveLength(1);
    const student = results[0].perStudent[0];

    // All criteria have 'N' → notAttempted state (when nCount > 0)
    // This will FAIL in the Red phase (current code produces value: null)
    expectMetricResultStateAware(student.completeness as unknown as MetricResult, {
      state: 'notAttempted',
      totalWeight: 1,
      totalDataPoints: 1,
    });
    expectMetricResultStateAware(student.accuracy as unknown as MetricResult, {
      state: 'notAttempted',
      totalWeight: 1,
      totalDataPoints: 1,
    });
    expectMetricResultStateAware(student.spag as unknown as MetricResult, {
      state: 'notAttempted',
      totalWeight: 1,
      totalDataPoints: 1,
    });
    // Overall has no numeric scores → notAttempted (nCount > 0 for all criteria)
    // Metadata summed across criteria per CRITICAL-3 (sum not Math.max):
    // completeness.totalDataPoints(1) + accuracy.totalDataPoints(1) + spag.totalDataPoints(1) = 3
    expectMetricResultStateAware(student.overall as unknown as MetricResult, {
      state: 'notAttempted',
      totalWeight: 0,
      totalDataPoints: 3,
    });
  });

  it('tracks nCount correctly when scores are mixed numeric and "N"', () => {
    const input = buildInput([
      {
        classId: 'c_001',
        studentIds: ['s_001'],
        assignments: [
          createAssignmentPartial({
            assignmentId: 'a_001',
            definitionKey: 'dk_001',
            tasks: [createTaskPartial('t_001')],
            submissions: [
              createSubmission('s_001', 'Alice', 'a_001', {
                t_001: createSubmissionItem('t_001', {
                  completeness: { score: 4 },
                  accuracy: { score: 'N' },
                  spag: { score: 'N' },
                }),
              }),
            ],
          }),
        ],
      },
    ]);

    const analyser = new AveragingAnalyser();
    const results = analyser.analyse(input);

    expect(results).toHaveLength(1);
    const student = results[0].perStudent[0];

    // Completeness has numeric score → computed
    // This will FAIL in the Red phase
    expectMetricResultStateAware(student.completeness as unknown as MetricResult, {
      state: 'computed',
      value: 4,
      totalWeight: 1,
      applicableDataPoints: 1,
      totalDataPoints: 1,
    });

    // Accuracy has 'N' only → notAttempted
    expectMetricResultStateAware(student.accuracy as unknown as MetricResult, {
      state: 'notAttempted',
      totalWeight: 1,
      totalDataPoints: 1,
    });

    // SPaG has 'N' only → notAttempted
    expectMetricResultStateAware(student.spag as unknown as MetricResult, {
      state: 'notAttempted',
      totalWeight: 1,
      totalDataPoints: 1,
    });
  });
});

// ---------------------------------------------------------------------------
// Existing accumulation tests — updated for the new MetricResult shape
// ---------------------------------------------------------------------------

describe('AveragingAnalyser', () => {
  describe('analyse — accumulation', () => {
    it('skips assignment when assignmentWeighting is 0', () => {
      const input = buildInput([
        {
          classId: 'c_001',
          studentIds: ['s_001'],
          assignments: [
            createAssignmentPartial({
              assignmentId: 'a_001',
              definitionKey: 'dk_algebra',
              tasks: [createTaskPartial('t_001')],
              assignmentWeighting: 0,
              submissions: [
                createSubmission('s_001', 'Alice', 'a_001', {
                  t_001: createSubmissionItem('t_001', {
                    completeness: { score: 5 },
                    accuracy: { score: 5 },
                    spag: { score: 5 },
                  }),
                }),
              ],
            }),
          ],
        },
      ]);

      const analyser = new AveragingAnalyser();
      const results = analyser.analyse(input);

      expect(results).toHaveLength(1);
      // Zero-weight assignment → no data points → error state
      // This will FAIL in the Red phase (current code produces value: null)
      expectMetricResultStateAware(results[0].perClass.completeness as unknown as MetricResult, {
        state: 'error',
        totalWeight: 0,
        totalDataPoints: 0,
      });
      expectMetricResultStateAware(results[0].perClass.accuracy as unknown as MetricResult, {
        state: 'error',
        totalWeight: 0,
        totalDataPoints: 0,
      });
      expectMetricResultStateAware(results[0].perClass.spag as unknown as MetricResult, {
        state: 'error',
        totalWeight: 0,
        totalDataPoints: 0,
      });
      expectMetricResultStateAware(results[0].perClass.overall as unknown as MetricResult, {
        state: 'error',
        totalWeight: 0,
        totalDataPoints: 0,
      });
    });

    it('skips task when taskWeighting is 0', () => {
      const input = buildInput([
        {
          classId: 'c_001',
          studentIds: ['s_001'],
          assignments: [
            createAssignmentPartial({
              assignmentId: 'a_001',
              definitionKey: 'dk_algebra',
              tasks: [createTaskPartial('t_001', 0)],
              submissions: [
                createSubmission('s_001', 'Alice', 'a_001', {
                  t_001: createSubmissionItem('t_001', {
                    completeness: { score: 5 },
                    accuracy: { score: 5 },
                    spag: { score: 5 },
                  }),
                }),
              ],
            }),
          ],
        },
      ]);

      const analyser = new AveragingAnalyser();
      const results = analyser.analyse(input);

      expect(results).toHaveLength(1);
      // Zero-weight task → no data points → error state
      // This will FAIL in the Red phase
      expectMetricResultStateAware(results[0].perClass.completeness as unknown as MetricResult, {
        state: 'error',
        totalWeight: 0,
        totalDataPoints: 0,
      });
      expectMetricResultStateAware(results[0].perClass.accuracy as unknown as MetricResult, {
        state: 'error',
        totalWeight: 0,
        totalDataPoints: 0,
      });
      expectMetricResultStateAware(results[0].perClass.spag as unknown as MetricResult, {
        state: 'error',
        totalWeight: 0,
        totalDataPoints: 0,
      });
      expectMetricResultStateAware(results[0].perClass.overall as unknown as MetricResult, {
        state: 'error',
        totalWeight: 0,
        totalDataPoints: 0,
      });
    });

    it('excludes SPaG N from spag weighted sum and adjusts overall denominator', () => {
      const input = buildInput([
        {
          classId: 'c_001',
          studentIds: ['s_001'],
          assignments: [
            createAssignmentPartial({
              assignmentId: 'a_001',
              definitionKey: 'dk_algebra',
              tasks: [createTaskPartial('t_001')],
              submissions: [
                createSubmission('s_001', 'Alice', 'a_001', {
                  t_001: createSubmissionItem('t_001', {
                    completeness: { score: 3 },
                    accuracy: { score: 4 },
                    spag: { score: 'N' },
                  }),
                }),
              ],
            }),
          ],
        },
      ]);

      const analyser = new AveragingAnalyser();
      const results = analyser.analyse(input);

      expect(results).toHaveLength(1);

      const student = results[0].perStudent[0];

      // completeness: value = 3, weight = 1 → computed
      expectMetricResultStateAware(student.completeness as unknown as MetricResult, {
        state: 'computed',
        value: 3,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });
      // accuracy: value = 4, weight = 1 → computed
      expectMetricResultStateAware(student.accuracy as unknown as MetricResult, {
        state: 'computed',
        value: 4,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });
      // spag: 'N' → not contributing, applicableDataPoints = 0, totalDataPoints still 1 → notAttempted
      // This will FAIL in the Red phase (current code produces value: null)
      // totalWeight is now accumulated for 'N' scores (was 0 before Bug #1 fix)
      expectMetricResultStateAware(student.spag as unknown as MetricResult, {
        state: 'notAttempted',
        totalWeight: 1,
        totalDataPoints: 1,
      });
      // overall: spag excluded from denominator
      // overall = (0.4*3 + 0.4*4) / (0.4 + 0.4) = (1.2 + 1.6) / 0.8 = 3.5 → computed
      // Metadata summed across computed criteria per CRITICAL-3 (sum not Math.max):
      // totalWeight: 1(completeness) + 1(accuracy) = 2
      // applicableDataPoints: 1 + 1 = 2
      // totalDataPoints: 1 + 1 = 2
      expectMetricResultStateAware(student.overall as unknown as MetricResult, {
        state: 'computed',
        value: 3.5,
        totalWeight: 2,
        applicableDataPoints: 2,
        totalDataPoints: 2,
      });
    });

    it('uses product of assignmentWeighting and taskWeighting as per-data-point weight', () => {
      const doubleAssignmentWeighting = 2;
      const tripleTaskWeighting = 3;
      const input = buildInput([
        {
          classId: 'c_001',
          studentIds: ['s_001'],
          assignments: [
            createAssignmentPartial({
              assignmentId: 'a_001',
              definitionKey: 'dk_algebra',
              assignmentWeighting: doubleAssignmentWeighting,
              tasks: [createTaskPartial('t_001', tripleTaskWeighting)],
              submissions: [
                createSubmission('s_001', 'Alice', 'a_001', {
                  t_001: createSubmissionItem('t_001', {
                    completeness: { score: 4 },
                    accuracy: { score: 4 },
                    spag: { score: 4 },
                  }),
                }),
              ],
            }),
          ],
        },
      ]);

      const analyser = new AveragingAnalyser();
      const results = analyser.analyse(input);

      expect(results).toHaveLength(1);
      // accuracy: value = (6*4)/6 = 4, totalWeight = 6 → computed
      expectMetricResultStateAware(results[0].perStudent[0].accuracy as unknown as MetricResult, {
        state: 'computed',
        value: 4,
        totalWeight: 6,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });
      // overall: all three criteria computed with weight 6 each
      // overall = (0.4*4 + 0.4*4 + 0.2*4) / 1.0 = 4.0
      // totalWeight = 6 + 6 + 6 = 18
      expectMetricResultStateAware(results[0].perStudent[0].overall as unknown as MetricResult, {
        state: 'computed',
        value: 4,
        totalWeight: 18,
        applicableDataPoints: 3,
        totalDataPoints: 3,
      });
    });

    it('resolves taskWeighting from pre-fetched assignmentDefinitionPartials cross-reference', () => {
      const preFetchedTaskWeighting = 5;
      const input = buildInput(
        [
          {
            classId: 'c_001',
            studentIds: ['s_001'],
            assignments: [
              createAssignmentPartial({
                assignmentId: 'a_001',
                definitionKey: 'dk_algebra',
                tasks: [createTaskPartial('t_001', 1)],
                submissions: [
                  createSubmission('s_001', 'Alice', 'a_001', {
                    t_001: createSubmissionItem('t_001', { accuracy: { score: 4 } }),
                  }),
                ],
              }),
            ],
          },
        ],
        {
          assignmentDefinitionPartials: [
            createDefinitionPartial({
              definitionKey: 'dk_algebra',
              tasks: [createTaskPartial('t_001', preFetchedTaskWeighting)],
            }),
          ],
        }
      );

      const analyser = new AveragingAnalyser();
      const results = analyser.analyse(input);

      expect(results).toHaveLength(1);
      // totalWeight = assignmentWeighting(1) × taskWeighting(5 from pre-fetched) = 5
      expectMetricResultStateAware(results[0].perClass.accuracy as unknown as MetricResult, {
        state: 'computed',
        value: 4,
        totalWeight: 5,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });
    });

    it('falls back to taskWeighting 1 when no matching task entry is found in assignmentDefinitionPartials', () => {
      const input = buildInput(
        [
          {
            classId: 'c_001',
            studentIds: ['s_001'],
            assignments: [
              createAssignmentPartial({
                assignmentId: 'a_001',
                definitionKey: 'dk_algebra',
                tasks: [createTaskPartial('t_001')],
                submissions: [
                  createSubmission('s_001', 'Alice', 'a_001', {
                    t_001: createSubmissionItem('t_001', { accuracy: { score: 4 } }),
                  }),
                ],
              }),
            ],
          },
        ],
        {
          assignmentDefinitionPartials: [
            createDefinitionPartial({
              definitionKey: 'dk_algebra',
              tasks: [],
            }),
          ],
        }
      );

      const analyser = new AveragingAnalyser();
      const results = analyser.analyse(input);

      expect(results).toHaveLength(1);
      // Fallback taskWeighting = 1 → totalWeight = 1 × 1 = 1
      expectMetricResultStateAware(results[0].perClass.accuracy as unknown as MetricResult, {
        state: 'computed',
        value: 4,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });
    });

    it('resolveTaskWeight uses the pre-built Map (O(1) lookup)', () => {
      const preFetchedTaskWeighting = 5;
      const input = buildInput(
        [
          {
            classId: 'c_001',
            studentIds: ['s_001'],
            assignments: [
              createAssignmentPartial({
                assignmentId: 'a_001',
                definitionKey: 'dk_algebra',
                tasks: [createTaskPartial('t_001', 1)],
                submissions: [
                  createSubmission('s_001', 'Alice', 'a_001', {
                    t_001: createSubmissionItem('t_001', { accuracy: { score: 4 } }),
                  }),
                ],
              }),
            ],
          },
        ],
        {
          assignmentDefinitionPartials: [
            createDefinitionPartial({
              definitionKey: 'dk_algebra',
              tasks: [{ taskId: 't_001', taskWeighting: preFetchedTaskWeighting, taskTitle: null }],
            }),
          ],
        }
      );

      const analyser = new AveragingAnalyser();
      const results = analyser.analyse(input);

      expect(results).toHaveLength(1);
      expectMetricResultStateAware(results[0].perClass.accuracy as unknown as MetricResult, {
        state: 'computed',
        value: 4,
        totalWeight: 5,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });
    });

    it('resolveTaskWeight falls back to 1 when the definitionKey is not in the pre-fetched partials', () => {
      const unusedTaskWeighting = 5;
      const input = buildInput(
        [
          {
            classId: 'c_001',
            studentIds: ['s_001'],
            assignments: [
              createAssignmentPartial({
                assignmentId: 'a_001',
                definitionKey: 'dk_algebra',
                tasks: [createTaskPartial('t_001', unusedTaskWeighting)],
                submissions: [
                  createSubmission('s_001', 'Alice', 'a_001', {
                    t_001: createSubmissionItem('t_001', { accuracy: { score: 4 } }),
                  }),
                ],
              }),
            ],
          },
        ],
        {
          assignmentDefinitionPartials: [
            createDefinitionPartial({
              definitionKey: 'dk_geometry',
              tasks: [createTaskPartial('t_001', unusedTaskWeighting)],
            }),
          ],
        }
      );

      const analyser = new AveragingAnalyser();
      const results = analyser.analyse(input);

      expect(results).toHaveLength(1);
      expectMetricResultStateAware(results[0].perClass.accuracy as unknown as MetricResult, {
        state: 'computed',
        value: 4,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });
    });

    it('treats null assignmentWeighting as 1', () => {
      const taskWeightingForNullTest = 2;
      const input = buildInput([
        {
          classId: 'c_001',
          studentIds: ['s_001'],
          assignments: [
            createAssignmentPartial({
              assignmentId: 'a_001',
              definitionKey: 'dk_algebra',
              assignmentWeighting: null,
              tasks: [createTaskPartial('t_001', taskWeightingForNullTest)],
              submissions: [
                createSubmission('s_001', 'Alice', 'a_001', {
                  t_001: createSubmissionItem('t_001', { accuracy: { score: 4 } }),
                }),
              ],
            }),
          ],
        },
      ]);

      const analyser = new AveragingAnalyser();
      const results = analyser.analyse(input);

      expect(results).toHaveLength(1);
      // assignmentWeighting=1 (null→1), taskWeighting=2 → totalWeight=2
      expectMetricResultStateAware(results[0].perClass.accuracy as unknown as MetricResult, {
        state: 'computed',
        value: 4,
        totalWeight: 2,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });
    });
  });
});

// ---------------------------------------------------------------------------
// computeOverallComposite metadata aggregation semantics (coverage gap 3)
// ---------------------------------------------------------------------------

describe('computeOverallComposite metadata aggregation', () => {
  it('sums metadata across computed criteria (not Math.max)', () => {
    const result = computeOverallComposite(
      createComputedMetricResult({
        value: 3,
        totalWeight: 10,
        applicableDataPoints: 2,
        totalDataPoints: 2,
      }),
      createComputedMetricResult({
        value: 4,
        totalWeight: 20,
        applicableDataPoints: 3,
        totalDataPoints: 3,
      }),
      createComputedMetricResult({
        value: 5,
        totalWeight: 5,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      }),
      { completeness: 0.4, accuracy: 0.4, spag: 0.2 }
    );

    expect(result.state).toBe('computed');
    if (result.state === 'computed') {
      // (0.4*3 + 0.4*4 + 0.2*5) / 1.0 = (1.2 + 1.6 + 1.0) / 1.0 = 3.8
      expect(result.value).toBeCloseTo(3.8, 10);
      // totalWeight: 10 + 20 + 5 = 35 (NOT Math.max which would give 20)
      expect(result.totalWeight).toBe(35);
      // applicableDataPoints: 2 + 3 + 1 = 6 (NOT Math.max which would give 3)
      expect(result.applicableDataPoints).toBe(6);
      // totalDataPoints: 2 + 3 + 1 = 6 (NOT Math.max which would give 3)
      expect(result.totalDataPoints).toBe(6);
    }
  });

  it('only computed entries contribute to metadata sum when mixed with notAttempted', () => {
    const result = computeOverallComposite(
      createComputedMetricResult({
        value: 3,
        totalWeight: 10,
        applicableDataPoints: 2,
        totalDataPoints: 2,
      }),
      createNotAttemptedMetricResult({ totalWeight: 0, totalDataPoints: 1 }),
      createNotAttemptedMetricResult({ totalWeight: 0, totalDataPoints: 1 }),
      { completeness: 0.4, accuracy: 0.4, spag: 0.2 }
    );

    expect(result.state).toBe('computed');
    if (result.state === 'computed') {
      // Only completeness contributes: (0.4 * 3) / 0.4 = 3
      expect(result.value).toBeCloseTo(3, 10);
      expect(result.totalWeight).toBe(10);
      expect(result.applicableDataPoints).toBe(2);
      expect(result.totalDataPoints).toBe(2);
    }
  });

  it('sums totalDataPoints across all three error criteria', () => {
    const result = computeOverallComposite(
      createErrorMetricResult({ totalDataPoints: 2 }),
      createErrorMetricResult({ totalDataPoints: 3 }),
      createErrorMetricResult({ totalDataPoints: 1 }),
      { completeness: 0.4, accuracy: 0.4, spag: 0.2 }
    );

    expect(result.state).toBe('error');
    if (result.state === 'error') {
      // totalWeight: 0 + 0 + 0 = 0 (all error criteria have totalWeight 0)
      expect(result.totalWeight).toBe(0);
      // applicableDataPoints: 0 + 0 + 0 = 0 (all error criteria have applicableDataPoints 0)
      expect(result.applicableDataPoints).toBe(0);
      // totalDataPoints: 2 + 3 + 1 = 6 (NOT Math.max which would give 3)
      expect(result.totalDataPoints).toBe(6);
    }
  });

  it('sums totalDataPoints across all three notAttempted criteria', () => {
    const result = computeOverallComposite(
      createNotAttemptedMetricResult({ totalDataPoints: 4 }),
      createNotAttemptedMetricResult({ totalDataPoints: 2 }),
      createNotAttemptedMetricResult({ totalDataPoints: 1 }),
      { completeness: 0.4, accuracy: 0.4, spag: 0.2 }
    );

    expect(result.state).toBe('notAttempted');
    if (result.state === 'notAttempted') {
      // totalWeight: 0 + 0 + 0 = 0 (all notAttempted criteria have totalWeight 0)
      expect(result.totalWeight).toBe(0);
      // applicableDataPoints: 0 + 0 + 0 = 0 (all notAttempted criteria have applicableDataPoints 0)
      expect(result.applicableDataPoints).toBe(0);
      // totalDataPoints: 4 + 2 + 1 = 7 (NOT Math.max which would give 4)
      expect(result.totalDataPoints).toBe(7);
    }
  });

  it('ensures applicableDataPoints never exceeds totalDataPoints in computed composite', () => {
    const result = computeOverallComposite(
      createComputedMetricResult({
        value: 5,
        totalWeight: 10,
        applicableDataPoints: 5,
        totalDataPoints: 10,
      }),
      createComputedMetricResult({
        value: 4,
        totalWeight: 10,
        applicableDataPoints: 8,
        totalDataPoints: 10,
      }),
      createComputedMetricResult({
        value: 3,
        totalWeight: 10,
        applicableDataPoints: 1,
        totalDataPoints: 10,
      }),
      { completeness: 0.4, accuracy: 0.4, spag: 0.2 }
    );

    expect(result.state).toBe('computed');
    if (result.state === 'computed') {
      expect(result.applicableDataPoints).toBeLessThanOrEqual(result.totalDataPoints);
    }

    // Boundary case: all criteria have equal applicableDataPoints and totalDataPoints
    const boundaryResult = computeOverallComposite(
      createComputedMetricResult({
        value: 5,
        totalWeight: 10,
        applicableDataPoints: 10,
        totalDataPoints: 10,
      }),
      createComputedMetricResult({
        value: 4,
        totalWeight: 10,
        applicableDataPoints: 10,
        totalDataPoints: 10,
      }),
      createComputedMetricResult({
        value: 3,
        totalWeight: 10,
        applicableDataPoints: 10,
        totalDataPoints: 10,
      }),
      { completeness: 0.4, accuracy: 0.4, spag: 0.2 }
    );
    expect(boundaryResult.state).toBe('computed');
    if (boundaryResult.state === 'computed') {
      expect(boundaryResult.applicableDataPoints).toBe(30);
      expect(boundaryResult.totalDataPoints).toBe(30);
      expect(boundaryResult.applicableDataPoints).toBeLessThanOrEqual(
        boundaryResult.totalDataPoints
      );
    }
  });
});

// ---------------------------------------------------------------------------
// criterionAccumulation module (MAJOR-4 decomposition)
// ---------------------------------------------------------------------------

describe('criterionAccumulation module (MAJOR-4 decomposition)', () => {
  it('exports expected functions', () => {
    // Import is now static since the module exists in GREEN phase
    expect(typeof accumulateCriterion).toBe('function');
    expect(typeof accumulateMetricsToTarget).toBe('function');
    expect(typeof computeOverall).toBe('function');
    expect(typeof processSubmissionItem).toBe('function');
    expect(typeof processItemAssessments).toBe('function');
  });
});
