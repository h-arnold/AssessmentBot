import { z } from 'zod';

/**
 * Canonical source for the lightweight task-weighting shape emitted by
 * the extended `AssignmentDefinition.toPartialJSON()`.
 *
 * @remarks
 * The full task schema is in `assignmentDefinition.zod.ts`
 * (`AssignmentDefinitionTaskSchema`). Range enforcement on `taskWeighting`
 * is the analyser's job — the wire schema only enforces shape (matching the
 * existing `assignmentDefinition.zod.ts` convention). `taskId` uses `.min(1)`
 * because `TaskDefinition._deriveId` always produces a `t_`-prefixed non-empty
 * hash.
 *
 * `taskId` aligns with `AssignmentDefinitionTaskSchema.taskId`. `taskTitle`
 * is nullable so that legacy or missing titles are carried through to the
 * heatmap column (the table header falls back to `taskId` for display).
 */
export const TaskPartialSchema = z.strictObject({
  taskId: z.string().min(1),
  taskWeighting: z.number(),
  taskTitle: z.string().nullable(),
});

export type TaskPartial = z.infer<typeof TaskPartialSchema>;
