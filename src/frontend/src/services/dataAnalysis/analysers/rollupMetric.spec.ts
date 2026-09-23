import { describe, expect, it } from 'vitest';
import { rollupMetric, type RollupMetric } from './rollupMetric';
import {
  createComputedMetricResult,
  createErrorMetricResult,
  createNotAttemptedMetricResult,
} from '../../../test/dataAnalysis/fixtures';
import { FLOAT_TOLERANCE } from '../../../test/dataAnalysis/averagingAnalyserAssertions';

const CRITERIA: RollupMetric[] = ['completeness', 'accuracy', 'spag'];
const COMPUTED_VALUE = 4;
const COMPUTED_WEIGHT = 1;
const NOT_ATTEMPTED_WEIGHT = 2;
const NOT_ATTEMPTED_DATA_POINTS = 2;
const ERROR_DATA_POINTS = 3;
const COMPUTED_WEIGHTED_SUM = 13;
const COMPUTED_TOTAL_WEIGHT = 3;
const NOT_ATTEMPTED_WEIGHTED_SUM = 8;
const NOT_ATTEMPTED_TOTAL_WEIGHT = 5;
const SPAG_COMPUTED_VALUE = 4;

describe('rollupMetric established aggregation', () => {
  it.each(CRITERIA)('rolls up computed %s values with weighted metadata', (metric) => {
    const result = rollupMetric(
      [
        createComputedMetricResult({
          value: 3,
          totalWeight: 1,
          applicableDataPoints: 1,
          totalDataPoints: 1,
        }),
        createComputedMetricResult({
          value: 5,
          totalWeight: 2,
          applicableDataPoints: 2,
          totalDataPoints: 2,
        }),
      ],
      metric
    );
    expect(result).toMatchObject({
      state: 'computed',
      totalWeight: 3,
      applicableDataPoints: 3,
      totalDataPoints: 3,
    });
    expect(result.value).toBeCloseTo(
      COMPUTED_WEIGHTED_SUM / COMPUTED_TOTAL_WEIGHT,
      FLOAT_TOLERANCE
    );
  });

  it.each(CRITERIA)('returns notAttempted for all-notAttempted %s values', (metric) => {
    expect(
      rollupMetric(
        [
          createNotAttemptedMetricResult({ totalWeight: 1, totalDataPoints: 2 }),
          createNotAttemptedMetricResult({ totalWeight: 1, totalDataPoints: 3 }),
        ],
        metric
      )
    ).toMatchObject({ state: 'notAttempted', value: 'N' });
  });

  it.each(CRITERIA)('returns error for all-error %s values', (metric) => {
    expect(
      rollupMetric(
        [
          createErrorMetricResult({ totalDataPoints: 1 }),
          createErrorMetricResult({ totalDataPoints: 2 }),
        ],
        metric
      )
    ).toMatchObject({ state: 'error', value: 'E', totalDataPoints: 3 });
  });

  it('excludes errors when computed evidence exists', () => {
    const result = rollupMetric(
      [
        createComputedMetricResult({
          value: 5,
          totalWeight: 2,
          applicableDataPoints: 2,
          totalDataPoints: 2,
        }),
        createComputedMetricResult({
          value: 3,
          totalWeight: 1,
          applicableDataPoints: 1,
          totalDataPoints: 1,
        }),
        createErrorMetricResult({ totalDataPoints: 1 }),
      ],
      'completeness'
    );
    expect(result).toMatchObject({
      state: 'computed',
      totalWeight: 3,
      applicableDataPoints: 3,
      totalDataPoints: 3,
    });
    expect(result.value).toBeCloseTo(
      COMPUTED_WEIGHTED_SUM / COMPUTED_TOTAL_WEIGHT,
      FLOAT_TOLERANCE
    );
  });

  it.each(CRITERIA)('handles computed and notAttempted %s values', (metric) => {
    const result = rollupMetric(
      [
        createComputedMetricResult({
          value: 4,
          totalWeight: 2,
          applicableDataPoints: 2,
          totalDataPoints: 2,
        }),
        createNotAttemptedMetricResult({ totalWeight: 3, totalDataPoints: 2 }),
      ],
      metric
    );
    expect(result.state).toBe('computed');
    if (result.state === 'computed') {
      expect(result.value).toBeCloseTo(
        metric === 'spag'
          ? SPAG_COMPUTED_VALUE
          : NOT_ATTEMPTED_WEIGHTED_SUM / NOT_ATTEMPTED_TOTAL_WEIGHT,
        FLOAT_TOLERANCE
      );
      expect(result.totalWeight).toBe(
        metric === 'spag' ? COMPUTED_TOTAL_WEIGHT - COMPUTED_WEIGHT : NOT_ATTEMPTED_TOTAL_WEIGHT
      );
    }
  });

  it('preserves terminal notAttempted totalWeight and totalDataPoints for one sub-task', () => {
    const result = rollupMetric(
      [createNotAttemptedMetricResult({ totalWeight: 2, totalDataPoints: 3 })],
      'completeness'
    );

    expect(result).toMatchObject({
      state: 'notAttempted',
      value: 'N',
      totalWeight: 2,
      applicableDataPoints: 0,
      totalDataPoints: 3,
    });
  });

  it('sums computed, notAttempted, and error metadata while clamping applicable points', () => {
    const result = rollupMetric(
      [
        createComputedMetricResult({
          value: COMPUTED_VALUE,
          totalWeight: COMPUTED_WEIGHT,
          applicableDataPoints: 5,
          totalDataPoints: 1,
        }),
        createNotAttemptedMetricResult({
          totalWeight: NOT_ATTEMPTED_WEIGHT,
          totalDataPoints: NOT_ATTEMPTED_DATA_POINTS,
        }),
        createErrorMetricResult({ totalDataPoints: ERROR_DATA_POINTS }),
      ],
      'completeness'
    );

    expect(result).toMatchObject({
      state: 'computed',
      value: COMPUTED_VALUE / (COMPUTED_WEIGHT + NOT_ATTEMPTED_WEIGHT),
      totalWeight: COMPUTED_WEIGHT + NOT_ATTEMPTED_WEIGHT,
      applicableDataPoints: 3,
      totalDataPoints: 1 + NOT_ATTEMPTED_DATA_POINTS,
    });
  });

  it('throws when no sub-tasks are supplied', () => {
    expect(() => rollupMetric([], 'completeness')).toThrow();
  });
});
