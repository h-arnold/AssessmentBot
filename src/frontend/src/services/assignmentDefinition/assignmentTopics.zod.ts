import { z } from 'zod';

const TrimmedNonEmptyStringSchema = z
  .string()
  .min(1)
  .refine((value) => value.trim().length > 0 && value.trim() === value, {
    message: 'Expected a non-empty, trimmed string.',
  });

export const AssignmentTopicSchema = z
  .object({
    key: TrimmedNonEmptyStringSchema,
    name: TrimmedNonEmptyStringSchema,
  })
  .strict();

export type AssignmentTopic = z.infer<typeof AssignmentTopicSchema>;

export const AssignmentTopicsResponseSchema = z.array(AssignmentTopicSchema);

export type AssignmentTopicsResponse = z.infer<typeof AssignmentTopicsResponseSchema>;
