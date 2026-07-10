import type {
  AveragingAnalyserInput,
  MetricResult,
  PerStudentTaskMetric,
} from '../dataAnalysis.zod';
import type { CriterionWeightings } from './averagingAnalyser';
import type { DataPointAccumulator, MetricAccumulator } from './averagingAnalyser.types';
import type { TaskPartial } from '../../assignmentDefinition/taskPartial.zod';
import { processItemAssessments } from './averagingAnalyser.criterionAccumulation';

/**
 * Create a zeroed-out metric accumulator.
 *
 * @returns {MetricAccumulator} A fresh entry with all fields at zero.
 */
export function createAccumulator(): MetricAccumulator {
  return { weightedSum: 0, totalWeight: 0, applicableDataPoints: 0, totalDataPoints: 0, nCount: 0 };
}

/**
 * Create a zeroed-out data-point accumulator set.
 *
 * @returns {DataPointAccumulator} A fresh entry with all sub-accumulators at zero.
 */
export function createDataPointAccumulator(): DataPointAccumulator {
  return {
    completeness: createAccumulator(),
    accuracy: createAccumulator(),
    spag: createAccumulator(),
    overall: createAccumulator(),
  };
}

/**
 * Convert a metric accumulator to its output MetricResult shape.
 *
 * The three-way check:
 * - `applicableDataPoints > 0` → `computed` (weighted mean).
 * - `nCount > 0` and `applicableDataPoints === 0` → `notAttempted` (value `'N'`).
 * - Otherwise → `error` (value `'E'`).
 *
 * @param {MetricAccumulator} accumulator - The mutable accumulator to convert.
 * @returns {MetricResult} A read-only MetricResult snapshot.
 */
export function accumToMetric(accumulator: MetricAccumulator): MetricResult {
  if (accumulator.applicableDataPoints > 0) {
    return {
      state: 'computed',
      value: accumulator.weightedSum / accumulator.totalWeight,
      totalWeight: accumulator.totalWeight,
      applicableDataPoints: accumulator.applicableDataPoints,
      totalDataPoints: accumulator.totalDataPoints,
    };
  }

  if (accumulator.nCount > 0) {
    return {
      state: 'notAttempted',
      value: 'N',
      totalWeight: accumulator.totalWeight,
      applicableDataPoints: 0,
      totalDataPoints: accumulator.totalDataPoints,
    };
  }

  return {
    state: 'error',
    value: 'E',
    totalWeight: accumulator.totalWeight,
    applicableDataPoints: 0,
    totalDataPoints: accumulator.totalDataPoints,
  };
}

/**
 * Pre-register tasks so entries with zero submissions appear in perTask.
 *
 * @param {ReadonlyArray<TaskPartial>} tasks - The tasks array.
 * @param {string} definitionKey - The definition key.
 * @param {Map<string, { definitionKey: string; taskId: string } & DataPointAccumulator>}
 *   taskAccums - The task accumulation map (mutated).
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

/**
 * Get or create a per-student accumulator for the given student.
 *
 * @param {Map<string, { studentName: string | null } & DataPointAccumulator>}
 *   studentAccums - The accumulators map.
 * @param {string} studentId - The student identifier.
 * @param {string | null} studentName - The student display name.
 * @returns {DataPointAccumulator} The existing or new accumulator.
 */
export function getOrCreateStudentAccum(
  studentAccums: Map<string, { studentName: string | null } & DataPointAccumulator>,
  studentId: string,
  studentName: string | null
): DataPointAccumulator {
  if (!studentAccums.has(studentId)) {
    studentAccums.set(studentId, {
      studentName,
      ...createDataPointAccumulator(),
    });
  }
  return studentAccums.get(studentId)!;
}

/**
 * Get or create a per-task accumulator for the given task.
 *
 * @param {Map<string, { definitionKey: string; taskId: string } & DataPointAccumulator>}
 *   taskAccums - The accumulators map.
 * @param {string} definitionKey - The definition key.
 * @param {string} taskId - The task identifier.
 * @returns {DataPointAccumulator} The existing or new accumulator.
 */
export function getOrCreateTaskAccum(
  taskAccums: Map<string, { definitionKey: string; taskId: string } & DataPointAccumulator>,
  definitionKey: string,
  taskId: string
): DataPointAccumulator {
  const taskKey = `${definitionKey}::${taskId}`;
  if (!taskAccums.has(taskKey)) {
    taskAccums.set(taskKey, {
      definitionKey,
      taskId,
      ...createDataPointAccumulator(),
    });
  }
  return taskAccums.get(taskKey)!;
}

/**
 * Get or create a per-(student, task) accumulator.
 *
 * @param {Map<string, Map<string, DataPointAccumulator>>} perStudentTaskAccums -
 *   The per-student-task accumulators map (mutated).
 * @param {string} studentId - The student identifier.
 * @param {string} taskKey - The composite key (`definitionKey::taskId`).
 * @returns {DataPointAccumulator} The existing or new accumulator.
 */
export function getOrCreatePerStudentTaskAccum(
  perStudentTaskAccums: Map<string, Map<string, DataPointAccumulator>>,
  studentId: string,
  taskKey: string
): DataPointAccumulator {
  if (!perStudentTaskAccums.has(studentId)) {
    perStudentTaskAccums.set(studentId, new Map<string, DataPointAccumulator>());
  }
  const studentMap = perStudentTaskAccums.get(studentId)!;
  if (!studentMap.has(taskKey)) {
    studentMap.set(taskKey, createDataPointAccumulator());
  }
  return studentMap.get(taskKey)!;
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
  perStudentTaskAccums: Map<string, Map<string, DataPointAccumulator>>
): void {
  for (const submission of assignment.submissions) {
    const { studentId, studentName, items } = submission;
    const studentAccum = getOrCreateStudentAccum(studentAccums, studentId, studentName);

    for (const [taskId, item] of Object.entries(items)) {
      const taskWeighting = taskWeightByDefinitionKey.get(definitionKey)?.get(taskId) ?? 1;

      const weight = assignmentWeighting * taskWeighting;
      if (weight === 0) {
        continue;
      }

      const taskKey = `${definitionKey}::${taskId}`;
      const taskAccum = getOrCreateTaskAccum(taskAccums, definitionKey, taskId);
      const perStudentTaskAccum = getOrCreatePerStudentTaskAccum(
        perStudentTaskAccums,
        studentId,
        taskKey
      );

      processItemAssessments(
        item,
        weight,
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
 *   perStudentTaskAccums: Map<string, Map<string, DataPointAccumulator>>
 * }} The four accumulator containers. `perStudentTaskAccums` is a new map
 *   providing per-(student, task) accumulators that feed `rollupMetric` in the
 *   row builders.
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
} {
  const studentAccums = new Map<string, { studentName: string | null } & DataPointAccumulator>();

  const taskAccums = new Map<
    string,
    { definitionKey: string; taskId: string } & DataPointAccumulator
  >();

  const classAccum = createDataPointAccumulator();

  const perStudentTaskAccums = new Map<string, Map<string, DataPointAccumulator>>();

  // Build a two-level Map for O(1) task-weighting lookups.
  const taskWeightByDefinitionKey = new Map<string, Map<string, number>>();
  for (const p of input.assignmentDefinitionPartials) {
    const taskMap = new Map<string, number>();
    for (const t of p.tasks ?? []) {
      taskMap.set(t.taskId, t.taskWeighting);
    }
    taskWeightByDefinitionKey.set(p.definitionKey, taskMap);
  }

  for (const assignment of filteredAssignments) {
    const definition = assignment.assignmentDefinition!;
    const { assignmentWeighting, definitionKey, tasks } = definition;
    const resolvedAssignmentWeighting = assignmentWeighting ?? 1;

    preRegisterTasks(tasks ?? [], definitionKey, taskAccums);

    processAssignment(
      assignment,
      resolvedAssignmentWeighting,
      definitionKey,
      taskWeightByDefinitionKey,
      studentAccums,
      taskAccums,
      classAccum,
      criterionWeightings,
      perStudentTaskAccums
    );
  }

  return { studentAccums, taskAccums, classAccum, perStudentTaskAccums };
}

/**
 * Compute the `overall` MetricResult as a composite of the three per-criterion
 * rollups using the 40/40/20 weighting with SPaG-renormalisation.
 *
 * The composite rule (per spec decision 5):
 * - If any criterion is `error`, overall is `error`.
 * - If all criteria are `notAttempted`, overall is `notAttempted`.
 * - Otherwise, compute the weighted average over the `computed` criteria,
 *   treating `notAttempted` criteria as excluded (consistent with SPaG's
 *   exclusion rule). The default weighting is 0.4 completeness + 0.4 accuracy
 *   + 0.2 spag, with SPaG-renormalisation when spag is `notAttempted`
 *   (renormalise the weighting to completeness + accuracy over 0.8).
 *
 * @remarks Metadata fields (`totalWeight`, `applicableDataPoints`,
 *   `totalDataPoints`) in the composite result are **summed** across the
 *   contributing criteria entries (not `Math.max`). The prior implementation
 *   used `Math.max`, which discarded data when criteria had different weights.
 *   The sum semantics was confirmed as a spec amendment per user decision.
 *
 * @param {MetricResult} completeness - The completeness rollup MetricResult.
 * @param {MetricResult} accuracy - The accuracy rollup MetricResult.
 * @param {MetricResult} spag - The spag rollup MetricResult.
 * @param {CriterionWeightings} criterionWeightings - The criterion weightings.
 * @returns {MetricResult} The composite overall MetricResult.
 */
export function computeOverallComposite(
  completeness: MetricResult,
  accuracy: MetricResult,
  spag: MetricResult,
  criterionWeightings: CriterionWeightings
): MetricResult {
  // Error-first precedence: if any criterion is error, overall is error.
  // This check must come before notAttempted/computed checks so that mixed
  // error states are not masked (the prior implementation allowed error +
  // notAttempted to return notAttempted, and error + computed to return
  // computed, violating the documented contract).
  if (completeness.state === 'error' || accuracy.state === 'error' || spag.state === 'error') {
    return {
      state: 'error',
      value: 'E',
      totalWeight: 0,
      applicableDataPoints: 0,
      totalDataPoints:
        completeness.totalDataPoints + accuracy.totalDataPoints + spag.totalDataPoints,
    };
  }

  const statesSet = new Set([completeness.state, accuracy.state, spag.state]);
  const hasComputed = statesSet.has('computed');

  if (!hasComputed) {
    // All remaining criteria are notAttempted (error was already excluded above)
    return {
      state: 'notAttempted',
      value: 'N',
      totalWeight: 0,
      applicableDataPoints: 0,
      totalDataPoints:
        completeness.totalDataPoints + accuracy.totalDataPoints + spag.totalDataPoints,
    };
  }

  // At least one criterion is computed and none are error.
  // Build the computed criteria list (notAttempted criteria are excluded).
  const toComputedEntry = (
    m: MetricResult,
    w: number
  ): {
    value: number;
    totalWeight: number;
    applicableDataPoints: number;
    totalDataPoints: number;
    weighting: number;
  } | null => {
    if (m.state !== 'computed') return null;
    return {
      value: m.value,
      totalWeight: m.totalWeight,
      applicableDataPoints: m.applicableDataPoints,
      totalDataPoints: m.totalDataPoints,
      weighting: w,
    };
  };

  const entries = [
    toComputedEntry(completeness, criterionWeightings.completeness),
    toComputedEntry(accuracy, criterionWeightings.accuracy),
    toComputedEntry(spag, criterionWeightings.spag),
  ].filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  let numerator = 0;
  let denominator = 0;
  let totalWeight = 0;
  let applicableDataPoints = 0;
  let totalDataPoints = 0;

  for (const entry of entries) {
    numerator += entry.weighting * entry.value;
    denominator += entry.weighting;
    totalWeight += entry.totalWeight;
    applicableDataPoints += entry.applicableDataPoints;
    totalDataPoints += entry.totalDataPoints;
  }

  if (denominator === 0) {
    throw new Error('computeOverallComposite: no computed criteria in composite');
  }

  return {
    state: 'computed',
    value: numerator / denominator,
    totalWeight,
    applicableDataPoints,
    totalDataPoints,
  };
}

/**
 * Build the perStudentTaskMetrics array from the internal per-(student, task)
 * accumulators.
 *
 * @param {string} classId - The class identifier to echo on each metric.
 * @param {Map<string, Map<string, DataPointAccumulator>>} perStudentTaskAccums -
 *   Outer key = studentId, inner key = taskKey (`definitionKey::taskId`).
 * @returns {PerStudentTaskMetric[]} Sorted array by studentId, then taskKey.
 */
export function buildPerStudentTaskMetrics(
  classId: string,
  perStudentTaskAccums: Map<string, Map<string, DataPointAccumulator>>
): PerStudentTaskMetric[] {
  const metrics: PerStudentTaskMetric[] = [];

  for (const [studentId, taskMap] of perStudentTaskAccums) {
    for (const [taskKey, accum] of taskMap) {
      metrics.push({
        classId,
        studentId,
        taskKey,
        completeness: accumToMetric(accum.completeness),
        accuracy: accumToMetric(accum.accuracy),
        spag: accumToMetric(accum.spag),
        overall: accumToMetric(accum.overall),
      });
    }
  }

  // Deterministic sort: studentId asc, then taskKey asc
  metrics.sort((a, b) => {
    const byStudent = a.studentId.localeCompare(b.studentId);
    return byStudent === 0 ? a.taskKey.localeCompare(b.taskKey) : byStudent;
  });

  return metrics;
}
