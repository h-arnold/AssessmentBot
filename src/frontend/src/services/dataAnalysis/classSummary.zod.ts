import { z } from 'zod';
import {
  isTrimmed,
  MAX_LIST_ENTRIES,
  validateStandingsScoreAlignment,
} from '../abClass/abClassMetadata.zod';
import { MetricResultSchema } from './dataAnalysis.zod';

/**
 * The four analyser-native criterion results carried by every score set.
 *
 * @remarks
 * Reuses the shared four-state `MetricResultSchema` rather than the metadata score
 * union, so `ClassSummary` keeps the analyser's `computed` / `notAttempted` /
 * `excluded` / `error` evidence until the writer projects it for persistence.
 */
const MetricScoresSchema = z.strictObject({
  completeness: MetricResultSchema,
  accuracy: MetricResultSchema,
  spag: MetricResultSchema,
  overall: MetricResultSchema,
});

export type MetricScores = z.infer<typeof MetricScoresSchema>;

/** Identity fields copied verbatim from a supplied assignment instance. */
const AssignmentIdentitySchema = z.strictObject({
  assignmentId: z.string().min(1),
  assignmentDefinitionKey: z.string().min(1),
  /** Mirrors `AssignmentPartial.updatedAt`, which is nullable on the read shape. */
  updatedAt: z.string().nullable(),
});

/** One ranked student with the full score set for the basis and each recent assignment. */
const MetricStandingSchema = z.strictObject({
  studentId: z.string().min(1),
  studentName: z.string().min(1).refine(isTrimmed),
  scores: MetricScoresSchema,
  recentAssignmentScores: z.array(MetricScoresSchema),
});

export type MetricStanding = z.infer<typeof MetricStandingSchema>;

/** The disjoint top and bottom ranking lists of one basis. */
const MetricStandingsSchema = z.strictObject({
  top: z.array(MetricStandingSchema).max(MAX_LIST_ENTRIES),
  bottom: z.array(MetricStandingSchema).max(MAX_LIST_ENTRIES),
});

export type MetricStandings = z.infer<typeof MetricStandingsSchema>;

/**
 * The unrefined summary shape. Exported indirectly as {@link ClassSummary}; named
 * here so the cross-field validators below can type their input without a forward
 * reference to the refined schema.
 */
const ClassSummaryObjectSchema = z.strictObject({
  classId: z.string().min(1),
  allTasks: z.strictObject({
    classAverages: MetricScoresSchema,
    standings: MetricStandingsSchema,
  }),
  baseline: z.strictObject({
    available: z.boolean(),
    classAverages: MetricScoresSchema.nullable(),
    standings: MetricStandingsSchema.nullable(),
  }),
  target: z.strictObject({
    ...AssignmentIdentitySchema.shape,
    averages: MetricScoresSchema,
  }),
  recentAssignments: z.array(AssignmentIdentitySchema).max(MAX_LIST_ENTRIES),
});

type ClassSummaryShape = z.infer<typeof ClassSummaryObjectSchema>;

/**
 * Add an issue when a student appears in both lists of one standings basis.
 *
 * @param {MetricStandings} standings - The basis being validated.
 * @param {readonly string[]} path - Path prefix for the diagnostic issue.
 * @param {z.RefinementCtx} context - Zod refinement context.
 * @returns {void} Adds validation issues to the context when needed.
 */
function validateStandingsDisjointness(
  standings: MetricStandings,
  path: readonly string[],
  context: z.RefinementCtx
): void {
  const topIds = new Set(standings.top.map((entry) => entry.studentId));
  standings.bottom.forEach((entry, index) => {
    if (topIds.has(entry.studentId)) {
      context.addIssue({
        code: 'custom',
        path: [...path, 'bottom', index, 'studentId'],
        message: 'a studentId must not appear in both top and bottom of one basis',
      });
    }
  });
}

/**
 * Add an issue when baseline availability disagrees with the presence of its data.
 *
 * @param {ClassSummaryShape} summary - The parsed summary shape.
 * @param {z.RefinementCtx} context - Zod refinement context.
 * @returns {void} Adds validation issues to the context when needed.
 */
function validateBaselineCoherence(summary: ClassSummaryShape, context: z.RefinementCtx): void {
  const { available, classAverages, standings } = summary.baseline;
  if (available !== (classAverages !== null) || available !== (standings !== null)) {
    context.addIssue({
      code: 'custom',
      path: ['baseline', 'available'],
      message:
        'baseline.available must match the presence of baseline.classAverages and baseline.standings',
    });
  }
}

/**
 * Apply the per-basis score-alignment rule to both standings sets.
 *
 * @param {ClassSummaryShape} summary - The parsed summary shape.
 * @param {z.RefinementCtx} context - Zod refinement context.
 * @returns {void} Adds validation issues to the context when needed.
 */
function validateScoreAlignment(summary: ClassSummaryShape, context: z.RefinementCtx): void {
  const expected = summary.recentAssignments.length;
  validateStandingsScoreAlignment(
    summary.allTasks.standings,
    ['allTasks', 'standings'],
    expected,
    context
  );
  if (summary.baseline.standings !== null) {
    validateStandingsScoreAlignment(
      summary.baseline.standings,
      ['baseline', 'standings'],
      expected,
      context
    );
  }
}

/**
 * Strict in-memory validation for the `ClassSummary` service output.
 *
 * @remarks
 * This is neither a wire nor a persistence shape. Each analyser declares its own
 * output schema, and `DataAnalysisService.analyseClassSummary` parses with this one.
 * The cross-field refinement asserts the producer's disjoint-selection rule, baseline
 * coherence and the index alignment between `recentAssignmentScores` and
 * `recentAssignments` so a malformed summary cannot reach the writer.
 */
export const ClassSummarySchema = ClassSummaryObjectSchema.superRefine((summary, context) => {
  validateStandingsDisjointness(summary.allTasks.standings, ['allTasks', 'standings'], context);
  if (summary.baseline.standings !== null) {
    validateStandingsDisjointness(summary.baseline.standings, ['baseline', 'standings'], context);
  }
  validateScoreAlignment(summary, context);
  validateBaselineCoherence(summary, context);
});

export type ClassSummary = z.infer<typeof ClassSummarySchema>;
