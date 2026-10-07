const SMALL_CLASS_MAX_SIZE = 3;
const NULL_ACTIVE_CLASS_INDEX_SMALL = 2;
const NULL_ACTIVE_CLASS_INDEX_DEFAULT = 3;
const NULL_OWNER_CLASS_INDEX = 2;
const ACTIVE_ALTERNATION_DIVISOR = 2;

/**
 * Leading digit of every synthetic student identifier. Kept as a literal so
 * the identifier always starts with a non-zero digit and never round-trips
 * through a number type.
 */
const STUDENT_ID_PREFIX = '1';

/**
 * Zero-padded width of each index segment of a synthetic student identifier.
 * The profiles generate at most 100 classes and 30 students per class, so
 * both indices stay well inside this width and every identifier is exactly
 * `1 + 10 + 10 = 21` characters. `tests/synthetic-analysis/syntheticCorpusConventions.test.ts`
 * pins that length for every profile.
 */
const STUDENT_ID_SEGMENT_LENGTH = 10;

/**
 * Builds the deterministic, digit-only 21-character student identifier for one
 * roster position.
 *
 * The value stays an opaque string: it is composed by left-padding each index
 * rather than by converting a number, so no precision-sensitive arithmetic is
 * ever applied to it.
 *
 * @param {number} classIndex Zero-based class index.
 * @param {number} studentIndex Zero-based student index within the class.
 * @returns {string} The 21-character digit-only student identifier.
 */
function buildStudentId(classIndex, studentIndex) {
  return `${STUDENT_ID_PREFIX}${String(classIndex).padStart(
    STUDENT_ID_SEGMENT_LENGTH,
    '0'
  )}${String(studentIndex).padStart(STUDENT_ID_SEGMENT_LENGTH, '0')}`;
}

/**
 * Leading honourific tokens stripped from generated person names. Only the
 * first whitespace-separated token is ever removed; Faker suffix tokens and
 * all remaining name tokens are preserved unchanged.
 */
const STRIPPED_LEADING_HONOURIFICS = new Set(['Mr', 'Mrs', 'Miss', 'Ms', 'Dr', 'Prof']);

/**
 * Removes one leading honourific token from a generated person name.
 *
 * @param {string} fullName The Faker-generated full person name.
 * @returns {string} The name without a leading honourific, or the input unchanged.
 */
function stripLeadingHonourific(fullName) {
  const [leadingToken, ...remainingTokens] = fullName.split(' ');
  if (remainingTokens.length === 0) {
    return fullName;
  }
  const bareToken = leadingToken.replace(/\.$/, '');
  if (!STRIPPED_LEADING_HONOURIFICS.has(bareToken)) {
    return fullName;
  }
  return remainingTokens.join(' ');
}

/**
 * Builds a deterministic teacher summary for a class.
 *
 * @param {{person: {fullName: () => string}}} faker Seeded Faker instance.
 * @param {number} classIndex Class index.
 * @returns {{userId: string, email: string, teacherName: string}} Teacher summary.
 */
function buildTeacher(faker, classIndex) {
  return {
    userId: `teacher-${classIndex}`,
    email: `teacher-${classIndex}@example.test`,
    teacherName: stripLeadingHonourific(faker.person.fullName()),
  };
}

/**
 * Builds the deterministic roster for a class.
 *
 * @param {{person: {fullName: () => string}}} faker Seeded Faker instance.
 * @param {number} classIndex Class index.
 * @param {number} studentsPerClass Roster size.
 * @returns {Array<{id: string, name: string, email: string}>} Roster students.
 */
function buildStudents(faker, classIndex, studentsPerClass) {
  const students = [];
  for (let studentIndex = 0; studentIndex < studentsPerClass; studentIndex += 1) {
    students.push({
      id: buildStudentId(classIndex, studentIndex),
      name: stripLeadingHonourific(faker.person.fullName()),
      email: `student-${classIndex}-${studentIndex}@example.test`,
    });
  }
  return students;
}

/**
 * Builds one persistence class document, including its roster, for a class index.
 *
 * @param {object} options Class inputs.
 * @param {{person: {fullName: () => string}}} options.faker Seeded Faker instance.
 * @param {{classCount: number, studentsPerClass: number}} options.profileDefinition Resolved profile definition.
 * @param {{cohorts: Array<{key: string}>, yearGroups: Array<{key: string}>}} options.referenceData Generated reference data.
 * @param {number} options.classIndex Class index.
 * @returns {object} Persistence class document.
 */
function buildClassDocument({ faker, profileDefinition, referenceData, classIndex }) {
  const yearGroup = referenceData.yearGroups[classIndex % referenceData.yearGroups.length];
  const cohort = referenceData.cohorts[classIndex % referenceData.cohorts.length];
  const teacher = buildTeacher(faker, classIndex);
  const activeNullIndex =
    profileDefinition.classCount <= SMALL_CLASS_MAX_SIZE
      ? NULL_ACTIVE_CLASS_INDEX_SMALL
      : NULL_ACTIVE_CLASS_INDEX_DEFAULT;

  return {
    classId: `class-${classIndex}`,
    className: classIndex === 0 ? null : `Synthetic Class ${classIndex + 1}`,
    cohortKey: classIndex === 1 ? null : cohort.key,
    courseLength: 1,
    yearGroupKey: yearGroup.key,
    classOwner: classIndex === NULL_OWNER_CLASS_INDEX ? null : teacher,
    teachers: [teacher],
    students: buildStudents(faker, classIndex, profileDefinition.studentsPerClass),
    active: classIndex === activeNullIndex ? null : classIndex % ACTIVE_ALTERNATION_DIVISOR === 0,
  };
}

/**
 * Generates every persistence class document, including its roster, for a profile.
 *
 * @param {object} inputs Generation inputs.
 * @param {{person: {fullName: () => string}}} inputs.faker Seeded Faker instance.
 * @param {{classCount: number, studentsPerClass: number}} inputs.profileDefinition Resolved profile definition.
 * @param {{cohorts: Array<{key: string}>, yearGroups: Array<{key: string}>}} inputs.referenceData Generated reference data.
 * @returns {Array<object>} Persistence class documents.
 */
export function generateClassRosters({ faker, profileDefinition, referenceData }) {
  const classes = [];

  for (let classIndex = 0; classIndex < profileDefinition.classCount; classIndex += 1) {
    classes.push(buildClassDocument({ faker, profileDefinition, referenceData, classIndex }));
  }

  return classes;
}
