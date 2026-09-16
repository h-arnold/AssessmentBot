/**
 * Forename/Surname column contract for the Student Averages table.
 *
 * @remarks
 * Red phase: asserts the split Forename/Surname columns derived via the
 * shared split helper. These assertions fail against the current single
 * Student Name column and pass once the column split lands.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { buildStudentAveragesTableColumns } from './studentAveragesTableColumns';
import type { StudentAverageRowModel } from './classPageAdapter.zod';
import { createComputedMetricResult } from '../../test/dataAnalysis/fixtures';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Metric score used for every fixture metric. */
const FIXTURE_SCORE = 4;

/** Second metric score for the average fixture field. */
const FIXTURE_AVERAGE_SCORE = 3.7;

/** Accuracy fixture score. */
const FIXTURE_ACCURACY_SCORE = 3;

/** SPaG fixture score. */
const FIXTURE_SPAG_SCORE = 3.5;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Empty filters: no metric column has an active range filter selection. */
const EMPTY_FILTERS = {
  completeness: [] as readonly string[],
  accuracy: [] as readonly string[],
  spag: [] as readonly string[],
  average: [] as readonly string[],
};

/**
 * Build a valid StudentAverageRowModel fixture for tests.
 *
 * @param {Partial<StudentAverageRowModel>} [overrides] - Optional overrides.
 * @returns {StudentAverageRowModel} A StudentAverageRowModel fixture.
 */
function buildRow(overrides: Partial<StudentAverageRowModel> = {}): StudentAverageRowModel {
  return {
    studentId: 's-1',
    studentName: 'Alice Smith',
    metrics: {
      completeness: createComputedMetricResult({ value: FIXTURE_SCORE }),
      accuracy: createComputedMetricResult({ value: FIXTURE_ACCURACY_SCORE }),
      spag: createComputedMetricResult({ value: FIXTURE_SPAG_SCORE }),
      average: createComputedMetricResult({ value: FIXTURE_AVERAGE_SCORE }),
    },
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

// ===========================================================================
// Tests
// ===========================================================================

describe('Student Averages Forename/Surname columns', () => {
  it('renders Forename then Surname headers replacing the single Student Name column', () => {
    const columns = buildStudentAveragesTableColumns(EMPTY_FILTERS);
    const keys = columns.map((column) => column.key);

    expect(keys).toContain('forename');
    expect(keys).toContain('surname');
    expect(keys).not.toContain('studentName');

    const forenameColumn = columns.find((column) => column.key === 'forename');
    const surnameColumn = columns.find((column) => column.key === 'surname');
    expect(forenameColumn).toBeDefined();
    expect(surnameColumn).toBeDefined();
    expect(forenameColumn!.title).toBe('Forename');
    expect(surnameColumn!.title).toBe('Surname');

    const forenameIndex = keys.indexOf('forename');
    const surnameIndex = keys.indexOf('surname');
    expect(forenameIndex).toBeLessThan(surnameIndex);
  });

  it('renders split forename and surname cell values for the first row', () => {
    const columns = buildStudentAveragesTableColumns(EMPTY_FILTERS);
    const forenameColumn = columns.find((column) => column.key === 'forename');
    const surnameColumn = columns.find((column) => column.key === 'surname');
    expect(forenameColumn).toBeDefined();
    expect(surnameColumn).toBeDefined();

    const record = buildRow({ studentId: 's-1', studentName: 'Alice Smith' });
    render(<>{forenameColumn!.render!('Alice', record, 0)}</>);
    render(<>{surnameColumn!.render!('Smith', record, 0)}</>);

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Smith')).toBeInTheDocument();
  });

  it('orders rows by surname via the Surname column sorter', () => {
    const columns = buildStudentAveragesTableColumns(EMPTY_FILTERS);
    const surnameColumn = columns.find((column) => column.key === 'surname');
    expect(surnameColumn).toBeDefined();
    expect(surnameColumn!.sorter).toBeDefined();

    const sorter = surnameColumn!.sorter as {
      compare: (first: StudentAverageRowModel, second: StudentAverageRowModel) => number;
    };
    const smithRow = buildRow({ studentId: 's-1', studentName: 'Alice Smith' });
    const jonesRow = buildRow({ studentId: 's-2', studentName: 'Bob Jones' });

    const sorted = [smithRow, jonesRow].toSorted(sorter.compare);
    expect(sorted.map((row) => row.studentId)).toEqual(['s-2', 's-1']);
  });

  it('orders rows by forename via the Forename column sorter', () => {
    const columns = buildStudentAveragesTableColumns(EMPTY_FILTERS);
    const forenameColumn = columns.find((column) => column.key === 'forename');
    expect(forenameColumn).toBeDefined();
    expect(forenameColumn!.sorter).toBeDefined();

    const sorter = forenameColumn!.sorter as {
      compare: (first: StudentAverageRowModel, second: StudentAverageRowModel) => number;
    };
    // Same pair as the Surname sorter test with the opposite expectation:
    // forename ascending puts Alice before Bob, while surname ascending puts
    // Jones before Smith. This symmetry proves each column sorts by its own
    // derived value rather than the full name.
    const smithRow = buildRow({ studentId: 's-1', studentName: 'Alice Smith' });
    const jonesRow = buildRow({ studentId: 's-2', studentName: 'Bob Jones' });

    const sorted = [jonesRow, smithRow].toSorted(sorter.compare);
    expect(sorted.map((row) => row.studentId)).toEqual(['s-1', 's-2']);
  });

  it('renders an empty surname cell for a one-token name without crashing', () => {
    const columns = buildStudentAveragesTableColumns(EMPTY_FILTERS);
    const forenameColumn = columns.find((column) => column.key === 'forename');
    const surnameColumn = columns.find((column) => column.key === 'surname');
    expect(forenameColumn).toBeDefined();
    expect(surnameColumn).toBeDefined();

    const record = buildRow({ studentId: 's-9', studentName: 'Plato' });
    let surnameElement: unknown = null;
    expect(() => {
      surnameElement = surnameColumn!.render!('', record, 0);
    }).not.toThrow();
    render(<>{forenameColumn!.render!('Plato', record, 0)}</>);
    render(<>{surnameElement as React.ReactElement}</>);

    expect(screen.getByText('Plato')).toBeInTheDocument();
  });
});
