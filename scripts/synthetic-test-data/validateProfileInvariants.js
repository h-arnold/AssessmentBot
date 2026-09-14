import { fail } from './invariantGuards.js';

const PERCENT_SCALE = 100;
const BAND_NOT_FOUND = -1;

/**
 * Asserts each persistence class matches the profile's exact roster size and
 * assignments-per-class count.
 *
 * @param {object} options Validation inputs.
 * @param {Array<object>} options.classes Persistence class documents.
 * @param {Array<object>} options.assignments Persistence assignment records.
 * @param {{name: string, studentsPerClass: number, assignmentsPerClass: number}} options.profile Resolved profile definition.
 */
export function assertPersistenceProfileShape({ classes, assignments, profile }) {
  const assignmentCountByCourseId = new Map();
  for (const assignment of assignments) {
    assignmentCountByCourseId.set(
      assignment.courseId,
      (assignmentCountByCourseId.get(assignment.courseId) ?? 0) + 1
    );
  }

  for (const classDocument of classes) {
    if (classDocument.students.length !== profile.studentsPerClass) {
      fail(
        `Class "${classDocument.classId}" holds ${classDocument.students.length} students but the "${profile.name}" profile requires ${profile.studentsPerClass}.`
      );
    }

    const assignmentCount = assignmentCountByCourseId.get(classDocument.classId) ?? 0;
    if (assignmentCount !== profile.assignmentsPerClass) {
      fail(
        `Class "${classDocument.classId}" holds ${assignmentCount} assignments but the "${profile.name}" profile requires ${profile.assignmentsPerClass}.`
      );
    }
  }
}

/**
 * Asserts a profile's classes are distributed evenly across its Year Groups:
 * every Year Group is represented and no Year Group holds more than the even
 * share (floor or ceiling of `classCount / yearGroupCount`).
 *
 * @param {object} options Validation inputs.
 * @param {Array<object>} options.classes Persistence class documents.
 * @param {Array<object>} options.yearGroups Reference-data Year Groups.
 */
export function assertYearGroupDistribution({ classes, yearGroups }) {
  const classCountByYearGroupKey = new Map();
  for (const classDocument of classes) {
    classCountByYearGroupKey.set(
      classDocument.yearGroupKey,
      (classCountByYearGroupKey.get(classDocument.yearGroupKey) ?? 0) + 1
    );
  }

  const minimumClasses = Math.floor(classes.length / yearGroups.length);
  const maximumClasses = Math.ceil(classes.length / yearGroups.length);

  for (const yearGroup of yearGroups) {
    const classCount = classCountByYearGroupKey.get(yearGroup.key) ?? 0;
    if (classCount < minimumClasses || classCount > maximumClasses) {
      fail(
        `Year Group "${yearGroup.key}" holds ${classCount} classes; classes must be distributed ${minimumClasses}-${maximumClasses} per Year Group.`
      );
    }
  }
}

/**
 * Counts each class assignment into its documented completion band.
 *
 * @param {string} classId Class identifier used in failure messages.
 * @param {object} classFull Transport class view.
 * @param {number} rosterSize Class roster size.
 * @param {Array<{minCompletedPercent: number, maxCompletedPercent: number}>} bands Documented completion bands.
 * @returns {Map<number, number>} Assignment counts keyed by band index.
 */
function countAssignmentsByBand(classId, classFull, rosterSize, bands) {
  const bandCountByIndex = new Map();

  for (const assignment of classFull.assignments) {
    const completionPercent = Math.round(
      (assignment.submissions.length / rosterSize) * PERCENT_SCALE
    );
    const bandIndex = bands.findIndex(
      (band) =>
        completionPercent >= band.minCompletedPercent &&
        completionPercent <= band.maxCompletedPercent
    );
    if (bandIndex === BAND_NOT_FOUND) {
      fail(
        `Class "${classId}" assignment "${assignment.assignmentId}" completes ${completionPercent}% of its roster, which falls outside every documented completion band.`
      );
    }
    bandCountByIndex.set(bandIndex, (bandCountByIndex.get(bandIndex) ?? 0) + 1);
  }

  return bandCountByIndex;
}

/**
 * Asserts every class's completion distribution matches the supplied bands,
 * deriving completion from the class roster size and generated submissions.
 *
 * @param {Record<string, object>} classesById Transport class views.
 * @param {Array<{sharePercent: number, minCompletedPercent: number, maxCompletedPercent: number}>} bands Documented completion bands.
 */
export function assertCompletionBands(classesById, bands) {
  const expectedShares = bands.map((band) => band.sharePercent);

  for (const [classId, classFull] of Object.entries(classesById)) {
    const rosterSize = classFull.students.length;
    if (rosterSize === 0) {
      fail(`Class "${classId}" has an empty roster so completion cannot be derived.`);
    }

    const bandCountByIndex = countAssignmentsByBand(classId, classFull, rosterSize, bands);
    const actualShares = expectedShares.map((_, index) => bandCountByIndex.get(index) ?? 0);

    if (!actualShares.every((count, index) => count === expectedShares.at(index))) {
      fail(
        `Class "${classId}" completion distribution ${JSON.stringify(actualShares)} does not match the required distribution ${JSON.stringify(expectedShares)}.`
      );
    }
  }
}
