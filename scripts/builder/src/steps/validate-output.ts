import path from 'node:path';
import { promises as fs } from 'node:fs';
import ts from 'typescript';

import { BuildStageError } from '../lib/errors.js';
import { listFilesRecursive, normalisePathSeparators } from '../lib/fs.js';
import { checksumUtf8 } from '../lib/hash.js';
import type { BuilderPaths, ValidateOutputResult } from '../types.js';
import type { GasIncompatibleSyntax } from './validate-output.zod.js';

const STAGE_ID = 'validate-output' as const;
const REQUIRED_FILES = ['appsscript.json', 'JsonDbApp.inlined.js', 'UI/ReactApp.html'];
const PROTECTED_GLOBALS = ['Validate', 'JsonDbApp'];
const FORBIDDEN_ASSET_PATTERNS = [
  /(?:src|href)=["']https?:\/\//i,
  /(?:src|href)=["']\/assets\//i,
  /(?:src|href)=["']\.\/assets\//i,
  /(?:src|href)=["']assets\//i,
];

/**
 * Logical assignment operators the Apps Script script parser rejects.
 *
 * The Apps Script parser is older than the V8 runtime it executes, so ES2021 logical
 * assignment fails to save with `ParseError: Unexpected token =` even though V8 supports it.
 */
const GAS_INCOMPATIBLE_LOGICAL_ASSIGNMENTS = new Map<ts.SyntaxKind, string>([
  [ts.SyntaxKind.BarBarEqualsToken, '||='],
  [ts.SyntaxKind.AmpersandAmpersandEqualsToken, '&&='],
  [ts.SyntaxKind.QuestionQuestionEqualsToken, '??='],
]);

/**
 * A single construct the Apps Script script parser cannot parse.
 */
export type { GasIncompatibleSyntax } from './validate-output.zod.js';

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
      `Final output is missing required files: ${missingFiles.join(', ')}`
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
        'Final UI/ReactApp.html still contains forbidden external asset references.'
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
  jsSourcesByPath: Record<string, string>
): Record<string, string[]> {
  const protectedDeclarations = new Map<string, Set<string>>();

  for (const [relativePath, source] of Object.entries(jsSourcesByPath)) {
    addProtectedDeclarationMatches(
      protectedDeclarations,
      relativePath,
      scanFileTopLevelDeclarations(source)
    );
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
 * Finds syntax the Apps Script script parser rejects.
 *
 * The Apps Script script parser is older than the V8 runtime it executes. It refuses
 * class field declarations (`createdAt;`, `static count = 0;`, `#private;`), class static
 * initialisation blocks and ES2021 logical assignment, so a pushed build fails with
 * `ParseError: Unexpected token ;` or `ParseError: Unexpected token =`.
 *
 * This runs against the emitted artefact rather than the source tree so that vendored
 * code — which no lint scope covers — is checked before deployment.
 *
 * @param {Record<string, string>} jsSourcesByPath - JavaScript sources keyed by relative file path.
 * @returns {GasIncompatibleSyntax[]} Incompatible constructs with their file and line.
 */
export function findGasIncompatibleSyntax(
  jsSourcesByPath: Record<string, string>
): GasIncompatibleSyntax[] {
  const findings: GasIncompatibleSyntax[] = [];

  for (const [relativePath, source] of Object.entries(jsSourcesByPath)) {
    const sourceFile = ts.createSourceFile(
      'build-output.js',
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.JS
    );

    const visit = (node: ts.Node): void => {
      const construct = describeGasIncompatibleConstruct(node);
      if (construct) {
        findings.push({
          relativePath,
          line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
          construct,
        });
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  }

  return findings;
}

/**
 * Describes a node when the Apps Script script parser cannot parse it.
 *
 * @param {ts.Node} node - Node to inspect.
 * @returns {string | null} Human-readable construct name, or null when the node is parseable.
 */
function describeGasIncompatibleConstruct(node: ts.Node): string | null {
  // TypeScript only emits `PropertyDeclaration` for class members, never for object literals.
  if (ts.isPropertyDeclaration(node)) {
    return 'class field declaration';
  }

  if (ts.isClassStaticBlockDeclaration(node)) {
    return 'class static initialisation block';
  }

  if (ts.isBinaryExpression(node)) {
    const operator = GAS_INCOMPATIBLE_LOGICAL_ASSIGNMENTS.get(node.operatorToken.kind);
    return operator ? `logical assignment (${operator})` : null;
  }

  return null;
}

/**
 * Scans JavaScript source for top-level declaration names only.
 *
 * @param {string} source - JavaScript source text.
 * @returns {string[]} Declaration names detected at brace depth zero.
 */
export function scanFileTopLevelDeclarations(source: string): string[] {
  const names: string[] = [];
  const sourceFile = ts.createSourceFile(
    'build-output.js',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS
  );

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
    throw new BuildStageError(
      STAGE_ID,
      'Final appsscript.json must include a non-empty oauthScopes array.'
    );
  }

  const duplicatedScopes = findDuplicatedValues(oauthScopes);
  if (duplicatedScopes.length === 0) {
    return;
  }

  throw new BuildStageError(
    STAGE_ID,
    `Final appsscript.json contains duplicated oauth scopes: ${[...new Set(duplicatedScopes)].join(', ')}`
  );
}

/**
 * Validates advanced services requirements for the merged manifest.
 *
 * @param {GasManifest['dependencies']['enabledAdvancedServices']} services - Optional advanced services list.
 * @returns {void} No return value.
 */
function validateAdvancedServices(
  services: NonNullable<GasManifest['dependencies']>['enabledAdvancedServices']
): void {
  if (!services) {
    return;
  }

  if (!Array.isArray(services)) {
    throw new BuildStageError(
      STAGE_ID,
      'Final appsscript.json dependencies.enabledAdvancedServices must be an array when present.'
    );
  }

  const duplicatedServiceIds = findDuplicatedValues(services.map((service) => service.serviceId));
  if (duplicatedServiceIds.length === 0) {
    return;
  }

  throw new BuildStageError(
    STAGE_ID,
    `Final appsscript.json contains duplicated advanced services: ${[...new Set(duplicatedServiceIds)].join(', ')}`
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
  declaredNames: string[]
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
 * Reads every JavaScript source emitted into the final GAS output.
 *
 * @param {string[]} absoluteFiles - Absolute paths of the emitted files.
 * @param {string} buildGasDir - Absolute path of the final GAS output directory.
 * @returns {Promise<Record<string, string>>} JavaScript sources keyed by relative file path.
 */
async function readJavaScriptSources(
  absoluteFiles: string[],
  buildGasDir: string
): Promise<Record<string, string>> {
  const jsSourcesByPath: Record<string, string> = {};

  for (const absolutePath of absoluteFiles) {
    if (!absolutePath.endsWith('.js')) {
      continue;
    }
    const relativePath = normalisePathSeparators(path.relative(buildGasDir, absolutePath));
    jsSourcesByPath[relativePath] = await fs.readFile(absolutePath, 'utf-8');
  }

  return jsSourcesByPath;
}

/**
 * Fails the build when protected global declarations collide across emitted files.
 *
 * @param {Record<string, string>} jsSourcesByPath - JavaScript sources keyed by relative file path.
 * @returns {void} No return value.
 */
function validateProtectedGlobalUniqueness(jsSourcesByPath: Record<string, string>): void {
  const duplicateProtectedGlobals = findDuplicateProtectedGlobals(jsSourcesByPath);
  if (Object.keys(duplicateProtectedGlobals).length === 0) {
    return;
  }

  const details = Object.entries(duplicateProtectedGlobals)
    .map(([symbol, files]) => `${symbol}: ${files.join(', ')}`)
    .join('; ');
  throw new BuildStageError(
    STAGE_ID,
    `Duplicate protected global declarations detected. Resolve collisions: ${details}`
  );
}

/**
 * Fails the build when the emitted script uses syntax the Apps Script script parser rejects.
 *
 * @param {Record<string, string>} jsSourcesByPath - JavaScript sources keyed by relative file path.
 * @returns {void} No return value.
 */
function validateGasCompatibleSyntax(jsSourcesByPath: Record<string, string>): void {
  const gasIncompatibleSyntax = findGasIncompatibleSyntax(jsSourcesByPath);
  if (gasIncompatibleSyntax.length === 0) {
    return;
  }

  const details = gasIncompatibleSyntax
    .map(({ relativePath, line, construct }) => `${construct} at ${relativePath}:${line}`)
    .join('; ');
  throw new BuildStageError(
    STAGE_ID,
    `Apps Script cannot parse the emitted script. Replace each construct with syntax its parser accepts: ${details}`
  );
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
      .map((absolutePath) =>
        normalisePathSeparators(path.relative(paths.buildGasDir, absolutePath))
      )
      .sort((left, right) => left.localeCompare(right));

    validateRequiredFiles(new Set(relativeFiles));

    const manifestPath = path.join(paths.buildGasDir, 'appsscript.json');
    const reactAppPath = path.join(paths.buildGasDir, 'UI', 'ReactApp.html');

    const manifestContent = await fs.readFile(manifestPath, 'utf-8');
    validateManifestSanity(manifestContent);

    const reactAppHtml = await fs.readFile(reactAppPath, 'utf-8');
    validateForbiddenFrontendReferences(reactAppHtml);

    const jsSourcesByPath = await readJavaScriptSources(absoluteFiles, paths.buildGasDir);
    validateProtectedGlobalUniqueness(jsSourcesByPath);
    validateGasCompatibleSyntax(jsSourcesByPath);

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
      gasIncompatibleSyntaxCount: 0,
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
      err
    );
  }
}
