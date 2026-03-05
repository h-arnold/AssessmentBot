import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';

import { BuildStageError } from '../lib/errors.js';
import type { BuilderPaths, FrontendHtmlServiceTransformResult } from '../types.js';

const STAGE_ID = 'frontend-htmlservice-transform' as const;

/**
 * Resolves an asset reference from built HTML to an on-disk file path.
 *
 * @param {BuilderPaths} paths - Resolved builder filesystem paths.
 * @param {string} assetRef - Asset path extracted from HTML tags.
 * @return {string} Absolute path to the referenced built asset.
 */
function resolveBuiltAssetPath(paths: BuilderPaths, assetRef: string): string {
  const sanitisedRef = assetRef.replace(/^\.\//, '');
  const resolvedPath = path.resolve(paths.buildFrontendDir, sanitisedRef);
  const relativePath = path.relative(paths.buildFrontendDir, resolvedPath);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new BuildStageError(STAGE_ID, `Invalid frontend asset reference: ${assetRef}`);
  }

  return resolvedPath;
}

/**
 * Converts Vite output HTML into a GAS HtmlService template with inlined assets.
 *
 * @param {BuilderPaths} paths - Resolved builder filesystem paths.
 * @return {Promise<FrontendHtmlServiceTransformResult>} Transform output metadata.
 */
export async function runFrontendHtmlServiceTransform(
  paths: BuilderPaths,
): Promise<FrontendHtmlServiceTransformResult> {
  const entryHtmlPath = path.join(paths.buildFrontendDir, 'index.html');
  const reactAppPath = path.join(paths.buildGasUiDir, 'ReactApp.html');

  let html: string;
  try {
    html = await readFile(entryHtmlPath, 'utf-8');
  } catch (err) {
    throw new BuildStageError(STAGE_ID, `Unable to read frontend entry HTML: ${entryHtmlPath}`, err);
  }

  let inlinedStyleCount = 0;
  const stylesheetPattern = /<link\s+[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gim;
  html = await replaceAsync(html, stylesheetPattern, async (_, href: string) => {
    const cssPath = resolveBuiltAssetPath(paths, href);
    let css: string;
    try {
      css = await readFile(cssPath, 'utf-8');
    } catch (err) {
      throw new BuildStageError(STAGE_ID, `Unable to read stylesheet asset: ${cssPath}`, err);
    }
    inlinedStyleCount += 1;
    return `<style>\n${css}\n</style>`;
  });

  let inlinedScriptCount = 0;
  const moduleScriptPattern =
    /<script\s+([^>]*\btype\s*=\s*(?:"module"|'module'|module)(?=\s|>|$)[^>]*)><\/script>/gim;
  html = await replaceAsync(html, moduleScriptPattern, async (_, attributes: string) => {
    const srcMatch = attributes.match(/\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s"'=<>`]+))/i);
    if (!srcMatch) {
      return `<script ${attributes}>` + '</script>';
    }

    const src = srcMatch[1] ?? srcMatch[2] ?? srcMatch[3];
    if (/^(https?:)?\/\//i.test(src)) {
      return `<script ${attributes}>` + '</script>';
    }
    const scriptPath = resolveBuiltAssetPath(paths, src);
    let script: string;
    try {
      script = await readFile(scriptPath, 'utf-8');
    } catch (err) {
      throw new BuildStageError(STAGE_ID, `Unable to read script asset: ${scriptPath}`, err);
    }
    inlinedScriptCount += 1;
    const preservedAttributes = attributes
      .replace(/\s*\bsrc\s*=\s*(?:"[^"]+"|'[^']+'|[^\s"'=<>`]+)/i, '')
      .trim();
    const tagAttributes = preservedAttributes.length > 0 ? ` ${preservedAttributes}` : '';
    return `<script${tagAttributes}>\n${script}\n</script>`;
  });

  if (html.includes('/assets/')) {
    throw new BuildStageError(
      STAGE_ID,
      'Transformed ReactApp HTML still contains forbidden /assets/ references.',
    );
  }
  if (
    /\b(?:src|href)\s*=\s*(?:"[^"]*assets\/[^"]*"|'[^']*assets\/[^']*'|[^\s"'=<>`]*assets\/[^\s"'=<>`]*)/i.test(
      html,
    )
  ) {
    throw new BuildStageError(
      STAGE_ID,
      'Transformed ReactApp HTML still contains unresolved asset src/href references.',
    );
  }
  if (
    /<script\b(?=[^>]*\btype\s*=\s*(?:"module"|'module'|module)(?=\s|>))(?=[^>]*\bsrc\s*=\s*(?:"[^"]+"|'[^']+'|[^\s"'=<>`]+))[^>]*><\/script>/i.test(
      html,
    )
  ) {
    throw new BuildStageError(
      STAGE_ID,
      'Transformed ReactApp HTML still contains unresolved external module script references.',
    );
  }
  try {
    await writeFile(reactAppPath, html, 'utf-8');
  } catch (err) {
    throw new BuildStageError(STAGE_ID, `Unable to write HtmlService output: ${reactAppPath}`, err);
  }

  return {
    stage: STAGE_ID,
    reactAppPath,
    inlinedScriptCount,
    inlinedStyleCount,
  };
}

/**
 * Asynchronously replaces regex matches in a string.
 *
 * @param {string} input - Input text to transform.
 * @param {RegExp} pattern - Match pattern.
 * @param {(match: string, ...groups: string[]) => Promise<string>} replacer - Async replacer callback.
 * @return {Promise<string>} Transformed output string.
 */
async function replaceAsync(
  input: string,
  pattern: RegExp,
  replacer: (match: string, ...groups: string[]) => Promise<string>,
): Promise<string> {
  const matches = Array.from(input.matchAll(pattern));
  if (matches.length === 0) {
    return input;
  }

  const replacements = await Promise.all(matches.map((match) => replacer(match[0], ...match.slice(1))));

  let replacementIndex = 0;
  return input.replace(pattern, () => replacements[replacementIndex++] as string);
}
