/**
 * Medium-corpus baseline-mode round trip through the data-analysis service.
 * Checks attempt-baseline claims against an oracle derived from the raw view:
 * pool ranking with an ascending-student-id tie-break, a non-degenerate
 * baseline, per-class outside-baseline keys, and E-condition non-candidacy.
 * Heatmap cases pin the adapter's column-level `includedInAttemptBaseline`
 * projection. Views are imported here with the `?raw` suffix.
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

/** Roster index of the sole top attempter. */
const ROSTER_INDEX_TOP_ATTEMPTER = 0;

/** Roster indices whose items are all-`E` (zero attempts despite participation). */
const ROSTER_INDEX_ERROR_CONDITION_FIRST = 1;
const ROSTER_INDEX_ERROR_CONDITION_SECOND = 2;

/** Roster indices tied at the pool boundary with identical attempt sets. */
const ROSTER_INDEX_POOL_BOUNDARY = 3;
const ROSTER_INDEX_POOL_BOUNDARY_RIVAL = 4;

/**
 * Ascending task-key comparator shared by the oracle and the pinned projections.
 * @param {string} a - First task key.
 * @param {string} b - Second task key.
 * @returns {number} Negative, zero or positive per ascending order.
 */
const ascending = (a: string, b: string) => a.localeCompare(b);

type MediumPartial = { definitionKey: string; tasks: Array<{ taskId: string }> };

/** Pool bounds: minimum size and the ten-percent fraction divisor. */
const POOL_MINIMUM = 2;
const POOL_FRACTION_DIVISOR = 10;

/** Every task key carried by the committed partial definitions, ascending. */
const PROJECTED_TASK_KEYS = (JSON.parse(mediumPartialsRaw) as MediumPartial[])
  .flatMap((definition) =>
    definition.tasks.map((task) => buildTaskKey(definition.definitionKey, task.taskId))
  )
  .toSorted(ascending);

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
 * @returns {Record<string, MediumClass>} The classes keyed by class id.
 */
function parseMediumClasses(): Record<string, MediumClass> {
  return JSON.parse(mediumClassesByIdRaw) as Record<string, MediumClass>;
}

/**
 * Build the validated analysis input over the requested `medium` classes.
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
 * Whether the submission item is an attempt: one numeric criterion score.
 * @param {MediumItem} item - The submission item.
 * @returns {boolean} True when the item is an attempt.
 */
function isAttemptItem(item: MediumItem): boolean {
  return ['completeness', 'accuracy', 'spag'].some(
    (criterion) => typeof item.assessments?.[criterion]?.score === 'number'
  );
}

/**
 * Collect a roster student's attempted task keys from one assignment.
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
 * Collect a roster student's attempted task keys.
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
 * Whether a raw-`N` SPaG score sits beside a numeric sibling.
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
 * Count a roster student's raw-`N`-with-numeric submitted items.
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

/**
 * Derive the pool/baseline oracle from the raw committed view only.
 * @param {MediumClass} classRecord - The parsed class record.
 * @returns {{ poolStudentIds: string[]; baselineTaskKeys: string[] }} The derived oracle.
 */
function deriveCorpusBaseline(classRecord: MediumClass): {
  poolStudentIds: string[];
  baselineTaskKeys: string[];
} {
  const attempted = new Map<string, Set<string>>();
  for (const [index, student] of classRecord.students.entries()) {
    attempted.set(student.id, collectAttemptedTaskKeys(classRecord, index));
  }
  const rosterIds = classRecord.students.map((student) => student.id);
  const candidates = rosterIds.filter((id) => attempted.get(id)!.size > 0);
  const poolSize = Math.min(
    candidates.length,
    Math.max(POOL_MINIMUM, Math.ceil(rosterIds.length / POOL_FRACTION_DIVISOR))
  );
  const poolStudentIds = candidates
    .toSorted((a, b) => attempted.get(b)!.size - attempted.get(a)!.size || a.localeCompare(b))
    .slice(0, poolSize);
  const shared = new Set(
    [...attempted.get(poolStudentIds[0])!].filter((key) =>
      poolStudentIds.slice(1).every((id) => attempted.get(id)!.has(key))
    )
  );
  return {
    poolStudentIds,
    baselineTaskKeys: [...shared].toSorted(ascending),
  };
}

describe('medium corpus baseline-mode round trip', () => {
  it('ranks the pool by distinct attempts with an ascending studentId tie-break', () => {
    const [result] = new DataAnalysisService().analyse(
      buildMediumInput('topDecileBaseline', [MEDIUM_CLASS_ID])
    );
    const classRecord = parseMediumClasses()[MEDIUM_CLASS_ID];
    const oracle = deriveCorpusBaseline(classRecord);

    // The boundary and its rival tie on attempt count with identical attempt
    // sets; the lower student id must win the pool place.
    const boundaryKeys = collectAttemptedTaskKeys(classRecord, ROSTER_INDEX_POOL_BOUNDARY);
    const rivalKeys = collectAttemptedTaskKeys(classRecord, ROSTER_INDEX_POOL_BOUNDARY_RIVAL);
    expect([...rivalKeys].toSorted(ascending)).toEqual([...boundaryKeys].toSorted(ascending));

    expect(result.appliedAnalysisMode).toBe('topDecileBaseline');
    expect(result.attemptBaseline?.poolStudentIds).toEqual(oracle.poolStudentIds);
    expect(result.attemptBaseline?.poolStudentIds).toContain(
      classRecord.students[ROSTER_INDEX_POOL_BOUNDARY].id
    );
    expect(result.attemptBaseline?.poolStudentIds).not.toContain(
      classRecord.students[ROSTER_INDEX_POOL_BOUNDARY_RIVAL].id
    );
  });

  it('excludes the E-condition rosters from candidacy despite participation', () => {
    const classRecord = parseMediumClasses()[MEDIUM_CLASS_ID];

    // The corpus's non-attempt evidence: every assessment on both rosters'
    // submitted items is an explicit E with the named cause.
    const errorCodesFirst = collectErrorCodes(classRecord, ROSTER_INDEX_ERROR_CONDITION_FIRST);
    const errorCodesSecond = collectErrorCodes(classRecord, ROSTER_INDEX_ERROR_CONDITION_SECOND);
    expect(errorCodesFirst).toEqual(new Set(['ASSESSMENT_FAILED']));
    expect(errorCodesSecond).toEqual(new Set(['SOURCE_UNREADABLE']));
    expect(
      countAssignmentsWithSubmissions(classRecord, ROSTER_INDEX_ERROR_CONDITION_FIRST)
    ).toBeGreaterThan(0);
    expect(
      countAssignmentsWithSubmissions(classRecord, ROSTER_INDEX_ERROR_CONDITION_SECOND)
    ).toBeGreaterThan(0);

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
    const topAttempterId = classRecord.students[ROSTER_INDEX_TOP_ATTEMPTER].id;
    let submittedItemCount = 0;
    for (const assignment of classRecord.assignments) {
      for (const submission of assignment.submissions) {
        if (submission.studentId === topAttempterId) {
          submittedItemCount += Object.keys(submission.items).length;
        }
      }
    }

    // Every item the top attempter submitted carries a raw-N SPaG assessment
    // beside a numeric completeness or accuracy score, and the student leads
    // the pool — so those items counted as attempts.
    expect(countSpagNotAttemptedWithNumericSibling(classRecord, ROSTER_INDEX_TOP_ATTEMPTER)).toBe(
      submittedItemCount
    );

    const [result] = new DataAnalysisService().analyse(
      buildMediumInput('topDecileBaseline', [MEDIUM_CLASS_ID])
    );
    expect(result.attemptBaseline?.poolStudentIds[0]).toBe(topAttempterId);
  });

  it('intersects the pool attempt sets into a non-degenerate baseline', () => {
    const [result] = new DataAnalysisService().analyse(
      buildMediumInput('topDecileBaseline', [MEDIUM_CLASS_ID])
    );
    const oracle = deriveCorpusBaseline(parseMediumClasses()[MEDIUM_CLASS_ID]);

    expect(result.attemptBaseline?.baselineTaskKeys).toEqual(oracle.baselineTaskKeys);
    expect(oracle.baselineTaskKeys.length).toBeGreaterThan(0);
    expect(
      result.perTask.map((row) => buildTaskKey(row.definitionKey, row.taskId)).toSorted(ascending)
    ).toEqual(PROJECTED_TASK_KEYS);
  });

  it('derives each class outside-baseline keys as the complement of its baseline in the attempt space', () => {
    const results = new DataAnalysisService().analyse(
      buildMediumInput('topDecileBaseline', MEDIUM_CLASS_IDS)
    );

    expect(results).toHaveLength(MEDIUM_CLASS_IDS.length);
    for (const [index, result] of results.entries()) {
      const attemptBaseline = result.attemptBaseline;
      if (!attemptBaseline) {
        throw new Error('baseline-mode result is missing the attemptBaseline block');
      }
      const oracle = deriveCorpusBaseline(parseMediumClasses()[MEDIUM_CLASS_IDS[index]]);
      // Outside-baseline rows are those whose key sits outside the result's
      // baseline set; the complement is taken over the corpus's projected keys.
      const baselineTaskKeys = new Set(attemptBaseline.baselineTaskKeys);
      const outsideRows = result.perTask.filter(
        (row) => !baselineTaskKeys.has(buildTaskKey(row.definitionKey, row.taskId))
      );
      expect(
        outsideRows.map((row) => buildTaskKey(row.definitionKey, row.taskId)).toSorted(ascending)
      ).toEqual(PROJECTED_TASK_KEYS.filter((key) => !baselineTaskKeys.has(key)));
      expect(result.perTask.length - outsideRows.length).toBe(oracle.baselineTaskKeys.length);
    }
  });

  it('keeps perStudentTaskMetrics identical across the two modes', () => {
    const absolute = new DataAnalysisService().analyse(
      buildMediumInput('absolute', MEDIUM_CLASS_IDS)
    );
    const baseline = new DataAnalysisService().analyse(
      buildMediumInput('topDecileBaseline', MEDIUM_CLASS_IDS)
    );

    // Absolute mode echoes its mode and omits the baseline block entirely.
    for (const result of absolute) {
      expect(result.appliedAnalysisMode).toBe('absolute');
      expect(result).not.toHaveProperty('attemptBaseline');
    }

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

      const oracle = deriveCorpusBaseline(parseMediumClasses()[classId]);
      expect(includedFlags.size).toBe(PROJECTED_TASK_KEYS.length);
      const excludedKeys: string[] = [];
      const includedKeys: string[] = [];
      for (const [key, included] of includedFlags) {
        if (included) {
          includedKeys.push(key);
        } else {
          excludedKeys.push(key);
        }
      }
      const baselineSet = new Set(oracle.baselineTaskKeys);
      expect(excludedKeys.toSorted(ascending)).toEqual(
        PROJECTED_TASK_KEYS.filter((key) => !baselineSet.has(key))
      );
      expect(includedKeys.toSorted(ascending)).toEqual(oracle.baselineTaskKeys);
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

    expect(merged.taskColumns.map((column) => column.taskKey).toSorted(ascending)).toEqual(
      PROJECTED_TASK_KEYS
    );
    for (const column of merged.taskColumns) {
      expect(column.includedInAttemptBaseline).toBe(true);
    }
  });
});

/**
 * Collect the explicit error cause codes from one submission item.
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
