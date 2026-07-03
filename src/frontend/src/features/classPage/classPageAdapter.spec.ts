/**
 * Tests for the Class page adapter (`classPageAdapter.ts`).
 *
 * @remarks
 * The adapter is a pure synchronous function that translates
 * `AveragingResult` + `ClassFull` into the canonical
 * `ClassPageAdapterResult` shape.  These tests define the full
 * behavioural contract; they will fail to import until the
 * implementation exists (red-phase).
 *
 * @see SPEC_CLASS_PAGE.md - "classPageAdapter - pure adapter"
 * @see SPEC_CLASS_PAGE_PREPARATION.md - "rollupMetric helper contract"
 */

import { describe, expect, it } from 'vitest';
import { adaptClassPageToViewModel } from './classPageAdapter';
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
// Fixture helpers
// ---------------------------------------------------------------------------

/** Default ISO timestamp used as `createdAt` / `updatedAt` in fixtures. */
const DEFAULT_TS = '2026-01-01T00:00:00.000Z';

/**
 * Build a `MetricResult` fixture of the requested state.
 * @param {'computed' | 'notAttempted' | 'error'} state - The MetricResult state.
 * @param {Partial<{ value: number; totalWeight: number; applicableDataPoints: number; totalDataPoints: number }>} [overrides] - Optional partial overrides.
 * @returns {MetricResult} A fully typed MetricResult.
 */
function metric(
  state: 'computed',
  overrides?: Partial<{
    value: number;
    totalWeight: number;
    applicableDataPoints: number;
    totalDataPoints: number;
  }>
): MetricResult;
function metric(
  state: 'notAttempted',
  overrides?: Partial<{ totalWeight: number; totalDataPoints: number }>
): MetricResult;
function metric(
  state: 'error',
  overrides?: Partial<{ totalWeight: number; totalDataPoints: number }>
): MetricResult;
function metric(
  state: 'computed' | 'notAttempted' | 'error',
  overrides?: Record<string, unknown>
): MetricResult {
  switch (state) {
    case 'computed': {
      return {
        state: 'computed',
        value: 5,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
        ...overrides,
      } as MetricResult;
    }
    case 'notAttempted': {
      return {
        state: 'notAttempted',
        value: 'N',
        totalWeight: 0,
        applicableDataPoints: 0,
        totalDataPoints: 1,
        ...overrides,
      } as MetricResult;
    }
    case 'error': {
      return {
        state: 'error',
        value: 'E',
        totalWeight: 0,
        applicableDataPoints: 0,
        totalDataPoints: 1,
        ...overrides,
      } as MetricResult;
    }
  }
}

/**
 * Build a minimal StudentSummary fixture.
 * @param {string} id - The student identifier.
 * @param {string} name - The student display name.
 * @returns {StudentSummary} A fully typed StudentSummary.
 */
function student(id: string, name: string): StudentSummary {
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
function assignment(overrides: {
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
    assignmentDefinition: {
      primaryTitle: 'Test',
      primaryTopic: 'Algebra',
      primaryTopicKey: 'algebra',
      yearGroupKey: 'yg-10',
      yearGroupLabel: 'Year 10',
      alternateTitles: [],
      alternateTopics: [],
      documentType: 'assignment',
      referenceDocumentId: null,
      templateDocumentId: null,
      assignmentWeighting: 1,
      definitionKey: overrides.definitionKey,
      tasks: overrides.taskIds.map((tid) => ({ id: tid, taskWeighting: 1 })),
      createdAt: DEFAULT_TS,
      updatedAt: DEFAULT_TS,
    },
  } as unknown as AssignmentPartial;
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
function perTaskRow(overrides: {
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
    overall: metric('computed', { value: 0 }), // placeholder; not used by adapter
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
function perStudentRow(overrides: {
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
function perClassResult(overrides?: Partial<PerClassResult>): PerClassResult {
  return {
    completeness: metric('computed', { value: 4 }),
    accuracy: metric('computed', { value: 3.5 }),
    spag: metric('computed', { value: 2 }),
    overall: metric('computed', { value: 3.4 }),
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
function averagingResult(
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
function classFull(
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

// ===========================================================================
// Tests
// ===========================================================================

describe('adaptClassPageToViewModel', () => {
  // -----------------------------------------------------------------------
  // recentAssignments — empty case
  // -----------------------------------------------------------------------
  describe('recentAssignments', () => {
    it('returns empty array when the class has no assignments', () => {
      const result = adaptClassPageToViewModel({
        analyserResult: averagingResult(),
        classFull: classFull({
          students: [student('s-1', 'Alice')],
          assignments: [],
        }),
      });

      expect(result.recentAssignments).toEqual([]);
    });

    // -----------------------------------------------------------------------
    // recentAssignments — top 3 sorted by updatedAt desc
    // -----------------------------------------------------------------------
    it('returns up to 3 assignments sorted by updatedAt descending', () => {
      const perTaskRowsA: PerTaskRow[] = [
        perTaskRow({
          definitionKey: 'dk-a',
          taskId: 't1',
          completeness: metric('computed', { value: 4 }),
          accuracy: metric('computed', { value: 3 }),
          spag: metric('computed', { value: 2 }),
        }),
      ];
      const perTaskRowsB: PerTaskRow[] = [
        perTaskRow({
          definitionKey: 'dk-b',
          taskId: 't1',
          completeness: metric('computed', { value: 5 }),
          accuracy: metric('computed', { value: 4 }),
          spag: metric('computed', { value: 3 }),
        }),
      ];
      const perTaskRowsC: PerTaskRow[] = [
        perTaskRow({
          definitionKey: 'dk-c',
          taskId: 't1',
          completeness: metric('computed', { value: 3 }),
          accuracy: metric('computed', { value: 2 }),
          spag: metric('computed', { value: 1 }),
        }),
      ];
      const perTaskRowsD: PerTaskRow[] = [
        perTaskRow({
          definitionKey: 'dk-d',
          taskId: 't1',
          completeness: metric('computed', { value: 2 }),
          accuracy: metric('computed', { value: 2 }),
          spag: metric('computed', { value: 2 }),
        }),
      ];

      const result = adaptClassPageToViewModel({
        analyserResult: averagingResult({
          perTask: [...perTaskRowsA, ...perTaskRowsB, ...perTaskRowsC, ...perTaskRowsD],
        }),
        classFull: classFull({
          students: [student('s-1', 'Alice')],
          assignments: [
            assignment({
              assignmentId: 'a-D',
              updatedAt: '2026-04-01T00:00:00.000Z',
              definitionKey: 'dk-d',
              taskIds: ['t1'],
            }),
            assignment({
              assignmentId: 'a-C',
              updatedAt: '2026-03-01T00:00:00.000Z',
              definitionKey: 'dk-c',
              taskIds: ['t1'],
            }),
            assignment({
              assignmentId: 'a-B',
              updatedAt: '2026-05-01T00:00:00.000Z',
              definitionKey: 'dk-b',
              taskIds: ['t1'],
            }),
            assignment({
              assignmentId: 'a-A',
              updatedAt: '2026-06-01T00:00:00.000Z',
              definitionKey: 'dk-a',
              taskIds: ['t1'],
            }),
          ],
        }),
      });

      const expectedTopCount = 3;
      expect(result.recentAssignments).toHaveLength(expectedTopCount);
      // Most recent 3 by updatedAt: a-A (June), a-B (May), a-D (April)
      expect(result.recentAssignments[0].assignmentId).toBe('a-A');
      expect(result.recentAssignments[1].assignmentId).toBe('a-B');
      expect(result.recentAssignments[2].assignmentId).toBe('a-D');
    });

    // -----------------------------------------------------------------------
    // recentAssignments — rollup via rollupMetric
    // -----------------------------------------------------------------------
    it('rolls up per-task metrics into per-assignment values using rollupMetric', () => {
      // One assignment with 2 tasks.  PerTask rows for definitionKey 'dk1':
      //   Task t1: completeness=4, accuracy=3, spag=2
      //   Task t2: completeness=5, accuracy=4, spag=3
      const perTaskRows: PerTaskRow[] = [
        perTaskRow({
          definitionKey: 'dk1',
          taskId: 't1',
          completeness: metric('computed', { value: 4, totalWeight: 1 }),
          accuracy: metric('computed', { value: 3, totalWeight: 1 }),
          spag: metric('computed', { value: 2, totalWeight: 1 }),
        }),
        perTaskRow({
          definitionKey: 'dk1',
          taskId: 't2',
          completeness: metric('computed', { value: 5, totalWeight: 1 }),
          accuracy: metric('computed', { value: 4, totalWeight: 1 }),
          spag: metric('computed', { value: 3, totalWeight: 1 }),
        }),
      ];

      const result = adaptClassPageToViewModel({
        analyserResult: averagingResult({
          perTask: perTaskRows,
        }),
        classFull: classFull({
          students: [student('s-1', 'Alice')],
          assignments: [
            assignment({
              assignmentId: 'a-1',
              updatedAt: DEFAULT_TS,
              definitionKey: 'dk1',
              taskIds: ['t1', 't2'],
            }),
          ],
        }),
      });

      expect(result.recentAssignments).toHaveLength(1);
      const assignmentMetrics = result.recentAssignments[0].metrics;

      const expectedCompletenessAverage = 4.5;
      const expectedAccuracyAverage = 3.5;
      const expectedSpagAverage = 2.5;

      // completeness: rollupMetric([computed(4,tw=1), computed(5,tw=1)], 'completeness')
      //   totalWeightedSum = 4*1 + 5*1 = 9
      //   computedTotalWeight = 2
      //   value = 9/2 = 4.5
      expect(assignmentMetrics.completeness.state).toBe('computed');
      if (assignmentMetrics.completeness.state === 'computed') {
        expect(assignmentMetrics.completeness.value).toBeCloseTo(expectedCompletenessAverage);
      }

      // accuracy: rollupMetric([computed(3,tw=1), computed(4,tw=1)], 'accuracy')
      //   totalWeightedSum = 3*1 + 4*1 = 7
      //   value = 7/2 = 3.5
      expect(assignmentMetrics.accuracy.state).toBe('computed');
      if (assignmentMetrics.accuracy.state === 'computed') {
        expect(assignmentMetrics.accuracy.value).toBeCloseTo(expectedAccuracyAverage);
      }

      // spag: rollupMetric([computed(2,tw=1), computed(3,tw=1)], 'spag')
      //   totalWeightedSum = 2*1 + 3*1 = 5
      //   value = 5/2 = 2.5
      expect(assignmentMetrics.spag.state).toBe('computed');
      if (assignmentMetrics.spag.state === 'computed') {
        expect(assignmentMetrics.spag.value).toBeCloseTo(expectedSpagAverage);
      }
    });

    // -----------------------------------------------------------------------
    // per-assignment average — 40/40/20 composite
    // -----------------------------------------------------------------------
    it('computes per-assignment average as a composite with 40/40/20 weighting', () => {
      const perTaskRows: PerTaskRow[] = [
        perTaskRow({
          definitionKey: 'dk1',
          taskId: 't1',
          completeness: metric('computed', { value: 5, totalWeight: 1 }),
          accuracy: metric('computed', { value: 3, totalWeight: 1 }),
          spag: metric('computed', { value: 2, totalWeight: 1 }),
        }),
      ];

      const result = adaptClassPageToViewModel({
        analyserResult: averagingResult({
          perTask: perTaskRows,
        }),
        classFull: classFull({
          students: [student('s-1', 'Alice')],
          assignments: [
            assignment({
              assignmentId: 'a-1',
              updatedAt: DEFAULT_TS,
              definitionKey: 'dk1',
              taskIds: ['t1'],
            }),
          ],
        }),
      });

      const average = result.recentAssignments[0].metrics.average;
      // Expected: 0.4 * 5 + 0.4 * 3 + 0.2 * 2 = 2.0 + 1.2 + 0.4 = 3.6
      const expectedAverageValue = 3.6;
      expect(average.state).toBe('computed');
      if (average.state === 'computed') {
        expect(average.value).toBeCloseTo(expectedAverageValue);
      }
    });

    // -----------------------------------------------------------------------
    // per-assignment average — error escalation
    // -----------------------------------------------------------------------
    it('sets per-assignment average to error when any criterion is error', () => {
      const perTaskRows: PerTaskRow[] = [
        perTaskRow({
          definitionKey: 'dk1',
          taskId: 't1',
          completeness: metric('computed', { value: 5 }),
          accuracy: metric('error'),
          spag: metric('computed', { value: 3 }),
        }),
      ];

      const result = adaptClassPageToViewModel({
        analyserResult: averagingResult({
          perTask: perTaskRows,
        }),
        classFull: classFull({
          students: [student('s-1', 'Alice')],
          assignments: [
            assignment({
              assignmentId: 'a-1',
              updatedAt: DEFAULT_TS,
              definitionKey: 'dk1',
              taskIds: ['t1'],
            }),
          ],
        }),
      });

      expect(result.recentAssignments[0].metrics.average.state).toBe('error');
    });

    // -----------------------------------------------------------------------
    // per-assignment average — all notAttempted
    // -----------------------------------------------------------------------
    it('sets per-assignment average to notAttempted when all three criteria are notAttempted and none is computed', () => {
      const perTaskRows: PerTaskRow[] = [
        perTaskRow({
          definitionKey: 'dk1',
          taskId: 't1',
          completeness: metric('notAttempted'),
          accuracy: metric('notAttempted'),
          spag: metric('notAttempted'),
        }),
      ];

      const result = adaptClassPageToViewModel({
        analyserResult: averagingResult({
          perTask: perTaskRows,
        }),
        classFull: classFull({
          students: [student('s-1', 'Alice')],
          assignments: [
            assignment({
              assignmentId: 'a-1',
              updatedAt: DEFAULT_TS,
              definitionKey: 'dk1',
              taskIds: ['t1'],
            }),
          ],
        }),
      });

      expect(result.recentAssignments[0].metrics.average.state).toBe('notAttempted');
    });

    // -----------------------------------------------------------------------
    // per-assignment average — SPaG-renormalisation
    // -----------------------------------------------------------------------
    it('renormalises the composite when SPaG is notAttempted (completeness + accuracy over 0.8)', () => {
      const perTaskRows: PerTaskRow[] = [
        perTaskRow({
          definitionKey: 'dk1',
          taskId: 't1',
          completeness: metric('computed', { value: 4, totalWeight: 1 }),
          accuracy: metric('computed', { value: 4, totalWeight: 1 }),
          spag: metric('notAttempted'),
        }),
      ];

      const result = adaptClassPageToViewModel({
        analyserResult: averagingResult({
          perTask: perTaskRows,
        }),
        classFull: classFull({
          students: [student('s-1', 'Alice')],
          assignments: [
            assignment({
              assignmentId: 'a-1',
              updatedAt: DEFAULT_TS,
              definitionKey: 'dk1',
              taskIds: ['t1'],
            }),
          ],
        }),
      });

      const average = result.recentAssignments[0].metrics.average;
      // SPaG is notAttempted → excluded.  Renormalised weights: 0.4/0.8 = 0.5 for each
      // Expected: 0.5 * 4 + 0.5 * 4 = 4.0
      const expectedSPaGExcludedAverage = 4;
      expect(average.state).toBe('computed');
      if (average.state === 'computed') {
        expect(average.value).toBeCloseTo(expectedSPaGExcludedAverage);
      }
    });
  });

  // -----------------------------------------------------------------------
  // studentAverages — no-data rows
  // -----------------------------------------------------------------------
  describe('studentAverages', () => {
    it('synthesises no-data rows for students not in analyserResult.perStudent', () => {
      const studentRows: PerStudentRow[] = [
        perStudentRow({
          studentId: 's-1',
          studentName: 'Alice',
          completeness: metric('computed', { value: 4 }),
          accuracy: metric('computed', { value: 3 }),
          spag: metric('computed', { value: 2 }),
          overall: metric('computed', { value: 3.2 }),
        }),
      ];

      const result = adaptClassPageToViewModel({
        analyserResult: averagingResult({
          perStudent: studentRows,
        }),
        classFull: classFull({
          students: [student('s-1', 'Alice'), student('s-2', 'Bob'), student('s-3', 'Charlie')],
          assignments: [
            assignment({
              assignmentId: 'a-1',
              updatedAt: DEFAULT_TS,
              definitionKey: 'dk1',
              taskIds: ['t1'],
            }),
          ],
        }),
      });

      const expectedStudentCount = 3;
      expect(result.studentAverages).toHaveLength(expectedStudentCount);

      const studentAverages = result.studentAverages as Array<{
        studentId: string;
        metrics: Record<string, unknown>;
      }>;

      // Alice has data
      const alice = studentAverages.find((s) => s.studentId === 's-1');
      expect(alice).toBeDefined();
      expect(alice!.metrics.completeness).toMatchObject({ state: 'computed' });

      // Bob is unassessed — all fields should be notAttempted
      const bob = studentAverages.find((s) => s.studentId === 's-2');
      expect(bob).toBeDefined();
      expect(bob!.metrics.completeness).toMatchObject({ state: 'notAttempted' });
      expect(bob!.metrics.accuracy).toMatchObject({ state: 'notAttempted' });
      expect(bob!.metrics.spag).toMatchObject({ state: 'notAttempted' });
      expect(bob!.metrics.average).toMatchObject({ state: 'notAttempted' });

      // Charlie is unassessed
      const charlie = studentAverages.find((s) => s.studentId === 's-3');
      expect(charlie).toBeDefined();
      expect(charlie!.metrics.completeness).toMatchObject({ state: 'notAttempted' });
      expect(charlie!.metrics.average).toMatchObject({ state: 'notAttempted' });
    });

    // -----------------------------------------------------------------------
    // studentAverages — sort order
    // -----------------------------------------------------------------------
    it('sorts studentAverages by studentName ascending with studentId as tie-breaker', () => {
      const studentRows: PerStudentRow[] = [
        perStudentRow({
          studentId: 's-2',
          studentName: 'Bob',
          completeness: metric('computed', { value: 4 }),
          accuracy: metric('computed', { value: 3 }),
          spag: metric('computed', { value: 2 }),
          overall: metric('computed', { value: 3 }),
        }),
        perStudentRow({
          studentId: 's-1',
          studentName: 'Alice',
          completeness: metric('computed', { value: 5 }),
          accuracy: metric('computed', { value: 4 }),
          spag: metric('computed', { value: 3 }),
          overall: metric('computed', { value: 4 }),
        }),
      ];

      const result = adaptClassPageToViewModel({
        analyserResult: averagingResult({
          perStudent: studentRows,
        }),
        classFull: classFull({
          students: [
            student('s-1', 'Alice'),
            student('s-2', 'Bob'),
            student('s-3', 'Charlie'),
            // Two students named "David" — tie-break by studentId
            student('s-5', 'David'),
            student('s-4', 'David'),
          ],
          assignments: [
            assignment({
              assignmentId: 'a-1',
              updatedAt: DEFAULT_TS,
              definitionKey: 'dk1',
              taskIds: ['t1'],
            }),
          ],
        }),
      });

      const expectedStudentSortCount = 5;
      expect(result.studentAverages).toHaveLength(expectedStudentSortCount);
      expect(result.studentAverages[0].studentId).toBe('s-1'); // Alice
      expect(result.studentAverages[1].studentId).toBe('s-2'); // Bob
      expect(result.studentAverages[2].studentId).toBe('s-3'); // Charlie
      // Two Davids: s-4 (David) before s-5 (David) by studentId asc
      expect(result.studentAverages[3].studentId).toBe('s-4');
      expect(result.studentAverages[4].studentId).toBe('s-5');
    });
  });

  // -----------------------------------------------------------------------
  // date formatting
  // -----------------------------------------------------------------------
  describe('date formatting', () => {
    it('formats lastAssessedAtLabel via formatUpdatedAtLabel', () => {
      const result = adaptClassPageToViewModel({
        analyserResult: averagingResult(),
        classFull: classFull({
          students: [student('s-1', 'Alice')],
          assignments: [
            assignment({
              assignmentId: 'a-1',
              updatedAt: '2025-11-05T00:00:00.000Z',
              definitionKey: 'dk1',
              taskIds: ['t1'],
            }),
          ],
        }),
      });

      expect(result.recentAssignments).toHaveLength(1);
      const card = result.recentAssignments[0];
      // formatUpdatedAtLabel('2025-11-05T00:00:00.000Z', en-GB, UTC) => '05/11/2025'
      expect(card.lastAssessedAt).toBe('2025-11-05T00:00:00.000Z');
      expect(card.lastAssessedAtLabel).toBe('05/11/2025');
    });
  });

  // -----------------------------------------------------------------------
  // trust validation — null updatedAt
  // -----------------------------------------------------------------------
  describe('trust validation', () => {
    it('throws on null updatedAt with an error referencing the assignmentId', () => {
      const nullUpdatedAtAssignment = assignment({
        assignmentId: 'a-bad',
        updatedAt: null, // null is a data bug
        definitionKey: 'dk1',
        taskIds: ['t1'],
      });

      expect(() =>
        adaptClassPageToViewModel({
          analyserResult: averagingResult(),
          classFull: classFull({
            students: [student('s-1', 'Alice')],
            assignments: [nullUpdatedAtAssignment],
          }),
        })
      ).toThrow(/a-bad/);
    });

    // -----------------------------------------------------------------------
    // trust validation — unparseable updatedAt
    // -----------------------------------------------------------------------
    it('throws on unparseable updatedAt with an error referencing the assignmentId', () => {
      const badUpdatedAtAssignment = assignment({
        assignmentId: 'a-bad-format',
        updatedAt: 'not-a-valid-iso-string',
        definitionKey: 'dk1',
        taskIds: ['t1'],
      });

      expect(() =>
        adaptClassPageToViewModel({
          analyserResult: averagingResult(),
          classFull: classFull({
            students: [student('s-1', 'Alice')],
            assignments: [badUpdatedAtAssignment],
          }),
        })
      ).toThrow(/a-bad-format/);
    });

    // -----------------------------------------------------------------------
    // trust validation — duplicate studentId
    // -----------------------------------------------------------------------
    it('throws on duplicate studentId', () => {
      expect(() =>
        adaptClassPageToViewModel({
          analyserResult: averagingResult(),
          classFull: classFull({
            students: [
              student('s-1', 'Alice'),
              student('s-1', 'Alice Duplicate'), // same id
            ],
            assignments: [
              assignment({
                assignmentId: 'a-1',
                updatedAt: DEFAULT_TS,
                definitionKey: 'dk1',
                taskIds: ['t1'],
              }),
            ],
          }),
        })
      ).toThrow(/duplicate.*student/i);
    });

    // -----------------------------------------------------------------------
    // trust validation — duplicate assignmentId
    // -----------------------------------------------------------------------
    it('throws on duplicate assignmentId', () => {
      expect(() =>
        adaptClassPageToViewModel({
          analyserResult: averagingResult(),
          classFull: classFull({
            students: [student('s-1', 'Alice')],
            assignments: [
              assignment({
                assignmentId: 'a-1',
                updatedAt: DEFAULT_TS,
                definitionKey: 'dk1',
                taskIds: ['t1'],
              }),
              assignment({
                assignmentId: 'a-1',
                updatedAt: DEFAULT_TS,
                definitionKey: 'dk2',
                taskIds: ['t1'],
              }), // duplicate id
            ],
          }),
        })
      ).toThrow(/duplicate.*assignment/i);
    });
  });

  // -----------------------------------------------------------------------
  // classMetrics passthrough
  // -----------------------------------------------------------------------
  describe('classMetrics', () => {
    it('passes through perClass from analyser result unchanged', () => {
      const customPerClass = perClassResult({
        completeness: metric('computed', { value: 4.2 }),
        accuracy: metric('notAttempted'),
        spag: metric('error'),
        overall: metric('computed', { value: 3.1 }),
      });

      const result = adaptClassPageToViewModel({
        analyserResult: averagingResult({
          perClass: customPerClass,
        }),
        classFull: classFull({
          students: [student('s-1', 'Alice')],
          assignments: [
            assignment({
              assignmentId: 'a-1',
              updatedAt: DEFAULT_TS,
              definitionKey: 'dk1',
              taskIds: ['t1'],
            }),
          ],
        }),
      });

      expect(result.classMetrics.completeness).toEqual(customPerClass.completeness);
      expect(result.classMetrics.accuracy).toEqual(customPerClass.accuracy);
      expect(result.classMetrics.spag).toEqual(customPerClass.spag);
      expect(result.classMetrics.overall).toEqual(customPerClass.overall);
    });
  });
});
