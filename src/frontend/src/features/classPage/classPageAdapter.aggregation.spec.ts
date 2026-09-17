/**
 * Focused adapter tests: student-average synthesis and ordering, and
 * class-metric passthrough for the Class page adapter (`classPageAdapter.ts`).
 *
 * @remarks
 * Split from the original single-file `classPageAdapter.spec.ts` to keep each
 * spec module under the 500-line `max-lines` lint threshold. Shared fixture
 * builders live in `src/test/classPage/classPageAdapterTestFixtures.ts`.
 *
 * @see docs/developer/frontend/frontend-testing.md
 */

import { describe, expect, it } from 'vitest';
import { createMetricResult, createDefinitionPartial } from '../../test/dataAnalysis/fixtures';
import {
  DEFAULT_TS,
  assignment,
  averagingResult,
  classFull,
  perClassResult,
  perStudentRow,
  student,
} from '../../test/classPage/classPageAdapterTestFixtures';
import { adaptClassPageToViewModel } from './classPageAdapter';
import type { PerStudentRow } from '../../services/dataAnalysis/dataAnalysis.zod';

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
              taskIds: ['t1'],
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
              taskIds: ['t1'],
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
              taskIds: ['t1'],
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
});
