/**
 * Deterministic profile definitions for the synthetic analysis corpus.
 *
 * @remarks
 * A profile name and its fixed integer seed identify a generated corpus
 * exactly. Seeds are distinct per profile so a seed change can be observed as
 * changed (but still invariant-preserving) synthetic values.
 */

/** Canonical large-full profile name. */
export const LARGE_FULL_PROFILE_NAME = 'large-full';
/** Canonical large-full class count. */
export const LARGE_FULL_CLASS_COUNT = 100;
/** Canonical large-full students per class. */
export const LARGE_FULL_STUDENTS_PER_CLASS = 30;
/** Canonical large-full assignments per class. */
export const LARGE_FULL_ASSIGNMENTS_PER_CLASS = 100;
/** Number of Year Groups 7-30 represented by the large-full profile. */
export const LARGE_FULL_YEAR_GROUP_COUNT = 24;

/**
 * The documented large-full completion bands.
 *
 * @remarks
 * Each band records its share of a class's 100 assignments and the derived
 * completion-percentage range (submitting students divided by the class roster).
 * Completion is always derived from the generated submissions, never stored as a
 * persistence or transport field.
 */
export const LARGE_FULL_COMPLETION_BANDS = Object.freeze([
  Object.freeze({ sharePercent: 5, minCompletedPercent: 20, maxCompletedPercent: 49 }),
  Object.freeze({ sharePercent: 10, minCompletedPercent: 50, maxCompletedPercent: 79 }),
  Object.freeze({ sharePercent: 70, minCompletedPercent: 80, maxCompletedPercent: 95 }),
  Object.freeze({ sharePercent: 15, minCompletedPercent: 96, maxCompletedPercent: 100 }),
]);

const SEED_SMALL = 17_031;
const SEED_MEDIUM = 28_042;
const SEED_LARGE_REPRESENTATIVE = 39_053;
const SEED_LARGE_FULL = 41_064;

const SMALL_PROFILE = Object.freeze({
  name: 'small',
  seed: SEED_SMALL,
  classCount: 3,
  studentsPerClass: 6,
  assignmentsPerClass: 4,
  yearGroupCount: 3,
});

const MEDIUM_PROFILE = Object.freeze({
  name: 'medium',
  seed: SEED_MEDIUM,
  classCount: 4,
  studentsPerClass: 12,
  assignmentsPerClass: 6,
  yearGroupCount: 4,
});

const LARGE_REPRESENTATIVE_PROFILE = Object.freeze({
  name: 'large-representative',
  seed: SEED_LARGE_REPRESENTATIVE,
  classCount: 4,
  studentsPerClass: 6,
  assignmentsPerClass: 5,
  yearGroupCount: 4,
});

const LARGE_FULL_PROFILE = Object.freeze({
  name: LARGE_FULL_PROFILE_NAME,
  seed: SEED_LARGE_FULL,
  classCount: LARGE_FULL_CLASS_COUNT,
  studentsPerClass: LARGE_FULL_STUDENTS_PER_CLASS,
  assignmentsPerClass: LARGE_FULL_ASSIGNMENTS_PER_CLASS,
  yearGroupCount: LARGE_FULL_YEAR_GROUP_COUNT,
});

const PROFILE_DEFINITIONS = new Map([
  ['small', SMALL_PROFILE],
  ['medium', MEDIUM_PROFILE],
  ['large-representative', LARGE_REPRESENTATIVE_PROFILE],
  [LARGE_FULL_PROFILE_NAME, LARGE_FULL_PROFILE],
]);

/** Supported profile names in canonical order. */
export const PROFILE_NAMES = Object.freeze([...PROFILE_DEFINITIONS.keys()]);

/**
 * Resolves a named profile definition, rejecting unknown names loudly.
 *
 * @param {string} name Requested profile name.
 * @returns {{name: string, seed: number, classCount: number, studentsPerClass: number, assignmentsPerClass: number, yearGroupCount: number}} The frozen profile definition.
 */
export function getProfileDefinition(name) {
  const definition = PROFILE_DEFINITIONS.get(name);
  if (definition === undefined) {
    throw new Error(
      `Unsupported synthetic analysis profile "${String(name)}". Supported profiles: ${PROFILE_NAMES.join(', ')}.`
    );
  }
  return definition;
}
