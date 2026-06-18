/**
 * Shared test helpers for AssignmentDefinitionController upsert tests
 *
 * Extracted from assignmentDefinitionController.upsert.test.js during
 * the Section 10 max-lines split. Provides pure helper functions used
 * across all split test files.
 *
 * Note: Mock variables (extractSlidesTaskDefinitionsMock,
 * extractSheetsTaskDefinitionsMock) and vi.mock() calls remain in each
 * test file because Vitest hoists vi.mock along with locally-declared
 * const/let references but does not hoist imported bindings the same way.
 */

import { expect } from 'vitest';

/**
 * Creates a mock parsed task definition
 * @param {{ id: string, taskTitle?: string, index?: number }} options
 * @returns {Object} Mock task definition object
 */
export function createParsedTaskDefinition({ id, taskTitle, index = 0 }) {
  return {
    getId: () => id,
    validate: () => ({ ok: true, errors: [] }),
    toJSON: () => ({
      id,
      taskTitle: taskTitle || 'Task ' + id,
      taskWeighting: null,
      index,
      artifacts: {
        reference: [],
        template: [],
      },
    }),
  };
}

/**
 * Creates a standard upsert payload for free-form (non-wizard) tests
 * @param {Object} [overrides] - Properties to override on the returned payload
 * @returns {Object} Upsert payload
 */
export function createUpsertPayload(overrides = {}) {
  return {
    primaryTitle: 'Water cycle explanation',
    primaryTopicKey: 'topic-science',
    yearGroupKey: 'year-group-8',
    yearGroupLabel: 'Year 8',
    alternateTitles: ['The water cycle'],
    referenceDocumentId: 'ref-doc-id',
    templateDocumentId: 'tpl-doc-id',
    documentType: 'SLIDES',
    assignmentWeighting: 1,
    taskWeightings: [],
    ...overrides,
  };
}

/**
 * Creates an upsert payload for wizard-based (taskWeightings) tests
 * @param {Object} [overrides] - Properties to override on the returned payload
 * @returns {Object} Wizard upsert payload
 */
export function createWizardUpsertPayload(overrides = {}) {
  return {
    primaryTitle: 'Water cycle explanation',
    primaryTopicKey: 'topic-science',
    yearGroupKey: 'year-group-8',
    yearGroupLabel: 'Year 8',
    referenceDocumentId: 'ref-doc-id',
    templateDocumentId: 'tpl-doc-id',
    documentType: 'SLIDES',
    assignmentWeighting: 1,
    taskWeightings: [{ taskId: 't_task_1', taskWeighting: 1 }],
    ...overrides,
  };
}

/**
 * Asserts that a definition has the canonical full-definition transport shape
 * @param {Object} definition - The definition to inspect
 */
export function expectCanonicalFullDefinitionShape(definition) {
  expect(definition).toMatchObject({
    definitionKey: expect.any(String),
    primaryTitle: expect.any(String),
    primaryTopicKey: expect.any(String),
    primaryTopic: expect.any(String),
    yearGroupKey: expect.any(String),
    yearGroupLabel: expect.any(String),
    referenceDocumentId: expect.any(String),
    templateDocumentId: expect.any(String),
    assignmentWeighting: expect.any(Number),
    tasks: expect.arrayContaining([
      expect.objectContaining({
        taskId: expect.any(String),
        taskTitle: expect.any(String),
        taskWeighting: expect.any(Number),
      }),
    ]),
  });

  expect(definition).not.toHaveProperty('referenceDocumentUrl');
  expect(definition).not.toHaveProperty('templateDocumentUrl');
}

/**
 * Asserts that task-weighting map entries match expected values
 * @param {Object} taskMap - Task map from a definition (saved.tasks)
 * @param {Array<[string, number]>} expectedEntries - Array of [taskId, expectedWeighting] pairs
 */
export function expectTaskWeightingMapEntries(taskMap, expectedEntries) {
  for (const [taskId, expectedWeighting] of expectedEntries) {
    expect(taskMap[taskId]).toBeDefined();
    expect(taskMap[taskId].taskWeighting).toBe(expectedWeighting);
  }
}
