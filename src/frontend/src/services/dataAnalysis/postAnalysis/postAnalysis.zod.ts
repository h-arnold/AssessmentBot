import { z } from 'zod';
import { ClassFullSchema } from '@/services/googleClassrooms/classDetail/classDetailService.zod';
import { AssignmentDefinitionPartialsResponseSchema } from '@/services/assignmentDefinition/assignmentDefinitionPartials.zod';
import { AveragingResultSchema } from '../dataAnalysis.zod';
import type { MetadataRefreshSkipped } from './metadataProjection';

/** Successful display analysis and its complete, unsliced source data. */
export const PostAnalysisContextSchema = z
  .strictObject({
    classFull: ClassFullSchema,
    assignmentDefinitionPartials: AssignmentDefinitionPartialsResponseSchema,
    averagingResult: AveragingResultSchema,
  })
  .refine((context) => context.classFull.classId === context.averagingResult.classId, {
    message: 'Post-analysis class and averaging result identities must match',
  });

export type PostAnalysisContext = z.infer<typeof PostAnalysisContextSchema>;

const TaskIdSchema = z.string().min(1);
/** Compile-time pinned to the task-owned skip union to prevent reason drift. */
const SKIPPED_REASONS = [
  'noAssignments',
  'unchanged',
  'staleSource',
] satisfies readonly MetadataRefreshSkipped['reason'][];

const SucceededResultSchema = z.strictObject({
  status: z.literal('succeeded'),
  confirmedPersistence: z.literal(true).optional(),
});
const SkippedResultSchema = z.strictObject({
  status: z.literal('skipped'),
  reason: z.enum(SKIPPED_REASONS),
});

/** Task-owned terminal results exclude lifecycle-owned pending and failed states. */
export const PostAnalysisTaskResultSchema = z.discriminatedUnion('status', [
  SucceededResultSchema,
  SkippedResultSchema,
]);

export type PostAnalysisTaskResult = z.infer<typeof PostAnalysisTaskResultSchema>;

/** Serialisable state only: callbacks and technical Errors remain local. */
export const PostAnalysisTaskOutcomeDataSchema = z.discriminatedUnion('status', [
  z.strictObject({ taskId: TaskIdSchema, status: z.literal('pending') }),
  SucceededResultSchema.extend({ taskId: TaskIdSchema }),
  SkippedResultSchema.extend({ taskId: TaskIdSchema }),
  z.strictObject({
    taskId: TaskIdSchema,
    status: z.literal('failed'),
    confirmedPersistence: z.literal(true).optional(),
  }),
]);

export type PostAnalysisTaskOutcomeData = z.infer<typeof PostAnalysisTaskOutcomeDataSchema>;
