/**
 * Tests for `resolveMetricTone` — pure tone resolver.
 *
 * @see SPEC_CLASS_PAGE_PREPARATION.md lines 246–298
 */

import { describe, it, expect } from 'vitest';
import type { MetricResult } from '../dataAnalysis.zod';
import {
  createComputedMetricResult,
  createNotAttemptedMetricResult,
  createErrorMetricResult,
} from '../../../test/dataAnalysis/fixtures';
import { resolveMetricTone } from './metricTone';
import type { MetricToneResolution } from './metricTone';

/** Value at the default range ceiling (upper bound of { lower: 0, upper: 5 }). */
const DEFAULT_RANGE_CEILING = 5;

describe('resolveMetricTone', () => {
  // -------------------------------------------------------------------------
  // Computed state — default range { lower: 0, upper: 5 }
  // -------------------------------------------------------------------------

  it('returns a dark-red gradient colour for a computed value at the range floor', () => {
    const metric: MetricResult = createComputedMetricResult({ value: 0 });

    const result: MetricToneResolution = resolveMetricTone(metric);

    expect(result).toStrictEqual({
      color: 'hsl(0.0, 70%, 34.0%)',
      cellStyle: {
        backgroundColor: 'hsl(0.0, 75%, 92%)',
        color: 'hsl(0.0, 70%, 32%)',
      },
      displayValue: 0,
      muted: false,
    });
  });

  it('returns a darker-red gradient colour for computed value 1 (default 0–5 range)', () => {
    const metric: MetricResult = createComputedMetricResult({ value: 1 });

    const result: MetricToneResolution = resolveMetricTone(metric);

    // t = (1 - 0) / 5 = 0.2 -> hue 120·0.2^1.5 ≈ 10.7, lightness 34 + 9·sin(0.2π) ≈ 39.3
    expect(result.color).toBe('hsl(10.7, 70%, 39.3%)');
    expect(result.cellStyle).toEqual({
      backgroundColor: 'hsl(10.7, 75%, 92%)',
      color: 'hsl(10.7, 70%, 32%)',
    });
    expect(result.displayValue).toBe(1);
    expect(result.muted).toBe(false);
  });

  it('returns an amber gradient colour for a computed value at the midpoint', () => {
    const metric: MetricResult = createComputedMetricResult({ value: 2.5 });

    const result: MetricToneResolution = resolveMetricTone(metric);

    // t = 0.5 -> hue 120·0.5^1.5 ≈ 42.4, lightness 34 + 9·sin(0.5π) = 43.0
    expect(result.color).toBe('hsl(42.4, 70%, 43.0%)');
    expect(result.cellStyle).toEqual({
      backgroundColor: 'hsl(42.4, 75%, 92%)',
      color: 'hsl(42.4, 70%, 32%)',
    });
  });

  it('returns a dark-green gradient colour for a computed value at the range ceiling', () => {
    const metric: MetricResult = createComputedMetricResult({ value: DEFAULT_RANGE_CEILING });

    const result: MetricToneResolution = resolveMetricTone(metric);

    // t = 1 -> hue 120, lightness 34 + 9·sin(π) = 34.0
    expect(result.color).toBe('hsl(120.0, 70%, 34.0%)');
    expect(result.cellStyle).toEqual({
      backgroundColor: 'hsl(120.0, 75%, 92%)',
      color: 'hsl(120.0, 70%, 32%)',
    });
    expect(result.displayValue).toBe(DEFAULT_RANGE_CEILING);
    expect(result.muted).toBe(false);
  });

  // -------------------------------------------------------------------------
  // NotAttempted state
  // -------------------------------------------------------------------------

  it('returns dark-grey colour with muted=true for notAttempted metric', () => {
    const metric: MetricResult = createNotAttemptedMetricResult();

    const result: MetricToneResolution = resolveMetricTone(metric);

    expect(result).toStrictEqual({
      color: '#434343',
      cellStyle: { backgroundColor: '#e8e8e8', color: '#434343' },
      displayValue: 'N',
      muted: true,
    });
  });

  // -------------------------------------------------------------------------
  // Error state
  // -------------------------------------------------------------------------

  it('returns default volcano colour for error metric', () => {
    const metric: MetricResult = createErrorMetricResult();

    const result: MetricToneResolution = resolveMetricTone(metric);

    expect(result).toStrictEqual({
      color: 'volcano',
      cellStyle: { backgroundColor: '#fff2e8', color: '#d4380d' },
      displayValue: 'E',
      muted: false,
    });
  });

  it('returns custom errorColor for error metric when supplied', () => {
    const metric: MetricResult = createErrorMetricResult();

    const result: MetricToneResolution = resolveMetricTone(metric, { lower: 0, upper: 5 }, 'red');

    expect(result).toStrictEqual({
      color: 'red',
      cellStyle: { backgroundColor: '#fff1f0', color: '#cf1322' },
      displayValue: 'E',
      muted: false,
    });
  });

  // -------------------------------------------------------------------------
  // Custom range { lower: 0, upper: 100 }
  // -------------------------------------------------------------------------

  it('returns a dark-red gradient colour for computed value 0 in a 0-100 range', () => {
    const metric: MetricResult = createComputedMetricResult({ value: 0 });

    const result: MetricToneResolution = resolveMetricTone(metric, { lower: 0, upper: 100 });

    expect(result.color).toBe('hsl(0.0, 70%, 34.0%)');
    expect(result.cellStyle).toEqual({
      backgroundColor: 'hsl(0.0, 75%, 92%)',
      color: 'hsl(0.0, 70%, 32%)',
    });
    expect(result.displayValue).toBe(0);
    expect(result.muted).toBe(false);
  });

  it('returns an amber gradient colour for computed value 50 in a 0-100 range', () => {
    const metric: MetricResult = createComputedMetricResult({ value: 50 });

    const result: MetricToneResolution = resolveMetricTone(metric, { lower: 0, upper: 100 });

    // t = 0.5 -> hue 120·0.5^1.5 ≈ 42.4, lightness 34 + 9·sin(0.5π) = 43.0
    expect(result.color).toBe('hsl(42.4, 70%, 43.0%)');
    expect(result.cellStyle).toEqual({
      backgroundColor: 'hsl(42.4, 75%, 92%)',
      color: 'hsl(42.4, 70%, 32%)',
    });
  });

  it('returns a dark-green gradient colour for computed value 100 in a 0-100 range', () => {
    const metric: MetricResult = createComputedMetricResult({ value: 100 });

    const result: MetricToneResolution = resolveMetricTone(metric, { lower: 0, upper: 100 });

    // t = 1 -> hue 120, lightness 34 + 9·sin(π) = 34.0
    expect(result.color).toBe('hsl(120.0, 70%, 34.0%)');
    expect(result.cellStyle).toEqual({
      backgroundColor: 'hsl(120.0, 75%, 92%)',
      color: 'hsl(120.0, 70%, 32%)',
    });
  });

  // -------------------------------------------------------------------------
  // Range validation
  // -------------------------------------------------------------------------

  it('throws when range upper equals lower', () => {
    const metric: MetricResult = createComputedMetricResult({ value: 0 });

    expect(() => resolveMetricTone(metric, { lower: 5, upper: 5 })).toThrow();
  });

  it('throws when range upper is less than lower', () => {
    const metric: MetricResult = createComputedMetricResult({ value: 0 });

    expect(() => resolveMetricTone(metric, { lower: 5, upper: 0 })).toThrow();
  });
});
