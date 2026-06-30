import { describe, it, expect } from 'vitest';
import { AveragingAnalyser } from './averagingAnalyser';
import {
  buildInput,
  createAssignmentPartial,
  createDefinitionPartial,
  createSubmission,
  createSubmissionItem,
  createTaskPartial,
} from '../../../test/dataAnalysis/fixtures';
import { expectMetricResultStateAware } from '../../../test/dataAnalysis/averagingAnalyserAssertions';
import type { MetricResultType } from '../../../test/dataAnalysis/averagingAnalyserAssertions';

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
 * @returns {MetricResultType} The completeness metric from the analyser output.
 */
function runAccumToMetricViaAnalyse(parameters: {
  hasNumeric: boolean;
  hasN: boolean;
}): MetricResultType {
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
  return results[0].perClass.completeness as unknown as MetricResultType;
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
    const result = student.completeness as unknown as MetricResultType;

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
    expectMetricResultStateAware(student.completeness as unknown as MetricResultType, {
      state: 'notAttempted',
      totalWeight: 0,
      totalDataPoints: 1,
    });
    expectMetricResultStateAware(student.accuracy as unknown as MetricResultType, {
      state: 'notAttempted',
      totalWeight: 0,
      totalDataPoints: 1,
    });
    expectMetricResultStateAware(student.spag as unknown as MetricResultType, {
      state: 'notAttempted',
      totalWeight: 0,
      totalDataPoints: 1,
    });
    // Overall has no numeric scores → notAttempted (nCount > 0 for all criteria)
    expectMetricResultStateAware(student.overall as unknown as MetricResultType, {
      state: 'notAttempted',
      totalWeight: 0,
      totalDataPoints: 1,
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
    expectMetricResultStateAware(student.completeness as unknown as MetricResultType, {
      state: 'computed',
      value: 4,
      totalWeight: 1,
      applicableDataPoints: 1,
      totalDataPoints: 1,
    });

    // Accuracy has 'N' only → notAttempted
    expectMetricResultStateAware(student.accuracy as unknown as MetricResultType, {
      state: 'notAttempted',
      totalWeight: 0,
      totalDataPoints: 1,
    });

    // SPaG has 'N' only → notAttempted
    expectMetricResultStateAware(student.spag as unknown as MetricResultType, {
      state: 'notAttempted',
      totalWeight: 0,
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
      expectMetricResultStateAware(
        results[0].perClass.completeness as unknown as MetricResultType,
        {
          state: 'error',
          totalWeight: 0,
          totalDataPoints: 0,
        }
      );
      expectMetricResultStateAware(results[0].perClass.accuracy as unknown as MetricResultType, {
        state: 'error',
        totalWeight: 0,
        totalDataPoints: 0,
      });
      expectMetricResultStateAware(results[0].perClass.spag as unknown as MetricResultType, {
        state: 'error',
        totalWeight: 0,
        totalDataPoints: 0,
      });
      expectMetricResultStateAware(results[0].perClass.overall as unknown as MetricResultType, {
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
      expectMetricResultStateAware(
        results[0].perClass.completeness as unknown as MetricResultType,
        {
          state: 'error',
          totalWeight: 0,
          totalDataPoints: 0,
        }
      );
      expectMetricResultStateAware(results[0].perClass.accuracy as unknown as MetricResultType, {
        state: 'error',
        totalWeight: 0,
        totalDataPoints: 0,
      });
      expectMetricResultStateAware(results[0].perClass.spag as unknown as MetricResultType, {
        state: 'error',
        totalWeight: 0,
        totalDataPoints: 0,
      });
      expectMetricResultStateAware(results[0].perClass.overall as unknown as MetricResultType, {
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
      expectMetricResultStateAware(student.completeness as unknown as MetricResultType, {
        state: 'computed',
        value: 3,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });
      // accuracy: value = 4, weight = 1 → computed
      expectMetricResultStateAware(student.accuracy as unknown as MetricResultType, {
        state: 'computed',
        value: 4,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });
      // spag: 'N' → not contributing, applicableDataPoints = 0, totalDataPoints still 1 → notAttempted
      // This will FAIL in the Red phase (current code produces value: null)
      expectMetricResultStateAware(student.spag as unknown as MetricResultType, {
        state: 'notAttempted',
        totalWeight: 0,
        totalDataPoints: 1,
      });
      // overall: spag excluded from denominator
      // overall = (0.4*3 + 0.4*4) / (0.4 + 0.4) = (1.2 + 1.6) / 0.8 = 3.5 → computed
      expectMetricResultStateAware(student.overall as unknown as MetricResultType, {
        state: 'computed',
        value: 3.5,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
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
      // accuracy: value = (6*4)/6 = 4, totalWeight = 6 → computed
      expectMetricResultStateAware(
        results[0].perStudent[0].accuracy as unknown as MetricResultType,
        {
          state: 'computed',
          value: 4,
          totalWeight: 6,
          applicableDataPoints: 1,
          totalDataPoints: 1,
        }
      );
      expectMetricResultStateAware(
        results[0].perStudent[0].overall as unknown as MetricResultType,
        {
          state: 'computed',
          value: 4,
          totalWeight: 6,
          applicableDataPoints: 1,
          totalDataPoints: 1,
        }
      );
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
      expectMetricResultStateAware(results[0].perClass.accuracy as unknown as MetricResultType, {
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
      expectMetricResultStateAware(results[0].perClass.accuracy as unknown as MetricResultType, {
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
              tasks: [{ id: 't_001', taskWeighting: preFetchedTaskWeighting }],
            }),
          ],
        }
      );

      const analyser = new AveragingAnalyser();
      const results = analyser.analyse(input);

      expect(results).toHaveLength(1);
      expectMetricResultStateAware(results[0].perClass.accuracy as unknown as MetricResultType, {
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
      expectMetricResultStateAware(results[0].perClass.accuracy as unknown as MetricResultType, {
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
      expectMetricResultStateAware(results[0].perClass.accuracy as unknown as MetricResultType, {
        state: 'computed',
        value: 4,
        totalWeight: 2,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });
    });
  });
});
