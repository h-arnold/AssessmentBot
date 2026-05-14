import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { pathToFileURL } from 'node:url';

import { loadDefaultRegressionCheckerConfig, runRegressionCheckerCli } from './cli/index.js';
import { runCommand } from '../lib/process.js';
import {
  isCrossPlatformAbsolutePath,
  isErrnoExceptionWithCode,
  normalisePathSeparators,
  normaliseRelativeSegments,
} from '../lib/fs.js';

const NPM_COMMAND_SPLIT_TOKEN = 'npm ';
const NPM_RUN_SEGMENT_TOKEN = ' run ';
const PREFIX_EQUALS_TOKEN = '--prefix=';
const PREFIX_SPACE_TOKEN = '--prefix ';
const MIN_WRAPPED_VALUE_LENGTH = 2;

/**
 * Runs the regression-checker CLI using repository defaults and the current process context.
 *
 * @returns {Promise<void>} Completion promise that sets the process exit code.
 */
async function main(): Promise<void> {
  const repoRoot = process.cwd();
  const rawConfig = await loadDefaultRegressionCheckerConfig(repoRoot);
  const packageJsonScriptsByDirectory = await loadPackageJsonScriptsByDirectory({
    repoRoot,
    rawConfig,
  });
  const result = await runRegressionCheckerCli({
    positionalSessionId: process.argv[2],
    repoRoot,
    createdAt: new Date().toISOString(),
    logicalCpuCount: Math.max(1, os.cpus().length),
    loadRawConfig: async () => rawConfig,
    packageJsonScriptsByDirectory,
    resolveGitBranchName,
  });

  const outputStream = result.exitCode === 0 ? process.stdout : process.stderr;
  outputStream.write(`${result.outputText}\n`);
  process.exitCode = result.exitCode;
}

/**
 * Resolves the current Git branch name for the default CLI entrypoint.
 *
 * @returns {Promise<string>} Active Git branch name.
 */
export async function resolveGitBranchName(): Promise<string> {
  const commandResult = await runCommand('git', ['branch', '--show-current'], {
    cwd: process.cwd(),
  });
  const branchName = commandResult.stdout.trim();

  if (branchName.length === 0) {
    throw new Error('Git branch name is empty.');
  }

  return branchName;
}
/**
 * Loads package-script maps for the repo root and each configured check directory.
 *
 * @param {{ repoRoot: string; rawConfig: unknown }} options - Repository root and raw config payload.
 * @param {string} options.repoRoot - Absolute repository root.
 * @param {unknown} options.rawConfig - Raw regression-checker config payload.
 * @returns {Promise<Record<string, Record<string, string>>>} Script maps keyed by repo-relative directory.
 */
export async function loadPackageJsonScriptsByDirectory(options: {
  repoRoot: string;
  rawConfig: unknown;
}): Promise<Record<string, Record<string, string>>> {
  const scriptEntries: Array<[string, Record<string, string>]> = [];
  const directoriesToProcess = [...getCandidateDirectories(options.rawConfig)];
  const processedDirectories = new Set<string>();

  while (directoriesToProcess.length > 0) {
    const directory = directoriesToProcess.shift();
    if (directory === undefined || processedDirectories.has(directory)) {
      continue;
    }
    processedDirectories.add(directory);

    const scripts = await readPackageJsonScripts(options.repoRoot, directory);
    if (scripts !== null) {
      scriptEntries.push([directory, scripts]);

      for (const discoveredDirectory of discoverPrefixedPackageDirectories(scripts)) {
        if (!processedDirectories.has(discoveredDirectory)) {
          directoriesToProcess.push(discoveredDirectory);
        }
      }
    }
  }

  return Object.fromEntries(scriptEntries);
}

/**
 * Extracts repo-relative package directories referenced by the raw config.
 *
 * @param {unknown} rawConfig - Raw config payload.
 * @returns {Set<string>} Candidate package directories including repo root.
 */
function getCandidateDirectories(rawConfig: unknown): Set<string> {
  const candidateDirectories = new Set<string>(['.']);

  if (!isRecord(rawConfig) || !Array.isArray(rawConfig.checks)) {
    return candidateDirectories;
  }

  for (const check of rawConfig.checks) {
    if (!isRecord(check) || typeof check.cwd !== 'string') {
      continue;
    }

    const canonicalDirectory = normaliseSafePackageDirectory(check.cwd);
    if (canonicalDirectory !== null) {
      candidateDirectories.add(canonicalDirectory);
    }
  }

  return candidateDirectories;
}

/**
 * Validates package lookup directories to avoid repo-escape resolution during pre-validation reads.
 *
 * @param {string} cwd - Raw `checks[].cwd` value from config.
 * @returns {string | null} Canonical repo-relative directory or `null` when invalid/unsafe.
 */
function normaliseSafePackageDirectory(cwd: string): string | null {
  const trimmed = cwd.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const normalised = normalisePathSeparators(trimmed);
  if (isCrossPlatformAbsolutePath(normalised)) {
    return null;
  }

  const canonicalSegments = normaliseRelativeSegments(normalised.split('/'));
  if (canonicalSegments === null) {
    return null;
  }

  return canonicalSegments.length === 0 ? '.' : canonicalSegments.join('/');
}

/**
 * Discovers repo-relative package directories referenced through npm --prefix script calls.
 *
 * @param {Record<string, string>} scripts - Scripts map from a package.json file.
 * @returns {Set<string>} Canonical repo-relative package directories.
 */
function discoverPrefixedPackageDirectories(scripts: Record<string, string>): Set<string> {
  const discoveredDirectories = new Set<string>();

  for (const scriptCommand of Object.values(scripts)) {
    for (const prefixPath of extractNpmPrefixPaths(scriptCommand)) {
      const canonicalDirectory = normaliseSafePackageDirectory(prefixPath);
      if (canonicalDirectory !== null) {
        discoveredDirectories.add(canonicalDirectory);
      }
    }
  }

  return discoveredDirectories;
}

/**
 * Extracts npm --prefix directory values from script command text.
 *
 * @param {string} scriptCommand - Raw package.json script command.
 * @returns {string[]} Prefix directory values.
 */
function extractNpmPrefixPaths(scriptCommand: string): string[] {
  const prefixPaths: string[] = [];
  const commandSegments = scriptCommand.split(NPM_COMMAND_SPLIT_TOKEN);

  for (const commandSegment of commandSegments.slice(1)) {
    const runTokenIndex = commandSegment.indexOf(NPM_RUN_SEGMENT_TOKEN);
    if (runTokenIndex < 0) {
      continue;
    }

    const prefixSection = commandSegment.slice(0, runTokenIndex).trim();
    const prefixCandidate = parsePrefixSection(prefixSection);
    if (prefixCandidate === null) {
      continue;
    }

    const prefixPath = stripWrappingQuotes(prefixCandidate).trim();
    if (prefixPath.length > 0) {
      prefixPaths.push(prefixPath);
    }
  }

  return prefixPaths;
}

/**
 * Parses the optional npm --prefix segment that appears before `run`.
 *
 * @param {string} prefixSection - Segment between `npm` and `run`.
 * @returns {string | null} Parsed prefix path or `null` when absent/invalid.
 */
function parsePrefixSection(prefixSection: string): string | null {
  if (prefixSection.startsWith(PREFIX_EQUALS_TOKEN)) {
    return prefixSection.slice(PREFIX_EQUALS_TOKEN.length);
  }

  if (!prefixSection.startsWith(PREFIX_SPACE_TOKEN)) {
    return null;
  }

  const prefixValue = prefixSection.slice(PREFIX_SPACE_TOKEN.length).trim();
  if (prefixValue.length === 0) {
    return null;
  }

  const separatorIndex = prefixValue.indexOf(' ');
  if (separatorIndex < 0) {
    return prefixValue;
  }

  return prefixValue.slice(0, separatorIndex);
}

/**
 * Removes a single pair of wrapping quote characters when present.
 *
 * @param {string} value - Candidate string value.
 * @returns {string} Unquoted string when wrapped with matching quotes.
 */
function stripWrappingQuotes(value: string): string {
  if (value.length < MIN_WRAPPED_VALUE_LENGTH) {
    return value;
  }

  let wrappingQuote: string | null = null;

  if (value.startsWith('"') && value.endsWith('"')) {
    wrappingQuote = '"';
  } else if (value.startsWith("'") && value.endsWith("'")) {
    wrappingQuote = "'";
  }

  if (wrappingQuote !== null) {
    return value.slice(wrappingQuote.length, value.length - wrappingQuote.length);
  }

  return value;
}

/**
 * Reads the scripts map from a package.json file when it exists.
 *
 * @param {string} repoRoot - Absolute repository root.
 * @param {string} directory - Repo-relative package directory.
 * @returns {Promise<Record<string, string> | null>} Script map or `null` when no package.json exists.
 */
async function readPackageJsonScripts(
  repoRoot: string,
  directory: string
): Promise<Record<string, string> | null> {
  const packageJsonPath = path.resolve(repoRoot, directory, 'package.json');

  try {
    const packageJsonText = await fs.readFile(packageJsonPath, 'utf8');
    const parsedPackageJson = JSON.parse(packageJsonText) as {
      scripts?: Record<string, string>;
    };

    return parsedPackageJson.scripts ?? {};
  } catch (error) {
    if (isErrnoExceptionWithCode(error, 'ENOENT')) {
      return null;
    }

    throw error;
  }
}

/**
 * Narrows unknown values to object records for config inspection.
 *
 * @param {unknown} value - Candidate value.
 * @returns {value is Record<string, unknown>} Type guard for plain records.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await main();
}
