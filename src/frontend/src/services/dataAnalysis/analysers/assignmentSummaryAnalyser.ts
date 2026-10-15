import type {
  AveragingAnalyserInput,
  PerStudentTaskMetric,
  TaskDisplayMetric,
} from '../dataAnalysis.zod';
import {
  AssignmentSummaryThresholdsSchema,
  type AssignmentSummary,
  type AssignmentSummaryThresholds,
  type TaskSummary,
} from '../assignmentSummary.zod';
import { AveragingAnalyser } from './averagingAnalyser';
import { buildTaskKey } from '../taskKey';

/**
 * Build descriptive counts and means from already-resolved display metrics.
 * @param {string} taskKey - Definition-scoped task identifier.
 * @param {readonly string[]} studentIds - Class roster identifiers.
 * @param {ReadonlyMap<string, ReadonlyMap<string, PerStudentTaskMetric>>} metricsByStudent - Display metrics by student and task.
 * @param {AssignmentSummaryThresholds} thresholds - Explicit analysis policy.
 * @returns {TaskSummary} Counts, mean and threshold classifications.
 */
function summariseTask(
  taskKey: string,
  studentIds: readonly string[],
  metricsByStudent: ReadonlyMap<string, ReadonlyMap<string, PerStudentTaskMetric>>,
  thresholds: AssignmentSummaryThresholds
): TaskSummary {
  const metrics = studentIds.map((studentId) => metricsByStudent.get(studentId)?.get(taskKey));
  const completeness = metrics.map((metric) => metric?.completeness);
  const accuracy = metrics.map((metric) => metric?.accuracy);
  const completedCount = completeness.filter(
    (metric) => metric?.state === 'computed' && metric.value >= thresholds.completeness
  ).length;
  const belowThresholdCount = completeness.filter(
    (metric) => metric?.state === 'computed' && metric.value < thresholds.completeness
  ).length;
  const notAttemptedCount = countNotAttempted(completeness);
  const completenessErrorCount = completeness.filter((metric) => metric?.state === 'error').length;
  const accuracyValues = accuracy
    .filter(
      (metric): metric is Extract<TaskDisplayMetric, { state: 'computed' }> =>
        metric?.state === 'computed'
    )
    .map((metric) => metric.value);
  const accuracyAssessedCount = accuracyValues.length;
  const accuracyAverage =
    accuracyAssessedCount > 0
      ? accuracyValues.reduce((sum, value) => sum + value, 0) / accuracyAssessedCount
      : null;
  const accuracyNotAttemptedCount = countNotAttempted(accuracy);
  const accuracyErrorCount = accuracy.filter((metric) => metric?.state === 'error').length;
  return {
    taskKey,
    completedCount,
    belowThresholdCount,
    notAttemptedCount,
    completenessErrorCount,
    incompleteAcrossMostStudents:
      studentIds.length > 0 &&
      (belowThresholdCount + notAttemptedCount) / studentIds.length >
        thresholds.incompleteProportion,
    accuracyAverage,
    accuracyAssessedCount,
    accuracyNotAttemptedCount,
    accuracyErrorCount,
    belowAccuracyThreshold: accuracyAverage !== null && accuracyAverage < thresholds.accuracy,
  };
}

/**
 * Count genuine N values and missing cells using the heatmap's existing rule.
 * @param {ReadonlyArray<TaskDisplayMetric | undefined>} metrics - Roster-aligned metrics.
 * @returns {number} Number of N or missing cells.
 */
function countNotAttempted(metrics: ReadonlyArray<TaskDisplayMetric | undefined>): number {
  return metrics.filter((metric) => !metric || metric.state === 'notAttempted').length;
}

/**
 * Index existing per-student display metrics for constant-time task lookups.
 * @param {readonly PerStudentTaskMetric[]} metrics - Assignment-scoped display results.
 * @returns {Map<string, Map<string, PerStudentTaskMetric>>} Student/task index.
 */
function indexStudentMetrics(
  metrics: readonly PerStudentTaskMetric[]
): Map<string, Map<string, PerStudentTaskMetric>> {
  const index = new Map<string, Map<string, PerStudentTaskMetric>>();
  for (const metric of metrics) {
    let tasks = index.get(metric.studentId);
    if (!tasks) {
      tasks = new Map();
      index.set(metric.studentId, tasks);
    }
    tasks.set(metric.taskKey, metric);
  }
  return index;
}

/** Pure assignment-scoped analysis; reuses the existing score-resolution rules. */
export class AssignmentSummaryAnalyser {
  private readonly thresholds: AssignmentSummaryThresholds;

  /**
   * Set the first-version policy at construction, with optional explicit overrides.
   * @param {AssignmentSummaryThresholds} [thresholds] - Optional explicit policy overrides.
   */
  constructor(thresholds?: AssignmentSummaryThresholds) {
    this.thresholds = AssignmentSummaryThresholdsSchema.parse(
      thresholds ?? {
        completeness: 4,
        accuracy: 3,
        incompleteProportion: 0.5,
      }
    );
  }

  /**
   * Analyse one assignment only, even when another uses the same definition.
   * @param {AveragingAnalyserInput} input - Validated source data; summary ignores global averaging filters.
   * @param {string} classId - Requested class identifier.
   * @param {string} assignmentId - Requested assignment identifier.
   * @returns {AssignmentSummary} Whole-roster descriptive task evidence.
   */
  analyse(input: AveragingAnalyserInput, classId: string, assignmentId: string): AssignmentSummary {
    const classFull = input.classes.find((candidate) => candidate.classId === classId);
    if (!classFull) throw new Error(`Unknown summary class: ${classId}`);
    const assignment = classFull.assignments.find(
      (candidate) => candidate.assignmentId === assignmentId
    );
    if (!assignment) throw new Error(`Unknown summary assignment: ${assignmentId}`);
    const partial = input.assignmentDefinitionPartials.find(
      (candidate) => candidate.definitionKey === assignment.assignmentDefinitionKey
    );
    if (!partial)
      throw new Error(`Missing summary definition: ${assignment.assignmentDefinitionKey}`);

    // Existing task keys omit assignmentId: isolate the assignment before accumulation.
    const [result] = new AveragingAnalyser().analyse({
      filter: { classIds: [classId] },
      classes: [{ ...classFull, assignments: [assignment] }],
      assignmentDefinitionPartials: input.assignmentDefinitionPartials,
    });
    const metricsByStudent = indexStudentMetrics(result.perStudentTaskMetrics ?? []);
    const studentIds = classFull.students.map((student) => student.id);
    const tasks = partial.tasks.map((task) => {
      return summariseTask(
        buildTaskKey(partial.definitionKey, task.taskId),
        studentIds,
        metricsByStudent,
        this.thresholds
      );
    });
    const averages = tasks
      .filter(
        (task): task is TaskSummary & { accuracyAverage: number } => task.accuracyAverage !== null
      )
      .map((task) => task.accuracyAverage);
    const highest = averages.length > 0 ? Math.max(...averages) : null;
    const lowest = averages.length > 0 ? Math.min(...averages) : null;
    return {
      classId,
      assignmentId,
      totalStudents: studentIds.length,
      thresholds: { ...this.thresholds },
      tasks,
      mostAccurateTaskKeys: tasks
        .filter((task) => highest !== null && task.accuracyAverage === highest)
        .map((task) => task.taskKey),
      leastAccurateTaskKeys: tasks
        .filter((task) => lowest !== null && task.accuracyAverage === lowest)
        .map((task) => task.taskKey),
    };
  }
}
