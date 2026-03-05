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
  const linkTagPattern = /<link\b([^>]*)>/gim;
  html = await replaceAsync(html, linkTagPattern, async (match: string, attributes: string) => {
    const rel = readAttributeValue(attributes, 'rel');
    if (rel?.toLowerCase() !== 'stylesheet') {
      return match;
    }

    const href = readAttributeValue(attributes, 'href');
    if (!href) {
      return match;
    }

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
  const moduleScriptPattern = /<script\b([^>]*)><\/script>/gim;
  html = await replaceAsync(html, moduleScriptPattern, async (_, attributes: string) => {
    const typeValue = readAttributeValue(attributes, 'type');
    const src = readAttributeValue(attributes, 'src');
    if (typeValue?.toLowerCase() !== 'module' || !src) {
      return `<script ${attributes}>` + '</script>';
    }

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
    const preservedAttributes = removeAttribute(attributes, 'src');
    const tagAttributes = preservedAttributes.length > 0 ? ` ${preservedAttributes}` : '';
    return `<script${tagAttributes}>\n${script}\n</script>`;
  });

  if (html.includes('/assets/')) {
    throw new BuildStageError(
      STAGE_ID,
      'Transformed ReactApp HTML still contains forbidden /assets/ references.',
    );
  }
  if (hasUnresolvedAssetAttributeReference(html)) {
    throw new BuildStageError(
      STAGE_ID,
      'Transformed ReactApp HTML still contains unresolved asset src/href references.',
    );
  }
  if (hasUnresolvedExternalModuleScriptReference(html)) {
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

  const replacements: string[] = await Promise.all(
    matches.map((match) => replacer(match[0], ...match.slice(1))),
  );

  let replacementIndex = 0;
  return input.replace(pattern, () => replacements[replacementIndex++] ?? '');
}

/**
 * Reads an attribute value from an HTML tag attributes string.
 *
 * @param {string} attributes - Tag attributes text.
 * @param {'src' | 'href' | 'type' | 'rel'} name - Attribute name to read.
 * @return {string | null} Parsed attribute value, or null when absent.
 */
function readAttributeValue(
  attributes: string,
  name: 'src' | 'href' | 'type' | 'rel',
): string | null {
  const pattern = new RegExp(
    `\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>\\\`]+))`,
    'i',
  );
  const match = pattern.exec(attributes);
  if (!match) {
    return null;
  }
  return match[1] ?? match[2] ?? match[3] ?? null;
}

/**
 * Detects unresolved local `assets/` references in src/href attributes.
 *
 * @param {string} html - HTML to scan.
 * @return {boolean} True when unresolved asset references are present.
 */
function hasUnresolvedAssetAttributeReference(html: string): boolean {
  const attributePattern = /\b(?:src|href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gim;
  let match: RegExpExecArray | null = attributePattern.exec(html);
  while (match !== null) {
    const value = match[1] ?? match[2] ?? match[3] ?? '';
    if (value.includes('assets/')) {
      return true;
    }
    match = attributePattern.exec(html);
  }
  return false;
}

/**
 * Detects `<script ... type=module ... src=...></script>` tags that remain unresolved.
 *
 * @param {string} html - HTML to scan.
 * @return {boolean} True when unresolved external module scripts are present.
 */
function hasUnresolvedExternalModuleScriptReference(html: string): boolean {
  const scriptTagPattern = /<script\b([^>]*)><\/script>/gim;
  let match: RegExpExecArray | null = scriptTagPattern.exec(html);
  while (match !== null) {
    const attributes = match[1] ?? '';
    const typeValue = readAttributeValue(attributes, 'type');
    const srcValue = readAttributeValue(attributes, 'src');
    if (typeValue?.toLowerCase() === 'module' && srcValue) {
      return true;
    }
    match = scriptTagPattern.exec(html);
  }
  return false;
}

/**
 * Removes one attribute name from a tag attributes string.
 *
 * @param {string} attributes - Tag attributes text.
 * @param {'src' | 'href' | 'type' | 'rel'} name - Attribute name to remove.
 * @return {string} Attributes without the named attribute.
 */
function removeAttribute(
  attributes: string,
  name: 'src' | 'href' | 'type' | 'rel',
): string {
  const attributePattern = new RegExp(
    `(^|\\s+)${name}\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s"'=<>\\\`]+)`,
    'i',
  );
  const updated = attributes.replace(attributePattern, (_, leading = '') => leading);
  return updated.trim();
}
