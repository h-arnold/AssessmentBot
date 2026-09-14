import { existsSync, realpathSync } from 'node:fs';
import { basename, dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateSyntheticAnalysisGraph } from './generateSyntheticAnalysisGraph.js';
import {
  commitStagedProfiles,
  discardStagedProfile,
  stageProfileFixtures,
  writeProfileFixtures,
} from './fixtureWriter.js';
import { LARGE_FULL_PROFILE_NAME, PROFILE_NAMES } from './profileDefinitions.js';

/**
 * Fixture generation CLI for the synthetic analysis corpus.
 *
 * @remarks
 * Compact mode regenerates the committed small, medium, and large-representative
 * profiles. Full mode is an explicit opt-in that writes the uncommitted large-full
 * corpus only under the ignored `.opencode/scratchpad/synthetic-analysis-full/`
 * root. Containment is checked against the physical path, following symlinks in
 * every existing ancestor, so a link inside the permitted root cannot redirect a
 * write outside it. Supplied options are validated before any generation or
 * default selection, so a missing value or unknown flag fails loudly rather than
 * silently falling through to a committed-fixture write.
 */

const COMMITTED_FIXTURE_ROOT = resolve(
  fileURLToPath(new URL('../../tests/__mocks__/data/synthetic-analysis/', import.meta.url))
);
const FULL_OUTPUT_ROOT = resolve(
  fileURLToPath(new URL('../../.opencode/scratchpad/synthetic-analysis-full/', import.meta.url))
);
const COMMITTED_PROFILE_NAMES = PROFILE_NAMES.filter(
  (profileName) => profileName !== LARGE_FULL_PROFILE_NAME
);
const CLI_ARGUMENT_OFFSET = 2;
const FULL_FLAG = '--full';
const OUTPUT_ROOT_FLAG = '--output-root';
const FLAG_PREFIX = '--';

/**
 * Resolves a path to its physical location, following symlinks in every existing
 * ancestor while preserving missing trailing segments so the target need not
 * exist yet.
 *
 * @param {string} target Path to resolve physically.
 * @returns {string} The physical absolute path with existing symlinks followed.
 */
function resolvePhysicalPath(target) {
  const missingSegments = [];
  let existingAncestor = resolve(target);

  while (!existsSync(existingAncestor)) {
    missingSegments.unshift(basename(existingAncestor));
    existingAncestor = dirname(existingAncestor);
  }

  return resolve(realpathSync(existingAncestor), ...missingSegments);
}

/**
 * Reports whether the resolved output path is physically contained in the
 * permitted root, rejecting symlink escapes.
 *
 * @param {string} outputRoot Requested full-output root.
 * @returns {string} The resolved permitted output root.
 * @throws {Error} When the requested path resolves outside the permitted root.
 */
export function resolveFullOutputRoot(outputRoot) {
  const resolvedRoot = resolve(outputRoot);
  const physicalPermittedRoot = resolvePhysicalPath(FULL_OUTPUT_ROOT);
  const physicalRoot = resolvePhysicalPath(resolvedRoot);
  const isPermitted =
    physicalRoot === physicalPermittedRoot ||
    physicalRoot.startsWith(`${physicalPermittedRoot}${sep}`);

  if (!isPermitted) {
    throw new Error(
      `Full synthetic analysis output is restricted to "${FULL_OUTPUT_ROOT}"; refusing to write to "${resolvedRoot}".`
    );
  }
  return resolvedRoot;
}

/**
 * Regenerates every committed compact profile into the requested output root.
 *
 * @remarks
 * Every compact profile is generated, validated, and staged before any
 * committed profile directory is replaced. A later generation, invariant,
 * serialisation, or staging-write failure therefore discards the staged set and
 * leaves every pre-existing committed profile intact.
 *
 * @param {object} options Generation inputs.
 * @param {string} options.outputRoot Directory the profile subdirectories are written under.
 */
export function generateCommittedProfiles({ outputRoot }) {
  commitStagedProfiles(stageCommittedProfiles(outputRoot));
}

/**
 * Stages every committed compact profile without replacing any committed
 * profile, discarding all staged profiles if a later one fails.
 *
 * @param {string} outputRoot Directory the staging directories are created under.
 * @returns {Array<{stagingDirectory: string, profileDirectory: string}>} Fully written staged profiles.
 * @throws {Error} When a profile cannot be generated, validated, or staged.
 */
function stageCommittedProfiles(outputRoot) {
  const stagedProfiles = [];

  try {
    for (const profileName of COMMITTED_PROFILE_NAMES) {
      stagedProfiles.push(
        stageProfileFixtures({
          graph: generateSyntheticAnalysisGraph(profileName),
          outputRoot,
        })
      );
    }
  } catch (error) {
    for (const stagedProfile of stagedProfiles) {
      discardStagedProfile(stagedProfile);
    }
    throw error;
  }

  return stagedProfiles;
}

/**
 * Generates the on-demand large-full corpus under the permitted ignored root,
 * validating the destination before the expensive graph is constructed.
 *
 * @param {object} options Generation inputs.
 * @param {string} options.outputRoot Requested ignored output root.
 * @throws {Error} When the requested output root escapes the permitted root.
 */
export function generateFullProfile({ outputRoot }) {
  const resolvedRoot = resolveFullOutputRoot(outputRoot);

  writeProfileFixtures({
    graph: generateSyntheticAnalysisGraph(LARGE_FULL_PROFILE_NAME),
    outputRoot: resolvedRoot,
  });
}

/**
 * Resolves the value token that follows an option flag, rejecting a missing or
 * flag-like value rather than treating it as an omitted option.
 *
 * @param {string[]} argv Arguments following the Node executable and script path.
 * @param {number} index Index of the option flag within `argv`.
 * @returns {string} The supplied option value.
 * @throws {Error} When the option value is missing.
 */
function resolveOptionValue(argv, index) {
  const value = argv.at(index + 1);
  if (value === undefined || value.startsWith(FLAG_PREFIX)) {
    throw new Error(`Missing value for "${OUTPUT_ROOT_FLAG}".`);
  }
  return value;
}

/**
 * Parses and validates CLI arguments, rejecting unknown flags and option values
 * that are missing before applying each mode's canonical default root.
 *
 * @param {string[]} argv Arguments following the Node executable and script path.
 * @returns {{full: boolean, outputRoot: string}} The parsed mode and output root.
 * @throws {Error} When an argument is unknown or an option value is missing.
 */
export function parseCliOptions(argv) {
  let full = false;
  let requestedOutputRoot;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv.at(index);

    if (argument === FULL_FLAG) {
      full = true;
    } else if (argument === OUTPUT_ROOT_FLAG) {
      requestedOutputRoot = resolveOptionValue(argv, index);
      index += 1;
    } else {
      throw new Error(
        `Unknown synthetic analysis fixture option "${String(argument)}". Supported options: ${FULL_FLAG}, ${OUTPUT_ROOT_FLAG} <path>.`
      );
    }
  }

  return {
    full,
    outputRoot: requestedOutputRoot ?? (full ? FULL_OUTPUT_ROOT : COMMITTED_FIXTURE_ROOT),
  };
}

/**
 * Runs the CLI for the parsed mode, writing to the mode-specific resolved root.
 *
 * @param {string[]} argv Arguments following the Node executable and script path.
 */
export function runCli(argv) {
  const options = parseCliOptions(argv);

  if (options.full) {
    generateFullProfile({ outputRoot: options.outputRoot });
    return;
  }

  generateCommittedProfiles({ outputRoot: options.outputRoot });
}

/**
 * Executes the CLI, reporting failures on stderr and setting a non-zero exit code.
 *
 * @param {string[]} argv Arguments following the Node executable and script path.
 */
export function executeCli(argv) {
  try {
    runCli(argv);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

/**
 * Reports whether this module was invoked directly rather than imported.
 *
 * @returns {boolean} True when Node was started with this file as its entry point.
 */
function isDirectExecution() {
  return resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isDirectExecution()) {
  executeCli(process.argv.slice(CLI_ARGUMENT_OFFSET));
}
