const LARGE_FULL_SUBMISSION_BANDS = Object.freeze([
  { startIndex: 0, endIndex: 5, basePercent: 20, stepPercent: 4, stepCount: 5 },
  { startIndex: 5, endIndex: 15, basePercent: 50, stepPercent: 6, stepCount: 5 },
  { startIndex: 15, endIndex: 85, basePercent: 80, stepPercent: 3, stepCount: 5 },
  { startIndex: 85, endIndex: 100, basePercent: 96, stepPercent: 4, stepCount: 2 },
]);
const PERCENT_SCALE = 100;
const COMPACT_SMALL_SUBMISSION_COUNT = 2;
const COMPACT_MEDIUM_SPARSE_SUBMISSION_COUNT = 3;
const COMPACT_MEDIUM_DENSE_SUBMISSION_COUNT = 5;

const COMPACT_SUBMISSION_PLANS = Object.freeze({
  small: Object.freeze([0, 'full', COMPACT_SMALL_SUBMISSION_COUNT, 'full']),
  medium: Object.freeze([
    0,
    'full',
    COMPACT_MEDIUM_SPARSE_SUBMISSION_COUNT,
    'full',
    COMPACT_MEDIUM_DENSE_SUBMISSION_COUNT,
    'full',
  ]),
  'large-representative': Object.freeze([
    0,
    'full',
    COMPACT_SMALL_SUBMISSION_COUNT,
    'full',
    COMPACT_MEDIUM_SPARSE_SUBMISSION_COUNT,
  ]),
});

/**
 * Resolves the deterministic submission count for one class assignment.
 *
 * @remarks
 * For the large-full profile the completion band is fixed by assignment index,
 * so the exact 5/10/70/15 distribution is preserved. The percentage within that
 * band is drawn from the seeded Faker instance, so changing the supplied profile
 * seed changes completion counts without moving any assignment between bands.
 *
 * @param {{name: string}} profileDefinition Resolved profile definition.
 * @param {number} assignmentIndex Assignment index within the class.
 * @param {number} studentsPerClass Class roster size.
 * @param {{number: {int: (options: {min: number, max: number}) => number}}} faker Seeded Faker instance.
 * @returns {number} Number of submitting students.
 */
export function resolveSubmissionCount(
  profileDefinition,
  assignmentIndex,
  studentsPerClass,
  faker
) {
  if (profileDefinition.name === 'large-full') {
    const band = LARGE_FULL_SUBMISSION_BANDS.find(
      (candidate) => assignmentIndex >= candidate.startIndex && assignmentIndex < candidate.endIndex
    );
    if (band === undefined) {
      throw new Error(`No large-full completion band covers assignment index ${assignmentIndex}.`);
    }
    const step = faker.number.int({ min: 0, max: band.stepCount - 1 });
    const percent = band.basePercent + step * band.stepPercent;
    return Math.round((studentsPerClass * percent) / PERCENT_SCALE);
  }

  const plan = COMPACT_SUBMISSION_PLANS[profileDefinition.name];
  const entry = plan[assignmentIndex % plan.length];
  return entry === 'full' ? studentsPerClass : entry;
}
