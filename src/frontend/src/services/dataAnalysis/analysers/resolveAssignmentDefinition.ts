import type { AssignmentDefinitionPartial } from '../../assignmentDefinition/assignmentDefinitionPartials.zod';
import type { TaskPartial } from '../../assignmentDefinition/taskPartial.zod';

/**
 * Resolved assignment definition data sourced exclusively from the live
 * {@link AssignmentDefinitionPartial} registry.
 */
export interface ResolvedAssignmentDefinition {
  assignmentWeighting: number;
  tasks: readonly TaskPartial[];
}

/**
 * Resolve assignment definition data from the live partials registry.
 *
 * The partials registry is the sole authoritative source. When no entry
 * exists for {@link definitionKey}, the function throws — it does not
 * fall back to the embedded `assignment.assignmentDefinition`.
 *
 * @param {string} definitionKey - The definition key to look up.
 * @param {ReadonlyMap<string, AssignmentDefinitionPartial>} partialsByDefinitionKey -
 *   Pre-built Map of definitionKey → live partial.
 * @returns {ResolvedAssignmentDefinition} The resolved weighting and tasks.
 * @throws {Error} When no partial exists for {@link definitionKey}.
 */
export function resolveAssignmentDefinitionData(
  definitionKey: string,
  partialsByDefinitionKey: ReadonlyMap<string, AssignmentDefinitionPartial>
): ResolvedAssignmentDefinition {
  const partial = partialsByDefinitionKey.get(definitionKey);

  if (!partial) {
    throw new Error(`No assignment definition partial found for definitionKey '${definitionKey}'`);
  }

  return {
    assignmentWeighting: partial.assignmentWeighting ?? 1,
    tasks: partial.tasks ?? [],
  };
}
