import type {
  AveragingAnalyserInput,
  AveragingResult,
  PerClassResult,
  PerStudentTaskMetric,
} from '../dataAnalysis.zod';
import { accumulateDataPoints } from './averagingAnalyser.accumulation';
import { createDataPointAccumulator } from './averagingAnalyser.accumulatorRegistry';
import { filterAssignments } from './averagingAnalyser.filters';
import {
  buildPerStudentRows,
  buildPerTaskRows,
  filterAccumulatorsByBaseline,
  rollupAccumulators,
} from './averagingAnalyser.rows';
import { buildPerStudentTaskMetrics } from './averagingAnalyser.taskProjection';
import type { DataPointAccumulator } from './averagingAnalyser.types';
import { deriveAttemptBaseline } from './attemptBaselineSelection';

/**
 * Default criterion weightings: completeness=0.4, accuracy=0.4, spag=0.2.
 * Set in the constructor only (root `AGENTS.md` Prime Directive 2.1.10 / `src/frontend/AGENTS.md` §2).
 */
export const DEFAULT_CRITERION_WEIGHTINGS = {
  completeness: 0.4,
  accuracy: 0.4,
  spag: 0.2,
} as const;

/** Per-criterion weightings configurable at construction time. */
export interface CriterionWeightings {
  completeness: number;
  accuracy: number;
  spag: number;
}

/**
 * Per-class baseline derivation: the transparency block emitted on the result
 * plus the baseline task-key set used to scope the aggregation.
 */
interface ClassBaseline {
  attemptBaseline: NonNullable<AveragingResult['attemptBaseline']>;
  baselineTaskKeys: ReadonlySet<string>;
}

/**
 * Derive one class's attempt baseline in `topDecileBaseline` mode; `null` in
 * `absolute` mode.
 *
 * @remarks
 * The derivation consumes the mode-invariant per-(student, task) metrics
 * (post-accumulation, no second raw-data walk) and the class's own roster, so
 * each class derives its pool and baseline independently (data-shape item 3;
 * docs/developer/frontend/data-analysis-architecture.md § Attempt-baseline
 * mode).
 *
 * @param {AveragingAnalyserInput['classes'][number]} cls - The class data.
 * @param {AveragingAnalyserInput['filter']['analysisMode']} analysisMode - The analysis mode.
 * @param {ReadonlyArray<PerStudentTaskMetric>} perStudentTaskMetrics - The
 *   mode-invariant per-(student, task) metrics.
 * @returns {ClassBaseline | null} The baseline, or `null` in absolute mode.
 * @throws {Error} When the derived baseline task set is empty: the failure
 *   propagates from {@link deriveAttemptBaseline} (data-shape item 3;
 *   docs/developer/frontend/data-analysis-architecture.md § Attempt-baseline
 *   mode), so the descriptive failure names the class and no result is
 *   produced.
 */
function deriveClassBaseline(
  cls: AveragingAnalyserInput['classes'][number],
  analysisMode: AveragingAnalyserInput['filter']['analysisMode'],
  perStudentTaskMetrics: ReadonlyArray<PerStudentTaskMetric>
): ClassBaseline | null {
  if (analysisMode !== 'topDecileBaseline') {
    return null;
  }
  const derivation = deriveAttemptBaseline({
    classId: cls.classId,
    rosterStudentIds: cls.students.map((student) => student.id),
    perStudentTaskMetrics,
  });
  return {
    attemptBaseline: {
      poolStudentIds: derivation.poolStudentIds,
      baselineTaskKeys: derivation.baselineTaskKeys,
    },
    baselineTaskKeys: new Set(derivation.baselineTaskKeys),
  };
}

/**
 * Collect the per-(student, task) accumulators for the per-class rollup,
 * restricted to the baseline task set in baseline mode.
 *
 * @remarks
 * The per-class rollup keeps today's all-accumulator scope in both modes
 * apart from the task-key restriction: the pool is the only roster-scoped
 * step, so a submission student id outside the roster keeps its evidence.
 *
 * @param {ReadonlyMap<string, Map<string, DataPointAccumulator>>}
 *   perStudentTaskAccums - The per-(student, task) accumulators.
 * @param {ReadonlySet<string> | undefined} baselineTaskKeys - The class's
 *   baseline task keys; `undefined` in absolute mode.
 * @returns {DataPointAccumulator[]} The class-scoped accumulators.
 */
function collectClassAccumulators(
  perStudentTaskAccums: ReadonlyMap<string, Map<string, DataPointAccumulator>>,
  baselineTaskKeys: ReadonlySet<string> | undefined
): DataPointAccumulator[] {
  const classAccums: DataPointAccumulator[] = [];
  for (const taskMap of perStudentTaskAccums.values()) {
    classAccums.push(...filterAccumulatorsByBaseline(taskMap, baselineTaskKeys));
  }
  return classAccums;
}

/**
 * Pure synchronous class that computes weighted averages for completeness,
 * accuracy, SPaG, and overall metrics.
 *
 * @remarks
 * The analyser trusts its input is already Zod-validated by the orchestrator.
 * Task-weighting resolution avoids N+1 `getAssignmentDefinition` calls
 * by cross-referencing the pre-fetched `assignmentDefinitionPartials`
 * collection.
 *
 * SPaG `'N'` causes renormalisation of the overall metric denominator
 * (the criterion weight for SPaG is excluded from both numerator and
 * denominator).
 *
 * All output arrays are deterministically sorted for testability:
 * - `perStudent`: `studentName` asc, then `studentId` asc
 *   tie-breaker
 * - `perTask`: `(definitionKey, taskId)` asc
 * - `AveragingResult[]`: `classId` asc
 */
export class AveragingAnalyser {
  private readonly criterionWeightings: CriterionWeightings;

  private readonly appliedCriterionWeightings: CriterionWeightings;

  /**
   * Constructs an AveragingAnalyser with the given criterion weightings.
   *
   * @param {CriterionWeightings} [criterionWeightings] - Optional weighting overrides.
   *   Defaults to `{ completeness: 0.4, accuracy: 0.4, spag: 0.2 }`.
   *   Defaults are set in the constructor only.
   */
  constructor(criterionWeightings?: CriterionWeightings) {
    const resolved = criterionWeightings ?? DEFAULT_CRITERION_WEIGHTINGS;
    this.criterionWeightings = resolved;
    this.appliedCriterionWeightings = { ...resolved };
  }

  /**
   * Run the averaging analysis over the provided input.
   *
   * @param {AveragingAnalyserInput} input - Fully assembled input data.
   * @returns {AveragingResult[]} An array of per-class results sorted by classId.
   */
  analyse(input: AveragingAnalyserInput): AveragingResult[] {
    // Build filter Sets once — they depend only on input.filter, which is
    // identical for every class in one analyse() run.
    const topicKeySet: Set<string> | undefined = input.filter.topicKeys?.length
      ? new Set(input.filter.topicKeys)
      : undefined;
    const definitionKeySet: Set<string> | undefined = input.filter.assignmentDefinitionKeys?.length
      ? new Set(input.filter.assignmentDefinitionKeys)
      : undefined;

    const sortedClasses = [...input.classes].toSorted((a, b) => a.classId.localeCompare(b.classId));

    return sortedClasses.map((cls) => this.analyseClass(cls, input, topicKeySet, definitionKeySet));
  }

  /**
   * Analyse a single class and produce its AveragingResult.
   *
   * @remarks
   * The per-class rollup uses `rollupAccumulators`, the same function as the
   * per-student and per-task rollups. When no per-student-task accumulators
   * exist, a fresh empty accumulator follows the same `rollupMetric` path and
   * yields the no-data `error` result without maintaining a write-only class
   * accumulator.
   *
   * @param {AveragingAnalyserInput['classes'][number]} cls - The class data.
   * @param {AveragingAnalyserInput} input - The full analyser input.
   * @param {Set<string> | undefined} topicKeySet - Optional set of topic keys
   *   to include (built once per analyse() call).
   * @param {Set<string> | undefined} definitionKeySet - Optional set of
   *   definition keys to include (built once per analyse() call).
   * @returns {AveragingResult} The per-class analysis result.
   */
  private analyseClass(
    cls: AveragingAnalyserInput['classes'][number],
    input: AveragingAnalyserInput,
    topicKeySet: Set<string> | undefined,
    definitionKeySet: Set<string> | undefined
  ): AveragingResult {
    const filteredAssignments = filterAssignments(cls, input, topicKeySet, definitionKeySet);
    const accumulators = accumulateDataPoints(filteredAssignments, input, this.criterionWeightings);

    // Heatmap-facing evidence is mode-invariant: project it before any
    // baseline scoping so both modes emit identical per-(student, task) metrics.
    const perStudentTaskMetrics = buildPerStudentTaskMetrics(
      cls.classId,
      accumulators.perStudentTaskAccums,
      accumulators.averageContributionByTaskKey
    );

    const baseline = deriveClassBaseline(cls, input.filter.analysisMode, perStudentTaskMetrics);
    const baselineTaskKeys = baseline?.baselineTaskKeys;

    const perStudent = buildPerStudentRows(
      accumulators.studentAccums,
      accumulators.perStudentTaskAccums,
      this.criterionWeightings,
      baselineTaskKeys
    );
    const perTask = buildPerTaskRows(
      accumulators.taskAccums,
      this.criterionWeightings,
      accumulators.averageContributionByTaskKey
    );

    // Build per-class rollup from all per-(student, task) accumulators,
    // restricted to the baseline task set in baseline mode (the pool is the
    // only roster-scoped step; the outside-roster submitter keeps its row).
    const allPerStudentTaskAccums = collectClassAccumulators(
      accumulators.perStudentTaskAccums,
      baselineTaskKeys
    );

    const { completeness, accuracy, spag, overall } = rollupAccumulators(
      allPerStudentTaskAccums.length > 0 ? allPerStudentTaskAccums : [createDataPointAccumulator()],
      this.criterionWeightings
    );

    const perClass: PerClassResult = {
      completeness,
      accuracy,
      spag,
      overall,
    };

    const result: AveragingResult = {
      classId: cls.classId,
      className: cls.className,
      perStudent,
      perTask,
      perClass,
      appliedCriterionWeightings: { ...this.appliedCriterionWeightings },
      appliedAnalysisMode: input.filter.analysisMode,
      perStudentTaskMetrics,
    };
    if (baseline) {
      result.attemptBaseline = baseline.attemptBaseline;
    }
    return result;
  }
}
