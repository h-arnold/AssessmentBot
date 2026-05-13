import { z } from 'zod';

const npmScriptRunSchema = z.object({
  kind: z.literal('npm-script'),
  script: z.string().trim().min(1, 'checks[].run.script must be a non-empty string.'),
});

const tscRunSchema = z.object({
  kind: z.literal('tsc'),
  project: z.string().trim().min(1, 'checks[].run.project must be a non-empty string.'),
});

const regressionCheckSchema = z.object({
  id: z.string().trim().min(1, 'checks[].id must be a non-empty string.'),
  tool: z.string().trim().min(1, 'checks[].tool must be a non-empty string.'),
  cwd: z.string().trim().min(1, 'checks[].cwd must be a non-empty string.'),
  timeoutMs: z.number().int().min(1, 'checks[].timeoutMs must be >= 1.').optional(),
  reporterMode: z.string().trim().min(1).optional(),
  run: z.discriminatedUnion('kind', [npmScriptRunSchema, tscRunSchema]),
});

const parallelSchema = z
  .object({
    enabled: z.boolean(),
    maxWorkers: z.number().int().min(1, 'parallel.maxWorkers must be >= 1.').optional(),
  })
  .optional();

export const regressionConfigInputSchema = z.object({
  reportDirectory: z.string().trim().min(1, 'reportDirectory must be a non-empty string.'),
  parallel: parallelSchema,
  checks: z.array(regressionCheckSchema).nonempty('checks must contain at least one check.'),
});

export type RegressionConfigInput = z.infer<typeof regressionConfigInputSchema>;

/**
 * Formats schema validation issues for regression-config parsing.
 *
 * @param {z.ZodError} error - Schema error produced by zod.
 * @returns {string} Human-readable issue list.
 */
export function formatRegressionConfigIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const issuePath = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
      return `${issuePath}${issue.message}`;
    })
    .join('; ');
}
