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
import { MetricResultSchema } from '../../services/dataAnalysis/dataAnalysis.zod';

/** Reuses the `MetricResult` discriminated union from the data analysis service. */
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
