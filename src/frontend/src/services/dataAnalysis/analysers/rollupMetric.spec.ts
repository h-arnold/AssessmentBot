/**
 * Red-phase tests for the `rollupMetric` helper.
 *
 * These tests define the expected behaviour of the shared rollupMetric
 * helper that will be created in the Green phase. They will fail in the
 * Red phase because the production module does not exist yet.
 *
 * @see SPEC_CLASS_PAGE_PREPARATION.md §"rollupMetric helper contract"
 */

import { describe, it, expect } from 'vitest';
import type { MetricResult } from '../dataAnalysis.zod';
import {
  createComputedMetricResult,
  createNotAttemptedMetricResult,
  createErrorMetricResult,
} from '../../../test/dataAnalysis/fixtures';

// ---------------------------------------------------------------------------
// Helper to import the not-yet-existing rollupMetric module
// ---------------------------------------------------------------------------

/**
 * Dynamically import the rollupMetric module.
 * This will fail in the Red phase because the module doesn't exist yet.
 *
 * @returns {Promise<{
 *   rollupMetric: (
 *     subTasks: ReadonlyArray<MetricResult>,
 *     metric: 'completeness' | 'accuracy' | 'spag'
 *   ) => MetricResult;
 * }>} A promise resolving to the rollupMetric module with the helper function.
 */
async function loadRollupMetric(): Promise<{
  rollupMetric: (
    subTasks: ReadonlyArray<MetricResult>,
    metric: 'completeness' | 'accuracy' | 'spag'
  ) => MetricResult;
}> {
  return import('./rollupMetric') as Promise<{
    rollupMetric: (
      subTasks: ReadonlyArray<MetricResult>,
      metric: 'completeness' | 'accuracy' | 'spag'
    ) => MetricResult;
  }>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Tolerance used for floating-point comparisons in toBeCloseTo assertions. */
const FLOAT_TOLERANCE = 10;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('rollupMetric', () => {
  // -----------------------------------------------------------------------
  // All-computed case — for each of the three criteria
  // -----------------------------------------------------------------------

  describe('all-computed sub-tasks', () => {
    it('rolls up completeness correctly', async () => {
      const { rollupMetric } = await loadRollupMetric();

      const subTasks = [
        createComputedMetricResult({ value: 3, totalWeight: 1, applicableDataPoints: 1 }),
        createComputedMetricResult({ value: 5, totalWeight: 2, applicableDataPoints: 2 }),
      ];

      const result = rollupMetric(subTasks, 'completeness');

      // Weighted mean: (3*1 + 5*2) / (1 + 2) = 13/3 ≈ 4.333...
      const COMPLETENESS_WEIGHTED_SUM = 13;
      const COMPLETENESS_WEIGHTED_DENOM = 3;
      const EXPECTED_MEAN = COMPLETENESS_WEIGHTED_SUM / COMPLETENESS_WEIGHTED_DENOM;
      const EXPECTED_TOTAL_WEIGHT = 3;
      const EXPECTED_APPLICABLE_POINTS = 2;
      const EXPECTED_TOTAL_POINTS = 2;

      expect(result.state).toBe('computed');
      if (result.state === 'computed') {
        expect(result.value).toBeCloseTo(EXPECTED_MEAN, FLOAT_TOLERANCE);
        expect(result.totalWeight).toBeCloseTo(EXPECTED_TOTAL_WEIGHT, FLOAT_TOLERANCE);
        expect(result.applicableDataPoints).toBe(EXPECTED_APPLICABLE_POINTS);
        expect(result.totalDataPoints).toBe(EXPECTED_TOTAL_POINTS);
      }
    });

    it('rolls up accuracy correctly', async () => {
      const { rollupMetric } = await loadRollupMetric();

      const subTasks = [
        createComputedMetricResult({ value: 4, totalWeight: 1, applicableDataPoints: 1 }),
        createComputedMetricResult({ value: 6, totalWeight: 1, applicableDataPoints: 1 }),
      ];

      const result = rollupMetric(subTasks, 'accuracy');

      const EXPECTED_MEAN = 5;
      const EXPECTED_TOTAL_WEIGHT = 2;
      const EXPECTED_APPLICABLE_POINTS = 2;
      const EXPECTED_TOTAL_POINTS = 2;

      expect(result.state).toBe('computed');
      if (result.state === 'computed') {
        expect(result.value).toBeCloseTo(EXPECTED_MEAN, FLOAT_TOLERANCE);
        expect(result.totalWeight).toBeCloseTo(EXPECTED_TOTAL_WEIGHT, FLOAT_TOLERANCE);
        expect(result.applicableDataPoints).toBe(EXPECTED_APPLICABLE_POINTS);
        expect(result.totalDataPoints).toBe(EXPECTED_TOTAL_POINTS);
      }
    });

    it('rolls up spag correctly', async () => {
      const { rollupMetric } = await loadRollupMetric();

      const subTasks = [
        createComputedMetricResult({ value: 2, totalWeight: 3, applicableDataPoints: 3 }),
        createComputedMetricResult({ value: 4, totalWeight: 1, applicableDataPoints: 1 }),
      ];

      const result = rollupMetric(subTasks, 'spag');

      // Weighted mean: (2*3 + 4*1) / (3 + 1) = 10/4 = 2.5
      const EXPECTED_MEAN = 2.5;
      const EXPECTED_TOTAL_WEIGHT = 4;
      const EXPECTED_APPLICABLE_POINTS = 2;
      const EXPECTED_TOTAL_POINTS = 2;

      expect(result.state).toBe('computed');
      if (result.state === 'computed') {
        expect(result.value).toBeCloseTo(EXPECTED_MEAN, FLOAT_TOLERANCE);
        expect(result.totalWeight).toBeCloseTo(EXPECTED_TOTAL_WEIGHT, FLOAT_TOLERANCE);
        expect(result.applicableDataPoints).toBe(EXPECTED_APPLICABLE_POINTS);
        expect(result.totalDataPoints).toBe(EXPECTED_TOTAL_POINTS);
      }
    });
  });

  // -----------------------------------------------------------------------
  // All-notAttempted case — for each of the three criteria
  // -----------------------------------------------------------------------

  describe('all-notAttempted sub-tasks', () => {
    it('produces notAttempted for completeness', async () => {
      const { rollupMetric } = await loadRollupMetric();

      const subTasks = [
        createNotAttemptedMetricResult({ totalDataPoints: 2 }),
        createNotAttemptedMetricResult({ totalDataPoints: 3 }),
      ];

      const result = rollupMetric(subTasks, 'completeness');

      expect(result.state).toBe('notAttempted');
      if (result.state === 'notAttempted') {
        expect(result.value).toBe('N');
      }
    });

    it('produces notAttempted for accuracy', async () => {
      const { rollupMetric } = await loadRollupMetric();

      const subTasks = [
        createNotAttemptedMetricResult({ totalDataPoints: 1 }),
        createNotAttemptedMetricResult({ totalDataPoints: 1 }),
      ];

      const result = rollupMetric(subTasks, 'accuracy');

      expect(result.state).toBe('notAttempted');
      if (result.state === 'notAttempted') {
        expect(result.value).toBe('N');
      }
    });

    it('produces notAttempted for spag', async () => {
      const { rollupMetric } = await loadRollupMetric();

      const subTasks = [
        createNotAttemptedMetricResult({ totalDataPoints: 1 }),
        createNotAttemptedMetricResult({ totalDataPoints: 1 }),
      ];

      const result = rollupMetric(subTasks, 'spag');

      expect(result.state).toBe('notAttempted');
      if (result.state === 'notAttempted') {
        expect(result.value).toBe('N');
      }
    });
  });

  // -----------------------------------------------------------------------
  // All-error case — for each of the three criteria
  // -----------------------------------------------------------------------

  describe('all-error sub-tasks', () => {
    it('produces error for completeness', async () => {
      const { rollupMetric } = await loadRollupMetric();

      const subTasks = [
        createErrorMetricResult({ totalDataPoints: 1 }),
        createErrorMetricResult({ totalDataPoints: 2 }),
      ];

      const result = rollupMetric(subTasks, 'completeness');

      expect(result.state).toBe('error');
      if (result.state === 'error') {
        expect(result.value).toBe('E');
      }
    });

    it('produces error for accuracy', async () => {
      const { rollupMetric } = await loadRollupMetric();

      const subTasks = [createErrorMetricResult({ totalDataPoints: 1 })];

      const result = rollupMetric(subTasks, 'accuracy');

      expect(result.state).toBe('error');
      if (result.state === 'error') {
        expect(result.value).toBe('E');
      }
    });

    it('produces error for spag', async () => {
      const { rollupMetric } = await loadRollupMetric();

      const subTasks = [
        createErrorMetricResult({ totalDataPoints: 1 }),
        createErrorMetricResult({ totalDataPoints: 3 }),
      ];

      const result = rollupMetric(subTasks, 'spag');

      expect(result.state).toBe('error');
      if (result.state === 'error') {
        expect(result.value).toBe('E');
      }
    });
  });

  // -----------------------------------------------------------------------
  // Mixed states — precedence test (error > notAttempted > computed)
  // -----------------------------------------------------------------------

  describe('mixed states precedence', () => {
    it('returns error when any sub-task is error', async () => {
      const { rollupMetric } = await loadRollupMetric();

      const subTasks = [
        createComputedMetricResult(),
        createNotAttemptedMetricResult(),
        createErrorMetricResult(),
      ];

      const result = rollupMetric(subTasks, 'completeness');

      expect(result.state).toBe('error');
      if (result.state === 'error') {
        expect(result.value).toBe('E');
      }
    });

    it('returns computed when mixing computed and notAttempted (notAttempted contributes 0 for completeness)', async () => {
      const { rollupMetric } = await loadRollupMetric();

      const subTasks = [
        createComputedMetricResult({
          value: 5,
          totalWeight: 1,
          applicableDataPoints: 1,
          totalDataPoints: 1,
        }),
        createNotAttemptedMetricResult({ totalWeight: 0, totalDataPoints: 1 }),
      ];

      const result = rollupMetric(subTasks, 'completeness');

      const EXPECTED_MIXED_VALUE = 5;
      const EXPECTED_MIXED_TOTAL_POINTS = 2;

      // Mixed computed + notAttempted → computed (the notAttempted contributes 0
      // for completeness/accuracy; the existing computed sub-task determines the state)
      expect(result.state).toBe('computed');
      if (result.state === 'computed') {
        expect(result.value).toBeCloseTo(EXPECTED_MIXED_VALUE, FLOAT_TOLERANCE);
        expect(result.totalWeight).toBeCloseTo(1, FLOAT_TOLERANCE);
        expect(result.applicableDataPoints).toBe(1);
        expect(result.totalDataPoints).toBe(EXPECTED_MIXED_TOTAL_POINTS);
      }
    });

    it('returns computed when all sub-tasks are computed', async () => {
      const { rollupMetric } = await loadRollupMetric();

      const subTasks = [
        createComputedMetricResult({ value: 3, totalWeight: 1 }),
        createComputedMetricResult({ value: 7, totalWeight: 1 }),
      ];

      const result = rollupMetric(subTasks, 'completeness');

      const EXPECTED_ALL_COMPUTED_VALUE = 5;

      expect(result.state).toBe('computed');
      if (result.state === 'computed') {
        expect(result.value).toBeCloseTo(EXPECTED_ALL_COMPUTED_VALUE, FLOAT_TOLERANCE);
      }
    });

    it('error sub-tasks are excluded from weighted average for completeness', async () => {
      const { rollupMetric } = await loadRollupMetric();

      // Error is excluded, notAttempted contributes 0 for completeness
      const subTasks = [
        createComputedMetricResult({ value: 4, totalWeight: 2, applicableDataPoints: 2 }),
        createNotAttemptedMetricResult({ totalWeight: 0, totalDataPoints: 1 }),
        createErrorMetricResult({ totalDataPoints: 1 }),
      ];

      const result = rollupMetric(subTasks, 'completeness');

      // error precedence → result is error
      expect(result.state).toBe('error');
    });

    it('error excludes from weighted average for accuracy', async () => {
      const { rollupMetric } = await loadRollupMetric();

      const subTasks = [
        createComputedMetricResult({ value: 4, totalWeight: 2, applicableDataPoints: 2 }),
        createErrorMetricResult({ totalDataPoints: 1 }),
      ];

      const result = rollupMetric(subTasks, 'accuracy');

      expect(result.state).toBe('error');
    });

    it('error excludes from weighted average for spag', async () => {
      const { rollupMetric } = await loadRollupMetric();

      const subTasks = [
        createComputedMetricResult({ value: 4, totalWeight: 2, applicableDataPoints: 2 }),
        createErrorMetricResult({ totalDataPoints: 1 }),
      ];

      const result = rollupMetric(subTasks, 'spag');

      expect(result.state).toBe('error');
    });
  });

  // -----------------------------------------------------------------------
  // Per-metric notAttempted handling
  // -----------------------------------------------------------------------

  describe('per-metric notAttempted handling', () => {
    it('completeness: notAttempted contributes 0 (weight in denominator)', async () => {
      const { rollupMetric } = await loadRollupMetric();

      // One computed (4 @ weight 2), one notAttempted (contributes 0)
      const subTasks = [
        createComputedMetricResult({
          value: 4,
          totalWeight: 2,
          applicableDataPoints: 2,
          totalDataPoints: 2,
        }),
        createNotAttemptedMetricResult({ totalWeight: 0, totalDataPoints: 1 }),
      ];

      const result = rollupMetric(subTasks, 'completeness');

      const EXPECTED_NA_COMPLETENESS_VALUE = 4;
      const EXPECTED_NA_COMPLETENESS_TOTAL_WEIGHT = 2;
      const EXPECTED_NA_COMPLETENESS_APPLICABLE_POINTS = 2;
      const EXPECTED_NA_COMPLETENESS_TOTAL_POINTS = 3;

      // Weighted mean: (4*2 + 0) / (2 + 0_for_notAttempted_weight)
      // Wait - for completeness, notAttempted contributes 0 with its weight in denominator
      // But notAttempted has totalWeight: 0 (which it does since no numeric data), so it doesn't contribute to denominator either
      // Actually, the spec says "notAttempted contributes a score of 0 (weight in denominator, zero in numerator)"
      // So if notAttempted has totalWeight: 0 (which it does since no numeric data), it doesn't contribute to denominator either
      // The result should be computed with just the computed sub-task's data
      expect(result.state).toBe('computed');
      if (result.state === 'computed') {
        expect(result.value).toBeCloseTo(EXPECTED_NA_COMPLETENESS_VALUE, FLOAT_TOLERANCE);
        expect(result.totalWeight).toBeCloseTo(
          EXPECTED_NA_COMPLETENESS_TOTAL_WEIGHT,
          FLOAT_TOLERANCE
        );
        expect(result.applicableDataPoints).toBe(EXPECTED_NA_COMPLETENESS_APPLICABLE_POINTS);
        expect(result.totalDataPoints).toBe(EXPECTED_NA_COMPLETENESS_TOTAL_POINTS);
      }
    });

    it('accuracy: notAttempted contributes 0 (weight in denominator)', async () => {
      const { rollupMetric } = await loadRollupMetric();

      const subTasks = [
        createComputedMetricResult({
          value: 3,
          totalWeight: 1,
          applicableDataPoints: 1,
          totalDataPoints: 1,
        }),
        createNotAttemptedMetricResult({ totalWeight: 0, totalDataPoints: 2 }),
      ];

      const result = rollupMetric(subTasks, 'accuracy');

      const EXPECTED_NA_ACCURACY_VALUE = 3;
      const EXPECTED_NA_ACCURACY_TOTAL_POINTS = 3;

      expect(result.state).toBe('computed');
      if (result.state === 'computed') {
        expect(result.value).toBeCloseTo(EXPECTED_NA_ACCURACY_VALUE, FLOAT_TOLERANCE);
        expect(result.totalWeight).toBeCloseTo(1, FLOAT_TOLERANCE);
        expect(result.applicableDataPoints).toBe(1);
        expect(result.totalDataPoints).toBe(EXPECTED_NA_ACCURACY_TOTAL_POINTS);
      }
    });

    it('spag: notAttempted is excluded (weight not in denominator)', async () => {
      const { rollupMetric } = await loadRollupMetric();

      const subTasks = [
        createComputedMetricResult({
          value: 4,
          totalWeight: 2,
          applicableDataPoints: 2,
          totalDataPoints: 2,
        }),
        createNotAttemptedMetricResult({ totalWeight: 0, totalDataPoints: 1 }),
      ];

      const result = rollupMetric(subTasks, 'spag');

      const EXPECTED_NA_SPAG_VALUE = 4;
      const EXPECTED_NA_SPAG_TOTAL_WEIGHT = 2;
      const EXPECTED_NA_SPAG_APPLICABLE_POINTS = 2;
      const EXPECTED_NA_SPAG_TOTAL_POINTS = 2;

      // For spag, notAttempted is excluded entirely (weight not in denominator)
      expect(result.state).toBe('computed');
      if (result.state === 'computed') {
        expect(result.value).toBeCloseTo(EXPECTED_NA_SPAG_VALUE, FLOAT_TOLERANCE);
        expect(result.totalWeight).toBeCloseTo(EXPECTED_NA_SPAG_TOTAL_WEIGHT, FLOAT_TOLERANCE);
        expect(result.applicableDataPoints).toBe(EXPECTED_NA_SPAG_APPLICABLE_POINTS);
        expect(result.totalDataPoints).toBe(EXPECTED_NA_SPAG_TOTAL_POINTS); // spag: notAttempted excluded from totalDataPoints too
      }
    });

    it('completeness: mix of computed and notAttempted with notAttempted carrying a totalWeight', async () => {
      const { rollupMetric } = await loadRollupMetric();

      // If notAttempted somehow carries a totalWeight (e.g., weight accumulated before being flagged NA)
      // it should still count in denominator as 0 in numerator
      const subTasks = [
        createComputedMetricResult({
          value: 6,
          totalWeight: 1,
          applicableDataPoints: 1,
          totalDataPoints: 1,
        }),
        createNotAttemptedMetricResult({ totalWeight: 0, totalDataPoints: 1 }),
      ];

      const result = rollupMetric(subTasks, 'completeness');

      const EXPECTED_MIXED_WITH_WEIGHT_VALUE = 6;

      expect(result.state).toBe('computed');
      if (result.state === 'computed') {
        expect(result.value).toBeCloseTo(EXPECTED_MIXED_WITH_WEIGHT_VALUE, FLOAT_TOLERANCE);
        expect(result.totalWeight).toBeCloseTo(1, FLOAT_TOLERANCE);
      }
    });

    it('spag: mix of computed and notAttempted — notAttempted excluded entirely', async () => {
      const { rollupMetric } = await loadRollupMetric();

      const subTasks = [
        createComputedMetricResult({
          value: 8,
          totalWeight: 2,
          applicableDataPoints: 2,
          totalDataPoints: 2,
        }),
        createNotAttemptedMetricResult({ totalDataPoints: 1 }),
      ];

      const result = rollupMetric(subTasks, 'spag');

      const EXPECTED_SPAG_EXCLUDED_VALUE = 8;
      const EXPECTED_SPAG_EXCLUDED_TOTAL_WEIGHT = 2;
      const EXPECTED_SPAG_EXCLUDED_APPLICABLE_POINTS = 2;
      const EXPECTED_SPAG_EXCLUDED_TOTAL_POINTS = 2;

      expect(result.state).toBe('computed');
      if (result.state === 'computed') {
        expect(result.value).toBeCloseTo(EXPECTED_SPAG_EXCLUDED_VALUE, FLOAT_TOLERANCE);
        expect(result.totalWeight).toBeCloseTo(
          EXPECTED_SPAG_EXCLUDED_TOTAL_WEIGHT,
          FLOAT_TOLERANCE
        );
        expect(result.applicableDataPoints).toBe(EXPECTED_SPAG_EXCLUDED_APPLICABLE_POINTS);
        // spag excludes notAttempted from everything
        expect(result.totalDataPoints).toBe(EXPECTED_SPAG_EXCLUDED_TOTAL_POINTS);
      }
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  describe('edge cases', () => {
    it('throws when subTasks is an empty array', async () => {
      const { rollupMetric } = await loadRollupMetric();

      expect(() => rollupMetric([], 'completeness')).toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // Coverage gap 4 — notAttempted with non-zero totalWeight
  // -----------------------------------------------------------------------

  describe('notAttempted with non-zero totalWeight', () => {
    it('contributes weight to denominator but zero to numerator for completeness', async () => {
      const { rollupMetric } = await loadRollupMetric();

      const subTasks = [
        createComputedMetricResult({ value: 4, totalWeight: 2 }),
        createNotAttemptedMetricResult({ totalWeight: 3, totalDataPoints: 2 }),
      ];

      const result = rollupMetric(subTasks, 'completeness');

      // Weighted mean: (4*2) / (2 + 3) = 8 / 5 = 1.6
      // totalWeight sums both: 2 + 3 = 5
      // totalDataPoints sums both: default(1) + 2 = 3
      const EXPECTED_VALUE = 1.6;
      const EXPECTED_TOTAL_WEIGHT = 5;
      const EXPECTED_TOTAL_POINTS = 3;

      expect(result.state).toBe('computed');
      if (result.state === 'computed') {
        expect(result.value).toBeCloseTo(EXPECTED_VALUE, FLOAT_TOLERANCE);
        expect(result.totalWeight).toBeCloseTo(EXPECTED_TOTAL_WEIGHT, FLOAT_TOLERANCE);
        expect(result.totalDataPoints).toBe(EXPECTED_TOTAL_POINTS);
      }
    });

    it('is excluded entirely from spag rollup even with non-zero weight', async () => {
      const { rollupMetric } = await loadRollupMetric();

      const subTasks = [
        createComputedMetricResult({
          value: 4,
          totalWeight: 2,
          applicableDataPoints: 2,
          totalDataPoints: 2,
        }),
        createNotAttemptedMetricResult({ totalWeight: 3, totalDataPoints: 2 }),
      ];

      const result = rollupMetric(subTasks, 'spag');

      // For spag, notAttempted is excluded entirely
      const EXPECTED_VALUE = 4;
      const EXPECTED_TOTAL_WEIGHT = 2;
      const EXPECTED_APPLICABLE_POINTS = 2;
      const EXPECTED_TOTAL_POINTS = 2;

      expect(result.state).toBe('computed');
      if (result.state === 'computed') {
        expect(result.value).toBeCloseTo(EXPECTED_VALUE, FLOAT_TOLERANCE);
        expect(result.totalWeight).toBeCloseTo(EXPECTED_TOTAL_WEIGHT, FLOAT_TOLERANCE);
        expect(result.applicableDataPoints).toBe(EXPECTED_APPLICABLE_POINTS);
        expect(result.totalDataPoints).toBe(EXPECTED_TOTAL_POINTS);
      }
    });
  });

  // -----------------------------------------------------------------------
  // Single sub-task
  // -----------------------------------------------------------------------

  describe('single sub-task', () => {
    it('returns computed sub-task as-is', async () => {
      const { rollupMetric } = await loadRollupMetric();

      const subTasks = [
        createComputedMetricResult({
          value: 3,
          totalWeight: 5,
          applicableDataPoints: 3,
          totalDataPoints: 3,
        }),
      ];

      const result = rollupMetric(subTasks, 'completeness');

      const EXPECTED_SINGLE_VALUE = 3;
      const EXPECTED_SINGLE_WEIGHT = 5;
      const EXPECTED_SINGLE_AP = 3;
      const EXPECTED_SINGLE_TDP = 3;

      expect(result.state).toBe('computed');
      if (result.state === 'computed') {
        expect(result.value).toBe(EXPECTED_SINGLE_VALUE);
        expect(result.totalWeight).toBe(EXPECTED_SINGLE_WEIGHT);
        expect(result.applicableDataPoints).toBe(EXPECTED_SINGLE_AP);
        expect(result.totalDataPoints).toBe(EXPECTED_SINGLE_TDP);
      }
    });

    it('returns notAttempted sub-task as-is', async () => {
      const { rollupMetric } = await loadRollupMetric();

      const subTasks = [createNotAttemptedMetricResult({ totalWeight: 2, totalDataPoints: 3 })];

      const result = rollupMetric(subTasks, 'completeness');

      const EXPECTED_NA_SINGLE_WEIGHT = 2;
      const EXPECTED_NA_SINGLE_TDP = 3;

      expect(result.state).toBe('notAttempted');
      if (result.state === 'notAttempted') {
        expect(result.value).toBe('N');
        expect(result.totalWeight).toBe(EXPECTED_NA_SINGLE_WEIGHT);
        expect(result.totalDataPoints).toBe(EXPECTED_NA_SINGLE_TDP);
      }
    });
  });

  // -----------------------------------------------------------------------
  // Metadata accumulation across states — error wins and metadata sums
  // -----------------------------------------------------------------------

  describe('metadata accumulation across states', () => {
    it('accumulates totalWeight and totalDataPoints from all sub-tasks when error wins', async () => {
      const { rollupMetric } = await loadRollupMetric();

      const subTasks = [
        createComputedMetricResult({
          value: 3,
          totalWeight: 1,
          applicableDataPoints: 1,
          totalDataPoints: 1,
        }),
        createNotAttemptedMetricResult({ totalWeight: 2, totalDataPoints: 3 }),
        createErrorMetricResult({ totalWeight: 0, totalDataPoints: 1 }),
      ];

      const result = rollupMetric(subTasks, 'completeness');

      // error wins, so state is error
      const EXPECTED_ERROR_TOTAL_WEIGHT = 3; // 1 + 2 + 0
      const EXPECTED_ERROR_TOTAL_POINTS = 5; // 1 + 3 + 1

      expect(result.state).toBe('error');
      if (result.state === 'error') {
        expect(result.value).toBe('E');
        expect(result.totalWeight).toBe(EXPECTED_ERROR_TOTAL_WEIGHT);
        expect(result.totalDataPoints).toBe(EXPECTED_ERROR_TOTAL_POINTS);
      }
    });
  });
});
