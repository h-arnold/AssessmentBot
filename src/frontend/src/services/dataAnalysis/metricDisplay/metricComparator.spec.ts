/**
 * Tests for the shared state-aware metric comparator (`metricComparator.ts`).
 *
 * @remarks
 * Covers the full ordering composition consumed by state-aware metric column
 * sorting in both the Class overview table and the heatmap table:
 * direction-aware state ranking, numeric value comparison within the computed
 * band, and the ascending row-id ultimate tie-break.
 *
 * @see SPEC.md decisions 3-4 — shared services-layer placement
 */

import { describe, expect, it } from 'vitest';
import type { MetricResult } from '../dataAnalysis.zod';
import {
  createComputedMetricResult,
  createNotAttemptedMetricResult,
  createErrorMetricResult,
} from '../../../test/dataAnalysis/fixtures';
import { compareMetricsByStateRank } from './metricComparator';

// Fixture scores chosen so value ordering within the computed band is
// unambiguous; hoisted into named constants for self-documenting assertions.
const LOW_SCORE = 2;
const HIGH_SCORE = 8;

/** Row identifiers used to exercise the ascending id tie-break. */
const ID_AAA = 'id-aaa';
const ID_ZZZ = 'id-zzz';

describe('compareMetricsByStateRank', () => {
  // -------------------------------------------------------------------------
  // State-band ordering (direction-aware)
  // -------------------------------------------------------------------------

  it('orders state bands ascending: computed before notAttempted before error', () => {
    const computed = createComputedMetricResult({ value: HIGH_SCORE });
    const notAttempted = createNotAttemptedMetricResult();
    const error = createErrorMetricResult();

    // Identifiers are identical so every non-zero sign comes from the rank band
    expect(compareMetricsByStateRank(computed, notAttempted, ID_AAA, ID_AAA, 'asc')).toBeLessThan(
      0
    );
    expect(compareMetricsByStateRank(notAttempted, error, ID_AAA, ID_AAA, 'asc')).toBeLessThan(0);
    expect(compareMetricsByStateRank(computed, error, ID_AAA, ID_AAA, 'asc')).toBeLessThan(0);
    // Antisymmetry across swapped arguments
    expect(compareMetricsByStateRank(error, notAttempted, ID_AAA, ID_AAA, 'asc')).toBeGreaterThan(
      0
    );
  });

  it('reverses state-band ordering when direction is desc: error before notAttempted before computed', () => {
    const computed = createComputedMetricResult({ value: LOW_SCORE });
    const notAttempted = createNotAttemptedMetricResult();
    const error = createErrorMetricResult();

    expect(compareMetricsByStateRank(error, notAttempted, ID_AAA, ID_AAA, 'desc')).toBeLessThan(0);
    expect(compareMetricsByStateRank(notAttempted, computed, ID_AAA, ID_AAA, 'desc')).toBeLessThan(
      0
    );
    expect(compareMetricsByStateRank(error, computed, ID_AAA, ID_AAA, 'desc')).toBeLessThan(0);
    // Antisymmetry across swapped arguments
    expect(
      compareMetricsByStateRank(computed, notAttempted, ID_AAA, ID_AAA, 'desc')
    ).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // Numeric value comparison within the computed band (direction-aware)
  // -------------------------------------------------------------------------

  it('orders computed values ascending when direction is asc', () => {
    const low = createComputedMetricResult({ value: LOW_SCORE });
    const high = createComputedMetricResult({ value: HIGH_SCORE });

    expect(compareMetricsByStateRank(low, high, ID_ZZZ, ID_ZZZ, 'asc')).toBeLessThan(0);
    expect(compareMetricsByStateRank(high, low, ID_ZZZ, ID_ZZZ, 'asc')).toBeGreaterThan(0);
  });

  it('orders computed values descending when direction is desc', () => {
    const low = createComputedMetricResult({ value: LOW_SCORE });
    const high = createComputedMetricResult({ value: HIGH_SCORE });

    expect(compareMetricsByStateRank(high, low, ID_ZZZ, ID_ZZZ, 'desc')).toBeLessThan(0);
    expect(compareMetricsByStateRank(low, high, ID_ZZZ, ID_ZZZ, 'desc')).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // Ultimate tie-break — row id ascending regardless of direction
  // -------------------------------------------------------------------------

  it('tie-breaks equal computed values by row id ascending in both directions', () => {
    const first = createComputedMetricResult({ value: HIGH_SCORE });
    const second = createComputedMetricResult({ value: HIGH_SCORE });

    // Same value — id-aaa must sort before id-zzz even though ids are passed
    // "backwards" relative to the argument order
    expect(compareMetricsByStateRank(first, second, ID_ZZZ, ID_AAA, 'asc')).toBeGreaterThan(0);
    // The descending direction flips ranks and values but never the id tie-break
    expect(compareMetricsByStateRank(first, second, ID_ZZZ, ID_AAA, 'desc')).toBeGreaterThan(0);
  });

  it('tie-breaks equal non-computed states by row id ascending', () => {
    const firstError = createErrorMetricResult();
    const secondError = createErrorMetricResult();
    const firstNotAttempted = createNotAttemptedMetricResult();
    const secondNotAttempted = createNotAttemptedMetricResult();

    expect(
      compareMetricsByStateRank(firstError, secondError, ID_ZZZ, ID_AAA, 'asc')
    ).toBeGreaterThan(0);
    expect(
      compareMetricsByStateRank(firstNotAttempted, secondNotAttempted, ID_ZZZ, ID_AAA, 'asc')
    ).toBeGreaterThan(0);
  });

  it('returns zero only when both metrics and identifiers are equal', () => {
    const first = createComputedMetricResult({ value: HIGH_SCORE });
    const second = createComputedMetricResult({ value: HIGH_SCORE });

    expect(compareMetricsByStateRank(first, second, ID_AAA, ID_AAA, 'asc')).toBe(0);
    expect(compareMetricsByStateRank(first, second, ID_AAA, ID_AAA, 'desc')).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Unknown-state fallback flowing through the composition
  // -------------------------------------------------------------------------

  it('treats an unknown state as rank 0: tying with computed in asc, but below it in desc', () => {
    // The MetricResult union is closed, so an out-of-union state needs a
    // minimal local cast to exercise the `?? 0` fallback branch inherited
    // from `getMetricStateRank`.
    const unknownStateMetric = {
      ...createComputedMetricResult(),
      state: 'unknown',
    } as unknown as MetricResult;

    const computed = createComputedMetricResult({ value: HIGH_SCORE });

    // Ascending: both resolve to rank 0, so ordering falls through to the id
    // tie-break — swapping the ids flips the sign
    expect(
      compareMetricsByStateRank(unknownStateMetric, computed, ID_AAA, ID_ZZZ, 'asc')
    ).toBeLessThan(0);
    expect(
      compareMetricsByStateRank(unknownStateMetric, computed, ID_ZZZ, ID_AAA, 'asc')
    ).toBeGreaterThan(0);

    // Descending: computed ranks HIGHEST_METRIC_STATE_RANK, the unknown state
    // still falls back to 0, so the unknown-state result sorts first
    expect(
      compareMetricsByStateRank(unknownStateMetric, computed, ID_AAA, ID_ZZZ, 'desc')
    ).toBeLessThan(0);
    expect(
      compareMetricsByStateRank(unknownStateMetric, computed, ID_ZZZ, ID_AAA, 'desc')
    ).toBeLessThan(0);
  });
});
