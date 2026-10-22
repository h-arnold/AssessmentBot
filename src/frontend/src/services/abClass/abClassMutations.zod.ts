import { z } from 'zod';
import { ABClassMetadataSchema } from './abClassMetadata.zod';

const LAST_CONTROL_CHARACTER_CODE = 31;
const DELETE_CHARACTER_CODE = 127;

const ClassIdSchema = z.string().min(1).refine(isSafeClassId);
const CourseLengthSchema = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
const configurationShape = {
  cohortKey: z.string().nullable(),
  yearGroupKey: z.string().nullable(),
  courseLength: CourseLengthSchema,
};

/**
 * Validates required upsert configuration and optional whole metadata replacement.
 * @remarks Omission preserves metadata; null clears it. Present undefined and
 * unknown/protected fields reject before enqueue. No defaults or coercion apply.
 */
export const UpsertABClassRequestSchema = z
  .custom<unknown>((value) =>
    isMutationRecord(value, ['classId', ...Object.keys(configurationShape), 'metadata'])
  )
  .pipe(
    z
      .object({
        classId: ClassIdSchema,
        cohortKey: configurationShape.cohortKey.unwrap(),
        yearGroupKey: configurationShape.yearGroupKey.unwrap(),
        courseLength: CourseLengthSchema,
        metadata: ABClassMetadataSchema.optional(),
      })
      .strict()
  );

/**
 * Validates optional editable fields without turning omission into undefined/null.
 * @remarks Metadata uses the shared strict whole-snapshot schema, never a nested
 * patch. Parsing detaches supplied metadata before it waits in the queue.
 */
export const UpdateABClassRequestSchema = z
  .custom<unknown>((value) =>
    isMutationRecord(value, ['classId', ...Object.keys(configurationShape), 'active', 'metadata'])
  )
  .pipe(
    z
      .object({
        classId: ClassIdSchema,
        cohortKey: configurationShape.cohortKey.optional(),
        yearGroupKey: configurationShape.yearGroupKey.optional(),
        courseLength: CourseLengthSchema.optional(),
        active: z.boolean().nullable().optional(),
        metadata: ABClassMetadataSchema.optional(),
      })
      .strict()
  );

export type UpsertABClassRequest = z.infer<typeof UpsertABClassRequestSchema>;
export type UpdateABClassRequest = z.infer<typeof UpdateABClassRequestSchema>;

/**
 * Checks request own keys before Zod copying can hide undefined or unknown fields.
 * @param {unknown} value - Candidate request.
 * @param {readonly string[]} allowedKeys - Permitted editable/request keys.
 * @returns {boolean} Whether the request is an own-field plain record.
 */
function isMutationRecord(value: unknown, allowedKeys: readonly string[]): boolean {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  return (
    Object.hasOwn(value, 'classId') &&
    Reflect.ownKeys(value).every((key) => {
      return (
        typeof key === 'string' &&
        allowedKeys.includes(key) &&
        Reflect.get(value, key) !== undefined
      );
    })
  );
}

/**
 * Mirrors the backend safe, already-trimmed path identifier contract.
 * @param {string} value - Candidate class identifier.
 * @returns {boolean} Whether no whitespace repair or unsafe path is present.
 */
function isSafeClassId(value: string): boolean {
  return (
    value.trim() === value &&
    !value.includes('/') &&
    !value.includes('\\') &&
    !value.includes('..') &&
    [...value].every((character) => {
      const codePoint = character.codePointAt(0)!;
      return codePoint > LAST_CONTROL_CHARACTER_CODE && codePoint !== DELETE_CHARACTER_CODE;
    })
  );
}
