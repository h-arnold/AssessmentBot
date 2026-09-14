import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PROFILE_VIEW_FILE_NAMES } from './fixtureWriter.js';
import { LARGE_FULL_PROFILE_NAME, PROFILE_NAMES } from './profileDefinitions.js';

/**
 * Synchronous immutable loader for committed synthetic analysis profiles.
 *
 * @remarks
 * Only the compact committed profiles are loadable; the full-large profile is
 * generated on demand and is deliberately rejected here. Every returned view is
 * recursively deep-frozen so a consumer must clone it before local mutation.
 */

const COMMITTED_FIXTURE_ROOT = fileURLToPath(
  new URL('../../tests/__mocks__/data/synthetic-analysis/', import.meta.url)
);
const COMMITTED_PROFILE_NAMES = PROFILE_NAMES.filter(
  (profileName) => profileName !== LARGE_FULL_PROFILE_NAME
);

/**
 * Resolves the committed fixture directory for a supported profile name.
 *
 * @param {string} profileName Requested committed profile name.
 * @returns {string} Absolute committed profile directory.
 * @throws {Error} When the profile is not a committed compact profile.
 */
function resolveCommittedProfileDirectory(profileName) {
  if (!COMMITTED_PROFILE_NAMES.includes(profileName)) {
    throw new Error(
      `Unsupported committed synthetic analysis profile "${String(profileName)}". Supported profiles: ${COMMITTED_PROFILE_NAMES.join(', ')}.`
    );
  }
  return join(COMMITTED_FIXTURE_ROOT, profileName);
}

/**
 * Resolves the file name backing a supported named view.
 *
 * @param {string} viewName Requested named view.
 * @returns {string} The view's committed file name.
 * @throws {Error} When the view name is not supported.
 */
function resolveViewFileName(viewName) {
  const fileName = PROFILE_VIEW_FILE_NAMES.get(viewName);
  if (fileName === undefined) {
    throw new Error(
      `Unsupported synthetic analysis view "${String(viewName)}". Supported views: ${[...PROFILE_VIEW_FILE_NAMES.keys()].join(', ')}.`
    );
  }
  return fileName;
}

/**
 * Recursively freezes a parsed JSON tree so consumers cannot mutate shared state.
 *
 * @param {unknown} value The value to freeze in place.
 * @returns {unknown} The same value, now deeply frozen.
 */
function deepFreeze(value) {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);
  for (const entry of Object.values(value)) {
    deepFreeze(entry);
  }
  return value;
}

/**
 * Loads one named view of a committed compact profile synchronously and frozen.
 *
 * @param {string} profileName Supported committed profile name.
 * @param {string} viewName Supported named view.
 * @returns {unknown} The parsed, recursively deep-frozen view.
 * @throws {Error} When the profile or view is unsupported, or the fixture is unreadable.
 */
export function loadSyntheticAnalysisProfile(profileName, viewName) {
  const directory = resolveCommittedProfileDirectory(profileName);
  const fileName = resolveViewFileName(viewName);
  const view = JSON.parse(readFileSync(join(directory, fileName), 'utf8'));

  return deepFreeze(view);
}
