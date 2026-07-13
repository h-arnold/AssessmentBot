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
  'SpAG',
  'Average',
] as const;

/** Metric column keys (the four metric columns, not studentName). */
const METRIC_COLUMN_KEYS = ['completeness', 'accuracy', 'spag', 'average'] as const;

/** Bold font weight applied when `emphasised` is true on MetricPill. */
const EMPHASISED_FONT_WEIGHT = 600;

// ---------------------------------------------------------------------------
// Default filters (empty — no filter active)
// ---------------------------------------------------------------------------

/** Empty filters: no column has an active range filter selection. */
const EMPTY_FILTERS = {
  completeness: [] as readonly number[],
  accuracy: [] as readonly number[],
  spag: [] as readonly number[],
  average: [] as readonly number[],
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
        // Render the JSX title element and verify the accessible label
        const { unmount } = render(<>{column.title as unknown as React.ReactElement}</>);
        expect(screen.getByLabelText(expectedHeader)).toBeInTheDocument();
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
      expect(metricInRange(createComputedMetricResult({ value: 3 }), 2, 4)).toBe(true);
      expect(metricInRange(createComputedMetricResult({ value: 4 }), 4, 5)).toBe(true);
    });

    it('excludes computed values outside the range', () => {
      expect(metricInRange(createComputedMetricResult({ value: 1 }), 2, 4)).toBe(false);
      expect(metricInRange(createComputedMetricResult({ value: 5.1 }), 0, 5)).toBe(false);
    });

    it('excludes notAttempted and error metrics', () => {
      expect(metricInRange(createNotAttemptedMetricResult(), 0, 5)).toBe(false);
      expect(metricInRange(createErrorMetricResult(), 0, 5)).toBe(false);
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
  // Average column uses emphasised={true}
  // -----------------------------------------------------------------------
  it('Average column uses emphasised={true} on the MetricPill', () => {
    const columns = buildStudentAveragesTableColumns(EMPTY_FILTERS);
    const averageColumn = columns.find((c) => c.key === 'average');
    expect(averageColumn).toBeDefined();
    expect(averageColumn!.render).toBeDefined();

    const record = buildRow();
    const renderedElement = averageColumn!.render!(null, record, 0);

    const { container } = render(<>{renderedElement}</>);
    const tags = container.querySelectorAll('.ant-tag');
    expect(tags).toHaveLength(1);

    // emphasised={true} applies fontWeight: 600 as an inline style
    expect(tags[0]).toHaveStyle({ fontWeight: EMPHASISED_FONT_WEIGHT });
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
});
