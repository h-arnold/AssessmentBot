import { describe, expect, it } from 'vitest';
import {
  getStudentMetric,
  RecentAssignmentCardModelSchema,
  StudentAverageRowModelSchema,
  ClassPageAdapterResultSchema,
} from './classPageAdapter.zod';

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
 *
 * @param overrides
 */
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
 *
 * @param overrides
 */
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
 *
 * @param overrides
 */
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
