import { z } from 'zod';

import { validateRepoRelativePath } from './path-safety.js';
import { validateNpmScriptCheck } from './npm-script-resolver.js';
import { validateTool, validateReporterMode } from './validators.js';
import {
  formatRegressionConfigIssues,
  regressionConfigInputSchema,
  type RegressionConfigInput,
} from '../validate-regression-config.zod.js';

const DEFAULT_PARALLEL_WORKER_LIMIT = 4;
const MIN_WORKER_COUNT = 1;

type ValidateRegressionConfigOptions = {
  rawConfig: unknown;
  repoRoot: string;
  packageJsonScriptsByDirectory: Record<string, Record<string, string>>;
  logicalCpuCount: number;
};

type RegressionConfig = {
  reportDirectory: string;
  parallel: {
    enabled: boolean;
    maxWorkers: number;
  };
  checks: RegressionConfigInput['checks'];
};

/**
 * Validates and normalises regression-checker config for Section 1 execution.
 *
 * @param {ValidateRegressionConfigOptions} options - Raw config and runtime dependencies.
 * @returns {RegressionConfig} Safe, validated regression-checker config.
 */
export function validateRegressionConfig(
  options: ValidateRegressionConfigOptions
): RegressionConfig {
  const parsedConfig = parseRegressionConfig(options.rawConfig);
  const reportDirectory = validateRepoRelativePath(
    options.repoRoot,
    parsedConfig.reportDirectory,
    'reportDirectory'
  );
  const logicalCpuCount = validateLogicalCpuCount(options.logicalCpuCount);
  const maxWorkers =
    parsedConfig.parallel?.maxWorkers ?? Math.min(DEFAULT_PARALLEL_WORKER_LIMIT, logicalCpuCount);
  const normalisedChecks = normaliseRegressionChecks(parsedConfig.checks, options);

  return {
    reportDirectory,
    parallel: {
      enabled: parsedConfig.parallel?.enabled ?? true,
      maxWorkers,
    },
    checks: normalisedChecks,
  };
}

/**
 * Normalises and validates all configured regression checks.
 *
 * @param {RegressionConfigInput['checks']} checks - Parsed regression checks.
 * @param {ValidateRegressionConfigOptions} options - Runtime dependencies and repo context.
 * @returns {RegressionConfigInput['checks']} Validated and normalised checks.
 */
function normaliseRegressionChecks(
  checks: RegressionConfigInput['checks'],
  options: ValidateRegressionConfigOptions
): RegressionConfigInput['checks'] {
  const seenCheckIds = new Set<string>();
  const normalisedChecks: RegressionConfigInput['checks'] = [];

  for (const check of checks) {
    if (seenCheckIds.has(check.id)) {
      throw new Error(`Regression config contains duplicate checks[].id value: ${check.id}`);
    }

    seenCheckIds.add(check.id);
    normalisedChecks.push(normaliseRegressionCheck(check, options));
  }

  return normalisedChecks;
}

/**
 * Validates and normalises a single regression check entry.
 *
 * @param {RegressionConfigInput['checks'][number]} check - Parsed regression check.
 * @param {ValidateRegressionConfigOptions} options - Runtime dependencies and repo context.
 * @returns {RegressionConfigInput['checks'][number]} Validated and normalised check.
 */
function normaliseRegressionCheck(
  check: RegressionConfigInput['checks'][number],
  options: ValidateRegressionConfigOptions
): RegressionConfigInput['checks'][number] {
  validateTool(check.tool);
  validateReporterMode(check.tool, check.reporterMode);

  const normalisedCwd = validateRepoRelativePath(
    options.repoRoot,
    check.cwd,
    `checks[].cwd (${check.id})`,
    {
      allowRepoRoot: true,
    }
  );

  if (check.tool === 'tsc') {
    if (check.run.kind !== 'tsc') {
      throw new Error(
        'Regression config invalid: tool=tsc requires run.kind=tsc; npm-script is not allowed.'
      );
    }

    const normalisedProjectPath = validateRepoRelativePath(
      options.repoRoot,
      check.run.project,
      `checks[].run.project (${check.id})`
    );

    return {
      ...check,
      cwd: normalisedCwd,
      run: {
        ...check.run,
        project: normalisedProjectPath,
      },
    };
  }

  if (check.run.kind === 'tsc') {
    throw new Error('Regression config invalid: run.kind=tsc is only supported with tool=tsc.');
  }

  validateNpmScriptCheck(check.tool, normalisedCwd, check.run.script, {
    repoRoot: options.repoRoot,
    packageJsonScriptsByDirectory: options.packageJsonScriptsByDirectory,
  });

  return {
    ...check,
    cwd: normalisedCwd,
  };
}

/**
 * Parses raw regression config using the canonical zod schema.
 *
 * @param {unknown} rawConfig - Untrusted raw config payload.
 * @returns {RegressionConfigInput} Schema-validated regression config.
 */
function parseRegressionConfig(rawConfig: unknown): RegressionConfigInput {
  try {
    return regressionConfigInputSchema.parse(rawConfig);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Regression config is invalid: ${formatRegressionConfigIssues(error)}`);
    }

    throw error;
  }
}

/**
 * Enforces a valid logical CPU count.
 *
 * @param {number} logicalCpuCount - Runtime logical CPU count.
 * @returns {number} Safe logical CPU count value.
 */
function validateLogicalCpuCount(logicalCpuCount: number): number {
  if (!Number.isInteger(logicalCpuCount) || logicalCpuCount < MIN_WORKER_COUNT) {
    throw new Error('logicalCpuCount must be an integer greater than or equal to 1.');
  }

  return logicalCpuCount;
}

export type { RegressionConfig };
