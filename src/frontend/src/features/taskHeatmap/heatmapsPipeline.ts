/**
 * Analyser + merged-adapter pipeline for the standalone Heatmaps hook.
 *
 * @remarks
 * Pure, deterministic helpers that run the synchronous averaging analysis over
 * input-shaped assignments and the merged-adapter projection. Extracted from
 * `useHeatmapsPageData.ts` to keep that module under the 500-LOC module-size gate, and to
 * isolate the analyser/adapter orchestration (per
 * `src/frontend/AGENTS.md` §3.3).
 *
 * The full input-shaping and memoisation rationale lives in `useHeatmapsPageData.ts`'s
 * module JSDoc; this helper owns only the pure analyser/adapter orchestration.
 */

import { DataAnalysisService } from '../../services/dataAnalysis/dataAnalysisService';
import {
  adaptMetricsToMergedHeatmap,
  type MergedHeatmapResult,
} from '../../services/dataAnalysis/heatmapAdapter.merged';
import type {
  AveragingAnalyserInput,
  AveragingResult,
} from '../../services/dataAnalysis/dataAnalysis.zod';
import type { ClassFull } from '../../services/googleClassrooms/classDetail/classDetailService.zod';
import type { AssignmentDefinitionPartialsResponse } from '../../services/assignmentDefinition/assignmentDefinitionPartials.zod';
import { logFrontendError } from '../../logging/frontendLogger';
import { toError } from '../../errors/normaliseUnknownError';
import type { PageDatasetState } from '../../hooks/usePageDataset';

/**
 * Create the module-level `DataAnalysisService` instance.
 *
 * A factory function is used so that `vi.mock` patching of `DataAnalysisService`
 * as a function (not a class constructor) works correctly in tests. The cached
 * instance retains the mocked `analyse` function reference between renders.
 *
 * @returns {DataAnalysisService} A new service instance.
 */
function createAnalysisService(): DataAnalysisService {
  return new DataAnalysisService();
}

const _analysisService: DataAnalysisService = createAnalysisService();

/**
 * Module-global set of already-logged pipeline error keys, keyed by
 * `context + '|' + normalised message + '|' + serialised metadata`.
 *
 * This set is deliberately module-global and is intentionally NOT reset per run.
 * `runHeatmapsPipeline` is recomputed by `useMemo` on every dependent render, so identical
 * `logFrontendError` calls across those recomputations must be suppressed to dedupe identical
 * calls across `useMemo` recomputations of `runHeatmapsPipeline`, honouring the agreed L-4
 * review decision (no-double-logging of identical diagnostics). The original `TaskHeatmapPage`
 * used a `useLogOnce`-style guard for the same intent, but `useLogOnce` is per-mount (useRef),
 * whereas the pipeline runs on every recomputation; a module-global Set is therefore used here
 * so the dedupe survives across recomputations rather than being reset on each mount.
 *
 * To avoid an unbounded memory leak in a long-lived SPA session (the Set would otherwise
 * grow monotonically with every distinct `(context, message, metadata)` tuple, and would
 * become effectively unbounded if the metadata varies), it is capped at
 * {@link LOGGED_ERROR_KEYS_MAX} entries. Once the cap is exceeded the oldest
 * (first-inserted) key is dropped first, exploiting the fact that Set iteration order follows
 * insertion order, so the dedupe set remains bounded while still suppressing identical keys
 * logged in hot-loop recomputations well below the cap.
 * Only the dedupe state is affected; the underlying sink still emits every distinct diagnostic
 * the first time it is seen.
 */
const LOGGED_ERROR_KEYS_MAX = 256;
const _loggedPipelineErrorKeys = new Set<string>();

/**
 * Logs a pipeline error exactly once per distinct `(context, message, metadata)` tuple.
 *
 * Identical errors raised on subsequent memo recomputations are suppressed to honour the
 * agreed L-4 review decision (no-double-logging of identical diagnostics), while the
 * underlying sink (`logFrontendError`) still emits every distinct diagnostic. The returned
 * error tuple is unaffected, so callers keep their behaviour regardless of dedupe.
 *
 * @param {string} context Log context for the emitting step.
 * @param {unknown} error The error to normalise and log.
 * @param {Record<string, unknown> | undefined} metadata Additional log metadata.
 * @returns {void} Nothing.
 */
function logPipelineError(
  context: string,
  error: unknown,
  metadata?: Record<string, unknown>
): void {
  const key = `${context}|${toError(error).message}|${JSON.stringify(metadata ?? {})}`;
  if (_loggedPipelineErrorKeys.has(key)) {
    return;
  }
  _loggedPipelineErrorKeys.add(key);
  // Bound the dedupe set: once the cap is exceeded, drop the oldest (first-inserted)
  // key. This keeps memory finite in a long-lived session while preserving the L-4
  // dedupe intent for keys seen below the cap.
  if (_loggedPipelineErrorKeys.size > LOGGED_ERROR_KEYS_MAX) {
    const oldestKey = _loggedPipelineErrorKeys.values().next().value;
    if (oldestKey !== undefined) {
      _loggedPipelineErrorKeys.delete(oldestKey);
    }
  }
  logFrontendError(context, error, metadata);
}

/**
 * Run the analyser step of the pipeline.
 *
 * @param {ClassFull} classFull - The class data (non-null, guaranteed by caller).
 * @param {AssignmentDefinitionPartialsResponse} assignmentDefinitionPartials - Reference data (non-null).
 * @param {string} classId - The selected class ID (non-null, guaranteed by caller).
 * @param {readonly string[]} selectedAssignmentIds - The selected assignment IDs.
 * @returns {readonly [AveragingResult | null, Error | null]} The result and optional error.
 */
function runAnalyserStep(
  classFull: ClassFull,
  assignmentDefinitionPartials: AssignmentDefinitionPartialsResponse,
  classId: string,
  selectedAssignmentIds: readonly string[]
): readonly [AveragingResult | null, Error | null] {
  try {
    const selectedIds = new Set(selectedAssignmentIds);
    const analyserInput: AveragingAnalyserInput = {
      filter: { classIds: [classId] },
      // Input shaping: scope analysis to exactly the selected assignment instances.
      classes: [
        {
          ...classFull,
          assignments: classFull.assignments.filter((assignment) =>
            selectedIds.has(assignment.assignmentId)
          ),
        },
      ],
      assignmentDefinitionPartials,
    };

    const response = _analysisService.analyse(analyserInput, 'averaging');
    if (response.length === 0) {
      const error = new Error('Analyser returned empty result');
      logPipelineError('heatmapsPipeline.runAnalyserStep', error, { classId });
      return [null, error];
    }
    return [response[0] ?? null, null];
  } catch (error_: unknown) {
    logPipelineError('heatmapsPipeline.runAnalyserStep', error_, { classId });
    return [null, toError(error_)];
  }
}

/**
 * Run the merged-adapter step of the pipeline.
 *
 * @param {AveragingResult} analyserResult - The analyser result (non-null, guaranteed by caller).
 * @param {ClassFull} classFull - The class data (non-null, guaranteed by caller).
 * @param {AssignmentDefinitionPartialsResponse} assignmentDefinitionPartials - The definition registry.
 * @param {readonly string[]} selectedAssignmentIds - The selected assignment IDs.
 * @returns {readonly [MergedHeatmapResult | null, Error | null]} The adapter result and optional error.
 */
function runAdapterStep(
  analyserResult: AveragingResult,
  classFull: ClassFull,
  assignmentDefinitionPartials: AssignmentDefinitionPartialsResponse,
  selectedAssignmentIds: readonly string[]
): readonly [MergedHeatmapResult | null, Error | null] {
  try {
    const result = adaptMetricsToMergedHeatmap(
      analyserResult,
      classFull,
      selectedAssignmentIds,
      assignmentDefinitionPartials
    );
    return [result, null];
  } catch (error_: unknown) {
    logPipelineError('heatmapsPipeline.runAdapterStep', error_, { classId: classFull.classId });
    return [null, toError(error_)];
  }
}

/**
 * Decide whether the analyser/merged-adapter pipeline should run for the current
 * selection. The pipeline is gated on a selected class, at least one selected
 * assignment, and a trustworthy (or not-yet-failed) ADP dataset.
 *
 * @param {ClassFull | null} classFull - The class query data.
 * @param {readonly string[]} selectedAssignmentIds - The selected assignment IDs.
 * @param {PageDatasetState} adpDatasetState - The ADP dataset state.
 * @returns {boolean} `true` if the pipeline should run.
 */
export function shouldRunHeatmapsPipeline(
  classFull: ClassFull | null,
  selectedAssignmentIds: readonly string[],
  adpDatasetState: PageDatasetState
): boolean {
  if (classFull === null) {
    return false;
  }
  if (selectedAssignmentIds.length === 0) {
    return false;
  }
  // Don't run on untrustworthy or failed data (parity with useClassPageData).
  if (adpDatasetState.isDatasetFailed) {
    return false;
  }
  if (adpDatasetState.isDatasetReady && !adpDatasetState.isDatasetTrustworthy) {
    return false;
  }
  return true;
}

/**
 * Run the analyser + merged-adapter pipeline, returning the four-tuple
 * `[analyserResult, analyserError, mergedResult, adapterError]`.
 *
 * @param {ClassFull | null} classFull - The class data.
 * @param {AssignmentDefinitionPartialsResponse | null} assignmentDefinitionPartials - The definition registry.
 * @param {string | null} classId - The selected class ID.
 * @param {readonly string[]} selectedAssignmentIds - The selected assignment IDs.
 * @returns {readonly [AveragingResult | null, Error | null, MergedHeatmapResult | null, Error | null]}
 *   The analyser result, analyser error, merged result, and adapter error.
 */
export function runHeatmapsPipeline(
  classFull: ClassFull | null,
  assignmentDefinitionPartials: AssignmentDefinitionPartialsResponse | null,
  classId: string | null,
  selectedAssignmentIds: readonly string[]
): readonly [AveragingResult | null, Error | null, MergedHeatmapResult | null, Error | null] {
  // Do not run the analyser with null partials or a missing class/ID; `shouldRunHeatmapsPipeline`
  // gates on class/selection/ADP state, not on partials, so the null-partials guard lives in
  // `runHeatmapsPipeline` itself (this function), returning the all-null tuple when partials are
  // unavailable — behaviour equivalent to the `shouldRunHeatmapsPipeline` gate.
  if (classFull === null || classId === null || assignmentDefinitionPartials === null) {
    return [null, null, null, null];
  }

  const [aResult, aError] = runAnalyserStep(
    classFull,
    assignmentDefinitionPartials,
    classId,
    selectedAssignmentIds
  );
  if (aError !== null) {
    return [null, aError, null, null];
  }
  if (aResult === null) {
    const error = new Error('heatmapsPipeline.runHeatmapsPipeline: analyser returned no result');
    logPipelineError('heatmapsPipeline.runHeatmapsPipeline', error, { classId });
    return [null, error, null, null];
  }

  const [adResult, adError] = runAdapterStep(
    aResult,
    classFull,
    assignmentDefinitionPartials,
    selectedAssignmentIds
  );
  if (adError !== null) {
    return [null, null, null, adError];
  }

  return [aResult, null, adResult, null];
}
