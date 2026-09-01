import type { AveragingResult, MetricResult } from './dataAnalysis.zod';
import type { ClassFull } from '../googleClassrooms/classDetail/classDetailService.zod';
import type {
  AssignmentDefinitionPartial,
  AssignmentDefinitionPartialsResponse,
} from '../assignmentDefinition/assignmentDefinitionPartials.zod';
import { getAssignmentDefinitionPartial } from '../assignmentDefinition/assignmentDefinitionUtilities';
import {
  buildCellsForStudent,
  groupMetricsByStudent,
  DEFAULT_CLASS_NAME_LABEL,
  TaskTitlesUnavailableError,
} from './heatmapAdapter';

/**
 * A column descriptor for a single task in the merged heatmap table, carrying
 * the full identity needed for future per-task column filtering.
 *
 * @remarks
 * Unlike {@link HeatmapTaskColumn}, every merged column carries its full
 * assignment identity (`assignmentId`, `definitionKey`, `assignmentName`) so a
 * future filter can slice columns without reshaping the view model. `taskKey`
 * is the composite `${definitionKey}::${taskId}` shared with the analyser's
 * per-student-task accumulators.
 */
export interface MergedHeatmapTaskColumn {
  taskKey: string;
  taskId: string;
  taskTitle: string | null;
  assignmentId: string;
  definitionKey: string;
  assignmentName: string;
}

/**
 * The complete merged heatmap view model, produced by
 * {@link adaptMetricsToMergedHeatmap}.
 *
 * @remarks
 * This is a distinct type from {@link HeatmapResult} (which stays byte-identical).
 * It spans multiple selected assignments: `sourceAssignments` records the
 * selection in `selectedAssignmentIds` order, while `taskColumns` carries the
 * deduplicated, classFull-ordered union of task columns.
 */
export interface MergedHeatmapResult {
  classId: string;
  className: string;
  sourceAssignments: ReadonlyArray<{
    assignmentId: string;
    definitionKey: string;
    assignmentName: string;
  }>;
  taskColumns: ReadonlyArray<MergedHeatmapTaskColumn>;
  rows: ReadonlyArray<{
    studentId: string;
    studentName: string;
    cells: ReadonlyArray<{
      completeness: MetricResult;
      accuracy: MetricResult;
      spag: MetricResult;
    }>;
  }>;
}

/**
 * Build merged task-column descriptors from a warm-up assignment-definition
 * partial, annotating each with the full assignment identity.
 *
 * @param {AssignmentDefinitionPartial} partial - The assignment-definition
 *   partial whose tasks define the column set.
 * @param {string} assignmentId - The contributing assignment identifier.
 * @param {string} assignmentName - The resolved assignment name (partial
 *   `primaryTitle`).
 * @returns {MergedHeatmapTaskColumn[]} Ordered merged task-column descriptors
 *   carrying full identity.
 */
function buildMergedTaskColumns(
  partial: AssignmentDefinitionPartial,
  assignmentId: string,
  assignmentName: string
): MergedHeatmapTaskColumn[] {
  return partial.tasks.map((task) => ({
    taskKey: `${partial.definitionKey}::${task.taskId}`,
    taskId: task.taskId,
    taskTitle: task.taskTitle,
    assignmentId,
    definitionKey: partial.definitionKey,
    assignmentName,
  }));
}

/**
 * Project an `AveragingResult` into a `MergedHeatmapResult` view model spanning
 * the selected assignment instances of one class.
 *
 * @param {AveragingResult} analyserResult - The analysis result containing
 *   per-student-task metrics.
 * @param {ClassFull} classFull - The full class data including assignment
 *   instances and roster.
 * @param {ReadonlyArray<string>} selectedAssignmentIds - The assignment
 *   identifiers to merge (selected in the builder surface).
 * @param {AssignmentDefinitionPartialsResponse} assignmentDefinitionPartials -
 *   The warm-up assignment-definition partials dataset. Task columns and titles
 *   are sourced from the entry matching each assignment's `definitionKey`.
 * @returns {MergedHeatmapResult} A merged heatmap with task columns, per-student
 *   rows, and metadata.
 * @throws {TaskTitlesUnavailableError} When a selected assignment's
 *   `definitionKey` has no matching warm-up partial.
 * @throws {Error} If a `selectedAssignmentId` is not present in
 *   `classFull.assignments`.
 *
 * @remarks
 * **Input shaping, not analyser filter keys.** The analyser consumes the single
 * `ClassFull` passed by the caller; it ignores `filter.classIds` and its
 * definition-key filter would wrongly include *sibling* instances of the same
 * definition. We therefore scope the merged view to exactly the selected
 * assignment instances here (the same `classFull.assignments` array the caller
 * shaped before analysis), deriving the `taskKey → assignment identity` mapping
 * from `classFull.assignments` restricted to `selectedAssignmentIds`.
 *
 * **Dedupe-by-taskKey is correct.** Per-student metrics are keyed by
 * `taskKey = ${definitionKey}::${taskId}` (no assignment-ID component), so two
 * selected instances sharing a definition key feed identical accumulators. The
 * merged `taskColumns` therefore collapses duplicate `taskKey`s to a single
 * column set; the collapsed column's identity (`assignmentId`, `assignmentName`)
 * is taken from the FIRST occurrence in `classFull.assignments` order, and its
 * cells are identical whether one or both instances are selected (merge parity).
 *
 * Column order follows `classFull.assignments` (restricted to selected IDs);
 * within an assignment, tasks follow the partial's task order. `sourceAssignments`
 * preserves the caller's `selectedAssignmentIds` order. Rows cover every class
 * student; missing `(studentId, taskKey)` pairs fall back to the frozen
 * not-attempted metric.
 */
export function adaptMetricsToMergedHeatmap(
  analyserResult: AveragingResult,
  classFull: ClassFull,
  selectedAssignmentIds: ReadonlyArray<string>,
  assignmentDefinitionPartials: AssignmentDefinitionPartialsResponse
): MergedHeatmapResult {
  const className: string = classFull.className ?? DEFAULT_CLASS_NAME_LABEL;

  // Resolve every selected assignment in selection order, validating presence
  // and warm-up partial availability up front (fail fast, no catch-and-ignore).
  const selectedMeta = resolveSelectedAssignmentMeta(
    classFull,
    selectedAssignmentIds,
    assignmentDefinitionPartials
  );

  const sourceAssignments = selectedMeta.map((meta) => ({
    assignmentId: meta.assignmentId,
    definitionKey: meta.definitionKey,
    assignmentName: meta.assignmentName,
  }));

  // Task columns follow classFull.assignments order (restricted to selected IDs),
  // deduplicated by taskKey; identity comes from the FIRST classFull occurrence.
  const taskColumns = buildMergedTaskColumnsInClassOrder(classFull, selectedMeta);

  const columnTaskKeys = new Set(taskColumns.map((column) => column.taskKey));
  const metricsByStudent = groupMetricsByStudent(analyserResult, classFull.classId, columnTaskKeys);

  const rows = classFull.students.map((student) =>
    buildCellsForStudent(
      student.id,
      student.name,
      metricsByStudent.get(student.id) ?? [],
      taskColumns
    )
  );

  return {
    classId: classFull.classId,
    className,
    sourceAssignments,
    taskColumns,
    rows,
  };
}

/** Resolved metadata for one selected assignment instance. */
type SelectedAssignmentMeta = {
  assignmentId: string;
  definitionKey: string;
  assignmentName: string;
  partial: AssignmentDefinitionPartial;
};

/**
 * Validate and resolve every selected assignment in selection order into its
 * merged-adapter metadata.
 *
 * @param {ClassFull} classFull - The full class data.
 * @param {ReadonlyArray<string>} selectedAssignmentIds - The selected assignment IDs.
 * @param {AssignmentDefinitionPartialsResponse} assignmentDefinitionPartials - The
 *   warm-up partials dataset.
 * @returns {SelectedAssignmentMeta[]} Resolved metadata per selected assignment,
 *   in `selectedAssignmentIds` order.
 * @throws {Error} If an ID is not present in `classFull.assignments`.
 * @throws {TaskTitlesUnavailableError} If a selected definition key has no partial.
 */
function resolveSelectedAssignmentMeta(
  classFull: ClassFull,
  selectedAssignmentIds: ReadonlyArray<string>,
  assignmentDefinitionPartials: AssignmentDefinitionPartialsResponse
): SelectedAssignmentMeta[] {
  const meta: SelectedAssignmentMeta[] = [];
  for (const assignmentId of selectedAssignmentIds) {
    const assignment = classFull.assignments.find((a) => a.assignmentId === assignmentId);
    if (!assignment) {
      throw new Error(
        `adaptMetricsToMergedHeatmap: assignmentId "${assignmentId}" not found in classFull.assignments`
      );
    }
    const definitionKey = assignment.assignmentDefinitionKey;
    const partial = getAssignmentDefinitionPartial(assignmentDefinitionPartials, definitionKey);
    if (!partial) {
      throw new TaskTitlesUnavailableError(definitionKey);
    }
    meta.push({
      assignmentId,
      definitionKey,
      assignmentName: partial.primaryTitle,
      partial,
    });
  }
  return meta;
}

/**
 * Build the merged task-column list from resolved metadata, following
 * `classFull.assignments` order (restricted to selected IDs) and de-duplicating
 * by composite `taskKey`; identity is taken from the FIRST classFull occurrence.
 *
 * @param {ClassFull} classFull - The full class data.
 * @param {SelectedAssignmentMeta[]} selectedMeta - Resolved selected-assignment
 *   metadata in selection order.
 * @returns {MergedHeatmapTaskColumn[]} Ordered, de-duplicated merged columns.
 */
function buildMergedTaskColumnsInClassOrder(
  classFull: ClassFull,
  selectedMeta: SelectedAssignmentMeta[]
): MergedHeatmapTaskColumn[] {
  const metaById = new Map(selectedMeta.map((m) => [m.assignmentId, m]));
  const selectedIdSet = new Set(selectedMeta.map((m) => m.assignmentId));
  const taskColumns: MergedHeatmapTaskColumn[] = [];
  const seenTaskKeys = new Set<string>();

  for (const assignment of classFull.assignments) {
    if (!selectedIdSet.has(assignment.assignmentId)) {
      continue;
    }
    const meta = metaById.get(assignment.assignmentId);
    if (!meta) {
      continue;
    }
    for (const column of buildMergedTaskColumns(
      meta.partial,
      meta.assignmentId,
      meta.assignmentName
    )) {
      if (seenTaskKeys.has(column.taskKey)) {
        continue;
      }
      seenTaskKeys.add(column.taskKey);
      taskColumns.push(column);
    }
  }
  return taskColumns;
}
