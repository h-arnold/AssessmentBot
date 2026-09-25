import type {
  AverageContribution,
  MetricResult,
  PerStudentRow,
  PerTaskRow,
} from '../dataAnalysis.zod';
import { requireAverageContribution } from './averagingAnalyser.accumulatorRegistry';
import { resolveAggregateMetric, resolveDisplayMetric } from './averagingAnalyser.metricResolution';
import { computeOverallComposite } from './averagingAnalyser.composite';
import type { CriterionWeightings } from './averagingAnalyser';
import { rollupMetric } from './rollupMetric';
import type { DataPointAccumulator } from './averagingAnalyser.types';

type PerStudentRowWithName = PerStudentRow & { studentName: string };

/**
 * Build the four MetricResults (completeness, accuracy, spag, overall) from
 * an iterable of DataPointAccumulators using rollupMetric and the composite rule.
 *
 * @remarks
 * This function was previously private and duplicated in `analyseClass`. The
 * export unifies the rollup pattern across per-student, per-task, and per-class
 * aggregation, eliminating the dual-path duplication.
 *
 * @param {Iterable<DataPointAccumulator>} accumulators - The source accumulators.
 * @param {CriterionWeightings} criterionWeightings - The criterion weightings.
 * @returns {{ completeness: MetricResult; accuracy: MetricResult; spag: MetricResult; overall: MetricResult }}
 *   The four metric rollup results.
 */
export function rollupAccumulators(
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
    completenessResults.push(resolveAggregateMetric(accumulator.completeness));
    accuracyResults.push(resolveAggregateMetric(accumulator.accuracy));
    spagResults.push(resolveAggregateMetric(accumulator.spag));
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
 * A null `studentName` is a data-source bug. The row builder throws
 * immediately and names the offending `studentId`, including for a single row.
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
  const rows: PerStudentRowWithName[] = [];

  for (const [studentId, accumulator] of studentAccums) {
    if (accumulator.studentName === null) {
      throw new Error(`buildPerStudentRows: null studentName for studentId '${studentId}'`);
    }

    const taskAccumsForStudent = perStudentTaskAccums.get(studentId);

    if (!taskAccumsForStudent || taskAccumsForStudent.size === 0) {
      rows.push({
        studentId,
        studentName: accumulator.studentName,
        completeness: resolveAggregateMetric(accumulator.completeness),
        accuracy: resolveAggregateMetric(accumulator.accuracy),
        spag: resolveAggregateMetric(accumulator.spag),
        overall: resolveAggregateMetric(accumulator.overall),
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
    const nameComparison = a.studentName.localeCompare(b.studentName);
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
 * `excluded` is valid only for aggregate scopes. Per SPEC.md §Task-level output,
 * task-level rows retain numeric or raw-`N` display evidence when observations
 * exist, while no-observation rows remain `error`. If the overall composite
 * resolves to `excluded` (for example, when contributing criterion aggregates
 * are all non-contributing), this row substitutes the criterion-weighted display
 * overall from the task accumulator instead of emitting an aggregate-only state
 * that the task schema rejects.
 *
 * @param {Map<string, { definitionKey: string; taskId: string } & DataPointAccumulator>}
 *   taskAccums - Map of composite key to accumulator data (used for definitionKey,
 *   taskId, and as fallback for tasks with no student submissions).
 * @param {CriterionWeightings} criterionWeightings - The criterion weightings.
 * @param {ReadonlyMap<string, AverageContribution>} averageContributionByTaskKey -
 *   Authoritative contribution metadata keyed by taskKey. Every key present in
 *   `taskAccums` must have an entry; a missing entry is a producer bug.
 * @returns {PerTaskRow[]} Sorted per-task result rows.
 */
export function buildPerTaskRows(
  taskAccums: Map<string, { definitionKey: string; taskId: string } & DataPointAccumulator>,
  criterionWeightings: CriterionWeightings,
  averageContributionByTaskKey: ReadonlyMap<string, AverageContribution>
): PerTaskRow[] {
  const rows: PerTaskRow[] = [];

  for (const [taskKey, accumulator] of taskAccums) {
    const averageContribution = requireAverageContribution(
      averageContributionByTaskKey,
      taskKey,
      'buildPerTaskRows'
    );

    const completeness = resolveDisplayMetric(accumulator.completeness);
    const accuracy = resolveDisplayMetric(accumulator.accuracy);
    const spag = resolveDisplayMetric(accumulator.spag);
    const composite = computeOverallComposite(completeness, accuracy, spag, criterionWeightings);
    const displayOverall = resolveDisplayMetric(accumulator.overall);
    const overall = composite.state === 'excluded' ? displayOverall : composite;

    rows.push({
      definitionKey: accumulator.definitionKey,
      taskId: accumulator.taskId,
      taskTitle: null,
      averageContribution,
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
