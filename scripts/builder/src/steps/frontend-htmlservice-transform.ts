import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';

import { BuildStageError } from '../lib/errors.js';
import type { BuilderPaths, FrontendHtmlServiceTransformResult } from '../types.js';

const STAGE_ID = 'frontend-htmlservice-transform' as const;
const HTML_ATTRIBUTE_VALUE_PATTERN = /\b([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi;

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
  html = await replaceAsync(html, moduleScriptPattern, async (match: string, attributes: string) => {
    const type = readAttributeValue(attributes, 'type');
    if (type?.toLowerCase() !== 'module') {
      return match;
    }

    const src = readAttributeValue(attributes, 'src');
    if (!src) {
      return match;
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
  return input.replace(pattern, () => replacements[replacementIndex++]);
}

/**
 * Reads an attribute value from a raw HTML attribute segment.
 *
 * @param {string} attributes - Raw HTML attribute segment.
 * @param {string} name - Attribute name to read.
 * @return {string | undefined} Attribute value when present.
 */
function readAttributeValue(attributes: string, name: string): string | undefined {
  const targetName = name.toLowerCase();

  for (const match of attributes.matchAll(HTML_ATTRIBUTE_VALUE_PATTERN)) {
    if (match[1]?.toLowerCase() !== targetName) {
      continue;
    }

    return match[2] ?? match[3] ?? match[4];
  }

  return undefined;
}

/**
 * Removes a named HTML attribute from an attribute string.
 *
 * @param {string} attributes - Raw HTML attribute segment.
 * @param {string} name - Attribute name to remove.
 * @return {string} Normalised attribute segment without the named attribute.
 */
function removeAttribute(attributes: string, name: string): string {
  const targetName = name.toLowerCase();
  const trimmed = attributes
    .replaceAll(HTML_ATTRIBUTE_VALUE_PATTERN, (match, attributeName: string) =>
      attributeName.toLowerCase() === targetName ? '' : match,
    )
    .trim();
  return trimmed.replaceAll(/\s+/g, ' ');
}

/**
 * Detects unresolved local asset references in `src` or `href` attributes.
 *
 * @param {string} html - HTML content to scan.
 * @return {boolean} `true` when local `assets/` references remain.
 */
function hasUnresolvedAssetAttributeReference(html: string): boolean {
  const pattern = /\b(?:src|href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^"\s'>]+))/gi;
  let match;
  while ((match = pattern.exec(html))) {
    const value = match[1] ?? match[2] ?? match[3];
    if (!value) {
      continue;
    }
    if (/^(?:\.\.\/|\.\/|\/)?assets\//i.test(value)) {
      return true;
    }
  }
  return false;
}

/**
 * Detects unresolved external module script references in transformed HTML.
 *
 * @param {string} html - HTML content to scan.
 * @return {boolean} `true` when a module script still has a `src` attribute.
 */
function hasUnresolvedExternalModuleScriptReference(html: string): boolean {
  const pattern = /<script\b([^>]*)><\/script>/gim;
  let match;
  while ((match = pattern.exec(html))) {
    const attributes = match[1];
    const type = readAttributeValue(attributes, 'type');
    if (type?.toLowerCase() !== 'module') {
      continue;
    }
    if (readAttributeValue(attributes, 'src')) {
      return true;
    }
  }
  return false;
}
