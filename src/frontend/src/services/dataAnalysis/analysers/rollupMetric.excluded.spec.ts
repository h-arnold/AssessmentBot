import { describe, expect, it } from 'vitest';
import { rollupMetric } from './rollupMetric';
import {
  createComputedMetricResult,
  createErrorMetricResult,
  createExcludedMetricResult,
  createNotAttemptedMetricResult,
} from '../../../test/dataAnalysis/fixtures';

describe('rollupMetric excluded precedence', () => {
  it.each([
    [['error', 'error', 'error'], 'error'],
    [['error', 'error', 'notAttempted'], 'notAttempted'],
    [['error', 'error', 'excluded'], 'excluded'],
    [['error', 'excluded', 'computed'], 'computed'],
  ] as const)('resolves %s precedence to %s', (states, expected) => {
    const metrics = states.map((state) => {
      if (state === 'error') return createErrorMetricResult();
      if (state === 'notAttempted') return createNotAttemptedMetricResult({ totalWeight: 1 });
      if (state === 'excluded') return createExcludedMetricResult();
      return createComputedMetricResult({ value: 7 });
    });
    expect(rollupMetric(metrics, 'completeness').state).toBe(expected);
  });

  it('ignores a zero-weight numeric display result in a positive aggregate', () => {
    const result = rollupMetric(
      [
        createComputedMetricResult({ value: 2, totalWeight: 1 }),
        createComputedMetricResult({ value: 10, totalWeight: 0 }),
      ],
      'accuracy'
    );
    expect(result).toMatchObject({ state: 'computed', value: 2, totalWeight: 1 });
  });

  it('resolves an all-zero observed set to excluded rather than error', () => {
    const result = rollupMetric(
      [
        createComputedMetricResult({ value: 10, totalWeight: 0 }),
        createNotAttemptedMetricResult({ totalWeight: 0 }),
      ],
      'completeness'
    );
    expect(result).toMatchObject({ state: 'excluded', value: null, totalWeight: 0 });
  });
});
