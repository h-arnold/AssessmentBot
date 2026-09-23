import { describe, expect, it } from 'vitest';
import { createMetricResult } from '../../test/dataAnalysis/fixtures';
import { buildClassPageViewModel } from './classPageModel';
import {
  buildAdapterResult,
  buildStudentRow,
} from '../../test/classPage/classPageModelTestFixtures';
import type { MetricResult } from '../../services/dataAnalysis/dataAnalysis.zod';

/**
 * Make a student row with the supplied completeness metric.
 * @param {string} studentId - Student identity used in stable ordering.
 * @param {MetricResult} metric - Metric result used for completeness.
 * @returns {StudentAverageRowModel} Complete student average row.
 */
function rowWithMetric(studentId: string, metric: MetricResult) {
  return buildStudentRow({
    studentId,
    studentName: studentId,
    metrics: {
      completeness: metric,
      accuracy: createMetricResult('computed'),
      spag: createMetricResult('computed'),
      average: createMetricResult('computed'),
    },
  });
}

describe('Class page model excluded state ordering and passthrough', () => {
  it('orders computed by value, then N, excluded and E in ascending order', () => {
    const rows = [
      rowWithMetric('error', createMetricResult('error')),
      rowWithMetric('excluded', createMetricResult('excluded')),
      rowWithMetric('not-attempted', createMetricResult('notAttempted')),
      rowWithMetric('computed-high', createMetricResult('computed', { value: 4 })),
      rowWithMetric('computed-low', createMetricResult('computed', { value: 1 })),
    ];
    const result = buildClassPageViewModel({
      adapterResult: buildAdapterResult({ studentAverages: rows }),
      filters: { searchTerm: '' },
      sort: { column: 'completeness', direction: 'asc' },
    });

    expect(result.studentAverages.map((row) => row.studentId)).toEqual([
      'computed-low',
      'computed-high',
      'not-attempted',
      'excluded',
      'error',
    ]);
  });

  it('reverses excluded/N/error state order in descending order while reversing computed values', () => {
    const rows = [
      rowWithMetric('computed-low', createMetricResult('computed', { value: 1 })),
      rowWithMetric('excluded', createMetricResult('excluded')),
      rowWithMetric('error', createMetricResult('error')),
      rowWithMetric('not-attempted', createMetricResult('notAttempted')),
      rowWithMetric('computed-high', createMetricResult('computed', { value: 4 })),
    ];
    const result = buildClassPageViewModel({
      adapterResult: buildAdapterResult({ studentAverages: rows }),
      filters: { searchTerm: '' },
      sort: { column: 'completeness', direction: 'desc' },
    });

    expect(result.studentAverages.map((row) => row.studentId)).toEqual([
      'error',
      'excluded',
      'not-attempted',
      'computed-high',
      'computed-low',
    ]);
  });

  it('uses ascending studentId tie-breaking for excluded rows and passes aggregate fields through', () => {
    const excludedMetric = createMetricResult('excluded');
    const recentAssignments = buildAdapterResult().recentAssignments.map((assignment) => ({
      ...assignment,
      metrics: { ...assignment.metrics, completeness: excludedMetric, average: excludedMetric },
    }));
    const classMetrics = {
      completeness: excludedMetric,
      accuracy: createMetricResult('computed'),
      spag: createMetricResult('error'),
      overall: excludedMetric,
    };
    const result = buildClassPageViewModel({
      adapterResult: buildAdapterResult({
        recentAssignments,
        classMetrics,
        studentAverages: [
          rowWithMetric('s-b', excludedMetric),
          rowWithMetric('s-a', excludedMetric),
        ],
      }),
      filters: { searchTerm: '' },
      sort: { column: 'completeness', direction: 'asc' },
    });

    expect(result.studentAverages.map((row) => row.studentId)).toEqual(['s-a', 's-b']);
    expect(result.recentAssignments).toEqual(recentAssignments);
    expect(result.classMetrics).toEqual(classMetrics);
  });
});
