import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import type { BuilderPaths } from '../types.js';
import { BuildStageError } from '../lib/errors.js';
import { createBuilderPaths, createTempDir } from '../test/builder-fixture-test-helpers.js';
import {
  findDuplicateProtectedGlobals,
  runValidateOutput,
  scanFileTopLevelDeclarations,
  validateForbiddenFrontendReferences,
  validateManifestSanity,
} from './validate-output.js';

const APPS_SCRIPT_JSON = 'appsscript.json';
const JSONDB_INLINED = 'JsonDbApp.inlined.js';
const REACT_APP_HTML = 'UI/ReactApp.html';
const VALIDATE_OUTPUT_STAGE = 'validate-output';
const REQUIRED_FILE_COUNT = 3;
const VALID_GAS_FILE_COUNT = 4;

/**
 * Writes minimum valid final GAS artefacts for validation tests.
 *
 * @param {BuilderPaths} paths - Builder paths for output.
 * @returns {Promise<void>} Resolves once fixture files are written.
 */
async function writeValidGasArtefacts(paths: BuilderPaths): Promise<void> {
  await fs.mkdir(paths.buildGasUiDir, { recursive: true });
  await fs.writeFile(
    path.join(paths.buildGasDir, APPS_SCRIPT_JSON),
    JSON.stringify({
      oauthScopes: ['https://www.googleapis.com/auth/script.scriptapp'],
      dependencies: {
        enabledAdvancedServices: [{ userSymbol: 'Drive', serviceId: 'drive', version: 'v3' }],
      },
    }),
    'utf-8',
  );
  await fs.writeFile(path.join(paths.buildGasDir, JSONDB_INLINED), 'const JsonDbApp = {};', 'utf-8');
  await fs.writeFile(path.join(paths.buildGasUiDir, path.basename(REACT_APP_HTML)), '<div id="root"></div>', 'utf-8');
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
    tempRoot = await createTempDir('validate-output-');
    paths = createBuilderPaths(tempRoot, {
      jsonDbAppSourceFiles: ['src/01-core.js'],
      jsonDbAppPublicExports: ['loadDatabase'],
    });
    await fs.mkdir(path.join(paths.buildGasDir, 'Utils'), { recursive: true });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it('returns concise validation metadata for valid output', async () => {
    await writeValidGasArtefacts(paths);

    const result = await runValidateOutput(paths);

    const expectedRequiredFileCount = REQUIRED_FILE_COUNT;
    const expectedGasFileCount = VALID_GAS_FILE_COUNT;

    expect(result.stage).toBe(VALIDATE_OUTPUT_STAGE);
    expect(result.outputPath).toBe(paths.buildGasDir);
    expect(result.requiredFileCount).toBe(expectedRequiredFileCount);
    expect(result.gasFileCount).toBe(expectedGasFileCount);
    expect(result.duplicateProtectedGlobalCount).toBe(0);
    expect(Object.keys(result.artefactSizes)).toEqual([
      APPS_SCRIPT_JSON,
      JSONDB_INLINED,
      REACT_APP_HTML,
    ]);
    expect(Object.keys(result.artefactChecksums)).toEqual([
      APPS_SCRIPT_JSON,
      JSONDB_INLINED,
      REACT_APP_HTML,
    ]);
    expect(result.artefactChecksums[APPS_SCRIPT_JSON]).toMatch(/^[a-f0-9]{64}$/);
    expect(result.artefactChecksums[JSONDB_INLINED]).toMatch(/^[a-f0-9]{64}$/);
    expect(result.artefactChecksums[REACT_APP_HTML]).toMatch(/^[a-f0-9]{64}$/);
  });

  it('treats Windows-style required-file paths as normalised forward-slash output paths', async () => {
    await writeValidGasArtefacts(paths);

    const windowsRelativePaths = new Map<string, string>([
      [path.join(paths.buildGasDir, APPS_SCRIPT_JSON), APPS_SCRIPT_JSON],
      [path.join(paths.buildGasDir, JSONDB_INLINED), JSONDB_INLINED],
      [path.join(paths.buildGasUiDir, path.basename(REACT_APP_HTML)), String.raw`UI\ReactApp.html`],
      [path.join(paths.buildGasDir, 'Utils', 'Validate.js'), String.raw`Utils\Validate.js`],
    ]);

    vi.spyOn(path, 'relative').mockImplementation((_from, to) => {
      const relativePath = windowsRelativePaths.get(String(to));
      if (!relativePath) {
        throw new Error(`Unexpected relative-path input: ${String(to)}`);
      }
      return relativePath;
    });

    const result = await runValidateOutput(paths);

    expect(result.requiredFileCount).toBe(REQUIRED_FILE_COUNT);
    expect(result.gasFileCount).toBe(VALID_GAS_FILE_COUNT);
  });

  it('returns stable checksums for unchanged outputs across runs', async () => {
    await writeValidGasArtefacts(paths);

    const first = await runValidateOutput(paths);
    const second = await runValidateOutput(paths);

    expect(second.artefactChecksums).toEqual(first.artefactChecksums);
  });

  it('reports duplicate protected globals with forward-slash relative file paths', async () => {
    await writeValidGasArtefacts(paths);
    await fs.mkdir(path.join(paths.buildGasDir, 'Duplicate'), { recursive: true });
    await fs.writeFile(path.join(paths.buildGasDir, 'Duplicate', 'ValidateAgain.js'), 'function Validate() {}', 'utf-8');

    const windowsRelativePaths = new Map<string, string>([
      [path.join(paths.buildGasDir, APPS_SCRIPT_JSON), APPS_SCRIPT_JSON],
      [path.join(paths.buildGasDir, JSONDB_INLINED), JSONDB_INLINED],
      [path.join(paths.buildGasUiDir, path.basename(REACT_APP_HTML)), REACT_APP_HTML],
      [path.join(paths.buildGasDir, 'Utils', 'Validate.js'), String.raw`Utils\Validate.js`],
      [path.join(paths.buildGasDir, 'Duplicate', 'ValidateAgain.js'), String.raw`Duplicate\ValidateAgain.js`],
    ]);

    vi.spyOn(path, 'relative').mockImplementation((_from, to) => {
      const relativePath = windowsRelativePaths.get(String(to));
      if (!relativePath) {
        throw new Error(`Unexpected relative-path input: ${String(to)}`);
      }
      return relativePath;
    });

    const error = await runValidateOutput(paths).catch((caughtError: unknown) => caughtError);

    expect(error).toBeInstanceOf(BuildStageError);
    expect(error).toMatchObject({
      stage: VALIDATE_OUTPUT_STAGE,
    });
    expect((error as BuildStageError).message).toContain(
      'Validate: Duplicate/ValidateAgain.js, Utils/Validate.js',
    );
  });

  it('fails with actionable error on duplicate protected globals', async () => {
    await writeValidGasArtefacts(paths);
    await fs.writeFile(path.join(paths.buildGasDir, 'DuplicateValidate.js'), 'function Validate() {}', 'utf-8');

    await expect(runValidateOutput(paths)).rejects.toBeInstanceOf(BuildStageError);
    await expect(runValidateOutput(paths)).rejects.toMatchObject({
      stage: VALIDATE_OUTPUT_STAGE,
    });
  });

  it('wraps missing build/gas output failures with validate-output stage context', async () => {
    await fs.rm(paths.buildGasDir, { recursive: true, force: true });

    await expect(runValidateOutput(paths)).rejects.toBeInstanceOf(BuildStageError);
    await expect(runValidateOutput(paths)).rejects.toMatchObject({
      stage: VALIDATE_OUTPUT_STAGE,
    });
  });

  it('wraps unreadable file failures with validate-output stage context', async () => {
    await writeValidGasArtefacts(paths);
    const manifestPath = path.join(paths.buildGasDir, APPS_SCRIPT_JSON);
    await fs.rm(manifestPath);
    await fs.mkdir(manifestPath);

    await expect(runValidateOutput(paths)).rejects.toBeInstanceOf(BuildStageError);
    await expect(runValidateOutput(paths)).rejects.toMatchObject({
      stage: VALIDATE_OUTPUT_STAGE,
    });
  });
});
