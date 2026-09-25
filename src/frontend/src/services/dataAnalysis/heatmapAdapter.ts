import { logFrontendEvent } from '../../logging/frontendLogger';
import type {
  AverageContribution,
  AveragingResult,
  PerStudentTaskMetric,
  TaskDisplayMetric,
} from './dataAnalysis.zod';
import type { ClassFull } from '../googleClassrooms/classDetail/classDetailService.zod';
import type {
  AssignmentDefinitionPartial,
  AssignmentDefinitionPartialsResponse,
} from '../assignmentDefinition/assignmentDefinitionPartials.zod';
import {
  computeEffectiveWeight,
  createTaskWeightingIndex,
  getAssignmentDefinitionPartial,
} from '../assignmentDefinition/assignmentDefinitionUtilities';
import { buildTaskKey } from './taskKey';

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
  completeness: TaskDisplayMetric;
  accuracy: TaskDisplayMetric;
  spag: TaskDisplayMetric;
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
  averageContribution: AverageContribution;
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
export const DEFAULT_CLASS_NAME_LABEL = 'Class Overview';

/**
 * A frozen not-attempted `TaskDisplayMetric` used as the default cell value when a
 * student has no per-student-task metric for a given task column.
 *
 * @remarks
 * This object is frozen to prevent accidental mutation from corrupting every
 * missing cell simultaneously.  If mutation is ever required, return a fresh
 * object per cell instead of unfreezing this one. Its `totalDataPoints: 1` is
 * intentional: it is a schema-valid task-level not-attempted fallback. The
 * Class-page adapter's zero-data `N` placeholder uses `totalDataPoints: 0` and
 * is intentionally kept separate from this task-display shape.
 */
const NOT_ATTEMPTED_METRIC: Readonly<TaskDisplayMetric> = Object.freeze({
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
export function buildTaskColumns(partial: AssignmentDefinitionPartial): HeatmapTaskColumn[] {
  const taskWeightingIndex = createTaskWeightingIndex(partial);
  return partial.tasks.map((task) => {
    const effectiveWeight = computeEffectiveWeight(taskWeightingIndex, task.taskId);
    if (effectiveWeight === undefined) {
      throw new Error(
        `buildTaskColumns: task '${task.taskId}' is missing from partial '${partial.definitionKey}'`
      );
    }
    return {
      taskKey: buildTaskKey(partial.definitionKey, task.taskId),
      taskId: task.taskId,
      taskTitle: task.taskTitle,
      averageContribution: {
        effectiveWeight,
        includedInAverage: effectiveWeight > 0,
      },
    };
  });
}

/**
 * Project the ordered per-task cells for one student from their grouped metrics.
 *
 * @param {string} studentId - The student identifier.
 * @param {string} studentName - The student display name.
 * @param {ReadonlyMap<string, PerStudentTaskMetric> | ReadonlyArray<PerStudentTaskMetric>} studentMetrics -
 *   The student's metrics, either as a task-key lookup or as a direct array for
 *   boundary callers. Arrays are indexed once before cell projection.
 * @param {ReadonlyArray<{ taskKey: string }>} taskColumns - The ordered task columns.
 * @returns {{ studentId: string; studentName: string; cells: HeatmapCell[] }} The
 *   completed heatmap row.
 *
 * @remarks
 * Shared by both {@link adaptMetricsToHeatmap} and {@link adaptMetricsToMergedHeatmap}
 * (byte-identical cell projection). This is the single source of truth for cell
 * semantics: the merged projection re-uses it rather than duplicating it. A missing
 * `(student, taskKey)` metric falls back to the frozen not-attempted metric. The
 * adapter supplies a task-key map, so cell projection performs constant-time lookups.
 */
export function buildCellsForStudent(
  studentId: string,
  studentName: string,
  studentMetrics: ReadonlyMap<string, PerStudentTaskMetric> | ReadonlyArray<PerStudentTaskMetric>,
  taskColumns: ReadonlyArray<{ taskKey: string }>
): { studentId: string; studentName: string; cells: HeatmapCell[] } {
  const metricsByTaskKey =
    'get' in studentMetrics
      ? studentMetrics
      : new Map<string, PerStudentTaskMetric>(
          studentMetrics.map((metric) => [metric.taskKey, metric] as const)
        );
  const cells: HeatmapCell[] = taskColumns.map((column) => {
    const metric = metricsByTaskKey.get(column.taskKey);
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
  return { studentId, studentName, cells };
}

/**
 * Warn once for each task column that has no analyser metric for any student.
 *
 * @param {string} context - The calling adapter's logging context.
 * @param {string} classId - The class ID associated with the heatmap.
 * @param {ReadonlyArray<{ taskKey: string }>} taskColumns - The ordered task columns.
 * @param {ReadonlyMap<string, ReadonlyMap<string, PerStudentTaskMetric>>} metricsByStudent -
 *   Metrics grouped by student ID and task key.
 * @returns {void} Nothing.
 */
export function warnForMissingTaskMetrics(
  context: string,
  classId: string,
  taskColumns: ReadonlyArray<{ taskKey: string }>,
  metricsByStudent: ReadonlyMap<string, ReadonlyMap<string, PerStudentTaskMetric>>
): void {
  const observedTaskKeys = new Set<string>();
  for (const studentMetrics of metricsByStudent.values()) {
    for (const taskKey of studentMetrics.keys()) {
      observedTaskKeys.add(taskKey);
    }
  }

  for (const column of taskColumns) {
    if (observedTaskKeys.has(column.taskKey)) {
      continue;
    }
    logFrontendEvent('warn', {
      context,
      errorMessage: `No analyser metric exists for any student for heatmap column '${column.taskKey}'`,
      metadata: { classId, taskKey: column.taskKey },
    });
  }
}

/**
 * Group per-student-task metrics by student ID and task key, filtering to those
 * matching the given class and task-key set.
 *
 * @param {AveragingResult} analyserResult - The analysis result.
 * @param {string} classId - The class ID to filter by.
 * @param {Set<string>} columnTaskKeys - The set of valid task keys for this assignment.
 * @returns {Map<string, Map<string, PerStudentTaskMetric>>} Metrics grouped by
 *   student ID and canonical task key.
 * @remarks
 * An omitted optional `perStudentTaskMetrics` field is logged once at this
 * boundary rather than silently treated as an empty metric set.
 */
export function groupMetricsByStudent(
  analyserResult: AveragingResult,
  classId: string,
  columnTaskKeys: Set<string>
): Map<string, Map<string, PerStudentTaskMetric>> {
  const metricsByStudent = new Map<string, Map<string, PerStudentTaskMetric>>();
  const perStudentTaskMetrics = analyserResult.perStudentTaskMetrics;
  if (perStudentTaskMetrics === undefined) {
    logFrontendEvent('warn', {
      context: 'groupMetricsByStudent',
      errorMessage:
        'Analyser result is missing perStudentTaskMetrics; heatmap cells use no-submission placeholders',
      metadata: { classId },
    });
    return metricsByStudent;
  }

  for (const metric of perStudentTaskMetrics) {
    if (metric.classId === classId && columnTaskKeys.has(metric.taskKey)) {
      let studentMetrics = metricsByStudent.get(metric.studentId);
      if (!studentMetrics) {
        studentMetrics = new Map<string, PerStudentTaskMetric>();
        metricsByStudent.set(metric.studentId, studentMetrics);
      }
      if (!studentMetrics.has(metric.taskKey)) {
        studentMetrics.set(metric.taskKey, metric);
      }
    }
  }
  return metricsByStudent;
}

/**
 * Resolve a single assignment's warm-up definition partial, validating its
 * presence in `classFull.assignments` and the availability of its partial.
 *
 * @param {ClassFull} classFull - The full class data.
 * @param {string} assignmentId - The assignment identifier to resolve.
 * @param {AssignmentDefinitionPartialsResponse} assignmentDefinitionPartials -
 *   The warm-up partials dataset.
 * @param {ReadonlyMap<string, ClassFull['assignments'][number]>} [assignmentById] -
 *   Optional prebuilt `assignmentId → assignment` map. When supplied, it is used
 *   instead of a linear `.find` over `classFull.assignments` so callers in a
 *   loop over many assignment IDs avoid a repeated O(A) scan.
 * @returns {{ definitionKey: string; partial: AssignmentDefinitionPartial }}
 *   The resolved definition key and warm-up partial.
 * @throws {Error} If `assignmentId` is not present in `classFull.assignments`.
 * @throws {TaskTitlesUnavailableError} If no partial exists for the definition key.
 *
 * @remarks
 * This is the single source of truth for the "find assignment → resolve
 * definition key → resolve partial → throw on absence" sequence shared by the
 * embedded and merged adapters, keeping the error contract in one place.
 */
export function resolveAssignmentPartial(
  classFull: ClassFull,
  assignmentId: string,
  assignmentDefinitionPartials: AssignmentDefinitionPartialsResponse,
  assignmentById?: ReadonlyMap<string, ClassFull['assignments'][number]>
): { definitionKey: string; partial: AssignmentDefinitionPartial } {
  const assignment =
    assignmentById?.get(assignmentId) ??
    classFull.assignments.find((a) => a.assignmentId === assignmentId);
  if (!assignment) {
    throw new Error(
      `resolveAssignmentPartial: assignmentId "${assignmentId}" not found in classFull.assignments`
    );
  }
  const definitionKey = assignment.assignmentDefinitionKey;
  const partial = getAssignmentDefinitionPartial(assignmentDefinitionPartials, definitionKey);
  if (!partial) {
    throw new TaskTitlesUnavailableError(definitionKey);
  }
  return { definitionKey, partial };
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
 * `taskKey`s with the shared `buildTaskKey` helper from the warm-up partial.
 * Multi-assignment selection is handled by the merged adapter (`heatmapAdapter.merged.ts`); this adapter remains single-assignment.
 */
export function adaptMetricsToHeatmap(
  analyserResult: AveragingResult,
  classFull: ClassFull,
  assignmentId: string,
  assignmentDefinitionPartials: AssignmentDefinitionPartialsResponse
): HeatmapResult {
  const { partial } = resolveAssignmentPartial(
    classFull,
    assignmentId,
    assignmentDefinitionPartials
  );
  const className: string = classFull.className ?? DEFAULT_CLASS_NAME_LABEL;

  const taskColumns = buildTaskColumns(partial);

  const columnTaskKeys = new Set(taskColumns.map((c) => c.taskKey));
  const metricsByStudent = groupMetricsByStudent(analyserResult, classFull.classId, columnTaskKeys);
  if (analyserResult.perStudentTaskMetrics !== undefined) {
    warnForMissingTaskMetrics(
      'adaptMetricsToHeatmap',
      classFull.classId,
      taskColumns,
      metricsByStudent
    );
  }

  const rows: HeatmapRow[] = classFull.students.map((student) =>
    buildCellsForStudent(
      student.id,
      student.name,
      metricsByStudent.get(student.id) ?? new Map<string, PerStudentTaskMetric>(),
      taskColumns
    )
  );

  return {
    assignmentId,
    assignmentName: partial.primaryTitle,
    className,
    rows,
    taskColumns,
  };
}
