import { fail, isRecord } from './invariantGuards.js';
import { assertTransportView } from './validateTransportViews.js';

/**
 * Asserts an assignmentsByKey key resolves to a full persistence assignment.
 *
 * @param {string} assignmentId The assignmentsByKey key under test.
 * @param {Map<string, object>} persistenceAssignmentByAssignmentId Persistence assignments keyed by assignment ID.
 */
function assertAssignmentKeyResolves(assignmentId, persistenceAssignmentByAssignmentId) {
  if (!persistenceAssignmentByAssignmentId.has(assignmentId)) {
    fail(
      `transport.assignmentsByKey key "${assignmentId}" does not resolve to a full persistence assignment.`
    );
  }
}

/**
 * Asserts an assignmentsByKey entry carries a matching identifier and a courseId
 * equal to its persistence owner.
 *
 * @param {string} assignmentId The assignmentsByKey key under test.
 * @param {object} assignment The entry under test.
 * @param {object} persistenceAssignment The persistence assignment owning this entry.
 */
function assertAssignmentIdentity(assignmentId, assignment, persistenceAssignment) {
  if (assignment.assignmentId !== assignmentId) {
    fail(
      `transport.assignmentsByKey key "${assignmentId}" does not match assignment.assignmentId ${JSON.stringify(assignment.assignmentId)}.`
    );
  }
  if (assignment.courseId !== persistenceAssignment.courseId) {
    fail(
      `transport.assignmentsByKey assignment "${assignmentId}" courseId ${JSON.stringify(assignment.courseId)} does not match its persistence owning class ${JSON.stringify(persistenceAssignment.courseId)}.`
    );
  }
}

/**
 * Asserts every submission in a full assignment names its owning assignment.
 *
 * @param {string} assignmentId The assignmentsByKey key under test.
 * @param {object} assignment The entry under test.
 */
function assertSubmissionParentAssignments(assignmentId, assignment) {
  for (const submission of assignment.submissions) {
    if (submission.assignmentId !== assignment.assignmentId) {
      fail(
        `transport.assignmentsByKey assignment "${assignmentId}" submission for student "${submission.studentId}" names parent assignment "${String(submission.assignmentId)}" instead of its owning assignment.`
      );
    }
  }
}

/**
 * Asserts every submission in a full assignment belongs to a student on the
 * roster of its persistence owning class.
 *
 * @param {string} assignmentId The assignmentsByKey key under test.
 * @param {object} assignment The entry under test.
 * @param {object} persistenceAssignment The persistence assignment owning this entry.
 * @param {Map<string, Set<string>>} rosterByClassId Persistence roster student IDs keyed by class ID.
 */
function assertSubmissionRosterMembership(
  assignmentId,
  assignment,
  persistenceAssignment,
  rosterByClassId
) {
  const rosterIds = rosterByClassId.get(persistenceAssignment.courseId);
  if (rosterIds === undefined) {
    fail(
      `transport.assignmentsByKey assignment "${assignmentId}" owning class ${JSON.stringify(persistenceAssignment.courseId)} does not resolve to a generated class roster.`
    );
  }
  for (const submission of assignment.submissions) {
    if (!rosterIds.has(submission.studentId)) {
      fail(
        `transport.assignmentsByKey assignment "${assignmentId}" submission references student "${submission.studentId}" outside class "${persistenceAssignment.courseId}".`
      );
    }
  }
}

/**
 * Asserts every item in a full assignment submission references a task declared
 * by its persistence assignment definition.
 *
 * @param {string} assignmentId The assignmentsByKey key under test.
 * @param {object} assignment The entry under test.
 * @param {object} persistenceAssignment The persistence assignment owning this entry.
 * @param {Map<string, Set<string>>} definitionTaskIdsByKey Declared task IDs keyed by definitionKey.
 */
function assertSubmissionItemTaskReferences(
  assignmentId,
  assignment,
  persistenceAssignment,
  definitionTaskIdsByKey
) {
  const taskIds = definitionTaskIdsByKey.get(persistenceAssignment.assignmentDefinitionKey);
  if (taskIds === undefined) {
    fail(
      `transport.assignmentsByKey assignment "${assignmentId}" definition "${persistenceAssignment.assignmentDefinitionKey}" does not declare tasks.`
    );
  }
  for (const submission of assignment.submissions) {
    for (const item of Object.values(submission.items)) {
      if (!taskIds.has(item.taskId)) {
        fail(
          `transport.assignmentsByKey assignment "${assignmentId}" submission item references task "${item.taskId}" not declared by definition "${persistenceAssignment.assignmentDefinitionKey}".`
        );
      }
    }
  }
}

/**
 * Asserts an assignmentsByKey entry preserves its persistence definition key.
 *
 * @param {string} assignmentId The assignmentsByKey key under test.
 * @param {object} assignment The entry under test.
 * @param {object} persistenceAssignment The persistence assignment owning this entry.
 */
function assertAssignmentDefinitionKey(assignmentId, assignment, persistenceAssignment) {
  if (
    !isRecord(assignment.assignmentDefinition) ||
    assignment.assignmentDefinition.definitionKey !== persistenceAssignment.assignmentDefinitionKey
  ) {
    fail(
      `transport.assignmentsByKey assignment "${assignmentId}" does not preserve persistence definitionKey "${persistenceAssignment.assignmentDefinitionKey}".`
    );
  }
}

/**
 * Asserts one assignmentsByKey entry resolves, matches its persistence owner,
 * preserves its definition key, and binds every submission and item to the
 * persistence owner's roster and definition.
 *
 * @param {object} options Entry validation inputs.
 * @param {string} options.assignmentId The assignmentsByKey key under test.
 * @param {object} options.assignment The entry under test.
 * @param {Map<string, object>} options.persistenceAssignmentByAssignmentId Persistence assignments keyed by assignment ID.
 * @param {Map<string, Set<string>>} options.rosterByClassId Persistence roster student IDs keyed by class ID.
 * @param {Map<string, Set<string>>} options.definitionTaskIdsByKey Declared task IDs keyed by definitionKey.
 */
function assertAssignmentByKeyEntry({
  assignmentId,
  assignment,
  persistenceAssignmentByAssignmentId,
  rosterByClassId,
  definitionTaskIdsByKey,
}) {
  assertAssignmentKeyResolves(assignmentId, persistenceAssignmentByAssignmentId);
  if (!isRecord(assignment)) {
    fail(`transport.assignmentsByKey entry "${assignmentId}" must be an object.`);
  }
  const persistenceAssignment = persistenceAssignmentByAssignmentId.get(assignmentId);
  assertAssignmentIdentity(assignmentId, assignment, persistenceAssignment);
  assertAssignmentDefinitionKey(assignmentId, assignment, persistenceAssignment);
  assertSubmissionParentAssignments(assignmentId, assignment);
  assertSubmissionRosterMembership(
    assignmentId,
    assignment,
    persistenceAssignment,
    rosterByClassId
  );
  assertSubmissionItemTaskReferences(
    assignmentId,
    assignment,
    persistenceAssignment,
    definitionTaskIdsByKey
  );
}

/**
 * Asserts the assignmentsByKey view holds exactly the persistence assignments
 * backed by a full definition, preserving each definition key.
 *
 * @param {object} options Validation inputs.
 * @param {Record<string, object>} options.assignmentsByKey Full assignment transport view.
 * @param {Array<object>} options.assignments Persistence assignment records.
 * @param {Map<string, object>} options.definitionByKey Persistence definitions keyed by definitionKey.
 * @param {Map<string, Set<string>>} options.rosterByClassId Persistence roster student IDs keyed by class ID.
 * @param {Map<string, Set<string>>} options.definitionTaskIdsByKey Declared task IDs keyed by definitionKey.
 */
export function assertAssignmentsByKeyView({
  assignmentsByKey,
  assignments,
  definitionByKey,
  rosterByClassId,
  definitionTaskIdsByKey,
}) {
  assertTransportView(assignmentsByKey, 'assignmentsByKey', 'record');

  const persistenceAssignmentByAssignmentId = new Map();
  for (const assignment of assignments) {
    const definition = definitionByKey.get(assignment.assignmentDefinitionKey);
    if (definition === undefined || Array.isArray(definition.tasks)) {
      continue;
    }
    persistenceAssignmentByAssignmentId.set(assignment.assignmentId, assignment);
  }

  const transportAssignmentIds = new Set(Object.keys(assignmentsByKey));
  if (transportAssignmentIds.size !== persistenceAssignmentByAssignmentId.size) {
    fail(
      `transport.assignmentsByKey holds ${transportAssignmentIds.size} full assignments but persistence holds ${persistenceAssignmentByAssignmentId.size}.`
    );
  }

  for (const [assignmentId, assignment] of Object.entries(assignmentsByKey)) {
    assertAssignmentByKeyEntry({
      assignmentId,
      assignment,
      persistenceAssignmentByAssignmentId,
      rosterByClassId,
      definitionTaskIdsByKey,
    });
  }
}
