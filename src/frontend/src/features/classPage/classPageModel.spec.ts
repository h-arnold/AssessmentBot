/**
 * Tests for the Class page view-model builder (`classPageModel.ts`).
 *
 * @remarks
 * The model is a pure synchronous function that applies search filtering
 * and sorting to the adapter's canonical output.  These tests define the
 * full behavioural contract; they will fail to import until the
 * implementation exists (red-phase).
 *
 * @see SPEC_CLASS_PAGE.md — "classPageModel — view-model builder"
 */

import { describe, expect, it } from 'vitest';
import { buildClassPageViewModel } from './classPageModel';
import type {
  ClassPageAdapterResult,
  RecentAssignmentCardModel,
  StudentAverageRowModel,
} from './classPageAdapter.zod';
import type { MetricResult } from '../../services/dataAnalysis/dataAnalysis.zod';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/**
 * Build a `MetricResult` fixture of the requested state.
 *
 * @param {'computed' | 'notAttempted' | 'error'} state - The MetricResult state discriminator.
 * @param {object} [overrides] - Optional partial overrides for the MetricResult fields.
 * @returns {MetricResult} A fully typed MetricResult fixture.
 */
function metric(
  state: 'computed',
  overrides?: Partial<{
    value: number;
    totalWeight: number;
    applicableDataPoints: number;
    totalDataPoints: number;
  }>
): MetricResult;
function metric(
  state: 'notAttempted',
  overrides?: Partial<{ totalWeight: number; totalDataPoints: number }>
): MetricResult;
function metric(
  state: 'error',
  overrides?: Partial<{ totalWeight: number; totalDataPoints: number }>
): MetricResult;
function metric(
  state: 'computed' | 'notAttempted' | 'error',
  overrides?: Record<string, unknown>
): MetricResult {
  switch (state) {
    case 'computed': {
      return {
        state: 'computed',
        value: 5,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
        ...overrides,
      } as MetricResult;
    }
    case 'notAttempted': {
      return {
        state: 'notAttempted',
        value: 'N',
        totalWeight: 0,
        applicableDataPoints: 0,
        totalDataPoints: 1,
        ...overrides,
      } as MetricResult;
    }
    case 'error': {
      return {
        state: 'error',
        value: 'E',
        totalWeight: 0,
        applicableDataPoints: 0,
        totalDataPoints: 1,
        ...overrides,
      } as MetricResult;
    }
  }
}

/**
 * Build a `StudentAverageRowModel` fixture with sensible defaults.
 *
 * @param {Partial<StudentAverageRowModel>} [overrides] - Optional partial overrides for the fixture fields.
 *   Supports any subset of `StudentAverageRowModel` fields (e.g. `studentId`,
 *   `studentName`, `metrics`).
 * @returns {StudentAverageRowModel} A fully typed StudentAverageRowModel fixture.
 */
function buildStudentRow(overrides?: Partial<StudentAverageRowModel>): StudentAverageRowModel {
  return {
    studentId: 's-1',
    studentName: 'Student A',
    metrics: {
      completeness: metric('computed'),
      accuracy: metric('computed'),
      spag: metric('computed'),
      average: metric('computed'),
    },
    ...overrides,
  };
}

/**
 * Build a `ClassPageAdapterResult` fixture with sensible defaults.
 *
 * @param {Partial<ClassPageAdapterResult>} [overrides] - Optional partial overrides for the fixture fields.
 *   Supports any subset of `ClassPageAdapterResult` fields (e.g.
 *   `recentAssignments`, `studentAverages`, `classMetrics`).
 * @returns {ClassPageAdapterResult} A fully typed ClassPageAdapterResult fixture.
 */
function buildAdapterResult(overrides?: Partial<ClassPageAdapterResult>): ClassPageAdapterResult {
  return {
    recentAssignments: [
      {
        assignmentId: 'a-1',
        assignmentName: 'Assignment 1',
        lastAssessedAt: '2026-06-01T00:00:00.000Z',
        lastAssessedAtLabel: '01/06/2026',
        metrics: {
          completeness: metric('computed'),
          accuracy: metric('computed'),
          spag: metric('computed'),
          average: metric('computed'),
        },
      },
    ],
    studentAverages: [buildStudentRow()],
    classMetrics: {
      completeness: metric('computed', { value: 4.2 }),
      accuracy: metric('computed', { value: 3.5 }),
      spag: metric('notAttempted'),
      overall: metric('computed', { value: 3.8 }),
    },
    ...overrides,
  };
}

// ===========================================================================
// Tests
// ===========================================================================

describe('buildClassPageViewModel', () => {
  // -----------------------------------------------------------------------
  // Pass-through fields
  // -----------------------------------------------------------------------
  describe('pass-through fields', () => {
    it('passes through recentAssignments and classMetrics unchanged', () => {
      const recentAssignmentCard: RecentAssignmentCardModel = {
        assignmentId: 'a-1',
        assignmentName: 'Algebra Baseline',
        lastAssessedAt: '2026-06-01T00:00:00.000Z',
        lastAssessedAtLabel: '01/06/2026',
        metrics: {
          completeness: metric('computed', { value: 4 }),
          accuracy: metric('notAttempted'),
          spag: metric('error'),
          average: metric('computed', { value: 3.2 }),
        },
      };

      const classMetrics = {
        completeness: metric('computed', { value: 4.5 }),
        accuracy: metric('computed', { value: 3 }),
        spag: metric('error'),
        overall: metric('computed', { value: 3.7 }),
      };

      const adapterResult = buildAdapterResult({
        recentAssignments: [recentAssignmentCard],
        classMetrics,
      });

      const result = buildClassPageViewModel({
        adapterResult,
        filters: { searchTerm: '' },
        sort: { column: 'studentName', direction: 'asc' },
      });

      expect(result.recentAssignments).toEqual(adapterResult.recentAssignments);
      expect(result.classMetrics).toEqual(adapterResult.classMetrics);
    });
  });

  // -----------------------------------------------------------------------
  // Search filter
  // -----------------------------------------------------------------------
  describe('search filter', () => {
    it('filters studentAverages by case-insensitive substring on studentName', () => {
      const oliverRow = buildStudentRow({
        studentId: 's-1',
        studentName: 'Oliver',
      });
      const bobRow = buildStudentRow({
        studentId: 's-2',
        studentName: 'Bob',
      });
      const lilyRow = buildStudentRow({
        studentId: 's-3',
        studentName: 'Lily',
      });

      const adapterResult = buildAdapterResult({
        studentAverages: [oliverRow, bobRow, lilyRow],
      });

      const result = buildClassPageViewModel({
        adapterResult,
        filters: { searchTerm: 'li' },
        sort: { column: 'studentName', direction: 'asc' },
      });

      const expectedFilteredCount = 2;
      expect(result.studentAverages).toHaveLength(expectedFilteredCount);
      // Oliver and Lily both contain "li" (case-insensitive); Bob does not
      const studentIds = result.studentAverages.map((row: StudentAverageRowModel) => row.studentId);
      expect(studentIds).toContain('s-1');
      expect(studentIds).toContain('s-3');
      expect(studentIds).not.toContain('s-2');
    });

    it('returns all students when searchTerm is empty', () => {
      const studentOne = buildStudentRow({ studentId: 's-1', studentName: 'Alice' });
      const studentTwo = buildStudentRow({ studentId: 's-2', studentName: 'Bob' });

      const adapterResult = buildAdapterResult({
        studentAverages: [studentOne, studentTwo],
      });

      const result = buildClassPageViewModel({
        adapterResult,
        filters: { searchTerm: '' },
        sort: { column: 'studentName', direction: 'asc' },
      });

      const expectedCount = 2;
      expect(result.studentAverages).toHaveLength(expectedCount);
    });
  });

  // -----------------------------------------------------------------------
  // Sort — studentName
  // -----------------------------------------------------------------------
  describe('sort by studentName', () => {
    it('sorts by studentName ascending when that column is specified', () => {
      const charlieRow = buildStudentRow({ studentId: 's-3', studentName: 'Charlie' });
      const aliceRow = buildStudentRow({ studentId: 's-1', studentName: 'Alice' });
      const bobRow = buildStudentRow({ studentId: 's-2', studentName: 'Bob' });

      const adapterResult = buildAdapterResult({
        studentAverages: [charlieRow, aliceRow, bobRow],
      });

      const result = buildClassPageViewModel({
        adapterResult,
        filters: { searchTerm: '' },
        sort: { column: 'studentName', direction: 'asc' },
      });

      expect(result.studentAverages[0].studentId).toBe('s-1'); // Alice
      expect(result.studentAverages[1].studentId).toBe('s-2'); // Bob
      expect(result.studentAverages[2].studentId).toBe('s-3'); // Charlie
    });

    it('sorts by studentName descending', () => {
      const aliceRow = buildStudentRow({ studentId: 's-1', studentName: 'Alice' });
      const charlieRow = buildStudentRow({ studentId: 's-3', studentName: 'Charlie' });
      const bobRow = buildStudentRow({ studentId: 's-2', studentName: 'Bob' });

      const adapterResult = buildAdapterResult({
        studentAverages: [aliceRow, charlieRow, bobRow],
      });

      const result = buildClassPageViewModel({
        adapterResult,
        filters: { searchTerm: '' },
        sort: { column: 'studentName', direction: 'desc' },
      });

      expect(result.studentAverages[0].studentId).toBe('s-3'); // Charlie
      expect(result.studentAverages[1].studentId).toBe('s-2'); // Bob
      expect(result.studentAverages[2].studentId).toBe('s-1'); // Alice
    });

    it('sorts by studentName case-insensitively', () => {
      const aliceRow = buildStudentRow({ studentId: 's-1', studentName: 'alice' });
      const bobRow = buildStudentRow({ studentId: 's-2', studentName: 'Bob' });

      const adapterResult = buildAdapterResult({
        studentAverages: [bobRow, aliceRow],
      });

      const result = buildClassPageViewModel({
        adapterResult,
        filters: { searchTerm: '' },
        sort: { column: 'studentName', direction: 'asc' },
      });

      // Case-insensitive: 'alice' should sort before 'Bob'
      expect(result.studentAverages[0].studentId).toBe('s-1'); // alice
      expect(result.studentAverages[1].studentId).toBe('s-2'); // Bob
    });
  });

  // -----------------------------------------------------------------------
  // Sort — metric columns (state-aware)
  // -----------------------------------------------------------------------
  describe('sort by metric columns (state-aware)', () => {
    it('sorts by completeness ascending: computed (by value) → notAttempted → error', () => {
      const lowComputedRow = buildStudentRow({
        studentId: 's-1',
        studentName: 'Alice',
        metrics: {
          completeness: metric('computed', { value: 2 }),
          accuracy: metric('computed'),
          spag: metric('computed'),
          average: metric('computed'),
        },
      });
      const highComputedRow = buildStudentRow({
        studentId: 's-2',
        studentName: 'Bob',
        metrics: {
          completeness: metric('computed', { value: 8 }),
          accuracy: metric('computed'),
          spag: metric('computed'),
          average: metric('computed'),
        },
      });
      const notAttemptedRow = buildStudentRow({
        studentId: 's-3',
        studentName: 'Charlie',
        metrics: {
          completeness: metric('notAttempted'),
          accuracy: metric('computed'),
          spag: metric('computed'),
          average: metric('computed'),
        },
      });
      const errorRow = buildStudentRow({
        studentId: 's-4',
        studentName: 'Diana',
        metrics: {
          completeness: metric('error'),
          accuracy: metric('computed'),
          spag: metric('computed'),
          average: metric('computed'),
        },
      });

      const adapterResult = buildAdapterResult({
        studentAverages: [errorRow, highComputedRow, notAttemptedRow, lowComputedRow],
      });

      const result = buildClassPageViewModel({
        adapterResult,
        filters: { searchTerm: '' },
        sort: { column: 'completeness', direction: 'asc' },
      });

      // Ascending: computed (2.0) → computed (8.0) → notAttempted → error
      expect(result.studentAverages[0].studentId).toBe('s-1'); // Alice: computed, value 2
      expect(result.studentAverages[1].studentId).toBe('s-2'); // Bob: computed, value 8
      expect(result.studentAverages[2].studentId).toBe('s-3'); // Charlie: notAttempted
      expect(result.studentAverages[3].studentId).toBe('s-4'); // Diana: error
    });

    it('sorts by completeness descending: error → notAttempted → computed (by value)', () => {
      const highComputedRow = buildStudentRow({
        studentId: 's-2',
        studentName: 'Bob',
        metrics: {
          completeness: metric('computed', { value: 8 }),
          accuracy: metric('computed'),
          spag: metric('computed'),
          average: metric('computed'),
        },
      });
      const lowComputedRow = buildStudentRow({
        studentId: 's-1',
        studentName: 'Alice',
        metrics: {
          completeness: metric('computed', { value: 2 }),
          accuracy: metric('computed'),
          spag: metric('computed'),
          average: metric('computed'),
        },
      });
      const notAttemptedRow = buildStudentRow({
        studentId: 's-3',
        studentName: 'Charlie',
        metrics: {
          completeness: metric('notAttempted'),
          accuracy: metric('computed'),
          spag: metric('computed'),
          average: metric('computed'),
        },
      });
      const errorRow = buildStudentRow({
        studentId: 's-4',
        studentName: 'Diana',
        metrics: {
          completeness: metric('error'),
          accuracy: metric('computed'),
          spag: metric('computed'),
          average: metric('computed'),
        },
      });

      const adapterResult = buildAdapterResult({
        studentAverages: [lowComputedRow, notAttemptedRow, highComputedRow, errorRow],
      });

      const result = buildClassPageViewModel({
        adapterResult,
        filters: { searchTerm: '' },
        sort: { column: 'completeness', direction: 'desc' },
      });

      // Descending: error → notAttempted → computed (8.0) → computed (2.0)
      expect(result.studentAverages[0].studentId).toBe('s-4'); // Diana: error
      expect(result.studentAverages[1].studentId).toBe('s-3'); // Charlie: notAttempted
      expect(result.studentAverages[2].studentId).toBe('s-2'); // Bob: computed, value 8
      expect(result.studentAverages[3].studentId).toBe('s-1'); // Alice: computed, value 2
    });
  });

  // -----------------------------------------------------------------------
  // Tie-breaking
  // -----------------------------------------------------------------------
  describe('tie-breaking', () => {
    it('tie-breaks by studentId ascending when state and value are equal (metric columns)', () => {
      const studentBRow = buildStudentRow({
        studentId: 's-B',
        studentName: 'Beta',
        metrics: {
          completeness: metric('computed', { value: 5 }),
          accuracy: metric('computed'),
          spag: metric('computed'),
          average: metric('computed'),
        },
      });
      const studentARow = buildStudentRow({
        studentId: 's-A',
        studentName: 'Alpha',
        metrics: {
          completeness: metric('computed', { value: 5 }),
          accuracy: metric('computed'),
          spag: metric('computed'),
          average: metric('computed'),
        },
      });

      const adapterResult = buildAdapterResult({
        studentAverages: [studentBRow, studentARow],
      });

      const result = buildClassPageViewModel({
        adapterResult,
        filters: { searchTerm: '' },
        sort: { column: 'completeness', direction: 'asc' },
      });

      // Same completeness value (5) — tie-break by studentId ascending
      expect(result.studentAverages[0].studentId).toBe('s-A');
      expect(result.studentAverages[1].studentId).toBe('s-B');
    });

    it('tie-breaks by studentId ascending when student names are identical', () => {
      const davidLaterRow = buildStudentRow({ studentId: 's-2', studentName: 'David' });
      const davidEarlierRow = buildStudentRow({ studentId: 's-1', studentName: 'David' });

      const adapterResult = buildAdapterResult({
        studentAverages: [davidLaterRow, davidEarlierRow],
      });

      const result = buildClassPageViewModel({
        adapterResult,
        filters: { searchTerm: '' },
        sort: { column: 'studentName', direction: 'asc' },
      });

      // Same name "David" — tie-break by studentId ascending
      expect(result.studentAverages[0].studentId).toBe('s-1');
      expect(result.studentAverages[1].studentId).toBe('s-2');
    });
  });

  // -----------------------------------------------------------------------
  // Default sort
  // -----------------------------------------------------------------------
  describe('default sort', () => {
    it('resets to studentName ascending when sort is null', () => {
      const charlieRow = buildStudentRow({ studentId: 's-3', studentName: 'Charlie' });
      const aliceRow = buildStudentRow({ studentId: 's-1', studentName: 'Alice' });

      const adapterResult = buildAdapterResult({
        studentAverages: [charlieRow, aliceRow],
      });

      const result = buildClassPageViewModel({
        adapterResult,
        filters: { searchTerm: '' },
        sort: null,
      });

      // Defaults to studentName ascending: Alice before Charlie
      expect(result.studentAverages[0].studentId).toBe('s-1');
      expect(result.studentAverages[1].studentId).toBe('s-3');
    });

    it('resets to studentName ascending when sort is undefined', () => {
      const bobRow = buildStudentRow({ studentId: 's-2', studentName: 'Bob' });
      const aliceRow = buildStudentRow({ studentId: 's-1', studentName: 'Alice' });

      const adapterResult = buildAdapterResult({
        studentAverages: [bobRow, aliceRow],
      });

      const result = buildClassPageViewModel({
        adapterResult,
        filters: { searchTerm: '' },
      });

      // Defaults to studentName ascending: Alice before Bob
      expect(result.studentAverages[0].studentId).toBe('s-1');
      expect(result.studentAverages[1].studentId).toBe('s-2');
    });
  });
});
