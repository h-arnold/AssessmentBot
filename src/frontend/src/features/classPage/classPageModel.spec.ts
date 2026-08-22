/**
 * Tests for the Class page view-model builder (`classPageModel.ts`).
 *
 * @remarks
 * The model is a pure synchronous function that applies search filtering
 * and sorting to the adapter's canonical output.  These tests define the
 * full behavioural contract.
 *
 * @see SPEC_CLASS_PAGE.md — "classPageModel — view-model builder"
 */

import { describe, expect, it } from 'vitest';
import { createMetricResult } from '../../test/dataAnalysis/fixtures';
import {
  buildClassPageViewModel,
  compareHeatmapStudentName,
  compareAssignmentUpdatedAtDesc,
} from './classPageModel';
import type { HeatmapRow } from '../../services/dataAnalysis/heatmapAdapter';
import type {
  ClassPageAdapterResult,
  RecentAssignmentCardModel,
  StudentAverageRowModel,
} from './classPageAdapter.zod';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

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
      completeness: createMetricResult('computed'),
      accuracy: createMetricResult('computed'),
      spag: createMetricResult('computed'),
      average: createMetricResult('computed'),
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
          completeness: createMetricResult('computed'),
          accuracy: createMetricResult('computed'),
          spag: createMetricResult('computed'),
          average: createMetricResult('computed'),
        },
      },
    ],
    studentAverages: [buildStudentRow()],
    classMetrics: {
      completeness: createMetricResult('computed', { value: 4.2 }),
      accuracy: createMetricResult('computed', { value: 3.5 }),
      spag: createMetricResult('notAttempted'),
      overall: createMetricResult('computed', { value: 3.8 }),
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
          completeness: createMetricResult('computed', { value: 4 }),
          accuracy: createMetricResult('notAttempted'),
          spag: createMetricResult('error'),
          average: createMetricResult('computed', { value: 3.2 }),
        },
      };

      const classMetrics = {
        completeness: createMetricResult('computed', { value: 4.5 }),
        accuracy: createMetricResult('computed', { value: 3 }),
        spag: createMetricResult('error'),
        overall: createMetricResult('computed', { value: 3.7 }),
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
          completeness: createMetricResult('computed', { value: 2 }),
          accuracy: createMetricResult('computed'),
          spag: createMetricResult('computed'),
          average: createMetricResult('computed'),
        },
      });
      const highComputedRow = buildStudentRow({
        studentId: 's-2',
        studentName: 'Bob',
        metrics: {
          completeness: createMetricResult('computed', { value: 8 }),
          accuracy: createMetricResult('computed'),
          spag: createMetricResult('computed'),
          average: createMetricResult('computed'),
        },
      });
      const notAttemptedRow = buildStudentRow({
        studentId: 's-3',
        studentName: 'Charlie',
        metrics: {
          completeness: createMetricResult('notAttempted'),
          accuracy: createMetricResult('computed'),
          spag: createMetricResult('computed'),
          average: createMetricResult('computed'),
        },
      });
      const errorRow = buildStudentRow({
        studentId: 's-4',
        studentName: 'Diana',
        metrics: {
          completeness: createMetricResult('error'),
          accuracy: createMetricResult('computed'),
          spag: createMetricResult('computed'),
          average: createMetricResult('computed'),
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
          completeness: createMetricResult('computed', { value: 8 }),
          accuracy: createMetricResult('computed'),
          spag: createMetricResult('computed'),
          average: createMetricResult('computed'),
        },
      });
      const lowComputedRow = buildStudentRow({
        studentId: 's-1',
        studentName: 'Alice',
        metrics: {
          completeness: createMetricResult('computed', { value: 2 }),
          accuracy: createMetricResult('computed'),
          spag: createMetricResult('computed'),
          average: createMetricResult('computed'),
        },
      });
      const notAttemptedRow = buildStudentRow({
        studentId: 's-3',
        studentName: 'Charlie',
        metrics: {
          completeness: createMetricResult('notAttempted'),
          accuracy: createMetricResult('computed'),
          spag: createMetricResult('computed'),
          average: createMetricResult('computed'),
        },
      });
      const errorRow = buildStudentRow({
        studentId: 's-4',
        studentName: 'Diana',
        metrics: {
          completeness: createMetricResult('error'),
          accuracy: createMetricResult('computed'),
          spag: createMetricResult('computed'),
          average: createMetricResult('computed'),
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
          completeness: createMetricResult('computed', { value: 5 }),
          accuracy: createMetricResult('computed'),
          spag: createMetricResult('computed'),
          average: createMetricResult('computed'),
        },
      });
      const studentARow = buildStudentRow({
        studentId: 's-A',
        studentName: 'Alpha',
        metrics: {
          completeness: createMetricResult('computed', { value: 5 }),
          accuracy: createMetricResult('computed'),
          spag: createMetricResult('computed'),
          average: createMetricResult('computed'),
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

  // -----------------------------------------------------------------------
  // compareHeatmapStudentName
  // -----------------------------------------------------------------------
  describe('compareHeatmapStudentName', () => {
    it('orders two HeatmapRows identically to compareStudentNames on the same names', () => {
      const alice: HeatmapRow = { studentId: 's-1', studentName: 'Alice', cells: [] };
      const bob: HeatmapRow = { studentId: 's-2', studentName: 'Bob', cells: [] };

      const result = compareHeatmapStudentName(alice, bob);

      expect(result).toBeLessThan(0);
    });

    it('returns positive when a.studentName > b.studentName', () => {
      const bob: HeatmapRow = { studentId: 's-2', studentName: 'Bob', cells: [] };
      const alice: HeatmapRow = { studentId: 's-1', studentName: 'Alice', cells: [] };

      const result = compareHeatmapStudentName(bob, alice);

      expect(result).toBeGreaterThan(0);
    });

    it('tie-breaks by studentId ascending when names are equal', () => {
      const davidB: HeatmapRow = { studentId: 's-B', studentName: 'David', cells: [] };
      const davidA: HeatmapRow = { studentId: 's-A', studentName: 'David', cells: [] };

      const result = compareHeatmapStudentName(davidA, davidB);

      // s-A vs s-B → negative (s-A sorts before s-B)
      expect(result).toBeLessThan(0);
    });

    it('orders case-insensitively — lowercase "alice" sorts before "Bob"', () => {
      const alice: HeatmapRow = { studentId: 's-1', studentName: 'alice', cells: [] };
      const bob: HeatmapRow = { studentId: 's-2', studentName: 'Bob', cells: [] };

      const result = compareHeatmapStudentName(alice, bob);

      // Case-insensitive: 'alice' (lowercase) should be considered < 'Bob'
      expect(result).toBeLessThan(0);
    });

    it('accepts HeatmapRow (not StudentAverageRowModel) — function is defined', () => {
      // RED phase fails because compareHeatmapStudentName is not yet exported.
      // Green phase: this call confirms the function signature accepts HeatmapRow.
      expect(typeof compareHeatmapStudentName).toBe('function');
    });
  });

  // -----------------------------------------------------------------------
  // compareAssignmentUpdatedAtDesc — shared recency comparator
  // -----------------------------------------------------------------------
  describe('compareAssignmentUpdatedAtDesc', () => {
    it('returns less than 0 when a has a later updatedAt than b (descending)', () => {
      const result = compareAssignmentUpdatedAtDesc(
        { updatedAt: '2026-02-01', assignmentId: 'a' },
        { updatedAt: '2026-01-01', assignmentId: 'b' }
      );

      // The later-updated entry (a) must sort before the earlier one (b)
      expect(result).toBeLessThan(0);
    });

    it('returns greater than 0 when updatedAt is equal and assignmentId tie-break is ascending', () => {
      const result = compareAssignmentUpdatedAtDesc(
        { updatedAt: '2026-01-01', assignmentId: 'b' },
        { updatedAt: '2026-01-01', assignmentId: 'a' }
      );

      // Same updatedAt — smaller assignmentId (a) sorts first, so b sorts after
      expect(result).toBeGreaterThan(0);
    });

    it('returns 0 when updatedAt and assignmentId are both equal', () => {
      const result = compareAssignmentUpdatedAtDesc(
        { updatedAt: '2026-01-01', assignmentId: 'a' },
        { updatedAt: '2026-01-01', assignmentId: 'a' }
      );

      expect(result).toBe(0);
    });
  });
});
