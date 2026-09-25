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
 * `MetricResult` is a discriminated union with four states:
 * - `computed`: at least one numeric data point contributed. `value` is a number.
 * - `notAttempted`: no numeric data points, but at least one raw `'N'` score was
 *   seen. `value` is `'N'`.
 * - `excluded`: aggregate-only — observations exist but none contributed to the
 *   average (for example, every observation had zero effective weight).
 *   `value` is `null`, `totalWeight` is `0`, and there is at least one total data
 *   point. Task-level display shapes use a narrower three-state union and never
 *   accept this member.
 * - `error`: all observed inputs are errors, or there is no usable data point
 *   to resolve. `value` is `'E'`. At aggregate scopes, `totalWeight` and
 *   `totalDataPoints` may retain summed evidence from those inputs; this state
 *   does not imply that those metadata fields are zero.
 *
 * The discriminated union replaces the earlier invariant
 * `value === null ⇔ applicableDataPoints === 0`.
 *
 * Display/sort precedence for a single MetricResult (not enforced at the schema
 * level): `error` > `excluded` > `notAttempted` > `computed`.
 * At rollup levels, `error` entries/criteria are **excluded** from averages rather
 * than escalating the result — the rollup is `error` only when every input is `error`.
 */
const ComputedMetricSchema = z.strictObject({
  state: z.literal('computed'),
  value: z.number(),
  totalWeight: z.number(),
  applicableDataPoints: z.number().int().min(1),
  totalDataPoints: z.number().int().min(0),
});

/**
 * Raw not-attempted metric, including a raw `N` observed at zero effective
 * weight.
 *
 * @remarks
 * `totalWeight` is deliberately unconstrained by positivity. A zero-weight raw
 * `N` remains `notAttempted` as display evidence and carries `totalWeight: 0`;
 * only `totalWeight > 0` makes a raw `N` contribute to an aggregate.
 */
const NotAttemptedMetricSchema = z.strictObject({
  state: z.literal('notAttempted'),
  value: z.literal('N'),
  totalWeight: z.number(),
  applicableDataPoints: z.literal(0),
  totalDataPoints: z.number().int().min(1),
});

/**
 * Aggregate-only metric state: observations exist, none contributed to the
 * average, and the inputs are not entirely errors.
 *
 * @remarks
 * Valid only where aggregate output permits it (`PerStudentRow`,
 * `PerClassResult`, and other parent scopes). It is not a substitute for a
 * numeric or raw-`N` task-level display result.
 */
const ExcludedMetricSchema = z.strictObject({
  state: z.literal('excluded'),
  value: z.null(),
  totalWeight: z.literal(0),
  applicableDataPoints: z.literal(0),
  totalDataPoints: z.number().int().min(1),
});

/**
 * Error metric used when no usable input can resolve to another state.
 *
 * @remarks
 * Aggregate error results may retain summed positive `totalWeight` and
 * `totalDataPoints` from error inputs. `error` therefore describes the
 * resolution state, not an absence of observed data.
 */
const ErrorMetricSchema = z.strictObject({
  state: z.literal('error'),
  value: z.literal('E'),
  totalWeight: z.number().min(0),
  applicableDataPoints: z.literal(0),
  totalDataPoints: z.number().int().min(0),
});

/**
 * Exported narrow display-scope metric union for task-level rows and cells.
 *
 * @remarks
 * Deliberately omits the aggregate-only `excluded` state so task displays keep
 * numeric zero-weight scores and genuine raw `N` values visible.
 */
export const TaskDisplayMetricSchema = z.discriminatedUnion('state', [
  ComputedMetricSchema,
  NotAttemptedMetricSchema,
  ErrorMetricSchema,
]);

export type TaskDisplayMetric = z.infer<typeof TaskDisplayMetricSchema>;

/** Shared four-state metric union used by aggregate result shapes. */
export const MetricResultSchema = z.discriminatedUnion('state', [
  ComputedMetricSchema,
  NotAttemptedMetricSchema,
  ExcludedMetricSchema,
  ErrorMetricSchema,
]);

export type MetricResult = z.infer<typeof MetricResultSchema>;

/**
 * Task-level average-contribution metadata.
 *
 * @remarks
 * `effectiveWeight` is the live assignment weighting multiplied by the live
 * task weighting. `includedInAverage` must be `true` exactly when
 * `effectiveWeight > 0`; a contradictory pair is invalid. This metadata is
 * validated separately from display evidence so a zero-weight numeric score can
 * remain visible while being excluded from parent averages.
 */
export const AverageContributionSchema = z
  .strictObject({
    effectiveWeight: z.number().min(0),
    includedInAverage: z.boolean(),
  })
  .refine((c) => c.includedInAverage === c.effectiveWeight > 0, {
    message: 'includedInAverage must be true exactly when effectiveWeight > 0',
  });

export type AverageContribution = z.infer<typeof AverageContributionSchema>;

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
 * `taskTitle` is always `null` in v1 because `buildPerTaskRows` does not project
 * or cross-reference titles. The live `TaskPartial` carries
 * `{ taskId, taskWeighting, taskTitle }` (with a nullable title), which heatmap
 * adapters read directly; this field is reserved for future cross-reference
 * resolution.
 *
 * Metrics use the narrow task-level display union (no `excluded`), and
 * `averageContribution` records whether the represented task's effective
 * weighting allowed its scores into parent averages.
 */
export const PerTaskRowSchema = z.strictObject({
  definitionKey: z.string(),
  taskId: z.string(),
  taskTitle: z.string().nullable(),
  averageContribution: AverageContributionSchema,
  completeness: TaskDisplayMetricSchema,
  accuracy: TaskDisplayMetricSchema,
  spag: TaskDisplayMetricSchema,
  overall: TaskDisplayMetricSchema,
});

export type PerTaskRow = z.infer<typeof PerTaskRowSchema>;

/**
 * Aggregate metrics for an entire class across all students and tasks.
 *
 * @remarks
 * Aggregate scope uses the shared four-state `MetricResultSchema`, so
 * `excluded` is valid here when observations exist with no positive-weight
 * contribution.
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
 * Per-(student, task) metric for the heatmap — one entry per (studentId, taskKey)
 * present in the per-student-task accumulators.
 *
 * @remarks
 * `taskKey` omits `assignmentId` in v1 (deferred multi-assignment re-keying).
 * See SPEC.md §Deferrals.
 *
 * Metrics use the narrow task-level display union (no `excluded`) so heatmap
 * cells keep numeric zero-weight scores and raw `N` values; contribution is
 * carried explicitly on `averageContribution` rather than inferred from a score.
 */
export const PerStudentTaskMetricSchema = z.strictObject({
  classId: z.string(),
  studentId: z.string(),
  taskKey: z.string(),
  averageContribution: AverageContributionSchema,
  completeness: TaskDisplayMetricSchema,
  accuracy: TaskDisplayMetricSchema,
  spag: TaskDisplayMetricSchema,
  overall: TaskDisplayMetricSchema,
});

export type PerStudentTaskMetric = z.infer<typeof PerStudentTaskMetricSchema>;

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
  perStudentTaskMetrics: z.array(PerStudentTaskMetricSchema).optional(),
});

export type AveragingResult = z.infer<typeof AveragingResultSchema>;

/**
 * Top-level data analysis response — an array of per-class results.
 */
export const DataAnalysisResponseSchema = z.array(AveragingResultSchema);

export type DataAnalysisResponse = z.infer<typeof DataAnalysisResponseSchema>;
