import path from 'node:path';
import { promises as fs } from 'node:fs';

import { isErrnoExceptionWithCode } from '../../lib/fs.js';
import type { SessionManifest } from '../storage/session-storage.js';

type RegressionTool = 'eslint' | 'vitest' | 'playwright' | 'tsc';

export const JSON_INDENT_SPACES = 2;

/**
 * Reads a raw artefact from disk and decodes JSON artefacts automatically.
 *
 * @param {string} rawArtefactPath - Absolute raw artefact path.
 * @returns {Promise<unknown>} Parsed JSON or raw text content.
 */
export async function readRawArtefactFromDisk(rawArtefactPath: string): Promise<unknown> {
  const artefactText = await fs.readFile(rawArtefactPath, 'utf8');
  if (!rawArtefactPath.endsWith('.json')) {
    return artefactText;
  }

  try {
    return JSON.parse(normaliseJsonArtefactText(artefactText));
  } catch (error) {
    if (error instanceof SyntaxError) {
      return artefactText;
    }

    throw error;
  }
}

/**
 * Writes UTF-8 file content, creating parent directories as needed.
 *
 * @param {string} targetPath - Absolute path to write.
 * @param {string} content - File content.
 * @returns {Promise<void>} Resolves after writing completes.
 */
export async function writeFileToDisk(targetPath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, content, 'utf8');
}

/**
 * Writes a session manifest to disk.
 *
 * @param {string} manifestPath - Absolute manifest path.
 * @param {SessionManifest} manifest - Manifest data.
 * @returns {Promise<void>} Resolves after writing completes.
 */
export async function writeSessionManifest(
  manifestPath: string,
  manifest: SessionManifest
): Promise<void> {
  await writeFileToDisk(manifestPath, JSON.stringify(manifest, null, JSON_INDENT_SPACES));
}

/**
 * Persists tool-specific command output to a raw artefact file.
 * For eslint and vitest, the tool writes its own JSON output via CLI flags,
 * but on failure the tool may not write anything, so we fallback to captured output.
 * For tsc and playwright, we always write the captured output.
 *
 * @param {{ tool: RegressionTool; rawArtefactPath: string; commandOutput: { stdout: string; stderr: string } }} options
 * Persistence inputs.
 * @param {RegressionTool} options.tool - Tool family for output handling.
 * @param {string} options.rawArtefactPath - Absolute raw artefact path.
 * @param {{ stdout: string; stderr: string }} options.commandOutput - Command output payload.
 * @param {string} options.commandOutput.stdout - Captured stdout.
 * @param {string} options.commandOutput.stderr - Captured stderr.
 * @returns {Promise<void>} Resolves once any required write completes.
 */
export async function persistCapturedArtefact(options: {
  tool: RegressionTool;
  rawArtefactPath: string;
  commandOutput: { stdout: string; stderr: string };
}): Promise<void> {
  // For eslint and vitest, check if the tool already wrote its own file
  // (they use --output-file or --outputFile flags). If the file exists and
  // has content, assume the tool wrote it successfully. Otherwise, fall back
  // to writing the captured output (which includes error messages for failures).
  if (options.tool === 'eslint' || options.tool === 'vitest') {
    try {
      const existingContent = await fs.readFile(options.rawArtefactPath, 'utf8');
      if (existingContent.trim().length > 0) {
        return;
      }
    } catch (error) {
      if (!isErrnoExceptionWithCode(error, 'ENOENT')) {
        throw error;
      }
    }
  }

  await writeFileToDisk(options.rawArtefactPath, buildCapturedArtefactContent(options));
}

/**
 * Builds the raw artefact content to persist from captured command output.
 *
 * @param {{ tool: RegressionTool; rawArtefactPath: string; commandOutput: { stdout: string; stderr: string } }} options
 * Captured tool output details.
 * @param {RegressionTool} options.tool - Tool family for output handling.
 * @param {string} options.rawArtefactPath - Target raw artefact path.
 * @param {{ stdout: string; stderr: string }} options.commandOutput - Captured command output.
 * @param {string} options.commandOutput.stdout - Captured stdout stream.
 * @param {string} options.commandOutput.stderr - Captured stderr stream.
 * @returns {string} Artefact content ready to write.
 */
function buildCapturedArtefactContent(options: {
  tool: RegressionTool;
  rawArtefactPath: string;
  commandOutput: { stdout: string; stderr: string };
}): string {
  const combinedContent = buildCombinedCommandOutput(options.commandOutput);
  if (!options.rawArtefactPath.endsWith('.json')) {
    return combinedContent;
  }

  const stdoutContent = normaliseJsonArtefactText(options.commandOutput.stdout);
  if (isJsonDocument(stdoutContent)) {
    return stdoutContent;
  }

  const combinedJson = normaliseJsonArtefactText(combinedContent);
  if (isJsonDocument(combinedJson)) {
    return combinedJson;
  }

  return combinedContent;
}

/**
 * Combines captured command streams for text artefacts and non-JSON fallback output.
 *
 * @param {{ stdout: string; stderr: string }} commandOutput - Captured stdout and stderr.
 * @param {string} commandOutput.stdout - Captured stdout stream.
 * @param {string} commandOutput.stderr - Captured stderr stream.
 * @returns {string} Combined output with stderr before stdout.
 */
function buildCombinedCommandOutput(commandOutput: { stdout: string; stderr: string }): string {
  const stdoutContent = commandOutput.stdout.trim();
  const stderrContent = commandOutput.stderr.trim();
  return [stderrContent, stdoutContent].filter((output) => output.length > 0).join('\n');
}

/**
 * Normalises npm-wrapped JSON artefact text by removing script banners when the
 * remaining content is still a JSON document.
 *
 * @param {string} artefactText - Raw captured or read artefact text.
 * @returns {string} Normalised JSON text when the payload is banner-prefixed, otherwise the original text.
 */
function normaliseJsonArtefactText(artefactText: string): string {
  const bannerlessText = stripLeadingNpmScriptOutput(artefactText);
  return isJsonDocument(bannerlessText) ? bannerlessText : artefactText;
}

/**
 * Checks whether a string is parseable JSON.
 *
 * @param {string} text - Candidate JSON text.
 * @returns {boolean} `true` when the text parses as JSON.
 */
function isJsonDocument(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch (error) {
    if (error instanceof SyntaxError) {
      return false;
    }

    throw error;
  }
}

/**
 * Removes leading npm script banner lines and blank lines from captured output.
 *
 * @param {string} artefactText - Raw captured artefact text.
 * @returns {string} Text without npm banners at the start.
 */
function stripLeadingNpmScriptOutput(artefactText: string): string {
  const lines = artefactText.split(/\r?\n/u);
  let firstContentLineIndex = 0;

  while (firstContentLineIndex < lines.length) {
    // eslint-disable-next-line security/detect-object-injection
    const line = lines[firstContentLineIndex];
    const trimmedLine = line.trimStart();
    if (trimmedLine.length === 0) {
      firstContentLineIndex += 1;
      continue;
    }

    if (trimmedLine.startsWith('{') || trimmedLine.startsWith('[')) {
      break;
    }

    if (trimmedLine.startsWith('> ') || /^npm (WARN|notice|ERR!) /u.test(trimmedLine)) {
      firstContentLineIndex += 1;
      continue;
    }

    break;
  }

  return lines.slice(firstContentLineIndex).join('\n');
}

/**
 * Resolves a session artefact path to an absolute path within the session directory.
 *
 * @param {string} sessionDirectory - Absolute session directory.
 * @param {string} relativeArtefactPath - Manifest path stored for the artefact.
 * @returns {string} Absolute artefact path within the session directory.
 */
export function resolveSessionArtefactPath(
  sessionDirectory: string,
  relativeArtefactPath: string
): string {
  const resolvedPath = path.resolve(sessionDirectory, relativeArtefactPath);
  const relativePath = path.relative(sessionDirectory, resolvedPath);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(
      `Unsafe session artefact path escapes the session directory: ${relativeArtefactPath}`
    );
  }

  return resolvedPath;
}
