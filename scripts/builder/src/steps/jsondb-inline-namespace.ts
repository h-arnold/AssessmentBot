import path from 'node:path';
import { promises as fs } from 'node:fs';

import { BuildStageError } from '../lib/errors.js';
import type { BuilderPaths, JsonDbInlineNamespaceResult } from '../types.js';

const STAGE_ID = 'jsondb-inline-namespace' as const;
const NAMESPACE_SYMBOL = 'JsonDbAppNS';
const OUTPUT_FILENAME = 'JsonDbApp.inlined.js';

/**
 * Creates the deterministic ordered source file list for JsonDbApp inlining.
 *
 * @param {BuilderPaths} paths - Resolved builder path configuration.
 * @return {string[]} Absolute JsonDbApp source file paths in load order.
 */
function resolveOrderedSourcePaths(paths: BuilderPaths): string[] {
  return [...paths.jsonDbAppSourceFiles]
    .sort((left, right) => left.localeCompare(right))
    .map((relativePath) => path.join(paths.jsonDbAppPinnedSnapshotDir, relativePath));
}

/**
 * Sanitises and de-duplicates configured export names while preserving order.
 *
 * @param {string[]} configuredExports - Configured JsonDbApp public API names.
 * @return {string[]} Unique export names in declaration order.
 */
export function resolvePublicExports(configuredExports: string[]): string[] {
  const uniqueExports: string[] = [];

  for (const exportName of configuredExports) {
    if (!uniqueExports.includes(exportName)) {
      uniqueExports.push(exportName);
    }
  }

  return uniqueExports;
}

/**
 * Generates the inlined wrapper source for JsonDbApp namespace isolation.
 *
 * @param {string[]} sourceChunks - Ordered raw JsonDbApp source contents.
 * @param {string[]} publicExports - Public API names to expose from namespace.
 * @return {string} Wrapped JavaScript source for GAS output.
 */
export function generateJsonDbNamespaceWrapper(sourceChunks: string[], publicExports: string[]): string {
  const body = sourceChunks.join('\n\n');
  const exportLines = publicExports.map((exportName) => `    ${exportName},`).join('\n');

  return `const ${NAMESPACE_SYMBOL} = (function () {\n${body}\n\n  return {\n${exportLines}\n  };\n})();\n`;
}

/**
 * Detects symbol names that appear as top-level declarations in script source.
 *
 * @param {string} source - JavaScript source code to scan.
 * @return {string[]} Declared symbol names.
 */
export function scanTopLevelDeclarations(source: string): string[] {
  const declarationMatches = source.matchAll(
    /^\s*(?:function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/gm,
  );

  const names: string[] = [];
  for (const match of declarationMatches) {
    names.push(match[1]);
  }

  return names;
}

/**
 * Generates the inlined JsonDbApp namespace bundle and writes it to build output.
 *
 * @param {BuilderPaths} paths - Resolved builder path configuration.
 * @return {Promise<JsonDbInlineNamespaceResult>} Bundle output metadata.
 */
export async function runJsonDbInlineNamespace(
  paths: BuilderPaths,
): Promise<JsonDbInlineNamespaceResult> {
  const orderedSourcePaths = resolveOrderedSourcePaths(paths);

  try {
    const sourceChunks = await Promise.all(
      orderedSourcePaths.map((sourcePath) => fs.readFile(sourcePath, 'utf-8')),
    );
    const exportedApi = resolvePublicExports(paths.jsonDbAppPublicExports);
    const outputSource = generateJsonDbNamespaceWrapper(sourceChunks, exportedApi);
    const outputPath = path.join(paths.buildGasDir, OUTPUT_FILENAME);

    await fs.writeFile(outputPath, outputSource, 'utf-8');

    return {
      stage: STAGE_ID,
      outputPath,
      namespaceSymbol: NAMESPACE_SYMBOL,
      exportedApi,
    };
  } catch (err) {
    throw new BuildStageError(STAGE_ID, 'Failed to generate JsonDbApp inlined namespace file.', err);
  }
}
