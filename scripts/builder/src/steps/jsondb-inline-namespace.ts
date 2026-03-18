import path from 'node:path';
import { promises as fs } from 'node:fs';

import { BuildStageError } from '../lib/errors.js';
import type { BuilderPaths, JsonDbInlineNamespaceResult } from '../types.js';
import { scanFileTopLevelDeclarations } from './validate-output.js';

const STAGE_ID = 'jsondb-inline-namespace' as const;
const NAMESPACE_SYMBOL = 'JsonDbApp';
const OUTPUT_FILENAME = 'JsonDbApp.inlined.js';
const PLACEHOLDER_SENTINEL = 'JsonDbApp snapshot placeholder';

/**
 * Creates the deterministic ordered source file list for JsonDbApp inlining.
 *
 * @param {BuilderPaths} paths - Resolved builder path configuration.
 * @returns {string[]} Absolute JsonDbApp source file paths in load order.
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
 * @returns {string[]} Unique export names in declaration order.
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
 * @returns {string} Wrapped JavaScript source for GAS output.
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
 * @returns {string[]} Declared symbol names.
 */
export function scanTopLevelDeclarations(source: string): string[] {
  return scanFileTopLevelDeclarations(source);
}

/**
 * Validates that configured exports map to declared symbols.
 *
 * @param {string[]} declaredSymbols - Top-level declared symbols in source.
 * @param {string[]} exportedApi - Configured exports to expose.
 * @returns {void}
 */
function validateConfiguredExports(declaredSymbols: string[], exportedApi: string[]): void {
  const missingExports = exportedApi.filter((exportName) => !declaredSymbols.includes(exportName));

  if (missingExports.length > 0) {
    throw new BuildStageError(
      STAGE_ID,
      `JsonDbApp public exports are missing declarations: ${missingExports.join(', ')}`,
    );
  }
}

/**
 * Validates that vendored JsonDbApp source is not a placeholder snapshot.
 *
 * @param {string[]} sourceChunks - Ordered raw JsonDbApp source contents.
 * @returns {void}
 */
function validateNoPlaceholderSnapshot(sourceChunks: string[]): void {
  const hasPlaceholderSource = sourceChunks.some((source) => source.includes(PLACEHOLDER_SENTINEL));

  if (hasPlaceholderSource) {
    throw new BuildStageError(
      STAGE_ID,
      'Pinned JsonDbApp snapshot contains placeholder implementations and cannot be bundled.',
    );
  }
}

/**
 * Generates the inlined JsonDbApp namespace bundle and writes it to build output.
 *
 * @param {BuilderPaths} paths - Resolved builder path configuration.
 * @returns {Promise<JsonDbInlineNamespaceResult>} Bundle output metadata.
 */
export async function runJsonDbInlineNamespace(
  paths: BuilderPaths,
): Promise<JsonDbInlineNamespaceResult> {
  const orderedSourcePaths = resolveOrderedSourcePaths(paths);

  try {
    const sourceChunks = await Promise.all(
      orderedSourcePaths.map((sourcePath) => fs.readFile(sourcePath, 'utf-8')),
    );
    validateNoPlaceholderSnapshot(sourceChunks);
    const exportedApi = resolvePublicExports(paths.jsonDbAppPublicExports);
    const declaredSymbols = scanTopLevelDeclarations(sourceChunks.join('\n\n'));
    validateConfiguredExports(declaredSymbols, exportedApi);
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
    if (err instanceof BuildStageError) {
      throw err;
    }
    throw new BuildStageError(STAGE_ID, 'Failed to generate JsonDbApp inlined namespace file.', err);
  }
}
