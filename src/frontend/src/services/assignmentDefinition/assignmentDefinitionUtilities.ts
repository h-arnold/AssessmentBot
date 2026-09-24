import type {
  AssignmentDefinitionPartial,
  AssignmentDefinitionPartialsResponse,
} from './assignmentDefinitionPartials.zod';
import type { TaskPartial } from './taskPartial.zod';

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

/** Pre-indexed live weighting data used for constant-time task lookups. */
export interface TaskWeightingIndex {
  readonly assignmentWeighting: number | null;
  readonly taskWeightingById: ReadonlyMap<string, number>;
}

/**
 * Build a task-weighting index from a live definition partial.
 *
 * @param {object} partial - Live assignment-definition weighting data.
 * @param {number | null} partial.assignmentWeighting - Nullable assignment weighting.
 * @param {ReadonlyArray<TaskPartial>} partial.tasks - Live task weightings.
 * @returns {TaskWeightingIndex} An index for constant-time task-weight lookups.
 *
 * @remarks
 * Building the index once per partial keeps repeated effective-weight lookups
 * independent of the number of tasks.
 */
export function createTaskWeightingIndex(partial: {
  readonly assignmentWeighting: number | null;
  readonly tasks: ReadonlyArray<TaskPartial>;
}): TaskWeightingIndex {
  return {
    assignmentWeighting: partial.assignmentWeighting,
    taskWeightingById: new Map(
      partial.tasks.map((task) => [task.taskId, task.taskWeighting] as const)
    ),
  };
}

/**
 * Compute one task's effective weight from pre-indexed live weighting data.
 *
 * @param {TaskWeightingIndex} weightingIndex - Indexed live weighting data.
 * @param {string} taskId - Task identifier to resolve.
 * @returns {number | undefined} The effective weight, or `undefined` when the
 *   task is absent from the live partial.
 *
 * @remarks
 * A `null` assignment weighting intentionally retains the established meaning
 * of full default weight (`1`). Task weighting is required by `TaskPartial`; an
 * absent task ID is therefore unknown data, not a missing-weight default.
 */
export function computeEffectiveWeight(
  weightingIndex: TaskWeightingIndex,
  taskId: string
): number | undefined {
  const taskWeighting = weightingIndex.taskWeightingById.get(taskId);
  if (taskWeighting === undefined) {
    return undefined;
  }
  return (weightingIndex.assignmentWeighting ?? 1) * taskWeighting;
}
