import { z } from 'zod';

/**
 * Canonical shape of a single construct the Apps Script script parser cannot parse.
 */
export const gasIncompatibleSyntaxSchema = z.object({
  relativePath: z.string(),
  line: z.number(),
  construct: z.string(),
});

export type GasIncompatibleSyntax = z.infer<typeof gasIncompatibleSyntaxSchema>;
