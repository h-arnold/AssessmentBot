import type { AveragingAnalyserInput, AveragingResult, PerClassResult } from '../dataAnalysis.zod';
import { accumulateDataPoints, buildPerStudentTaskMetrics } from './averagingAnalyser.accumulation';
import { filterAssignments } from './averagingAnalyser.filters';
import {
  buildPerStudentRows,
  buildPerTaskRows,
  rollupAccumulators,
} from './averagingAnalyser.rows';
import type { DataPointAccumulator } from './averagingAnalyser.types';

/**
 * Default criterion weightings: completeness=0.4, accuracy=0.4, spag=0.2.
 * Set in the constructor only (AGENTS §11 / frontend §11).
 */
const DEFAULT_CRITERION_WEIGHTINGS = { completeness: 0.4, accuracy: 0.4, spag: 0.2 } as const;

/** Per-criterion weightings configurable at construction time. */
export interface CriterionWeightings {
  completeness: number;
  accuracy: number;
  spag: number;
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
    const sortedClasses = [...input.classes].toSorted((a, b) => a.classId.localeCompare(b.classId));

    return sortedClasses.map((cls) => this.analyseClass(cls, input));
  }

  /**
   * Analyse a single class and produce its AveragingResult.
   *
   * @remarks
   * The per-class rollup now uses `rollupAccumulators` — the same function as
   * per-student and per-task rollups — eliminating the dual-path duplication.
   * When no per-student-task accumulators exist, the fallback passes
   * `[classAccum]` as a single-element array, which delegates to the same
   * `rollupMetric` path as the populated case.
   *
   * @param {AveragingAnalyserInput['classes'][number]} cls - The class data.
   * @param {AveragingAnalyserInput} input - The full analyser input.
   * @returns {AveragingResult} The per-class analysis result.
   */
  private analyseClass(
    cls: AveragingAnalyserInput['classes'][number],
    input: AveragingAnalyserInput
  ): AveragingResult {
    const filteredAssignments = filterAssignments(cls, input);
    const accumulators = accumulateDataPoints(filteredAssignments, input, this.criterionWeightings);

    const perStudent = buildPerStudentRows(
      accumulators.studentAccums,
      accumulators.perStudentTaskAccums,
      this.criterionWeightings
    );
    const perTask = buildPerTaskRows(
      accumulators.taskAccums,
      accumulators.perStudentTaskAccums,
      this.criterionWeightings
    );

    // Build per-class rollup from all per-(student, task) accumulators
    const allPerStudentTaskAccums: DataPointAccumulator[] = [];
    for (const taskMap of accumulators.perStudentTaskAccums.values()) {
      for (const accumulator of taskMap.values()) {
        allPerStudentTaskAccums.push(accumulator);
      }
    }

    const { completeness, accuracy, spag, overall } =
      allPerStudentTaskAccums.length > 0
        ? rollupAccumulators(allPerStudentTaskAccums, this.criterionWeightings)
        : rollupAccumulators([accumulators.classAccum], this.criterionWeightings);

    const perClass: PerClassResult = {
      completeness,
      accuracy,
      spag,
      overall,
    };

    const perStudentTaskMetrics = buildPerStudentTaskMetrics(
      cls.classId,
      accumulators.perStudentTaskAccums
    );

    return {
      classId: cls.classId,
      className: cls.className,
      perStudent,
      perTask,
      perClass,
      appliedCriterionWeightings: { ...this.appliedCriterionWeightings },
      perStudentTaskMetrics,
    };
  }
}
