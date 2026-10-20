import { loadSyntheticAnalysisProfile } from './loadSyntheticAnalysisProfile.js';

const VIEW_NAMES = [
  'classPartials',
  'classesById',
  'assignmentsByKey',
  'editableDefinitions',
  'assignmentDefinitionPartials',
];

/**
 * Copies a canonical definition into the backend's embedded partial-definition shape.
 * Editable definitions are transport summaries with lightweight task arrays;
 * ABClass assignments need the array representation accepted by
 * AssignmentDefinition.fromJSON().
 * @param {object} definition Canonical full or partial definition.
 * @returns {object} An independently owned partial definition payload.
 */
function toPartialDefinition(definition) {
  const copy = structuredClone(definition);
  if (!Array.isArray(copy.tasks)) {
    copy.tasks = Object.values(copy.tasks).map((task) => ({
      taskId: task.taskId ?? task.id,
      taskWeighting: task.taskWeighting,
      taskTitle: task.taskTitle,
    }));
  }
  return copy;
}

/**
 * Resolves a referenced definition without promoting registry-only definitions.
 * @param {string} definitionKey Referenced canonical definition key.
 * @param {Map<string, object>} editable Editable definition summaries by key.
 * @param {Map<string, object>} partials Partial registry definitions by key.
 * @returns {object} Definition matching the source's full/partial requirement.
 */
function resolveDefinition(definitionKey, editable, partials) {
  if (typeof definitionKey !== 'string' || !definitionKey) {
    throw new Error(`Missing canonical assignment definition key: ${String(definitionKey)}.`);
  }
  const definition = editable.get(definitionKey) ?? partials.get(definitionKey);
  if (!definition) {
    throw new Error(`No canonical assignment definition found for "${definitionKey}".`);
  }
  if (definition.definitionKey !== definitionKey) {
    throw new Error(`Canonical definition key mismatch for "${definitionKey}".`);
  }
  return definition;
}

/**
 * Adapts the assignments embedded in one canonical class view.
 * @param {string} classId Canonical class identifier.
 * @param {object} classInput Cloned class view.
 * @param {Map<string, object>} editable Editable definition summaries by key.
 * @param {Map<string, object>} partials Partial definitions by key.
 */
function adaptClassAssignments(classId, classInput, editable, partials) {
  if (classInput.classId !== classId || !Array.isArray(classInput.assignments)) {
    throw new Error(`Malformed canonical class model input for "${classId}".`);
  }
  classInput.assignments = classInput.assignments.map((assignment) => {
    const definition = resolveDefinition(assignment.assignmentDefinitionKey, editable, partials);
    return {
      ...structuredClone(assignment),
      assignmentDefinition: toPartialDefinition(definition),
    };
  });
}

/**
 * Validates standalone assignment references without replacing their full canonical definitions.
 * @param {Record<string, object>} assignments Cloned standalone full assignments.
 * @param {Map<string, object>} editable Editable definition summaries by key.
 * @param {Map<string, object>} partials Partial definitions by key.
 * @returns {void} Does not modify the standalone assignments.
 * @throws {Error} If a definition reference or assignment key is invalid.
 */
function adaptStandaloneAssignments(assignments, editable, partials) {
  for (const [key, assignment] of Object.entries(assignments)) {
    const definitionKey = assignment.assignmentDefinition?.definitionKey;
    resolveDefinition(definitionKey, editable, partials);
    if (!editable.has(definitionKey)) {
      throw new Error(
        `Standalone assignment "${assignment.assignmentId}" has no full canonical definition "${definitionKey}".`
      );
    }
    if (key !== assignment.assignmentId) {
      throw new Error(`Canonical assignment key mismatch for "${assignment.assignmentId}".`);
    }
    // assignmentsByKey already carries the full keyed-task definition and its
    // freshness metadata. The editable view is only a summary for identity
    // resolution; replacing the embedded record would make Assignment.toJSON()
    // treat this full assignment as partial.
  }
}

/**
 * Loads canonical transport views and adapts cloned records to backend model JSON.
 *
 * Class-embedded assignments use the raw root `assignmentDefinitionKey` and remain
 * redacted partials; standalone assignment records use the nested definition's
 * `definitionKey` and retain their full tasks and submissions. Definitions that
 * exist only in the partial registry remain partial. Every returned representation
 * is independently cloned, and frozen loader data is never modified.
 *
 * @param {string} profileName Explicit committed profile name (`small`, `medium`, or
 *   `large-representative`).
 * @returns {{classPartials: Array<object>, classesById: Record<string, object>, assignmentsByKey: Record<string, object>}} Backend restoration inputs.
 * @throws {Error} If a canonical view or referenced definition is missing or malformed.
 */
export function loadBackendModelInputs(profileName) {
  const [classPartials, classesById, assignmentsByKey, editableDefinitions, definitionRows] =
    VIEW_NAMES.map((viewName) =>
      structuredClone(loadSyntheticAnalysisProfile(profileName, viewName))
    );
  const partialDefinitions = new Map(
    definitionRows.map((definition) => [definition.definitionKey, definition])
  );
  const editableByKey = new Map(Object.entries(editableDefinitions));

  for (const [classId, classInput] of Object.entries(classesById)) {
    adaptClassAssignments(classId, classInput, editableByKey, partialDefinitions);
  }

  adaptStandaloneAssignments(assignmentsByKey, editableByKey, partialDefinitions);

  return { classPartials, classesById, assignmentsByKey };
}
