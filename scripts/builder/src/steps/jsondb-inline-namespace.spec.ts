import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { BuilderPaths } from '../types.js';
import {
  generateJsonDbNamespaceWrapper,
  resolvePublicExports,
  runJsonDbInlineNamespace,
  scanTopLevelDeclarations,
} from './jsondb-inline-namespace.js';

const LOAD_DATABASE_EXPORT = 'loadDatabase,';

/**
 * Creates a unique temporary directory for a test case.
 *
 * @returns {Promise<string>} Path to the created temporary directory.
 */
async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'jsondb-inline-namespace-'));
}

/**
 * Builds a complete `BuilderPaths` object rooted at a temporary directory.
 *
 * @param {string} rootDir - Root temporary directory for the test fixture.
 * @returns {BuilderPaths} Fully resolved builder path values.
 */
function createBuilderPaths(rootDir: string): BuilderPaths {
  const repoRoot = rootDir;
  const buildDir = path.join(repoRoot, 'build');
  const buildGasDir = path.join(buildDir, 'gas');

  return {
    repoRoot,
    builderRoot: path.join(repoRoot, 'scripts', 'builder'),
    configPath: path.join(repoRoot, 'scripts', 'builder', 'builder.config.json'),
    frontendDir: path.join(repoRoot, 'src', 'frontend'),
    backendDir: path.join(repoRoot, 'src', 'backend'),
    buildDir,
    buildFrontendDir: path.join(buildDir, 'frontend'),
    buildWorkDir: path.join(buildDir, 'work'),
    buildGasDir,
    buildGasUiDir: path.join(buildGasDir, 'UI'),
    backendManifestPath: path.join(repoRoot, 'src', 'backend', 'appsscript.json'),
    jsonDbAppPinnedSnapshotDir: path.join(repoRoot, 'vendor', 'jsondbapp'),
    jsonDbAppManifestPath: path.join(repoRoot, 'vendor', 'jsondbapp', 'appsscript.json'),
    jsonDbAppSourceFiles: ['src/01-core.js', 'src/02-database.js'],
    jsonDbAppPublicExports: ['loadDatabase', 'createAndInitialiseDatabase'],
  };
}

describe('generateJsonDbNamespaceWrapper', () => {
  it('outputs the expected namespace declaration wrapper', () => {
    const output = generateJsonDbNamespaceWrapper(['function loadDatabase() {}'], ['loadDatabase']);

    expect(output).toContain('const JsonDbApp = (function () {');
    expect(output).toContain('return {');
    expect(output).toContain(LOAD_DATABASE_EXPORT);
  });

  it('exports only configured public names', () => {
    const output = generateJsonDbNamespaceWrapper(
      ['function loadDatabase() {}\nfunction hiddenInternal() {}'],
      ['loadDatabase'],
    );

    expect(output).toContain(LOAD_DATABASE_EXPORT);
    expect(output).not.toContain('hiddenInternal,');
  });
});

describe('resolvePublicExports', () => {
  it('de-duplicates configured names while preserving order', () => {
    expect(resolvePublicExports(['loadDatabase', 'loadDatabase', 'createAndInitialiseDatabase'])).toEqual([
      'loadDatabase',
      'createAndInitialiseDatabase',
    ]);
  });
});

describe('runJsonDbInlineNamespace', () => {
  let tempRoot: string;
  let paths: BuilderPaths;

  beforeEach(async () => {
    tempRoot = await createTempDir();
    paths = createBuilderPaths(tempRoot);

    await fs.mkdir(path.join(paths.jsonDbAppPinnedSnapshotDir, 'src'), { recursive: true });
    await fs.mkdir(paths.buildGasDir, { recursive: true });

    await fs.writeFile(
      path.join(paths.jsonDbAppPinnedSnapshotDir, 'src', '01-core.js'),
      'function Validate() {}\nfunction loadDatabase() {}\n',
      'utf-8',
    );
    await fs.writeFile(
      path.join(paths.jsonDbAppPinnedSnapshotDir, 'src', '02-database.js'),
      'function createAndInitialiseDatabase() {}\nfunction JsonDbInternal() {}\n',
      'utf-8',
    );
  });

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it('writes JsonDbApp.inlined.js and restricts exported API list', async () => {
    const result = await runJsonDbInlineNamespace(paths);
    const output = await fs.readFile(result.outputPath, 'utf-8');

    expect(result.stage).toBe('jsondb-inline-namespace');
    expect(result.namespaceSymbol).toBe('JsonDbApp');
    expect(result.exportedApi).toEqual(['loadDatabase', 'createAndInitialiseDatabase']);
    expect(result.outputPath).toBe(path.join(paths.buildGasDir, 'JsonDbApp.inlined.js'));

    expect(output).toContain('const JsonDbApp = (function () {');
    expect(output).toContain('loadDatabase,');
    expect(output).toContain('createAndInitialiseDatabase,');
    expect(output).not.toContain('JsonDbInternal,');
    expect(output).not.toContain('Validate,');
  });

  it('fails when configured exports are not declared in source', async () => {
    paths.jsonDbAppPublicExports = ['loadDatabase', 'missingExport'];

    await expect(runJsonDbInlineNamespace(paths)).rejects.toThrow(
      'JsonDbApp public exports are missing declarations: missingExport',
    );
  });

  it('fails when source files contain placeholder snapshot implementations', async () => {
    await fs.writeFile(
      path.join(paths.jsonDbAppPinnedSnapshotDir, 'src', '01-core.js'),
      "function loadDatabase() { throw new Error('JsonDbApp snapshot placeholder'); }",
      'utf-8',
    );

    await expect(runJsonDbInlineNamespace(paths)).rejects.toThrow(
      'Pinned JsonDbApp snapshot contains placeholder implementations and cannot be bundled.',
    );
  });

  it('keeps JsonDb internals isolated from global declarations scan', async () => {
    const result = await runJsonDbInlineNamespace(paths);
    const output = await fs.readFile(result.outputPath, 'utf-8');

    const declarations = scanTopLevelDeclarations(output);

    expect(declarations).toEqual(['JsonDbApp']);
    expect(declarations).not.toContain('Validate');
    expect(declarations).not.toContain('JsonDbInternal');
    expect(declarations).not.toContain('loadDatabase');
    expect(declarations).not.toContain('createAndInitialiseDatabase');
  });
});
