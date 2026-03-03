import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { BuilderPaths } from '../types.js';
import { BuildStageError } from '../lib/errors.js';
import { runFrontendHtmlServiceTransform } from './frontend-htmlservice-transform.js';

/**
 * Creates a unique temporary directory for a test case.
 *
 * @return {Promise<string>} Path to the created temporary directory.
 */
async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'frontend-htmlservice-transform-'));
}

/**
 * Builds a complete `BuilderPaths` object rooted at a temporary directory.
 *
 * @param {string} rootDir - Root temporary directory for the test fixture.
 * @return {BuilderPaths} Fully resolved builder path values.
 */
function createBuilderPaths(rootDir: string): BuilderPaths {
  const repoRoot = rootDir;
  const buildDir = path.join(repoRoot, 'build');
  const buildFrontendDir = path.join(buildDir, 'frontend');
  const buildGasDir = path.join(buildDir, 'gas');
  const buildGasUiDir = path.join(buildGasDir, 'UI');

  return {
    repoRoot,
    builderRoot: path.join(repoRoot, 'scripts', 'builder'),
    configPath: path.join(repoRoot, 'scripts', 'builder', 'builder.config.json'),
    frontendDir: path.join(repoRoot, 'src', 'frontend'),
    backendDir: path.join(repoRoot, 'src', 'backend'),
    buildDir,
    buildFrontendDir,
    buildWorkDir: path.join(buildDir, 'work'),
    buildGasDir,
    buildGasUiDir,
    jsonDbAppPinnedSnapshotDir: path.join(repoRoot, 'vendor', 'jsondbapp'),
    jsonDbAppSourceFiles: ['src/01-core.js'],
  };
}

describe('runFrontendHtmlServiceTransform', () => {
  let tempRoot: string;
  let paths: BuilderPaths;

  beforeEach(async () => {
    tempRoot = await createTempDir();
    paths = createBuilderPaths(tempRoot);

    await fs.mkdir(path.join(paths.buildFrontendDir, 'assets'), { recursive: true });
    await fs.mkdir(paths.buildGasUiDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it('inlines module script content and removes module type declaration', async () => {
    await fs.writeFile(
      path.join(paths.buildFrontendDir, 'index.html'),
      [
        '<!doctype html>',
        '<html>',
        '  <head></head>',
        '  <body>',
        '    <div id="root"></div>',
        '    <script type="module" src="./assets/index-abc.js"></script>',
        '  </body>',
        '</html>',
      ].join('\n'),
      'utf-8',
    );
    await fs.writeFile(
      path.join(paths.buildFrontendDir, 'assets', 'index-abc.js'),
      'window.__testReactBoot = true;',
      'utf-8',
    );

    const result = await runFrontendHtmlServiceTransform(paths);
    const output = await fs.readFile(result.reactAppPath, 'utf-8');

    expect(result.stage).toBe('frontend-htmlservice-transform');
    expect(result.inlinedScriptCount).toBe(1);
    expect(output).toContain('<script>');
    expect(output).toContain('window.__testReactBoot = true;');
    expect(output).not.toContain('type="module"');
  });

  it('replaces stylesheet links with inline style blocks', async () => {
    await fs.writeFile(
      path.join(paths.buildFrontendDir, 'index.html'),
      [
        '<!doctype html>',
        '<html>',
        '  <head>',
        '    <link rel="stylesheet" href="./assets/index-abc.css">',
        '  </head>',
        '  <body>',
        '    <div id="root"></div>',
        '  </body>',
        '</html>',
      ].join('\n'),
      'utf-8',
    );
    await fs.writeFile(
      path.join(paths.buildFrontendDir, 'assets', 'index-abc.css'),
      'body { color: rgb(1, 2, 3); }',
      'utf-8',
    );

    const result = await runFrontendHtmlServiceTransform(paths);
    const output = await fs.readFile(result.reactAppPath, 'utf-8');

    expect(result.inlinedStyleCount).toBe(1);
    expect(output).toContain('<style>');
    expect(output).toContain('body { color: rgb(1, 2, 3); }');
    expect(output).not.toContain('<link rel="stylesheet"');
  });

  it('produces output with no module declaration and no /assets references', async () => {
    await fs.writeFile(
      path.join(paths.buildFrontendDir, 'index.html'),
      [
        '<!doctype html>',
        '<html>',
        '  <head>',
        '    <meta charset="UTF-8">',
        '    <link rel="stylesheet" href="./assets/index-abc.css">',
        '  </head>',
        '  <body>',
        '    <div id="root"></div>',
        '    <script type="module" src="./assets/index-abc.js"></script>',
        '  </body>',
        '</html>',
      ].join('\n'),
      'utf-8',
    );
    await fs.writeFile(
      path.join(paths.buildFrontendDir, 'assets', 'index-abc.css'),
      ':root { --accent: #123456; }',
      'utf-8',
    );
    await fs.writeFile(
      path.join(paths.buildFrontendDir, 'assets', 'index-abc.js'),
      'document.getElementById("root");',
      'utf-8',
    );

    const result = await runFrontendHtmlServiceTransform(paths);
    const output = await fs.readFile(result.reactAppPath, 'utf-8');

    expect(output).toContain('<meta charset="UTF-8">');
    expect(output).toContain('<div id="root"></div>');
    expect(output).not.toContain('type="module"');
    expect(output).not.toContain('/assets/');
  });

  it('fails when unresolved /assets references remain in transformed output', async () => {
    await fs.writeFile(
      path.join(paths.buildFrontendDir, 'index.html'),
      [
        '<!doctype html>',
        '<html>',
        '  <head></head>',
        '  <body>',
        '    <div id="root"></div>',
        '    <img src="/assets/logo.svg">',
        '  </body>',
        '</html>',
      ].join('\n'),
      'utf-8',
    );

    await expect(runFrontendHtmlServiceTransform(paths)).rejects.toBeInstanceOf(BuildStageError);
    await expect(runFrontendHtmlServiceTransform(paths)).rejects.toThrow(
      'forbidden /assets/ references',
    );
  });

  it('fails when unresolved relative assets references remain in transformed output', async () => {
    await fs.writeFile(
      path.join(paths.buildFrontendDir, 'index.html'),
      [
        '<!doctype html>',
        '<html>',
        '  <head></head>',
        '  <body>',
        '    <div id="root"></div>',
        '    <img src="./assets/logo.svg">',
        '  </body>',
        '</html>',
      ].join('\n'),
      'utf-8',
    );

    await expect(runFrontendHtmlServiceTransform(paths)).rejects.toBeInstanceOf(BuildStageError);
    await expect(runFrontendHtmlServiceTransform(paths)).rejects.toThrow(
      'forbidden /assets/ references',
    );
  });
});
