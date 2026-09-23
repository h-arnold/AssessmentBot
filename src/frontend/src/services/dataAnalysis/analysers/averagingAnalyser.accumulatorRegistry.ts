import type { AverageContribution } from '../dataAnalysis.zod';
import type { TaskPartial } from '../../assignmentDefinition/taskPartial.zod';
import type { DataPointAccumulator, MetricAccumulator } from './averagingAnalyser.types';

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
    const taskKey = `${definitionKey}::${task.taskId}`;
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
  const taskKey = `${definitionKey}::${taskId}`;
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
 */
export function ensureAverageContribution(
  contributions: Map<string, AverageContribution>,
  definitionKey: string,
  taskId: string,
  effectiveWeight: number
): void {
  const taskKey = `${definitionKey}::${taskId}`;
  if (contributions.has(taskKey)) return;
  contributions.set(taskKey, { effectiveWeight, includedInAverage: effectiveWeight > 0 });
}
