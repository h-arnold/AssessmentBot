import type { AssignmentPartial } from '../googleClassrooms/classDetail/classDetailService.zod';
import { AttemptBaselineUnavailableError } from './analysers/attemptBaselineSelection';
import {
  AveragingAnalyser,
  DEFAULT_CRITERION_WEIGHTINGS,
  type CriterionWeightings,
} from './analysers/averagingAnalyser';
import { computeOverallComposite } from './analysers/averagingAnalyser.composite';
import { convertToBaselineExcluded } from './analysers/averagingAnalyser.rows';
import { rollupMetric, type RollupMetric } from './analysers/rollupMetric';
import type {
  AveragingAnalyserInput,
  AveragingResult,
  MetricResult,
  PerStudentRow,
  PerStudentTaskMetric,
} from './dataAnalysis.zod';
import type {
  ClassSummary,
  MetricScores,
  MetricStanding,
  MetricStandings,
} from './classSummary.zod';

/** Maximum number of entries in either standing list. */
const MAX_STANDING_ENTRIES = 3;

/** Direction used when ordering rankable students by their overall metric. */
type RankDirection = 'desc' | 'asc';

/** The four aggregate metrics carried by a score set. */
interface MetricSet {
  completeness: MetricResult;
  accuracy: MetricResult;
  spag: MetricResult;
  overall: MetricResult;
}

/** Caller-supplied assignment instances; the analyser performs no freshness selection. */
export interface AnalyseClassSummaryOptions {
  target: AssignmentPartial;
  recentAssignments: AssignmentPartial[];
}

/**
 * Project an aggregate result onto the four analyser-native score fields.
 *
 * @param {MetricSet} metrics - Source aggregate metrics.
 * @returns {MetricScores} The projected score set.
 */
function projectScores(metrics: MetricSet): MetricScores {
  return {
    completeness: metrics.completeness,
    accuracy: metrics.accuracy,
    spag: metrics.spag,
    overall: metrics.overall,
  };
}

/**
 * Copy a supplied assignment's identity into the summary, unchanged.
 *
 * @param {AssignmentPartial} assignment - The supplied assignment instance.
 * @returns {{ assignmentId: string; assignmentDefinitionKey: string; updatedAt: string | null }}
 *   The identity fields copied verbatim.
 */
function assignmentIdentity(assignment: AssignmentPartial): {
  assignmentId: string;
  assignmentDefinitionKey: string;
  updatedAt: string | null;
} {
  return {
    assignmentId: assignment.assignmentId,
    assignmentDefinitionKey: assignment.assignmentDefinitionKey,
    updatedAt: assignment.updatedAt,
  };
}

/**
 * Whether one isolated result carries a row for the given student.
 *
 * @param {AveragingResult} result - The isolated result to inspect.
 * @param {string} studentId - The student to find.
 * @returns {boolean} True when the student has a row.
 */
function hasRowForStudent(result: AveragingResult, studentId: string): boolean {
  return result.perStudent.some((candidate) => candidate.studentId === studentId);
}

/**
 * Fetch a student's row from one isolated result, failing fast on a missing row.
 *
 * @param {ReadonlyArray<PerStudentRow>} rows - The isolated result's student rows.
 * @param {string} studentId - The student to find.
 * @param {string} context - Caller name prefixed onto the failure message.
 * @returns {PerStudentRow} The student's row.
 */
function requireStudentRow(
  rows: ReadonlyArray<PerStudentRow>,
  studentId: string,
  context: string
): PerStudentRow {
  const row = rows.find((candidate) => candidate.studentId === studentId);
  if (!row) {
    throw new Error(`${context}: no isolated row for student '${studentId}'`);
  }
  return row;
}

/**
 * Single owner of the in-memory class-summary calculation.
 *
 * @remarks
 * Composes {@link AveragingAnalyser} for the full-class absolute and baseline results
 * and for each isolated recent assignment, then assembles the disjoint standings. No
 * averaging maths is reimplemented here; the exported `rollupMetric`,
 * `computeOverallComposite` and `convertToBaselineExcluded` helpers do the work.
 */
export class ClassSummaryAnalyser {
  private readonly criterionWeightings: CriterionWeightings;

  /**
   * Construct the analyser with the criterion weightings used for every composite.
   *
   * @param {CriterionWeightings} [criterionWeightings] - Optional overrides; the
   *   constructor's standard 40/40/20 weighting is the default.
   */
  constructor(criterionWeightings?: CriterionWeightings) {
    this.criterionWeightings = criterionWeightings ?? DEFAULT_CRITERION_WEIGHTINGS;
  }

  /**
   * Build a validated-class summary from the supplied assignment instances.
   *
   * @param {AveragingAnalyserInput} input - Validated full-class analysis input.
   * @param {AnalyseClassSummaryOptions} options - Target and newest-first recent assignments.
   * @returns {ClassSummary} The assembled summary (validated by the service schema).
   * @remarks
   * The all-tasks basis is always computed in absolute mode, regardless of the input's
   * `filter.analysisMode`, so `allTasks` never silently becomes the baseline basis.
   * Baseline task keys are read only from the full-class baseline result and reused
   * for every isolated assignment; no isolated analysis runs in baseline mode, so no
   * second pool or baseline is derived.
   */
  analyse(input: AveragingAnalyserInput, options: AnalyseClassSummaryOptions): ClassSummary {
    const absoluteInput: AveragingAnalyserInput = {
      ...input,
      filter: { ...input.filter, analysisMode: 'absolute' },
    };
    const absolute = this.analyseAveraging(absoluteInput);
    const baseline = this.analyseBaseline(input);
    const { recentAssignments } = options;
    const isolated = recentAssignments.map((assignment) => this.analyseIsolated(input, assignment));
    const targetScores = this.analyseIsolated(input, options.target);
    const baselineKeys = baseline?.attemptBaseline
      ? new Set(baseline.attemptBaseline.baselineTaskKeys)
      : null;

    const allTaskStandings = this.buildStandings(absolute.perStudent, isolated, null);
    const baselineStandings = baseline
      ? this.buildStandings(baseline.perStudent, isolated, baselineKeys)
      : null;

    return {
      classId: absolute.classId,
      allTasks: {
        classAverages: projectScores(absolute.perClass),
        standings: allTaskStandings,
      },
      baseline: {
        available: baseline !== null,
        classAverages: baseline ? projectScores(baseline.perClass) : null,
        standings: baselineStandings,
      },
      target: {
        ...assignmentIdentity(options.target),
        averages: projectScores(targetScores.perClass),
      },
      recentAssignments: recentAssignments.map((assignment) => assignmentIdentity(assignment)),
    };
  }

  /**
   * Run the averaging analyser in the supplied input's mode.
   *
   * @param {AveragingAnalyserInput} input - Validated analysis input.
   * @returns {AveragingResult} The first (single) class result.
   */
  private analyseAveraging(input: AveragingAnalyserInput): AveragingResult {
    return new AveragingAnalyser(this.criterionWeightings).analyse(input)[0];
  }

  /**
   * Run the full-class baseline analysis, representing documented unavailability as null.
   *
   * @param {AveragingAnalyserInput} input - Validated full-class input; its analysis mode is overridden to baseline internally.
   * @returns {AveragingResult | null} The baseline result, or null when unavailable.
   * @remarks
   * Only {@link AttemptBaselineUnavailableError} is caught. It is the sole signal for
   * the three documented baseline-unavailability conditions; every other failure is a
   * genuine fault and propagates unchanged without message matching or a broad catch.
   */
  private analyseBaseline(input: AveragingAnalyserInput): AveragingResult | null {
    const baselineInput: AveragingAnalyserInput = {
      ...input,
      filter: { ...input.filter, analysisMode: 'topDecileBaseline' },
    };
    try {
      return this.analyseAveraging(baselineInput);
    } catch (error: unknown) {
      if (error instanceof AttemptBaselineUnavailableError) return null;
      throw error;
    }
  }

  /**
   * Run an isolated absolute analysis for one assignment instance.
   *
   * @param {AveragingAnalyserInput} input - The full validated input.
   * @param {AssignmentPartial} assignment - The assignment to isolate.
   * @returns {AveragingResult} The isolated absolute result for the first class.
   * @remarks
   * Absolute mode is pinned explicitly so an isolated analysis never derives its own
   * pool or baseline; the whole-class baseline keys are applied later by the rollup.
   */
  private analyseIsolated(
    input: AveragingAnalyserInput,
    assignment: AssignmentPartial
  ): AveragingResult {
    const isolatedInput: AveragingAnalyserInput = {
      ...input,
      filter: { ...input.filter, analysisMode: 'absolute' },
      classes: [{ ...input.classes[0], assignments: [assignment] }],
    };
    return this.analyseAveraging(isolatedInput);
  }

  /**
   * Build the disjoint, ordered top and bottom standings for one basis.
   *
   * @param {ReadonlyArray<PerStudentRow>} students - The basis's per-student rows.
   * @param {ReadonlyArray<AveragingResult>} isolated - Per-recent-assignment absolute results.
   * @param {ReadonlySet<string> | null} baselineKeys - Whole-class baseline keys for
   *   the baseline basis; null for the all-task basis.
   * @returns {MetricStandings} The top three and bottom three from remaining students.
   * @remarks
   * A standing entry carries one score per supplied recent assignment, so only
   * students with a row in every isolated analysis can form a complete, aligned
   * entry. Students whose evidence is confined to other assignments are not ranked.
   */
  private buildStandings(
    students: ReadonlyArray<PerStudentRow>,
    isolated: ReadonlyArray<AveragingResult>,
    baselineKeys: ReadonlySet<string> | null
  ): MetricStandings {
    const rankable = students.filter((row) => {
      return (
        row.overall.state === 'computed' &&
        Number.isFinite(row.overall.value) &&
        isolated.every((result) => hasRowForStudent(result, row.studentId))
      );
    });
    const top = [...rankable]
      .toSorted((a, b) => this.compareByOverall(a, b, 'desc'))
      .slice(0, MAX_STANDING_ENTRIES);
    const topIds = new Set(top.map((row) => row.studentId));
    const bottom = rankable
      .filter((row) => !topIds.has(row.studentId))
      .toSorted((a, b) => this.compareByOverall(a, b, 'asc'))
      .slice(0, MAX_STANDING_ENTRIES);
    return {
      top: top.map((row) => this.buildStanding(row, isolated, baselineKeys)),
      bottom: bottom.map((row) => this.buildStanding(row, isolated, baselineKeys)),
    };
  }

  /**
   * Order two rankable rows by overall score with an ascending studentId tie-break.
   *
   * @param {PerStudentRow} a - First row.
   * @param {PerStudentRow} b - Second row.
   * @param {RankDirection} direction - Descending for top, ascending for bottom.
   * @returns {number} Comparator result.
   */
  private compareByOverall(a: PerStudentRow, b: PerStudentRow, direction: RankDirection): number {
    const aValue = a.overall.value as number;
    const bValue = b.overall.value as number;
    const difference = direction === 'desc' ? bValue - aValue : aValue - bValue;
    if (difference !== 0) return difference;
    return a.studentId.localeCompare(b.studentId);
  }

  /**
   * Assemble one standing entry with the aligned per-assignment score array.
   *
   * @param {PerStudentRow} row - The ranked basis row.
   * @param {ReadonlyArray<AveragingResult>} isolated - Per-recent-assignment absolute results.
   * @param {ReadonlySet<string> | null} baselineKeys - Whole-class baseline keys, or
   *   null for the all-task basis.
   * @returns {MetricStanding} The assembled entry.
   */
  private buildStanding(
    row: PerStudentRow,
    isolated: ReadonlyArray<AveragingResult>,
    baselineKeys: ReadonlySet<string> | null
  ): MetricStanding {
    if (row.studentName === null) {
      throw new Error(`ClassSummaryAnalyser: null studentName for student '${row.studentId}'`);
    }
    const recentAssignmentScores = isolated.map((result) => {
      if (baselineKeys === null) {
        return projectScores(
          requireStudentRow(result.perStudent, row.studentId, 'ClassSummaryAnalyser')
        );
      }
      return this.baselineScores(result, row.studentId, baselineKeys);
    });
    return {
      studentId: row.studentId,
      studentName: row.studentName,
      scores: projectScores(row),
      recentAssignmentScores,
    };
  }

  /**
   * Derive one student's baseline-restricted scores for one isolated assignment.
   *
   * @param {AveragingResult} isolatedResult - The isolated absolute result.
   * @param {string} studentId - The ranked student.
   * @param {ReadonlySet<string>} baselineKeys - Whole-class baseline task keys.
   * @returns {MetricScores} The baseline-basis score set.
   * @remarks
   * The keys come only from the full-class baseline result, never from this isolated
   * analysis. Task display metrics are valid `MetricResult` inputs (the three-state
   * display union is a subset of the four-state union), so they pass straight to
   * `rollupMetric` with no conversion layer. A student with no baseline metrics is
   * rolled up over their unfiltered evidence and each criterion is converted with
   * `convertToBaselineExcluded` before the overall composite is derived.
   */
  private baselineScores(
    isolatedResult: AveragingResult,
    studentId: string,
    baselineKeys: ReadonlySet<string>
  ): MetricScores {
    const metrics = isolatedResult.perStudentTaskMetrics ?? [];
    const forStudent = metrics.filter((metric) => metric.studentId === studentId);
    const inBaseline = forStudent.filter((metric) => baselineKeys.has(metric.taskKey));
    const source = inBaseline.length > 0 ? inBaseline : forStudent;
    const shouldConvert = inBaseline.length === 0;
    const completeness = this.rollCriterion(source, 'completeness', shouldConvert);
    const accuracy = this.rollCriterion(source, 'accuracy', shouldConvert);
    const spag = this.rollCriterion(source, 'spag', shouldConvert);
    return {
      completeness,
      accuracy,
      spag,
      overall: computeOverallComposite(completeness, accuracy, spag, this.criterionWeightings),
    };
  }

  /**
   * Roll up one criterion from a student's per-task display metrics.
   *
   * @param {ReadonlyArray<PerStudentTaskMetric>} source - Baseline or unfiltered metrics.
   * @param {RollupMetric} criterion - The criterion to roll up.
   * @param {boolean} shouldConvert - Whether to apply the baseline-excluded conversion.
   * @returns {MetricResult} The rolled (and optionally converted) metric.
   */
  private rollCriterion(
    source: ReadonlyArray<PerStudentTaskMetric>,
    criterion: RollupMetric,
    shouldConvert: boolean
  ): MetricResult {
    const rolled = rollupMetric(
      source.map((metric) => metric[criterion]),
      criterion
    );
    return shouldConvert ? convertToBaselineExcluded(rolled) : rolled;
  }
}
