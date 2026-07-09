import type { AveragingResult, MetricResult, PerStudentTaskMetric } from './dataAnalysis.zod';
import type { ClassFull } from '../googleClassrooms/classDetail/classDetailService.zod';
import type { AssignmentDefinitionPartial } from '../assignmentDefinition/assignmentDefinitionPartials.zod';

/**
 * A single heatmap cell containing the three criterion metric results for one
 * student on one task.
 */
export interface HeatmapCell {
  completeness: MetricResult;
  accuracy: MetricResult;
  spag: MetricResult;
}

/**
 * A single student row in the heatmap, containing the student's identifier,
 * display name, and an ordered array of per-task cells.
 */
export interface HeatmapRow {
  studentId: string;
  studentName: string;
  cells: HeatmapCell[];
}

/**
 * A column descriptor for a single task in the heatmap table.
 *
 * @remarks
 * `taskTitle` is always `null` in v1 because the assignment definition partial
 * carries no per-task title. The table header falls back to `taskId` for
 * display.
 */
export interface HeatmapTaskColumn {
  taskKey: string;
  taskId: string;
  taskTitle: string | null;
}

/**
 * The complete heatmap view model, produced by {@link adaptMetricsToHeatmap}.
 */
export interface HeatmapResult {
  assignmentId: string;
  assignmentName: string;
  className: string;
  rows: HeatmapRow[];
  taskColumns: HeatmapTaskColumn[];
}

/** Static fallback label when `classFull.className` is `null`. */
const DEFAULT_CLASS_NAME_LABEL = 'Class Overview';

/**
 * A not-attempted `MetricResult` used as the default cell value when a student
 * has no per-student-task metric for a given task column.
 */
const NOT_ATTEMPTED_METRIC: MetricResult = {
  state: 'notAttempted',
  value: 'N',
  totalWeight: 0,
  applicableDataPoints: 0,
  totalDataPoints: 1,
};

/**
 * Build the ordered task-column descriptors for a single assignment.
 *
 * @param {AssignmentDefinitionPartial} definition - The assignment definition containing the
 *   task list.
 * @returns {HeatmapTaskColumn[]} Ordered task-column descriptors with `taskKey`,
 *   `taskId`, and `taskTitle: null`.
 */
function buildTaskColumns(definition: AssignmentDefinitionPartial): HeatmapTaskColumn[] {
  return (definition.tasks ?? []).map((task) => ({
    taskKey: `${definition.definitionKey}::${task.id}`,
    taskId: task.id,
    taskTitle: null,
  }));
}

/**
 * Group per-student-task metrics by student ID, filtering to those matching the
 * given class and task-key set.
 *
 * @param {AveragingResult} analyserResult - The analysis result.
 * @param {string} classId - The class ID to filter by.
 * @param {Set<string>} columnTaskKeys - The set of valid task keys for this assignment.
 * @returns {Map<string, PerStudentTaskMetric[]>} Metrics grouped by `studentId`.
 */
function groupMetricsByStudent(
  analyserResult: AveragingResult,
  classId: string,
  columnTaskKeys: Set<string>
): Map<string, PerStudentTaskMetric[]> {
  const metricsByStudent = new Map<string, PerStudentTaskMetric[]>();
  for (const metric of analyserResult.perStudentTaskMetrics ?? []) {
    if (metric.classId === classId && columnTaskKeys.has(metric.taskKey)) {
      const list = metricsByStudent.get(metric.studentId) ?? [];
      list.push(metric);
      metricsByStudent.set(metric.studentId, list);
    }
  }
  return metricsByStudent;
}

/**
 * Project an `AveragingResult` (with per-student-task metrics) and a `ClassFull`
 * into a `HeatmapResult` view model for a single assignment.
 *
 * @param {AveragingResult} analyserResult - The analysis result containing
 *   per-student-task metrics.
 * @param {ClassFull} classFull - The full class data including assignment
 *   definitions and roster.
 * @param {string} assignmentId - The identifier of the assignment to project.
 * @returns {HeatmapResult} A `HeatmapResult` with task columns, per-student rows,
 *   and metadata.
 * @throws {Error} If `assignmentId` is not found in `classFull.assignments`.
 * @remarks
 * v1 uses single-assignment selection at the adapter boundary by deriving
 * `taskKey`s (`${definitionKey}::${taskId}`) from the assignment in `classFull`.
 * Multi-assignment selection is deferred — see SPEC.md §Deferrals.
 */
export function adaptMetricsToHeatmap(
  analyserResult: AveragingResult,
  classFull: ClassFull,
  assignmentId: string
): HeatmapResult {
  const assignment = classFull.assignments.find((a) => a.assignmentId === assignmentId);
  if (!assignment) {
    throw new Error(
      `adaptMetricsToHeatmap: assignmentId "${assignmentId}" not found in classFull.assignments`
    );
  }

  const definition = assignment.assignmentDefinition;
  const className = classFull.className ?? DEFAULT_CLASS_NAME_LABEL;
  const taskColumns = buildTaskColumns(definition);
  const columnTaskKeys = new Set(taskColumns.map((c) => c.taskKey));
  const metricsByStudent = groupMetricsByStudent(analyserResult, classFull.classId, columnTaskKeys);

  const rows: HeatmapRow[] = classFull.students.map((student) => {
    const studentMetrics = metricsByStudent.get(student.id) ?? [];
    const metricByTaskKey = new Map(studentMetrics.map((m) => [m.taskKey, m]));

    const cells: HeatmapCell[] = taskColumns.map((column) => {
      const metric = metricByTaskKey.get(column.taskKey);
      if (metric) {
        return {
          completeness: metric.completeness,
          accuracy: metric.accuracy,
          spag: metric.spag,
        };
      }
      return {
        completeness: NOT_ATTEMPTED_METRIC,
        accuracy: NOT_ATTEMPTED_METRIC,
        spag: NOT_ATTEMPTED_METRIC,
      };
    });

    return { studentId: student.id, studentName: student.name, cells };
  });

  return { assignmentId, assignmentName: definition.primaryTitle, className, rows, taskColumns };
}
