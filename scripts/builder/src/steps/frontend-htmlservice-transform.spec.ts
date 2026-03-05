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

/**
 * Writes the frontend `index.html` fixture for the current test.
 *
 * @param {BuilderPaths} paths - Builder path set for the test fixture.
 * @param {string[]} htmlLines - HTML lines that will be joined using newlines.
 * @return {Promise<void>} Resolves when the fixture is written.
 */
async function writeFrontendIndexHtml(paths: BuilderPaths, htmlLines: string[]): Promise<void> {
  await fs.writeFile(path.join(paths.buildFrontendDir, 'index.html'), htmlLines.join('\n'), 'utf-8');
}

/**
 * Writes a single asset file under `build/frontend/assets`.
 *
 * @param {BuilderPaths} paths - Builder path set for the test fixture.
 * @param {string} assetName - Asset file name relative to `assets`.
 * @param {string} contents - File contents to write.
 * @return {Promise<void>} Resolves when the asset file is written.
 */
async function writeFrontendAsset(
  paths: BuilderPaths,
  assetName: string,
  contents: string,
): Promise<void> {
  await fs.writeFile(path.join(paths.buildFrontendDir, 'assets', assetName), contents, 'utf-8');
}

/**
 * Runs the transform and reads the emitted HtmlService template output.
 *
 * @param {BuilderPaths} paths - Builder path set for the test fixture.
 * @return {Promise<{ result: Awaited<ReturnType<typeof runFrontendHtmlServiceTransform>>; output: string }>}
 * Stage result and transformed HTML output.
 */
async function runTransformAndReadOutput(
  paths: BuilderPaths,
): Promise<{ result: Awaited<ReturnType<typeof runFrontendHtmlServiceTransform>>; output: string }> {
  const result = await runFrontendHtmlServiceTransform(paths);
  const output = await fs.readFile(result.reactAppPath, 'utf-8');
  return { result, output };
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
    await writeFrontendIndexHtml(paths, [
      '<!doctype html>',
      '<html>',
      '  <head></head>',
      '  <body>',
      '    <div id="root"></div>',
      '    <script type="module" crossorigin src="./assets/index-abc.js"></script>',
      '  </body>',
      '</html>',
    ]);
    await writeFrontendAsset(paths, 'index-abc.js', 'window.__testReactBoot = true;');

    const { result, output } = await runTransformAndReadOutput(paths);

    expect(result.stage).toBe('frontend-htmlservice-transform');
    expect(result.inlinedScriptCount).toBe(1);
    expect(output).toContain('<script type="module" crossorigin>');
    expect(output).toContain('window.__testReactBoot = true;');
  });

  it('inlines module scripts when src attribute appears before type', async () => {
    await writeFrontendIndexHtml(paths, [
      '<!doctype html>',
      '<html>',
      '  <head></head>',
      '  <body>',
      '    <div id="root"></div>',
      '    <script src="./assets/index-abc.js" type="module"></script>',
      '  </body>',
      '</html>',
    ]);
    await writeFrontendAsset(paths, 'index-abc.js', 'window.__srcBeforeType = true;');

    const { result, output } = await runTransformAndReadOutput(paths);

    expect(result.inlinedScriptCount).toBe(1);
    expect(output).toContain('<script type="module">');
    expect(output).toContain('window.__srcBeforeType = true;');
    expect(output).not.toContain('src="./assets/index-abc.js"');
  });

  it('inlines module scripts with unquoted local src and type attributes', async () => {
    await writeFrontendIndexHtml(paths, [
      '<!doctype html>',
      '<html>',
      '  <head></head>',
      '  <body>',
      '    <div id="root"></div>',
      '    <script src=./assets/index-abc.js type=module></script>',
      '  </body>',
      '</html>',
    ]);
    await writeFrontendAsset(paths, 'index-abc.js', 'window.__unquotedModuleAttrs = true;');

    const { result, output } = await runTransformAndReadOutput(paths);

    expect(result.inlinedScriptCount).toBe(1);
    expect(output).toContain('<script type=module>');
    expect(output).toContain('window.__unquotedModuleAttrs = true;');
    expect(output).not.toContain('src=./assets/index-abc.js');
  });

  it('replaces stylesheet links with inline style blocks', async () => {
    await writeFrontendIndexHtml(paths, [
      '<!doctype html>',
      '<html>',
      '  <head>',
      '    <link rel="stylesheet" href="./assets/index-abc.css">',
      '  </head>',
      '  <body>',
      '    <div id="root"></div>',
      '  </body>',
      '</html>',
    ]);
    await writeFrontendAsset(paths, 'index-abc.css', 'body { color: rgb(1, 2, 3); }');

    const { result, output } = await runTransformAndReadOutput(paths);

    expect(result.inlinedStyleCount).toBe(1);
    expect(output).toContain('<style>');
    expect(output).toContain('body { color: rgb(1, 2, 3); }');
    expect(output).not.toContain('<link rel="stylesheet"');
  });

  it('produces output with module declaration and no /assets references', async () => {
    await writeFrontendIndexHtml(paths, [
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
    ]);
    await writeFrontendAsset(paths, 'index-abc.css', ':root { --accent: #123456; }');
    await writeFrontendAsset(paths, 'index-abc.js', 'document.getElementById("root");');

    const { output } = await runTransformAndReadOutput(paths);

    expect(output).toContain('<meta charset="UTF-8">');
    expect(output).toContain('<div id="root"></div>');
    expect(output).toContain('type="module"');
    expect(output).not.toContain('/assets/');
  });

  it('fails when asset references resolve outside the frontend build directory', async () => {
    await writeFrontendIndexHtml(paths, [
      '<!doctype html>',
      '<html>',
      '  <head></head>',
      '  <body>',
      '    <div id="root"></div>',
      '    <script type="module" src="../secrets.js"></script>',
      '  </body>',
      '</html>',
    ]);

    await expect(runFrontendHtmlServiceTransform(paths)).rejects.toBeInstanceOf(BuildStageError);
    await expect(runFrontendHtmlServiceTransform(paths)).rejects.toThrow('Invalid frontend asset reference');
  });

  it('fails when unresolved /assets references remain in transformed output', async () => {
    await writeFrontendIndexHtml(paths, [
      '<!doctype html>',
      '<html>',
      '  <head></head>',
      '  <body>',
      '    <div id="root"></div>',
      '    <img src="/assets/logo.svg">',
      '  </body>',
      '</html>',
    ]);

    await expect(runFrontendHtmlServiceTransform(paths)).rejects.toBeInstanceOf(BuildStageError);
    await expect(runFrontendHtmlServiceTransform(paths)).rejects.toThrow(
      'forbidden /assets/ references',
    );
  });

  it('fails when unresolved relative assets references remain in transformed output', async () => {
    await writeFrontendIndexHtml(paths, [
      '<!doctype html>',
      '<html>',
      '  <head></head>',
      '  <body>',
      '    <div id="root"></div>',
      '    <img src="./assets/logo.svg">',
      '  </body>',
      '</html>',
    ]);

    await expect(runFrontendHtmlServiceTransform(paths)).rejects.toBeInstanceOf(BuildStageError);
    await expect(runFrontendHtmlServiceTransform(paths)).rejects.toThrow(
      'forbidden /assets/ references',
    );
  });

  it('fails when unresolved external module scripts remain after transform', async () => {
    await writeFrontendIndexHtml(paths, [
      '<!doctype html>',
      '<html>',
      '  <head></head>',
      '  <body>',
      '    <div id="root"></div>',
      '    <script src="https://cdn.example.com/app.js" type="module"></script>',
      '  </body>',
      '</html>',
    ]);

    await expect(runFrontendHtmlServiceTransform(paths)).rejects.toBeInstanceOf(BuildStageError);
    await expect(runFrontendHtmlServiceTransform(paths)).rejects.toThrow(
      'unresolved external module script references',
    );
  });

  it('fails when unresolved unquoted external module scripts remain after transform', async () => {
    await writeFrontendIndexHtml(paths, [
      '<!doctype html>',
      '<html>',
      '  <head></head>',
      '  <body>',
      '    <div id="root"></div>',
      '    <script src=https://cdn.example.com/app.js type=module></script>',
      '  </body>',
      '</html>',
    ]);

    await expect(runFrontendHtmlServiceTransform(paths)).rejects.toBeInstanceOf(BuildStageError);
    await expect(runFrontendHtmlServiceTransform(paths)).rejects.toThrow(
      'unresolved external module script references',
    );
  });

  it('leaves regular scripts intact when the type attribute is missing', async () => {
    await writeFrontendIndexHtml(paths, [
      '<!doctype html>',
      '<html>',
      '  <head></head>',
      '  <body>',
      '    <div id="root"></div>',
      '    <script src="./local/index-abc.js"></script>',
      '  </body>',
      '</html>',
    ]);
    await fs.mkdir(path.join(paths.buildFrontendDir, 'local'), { recursive: true });
    await fs.writeFile(
      path.join(paths.buildFrontendDir, 'local', 'index-abc.js'),
      'window.__plainScript = true;',
      'utf-8',
    );

    const { result, output } = await runTransformAndReadOutput(paths);

    expect(result.inlinedScriptCount).toBe(0);
    expect(output).toContain('src="./local/index-abc.js"');
  });

  it('fails when attribute values still reference assets/ without a leading slash', async () => {
    await writeFrontendIndexHtml(paths, [
      '<!doctype html>',
      '<html>',
      '  <head></head>',
      '  <body>',
      '    <div id="root"></div>',
      '    <img src="assets/logo.svg">',
      '  </body>',
      '</html>',
    ]);

    await expect(runFrontendHtmlServiceTransform(paths)).rejects.toBeInstanceOf(BuildStageError);
    await expect(runFrontendHtmlServiceTransform(paths)).rejects.toThrow(
      'still contains unresolved asset src/href references',
    );
  });

  it('detects unresolved module scripts after skipping non-module siblings', async () => {
    await writeFrontendIndexHtml(paths, [
      '<!doctype html>',
      '<html>',
      '  <head></head>',
      '  <body>',
      '    <div id="root"></div>',
      '    <script src="./local/lib.js"></script>',
      '    <script type="module" src="https://cdn.example.com/module.js"></script>',
      '  </body>',
      '</html>',
    ]);

    await fs.mkdir(path.join(paths.buildFrontendDir, 'local'), { recursive: true });
    await fs.writeFile(
      path.join(paths.buildFrontendDir, 'local', 'lib.js'),
      'export const lib = true;',
      'utf-8',
    );

    await expect(runFrontendHtmlServiceTransform(paths)).rejects.toBeInstanceOf(BuildStageError);
    await expect(runFrontendHtmlServiceTransform(paths)).rejects.toThrow(
      'unresolved external module script references',
    );
  });
});
