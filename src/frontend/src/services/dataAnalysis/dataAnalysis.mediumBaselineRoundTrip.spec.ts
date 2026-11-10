/**
 * Medium-corpus baseline-mode round trip through the data-analysis service.
 *
 * Pins the committed `medium` profile's attempt-baseline claims (specification
 * decisions 3–5): pool sizing at the structural minimum of two, the
 * pool-boundary tie at roster indices 3 and 4 broken by ascending student id,
 * E-condition non-candidacy for rosters 1 and 2, raw-`N`-alongside-numeric
 * attempts at roster index 0, the non-degenerate seven-of-nine-key baseline,
 * and the per-class outside-baseline pair.
 *
 * The heatmap-projection cases pin the adapter's column-level
 * `includedInAttemptBaseline` projection of the same corpus: baseline mode
 * marks the per-class outside-baseline pair as outside the baseline, while the
 * absolute and merged paths stay all-included through the explicit `null`
 * baseline set.
 *
 * The committed views are imported at this call site with the `?raw` suffix,
 * following `dataAnalysis.mediumRoundTrip.spec.ts`: record loading stays at
 * the call site and no shared loader is created.
 *
 * @see docs/developer/testing/synthetic-test-data.md
 */

import { describe, expect, it } from 'vitest';
import mediumClassesByIdRaw from '@synthetic/medium/classesById.json?raw';
import mediumPartialsRaw from '@synthetic/medium/assignmentDefinitionPartials.json?raw';
import { DataAnalysisService } from './dataAnalysisService';
import { AveragingAnalyserInputSchema } from './dataAnalysis.zod';
import type { AveragingAnalyserInput, AnalysisMode } from './dataAnalysis.zod';
import { adaptMetricsToHeatmap } from './heatmapAdapter';
import { adaptMetricsToMergedHeatmap } from './heatmapAdapter.merged';
import { buildTaskKey } from './taskKey';

/** `medium` class analysed in depth by this suite. */
const MEDIUM_CLASS_ID = 'class-0';

/** All four committed `medium` class ids. */
const MEDIUM_CLASS_IDS = ['class-0', 'class-1', 'class-2', 'class-3'];

/** Roster index of the sole top attempter (nine distinct task keys). */
const ROSTER_INDEX_TOP_ATTEMPTER = 0;

/** Roster indices whose items are all-`E` (zero attempts despite participation). */
const ROSTER_INDEX_ERROR_CONDITION_FIRST = 1;
const ROSTER_INDEX_ERROR_CONDITION_SECOND = 2;

/** Roster indices tied at the pool boundary with identical attempt sets. */
const ROSTER_INDEX_POOL_BOUNDARY = 3;
const ROSTER_INDEX_POOL_BOUNDARY_RIVAL = 4;

/** Assignments each participating `medium` student submitted to. */
const EXPECTED_ERROR_ROSTER_PARTICIPATION = 5;

/** Number of submitted items carried by the top attempter. */
const EXPECTED_TOP_ATTEMPTER_ITEM_COUNT = 9;

/** Distinct attempted task keys carried by the pool-boundary roster student. */
const EXPECTED_BOUNDARY_ATTEMPT_COUNT = 7;

/** Number of baseline task keys derived for every `medium` class. */
const EXPECTED_BASELINE_KEY_COUNT = 7;

/** Number of per-task rows derived for every `medium` class (nine task keys). */
const EXPECTED_PER_TASK_ROW_COUNT = 9;

/** Distinct task keys projected across every assignment of one `medium` class. */
const EXPECTED_PROJECTED_TASK_KEY_COUNT = 9;

/** The outside-baseline task keys per class (the pool leader's extra attempts). */
const OUTSIDE_BASELINE_KEYS_BY_CLASS: Record<string, string[]> = {
  'class-0': ['definition-2-slides::task-2-0', 'definition-2-slides::task-2-1'],
  'class-1': ['definition-0-slides::task-0-0', 'definition-0-slides::task-0-1'],
  'class-2': ['definition-2-slides::task-2-0', 'definition-2-slides::task-2-1'],
  'class-3': ['definition-0-slides::task-0-0', 'definition-0-slides::task-0-1'],
};

/** All nine projected task keys per class, ascending. */
const EXPECTED_PROJECTED_TASK_KEYS = [
  'definition-0-slides::task-0-0',
  'definition-0-slides::task-0-1',
  'definition-1-sheets::task-1-0',
  'definition-1-sheets::task-1-1',
  'definition-2-slides::task-2-0',
  'definition-2-slides::task-2-1',
  'definition-3-sheets::task-3-0',
  'definition-3-sheets::task-3-1',
  'definition-partial-0::task-partial-0-0',
];

/** Per-class baseline keys: the projected set minus the outside pair. */
const EXPECTED_BASELINE_KEYS_BY_CLASS: Record<string, string[]> = Object.fromEntries(
  MEDIUM_CLASS_IDS.map((classId): [string, string[]] => {
    return [
      classId,
      EXPECTED_PROJECTED_TASK_KEYS.filter(
        (key) => !OUTSIDE_BASELINE_KEYS_BY_CLASS[classId].includes(key)
      ),
    ];
  })
);

/** Class-0/2 baseline key set (ascending): the projected set minus its outside pair. */
const EXPECTED_BASELINE_TASK_KEYS = EXPECTED_BASELINE_KEYS_BY_CLASS[MEDIUM_CLASS_ID];

type MediumAssessment = { score: number | 'N' | 'E'; error?: { code: string } };
type MediumItem = { assessments?: Record<string, MediumAssessment> };
type MediumSubmission = { studentId: string; items: Record<string, MediumItem> };
type MediumAssignment = {
  assignmentId: string;
  assignmentDefinitionKey: string;
  submissions: MediumSubmission[];
};
type MediumClass = {
  classId: string;
  students: Array<{ id: string }>;
  assignments: MediumAssignment[];
};

/**
 * Parse the committed `medium` class records.
 *
 * @returns {Record<string, MediumClass>} The classes keyed by class id.
 */
function parseMediumClasses(): Record<string, MediumClass> {
  return JSON.parse(mediumClassesByIdRaw) as Record<string, MediumClass>;
}

/**
 * Build the validated analysis input over the requested `medium` classes.
 *
 * @param {AnalysisMode} analysisMode - The analysis mode under test.
 * @param {string[]} classIds - The `medium` class ids to analyse.
 * @returns {AveragingAnalyserInput} The validated analysis input.
 */
function buildMediumInput(analysisMode: AnalysisMode, classIds: string[]): AveragingAnalyserInput {
  const classesById = parseMediumClasses();
  return AveragingAnalyserInputSchema.parse({
    filter: { classIds, analysisMode },
    classes: classIds.map((classId) => classesById[classId]),
    assignmentDefinitionPartials: JSON.parse(mediumPartialsRaw),
  });
}

/**
 * Return the roster student at the given index, failing loudly when absent.
 *
 * @param {MediumClass} classRecord - The parsed class record.
 * @param {number} rosterIndex - The roster index to read.
 * @returns {{ id: string }} The roster student.
 */
function requireRosterStudent(classRecord: MediumClass, rosterIndex: number): { id: string } {
  const student = classRecord.students.at(rosterIndex);
  if (student === undefined) {
    throw new Error(`medium round-trip spec: roster index ${rosterIndex} does not exist`);
  }
  return student;
}

/**
 * Whether the submission item is an attempt (decision 3): at least one
 * criterion assessment carries a numeric score.
 *
 * @param {MediumItem} item - The submission item.
 * @returns {boolean} True when the item is an attempt.
 */
function isAttemptItem(item: MediumItem): boolean {
  return ['completeness', 'accuracy', 'spag'].some(
    (criterion) => typeof item.assessments?.[criterion]?.score === 'number'
  );
}

/**
 * Collect a roster student's attempted task keys from one assignment into the
 * given set.
 *
 * @param {MediumAssignment} assignment - The assignment to walk.
 * @param {string} studentId - The student whose items are collected.
 * @param {Set<string>} attemptedTaskKeys - The accumulator set (mutated).
 */
function collectAttemptedTaskKeysFromAssignment(
  assignment: MediumAssignment,
  studentId: string,
  attemptedTaskKeys: Set<string>
): void {
  for (const submission of assignment.submissions) {
    if (submission.studentId !== studentId) continue;
    for (const [taskId, item] of Object.entries(submission.items)) {
      if (isAttemptItem(item)) {
        attemptedTaskKeys.add(buildTaskKey(assignment.assignmentDefinitionKey, taskId));
      }
    }
  }
}

/**
 * Collect a roster student's attempted task keys (decision 3: at least one
 * numeric criterion score on the submission item).
 *
 * @param {MediumClass} classRecord - The parsed class record.
 * @param {number} rosterIndex - The roster index to collect for.
 * @returns {Set<string>} The student's distinct attempted task keys.
 */
function collectAttemptedTaskKeys(classRecord: MediumClass, rosterIndex: number): Set<string> {
  const studentId = requireRosterStudent(classRecord, rosterIndex).id;
  const attemptedTaskKeys = new Set<string>();
  for (const assignment of classRecord.assignments) {
    collectAttemptedTaskKeysFromAssignment(assignment, studentId, attemptedTaskKeys);
  }
  return attemptedTaskKeys;
}

/**
 * Count the assignments a roster student submitted to.
 *
 * @param {MediumClass} classRecord - The parsed class record.
 * @param {number} rosterIndex - The roster index to count for.
 * @returns {number} Distinct assignment ids carrying a submission from the student.
 */
function countAssignmentsWithSubmissions(classRecord: MediumClass, rosterIndex: number): number {
  const studentId = requireRosterStudent(classRecord, rosterIndex).id;
  const assignmentIds = new Set<string>();
  for (const assignment of classRecord.assignments) {
    if (assignment.submissions.some((submission) => submission.studentId === studentId)) {
      assignmentIds.add(assignment.assignmentId);
    }
  }
  return assignmentIds.size;
}

/**
 * Whether the submission item carries a raw-`N` SPaG assessment alongside a
 * numeric completeness or accuracy score (the corpus's attempt-with-raw-N shape).
 *
 * @param {MediumItem} item - The submission item.
 * @returns {boolean} True when the item matches the shape.
 */
function hasSpagNotAttemptedWithNumericSibling(item: MediumItem): boolean {
  if (item.assessments?.spag?.score !== 'N') return false;
  return ['completeness', 'accuracy'].some(
    (criterion) => typeof item.assessments?.[criterion]?.score === 'number'
  );
}

/**
 * Count a roster student's submitted items whose SPaG assessment is raw `N`
 * alongside a numeric completeness or accuracy score.
 *
 * @param {MediumClass} classRecord - The parsed class record.
 * @param {number} rosterIndex - The roster index to count for.
 * @returns {number} The matching item count.
 */
function countSpagNotAttemptedWithNumericSibling(
  classRecord: MediumClass,
  rosterIndex: number
): number {
  const studentId = requireRosterStudent(classRecord, rosterIndex).id;
  let matchingItemCount = 0;
  for (const assignment of classRecord.assignments) {
    for (const submission of assignment.submissions) {
      if (submission.studentId !== studentId) continue;
      for (const item of Object.values(submission.items)) {
        if (hasSpagNotAttemptedWithNumericSibling(item)) matchingItemCount++;
      }
    }
  }
  return matchingItemCount;
}

describe('medium corpus baseline-mode round trip', () => {
  it('sizes the pool at two and breaks the roster-boundary tie by studentId', () => {
    const [result] = new DataAnalysisService().analyse(
      buildMediumInput('topDecileBaseline', [MEDIUM_CLASS_ID])
    );
    const classRecord = parseMediumClasses()[MEDIUM_CLASS_ID];

    // Roster indices 3 and 4 tie at seven distinct attempts with identical
    // attempt sets; ascending student id displaces index 4 from the pool.
    const boundaryKeys = collectAttemptedTaskKeys(classRecord, ROSTER_INDEX_POOL_BOUNDARY);
    const rivalKeys = collectAttemptedTaskKeys(classRecord, ROSTER_INDEX_POOL_BOUNDARY_RIVAL);
    expect(boundaryKeys.size).toBe(EXPECTED_BOUNDARY_ATTEMPT_COUNT);
    expect([...rivalKeys].toSorted((a, b) => a.localeCompare(b))).toEqual(
      [...boundaryKeys].toSorted((a, b) => a.localeCompare(b))
    );

    expect(result.appliedAnalysisMode).toBe('topDecileBaseline');
    expect(result.attemptBaseline?.poolStudentIds).toEqual([
      classRecord.students[ROSTER_INDEX_TOP_ATTEMPTER].id,
      classRecord.students[ROSTER_INDEX_POOL_BOUNDARY].id,
    ]);
    expect(
      result.attemptBaseline?.poolStudentIds.includes(
        classRecord.students[ROSTER_INDEX_POOL_BOUNDARY_RIVAL].id
      )
    ).toBe(false);
  });

  it('excludes the E-condition rosters from candidacy despite five-assignment participation', () => {
    const classRecord = parseMediumClasses()[MEDIUM_CLASS_ID];

    // The corpus's non-attempt evidence: every assessment on both rosters'
    // nine items is an explicit E with the named cause.
    const errorCodesFirst = collectErrorCodes(classRecord, ROSTER_INDEX_ERROR_CONDITION_FIRST);
    const errorCodesSecond = collectErrorCodes(classRecord, ROSTER_INDEX_ERROR_CONDITION_SECOND);
    expect(errorCodesFirst).toEqual(new Set(['ASSESSMENT_FAILED']));
    expect(errorCodesSecond).toEqual(new Set(['SOURCE_UNREADABLE']));
    expect(countAssignmentsWithSubmissions(classRecord, ROSTER_INDEX_ERROR_CONDITION_FIRST)).toBe(
      EXPECTED_ERROR_ROSTER_PARTICIPATION
    );
    expect(countAssignmentsWithSubmissions(classRecord, ROSTER_INDEX_ERROR_CONDITION_SECOND)).toBe(
      EXPECTED_ERROR_ROSTER_PARTICIPATION
    );

    const [result] = new DataAnalysisService().analyse(
      buildMediumInput('topDecileBaseline', [MEDIUM_CLASS_ID])
    );
    const attemptBaseline = result.attemptBaseline;
    if (!attemptBaseline) {
      throw new Error('baseline-mode result is missing the attemptBaseline block');
    }
    expect(attemptBaseline.poolStudentIds).not.toContain(
      classRecord.students[ROSTER_INDEX_ERROR_CONDITION_FIRST].id
    );
    expect(attemptBaseline.poolStudentIds).not.toContain(
      classRecord.students[ROSTER_INDEX_ERROR_CONDITION_SECOND].id
    );
  });

  it('treats raw-N-alongside-numeric items as attempts at the top attempter', () => {
    const classRecord = parseMediumClasses()[MEDIUM_CLASS_ID];

    // Every item the top attempter submitted carries a raw-N SPaG assessment
    // beside a numeric completeness or accuracy score, and the student leads
    // the pool — so those items counted as attempts.
    expect(countSpagNotAttemptedWithNumericSibling(classRecord, ROSTER_INDEX_TOP_ATTEMPTER)).toBe(
      EXPECTED_TOP_ATTEMPTER_ITEM_COUNT
    );

    const [result] = new DataAnalysisService().analyse(
      buildMediumInput('topDecileBaseline', [MEDIUM_CLASS_ID])
    );
    expect(result.attemptBaseline?.poolStudentIds[0]).toBe(
      classRecord.students[ROSTER_INDEX_TOP_ATTEMPTER].id
    );
  });

  it('intersects the pool attempt sets into the seven-key non-degenerate baseline', () => {
    const [result] = new DataAnalysisService().analyse(
      buildMediumInput('topDecileBaseline', [MEDIUM_CLASS_ID])
    );

    expect(result.attemptBaseline?.baselineTaskKeys).toEqual(EXPECTED_BASELINE_TASK_KEYS);
    expect(result.perTask).toHaveLength(EXPECTED_PER_TASK_ROW_COUNT);
  });

  it('marks the per-class outside-baseline pair on per-task rows across all classes', () => {
    const results = new DataAnalysisService().analyse(
      buildMediumInput('topDecileBaseline', MEDIUM_CLASS_IDS)
    );

    expect(results).toHaveLength(MEDIUM_CLASS_IDS.length);
    for (const result of results) {
      const outsideKeys = OUTSIDE_BASELINE_KEYS_BY_CLASS[result.classId];
      const outsideRows = result.perTask.filter((row) => !row.includedInAttemptBaseline);
      expect(outsideRows.map((row) => buildTaskKey(row.definitionKey, row.taskId))).toEqual(
        outsideKeys
      );
      expect(result.perTask.length - outsideRows.length).toBe(EXPECTED_BASELINE_KEY_COUNT);
    }
  });

  it('keeps perStudentTaskMetrics identical across the two modes', () => {
    const absolute = new DataAnalysisService().analyse(
      buildMediumInput('absolute', MEDIUM_CLASS_IDS)
    );
    const baseline = new DataAnalysisService().analyse(
      buildMediumInput('topDecileBaseline', MEDIUM_CLASS_IDS)
    );

    expect(baseline.map((result) => result.perStudentTaskMetrics)).toEqual(
      absolute.map((result) => result.perStudentTaskMetrics)
    );
  });
});

describe('medium corpus heatmap column projection', () => {
  it('marks exactly the outside-baseline columns excluded from the attempt baseline in baseline mode', () => {
    const input = buildMediumInput('topDecileBaseline', MEDIUM_CLASS_IDS);
    const results = new DataAnalysisService().analyse(input);

    for (const [classIndex, classId] of MEDIUM_CLASS_IDS.entries()) {
      const result = results[classIndex];
      const classFull = input.classes[classIndex];
      const includedFlags = new Map<string, boolean>();
      for (const assignment of classFull.assignments) {
        const heatmap = adaptMetricsToHeatmap(
          result,
          classFull,
          assignment.assignmentId,
          input.assignmentDefinitionPartials
        );
        for (const column of heatmap.taskColumns) {
          includedFlags.set(column.taskKey, column.includedInAttemptBaseline);
        }
      }

      const outsideKeys = OUTSIDE_BASELINE_KEYS_BY_CLASS[classId];
      expect(includedFlags.size).toBe(EXPECTED_PROJECTED_TASK_KEY_COUNT);
      const excludedKeys: string[] = [];
      const includedKeys: string[] = [];
      for (const [key, included] of includedFlags) {
        if (included) {
          includedKeys.push(key);
        } else {
          excludedKeys.push(key);
        }
      }
      expect(excludedKeys.toSorted((a, b) => a.localeCompare(b))).toEqual(
        outsideKeys.toSorted((a, b) => a.localeCompare(b))
      );
      expect(includedKeys.toSorted((a, b) => a.localeCompare(b))).toEqual(
        EXPECTED_BASELINE_KEYS_BY_CLASS[classId]
      );
    }
  });

  it('keeps every heatmap column included in absolute mode via the explicit null baseline set', () => {
    const input = buildMediumInput('absolute', MEDIUM_CLASS_IDS);
    const results = new DataAnalysisService().analyse(input);

    for (const classIndex of MEDIUM_CLASS_IDS.keys()) {
      const result = results[classIndex];
      const classFull = input.classes[classIndex];
      for (const assignment of classFull.assignments) {
        const heatmap = adaptMetricsToHeatmap(
          result,
          classFull,
          assignment.assignmentId,
          input.assignmentDefinitionPartials
        );
        for (const column of heatmap.taskColumns) {
          expect(column.includedInAttemptBaseline).toBe(true);
        }
      }
    }
  });

  it('keeps merged heatmap columns all included via the explicit null chain even for a baseline-mode result', () => {
    const input = buildMediumInput('topDecileBaseline', [MEDIUM_CLASS_ID]);
    const [result] = new DataAnalysisService().analyse(input);
    const classFull = input.classes[0];

    const merged = adaptMetricsToMergedHeatmap(
      result,
      classFull,
      classFull.assignments.map((assignment) => assignment.assignmentId),
      input.assignmentDefinitionPartials
    );

    expect(merged.taskColumns).toHaveLength(EXPECTED_PROJECTED_TASK_KEY_COUNT);
    for (const column of merged.taskColumns) {
      expect(column.includedInAttemptBaseline).toBe(true);
    }
  });
});

/**
 * Collect the explicit error cause codes from one submission item.
 *
 * @param {MediumItem} item - The submission item.
 * @param {Set<string>} errorCodes - The accumulator set (mutated).
 */
function collectErrorCodesFromItem(item: MediumItem, errorCodes: Set<string>): void {
  const assessments = item.assessments;
  if (assessments === undefined) return;
  for (const assessment of Object.values(assessments)) {
    if (assessment.score !== 'E') continue;
    errorCodes.add(assessment.error?.code ?? 'missing-code');
  }
}

/**
 * Collect the explicit error cause codes across one roster student's items.
 *
 * @param {MediumClass} classRecord - The parsed class record.
 * @param {number} rosterIndex - The roster index to collect for.
 * @returns {Set<string>} The distinct error cause codes.
 */
function collectErrorCodes(classRecord: MediumClass, rosterIndex: number): Set<string> {
  const studentId = requireRosterStudent(classRecord, rosterIndex).id;
  const errorCodes = new Set<string>();
  for (const assignment of classRecord.assignments) {
    for (const submission of assignment.submissions) {
      if (submission.studentId !== studentId) continue;
      for (const item of Object.values(submission.items)) {
        collectErrorCodesFromItem(item, errorCodes);
      }
    }
  }
  return errorCodes;
}
