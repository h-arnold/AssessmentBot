/**
 * npm-script resolution and shell-token analysis.
 *
 * @module
 */

import { SUPPORTED_TOOLS, type RegressionTool } from './validators.js';
import { validateRepoRelativePath } from './path-safety.js';

type ShellQuoteCharacter = "'" | '"';
type NpmRunTarget = {
  scriptName: string;
  prefixPath?: string;
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
 * @returns {character is ShellQuoteCharacter} `true` when the character is a quote.
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

export { validateNpmScriptCheck, validateNpmScriptCommandSafety, resolveToolFamiliesFromScript };
export type {
  NpmRunTarget,
  NpmRunTokenAction,
  NpmScriptResolutionContext,
  ShellQuoteCharacter,
  ToolFamilyResolutionOptions,
};
