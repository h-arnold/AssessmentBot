import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

import type { BuilderPaths } from '../types.js';

const execFileAsync = promisify(execFile);
const APPS_SCRIPT_JSON = 'appsscript.json';

/**
 * Builds a complete `BuilderPaths` object rooted at a temporary directory.
 *
 * @param {string} rootDir - Root temporary directory for the test fixture.
 * @return {BuilderPaths} Fully resolved builder path values.
 */
export function createBuilderPaths(rootDir: string): BuilderPaths {
  return {
    repoRoot: rootDir,
    builderRoot: path.join(rootDir, 'scripts', 'builder'),
    configPath: path.join(rootDir, 'scripts', 'builder', 'builder.config.json'),
    frontendDir: path.join(rootDir, 'src', 'frontend'),
    backendDir: path.join(rootDir, 'src', 'backend'),
    buildDir: path.join(rootDir, 'build'),
    buildFrontendDir: path.join(rootDir, 'build', 'frontend'),
    buildWorkDir: path.join(rootDir, 'build', 'work'),
    buildGasDir: path.join(rootDir, 'build', 'gas'),
    buildGasUiDir: path.join(rootDir, 'build', 'gas', 'UI'),
    backendManifestPath: path.join(rootDir, 'src', 'backend', APPS_SCRIPT_JSON),
    jsonDbAppPinnedSnapshotDir: path.join(rootDir, 'vendor', 'jsondbapp'),
    jsonDbAppManifestPath: path.join(rootDir, 'vendor', 'jsondbapp', APPS_SCRIPT_JSON),
    jsonDbAppSourceFiles: [],
    jsonDbAppPublicExports: ['loadDatabase', 'createAndInitialiseDatabase'],
  };
}

/**
 * Creates a tar.gz release fixture and returns its bytes for mocked download tests.
 *
 * @param {string} tempRoot - Temporary root directory for fixture files.
 * @param {(releaseFixtureRoot: string) => Promise<void>} setup - Fixture setup callback.
 * @return {Promise<Uint8Array>} Archive bytes for use in mocked fetch responses.
 */
export async function createReleaseArchive(
  tempRoot: string,
  setup: (releaseFixtureRoot: string) => Promise<void>,
): Promise<Uint8Array> {
  const releaseFixtureDir = path.join(tempRoot, 'release-fixture');
  const releaseFixtureRoot = path.join(releaseFixtureDir, 'JsonDbApp-0.1.0');
  const archivePath = path.join(tempRoot, 'jsondbapp-release.tar.gz');

  await fs.mkdir(releaseFixtureRoot, { recursive: true });
  await setup(releaseFixtureRoot);
  await execFileAsync('tar', ['-czf', archivePath, '-C', releaseFixtureDir, 'JsonDbApp-0.1.0']);

  return fs.readFile(archivePath);
}

/**
 * Writes a minimal JsonDb release manifest fixture.
 *
 * @param {string} releaseFixtureRoot - Root fixture directory containing release files.
 * @return {Promise<void>} Resolves once the manifest is written.
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
 * @return {Promise<void>} Resolves once the file is written.
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
