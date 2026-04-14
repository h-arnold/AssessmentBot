import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import type { BuilderPaths } from '../types.js';

const execFileAsync = promisify(execFile);
const APPS_SCRIPT_JSON = 'appsscript.json';

type BuilderPathOverrides = Partial<BuilderPaths>;
type BuilderRootPaths = Pick<
  BuilderPaths,
  'repoRoot' | 'builderRoot' | 'configPath' | 'frontendDir' | 'backendDir'
>;
type BuilderBuildPaths = Pick<
  BuilderPaths,
  'buildDir' | 'buildFrontendDir' | 'buildWorkDir' | 'buildGasDir' | 'buildGasUiDir'
>;
type BuilderFixturePaths = Pick<
  BuilderPaths,
  | 'backendManifestPath'
  | 'jsonDbAppPinnedSnapshotDir'
  | 'jsonDbAppManifestPath'
  | 'jsonDbAppSourceFiles'
  | 'jsonDbAppPublicExports'
>;

/**
 * Creates a unique temporary directory for a test case.
 *
 * @param {string} prefix - Prefix used for the temporary directory name.
 * @returns {Promise<string>} Path to the created temporary directory.
 */
export async function createTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

/**
 * Resolves the root-level builder paths for a test fixture.
 *
 * @param {string} rootDir - Root temporary directory for the fixture.
 * @param {BuilderPathOverrides} overrides - Optional path overrides.
 * @returns {BuilderRootPaths} Resolved root-level builder paths.
 */
function resolveRootPaths(rootDir: string, overrides: BuilderPathOverrides): BuilderRootPaths {
  const repoRoot = overrides.repoRoot ?? rootDir;
  const builderRoot = overrides.builderRoot ?? path.join(repoRoot, 'scripts', 'builder');

  return {
    repoRoot,
    builderRoot,
    configPath: overrides.configPath ?? path.join(builderRoot, 'builder.config.json'),
    frontendDir: overrides.frontendDir ?? path.join(repoRoot, 'src', 'frontend'),
    backendDir: overrides.backendDir ?? path.join(repoRoot, 'src', 'backend'),
  };
}

/**
 * Resolves build-output directories for a test fixture.
 *
 * @param {string} repoRoot - Repository root directory for the fixture.
 * @param {BuilderPathOverrides} overrides - Optional path overrides.
 * @returns {BuilderBuildPaths} Resolved build-output paths.
 */
function resolveBuildPaths(
  repoRoot: string,
  overrides: BuilderPathOverrides,
): BuilderBuildPaths {
  const buildDir = overrides.buildDir ?? path.join(repoRoot, 'build');
  const buildGasDir = overrides.buildGasDir ?? path.join(buildDir, 'gas');

  return {
    buildDir,
    buildFrontendDir: overrides.buildFrontendDir ?? path.join(buildDir, 'frontend'),
    buildWorkDir: overrides.buildWorkDir ?? path.join(buildDir, 'work'),
    buildGasDir,
    buildGasUiDir: overrides.buildGasUiDir ?? path.join(buildGasDir, 'UI'),
  };
}

/**
 * Resolves manifest and JsonDb-specific paths for a test fixture.
 *
 * @param {string} repoRoot - Repository root directory for the fixture.
 * @param {string} backendDir - Backend source directory for the fixture.
 * @param {BuilderPathOverrides} overrides - Optional path overrides.
 * @returns {BuilderFixturePaths} Resolved manifest and JsonDb fixture paths.
 */
function resolveFixturePaths(
  repoRoot: string,
  backendDir: string,
  overrides: BuilderPathOverrides,
): BuilderFixturePaths {
  const jsonDbAppPinnedSnapshotDir =
    overrides.jsonDbAppPinnedSnapshotDir ?? path.join(repoRoot, 'vendor', 'jsondbapp');

  return {
    backendManifestPath:
      overrides.backendManifestPath ?? path.join(backendDir, APPS_SCRIPT_JSON),
    jsonDbAppPinnedSnapshotDir,
    jsonDbAppManifestPath:
      overrides.jsonDbAppManifestPath ?? path.join(jsonDbAppPinnedSnapshotDir, APPS_SCRIPT_JSON),
    jsonDbAppSourceFiles: overrides.jsonDbAppSourceFiles ?? [],
    jsonDbAppPublicExports:
      overrides.jsonDbAppPublicExports ?? ['loadDatabase', 'createAndInitialiseDatabase'],
  };
}

/**
 * Builds a complete `BuilderPaths` object rooted at a temporary directory.
 *
 * @param {string} rootDir - Root temporary directory for the test fixture.
 * @param {BuilderPathOverrides} overrides - Optional path and config overrides.
 * @returns {BuilderPaths} Fully resolved builder path values.
 */
export function createBuilderPaths(
  rootDir: string,
  overrides: BuilderPathOverrides = {},
): BuilderPaths {
  return {
    ...resolveRootPaths(rootDir, overrides),
    ...resolveBuildPaths(overrides.repoRoot ?? rootDir, overrides),
    ...resolveFixturePaths(
      overrides.repoRoot ?? rootDir,
      overrides.backendDir ?? path.join(overrides.repoRoot ?? rootDir, 'src', 'backend'),
      overrides,
    ),
  };
}

/**
 * Creates a tar.gz release fixture and returns its bytes for mocked download tests.
 *
 * @param {string} tempRoot - Temporary root directory for fixture files.
 * @param {(releaseFixtureRoot: string) => Promise<void>} setup - Fixture setup callback.
 * @returns {Promise<Uint8Array>} Archive bytes for use in mocked fetch responses.
 */
export async function createReleaseArchive(
  tempRoot: string,
  setup: (releaseFixtureRoot: string) => Promise<void>,
): Promise<Uint8Array> {
  const releaseFixtureDir = path.join(tempRoot, 'release-fixture');
  const releaseFixtureRoot = path.join(releaseFixtureDir, 'JsonDbApp-0.1.1');
  const archivePath = path.join(tempRoot, 'jsondbapp-release.tar.gz');

  await fs.mkdir(releaseFixtureRoot, { recursive: true });
  await setup(releaseFixtureRoot);
  await execFileAsync('tar', ['-czf', archivePath, '-C', releaseFixtureDir, 'JsonDbApp-0.1.1']);

  return fs.readFile(archivePath);
}

/**
 * Writes a minimal JsonDb release manifest fixture.
 *
 * @param {string} releaseFixtureRoot - Root fixture directory containing release files.
 * @returns {Promise<void>} Resolves once the manifest is written.
 */
export async function writeReleaseManifest(releaseFixtureRoot: string): Promise<void> {
  await fs.writeFile(path.join(releaseFixtureRoot, APPS_SCRIPT_JSON), '{"oauthScopes":[]}', 'utf-8');
}

/**
 * Writes a release source file fixture, creating parent directories as needed.
 *
 * @param {string} releaseFixtureRoot - Root fixture directory containing release files.
 * @param {string} relativeFilePath - File path relative to the release root.
 * @param {string} content - File content.
 * @returns {Promise<void>} Resolves once the file is written.
 */
export async function writeReleaseFile(
  releaseFixtureRoot: string,
  relativeFilePath: string,
  content: string,
): Promise<void> {
  const absoluteFilePath = path.join(releaseFixtureRoot, relativeFilePath);
  await fs.mkdir(path.dirname(absoluteFilePath), { recursive: true });
  await fs.writeFile(absoluteFilePath, content, 'utf-8');
}
