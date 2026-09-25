/**
 * Direct unit tests for the shared metric display-text formatter.
 *
 * @see metricDisplayText.ts
 */

import { describe, expect, it } from 'vitest';
import type { MetricResult } from '../dataAnalysis.zod';
import {
  createComputedMetricResult,
  createNotAttemptedMetricResult,
  createErrorMetricResult,
  createExcludedMetricResult,
} from '../../../test/dataAnalysis/fixtures';
import { formatMetricDisplayText } from './metricDisplayText';

/** Precision used by the formatter tests. */
const DISPLAY_PRECISION = 2;

/** Computed fixture value used to verify precision handling. */
const COMPUTED_VALUE = 3.14;

/** Expected computed text at {@link DISPLAY_PRECISION}. */
const COMPUTED_TEXT = '3.14';

describe('formatMetricDisplayText', () => {
  it('formats computed values with the requested precision', () => {
    expect(
      formatMetricDisplayText(
        createComputedMetricResult({ value: COMPUTED_VALUE }),
        DISPLAY_PRECISION
      )
    ).toBe(COMPUTED_TEXT);
  });

  it('uses the shared literal text for N and E states', () => {
    expect(formatMetricDisplayText(createNotAttemptedMetricResult(), DISPLAY_PRECISION)).toBe('N');
    expect(formatMetricDisplayText(createErrorMetricResult(), DISPLAY_PRECISION)).toBe('E');
  });

  it('formats the aggregate-only excluded state as Excluded', () => {
    expect(formatMetricDisplayText(createExcludedMetricResult(), DISPLAY_PRECISION)).toBe(
      'Excluded'
    );
  });

  it('fails fast for an impossible unknown metric state', () => {
    const invalidMetric = {
      state: 'unknown',
      value: 0,
    } as unknown as MetricResult;

    expect(() => formatMetricDisplayText(invalidMetric, DISPLAY_PRECISION)).toThrow();
  });
});
