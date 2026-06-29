import { AveragingAnalyser } from './analysers/averagingAnalyser';
import { AveragingAnalyserInputSchema, DataAnalysisResponseSchema } from './dataAnalysis.zod';
import type { AveragingAnalyserInput, DataAnalysisResponse } from './dataAnalysis.zod';

/**
 * Thin stateless orchestrator that validates input, dispatches to registered
 * analysers, and returns their typed results.
 *
 * @remarks
 * The orchestrator follows a pluggable analyser pattern (strategy pattern)
 * backed by an internal {@link Map} registry.
 *
 * New analysers are added by registering an instance under a string key in
 * the constructor. The v1 analyser is registered as `'averaging'`.
 *
 * The orchestrator is pure — no I/O, no `callApi`, no React Query, no Ant
 * Design imports.
 */
export class DataAnalysisService {
  /** Internal registry of analyser key → analyser instance. */
  private readonly registry: Map<string, AveragingAnalyser>;

  /**
   * Constructs a `DataAnalysisService` and initialises the analyser registry.
   *
   * @remarks
   * The v1 analyser is registered under the key `'averaging'` with default
   * criterion weightings. Future analysers can be added by extending the
   * registry initialisation and adding new key entries.
   */
  constructor() {
    this.registry = new Map<string, AveragingAnalyser>([['averaging', new AveragingAnalyser()]]);
  }

  /**
   * Validates the input via Zod, dispatches to the registered analyser
   * identified by {@link analyserKey}, and validates the output before
   * returning.
   *
   * @param {AveragingAnalyserInput} input - Fully assembled input data
   *   (pre-fetched classes, partial definitions, and filter).
   * @param {string} [analyserKey='averaging'] - Key identifying which
   *   registered analyser to dispatch to.
   * @returns {DataAnalysisResponse} An array of per-class averaging results.
   * @throws {ZodError} When the input fails Zod validation.
   * @throws {Error} When {@link analyserKey} is not a registered analyser,
   *   or when the analyser encounters an unrecoverable invariant violation
   *   (e.g. missing `assignmentDefinition`).
   *
   * @remarks
   * Pure frontend orchestrator — no I/O, no `callApi`.
   */
  analyse(input: AveragingAnalyserInput, analyserKey: string = 'averaging'): DataAnalysisResponse {
    const validated = AveragingAnalyserInputSchema.parse(input);

    const analyser = this.registry.get(analyserKey);
    if (!analyser) {
      throw new Error(`Unknown analyser key: ${analyserKey}`);
    }

    const results = analyser.analyse(validated);
    return DataAnalysisResponseSchema.parse(results);
  }
}
