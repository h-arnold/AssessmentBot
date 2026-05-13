import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { pathToFileURL } from 'node:url';

import { loadDefaultRegressionCheckerConfig, runRegressionCheckerCli } from './cli/index.js';
import { runCommand } from '../lib/process.js';

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

  for (const directory of getCandidateDirectories(options.rawConfig)) {
    const scripts = await readPackageJsonScripts(options.repoRoot, directory);
    if (scripts !== null) {
      scriptEntries.push([directory, scripts]);
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
 * @returns {boolean} `true` when the path is safely repo-relative for package.json lookup.
 */
function normaliseSafePackageDirectory(cwd: string): string | null {
  const trimmed = cwd.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const normalised = trimmed.replaceAll('\\', '/');
  if (hasForbiddenPathPrefix(normalised)) {
    return null;
  }

  const canonicalSegments = normaliseRelativeSegments(normalised.split('/'));
  if (canonicalSegments === null) {
    return null;
  }

  return canonicalSegments.length === 0 ? '.' : canonicalSegments.join('/');
}

/**
 * Detects absolute-path prefixes that are unsafe for repo-relative lookup.
 *
 * @param {string} normalisedPath - Separator-normalised path candidate.
 * @returns {boolean} `true` when the path is absolute or UNC-style.
 */
function hasForbiddenPathPrefix(normalisedPath: string): boolean {
  return (
    normalisedPath.startsWith('/') ||
    normalisedPath.startsWith('//') ||
    /^[A-Za-z]:\//u.test(normalisedPath)
  );
}

/**
 * Determines whether path segments attempt to traverse above repo root.
 *
 * @param {string[]} segments - Path segments.
 * @returns {boolean} `true` when traversal escapes root.
 */
function normaliseRelativeSegments(segments: string[]): string[] | null {
  const canonicalSegments: string[] = [];
  for (const segment of segments) {
    if (segment === '' || segment === '.') {
      continue;
    }

    if (segment === '..') {
      if (canonicalSegments.length === 0) {
        return null;
      }

      canonicalSegments.pop();
      continue;
    }

    canonicalSegments.push(segment);
  }

  return canonicalSegments;
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
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
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
