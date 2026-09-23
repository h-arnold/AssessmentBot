import { describe, expect, it } from 'vitest';
import type { DataAnalysisResponse } from './dataAnalysis.zod';

/**
 * Helper type for schema modules that export a `parse` method.
 */
interface ParseOnly {
  parse: (input: unknown) => unknown;
}

/**
 * Helper type for the result/output schema module shape.
 */
interface ResultSchemaModule {
  MetricResultSchema: ParseOnly;
  PerStudentRowSchema: ParseOnly;
  PerTaskRowSchema: ParseOnly;
  PerClassResultSchema: ParseOnly;
  AveragingResultSchema: ParseOnly;
  DataAnalysisResponseSchema: ParseOnly;
  PerStudentTaskMetricSchema: ParseOnly;
}

/**
 * Dynamically loads the dataAnalysis.zod module for result/output suites.
 *
 * @returns {Promise<ResultSchemaModule>} The imported module.
 */
async function loadDataAnalysisZod(): Promise<ResultSchemaModule> {
  return import('./dataAnalysis.zod') as unknown as Promise<ResultSchemaModule>;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const computedMetricResult = {
  state: 'computed' as const,
  value: 0.75,
  totalWeight: 2,
  applicableDataPoints: 2,
  totalDataPoints: 2,
};

const notAttemptedMetricResult = {
  state: 'notAttempted' as const,
  value: 'N' as const,
  totalWeight: 0,
  applicableDataPoints: 0 as const,
  totalDataPoints: 3,
};

const excludedMetricResult = {
  state: 'excluded' as const,
  value: null,
  totalWeight: 0,
  applicableDataPoints: 0,
  totalDataPoints: 2,
};

const validPerStudentRow = {
  studentId: 's-1',
  studentName: 'Student A',
  completeness: computedMetricResult,
  accuracy: computedMetricResult,
  spag: computedMetricResult,
  overall: computedMetricResult,
};

const validPerTaskRow = {
  definitionKey: 'def-1',
  taskId: 't_abc123',
  taskTitle: null,
  completeness: computedMetricResult,
  accuracy: computedMetricResult,
  spag: computedMetricResult,
  overall: computedMetricResult,
};

const validAverageContribution = {
  effectiveWeight: 0.4,
  includedInAverage: true,
};

const validPerClassResult = {
  completeness: computedMetricResult,
  accuracy: computedMetricResult,
  spag: computedMetricResult,
  overall: computedMetricResult,
};

const validAppliedCriterionWeightings = {
  completeness: 0.4,
  accuracy: 0.4,
  spag: 0.2,
};

// ---------------------------------------------------------------------------
// PerStudentRowSchema — round-trip with MetricResult shape
// ---------------------------------------------------------------------------

describe('PerStudentRowSchema', () => {
  it('round-trips with the new MetricResult shape', async () => {
    const { PerStudentRowSchema } = await loadDataAnalysisZod();

    const result = PerStudentRowSchema.parse(validPerStudentRow);

    expect(result).toMatchObject({
      studentId: 's-1',
      studentName: 'Student A',
      completeness: { state: 'computed', value: 0.75 },
      accuracy: { state: 'computed', value: 0.75 },
      spag: { state: 'computed', value: 0.75 },
      overall: { state: 'computed', value: 0.75 },
    });
  });

  it('rejects task-level averageContribution metadata on aggregate rows', async () => {
    const { PerStudentRowSchema } = await loadDataAnalysisZod();

    expect(() =>
      PerStudentRowSchema.parse({
        ...validPerStudentRow,
        averageContribution: validAverageContribution,
      })
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// PerTaskRowSchema — display-scope metrics plus contribution metadata
// ---------------------------------------------------------------------------

describe('PerTaskRowSchema', () => {
  it('round-trips with the new MetricResult shape', async () => {
    const { PerTaskRowSchema } = await loadDataAnalysisZod();

    const result = PerTaskRowSchema.parse({
      ...validPerTaskRow,
      averageContribution: validAverageContribution,
    });

    expect(result).toMatchObject({
      definitionKey: 'def-1',
      taskId: 't_abc123',
      taskTitle: null,
      completeness: { state: 'computed', value: 0.75 },
      accuracy: { state: 'computed', value: 0.75 },
      spag: { state: 'computed', value: 0.75 },
      overall: { state: 'computed', value: 0.75 },
      averageContribution: validAverageContribution,
    });
  });

  it('accepts contribution metadata with effectiveWeight 0', async () => {
    const { PerTaskRowSchema } = await loadDataAnalysisZod();

    const zeroWeightContribution = { effectiveWeight: 0, includedInAverage: false };
    const result = PerTaskRowSchema.parse({
      ...validPerTaskRow,
      averageContribution: zeroWeightContribution,
    });

    expect(result).toMatchObject({ averageContribution: zeroWeightContribution });
  });

  it('rejects task-level excluded metric states', async () => {
    const { PerTaskRowSchema } = await loadDataAnalysisZod();

    expect(() =>
      PerTaskRowSchema.parse({
        ...validPerTaskRow,
        averageContribution: validAverageContribution,
        overall: excludedMetricResult,
      })
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// PerClassResultSchema — aggregate scope may use excluded
// ---------------------------------------------------------------------------

describe('PerClassResultSchema', () => {
  it('round-trips with the new MetricResult shape', async () => {
    const { PerClassResultSchema } = await loadDataAnalysisZod();

    const result = PerClassResultSchema.parse(validPerClassResult);

    expect(result).toMatchObject({
      completeness: { state: 'computed', value: 0.75 },
      accuracy: { state: 'computed', value: 0.75 },
      spag: { state: 'computed', value: 0.75 },
      overall: { state: 'computed', value: 0.75 },
    });
  });

  it('accepts an excluded aggregate metric', async () => {
    const { PerClassResultSchema } = await loadDataAnalysisZod();

    const result = PerClassResultSchema.parse({
      ...validPerClassResult,
      overall: excludedMetricResult,
    }) as { overall: unknown };

    expect(result.overall).toMatchObject({ state: 'excluded', value: null });
  });
});

// ---------------------------------------------------------------------------
// AveragingResultSchema
// ---------------------------------------------------------------------------

describe('AveragingResultSchema', () => {
  it('accepts a valid full result', async () => {
    const { AveragingResultSchema } = await loadDataAnalysisZod();

    const result = AveragingResultSchema.parse({
      classId: 'c-1',
      className: 'Test Class',
      perStudent: [validPerStudentRow],
      perTask: [{ ...validPerTaskRow, averageContribution: validAverageContribution }],
      perClass: validPerClassResult,
      appliedCriterionWeightings: validAppliedCriterionWeightings,
    });

    expect(result).toEqual({
      classId: 'c-1',
      className: 'Test Class',
      perStudent: [validPerStudentRow],
      perTask: [{ ...validPerTaskRow, averageContribution: validAverageContribution }],
      perClass: validPerClassResult,
      appliedCriterionWeightings: validAppliedCriterionWeightings,
    });
  });

  it('accepts excluded metrics in perClass aggregate scope', async () => {
    const { AveragingResultSchema } = await loadDataAnalysisZod();

    const result = AveragingResultSchema.parse({
      classId: 'c-1',
      className: 'Test Class',
      perStudent: [validPerStudentRow],
      perTask: [{ ...validPerTaskRow, averageContribution: validAverageContribution }],
      perClass: { ...validPerClassResult, overall: excludedMetricResult },
      appliedCriterionWeightings: validAppliedCriterionWeightings,
    }) as { perClass: { overall: unknown } };

    expect(result.perClass.overall).toMatchObject({ state: 'excluded', value: null });
  });

  it('accepts a result without perStudentTaskMetrics (optional)', async () => {
    const { AveragingResultSchema } = await loadDataAnalysisZod();

    const result = AveragingResultSchema.parse({
      classId: 'c-1',
      className: 'Test Class',
      perStudent: [validPerStudentRow],
      perTask: [{ ...validPerTaskRow, averageContribution: validAverageContribution }],
      perClass: validPerClassResult,
      appliedCriterionWeightings: validAppliedCriterionWeightings,
    });

    expect(result).toBeDefined();
    // The perStudentTaskMetrics key is optional and absent when not provided.
  });

  it('rejects perStudentTaskMetrics when value is not an array', async () => {
    const { AveragingResultSchema } = await loadDataAnalysisZod();

    expect(() =>
      AveragingResultSchema.parse({
        classId: 'c-1',
        className: 'Test Class',
        perStudent: [validPerStudentRow],
        perTask: [{ ...validPerTaskRow, averageContribution: validAverageContribution }],
        perClass: validPerClassResult,
        appliedCriterionWeightings: validAppliedCriterionWeightings,
        perStudentTaskMetrics: 'not-an-array',
      })
    ).toThrow();
  });

  it('accepts perStudentTaskMetrics as an array of valid entries', async () => {
    const { AveragingResultSchema, PerStudentTaskMetricSchema } = await loadDataAnalysisZod();

    const validMetric = PerStudentTaskMetricSchema.parse({
      classId: 'c-1',
      studentId: 's-1',
      taskKey: 'dk_algebra::t_001',
      averageContribution: validAverageContribution,
      completeness: computedMetricResult,
      accuracy: computedMetricResult,
      spag: computedMetricResult,
      overall: computedMetricResult,
    });

    const result = AveragingResultSchema.parse({
      classId: 'c-1',
      className: 'Test Class',
      perStudent: [validPerStudentRow],
      perTask: [{ ...validPerTaskRow, averageContribution: validAverageContribution }],
      perClass: validPerClassResult,
      appliedCriterionWeightings: validAppliedCriterionWeightings,
      perStudentTaskMetrics: [validMetric],
    });

    expect(result).toBeDefined();
    const parsed = result as Record<string, unknown>;
    expect(parsed.perStudentTaskMetrics).toBeDefined();
    expect(Array.isArray(parsed.perStudentTaskMetrics)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// DataAnalysisResponseSchema
// ---------------------------------------------------------------------------

describe('DataAnalysisResponseSchema', () => {
  it('accepts an array of AveragingResultSchema', async () => {
    const { DataAnalysisResponseSchema } = await loadDataAnalysisZod();

    const validAveragingResult = {
      classId: 'c-1',
      className: 'Test Class',
      perStudent: [validPerStudentRow],
      perTask: [{ ...validPerTaskRow, averageContribution: validAverageContribution }],
      perClass: validPerClassResult,
      appliedCriterionWeightings: validAppliedCriterionWeightings,
    };

    const result = DataAnalysisResponseSchema.parse([validAveragingResult]) as DataAnalysisResponse;

    expect(result).toHaveLength(1);
    expect(result[0].classId).toBe('c-1');
  });
});

// ---------------------------------------------------------------------------
// PerStudentTaskMetricSchema — display-scope metrics plus contribution metadata
// ---------------------------------------------------------------------------

describe('PerStudentTaskMetricSchema', () => {
  it('parses a valid metric with contribution metadata and criterion scores', async () => {
    const { PerStudentTaskMetricSchema } = await loadDataAnalysisZod();

    const result = PerStudentTaskMetricSchema.parse({
      classId: 'c-1',
      studentId: 's-1',
      taskKey: 'dk_algebra::t_001',
      averageContribution: validAverageContribution,
      completeness: computedMetricResult,
      accuracy: computedMetricResult,
      spag: notAttemptedMetricResult,
      overall: computedMetricResult,
    });

    expect(result).toMatchObject({
      classId: 'c-1',
      studentId: 's-1',
      taskKey: 'dk_algebra::t_001',
      averageContribution: validAverageContribution,
    });
  });

  it('rejects task-level excluded metric states', async () => {
    const { PerStudentTaskMetricSchema } = await loadDataAnalysisZod();

    expect(() =>
      PerStudentTaskMetricSchema.parse({
        classId: 'c-1',
        studentId: 's-1',
        taskKey: 'dk_algebra::t_001',
        averageContribution: validAverageContribution,
        completeness: computedMetricResult,
        accuracy: computedMetricResult,
        spag: computedMetricResult,
        overall: excludedMetricResult,
      })
    ).toThrow();
  });

  it('rejects extra keys such as taskId (strict object)', async () => {
    const { PerStudentTaskMetricSchema } = await loadDataAnalysisZod();

    expect(() =>
      PerStudentTaskMetricSchema.parse({
        classId: 'c-1',
        studentId: 's-1',
        taskKey: 'dk_algebra::t_001',
        averageContribution: validAverageContribution,
        completeness: computedMetricResult,
        accuracy: computedMetricResult,
        spag: computedMetricResult,
        overall: computedMetricResult,
        taskId: 't_001',
      })
    ).toThrow();
  });

  it('rejects extra keys such as taskTitle (strict object)', async () => {
    const { PerStudentTaskMetricSchema } = await loadDataAnalysisZod();

    expect(() =>
      PerStudentTaskMetricSchema.parse({
        classId: 'c-1',
        studentId: 's-1',
        taskKey: 'dk_algebra::t_001',
        averageContribution: validAverageContribution,
        completeness: computedMetricResult,
        accuracy: computedMetricResult,
        spag: computedMetricResult,
        overall: computedMetricResult,
        taskTitle: 'A Task',
      })
    ).toThrow();
  });
});
