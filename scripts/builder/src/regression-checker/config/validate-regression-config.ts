import path from 'node:path';

import { z } from 'zod';

import {
  isCrossPlatformAbsolutePath,
  normalisePathSeparators,
  normaliseRelativeSegments,
} from '../../lib/fs.js';
import {
  formatRegressionConfigIssues,
  regressionConfigInputSchema,
  type RegressionConfigInput,
} from './validate-regression-config.zod.js';

const SUPPORTED_TOOLS = ['eslint', 'vitest', 'playwright', 'tsc'] as const;
const DEFAULT_PARALLEL_WORKER_LIMIT = 4;
const MIN_WORKER_COUNT = 1;
const SHELL_TOKEN_LENGTH = 1;
const DOUBLE_CHARACTER_TOKEN_LENGTH = 2;
const TRIPLE_CHARACTER_TOKEN_LENGTH = 3;
const PREFIX_FLAG_TOKEN_LENGTH = 8;
const CHAR_CODE_DASH = 45;
const CHAR_CODE_SEMICOLON = 59;
const CHAR_CODE_PIPE = 124;
const CHAR_CODE_N = 110;
const CHAR_CODE_R = 114;
const CHAR_CODE_U = 117;
const THIRD_CHARACTER_INDEX = 2;
const CHAINED_COMMAND_PATTERN = /&&|\|\||;|\|/;
const MUTATING_COMMAND_PATTERN = /(^|\s)(?:--(?:fix|write|update|update-snapshots)|-u)(?=\s|$)/i;

type RegressionTool = (typeof SUPPORTED_TOOLS)[number];
type ShellQuoteCharacter = "'" | '"';
type NpmRunTarget = {
  scriptName: string;
  prefixPath?: string;
};

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

  switch (tool) {
    case 'eslint':
    case 'vitest':
    case 'playwright':
      if (reporterMode === 'json') {
        return;
      }
      break;
    case 'tsc':
      break;
  }

  throw new Error(`Unsupported reporter mode configured for tool=${tool}: ${reporterMode}`);
}

/**
 * Validates a repo-relative config path and returns the normalised value.
 *
 * @param {string} repoRoot - Absolute repository root.
 * @param {string} configuredPath - Raw configured path.
 * @param {string} label - Path label for errors.
 * @param {{allowRepoRoot?: boolean}} [options] - Path safety options.
 * @param {boolean} [options.allowRepoRoot] - Allow the repo root itself as a valid result.
 * @returns {string} Normalised repo-relative path.
 */
function validateRepoRelativePath(
  repoRoot: string,
  configuredPath: string,
  label: string,
  options: { allowRepoRoot?: boolean } = {}
): string {
  const trimmedPath = configuredPath.trim();
  const separatorNormalisedPath = normalisePathSeparators(trimmedPath);
  assertRepoRelativePathIsValid(repoRoot, configuredPath, separatorNormalisedPath, label, options);

  return path.posix.normalize(separatorNormalisedPath);
}

/**
 * Enforces repo-root containment for a validated path candidate.
 *
 * @param {string} repoRoot - Absolute repository root.
 * @param {string} configuredPath - Raw configured path for error messages.
 * @param {string} separatorNormalisedPath - Path with normalised separators.
 * @param {string} label - Path label for errors.
 * @param {{allowRepoRoot?: boolean}} [options] - Path safety options.
 * @param {boolean} [options.allowRepoRoot] - Allow the repository root itself as a valid result.
 * @returns {void}
 */
function assertRepoRelativePathIsValid(
  repoRoot: string,
  configuredPath: string,
  separatorNormalisedPath: string,
  label: string,
  options: { allowRepoRoot?: boolean } = {}
): void {
  assertPathIsNotEmpty(separatorNormalisedPath, label);
  assertPathIsNotAbsolute(separatorNormalisedPath, configuredPath, label);
  assertPathDoesNotEscapeRepoRoot(separatorNormalisedPath, configuredPath, label);
  assertPathResolvesInsideRepoRoot(
    repoRoot,
    separatorNormalisedPath,
    configuredPath,
    label,
    options
  );
}

/**
 * Ensures a normalised path is not empty.
 *
 * @param {string} separatorNormalisedPath - Path with normalised separators.
 * @param {string} label - Path label for errors.
 * @returns {void}
 */
function assertPathIsNotEmpty(separatorNormalisedPath: string, label: string): void {
  if (separatorNormalisedPath.length === 0) {
    throw new Error(`${label} must be a non-empty path.`);
  }
}

/**
 * Ensures a normalised path is not absolute.
 *
 * @param {string} separatorNormalisedPath - Path with normalised separators.
 * @param {string} configuredPath - Raw configured path for errors.
 * @param {string} label - Path label for errors.
 * @returns {void}
 */
function assertPathIsNotAbsolute(
  separatorNormalisedPath: string,
  configuredPath: string,
  label: string
): void {
  if (isCrossPlatformAbsolutePath(separatorNormalisedPath)) {
    throw new Error(`${label} must resolve inside repo root: ${configuredPath}`);
  }
}

/**
 * Ensures a normalised path does not traverse above the repository root.
 *
 * @param {string} separatorNormalisedPath - Path with normalised separators.
 * @param {string} configuredPath - Raw configured path for errors.
 * @param {string} label - Path label for errors.
 * @returns {void}
 */
function assertPathDoesNotEscapeRepoRoot(
  separatorNormalisedPath: string,
  configuredPath: string,
  label: string
): void {
  if (normaliseRelativeSegments(separatorNormalisedPath.split('/')) === null) {
    throw new Error(`${label} must resolve inside repo root: ${configuredPath}`);
  }
}

/**
 * Ensures a path resolves within the repository root.
 *
 * @param {string} repoRoot - Absolute repository root.
 * @param {string} separatorNormalisedPath - Path with normalised separators.
 * @param {string} configuredPath - Raw configured path for errors.
 * @param {string} label - Path label for errors.
 * @param {{allowRepoRoot?: boolean}} options - Path safety options.
 * @param {boolean} [options.allowRepoRoot] - Allow the repository root itself as a valid result.
 * @returns {void}
 */
function assertPathResolvesInsideRepoRoot(
  repoRoot: string,
  separatorNormalisedPath: string,
  configuredPath: string,
  label: string,
  options: { allowRepoRoot?: boolean }
): void {
  const resolvedPath = path.resolve(repoRoot, separatorNormalisedPath);
  const relativePath = path.relative(repoRoot, resolvedPath);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`${label} must resolve inside repo root: ${configuredPath}`);
  }

  if (!options.allowRepoRoot && relativePath.length === 0) {
    throw new Error(`${label} must resolve inside repo root: ${configuredPath}`);
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
  const scriptCommand = getPackageJsonScriptCommand(
    resolutionContext,
    packageDirectory,
    scriptName
  );
  if (scriptCommand === null) {
    throw new Error(`run.kind=npm-script requires a declared package.json script: ${scriptName}`);
  }

  validateNpmScriptCommandSafety(scriptCommand, scriptName);

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

  const scriptCommand = getPackageJsonScriptCommand(
    options.resolutionContext,
    options.packageDirectory,
    options.scriptName
  );
  if (scriptCommand === null) {
    throw new Error(
      `run.kind=npm-script script is not declared in package.json (${options.packageDirectory}): ${options.scriptName}`
    );
  }

  validateNpmScriptCommandSafety(scriptCommand, options.scriptName);

  const nextVisitedScripts = new Set(options.visitedScripts);
  nextVisitedScripts.add(recursiveScriptToken);

  const resolvedToolFamilies = resolveDirectToolFamilies(scriptCommand);

  for (const nestedNpmRun of extractNpmRunTargets(scriptCommand)) {
    appendNestedToolFamilies(resolvedToolFamilies, options, nestedNpmRun, nextVisitedScripts);
  }

  if (resolvedToolFamilies.size === 0) {
    throw new Error(
      `run.kind=npm-script script ${options.scriptName} does not map to a supported tool family.`
    );
  }

  return resolvedToolFamilies;
}

/**
 * Resolves and appends tool families referenced by a nested `npm run` target.
 *
 * @param {Set<RegressionTool>} resolvedToolFamilies - Accumulator for resolved families.
 * @param {ToolFamilyResolutionOptions} options - Script resolution parameters.
 * @param {NpmRunTarget} nestedNpmRun - Nested npm run target to resolve.
 * @param {Set<string>} visitedScripts - Recursion guard for nested resolution.
 * @returns {void}
 */
function appendNestedToolFamilies(
  resolvedToolFamilies: Set<RegressionTool>,
  options: ToolFamilyResolutionOptions,
  nestedNpmRun: NpmRunTarget,
  visitedScripts: Set<string>
): void {
  const nestedPackageDirectory = nestedNpmRun.prefixPath
    ? validateRepoRelativePath(
        options.resolutionContext.repoRoot,
        nestedNpmRun.prefixPath,
        `run.kind=npm-script npm --prefix (${options.scriptName})`,
        { allowRepoRoot: true }
      )
    : options.packageDirectory;

  const nestedScriptCommand = getPackageJsonScriptCommand(
    options.resolutionContext,
    nestedPackageDirectory,
    nestedNpmRun.scriptName
  );
  if (nestedScriptCommand === null) {
    // Nested `npm run` targets may reference scripts that are not present in the
    // preloaded package map; skip those and keep resolving the declared script.
    return;
  }

  const nestedFamilies = resolveToolFamiliesFromScript({
    resolutionContext: options.resolutionContext,
    packageDirectory: nestedPackageDirectory,
    scriptName: nestedNpmRun.scriptName,
    visitedScripts,
  });

  for (const nestedFamily of nestedFamilies) {
    resolvedToolFamilies.add(nestedFamily);
  }
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
  const scriptsByDirectoryMap = new Map(
    Object.entries(resolutionContext.packageJsonScriptsByDirectory)
  );
  const scripts = scriptsByDirectoryMap.get(packageDirectory);
  if (scripts !== undefined) {
    return scripts;
  }

  throw new Error(
    `run.kind=npm-script requires script lookup for relevant package.json directory: ${packageDirectory}`
  );
}

/**
 * Looks up a script command by directory and script name.
 *
 * @param {NpmScriptResolutionContext} resolutionContext - Package script lookup context.
 * @param {string} packageDirectory - Repo-relative package directory (`.` for repo root).
 * @param {string} scriptName - npm script name to resolve.
 * @returns {string | null} Script command when declared, otherwise `null`.
 */
function getPackageJsonScriptCommand(
  resolutionContext: NpmScriptResolutionContext,
  packageDirectory: string,
  scriptName: string
): string | null {
  const scripts = getPackageJsonScriptsForDirectory(resolutionContext, packageDirectory);
  const scriptsMap = new Map(Object.entries(scripts));
  const scriptCommand = scriptsMap.get(scriptName);
  if (scriptCommand === undefined) {
    return null;
  }

  const resolvedScriptCommand: unknown = scriptCommand;
  if (typeof resolvedScriptCommand !== 'string') {
    throw new TypeError(
      `run.kind=npm-script script is not declared in package.json (${packageDirectory}): ${scriptName}`
    );
  }

  return resolvedScriptCommand;
}

/**
 * Resolves directly invoked tool families from a script command.
 *
 * @param {string} command - Script command string.
 * @returns {Set<RegressionTool>} Directly invoked tool families.
 */
function resolveDirectToolFamilies(command: string): Set<RegressionTool> {
  const firstCommandToken = getFirstCommandToken(command);
  if (firstCommandToken === null) {
    return new Set<RegressionTool>();
  }

  if (!isSupportedTool(firstCommandToken)) {
    return new Set<RegressionTool>();
  }

  return new Set<RegressionTool>([firstCommandToken]);
}

/**
 * Resolves the first command token after leading environment assignments.
 *
 * @param {string} command - Script command string.
 * @returns {string | null} First command token or `null` when not present.
 */
function getFirstCommandToken(command: string): string | null {
  const tokens = tokeniseShellWords(command);
  for (const token of tokens) {
    if (isEnvironmentAssignmentToken(token)) {
      continue;
    }

    return token;
  }

  return null;
}

/**
 * Tokenises a shell-like command while preserving quoted segments.
 *
 * @param {string} command - Script command string.
 * @returns {string[]} Command tokens.
 */
function tokeniseShellWords(command: string): string[] {
  const tokens: string[] = [];
  let token = '';
  let quote: ShellQuoteCharacter | null = null;

  for (const character of command) {
    if (isWhitespaceCharacter(character) && quote === null) {
      if (token.length > 0) {
        tokens.push(token);
        token = '';
      }
      continue;
    }

    if (isQuoteCharacter(character)) {
      quote = updateQuoteState(quote, character);
    }

    token += character;
  }

  if (token.length > 0) {
    tokens.push(token);
  }

  return tokens;
}

/**
 * Detects shell-style environment assignment tokens (`KEY=value`).
 *
 * @param {string} token - Token to inspect.
 * @returns {boolean} `true` when token is an environment assignment.
 */
function isEnvironmentAssignmentToken(token: string): boolean {
  const separatorIndex = token.indexOf('=');
  if (separatorIndex <= 0) {
    return false;
  }

  const variableName = token.slice(0, separatorIndex);
  return /^[A-Za-z_]\w*$/u.test(variableName);
}

/**
 * Checks whether a command token is one of the supported tool families.
 *
 * @param {string} toolToken - Command token to inspect.
 * @returns {toolToken is RegressionTool} `true` for supported tool families.
 */
function isSupportedTool(toolToken: string): toolToken is RegressionTool {
  return SUPPORTED_TOOLS.includes(toolToken as RegressionTool);
}

/**
 * Extracts nested `npm run <script>` targets from a command.
 *
 * @param {string} command - Script command string.
 * @returns {NpmRunTarget[]} Nested npm script targets.
 */
function extractNpmRunTargets(command: string): NpmRunTarget[] {
  const targets: NpmRunTarget[] = [];
  const tokens = tokeniseShellWords(command);

  while (tokens.length > 0) {
    const token = tokens.shift()!;

    if (!isNpmToken(token)) {
      continue;
    }

    const parsedTarget = readNpmRunTarget(tokens);
    if (parsedTarget === null) {
      continue;
    }

    targets.push(parsedTarget);
  }

  return targets;
}

/**
 * Parses a nested `npm run` target from tokenised command text.
 *
 * @param {string[]} tokens - Tokenised shell command.
 * @returns {NpmRunTarget | null} Parsed target or `null`.
 */
function readNpmRunTarget(tokens: string[]): NpmRunTarget | null {
  let prefixPath: string | undefined;

  while (tokens.length > 0) {
    const token = tokens.shift()!;

    const nextAction = classifyNpmRunToken(token, tokens, prefixPath);
    switch (nextAction.kind) {
      case 'target':
        return nextAction.target;
      case 'continue':
        prefixPath = nextAction.prefixPath;
        continue;
      case 'fail':
        return null;
    }
  }

  return null;
}

type NpmRunTokenAction =
  | {
      kind: 'continue';
      prefixPath?: string;
    }
  | {
      kind: 'fail';
    }
  | {
      kind: 'target';
      target: NpmRunTarget;
    };

/**
 * Classifies a token encountered while scanning an npm run command.
 *
 * @param {string} token - Current token.
 * @param {string[]} tokens - Remaining token queue.
 * @param {string | undefined} prefixPath - Active prefix path.
 * @returns {NpmRunTokenAction} Next parser action.
 */
function classifyNpmRunToken(
  token: string,
  tokens: string[],
  prefixPath: string | undefined
): NpmRunTokenAction {
  if (isRunToken(token)) {
    const scriptName = consumeToken(tokens);
    if (scriptName === undefined) {
      return { kind: 'fail' };
    }

    return {
      kind: 'target',
      target: prefixPath === undefined ? { scriptName } : { scriptName, prefixPath },
    };
  }

  const prefixCandidate = consumePrefixPathToken(token, tokens);
  if (prefixCandidate !== null) {
    return {
      kind: 'continue',
      prefixPath: prefixCandidate,
    };
  }

  if (isShellControlToken(token)) {
    return { kind: 'fail' };
  }

  if (isNpmOptionToken(token)) {
    skipLikelyNpmOptionValue(tokens);
    return { kind: 'continue' };
  }

  return { kind: 'fail' };
}

/**
 * Consumes the next token from the queue.
 *
 * @param {string[]} tokens - Tokenised shell command.
 * @returns {string | undefined} The next token or `undefined` when the queue is empty.
 */
function consumeToken(tokens: string[]): string | undefined {
  return tokens.shift();
}

/**
 * Consumes a `--prefix` token and its value when present.
 *
 * @param {string} token - Current token.
 * @param {string[]} tokens - Remaining token queue.
 * @returns {string | null} Prefix path when the token is a prefix flag, otherwise `null`.
 */
function consumePrefixPathToken(token: string, tokens: string[]): string | null {
  if (isPrefixToken(token)) {
    const prefixCandidate = consumeToken(tokens);
    if (prefixCandidate === undefined) {
      return null;
    }

    return prefixCandidate;
  }

  if (token.startsWith('--prefix=')) {
    return token.slice('--prefix='.length);
  }

  return null;
}

/**
 * Skips a likely value token for an npm option.
 *
 * @param {string[]} tokens - Remaining token queue.
 * @returns {void}
 */
function skipLikelyNpmOptionValue(tokens: string[]): void {
  if (tokens.length === 0) {
    return;
  }

  const valueToken = tokens[0];
  if (isRunToken(valueToken) || valueToken.startsWith('-') || isShellControlToken(valueToken)) {
    return;
  }
  tokens.shift();
}

/**
 * Checks whether a token splits the command into separate shell segments.
 *
 * @param {string} token - Shell token.
 * @returns {boolean} `true` when the token is a shell control operator.
 */
function isShellControlToken(token: string): boolean {
  return (
    isAndAndToken(token) ||
    isPipePipeToken(token) ||
    isSingleCharacterShellToken(token, CHAR_CODE_SEMICOLON) ||
    isSingleCharacterShellToken(token, CHAR_CODE_PIPE)
  );
}

/**
 * Checks whether a token is `&&`.
 *
 * @param {string} token - Shell token.
 * @returns {boolean} `true` when the token is `&&`.
 */
function isAndAndToken(token: string): boolean {
  return token.length === DOUBLE_CHARACTER_TOKEN_LENGTH && token.startsWith('&&');
}

/**
 * Checks whether a token is `||`.
 *
 * @param {string} token - Shell token.
 * @returns {boolean} `true` when the token is `||`.
 */
function isPipePipeToken(token: string): boolean {
  return token.length === DOUBLE_CHARACTER_TOKEN_LENGTH && token.startsWith('||');
}

/**
 * Checks whether a token is a single-character shell control operator.
 *
 * @param {string} token - Shell token.
 * @param {number} expectedCharCode - Expected character code.
 * @returns {boolean} `true` when the token matches the expected single-character operator.
 */
function isSingleCharacterShellToken(token: string, expectedCharCode: number): boolean {
  return token.length === SHELL_TOKEN_LENGTH && token.codePointAt(0) === expectedCharCode;
}

/**
 * Checks whether a character is whitespace.
 *
 * @param {string} character - Single character to inspect.
 * @returns {boolean} `true` when the character is whitespace.
 */
function isWhitespaceCharacter(character: string): boolean {
  return character.trim().length === 0;
}

/**
 * Checks whether a character is a shell quote marker.
 *
 * @param {string} character - Single character to inspect.
 * @returns {character is \"'\" | '\"'} `true` when the character is a quote.
 */
function isQuoteCharacter(character: string): character is ShellQuoteCharacter {
  return character === "'" || character === '"';
}

/**
 * Updates the active quote state when encountering a quote character.
 *
 * @param {ShellQuoteCharacter | null} quote - Current quote state.
 * @param {ShellQuoteCharacter} character - Quote character to process.
 * @returns {ShellQuoteCharacter | null} Next quote state.
 */
function updateQuoteState(
  quote: ShellQuoteCharacter | null,
  character: ShellQuoteCharacter
): ShellQuoteCharacter | null {
  return quote === character ? null : character;
}

/**
 * Checks whether a token is the `npm` command token.
 *
 * @param {string} token - Shell token.
 * @returns {boolean} `true` when the token is `npm`.
 */
function isNpmToken(token: string): boolean {
  return token === 'npm';
}

/**
 * Checks whether a token is the `run` command token.
 *
 * @param {string} token - Shell token.
 * @returns {boolean} `true` when the token is `run`.
 */
function isRunToken(token: string): boolean {
  return (
    token.length === TRIPLE_CHARACTER_TOKEN_LENGTH &&
    token.codePointAt(0) === CHAR_CODE_R &&
    token.codePointAt(1) === CHAR_CODE_U &&
    token.codePointAt(THIRD_CHARACTER_INDEX) === CHAR_CODE_N
  );
}

/**
 * Checks whether a token is the `--prefix` flag.
 *
 * @param {string} token - Shell token.
 * @returns {boolean} `true` when the token is the prefix flag.
 */
function isPrefixToken(token: string): boolean {
  return token.length === PREFIX_FLAG_TOKEN_LENGTH && token.startsWith('--prefix');
}

/**
 * Checks whether a token is an npm option flag.
 *
 * @param {string} token - Shell token.
 * @returns {boolean} `true` when the token begins with `--`.
 */
function isNpmOptionToken(token: string): boolean {
  return (
    token.length >= DOUBLE_CHARACTER_TOKEN_LENGTH &&
    token.codePointAt(0) === CHAR_CODE_DASH &&
    token.codePointAt(1) === CHAR_CODE_DASH
  );
}

/**
 * Validates npm-script command safety before resolution.
 *
 * @param {string} scriptCommand - Raw npm script command.
 * @param {string} scriptName - npm script name for error messages.
 * @returns {void}
 */
function validateNpmScriptCommandSafety(scriptCommand: string, scriptName: string): void {
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
}
