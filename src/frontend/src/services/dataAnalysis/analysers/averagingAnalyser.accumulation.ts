import { logFrontendEvent } from '../../../logging/frontendLogger';
import type {
  AveragingAnalyserInput,
  AverageContribution,
  MetricResult,
} from '../dataAnalysis.zod';
import type { CriterionWeightings } from './averagingAnalyser';
import type { DataPointAccumulator, MetricAccumulator } from './averagingAnalyser.types';
import { processItemAssessments } from './averagingAnalyser.criterionAccumulation';
import { resolveAssignmentDefinitionData } from './resolveAssignmentDefinition';
import { resolveAggregateMetric } from './averagingAnalyser.metricResolution';
import type { AssignmentDefinitionPartial } from '../../assignmentDefinition/assignmentDefinitionPartials.zod';
export {
  createAccumulator,
  createDataPointAccumulator,
} from './averagingAnalyser.accumulatorRegistry';
export { buildPerStudentTaskMetrics } from './averagingAnalyser.taskProjection';
export { toTaskDisplayMetric } from './averagingAnalyser.taskProjection';
import { createDataPointAccumulator } from './averagingAnalyser.accumulatorRegistry';
import {
  ensureAverageContribution,
  getOrCreatePerStudentTaskAccum,
  getOrCreateStudentAccum,
  getOrCreateTaskAccum,
  preRegisterTasks,
} from './averagingAnalyser.accumulatorRegistry';

/**
 * Convert contribution accumulator state into a public metric result.
 * @param {MetricAccumulator} accumulator - The accumulator to resolve.
 * @returns {MetricResult} The resolved metric.
 */
export function accumToMetric(accumulator: MetricAccumulator): MetricResult {
  return resolveAggregateMetric(accumulator);
}

/**
 * Resolve effective weight from live definition task weights.
 * @param {string} definitionKey - Assignment definition identifier.
 * @param {string} taskId - Task identifier.
 * @param {number} assignmentWeighting - Resolved live assignment weighting.
 * @param {ReadonlyMap<string, ReadonlyMap<string, number>>} taskWeightByDefinitionKey - Live task weights.
 * @returns {number} The effective assignment-task weight.
 */
function resolveEffectiveWeight(
  definitionKey: string,
  taskId: string,
  assignmentWeighting: number,
  taskWeightByDefinitionKey: ReadonlyMap<string, ReadonlyMap<string, number>>
): number {
  const taskWeighting = taskWeightByDefinitionKey.get(definitionKey)?.get(taskId) ?? 1;
  return assignmentWeighting * taskWeighting;
}

/**
 * Process a single assignment, accumulating its submission data.
 *
 * @param {AveragingAnalyserInput['classes'][number]['assignments'][number]}
 *   assignment - The assignment to process.
 * @param {number} assignmentWeighting - The resolved assignment weighting.
 * @param {string} definitionKey - The assignment definition key.
 * @param {Map<string, Map<string, number>>} taskWeightByDefinitionKey - Two-level
 *   Map for O(1) task-weighting lookups (built once per analysis run).
 * @param {Map<string, { studentName: string | null } & DataPointAccumulator>}
 *   studentAccums - Per-student accumulators (mutated).
 * @param {Map<string, { definitionKey: string; taskId: string } & DataPointAccumulator>}
 *   taskAccums - Per-task accumulators (mutated).
 * @param {DataPointAccumulator} classAccum - Per-class accumulator (mutated).
 * @param {CriterionWeightings} criterionWeightings - The criterion weightings.
 * @param {Map<string, Map<string, DataPointAccumulator>>}
 *   perStudentTaskAccums - Per-(student, task) accumulators (mutated).
 * @param {Map<string, AverageContribution>} averageContributionByTaskKey -
 *   Contribution metadata keyed by `definitionKey::taskId` (mutated).
 */
export function processAssignment(
  assignment: AveragingAnalyserInput['classes'][number]['assignments'][number],
  assignmentWeighting: number,
  definitionKey: string,
  taskWeightByDefinitionKey: Map<string, Map<string, number>>,
  studentAccums: Map<string, { studentName: string | null } & DataPointAccumulator>,
  taskAccums: Map<string, { definitionKey: string; taskId: string } & DataPointAccumulator>,
  classAccum: DataPointAccumulator,
  criterionWeightings: CriterionWeightings,
  perStudentTaskAccums: Map<string, Map<string, DataPointAccumulator>>,
  averageContributionByTaskKey: Map<string, AverageContribution>
): void {
  for (const submission of assignment.submissions) {
    const { studentId, studentName, items } = submission;
    const studentAccum = getOrCreateStudentAccum(studentAccums, studentId, studentName);

    for (const [taskId, item] of Object.entries(items)) {
      const effectiveWeight = resolveEffectiveWeight(
        definitionKey,
        taskId,
        assignmentWeighting,
        taskWeightByDefinitionKey
      );
      ensureAverageContribution(
        averageContributionByTaskKey,
        definitionKey,
        taskId,
        effectiveWeight
      );

      const taskKey = `${definitionKey}::${taskId}`;
      const taskAccum = getOrCreateTaskAccum(taskAccums, definitionKey, taskId);
      const perStudentTaskAccum = getOrCreatePerStudentTaskAccum(
        perStudentTaskAccums,
        studentId,
        taskKey
      );

      processItemAssessments(
        item,
        effectiveWeight,
        studentAccum,
        classAccum,
        taskAccum,
        criterionWeightings,
        perStudentTaskAccum
      );
    }
  }
}

/**
 * Build O(1) lookups from live assignment-definition partials.
 * @param {AveragingAnalyserInput['assignmentDefinitionPartials']} partials - Live partials.
 * @returns {{ partialsByDefinitionKey: Map<string, AssignmentDefinitionPartial>; taskWeightByDefinitionKey: Map<string, Map<string, number>> }} The lookup maps.
 */
function buildDefinitionLookups(partials: AveragingAnalyserInput['assignmentDefinitionPartials']): {
  partialsByDefinitionKey: Map<string, AssignmentDefinitionPartial>;
  taskWeightByDefinitionKey: Map<string, Map<string, number>>;
} {
  const partialsByDefinitionKey = new Map<string, AssignmentDefinitionPartial>();
  const taskWeightByDefinitionKey = new Map<string, Map<string, number>>();
  for (const partial of partials) {
    partialsByDefinitionKey.set(partial.definitionKey, partial);
    taskWeightByDefinitionKey.set(
      partial.definitionKey,
      new Map((partial.tasks ?? []).map((task) => [task.taskId, task.taskWeighting]))
    );
  }
  return { partialsByDefinitionKey, taskWeightByDefinitionKey };
}

/**
 * Accumulate data points across all filtered assignments.
 *
 * @param {AveragingAnalyserInput['classes'][number]['assignments']}
 *   filteredAssignments - The in-scope assignments after filtering.
 * @param {AveragingAnalyserInput} input - Full analyser input.
 * @param {CriterionWeightings} criterionWeightings - The criterion weightings.
 * @returns {{
 *   studentAccums: Map<string, { studentName: string | null } & DataPointAccumulator>,
 *   taskAccums: Map<string, { definitionKey: string; taskId: string } & DataPointAccumulator>,
 *   classAccum: DataPointAccumulator,
 *   perStudentTaskAccums: Map<string, Map<string, DataPointAccumulator>>,
 *   averageContributionByTaskKey: Map<string, AverageContribution>
 * }} The accumulator containers plus definition-scoped contribution metadata.
 *   `perStudentTaskAccums` feeds `rollupMetric` in the row builders;
 *   `averageContributionByTaskKey` supplies the required task-level
 *   `averageContribution` field for `PerTaskRow` and `PerStudentTaskMetric`.
 * @remarks A two-level Map (`definitionKey → taskId → taskWeighting`) is built
 *   once per analysis run from `input.assignmentDefinitionPartials`, giving O(1)
 *   task-weighting lookup per submission item instead of O(P × T) linear
 *   searches.
 */
export function accumulateDataPoints(
  filteredAssignments: AveragingAnalyserInput['classes'][number]['assignments'],
  input: AveragingAnalyserInput,
  criterionWeightings: CriterionWeightings
): {
  studentAccums: Map<string, { studentName: string | null } & DataPointAccumulator>;
  taskAccums: Map<string, { definitionKey: string; taskId: string } & DataPointAccumulator>;
  classAccum: DataPointAccumulator;
  perStudentTaskAccums: Map<string, Map<string, DataPointAccumulator>>;
  averageContributionByTaskKey: Map<string, AverageContribution>;
} {
  const studentAccums = new Map<string, { studentName: string | null } & DataPointAccumulator>();

  const taskAccums = new Map<
    string,
    { definitionKey: string; taskId: string } & DataPointAccumulator
  >();

  const classAccum = createDataPointAccumulator();

  const perStudentTaskAccums = new Map<string, Map<string, DataPointAccumulator>>();

  const averageContributionByTaskKey = new Map<string, AverageContribution>();

  // Build lookup Maps for O(1) resolution.
  const { partialsByDefinitionKey, taskWeightByDefinitionKey } = buildDefinitionLookups(
    input.assignmentDefinitionPartials
  );

  for (const assignment of filteredAssignments) {
    const definitionKey = assignment.assignmentDefinitionKey;

    const resolved = resolveAssignmentDefinitionData(definitionKey, partialsByDefinitionKey);

    if (!resolved) {
      logFrontendEvent('warn', {
        context: 'accumulateDataPoints',
        errorMessage: `No assignment definition partial found for definitionKey '${definitionKey}'`,
        metadata: { definitionKey },
      });
      continue;
    }

    preRegisterTasks(resolved.tasks, definitionKey, taskAccums);
    for (const task of resolved.tasks) {
      const effectiveWeight = resolveEffectiveWeight(
        definitionKey,
        task.taskId,
        resolved.assignmentWeighting,
        taskWeightByDefinitionKey
      );
      ensureAverageContribution(
        averageContributionByTaskKey,
        definitionKey,
        task.taskId,
        effectiveWeight
      );
    }

    processAssignment(
      assignment,
      resolved.assignmentWeighting,
      definitionKey,
      taskWeightByDefinitionKey,
      studentAccums,
      taskAccums,
      classAccum,
      criterionWeightings,
      perStudentTaskAccums,
      averageContributionByTaskKey
    );
  }

  return {
    studentAccums,
    taskAccums,
    classAccum,
    perStudentTaskAccums,
    averageContributionByTaskKey,
  };
}
