import { createMetricResult } from '../dataAnalysis/fixtures';
import type {
  ClassPageAdapterResult,
  StudentAverageRowModel,
} from '../../features/classPage/classPageAdapter.zod';

/**
 * Build a student average row with the fixture defaults.
 * @param {Partial<StudentAverageRowModel>} [overrides] - Optional row overrides.
 * @returns {StudentAverageRowModel} A complete student row.
 */
export function buildStudentRow(
  overrides?: Partial<StudentAverageRowModel>
): StudentAverageRowModel {
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
 * Build an adapter result with the fixture defaults.
 * @param {Partial<ClassPageAdapterResult>} [overrides] - Optional result overrides.
 * @returns {ClassPageAdapterResult} A complete adapter result.
 */
export function buildAdapterResult(
  overrides?: Partial<ClassPageAdapterResult>
): ClassPageAdapterResult {
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
