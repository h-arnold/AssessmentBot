import { describe, expect, it } from 'vitest';
import {
  getStudentMetric,
  RecentAssignmentCardModelSchema,
  StudentAverageRowModelSchema,
  ClassPageAdapterResultSchema,
} from './classPageAdapter.zod';
import { MetricResultSchema } from '../../services/dataAnalysis/dataAnalysis.zod';
import { adaptClassPageToViewModel } from './classPageAdapter';
import {
  averagingResult,
  classFull,
  student,
  assignment,
  DEFAULT_TS,
} from '../../test/classPage/classPageAdapterTestFixtures';
import { createDefinitionPartial } from '../../test/dataAnalysis/fixtures';
import { createMetricResult } from '../../test/dataAnalysis/fixtures';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const validComputedMetric = {
  state: 'computed' as const,
  value: 0.75,
  totalWeight: 2,
  applicableDataPoints: 2,
  totalDataPoints: 3,
};

const validNotAttemptedMetric = {
  state: 'notAttempted' as const,
  value: 'N' as const,
  totalWeight: 0,
  applicableDataPoints: 0 as const,
  totalDataPoints: 3,
};

/**
 * Creates a valid RecentAssignmentCardModel fixture with optional overrides.
 *
 * @param {Record<string, unknown>} overrides - Partial overrides to apply.
 * @returns {object} A fixture object matching RecentAssignmentCardModelSchema.
 */
function validRecentAssignmentCard(overrides: Record<string, unknown> = {}) {
  return {
    assignmentId: 'a-1',
    assignmentName: 'Test Assignment',
    lastAssessedAt: '2026-06-01T12:00:00.000Z',
    lastAssessedAtLabel: '2026-06-01',
    metrics: {
      completeness: validComputedMetric,
      accuracy: validComputedMetric,
      spag: validNotAttemptedMetric,
      average: validComputedMetric,
    },
    ...overrides,
  };
}

/**
 * Creates a valid StudentAverageRowModel fixture with optional overrides.
 *
 * @param {Record<string, unknown>} overrides - Partial overrides to apply.
 * @returns {object} A fixture object matching StudentAverageRowModelSchema.
 */
function validStudentAverageRow(overrides: Record<string, unknown> = {}) {
  return {
    studentId: 's-1',
    studentName: 'Student A',
    metrics: {
      completeness: validComputedMetric,
      accuracy: validComputedMetric,
      spag: validComputedMetric,
      average: validComputedMetric,
    },
    ...overrides,
  };
}

/**
 * Creates a valid ClassPageAdapterResult fixture with optional overrides.
 *
 * @param {Record<string, unknown>} overrides - Partial overrides to apply.
 * @returns {object} A fixture object matching ClassPageAdapterResultSchema.
 */
function validClassPageAdapterResult(overrides: Record<string, unknown> = {}) {
  return {
    recentAssignments: [validRecentAssignmentCard()],
    studentAverages: [validStudentAverageRow()],
    classMetrics: {
      completeness: validComputedMetric,
      accuracy: validComputedMetric,
      spag: validNotAttemptedMetric,
      overall: validComputedMetric,
    },
    ...overrides,
  };
}

/**
 * Build an adapter result with the metric inserted at a selected boundary.
 * @param {unknown} metric - The metric value under validation.
 * @param {'recent' | 'student' | 'class'} location - The containing boundary.
 * @returns {object} A result with the selected metric in one location.
 */
function buildResultWithMetricAtLocation(metric: unknown, location: 'recent' | 'student') {
  const base = validClassPageAdapterResult();
  if (location === 'recent') {
    return {
      ...base,
      recentAssignments: [
        validRecentAssignmentCard({
          metrics: {
            completeness: metric,
            accuracy: validComputedMetric,
            spag: validComputedMetric,
            average: validComputedMetric,
          },
        }),
      ],
    };
  }
  return {
    ...base,
    studentAverages: [
      validStudentAverageRow({
        metrics: {
          completeness: metric,
          accuracy: validComputedMetric,
          spag: validComputedMetric,
          average: validComputedMetric,
        },
      }),
    ],
  };
}

// ---------------------------------------------------------------------------
// RecentAssignmentCardModelSchema
// ---------------------------------------------------------------------------

describe('RecentAssignmentCardModelSchema', () => {
  it('accepts a valid recent assignment card', () => {
    const input = validRecentAssignmentCard();
    const result = RecentAssignmentCardModelSchema.parse(input);
    expect(result.assignmentId).toBe('a-1');
    expect(result.assignmentName).toBe('Test Assignment');
    expect(result.metrics.completeness.state).toBe('computed');
  });

  it('rejects missing assignmentId', () => {
    const input = validRecentAssignmentCard({ assignmentId: undefined });
    expect(() => RecentAssignmentCardModelSchema.parse(input)).toThrow();
  });

  it('rejects empty assignmentId', () => {
    const input = validRecentAssignmentCard({ assignmentId: '' });
    expect(() => RecentAssignmentCardModelSchema.parse(input)).toThrow();
  });

  it('rejects invalid MetricResult shapes (state: "computed" with value: "N")', () => {
    const input = validRecentAssignmentCard({
      metrics: {
        completeness: {
          state: 'computed',
          value: 'N',
          totalWeight: 1,
          applicableDataPoints: 1,
          totalDataPoints: 1,
        },
        accuracy: validComputedMetric,
        spag: validNotAttemptedMetric,
        average: validComputedMetric,
      },
    });
    expect(() => RecentAssignmentCardModelSchema.parse(input)).toThrow();
  });

  it('rejects extra fields (strict mode)', () => {
    const input = validRecentAssignmentCard({ extraField: 'should not be allowed' });
    expect(() => RecentAssignmentCardModelSchema.parse(input)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// StudentAverageRowModelSchema
// ---------------------------------------------------------------------------

describe('StudentAverageRowModelSchema', () => {
  it('accepts a valid student average row', () => {
    const input = validStudentAverageRow();
    const result = StudentAverageRowModelSchema.parse(input);
    expect(result.studentId).toBe('s-1');
    expect(result.studentName).toBe('Student A');
  });

  it('rejects missing studentId', () => {
    const input = validStudentAverageRow({ studentId: undefined });
    expect(() => StudentAverageRowModelSchema.parse(input)).toThrow();
  });

  it('rejects empty studentId', () => {
    const input = validStudentAverageRow({ studentId: '' });
    expect(() => StudentAverageRowModelSchema.parse(input)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// ClassPageAdapterResultSchema
// ---------------------------------------------------------------------------

describe('ClassPageAdapterResultSchema', () => {
  it('accepts only the exact adapter no-data N placeholder while shared MetricResult rejects it', () => {
    const noData = {
      state: 'notAttempted',
      value: 'N',
      totalWeight: 0,
      applicableDataPoints: 0,
      totalDataPoints: 0,
    } as const;
    expect(MetricResultSchema.safeParse(noData).success).toBe(false);
    const validRawNotAttempted = { ...noData, totalDataPoints: 1 };
    const validZeroDataError = createMetricResult('error', { totalDataPoints: 0 });
    const validExcluded = createMetricResult('excluded', { totalDataPoints: 1 });
    expect(MetricResultSchema.safeParse(validRawNotAttempted).success).toBe(true);
    expect(MetricResultSchema.safeParse(validZeroDataError).success).toBe(true);
    expect(MetricResultSchema.safeParse(validExcluded).success).toBe(true);

    const actualModel = adaptClassPageToViewModel({
      analyserResult: averagingResult(),
      classFull: classFull({
        students: [student('s-empty', 'Empty Student')],
        assignments: [
          assignment({
            assignmentId: 'a-empty',
            updatedAt: DEFAULT_TS,
            definitionKey: 'dk-empty',
            taskIds: [],
          }),
        ],
      }),
      assignmentDefinitionPartials: [createDefinitionPartial({ definitionKey: 'dk-empty' })],
    });
    const parsed = ClassPageAdapterResultSchema.parse(actualModel);
    expect(parsed.studentAverages[0].metrics.average).toEqual(noData);
    expect(parsed.recentAssignments[0].metrics.completeness).toEqual(noData);
    expect(parsed.classMetrics.completeness).toEqual(createMetricResult('computed', { value: 4 }));
    for (const location of ['recent', 'student'] as const) {
      expect(
        ClassPageAdapterResultSchema.safeParse(buildResultWithMetricAtLocation(noData, location))
          .success
      ).toBe(true);
    }
    const classMetricsPlaceholder = {
      ...validClassPageAdapterResult(),
      classMetrics: {
        completeness: noData,
        accuracy: validComputedMetric,
        spag: validComputedMetric,
        overall: validComputedMetric,
      },
    };
    expect(ClassPageAdapterResultSchema.safeParse(classMetricsPlaceholder).success).toBe(false);

    for (const invalid of [
      { state: 'computed', value: 0, totalWeight: 0, applicableDataPoints: 0, totalDataPoints: 0 },
      {
        state: 'excluded',
        value: null,
        totalWeight: 0,
        applicableDataPoints: 0,
        totalDataPoints: 0,
      },
      { ...noData, totalWeight: 1 },
      { ...noData, value: 'E' },
      { ...noData, applicableDataPoints: 1 },
    ]) {
      for (const location of ['recent', 'student'] as const) {
        expect(
          ClassPageAdapterResultSchema.safeParse(buildResultWithMetricAtLocation(invalid, location))
            .success
        ).toBe(false);
      }
    }
    for (const validMetric of [validRawNotAttempted, validZeroDataError, validExcluded]) {
      const classMetricsResult = {
        ...validClassPageAdapterResult(),
        classMetrics: {
          completeness: validMetric,
          accuracy: validComputedMetric,
          spag: validComputedMetric,
          overall: validComputedMetric,
        },
      };
      expect(ClassPageAdapterResultSchema.safeParse(classMetricsResult).success).toBe(true);
    }
  });

  it('passes excluded aggregate results through student and class metrics', () => {
    const excluded = createMetricResult('excluded', { totalDataPoints: 2 });
    const input = {
      ...validClassPageAdapterResult(),
      recentAssignments: [
        validRecentAssignmentCard({
          metrics: {
            completeness: excluded,
            accuracy: validComputedMetric,
            spag: validComputedMetric,
            average: excluded,
          },
        }),
      ],
      studentAverages: [
        validStudentAverageRow({
          metrics: {
            completeness: excluded,
            accuracy: validComputedMetric,
            spag: validComputedMetric,
            average: excluded,
          },
        }),
      ],
      classMetrics: {
        completeness: excluded,
        accuracy: validComputedMetric,
        spag: validComputedMetric,
        overall: excluded,
      },
    };
    expect(ClassPageAdapterResultSchema.parse(input)).toMatchObject({
      recentAssignments: [
        { metrics: { completeness: { state: 'excluded' }, average: { state: 'excluded' } } },
      ],
      studentAverages: [
        { metrics: { completeness: { state: 'excluded' }, average: { state: 'excluded' } } },
      ],
      classMetrics: { completeness: { state: 'excluded' }, overall: { state: 'excluded' } },
    });
  });
  it('round-trips a valid adapter output', () => {
    const input = validClassPageAdapterResult();
    const result = ClassPageAdapterResultSchema.parse(input);

    expect(result.recentAssignments).toHaveLength(1);
    expect(result.recentAssignments[0].assignmentId).toBe('a-1');

    expect(result.studentAverages).toHaveLength(1);
    expect(result.studentAverages[0].studentId).toBe('s-1');

    expect(result.classMetrics.completeness.state).toBe('computed');
    expect(result.classMetrics.overall.state).toBe('computed');
  });

  it('rejects an adapter output with an invalid MetricResult in classMetrics', () => {
    const input = validClassPageAdapterResult({
      classMetrics: {
        completeness: {
          state: 'computed',
          value: 'N',
          totalWeight: 1,
          applicableDataPoints: 1,
          totalDataPoints: 1,
        },
        accuracy: validComputedMetric,
        spag: validNotAttemptedMetric,
        overall: validComputedMetric,
      },
    });
    expect(() => ClassPageAdapterResultSchema.parse(input)).toThrow();
  });

  it('rejects missing recentAssignments', () => {
    const input = validClassPageAdapterResult({ recentAssignments: undefined });
    expect(() => ClassPageAdapterResultSchema.parse(input)).toThrow();
  });

  it('rejects missing studentAverages', () => {
    const input = validClassPageAdapterResult({ studentAverages: undefined });
    expect(() => ClassPageAdapterResultSchema.parse(input)).toThrow();
  });

  it('rejects missing classMetrics', () => {
    const input = validClassPageAdapterResult({ classMetrics: undefined });
    expect(() => ClassPageAdapterResultSchema.parse(input)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// getStudentMetric
// ---------------------------------------------------------------------------

describe('getStudentMetric', () => {
  const metrics = {
    completeness: validComputedMetric,
    accuracy: validComputedMetric,
    spag: validNotAttemptedMetric,
    average: validComputedMetric,
  };

  it('returns metrics.completeness for key "completeness"', () => {
    const result = getStudentMetric(metrics, 'completeness');
    expect(result).toBe(metrics.completeness);
  });

  it('returns metrics.accuracy for key "accuracy"', () => {
    const result = getStudentMetric(metrics, 'accuracy');
    expect(result).toBe(metrics.accuracy);
  });

  it('returns metrics.spag for key "spag"', () => {
    const result = getStudentMetric(metrics, 'spag');
    expect(result).toBe(metrics.spag);
  });

  it('returns metrics.average for key "average"', () => {
    const result = getStudentMetric(metrics, 'average');
    expect(result).toBe(metrics.average);
  });
});
