/**
 * Tests for the metric-state ranking helpers (`metricStateRank.ts`).
 *
 * @remarks
 * Covers the ascending and descending rank lookups over
 * `MetricResult['state']`, the direction-selecting rank resolver consumed by
 * state-aware metric column sorting in both the Class overview table and the
 * heatmap table, and the fallback rank applied to an unknown state.
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
import {
  METRIC_STATE_RANK_ASC,
  METRIC_STATE_RANK_DESC,
  getMetricStateRank,
} from './metricStateRank';

// Highest rank asserted against either rank map; hoisted into a named constant
// so assertions do not trip the no-magic-numbers gate.
const HIGHEST_METRIC_STATE_RANK = 2;

describe('metricStateRank', () => {
  // -------------------------------------------------------------------------
  // METRIC_STATE_RANK_ASC — ascending state ordering
  // -------------------------------------------------------------------------

  it('maps ascending ranks: computed 0, notAttempted 1, error 2', () => {
    expect(Object.fromEntries(METRIC_STATE_RANK_ASC)).toStrictEqual({
      computed: 0,
      notAttempted: 1,
      error: 2,
    });
  });

  // -------------------------------------------------------------------------
  // METRIC_STATE_RANK_DESC — descending state ordering
  // -------------------------------------------------------------------------

  it('maps descending ranks: error 0, notAttempted 1, computed 2', () => {
    expect(Object.fromEntries(METRIC_STATE_RANK_DESC)).toStrictEqual({
      error: 0,
      notAttempted: 1,
      computed: 2,
    });
  });

  // -------------------------------------------------------------------------
  // getMetricStateRank — direction-selecting rank resolver
  // -------------------------------------------------------------------------

  it('returns the mapped rank for each state in both sort directions', () => {
    const computed: MetricResult = createComputedMetricResult();
    const notAttempted: MetricResult = createNotAttemptedMetricResult();
    const error: MetricResult = createErrorMetricResult();

    // Ascending: computed (0) -> notAttempted (1) -> error (HIGHEST_METRIC_STATE_RANK)
    expect(getMetricStateRank(computed, 'asc')).toBe(0);
    expect(getMetricStateRank(notAttempted, 'asc')).toBe(1);
    expect(getMetricStateRank(error, 'asc')).toBe(HIGHEST_METRIC_STATE_RANK);

    // Descending: error (0) -> notAttempted (1) -> computed (HIGHEST_METRIC_STATE_RANK)
    expect(getMetricStateRank(error, 'desc')).toBe(0);
    expect(getMetricStateRank(notAttempted, 'desc')).toBe(1);
    expect(getMetricStateRank(computed, 'desc')).toBe(HIGHEST_METRIC_STATE_RANK);
  });

  // -------------------------------------------------------------------------
  // Unknown-state fallback
  // -------------------------------------------------------------------------

  it('falls back to rank 0 for an unknown metric state', () => {
    // The MetricResult union is closed, so an out-of-union state needs a
    // minimal local cast to exercise the `?? 0` fallback branch.
    const unknownStateMetric = {
      ...createComputedMetricResult(),
      state: 'unknown',
    } as unknown as MetricResult;

    expect(getMetricStateRank(unknownStateMetric, 'asc')).toBe(0);
    expect(getMetricStateRank(unknownStateMetric, 'desc')).toBe(0);
  });
});
