import type { AveragingResult, MetricResult, PerStudentTaskMetric } from './dataAnalysis.zod';
import type { ClassFull } from '../googleClassrooms/classDetail/classDetailService.zod';
import type {
  AssignmentDefinitionPartial,
  AssignmentDefinitionPartialsResponse,
} from '../assignmentDefinition/assignmentDefinitionPartials.zod';
import { getAssignmentDefinitionPartial } from '../assignmentDefinition/assignmentDefinitionUtilities';

/**
 * Error thrown when task titles cannot be resolved for a heatmap assignment.
 *
 * @remarks
 * This indicates the warm-up `assignmentDefinitionPartials` dataset has
 * no entry for the assignment's `definitionKey`.  The caller should render an
 * in-view `Alert` rather than auto-navigating.
 */
export class TaskTitlesUnavailableError extends Error {
  /**
   * Construct a TaskTitlesUnavailableError for the given definition key.
   *
   * @param {string} definitionKey - The definition key whose titles could not
   *   be resolved.
   */
  constructor(definitionKey: string) {
    super(`Task titles unavailable for definition "${definitionKey}"`);
    this.name = 'TaskTitlesUnavailableError';
  }
}

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
 * `taskTitle` is sourced from the warm-up `assignmentDefinitionPartials`
 * dataset and may be `null` (carried through to the column; the table header
 * falls back to `taskId` for display).
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
 * A frozen not-attempted `MetricResult` used as the default cell value when a
 * student has no per-student-task metric for a given task column.
 *
 * @remarks
 * This object is frozen to prevent accidental mutation from corrupting every
 * missing cell simultaneously.  If mutation is ever required, return a fresh
 * object per cell instead of unfreezing this one.
 */
const NOT_ATTEMPTED_METRIC: Readonly<MetricResult> = Object.freeze({
  state: 'notAttempted' as const,
  value: 'N' as const,
  totalWeight: 0,
  applicableDataPoints: 0,
  totalDataPoints: 1,
});

/**
 * Build the ordered task-column descriptors from a warm-up assignment-definition
 * partial.
 *
 * @param {AssignmentDefinitionPartial} partial - The assignment-definition
 *   partial whose tasks define the column set.
 * @returns {HeatmapTaskColumn[]} Ordered task-column descriptors with `taskKey`,
 *   `taskId`, and `taskTitle` read directly from the partial.
 */
function buildTaskColumns(partial: AssignmentDefinitionPartial): HeatmapTaskColumn[] {
  return partial.tasks.map((task) => ({
    taskKey: `${partial.definitionKey}::${task.taskId}`,
    taskId: task.taskId,
    taskTitle: task.taskTitle,
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
 * Project an `AveragingResult` (with per-student-task metrics), a `ClassFull`,
 * an `assignmentId`, and the warm-up `assignmentDefinitionPartials` into a
 * `HeatmapResult` view model for a single assignment.
 *
 * @param {AveragingResult} analyserResult - The analysis result containing
 *   per-student-task metrics.
 * @param {ClassFull} classFull - The full class data including assignment
 *   definitions and roster.
 * @param {string} assignmentId - The identifier of the assignment to project.
 * @param {AssignmentDefinitionPartialsResponse} assignmentDefinitionPartials -
 *   The warm-up assignment-definition partials dataset.  Task columns and
 *   titles are sourced from the entry matching the assignment's `definitionKey`.
 * @returns {HeatmapResult} A `HeatmapResult` with task columns, per-student rows,
 *   and metadata.
 * @throws {TaskTitlesUnavailableError} When the warm-up partial is missing for
 *   the assignment's `definitionKey`.
 * @throws {Error} If `assignmentId` is not found in `classFull.assignments`.
 *
 * @remarks
 * **Breaking change (Section 8):** the signature now requires a 4th parameter
 * (`assignmentDefinitionPartials`).  Task columns are sourced from the warm-up
 * partial located via `getAssignmentDefinitionPartial`, NOT from the embedded
 * `assignment.assignmentDefinition.tasks` (which was removed in favour of the
 * lightweight `assignmentDefinitionKey`).  If the partial is missing,
 * `TaskTitlesUnavailableError` is thrown.
 * This is distinct from a generic `Error` (unknown `assignmentId`).
 *
 * The per-task `null`-title branch was removed (E3–F3) because `null` titles
 * are now carried through to the column descriptor (the table header falls back
 * to `taskId` for display).  Missing partials are caught by the
 * `getAssignmentDefinitionPartial` check above.
 *
 * v1 uses single-assignment selection at the adapter boundary by deriving
 * `taskKey`s (`${definitionKey}::${taskId}`) from the warm-up partial.
 * Multi-assignment selection is deferred — see SPEC.md §Deferrals.
 */
export function adaptMetricsToHeatmap(
  analyserResult: AveragingResult,
  classFull: ClassFull,
  assignmentId: string,
  assignmentDefinitionPartials: AssignmentDefinitionPartialsResponse
): HeatmapResult {
  const assignment = classFull.assignments.find((a) => a.assignmentId === assignmentId);
  if (!assignment) {
    throw new Error(
      `adaptMetricsToHeatmap: assignmentId "${assignmentId}" not found in classFull.assignments`
    );
  }

  const definitionKey: string = assignment.assignmentDefinitionKey ?? '';
  const className: string = classFull.className ?? DEFAULT_CLASS_NAME_LABEL;

  // Source task columns from the warm-up partial, not the embedded definition.
  const partial = getAssignmentDefinitionPartial(assignmentDefinitionPartials, definitionKey);
  if (!partial) {
    throw new TaskTitlesUnavailableError(definitionKey);
  }

  const taskColumns = buildTaskColumns(partial);

  const columnTaskKeys = new Set(taskColumns.map((c) => c.taskKey));
  const metricsByStudent = groupMetricsByStudent(analyserResult, classFull.classId, columnTaskKeys);

  const rows: HeatmapRow[] = classFull.students.map((student) => {
    const studentMetrics = metricsByStudent.get(student.id) ?? [];

    const cells: HeatmapCell[] = taskColumns.map((column) => {
      const metric = studentMetrics.find((m) => m.taskKey === column.taskKey);
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

  return {
    assignmentId,
    assignmentName: partial.primaryTitle,
    className,
    rows,
    taskColumns,
  };
}
