import { toPartialSubmission } from './projectSubmissionViews.js';

/**
 * Class transport projection between persistence and the class partial and
 * full class views.
 *
 * @remarks
 * The class view embeds the persisted roster and redacted partial assignments;
 * submission and artefact redaction is delegated to `projectSubmissionViews.js`.
 */

/**
 * Projects a persistence class document into a class partial.
 *
 * @param {object} classDocument Persistence class document.
 * @returns {object} ClassPartial transport view.
 */
function toClassPartial(classDocument) {
  return {
    classId: classDocument.classId,
    className: classDocument.className,
    cohortKey: classDocument.cohortKey,
    courseLength: classDocument.courseLength,
    yearGroupKey: classDocument.yearGroupKey,
    classOwner: classDocument.classOwner,
    teachers: classDocument.teachers,
    active: classDocument.active,
  };
}

/**
 * Projects a persistence assignment into a class-embedded assignment partial.
 *
 * @remarks
 * `courseId` and `assignmentName` are part of the backend `toPartialJSON()` wire
 * representation even though the frontend `AssignmentPartialSchema` strips them.
 * They are retained so the raw transport view matches the backend output.
 *
 * @param {object} assignment Persistence assignment record.
 * @returns {object} AssignmentPartial transport view.
 */
function toPartialAssignment(assignment) {
  return {
    courseId: assignment.courseId,
    assignmentId: assignment.assignmentId,
    assignmentName: assignment.assignmentName,
    dueDate: assignment.dueDate,
    updatedAt: assignment.updatedAt,
    createdAt: assignment.createdAt,
    documentType: assignment.documentType,
    submissions: assignment.submissions.map(toPartialSubmission),
    assignmentDefinitionKey: assignment.assignmentDefinitionKey,
  };
}

/**
 * Groups persistence assignments by class, rejecting an unknown definition key.
 *
 * @param {Array<object>} assignments Persistence assignment records.
 * @param {Map<string, object>} definitionByKey Persistence definitions keyed by definitionKey.
 * @returns {Map<string, Array<object>>} Assignments keyed by class identifier.
 */
function groupAssignmentsByClassId(assignments, definitionByKey) {
  const assignmentsByClassId = new Map();

  for (const assignment of assignments) {
    if (!definitionByKey.has(assignment.assignmentDefinitionKey)) {
      throw new Error(
        `Assignment "${assignment.assignmentId}" references unknown definition "${assignment.assignmentDefinitionKey}".`
      );
    }
    const classAssignments = assignmentsByClassId.get(assignment.courseId) ?? [];
    classAssignments.push(assignment);
    assignmentsByClassId.set(assignment.courseId, classAssignments);
  }

  return assignmentsByClassId;
}

/**
 * Builds the class partial list and the full class views keyed by class identifier.
 *
 * @param {Array<object>} classes Persistence class documents.
 * @param {Array<object>} assignments Persistence assignment records.
 * @param {Map<string, object>} definitionByKey Persistence definitions keyed by definitionKey.
 * @returns {{classPartials: Array<object>, classesById: Record<string, object>}} Class transport views.
 */
export function buildClassTransportViews(classes, assignments, definitionByKey) {
  const assignmentsByClassId = groupAssignmentsByClassId(assignments, definitionByKey);
  const classesById = {};

  for (const classDocument of classes) {
    const classAssignments = assignmentsByClassId.get(classDocument.classId) ?? [];
    classesById[classDocument.classId] = {
      ...toClassPartial(classDocument),
      students: classDocument.students,
      assignments: classAssignments.map(toPartialAssignment),
    };
  }

  return {
    classPartials: classes.map(toClassPartial),
    classesById,
  };
}
