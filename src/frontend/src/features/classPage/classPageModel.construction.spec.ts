/**
 * Tests for Class page view-model construction and unchanged adapter fields.
 *
 * @see SPEC_CLASS_PAGE.md — "classPageModel — view-model builder"
 */

import { describe, expect, it } from 'vitest';
import { createMetricResult } from '../../test/dataAnalysis/fixtures';
import { buildClassPageViewModel } from './classPageModel';
import {
  buildAdapterResult,
  buildStudentRow,
} from '../../test/classPage/classPageModelTestFixtures';

describe('buildClassPageViewModel construction', () => {
  it('passes through recentAssignments and classMetrics unchanged', () => {
    const adapterResult = buildAdapterResult({
      recentAssignments: [
        {
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
        },
      ],
      classMetrics: {
        completeness: createMetricResult('computed', { value: 4.5 }),
        accuracy: createMetricResult('computed', { value: 3 }),
        spag: createMetricResult('error'),
        overall: createMetricResult('computed', { value: 3.7 }),
      },
    });

    const result = buildClassPageViewModel({
      adapterResult,
      filters: { searchTerm: '' },
      sort: { column: 'forename', direction: 'asc' },
    });

    expect(result.recentAssignments).toEqual(adapterResult.recentAssignments);
    expect(result.classMetrics).toEqual(adapterResult.classMetrics);
  });

  it('returns the matching student rows when no search term is supplied', () => {
    const students = [
      buildStudentRow({ studentId: 's-1', studentName: 'Alice' }),
      buildStudentRow({ studentId: 's-2', studentName: 'Bob' }),
    ];
    const result = buildClassPageViewModel({
      adapterResult: buildAdapterResult({ studentAverages: students }),
      filters: { searchTerm: '' },
      sort: { column: 'forename', direction: 'asc' },
    });

    const EXPECTED_STUDENT_COUNT = 2;
    expect(result.studentAverages).toHaveLength(EXPECTED_STUDENT_COUNT);
  });
});
