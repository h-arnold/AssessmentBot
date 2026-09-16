/**
 * Forename/Surname sort-state contract for the Class page view model.
 *
 * @remarks
 * Green phase: asserts Forename/Surname sort keys with full-name ascending as
 * the default and clear-reset ordering. The default and clear-reset fixtures
 * use same-forename pairs (Alice Brown/Alice Smith) so full-name ascending is
 * uniquely distinguished from a forename-only sort with a studentId tie-break.
 * Sort inputs use the production sort type directly (the Red-phase cast
 * bridge is gone now the model accepts the new keys).
 */

import { describe, it, expect } from 'vitest';
import { createMetricResult } from '../../test/dataAnalysis/fixtures';
import { buildClassPageViewModel, DEFAULT_SORT } from './classPageModel';
import type { ClassPageAdapterResult, StudentAverageRowModel } from './classPageAdapter.zod';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/**
 * Build a `StudentAverageRowModel` fixture with sensible defaults.
 *
 * @param {Partial<StudentAverageRowModel>} [overrides] - Optional partial overrides.
 * @returns {StudentAverageRowModel} A fully typed StudentAverageRowModel fixture.
 */
function buildStudentRow(overrides?: Partial<StudentAverageRowModel>): StudentAverageRowModel {
  return {
    studentId: 's-1',
    studentName: 'Alice Smith',
    metrics: {
      completeness: createMetricResult('computed'),
      accuracy: createMetricResult('computed'),
      spag: createMetricResult('computed'),
      average: createMetricResult('computed'),
    },
    ...overrides,
  };
}

/**
 * Build a `ClassPageAdapterResult` fixture for the given student rows.
 *
 * @param {StudentAverageRowModel[]} rows - The student rows to include.
 * @returns {ClassPageAdapterResult} A fully typed adapter result fixture.
 */
function buildAdapterResult(rows: StudentAverageRowModel[]): ClassPageAdapterResult {
  return {
    recentAssignments: [],
    studentAverages: rows,
    classMetrics: {
      completeness: createMetricResult('computed'),
      accuracy: createMetricResult('computed'),
      spag: createMetricResult('notAttempted'),
      overall: createMetricResult('computed'),
    },
  };
}

// ===========================================================================
// Tests
// ===========================================================================

describe('Class page Forename/Surname sort state', () => {
  it('uses a Forename/Surname sort key for the default sort, not the single studentName key', () => {
    expect(DEFAULT_SORT.column).not.toBe('studentName');
    expect(['forename', 'surname']).toContain(DEFAULT_SORT.column);
    expect(DEFAULT_SORT.direction).toBe('asc');
  });

  it('keeps the default ordering as full-name ascending', () => {
    // Same-forename pair: full-name ascending puts Brown before Smith, while
    // a forename-only sort would tie on Alice and fall back to studentId
    // (s-1 before s-2). Expecting Brown first pins full-name ordering.
    const aliceSmith = buildStudentRow({ studentId: 's-1', studentName: 'Alice Smith' });
    const aliceBrown = buildStudentRow({ studentId: 's-2', studentName: 'Alice Brown' });
    const adapterResult = buildAdapterResult([aliceSmith, aliceBrown]);

    const result = buildClassPageViewModel({
      adapterResult,
      filters: { searchTerm: '' },
    });

    expect(result.studentAverages.map((row) => row.studentId)).toEqual(['s-2', 's-1']);
  });

  it('sorts by surname ascending with a studentId tie-break', () => {
    const smithRow = buildStudentRow({ studentId: 's-1', studentName: 'Alice Smith' });
    const jonesRow = buildStudentRow({ studentId: 's-2', studentName: 'Bob Jones' });
    const adapterResult = buildAdapterResult([smithRow, jonesRow]);

    const viewModel = buildClassPageViewModel({
      adapterResult,
      filters: { searchTerm: '' },
      sort: { column: 'surname', direction: 'asc' },
    });

    expect(viewModel.studentAverages.map((row) => row.studentId)).toEqual(['s-2', 's-1']);
  });

  it('sorts by forename ascending', () => {
    const bobRow = buildStudentRow({ studentId: 's-2', studentName: 'Bob Jones' });
    const aliceRow = buildStudentRow({ studentId: 's-1', studentName: 'Alice Smith' });
    const adapterResult = buildAdapterResult([bobRow, aliceRow]);

    const viewModel = buildClassPageViewModel({
      adapterResult,
      filters: { searchTerm: '' },
      sort: { column: 'forename', direction: 'asc' },
    });

    expect(viewModel.studentAverages.map((row) => row.studentId)).toEqual(['s-1', 's-2']);
  });

  it('resolves a cleared sort to full-name ascending order', () => {
    // Same-forename pair: full-name ascending puts Brown before Smith, while
    // a forename-only sort would tie on Alice and fall back to studentId
    // (s-1 before s-3). Expecting Brown first pins the full-name reset.
    const aliceSmith = buildStudentRow({ studentId: 's-1', studentName: 'Alice Smith' });
    const aliceBrown = buildStudentRow({ studentId: 's-3', studentName: 'Alice Brown' });
    const adapterResult = buildAdapterResult([aliceSmith, aliceBrown]);

    const result = buildClassPageViewModel({
      adapterResult,
      filters: { searchTerm: '' },
      sort: null,
    });

    expect(result.studentAverages.map((row) => row.studentId)).toEqual(['s-3', 's-1']);
  });
});
