/**
 * Red-phase tests for `buildStudentAveragesTableColumns` — column definitions
 * for the Student Averages table.
 *
 * @remarks
 * These tests define the full behavioural contract of the columns function.
 * They will fail to import until the source module exists (red-phase).
 *
 * @see SPEC_CLASS_PAGE.md — "studentAveragesTableColumns"
 * @see CLASS_PAGE_LAYOUT.md — "4a. Column Filter Details"
 * @see ACTION_PLAN.md §5 — Required test cases 1-5
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import {
  buildStudentAveragesTableColumns,
} from './studentAveragesTableColumns';
import type { StudentAverageRowModel } from './classPageAdapter.zod';
import type { MetricResult } from '../../services/dataAnalysis/dataAnalysis.zod';
import { resolveMetricTone } from '../../services/dataAnalysis/metricDisplay/metricTone';
import {
  createComputedMetricResult,
  createNotAttemptedMetricResult,
  createErrorMetricResult,
} from '../../test/dataAnalysis/fixtures';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Minimal column shape used by these tests.
 *
 * @remarks
 * This local type mirrors the relevant subset of Ant Design's `ColumnType`
 * that the tests access. It is used only until `studentAveragesTableColumns.tsx`
 * exists and TypeScript can resolve the return type of `buildStudentAveragesTableColumns`.
 *
 * Once the source module is created, the `buildStudentAveragesTableColumns` return
 * type resolves and this local type can be replaced with the real column type.
 */
interface TestColumn {
  key?: string;
  title?: string;
  filters?: ReadonlyArray<{ text: string; value: string }>;
  filteredValue?: unknown;
  onFilter?: (value: string, record: StudentAverageRowModel) => boolean;
  render?: (value: unknown, record: StudentAverageRowModel, index: number) => ReactNode;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Expected filter entries for each metric column (in order). */
const EXPECTED_FILTERS: ReadonlyArray<{ text: string; value: string }> = [
  { text: 'Red (low)', value: 'red' },
  { text: 'Amber (mid)', value: 'gold' },
  { text: 'Green (high)', value: 'green' },
  { text: 'Not Attempted', value: 'default' },
  { text: 'Error', value: 'volcano' },
];

/** Expected column keys in order. */
const EXPECTED_COLUMN_KEYS = [
  'studentName',
  'completeness',
  'accuracy',
  'spag',
  'average',
] as const;

/** Expected column headers in order. */
const EXPECTED_COLUMN_HEADERS = [
  'Student Name',
  'Completeness',
  'Accuracy',
  'SpAG',
  'Average',
] as const;

/** The default scoring range used by the onFilter predicate. */
const DEFAULT_TONE_RANGE = { lower: 0, upper: 5 } as const;

/** Metric column keys (the four metric columns, not studentName). */
const METRIC_COLUMN_KEYS = ['completeness', 'accuracy', 'spag', 'average'] as const;

/** Bold font weight applied when `emphasised` is true on MetricPill. */
const EMPHASISED_FONT_WEIGHT = 600;

// ---------------------------------------------------------------------------
// Default filters (empty — no filter active)
// ---------------------------------------------------------------------------

/** Empty filters: no column has an active filter selection. */
const EMPTY_FILTERS = {
  completeness: [] as ReadonlyArray<string>,
  accuracy: [] as ReadonlyArray<string>,
  spag: [] as ReadonlyArray<string>,
  average: [] as ReadonlyArray<string>,
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
    const columns = buildStudentAveragesTableColumns(EMPTY_FILTERS) as TestColumn[];

    expect(columns).toHaveLength(EXPECTED_COLUMN_KEYS.length);

    columns.forEach((column: TestColumn, index: number) => {
      expect(column.key).toBe(EXPECTED_COLUMN_KEYS[index]);
      expect(column.title).toBe(EXPECTED_COLUMN_HEADERS[index]);
    });
  });

  // -----------------------------------------------------------------------
  // studentName column has no filter properties
  // -----------------------------------------------------------------------
  it('studentName column has no filters/filteredValue/onFilter', () => {
    const columns = buildStudentAveragesTableColumns(EMPTY_FILTERS) as TestColumn[];
    const nameColumn = columns.find((c: TestColumn) => c.key === 'studentName');

    expect(nameColumn).toBeDefined();
    expect(nameColumn!.filters).toBeUndefined();
    expect(nameColumn!.filteredValue).toBeUndefined();
    expect(nameColumn!.onFilter).toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // Metric columns have five filter entries
  // -----------------------------------------------------------------------
  it.each(METRIC_COLUMN_KEYS)(
    'the %s column has five filter entries with exact text/value pairs',
    (columnKey: string) => {
      const columns = buildStudentAveragesTableColumns(EMPTY_FILTERS) as TestColumn[];
      const metricColumn = columns.find((c: TestColumn) => c.key === columnKey);

      expect(metricColumn).toBeDefined();
      expect(metricColumn!.filters).toEqual(EXPECTED_FILTERS);
    }
  );

  // -----------------------------------------------------------------------
  // onFilter predicate
  // -----------------------------------------------------------------------
  describe('onFilter predicate', () => {
    it.each([
      {
        description: 'red band (computed with value 1) matches "red"',
        metricValue: createComputedMetricResult({ value: 1 }),
        filterValue: 'red',
        expected: true,
      },
      {
        description: 'red band (computed with value 1) does NOT match "green"',
        metricValue: createComputedMetricResult({ value: 1 }),
        filterValue: 'green',
        expected: false,
      },
      {
        description: 'green band (computed with value 5) matches "green"',
        metricValue: createComputedMetricResult({ value: 5 }),
        filterValue: 'green',
        expected: true,
      },
      {
        description: 'gold band (computed with value 2.5) matches "gold"',
        metricValue: createComputedMetricResult({ value: 2.5 }),
        filterValue: 'gold',
        expected: true,
      },
      {
        description: 'notAttempted matches "default"',
        metricValue: createNotAttemptedMetricResult(),
        filterValue: 'default',
        expected: true,
      },
      {
        description: 'notAttempted does NOT match "red"',
        metricValue: createNotAttemptedMetricResult(),
        filterValue: 'red',
        expected: false,
      },
      {
        description: 'error matches "volcano"',
        metricValue: createErrorMetricResult(),
        filterValue: 'volcano',
        expected: true,
      },
      {
        description: 'error does NOT match "red"',
        metricValue: createErrorMetricResult(),
        filterValue: 'red',
        expected: false,
      },
    ])(
      'onFilter for completeness column: $description',
      ({ metricValue, filterValue, expected }: { metricValue: MetricResult; filterValue: string; expected: boolean }) => {
        const columns = buildStudentAveragesTableColumns(EMPTY_FILTERS) as TestColumn[];
        const completenessColumn = columns.find((c: TestColumn) => c.key === 'completeness');
        expect(completenessColumn).toBeDefined();
        expect(completenessColumn!.onFilter).toBeDefined();

        const record = buildRow({
          metrics: {
            completeness: metricValue,
            accuracy: createComputedMetricResult({ value: 3 }),
            spag: createComputedMetricResult({ value: 3.5 }),
            average: createComputedMetricResult({ value: 3.7 }),
          },
        });

        expect(completenessColumn!.onFilter!(filterValue, record)).toBe(expected);
      }
    );

    it('onFilter uses resolveMetricTone with the correct range', () => {
      const columns = buildStudentAveragesTableColumns(EMPTY_FILTERS) as TestColumn[];
      const completenessColumn = columns.find((c: TestColumn) => c.key === 'completeness');
      expect(completenessColumn).toBeDefined();
      expect(completenessColumn!.onFilter).toBeDefined();

      // Value 1 maps to 'red' with default range { lower: 0, upper: 5 }
      const record = buildRow({
        metrics: {
          completeness: createComputedMetricResult({ value: 1 }),
          accuracy: createComputedMetricResult({ value: 3 }),
          spag: createComputedMetricResult({ value: 3.5 }),
          average: createComputedMetricResult({ value: 3.7 }),
        },
      });

      // Verify the expected tone colour matches the function output
      const expectedColour = resolveMetricTone(record.metrics.completeness, DEFAULT_TONE_RANGE).color;
      expect(completenessColumn!.onFilter!(expectedColour, record)).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Average column uses emphasised={true}
  // -----------------------------------------------------------------------
  it('Average column uses emphasised={true} on the MetricPill', () => {
    const columns = buildStudentAveragesTableColumns(EMPTY_FILTERS) as TestColumn[];
    const averageColumn = columns.find((c: TestColumn) => c.key === 'average');
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
    const columns = buildStudentAveragesTableColumns(EMPTY_FILTERS) as TestColumn[];
    const nameColumn = columns.find((c: TestColumn) => c.key === 'studentName');
    expect(nameColumn).toBeDefined();
    expect(nameColumn!.render).toBeDefined();

    const record = buildRow({ studentId: 's-1', studentName: 'Alice' });
    const renderedElement = nameColumn!.render!('Alice', record, 0);

    render(<>{renderedElement}</>);
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });
});
