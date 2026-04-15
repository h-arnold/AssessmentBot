import path from 'node:path';

import { z } from 'zod';

const WINDOWS_DRIVE_PATH_PATTERN = /^[A-Za-z]:\//;
const WINDOWS_UNC_PATH_PREFIX = '//';

/**
 * Normalises configured path separators to forward slashes.
 *
 * @param {string} value - Raw configured path.
 * @returns {string} Path using forward-slash separators.
 */
function normalisePathSeparators(value: string): string {
  return value.replaceAll('\\', '/');
}

/**
 * Detects absolute paths across POSIX and Windows-style formats.
 *
 * @param {string} value - Normalised path string.
 * @returns {boolean} `true` when the path is absolute.
 */
function isCrossPlatformAbsolutePath(value: string): boolean {
  return (
    value.startsWith('/') ||
    value.startsWith(WINDOWS_UNC_PATH_PREFIX) ||
    WINDOWS_DRIVE_PATH_PATTERN.test(value)
  );
}

/**
 * Normalises and validates a repo-relative configured path.
 *
 * @param {string} value - Raw configured path string.
 * @param {string} label - Config field label for error output.
 * @returns {string} Normalised repo-relative path.
 */
function normaliseRepoRelativePath(value: string, label: string): string {
  const trimmedValue = value.trim();
  if (trimmedValue.length === 0) {
    throw new Error(`${label} must be a non-empty path.`);
  }

  const separatorNormalisedValue = normalisePathSeparators(trimmedValue);
  if (isCrossPlatformAbsolutePath(separatorNormalisedValue)) {
    throw new Error(`${label} must resolve inside repo root: ${value}`);
  }

  const repoRelativePath = path.posix.normalize(separatorNormalisedValue);
  if (
    repoRelativePath === '.' ||
    repoRelativePath === '..' ||
    repoRelativePath.startsWith('../')
  ) {
    throw new Error(`${label} must resolve inside repo root: ${value}`);
  }

  return repoRelativePath;
}

/**
 * Builds a normalising repo-relative path schema.
 *
 * @param {string} label - Config field label for error output.
 * @returns {z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>} Schema for the configured path.
 */
function createRepoRelativePathSchema(label: string) {
  return z.string().transform((value, context) => {
    try {
      return normaliseRepoRelativePath(value, label);
    } catch (error) {
      context.addIssue({
        code: 'custom',
        message: error instanceof Error ? error.message : `${label} is invalid.`,
      });
      return z.NEVER;
    }
  });
}

/**
 * Builds a normalising repo-relative JavaScript source-file schema.
 *
 * @param {string} label - Config field label for error output.
 * @returns {z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>} Schema for configured source-file entries.
 */
function createRepoRelativeJavaScriptPathSchema(label: string) {
  return createRepoRelativePathSchema(label).superRefine((value, context) => {
    if (!value.endsWith('.js')) {
      context.addIssue({
        code: 'custom',
        message: `${label} must contain only relative .js file paths.`,
      });
    }
  });
}

/**
 * Validates that an array contains unique entries.
 *
 * @param {string[]} values - Parsed array values.
 * @param {z.RefinementCtx} context - Zod refinement context.
 * @param {string} label - Config field label for error output.
 * @returns {void}
 */
function validateUniqueEntries(values: string[], context: z.RefinementCtx, label: string): void {
  const seenValues = new Set<string>();

  for (const value of values) {
    if (seenValues.has(value)) {
      context.addIssue({
        code: 'custom',
        message: `${label} must not contain duplicate entries: ${value}`,
      });
      continue;
    }

    seenValues.add(value);
  }
}

const jsonDbAppSourceFilesSchema = z
  .array(createRepoRelativeJavaScriptPathSchema('jsonDbApp.sourceFiles'))
  .nonempty({ message: 'jsonDbApp.sourceFiles must contain at least one entry.' })
  .superRefine((values, context) => {
    validateUniqueEntries(values, context, 'jsonDbApp.sourceFiles');
  });

const jsonDbAppPublicExportsSchema = z
  .array(z.string().trim().min(1, 'jsonDbApp.publicExports must contain only non-empty strings.'))
  .nonempty({ message: 'jsonDbApp.publicExports must contain at least one entry.' })
  .superRefine((values, context) => {
    validateUniqueEntries(values, context, 'jsonDbApp.publicExports');
  });

export const builderConfigSchema = z.object({
  frontendDir: z.string(),
  backendDir: z.string(),
  buildDir: z.string(),
  jsonDbApp: z.object({
    pinnedSnapshotDir: createRepoRelativePathSchema('jsonDbApp.pinnedSnapshotDir'),
    sourceFiles: jsonDbAppSourceFilesSchema,
    publicExports: jsonDbAppPublicExportsSchema,
  }),
});

export type BuilderConfig = z.infer<typeof builderConfigSchema>;

/**
 * Formats Zod issues into a readable builder-config error message.
 *
 * @param {z.ZodError} error - Zod validation error.
 * @returns {string} Joined issue summary.
 */
export function formatBuilderConfigIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const issuePath = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
      return `${issuePath}${issue.message}`;
    })
    .join('; ');
}
