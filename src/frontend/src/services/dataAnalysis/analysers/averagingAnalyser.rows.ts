import type { MetricResult, PerStudentRow, PerTaskRow } from '../dataAnalysis.zod';
import { accumToMetric, computeOverallComposite } from './averagingAnalyser.accumulation';
import type { CriterionWeightings } from './averagingAnalyser';
import { rollupMetric } from './rollupMetric';
import type { DataPointAccumulator } from './averagingAnalyser.types';

/**
 * Build the four MetricResults (completeness, accuracy, spag, overall) from
 * an iterable of DataPointAccumulators using rollupMetric and the composite rule.
 *
 * @param {Iterable<DataPointAccumulator>} accumulators - The source accumulators.
 * @param {CriterionWeightings} criterionWeightings - The criterion weightings.
 * @returns {{ completeness: MetricResult; accuracy: MetricResult; spag: MetricResult; overall: MetricResult }}
 *   The four metric rollup results.
 */
function rollupAccumulators(
  accumulators: Iterable<DataPointAccumulator>,
  criterionWeightings: CriterionWeightings
): {
  completeness: MetricResult;
  accuracy: MetricResult;
  spag: MetricResult;
  overall: MetricResult;
} {
  const completenessResults: MetricResult[] = [];
  const accuracyResults: MetricResult[] = [];
  const spagResults: MetricResult[] = [];

  for (const accumulator of accumulators) {
    completenessResults.push(accumToMetric(accumulator.completeness));
    accuracyResults.push(accumToMetric(accumulator.accuracy));
    spagResults.push(accumToMetric(accumulator.spag));
  }

  const completeness = rollupMetric(completenessResults, 'completeness');
  const accuracy = rollupMetric(accuracyResults, 'accuracy');
  const spag = rollupMetric(spagResults, 'spag');
  const overall = computeOverallComposite(completeness, accuracy, spag, criterionWeightings);

  return { completeness, accuracy, spag, overall };
}

/**
 * Build sorted per-student rows from accumulators.
 *
 * @remarks
 * The per-criterion rollup is delegated to the shared `rollupMetric` helper to
 * ensure the same precedence and per-metric `notAttempted` handling is applied
 * consistently across all aggregation levels. The `overall` composite is
 * computed from the three per-criterion rollups using the 40/40/20 weighting
 * with SPaG-renormalisation.
 *
 * A null `studentName` is a data-source bug and will cause the function to
 * throw at runtime.
 *
 * @param {Map<string, { studentName: string | null } & DataPointAccumulator>}
 *   studentAccums - Map of studentId to accumulator data (used for studentName
 *   and as a fallback for students with no per-student-task accumulators).
 * @param {Map<string, Map<string, DataPointAccumulator>>} perStudentTaskAccums -
 *   Per-(student, task) accumulators for rollup input building.
 * @param {CriterionWeightings} criterionWeightings - The criterion weightings.
 * @returns {PerStudentRow[]} Sorted per-student result rows.
 */
export function buildPerStudentRows(
  studentAccums: Map<string, { studentName: string | null } & DataPointAccumulator>,
  perStudentTaskAccums: Map<string, Map<string, DataPointAccumulator>>,
  criterionWeightings: CriterionWeightings
): PerStudentRow[] {
  const rows: PerStudentRow[] = [];

  for (const [studentId, accumulator] of studentAccums) {
    const taskAccumsForStudent = perStudentTaskAccums.get(studentId);

    if (!taskAccumsForStudent || taskAccumsForStudent.size === 0) {
      rows.push({
        studentId,
        studentName: accumulator.studentName,
        completeness: accumToMetric(accumulator.completeness),
        accuracy: accumToMetric(accumulator.accuracy),
        spag: accumToMetric(accumulator.spag),
        overall: accumToMetric(accumulator.overall),
      });
      continue;
    }

    const { completeness, accuracy, spag, overall } = rollupAccumulators(
      taskAccumsForStudent.values(),
      criterionWeightings
    );

    rows.push({
      studentId,
      studentName: accumulator.studentName,
      completeness,
      accuracy,
      spag,
      overall,
    });
  }

  rows.sort((a, b) => {
    const nameComparison = a.studentName!.localeCompare(b.studentName!);
    if (nameComparison !== 0) return nameComparison;
    return a.studentId.localeCompare(b.studentId);
  });
  return rows;
}

/**
 * Build sorted per-task rows from accumulators.
 *
 * @remarks
 * The per-criterion rollup is delegated to the shared `rollupMetric` helper to
 * ensure the same precedence and per-metric `notAttempted` handling is applied
 * consistently across all aggregation levels. The `overall` composite is
 * computed from the three per-criterion rollups using the 40/40/20 weighting
 * with SPaG-renormalisation.
 *
 * @param {Map<string, { definitionKey: string; taskId: string } & DataPointAccumulator>}
 *   taskAccums - Map of composite key to accumulator data (used for definitionKey,
 *   taskId, and as fallback for tasks with no student submissions).
 * @param {Map<string, Map<string, DataPointAccumulator>>} perStudentTaskAccums -
 *   Per-(student, task) accumulators for rollup input building.
 * @param {CriterionWeightings} criterionWeightings - The criterion weightings.
 * @returns {PerTaskRow[]} Sorted per-task result rows.
 */
export function buildPerTaskRows(
  taskAccums: Map<string, { definitionKey: string; taskId: string } & DataPointAccumulator>,
  perStudentTaskAccums: Map<string, Map<string, DataPointAccumulator>>,
  criterionWeightings: CriterionWeightings
): PerTaskRow[] {
  const rows: PerTaskRow[] = [];

  // Build a reverse index: taskKey → student accumulators
  const taskToStudentAccums = new Map<string, Array<DataPointAccumulator>>();
  for (const [, taskMap] of perStudentTaskAccums) {
    for (const [taskKey, accum] of taskMap) {
      if (!taskToStudentAccums.has(taskKey)) {
        taskToStudentAccums.set(taskKey, []);
      }
      taskToStudentAccums.get(taskKey)!.push(accum);
    }
  }

  for (const [taskKey, accumulator] of taskAccums) {
    const studentAccumsForTask = taskToStudentAccums.get(taskKey);

    if (!studentAccumsForTask || studentAccumsForTask.length === 0) {
      rows.push({
        definitionKey: accumulator.definitionKey,
        taskId: accumulator.taskId,
        taskTitle: null,
        completeness: accumToMetric(accumulator.completeness),
        accuracy: accumToMetric(accumulator.accuracy),
        spag: accumToMetric(accumulator.spag),
        overall: accumToMetric(accumulator.overall),
      });
      continue;
    }

    const { completeness, accuracy, spag, overall } = rollupAccumulators(
      studentAccumsForTask,
      criterionWeightings
    );

    rows.push({
      definitionKey: accumulator.definitionKey,
      taskId: accumulator.taskId,
      taskTitle: null,
      completeness,
      accuracy,
      spag,
      overall,
    });
  }

  rows.sort((a, b) => {
    const definitionComparison = a.definitionKey.localeCompare(b.definitionKey);
    if (definitionComparison !== 0) return definitionComparison;
    return a.taskId.localeCompare(b.taskId);
  });
  return rows;
}
