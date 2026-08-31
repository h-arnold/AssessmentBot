/**
 * Analyser + merged-adapter pipeline for the standalone Heatmaps hook.
 *
 * @remarks
 * Pure, deterministic helpers that run the synchronous averaging analysis over
 * input-shaped assignments and the merged-adapter projection. Extracted from
 * `useHeatmapsPageData.ts` to keep that module under the 500-LOC split gate and to
 * isolate the analyser/adapter orchestration (per `src/frontend/AGENTS.md` §3.3;
 * `src/backend/AGENTS.md` §11 as the behavioural analogue).
 *
 * **Analyser input shaping.** `classes` is passed as the single selected `ClassFull`
 * with its `assignments` replaced by the *selected assignment IDs* (string[]), and
 * `filter.classIds` carries only the selected class. The analyser ignores
 * `filter.classIds` and its definition-key filters would wrongly include sibling
 * instances, so input shaping owns scoping (no `topicKeys` / `assignmentDefinitionKeys`
 * filters). The analyser call is wrapped in try/catch so any schema drift fails safe
 * as a blocking error rather than rendering silently.
 *
 * **Memoisation.** The pipeline is re-run only when `shouldRunHeatmapsPipeline` holds
 * and its memo key includes `selectedAssignmentIds` (joined) as well as `classId`,
 * `classFull`, and `assignmentDefinitionPartials`. `classId` and `selectedAssignmentIds`
 * both feed the analyser input, so omitting either would reuse stale results when the
 * selection changes without `classFull` changing — this is the staleness-guard
 * analogue to `useClassPageData`'s `classId`-in-key note.
 */

import { DataAnalysisService } from '../../services/dataAnalysis/dataAnalysisService';
import {
  adaptMetricsToMergedHeatmap,
  type MergedHeatmapResult,
} from '../../services/dataAnalysis/heatmapAdapter';
import type {
  AveragingAnalyserInput,
  AveragingResult,
} from '../../services/dataAnalysis/dataAnalysis.zod';
import type { ClassFull } from '../../services/googleClassrooms/classDetail/classDetailService.zod';
import type { AssignmentDefinitionPartialsResponse } from '../../services/assignmentDefinition/assignmentDefinitionPartials.zod';
import { logFrontendError } from '../../logging/frontendLogger';
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
 * Run the analyser step of the pipeline.
 *
 * @param {ClassFull | null} classFull - The class data (null skips analysis).
 * @param {AssignmentDefinitionPartialsResponse | null} assignmentDefinitionPartials - Reference data.
 * @param {string | null} classId - The selected class ID.
 * @param {readonly string[]} selectedAssignmentIds - The selected assignment IDs.
 * @returns {readonly [AveragingResult | null, Error | null]} The result and optional error.
 */
function runAnalyserStep(
  classFull: ClassFull | null,
  assignmentDefinitionPartials: AssignmentDefinitionPartialsResponse | null,
  classId: string | null,
  selectedAssignmentIds: readonly string[]
): readonly [AveragingResult | null, Error | null] {
  if (classFull === null || classId === null) {
    return [null, null];
  }

  try {
    const analyserInput = {
      filter: { classIds: [classId] },
      // Input shaping: scope analysis to exactly the selected assignment instances.
      classes: [{ ...classFull, assignments: selectedAssignmentIds }],
      assignmentDefinitionPartials,
    };

    const response = _analysisService.analyse(
      analyserInput as unknown as AveragingAnalyserInput,
      'averaging'
    );
    if (response.length === 0) {
      return [null, new Error('Analyser returned empty result')];
    }
    return [response[0] ?? null, null];
  } catch (error_: unknown) {
    logFrontendError('useHeatmapsPageData.runAnalyserStep', error_, { classId });
    return [null, error_ instanceof Error ? error_ : new Error(String(error_))];
  }
}

/**
 * Run the merged-adapter step of the pipeline.
 *
 * @param {AveragingResult | null} analyserResult - The analyser result (null skips adapter).
 * @param {ClassFull} classFull - The class data (non-null, guaranteed by caller).
 * @param {AssignmentDefinitionPartialsResponse | null} assignmentDefinitionPartials - The definition registry.
 * @param {readonly string[]} selectedAssignmentIds - The selected assignment IDs.
 * @returns {readonly [MergedHeatmapResult | null, Error | null]} The adapter result and optional error.
 */
function runAdapterStep(
  analyserResult: AveragingResult | null,
  classFull: ClassFull,
  assignmentDefinitionPartials: AssignmentDefinitionPartialsResponse | null,
  selectedAssignmentIds: readonly string[]
): readonly [MergedHeatmapResult | null, Error | null] {
  if (analyserResult === null) {
    return [null, new Error('useHeatmapsPageData.runAdapterStep: analyserResult is null')];
  }
  if (assignmentDefinitionPartials === null) {
    return [
      null,
      new Error('useHeatmapsPageData.runAdapterStep: assignmentDefinitionPartials is null'),
    ];
  }

  try {
    const result = adaptMetricsToMergedHeatmap(
      analyserResult,
      classFull,
      selectedAssignmentIds,
      assignmentDefinitionPartials
    );
    return [result, null];
  } catch (error_: unknown) {
    logFrontendError('useHeatmapsPageData.runAdapterStep', error_, { classId: classFull.classId });
    return [null, error_ instanceof Error ? error_ : new Error(String(error_))];
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
  const [aResult, aError] = runAnalyserStep(
    classFull,
    assignmentDefinitionPartials,
    classId,
    selectedAssignmentIds
  );
  if (aError !== null) {
    return [null, aError, null, null];
  }

  const [adResult, adError] = runAdapterStep(
    aResult,
    classFull as ClassFull,
    assignmentDefinitionPartials,
    selectedAssignmentIds
  );
  if (adError !== null) {
    return [null, null, null, adError];
  }

  return [aResult, null, adResult, null];
}
