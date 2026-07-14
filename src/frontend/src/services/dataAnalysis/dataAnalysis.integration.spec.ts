import { describe, it, expect } from 'vitest';
import { DataAnalysisService } from './dataAnalysisService';
import { DataAnalysisResponseSchema, type MetricResult } from './dataAnalysis.zod';
import {
  buildInput,
  createAssignmentPartial,
  createSubmission,
  createSubmissionItem,
  createTaskPartial,
  createDefinitionPartial,
} from '../../test/dataAnalysis/fixtures';
import {
  expectMetricResultStateAware,
  FLOAT_TOLERANCE,
} from '../../test/dataAnalysis/averagingAnalyserAssertions';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Assert that the overall metric matches expectations when only one criterion
 * (accuracy) is computed — the overall value should equal accuracy.value
 * because completeness and spag are error (and thus excluded from the composite).
 *
 * @param {MetricResult} overall - The overall MetricResult to check.
 * @param {MetricResult} accuracy - The accuracy MetricResult to compare against.
 */
function expectOverallEqualsAccuracy(overall: MetricResult, accuracy: MetricResult): void {
  expect(overall.state).toBe('computed');
  if (accuracy.state === 'computed') {
    const ov = overall as Extract<MetricResult, { state: 'computed' }>;
    expect(ov.value).toBeCloseTo(accuracy.value, FLOAT_TOLERANCE);
    expect(ov.totalWeight).toBeCloseTo(accuracy.totalWeight, FLOAT_TOLERANCE);
    expect(ov.applicableDataPoints).toBe(accuracy.applicableDataPoints);
    expect(ov.totalDataPoints).toBe(accuracy.totalDataPoints);
  }
}

/**
 * Assert that a MetricResult is in the error state.
 *
 * @param {MetricResult} actual - The actual MetricResult to check.
 * @param {number} totalWeight - The expected totalWeight value.
 * @param {number} totalDataPoints - The expected totalDataPoints value.
 */
function expectErrorMetric(
  actual: MetricResult,
  totalWeight: number,
  totalDataPoints: number
): void {
  expectMetricResultStateAware(actual, {
    state: 'error',
    totalWeight,
    totalDataPoints,
  });
}

// ---------------------------------------------------------------------------
// Integration tests — core assignment-weighting scenarios
// ---------------------------------------------------------------------------

describe('DataAnalysisService integration', () => {
  describe('live assignment weighting wins over embedded value', () => {
    it('uses assignmentWeighting from live partials (2) instead of stale embedded value (0)', () => {
      const input = buildInput(
        [
          {
            classId: 'c_001',
            className: 'Test Class',
            studentIds: ['s_001'],
            assignments: [
              createAssignmentPartial({
                assignmentId: 'a_001',
                definitionKey: 'dk_algebra',
                assignmentWeighting: 0,
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
              assignmentWeighting: 2,
              tasks: [createTaskPartial('t_001', 1)],
            }),
          ],
        }
      );

      const service = new DataAnalysisService();
      const results = service.analyse(input);

      expect(() => DataAnalysisResponseSchema.parse(results)).not.toThrow();

      expect(results).toHaveLength(1);
      expect(results[0].classId).toBe('c_001');

      const accuracyExpected = {
        state: 'computed' as const,
        value: 4,
        totalWeight: 2,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      };

      expect(results[0].perStudent).toHaveLength(1);
      expectMetricResultStateAware(results[0].perStudent[0].accuracy, accuracyExpected);

      expectErrorMetric(results[0].perStudent[0].completeness, 0, 0);
      expectErrorMetric(results[0].perStudent[0].spag, 0, 0);

      expectOverallEqualsAccuracy(
        results[0].perStudent[0].overall,
        results[0].perStudent[0].accuracy
      );

      expect(results[0].perTask).toHaveLength(1);
      expectMetricResultStateAware(results[0].perTask[0].accuracy, accuracyExpected);

      expectMetricResultStateAware(results[0].perClass.accuracy, accuracyExpected);
    });
  });

  describe('live task weightings affect outcomes', () => {
    it('applies different task weightings from live partials proportionally', () => {
      const input = buildInput(
        [
          {
            classId: 'c_001',
            className: 'Test Class',
            studentIds: ['s_001'],
            assignments: [
              createAssignmentPartial({
                assignmentId: 'a_001',
                definitionKey: 'dk_algebra',
                assignmentWeighting: 1,
                tasks: [createTaskPartial('t_001', 1), createTaskPartial('t_002', 1)],
                submissions: [
                  createSubmission('s_001', 'Alice', 'a_001', {
                    t_001: createSubmissionItem('t_001', { accuracy: { score: 4 } }),
                    t_002: createSubmissionItem('t_002', { accuracy: { score: 2 } }),
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
              assignmentWeighting: 1,
              tasks: [
                { taskId: 't_001', taskWeighting: 3, taskTitle: null },
                { taskId: 't_002', taskWeighting: 0.5, taskTitle: null },
              ],
            }),
          ],
        }
      );

      const service = new DataAnalysisService();
      const results = service.analyse(input);

      expect(() => DataAnalysisResponseSchema.parse(results)).not.toThrow();
      expect(results).toHaveLength(1);

      const studentAccuracy = results[0].perStudent[0].accuracy;

      expectMetricResultStateAware(studentAccuracy, {
        state: 'computed',
        value: 13 / 3.5,
        totalWeight: 3.5,
        applicableDataPoints: 2,
        totalDataPoints: 2,
      });

      expect(results[0].perTask).toHaveLength(2);

      const t001Task = results[0].perTask.find((t) => t.taskId === 't_001')!;
      expect(t001Task).toBeDefined();
      expectMetricResultStateAware(t001Task.accuracy, {
        state: 'computed',
        value: 4,
        totalWeight: 3,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });

      const t002Task = results[0].perTask.find((t) => t.taskId === 't_002')!;
      expect(t002Task).toBeDefined();
      expectMetricResultStateAware(t002Task.accuracy, {
        state: 'computed',
        value: 2,
        totalWeight: 0.5,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });
    });
  });

  describe('missing definition key is skipped gracefully', () => {
    it('returns empty result when assignmentDefinitionPartials lacks the required definition key', () => {
      const input = buildInput(
        [
          {
            classId: 'c_001',
            className: 'Test Class',
            studentIds: ['s_001'],
            assignments: [
              createAssignmentPartial({
                assignmentId: 'a_001',
                definitionKey: 'dk_missing',
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
          assignmentDefinitionPartials: [],
        }
      );

      const service = new DataAnalysisService();
      const results = service.analyse(input);

      // The missing definition key degrades per-assignment: the assignment
      // is skipped and the rest of the class analysis completes with no data.
      expect(results).toHaveLength(1);
      expect(results[0].classId).toBe('c_001');
      expect(results[0].perStudent).toHaveLength(0);
      expect(results[0].perTask).toHaveLength(0);

      // All per-class metrics are error because no data was accumulated
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
  });

  describe('null assignmentWeighting in partials defaults to 1', () => {
    it('defaults assignmentWeighting to 1 when live partial has null', () => {
      const input = buildInput(
        [
          {
            classId: 'c_001',
            className: 'Test Class',
            studentIds: ['s_001'],
            assignments: [
              createAssignmentPartial({
                assignmentId: 'a_001',
                definitionKey: 'dk_algebra',
                assignmentWeighting: null,
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
              assignmentWeighting: null,
              tasks: [createTaskPartial('t_001', 1)],
            }),
          ],
        }
      );

      const service = new DataAnalysisService();
      const results = service.analyse(input);

      expect(() => DataAnalysisResponseSchema.parse(results)).not.toThrow();
      expect(results).toHaveLength(1);

      expectMetricResultStateAware(results[0].perStudent[0].accuracy, {
        state: 'computed',
        value: 4,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });
    });
  });
});
