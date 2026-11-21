import { AveragingAnalyser } from './analysers/averagingAnalyser';
import { AveragingAnalyserInputSchema, DataAnalysisResponseSchema } from './dataAnalysis.zod';
import type { AveragingAnalyserInput, DataAnalysisResponse } from './dataAnalysis.zod';
import { AssignmentSummaryAnalyser } from './analysers/assignmentSummaryAnalyser';
import { AssignmentSummarySchema, type AssignmentSummary } from './assignmentSummary.zod';
import { ClassSummaryAnalyser, type AnalyseClassSummaryOptions } from './classSummaryAnalyser';
import { ClassSummarySchema, type ClassSummary } from './classSummary.zod';

/**
 * Thin stateless orchestrator that validates input, runs the averaging
 * analyser, and returns its typed results.
 *
 * @remarks
 * The orchestrator composes a single {@link AveragingAnalyser} constructed
 * directly in the constructor. Descriptive task summaries and class summaries
 * are delegated to their own analyser fields.
 *
 * The orchestrator itself performs no I/O or logging. Validation failures are
 * rethrown for the consumer boundary to log with contextual metadata,
 * including `zodIssues` for Zod validation failures.
 */
export class DataAnalysisService {
  private readonly analyser: AveragingAnalyser;
  private readonly summaryAnalyser: AssignmentSummaryAnalyser;
  private readonly classSummaryAnalyser: ClassSummaryAnalyser;

  /**
   * Constructs a `DataAnalysisService` and its analyser instances with default
   * criterion weightings.
   */
  constructor() {
    this.analyser = new AveragingAnalyser();
    this.summaryAnalyser = new AssignmentSummaryAnalyser();
    this.classSummaryAnalyser = new ClassSummaryAnalyser();
  }

  /**
   * Validate the input, build the enriched class summary, and validate its output.
   *
   * @param {AveragingAnalyserInput} input - Loaded class data and live definitions.
   * @param {AnalyseClassSummaryOptions} options - Target and newest-first recent assignments.
   * @returns {ClassSummary} Validated, UI-independent class summary.
   * @throws {ZodError} When the input or the summary output fails Zod validation.
   */
  analyseClassSummary(
    input: AveragingAnalyserInput,
    options: AnalyseClassSummaryOptions
  ): ClassSummary {
    const validated = AveragingAnalyserInputSchema.parse(input);
    return ClassSummarySchema.parse(this.classSummaryAnalyser.analyse(validated, options));
  }

  /**
   * Validate and analyse descriptive task summaries for one class assignment.
   * @param {AveragingAnalyserInput} input - Loaded class data and live definitions.
   * @param {string} classId - Class to summarise.
   * @param {string} assignmentId - Assignment to isolate before accumulation.
   * @returns {AssignmentSummary} Validated UI-independent evidence.
   */
  analyseAssignmentSummary(
    input: AveragingAnalyserInput,
    classId: string,
    assignmentId: string
  ): AssignmentSummary {
    const validated = AveragingAnalyserInputSchema.parse(input);
    return AssignmentSummarySchema.parse(
      this.summaryAnalyser.analyse(validated, classId, assignmentId)
    );
  }

  /**
   * Validates the input via Zod, runs the averaging analyser, and validates the
   * output before returning.
   *
   * @param {AveragingAnalyserInput} input - Fully assembled input data
   *   (pre-fetched classes, partial definitions, and filter).
   * @returns {DataAnalysisResponse} An array of per-class averaging results.
   * @throws {ZodError} When the input or analyser output fails Zod validation.
   * @throws {Error} When the analyser encounters an unrecoverable invariant
   *   violation (e.g. missing `assignmentDefinition`).
   *
   * @remarks
   * The service performs synchronous validation and analysis only. It does not
   * log or catch validation failures; consumer boundaries add their contextual
   * diagnostics and, where applicable, repeat-run policy.
   */
  analyse(input: AveragingAnalyserInput): DataAnalysisResponse {
    const validated = AveragingAnalyserInputSchema.parse(input);
    const results = this.analyser.analyse(validated);
    return DataAnalysisResponseSchema.parse(results);
  }
}
