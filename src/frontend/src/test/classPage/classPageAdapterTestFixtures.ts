/**
 * Shared fixture builders for the `classPageAdapter` spec modules.
 *
 * @remarks
 * Extracted from the original single-file `classPageAdapter.spec.ts` so the
 * focused adapter spec modules can share identical fixture builders without
 * duplication. Placement follows `docs/developer/frontend/frontend-testing.md`
 * §"Shared test helpers" (shared test helpers live under `src/test/**`).
 *
 * @module test/classPage/classPageAdapterTestFixtures
 */

import { createDefinitionPartial, createMetricResult } from '../dataAnalysis/fixtures';
import type { MetricResult } from '../../services/dataAnalysis/dataAnalysis.zod';
import type {
  AveragingResult,
  PerTaskRow,
  PerStudentRow,
  PerClassResult,
} from '../../services/dataAnalysis/dataAnalysis.zod';
import type {
  ClassFull,
  AssignmentPartial,
  StudentSummary,
} from '../../services/googleClassrooms/classDetail/classDetailService.zod';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default ISO timestamp used as `createdAt` / `updatedAt` in fixtures. */
export const DEFAULT_TS = '2026-01-01T00:00:00.000Z';

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

/**
 * Build a minimal StudentSummary fixture.
 * @param {string} id - The student identifier.
 * @param {string} name - The student display name.
 * @returns {StudentSummary} A fully typed StudentSummary.
 */
export function student(id: string, name: string): StudentSummary {
  return { id, name, email: `${id}@test.com` };
}

/**
 * Build a minimal AssignmentPartial fixture for adapter tests.
 * @param {{ assignmentId: string; updatedAt: string | null; definitionKey: string; taskIds: string[] }} overrides - The required fields for the assignment fixture.
 * @param {string} overrides.assignmentId - The assignment identifier.
 * @param {string | null} overrides.updatedAt - The ISO timestamp or null for the last update.
 * @param {string} overrides.definitionKey - The definition key linking to per-task rows.
 * @param {string[]} overrides.taskIds - The task identifiers belonging to this assignment.
 * @returns {AssignmentPartial} A fully typed AssignmentPartial.
 */
export function assignment(overrides: {
  assignmentId: string;
  updatedAt: string | null;
  definitionKey: string;
  taskIds: string[];
}): AssignmentPartial {
  return {
    courseId: 'course_001',
    assignmentId: overrides.assignmentId,
    assignmentName: `Assignment ${overrides.assignmentId}`,
    dueDate: null,
    updatedAt: overrides.updatedAt,
    createdAt: DEFAULT_TS,
    documentType: 'assessment',
    submissions: [],
    assignmentDefinitionKey: overrides.definitionKey,
  } as unknown as AssignmentPartial;
}

/**
 * Build a PerTaskRow fixture whose three criteria are all `computed` with
 * `totalWeight: 1`, given their numeric values.
 *
 * @remarks Covers the most common adapter-test shape (all criteria computed
 * with unit weight); use {@link perTaskRow} directly for mixed-state rows.
 *
 * @param {string} definitionKey - The definition key linking to an assignment.
 * @param {string} taskId - The task identifier.
 * @param {Object} values - The computed criterion values.
 * @param {number} values.completeness - The completeness score.
 * @param {number} values.accuracy - The accuracy score.
 * @param {number} values.spag - The spelling, punctuation and grammar score.
 * @returns {PerTaskRow} A fully typed PerTaskRow with unit-weight computed criteria.
 */
export function computedPerTaskRow(
  definitionKey: string,
  taskId: string,
  values: { completeness: number; accuracy: number; spag: number }
): PerTaskRow {
  const { completeness, accuracy, spag } = values;
  return perTaskRow({
    definitionKey,
    taskId,
    completeness: createMetricResult('computed', { value: completeness, totalWeight: 1 }),
    accuracy: createMetricResult('computed', { value: accuracy, totalWeight: 1 }),
    spag: createMetricResult('computed', { value: spag, totalWeight: 1 }),
  });
}

/**
 * Build the single-assignment `dk1` input shared by metric rollup tests.
 *
 * @param {PerTaskRow[]} perTaskRows - Fresh rows supplied by the test, including empty data.
 * @param {string[]} taskIds - Task identifiers for assignment `a-1`.
 * @returns {Object} Fresh adapter input with Alice's roster and the matching definition.
 */
export function singleAssignmentAdapterInput(
  perTaskRows: PerTaskRow[],
  taskIds: string[]
): {
  analyserResult: AveragingResult;
  classFull: ClassFull;
  assignmentDefinitionPartials: ReturnType<typeof createDefinitionPartial>[];
} {
  return {
    analyserResult: averagingResult({ perTask: perTaskRows }),
    classFull: classFull({
      students: [student('s-1', 'Alice')],
      assignments: [
        assignment({ assignmentId: 'a-1', updatedAt: DEFAULT_TS, definitionKey: 'dk1', taskIds }),
      ],
    }),
    assignmentDefinitionPartials: [createDefinitionPartial({ definitionKey: 'dk1' })],
  };
}

/**
 * Build a minimal PerTaskRow fixture.
 * @param {{ definitionKey: string; taskId: string; completeness: MetricResult; accuracy: MetricResult; spag: MetricResult }} overrides - The required fields for the per-task row fixture.
 * @param {string} overrides.definitionKey - The definition key linking to an assignment.
 * @param {string} overrides.taskId - The task identifier.
 * @param {MetricResult} overrides.completeness - The completeness MetricResult.
 * @param {MetricResult} overrides.accuracy - The accuracy MetricResult.
 * @param {MetricResult} overrides.spag - The spelling, punctuation and grammar MetricResult.
 * @returns {PerTaskRow} A fully typed PerTaskRow.
 */
export function perTaskRow(overrides: {
  definitionKey: string;
  taskId: string;
  completeness: MetricResult;
  accuracy: MetricResult;
  spag: MetricResult;
}): PerTaskRow {
  // The overall is computed the same way as the adapter's average
  // For test simplicity we set it to a sensible default
  return {
    definitionKey: overrides.definitionKey,
    taskId: overrides.taskId,
    taskTitle: null,
    completeness: overrides.completeness,
    accuracy: overrides.accuracy,
    spag: overrides.spag,
    overall: createMetricResult('computed', { value: 0 }), // placeholder; not used by adapter
  } as PerTaskRow;
}

/**
 * Build a minimal PerStudentRow fixture.
 * @param {{ studentId: string; studentName: string | null; completeness: MetricResult; accuracy: MetricResult; spag: MetricResult; overall: MetricResult }} overrides - The required fields for the per-student row fixture.
 * @param {string} overrides.studentId - The student identifier.
 * @param {string | null} overrides.studentName - The student display name or null.
 * @param {MetricResult} overrides.completeness - The completeness MetricResult.
 * @param {MetricResult} overrides.accuracy - The accuracy MetricResult.
 * @param {MetricResult} overrides.spag - The spelling, punctuation and grammar MetricResult.
 * @param {MetricResult} overrides.overall - The overall MetricResult.
 * @returns {PerStudentRow} A fully typed PerStudentRow.
 */
export function perStudentRow(overrides: {
  studentId: string;
  studentName: string | null;
  completeness: MetricResult;
  accuracy: MetricResult;
  spag: MetricResult;
  overall: MetricResult;
}): PerStudentRow {
  return {
    studentId: overrides.studentId,
    studentName: overrides.studentName,
    completeness: overrides.completeness,
    accuracy: overrides.accuracy,
    spag: overrides.spag,
    overall: overrides.overall,
  } as PerStudentRow;
}

/**
 * Build a minimal PerClassResult fixture.
 * @param {Partial<PerClassResult>} [overrides] - Optional partial overrides for the PerClassResult fields.
 * @returns {PerClassResult} A fully typed PerClassResult.
 */
export function perClassResult(overrides?: Partial<PerClassResult>): PerClassResult {
  return {
    completeness: createMetricResult('computed', { value: 4 }),
    accuracy: createMetricResult('computed', { value: 3.5 }),
    spag: createMetricResult('computed', { value: 2 }),
    overall: createMetricResult('computed', { value: 3.4 }),
    ...overrides,
  } as PerClassResult;
}

/**
 * Build a minimal AveragingResult fixture.
 * @param {{ classId?: string; className?: string | null; perStudent?: PerStudentRow[]; perTask?: PerTaskRow[]; perClass?: PerClassResult }} [overrides] - Optional overrides for the AveragingResult fields.
 * @param {string} [overrides.classId] - The class identifier (defaults to 'c-1').
 * @param {string | null} [overrides.className] - The class display name or null (defaults to 'Test Class').
 * @param {PerStudentRow[]} [overrides.perStudent] - The per-student rows (defaults to empty array).
 * @param {PerTaskRow[]} [overrides.perTask] - The per-task rows (defaults to empty array).
 * @param {PerClassResult} [overrides.perClass] - The per-class results (defaults to perClassResult()).
 * @returns {AveragingResult} A fully typed AveragingResult.
 */
export function averagingResult(
  overrides: {
    classId?: string;
    className?: string | null;
    perStudent?: PerStudentRow[];
    perTask?: PerTaskRow[];
    perClass?: PerClassResult;
  } = {}
): AveragingResult {
  return {
    classId: overrides.classId ?? 'c-1',
    className: overrides.className ?? 'Test Class',
    perStudent: overrides.perStudent ?? [],
    perTask: overrides.perTask ?? [],
    perClass: overrides.perClass ?? perClassResult(),
    appliedCriterionWeightings: { completeness: 0.4, accuracy: 0.4, spag: 0.2 },
  } as AveragingResult;
}

/**
 * Build a minimal ClassFull fixture.
 * @param {{ classId?: string; className?: string | null; students?: StudentSummary[]; assignments?: AssignmentPartial[] }} [overrides] - Optional overrides for the ClassFull fields.
 * @param {string} [overrides.classId] - The class identifier (defaults to 'c-1').
 * @param {string | null} [overrides.className] - The class display name or null (defaults to 'Test Class').
 * @param {StudentSummary[]} [overrides.students] - The student summaries (defaults to empty array).
 * @param {AssignmentPartial[]} [overrides.assignments] - The assignment partials (defaults to empty array).
 * @returns {ClassFull} A fully typed ClassFull.
 */
export function classFull(
  overrides: {
    classId?: string;
    className?: string | null;
    students?: StudentSummary[];
    assignments?: AssignmentPartial[];
  } = {}
): ClassFull {
  return {
    classId: overrides.classId ?? 'c-1',
    className: overrides.className ?? 'Test Class',
    cohortKey: null,
    courseLength: 1,
    yearGroupKey: 'yg-10',
    classOwner: null,
    teachers: [],
    students: overrides.students ?? [],
    assignments: overrides.assignments ?? [],
    active: null,
  } as ClassFull;
}
