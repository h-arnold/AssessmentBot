import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import type { BuilderPaths } from '../types.js';
import { createBuilderPaths, createTempDir } from '../test/builder-fixture-test-helpers.js';
import { scanFileTopLevelDeclarations } from './validate-output.js';
import {
  generateJsonDbNamespaceWrapper,
  resolvePublicExports,
  runJsonDbInlineNamespace,
} from './jsondb-inline-namespace.js';

const LOAD_DATABASE_EXPORT = 'loadDatabase,';
const REAL_VENDORED_SOURCE_FILES = ['src/04_core/Database.js', 'src/04_core/99_PublicAPI.js'];

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
    tempRoot = await createTempDir('jsondb-inline-namespace-');
    paths = createBuilderPaths(tempRoot, {
      jsonDbAppSourceFiles: [...REAL_VENDORED_SOURCE_FILES],
      jsonDbAppPublicExports: ['loadDatabase', 'createAndInitialiseDatabase'],
    });

    await fs.mkdir(path.join(paths.jsonDbAppPinnedSnapshotDir, 'src', '04_core'), { recursive: true });
    await fs.mkdir(paths.buildGasDir, { recursive: true });

    await fs.writeFile(
      path.join(paths.jsonDbAppPinnedSnapshotDir, 'src', '04_core', 'Database.js'),
      [
        'function Database(config) {',
        '  this.config = config;',
        '}',
        'Database.prototype.initialise = function () {};',
        'Database.prototype.createDatabase = function () {};',
        '',
      ].join('\n'),
      'utf-8',
    );
    await fs.writeFile(
      path.join(paths.jsonDbAppPinnedSnapshotDir, 'src', '04_core', '99_PublicAPI.js'),
      [
        'function loadDatabase(config) {',
        '  const db = new Database(config);',
        '  db.initialise();',
        '  return db;',
        '}',
        '',
        'function createAndInitialiseDatabase(config) {',
        '  const db = new Database(config);',
        '  db.createDatabase();',
        '  db.initialise();',
        '  return db;',
        '}',
        '',
      ].join('\n'),
      'utf-8',
    );
    await fs.writeFile(
      path.join(paths.jsonDbAppPinnedSnapshotDir, 'src', '04_core', 'UnusedHelper.js'),
      'function leakedHelper() {}\n',
      'utf-8',
    );
  });

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it('writes JsonDbApp.inlined.js from the configured vendored source subset', async () => {
    const result = await runJsonDbInlineNamespace(paths);
    const output = await fs.readFile(result.outputPath, 'utf-8');

    expect(result.stage).toBe('jsondb-inline-namespace');
    expect(result.namespaceSymbol).toBe('JsonDbApp');
    expect(result.exportedApi).toEqual(['loadDatabase', 'createAndInitialiseDatabase']);
    expect(result.outputPath).toBe(path.join(paths.buildGasDir, 'JsonDbApp.inlined.js'));

    expect(output).toContain('const JsonDbApp = (function () {');
    expect(output).toContain('loadDatabase,');
    expect(output).toContain('createAndInitialiseDatabase,');
    expect(output).not.toContain('leakedHelper');
  });

  it('emits configured JsonDbApp source files in lexicographic relative-path order', async () => {
    paths.jsonDbAppSourceFiles = [
      'src/04_core/30-third.js',
      'src/04_core/10-first.js',
      'src/04_core/20-second.js',
    ];

    const lineBreak = '\n';

    await fs.writeFile(
      path.join(paths.jsonDbAppPinnedSnapshotDir, 'src', '04_core', '10-first.js'),
      ['// first', 'function alphaHelper() {}', ''].join(lineBreak),
      'utf-8',
    );
    await fs.writeFile(
      path.join(paths.jsonDbAppPinnedSnapshotDir, 'src', '04_core', '20-second.js'),
      ['// second', 'function loadDatabase() {', '  return alphaHelper();', '}', ''].join(lineBreak),
      'utf-8',
    );
    await fs.writeFile(
      path.join(paths.jsonDbAppPinnedSnapshotDir, 'src', '04_core', '30-third.js'),
      [
        '// third',
        'function createAndInitialiseDatabase() {',
        '  return loadDatabase();',
        '}',
        '',
      ].join(lineBreak),
      'utf-8',
    );

    const result = await runJsonDbInlineNamespace(paths);
    const output = await fs.readFile(result.outputPath, 'utf-8');

    expect(output.indexOf('// first')).toBeLessThan(output.indexOf('// second'));
    expect(output.indexOf('// second')).toBeLessThan(output.indexOf('// third'));
  });

  it('fails when configured exports are not declared in the vendored source subset', async () => {
    paths.jsonDbAppPublicExports = ['loadDatabase', 'missingExport'];

    await expect(runJsonDbInlineNamespace(paths)).rejects.toThrow(
      'JsonDbApp public exports are missing declarations: missingExport',
    );
  });

  it('wraps unexpected source read failures with stage context', async () => {
    const sourcePath = path.join(paths.jsonDbAppPinnedSnapshotDir, 'src', '04_core', 'Database.js');
    await fs.rm(sourcePath);
    await fs.mkdir(sourcePath);

    await expect(runJsonDbInlineNamespace(paths)).rejects.toMatchObject({
      name: 'BuildStageError',
      stage: 'jsondb-inline-namespace',
      message: 'Failed to generate JsonDbApp inlined namespace file.',
    });
  });

  it('keeps JsonDb internals isolated from the top-level declarations scan', async () => {
    const result = await runJsonDbInlineNamespace(paths);
    const output = await fs.readFile(result.outputPath, 'utf-8');

    const declarations = scanFileTopLevelDeclarations(output);

    expect(declarations).toEqual(['JsonDbApp']);
    expect(declarations).not.toContain('Database');
    expect(declarations).not.toContain('loadDatabase');
    expect(declarations).not.toContain('createAndInitialiseDatabase');
  });
});
