import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

import { BuildStageError } from './lib/errors.js';
import type { BuilderConfig, BuilderPaths } from './types.js';

const CONFIG_FILENAME = 'builder.config.json';

const getBuilderRoot = (): string => {
  const currentFile = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(currentFile), '..');
};

const getRepoRoot = (builderRoot: string): string =>
  path.resolve(builderRoot, '..', '..');

const parseConfig = (configPath: string, raw: string): BuilderConfig => {
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
};

export const resolveBuildDir = (repoRoot: string, buildDirInput: string): string => {
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
};

const resolveSourceDir = (repoRoot: string, dirInput: string, label: string): string => {
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
};

export const loadBuilderConfig = async (configPath: string): Promise<BuilderConfig> => {
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
};

type ResolveBuilderPathsOptions = {
  builderRoot?: string;
  repoRoot?: string;
  configPath?: string;
};

export const resolveBuilderPaths = async (
  options: ResolveBuilderPathsOptions = {},
): Promise<BuilderPaths> => {
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
};
