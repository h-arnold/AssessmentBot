import { toFullSubmission } from './projectSubmissionViews.js';
import { buildClassTransportViews } from './projectClassTransportViews.js';

/**
 * Projects the persistence graph into the five named transport views.
 *
 * @remarks
 * This is the composition point for partial and full transport views. Class
 * transport views are built by `projectClassTransportViews.js`; submission and
 * artefact projection (including redaction) is delegated to
 * `projectSubmissionViews.js`.
 */

/**
 * Projects the keyed or partial-array tasks of a persistence definition into the
 * lightweight partial task array.
 *
 * @param {Record<string, object>|Array<object>} tasks Persistence tasks.
 * @returns {Array<{taskId: string, taskWeighting: number, taskTitle: string|null}>} Partial task summaries.
 */
function toPartialTasks(tasks) {
  if (Array.isArray(tasks)) {
    return tasks.map((task) => ({
      taskId: task.taskId,
      taskWeighting: task.taskWeighting,
      taskTitle: task.taskTitle ?? null,
    }));
  }

  return Object.entries(tasks).map(([taskId, task]) => ({
    taskId,
    taskWeighting: task.taskWeighting,
    taskTitle: task.taskTitle ?? null,
  }));
}

/**
 * Projects a persistence definition into a definition partial.
 *
 * @param {object} definition Persistence assignment definition.
 * @param {Map<string, string>} yearGroupNameByKey Year-group display names keyed by key.
 * @returns {object} AssignmentDefinitionPartial transport view.
 */
function toDefinitionPartial(definition, yearGroupNameByKey) {
  return {
    primaryTitle: definition.primaryTitle,
    primaryTopic: definition.primaryTopic,
    primaryTopicKey: definition.primaryTopicKey,
    yearGroupKey: definition.yearGroupKey,
    yearGroupLabel: yearGroupNameByKey.get(definition.yearGroupKey) ?? definition.yearGroupLabel,
    alternateTitles: definition.alternateTitles,
    alternateTopics: definition.alternateTopics,
    documentType: definition.documentType,
    referenceDocumentId: definition.referenceDocumentId,
    templateDocumentId: definition.templateDocumentId,
    assignmentWeighting: definition.assignmentWeighting,
    definitionKey: definition.definitionKey,
    tasks: toPartialTasks(definition.tasks),
    createdAt: definition.createdAt,
    updatedAt: definition.updatedAt,
  };
}

/**
 * Projects a persistence definition into a full definition, preserving the
 * persisted document identifiers and numeric weighting exactly.
 *
 * @param {object} definition Persistence assignment definition.
 * @returns {object} Full AssignmentDefinition transport view.
 */
function toFullDefinition(definition) {
  return {
    primaryTitle: definition.primaryTitle,
    primaryTopic: definition.primaryTopic,
    primaryTopicKey: definition.primaryTopicKey,
    yearGroupKey: definition.yearGroupKey,
    yearGroupLabel: definition.yearGroupLabel,
    alternateTitles: definition.alternateTitles,
    alternateTopics: definition.alternateTopics,
    documentType: definition.documentType,
    referenceDocumentId: definition.referenceDocumentId,
    templateDocumentId: definition.templateDocumentId,
    referenceLastModified: definition.referenceLastModified,
    templateLastModified: definition.templateLastModified,
    assignmentWeighting: definition.assignmentWeighting,
    definitionKey: definition.definitionKey,
    tasks: definition.tasks,
    createdAt: definition.createdAt,
    updatedAt: definition.updatedAt,
  };
}

/**
 * Reports whether a persistence definition carries a full definition that can
 * hydrate into an editable transport record.
 *
 * @param {object} definition Persistence assignment definition.
 * @returns {boolean} True for full definitions with document identifiers and keyed tasks.
 */
function isFullDefinition(definition) {
  return (
    !Array.isArray(definition.tasks) &&
    definition.referenceDocumentId !== null &&
    definition.templateDocumentId !== null
  );
}

/**
 * Projects a persistence definition into an editable full-definition transport
 * record, applying the backend response-mapper transformation.
 *
 * @remarks
 * Keyed tasks become a lightweight `{taskId, taskTitle, taskWeighting}` array
 * with null-weighting tasks filtered out, and the `referenceLastModified` and
 * `templateLastModified` freshness fields are omitted, matching
 * `AssignmentDefinitionResponseMapper._getFullAssignmentDefinition`.
 *
 * @param {object} definition Persistence assignment definition.
 * @param {Map<string, string>} yearGroupNameByKey Year-group display names keyed by key.
 * @returns {object} Editable AssignmentDefinition transport record.
 */
function toEditableDefinition(definition, yearGroupNameByKey) {
  const tasks = Object.entries(definition.tasks)
    .filter(([, task]) => task?.taskWeighting !== null && task?.taskWeighting !== undefined)
    .map(([taskId, task]) => ({
      taskId,
      taskTitle: task.taskTitle,
      taskWeighting: task.taskWeighting,
    }));

  return {
    primaryTitle: definition.primaryTitle,
    primaryTopic: definition.primaryTopic,
    primaryTopicKey: definition.primaryTopicKey,
    yearGroupKey: definition.yearGroupKey,
    yearGroupLabel: yearGroupNameByKey.get(definition.yearGroupKey) ?? definition.yearGroupLabel,
    alternateTitles: definition.alternateTitles,
    alternateTopics: definition.alternateTopics,
    documentType: definition.documentType,
    referenceDocumentId: definition.referenceDocumentId,
    templateDocumentId: definition.templateDocumentId,
    assignmentWeighting: definition.assignmentWeighting,
    definitionKey: definition.definitionKey,
    tasks,
    createdAt: definition.createdAt,
    updatedAt: definition.updatedAt,
  };
}

/**
 * Builds the editable full-definition transport view keyed by definition key.
 *
 * @param {Array<object>} assignmentDefinitions Persistence assignment definitions.
 * @param {Map<string, string>} yearGroupNameByKey Year-group display names keyed by key.
 * @returns {Record<string, object>} Editable full-definition records keyed by definition key.
 */
function buildEditableDefinitions(assignmentDefinitions, yearGroupNameByKey) {
  const editableDefinitions = {};

  for (const definition of assignmentDefinitions) {
    // A partial-only registry row cannot hydrate into an editable definition, so
    // it is represented only in the partial views, never here.
    if (!isFullDefinition(definition)) {
      continue;
    }
    editableDefinitions[definition.definitionKey] = toEditableDefinition(
      definition,
      yearGroupNameByKey
    );
  }

  return editableDefinitions;
}

/**
 * Projects a persistence assignment into a full assignment view.
 *
 * @param {object} assignment Persistence assignment record.
 * @param {object} definition Full persistence assignment definition.
 * @returns {object} AssignmentFull transport view.
 */
function toFullAssignment(assignment, definition) {
  return {
    courseId: assignment.courseId,
    assignmentId: assignment.assignmentId,
    assignmentName: assignment.assignmentName,
    dueDate: assignment.dueDate,
    updatedAt: assignment.updatedAt,
    createdAt: assignment.createdAt,
    documentType: assignment.documentType,
    referenceDocumentId: definition.referenceDocumentId,
    templateDocumentId: definition.templateDocumentId,
    tasks: definition.tasks,
    submissions: assignment.submissions.map((submission) => toFullSubmission(submission)),
    assignmentDefinition: toFullDefinition(definition),
  };
}

/**
 * Projects every hydratable assignment into the full assignment view.
 *
 * @param {Array<object>} assignments Persistence assignment records.
 * @param {Map<string, object>} definitionByKey Persistence definitions keyed by definitionKey.
 * @returns {Record<string, object>} Full assignment views keyed by assignment identifier.
 */
function buildAssignmentsByKey(assignments, definitionByKey) {
  const assignmentsByKey = {};

  for (const assignment of assignments) {
    const definition = definitionByKey.get(assignment.assignmentDefinitionKey);
    // A partial-only registry row cannot hydrate into a full assignment, so it is
    // represented only in the class partial view, never as an AssignmentFull.
    if (Array.isArray(definition.tasks)) {
      continue;
    }
    assignmentsByKey[assignment.assignmentId] = toFullAssignment(assignment, definition);
  }

  return assignmentsByKey;
}

/**
 * Builds the transport views consumed by frontend services and focused tests.
 *
 * @param {object} inputs Graph inputs.
 * @param {object} inputs.referenceData Reference-data view.
 * @param {Array<object>} inputs.classes Persistence class documents.
 * @param {Array<object>} inputs.assignmentDefinitions Persistence assignment definitions.
 * @param {Array<object>} inputs.assignments Persistence assignment records.
 * @returns {{classPartials: Array<object>, assignmentDefinitionPartials: Array<object>, editableDefinitions: Record<string, object>, classesById: Record<string, object>, assignmentsByKey: Record<string, object>}} The five named transport views.
 */
export function toTransportViews({ referenceData, classes, assignmentDefinitions, assignments }) {
  const definitionByKey = new Map(
    assignmentDefinitions.map((definition) => [definition.definitionKey, definition])
  );
  const yearGroupNameByKey = new Map(
    referenceData.yearGroups.map((yearGroup) => [yearGroup.key, yearGroup.name])
  );
  const { classPartials, classesById } = buildClassTransportViews(
    classes,
    assignments,
    definitionByKey
  );
  const assignmentDefinitionPartials = assignmentDefinitions.map((definition) =>
    toDefinitionPartial(definition, yearGroupNameByKey)
  );
  const editableDefinitions = buildEditableDefinitions(assignmentDefinitions, yearGroupNameByKey);
  const assignmentsByKey = buildAssignmentsByKey(assignments, definitionByKey);

  return {
    classPartials,
    assignmentDefinitionPartials,
    editableDefinitions,
    classesById,
    assignmentsByKey,
  };
}
