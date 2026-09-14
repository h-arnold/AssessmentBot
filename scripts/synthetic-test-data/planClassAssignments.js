import { isoAt } from './deterministicPrimitives.js';
import { generateSubmissions } from './generateSubmissions.js';
import { resolveSubmissionCount } from './resolveSubmissionCount.js';

const MINUTES_PER_CLASS = 1440;
const MINUTES_PER_ASSIGNMENT = 60;
const MINUTES_AFTER_ASSIGNMENT_CREATED = 3;

/**
 * Resolves the assignment definition for one class assignment.
 *
 * @remarks
 * The final assignment of each class references a partial-only registry row so
 * the class partial view retains the documented nullable partial scenarios. Every
 * other assignment references a full definition and can be hydrated into a full
 * assignment.
 *
 * @param {object} options Resolution inputs.
 * @param {Array<object>} options.fullDefinitions Full (keyed-task) definitions.
 * @param {Array<object>} options.partialOnlyDefinitions Partial-only registry rows.
 * @param {number} options.classIndex Class index.
 * @param {number} options.assignmentIndex Assignment index within the class.
 * @param {number} options.assignmentsPerClass Assignments per class.
 * @returns {object} The resolved assignment definition.
 */
function resolveAssignmentDefinition({
  fullDefinitions,
  partialOnlyDefinitions,
  classIndex,
  assignmentIndex,
  assignmentsPerClass,
}) {
  if (partialOnlyDefinitions.length > 0 && assignmentIndex === assignmentsPerClass - 1) {
    return partialOnlyDefinitions[classIndex % partialOnlyDefinitions.length];
  }

  const globalAssignmentIndex = classIndex * assignmentsPerClass + assignmentIndex;
  return fullDefinitions[globalAssignmentIndex % fullDefinitions.length];
}

/**
 * Splits generated definitions into full and partial-only groups, failing when
 * no full definition is available to hydrate assignments.
 *
 * @param {Array<object>} assignmentDefinitions Generated assignment definitions.
 * @returns {{fullDefinitions: Array<object>, partialOnlyDefinitions: Array<object>}} Partitioned definitions.
 */
export function partitionDefinitions(assignmentDefinitions) {
  const fullDefinitions = assignmentDefinitions.filter(
    (definition) => !Array.isArray(definition.tasks)
  );
  const partialOnlyDefinitions = assignmentDefinitions.filter((definition) =>
    Array.isArray(definition.tasks)
  );

  if (fullDefinitions.length === 0) {
    throw new Error(
      'Synthetic analysis generation requires at least one full assignment definition.'
    );
  }

  return { fullDefinitions, partialOnlyDefinitions };
}

/**
 * Builds one persistence assignment, including its roster-bound submissions.
 *
 * @param {object} options Assignment inputs.
 * @param {{number: {int: (options: {min: number, max: number}) => number}}} options.faker Seeded Faker instance.
 * @param {{name: string, seed: number, studentsPerClass: number, assignmentsPerClass: number}} options.profileDefinition Resolved profile definition.
 * @param {object} options.classDocument Owning persistence class document.
 * @param {number} options.classIndex Class index.
 * @param {number} options.assignmentIndex Assignment index within the class.
 * @param {number} options.baseMinuteOffset Base timestamp offset for the owning class.
 * @param {Array<object>} options.fullDefinitions Full (keyed-task) definitions.
 * @param {Array<object>} options.partialOnlyDefinitions Partial-only registry rows.
 * @returns {object} Persistence assignment record.
 */
function buildAssignment({
  faker,
  profileDefinition,
  classDocument,
  classIndex,
  assignmentIndex,
  baseMinuteOffset,
  fullDefinitions,
  partialOnlyDefinitions,
}) {
  const assignmentDefinition = resolveAssignmentDefinition({
    fullDefinitions,
    partialOnlyDefinitions,
    classIndex,
    assignmentIndex,
    assignmentsPerClass: profileDefinition.assignmentsPerClass,
  });
  const assignmentId = `assignment-${classIndex}-${assignmentIndex}`;
  const assignmentMinuteOffset = baseMinuteOffset + assignmentIndex * MINUTES_PER_ASSIGNMENT;

  return {
    courseId: classDocument.classId,
    assignmentId,
    assignmentName: `Synthetic Assignment ${classIndex + 1}.${assignmentIndex + 1}`,
    assignmentDefinitionKey: assignmentDefinition.definitionKey,
    dueDate: null,
    updatedAt:
      assignmentIndex === 0
        ? null
        : isoAt(assignmentMinuteOffset + MINUTES_AFTER_ASSIGNMENT_CREATED),
    createdAt: isoAt(assignmentMinuteOffset),
    documentType: assignmentIndex === 0 ? null : assignmentDefinition.documentType,
    submissions: generateSubmissions({
      profileDefinition,
      classDocument,
      assignmentDefinition,
      assignmentId,
      submissionCount: resolveSubmissionCount(
        profileDefinition,
        assignmentIndex,
        profileDefinition.studentsPerClass,
        faker
      ),
      assignmentIndex,
      baseMinuteOffset,
    }),
  };
}

/**
 * Builds every assignment for one class.
 *
 * @param {object} options Class assignment inputs.
 * @param {{number: {int: (options: {min: number, max: number}) => number}}} options.faker Seeded Faker instance.
 * @param {{name: string, seed: number, studentsPerClass: number, assignmentsPerClass: number}} options.profileDefinition Resolved profile definition.
 * @param {object} options.classDocument Owning persistence class document.
 * @param {number} options.classIndex Class index.
 * @param {number} options.baseMinuteOffset Base timestamp offset for the owning class.
 * @param {Array<object>} options.fullDefinitions Full (keyed-task) definitions.
 * @param {Array<object>} options.partialOnlyDefinitions Partial-only registry rows.
 * @returns {Array<object>} Persistence assignment records for the class.
 */
function buildClassAssignments({
  faker,
  profileDefinition,
  classDocument,
  classIndex,
  baseMinuteOffset,
  fullDefinitions,
  partialOnlyDefinitions,
}) {
  const classAssignments = [];

  for (
    let assignmentIndex = 0;
    assignmentIndex < profileDefinition.assignmentsPerClass;
    assignmentIndex += 1
  ) {
    classAssignments.push(
      buildAssignment({
        faker,
        profileDefinition,
        classDocument,
        classIndex,
        assignmentIndex,
        baseMinuteOffset,
        fullDefinitions,
        partialOnlyDefinitions,
      })
    );
  }

  return classAssignments;
}

/**
 * Builds the persistence assignment graph for every class.
 *
 * @param {object} options Assignment graph inputs.
 * @param {{number: {int: (options: {min: number, max: number}) => number}}} options.faker Seeded Faker instance.
 * @param {{name: string, seed: number, studentsPerClass: number, assignmentsPerClass: number}} options.profileDefinition Resolved profile definition.
 * @param {Array<object>} options.classes Persistence class documents.
 * @param {Array<object>} options.fullDefinitions Full (keyed-task) definitions.
 * @param {Array<object>} options.partialOnlyDefinitions Partial-only registry rows.
 * @returns {Array<object>} Persistence assignment records.
 */
export function generateClassAssignments({
  faker,
  profileDefinition,
  classes,
  fullDefinitions,
  partialOnlyDefinitions,
}) {
  const assignments = [];

  for (const [classIndex, classDocument] of classes.entries()) {
    assignments.push(
      ...buildClassAssignments({
        faker,
        profileDefinition,
        classDocument,
        classIndex,
        baseMinuteOffset: classIndex * MINUTES_PER_CLASS,
        fullDefinitions,
        partialOnlyDefinitions,
      })
    );
  }

  return assignments;
}
