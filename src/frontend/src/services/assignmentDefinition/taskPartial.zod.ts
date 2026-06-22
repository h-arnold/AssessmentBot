import { z } from 'zod';

/**
 * Canonical source for the lightweight task-weighting shape emitted by
 * the extended `AssignmentDefinition.toPartialJSON()`.
 *
 * @remarks
 * The full task schema is in `assignmentDefinition.zod.ts`
 * (`AssignmentDefinitionTaskSchema`). Range enforcement on `taskWeighting`
 * is the analyser's job — the wire schema only enforces shape (matching the
 * existing `assignmentDefinition.zod.ts` convention). `id` uses `.min(1)`
 * because `TaskDefinition._deriveId` always produces a `t_`-prefixed non-empty
 * hash.
 */
export const TaskPartialSchema = z.strictObject({
  id: z.string().min(1),
  taskWeighting: z.number(),
});

export type TaskPartial = z.infer<typeof TaskPartialSchema>;
