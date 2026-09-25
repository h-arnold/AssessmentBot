import type { AverageContribution } from '../dataAnalysis.zod';
import type { TaskPartial } from '../../assignmentDefinition/taskPartial.zod';
import type { DataPointAccumulator, MetricAccumulator } from './averagingAnalyser.types';
import { buildTaskKey } from '../taskKey';

/**
 * Create an empty metric accumulator.
 * @returns {MetricAccumulator} Empty state.
 */
export function createAccumulator(): MetricAccumulator {
  return {
    weightedSum: 0,
    totalWeight: 0,
    applicableDataPoints: 0,
    totalDataPoints: 0,
    nCount: 0,
    displaySum: 0,
    displayCount: 0,
    displayNCount: 0,
    displayTotalDataPoints: 0,
  };
}

/**
 * Create empty accumulators for all criteria.
 * @returns {DataPointAccumulator} Empty state.
 */
export function createDataPointAccumulator(): DataPointAccumulator {
  return {
    completeness: createAccumulator(),
    accuracy: createAccumulator(),
    spag: createAccumulator(),
    overall: createAccumulator(),
  };
}

/** Register definition tasks before processing submissions.
 * @param {ReadonlyArray<TaskPartial>} tasks - Definition tasks.
 * @param {string} definitionKey - Definition identifier.
 * @param {Map<string, { definitionKey: string; taskId: string } & DataPointAccumulator>} taskAccums - Mutable registry.
 */
export function preRegisterTasks(
  tasks: ReadonlyArray<TaskPartial>,
  definitionKey: string,
  taskAccums: Map<string, { definitionKey: string; taskId: string } & DataPointAccumulator>
): void {
  for (const task of tasks) {
    const taskKey = buildTaskKey(definitionKey, task.taskId);
    if (!taskAccums.has(taskKey)) {
      taskAccums.set(taskKey, {
        definitionKey,
        taskId: task.taskId,
        ...createDataPointAccumulator(),
      });
    }
  }
}

/** Resolve a student's accumulator, creating it when absent.
 * @param {Map<string, { studentName: string | null } & DataPointAccumulator>} studentAccums - Mutable registry.
 * @param {string} studentId - Student identifier.
 * @param {string | null} studentName - Student name.
 * @returns {DataPointAccumulator} The accumulator.
 */
export function getOrCreateStudentAccum(
  studentAccums: Map<string, { studentName: string | null } & DataPointAccumulator>,
  studentId: string,
  studentName: string | null
): DataPointAccumulator {
  if (!studentAccums.has(studentId)) {
    studentAccums.set(studentId, { studentName, ...createDataPointAccumulator() });
  }
  return studentAccums.get(studentId)!;
}

/** Resolve a task accumulator, creating it when absent.
 * @param {Map<string, { definitionKey: string; taskId: string } & DataPointAccumulator>} taskAccums - Mutable registry.
 * @param {string} definitionKey - Definition identifier.
 * @param {string} taskId - Task identifier.
 * @returns {DataPointAccumulator} The accumulator.
 */
export function getOrCreateTaskAccum(
  taskAccums: Map<string, { definitionKey: string; taskId: string } & DataPointAccumulator>,
  definitionKey: string,
  taskId: string
): DataPointAccumulator {
  const taskKey = buildTaskKey(definitionKey, taskId);
  if (!taskAccums.has(taskKey)) {
    taskAccums.set(taskKey, { definitionKey, taskId, ...createDataPointAccumulator() });
  }
  return taskAccums.get(taskKey)!;
}

/** Resolve a per-student task accumulator, creating it when absent.
 * @param {Map<string, Map<string, DataPointAccumulator>>} accums - Mutable registry.
 * @param {string} studentId - Student identifier.
 * @param {string} taskKey - Definition-scoped task key.
 * @returns {DataPointAccumulator} The accumulator.
 */
export function getOrCreatePerStudentTaskAccum(
  accums: Map<string, Map<string, DataPointAccumulator>>,
  studentId: string,
  taskKey: string
): DataPointAccumulator {
  if (!accums.has(studentId)) accums.set(studentId, new Map());
  const studentMap = accums.get(studentId)!;
  if (!studentMap.has(taskKey)) studentMap.set(taskKey, createDataPointAccumulator());
  return studentMap.get(taskKey)!;
}

/** Record authoritative task contribution metadata.
 * @param {Map<string, AverageContribution>} contributions - Mutable metadata registry.
 * @param {string} definitionKey - Definition identifier.
 * @param {string} taskId - Task identifier.
 * @param {number} effectiveWeight - Resolved live assignment and task weighting product.
 * @throws {Error} If the same task key is registered with a conflicting
 *   effective weight.
 */
export function ensureAverageContribution(
  contributions: Map<string, AverageContribution>,
  definitionKey: string,
  taskId: string,
  effectiveWeight: number
): void {
  const taskKey = buildTaskKey(definitionKey, taskId);
  const existing = contributions.get(taskKey);
  if (existing) {
    if (existing.effectiveWeight !== effectiveWeight) {
      throw new Error(
        `ensureAverageContribution: conflicting effective weights for taskKey '${taskKey}': ${existing.effectiveWeight} and ${effectiveWeight}`
      );
    }
    return;
  }
  contributions.set(taskKey, { effectiveWeight, includedInAverage: effectiveWeight > 0 });
}

/** Look up task contribution metadata and fail fast when a producer invariant is broken.
 * @param {ReadonlyMap<string, AverageContribution>} contributions - Contribution metadata registry.
 * @param {string} taskKey - Definition-scoped task key.
 * @param {'buildPerStudentTaskMetrics' | 'buildPerTaskRows'} consumer - Calling projection boundary.
 * @returns {AverageContribution} The registered contribution metadata.
 * @throws {Error} When no contribution is registered for `taskKey`.
 */
export function requireAverageContribution(
  contributions: ReadonlyMap<string, AverageContribution>,
  taskKey: string,
  consumer: 'buildPerStudentTaskMetrics' | 'buildPerTaskRows'
): AverageContribution {
  const contribution = contributions.get(taskKey);
  if (!contribution) {
    throw new Error(`${consumer}: missing averageContribution for taskKey '${taskKey}'`);
  }
  return contribution;
}
