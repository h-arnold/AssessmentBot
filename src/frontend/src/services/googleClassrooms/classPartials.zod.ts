import { ABClassMetadataSchema } from '../abClass/abClassMetadata.zod';
import { z } from 'zod';

export const TeacherSummarySchema = z.object({
  userId: z.string().nullable(),
  email: z.string().nullable(),
  teacherName: z
    .string()
    .nullable()
    .optional()
    .transform((value = null) => value),
});

export type TeacherSummary = z.infer<typeof TeacherSummarySchema>;

/**
 * Shape of a class partial document returned by the backend transport.
 * Teacher-bearing fields use TeacherSummary rather than the full Teacher model.
 *
 * @remarks The transport contract is key-based and intentionally excludes derived
 * label fields such as `cohortLabel` and `yearGroupLabel`.
 *
 * @remarks `active` is tri-state (`true` | `false` | `null`) to distinguish
 * inactive classes from unknown/unset values.
 *
 * @remarks `metadata` is the ABClass assessment-summary snapshot shared with the
 * full class read. It is a required, nullable whole value on successful reads:
 * the backend always emits it (legacy absence normalised to explicit `null`), so
 * a missing or malformed field fails parsing rather than defaulting. There is no
 * frontend legacy default, no coercion, and no optional weakening. On mutation
 * requests, the metadata property is optional by omission; when present, it is
 * subject to the shared strict validation. Explicit `null` clears metadata, and
 * a supplied object replaces the whole value. This field is distinct from the
 * unrelated task-artifact `metadata` (artifact source metadata).
 */
export const ClassPartialSchema = z.object({
  classId: z.string(),
  className: z.string().nullable(),
  cohortKey: z.string().nullable(),
  courseLength: z.number(),
  yearGroupKey: z.string().nullable(),
  classOwner: TeacherSummarySchema.nullable(),
  teachers: z.array(TeacherSummarySchema),
  active: z.boolean().nullable(),
  metadata: ABClassMetadataSchema,
});

export type ClassPartial = z.infer<typeof ClassPartialSchema>;

export const ClassPartialsResponseSchema = z.array(ClassPartialSchema);

export type ClassPartialsResponse = z.infer<typeof ClassPartialsResponseSchema>;
