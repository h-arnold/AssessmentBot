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
 * Convert one per-criterion aggregate rollup to the aggregate-only `excluded`
 * state for observed evidence that fell outside the baseline task set.
 *
 * @remarks
 * Only `computed` and `notAttempted` convert. An already-`excluded` zero-weight
 * rollup keeps its weighting cause (the conversion never launders an existing
 * cause, so the mode-aware accessible label stays truthful), and an `error`
 * rollup keeps `error` (no `excluded` result is synthesised without observed
 * non-error evidence). The resolved `totalDataPoints` is preserved: the
 * conversion never substitutes the weight-gated `applicableDataPoints` counter,
 * which would violate the `excluded` schema's `totalDataPoints >= 1` bound.
 *
 * @param {MetricResult} metric - The unfiltered per-criterion rollup.
 * @returns {MetricResult} The converted (or untouched) metric result.
 */
export function convertToBaselineExcluded(metric: MetricResult): MetricResult {
  if (metric.state !== 'computed' && metric.state !== 'notAttempted') {
    return metric;
  }
  return {
    state: 'excluded',
    value: null,
    totalWeight: 0,
    applicableDataPoints: 0,
    totalDataPoints: metric.totalDataPoints,
  };
}

/**
 * Select a student's per-(student, task) accumulators inside the baseline
 * task set.
 *
 * @param {Map<string, DataPointAccumulator>} taskAccumsForStudent - The student's accumulators.
 * @param {ReadonlySet<string>} baselineTaskKeys - The class's baseline task keys.
 * @returns {DataPointAccumulator[]} The baseline-restricted accumulators.
 */
function selectBaselineAccumulators(
  taskAccumsForStudent: Map<string, DataPointAccumulator>,
  baselineTaskKeys: ReadonlySet<string>
): DataPointAccumulator[] {
  const baselineAccums: DataPointAccumulator[] = [];
  for (const [taskKey, accumulator] of taskAccumsForStudent) {
    if (baselineTaskKeys.has(taskKey)) baselineAccums.push(accumulator);
  }
  return baselineAccums;
}

/**
 * Build one per-student row from the student's unfiltered accumulators when
 * none of them sit inside the baseline task set: each criterion resolves to
 * the existing aggregate-only `excluded` state with observed-evidence
 * semantics, and the `overall` composite is derived from the converted
 * criteria through the existing `computeOverallComposite` (the composite is
 * never converted directly).
 *
 * @param {string} studentId - The student identifier.
 * @param {string} studentName - The student's display name.
 * @param {Map<string, DataPointAccumulator>} taskAccumsForStudent - The student's accumulators.
 * @param {CriterionWeightings} criterionWeightings - The criterion weightings.
 * @returns {PerStudentRowWithName} The converted row.
 */
function buildBaselineOutsideRow(
  studentId: string,
  studentName: string,
  taskAccumsForStudent: Map<string, DataPointAccumulator>,
  criterionWeightings: CriterionWeightings
): PerStudentRowWithName {
  const unfiltered = rollupAccumulators(taskAccumsForStudent.values(), criterionWeightings);
  const completeness = convertToBaselineExcluded(unfiltered.completeness);
  const accuracy = convertToBaselineExcluded(unfiltered.accuracy);
  const spag = convertToBaselineExcluded(unfiltered.spag);
  const overall = computeOverallComposite(completeness, accuracy, spag, criterionWeightings);
  return { studentId, studentName, completeness, accuracy, spag, overall };
}

/**
 * Build one per-student row from the student's accumulators, scoped to the
 * baseline task set in baseline mode.
 *
 * @param {string} studentId - The student identifier.
 * @param {string} studentName - The student's display name.
 * @param {Map<string, DataPointAccumulator>} taskAccumsForStudent - The student's accumulators.
 * @param {CriterionWeightings} criterionWeightings - The criterion weightings.
 * @param {ReadonlySet<string> | undefined} baselineTaskKeys - The class's
 *   baseline task keys; `undefined` in absolute mode.
 * @returns {PerStudentRowWithName} The row.
 */
function buildStudentRow(
  studentId: string,
  studentName: string,
  taskAccumsForStudent: Map<string, DataPointAccumulator>,
  criterionWeightings: CriterionWeightings,
  baselineTaskKeys: ReadonlySet<string> | undefined
): PerStudentRowWithName {
  if (!baselineTaskKeys) {
    const { completeness, accuracy, spag, overall } = rollupAccumulators(
      taskAccumsForStudent.values(),
      criterionWeightings
    );
    return { studentId, studentName, completeness, accuracy, spag, overall };
  }

  const baselineAccums = selectBaselineAccumulators(taskAccumsForStudent, baselineTaskKeys);
  if (baselineAccums.length === 0) {
    return buildBaselineOutsideRow(
      studentId,
      studentName,
      taskAccumsForStudent,
      criterionWeightings
    );
  }

  const { completeness, accuracy, spag, overall } = rollupAccumulators(
    baselineAccums,
    criterionWeightings
  );
  return { studentId, studentName, completeness, accuracy, spag, overall };
}

/**
 * Build the four MetricResults (completeness, accuracy, spag, overall) from
 * an iterable of DataPointAccumulators using rollupMetric and the composite rule.
 *
 * @remarks
 * Shared by the per-student, per-task, and per-class aggregation scopes, so all
 * three roll their criterion metrics up identically.
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
 * @param {ReadonlySet<string> | undefined} baselineTaskKeys - The class's
 *   baseline task keys in baseline mode; `undefined` in absolute mode. Baseline
 *   scoping restricts only the aggregation step: students with baseline
 *   accumulators roll them up per criterion, students whose accumulators all
 *   fall outside the baseline resolve to the aggregate-only `excluded` state
 *   with observed-evidence semantics, and students with no accumulators at all
 *   keep today's fallback path.
 * @returns {PerStudentRow[]} Sorted per-student result rows.
 */
export function buildPerStudentRows(
  studentAccums: Map<string, { studentName: string | null } & DataPointAccumulator>,
  perStudentTaskAccums: Map<string, Map<string, DataPointAccumulator>>,
  criterionWeightings: CriterionWeightings,
  baselineTaskKeys?: ReadonlySet<string>
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

    rows.push(
      buildStudentRow(
        studentId,
        accumulator.studentName,
        taskAccumsForStudent,
        criterionWeightings,
        baselineTaskKeys
      )
    );
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
 * `excluded` is valid only for aggregate scopes. Task-level rows retain numeric
 * or raw-`N` display evidence when observations exist, while no-observation rows
 * remain `error`. If the overall composite resolves to `excluded` (for example,
 * when contributing criterion aggregates are all non-contributing), this row
 * substitutes the criterion-weighted display overall from the task accumulator
 * instead of emitting an aggregate-only state that the task schema rejects.
 *
 * @param {Map<string, { definitionKey: string; taskId: string } & DataPointAccumulator>}
 *   taskAccums - Map of composite key to accumulator data (used for definitionKey,
 *   taskId, and as fallback for tasks with no student submissions).
 * @param {CriterionWeightings} criterionWeightings - The criterion weightings.
 * @param {ReadonlyMap<string, AverageContribution>} averageContributionByTaskKey -
 *   Authoritative contribution metadata keyed by taskKey. Every key present in
 *   `taskAccums` must have an entry; a missing entry is a producer bug.
 * @param {ReadonlySet<string> | undefined} baselineTaskKeys - The class's
 *   baseline task keys in baseline mode; `undefined` in absolute mode, where
 *   every task row is included. Row values stay absolute in both modes: the
 *   flag marks baseline-set membership only.
 * @returns {PerTaskRow[]} Sorted per-task result rows.
 */
export function buildPerTaskRows(
  taskAccums: Map<string, { definitionKey: string; taskId: string } & DataPointAccumulator>,
  criterionWeightings: CriterionWeightings,
  averageContributionByTaskKey: ReadonlyMap<string, AverageContribution>,
  baselineTaskKeys?: ReadonlySet<string>
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
      // Absolute mode includes every task row in the baseline; baseline mode
      // derives the flag from the class's baseline set instead.
      includedInAttemptBaseline: baselineTaskKeys?.has(taskKey) ?? true,
    });
  }

  rows.sort((a, b) => {
    const definitionComparison = a.definitionKey.localeCompare(b.definitionKey);
    if (definitionComparison !== 0) return definitionComparison;
    return a.taskId.localeCompare(b.taskId);
  });
  return rows;
}
