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

import { rollupMetric } from '../../services/dataAnalysis/analysers/rollupMetric';
import { formatUpdatedAtLabel } from '../../utils/dateFormatting';
import type { AveragingResult, MetricResult } from '../../services/dataAnalysis/dataAnalysis.zod';
import type { ClassFull } from '../../services/googleClassrooms/classDetail/classDetailService.zod';
import type {
  ClassPageAdapterResult,
  RecentAssignmentCardModel,
  StudentAverageRowModel,
} from './classPageAdapter.zod';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of recent assignment cards to return. */
const MAX_RECENT_ASSIGNMENTS = 3;

/** Default criterion weightings for the per-assignment average composite. */
const WEIGHTS: Record<string, number> = {
  completeness: 0.4,
  accuracy: 0.4,
  spag: 0.2,
};

// ---------------------------------------------------------------------------
// State detection helpers
// ---------------------------------------------------------------------------

/**
 * Check whether any of the three criterion metrics is in the `error` state.
 *
 * @param {MetricResult} completeness - The completeness metric.
 * @param {MetricResult} accuracy - The accuracy metric.
 * @param {MetricResult} spag - The SPaG metric.
 * @returns {boolean} `true` if any metric has state `'error'`.
 */
function isAnyError(
  completeness: MetricResult,
  accuracy: MetricResult,
  spag: MetricResult
): boolean {
  return completeness.state === 'error' || accuracy.state === 'error' || spag.state === 'error';
}

/**
 * Check whether any of the three criterion metrics is in the `computed` state.
 *
 * @param {MetricResult} completeness - The completeness metric.
 * @param {MetricResult} accuracy - The accuracy metric.
 * @param {MetricResult} spag - The SPaG metric.
 * @returns {boolean} `true` if any metric has state `'computed'`.
 */
function isAnyComputed(
  completeness: MetricResult,
  accuracy: MetricResult,
  spag: MetricResult
): boolean {
  return (
    completeness.state === 'computed' || accuracy.state === 'computed' || spag.state === 'computed'
  );
}

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
 * Detect the first duplicate student ID in the roster.
 *
 * @param {ClassFull['students']} students - The class student list.
 * @returns {string | null} The duplicate student ID, or `null` if all IDs are unique.
 */
function findDuplicateStudentId(students: ClassFull['students']): string | null {
  const seen = new Set<string>();
  for (const s of students) {
    if (seen.has(s.id)) {
      return s.id;
    }
    seen.add(s.id);
  }
  return null;
}

/**
 * Detect the first duplicate assignment ID in the assignments list.
 *
 * @param {ClassFull['assignments']} assignments - The class assignment list.
 * @returns {string | null} The duplicate assignment ID, or `null` if all IDs are unique.
 */
function findDuplicateAssignmentId(assignments: ClassFull['assignments']): string | null {
  const seen = new Set<string>();
  for (const a of assignments) {
    if (seen.has(a.assignmentId)) {
      return a.assignmentId;
    }
    seen.add(a.assignmentId);
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

/**
 * Build a `MetricResult` in the `error` state summing totalWeight and
 * totalDataPoints from all three criterion metrics.
 *
 * @param {MetricResult} completeness - The completeness metric.
 * @param {MetricResult} accuracy - The accuracy metric.
 * @param {MetricResult} spag - The SPaG metric.
 * @returns {MetricResult} An `error` MetricResult with aggregated weight fields.
 */
function buildErrorMetric(
  completeness: MetricResult,
  accuracy: MetricResult,
  spag: MetricResult
): MetricResult {
  return {
    state: 'error',
    value: 'E',
    totalWeight: completeness.totalWeight + accuracy.totalWeight + spag.totalWeight,
    applicableDataPoints: 0,
    totalDataPoints: completeness.totalDataPoints + accuracy.totalDataPoints + spag.totalDataPoints,
  };
}

/**
 * Build a `MetricResult` in the `notAttempted` state summing totalWeight
 * and totalDataPoints from all three criterion metrics.
 *
 * @param {MetricResult} completeness - The completeness metric.
 * @param {MetricResult} accuracy - The accuracy metric.
 * @param {MetricResult} spag - The SPaG metric.
 * @returns {MetricResult} A `notAttempted` MetricResult with aggregated weight fields.
 */
function buildNotAttemptedMetric(
  completeness: MetricResult,
  accuracy: MetricResult,
  spag: MetricResult
): MetricResult {
  return {
    state: 'notAttempted',
    value: 'N',
    totalWeight: completeness.totalWeight + accuracy.totalWeight + spag.totalWeight,
    applicableDataPoints: 0,
    totalDataPoints: completeness.totalDataPoints + accuracy.totalDataPoints + spag.totalDataPoints,
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
 * The average is NOT computed by `rollupMetric` — it is a composite of the
 * three per-criterion values using the 40/40/20 weighting with SPaG
 * renormalisation.
 *
 * Rule:
 * 1. If any criterion is `error` → average is `error` (error escalation).
 * 2. If all three are `notAttempted` and none is `computed` → average is
 *    `notAttempted`.
 * 3. Otherwise, weighted average over `computed` criteria:
 *    - Default weighting: 0.4 completeness + 0.4 accuracy + 0.2 spag.
 *    - When SPaG is `notAttempted`: renormalise completeness + accuracy
 *      over 0.8 (i.e. 0.5 each).
 *    - `notAttempted` criteria are excluded from the weighted average.
 *    - The result carries the sum of `totalWeight`, `applicableDataPoints`,
 *      and `totalDataPoints` from all computed criteria.
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
  // 1. Error escalation
  if (isAnyError(completeness, accuracy, spag)) {
    return buildErrorMetric(completeness, accuracy, spag);
  }

  // 2. All notAttempted and none computed
  if (!isAnyComputed(completeness, accuracy, spag)) {
    return buildNotAttemptedMetric(completeness, accuracy, spag);
  }

  // 3. Weighted average over computed criteria
  // Collect all criteria; filter keeps only computed entries.
  const allCriteria = [
    { metric: completeness, weight: WEIGHTS.completeness },
    { metric: accuracy, weight: WEIGHTS.accuracy },
    { metric: spag, weight: WEIGHTS.spag },
  ];

  const computedCriteria = allCriteria.filter(
    (c): c is { metric: Extract<MetricResult, { state: 'computed' }>; weight: number } =>
      c.metric.state === 'computed'
  );

  // Renormalise weights so they sum to 1.0
  const rawTotalWeight = computedCriteria.reduce((sum, c) => sum + c.weight, 0);

  let weightedValue = 0;
  let sumTotalWeight = 0;
  let sumApplicableDataPoints = 0;
  let sumTotalDataPoints = 0;

  for (const { metric, weight } of computedCriteria) {
    weightedValue += metric.value * (weight / rawTotalWeight);
    sumTotalWeight += metric.totalWeight;
    sumApplicableDataPoints += metric.applicableDataPoints;
    sumTotalDataPoints += metric.totalDataPoints;
  }

  return {
    state: 'computed',
    value: weightedValue,
    totalWeight: sumTotalWeight,
    applicableDataPoints: sumApplicableDataPoints,
    totalDataPoints: sumTotalDataPoints,
  };
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
  matchingPerTask: AveragingResult['perTask'],
  validatedUpdatedAt: string
): RecentAssignmentCardModel {
  // Roll up per-task metrics into per-assignment values
  let rolledUpCompleteness: MetricResult;
  let rolledUpAccuracy: MetricResult;
  let rolledUpSpag: MetricResult;

  if (matchingPerTask.length === 0) {
    // No per-task data — synthesise all-notAttempted
    rolledUpCompleteness = noDataMetric();
    rolledUpAccuracy = noDataMetric();
    rolledUpSpag = noDataMetric();
  } else {
    rolledUpCompleteness = rollupMetric(
      matchingPerTask.map((r) => r.completeness),
      'completeness'
    );
    rolledUpAccuracy = rollupMetric(
      matchingPerTask.map((r) => r.accuracy),
      'accuracy'
    );
    rolledUpSpag = rollupMetric(
      matchingPerTask.map((r) => r.spag),
      'spag'
    );
  }

  // Compute the per-assignment average composite
  const average = computeAverageMetric(rolledUpCompleteness, rolledUpAccuracy, rolledUpSpag);

  // Format the date label (validatedUpdatedAt is guaranteed valid)
  const lastAssessedAtLabel = formatUpdatedAtLabel(validatedUpdatedAt);

  return {
    assignmentId: assignment.assignmentId,
    assignmentName: assignment.assignmentName,
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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

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

  const dupStudentId = findDuplicateStudentId(classFull.students);
  if (dupStudentId !== null) {
    throw new TypeError(`Duplicate student id: ${dupStudentId}`);
  }

  const dupAssignmentId = findDuplicateAssignmentId(classFull.assignments);
  if (dupAssignmentId !== null) {
    throw new TypeError(`Duplicate assignment id: ${dupAssignmentId}`);
  }

  // -----------------------------------------------------------------------
  // Recent assignments
  // -----------------------------------------------------------------------

  const recentAssignments: RecentAssignmentCardModel[] = [];

  for (const assignment of classFull.assignments) {
    // Null/unparseable updatedAt throws — extract to local for type narrowing
    const rawUpdatedAt: string | null = assignment.updatedAt;
    validateUpdatedAt(rawUpdatedAt, assignment.assignmentId);

    // Find matching per-task rows by definitionKey
    const matchingPerTask = analyserResult.perTask.filter(
      (row) => row.definitionKey === assignment.assignmentDefinition.definitionKey
    );

    recentAssignments.push(buildRecentAssignment(assignment, matchingPerTask, rawUpdatedAt));
  }

  // Sort by updatedAt descending and take top 3
  recentAssignments.sort(
    (a, b) => new Date(b.lastAssessedAt).getTime() - new Date(a.lastAssessedAt).getTime()
  );
  const topRecentAssignments = recentAssignments.slice(0, MAX_RECENT_ASSIGNMENTS);

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

  const studentAverages: StudentAverageRowModel[] = [];

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

  // Sort by studentName ascending (locale-aware, case-insensitive),
  // with studentId as the deterministic tie-breaker
  studentAverages.sort((a, b) => {
    const nameCmp = a.studentName.localeCompare(b.studentName, undefined, {
      sensitivity: 'base',
    });
    if (nameCmp !== 0) return nameCmp;
    return a.studentId.localeCompare(b.studentId);
  });

  // -----------------------------------------------------------------------
  // Class metrics passthrough
  // -----------------------------------------------------------------------

  return {
    recentAssignments: topRecentAssignments,
    studentAverages,
    classMetrics: {
      completeness: analyserResult.perClass.completeness,
      accuracy: analyserResult.perClass.accuracy,
      spag: analyserResult.perClass.spag,
      overall: analyserResult.perClass.overall,
    },
  };
}
