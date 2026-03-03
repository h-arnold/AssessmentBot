import path from 'node:path';
import { promises as fs } from 'node:fs';

import { BuildStageError } from '../lib/errors.js';
import type { BuilderPaths, ValidateOutputResult } from '../types.js';

const STAGE_ID = 'validate-output' as const;
const REQUIRED_FILES = ['appsscript.json', 'JsonDbApp.inlined.js', 'UI/ReactApp.html'];
const PROTECTED_GLOBALS = ['Validate', 'JsonDbAppNS'];
const FORBIDDEN_ASSET_PATTERNS = [
  /(?:src|href)=["']https?:\/\//i,
  /(?:src|href)=["']\/assets\//i,
  /(?:src|href)=["']\.\/assets\//i,
  /(?:src|href)=["']assets\//i,
];

type GasManifest = {
  oauthScopes?: string[];
  dependencies?: {
    enabledAdvancedServices?: { userSymbol: string; serviceId: string; version: string }[];
  };
};

/**
 * Recursively lists files beneath a directory in deterministic order.
 *
 * @param {string} rootDir - Directory to scan.
 * @return {Promise<string[]>} Absolute file paths.
 */
async function listFilesRecursive(rootDir: string): Promise<string[]> {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  const sortedEntries = [...entries].sort((left, right) => left.name.localeCompare(right.name));
  const files: string[] = [];

  for (const entry of sortedEntries) {
    const entryPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(entryPath)));
      continue;
    }
    if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

/**
 * Ensures required final GAS output files are present.
 *
 * @param {Set<string>} relativeFiles - Relative output file paths.
 * @return {void} No return value.
 */
function validateRequiredFiles(relativeFiles: Set<string>): void {
  const missingFiles = REQUIRED_FILES.filter((requiredPath) => !relativeFiles.has(requiredPath));
  if (missingFiles.length > 0) {
    throw new BuildStageError(
      STAGE_ID,
      `Final output is missing required files: ${missingFiles.join(', ')}`,
    );
  }
}

/**
 * Validates merged GAS manifest structure and de-duplication assumptions.
 *
 * @param {string} manifestContent - Raw manifest JSON string.
 * @return {void} No return value.
 */
export function validateManifestSanity(manifestContent: string): void {
  let parsedManifest: GasManifest;
  try {
    parsedManifest = JSON.parse(manifestContent) as GasManifest;
  } catch (err) {
    throw new BuildStageError(STAGE_ID, 'Final appsscript.json is not valid JSON.', err);
  }

  if (!Array.isArray(parsedManifest.oauthScopes) || parsedManifest.oauthScopes.length === 0) {
    throw new BuildStageError(STAGE_ID, 'Final appsscript.json must include a non-empty oauthScopes array.');
  }

  const duplicatedScopes = parsedManifest.oauthScopes.filter(
    (scope, index, list) => list.indexOf(scope) !== index,
  );
  if (duplicatedScopes.length > 0) {
    throw new BuildStageError(
      STAGE_ID,
      `Final appsscript.json contains duplicated oauth scopes: ${[...new Set(duplicatedScopes)].join(', ')}`,
    );
  }

  const services = parsedManifest.dependencies?.enabledAdvancedServices;
  if (services) {
    if (!Array.isArray(services)) {
      throw new BuildStageError(
        STAGE_ID,
        'Final appsscript.json dependencies.enabledAdvancedServices must be an array when present.',
      );
    }

    const serviceIds = services.map((service) => service.serviceId);
    const duplicatedServiceIds = serviceIds.filter(
      (serviceId, index, list) => list.indexOf(serviceId) !== index,
    );

    if (duplicatedServiceIds.length > 0) {
      throw new BuildStageError(
        STAGE_ID,
        `Final appsscript.json contains duplicated advanced services: ${[...new Set(duplicatedServiceIds)].join(', ')}`,
      );
    }
  }
}

/**
 * Validates HtmlService output does not reference forbidden external assets.
 *
 * @param {string} reactAppHtml - ReactApp HtmlService template content.
 * @return {void} No return value.
 */
export function validateForbiddenFrontendReferences(reactAppHtml: string): void {
  for (const pattern of FORBIDDEN_ASSET_PATTERNS) {
    if (pattern.test(reactAppHtml)) {
      throw new BuildStageError(
        STAGE_ID,
        'Final UI/ReactApp.html still contains forbidden external asset references.',
      );
    }
  }
}

/**
 * Detects duplicate protected global declarations across GAS JavaScript files.
 *
 * @param {Record<string, string>} jsSourcesByPath - JavaScript sources keyed by relative file path.
 * @return {Record<string, string[]>} Duplicate declarations keyed by symbol name.
 */
export function findDuplicateProtectedGlobals(
  jsSourcesByPath: Record<string, string>,
): Record<string, string[]> {
  const protectedDeclarations = new Map<string, Set<string>>();

  for (const [relativePath, source] of Object.entries(jsSourcesByPath)) {
    const declaredNames = scanFileTopLevelDeclarations(source);

    for (const symbol of PROTECTED_GLOBALS) {
      if (declaredNames.includes(symbol)) {
        if (!protectedDeclarations.has(symbol)) {
          protectedDeclarations.set(symbol, new Set<string>());
        }
        protectedDeclarations.get(symbol)?.add(relativePath);
      }
    }
  }

  const duplicates: Record<string, string[]> = {};
  for (const [symbol, files] of protectedDeclarations.entries()) {
    if (files.size > 1) {
      duplicates[symbol] = [...files].sort((left, right) => left.localeCompare(right));
    }
  }

  return duplicates;
}

/**
 * Scans JavaScript source for top-level declaration names only.
 *
 * @param {string} source - JavaScript source text.
 * @return {string[]} Declaration names detected at brace depth zero.
 */
export function scanFileTopLevelDeclarations(source: string): string[] {
  const sanitisedSource = sanitiseSourceForTopLevelScan(source);
  const names: string[] = [];
  const lines = sanitisedSource.split(/\r?\n/);
  let braceDepth = 0;

  for (const line of lines) {
    const depthBeforeLine = braceDepth;
    for (const character of line) {
      if (character === '{') {
        braceDepth += 1;
      } else if (character === '}') {
        braceDepth = Math.max(0, braceDepth - 1);
      }
    }

    if (depthBeforeLine !== 0) {
      continue;
    }

    const match = line.match(/^\s*(?:function|class|const|let|var)\s+([A-Za-z_$][\w$]*)\b/);
    if (match?.[1]) {
      names.push(match[1]);
    }
  }

  return names;
}

/**
 * Sanitises JavaScript source for declaration scanning by removing comment and string literal content.
 *
 * @param {string} source - JavaScript source text.
 * @return {string} Source with non-code literal/comment content replaced by spaces.
 */
function sanitiseSourceForTopLevelScan(source: string): string {
  const output: string[] = [];
  let index = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inTemplateLiteral = false;
  let inLineComment = false;
  let inBlockComment = false;
  let templateExpressionDepth = 0;

  while (index < source.length) {
    const character = source[index] ?? '';
    const nextCharacter = source[index + 1] ?? '';

    if (inLineComment) {
      if (character === '\n') {
        inLineComment = false;
        output.push('\n');
      } else {
        output.push(' ');
      }
      index += 1;
      continue;
    }

    if (inBlockComment) {
      if (character === '*' && nextCharacter === '/') {
        output.push(' ');
        output.push(' ');
        inBlockComment = false;
        index += 2;
      } else {
        output.push(character === '\n' ? '\n' : ' ');
        index += 1;
      }
      continue;
    }

    if (inSingleQuote) {
      if (character === '\\') {
        output.push(' ');
        output.push(nextCharacter === '\n' ? '\n' : ' ');
        index += 2;
        continue;
      }
      output.push(character === '\n' ? '\n' : ' ');
      if (character === "'") {
        inSingleQuote = false;
      }
      index += 1;
      continue;
    }

    if (inDoubleQuote) {
      if (character === '\\') {
        output.push(' ');
        output.push(nextCharacter === '\n' ? '\n' : ' ');
        index += 2;
        continue;
      }
      output.push(character === '\n' ? '\n' : ' ');
      if (character === '"') {
        inDoubleQuote = false;
      }
      index += 1;
      continue;
    }

    if (inTemplateLiteral) {
      if (character === '\\') {
        output.push(' ');
        output.push(nextCharacter === '\n' ? '\n' : ' ');
        index += 2;
        continue;
      }

      if (character === '$' && nextCharacter === '{') {
        output.push('$');
        output.push('{');
        inTemplateLiteral = false;
        templateExpressionDepth = 1;
        index += 2;
        continue;
      }

      output.push(character === '\n' ? '\n' : ' ');
      if (character === '`') {
        inTemplateLiteral = false;
      }
      index += 1;
      continue;
    }

    if (character === '/' && nextCharacter === '/') {
      output.push(' ');
      output.push(' ');
      inLineComment = true;
      index += 2;
      continue;
    }

    if (character === '/' && nextCharacter === '*') {
      output.push(' ');
      output.push(' ');
      inBlockComment = true;
      index += 2;
      continue;
    }

    if (character === "'") {
      output.push(' ');
      inSingleQuote = true;
      index += 1;
      continue;
    }

    if (character === '"') {
      output.push(' ');
      inDoubleQuote = true;
      index += 1;
      continue;
    }

    if (character === '`') {
      output.push(' ');
      inTemplateLiteral = true;
      index += 1;
      continue;
    }

    output.push(character);
    if (templateExpressionDepth > 0) {
      if (character === '{') {
        templateExpressionDepth += 1;
      } else if (character === '}') {
        templateExpressionDepth -= 1;
        if (templateExpressionDepth === 0) {
          inTemplateLiteral = true;
        }
      }
    }
    index += 1;
  }

  return output.join('');
}

/**
 * Runs final output validation checks and emits concise build metadata.
 *
 * @param {BuilderPaths} paths - Resolved builder path configuration.
 * @return {Promise<ValidateOutputResult>} Validation summary metadata.
 */
export async function runValidateOutput(paths: BuilderPaths): Promise<ValidateOutputResult> {
  try {
    const absoluteFiles = await listFilesRecursive(paths.buildGasDir);
    const relativeFiles = absoluteFiles
      .map((absolutePath) => path.relative(paths.buildGasDir, absolutePath).replace(/\\/g, '/'))
      .sort((left, right) => left.localeCompare(right));
    const relativeFileSet = new Set(relativeFiles);

    validateRequiredFiles(relativeFileSet);

    const manifestPath = path.join(paths.buildGasDir, 'appsscript.json');
    const reactAppPath = path.join(paths.buildGasDir, 'UI', 'ReactApp.html');

    const manifestContent = await fs.readFile(manifestPath, 'utf-8');
    validateManifestSanity(manifestContent);

    const reactAppHtml = await fs.readFile(reactAppPath, 'utf-8');
    validateForbiddenFrontendReferences(reactAppHtml);

    const jsSourcesByPath: Record<string, string> = {};
    for (const absolutePath of absoluteFiles) {
      if (!absolutePath.endsWith('.js')) {
        continue;
      }
      const relativePath = path.relative(paths.buildGasDir, absolutePath).replace(/\\/g, '/');
      jsSourcesByPath[relativePath] = await fs.readFile(absolutePath, 'utf-8');
    }

    const duplicateProtectedGlobals = findDuplicateProtectedGlobals(jsSourcesByPath);
    if (Object.keys(duplicateProtectedGlobals).length > 0) {
      const details = Object.entries(duplicateProtectedGlobals)
        .map(([symbol, files]) => `${symbol}: ${files.join(', ')}`)
        .join('; ');
      throw new BuildStageError(
        STAGE_ID,
        `Duplicate protected global declarations detected. Resolve collisions: ${details}`,
      );
    }

    const artefactSizes: Record<string, number> = {};
    for (const requiredPath of REQUIRED_FILES) {
      const absolutePath = path.join(paths.buildGasDir, requiredPath);
      const stats = await fs.stat(absolutePath);
      artefactSizes[requiredPath] = stats.size;
    }

    return {
      stage: STAGE_ID,
      outputPath: paths.buildGasDir,
      requiredFileCount: REQUIRED_FILES.length,
      gasFileCount: relativeFiles.length,
      duplicateProtectedGlobalCount: 0,
      artefactSizes,
    };
  } catch (err) {
    if (err instanceof BuildStageError) {
      throw err;
    }

    throw new BuildStageError(
      STAGE_ID,
      `Unable to validate final GAS output at ${paths.buildGasDir}.`,
      err,
    );
  }
}
