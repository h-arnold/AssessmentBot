/**
 * Zod schemas for the Class page adapter's canonical output.
 *
 * This module defines the trust boundary between the analyser and the UI.
 * Per `src/frontend/AGENTS.md` §9, Zod-first validation is mandatory for
 * trust boundaries: the schema is defined first, and all TypeScript types
 * are derived via `z.infer<typeof ...>`.
 *
 * @remarks
 * `RecentAssignmentCardMetricSchema` reuses the data analysis service's
 * `MetricResult` discriminated union. The per-assignment `average` metric
 * is a composite computed by the adapter (not a raw rollup); it is still
 * validated against the same discriminated union at rest.
 */

import { z } from 'zod';
import type { MetricResult } from '../../services/dataAnalysis/dataAnalysis.zod';
import { MetricResultSchema } from '../../services/dataAnalysis/dataAnalysis.zod';

/**
 * Access a metric result from a student's metrics by key.
 *
 * Uses a `switch` statement (not computed property access, e.g.
 * `metrics[key]`) to satisfy the `security/detect-object-injection` ESLint
 * rule, which flags bracket-access on objects whose keys are not statically
 * known. Each case is a literal string, so the lint rule is satisfied while
 * keeping the accessor concise.
 *
 * @remarks
 * The switch-statement pattern is deliberate: the `security/detect-object-injection`
 * rule from `eslint-plugin-security` triggers on computed property access
 * (`metrics[key]`) even when `key` is a union of known literal strings. A
 * `switch` over a known-union type avoids the warning because each branch
 * accesses a literal property directly. This pattern is repeated in two
 * other modules (`studentAveragesTableColumns.tsx` and `classPageModel.ts`),
 * which import this shared accessor instead of duplicating the switch.
 *
 * @param {StudentAverageRowModel['metrics']} metrics - The student's metrics object.
 * @param {'completeness' | 'accuracy' | 'spag' | 'average'} key - The metric key to access.
 * @returns {MetricResult} The metric result for the given key.
 */
export function getStudentMetric(
  metrics: StudentAverageRowModel['metrics'],
  key: 'completeness' | 'accuracy' | 'spag' | 'average'
): MetricResult {
  switch (key) {
    case 'completeness': {
      return metrics.completeness;
    }
    case 'accuracy': {
      return metrics.accuracy;
    }
    case 'spag': {
      return metrics.spag;
    }
    case 'average': {
      return metrics.average;
    }
  }
}

/** Alias documenting that recent-assignment card metric fields reuse the dataAnalysis.zod MetricResultSchema. */
const RecentAssignmentCardMetricSchema = MetricResultSchema;

/**
 * Schema for a single recent-assignment card model.
 *
 * The `assignmentId` field is validated as a non-empty string so it can
 * serve as a unique React key. The `lastAssessedAt` field is a raw ISO
 * 8601 string (nullable at the transport layer, non-nullable here —
 * a null `updatedAt` is a data bug that the adapter surfaces as a
 * blocking state before the model is built).
 */
export const RecentAssignmentCardModelSchema = z.strictObject({
  assignmentId: z.string().min(1),
  assignmentName: z.string(),
  lastAssessedAt: z.string(),
  lastAssessedAtLabel: z.string(),
  metrics: z.strictObject({
    completeness: RecentAssignmentCardMetricSchema,
    accuracy: RecentAssignmentCardMetricSchema,
    spag: RecentAssignmentCardMetricSchema,
    average: RecentAssignmentCardMetricSchema,
  }),
});

export type RecentAssignmentCardModel = z.infer<typeof RecentAssignmentCardModelSchema>;

/**
 * Schema for a single student-average row model.
 *
 * The `studentId` field is validated as a non-empty string so it can
 * serve as a unique table row key.
 */
export const StudentAverageRowModelSchema = z.strictObject({
  studentId: z.string().min(1),
  studentName: z.string(),
  metrics: z.strictObject({
    completeness: RecentAssignmentCardMetricSchema,
    accuracy: RecentAssignmentCardMetricSchema,
    spag: RecentAssignmentCardMetricSchema,
    average: RecentAssignmentCardMetricSchema,
  }),
});

export type StudentAverageRowModel = z.infer<typeof StudentAverageRowModelSchema>;

/**
 * Schema for the complete adapter result consumed by the Class page UI.
 *
 * `classMetrics` uses `overall` as the fourth key (matching the analyser's
 * `perClass` output), while `RecentAssignmentCardModel` and
 * `StudentAverageRowModel` use `average`. This intentional asymmetry
 * reflects the different semantics: `overall` is the analyser's composite
 * for the entire class, while `average` is the adapter's per-assignment
 * or per-student composite.
 */
export const ClassPageAdapterResultSchema = z.strictObject({
  recentAssignments: z.array(RecentAssignmentCardModelSchema),
  studentAverages: z.array(StudentAverageRowModelSchema),
  classMetrics: z.strictObject({
    completeness: RecentAssignmentCardMetricSchema,
    accuracy: RecentAssignmentCardMetricSchema,
    spag: RecentAssignmentCardMetricSchema,
    overall: RecentAssignmentCardMetricSchema,
  }),
});

export type ClassPageAdapterResult = z.infer<typeof ClassPageAdapterResultSchema>;
