import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

import { BuildStageError } from './lib/errors.js';
import type { BuilderConfig, BuilderPaths } from './types.js';

const CONFIG_FILENAME = 'builder.config.json';

/**
 * Resolves the absolute path to the builder module root.
 *
 * @return {string} Absolute builder root directory path.
 */
function getBuilderRoot(): string {
  const currentFile = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(currentFile), '..');
}

/**
 * Resolves the repository root from the builder root.
 *
 * @param {string} builderRoot - Absolute builder root path.
 * @return {string} Absolute repository root directory path.
 */
function getRepoRoot(builderRoot: string): string {
  return path.resolve(builderRoot, '..', '..');
}

/**
 * Parses and validates raw builder configuration JSON.
 *
 * @param {string} configPath - Path to the configuration file for error context.
 * @param {string} raw - Raw JSON string loaded from disk.
 * @return {BuilderConfig} Validated builder configuration object.
 */
function parseConfig(configPath: string, raw: string): BuilderConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new BuildStageError(
      'preflight-clean',
      `Builder config is not valid JSON: ${configPath}`,
      err,
    );
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new BuildStageError('preflight-clean', `Builder config is invalid: ${configPath}`);
  }

  const config = parsed as Partial<BuilderConfig>;
  const missing = ['frontendDir', 'backendDir', 'buildDir'].filter(
    (key) => typeof config[key as keyof BuilderConfig] !== 'string',
  );
  if (missing.length > 0) {
    throw new BuildStageError(
      'preflight-clean',
      `Builder config is missing required fields: ${missing.join(', ')}`,
    );
  }

  return config as BuilderConfig;
}

/**
 * Resolves and validates the configured build output directory.
 *
 * @param {string} repoRoot - Absolute repository root path.
 * @param {string} buildDirInput - Configured build directory path.
 * @return {string} Absolute build directory path inside the repository.
 */
export function resolveBuildDir(repoRoot: string, buildDirInput: string): string {
  if (!buildDirInput || buildDirInput.trim().length === 0) {
    throw new BuildStageError(
      'preflight-clean',
      'Builder config buildDir must be a non-empty path.',
    );
  }

  const resolvedBuildDir = path.resolve(repoRoot, buildDirInput);
  const relativePath = path.relative(repoRoot, resolvedBuildDir);

  if (relativePath === '' || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new BuildStageError(
      'preflight-clean',
      `Builder config buildDir must resolve inside repo root: ${buildDirInput}`,
    );
  }

  return resolvedBuildDir;
}

/**
 * Resolves and validates a configured source directory path.
 *
 * @param {string} repoRoot - Absolute repository root path.
 * @param {string} dirInput - Configured source directory path.
 * @param {string} label - Config field name for error context.
 * @return {string} Absolute source directory path inside the repository.
 */
function resolveSourceDir(repoRoot: string, dirInput: string, label: string): string {
  if (!dirInput || dirInput.trim().length === 0) {
    throw new BuildStageError(
      'preflight-clean',
      `Builder config ${label} must be a non-empty path.`,
    );
  }

  const resolvedDir = path.resolve(repoRoot, dirInput);
  const relativePath = path.relative(repoRoot, resolvedDir);

  if (relativePath === '' || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new BuildStageError(
      'preflight-clean',
      `Builder config ${label} must resolve inside repo root: ${dirInput}`,
    );
  }

  return resolvedDir;
}

/**
 * Loads and validates the builder configuration file.
 *
 * @param {string} configPath - Absolute path to `builder.config.json`.
 * @return {Promise<BuilderConfig>} Parsed and validated builder configuration.
 */
export async function loadBuilderConfig(configPath: string): Promise<BuilderConfig> {
  try {
    const raw = await readFile(configPath, 'utf-8');
    return parseConfig(configPath, raw);
  } catch (err) {
    if (err instanceof BuildStageError) {
      throw err;
    }
    throw new BuildStageError(
      'preflight-clean',
      `Builder config could not be read: ${configPath}`,
      err,
    );
  }
}

type ResolveBuilderPathsOptions = {
  builderRoot?: string;
  repoRoot?: string;
  configPath?: string;
};

/**
 * Resolves all required absolute paths for the builder pipeline.
 *
 * @param {ResolveBuilderPathsOptions} options - Optional root and config path overrides.
 * @return {Promise<BuilderPaths>} Fully resolved and validated builder paths.
 */
export async function resolveBuilderPaths(
  options: ResolveBuilderPathsOptions = {},
): Promise<BuilderPaths> {
  const builderRoot = options.builderRoot ?? getBuilderRoot();
  const repoRoot = options.repoRoot ?? getRepoRoot(builderRoot);
  const configPath = options.configPath ?? path.join(builderRoot, CONFIG_FILENAME);
  const config = await loadBuilderConfig(configPath);

  const frontendDir = resolveSourceDir(repoRoot, config.frontendDir, 'frontendDir');
  const backendDir = resolveSourceDir(repoRoot, config.backendDir, 'backendDir');
  const buildDir = resolveBuildDir(repoRoot, config.buildDir);
  const buildFrontendDir = path.join(buildDir, 'frontend');
  const buildWorkDir = path.join(buildDir, 'work');
  const buildGasDir = path.join(buildDir, 'gas');
  const buildGasUiDir = path.join(buildGasDir, 'UI');

  return {
    repoRoot,
    builderRoot,
    configPath,
    frontendDir,
    backendDir,
    buildDir,
    buildFrontendDir,
    buildWorkDir,
    buildGasDir,
    buildGasUiDir,
  };
}
