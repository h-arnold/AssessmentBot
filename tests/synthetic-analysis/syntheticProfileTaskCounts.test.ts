import { describe, expect, it } from 'vitest';

import { generateAssignmentDefinitions } from '#synthetic-data/generateAssignmentDefinitions.js';
import { generateReferenceData } from '#synthetic-data/generateReferenceData.js';
import { getProfileDefinition } from '#synthetic-data/profileDefinitions.js';

/** The unchanged artefact-body cycle used by the definition builder. */
const ARTEFACT_BODY_TYPES = ['TEXT', 'IMAGE', 'SPREADSHEET'] as const;

/** Expected task count per full definition for every profile. */
const EXPECTED_TASKS_PER_DEFINITION = {
  small: 4,
  medium: 6,
  'large-representative': 10,
  'large-full': 15,
} as const;

type GeneratedReferenceData = {
  cohorts: Array<{ key: string }>;
  yearGroups: Array<{ key: string; name: string }>;
  assignmentTopics: Array<{ key: string; name: string; yearGroupKeys: string[] }>;
};

type GeneratedTask = {
  id: string;
  artifacts: {
    reference: Array<{ type: string }>;
    template: Array<{ type: string }>;
  };
};

type GeneratedFullDefinition = {
  definitionKey: string;
  tasks: Record<string, GeneratedTask>;
};

type GeneratedAssignmentDefinition = {
  definitionKey: string;
  tasks: Record<string, GeneratedTask> | Array<unknown>;
};

/**
 * Generates the full definitions of one profile without assembling the rest of
 * the graph, so the large-full task count stays cheap to assert.
 *
 * @param profileName Supported synthetic profile name.
 * @returns Full definitions keyed by their generated task identifiers.
 */
function fullDefinitionsFor(profileName: string): GeneratedFullDefinition[] {
  const profileDefinition = getProfileDefinition(profileName);
  const referenceData = generateReferenceData(profileDefinition) as GeneratedReferenceData;
  const definitions = generateAssignmentDefinitions({
    profileDefinition,
    referenceData,
  }) as GeneratedAssignmentDefinition[];

  return definitions.filter(
    (definition): definition is GeneratedFullDefinition => !Array.isArray(definition.tasks)
  );
}

/**
 * Reads the builder indices encoded in a generated task identifier.
 *
 * @param taskId Generated task identifier.
 * @returns The definition and task indices.
 */
function taskIndices(taskId: string): { definitionIndex: number; taskIndex: number } {
  const match = /^task-(\d+)-(\d+)$/u.exec(taskId);
  if (!match) {
    throw new Error(`Unexpected generated task identifier "${taskId}".`);
  }
  return { definitionIndex: Number(match[1]), taskIndex: Number(match[2]) };
}

/**
 * Asserts the artefact cycle and the TEXT-task count of every full definition.
 *
 * @param profileName Profile whose definitions are checked.
 * @param expectedTextCount Derives the expected TEXT count from the definition index.
 */
function assertTextCounts(
  profileName: string,
  expectedTextCount: (definitionIndex: number) => number
): void {
  const definitions = fullDefinitionsFor(profileName);
  expect(definitions.length).toBeGreaterThan(0);

  for (const definition of definitions) {
    const tasks = Object.values(definition.tasks);
    const { definitionIndex } = taskIndices(tasks[0].id);
    const textTasks = tasks.filter((task) => task.artifacts.reference[0]?.type === 'TEXT');

    expect(textTasks, `${profileName}/${definition.definitionKey}`).toHaveLength(
      expectedTextCount(definitionIndex)
    );

    for (const task of tasks) {
      const indices = taskIndices(task.id);
      const expectedType =
        ARTEFACT_BODY_TYPES[
          (indices.definitionIndex + indices.taskIndex) % ARTEFACT_BODY_TYPES.length
        ];
      expect(task.artifacts.reference[0]?.type, task.id).toBe(expectedType);
      expect(task.artifacts.template[0]?.type, task.id).toBe(expectedType);
    }
  }
}

describe('synthetic profile task counts', () => {
  it.each(Object.entries(EXPECTED_TASKS_PER_DEFINITION) as Array<[string, number]>)(
    'generates %s full definitions with the expected number of tasks',
    (profileName, expectedTaskCount) => {
      for (const definition of fullDefinitionsFor(profileName)) {
        expect(Object.keys(definition.tasks), definition.definitionKey).toHaveLength(
          expectedTaskCount
        );
      }
    }
  );

  it('gives small definitions two TEXT tasks only where definitionIndex % 3 === 0', () => {
    assertTextCounts('small', (definitionIndex) => (definitionIndex % 3 === 0 ? 2 : 1));
  });

  it('gives every medium definition exactly two TEXT tasks', () => {
    assertTextCounts('medium', () => 2);
  });

  it('gives large-representative definitions three or four TEXT tasks', () => {
    assertTextCounts('large-representative', (definitionIndex) =>
      definitionIndex % 3 === 0 ? 4 : 3
    );
  });

  it('gives every large-full definition exactly five TEXT tasks', () => {
    assertTextCounts('large-full', () => 5);
  });
});
