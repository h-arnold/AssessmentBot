/**
 * Tests for the metric-state ranking helpers (`metricStateRank.ts`).
 *
 * @remarks
 * Covers the ascending and descending rank lookups over
 * `MetricResult['state']`, the direction-selecting rank resolver consumed by
 * state-aware metric column sorting in both the Class overview table and the
 * heatmap table, and fail-fast handling for an unknown state.
 *
 * @see SPEC.md decisions 3-4 — shared services-layer placement
 */

import { describe, expect, it } from 'vitest';
import type { MetricResult } from '../dataAnalysis.zod';
import {
  createComputedMetricResult,
  createNotAttemptedMetricResult,
  createErrorMetricResult,
  createExcludedMetricResult,
} from '../../../test/dataAnalysis/fixtures';
import {
  METRIC_STATE_RANK_ASC,
  METRIC_STATE_RANK_DESC,
  getMetricStateRank,
} from './metricStateRank';

// Highest rank asserted against either rank map; hoisted into a named constant
// so assertions do not trip the no-magic-numbers gate.
const HIGHEST_METRIC_STATE_RANK = 3;
const EXCLUDED_ASCENDING_RANK = 2;
const EXCLUDED_DESCENDING_RANK = 1;
const NOT_ATTEMPTED_DESCENDING_RANK = 2;

describe('metricStateRank', () => {
  // -------------------------------------------------------------------------
  // METRIC_STATE_RANK_ASC — ascending state ordering
  // -------------------------------------------------------------------------

  it('maps ascending ranks: computed, notAttempted, excluded, error', () => {
    expect(Object.fromEntries(METRIC_STATE_RANK_ASC)).toStrictEqual({
      computed: 0,
      notAttempted: 1,
      excluded: 2,
      error: 3,
    });
  });

  // -------------------------------------------------------------------------
  // METRIC_STATE_RANK_DESC — descending state ordering
  // -------------------------------------------------------------------------

  it('maps descending ranks: error, excluded, notAttempted, computed', () => {
    expect(Object.fromEntries(METRIC_STATE_RANK_DESC)).toStrictEqual({
      error: 0,
      excluded: 1,
      notAttempted: 2,
      computed: 3,
    });
  });

  // -------------------------------------------------------------------------
  // getMetricStateRank — direction-selecting rank resolver
  // -------------------------------------------------------------------------

  it('returns the mapped rank for each state in both sort directions', () => {
    const computed: MetricResult = createComputedMetricResult();
    const notAttempted: MetricResult = createNotAttemptedMetricResult();
    const error: MetricResult = createErrorMetricResult();
    const excluded: MetricResult = createExcludedMetricResult();

    // Ascending: computed -> notAttempted -> excluded -> error.
    expect(getMetricStateRank(computed, 'asc')).toBe(0);
    expect(getMetricStateRank(notAttempted, 'asc')).toBe(1);
    expect(getMetricStateRank(excluded, 'asc')).toBe(EXCLUDED_ASCENDING_RANK);
    expect(getMetricStateRank(error, 'asc')).toBe(HIGHEST_METRIC_STATE_RANK);

    // Descending: error -> excluded -> notAttempted -> computed.
    expect(getMetricStateRank(error, 'desc')).toBe(0);
    expect(getMetricStateRank(excluded, 'desc')).toBe(EXCLUDED_DESCENDING_RANK);
    expect(getMetricStateRank(notAttempted, 'desc')).toBe(NOT_ATTEMPTED_DESCENDING_RANK);
    expect(getMetricStateRank(computed, 'desc')).toBe(HIGHEST_METRIC_STATE_RANK);
  });

  // -------------------------------------------------------------------------
  // Unknown-state fail-fast behaviour
  // -------------------------------------------------------------------------

  it('throws instead of assigning a fallback rank to an unknown metric state', () => {
    // The MetricResult union is closed, so an out-of-union state needs a
    // minimal local cast to exercise the fail-fast boundary.
    const unknownStateMetric = {
      ...createComputedMetricResult(),
      state: 'unknown',
    } as unknown as MetricResult;

    expect(() => getMetricStateRank(unknownStateMetric, 'asc')).toThrow();
    expect(() => getMetricStateRank(unknownStateMetric, 'desc')).toThrow();
  });
});
