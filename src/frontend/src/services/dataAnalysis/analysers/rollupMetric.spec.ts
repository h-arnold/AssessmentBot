/**
 * Tests for the `rollupMetric` helper.
 *
 * Restructured to use `describe.each` across the three criteria
 * (completeness, accuracy, spag), reducing repetition.
 */

import { describe, it, expect } from 'vitest';
import type { MetricResult } from '../dataAnalysis.zod';
import {
  createComputedMetricResult,
  createNotAttemptedMetricResult,
  createErrorMetricResult,
} from '../../../test/dataAnalysis/fixtures';

// ---------------------------------------------------------------------------
// Helper to dynamically import the rollupMetric module
// ---------------------------------------------------------------------------

/**
 * Dynamically import the rollupMetric module.
 *
 * @returns {Promise<{
 *   rollupMetric: (
 *     subTasks: ReadonlyArray<MetricResult>,
 *     metric: 'completeness' | 'accuracy' | 'spag'
 *   ) => MetricResult;
 * }>} A promise resolving to the rollupMetric module.
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

/** Tolerance for floating-point toBeCloseTo assertions. */
const FLOAT_TOLERANCE = 10;

type Metric = 'completeness' | 'accuracy' | 'spag';

/** Parameterisation array — one entry per metric criterion. */
const CRITERIA: { metric: Metric; isSpag: boolean }[] = [
  { metric: 'completeness', isSpag: false },
  { metric: 'accuracy', isSpag: false },
  { metric: 'spag', isSpag: true },
];

// ---------------------------------------------------------------------------
// Per-criterion computed data
// ---------------------------------------------------------------------------

const COMPLETENESS_WEIGHTED_SUM = 13;
const COMPLETENESS_WEIGHTED_DENOM = 3;
const COMPLETENESS_MEAN = COMPLETENESS_WEIGHTED_SUM / COMPLETENESS_WEIGHTED_DENOM;
const ACCURACY_MEAN = 5;
const SPAG_MEAN = 2.5;

const COMPUTED = {
  completeness: {
    a: { value: 3, totalWeight: 1, applicableDataPoints: 1 },
    b: { value: 5, totalWeight: 2, applicableDataPoints: 2 },
    mean: COMPLETENESS_MEAN,
    tw: 3,
    ap: 2,
    tdp: 2,
  },
  accuracy: {
    a: { value: 4, totalWeight: 1, applicableDataPoints: 1 },
    b: { value: 6, totalWeight: 1, applicableDataPoints: 1 },
    mean: ACCURACY_MEAN,
    tw: 2,
    ap: 2,
    tdp: 2,
  },
  spag: {
    a: { value: 2, totalWeight: 3, applicableDataPoints: 3 },
    b: { value: 4, totalWeight: 1, applicableDataPoints: 1 },
    mean: SPAG_MEAN,
    tw: 4,
    ap: 2,
    tdp: 2,
  },
} as const;

// ---------------------------------------------------------------------------
// Per-criterion error exclusion data
// ---------------------------------------------------------------------------

const ERROR_EXCLUSION = {
  completeness: {
    tasks: [
      createComputedMetricResult({ value: 4, totalWeight: 2, applicableDataPoints: 2 }),
      createNotAttemptedMetricResult({ totalWeight: 0, totalDataPoints: 1 }),
      createErrorMetricResult({ totalDataPoints: 1 }),
    ],
  },
  accuracy: {
    tasks: [
      createComputedMetricResult({ value: 4, totalWeight: 2, applicableDataPoints: 2 }),
      createErrorMetricResult({ totalDataPoints: 1 }),
    ],
  },
  spag: {
    tasks: [
      createComputedMetricResult({ value: 4, totalWeight: 2, applicableDataPoints: 2 }),
      createErrorMetricResult({ totalDataPoints: 1 }),
    ],
  },
};

// ---------------------------------------------------------------------------
// Per-criterion notAttempted-handling data
// ---------------------------------------------------------------------------

const NA_HANDLING = {
  completeness: {
    task: { value: 4, totalWeight: 2, applicableDataPoints: 2, totalDataPoints: 2 },
    na: { totalWeight: 0, totalDataPoints: 1 },
    expectedValue: 4,
    expectedTw: 2,
    expectedAp: 2,
    expectedTdp: 3,
  },
  accuracy: {
    task: { value: 3, totalWeight: 1, applicableDataPoints: 1, totalDataPoints: 1 },
    na: { totalWeight: 0, totalDataPoints: 2 },
    expectedValue: 3,
    expectedTw: 1,
    expectedAp: 1,
    expectedTdp: 3,
  },
  spag: {
    task: { value: 4, totalWeight: 2, applicableDataPoints: 2, totalDataPoints: 2 },
    na: { totalWeight: 0, totalDataPoints: 1 },
    expectedValue: 4,
    expectedTw: 2,
    expectedAp: 2,
    expectedTdp: 2,
  },
} as const;

// ---------------------------------------------------------------------------
// Per-criterion notAttempted-with-weight data
// ---------------------------------------------------------------------------

const NA_WEIGHT = {
  completeness: {
    task: { value: 4, totalWeight: 2, applicableDataPoints: 1, totalDataPoints: 1 },
    na: { totalWeight: 3, totalDataPoints: 2 },
    expectedValue: 1.6,
    expectedTw: 5,
    expectedAp: 1,
    expectedTdp: 3,
  },
  spag: {
    task: { value: 4, totalWeight: 2, applicableDataPoints: 2, totalDataPoints: 2 },
    na: { totalWeight: 3, totalDataPoints: 2 },
    expectedValue: 4,
    expectedTw: 2,
    expectedAp: 2,
    expectedTdp: 2,
  },
} as const;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('rollupMetric', () => {
  // -----------------------------------------------------------------------
  // All-computed sub-tasks — for each criterion
  // -----------------------------------------------------------------------

  describe.each(CRITERIA)('all-computed sub-tasks ($metric)', ({ metric }) => {
    it('rolls up correctly', async () => {
      const { rollupMetric } = await loadRollupMetric();
      const d = COMPUTED[metric];

      const subTasks = [createComputedMetricResult(d.a), createComputedMetricResult(d.b)];

      const result = rollupMetric(subTasks, metric);

      expect(result.state).toBe('computed');
      if (result.state === 'computed') {
        expect(result.value).toBeCloseTo(d.mean, FLOAT_TOLERANCE);
        expect(result.totalWeight).toBeCloseTo(d.tw, FLOAT_TOLERANCE);
        expect(result.applicableDataPoints).toBe(d.ap);
        expect(result.totalDataPoints).toBe(d.tdp);
      }
    });
  });

  // -----------------------------------------------------------------------
  // All-notAttempted sub-tasks — for each criterion
  // -----------------------------------------------------------------------

  describe.each(CRITERIA)('all-notAttempted sub-tasks ($metric)', ({ metric }) => {
    it('produces notAttempted', async () => {
      const { rollupMetric } = await loadRollupMetric();

      const subTasks = [
        createNotAttemptedMetricResult({ totalDataPoints: 2 }),
        createNotAttemptedMetricResult({ totalDataPoints: 3 }),
      ];

      const result = rollupMetric(subTasks, metric);

      expect(result.state).toBe('notAttempted');
      if (result.state === 'notAttempted') {
        expect(result.value).toBe('N');
      }
    });
  });

  // -----------------------------------------------------------------------
  // All-error sub-tasks — for each criterion
  // -----------------------------------------------------------------------

  describe.each(CRITERIA)('all-error sub-tasks ($metric)', ({ metric }) => {
    it('produces error', async () => {
      const { rollupMetric } = await loadRollupMetric();

      const subTasks = [
        createErrorMetricResult({ totalDataPoints: 1 }),
        createErrorMetricResult({ totalDataPoints: 2 }),
      ];

      const result = rollupMetric(subTasks, metric);

      expect(result.state).toBe('error');
      if (result.state === 'error') {
        expect(result.value).toBe('E');
      }
    });
  });

  // -----------------------------------------------------------------------
  // Mixed states — precedence (error > notAttempted > computed)
  // -----------------------------------------------------------------------

  describe('mixed states precedence', () => {
    it('returns computed (error sub-task excluded) when mixing computed, notAttempted, and error', async () => {
      const { rollupMetric } = await loadRollupMetric();

      const subTasks = [
        createComputedMetricResult(),
        createNotAttemptedMetricResult(),
        createErrorMetricResult(),
      ];

      const result = rollupMetric(subTasks, 'completeness');
      // computed(5, tw=1, ap=1, tdp=1) + notAttempted(tw=0, tdp=1) + error(tdp=1)
      // totalWeightedSum = 5*1 = 5, computedTotalWeight = 1, naTotalWeight = 0
      // finalTotalWeight = 1, finalTotalDataPoints = 1 + 1 = 2
      // value = 5/1 = 5, ap = min(1, 2) = 1
      const EXPECTED_VALUE = 5;
      const EXPECTED_TW = 1;
      const EXPECTED_AP = 1;
      const EXPECTED_TDP = 2;
      expect(result.state).toBe('computed');
      if (result.state === 'computed') {
        expect(result.value).toBeCloseTo(EXPECTED_VALUE, FLOAT_TOLERANCE);
        expect(result.totalWeight).toBeCloseTo(EXPECTED_TW, FLOAT_TOLERANCE);
        expect(result.applicableDataPoints).toBe(EXPECTED_AP);
        expect(result.totalDataPoints).toBe(EXPECTED_TDP);
      }
    });

    it('returns computed when all sub-tasks are computed', async () => {
      const { rollupMetric } = await loadRollupMetric();
      const EXPECTED = 5;

      const subTasks = [
        createComputedMetricResult({ value: 3, totalWeight: 1 }),
        createComputedMetricResult({ value: 7, totalWeight: 1 }),
      ];

      const result = rollupMetric(subTasks, 'completeness');

      expect(result.state).toBe('computed');
      if (result.state === 'computed') {
        expect(result.value).toBeCloseTo(EXPECTED, FLOAT_TOLERANCE);
      }
    });

    it('returns computed when mixing computed and notAttempted', async () => {
      const { rollupMetric } = await loadRollupMetric();
      const EXPECTED_VALUE = 5;
      const EXPECTED_TW = 1;
      const EXPECTED_AP = 1;
      const EXPECTED_TDP = 2;

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

      expect(result.state).toBe('computed');
      if (result.state === 'computed') {
        expect(result.value).toBeCloseTo(EXPECTED_VALUE, FLOAT_TOLERANCE);
        expect(result.totalWeight).toBeCloseTo(EXPECTED_TW, FLOAT_TOLERANCE);
        expect(result.applicableDataPoints).toBe(EXPECTED_AP);
        expect(result.totalDataPoints).toBe(EXPECTED_TDP);
      }
    });

    describe.each(CRITERIA)(
      'error sub-tasks are excluded from weighted average ($metric)',
      ({ metric, isSpag }) => {
        it('produces computed (error excluded)', async () => {
          const { rollupMetric } = await loadRollupMetric();
          const d = ERROR_EXCLUSION[metric];

          const result = rollupMetric(d.tasks, metric);

          // All ERROR_EXCLUSION data has one computed entry (4, tw=2, ap=2)
          // plus error/notAttempted entries. Error is excluded from the average.
          const EXPECTED_VALUE = 4;
          const EXPECTED_TOTAL_WEIGHT = 2;
          expect(result.state).toBe('computed');
          if (result.state === 'computed') {
            expect(result.value).toBeCloseTo(EXPECTED_VALUE, FLOAT_TOLERANCE);
            expect(result.totalWeight).toBeCloseTo(EXPECTED_TOTAL_WEIGHT, FLOAT_TOLERANCE);
            // completeness has na(tw=0, tdp=1) → finalTotalDataPoints=2, ap=min(2,2)=2
            // accuracy/spag has no na → finalTotalDataPoints=1, ap=min(2,1)=1
            if (isSpag || metric === 'accuracy') {
              expect(result.applicableDataPoints).toBe(1);
            } else {
              const EXPECTED_AP = 2;
              expect(result.applicableDataPoints).toBe(EXPECTED_AP);
            }
          }
        });
      }
    );
  });

  it('error sub-task excluded from weighted average when mixed with two computed entries', async () => {
    const { rollupMetric } = await loadRollupMetric();

    // Two computed entries (value=5, tw=2 and value=3, tw=1) plus one error
    const subTasks = [
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
    ];

    const COMPUTED_TOTAL_WEIGHTED_SUM = 13;
    const COMPUTED_TOTAL_WEIGHT = 3;
    const EXPECTED_VALUE = COMPUTED_TOTAL_WEIGHTED_SUM / COMPUTED_TOTAL_WEIGHT;
    const EXPECTED_TOTAL_WEIGHT = COMPUTED_TOTAL_WEIGHT;
    const EXPECTED_AP = 3;
    const EXPECTED_TDP = 3;
    const result = rollupMetric(subTasks, 'completeness');
    // totalWeightedSum = 5*2 + 3*1 = 13
    // computedTotalWeight = 3, finalTotalWeight = 3
    // value = 13/3 ≈ 4.333
    // computedTd = 3, no na → finalTotalDataPoints = 3, ap = min(2+1=3, 3) = 3
    expect(result.state).toBe('computed');
    if (result.state === 'computed') {
      expect(result.value).toBeCloseTo(EXPECTED_VALUE, FLOAT_TOLERANCE);
      expect(result.totalWeight).toBeCloseTo(EXPECTED_TOTAL_WEIGHT, FLOAT_TOLERANCE);
      expect(result.applicableDataPoints).toBe(EXPECTED_AP);
      expect(result.totalDataPoints).toBe(EXPECTED_TDP);
    }
  });

  // -----------------------------------------------------------------------
  // Per-metric notAttempted handling
  // -----------------------------------------------------------------------

  describe('per-metric notAttempted handling', () => {
    describe.each(CRITERIA)('notAttempted contributes 0 for $metric', ({ metric }) => {
      it('computes correctly', async () => {
        const { rollupMetric } = await loadRollupMetric();
        const d = NA_HANDLING[metric];

        const subTasks = [createComputedMetricResult(d.task), createNotAttemptedMetricResult(d.na)];

        const result = rollupMetric(subTasks, metric);

        expect(result.state).toBe('computed');
        if (result.state === 'computed') {
          expect(result.value).toBeCloseTo(d.expectedValue, FLOAT_TOLERANCE);
          expect(result.totalWeight).toBeCloseTo(d.expectedTw, FLOAT_TOLERANCE);
          expect(result.applicableDataPoints).toBe(d.expectedAp);
          expect(result.totalDataPoints).toBe(d.expectedTdp);
        }
      });
    });

    it('completeness: mix with notAttempted carrying a totalWeight', async () => {
      const { rollupMetric } = await loadRollupMetric();
      const EXPECTED_VALUE = 6;

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

      expect(result.state).toBe('computed');
      if (result.state === 'computed') {
        expect(result.value).toBeCloseTo(EXPECTED_VALUE, FLOAT_TOLERANCE);
        expect(result.totalWeight).toBeCloseTo(1, FLOAT_TOLERANCE);
      }
    });

    it('spag: mix of computed and notAttempted — notAttempted excluded entirely', async () => {
      const { rollupMetric } = await loadRollupMetric();
      const EXPECTED_VALUE = 8;
      const EXPECTED_TW = 2;
      const EXPECTED_AP = 2;
      const EXPECTED_TDP = 2;

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

      expect(result.state).toBe('computed');
      if (result.state === 'computed') {
        expect(result.value).toBeCloseTo(EXPECTED_VALUE, FLOAT_TOLERANCE);
        expect(result.totalWeight).toBeCloseTo(EXPECTED_TW, FLOAT_TOLERANCE);
        expect(result.applicableDataPoints).toBe(EXPECTED_AP);
        expect(result.totalDataPoints).toBe(EXPECTED_TDP);
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
  // notAttempted with non-zero totalWeight (coverage gap 4)
  // -----------------------------------------------------------------------

  describe('notAttempted with non-zero totalWeight', () => {
    describe.each(CRITERIA.filter((c) => c.metric !== 'accuracy'))(
      '($metric)',
      ({ metric, isSpag }) => {
        it('handles correctly', async () => {
          const { rollupMetric } = await loadRollupMetric();
          const d = NA_WEIGHT[isSpag ? 'spag' : 'completeness'];

          const subTasks = [
            createComputedMetricResult(d.task),
            createNotAttemptedMetricResult(d.na),
          ];

          const result = rollupMetric(subTasks, metric);

          expect(result.state).toBe('computed');
          if (result.state === 'computed') {
            expect(result.value).toBeCloseTo(d.expectedValue, FLOAT_TOLERANCE);
            expect(result.totalWeight).toBeCloseTo(d.expectedTw, FLOAT_TOLERANCE);
            expect(result.applicableDataPoints).toBe(d.expectedAp);
            expect(result.totalDataPoints).toBe(d.expectedTdp);
          }
        });
      }
    );
  });

  // -----------------------------------------------------------------------
  // Single sub-task
  // -----------------------------------------------------------------------

  describe('single sub-task', () => {
    it('returns computed sub-task as-is', async () => {
      const { rollupMetric } = await loadRollupMetric();
      const VALUE = 3;
      const TOTAL_WEIGHT = 5;
      const AP = 3;
      const TDP = 3;

      const subTasks = [
        createComputedMetricResult({
          value: VALUE,
          totalWeight: TOTAL_WEIGHT,
          applicableDataPoints: AP,
          totalDataPoints: TDP,
        }),
      ];

      const result = rollupMetric(subTasks, 'completeness');

      expect(result.state).toBe('computed');
      if (result.state === 'computed') {
        expect(result.value).toBe(VALUE);
        expect(result.totalWeight).toBe(TOTAL_WEIGHT);
        expect(result.applicableDataPoints).toBe(AP);
        expect(result.totalDataPoints).toBe(TDP);
      }
    });

    it('returns notAttempted sub-task as-is', async () => {
      const { rollupMetric } = await loadRollupMetric();
      const TOTAL_WEIGHT = 2;
      const TDP = 3;

      const subTasks = [
        createNotAttemptedMetricResult({ totalWeight: TOTAL_WEIGHT, totalDataPoints: TDP }),
      ];

      const result = rollupMetric(subTasks, 'completeness');

      expect(result.state).toBe('notAttempted');
      if (result.state === 'notAttempted') {
        expect(result.value).toBe('N');
        expect(result.totalWeight).toBe(TOTAL_WEIGHT);
        expect(result.totalDataPoints).toBe(TDP);
      }
    });
  });

  // -----------------------------------------------------------------------
  // Metadata accumulation across states — error wins and sums metadata
  // -----------------------------------------------------------------------

  describe('metadata accumulation across states', () => {
    it('accumulates totalWeight and totalDataPoints from computed and notAttempted sub-tasks, excluding error', async () => {
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

      const EXPECTED_TOTAL_WEIGHT = 3;
      const EXPECTED_TOTAL_DATA_POINTS = 4;
      const result = rollupMetric(subTasks, 'completeness');
      // totalWeightedSum = 3*1 = 3
      // computedTotalWeight = 1, naTotalWeight = 2 → finalTotalWeight = 3
      // computedTd = 1, naTotalDataPoints = 3 → finalTotalDataPoints = 4
      // value = 3/3 = 1, ap = min(1, 4) = 1
      expect(result.state).toBe('computed');
      if (result.state === 'computed') {
        expect(result.value).toBeCloseTo(1, FLOAT_TOLERANCE);
        expect(result.totalWeight).toBeCloseTo(EXPECTED_TOTAL_WEIGHT, FLOAT_TOLERANCE);
        expect(result.applicableDataPoints).toBe(1);
        expect(result.totalDataPoints).toBe(EXPECTED_TOTAL_DATA_POINTS);
      }
    });
  });
});
