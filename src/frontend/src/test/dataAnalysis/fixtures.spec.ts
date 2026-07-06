/**
 * Green-phase tests for the consolidated `createMetricResult` builder.
 *
 * These tests verify the parameterised `createMetricResult(state, overrides?)`
 * builder and its backward-compatible per-state wrappers.
 *
 * @see CODE_REVIEW.md MAJOR-3 — Duplicated Fixture Builders
 */

import { describe, it, expect } from 'vitest';
import type { MetricResult } from '../../services/dataAnalysis/dataAnalysis.zod';
import {
  createMetricResult,
  createComputedMetricResult,
  createNotAttemptedMetricResult,
  createErrorMetricResult,
} from './fixtures';
import { expectMetricResultStateAware } from './averagingAnalyserAssertions';

// ---------------------------------------------------------------------------
// Constants for test values
// ---------------------------------------------------------------------------

const VALUE_THREE_POINT_FIVE = 3.5;
const VALUE_TWO = 2;
const VALUE_THREE = 3;
const VALUE_FOUR = 4;
const VALUE_FIVE = 5;
const VALUE_SIX = 6;
const VALUE_SEVEN = 7;

// ---------------------------------------------------------------------------
// createMetricResult — new parameterised builder
// ---------------------------------------------------------------------------

describe('createMetricResult', () => {
  describe('computed state', () => {
    it('produces a computed MetricResult with supplied value', () => {
      const result = createMetricResult('computed', { value: VALUE_THREE_POINT_FIVE });

      expect(result.state).toBe('computed');
      expect(result.value).toBe(VALUE_THREE_POINT_FIVE);
      expect(result.totalWeight).toBe(1);
      expect(result.applicableDataPoints).toBe(1);
      expect(result.totalDataPoints).toBe(1);
    });

    it('overrides default totalWeight when supplied', () => {
      const result = createMetricResult('computed', { value: VALUE_TWO, totalWeight: VALUE_FOUR });

      expect(result.state).toBe('computed');
      expect(result.value).toBe(VALUE_TWO);
      expect(result.totalWeight).toBe(VALUE_FOUR);
    });

    it('overrides default applicableDataPoints when supplied', () => {
      const result = createMetricResult('computed', {
        value: VALUE_FIVE,
        applicableDataPoints: VALUE_THREE,
      });

      expect(result.state).toBe('computed');
      expect(result.applicableDataPoints).toBe(VALUE_THREE);
    });

    it('overrides default totalDataPoints when supplied', () => {
      const result = createMetricResult('computed', {
        value: VALUE_FIVE,
        totalDataPoints: VALUE_FIVE,
      });

      expect(result.state).toBe('computed');
      expect(result.totalDataPoints).toBe(VALUE_FIVE);
    });

    it('can be used with expectMetricResultStateAware', () => {
      const result = createMetricResult('computed', { value: VALUE_THREE_POINT_FIVE });

      expectMetricResultStateAware(result, {
        state: 'computed',
        value: VALUE_THREE_POINT_FIVE,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      });
    });
  });

  describe('notAttempted state', () => {
    it('produces a notAttempted MetricResult', () => {
      const result = createMetricResult('notAttempted');

      expect(result.state).toBe('notAttempted');
      expect(result.value).toBe('N');
      expect(result.applicableDataPoints).toBe(0);
      expect(result.totalWeight).toBe(0);
      expect(result.totalDataPoints).toBe(1);
    });

    it('overrides totalWeight when supplied', () => {
      const result = createMetricResult('notAttempted', { totalWeight: VALUE_TWO });

      expect(result.state).toBe('notAttempted');
      expect(result.totalWeight).toBe(VALUE_TWO);
    });

    it('overrides totalDataPoints when supplied', () => {
      const result = createMetricResult('notAttempted', { totalDataPoints: VALUE_FIVE });

      expect(result.state).toBe('notAttempted');
      expect(result.totalDataPoints).toBe(VALUE_FIVE);
    });

    it('can be used with expectMetricResultStateAware', () => {
      const result = createMetricResult('notAttempted');

      expectMetricResultStateAware(result, {
        state: 'notAttempted',
        totalWeight: 0,
        totalDataPoints: 1,
      });
    });
  });

  describe('error state', () => {
    it('produces an error MetricResult', () => {
      const result = createMetricResult('error');

      expect(result.state).toBe('error');
      expect(result.value).toBe('E');
      expect(result.applicableDataPoints).toBe(0);
      expect(result.totalWeight).toBe(0);
      expect(result.totalDataPoints).toBe(1);
    });

    it('overrides totalWeight when supplied', () => {
      const result = createMetricResult('error', { totalWeight: 0 });

      expect(result.state).toBe('error');
      expect(result.totalWeight).toBe(0);
    });

    it('overrides totalDataPoints when supplied', () => {
      const result = createMetricResult('error', { totalDataPoints: VALUE_THREE });

      expect(result.state).toBe('error');
      expect(result.totalDataPoints).toBe(VALUE_THREE);
    });

    it('can be used with expectMetricResultStateAware', () => {
      const result = createMetricResult('error');

      expectMetricResultStateAware(result, {
        state: 'error',
        totalWeight: 0,
        totalDataPoints: 1,
      });
    });
  });
});

// ---------------------------------------------------------------------------
// Backward-compatible wrappers — produce identical results to createMetricResult
// ---------------------------------------------------------------------------

describe('backward-compatible wrappers', () => {
  it('createComputedMetricResult matches createMetricResult("computed", ...)', () => {
    const wrapped = createComputedMetricResult({ value: VALUE_SEVEN, totalWeight: VALUE_TWO });
    const unified = createMetricResult('computed', { value: VALUE_SEVEN, totalWeight: VALUE_TWO });

    expect(wrapped).toStrictEqual(unified);
  });

  it('createComputedMetricResult defaults match createMetricResult("computed")', () => {
    const wrapped = createComputedMetricResult();
    const unified = createMetricResult('computed');

    expect(wrapped).toStrictEqual(unified);
  });

  it('createNotAttemptedMetricResult matches createMetricResult("notAttempted", ...)', () => {
    const wrapped = createNotAttemptedMetricResult({ totalDataPoints: 4 });
    const unified = createMetricResult('notAttempted', { totalDataPoints: 4 });

    expect(wrapped).toStrictEqual(unified);
  });

  it('createNotAttemptedMetricResult defaults match createMetricResult("notAttempted")', () => {
    const wrapped = createNotAttemptedMetricResult();
    const unified = createMetricResult('notAttempted');

    expect(wrapped).toStrictEqual(unified);
  });

  it('createErrorMetricResult matches createMetricResult("error", ...)', () => {
    const wrapped = createErrorMetricResult({ totalDataPoints: 5 });
    const unified = createMetricResult('error', { totalDataPoints: 5 });

    expect(wrapped).toStrictEqual(unified);
  });

  it('createErrorMetricResult defaults match createMetricResult("error")', () => {
    const wrapped = createErrorMetricResult();
    const unified = createMetricResult('error');

    expect(wrapped).toStrictEqual(unified);
  });
});

// ---------------------------------------------------------------------------
// Type compatibility — MetricResult from production zod can be used with
// expectMetricResultStateAware (compile-time check)
// ---------------------------------------------------------------------------

describe('type compatibility with MetricResult (dataAnalysis.zod.ts)', () => {
  it('accepts a MetricResult (production type) as the actual parameter of expectMetricResultStateAware', () => {
    // This is a compile-time check: MetricResult (from the production Zod schema)
    // must be accepted by expectMetricResultStateAware.
    // If the types are compatible, this should compile.
    const productionResult: MetricResult = {
      state: 'computed',
      value: 4,
      totalWeight: 1,
      applicableDataPoints: 1,
      totalDataPoints: 1,
    };

    // This call verifies MetricResult is accepted by expectMetricResultStateAware
    expectMetricResultStateAware(productionResult, {
      state: 'computed',
      value: 4,
      totalWeight: 1,
      applicableDataPoints: 1,
      totalDataPoints: 1,
    });
  });

  it('MetricResult shapes from createComputedMetricResult are assignable to MetricResult', () => {
    const result: MetricResult = createComputedMetricResult({ value: VALUE_SIX });

    expect(result.state).toBe('computed');
    expect(result.value).toBe(VALUE_SIX);
  });

  it('MetricResult shapes from createNotAttemptedMetricResult are assignable to MetricResult', () => {
    const result: MetricResult = createNotAttemptedMetricResult();

    expect(result.state).toBe('notAttempted');
    expect(result.value).toBe('N');
  });

  it('MetricResult shapes from createErrorMetricResult are assignable to MetricResult', () => {
    const result: MetricResult = createErrorMetricResult();

    expect(result.state).toBe('error');
    expect(result.value).toBe('E');
  });
});
