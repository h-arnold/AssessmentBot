import path from 'node:path';
import { promises as fs } from 'node:fs';
import ts from 'typescript';

import { BuildStageError } from '../lib/errors.js';
import { listFilesRecursive } from '../lib/fs.js';
import { checksumUtf8 } from '../lib/hash.js';
import type { BuilderPaths, ValidateOutputResult } from '../types.js';

const STAGE_ID = 'validate-output' as const;
const REQUIRED_FILES = ['appsscript.json', 'JsonDbApp.inlined.js', 'UI/ReactApp.html'];
const PROTECTED_GLOBALS = ['Validate', 'JsonDbApp'];
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
 * Ensures required final GAS output files are present.
 *
 * @param {Set<string>} relativeFiles - Relative output file paths.
 * @returns {void} No return value.
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
 * @returns {void} No return value.
 */
export function validateManifestSanity(manifestContent: string): void {
  const parsedManifest = parseManifestContent(manifestContent);
  validateOauthScopes(parsedManifest.oauthScopes);
  validateAdvancedServices(parsedManifest.dependencies?.enabledAdvancedServices);
}

/**
 * Validates HtmlService output does not reference forbidden external assets.
 *
 * @param {string} reactAppHtml - ReactApp HtmlService template content.
 * @returns {void} No return value.
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
 * @returns {Record<string, string[]>} Duplicate declarations keyed by symbol name.
 */
export function findDuplicateProtectedGlobals(
  jsSourcesByPath: Record<string, string>,
): Record<string, string[]> {
  const protectedDeclarations = new Map<string, Set<string>>();

  for (const [relativePath, source] of Object.entries(jsSourcesByPath)) {
    addProtectedDeclarationMatches(protectedDeclarations, relativePath, scanFileTopLevelDeclarations(source));
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
 * @returns {string[]} Declaration names detected at brace depth zero.
 */
export function scanFileTopLevelDeclarations(source: string): string[] {
  const names: string[] = [];
  const sourceFile = ts.createSourceFile('build-output.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);

  for (const statement of sourceFile.statements) {
    const declarationNames = getTopLevelDeclarationNames(statement);
    names.push(...declarationNames);
  }

  return names;
}

/**
 * Parses manifest JSON and wraps parse failures with stage context.
 *
 * @param {string} manifestContent - Raw manifest JSON string.
 * @returns {GasManifest} Parsed manifest object.
 */
function parseManifestContent(manifestContent: string): GasManifest {
  try {
    return JSON.parse(manifestContent) as GasManifest;
  } catch (err) {
    throw new BuildStageError(STAGE_ID, 'Final appsscript.json is not valid JSON.', err);
  }
}

/**
 * Validates oauth scope requirements for the merged manifest.
 *
 * @param {string[] | undefined} oauthScopes - Optional oauth scopes list.
 * @returns {void} No return value.
 */
function validateOauthScopes(oauthScopes: string[] | undefined): void {
  if (!Array.isArray(oauthScopes) || oauthScopes.length === 0) {
    throw new BuildStageError(STAGE_ID, 'Final appsscript.json must include a non-empty oauthScopes array.');
  }

  const duplicatedScopes = findDuplicatedValues(oauthScopes);
  if (duplicatedScopes.length === 0) {
    return;
  }

  throw new BuildStageError(
    STAGE_ID,
    `Final appsscript.json contains duplicated oauth scopes: ${[...new Set(duplicatedScopes)].join(', ')}`,
  );
}

/**
 * Validates advanced services requirements for the merged manifest.
 *
 * @param {GasManifest['dependencies']['enabledAdvancedServices']} services - Optional advanced services list.
 * @returns {void} No return value.
 */
function validateAdvancedServices(
  services: NonNullable<GasManifest['dependencies']>['enabledAdvancedServices'],
): void {
  if (!services) {
    return;
  }

  if (!Array.isArray(services)) {
    throw new BuildStageError(
      STAGE_ID,
      'Final appsscript.json dependencies.enabledAdvancedServices must be an array when present.',
    );
  }

  const duplicatedServiceIds = findDuplicatedValues(services.map((service) => service.serviceId));
  if (duplicatedServiceIds.length === 0) {
    return;
  }

  throw new BuildStageError(
    STAGE_ID,
    `Final appsscript.json contains duplicated advanced services: ${[...new Set(duplicatedServiceIds)].join(', ')}`,
  );
}

/**
 * Returns duplicate values while preserving repeated entries.
 *
 * @param {string[]} values - Input values.
 * @returns {string[]} Values that appear more than once.
 */
function findDuplicatedValues(values: string[]): string[] {
  return values.filter((value, index, list) => list.indexOf(value) !== index);
}

/**
 * Adds declaration matches for protected symbols from one source file.
 *
 * @param {Map<string, Set<string>>} protectedDeclarations - Collected protected declarations map.
 * @param {string} relativePath - Relative source path being processed.
 * @param {string[]} declaredNames - Top-level declarations found in source.
 * @returns {void} No return value.
 */
function addProtectedDeclarationMatches(
  protectedDeclarations: Map<string, Set<string>>,
  relativePath: string,
  declaredNames: string[],
): void {
  for (const symbol of PROTECTED_GLOBALS) {
    if (!declaredNames.includes(symbol)) {
      continue;
    }

    if (!protectedDeclarations.has(symbol)) {
      protectedDeclarations.set(symbol, new Set<string>());
    }

    protectedDeclarations.get(symbol)!.add(relativePath);
  }
}

/**
 * Extracts top-level declaration names from a parsed JavaScript statement node.
 *
 * @param {ts.Statement} statement - TypeScript AST statement node.
 * @returns {string[]} Declaration names from supported declaration statements.
 */
function getTopLevelDeclarationNames(statement: ts.Statement): string[] {
  if (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) {
    return statement.name ? [statement.name.text] : [];
  }

  if (!ts.isVariableStatement(statement)) {
    return [];
  }

  return statement.declarationList.declarations
    .map((declaration) => declaration.name)
    .filter((name): name is ts.Identifier => ts.isIdentifier(name))
    .map((identifier) => identifier.text);
}

/**
 * Runs final output validation checks and emits concise build metadata.
 *
 * @param {BuilderPaths} paths - Resolved builder path configuration.
 * @returns {Promise<ValidateOutputResult>} Validation summary metadata.
 */
export async function runValidateOutput(paths: BuilderPaths): Promise<ValidateOutputResult> {
  try {
    const absoluteFiles = await listFilesRecursive(paths.buildGasDir);
    const relativeFiles = absoluteFiles
      .map((absolutePath) => path.relative(paths.buildGasDir, absolutePath).replaceAll('\\\\', '/'))
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
      const relativePath = path.relative(paths.buildGasDir, absolutePath).replaceAll('\\\\', '/');
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
    const artefactChecksums: Record<string, string> = {};
    for (const requiredPath of REQUIRED_FILES) {
      const absolutePath = path.join(paths.buildGasDir, requiredPath);
      const content = await fs.readFile(absolutePath, 'utf-8');
      const stats = await fs.stat(absolutePath);
      artefactSizes[requiredPath] = stats.size;
      artefactChecksums[requiredPath] = checksumUtf8(content);
    }

    return {
      stage: STAGE_ID,
      outputPath: paths.buildGasDir,
      requiredFileCount: REQUIRED_FILES.length,
      gasFileCount: relativeFiles.length,
      duplicateProtectedGlobalCount: 0,
      artefactSizes,
      artefactChecksums,
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
