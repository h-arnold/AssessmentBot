import { createSeededFaker } from './deterministicPrimitives.js';
import { generateClassRosters } from './generateClassRosters.js';
import { generateClassAssignments, partitionDefinitions } from './planClassAssignments.js';

/**
 * Generates class rosters and the per-class assignment graph.
 *
 * @remarks
 * Class/roster creation and assignment/submission planning are separate adjacent
 * modules. This composition point preserves the original seeded-Faker call order
 * so the generated graph remains byte-identical for a given profile and seed.
 *
 * @param {object} inputs Generation inputs.
 * @param {{name: string, seed: number, classCount: number, studentsPerClass: number, assignmentsPerClass: number, yearGroupCount: number}} inputs.profileDefinition Resolved profile definition.
 * @param {{cohorts: Array<{key: string}>, yearGroups: Array<{key: string}>}} inputs.referenceData Generated reference data.
 * @param {Array<{definitionKey: string, documentType: string, tasks: Record<string, unknown>|Array<{taskId: string}>}>} inputs.assignmentDefinitions Generated assignment definitions (full keyed-task definitions and partial-only registry rows).
 * @returns {{classes: Array<object>, assignments: Array<object>}} Persistence class documents and assignment records.
 */
export function generateAssignments({ profileDefinition, referenceData, assignmentDefinitions }) {
  const faker = createSeededFaker(profileDefinition.seed);
  const { fullDefinitions, partialOnlyDefinitions } = partitionDefinitions(assignmentDefinitions);
  const classes = generateClassRosters({ faker, profileDefinition, referenceData });
  const assignments = generateClassAssignments({
    faker,
    profileDefinition,
    classes,
    fullDefinitions,
    partialOnlyDefinitions,
  });

  return { classes, assignments };
}
