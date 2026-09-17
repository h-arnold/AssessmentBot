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
import type { MetricResult } from '../../services/dataAnalysis/dataAnalysis.zod';
import { buildClassPageViewModel, compareAssignmentUpdatedAtDesc } from './classPageModel';
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
        sort: { column: 'forename', direction: 'asc' },
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
        sort: { column: 'forename', direction: 'asc' },
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
        sort: { column: 'forename', direction: 'asc' },
      });

      const expectedCount = 2;
      expect(result.studentAverages).toHaveLength(expectedCount);
    });
  });

  // -----------------------------------------------------------------------
  // Sort — name columns (surname ordering differs from forename ordering)
  // -----------------------------------------------------------------------
  describe('sort by name columns', () => {
    it.each<{
      name: string;
      column: 'forename' | 'surname';
      direction: 'asc' | 'desc';
      students: [studentId: string, studentName: string][];
      expectedIds: string[];
    }>([
      {
        name: 'sorts by forename ascending when that column is specified',
        column: 'forename',
        direction: 'asc',
        students: [
          ['s-3', 'Charlie'],
          ['s-1', 'Alice'],
          ['s-2', 'Bob'],
        ],
        expectedIds: ['s-1', 's-2', 's-3'],
      },
      {
        name: 'sorts by forename descending',
        column: 'forename',
        direction: 'desc',
        students: [
          ['s-1', 'Alice'],
          ['s-3', 'Charlie'],
          ['s-2', 'Bob'],
        ],
        expectedIds: ['s-3', 's-2', 's-1'],
      },
      {
        name: 'sorts by surname ascending when that column is specified',
        column: 'surname',
        direction: 'asc',
        students: [
          ['s-1', 'Alice Smith'],
          ['s-2', 'Bob Jones'],
        ],
        expectedIds: ['s-2', 's-1'],
      },
      {
        name: 'sorts by surname descending',
        column: 'surname',
        direction: 'desc',
        students: [
          ['s-2', 'Bob Jones'],
          ['s-1', 'Alice Smith'],
        ],
        expectedIds: ['s-1', 's-2'],
      },
    ])('$name', ({ column, direction, students, expectedIds }) => {
      const adapterResult = buildAdapterResult({
        studentAverages: students.map(([studentId, studentName]) =>
          buildStudentRow({ studentId, studentName })
        ),
      });

      const result = buildClassPageViewModel({
        adapterResult,
        filters: { searchTerm: '' },
        sort: { column, direction },
      });

      expect(result.studentAverages.map((row) => row.studentId)).toEqual(expectedIds);
    });

    it('sorts by forename case-insensitively', () => {
      const aliceRow = buildStudentRow({ studentId: 's-1', studentName: 'alice' });
      const bobRow = buildStudentRow({ studentId: 's-2', studentName: 'Bob' });

      const adapterResult = buildAdapterResult({
        studentAverages: [bobRow, aliceRow],
      });

      const result = buildClassPageViewModel({
        adapterResult,
        filters: { searchTerm: '' },
        sort: { column: 'forename', direction: 'asc' },
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
    /**
     * Build a student row with the specified completeness result.
     *
     * @param {string} studentId - The student's identifier.
     * @param {string} studentName - The student's display name.
     * @param {MetricResult} completeness - The completeness state and value under test.
     * @returns {StudentAverageRowModel} A student row with computed values for the other metrics.
     */
    function buildRowWithCompleteness(
      studentId: string,
      studentName: string,
      completeness: MetricResult
    ): StudentAverageRowModel {
      return buildStudentRow({
        studentId,
        studentName,
        metrics: {
          completeness,
          accuracy: createMetricResult('computed'),
          spag: createMetricResult('computed'),
          average: createMetricResult('computed'),
        },
      });
    }

    const lowComputedRow = buildRowWithCompleteness(
      's-1',
      'Alice',
      createMetricResult('computed', { value: 2 })
    );
    const highComputedRow = buildRowWithCompleteness(
      's-2',
      'Bob',
      createMetricResult('computed', { value: 8 })
    );
    const notAttemptedRow = buildRowWithCompleteness(
      's-3',
      'Charlie',
      createMetricResult('notAttempted')
    );
    const errorRow = buildRowWithCompleteness('s-4', 'Diana', createMetricResult('error'));

    it.each<{
      name: string;
      direction: 'asc' | 'desc';
      inputOrder: StudentAverageRowModel[];
      expectedIds: string[];
    }>([
      {
        name: 'sorts by completeness ascending: computed (by value) → notAttempted → error',
        direction: 'asc',
        inputOrder: [errorRow, highComputedRow, notAttemptedRow, lowComputedRow],
        expectedIds: ['s-1', 's-2', 's-3', 's-4'],
      },
      {
        name: 'sorts by completeness descending: error → notAttempted → computed (by value)',
        direction: 'desc',
        inputOrder: [lowComputedRow, notAttemptedRow, highComputedRow, errorRow],
        expectedIds: ['s-4', 's-3', 's-2', 's-1'],
      },
    ])('$name', ({ direction, inputOrder, expectedIds }) => {
      const adapterResult = buildAdapterResult({ studentAverages: inputOrder });

      const result = buildClassPageViewModel({
        adapterResult,
        filters: { searchTerm: '' },
        sort: { column: 'completeness', direction },
      });

      expect(result.studentAverages.map((row) => row.studentId)).toEqual(expectedIds);
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
        sort: { column: 'forename', direction: 'asc' },
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
    it('resets to full-name ascending when sort is null', () => {
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

      // Defaults to full-name ascending: Alice before Charlie
      expect(result.studentAverages[0].studentId).toBe('s-1');
      expect(result.studentAverages[1].studentId).toBe('s-3');
    });

    it('resets to full-name ascending when sort is undefined', () => {
      // Same-forename pair: full-name ascending puts Brown before Smith,
      // while a forename-only sort would tie on Alice and fall back to
      // studentId (s-1 before s-2). Expecting Brown first pins full-name
      // ordering as distinct from Forename ordering.
      const aliceSmithRow = buildStudentRow({ studentId: 's-1', studentName: 'Alice Smith' });
      const aliceBrownRow = buildStudentRow({ studentId: 's-2', studentName: 'Alice Brown' });

      const adapterResult = buildAdapterResult({
        studentAverages: [aliceSmithRow, aliceBrownRow],
      });

      const result = buildClassPageViewModel({
        adapterResult,
        filters: { searchTerm: '' },
      });

      // Defaults to full-name ascending: Alice Brown before Alice Smith
      expect(result.studentAverages[0].studentId).toBe('s-2');
      expect(result.studentAverages[1].studentId).toBe('s-1');
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
