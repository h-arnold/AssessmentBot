/**
 * Pure adapter that translates `AveragingResult` + `ClassFull` into
 * the canonical `ClassPageAdapterResult` view-model shape.
 *
 * @remarks
 * This is a pure synchronous function with no I/O, no React imports,
 * and no Ant Design imports. The only side effect is throwing on data
 * integrity violations (null `updatedAt`, duplicate IDs, unparseable
 * `updatedAt`).
 *
 * @see SPEC_CLASS_PAGE.md §"classPageAdapter — pure adapter"
 */

import { computeOverallComposite } from '../../services/dataAnalysis/analysers/averagingAnalyser.accumulation';
import { rollupMetric } from '../../services/dataAnalysis/analysers/rollupMetric';
import { formatUpdatedAtLabel } from '../../utils/dateFormatting';
import type {
  AveragingResult,
  MetricResult,
  PerTaskRow,
} from '../../services/dataAnalysis/dataAnalysis.zod';
import type { ClassFull } from '../../services/googleClassrooms/classDetail/classDetailService.zod';
import type {
  ClassPageAdapterResult,
  RecentAssignmentCardModel,
  StudentAverageRowModel,
} from './classPageAdapter.zod';
import { compareAssignmentUpdatedAtDesc, compareStudentNames } from './classPageModel';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of recent assignment cards to return. */
const MAX_RECENT_ASSIGNMENTS = 3;

/** Default criterion weightings for the per-assignment average composite. */
const WEIGHTS = {
  completeness: 0.4,
  accuracy: 0.4,
  spag: 0.2,
};

// ---------------------------------------------------------------------------
// Trust validation helpers
// ---------------------------------------------------------------------------

/**
 * Validate that `updatedAt` is a non-null, parseable ISO string.
 *
 * @param {string | null} updatedAt - The raw updatedAt value (nullable).
 * @param {string} assignmentId - The assignment ID for error messages.
 * @throws {TypeError} If `updatedAt` is null — message references `assignmentId`.
 * @throws {TypeError} If `updatedAt` is not a valid ISO string — message
 *   references `assignmentId`.
 */
function validateUpdatedAt(
  updatedAt: string | null,
  assignmentId: string
): asserts updatedAt is string {
  if (updatedAt === null) {
    throw new TypeError(`Null updatedAt for assignment ${assignmentId}`);
  }
  if (Number.isNaN(new Date(updatedAt).getTime())) {
    throw new TypeError(`Unparseable updatedAt "${updatedAt}" for assignment ${assignmentId}`);
  }
}

/**
 * Find the first duplicate key in a list.
 *
 * @remarks Unifies duplicate-id detection for both students and assignments.
 * @typeParam T - The item type.
 * @param {readonly T[]} items - The items to scan for duplicates.
 * @param {(item: T) => string} keyFunction - Extracts a string key from each item.
 * @returns {string | null} The first duplicate key, or `null` if all are unique.
 */
function findFirstDuplicate<T>(
  items: readonly T[],
  keyFunction: (item: T) => string
): string | null {
  const seen = new Set<string>();
  for (const item of items) {
    const key = keyFunction(item);
    if (seen.has(key)) {
      return key;
    }
    seen.add(key);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Metric-result builders
// ---------------------------------------------------------------------------

/**
 * Build a `MetricResult` in the `notAttempted` state with zero weights.
 * Used for synthesised no-data rows and empty-per-task fallbacks.
 *
 * @returns {MetricResult} A `notAttempted` MetricResult with all weights set to zero.
 */
function noDataMetric(): MetricResult {
  return {
    state: 'notAttempted',
    value: 'N',
    totalWeight: 0,
    applicableDataPoints: 0,
    totalDataPoints: 0,
  };
}

// ---------------------------------------------------------------------------
// Average composite computation
// ---------------------------------------------------------------------------

/**
 * Compute the per-assignment `average` composite from the three rolled-up
 * criterion metrics.
 *
 * @remarks
 * Delegates to the shared {@link computeOverallComposite} helper from the
 * dataAnalysis averaging pipeline. Error criteria are **excluded** from the
 * weighted average rather than collapsing the result — the average is `error`
 * only when **all three** criteria are `error`. This matches the behaviour of
 * the analyser's per-student and per-task overall composite.
 *
 * The average is NOT computed by `rollupMetric` — it is a composite of the
 * three per-criterion values using the 40/40/20 weighting with SPaG
 * renormalisation.
 *
 * @param {MetricResult} completeness - The rolled-up completeness metric.
 * @param {MetricResult} accuracy - The rolled-up accuracy metric.
 * @param {MetricResult} spag - The rolled-up SPaG metric.
 * @returns {MetricResult} The per-assignment average MetricResult.
 */
function computeAverageMetric(
  completeness: MetricResult,
  accuracy: MetricResult,
  spag: MetricResult
): MetricResult {
  return computeOverallComposite(completeness, accuracy, spag, WEIGHTS);
}

// ---------------------------------------------------------------------------
// Recent assignments
// ---------------------------------------------------------------------------

/**
 * Build a single `RecentAssignmentCardModel` from an `AssignmentPartial`,
 * its matching per-task rows, and the validated `updatedAt` string.
 *
 * @param {ClassFull['assignments'][number]} assignment - The raw assignment partial.
 * @param {AveragingResult['perTask']} matchingPerTask - The per-task analysis rows matching this assignment.
 * @param {string} validatedUpdatedAt - The validated non-null parseable updatedAt string.
 * @returns {RecentAssignmentCardModel} A fully-populated recent assignment card model.
 */
function buildRecentAssignment(
  assignment: ClassFull['assignments'][number],
  matchingPerTask: PerTaskRow[] | undefined,
  validatedUpdatedAt: string
): RecentAssignmentCardModel {
  const rows = matchingPerTask ?? [];
  // Roll up per-task metrics into per-assignment values
  let rolledUpCompleteness: MetricResult;
  let rolledUpAccuracy: MetricResult;
  let rolledUpSpag: MetricResult;

  if (rows.length === 0) {
    // No per-task data — synthesise all-notAttempted
    rolledUpCompleteness = noDataMetric();
    rolledUpAccuracy = noDataMetric();
    rolledUpSpag = noDataMetric();
  } else {
    rolledUpCompleteness = rollupMetric(
      rows.map((r) => r.completeness),
      'completeness'
    );
    rolledUpAccuracy = rollupMetric(
      rows.map((r) => r.accuracy),
      'accuracy'
    );
    rolledUpSpag = rollupMetric(
      rows.map((r) => r.spag),
      'spag'
    );
  }

  // Compute the per-assignment average composite
  const average = computeAverageMetric(rolledUpCompleteness, rolledUpAccuracy, rolledUpSpag);

  // Format the date label (validatedUpdatedAt is guaranteed valid)
  const lastAssessedAtLabel = formatUpdatedAtLabel(validatedUpdatedAt);

  return {
    assignmentId: assignment.assignmentId,
    assignmentName: assignment.assignmentDefinition.primaryTitle,
    lastAssessedAt: validatedUpdatedAt,
    lastAssessedAtLabel,
    metrics: {
      completeness: rolledUpCompleteness,
      accuracy: rolledUpAccuracy,
      spag: rolledUpSpag,
      average,
    },
  };
}

// ---------------------------------------------------------------------------
// Student averages
// ---------------------------------------------------------------------------

/**
 * Build a synthesised no-data student row when the analyser has no data
 * for a given student.
 *
 * @param {string} studentId - The student's unique identifier.
 * @param {string} studentName - The student's display name.
 * @returns {StudentAverageRowModel} A student average row with all metrics in `notAttempted` state.
 */
function buildNoDataStudent(studentId: string, studentName: string): StudentAverageRowModel {
  const ndm = noDataMetric();
  return {
    studentId,
    studentName,
    metrics: {
      completeness: ndm,
      accuracy: ndm,
      spag: ndm,
      average: ndm,
    },
  };
}

/**
 * Build a lookup: definitionKey → per-task rows for O(1) access.
 *
 * @param {AveragingResult['perTask']} perTask - The per-task analysis rows.
 * @returns {Map<string, PerTaskRow[]>} A map from definitionKey to matching rows.
 */
function buildPerTaskLookup(perTask: AveragingResult['perTask']): Map<string, PerTaskRow[]> {
  const lookup = new Map<string, PerTaskRow[]>();
  for (const row of perTask) {
    const group = lookup.get(row.definitionKey);
    if (group) {
      group.push(row);
    } else {
      lookup.set(row.definitionKey, [row]);
    }
  }
  return lookup;
}

/**
 * Translate the data analysis service's `AveragingResult` plus the raw
 * `ClassFull` into the canonical `ClassPageAdapterResult` shape.
 *
 * @param {{ analyserResult: AveragingResult; classFull: ClassFull }} input - The combined input.
 * @param {AveragingResult} input.analyserResult - The analysis result from the averaging analyser.
 * @param {ClassFull} input.classFull - The raw class document from `getABClass`.
 * @returns {ClassPageAdapterResult} The canonical adapter result consumed by the Class page UI.
 * @throws {TypeError} On data integrity violations:
 *   - Duplicate `studentId` within `classFull.students`
 *   - Duplicate `assignmentId` within `classFull.assignments`
 *   - Null `updatedAt` on any assignment
 *   - Unparseable `updatedAt` on any assignment
 */
export function adaptClassPageToViewModel(input: {
  analyserResult: AveragingResult;
  classFull: ClassFull;
}): ClassPageAdapterResult {
  const { analyserResult, classFull } = input;

  // -----------------------------------------------------------------------
  // Trust validation
  // -----------------------------------------------------------------------

  const dupStudentId = findFirstDuplicate(classFull.students, (s) => s.id);
  if (dupStudentId !== null) {
    throw new TypeError(`Duplicate student id: ${dupStudentId}`);
  }

  const dupAssignmentId = findFirstDuplicate(classFull.assignments, (a) => a.assignmentId);
  if (dupAssignmentId !== null) {
    throw new TypeError(`Duplicate assignment id: ${dupAssignmentId}`);
  }

  // -----------------------------------------------------------------------
  // Recent assignments
  // -----------------------------------------------------------------------

  const perTaskLookup = buildPerTaskLookup(analyserResult.perTask);

  // Validate all assignments first (required for sorting — trust validation)
  const validatedAssignments: Array<{
    assignment: ClassFull['assignments'][number];
    validatedUpdatedAt: string;
  }> = classFull.assignments.map((assignment) => {
    const rawUpdatedAt: string | null = assignment.updatedAt;
    validateUpdatedAt(rawUpdatedAt, assignment.assignmentId);
    return { assignment, validatedUpdatedAt: rawUpdatedAt };
  });

  // Take the most recent 3 *before* rolling up (avoids ~(A-3)·T wasted rollups)
  const topAssignments = validatedAssignments
    .toSorted((a, b) =>
      compareAssignmentUpdatedAtDesc(
        { updatedAt: a.validatedUpdatedAt, assignmentId: a.assignment.assignmentId },
        { updatedAt: b.validatedUpdatedAt, assignmentId: b.assignment.assignmentId }
      )
    )
    .slice(0, MAX_RECENT_ASSIGNMENTS);

  const recentAssignments: RecentAssignmentCardModel[] = topAssignments.map(
    ({ assignment, validatedUpdatedAt }) =>
      buildRecentAssignment(
        assignment,
        perTaskLookup.get(assignment.assignmentDefinition.definitionKey),
        validatedUpdatedAt
      )
  );

  // -----------------------------------------------------------------------
  // Student averages — full roster
  // -----------------------------------------------------------------------

  // Build lookup: studentId → PerStudentRow
  const perStudentLookup = new Map<
    (typeof analyserResult.perStudent)[number]['studentId'],
    (typeof analyserResult.perStudent)[number]
  >();
  for (const row of analyserResult.perStudent) {
    perStudentLookup.set(row.studentId, row);
  }

  let studentAverages: StudentAverageRowModel[] = [];

  for (const student of classFull.students) {
    const analyserRow = perStudentLookup.get(student.id);

    if (analyserRow) {
      // Use analyser data; map `overall` to `average`
      studentAverages.push({
        studentId: student.id,
        studentName: student.name,
        metrics: {
          completeness: analyserRow.completeness,
          accuracy: analyserRow.accuracy,
          spag: analyserRow.spag,
          average: analyserRow.overall,
        },
      });
    } else {
      // Synthesise a no-data row
      studentAverages.push(buildNoDataStudent(student.id, student.name));
    }
  }

  // Sort by studentName ascending with studentId tie-breaker (shared comparator)
  studentAverages = studentAverages.toSorted(compareStudentNames);

  return {
    recentAssignments,
    studentAverages,
    classMetrics: {
      completeness: analyserResult.perClass.completeness,
      accuracy: analyserResult.perClass.accuracy,
      spag: analyserResult.perClass.spag,
      overall: analyserResult.perClass.overall,
    },
  };
}
