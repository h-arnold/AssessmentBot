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
export const LARGE_FULL_CLASS_COUNT = 48;
/** Canonical large-full students per class. */
export const LARGE_FULL_STUDENTS_PER_CLASS = 30;
/** Canonical large-full assignments per class. */
export const LARGE_FULL_ASSIGNMENTS_PER_CLASS = 50;
/** Number of Year Groups 7–14 represented by the large-full profile. */
export const LARGE_FULL_YEAR_GROUP_COUNT = 8;

/**
 * The documented large-full assignment bands.
 *
 * @remarks
 * Each band records its assignment index range, its share of a class's 50
 * assignments, the derived completion-percentage range (submitting students
 * divided by the class roster), and the discrete completion percentages used
 * when generating submissions. Completion is always derived from the generated
 * submissions, never stored as a persistence or transport field. The step
 * percentages are fixed corpus inputs and are deliberately not recomputed from
 * the completion range, because doing so would change the generated data.
 */
export const LARGE_FULL_BANDS = Object.freeze([
  Object.freeze({
    startIndex: 0,
    endIndex: 3,
    sharePercent: 6,
    minCompletedPercent: 20,
    maxCompletedPercent: 49,
    basePercent: 20,
    stepPercent: 4,
    stepCount: 5,
  }),
  Object.freeze({
    startIndex: 3,
    endIndex: 8,
    sharePercent: 10,
    minCompletedPercent: 50,
    maxCompletedPercent: 79,
    basePercent: 50,
    stepPercent: 6,
    stepCount: 5,
  }),
  Object.freeze({
    startIndex: 8,
    endIndex: 43,
    sharePercent: 70,
    minCompletedPercent: 80,
    maxCompletedPercent: 95,
    basePercent: 80,
    stepPercent: 3,
    stepCount: 5,
  }),
  Object.freeze({
    startIndex: 43,
    endIndex: 50,
    sharePercent: 14,
    minCompletedPercent: 96,
    maxCompletedPercent: 100,
    basePercent: 96,
    stepPercent: 4,
    stepCount: 2,
  }),
]);

/** Completion bands consumed by transport-graph validation. */
export const LARGE_FULL_COMPLETION_BANDS = Object.freeze(
  LARGE_FULL_BANDS.map(({ sharePercent, minCompletedPercent, maxCompletedPercent }) =>
    Object.freeze({ sharePercent, minCompletedPercent, maxCompletedPercent })
  )
);

/** Submission bands consumed by deterministic submission-count generation. */
export const LARGE_FULL_SUBMISSION_BANDS = Object.freeze(
  LARGE_FULL_BANDS.map(({ startIndex, endIndex, basePercent, stepPercent, stepCount }) =>
    Object.freeze({ startIndex, endIndex, basePercent, stepPercent, stepCount })
  )
);

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
