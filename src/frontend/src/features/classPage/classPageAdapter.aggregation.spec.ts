/**
 * Focused adapter tests: student-average synthesis and ordering,
 * class-metric passthrough, and baseline-mode recent-assignment metric
 * resolution for the Class page adapter (`classPageAdapter.ts`).
 *
 * @remarks
 * Shared fixture builders live in
 * `src/test/classPage/classPageAdapterTestFixtures.ts`.
 *
 * @see docs/developer/frontend/frontend-testing.md
 */

import { describe, expect, it } from 'vitest';
import { createMetricResult, createDefinitionPartial } from '@/test/dataAnalysis/fixtures';
import {
  DEFAULT_TS,
  assignment,
  averagingResult,
  classFull,
  computedPerTaskRow,
  perClassResult,
  perStudentRow,
  perTaskRow,
  singleAssignmentAdapterInput,
  student,
} from '@/test/classPage/classPageAdapterTestFixtures';
import { adaptClassPageToViewModel } from './classPageAdapter';
import type { PerStudentRow, PerTaskRow } from '@/services/dataAnalysis/dataAnalysis.zod';

describe('adaptClassPageToViewModel — aggregation', () => {
  describe('studentAverages', () => {
    it('synthesises no-data rows for students not in analyserResult.perStudent', () => {
      const studentRows: PerStudentRow[] = [
        perStudentRow({
          studentId: 's-1',
          studentName: 'Alice',
          completeness: createMetricResult('computed', { value: 4 }),
          accuracy: createMetricResult('computed', { value: 3 }),
          spag: createMetricResult('computed', { value: 2 }),
          overall: createMetricResult('computed', { value: 3.2 }),
        }),
      ];

      const result = adaptClassPageToViewModel({
        analyserResult: averagingResult({
          perStudent: studentRows,
        }),
        classFull: classFull({
          students: [student('s-1', 'Alice'), student('s-2', 'Bob'), student('s-3', 'Charlie')],
          assignments: [
            assignment({
              assignmentId: 'a-1',
              updatedAt: DEFAULT_TS,
              definitionKey: 'dk1',
            }),
          ],
        }),
        assignmentDefinitionPartials: [createDefinitionPartial({ definitionKey: 'dk1' })],
      });

      const expectedStudentCount = 3;
      expect(result.studentAverages).toHaveLength(expectedStudentCount);

      const studentAverages = result.studentAverages as Array<{
        studentId: string;
        metrics: Record<string, unknown>;
      }>;

      // Alice has data
      const alice = studentAverages.find((s) => s.studentId === 's-1');
      expect(alice).toBeDefined();
      expect(alice!.metrics.completeness).toMatchObject({ state: 'computed' });

      // Bob is unassessed — all fields should be notAttempted
      const bob = studentAverages.find((s) => s.studentId === 's-2');
      expect(bob).toBeDefined();
      expect(bob!.metrics.completeness).toMatchObject({ state: 'notAttempted' });
      expect(bob!.metrics.accuracy).toMatchObject({ state: 'notAttempted' });
      expect(bob!.metrics.spag).toMatchObject({ state: 'notAttempted' });
      expect(bob!.metrics.average).toMatchObject({ state: 'notAttempted' });

      // Charlie is unassessed
      const charlie = studentAverages.find((s) => s.studentId === 's-3');
      expect(charlie).toBeDefined();
      expect(charlie!.metrics.completeness).toMatchObject({ state: 'notAttempted' });
      expect(charlie!.metrics.average).toMatchObject({ state: 'notAttempted' });
    });

    it('sorts studentAverages by studentName ascending with studentId as tie-breaker', () => {
      const studentRows: PerStudentRow[] = [
        perStudentRow({
          studentId: 's-2',
          studentName: 'Bob',
          completeness: createMetricResult('computed', { value: 4 }),
          accuracy: createMetricResult('computed', { value: 3 }),
          spag: createMetricResult('computed', { value: 2 }),
          overall: createMetricResult('computed', { value: 3 }),
        }),
        perStudentRow({
          studentId: 's-1',
          studentName: 'Alice',
          completeness: createMetricResult('computed', { value: 5 }),
          accuracy: createMetricResult('computed', { value: 4 }),
          spag: createMetricResult('computed', { value: 3 }),
          overall: createMetricResult('computed', { value: 4 }),
        }),
      ];

      const result = adaptClassPageToViewModel({
        analyserResult: averagingResult({
          perStudent: studentRows,
        }),
        classFull: classFull({
          students: [
            student('s-1', 'Alice'),
            student('s-2', 'Bob'),
            student('s-3', 'Charlie'),
            // Two students named "David" — tie-break by studentId
            student('s-5', 'David'),
            student('s-4', 'David'),
          ],
          assignments: [
            assignment({
              assignmentId: 'a-1',
              updatedAt: DEFAULT_TS,
              definitionKey: 'dk1',
            }),
          ],
        }),
        assignmentDefinitionPartials: [createDefinitionPartial({ definitionKey: 'dk1' })],
      });

      const expectedStudentSortCount = 5;
      expect(result.studentAverages).toHaveLength(expectedStudentSortCount);
      expect(result.studentAverages[0].studentId).toBe('s-1'); // Alice
      expect(result.studentAverages[1].studentId).toBe('s-2'); // Bob
      expect(result.studentAverages[2].studentId).toBe('s-3'); // Charlie
      // Two Davids: s-4 (David) before s-5 (David) by studentId asc
      expect(result.studentAverages[3].studentId).toBe('s-4');
      expect(result.studentAverages[4].studentId).toBe('s-5');
    });
  });

  describe('classMetrics', () => {
    it('passes through perClass from analyser result unchanged', () => {
      const customPerClass = perClassResult({
        completeness: createMetricResult('computed', { value: 4.2 }),
        accuracy: createMetricResult('notAttempted'),
        spag: createMetricResult('error'),
        overall: createMetricResult('computed', { value: 3.1 }),
      });

      const result = adaptClassPageToViewModel({
        analyserResult: averagingResult({
          perClass: customPerClass,
        }),
        classFull: classFull({
          students: [student('s-1', 'Alice')],
          assignments: [
            assignment({
              assignmentId: 'a-1',
              updatedAt: DEFAULT_TS,
              definitionKey: 'dk1',
            }),
          ],
        }),
        assignmentDefinitionPartials: [createDefinitionPartial({ definitionKey: 'dk1' })],
      });

      expect(result.classMetrics.completeness).toEqual(customPerClass.completeness);
      expect(result.classMetrics.accuracy).toEqual(customPerClass.accuracy);
      expect(result.classMetrics.spag).toEqual(customPerClass.spag);
      expect(result.classMetrics.overall).toEqual(customPerClass.overall);
    });
  });

  describe('recentAssignments — baseline-mode metric resolution', () => {
    it('converts card criteria to excluded preserving observed data points when no row is inside the baseline', () => {
      // Both rows sit outside the baseline set, so the filtered row set is
      // empty: the unfiltered rollups (computed here) convert to `excluded`
      // while preserving their resolved `totalDataPoints`, and the card's
      // average composite derives from the converted criteria.
      const perTaskRows: PerTaskRow[] = [
        computedPerTaskRow('dk1', 't1', { completeness: 4, accuracy: 3, spag: 2 }),
        computedPerTaskRow('dk1', 't2', { completeness: 2, accuracy: 2, spag: 2 }),
      ];

      const result = adaptClassPageToViewModel(
        singleAssignmentAdapterInput(perTaskRows, {
          appliedAnalysisMode: 'topDecileBaseline',
          // The baseline set only contains tasks of other assignments.
          attemptBaseline: { poolStudentIds: ['s-1', 's-2'], baselineTaskKeys: ['dk2::t9'] },
        })
      );

      const metrics = result.recentAssignments[0].metrics;
      const expectedConvertedDataPoints = 2;
      expect(metrics.completeness).toMatchObject({
        state: 'excluded',
        value: null,
        totalWeight: 0,
        applicableDataPoints: 0,
        totalDataPoints: expectedConvertedDataPoints,
      });
      expect(metrics.accuracy).toMatchObject({
        state: 'excluded',
        value: null,
        totalWeight: 0,
        applicableDataPoints: 0,
        totalDataPoints: expectedConvertedDataPoints,
      });
      expect(metrics.spag).toMatchObject({
        state: 'excluded',
        value: null,
        totalWeight: 0,
        applicableDataPoints: 0,
        totalDataPoints: expectedConvertedDataPoints,
      });
      // The composite is never converted: its resolved totalDataPoints is the
      // sum of the converted criteria's counts (2 + 2 + 2).
      const expectedConvertedAverageDataPoints = 6;
      expect(metrics.average).toMatchObject({
        state: 'excluded',
        value: null,
        totalWeight: 0,
        applicableDataPoints: 0,
        totalDataPoints: expectedConvertedAverageDataPoints,
      });
    });

    it('keeps zero-evidence card criteria as error when no row is inside the baseline', () => {
      // A definition with tasks but no attempts anywhere: every criterion is
      // `error` with zero data points, so no `excluded` is synthesised
      // (ExcludedMetricSchema requires at least one observed data point).
      const noAttemptRows: PerTaskRow[] = ['t1', 't2'].map((taskId) => {
        return perTaskRow({
          definitionKey: 'dk1',
          taskId,
          completeness: createMetricResult('error', { totalDataPoints: 0 }),
          accuracy: createMetricResult('error', { totalDataPoints: 0 }),
          spag: createMetricResult('error', { totalDataPoints: 0 }),
        });
      });

      const result = adaptClassPageToViewModel(
        singleAssignmentAdapterInput(noAttemptRows, {
          appliedAnalysisMode: 'topDecileBaseline',
          attemptBaseline: { poolStudentIds: ['s-1', 's-2'], baselineTaskKeys: ['dk2::t9'] },
        })
      );

      const metrics = result.recentAssignments[0].metrics;
      expect(metrics.completeness).toMatchObject({ state: 'error', totalDataPoints: 0 });
      expect(metrics.accuracy).toMatchObject({ state: 'error', totalDataPoints: 0 });
      expect(metrics.spag).toMatchObject({ state: 'error', totalDataPoints: 0 });
      expect(metrics.average).toMatchObject({ state: 'error', totalDataPoints: 0 });
    });

    it('keeps an already-excluded zero-weight card rollup unchanged when no row is inside the baseline', () => {
      // Every observation carries zero effective weight, so the unfiltered
      // rollup is already `excluded`: the conversion leaves it untouched
      // (preserving the observed totalDataPoints) rather than re-deriving it.
      const zeroWeightRows: PerTaskRow[] = [
        { taskId: 't1', completeness: 4, accuracy: 3, spag: 2 },
        { taskId: 't2', completeness: 2, accuracy: 2, spag: 2 },
      ].map((row) => {
        return perTaskRow({
          definitionKey: 'dk1',
          taskId: row.taskId,
          averageContribution: { effectiveWeight: 0, includedInAverage: false },
          completeness: createMetricResult('computed', { value: row.completeness, totalWeight: 0 }),
          accuracy: createMetricResult('computed', { value: row.accuracy, totalWeight: 0 }),
          spag: createMetricResult('computed', { value: row.spag, totalWeight: 0 }),
        });
      });

      const result = adaptClassPageToViewModel(
        singleAssignmentAdapterInput(zeroWeightRows, {
          appliedAnalysisMode: 'topDecileBaseline',
          attemptBaseline: { poolStudentIds: ['s-1', 's-2'], baselineTaskKeys: ['dk2::t9'] },
        })
      );

      const metrics = result.recentAssignments[0].metrics;
      const expectedZeroWeightDataPoints = 2;
      expect(metrics.completeness).toMatchObject({
        state: 'excluded',
        value: null,
        totalWeight: 0,
        applicableDataPoints: 0,
        totalDataPoints: expectedZeroWeightDataPoints,
      });
      // Composite totalDataPoints: sum of the three criteria's counts (2 * 3).
      const expectedZeroWeightAverageDataPoints = 6;
      expect(metrics.average).toMatchObject({
        state: 'excluded',
        value: null,
        totalDataPoints: expectedZeroWeightAverageDataPoints,
      });
    });
  });
});
