import type { AveragingAnalyserInput } from '../dataAnalysis.zod';
import type { CriterionWeightings } from './averagingAnalyser';
import type { AssessmentScore, DataPointAccumulator } from './averagingAnalyser.types';
import { createDataPointAccumulator } from './averagingAnalyser.types';

/**
 * Pre-register tasks so entries with zero submissions appear in perTask.
 *
 * @param {ReadonlyArray<{ id: string }>} tasks - The tasks array.
 * @param {string} definitionKey - The definition key.
 * @param {Map<string, { definitionKey: string; taskId: string } & DataPointAccumulator>}
 *   taskAccums - The task accumulation map (mutated).
 */
export function preRegisterTasks(
  tasks: ReadonlyArray<{ id: string }>,
  definitionKey: string,
  taskAccums: Map<string, { definitionKey: string; taskId: string } & DataPointAccumulator>
): void {
  for (const task of tasks) {
    const taskKey = `${definitionKey}::${task.id}`;
    if (!taskAccums.has(taskKey)) {
      taskAccums.set(taskKey, {
        definitionKey,
        taskId: task.id,
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
 * Accumulate all four metrics into a single target accumulator for one
 * data point.
 *
 * @param {DataPointAccumulator} target - The accumulator to update.
 * @param {AssessmentScore} completenessScore - Completeness score.
 * @param {AssessmentScore} accuracyScore - Accuracy score.
 * @param {AssessmentScore} spagScore - SPaG score.
 * @param {number | null} overallValue - Pre-computed overall.
 * @param {number} weight - Per-data-point weight.
 */
export function accumulateMetricsToTarget(
  target: DataPointAccumulator,
  completenessScore: AssessmentScore,
  accuracyScore: AssessmentScore,
  spagScore: AssessmentScore,
  overallValue: number | null,
  weight: number
): void {
  target.completeness.totalDataPoints++;
  if (typeof completenessScore === 'number') {
    target.completeness.weightedSum += completenessScore * weight;
    target.completeness.totalWeight += weight;
    target.completeness.applicableDataPoints++;
  }

  target.accuracy.totalDataPoints++;
  if (typeof accuracyScore === 'number') {
    target.accuracy.weightedSum += accuracyScore * weight;
    target.accuracy.totalWeight += weight;
    target.accuracy.applicableDataPoints++;
  }

  target.spag.totalDataPoints++;
  if (typeof spagScore === 'number') {
    target.spag.weightedSum += spagScore * weight;
    target.spag.totalWeight += weight;
    target.spag.applicableDataPoints++;
  }

  target.overall.totalDataPoints++;
  if (overallValue !== null) {
    target.overall.weightedSum += overallValue * weight;
    target.overall.totalWeight += weight;
    target.overall.applicableDataPoints++;
  }
}

/**
 * Compute the overall value for a single data point, renormalising when
 * criteria are 'N' (not applicable).
 *
 * @param {CriterionWeightings} criterionWeightings - The criterion weightings.
 * @param {AssessmentScore} completenessScore - The completeness score.
 * @param {AssessmentScore} accuracyScore - The accuracy score.
 * @param {AssessmentScore} spagScore - The SPaG score.
 * @returns {number | null} The weighted overall, or null if all criteria
 *   are unavailable.
 */
export function computeOverall(
  criterionWeightings: CriterionWeightings,
  completenessScore: AssessmentScore,
  accuracyScore: AssessmentScore,
  spagScore: AssessmentScore
): number | null {
  const cw = criterionWeightings;
  let numerator = 0;
  let denominator = 0;

  if (typeof completenessScore === 'number') {
    numerator += cw.completeness * completenessScore;
    denominator += cw.completeness;
  }
  if (typeof accuracyScore === 'number') {
    numerator += cw.accuracy * accuracyScore;
    denominator += cw.accuracy;
  }
  if (typeof spagScore === 'number') {
    numerator += cw.spag * spagScore;
    denominator += cw.spag;
  }

  if (denominator === 0) return null;
  return numerator / denominator;
}

/**
 * Process one submission item, accumulating metrics into all three scopes.
 *
 * @param {AssessmentScore} completenessScore - The completeness score.
 * @param {AssessmentScore} accuracyScore - The accuracy score.
 * @param {AssessmentScore} spagScore - The SPaG score.
 * @param {number} weight - The per-data-point weight.
 * @param {DataPointAccumulator} studentAccum - Per-student accumulator.
 * @param {DataPointAccumulator} classAccum - Per-class accumulator.
 * @param {DataPointAccumulator} taskAccum - Per-task accumulator.
 * @param {CriterionWeightings} criterionWeightings - The criterion weightings.
 */
export function processSubmissionItem(
  completenessScore: AssessmentScore,
  accuracyScore: AssessmentScore,
  spagScore: AssessmentScore,
  weight: number,
  studentAccum: DataPointAccumulator,
  classAccum: DataPointAccumulator,
  taskAccum: DataPointAccumulator,
  criterionWeightings: CriterionWeightings
): void {
  const overallValue = computeOverall(
    criterionWeightings,
    completenessScore,
    accuracyScore,
    spagScore
  );

  accumulateMetricsToTarget(
    studentAccum,
    completenessScore,
    accuracyScore,
    spagScore,
    overallValue,
    weight
  );
  accumulateMetricsToTarget(
    classAccum,
    completenessScore,
    accuracyScore,
    spagScore,
    overallValue,
    weight
  );
  accumulateMetricsToTarget(
    taskAccum,
    completenessScore,
    accuracyScore,
    spagScore,
    overallValue,
    weight
  );
}

/**
 * Extract assessment scores from a submission item and apply them to all
 * three accumulator scopes.
 *
 * @param {AveragingAnalyserInput['classes'][number]['assignments'][number]['submissions'][number]['items'][string]}
 *   item - The submission item.
 * @param {number} weight - The per-data-point weight.
 * @param {DataPointAccumulator} studentAccum - Per-student accumulator.
 * @param {DataPointAccumulator} classAccum - Per-class accumulator.
 * @param {DataPointAccumulator} taskAccum - Per-task accumulator.
 * @param {CriterionWeightings} criterionWeightings - The criterion weightings.
 */
export function processItemAssessments(
  item: AveragingAnalyserInput['classes'][number]['assignments'][number]['submissions'][number]['items'][string],
  weight: number,
  studentAccum: DataPointAccumulator,
  classAccum: DataPointAccumulator,
  taskAccum: DataPointAccumulator,
  criterionWeightings: CriterionWeightings
): void {
  const { assessments } = item;
  const assessmentsOrEmpty = assessments ?? {};
  const completenessScore: AssessmentScore = assessmentsOrEmpty.completeness?.score;
  const accuracyScore: AssessmentScore = assessmentsOrEmpty.accuracy?.score;
  const spagScore: AssessmentScore = assessmentsOrEmpty.spag?.score;

  processSubmissionItem(
    completenessScore,
    accuracyScore,
    spagScore,
    weight,
    studentAccum,
    classAccum,
    taskAccum,
    criterionWeightings
  );
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
 */
export function processAssignment(
  assignment: AveragingAnalyserInput['classes'][number]['assignments'][number],
  assignmentWeighting: number,
  definitionKey: string,
  taskWeightByDefinitionKey: Map<string, Map<string, number>>,
  studentAccums: Map<string, { studentName: string | null } & DataPointAccumulator>,
  taskAccums: Map<string, { definitionKey: string; taskId: string } & DataPointAccumulator>,
  classAccum: DataPointAccumulator,
  criterionWeightings: CriterionWeightings
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

      const taskAccum = getOrCreateTaskAccum(taskAccums, definitionKey, taskId);

      processItemAssessments(
        item,
        weight,
        studentAccum,
        classAccum,
        taskAccum,
        criterionWeightings
      );
    }
  }
}

/**
 * Resolve the task weighting by cross-referencing the pre-fetched
 * assignmentDefinitionPartials collection.
 *
 * @param {string} definitionKey - The assignment definition key.
 * @param {string} taskId - The task identifier.
 * @param {ReadonlyArray<{ definitionKey: string; tasks?: ReadonlyArray<{ id: string; taskWeighting: number }> }>}
 *   assignmentDefinitionPartials - The pre-fetched partials.
 * @returns {number} The resolved task weighting, or `1` if no match.
 */
export function resolveTaskWeight(
  definitionKey: string,
  taskId: string,
  assignmentDefinitionPartials: ReadonlyArray<{
    definitionKey: string;
    tasks?: ReadonlyArray<{ id: string; taskWeighting: number }>;
  }>
): number {
  const definitionPartial = assignmentDefinitionPartials.find(
    (d) => d.definitionKey === definitionKey
  );
  if (!definitionPartial) return 1;

  const tasks = definitionPartial.tasks ?? [];
  const task = tasks.find((t) => t.id === taskId);
  return task?.taskWeighting ?? 1;
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
 *   classAccum: DataPointAccumulator
 * }} The three accumulator containers.
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
} {
  const studentAccums = new Map<string, { studentName: string | null } & DataPointAccumulator>();

  const taskAccums = new Map<
    string,
    { definitionKey: string; taskId: string } & DataPointAccumulator
  >();

  const classAccum = createDataPointAccumulator();

  // Build a two-level Map for O(1) task-weighting lookups.
  const taskWeightByDefinitionKey = new Map<string, Map<string, number>>();
  for (const p of input.assignmentDefinitionPartials) {
    const taskMap = new Map<string, number>();
    for (const t of p.tasks ?? []) {
      taskMap.set(t.id, t.taskWeighting);
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
      criterionWeightings
    );
  }

  return { studentAccums, taskAccums, classAccum };
}
