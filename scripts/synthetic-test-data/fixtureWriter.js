import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

import { validateSyntheticAnalysisGraph } from './validateSyntheticAnalysisGraph.js';

/**
 * Staged writer for committed synthetic analysis profiles.
 *
 * @remarks
 * A profile is validated and written into a staging directory first. The
 * committed profile directory is replaced only after every profile in the set
 * has been staged successfully, so a generation, invariant, serialisation, or
 * staging-write failure leaves the existing committed set untouched. The
 * replacement phase keeps each displaced directory as a backup and rolls every
 * applied replacement back if a later replacement fails, so the committed set
 * is never left partially regenerated. The writer only ever writes the compact
 * transport views; the uncommitted full-large corpus is gated by the caller in
 * `generateSyntheticAnalysisFixtures.js`.
 */

const JSON_INDENT_SPACES = 2;
const STAGING_PREFIX = '.synthetic-staging-';
const BACKUP_SUFFIX = '-previous';
const PROFILE_DIRECTORY_MODE = 0o755;

/**
 * Maps each named corpus view to the file it is persisted under. The writer and
 * the synchronous profile loader both derive their file names from this map.
 */
export const PROFILE_VIEW_FILE_NAMES = new Map([
  ['manifest', 'manifest.json'],
  ['classPartials', 'classPartials.json'],
  ['assignmentDefinitionPartials', 'assignmentDefinitionPartials.json'],
  ['classesById', 'classesById.json'],
  ['assignmentsByKey', 'assignmentsByKey.json'],
]);

/**
 * Serialises one view to its committed on-disk representation.
 *
 * @param {unknown} view The view to serialise.
 * @returns {string} Pretty-printed JSON with a trailing newline.
 */
function serialiseView(view) {
  return `${JSON.stringify(view, null, JSON_INDENT_SPACES)}\n`;
}

/**
 * Builds the file name to serialised content map for a graph's committed views,
 * deriving every file name from the exported view mapping so the writer and the
 * synchronous loader cannot drift apart.
 *
 * @param {object} graph The generated logical graph.
 * @returns {Map<string, string>} Serialised file contents keyed by file name.
 */
function buildProfileViewContents(graph) {
  const views = new Map([
    ['manifest', graph.manifest],
    ['classPartials', graph.transport.classPartials],
    ['assignmentDefinitionPartials', graph.transport.assignmentDefinitionPartials],
    ['classesById', graph.transport.classesById],
    ['assignmentsByKey', graph.transport.assignmentsByKey],
  ]);

  const files = new Map();
  for (const [viewName, fileName] of PROFILE_VIEW_FILE_NAMES) {
    files.set(fileName, serialiseView(views.get(viewName)));
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
 * Validates a generated graph and writes its committed transport views into a
 * fresh staging directory, leaving the destination profile directory untouched.
 *
 * @param {object} options Staging inputs.
 * @param {object} options.graph The generated logical graph to persist.
 * @param {string} options.outputRoot Directory the staging directory is created under.
 * @returns {{stagingDirectory: string, profileDirectory: string}} The staged profile location.
 * @throws {Error} When validation fails or a staged file cannot be written.
 */
export function stageProfileFixtures({ graph, outputRoot }) {
  validateSyntheticAnalysisGraph(graph);
  const profileDirectory = join(outputRoot, graph.manifest.profile);

  mkdirSync(outputRoot, { recursive: true });
  const stagingDirectory = mkdtempSync(join(outputRoot, STAGING_PREFIX));

  try {
    writeProfileFiles(stagingDirectory, buildProfileViewContents(graph));
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
 * Validates a generated graph and writes its committed transport view files.
 *
 * @param {object} options Write inputs.
 * @param {object} options.graph The generated logical graph to persist.
 * @param {string} options.outputRoot Directory the profile subdirectory is written under.
 * @throws {Error} When validation fails or any file cannot be written.
 */
export function writeProfileFixtures({ graph, outputRoot }) {
  commitStagedProfiles([stageProfileFixtures({ graph, outputRoot })]);
}
