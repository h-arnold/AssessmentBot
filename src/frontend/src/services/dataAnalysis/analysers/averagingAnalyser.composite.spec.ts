import { describe, expect, it } from 'vitest';
import {
  createComputedMetricResult,
  createErrorMetricResult,
  createNotAttemptedMetricResult,
} from '../../../test/dataAnalysis/fixtures';
import { FLOAT_TOLERANCE } from '../../../test/dataAnalysis/averagingAnalyserAssertions';
import { computeOverallComposite } from './averagingAnalyser.composite';

const STANDARD_WEIGHTS = { completeness: 0.4, accuracy: 0.4, spag: 0.2 };
const EXPECTED_ZERO_WEIGHT_EVIDENCE_VALUE = 3;
const WEIGHTS_WITH_ZERO_SPAG = { completeness: 0.4, accuracy: 0.4, spag: 0 };
const WEIGHTS_WITH_ZERO_COMPLETENESS = { completeness: 0, accuracy: 0.5, spag: 0.5 };

describe('overall composite criterion-weight boundaries', () => {
  it('ignores an unweighted computed criterion when all weighted criteria are errors', () => {
    const result = computeOverallComposite(
      createErrorMetricResult(),
      createErrorMetricResult(),
      createComputedMetricResult(),
      WEIGHTS_WITH_ZERO_SPAG
    );

    expect(result).toMatchObject({ state: 'error', value: 'E' });
  });

  it('ignores an unweighted positive-weight N when all weighted criteria are errors', () => {
    const result = computeOverallComposite(
      createNotAttemptedMetricResult({ totalWeight: 1, totalDataPoints: 1 }),
      createErrorMetricResult(),
      createErrorMetricResult(),
      WEIGHTS_WITH_ZERO_COMPLETENESS
    );

    expect(result).toMatchObject({ state: 'error', value: 'E' });
  });

  it('retains zero-effective-weight numeric and N evidence in a computed total', () => {
    const result = computeOverallComposite(
      createComputedMetricResult({
        value: 3,
        totalWeight: 10,
        applicableDataPoints: 2,
        totalDataPoints: 2,
      }),
      createComputedMetricResult({
        value: 8,
        totalWeight: 0,
        applicableDataPoints: 1,
        totalDataPoints: 2,
      }),
      createNotAttemptedMetricResult({ totalWeight: 0, totalDataPoints: 1 }),
      STANDARD_WEIGHTS
    );

    expect(result).toMatchObject({
      state: 'computed',
      totalWeight: 10,
      applicableDataPoints: 2,
      totalDataPoints: 5,
    });
    expect(result.value).toBeCloseTo(EXPECTED_ZERO_WEIGHT_EVIDENCE_VALUE, FLOAT_TOLERANCE);
  });

  it('retains zero-configured criterion evidence without adding it to contributions', () => {
    const result = computeOverallComposite(
      createComputedMetricResult({
        value: 10,
        totalWeight: 2,
        applicableDataPoints: 2,
        totalDataPoints: 2,
      }),
      createComputedMetricResult({
        value: 4,
        totalWeight: 3,
        applicableDataPoints: 3,
        totalDataPoints: 3,
      }),
      createNotAttemptedMetricResult({ totalWeight: 4, totalDataPoints: 5 }),
      WEIGHTS_WITH_ZERO_COMPLETENESS
    );

    expect(result).toMatchObject({
      state: 'computed',
      value: 4,
      totalWeight: 3,
      applicableDataPoints: 3,
      totalDataPoints: 10,
    });
  });
});
