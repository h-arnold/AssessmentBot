import { fail } from './invariantGuards.js';
import { LARGE_FULL_COMPLETION_BANDS, LARGE_FULL_PROFILE_NAME } from './profileDefinitions.js';
import { collectRosterIds } from './validationContext.js';
import { assertAssignmentsByKeyView } from './validateAssignmentsByKeyView.js';
import { assertClassPartialsView } from './validateClassPartialsView.js';
import { assertCompletionBands } from './validateProfileInvariants.js';

/**
 * Asserts a transport class view carries the profile's roster and assignment counts
 * and resolvable reference keys.
 *
 * @param {string} classId Class identifier used in failure messages.
 * @param {object} classFull Transport class view.
 * @param {object} context Validation context.
 */
function assertTransportClassProfileShape(classId, classFull, context) {
  const { profile, yearGroupKeys, cohortKeys } = context;

  if (classFull.students.length !== profile.studentsPerClass) {
    fail(
      `Class "${classId}" has ${classFull.students.length} students but the "${profile.name}" profile requires ${profile.studentsPerClass}.`
    );
  }
  if (classFull.assignments.length !== profile.assignmentsPerClass) {
    fail(
      `Class "${classId}" has ${classFull.assignments.length} assignments but the "${profile.name}" profile requires ${profile.assignmentsPerClass}.`
    );
  }
  if (typeof classFull.yearGroupKey !== 'string' || !yearGroupKeys.has(classFull.yearGroupKey)) {
    fail(
      `Class "${classId}" has yearGroupKey ${JSON.stringify(classFull.yearGroupKey)}; every class yearGroupKey must resolve in referenceData.yearGroups.`
    );
  }
  if (classFull.cohortKey !== null && !cohortKeys.has(classFull.cohortKey)) {
    fail(
      `Class "${classId}" cohortKey "${classFull.cohortKey}" does not resolve in referenceData.cohorts.`
    );
  }
}

/**
 * Asserts a submission item references a task declared by its assignment definition.
 *
 * @param {string} classId Class identifier used in failure messages.
 * @param {object} assignment Owning transport assignment.
 * @param {object} item Partial submission item.
 * @param {Set<string>|undefined} taskIds Declared task IDs.
 */
function assertItemTaskDeclared(classId, assignment, item, taskIds) {
  if (taskIds !== undefined && !taskIds.has(item.taskId)) {
    fail(
      `Class "${classId}" assignment "${assignment.assignmentId}" submission item references task "${item.taskId}" not declared by definition "${assignment.assignmentDefinitionKey}".`
    );
  }
}

/**
 * Asserts a partial submission item has redacted its artefact content fields.
 *
 * @param {object} item Partial submission item.
 */
function assertArtefactRedacted(item) {
  if (item.artifact.content !== null) {
    fail(
      `Partial submission item "${item.id}" must redact artefact content but carries ${JSON.stringify(item.artifact.content)}.`
    );
  }
  if (item.artifact.contentHash !== null) {
    fail(
      `Partial submission item "${item.id}" must redact artefact contentHash but carries ${JSON.stringify(item.artifact.contentHash)}.`
    );
  }
}

/**
 * Asserts a partial submission item carries no assessment reasoning.
 *
 * @param {object} item Partial submission item.
 */
function assertReasoningRedacted(item) {
  for (const assessment of Object.values(item.assessments ?? {})) {
    if ('reasoning' in assessment) {
      fail(`Partial submission item "${item.id}" must not carry assessment reasoning.`);
    }
  }
}

/**
 * Asserts a partial submission item references a declared task and has redacted
 * its artefact and assessment-reasoning fields.
 *
 * @param {string} classId Class identifier used in failure messages.
 * @param {object} assignment Owning transport assignment.
 * @param {object} item Partial submission item.
 * @param {Set<string>|undefined} taskIds Declared task IDs.
 */
function assertPartialItemRedaction(classId, assignment, item, taskIds) {
  assertItemTaskDeclared(classId, assignment, item, taskIds);
  assertArtefactRedacted(item);
  assertReasoningRedacted(item);
}

/**
 * Asserts a class-embedded assignment identifier resolves to the persistence
 * assignment owned by the enclosing class.
 *
 * @param {string} classId Class identifier used in failure messages.
 * @param {object} assignment Transport assignment partial.
 * @param {Map<string, object>} persistenceAssignmentByAssignmentId Persistence assignments keyed by assignment ID.
 * @returns {object} The resolved persistence assignment owning this entry.
 */
function assertTransportAssignmentOwnership(
  classId,
  assignment,
  persistenceAssignmentByAssignmentId
) {
  const persistenceAssignment = persistenceAssignmentByAssignmentId.get(assignment.assignmentId);
  if (persistenceAssignment === undefined) {
    fail(
      `Class "${classId}" assignment "${assignment.assignmentId}" does not resolve to a persistence assignment.`
    );
  }
  if (persistenceAssignment.courseId !== classId) {
    fail(
      `Class "${classId}" assignment "${assignment.assignmentId}" does not match its persistence owning class "${String(persistenceAssignment.courseId)}".`
    );
  }
  return persistenceAssignment;
}

/**
 * Asserts a class-embedded assignment preserves its persistence owner's
 * assignmentDefinitionKey.
 *
 * @param {string} classId Class identifier used in failure messages.
 * @param {object} assignment Transport assignment partial.
 * @param {object} persistenceAssignment The persistence assignment owning this entry.
 */
function assertTransportAssignmentDefinitionKey(classId, assignment, persistenceAssignment) {
  if (assignment.assignmentDefinitionKey !== persistenceAssignment.assignmentDefinitionKey) {
    fail(
      `Class "${classId}" assignment "${assignment.assignmentId}" carries assignmentDefinitionKey ${JSON.stringify(assignment.assignmentDefinitionKey)} instead of its persistence owner's "${persistenceAssignment.assignmentDefinitionKey}".`
    );
  }
}

/**
 * Asserts one transport class assignment belongs to its owning class, resolves
 * its persistence assignment and definition, and every partial submission
 * references the roster, its owning assignment, and a declared task.
 *
 * @param {string} classId Class identifier used in failure messages.
 * @param {object} assignment Transport assignment partial.
 * @param {Set<string>} transportStudentIds Transport class roster IDs.
 * @param {object} context Validation context.
 */
function assertTransportAssignmentEntry(classId, assignment, transportStudentIds, context) {
  const { definitionByKey, definitionTaskIdsByKey, persistenceAssignmentByAssignmentId } = context;
  const persistenceAssignment = assertTransportAssignmentOwnership(
    classId,
    assignment,
    persistenceAssignmentByAssignmentId
  );
  assertTransportAssignmentDefinitionKey(classId, assignment, persistenceAssignment);
  if (assignment.courseId !== classId) {
    fail(
      `Class "${classId}" assignment "${assignment.assignmentId}" carries courseId "${String(assignment.courseId)}" instead of its owning class.`
    );
  }
  const definition = definitionByKey.get(assignment.assignmentDefinitionKey);
  if (definition === undefined) {
    fail(
      `Class "${classId}" assignment "${assignment.assignmentId}" references unknown assignmentDefinitionKey "${assignment.assignmentDefinitionKey}".`
    );
  }
  const taskIds = definitionTaskIdsByKey.get(assignment.assignmentDefinitionKey);

  for (const submission of assignment.submissions) {
    if (submission.assignmentId !== assignment.assignmentId) {
      fail(
        `Class "${classId}" assignment "${assignment.assignmentId}" submission for student "${submission.studentId}" names parent assignment "${String(submission.assignmentId)}" instead of its owning assignment.`
      );
    }
    if (!transportStudentIds.has(submission.studentId)) {
      fail(
        `Class "${classId}" assignment "${assignment.assignmentId}" submission references student "${submission.studentId}" outside the class roster.`
      );
    }
    for (const item of Object.values(submission.items)) {
      assertPartialItemRedaction(classId, assignment, item, taskIds);
    }
  }
}

/**
 * Asserts a classesById entry's classId matches its record key.
 *
 * @param {string} classId The classesById record key.
 * @param {object} classFull Transport class view.
 */
function assertTransportClassIdentity(classId, classFull) {
  if (classFull.classId !== classId) {
    fail(
      `transport.classesById key "${classId}" does not match classFull.classId ${JSON.stringify(classFull.classId)}.`
    );
  }
}

/**
 * Asserts the transport classesById view matches persistence and each class
 * resolves its references and redacts partial artefacts.
 *
 * @param {object} transport Generated transport view.
 * @param {object} context Validation context.
 */
function assertTransportClassesResolveReferences(transport, context) {
  const { persistenceClassIds } = context;
  const transportClassIds = new Set(Object.keys(transport.classesById));
  if (transportClassIds.size !== persistenceClassIds.size) {
    fail(
      `transport.classesById holds ${transportClassIds.size} classes but persistence holds ${persistenceClassIds.size}.`
    );
  }
  for (const classId of transportClassIds) {
    if (!persistenceClassIds.has(classId)) {
      fail(`transport.classesById class "${classId}" does not exist in persistence.classes.`);
    }
  }

  for (const [classId, classFull] of Object.entries(transport.classesById)) {
    assertTransportClassIdentity(classId, classFull);
    assertTransportClassProfileShape(classId, classFull, context);
    const transportStudentIds = collectRosterIds(classId, classFull.students);

    for (const assignment of classFull.assignments) {
      assertTransportAssignmentEntry(classId, assignment, transportStudentIds, context);
    }
  }
}

/**
 * Asserts every transport definition resolves in the persistence definition set.
 *
 * @param {object} transport Generated transport view.
 * @param {Map<string, object>} definitionByKey Persistence definitions keyed by definitionKey.
 */
function assertTransportDefinitionsMatchPersistence(transport, definitionByKey) {
  const persistenceDefinitionKeys = new Set(definitionByKey.keys());
  const transportDefinitionKeys = new Set(
    transport.assignmentDefinitionPartials.map((definition) => definition.definitionKey)
  );
  if (persistenceDefinitionKeys.size !== transportDefinitionKeys.size) {
    fail(
      `Transport exposes ${transportDefinitionKeys.size} assignment definitions but persistence holds ${persistenceDefinitionKeys.size}.`
    );
  }
  for (const definitionKey of transportDefinitionKeys) {
    if (!persistenceDefinitionKeys.has(definitionKey)) {
      fail(`Transport definition "${definitionKey}" does not exist in persistence.`);
    }
  }
}

/**
 * Validates the four named transport views: class partials, class and assignment
 * references, partial redaction, completion bands, and definition coverage.
 *
 * @param {object} options Validation inputs.
 * @param {object} options.transport Generated transport view.
 * @param {Array<object>} options.assignments Persistence assignment records.
 * @param {object} options.context Validation context.
 */
export function validateTransportGraph({ transport, assignments, context }) {
  assertClassPartialsView({
    classPartials: transport.classPartials,
    persistenceClassIds: context.persistenceClassIds,
    yearGroupKeys: context.yearGroupKeys,
    cohortKeys: context.cohortKeys,
  });

  assertTransportClassesResolveReferences(transport, context);

  if (context.profile.name === LARGE_FULL_PROFILE_NAME) {
    assertCompletionBands(transport.classesById, LARGE_FULL_COMPLETION_BANDS);
  }

  assertAssignmentsByKeyView({
    assignmentsByKey: transport.assignmentsByKey,
    assignments,
    definitionByKey: context.definitionByKey,
    rosterByClassId: context.rosterByClassId,
    definitionTaskIdsByKey: context.definitionTaskIdsByKey,
  });

  assertTransportDefinitionsMatchPersistence(transport, context.definitionByKey);
}
