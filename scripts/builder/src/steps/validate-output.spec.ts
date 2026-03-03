import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { BuilderPaths } from '../types.js';
import { BuildStageError } from '../lib/errors.js';
import {
  findDuplicateProtectedGlobals,
  runValidateOutput,
  scanFileTopLevelDeclarations,
  validateForbiddenFrontendReferences,
  validateManifestSanity,
} from './validate-output.js';

/**
 * Creates a unique temporary root for tests.
 *
 * @return {Promise<string>} Temporary directory path.
 */
async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'validate-output-'));
}

/**
 * Creates a complete builder paths object for tests.
 *
 * @param {string} rootDir - Temporary repository root.
 * @return {BuilderPaths} Fully resolved test paths.
 */
function createBuilderPaths(rootDir: string): BuilderPaths {
  const buildDir = path.join(rootDir, 'build');
  const buildGasDir = path.join(buildDir, 'gas');

  return {
    repoRoot: rootDir,
    builderRoot: path.join(rootDir, 'scripts', 'builder'),
    configPath: path.join(rootDir, 'scripts', 'builder', 'builder.config.json'),
    frontendDir: path.join(rootDir, 'src', 'frontend'),
    backendDir: path.join(rootDir, 'src', 'backend'),
    buildDir,
    buildFrontendDir: path.join(buildDir, 'frontend'),
    buildWorkDir: path.join(buildDir, 'work'),
    buildGasDir,
    buildGasUiDir: path.join(buildGasDir, 'UI'),
    backendManifestPath: path.join(rootDir, 'src', 'backend', 'appsscript.json'),
    jsonDbAppPinnedSnapshotDir: path.join(rootDir, 'vendor', 'jsondbapp'),
    jsonDbAppManifestPath: path.join(rootDir, 'vendor', 'jsondbapp', 'appsscript.json'),
    jsonDbAppSourceFiles: ['src/01-core.js'],
    jsonDbAppPublicExports: ['loadDatabase'],
  };
}

/**
 * Writes minimum valid final GAS artefacts for validation tests.
 *
 * @param {BuilderPaths} paths - Builder paths for output.
 * @return {Promise<void>} Resolves once fixture files are written.
 */
async function writeValidGasArtefacts(paths: BuilderPaths): Promise<void> {
  await fs.mkdir(paths.buildGasUiDir, { recursive: true });
  await fs.writeFile(
    path.join(paths.buildGasDir, 'appsscript.json'),
    JSON.stringify({
      oauthScopes: ['https://www.googleapis.com/auth/script.scriptapp'],
      dependencies: {
        enabledAdvancedServices: [{ userSymbol: 'Drive', serviceId: 'drive', version: 'v3' }],
      },
    }),
    'utf-8',
  );
  await fs.writeFile(path.join(paths.buildGasDir, 'JsonDbApp.inlined.js'), 'const JsonDbAppNS = {};', 'utf-8');
  await fs.writeFile(path.join(paths.buildGasUiDir, 'ReactApp.html'), '<div id="root"></div>', 'utf-8');
  await fs.writeFile(path.join(paths.buildGasDir, 'Utils', 'Validate.js'), 'class Validate {}', 'utf-8');
}

describe('validateManifestSanity', () => {
  it('rejects invalid manifest JSON', () => {
    expect(() => validateManifestSanity('{invalid json')).toThrow(BuildStageError);
  });

  it('rejects duplicated oauth scopes', () => {
    expect(() =>
      validateManifestSanity(
        JSON.stringify({
          oauthScopes: ['scope.a', 'scope.a'],
        }),
      ),
    ).toThrow(BuildStageError);
  });

  it('rejects duplicated enabled advanced services by serviceId', () => {
    expect(() =>
      validateManifestSanity(
        JSON.stringify({
          oauthScopes: ['scope.a'],
          dependencies: {
            enabledAdvancedServices: [
              { userSymbol: 'Drive', serviceId: 'drive', version: 'v3' },
              { userSymbol: 'DriveAlias', serviceId: 'drive', version: 'v3' },
            ],
          },
        }),
      ),
    ).toThrow(BuildStageError);
  });
});

describe('validateForbiddenFrontendReferences', () => {
  it('rejects forbidden external asset references', () => {
    expect(() =>
      validateForbiddenFrontendReferences('<script src="https://cdn.example.com/app.js"></script>'),
    ).toThrow(BuildStageError);
  });

  it('rejects /assets local references', () => {
    expect(() =>
      validateForbiddenFrontendReferences('<script src="/assets/index-123.js"></script>'),
    ).toThrow(BuildStageError);
  });

  it('rejects ./assets local references', () => {
    expect(() =>
      validateForbiddenFrontendReferences('<script src="./assets/index-123.js"></script>'),
    ).toThrow(BuildStageError);
  });

  it('rejects assets/ local references', () => {
    expect(() =>
      validateForbiddenFrontendReferences('<script src="assets/index-123.js"></script>'),
    ).toThrow(BuildStageError);
  });
});

describe('findDuplicateProtectedGlobals', () => {
  it('flags duplicate protected symbols', () => {
    const duplicates = findDuplicateProtectedGlobals({
      'a.js': 'class Validate {}',
      'b.js': 'function Validate() {}',
      'JsonDbApp.inlined.js': 'const JsonDbApp = {};',
    });

    expect(duplicates).toEqual({
      Validate: ['a.js', 'b.js'],
    });
  });
});

describe('scanFileTopLevelDeclarations', () => {
  it('ignores declarations nested inside top-level wrappers', () => {
    const declarations = scanFileTopLevelDeclarations(`
const JsonDbApp = (function () {
  class Validate {}
  function hiddenHelper() {}
  return {};
})();
`);

    expect(declarations).toEqual(['JsonDbApp']);
  });

  it('ignores braces in comments, strings and template literal text', () => {
    const declarations = scanFileTopLevelDeclarations(`
const text = "{";
const template = ` + "`value {still text}`" + `;
// function Validate() { }
/*
class Validate {}
*/
class Validate {}
`);

    expect(declarations).toEqual(['text', 'template', 'Validate']);
  });
});

describe('runValidateOutput', () => {
  let tempRoot: string;
  let paths: BuilderPaths;

  beforeEach(async () => {
    tempRoot = await createTempDir();
    paths = createBuilderPaths(tempRoot);
    await fs.mkdir(path.join(paths.buildGasDir, 'Utils'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it('returns concise validation metadata for valid output', async () => {
    await writeValidGasArtefacts(paths);

    const result = await runValidateOutput(paths);

    const expectedRequiredFileCount = 3;
    const expectedGasFileCount = 4;

    expect(result.stage).toBe('validate-output');
    expect(result.outputPath).toBe(paths.buildGasDir);
    expect(result.requiredFileCount).toBe(expectedRequiredFileCount);
    expect(result.gasFileCount).toBe(expectedGasFileCount);
    expect(result.duplicateProtectedGlobalCount).toBe(0);
    expect(Object.keys(result.artefactSizes)).toEqual([
      'appsscript.json',
      'JsonDbApp.inlined.js',
      'UI/ReactApp.html',
    ]);
    expect(Object.keys(result.artefactChecksums)).toEqual([
      'appsscript.json',
      'JsonDbApp.inlined.js',
      'UI/ReactApp.html',
    ]);
    expect(result.artefactChecksums['appsscript.json']).toMatch(/^[a-f0-9]{64}$/);
    expect(result.artefactChecksums['JsonDbApp.inlined.js']).toMatch(/^[a-f0-9]{64}$/);
    expect(result.artefactChecksums['UI/ReactApp.html']).toMatch(/^[a-f0-9]{64}$/);
  });

  it('returns stable checksums for unchanged outputs across runs', async () => {
    await writeValidGasArtefacts(paths);

    const first = await runValidateOutput(paths);
    const second = await runValidateOutput(paths);

    expect(second.artefactChecksums).toEqual(first.artefactChecksums);
  });

  it('fails with actionable error on duplicate protected globals', async () => {
    await writeValidGasArtefacts(paths);
    await fs.writeFile(path.join(paths.buildGasDir, 'DuplicateValidate.js'), 'function Validate() {}', 'utf-8');

    await expect(runValidateOutput(paths)).rejects.toBeInstanceOf(BuildStageError);
    await expect(runValidateOutput(paths)).rejects.toMatchObject({
      stage: 'validate-output',
    });
  });

  it('wraps missing build/gas output failures with validate-output stage context', async () => {
    await fs.rm(paths.buildGasDir, { recursive: true, force: true });

    await expect(runValidateOutput(paths)).rejects.toBeInstanceOf(BuildStageError);
    await expect(runValidateOutput(paths)).rejects.toMatchObject({
      stage: 'validate-output',
    });
  });

  it('wraps unreadable file failures with validate-output stage context', async () => {
    await writeValidGasArtefacts(paths);
    const manifestPath = path.join(paths.buildGasDir, 'appsscript.json');
    await fs.rm(manifestPath);
    await fs.mkdir(manifestPath);

    await expect(runValidateOutput(paths)).rejects.toBeInstanceOf(BuildStageError);
    await expect(runValidateOutput(paths)).rejects.toMatchObject({
      stage: 'validate-output',
    });
  });
});
