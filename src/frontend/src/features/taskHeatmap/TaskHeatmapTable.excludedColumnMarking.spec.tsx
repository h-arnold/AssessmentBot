/**
 * Tests for the shared excluded-column visual language of `TaskHeatmapTable`.
 *
 * The edge classes, the group chrome and the composed labels do not depend on
 * the marking cause: a baseline-off column with positive weighting renders the
 * same chrome as a zero-weighted one, and a co-occurring column composes the
 * baseline fact before the zero-weight fact. Helper-level cases pin
 * `getExcludedMetricEdgeClass` directly; DOM cases render the full table
 * through the embedded render helpers, which clone the shared
 * `buildHeatmapResult` fixture and mark the excluded column locally.
 *
 * @see docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md §3.7
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TaskHeatmapTable } from './TaskHeatmapTable';
import { buildHeatmapResult } from '@/test/taskHeatmapTableTestHelpers';
import {
  BASELINE_CAPTION,
  BASELINE_MARKER,
  BASELINE_OFF_EXPLANATION,
  EXCLUDED_COLUMN_FIRST_CLASS,
  EXCLUDED_COLUMN_GROUP_CLASS,
  EXCLUDED_COLUMN_LAST_CLASS,
  ZERO_WEIGHT_EXPLANATION,
  getExcludedMetricEdgeClass,
} from './taskHeatmapColumnMarking';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let user: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  user = userEvent.setup();
});

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Embedded render helpers
// ---------------------------------------------------------------------------

/**
 * Render a locally cloned embedded result whose first task sits outside the
 * attempt baseline while keeping a positive weighting.
 * @returns {ReturnType<typeof render>} The rendered table.
 */
function renderEmbeddedBaselineOffTable() {
  const base = buildHeatmapResult();
  const result = {
    ...base,
    taskColumns: base.taskColumns.map((column, index) =>
      index === 0 ? { ...column, includedInAttemptBaseline: false } : { ...column }
    ),
    rows: base.rows.map((row) => ({ ...row, cells: [...row.cells] })),
  };

  return render(
    <TaskHeatmapTable
      heatmapResult={result}
      cellPreviewLookup={null}
      isAssignmentLoading={false}
      showAssignmentError={false}
    />
  );
}

/**
 * Render a locally cloned embedded result whose first task is both
 * zero-weight and outside the attempt baseline.
 * @returns {ReturnType<typeof render>} The rendered table.
 */
function renderEmbeddedCoOccurringTable() {
  const base = buildHeatmapResult();
  const result = {
    ...base,
    taskColumns: base.taskColumns.map((column, index) => {
      return index === 0
        ? {
            ...column,
            averageContribution: { effectiveWeight: 0, includedInAverage: false },
            includedInAttemptBaseline: false,
          }
        : { ...column };
    }),
    rows: base.rows.map((row) => ({ ...row, cells: [...row.cells] })),
  };

  return render(
    <TaskHeatmapTable
      heatmapResult={result}
      cellPreviewLookup={null}
      isAssignmentLoading={false}
      showAssignmentError={false}
    />
  );
}

// ===========================================================================
// Tests
// ===========================================================================

describe('shared visual language across marking causes', () => {
  /** Weighting that contributes to averages (the baseline-off column default). */
  const POSITIVE_CONTRIBUTION = { effectiveWeight: 1, includedInAverage: true };
  /** Metric sub-column count of a full task group. */
  const THREE_METRICS = 3;
  /** Zero-based index of the last metric in a three-metric group. */
  const LAST_METRIC_INDEX = 2;
  /** Single-metric group count used for the both-edges case. */
  const SINGLE_METRIC_GROUP = 1;

  it('applies the zero-weight edge classes to a column outside the attempt baseline even when its weighting is positive', () => {
    const firstEdge = getExcludedMetricEdgeClass(0, THREE_METRICS, POSITIVE_CONTRIBUTION, {
      includedInAttemptBaseline: false,
    });
    expect(firstEdge).toBeDefined();
    expect(firstEdge).toContain(EXCLUDED_COLUMN_FIRST_CLASS);
    expect(
      getExcludedMetricEdgeClass(1, THREE_METRICS, POSITIVE_CONTRIBUTION, {
        includedInAttemptBaseline: false,
      })
    ).toBeUndefined();
    expect(
      getExcludedMetricEdgeClass(LAST_METRIC_INDEX, THREE_METRICS, POSITIVE_CONTRIBUTION, {
        includedInAttemptBaseline: false,
      })
    ).toContain(EXCLUDED_COLUMN_LAST_CLASS);
    const singleMetricEdge = getExcludedMetricEdgeClass(
      0,
      SINGLE_METRIC_GROUP,
      POSITIVE_CONTRIBUTION,
      { includedInAttemptBaseline: false }
    );
    expect(singleMetricEdge).toContain(EXCLUDED_COLUMN_FIRST_CLASS);
    expect(singleMetricEdge).toContain(EXCLUDED_COLUMN_LAST_CLASS);
  });

  it('applies the identical edge classes when zero weighting and baseline exclusion co-occur', () => {
    const zeroWeightContribution = { effectiveWeight: 0, includedInAverage: false };
    const zeroWeightOnly = getExcludedMetricEdgeClass(
      0,
      SINGLE_METRIC_GROUP,
      zeroWeightContribution,
      {
        includedInAttemptBaseline: true,
      }
    );
    const coOccurring = getExcludedMetricEdgeClass(0, SINGLE_METRIC_GROUP, zeroWeightContribution, {
      includedInAttemptBaseline: false,
    });

    // One visual language: the cause never changes the chrome.
    expect(coOccurring).toBe(zeroWeightOnly);
    expect(coOccurring).toContain(EXCLUDED_COLUMN_FIRST_CLASS);
    expect(coOccurring).toContain(EXCLUDED_COLUMN_LAST_CLASS);
  });

  it('applies the shared edge classes to baseline-off metric headers and body cells', () => {
    const { container } = renderEmbeddedBaselineOffTable();

    const markedSpan = screen.getByRole('group');
    expect(markedSpan.textContent).toBe(`Task 1${BASELINE_MARKER}`);
    expect(markedSpan.closest('th')).toHaveClass(EXCLUDED_COLUMN_GROUP_CLASS);

    const metricHeaders = screen.getAllByRole('columnheader', {
      name: /completeness|accuracy|spag/i,
    });
    expect(metricHeaders[0]).toHaveClass(EXCLUDED_COLUMN_FIRST_CLASS);
    expect(metricHeaders[2]).toHaveClass(EXCLUDED_COLUMN_LAST_CLASS);
    expect(metricHeaders[3]).not.toHaveClass(EXCLUDED_COLUMN_FIRST_CLASS);

    const bodyCells = [...container.querySelectorAll(':scope tbody tr[data-row-key="s-1"] td')];
    expect(bodyCells[2]).toHaveClass(EXCLUDED_COLUMN_FIRST_CLASS);
    expect(bodyCells[4]).toHaveClass(EXCLUDED_COLUMN_LAST_CLASS);
    expect(bodyCells[5]).not.toHaveClass(EXCLUDED_COLUMN_FIRST_CLASS);
  });

  it('renders one composed tooltip with the baseline fact before the zero-weight fact when both causes co-occur', async () => {
    renderEmbeddedCoOccurringTable();

    const markedSpan = screen.getByRole('group');
    expect(markedSpan.textContent).toBe(`Task 1${BASELINE_MARKER}`);

    // The focusable target's aria-label carries both facts, baseline first.
    const spanLabel = markedSpan.getAttribute('aria-label') ?? '';
    expect(spanLabel).toContain(BASELINE_OFF_EXPLANATION);
    expect(spanLabel).toContain(ZERO_WEIGHT_EXPLANATION);
    expect(spanLabel.indexOf(BASELINE_OFF_EXPLANATION)).toBeLessThan(
      spanLabel.indexOf(ZERO_WEIGHT_EXPLANATION)
    );

    // The header cell aria-label follows the same order.
    const headerLabel = markedSpan.closest('th')?.getAttribute('aria-label') ?? '';
    expect(headerLabel.indexOf(BASELINE_OFF_EXPLANATION)).toBeLessThan(
      headerLabel.indexOf(ZERO_WEIGHT_EXPLANATION)
    );

    // One composed tooltip body — never two stacked tooltips.
    await user.hover(markedSpan);
    const tooltip = await screen.findByRole('tooltip');
    const tooltipText = tooltip.textContent ?? '';
    expect(tooltipText).toContain(BASELINE_OFF_EXPLANATION);
    expect(tooltipText).toContain(ZERO_WEIGHT_EXPLANATION);
    expect(tooltipText.indexOf(BASELINE_OFF_EXPLANATION)).toBeLessThan(
      tooltipText.indexOf(ZERO_WEIGHT_EXPLANATION)
    );

    // The marked column also brings the caption in.
    expect(screen.getByText(BASELINE_CAPTION)).toBeInTheDocument();
  });
});
