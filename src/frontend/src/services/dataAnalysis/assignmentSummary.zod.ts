import { z } from 'zod';

const SCORE_CEILING = 5;
const StudentCountSchema = z.number().int().min(0);

/** Explicit policy echoed by the summary, independent of presentation. */
export const AssignmentSummaryThresholdsSchema = z.strictObject({
  completeness: z.number().min(0).max(SCORE_CEILING),
  accuracy: z.number().min(0).max(SCORE_CEILING),
  incompleteProportion: z.number().min(0).max(1),
});

export type AssignmentSummaryThresholds = z.infer<typeof AssignmentSummaryThresholdsSchema>;

/** Descriptive evidence for one task, counting each roster student once. */
export const TaskSummarySchema = z.strictObject({
  taskKey: z.string().min(1),
  completedCount: StudentCountSchema,
  belowThresholdCount: StudentCountSchema,
  notAttemptedCount: StudentCountSchema,
  completenessErrorCount: StudentCountSchema,
  incompleteAcrossMostStudents: z.boolean(),
  accuracyAverage: z.number().nullable(),
  accuracyAssessedCount: StudentCountSchema,
  accuracyNotAttemptedCount: StudentCountSchema,
  accuracyErrorCount: StudentCountSchema,
  belowAccuracyThreshold: z.boolean(),
});

export type TaskSummary = z.infer<typeof TaskSummarySchema>;

/** Frontend-only analysis result; no UI labels, styles or component props. */
export const AssignmentSummarySchema = z.strictObject({
  classId: z.string().min(1),
  assignmentId: z.string().min(1),
  totalStudents: StudentCountSchema,
  thresholds: AssignmentSummaryThresholdsSchema,
  tasks: z.array(TaskSummarySchema),
  mostAccurateTaskKeys: z.array(z.string()),
  leastAccurateTaskKeys: z.array(z.string()),
});

export type AssignmentSummary = z.infer<typeof AssignmentSummarySchema>;
