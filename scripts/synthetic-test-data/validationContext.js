import { fail } from './invariantGuards.js';
import { getProfileDefinition } from './profileDefinitions.js';

/**
 * Collects the declared task IDs from a keyed or array task collection.
 *
 * @param {Record<string, object>|Array<{taskId: string}>} tasks Persistence tasks.
 * @returns {Set<string>} Declared task IDs.
 */
function collectTaskIds(tasks) {
  return Array.isArray(tasks)
    ? new Set(tasks.map((task) => task.taskId))
    : new Set(Object.keys(tasks));
}

/**
 * Collects unique roster student IDs, failing on a duplicate identifier.
 *
 * @param {string} classId Class identifier used in failure messages.
 * @param {Array<{id: string}>} students Roster students.
 * @returns {Set<string>} Unique roster student IDs.
 */
export function collectRosterIds(classId, students) {
  const studentIds = new Set();

  for (const student of students) {
    if (studentIds.has(student.id)) {
      fail(`duplicate student id "${student.id}" in class "${classId}" roster.`);
    }
    studentIds.add(student.id);
  }

  return studentIds;
}

/**
 * Builds the shared lookup context used by the graph invariant checks.
 *
 * @param {object} manifest Generated manifest.
 * @param {object} referenceData Generated reference-data view.
 * @param {object} persistence Generated persistence graph.
 * @returns {object} Validation context.
 */
export function buildValidationContext(manifest, referenceData, persistence) {
  const profile = getProfileDefinition(manifest.profile);
  const persistenceClassIds = new Set(persistence.classes.map((entry) => entry.classId));
  const yearGroupKeys = new Set(referenceData.yearGroups.map((yearGroup) => yearGroup.key));
  const cohortKeys = new Set(referenceData.cohorts.map((cohort) => cohort.key));
  const topicKeys = new Set(referenceData.assignmentTopics.map((topic) => topic.key));
  const definitionByKey = new Map();
  const definitionTaskIdsByKey = new Map();
  for (const definition of persistence.assignmentDefinitions) {
    if (definitionByKey.has(definition.definitionKey)) {
      fail(
        `duplicate assignment definition key "${definition.definitionKey}" in persistence.assignmentDefinitions.`
      );
    }
    definitionByKey.set(definition.definitionKey, definition);
    definitionTaskIdsByKey.set(definition.definitionKey, collectTaskIds(definition.tasks));
  }

  const rosterByClassId = new Map(
    persistence.classes.map((classDocument) => [
      classDocument.classId,
      new Set(classDocument.students.map((student) => student.id)),
    ])
  );

  const persistenceAssignmentByAssignmentId = new Map();
  for (const assignment of persistence.assignments) {
    if (persistenceAssignmentByAssignmentId.has(assignment.assignmentId)) {
      fail(`duplicate assignment id "${assignment.assignmentId}" in persistence.assignments.`);
    }
    persistenceAssignmentByAssignmentId.set(assignment.assignmentId, assignment);
  }

  return {
    profile,
    persistenceClassIds,
    yearGroupKeys,
    cohortKeys,
    topicKeys,
    definitionByKey,
    definitionTaskIdsByKey,
    rosterByClassId,
    persistenceAssignmentByAssignmentId,
  };
}
