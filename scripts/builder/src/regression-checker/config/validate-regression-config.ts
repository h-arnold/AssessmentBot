import path from 'node:path';

import { z } from 'zod';

import { normalisePathSeparators } from '../../lib/fs.js';
import {
  formatRegressionConfigIssues,
  regressionConfigInputSchema,
  type RegressionConfigInput,
} from './validate-regression-config.zod.js';

const SUPPORTED_TOOLS = ['eslint', 'vitest', 'playwright', 'tsc'] as const;
const TOOL_SUPPORTED_REPORTER_MODES: Record<RegressionTool, readonly string[]> = {
  eslint: ['json'],
  vitest: ['json'],
  playwright: ['json'],
  tsc: [],
};
const DEFAULT_PARALLEL_WORKER_LIMIT = 4;
const MIN_WORKER_COUNT = 1;
const CHAINED_COMMAND_PATTERN = /&&|\|\||;|\|/;
const MUTATING_COMMAND_PATTERN = /(^|\s)(?:--(?:fix|write|update|update-snapshots)|-u)(?=\s|$)/i;
const DIRECT_TOOL_FAMILY_PATTERN =
  /^(?:\s*[A-Za-z_][A-Za-z0-9_]*=(?:[^\s'"]+|"[^"]*"|'[^']*')\s+)*\s*(eslint|vitest|playwright|tsc)(?=\s|$)/u;

const WINDOWS_DRIVE_PATH_PATTERN = /^[A-Za-z]:\//;
const WINDOWS_UNC_PATH_PREFIX = '//';

type RegressionTool = (typeof SUPPORTED_TOOLS)[number];

type ValidateRegressionConfigOptions = {
  rawConfig: unknown;
  repoRoot: string;
  packageJsonScriptsByDirectory: Record<string, Record<string, string>>;
  logicalCpuCount: number;
};

type NpmScriptResolutionContext = {
  repoRoot: string;
  packageJsonScriptsByDirectory: Record<string, Record<string, string>>;
};

type ToolFamilyResolutionOptions = {
  resolutionContext: NpmScriptResolutionContext;
  packageDirectory: string;
  scriptName: string;
  visitedScripts: Set<string>;
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

  const checkIds = new Set<string>();
  const normalisedChecks: RegressionConfigInput['checks'] = [];

  for (const check of parsedConfig.checks) {
    if (checkIds.has(check.id)) {
      throw new Error(`Regression config contains duplicate checks[].id value: ${check.id}`);
    }

    checkIds.add(check.id);

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

    if (check.tool === 'tsc' && check.run.kind === 'npm-script') {
      throw new Error(
        'Regression config invalid: tool=tsc requires run.kind=tsc; npm-script is not allowed.'
      );
    }

    if (check.run.kind === 'tsc') {
      if (check.tool !== 'tsc') {
        throw new Error('Regression config invalid: run.kind=tsc is only supported with tool=tsc.');
      }

      const normalisedProjectPath = validateRepoRelativePath(
        options.repoRoot,
        check.run.project,
        `checks[].run.project (${check.id})`
      );
      normalisedChecks.push({
        ...check,
        cwd: normalisedCwd,
        run: {
          ...check.run,
          project: normalisedProjectPath,
        },
      });
      continue;
    }

    validateNpmScriptCheck(check.tool, normalisedCwd, check.run.script, {
      repoRoot: options.repoRoot,
      packageJsonScriptsByDirectory: options.packageJsonScriptsByDirectory,
    });

    normalisedChecks.push({
      ...check,
      cwd: normalisedCwd,
    });
  }

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

/**
 * Validates a supported tool family name.
 *
 * @param {string} tool - Configured check tool family.
 * @returns {void}
 */
function validateTool(tool: string): asserts tool is RegressionTool {
  if ((SUPPORTED_TOOLS as readonly string[]).includes(tool)) {
    return;
  }

  throw new Error(`Unsupported tool family configured: ${tool}`);
}

/**
 * Validates an optional explicit reporter mode.
 *
 * @param {RegressionTool} tool - Check tool family.
 * @param {string | undefined} reporterMode - Optional configured reporter mode.
 * @returns {void}
 */
function validateReporterMode(tool: RegressionTool, reporterMode: string | undefined): void {
  if (reporterMode === undefined) {
    return;
  }

  const supportedReporterModes = TOOL_SUPPORTED_REPORTER_MODES[tool];
  if (supportedReporterModes.includes(reporterMode)) {
    return;
  }

  throw new Error(`Unsupported reporter mode configured for tool=${tool}: ${reporterMode}`);
}

/**
 * Detects absolute paths across POSIX and Windows formats.
 *
 * @param {string} value - Separator-normalised path.
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
 * Validates a repo-relative config path and returns the normalised value.
 *
 * @param {string} repoRoot - Absolute repository root.
 * @param {string} configuredPath - Raw configured path.
 * @param {string} label - Path label for errors.
 * @param {{allowRepoRoot?: boolean}} options - Path safety options.
 * @returns {string} Normalised repo-relative path.
 */
function validateRepoRelativePath(
  repoRoot: string,
  configuredPath: string,
  label: string,
  options: { allowRepoRoot?: boolean } = {}
): string {
  const trimmedPath = configuredPath.trim();
  if (trimmedPath.length === 0) {
    throw new Error(`${label} must be a non-empty path.`);
  }

  const separatorNormalisedPath = normalisePathSeparators(trimmedPath);
  if (isCrossPlatformAbsolutePath(separatorNormalisedPath)) {
    throw new Error(`${label} must resolve inside repo root: ${configuredPath}`);
  }

  assertPathDoesNotTraverseOutsideRepo(separatorNormalisedPath, label, configuredPath);

  const resolvedPath = path.resolve(repoRoot, separatorNormalisedPath);
  const relativePath = path.relative(repoRoot, resolvedPath);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`${label} must resolve inside repo root: ${configuredPath}`);
  }

  if (relativePath === '' && options.allowRepoRoot !== true) {
    throw new Error(`${label} must resolve inside repo root: ${configuredPath}`);
  }

  return path.posix.normalize(separatorNormalisedPath);
}

/**
 * Rejects path values that traverse outside the repository, even when they later
 * resolve back under repo root.
 *
 * @param {string} configuredPath - Separator-normalised configured path.
 * @param {string} label - Path label for error context.
 * @param {string} originalValue - Raw configured path value.
 * @returns {void}
 */
function assertPathDoesNotTraverseOutsideRepo(
  configuredPath: string,
  label: string,
  originalValue: string
): void {
  const segments = configuredPath.split('/');
  let relativeDepth = 0;

  for (const segment of segments) {
    if (segment === '' || segment === '.') {
      continue;
    }

    if (segment === '..') {
      if (relativeDepth === 0) {
        throw new Error(`${label} must resolve inside repo root: ${originalValue}`);
      }

      relativeDepth -= 1;
      continue;
    }

    relativeDepth += 1;
  }
}

/**
 * Validates npm-script checks against v1 safety and tool-family constraints.
 *
 * @param {RegressionTool} declaredTool - Declared tool family from config.
 * @param {string} packageDirectory - Repo-relative package directory for script lookup.
 * @param {string} scriptName - npm script name.
 * @param {NpmScriptResolutionContext} resolutionContext - Package script lookup context.
 * @returns {void}
 */
function validateNpmScriptCheck(
  declaredTool: RegressionTool,
  packageDirectory: string,
  scriptName: string,
  resolutionContext: NpmScriptResolutionContext
): void {
  const scriptCommand = getPackageJsonScriptsForDirectory(resolutionContext, packageDirectory)[
    scriptName
  ];
  if (scriptCommand === undefined) {
    throw new Error(`run.kind=npm-script requires a declared package.json script: ${scriptName}`);
  }

  if (MUTATING_COMMAND_PATTERN.test(scriptCommand)) {
    throw new Error(
      `run.kind=npm-script script ${scriptName} is mutating and not allowed (${scriptCommand}).`
    );
  }

  if (CHAINED_COMMAND_PATTERN.test(scriptCommand)) {
    throw new Error(
      `run.kind=npm-script script ${scriptName} must resolve to a single tool family and cannot be chained.`
    );
  }

  const resolvedToolFamilies = resolveToolFamiliesFromScript({
    resolutionContext,
    packageDirectory,
    scriptName,
    visitedScripts: new Set<string>(),
  });

  if (resolvedToolFamilies.size !== 1) {
    throw new Error(
      `run.kind=npm-script script ${scriptName} must resolve to exactly one supported tool family.`
    );
  }

  const [resolvedToolFamily] = [...resolvedToolFamilies];
  if (resolvedToolFamily !== declaredTool) {
    throw new Error(
      `run.kind=npm-script script ${scriptName} resolves to ${resolvedToolFamily}, not declared tool family ${declaredTool}.`
    );
  }
}

/**
 * Resolves supported tool families referenced by a named npm script.
 *
 * @param {ToolFamilyResolutionOptions} options - Script resolution parameters.
 * @returns {Set<RegressionTool>} Resolved supported tool families.
 */
function resolveToolFamiliesFromScript(options: ToolFamilyResolutionOptions): Set<RegressionTool> {
  const recursiveScriptToken = `${options.packageDirectory}:${options.scriptName}`;
  if (options.visitedScripts.has(recursiveScriptToken)) {
    throw new Error(`run.kind=npm-script script recursion detected: ${recursiveScriptToken}`);
  }

  const packageJsonScripts = getPackageJsonScriptsForDirectory(
    options.resolutionContext,
    options.packageDirectory
  );
  const scriptCommand = packageJsonScripts[options.scriptName];
  if (scriptCommand === undefined) {
    throw new Error(
      `run.kind=npm-script script is not declared in package.json (${options.packageDirectory}): ${options.scriptName}`
    );
  }

  if (MUTATING_COMMAND_PATTERN.test(scriptCommand)) {
    throw new Error(
      `run.kind=npm-script script ${options.scriptName} is mutating and not allowed (${scriptCommand}).`
    );
  }

  if (CHAINED_COMMAND_PATTERN.test(scriptCommand)) {
    throw new Error(
      `run.kind=npm-script script ${options.scriptName} must resolve to a single tool family and cannot be chained.`
    );
  }

  const nextVisitedScripts = new Set(options.visitedScripts);
  nextVisitedScripts.add(recursiveScriptToken);

  const resolvedToolFamilies = resolveDirectToolFamilies(scriptCommand);

  for (const nestedNpmRun of extractNpmRunTargets(scriptCommand)) {
    const nestedPackageDirectory = nestedNpmRun.prefixPath
      ? validateRepoRelativePath(
          options.resolutionContext.repoRoot,
          nestedNpmRun.prefixPath,
          `run.kind=npm-script npm --prefix (${options.scriptName})`,
          { allowRepoRoot: true }
        )
      : options.packageDirectory;

    const nestedPackageScripts = getPackageJsonScriptsForDirectory(
      options.resolutionContext,
      nestedPackageDirectory
    );
    if (!(nestedNpmRun.scriptName in nestedPackageScripts)) {
      continue;
    }

    const nestedFamilies = resolveToolFamiliesFromScript({
      resolutionContext: options.resolutionContext,
      packageDirectory: nestedPackageDirectory,
      scriptName: nestedNpmRun.scriptName,
      visitedScripts: nextVisitedScripts,
    });

    for (const nestedFamily of nestedFamilies) {
      resolvedToolFamilies.add(nestedFamily);
    }
  }

  if (resolvedToolFamilies.size === 0) {
    throw new Error(
      `run.kind=npm-script script ${options.scriptName} does not map to a supported tool family.`
    );
  }

  return resolvedToolFamilies;
}

/**
 * Loads scripts from the relevant package.json directory map.
 *
 * @param {NpmScriptResolutionContext} resolutionContext - Package script lookup context.
 * @param {string} packageDirectory - Repo-relative package directory (`.` for repo root).
 * @returns {Record<string, string>} Scripts declared in the target package.json.
 */
function getPackageJsonScriptsForDirectory(
  resolutionContext: NpmScriptResolutionContext,
  packageDirectory: string
): Record<string, string> {
  const scripts = resolutionContext.packageJsonScriptsByDirectory[packageDirectory];
  if (scripts !== undefined) {
    return scripts;
  }

  throw new Error(
    `run.kind=npm-script requires script lookup for relevant package.json directory: ${packageDirectory}`
  );
}

/**
 * Resolves directly invoked tool families from a script command.
 *
 * @param {string} command - Script command string.
 * @returns {Set<RegressionTool>} Directly invoked tool families.
 */
function resolveDirectToolFamilies(command: string): Set<RegressionTool> {
  const directToolFamilyMatch = command.match(DIRECT_TOOL_FAMILY_PATTERN);
  if (directToolFamilyMatch?.[1] === undefined) {
    return new Set<RegressionTool>();
  }

  return new Set<RegressionTool>([directToolFamilyMatch[1] as RegressionTool]);
}

/**
 * Extracts nested `npm run <script>` targets from a command.
 *
 * @param {string} command - Script command string.
 * @returns {Array<{ scriptName: string; prefixPath?: string }>} Nested npm script targets.
 */
function extractNpmRunTargets(command: string): Array<{ scriptName: string; prefixPath?: string }> {
  const matches = [
    ...command.matchAll(
      /(?:^|\s)npm(?:\s+--prefix(?:=|\s+)([^\s]+))?(?:\s+--[^\s=]+(?:=[^\s]+|\s+[^\s]+))*\s+run\s+([^\s]+)/gu
    ),
  ];

  const targets: Array<{ scriptName: string; prefixPath?: string }> = [];
  for (const match of matches) {
    const scriptName = match[2];
    if (scriptName === undefined) {
      continue;
    }

    const prefixPath = match[1];
    if (prefixPath === undefined) {
      targets.push({ scriptName });
      continue;
    }

    targets.push({
      scriptName,
      prefixPath,
    });
  }

  return targets;
}
