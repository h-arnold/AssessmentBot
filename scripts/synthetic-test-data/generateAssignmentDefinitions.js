import { isoAt } from './deterministicPrimitives.js';

const DOCUMENT_TYPES = ['SLIDES', 'SHEETS'];
const COMPACT_DEFINITION_MINIMUM = 3;
const LARGE_FULL_DEFINITION_COUNT = 8;
const COMPACT_TASKS_PER_DEFINITION = 2;
const LARGE_FULL_TASKS_PER_DEFINITION = 1;
const PARTIAL_ONLY_DEFINITION_COUNT = 1;
const MAX_GENERATED_WEIGHTING = 5;
const MINUTES_PER_DEFINITION = 10;
const TEMPLATE_OFFSET_MINUTES = 4;
const UPDATE_OFFSET_MINUTES = 2;

/**
 * Returns the number of full assignment definitions to generate for a profile.
 *
 * @param {{name: string, yearGroupCount: number}} profileDefinition Resolved profile definition.
 * @returns {number} Full definition count.
 */
function resolveFullDefinitionCount(profileDefinition) {
  if (profileDefinition.name === 'large-full') {
    return LARGE_FULL_DEFINITION_COUNT;
  }
  return Math.max(COMPACT_DEFINITION_MINIMUM, profileDefinition.yearGroupCount);
}

/**
 * Returns the number of tasks carried by each full definition for a profile.
 *
 * @param {{name: string}} profileDefinition Resolved profile definition.
 * @returns {number} Task count per definition.
 */
function resolveTasksPerDefinition(profileDefinition) {
  return profileDefinition.name === 'large-full'
    ? LARGE_FULL_TASKS_PER_DEFINITION
    : COMPACT_TASKS_PER_DEFINITION;
}

/**
 * Builds a full transport-shaped task artifact.
 *
 * @param {object} options Artifact inputs.
 * @param {string} options.taskId Parent task ID.
 * @param {string} options.role Artifact role (`reference` or `template`).
 * @returns {object} A full `BaseTaskArtifact`-shaped artifact.
 */
function buildDefinitionArtifact({ taskId, role }) {
  return {
    taskId,
    role,
    pageId: `page-${taskId}`,
    documentId: `document-${role}-${taskId}`,
    content: `${role} synthetic content for ${taskId}`,
    contentHash: `hash-${role}-${taskId}`,
    metadata: {},
    uid: `uid-${role}-${taskId}`,
    type: 'TEXT',
  };
}

/**
 * Builds a keyed task definition for one assignment definition.
 *
 * @param {object} options Task inputs.
 * @param {number} options.definitionIndex Definition index.
 * @param {number} options.taskIndex Task index within the definition.
 * @returns {object} A keyed task definition.
 */
function buildTask({ definitionIndex, taskIndex }) {
  const taskId = `task-${definitionIndex}-${taskIndex}`;
  return {
    id: taskId,
    taskTitle: `Synthetic Task ${definitionIndex + 1}.${taskIndex + 1}`,
    pageId: `page-${taskId}`,
    taskNotes: null,
    taskMetadata: {},
    taskWeighting: 1,
    index: taskIndex,
    artifacts: {
      reference: [buildDefinitionArtifact({ taskId, role: 'reference' })],
      template: [buildDefinitionArtifact({ taskId, role: 'template' })],
    },
  };
}

/**
 * Builds a full definition that satisfies the documented full model: keyed tasks,
 * non-null reference/template document IDs, and a numeric weighting.
 *
 * @param {object} options Definition inputs.
 * @param {number} options.index Definition index.
 * @param {{name: string, key: string}} options.topic Resolved assignment topic.
 * @param {string} options.yearGroupKey Resolved year-group key.
 * @param {string} options.yearGroupLabel Resolved year-group label.
 * @param {number} options.tasksPerDefinition Task count for the profile.
 * @returns {object} A persistence-shaped full assignment definition.
 */
function buildFullDefinition({ index, topic, yearGroupKey, yearGroupLabel, tasksPerDefinition }) {
  const tasks = {};
  for (let taskIndex = 0; taskIndex < tasksPerDefinition; taskIndex += 1) {
    const task = buildTask({ definitionIndex: index, taskIndex });
    tasks[task.id] = task;
  }

  return {
    definitionKey: `definition-${index}-${DOCUMENT_TYPES[index % DOCUMENT_TYPES.length].toLowerCase()}`,
    primaryTitle: `Synthetic Assignment Definition ${index + 1}`,
    primaryTopic: topic.name,
    primaryTopicKey: topic.key,
    yearGroupKey,
    yearGroupLabel,
    alternateTitles: [],
    alternateTopics: [],
    documentType: DOCUMENT_TYPES[index % DOCUMENT_TYPES.length],
    referenceDocumentId: `reference-document-${index}`,
    templateDocumentId: `template-document-${index}`,
    referenceLastModified: isoAt(index * MINUTES_PER_DEFINITION),
    templateLastModified: isoAt(index * MINUTES_PER_DEFINITION + TEMPLATE_OFFSET_MINUTES),
    assignmentWeighting: 1 + (index % MAX_GENERATED_WEIGHTING),
    tasks,
    createdAt: isoAt(index * MINUTES_PER_DEFINITION),
    updatedAt: isoAt(index * MINUTES_PER_DEFINITION + UPDATE_OFFSET_MINUTES),
  };
}

/**
 * Builds a partial-only registry row that preserves the documented nullable
 * partial scenarios. Its tasks use the documented partial array wire form and it
 * must never be embedded in a full assignment.
 *
 * @param {object} options Definition inputs.
 * @param {number} options.index Definition index.
 * @param {{name: string, key: string}} options.topic Resolved assignment topic.
 * @param {string} options.yearGroupKey Resolved year-group key.
 * @param {string} options.yearGroupLabel Resolved year-group label.
 * @returns {object} A persistence-shaped partial-only assignment definition.
 */
function buildPartialOnlyDefinition({ index, topic, yearGroupKey, yearGroupLabel }) {
  const taskId = `task-partial-${index}-0`;
  return {
    definitionKey: `definition-partial-${index}`,
    primaryTitle: `Synthetic Partial Assignment Definition ${index + 1}`,
    primaryTopic: topic.name,
    primaryTopicKey: topic.key,
    yearGroupKey,
    yearGroupLabel,
    alternateTitles: [],
    alternateTopics: [],
    documentType: DOCUMENT_TYPES[index % DOCUMENT_TYPES.length],
    referenceDocumentId: null,
    templateDocumentId: null,
    assignmentWeighting: null,
    tasks: [
      {
        taskId,
        taskWeighting: 1,
        taskTitle: `Synthetic Partial Task ${index + 1}.1`,
      },
    ],
    createdAt: isoAt(index * MINUTES_PER_DEFINITION),
    updatedAt: isoAt(index * MINUTES_PER_DEFINITION + UPDATE_OFFSET_MINUTES),
  };
}

/**
 * Generates assignment definitions with resolvable reference keys and keyed tasks.
 *
 * @remarks
 * Full definitions carry the documented full-model values (keyed tasks, non-null
 * document IDs, numeric weighting). A bounded number of partial-only registry
 * rows are appended to retain the documented nullable partial scenarios; they use
 * the partial array task wire form and are never hydrated into a full assignment.
 *
 * @param {object} inputs Generation inputs.
 * @param {{name: string, classCount: number, yearGroupCount: number, assignmentsPerClass: number, studentsPerClass: number, seed: number}} inputs.profileDefinition Resolved profile definition.
 * @param {{yearGroups: Array<{key: string, name: string}>, assignmentTopics: Array<{key: string, name: string, yearGroupKeys: string[]}>}} inputs.referenceData Generated reference data.
 * @returns {Array<object>} Persistence-shaped assignment definitions (full first, then partial-only).
 */
export function generateAssignmentDefinitions({ profileDefinition, referenceData }) {
  const yearGroupNames = new Map(
    referenceData.yearGroups.map((yearGroup) => [yearGroup.key, yearGroup.name])
  );
  const fullDefinitionCount = resolveFullDefinitionCount(profileDefinition);
  const tasksPerDefinition = resolveTasksPerDefinition(profileDefinition);
  const fullDefinitions = [];

  for (let index = 0; index < fullDefinitionCount; index += 1) {
    const topic = referenceData.assignmentTopics[index % referenceData.assignmentTopics.length];
    const yearGroupKey = topic.yearGroupKeys[0];
    fullDefinitions.push(
      buildFullDefinition({
        index,
        topic,
        yearGroupKey,
        yearGroupLabel: yearGroupNames.get(yearGroupKey),
        tasksPerDefinition,
      })
    );
  }

  const partialOnlyDefinitions = [];
  for (let index = 0; index < PARTIAL_ONLY_DEFINITION_COUNT; index += 1) {
    const topic = referenceData.assignmentTopics[index % referenceData.assignmentTopics.length];
    const yearGroupKey = topic.yearGroupKeys[0];
    partialOnlyDefinitions.push(
      buildPartialOnlyDefinition({
        index,
        topic,
        yearGroupKey,
        yearGroupLabel: yearGroupNames.get(yearGroupKey),
      })
    );
  }

  return [...fullDefinitions, ...partialOnlyDefinitions];
}
