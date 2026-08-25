import { describe, expect, it } from 'vitest';
import type { AveragingAnalyserInput, DataAnalysisResponse } from './dataAnalysis.zod';
import {
  StudentSubmissionItemPartialSchema,
  StudentSubmissionPartialSchema,
} from '../googleClassrooms/classDetail/classDetailService.zod';

/**
 * Helper type for schema modules that export a `parse` method.
 */
interface ParseOnly {
  parse: (input: unknown) => unknown;
}

/**
 * Helper type for the `AnalysisFilterSchema` module shape.
 */
interface AnalysisFilterSchemaModule {
  AnalysisFilterSchema: ParseOnly;
  AveragingAnalyserInputSchema: ParseOnly;
  MetricResultSchema: ParseOnly;
  AveragingResultSchema: ParseOnly;
  PerStudentRowSchema: ParseOnly;
  PerTaskRowSchema: ParseOnly;
  PerClassResultSchema: ParseOnly;
  DataAnalysisResponseSchema: ParseOnly;
  PerStudentTaskMetricSchema: ParseOnly;
}

/**
 * Dynamically loads the dataAnalysis.zod module.
 *
 * @returns {Promise<AnalysisFilterSchemaModule>} The imported module.
 */
async function loadDataAnalysisZod(): Promise<AnalysisFilterSchemaModule> {
  return import('./dataAnalysis.zod') as unknown as Promise<AnalysisFilterSchemaModule>;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const validIsoTimestamp = '2026-01-15T10:00:00.000Z';
const validIsoTimestampLater = '2026-06-01T00:00:00.000Z';

const minimalAssignmentDefinitionPartial = {
  primaryTitle: 'Test',
  primaryTopic: 'Maths',
  primaryTopicKey: 'maths',
  yearGroupKey: 'yg-10',
  yearGroupLabel: 'Year 10',
  alternateTitles: [],
  alternateTopics: [],
  documentType: 'assignment',
  referenceDocumentId: null,
  templateDocumentId: null,
  assignmentWeighting: null,
  definitionKey: 'def-1',
  tasks: [],
  createdAt: null,
  updatedAt: null,
};

const minimalClassFull = {
  classId: 'c-1',
  className: 'Test Class',
  cohortKey: null,
  courseLength: 1,
  yearGroupKey: 'yg-10',
  classOwner: { userId: 'u-1', email: 'teacher@test.com', teacherName: 'Mr T' },
  teachers: [{ userId: 'u-1', email: 'teacher@test.com', teacherName: 'Mr T' }],
  students: [{ name: 'Student A', email: 's-a@test.com', id: 's-1' }],
  assignments: [
    {
      courseId: 'course-1',
      assignmentId: 'a-1',
      assignmentName: 'Test Assignment',
      dueDate: null,
      updatedAt: null,
      createdAt: validIsoTimestamp,
      documentType: null,
      submissions: [
        {
          studentId: 's-1',
          studentName: 'Student A',
          assignmentId: 'a-1',
          documentId: null,
          items: {},
          createdAt: validIsoTimestamp,
          updatedAt: validIsoTimestamp,
        },
      ],
      assignmentDefinitionKey: 'def-1',
    },
  ],
  active: true,
};

// MetricResult fixtures for the new discriminated union shape
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

const errorMetricResult = {
  state: 'error' as const,
  value: 'E' as const,
  totalWeight: 0,
  applicableDataPoints: 0 as const,
  totalDataPoints: 3,
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
// AnalysisFilterSchema
// ---------------------------------------------------------------------------

describe('AnalysisFilterSchema', () => {
  it('accepts valid minimal input (classIds only)', async () => {
    const { AnalysisFilterSchema } = await loadDataAnalysisZod();

    const result = AnalysisFilterSchema.parse({ classIds: ['c1'] });

    expect(result).toEqual({ classIds: ['c1'] });
  });

  it('accepts valid full input with all optional fields', async () => {
    const { AnalysisFilterSchema } = await loadDataAnalysisZod();

    const result = AnalysisFilterSchema.parse({
      classIds: ['c1', 'c2'],
      dateRange: {
        from: validIsoTimestamp,
        to: validIsoTimestampLater,
      },
      topicKeys: ['topic-1'],
      assignmentDefinitionKeys: ['def-1'],
      criterionWeightings: {
        completeness: 0.4,
        accuracy: 0.4,
        spag: 0.2,
      },
    });

    expect(result).toEqual({
      classIds: ['c1', 'c2'],
      dateRange: {
        from: validIsoTimestamp,
        to: validIsoTimestampLater,
      },
      topicKeys: ['topic-1'],
      assignmentDefinitionKeys: ['def-1'],
      criterionWeightings: {
        completeness: 0.4,
        accuracy: 0.4,
        spag: 0.2,
      },
    });
  });

  it('rejects empty classIds array', async () => {
    const { AnalysisFilterSchema } = await loadDataAnalysisZod();

    expect(() => AnalysisFilterSchema.parse({ classIds: [] })).toThrow();
  });

  it('rejects dateRange.from > dateRange.to', async () => {
    const { AnalysisFilterSchema } = await loadDataAnalysisZod();

    expect(() =>
      AnalysisFilterSchema.parse({
        classIds: ['c1'],
        dateRange: {
          from: validIsoTimestampLater,
          to: validIsoTimestamp,
        },
      })
    ).toThrow();
  });

  it('rejects criterionWeightings not summing to 1.0', async () => {
    const { AnalysisFilterSchema } = await loadDataAnalysisZod();

    expect(() =>
      AnalysisFilterSchema.parse({
        classIds: ['c1'],
        criterionWeightings: {
          completeness: 0.5,
          accuracy: 0.5,
          spag: 0.5,
        },
      })
    ).toThrow();
  });

  it('rejects criterionWeightings with negative values', async () => {
    const { AnalysisFilterSchema } = await loadDataAnalysisZod();

    expect(() =>
      AnalysisFilterSchema.parse({
        classIds: ['c1'],
        criterionWeightings: {
          completeness: -0.1,
          accuracy: 0.5,
          spag: 0.6,
        },
      })
    ).toThrow();
  });

  it('rejects extra fields (strict mode)', async () => {
    const { AnalysisFilterSchema } = await loadDataAnalysisZod();

    expect(() =>
      AnalysisFilterSchema.parse({
        classIds: ['c1'],
        extraField: 'should not be allowed',
      })
    ).toThrow();
  });

  it('rejects dateRange with non-strict ISO timestamp (missing milliseconds)', async () => {
    const { AnalysisFilterSchema } = await loadDataAnalysisZod();

    expect(() =>
      AnalysisFilterSchema.parse({
        classIds: ['c1'],
        dateRange: {
          from: '2026-01-05T10:00:00Z',
          to: validIsoTimestampLater,
        },
      })
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// AveragingAnalyserInputSchema
// ---------------------------------------------------------------------------

describe('AveragingAnalyserInputSchema', () => {
  it('accepts valid input with minimal ClassFullSchema, one definition partial, and filter', async () => {
    const { AveragingAnalyserInputSchema } = await loadDataAnalysisZod();

    const result = AveragingAnalyserInputSchema.parse({
      classes: [minimalClassFull],
      assignmentDefinitionPartials: [minimalAssignmentDefinitionPartial],
      filter: { classIds: ['c-1'] },
    });

    expect(result).toBeDefined();
    const typedResult = result as AveragingAnalyserInput;
    expect(typedResult.classes).toHaveLength(1);
    expect(typedResult.assignmentDefinitionPartials).toHaveLength(1);
    expect(typedResult.filter.classIds).toEqual(['c-1']);
  });

  it('rejects missing required field', async () => {
    const { AveragingAnalyserInputSchema } = await loadDataAnalysisZod();

    expect(() =>
      AveragingAnalyserInputSchema.parse({
        classes: [minimalClassFull],
        assignmentDefinitionPartials: [minimalAssignmentDefinitionPartial],
        // missing filter
      })
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// MetricResultSchema — rewritten for the new discriminated union shape
// ---------------------------------------------------------------------------

describe('MetricResultSchema', () => {
  it('round-trips a computed shape', async () => {
    const { MetricResultSchema } = await loadDataAnalysisZod();

    const result = MetricResultSchema.parse(computedMetricResult);

    expect(result).toMatchObject({
      state: 'computed',
      value: 0.75,
      totalWeight: 2,
      applicableDataPoints: 2,
      totalDataPoints: 2,
    });
  });

  it('round-trips a notAttempted shape with value: "N"', async () => {
    const { MetricResultSchema } = await loadDataAnalysisZod();

    const result = MetricResultSchema.parse(notAttemptedMetricResult);

    expect(result).toMatchObject({
      state: 'notAttempted',
      value: 'N',
      totalWeight: 0,
      applicableDataPoints: 0,
      totalDataPoints: 3,
    });
  });

  it('round-trips an error shape with value: "E"', async () => {
    const { MetricResultSchema } = await loadDataAnalysisZod();

    const result = MetricResultSchema.parse(errorMetricResult);

    expect(result).toMatchObject({
      state: 'error',
      value: 'E',
      totalWeight: 0,
      applicableDataPoints: 0,
      totalDataPoints: 3,
    });
  });

  it('rejects a mismatched shape (state: "computed" with value: "N")', async () => {
    const { MetricResultSchema } = await loadDataAnalysisZod();

    expect(() =>
      MetricResultSchema.parse({
        state: 'computed',
        value: 'N',
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      })
    ).toThrow();
  });

  it('rejects computed state with applicableDataPoints = 0', async () => {
    const { MetricResultSchema } = await loadDataAnalysisZod();

    expect(() =>
      MetricResultSchema.parse({
        state: 'computed',
        value: 5,
        totalWeight: 1,
        applicableDataPoints: 0,
        totalDataPoints: 1,
      })
    ).toThrow();
  });

  it('rejects notAttempted state with applicableDataPoints > 0', async () => {
    const { MetricResultSchema } = await loadDataAnalysisZod();

    expect(() =>
      MetricResultSchema.parse({
        state: 'notAttempted',
        value: 'N',
        totalWeight: 0,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      })
    ).toThrow();
  });

  it('rejects error state with applicableDataPoints > 0', async () => {
    const { MetricResultSchema } = await loadDataAnalysisZod();

    expect(() =>
      MetricResultSchema.parse({
        state: 'error',
        value: 'E',
        totalWeight: 0,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      })
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// PerStudentRowSchema — round-trip with new MetricResult shape
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
});

// ---------------------------------------------------------------------------
// PerTaskRowSchema — round-trip with new MetricResult shape
// ---------------------------------------------------------------------------

describe('PerTaskRowSchema', () => {
  it('round-trips with the new MetricResult shape', async () => {
    const { PerTaskRowSchema } = await loadDataAnalysisZod();

    const result = PerTaskRowSchema.parse(validPerTaskRow);

    expect(result).toMatchObject({
      definitionKey: 'def-1',
      taskId: 't_abc123',
      taskTitle: null,
      completeness: { state: 'computed', value: 0.75 },
      accuracy: { state: 'computed', value: 0.75 },
      spag: { state: 'computed', value: 0.75 },
      overall: { state: 'computed', value: 0.75 },
    });
  });
});

// ---------------------------------------------------------------------------
// PerClassResultSchema — round-trip with new MetricResult shape
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
      perTask: [validPerTaskRow],
      perClass: validPerClassResult,
      appliedCriterionWeightings: validAppliedCriterionWeightings,
    });

    expect(result).toEqual({
      classId: 'c-1',
      className: 'Test Class',
      perStudent: [validPerStudentRow],
      perTask: [validPerTaskRow],
      perClass: validPerClassResult,
      appliedCriterionWeightings: validAppliedCriterionWeightings,
    });
  });
});

// ---------------------------------------------------------------------------
// StudentSubmissionItemPartialSchema.assessments — imported from classDetailService.zod.ts
// ---------------------------------------------------------------------------

describe('StudentSubmissionItemPartialSchema.assessments', () => {
  const validItemBase = {
    id: 'sub-1',
    taskId: 'task-1',
    artifact: {
      taskId: 'task-1',
      role: 'student',
      content: null,
      contentHash: null,
      uid: 'uid-1',
      type: 'slides',
    },
  };

  it('accepts valid integer scores (0-5)', () => {
    const result = StudentSubmissionItemPartialSchema.parse({
      ...validItemBase,
      assessments: { completeness: { score: 0 }, accuracy: { score: 3 }, spag: { score: 5 } },
    });
    expect(result.assessments).toBeDefined();
    expect(result.assessments!.completeness.score).toBe(0);
    const expectedAccuracyScore = 3;
    const expectedSpagScore = 5;
    expect(result.assessments!.accuracy.score).toBe(expectedAccuracyScore);
    expect(result.assessments!.spag.score).toBe(expectedSpagScore);
  });

  it('accepts "N" score for SPaG (non-applicable)', () => {
    const result = StudentSubmissionItemPartialSchema.parse({
      ...validItemBase,
      assessments: { spag: { score: 'N' } },
    });
    expect(result.assessments!.spag.score).toBe('N');
  });

  it('rejects score above 5', () => {
    expect(() =>
      StudentSubmissionItemPartialSchema.parse({
        ...validItemBase,
        assessments: { completeness: { score: 6 } },
      })
    ).toThrow();
  });

  it('rejects negative score', () => {
    expect(() =>
      StudentSubmissionItemPartialSchema.parse({
        ...validItemBase,
        assessments: { accuracy: { score: -1 } },
      })
    ).toThrow();
  });

  it('rejects non-integer score', () => {
    expect(() =>
      StudentSubmissionItemPartialSchema.parse({
        ...validItemBase,
        assessments: { completeness: { score: 3.5 } },
      })
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// StudentSubmissionPartialSchema — imported from classDetailService.zod.ts
// ---------------------------------------------------------------------------

describe('StudentSubmissionPartialSchema', () => {
  const validItemBase = {
    id: 'sub-1',
    taskId: 't_abc',
    artifact: {
      taskId: 't_abc',
      role: 'student',
      content: null,
      contentHash: null,
      uid: 'uid-1',
      type: 'slides',
    },
  };

  it('accepts items as a record/dictionary keyed by taskId', () => {
    const result = StudentSubmissionPartialSchema.parse({
      studentId: 's-1',
      studentName: 'Alice',
      assignmentId: 'a-1',
      documentId: null,
      items: { t_abc: validItemBase },
      createdAt: '2026-01-15T10:00:00.000Z',
      updatedAt: '2026-01-15T10:00:00.000Z',
    });
    expect(result.items['t_abc']).toBeDefined();
    expect(result.items['t_abc'].taskId).toBe('t_abc');
  });

  it('rejects items as a flat array (the pre-existing bug shape)', () => {
    expect(() =>
      StudentSubmissionPartialSchema.parse({
        studentId: 's-1',
        studentName: 'Alice',
        assignmentId: 'a-1',
        documentId: null,
        items: [validItemBase],
        createdAt: '2026-01-15T10:00:00.000Z',
        updatedAt: '2026-01-15T10:00:00.000Z',
      })
    ).toThrow();
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
      perTask: [validPerTaskRow],
      perClass: validPerClassResult,
      appliedCriterionWeightings: validAppliedCriterionWeightings,
    };

    const result = DataAnalysisResponseSchema.parse([validAveragingResult]) as DataAnalysisResponse;

    expect(result).toHaveLength(1);
    expect(result[0].classId).toBe('c-1');
  });
});

// ---------------------------------------------------------------------------
// PerStudentTaskMetricSchema — RED phase (does not yet exist in production)
// ---------------------------------------------------------------------------

describe('PerStudentTaskMetricSchema', () => {
  it('parses a valid metric with criterion scores 0..5 and "N" and string identifiers', async () => {
    const { PerStudentTaskMetricSchema } = await loadDataAnalysisZod();

    const result = PerStudentTaskMetricSchema.parse({
      classId: 'c-1',
      studentId: 's-1',
      taskKey: 'dk_algebra::t_001',
      completeness: computedMetricResult,
      accuracy: computedMetricResult,
      spag: notAttemptedMetricResult,
      overall: computedMetricResult,
    });

    expect(result).toMatchObject({
      classId: 'c-1',
      studentId: 's-1',
      taskKey: 'dk_algebra::t_001',
    });
  });

  it('rejects extra keys such as taskId (strict object)', async () => {
    const { PerStudentTaskMetricSchema } = await loadDataAnalysisZod();

    expect(() =>
      PerStudentTaskMetricSchema.parse({
        classId: 'c-1',
        studentId: 's-1',
        taskKey: 'dk_algebra::t_001',
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
        completeness: computedMetricResult,
        accuracy: computedMetricResult,
        spag: computedMetricResult,
        overall: computedMetricResult,
        taskTitle: 'A Task',
      })
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// AveragingResultSchema — perStudentTaskMetrics optional field (RED phase)
// ---------------------------------------------------------------------------

describe('AveragingResultSchema — perStudentTaskMetrics optional field', () => {
  it('accepts a result without perStudentTaskMetrics (optional)', async () => {
    const { AveragingResultSchema } = await loadDataAnalysisZod();

    const result = AveragingResultSchema.parse({
      classId: 'c-1',
      className: 'Test Class',
      perStudent: [validPerStudentRow],
      perTask: [validPerTaskRow],
      perClass: validPerClassResult,
      appliedCriterionWeightings: validAppliedCriterionWeightings,
    });

    expect(result).toBeDefined();
    // In RED phase the result has no perStudentTaskMetrics key at all (schema
    // doesn't include it); in GREEN phase the key is optional and will also
    // be absent when not provided.
  });

  it('rejects perStudentTaskMetrics when value is not an array', async () => {
    const { AveragingResultSchema } = await loadDataAnalysisZod();

    // RED phase: AveragingResultSchema is a strictObject that does not yet
    // include perStudentTaskMetrics, so a string value for that key triggers
    // "Unrecognized key(s)" rejection. GREEN phase: the key is present but
    // requires z.array(...), so a string also fails.
    expect(() =>
      AveragingResultSchema.parse({
        classId: 'c-1',
        className: 'Test Class',
        perStudent: [validPerStudentRow],
        perTask: [validPerTaskRow],
        perClass: validPerClassResult,
        appliedCriterionWeightings: validAppliedCriterionWeightings,
        perStudentTaskMetrics: 'not-an-array',
      })
    ).toThrow();
  });

  it('accepts perStudentTaskMetrics as an array of valid PerStudentTaskMetricSchema entries', async () => {
    const { AveragingResultSchema, PerStudentTaskMetricSchema } = await loadDataAnalysisZod();

    // RED phase: PerStudentTaskMetricSchema is undefined, so this test fails
    // at the .parse() call before reaching the AveragingResultSchema assertion.
    const validMetric = PerStudentTaskMetricSchema.parse({
      classId: 'c-1',
      studentId: 's-1',
      taskKey: 'dk_algebra::t_001',
      completeness: computedMetricResult,
      accuracy: computedMetricResult,
      spag: computedMetricResult,
      overall: computedMetricResult,
    });

    const result = AveragingResultSchema.parse({
      classId: 'c-1',
      className: 'Test Class',
      perStudent: [validPerStudentRow],
      perTask: [validPerTaskRow],
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
