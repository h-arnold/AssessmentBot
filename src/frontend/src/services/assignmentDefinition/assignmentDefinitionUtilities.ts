import type {
  AssignmentDefinitionPartial,
  AssignmentDefinitionPartialsResponse,
} from './assignmentDefinitionPartials.zod';

/**
 * Locate a warm-up assignment-definition partial by its `definitionKey`.
 *
 * @param {AssignmentDefinitionPartialsResponse} partials - The array of warm-up
 *   assignment-definition partials from the frontend dataset.
 * @param {string} definitionKey - The definition key to locate.
 * @returns {AssignmentDefinitionPartial | null} The matching partial, or `null`
 *   when no entry is found.
 *
 * @remarks
 * This is the single seam for warm-up-partial lookup by `definitionKey`. The
 * heatmap adapter and any other consumer that needs task-column structure or
 * per-task titles should use this helper rather than inlining the array `find`.
 */
export function getAssignmentDefinitionPartial(
  partials: AssignmentDefinitionPartialsResponse,
  definitionKey: string
): AssignmentDefinitionPartial | null {
  return partials.find((p) => p.definitionKey === definitionKey) ?? null;
}
