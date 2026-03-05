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
    backendManifestPath: path.join(repoRoot, 'src', 'backend', 'appsscript.json'),
    jsonDbAppPinnedSnapshotDir: path.join(repoRoot, 'vendor', 'jsondbapp'),
    jsonDbAppManifestPath: path.join(repoRoot, 'vendor', 'jsondbapp', 'appsscript.json'),
    jsonDbAppSourceFiles: ['src/01-core.js'],
    jsonDbAppPublicExports: ['loadDatabase'],
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

  it('inlines module script content and preserves module script attributes', async () => {
    await fs.writeFile(
      path.join(paths.buildFrontendDir, 'index.html'),
      [
        '<!doctype html>',
        '<html>',
        '  <head></head>',
        '  <body>',
        '    <div id="root"></div>',
        '    <script type="module" crossorigin src="./assets/index-abc.js"></script>',
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
    expect(output).toContain('<script type="module" crossorigin>');
    expect(output).toContain('window.__testReactBoot = true;');
  });

  it('inlines module scripts when src attribute appears before type', async () => {
    await fs.writeFile(
      path.join(paths.buildFrontendDir, 'index.html'),
      [
        '<!doctype html>',
        '<html>',
        '  <head></head>',
        '  <body>',
        '    <div id="root"></div>',
        '    <script src="./assets/index-abc.js" type="module"></script>',
        '  </body>',
        '</html>',
      ].join('\n'),
      'utf-8',
    );
    await fs.writeFile(
      path.join(paths.buildFrontendDir, 'assets', 'index-abc.js'),
      'window.__srcBeforeType = true;',
      'utf-8',
    );

    const result = await runFrontendHtmlServiceTransform(paths);
    const output = await fs.readFile(result.reactAppPath, 'utf-8');

    expect(result.inlinedScriptCount).toBe(1);
    expect(output).toContain('<script type="module">');
    expect(output).toContain('window.__srcBeforeType = true;');
    expect(output).not.toContain('src="./assets/index-abc.js"');
  });

  it('inlines module scripts with unquoted local src and type attributes', async () => {
    await fs.writeFile(
      path.join(paths.buildFrontendDir, 'index.html'),
      [
        '<!doctype html>',
        '<html>',
        '  <head></head>',
        '  <body>',
        '    <div id="root"></div>',
        '    <script src=./assets/index-abc.js type=module></script>',
        '  </body>',
        '</html>',
      ].join('\n'),
      'utf-8',
    );
    await fs.writeFile(
      path.join(paths.buildFrontendDir, 'assets', 'index-abc.js'),
      'window.__unquotedModuleAttrs = true;',
      'utf-8',
    );

    const result = await runFrontendHtmlServiceTransform(paths);
    const output = await fs.readFile(result.reactAppPath, 'utf-8');

    expect(result.inlinedScriptCount).toBe(1);
    expect(output).toContain('<script type=module>');
    expect(output).toContain('window.__unquotedModuleAttrs = true;');
    expect(output).not.toContain('src=./assets/index-abc.js');
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

  it('produces output with module declaration and no /assets references', async () => {
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
    expect(output).toContain('type="module"');
    expect(output).not.toContain('/assets/');
  });



  it('fails when asset references resolve outside the frontend build directory', async () => {
    await fs.writeFile(
      path.join(paths.buildFrontendDir, 'index.html'),
      [
        '<!doctype html>',
        '<html>',
        '  <head></head>',
        '  <body>',
        '    <div id="root"></div>',
        '    <script type="module" src="../secrets.js"></script>',
        '  </body>',
        '</html>',
      ].join('\n'),
      'utf-8',
    );

    await expect(runFrontendHtmlServiceTransform(paths)).rejects.toBeInstanceOf(BuildStageError);
    await expect(runFrontendHtmlServiceTransform(paths)).rejects.toThrow('Invalid frontend asset reference');
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

  it('fails when unresolved external module scripts remain after transform', async () => {
    await fs.writeFile(
      path.join(paths.buildFrontendDir, 'index.html'),
      [
        '<!doctype html>',
        '<html>',
        '  <head></head>',
        '  <body>',
        '    <div id="root"></div>',
        '    <script src="https://cdn.example.com/app.js" type="module"></script>',
        '  </body>',
        '</html>',
      ].join('\n'),
      'utf-8',
    );

    await expect(runFrontendHtmlServiceTransform(paths)).rejects.toBeInstanceOf(BuildStageError);
    await expect(runFrontendHtmlServiceTransform(paths)).rejects.toThrow(
      'unresolved external module script references',
    );
  });

  it('fails when unresolved unquoted external module scripts remain after transform', async () => {
    await fs.writeFile(
      path.join(paths.buildFrontendDir, 'index.html'),
      [
        '<!doctype html>',
        '<html>',
        '  <head></head>',
        '  <body>',
        '    <div id="root"></div>',
        '    <script src=https://cdn.example.com/app.js type=module></script>',
        '  </body>',
        '</html>',
      ].join('\n'),
      'utf-8',
    );

    await expect(runFrontendHtmlServiceTransform(paths)).rejects.toBeInstanceOf(BuildStageError);
    await expect(runFrontendHtmlServiceTransform(paths)).rejects.toThrow(
      'unresolved external module script references',
    );
  });
});
