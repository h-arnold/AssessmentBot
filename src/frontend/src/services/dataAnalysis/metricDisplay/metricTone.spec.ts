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

describe('resolveMetricTone', () => {
  // -------------------------------------------------------------------------
  // Computed state — default range { lower: 0, upper: 5 }
  // -------------------------------------------------------------------------

  it('returns red for computed value below the red/amber boundary', () => {
    const metric: MetricResult = createComputedMetricResult({ value: 1 });

    const result: MetricToneResolution = resolveMetricTone(metric);

    expect(result).toStrictEqual({
      color: 'red',
      displayValue: 1,
      muted: false,
    });
  });

  it('returns gold for computed value at the red/amber edge (amber side inclusive)', () => {
    const metric: MetricResult = createComputedMetricResult({ value: 1.25 });

    const result: MetricToneResolution = resolveMetricTone(metric);

    expect(result).toStrictEqual({
      color: 'gold',
      displayValue: 1.25,
      muted: false,
    });
  });

  it('returns gold for computed value at the amber/green edge (amber side inclusive)', () => {
    const metric: MetricResult = createComputedMetricResult({ value: 3.75 });

    const result: MetricToneResolution = resolveMetricTone(metric);

    expect(result).toStrictEqual({
      color: 'gold',
      displayValue: 3.75,
      muted: false,
    });
  });

  it('returns green for computed value at the green boundary', () => {
    const metric: MetricResult = createComputedMetricResult({ value: 4 });

    const result: MetricToneResolution = resolveMetricTone(metric);

    expect(result).toStrictEqual({
      color: 'green',
      displayValue: 4,
      muted: false,
    });
  });

  // -------------------------------------------------------------------------
  // NotAttempted state
  // -------------------------------------------------------------------------

  it('returns default colour with muted=true for notAttempted metric', () => {
    const metric: MetricResult = createNotAttemptedMetricResult();

    const result: MetricToneResolution = resolveMetricTone(metric);

    expect(result).toStrictEqual({
      color: 'default',
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
      displayValue: 'E',
      muted: false,
    });
  });

  it('returns custom errorColor for error metric when supplied', () => {
    const metric: MetricResult = createErrorMetricResult();

    const result: MetricToneResolution = resolveMetricTone(metric, { lower: 0, upper: 5 }, 'red');

    expect(result).toStrictEqual({
      color: 'red',
      displayValue: 'E',
      muted: false,
    });
  });

  // -------------------------------------------------------------------------
  // Custom range { lower: 0, upper: 100 }
  // -------------------------------------------------------------------------

  it('returns red for computed value 24 in a 0-100 range (below red/amber boundary 25)', () => {
    const metric: MetricResult = createComputedMetricResult({ value: 24 });

    const result: MetricToneResolution = resolveMetricTone(metric, { lower: 0, upper: 100 });

    expect(result).toStrictEqual({
      color: 'red',
      displayValue: 24,
      muted: false,
    });
  });

  it('returns gold for computed value 25 in a 0-100 range (at red/amber edge, amber side)', () => {
    const metric: MetricResult = createComputedMetricResult({ value: 25 });

    const result: MetricToneResolution = resolveMetricTone(metric, { lower: 0, upper: 100 });

    expect(result).toStrictEqual({
      color: 'gold',
      displayValue: 25,
      muted: false,
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
