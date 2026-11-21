/**
 * ClassSummary derivation contract against the canonical `medium` / `class-0`
 * view.
 *
 * The committed view is parsed exactly as
 * `dataAnalysis.mediumBaselineRoundTrip.spec.ts` does with
 * `AveragingAnalyserInputSchema.parse`. The final committed assignment carries
 * a null `studentName` (a documented historical-source boundary that isolated
 * analysis rejects), so successful cases omit only that assignment.
 *
 * Baseline-unavailability and collaborator-error probes live in the sibling
 * `classSummaryAnalyser.boundary.spec.ts`; the local equal-overall tie-break
 * fixture and the baseline fail-fast probes stay here beside the ranking assertions.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import mediumClassesByIdRaw from '@synthetic/medium/classesById.json?raw';
import mediumPartialsRaw from '@synthetic/medium/assignmentDefinitionPartials.json?raw';
import { ClassSummaryAnalyser } from './classSummaryAnalyser';
import { ClassSummarySchema, type ClassSummary } from './classSummary.zod';
import { AveragingAnalyser, DEFAULT_CRITERION_WEIGHTINGS } from './analysers/averagingAnalyser';
import { computeOverallComposite } from './analysers/averagingAnalyser.composite';
import { convertToBaselineExcluded } from './analysers/averagingAnalyser.rows';
import { rollupMetric } from './analysers/rollupMetric';
import {
  AveragingAnalyserInputSchema,
  type AveragingAnalyserInput,
  type AveragingResult,
  type MetricResult,
  type PerStudentTaskMetric,
} from './dataAnalysis.zod';
import type { AssignmentPartial } from '../googleClassrooms/classDetail/classDetailService.zod';
import {
  buildInput,
  createAssignmentPartial,
  createSubmission,
  createSubmissionItem,
  createTaskPartial,
} from '@/test/dataAnalysis/fixtures';

/** Canonical profile class analysed in depth by this suite. */
const MEDIUM_CLASS_ID = 'class-0';

/** Index of the committed final assignment with the null-studentName boundary. */
const FINAL_ASSIGNMENT_INDEX = -1;

/** Maximum number of entries in each standing list. */
const MAX_STANDING_ENTRIES = 3;

/** Default number of recent assignments supplied to the analyser. */
const DEFAULT_RECENT_ASSIGNMENT_COUNT = 3;

/** Score shared by the highest equal-overall tie band. */
const HIGH_TIE_SCORE = 5;

/** Score shared by the middle equal-overall tie band. */
const MID_TIE_SCORE = 4;

/** Score shared by the lowest equal-overall tie band. */
const LOW_TIE_SCORE = 3;

/** Student ids in the highest tie band, deliberately out of score order. */
const HIGH_TIE_IDS = new Set(['s_006', 's_001']);

/** Student ids in the lowest tie band, deliberately out of score order. */
const LOW_TIE_IDS = new Set(['s_005', 's_002']);

/** Number of students in each equal-overall tie band. */
const TIE_BAND_SIZE = 2;

/** Narrow metric-score set derived from the public summary shape. */
type MetricScores = ClassSummary['allTasks']['classAverages'];

/** One standing entry derived from the public summary shape. */
type MetricStanding = ClassSummary['allTasks']['standings']['top'][number];

/** Options passed to the summary entry point. */
interface SummaryOptions {
  target: AssignmentPartial;
  recentAssignments: AssignmentPartial[];
}

/**
 * Build the validated medium input over the historical-source class slice.
 *
 * @returns {AveragingAnalyserInput} The parsed analysis input.
 */
function buildMediumInput(): AveragingAnalyserInput {
  const classesById = JSON.parse(mediumClassesByIdRaw) as Record<
    string,
    { assignments: unknown[] }
  >;
  const classRecord = classesById[MEDIUM_CLASS_ID];
  // The committed final assignment holds the null-studentName boundary.
  const historicalSourceClass = {
    ...classRecord,
    assignments: classRecord.assignments.slice(0, FINAL_ASSIGNMENT_INDEX),
  };
  return AveragingAnalyserInputSchema.parse({
    filter: { classIds: [MEDIUM_CLASS_ID], analysisMode: 'absolute' },
    classes: [historicalSourceClass],
    assignmentDefinitionPartials: JSON.parse(mediumPartialsRaw),
  });
}

/**
 * Build summary options from an input's newest assignments, newest first.
 *
 * @param {AveragingAnalyserInput} input - The validated analysis input.
 * @param {number} [count=3] - Number of recent assignments to supply.
 * @returns {SummaryOptions} The target and newest-first recent assignments.
 */
function buildSummaryOptions(
  input: AveragingAnalyserInput,
  count = DEFAULT_RECENT_ASSIGNMENT_COUNT
): SummaryOptions {
  const assignments = input.classes[0].assignments.toReversed().slice(0, count);
  const target = assignments[0];
  if (!target) throw new Error('classSummaryAnalyser spec: no target assignment available');
  return { target, recentAssignments: assignments };
}

/**
 * Run the summary analyser and validate its output through ClassSummarySchema.
 *
 * @param {AveragingAnalyserInput} input - The validated analysis input.
 * @param {SummaryOptions} options - Target and recent assignments.
 * @returns {ClassSummary} The validated summary.
 */
function analyseSummary(input: AveragingAnalyserInput, options: SummaryOptions): ClassSummary {
  return ClassSummarySchema.parse(new ClassSummaryAnalyser().analyse(input, options));
}

/**
 * Run an absolute-mode AveragingAnalyser over a single assignment instance.
 *
 * @param {AveragingAnalyserInput} input - The full validated input.
 * @param {AssignmentPartial} assignment - The assignment to isolate.
 * @returns {ReturnType<AveragingAnalyser['analyse']>[number]} The isolated result.
 */
function isolatedAbsoluteResult(input: AveragingAnalyserInput, assignment: AssignmentPartial) {
  const isolatedInput: AveragingAnalyserInput = {
    ...input,
    classes: [{ ...input.classes[0], assignments: [assignment] }],
  };
  return new AveragingAnalyser().analyse(isolatedInput)[0];
}

/**
 * Project one aggregate row onto the four-metric summary score set.
 *
 * @param {object} metrics - The four aggregate metrics.
 * @param {MetricResult} metrics.completeness - Completeness result.
 * @param {MetricResult} metrics.accuracy - Accuracy result.
 * @param {MetricResult} metrics.spag - SPaG result.
 * @param {MetricResult} metrics.overall - Overall composite result.
 * @returns {MetricScores} The projected score set.
 */
function projectMetrics(metrics: {
  completeness: MetricResult;
  accuracy: MetricResult;
  spag: MetricResult;
  overall: MetricResult;
}): MetricScores {
  return {
    completeness: metrics.completeness,
    accuracy: metrics.accuracy,
    spag: metrics.spag,
    overall: metrics.overall,
  };
}

/**
 * Independently derive one student's baseline-restricted score set for one
 * isolated assignment, reusing the production rollup helpers named in the spec.
 *
 * @param {AveragingAnalyserInput} input - The full validated input.
 * @param {ReadonlySet<string>} baselineTaskKeys - Whole-class baseline task keys.
 * @param {AssignmentPartial} assignment - The isolated assignment.
 * @param {string} studentId - The ranked student.
 * @returns {MetricScores} The expected baseline score set.
 */
function expectedBaselineScores(
  input: AveragingAnalyserInput,
  baselineTaskKeys: ReadonlySet<string>,
  assignment: AssignmentPartial,
  studentId: string
): MetricScores {
  const isolatedMetrics = isolatedAbsoluteResult(input, assignment).perStudentTaskMetrics ?? [];
  const forStudent = isolatedMetrics.filter((metric) => metric.studentId === studentId);
  const inBaseline = forStudent.filter((metric) => baselineTaskKeys.has(metric.taskKey));
  const source = inBaseline.length > 0 ? inBaseline : forStudent;
  const shouldConvert = inBaseline.length === 0;
  const rollupFor = (criterion: 'completeness' | 'accuracy' | 'spag'): MetricResult => {
    const rolled = rollupMetric(
      source.map((metric: PerStudentTaskMetric) => metric[criterion]),
      criterion
    );
    return shouldConvert ? convertToBaselineExcluded(rolled) : rolled;
  };
  const completeness = rollupFor('completeness');
  const accuracy = rollupFor('accuracy');
  const spag = rollupFor('spag');
  return {
    completeness,
    accuracy,
    spag,
    overall: computeOverallComposite(completeness, accuracy, spag, DEFAULT_CRITERION_WEIGHTINGS),
  };
}

/**
 * Assert the comparator invariants of one standings basis.
 *
 * @param {ClassSummary['allTasks']['standings']} standings - The basis standings.
 */
function expectValidStandings(standings: ClassSummary['allTasks']['standings']): void {
  expect(standings.top.length).toBeLessThanOrEqual(MAX_STANDING_ENTRIES);
  expect(standings.bottom.length).toBeLessThanOrEqual(MAX_STANDING_ENTRIES);

  for (const entry of [...standings.top, ...standings.bottom]) {
    expect(entry.scores.overall.state).toBe('computed');
    expect(Number.isFinite(entry.scores.overall.value as number)).toBe(true);
  }

  const assertOrdered = (entries: MetricStanding[], direction: 'desc' | 'asc'): void => {
    for (let index = 0; index + 1 < entries.length; index++) {
      const current = entries[index].scores.overall.value as number;
      const next = entries[index + 1].scores.overall.value as number;
      if (current === next) {
        expect(entries[index].studentId < entries[index + 1].studentId).toBe(true);
      } else if (direction === 'desc') {
        expect(current).toBeGreaterThan(next);
      } else {
        expect(current).toBeLessThan(next);
      }
    }
  };
  assertOrdered(standings.top, 'desc');
  assertOrdered(standings.bottom, 'asc');

  const topIds = new Set(standings.top.map((entry) => entry.studentId));
  expect(standings.bottom.every((entry) => !topIds.has(entry.studentId))).toBe(true);
}

/**
 * Build one submission whose three criteria share a single numeric score.
 *
 * @param {string} studentId - Owning student.
 * @param {number} score - Shared criterion score.
 * @returns {ReturnType<typeof createSubmission>} The submission fixture.
 */
function createTieSubmission(studentId: string, score: number) {
  return createSubmission(studentId, `Student ${studentId}`, 'a_tie', {
    t_001: createSubmissionItem('t_001', {
      completeness: { score },
      accuracy: { score },
      spag: { score },
    }),
  });
}

/**
 * Build a local input with three equal-overall bands of two students each.
 *
 * Students in a band submit identical criterion scores, so their numeric
 * `overall` composites are exactly equal. Ids are deliberately out of score
 * order so the ascending-`studentId` tie-break is observable in both standings.
 *
 * @returns {AveragingAnalyserInput} The validated six-student input.
 */
function buildEqualOverallTieInput(): AveragingAnalyserInput {
  const assignment = createAssignmentPartial({
    assignmentId: 'a_tie',
    definitionKey: 'dk_tie',
    tasks: [createTaskPartial('t_001')],
    submissions: [
      createTieSubmission('s_006', HIGH_TIE_SCORE),
      createTieSubmission('s_001', HIGH_TIE_SCORE),
      createTieSubmission('s_004', MID_TIE_SCORE),
      createTieSubmission('s_003', MID_TIE_SCORE),
      createTieSubmission('s_005', LOW_TIE_SCORE),
      createTieSubmission('s_002', LOW_TIE_SCORE),
    ],
  });
  const input = buildInput([
    {
      classId: 'c_tie',
      className: 'Tie-break Class',
      studentIds: ['s_001', 's_002', 's_003', 's_004', 's_005', 's_006'],
      assignments: [assignment],
    },
  ]);
  input.classes[0].assignments[0].updatedAt = '2026-01-01T00:00:00.000Z';
  return AveragingAnalyserInputSchema.parse(input);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ClassSummaryAnalyser — canonical medium derivation', () => {
  it('reports full-class averages equal to the corresponding AveragingAnalyser perClass results', () => {
    const input = buildMediumInput();
    const summary = analyseSummary(input, buildSummaryOptions(input));

    const absolute = new AveragingAnalyser().analyse(input)[0];
    const baselineInput: AveragingAnalyserInput = {
      ...input,
      filter: { ...input.filter, analysisMode: 'topDecileBaseline' },
    };
    const baseline = new AveragingAnalyser().analyse(baselineInput)[0];

    expect(summary.allTasks.classAverages).toEqual(absolute.perClass);
    expect(summary.baseline.available).toBe(true);
    expect(summary.baseline.classAverages).toEqual(baseline.perClass);
  });

  it('ranks only finite numeric overall metrics with disjoint 0–3 top and bottom lists', () => {
    const input = buildMediumInput();
    const summary = analyseSummary(input, buildSummaryOptions(input));

    expectValidStandings(summary.allTasks.standings);
    if (!summary.baseline.standings) {
      throw new Error('available baseline summary must carry standings');
    }
    expectValidStandings(summary.baseline.standings);
  });

  it('uses the whole-class baseline keys for isolated scores and excludes students without baseline metrics', () => {
    const input = buildMediumInput();
    const options = buildSummaryOptions(input);
    const summary = analyseSummary(input, options);

    const baselineInput: AveragingAnalyserInput = {
      ...input,
      filter: { ...input.filter, analysisMode: 'topDecileBaseline' },
    };
    const baselineResult = new AveragingAnalyser().analyse(baselineInput)[0];
    if (!baselineResult.attemptBaseline) {
      throw new Error('canonical medium fixture must be baseline-eligible');
    }
    if (!summary.baseline.standings) {
      throw new Error('available baseline summary must carry standings');
    }
    const baselineKeys = new Set(baselineResult.attemptBaseline.baselineTaskKeys);

    // If the analyser re-derived a baseline per assignment, these independently
    // rolled scores (built from the whole-class keys) would not match.
    for (const entry of [...summary.baseline.standings.top, ...summary.baseline.standings.bottom]) {
      expect(entry.recentAssignmentScores).toHaveLength(options.recentAssignments.length);
      options.recentAssignments.forEach((assignment, index) => {
        expect(entry.recentAssignmentScores[index]).toEqual(
          expectedBaselineScores(input, baselineKeys, assignment, entry.studentId)
        );
      });
    }
  });

  it('aligns recentAssignmentScores by index with newest-first recentAssignments', () => {
    const input = buildMediumInput();
    const options = buildSummaryOptions(input);
    const summary = analyseSummary(input, options);

    const times = options.recentAssignments.map((assignment) => assignment.updatedAt ?? '');
    expect(times).toEqual([...times].toSorted((a, b) => b.localeCompare(a)));
    expect(summary.recentAssignments).toEqual(
      options.recentAssignments.map((assignment) => {
        return {
          assignmentId: assignment.assignmentId,
          assignmentDefinitionKey: assignment.assignmentDefinitionKey,
          updatedAt: assignment.updatedAt,
        };
      })
    );

    const entries = [...summary.allTasks.standings.top, ...summary.allTasks.standings.bottom];
    for (const entry of entries) {
      expect(entry.recentAssignmentScores).toHaveLength(options.recentAssignments.length);
      options.recentAssignments.forEach((assignment, index) => {
        const row = isolatedAbsoluteResult(input, assignment).perStudent.find(
          (candidate) => candidate.studentId === entry.studentId
        );
        if (!row) throw new Error(`no isolated row for student ${entry.studentId}`);
        expect(entry.recentAssignmentScores[index]).toEqual(projectMetrics(row));
      });
    }
  });

  it('shortens score arrays only when fewer assignments are supplied', () => {
    const input = buildMediumInput();
    const summary = analyseSummary(input, buildSummaryOptions(input, 1));

    expect(summary.recentAssignments).toHaveLength(1);
    for (const entry of [...summary.allTasks.standings.top, ...summary.allTasks.standings.bottom]) {
      expect(entry.recentAssignmentScores).toHaveLength(1);
    }
  });
});

describe('ClassSummaryAnalyser — deterministic ranking tie-break', () => {
  it('breaks exactly equal overall scores by ascending studentId in both top and bottom lists', () => {
    const input = buildEqualOverallTieInput();
    const summary = analyseSummary(input, buildSummaryOptions(input, 1));
    const { top, bottom } = summary.allTasks.standings;

    const highTie = top.filter((entry: MetricStanding) => HIGH_TIE_IDS.has(entry.studentId));
    const lowTie = bottom.filter((entry: MetricStanding) => LOW_TIE_IDS.has(entry.studentId));

    // Each band shares an identical numeric overall by construction.
    expect(highTie).toHaveLength(TIE_BAND_SIZE);
    expect(lowTie).toHaveLength(TIE_BAND_SIZE);
    expect(highTie[0].scores.overall.value).toBe(highTie[1].scores.overall.value);
    expect(lowTie[0].scores.overall.value).toBe(lowTie[1].scores.overall.value);
    expect(Number.isFinite(highTie[0].scores.overall.value as number)).toBe(true);
    expect(Number.isFinite(lowTie[0].scores.overall.value as number)).toBe(true);

    // Descending top and ascending bottom both resolve ties by studentId ascending.
    expect(highTie.map((entry: MetricStanding) => entry.studentId)).toEqual(['s_001', 's_006']);
    expect(lowTie.map((entry: MetricStanding) => entry.studentId)).toEqual(['s_002', 's_005']);
  });
});

describe('ClassSummaryAnalyser — baseline fail-fast probes', () => {
  it('fails fast with the deriveBaselineTaskKeySet error when a baseline result omits its attemptBaseline block', () => {
    const input = buildMediumInput();
    const options = buildSummaryOptions(input);
    const realBaseline = new AveragingAnalyser().analyse({
      ...input,
      filter: { ...input.filter, analysisMode: 'topDecileBaseline' },
    })[0];
    const malformedBaseline = {
      ...realBaseline,
      appliedAnalysisMode: 'topDecileBaseline' as const,
    };
    delete malformedBaseline.attemptBaseline;

    const originalAnalyse = AveragingAnalyser.prototype.analyse;
    vi.spyOn(AveragingAnalyser.prototype, 'analyse').mockImplementation(function (
      this: AveragingAnalyser,
      analyseInput: AveragingAnalyserInput
    ): AveragingResult[] {
      return analyseInput.filter.analysisMode === 'topDecileBaseline'
        ? [malformedBaseline]
        : originalAnalyse.call(this, analyseInput);
    });

    let thrown: unknown;
    try {
      new ClassSummaryAnalyser().analyse(input, options);
    } catch (error: unknown) {
      thrown = error;
    }
    // The helper's exact message proves the baseline branch ran and did not
    // silently fall back to all-task scores under the baseline basis.
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toBe(
      `ClassSummaryAnalyser: baseline-mode analyser result for class '${MEDIUM_CLASS_ID}' is missing the required attemptBaseline block`
    );
  });

  it('fails loudly when an isolated result omits perStudentTaskMetrics instead of emitting excluded scores', () => {
    const input = buildMediumInput();
    const options = buildSummaryOptions(input);
    const originalAnalyse = AveragingAnalyser.prototype.analyse;
    vi.spyOn(AveragingAnalyser.prototype, 'analyse').mockImplementation(function (
      this: AveragingAnalyser,
      analyseInput: AveragingAnalyserInput
    ): AveragingResult[] {
      const results = originalAnalyse.call(this, analyseInput);
      if (analyseInput.filter.analysisMode === 'topDecileBaseline') return results;
      // A collaborator result that lost the optional metrics must not silently
      // become excluded-style scores through an empty-array fallback.
      return results.map((result) => {
        const withoutMetrics = { ...result };
        delete withoutMetrics.perStudentTaskMetrics;
        return withoutMetrics;
      });
    });

    expect(() => new ClassSummaryAnalyser().analyse(input, options)).toThrow();
  });
});
