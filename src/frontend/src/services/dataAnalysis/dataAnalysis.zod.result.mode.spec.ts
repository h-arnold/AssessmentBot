import { describe, expect, it } from 'vitest';

/**
 * Helper type for schema modules that export a `parse` method.
 */
interface ParseOnly {
  parse: (input: unknown) => unknown;
}

/**
 * Helper type for the mode-bearing result schema module shape.
 */
interface ModeResultSchemaModule {
  PerTaskRowSchema: ParseOnly;
  PerStudentTaskMetricSchema: ParseOnly;
  AveragingResultSchema: ParseOnly;
}

/**
 * Dynamically loads the dataAnalysis.zod module for mode-bearing result suites.
 *
 * @returns {Promise<ModeResultSchemaModule>} The imported module.
 */
async function loadDataAnalysisZod(): Promise<ModeResultSchemaModule> {
  return import('./dataAnalysis.zod');
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
// PerTaskRowSchema.includedInAttemptBaseline — required task-row flag
// ---------------------------------------------------------------------------

describe('PerTaskRowSchema.includedInAttemptBaseline', () => {
  it('rejects a task row that omits includedInAttemptBaseline', async () => {
    const { PerTaskRowSchema } = await loadDataAnalysisZod();

    expect(() => {
      return PerTaskRowSchema.parse({
        ...validPerTaskRow,
        averageContribution: validAverageContribution,
      });
    }).toThrow();
  });

  it('accepts an absolute-mode task row with includedInAttemptBaseline true', async () => {
    const { PerTaskRowSchema } = await loadDataAnalysisZod();

    const result = PerTaskRowSchema.parse({
      ...validPerTaskRow,
      averageContribution: validAverageContribution,
      includedInAttemptBaseline: true,
    }) as { includedInAttemptBaseline: unknown };

    expect(result.includedInAttemptBaseline).toBe(true);
  });

  it('accepts a baseline-mode task row with includedInAttemptBaseline false', async () => {
    const { PerTaskRowSchema } = await loadDataAnalysisZod();

    const result = PerTaskRowSchema.parse({
      ...validPerTaskRow,
      averageContribution: validAverageContribution,
      includedInAttemptBaseline: false,
    }) as { includedInAttemptBaseline: unknown };

    expect(result.includedInAttemptBaseline).toBe(false);
  });

  it('rejects a non-boolean includedInAttemptBaseline', async () => {
    const { PerTaskRowSchema } = await loadDataAnalysisZod();

    expect(() => {
      return PerTaskRowSchema.parse({
        ...validPerTaskRow,
        averageContribution: validAverageContribution,
        includedInAttemptBaseline: 'true',
      });
    }).toThrow();
  });
});

// ---------------------------------------------------------------------------
// PerStudentTaskMetricSchema carries no baseline flag
// ---------------------------------------------------------------------------

describe('PerStudentTaskMetricSchema baseline flag absence', () => {
  it('rejects includedInAttemptBaseline on a per-(student, task) metric', async () => {
    const { PerStudentTaskMetricSchema } = await loadDataAnalysisZod();

    expect(() => {
      return PerStudentTaskMetricSchema.parse({
        classId: 'c-1',
        studentId: 's-1',
        taskKey: 'dk_algebra::t_001',
        averageContribution: validAverageContribution,
        completeness: computedMetricResult,
        accuracy: computedMetricResult,
        spag: computedMetricResult,
        overall: computedMetricResult,
        includedInAttemptBaseline: true,
      });
    }).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Absolute-mode result — echo, absent baseline block and all-true row flags
// ---------------------------------------------------------------------------

describe('absolute-mode analysis result', () => {
  const absoluteTaskRow = {
    ...validPerTaskRow,
    averageContribution: validAverageContribution,
    includedInAttemptBaseline: true,
  };

  const absoluteResult = {
    classId: 'c-1',
    className: 'Test Class',
    perStudent: [validPerStudentRow],
    perTask: [absoluteTaskRow],
    perClass: validPerClassResult,
    appliedCriterionWeightings: validAppliedCriterionWeightings,
    appliedAnalysisMode: 'absolute',
  };

  it('parses with the appliedAnalysisMode echo and no attemptBaseline block', async () => {
    const { AveragingResultSchema } = await loadDataAnalysisZod();

    const result = AveragingResultSchema.parse(absoluteResult) as Record<string, unknown>;

    expect(result.appliedAnalysisMode).toBe('absolute');
    expect(result).not.toHaveProperty('attemptBaseline');
  });

  it('parses every per-task row with includedInAttemptBaseline true', async () => {
    const { AveragingResultSchema } = await loadDataAnalysisZod();

    const result = AveragingResultSchema.parse(absoluteResult) as {
      perTask: Array<{ includedInAttemptBaseline: unknown }>;
    };

    expect(result.perTask).toHaveLength(1);
    for (const row of result.perTask) {
      expect(row.includedInAttemptBaseline).toBe(true);
    }
  });

  it('rejects a per-task row missing includedInAttemptBaseline inside a full result', async () => {
    const { AveragingResultSchema } = await loadDataAnalysisZod();

    expect(() => {
      return AveragingResultSchema.parse({
        ...absoluteResult,
        perTask: [{ ...validPerTaskRow, averageContribution: validAverageContribution }],
      });
    }).toThrow();
  });

  it('rejects a perStudentTaskMetrics entry carrying a baseline flag', async () => {
    const { AveragingResultSchema } = await loadDataAnalysisZod();

    expect(() => {
      return AveragingResultSchema.parse({
        ...absoluteResult,
        perStudentTaskMetrics: [
          {
            classId: 'c-1',
            studentId: 's-1',
            taskKey: 'dk_algebra::t_001',
            averageContribution: validAverageContribution,
            completeness: computedMetricResult,
            accuracy: computedMetricResult,
            spag: computedMetricResult,
            overall: computedMetricResult,
            includedInAttemptBaseline: true,
          },
        ],
      });
    }).toThrow();
  });
});
