/**
 * Tests for `buildStudentAveragesTableColumns` — column definitions
 * for the Student Averages table.
 *
 * @see SPEC_CLASS_PAGE.md — "studentAveragesTableColumns"
 * @see CLASS_PAGE_LAYOUT.md — "4a. Column Filter Details"
 * @see ACTION_PLAN.md §5 — Required test cases 1-5
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  buildStudentAveragesTableColumns,
} from './studentAveragesTableColumns';
import type { StudentAveragesTableFilters } from './studentAveragesTableColumns';
import type { StudentAverageRowModel } from './classPageAdapter.zod';
import { metricInRange } from '../../services/dataAnalysis/metricDisplay/metricRangeFilter';
import {
  createComputedMetricResult,
  createNotAttemptedMetricResult,
  createErrorMetricResult,
} from '../../test/dataAnalysis/fixtures';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Expected column keys in order. */
const EXPECTED_COLUMN_KEYS = [
  'studentName',
  'completeness',
  'accuracy',
  'spag',
  'average',
] as const;

/** Expected column header accessible names in order. */
const EXPECTED_COLUMN_HEADERS = [
  'Student Name',
  'Completeness',
  'Accuracy',
  'SPaG',
  'Average',
] as const;

/** Metric column keys (the four metric columns, not studentName). */
const METRIC_COLUMN_KEYS = ['completeness', 'accuracy', 'spag', 'average'] as const;

// ---------------------------------------------------------------------------
// Score‑range magic‑number constants (avoids @typescript-eslint/no-magic-numbers)
// ---------------------------------------------------------------------------

/** Lower bound for the "inside the range" test. */
const RANGE_LOWER = 2;
/** Upper bound for the "inside the range" test. */
const RANGE_UPPER = 4;
/** Alternative upper bound for edge‑case test. */
const RANGE_UPPER_ALT = 5;
/** Value below RANGE_LOWER used for the "outside the range" test. */
const BELOW_RANGE = 1;
/** Value above range used for the "outside the range" test. */
const ABOVE_RANGE = 5.1;

// ---------------------------------------------------------------------------
// Default filters (empty — no filter active)
// ---------------------------------------------------------------------------

/** Empty filters: no column has an active range filter selection. */
const EMPTY_FILTERS = {
  completeness: [] as readonly string[],
  accuracy: [] as readonly string[],
  spag: [] as readonly string[],
  average: [] as readonly string[],
};

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/**
 * Build a valid StudentAverageRowModel for tests.
 *
 * @param {Partial<StudentAverageRowModel>} [overrides] - Optional overrides.
 * @returns {StudentAverageRowModel} A StudentAverageRowModel fixture.
 */
function buildRow(overrides: Partial<StudentAverageRowModel> = {}): StudentAverageRowModel {
  return {
    studentId: 's-1',
    studentName: 'Alice',
    metrics: {
      completeness: createComputedMetricResult({ value: 4 }),
      accuracy: createComputedMetricResult({ value: 3 }),
      spag: createComputedMetricResult({ value: 3.5 }),
      average: createComputedMetricResult({ value: 3.7 }),
    },
    ...overrides,
  };
}

// ===========================================================================
// Tests
// ===========================================================================

describe('buildStudentAveragesTableColumns', () => {
  // -----------------------------------------------------------------------
  // Column count and headers
  // -----------------------------------------------------------------------
  it('returns five columns with correct keys and headers', () => {
    const columns = buildStudentAveragesTableColumns(EMPTY_FILTERS);

    expect(columns).toHaveLength(EXPECTED_COLUMN_KEYS.length);

    columns.forEach((column, index) => {
      expect(column.key).toBe(EXPECTED_COLUMN_KEYS[index]);
      const expectedHeader = EXPECTED_COLUMN_HEADERS[index];
      // The studentName column (index 0) still has a plain string title;
      // metric columns (indices 1-4) have a MetricIconLabel title (JSX).
      if (index === 0) {
        expect(column.title).toBe(expectedHeader);
      } else {
        // Render the JSX title element and check the SVG's aria-label via
        // querySelector (getByLabelText does not resolve <svg aria-label="…">
        // in the happy‑dom stack).
        const { container, unmount } = render(
          <>{column.title as unknown as React.ReactElement}</>
        );
        const headerElement = container.ownerDocument.querySelector(
          `[aria-label="${expectedHeader}"]`
        );
        expect(headerElement).not.toBeNull();
        unmount();
      }
    });
  });

  // -----------------------------------------------------------------------
  // studentName column has no filter properties
  // -----------------------------------------------------------------------
  it('studentName column has no filters/filteredValue/onFilter', () => {
    const columns = buildStudentAveragesTableColumns(EMPTY_FILTERS);
    const nameColumn = columns.find((c) => c.key === 'studentName');

    expect(nameColumn).toBeDefined();
    expect(nameColumn!.filters).toBeUndefined();
    expect(nameColumn!.filteredValue).toBeUndefined();
    expect(nameColumn!.onFilter).toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // Metric columns expose a score-range filter (no fixed band list)
  // -----------------------------------------------------------------------
  it.each(METRIC_COLUMN_KEYS)(
    'the %s column exposes a range filterDropdown and onFilter',
    (columnKey: string) => {
      const columns = buildStudentAveragesTableColumns(EMPTY_FILTERS);
      const metricColumn = columns.find((c) => c.key === columnKey);

      expect(metricColumn).toBeDefined();
      expect(typeof metricColumn!.filterDropdown).toBe('function');
      expect(metricColumn!.onFilter).toBeDefined();
      expect(metricColumn!.filters).toBeUndefined();
    }
  );

  // -----------------------------------------------------------------------
  // metricInRange predicate
  // -----------------------------------------------------------------------
  describe('metricInRange predicate', () => {
    it('matches computed values inside the range', () => {
      expect(metricInRange(createComputedMetricResult({ value: 3 }), RANGE_LOWER, RANGE_UPPER)).toBe(true);
      expect(metricInRange(createComputedMetricResult({ value: 4 }), RANGE_UPPER, RANGE_UPPER_ALT)).toBe(true);
    });

    it('excludes computed values outside the range', () => {
      expect(metricInRange(createComputedMetricResult({ value: BELOW_RANGE }), RANGE_LOWER, RANGE_UPPER)).toBe(false);
      expect(metricInRange(createComputedMetricResult({ value: ABOVE_RANGE }), 0, RANGE_UPPER_ALT)).toBe(false);
    });

    it('excludes notAttempted and error metrics', () => {
      expect(metricInRange(createNotAttemptedMetricResult(), 0, RANGE_UPPER_ALT)).toBe(false);
      expect(metricInRange(createErrorMetricResult(), 0, RANGE_UPPER_ALT)).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Column onFilter (range key) integration
  // -----------------------------------------------------------------------
  describe('column onFilter', () => {
    it('matches a record within the encoded range and rejects outside it', () => {
      const columns = buildStudentAveragesTableColumns(EMPTY_FILTERS);
      const completenessColumn = columns.find((c) => c.key === 'completeness')!;
      expect(completenessColumn.onFilter).toBeDefined();

      const record = buildRow({
        metrics: {
          completeness: createComputedMetricResult({ value: 4 }),
          accuracy: createComputedMetricResult({ value: 3 }),
          spag: createComputedMetricResult({ value: 3.5 }),
          average: createComputedMetricResult({ value: 3.7 }),
        },
      });

      // Encoded range key is `${min}|${max}` (see metricRangeFilter).
      expect(completenessColumn.onFilter!('0|5', record)).toBe(true);
      expect(completenessColumn.onFilter!('4|5', record)).toBe(true);
      expect(completenessColumn.onFilter!('0|3', record)).toBe(false);
    });

    it('rejects notAttempted under an active range filter', () => {
      const columns = buildStudentAveragesTableColumns(EMPTY_FILTERS);
      const completenessColumn = columns.find((c) => c.key === 'completeness')!;

      const record = buildRow({
        metrics: {
          completeness: createNotAttemptedMetricResult(),
          accuracy: createComputedMetricResult({ value: 3 }),
          spag: createComputedMetricResult({ value: 3.5 }),
          average: createComputedMetricResult({ value: 3.7 }),
        },
      });

      expect(completenessColumn.onFilter!('0|5', record)).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Average column renders plain <span> with the score (no MetricPill)
  // -----------------------------------------------------------------------
  it('Average column renders plain span with score', () => {
    const columns = buildStudentAveragesTableColumns(EMPTY_FILTERS);
    const averageColumn = columns.find((c) => c.key === 'average');
    expect(averageColumn).toBeDefined();
    expect(averageColumn!.render).toBeDefined();

    const record = buildRow();
    const renderedElement = averageColumn!.render!(null, record, 0);

    render(<>{renderedElement}</>);
    expect(screen.getByText('3.70')).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // studentName column renders plain Typography.Text
  // -----------------------------------------------------------------------
  it('studentName column renders plain Typography.Text with the student name', () => {
    const columns = buildStudentAveragesTableColumns(EMPTY_FILTERS);
    const nameColumn = columns.find((c) => c.key === 'studentName');
    expect(nameColumn).toBeDefined();
    expect(nameColumn!.render).toBeDefined();

    const record = buildRow({ studentId: 's-1', studentName: 'Alice' });
    const renderedElement = nameColumn!.render!('Alice', record, 0);

    render(<>{renderedElement}</>);
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // activeFilterKey: raw encoded key is preserved, N/E toggles honoured
  // -----------------------------------------------------------------------
  describe('activeFilterKey code path', () => {
    /** Encoded key: min=2, max=4, includeNotAttempted=1, includeError=0. */
    const ENCODED_KEY_INCLUDE_N = '2|4|1|0';
    /** Encoded key: min=2, max=4, includeNotAttempted=0, includeError=1. */
    const ENCODED_KEY_INCLUDE_E = '2|4|0|1';

    /** Filters with a populated encoded key for completeness. */
    const POPULATED_FILTERS: StudentAveragesTableFilters = {
      completeness: [ENCODED_KEY_INCLUDE_N],
      accuracy: [] as readonly string[],
      spag: [] as readonly string[],
      average: [] as readonly string[],
    };

    it('preserves the raw encoded key as filteredValue', () => {
      const columns = buildStudentAveragesTableColumns(POPULATED_FILTERS);
      const completenessColumn = columns.find((c) => c.key === 'completeness')!;

      expect(completenessColumn.filteredValue).toEqual([ENCODED_KEY_INCLUDE_N]);
    });

    it('keeps notAttempted rows when includeN=1 and drops them when includeN=0', () => {
      const columns = buildStudentAveragesTableColumns(POPULATED_FILTERS);
      const completenessColumn = columns.find((c) => c.key === 'completeness')!;

      const record = buildRow({
        metrics: {
          completeness: createNotAttemptedMetricResult(),
          accuracy: createComputedMetricResult({ value: 3 }),
          spag: createComputedMetricResult({ value: 3.5 }),
          average: createComputedMetricResult({ value: 3.7 }),
        },
      });

      // includeN=1: notAttempted should pass
      expect(completenessColumn.onFilter!(ENCODED_KEY_INCLUDE_N, record)).toBe(true);

      // includeN=0: notAttempted should be dropped
      expect(completenessColumn.onFilter!(ENCODED_KEY_INCLUDE_E, record)).toBe(false);
    });

    it('keeps error rows when includeE=1 and drops them when includeE=0', () => {
      const columns = buildStudentAveragesTableColumns(POPULATED_FILTERS);
      const completenessColumn = columns.find((c) => c.key === 'completeness')!;

      const record = buildRow({
        metrics: {
          completeness: createErrorMetricResult(),
          accuracy: createComputedMetricResult({ value: 3 }),
          spag: createComputedMetricResult({ value: 3.5 }),
          average: createComputedMetricResult({ value: 3.7 }),
        },
      });

      // includeE=1 (ENCODED_KEY_INCLUDE_E): error should pass
      expect(completenessColumn.onFilter!(ENCODED_KEY_INCLUDE_E, record)).toBe(true);

      // includeE=0 (ENCODED_KEY_INCLUDE_N): error should be dropped
      expect(completenessColumn.onFilter!(ENCODED_KEY_INCLUDE_N, record)).toBe(false);
    });

    it('filters computed values correctly with the preserved key', () => {
      const columns = buildStudentAveragesTableColumns(POPULATED_FILTERS);
      const completenessColumn = columns.find((c) => c.key === 'completeness')!;

      // Record inside range (value=3, inside 2-4)
      const inRangeRecord = buildRow({
        metrics: {
          completeness: createComputedMetricResult({ value: 3 }),
          accuracy: createComputedMetricResult({ value: 3 }),
          spag: createComputedMetricResult({ value: 3.5 }),
          average: createComputedMetricResult({ value: 3.7 }),
        },
      });
      expect(completenessColumn.onFilter!(ENCODED_KEY_INCLUDE_N, inRangeRecord)).toBe(true);

      // Record below range (value=1, outside 2-4)
      const belowRangeRecord = buildRow({
        metrics: {
          completeness: createComputedMetricResult({ value: 1 }),
          accuracy: createComputedMetricResult({ value: 3 }),
          spag: createComputedMetricResult({ value: 3.5 }),
          average: createComputedMetricResult({ value: 3.7 }),
        },
      });
      expect(completenessColumn.onFilter!(ENCODED_KEY_INCLUDE_N, belowRangeRecord)).toBe(false);

      // Record above range (value=5, outside 2-4)
      const aboveRangeRecord = buildRow({
        metrics: {
          completeness: createComputedMetricResult({ value: 5 }),
          accuracy: createComputedMetricResult({ value: 3 }),
          spag: createComputedMetricResult({ value: 3.5 }),
          average: createComputedMetricResult({ value: 3.7 }),
        },
      });
      expect(completenessColumn.onFilter!(ENCODED_KEY_INCLUDE_N, aboveRangeRecord)).toBe(false);
    });
  });
});
