import {
  chmodSync,
  closeSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  renameSync,
  rmSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as prettier from 'prettier';

import { validateSyntheticAnalysisGraph } from './validateSyntheticAnalysisGraph.js';

/**
 * Staged writer for compact and full synthetic analysis profile outputs.
 *
 * @remarks
 * A profile is validated and written into a staging directory first. The
 * committed profile directory is replaced only after every profile in the set
 * has been staged successfully, so a generation, invariant, serialisation, or
 * staging-write failure leaves the existing committed set untouched. The
 * replacement phase keeps each displaced directory as a backup and rolls every
 * applied replacement back if a later replacement fails, so the committed set
 * is never left partially regenerated. For either a compact profile or the
 * uncommitted full-large corpus the writer persists only the transport views
 * and manifest; the in-memory `persistence` graph is never written, and
 * full-output-root enforcement is left to the caller in
 * `generateSyntheticAnalysisFixtures.js`.
 *
 * Every view is serialised as JSON and then formatted with the installed
 * Prettier configuration resolved from its canonical committed fixture path,
 * so scratch and staging output share the committed byte representation. A
 * view too large for a single V8 string is instead written to its staging file
 * entry by entry using the resolved Prettier print width, so the emitted bytes
 * stay identical to the whole-view path without ever allocating an oversized
 * string. Staging and writing are asynchronous:
 * callers must await `stageProfileFixtures` and `writeProfileFixtures` before
 * treating the committed set as replaced. Replacement and cleanup
 * (`commitStagedProfiles` and `discardStagedProfile`) are synchronous.
 */

const JSON_INDENT_SPACES = 2;
const LINE_BREAK = '\n';
const INVALID_STRING_LENGTH_MESSAGE = 'Invalid string length';
const WRITE_BUFFER_BYTES = 65536;
const STAGING_PREFIX = '.synthetic-staging-';
const BACKUP_SUFFIX = '-previous';
const PROFILE_DIRECTORY_MODE = 0o755;
const REPOSITORY_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const COMMITTED_FIXTURE_DIRECTORY = join(
  REPOSITORY_ROOT,
  'tests/__mocks__/data/synthetic-analysis'
);

/**
 * Maps each named corpus view to the file it is persisted under. The writer and
 * the synchronous profile loader both derive their file names from this map.
 */
export const PROFILE_VIEW_FILE_NAMES = new Map([
  ['manifest', 'manifest.json'],
  ['classPartials', 'classPartials.json'],
  ['assignmentDefinitionPartials', 'assignmentDefinitionPartials.json'],
  ['editableDefinitions', 'editableDefinitions.json'],
  ['classesById', 'classesById.json'],
  ['assignmentsByKey', 'assignmentsByKey.json'],
]);

/**
 * Reports whether an error is V8's hard max-string-length failure, which cannot
 * be raised by heap flags and therefore needs a streaming serialisation path.
 *
 * @param {unknown} error The caught error to classify.
 * @returns {boolean} True when the error is the max-string-length `RangeError`.
 */
function isStringLengthError(error) {
  return error instanceof RangeError && error.message === INVALID_STRING_LENGTH_MESSAGE;
}

/**
 * Reports whether a value is a JSON scalar rather than a container.
 *
 * @param {unknown} value The value to classify.
 * @returns {boolean} True for null and all non-object values.
 */
function isScalarValue(value) {
  return value === null || typeof value !== 'object';
}

/**
 * Builds the single-line form Prettier emits for a JSON value whose source was
 * produced with two-space indentation. Such objects always stay expanded, so
 * this form is only used for scalars and scalar-only arrays that fit.
 *
 * @param {unknown} value The value to render inline.
 * @returns {string} The single-line JSON representation.
 */
function formatInlineValue(value) {
  if (isScalarValue(value)) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(formatInlineValue).join(', ')}]`;
  }
  return '{}';
}

/**
 * Reports whether a scalar-only array fits on its current line. Prettier's fit
 * check includes the print width and a trailing comma for a non-final entry.
 *
 * @param {unknown} value The candidate value.
 * @param {number} column Column at which the value starts.
 * @param {number} printWidth Configured Prettier print width.
 * @param {boolean} isLast Whether the value is the last entry of its parent.
 * @returns {boolean} True when the array should be emitted on one line.
 */
function fitsOnOneLine(value, column, printWidth, isLast) {
  if (!Array.isArray(value) || value.length === 0) {
    return false;
  }
  if (value.some((item) => !isScalarValue(item))) {
    return false;
  }
  const trailingComma = isLast ? 0 : 1;
  return column + formatInlineValue(value).length + trailingComma <= printWidth;
}

/**
 * Creates a buffered file writer so a large view is flushed in bounded chunks
 * rather than with one write per JSON token.
 *
 * @param {number} descriptor Open file descriptor to write into.
 * @returns {{write: (text: string) => void, flush: () => void}} Buffered write and final flush functions.
 */
function createBufferedWriter(descriptor) {
  let buffer = '';
  const writeBuffer = () => {
    const bytes = Buffer.from(buffer);
    let written = 0;
    while (written < bytes.length) {
      written += writeSync(descriptor, bytes, written, bytes.length - written);
    }
    buffer = '';
  };
  return {
    write: (text) => {
      buffer += text;
      if (buffer.length >= WRITE_BUFFER_BYTES) {
        writeBuffer();
      }
    },
    flush: () => {
      if (buffer.length > 0) {
        writeBuffer();
      }
    },
  };
}

/**
 * Appends the entries of one object or array across successive lines.
 *
 * @param {object|Array} value Container whose entries are appended.
 * @param {boolean} isArray Whether the container is an array.
 * @param {number} indent Indentation of the container's own line.
 * @param {number} printWidth Configured Prettier print width.
 * @param {{write: (text: string) => void}} writer Buffered writer to append into.
 * @returns {void}
 */
function appendContainerEntries(value, isArray, indent, printWidth, writer) {
  const entries = isArray ? value.map((item, index) => [index, item]) : Object.entries(value);

  for (const [index, [key, item]] of entries.entries()) {
    writer.write(' '.repeat(indent + JSON_INDENT_SPACES));
    let valueColumn = indent + JSON_INDENT_SPACES;
    if (!isArray) {
      const keyToken = JSON.stringify(key);
      writer.write(`${keyToken}: `);
      valueColumn += keyToken.length + ': '.length;
    }
    appendValue(
      item,
      indent + JSON_INDENT_SPACES,
      valueColumn,
      printWidth,
      writer,
      index === entries.length - 1
    );
    if (index < entries.length - 1) {
      writer.write(',');
    }
    writer.write(LINE_BREAK);
  }
}

/**
 * Appends one JSON value at the given indentation and starting column.
 *
 * @param {unknown} value The value to append.
 * @param {number} indent Indentation of the value's own line.
 * @param {number} column Column at which the value starts.
 * @param {number} printWidth Configured Prettier print width.
 * @param {{write: (text: string) => void}} writer Buffered writer to append into.
 * @param {boolean} isLast Whether the value is the last entry of its parent.
 * @returns {void}
 */
function appendValue(value, indent, column, printWidth, writer, isLast) {
  const isArray = Array.isArray(value);
  if (
    isScalarValue(value) ||
    (isArray ? value.length === 0 : Object.keys(value).length === 0) ||
    fitsOnOneLine(value, column, printWidth, isLast)
  ) {
    writer.write(formatInlineValue(value));
    return;
  }

  writer.write(isArray ? '[' : '{');
  writer.write(LINE_BREAK);
  appendContainerEntries(value, isArray, indent, printWidth, writer);
  writer.write(' '.repeat(indent));
  writer.write(isArray ? ']' : '}');
}

/**
 * Writes a view directly to its staging file in bounded chunks, reproducing the
 * bytes of the stringify-plus-Prettier path without ever building a single
 * oversized string. Objects stay expanded as in the stringify source and arrays
 * of scalars collapse when they fit inside the configured print width.
 *
 * @param {unknown} view The view to serialise incrementally.
 * @param {object|null} configuration Prettier configuration resolved from the canonical path.
 * @param {string} destinationPath Staging file to write the view into.
 * @returns {void}
 */
function streamViewToFile(view, configuration, destinationPath) {
  const isArrayView = Array.isArray(view);
  const descriptor = openSync(destinationPath, 'w');
  const writer = createBufferedWriter(descriptor);

  try {
    writer.write(isArrayView ? '[' : '{');
    writer.write(LINE_BREAK);
    appendContainerEntries(view, isArrayView, 0, configuration.printWidth, writer);
    writer.write(isArrayView ? ']' : '}');
    writer.write(LINE_BREAK);
    writer.flush();
  } finally {
    closeSync(descriptor);
  }
}

/**
 * Serialises one view to its persisted on-disk representation.
 *
 * @param {unknown} view The view to serialise.
 * @param {string} filePath Canonical committed fixture path passed as Prettier's filepath option.
 * @param {string} destinationPath Staging file used only when the view cannot fit in a single string.
 * @param {object|null} configuration Prettier configuration resolved once from the first view's committed path.
 * @returns {Promise<string|null>} Prettier-formatted JSON, or null when the view was streamed straight to its staging file.
 */
async function serialiseView(view, filePath, destinationPath, configuration) {
  try {
    const source = `${JSON.stringify(view, null, JSON_INDENT_SPACES)}${LINE_BREAK}`;
    return await prettier.format(source, { ...configuration, filepath: filePath });
  } catch (error) {
    if (!isStringLengthError(error)) {
      throw error;
    }
    streamViewToFile(view, configuration, destinationPath);
    return null;
  }
}

/**
 * Builds the file name to serialised content map for a graph's persisted views,
 * deriving every file name from the exported view mapping so the writer and the
 * synchronous loader cannot drift apart.
 *
 * A view too large for a single string is written directly into the staging
 * directory during serialisation and resolves to no in-memory content, so the
 * writer must not try to write it a second time.
 *
 * @param {object} graph The generated logical graph.
 * @param {string} stagingDirectory Directory streamed views are written into.
 * @returns {Promise<Map<string, string>>} In-memory serialised file contents keyed by file name.
 */
async function buildProfileViewContents(graph, stagingDirectory) {
  const views = new Map([
    ['manifest', graph.manifest],
    ['classPartials', graph.transport.classPartials],
    ['assignmentDefinitionPartials', graph.transport.assignmentDefinitionPartials],
    ['editableDefinitions', graph.transport.editableDefinitions],
    ['classesById', graph.transport.classesById],
    ['assignmentsByKey', graph.transport.assignmentsByKey],
  ]);

  // Every view shares one committed fixture directory, so a single resolution
  // of the Prettier config preserves the byte representation of all six views.
  const firstFileName = PROFILE_VIEW_FILE_NAMES.values().next().value;
  const configuration = await prettier.resolveConfig(
    join(COMMITTED_FIXTURE_DIRECTORY, graph.manifest.profile, firstFileName)
  );

  // Serialisations are independent, so they run concurrently. Each resolves to
  // its own file name and content pair (or null when it streamed itself to
  // disk), and the outcome walk throws on the first in-order failure, so
  // serialisation never reorders what the writer persists.
  const serialisations = Array.from(PROFILE_VIEW_FILE_NAMES, ([viewName, fileName]) => {
    const filePath = join(COMMITTED_FIXTURE_DIRECTORY, graph.manifest.profile, fileName);
    const destinationPath = join(stagingDirectory, fileName);
    return serialiseView(views.get(viewName), filePath, destinationPath, configuration).then(
      (content) => [fileName, content]
    );
  });
  const outcomes = await Promise.allSettled(serialisations);

  const files = new Map();
  for (const outcome of outcomes) {
    if (outcome.status === 'rejected') {
      throw outcome.reason;
    }
    const [fileName, content] = outcome.value;
    if (content !== null) {
      files.set(fileName, content);
    }
  }

  return files;
}

/**
 * Writes every serialised view into a profile directory.
 *
 * @param {string} directory Absolute profile directory to populate.
 * @param {Map<string, string>} files Serialised file contents keyed by file name.
 */
function writeProfileFiles(directory, files) {
  for (const [fileName, content] of files) {
    writeFileSync(join(directory, fileName), content);
  }
}

/**
 * Validates a generated graph and writes its transport and manifest files into
 * a fresh staging directory, leaving the destination profile directory
 * untouched.
 *
 * @param {object} options Staging inputs.
 * @param {object} options.graph The generated logical graph to persist.
 * @param {string} options.outputRoot Directory the staging directory is created under.
 * @returns {Promise<{stagingDirectory: string, profileDirectory: string}>} The staged profile location once every view has been written.
 * @throws {Error} When validation fails or a staged file cannot be written.
 */
export async function stageProfileFixtures({ graph, outputRoot }) {
  validateSyntheticAnalysisGraph(graph);
  const profileDirectory = join(outputRoot, graph.manifest.profile);

  mkdirSync(outputRoot, { recursive: true });
  const stagingDirectory = mkdtempSync(join(outputRoot, STAGING_PREFIX));

  try {
    writeProfileFiles(stagingDirectory, await buildProfileViewContents(graph, stagingDirectory));
    chmodSync(stagingDirectory, PROFILE_DIRECTORY_MODE);
  } catch (error) {
    rmSync(stagingDirectory, { recursive: true, force: true });
    throw error;
  }

  return { stagingDirectory, profileDirectory };
}

/**
 * Swaps a fully written staging directory into its committed profile location,
 * retaining the displaced directory as a backup for set-level rollback.
 *
 * @param {string} stagingDirectory Fully written staging directory.
 * @param {string} profileDirectory Destination profile directory.
 * @returns {{profileDirectory: string, backupDirectory: string, hadCommittedProfile: boolean}} Rollback handle for the applied replacement.
 * @throws {Error} When either rename fails; a displaced profile is restored first.
 */
function swapProfileDirectory(stagingDirectory, profileDirectory) {
  const backupDirectory = `${stagingDirectory}${BACKUP_SUFFIX}`;
  const hadCommittedProfile = existsSync(profileDirectory);

  if (hadCommittedProfile) {
    renameSync(profileDirectory, backupDirectory);
  }

  try {
    renameSync(stagingDirectory, profileDirectory);
  } catch (error) {
    if (hadCommittedProfile) {
      renameSync(backupDirectory, profileDirectory);
    }
    throw error;
  }

  return { profileDirectory, backupDirectory, hadCommittedProfile };
}

/**
 * Reverses one applied profile replacement, removing the new directory and
 * restoring the displaced committed directory when there was one.
 *
 * @param {{profileDirectory: string, backupDirectory: string, hadCommittedProfile: boolean}} swap Applied replacement to reverse.
 */
function restoreSwappedProfile({ profileDirectory, backupDirectory, hadCommittedProfile }) {
  rmSync(profileDirectory, { recursive: true, force: true });
  if (hadCommittedProfile) {
    renameSync(backupDirectory, profileDirectory);
  }
}

/**
 * Deletes the retained backup for an applied replacement once the whole set has
 * been swapped successfully.
 *
 * @param {{backupDirectory: string, hadCommittedProfile: boolean}} swap Applied replacement to finalise.
 */
function finaliseSwappedProfile({ backupDirectory, hadCommittedProfile }) {
  if (hadCommittedProfile) {
    rmSync(backupDirectory, { recursive: true, force: true });
  }
}

/**
 * Removes a staged profile directory that will not be committed.
 *
 * @param {{stagingDirectory: string}} stagedProfile Staged profile location to remove.
 */
export function discardStagedProfile({ stagingDirectory }) {
  rmSync(stagingDirectory, { recursive: true, force: true });
}

/**
 * Replaces committed profile directories from a fully staged set, rolling every
 * applied replacement back if a later replacement fails.
 *
 * @param {Array<{stagingDirectory: string, profileDirectory: string}>} stagedProfiles Fully written staged profiles in replacement order.
 * @returns {void} Returns once every staged profile has replaced its committed directory.
 * @throws {Error} When a replacement fails; applied replacements are rolled back and uncommitted staged profiles discarded first.
 */
export function commitStagedProfiles(stagedProfiles) {
  const appliedSwaps = [];

  try {
    for (const stagedProfile of stagedProfiles) {
      appliedSwaps.push(
        swapProfileDirectory(stagedProfile.stagingDirectory, stagedProfile.profileDirectory)
      );
    }
  } catch (error) {
    for (const swap of appliedSwaps) {
      restoreSwappedProfile(swap);
    }
    for (const stagedProfile of stagedProfiles.slice(appliedSwaps.length)) {
      discardStagedProfile(stagedProfile);
    }
    throw error;
  }

  for (const swap of appliedSwaps) {
    finaliseSwappedProfile(swap);
  }
}

/**
 * Validates a generated graph and writes its transport and manifest files.
 *
 * @param {object} options Write inputs.
 * @param {object} options.graph The generated logical graph to persist.
 * @param {string} options.outputRoot Directory the profile subdirectory is written under.
 * @returns {Promise<void>} Resolves once the staged profile has replaced its committed directory.
 * @throws {Error} When validation fails or any file cannot be written.
 */
export async function writeProfileFixtures({ graph, outputRoot }) {
  commitStagedProfiles([await stageProfileFixtures({ graph, outputRoot })]);
}
