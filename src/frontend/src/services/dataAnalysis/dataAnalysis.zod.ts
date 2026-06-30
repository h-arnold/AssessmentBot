import { z } from 'zod';
import {
  AssignmentDefinitionPartialsResponseSchema,
  IsoDateTimeWithTimezoneSchema,
} from '../assignmentDefinition/assignmentDefinitionPartials.zod';
import { ClassFullSchema } from '../googleClassrooms/classDetail/classDetailService.zod';

/** Float-drift tolerance for criterion weightings summing to 1. */
const CRITERION_WEIGHTINGS_TOLERANCE = 1e-9;

/**
 * Filter specifying which classes and optional criteria to include in the analysis.
 *
 * @remarks
 * The `dateRange` uses strict ISO-with-timezone validation matching the data-load
 * layer. This is necessary because `google.script.run` prohibits `Date` objects in
 * payloads, so all timestamps on the wire are ISO 8601 strings.
 */
export const AnalysisFilterSchema = z.strictObject({
  classIds: z.array(z.string().min(1)).min(1),
  dateRange: z
    .strictObject({
      from: IsoDateTimeWithTimezoneSchema,
      to: IsoDateTimeWithTimezoneSchema,
    })
    .refine((r) => new Date(r.from).getTime() <= new Date(r.to).getTime(), {
      message: 'dateRange.from must be <= dateRange.to',
    })
    .optional(),
  topicKeys: z.array(z.string().min(1)).min(1).optional(),
  assignmentDefinitionKeys: z.array(z.string().min(1)).min(1).optional(),
  criterionWeightings: z
    .strictObject({
      completeness: z.number().min(0),
      accuracy: z.number().min(0),
      spag: z.number().min(0),
    })
    .refine(
      (w) => Math.abs(w.completeness + w.accuracy + w.spag - 1) < CRITERION_WEIGHTINGS_TOLERANCE,
      { message: 'criterionWeightings must sum to 1.0 within float-drift tolerance' }
    )
    .optional(),
});

export type AnalysisFilter = z.infer<typeof AnalysisFilterSchema>;

/**
 * Input to the averaging analyser, combining pre-fetched ABClass data,
 * partial definition cross-references, and a validated filter.
 *
 * @remarks
 * `classes` uses the canonical `ClassFullSchema` from `classDetailService.zod.ts`
 * (post-correction in Section 2). `assignmentDefinitionPartials` reuses
 * `AssignmentDefinitionPartialsResponseSchema` from `assignmentDefinitionPartials.zod.ts`
 * (unified in Section 3).
 */
export const AveragingAnalyserInputSchema = z.strictObject({
  filter: AnalysisFilterSchema,
  classes: z.array(ClassFullSchema),
  assignmentDefinitionPartials: AssignmentDefinitionPartialsResponseSchema,
});

export type AveragingAnalyserInput = z.infer<typeof AveragingAnalyserInputSchema>;

/**
 * Result for a single metric (completeness, accuracy, spag, or overall).
 *
 * @remarks
 * `MetricResult` is a discriminated union with three states:
 * - `computed`: at least one numeric data point contributed. `value` is a number.
 * - `notAttempted`: no numeric data points, but at least one raw `'N'` score was
 *   seen. `value` is `'N'`.
 * - `error`: no data points at all — no numeric scores and no `'N'` scores.
 *   `value` is `'E'`.
 *
 * The discriminated union replaces the earlier invariant
 * `value === null ⇔ applicableDataPoints === 0`.
 *
 * Precedence for rollups (not enforced at the schema level):
 * `error` > `notAttempted` > `computed`.
 */
const ComputedMetricSchema = z.strictObject({
  state: z.literal('computed'),
  value: z.number(),
  totalWeight: z.number(),
  applicableDataPoints: z.number().int().min(1),
  totalDataPoints: z.number().int().min(0),
});

const NotAttemptedMetricSchema = z.strictObject({
  state: z.literal('notAttempted'),
  value: z.literal('N'),
  totalWeight: z.number(),
  applicableDataPoints: z.literal(0),
  totalDataPoints: z.number().int().min(1),
});

const ErrorMetricSchema = z.strictObject({
  state: z.literal('error'),
  value: z.literal('E'),
  totalWeight: z.number().min(0),
  applicableDataPoints: z.literal(0),
  totalDataPoints: z.number().int().min(0),
});

export const MetricResultSchema = z.discriminatedUnion('state', [
  ComputedMetricSchema,
  NotAttemptedMetricSchema,
  ErrorMetricSchema,
]);

export type MetricResult = z.infer<typeof MetricResultSchema>;

/**
 * Per-student analysis row with flat metric fields.
 *
 * @remarks
 * Fields use chart/table-friendly names for the deferred page work stream.
 */
export const PerStudentRowSchema = z.strictObject({
  studentId: z.string(),
  studentName: z.string().nullable(),
  completeness: MetricResultSchema,
  accuracy: MetricResultSchema,
  spag: MetricResultSchema,
  overall: MetricResultSchema,
});

export type PerStudentRow = z.infer<typeof PerStudentRowSchema>;

/**
 * Per-task analysis row with flat metric fields.
 *
 * @remarks
 * `taskTitle` is always `null` in v1 (the post-extension partial only carries
 * `{ id, taskWeighting }` per task). The field is reserved for future
 * cross-reference resolution.
 */
export const PerTaskRowSchema = z.strictObject({
  definitionKey: z.string(),
  taskId: z.string(),
  taskTitle: z.string().nullable(),
  completeness: MetricResultSchema,
  accuracy: MetricResultSchema,
  spag: MetricResultSchema,
  overall: MetricResultSchema,
});

export type PerTaskRow = z.infer<typeof PerTaskRowSchema>;

/**
 * Aggregate metrics for an entire class across all students and tasks.
 */
export const PerClassResultSchema = z.strictObject({
  completeness: MetricResultSchema,
  accuracy: MetricResultSchema,
  spag: MetricResultSchema,
  overall: MetricResultSchema,
});

export type PerClassResult = z.infer<typeof PerClassResultSchema>;

/**
 * The criterion weightings that were actually applied during analysis.
 *
 * @remarks
 * Echoes the weightings used (either the default 40/40/20 split or a
 * caller-supplied override).
 */
export const AppliedCriterionWeightingsSchema = z.strictObject({
  completeness: z.number(),
  accuracy: z.number(),
  spag: z.number(),
});

export type AppliedCriterionWeightings = z.infer<typeof AppliedCriterionWeightingsSchema>;

/**
 * Complete analysis result for a single class.
 */
export const AveragingResultSchema = z.strictObject({
  classId: z.string(),
  className: z.string().nullable(),
  perStudent: z.array(PerStudentRowSchema),
  perTask: z.array(PerTaskRowSchema),
  perClass: PerClassResultSchema,
  appliedCriterionWeightings: AppliedCriterionWeightingsSchema,
});

export type AveragingResult = z.infer<typeof AveragingResultSchema>;

/**
 * Top-level data analysis response — an array of per-class results.
 */
export const DataAnalysisResponseSchema = z.array(AveragingResultSchema);

export type DataAnalysisResponse = z.infer<typeof DataAnalysisResponseSchema>;
