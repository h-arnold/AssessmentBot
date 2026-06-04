/**
 * Startup warm-up state helpers for assignment definition wizard tests.
 */

import type {
  StartupWarmupContextValue,
  StartupWarmupSnapshot,
  StartupWarmupStatus,
} from '../../../features/auth/startupWarmupState';
import {
  startupWarmupDatasetKeys,
  type StartupWarmupDatasetKey,
} from '../../../query/sharedQueries';

/**
 * Dataset status type for warmup state configuration.
 */
export type DatasetStatus = StartupWarmupStatus;

/**
 * Options for creating startup warmup state.
 * Supports both simple dataset status overrides and custom ready/failed selectors.
 */
export interface CreateStartupWarmupStateOptions {
  /** Simple dataset status overrides (for backward compatibility with existing tests). */
  assignmentTopicsStatus?: DatasetStatus;
  yearGroupsStatus?: DatasetStatus;
  classPartialsStatus?: DatasetStatus;
  cohortsStatus?: DatasetStatus;
  assignmentDefinitionPartialsStatus?: DatasetStatus;
  /** Custom dataset ready selector (for advanced use cases). */
  isDatasetReady?: (datasetKey: string) => boolean;
  /** Custom dataset failed selector (for advanced use cases). */
  isDatasetFailed?: (datasetKey: string) => boolean;
  /** Overall warmup state (for advanced use cases). */
  warmupState?: 'loading' | 'ready' | 'failed';
  /** Overall isFailed flag (for advanced use cases). */
  isFailed?: boolean;
  /** Overall isLoading flag (for advanced use cases). */
  isLoading?: boolean;
}

// Dataset keys for warmup state
const DATASET_KEYS = startupWarmupDatasetKeys;

/**
 * Get the status for a specific dataset key from options.
 *
 * @param {StartupWarmupDatasetKey} datasetKey The dataset key.
 * @param {CreateStartupWarmupStateOptions} options The options object.
 * @returns {DatasetStatus} The dataset status.
 */
function getSingleDatasetStatus(
  datasetKey: StartupWarmupDatasetKey,
  options: CreateStartupWarmupStateOptions
): DatasetStatus {
  // Dataset keys are from a known set - safe to use for property access
  const key: `${StartupWarmupDatasetKey}Status` = `${datasetKey}Status`;
  const status = options[key as keyof CreateStartupWarmupStateOptions];
  return (status as DatasetStatus | undefined) ?? 'ready';
}

/**
 * Check if a specific dataset is ready based on options.
 *
 * @param {StartupWarmupDatasetKey} datasetKey The dataset key.
 * @param {CreateStartupWarmupStateOptions} options The options object.
 * @returns {boolean} True if the dataset is ready.
 */
function isSingleDatasetReady(
  datasetKey: StartupWarmupDatasetKey,
  options: CreateStartupWarmupStateOptions
): boolean {
  const status = getSingleDatasetStatus(datasetKey, options);
  return status === 'ready';
}

/**
 * Check if a specific dataset is failed based on options.
 *
 * @param {StartupWarmupDatasetKey} datasetKey The dataset key.
 * @param {CreateStartupWarmupStateOptions} options The options object.
 * @returns {boolean} True if the dataset is failed.
 */
function isSingleDatasetFailed(
  datasetKey: StartupWarmupDatasetKey,
  options: CreateStartupWarmupStateOptions
): boolean {
  const status = getSingleDatasetStatus(datasetKey, options);
  return status === 'failed';
}

/**
 * Check if a specific dataset is loading based on options.
 *
 * @param {StartupWarmupDatasetKey} datasetKey The dataset key.
 * @param {CreateStartupWarmupStateOptions} options The options object.
 * @returns {boolean} True if the dataset is loading.
 */
function isSingleDatasetLoading(
  datasetKey: StartupWarmupDatasetKey,
  options: CreateStartupWarmupStateOptions
): boolean {
  const status = getSingleDatasetStatus(datasetKey, options);
  return status === 'loading';
}

/**
 * Create default isDatasetReady selector.
 *
 * @param {CreateStartupWarmupStateOptions} options The options object.
 * @returns {(datasetKey: StartupWarmupDatasetKey) => boolean} Selector function.
 */
function createDefaultIsDatasetReady(
  options: CreateStartupWarmupStateOptions
): (datasetKey: StartupWarmupDatasetKey) => boolean {
  return (datasetKey: StartupWarmupDatasetKey): boolean =>
    isSingleDatasetReady(datasetKey, options);
}

/**
 * Create default isDatasetFailed selector.
 *
 * @param {CreateStartupWarmupStateOptions} options The options object.
 * @returns {(datasetKey: StartupWarmupDatasetKey) => boolean} Selector function.
 */
function createDefaultIsDatasetFailed(
  options: CreateStartupWarmupStateOptions
): (datasetKey: StartupWarmupDatasetKey) => boolean {
  return (datasetKey: StartupWarmupDatasetKey): boolean =>
    isSingleDatasetFailed(datasetKey, options);
}

/**
 * Check if any dataset is failed.
 *
 * @param {CreateStartupWarmupStateOptions} options The options object.
 * @returns {boolean} True if any dataset is failed.
 */
function isAnyDatasetFailed(options: CreateStartupWarmupStateOptions): boolean {
  return DATASET_KEYS.some((key) => isSingleDatasetFailed(key, options));
}

/**
 * Check if any dataset is loading.
 *
 * @param {CreateStartupWarmupStateOptions} options The options object.
 * @returns {boolean} True if any dataset is loading.
 */
function isAnyDatasetLoading(options: CreateStartupWarmupStateOptions): boolean {
  return DATASET_KEYS.some((key) => isSingleDatasetLoading(key, options));
}

/**
 * Create dataset snapshot object.
 *
 * @param {CreateStartupWarmupStateOptions} options The options object.
 * @returns {StartupWarmupSnapshot} Dataset snapshot.
 */
function createDatasetSnapshot(options: CreateStartupWarmupStateOptions): StartupWarmupSnapshot {
  const datasets: Record<
    StartupWarmupDatasetKey,
    { status: StartupWarmupStatus; isTrustworthy: boolean }
  > = {
    classPartials: { status: 'ready', isTrustworthy: true },
    assignmentDefinitionPartials: { status: 'ready', isTrustworthy: true },
    assignmentTopics: { status: 'ready', isTrustworthy: true },
    cohorts: { status: 'ready', isTrustworthy: true },
    yearGroups: { status: 'ready', isTrustworthy: true },
  };

  // Keys are from a known const array from sharedQueries - safe to use as object keys
  for (const key of DATASET_KEYS) {
    const status = getSingleDatasetStatus(key, options);
    // eslint-disable-next-line security/detect-object-injection
    datasets[key] = {
      status,
      isTrustworthy: status === 'ready',
    };
  }

  return { datasets };
}

/**
 * Creates startup warm-up state with configurable dataset readiness.
 *
 * Supports two patterns:
 * 1. Simple: Pass dataset status overrides (assignmentTopicsStatus, yearGroupsStatus, etc.)
 * 2. Advanced: Pass custom selectors (isDatasetReady, isDatasetFailed) and state flags
 *
 * @param {CreateStartupWarmupStateOptions} options Warm-up override options.
 * @returns {StartupWarmupContextValue} Warm-up state consumed by components.
 */
// eslint-disable-next-line complexity
export function createStartupWarmupState(
  options: CreateStartupWarmupStateOptions = {}
): StartupWarmupContextValue {
  const {
    isDatasetReady,
    isDatasetFailed,
    warmupState = 'ready',
    isFailed = false,
    isLoading = false,
  } = options;

  const anyDatasetFailed = isAnyDatasetFailed(options);
  const anyDatasetLoading = isAnyDatasetLoading(options);
  const combinedIsFailed = isFailed || anyDatasetFailed;
  const combinedIsLoading = isLoading || anyDatasetLoading;

  return {
    isFailed: combinedIsFailed,
    isLoading: combinedIsLoading,
    isReady: !combinedIsLoading && !combinedIsFailed,
    warmupState,
    snapshot: createDatasetSnapshot(options),
    isDatasetReady: isDatasetReady ?? createDefaultIsDatasetReady(options),
    isDatasetFailed: isDatasetFailed ?? createDefaultIsDatasetFailed(options),
  };
}

/**
 * Creates a ready startup warmup state with all datasets ready.
 *
 * @returns {StartupWarmupContextValue} Ready startup warmup state.
 */
export function createReadyStartupWarmupState(): StartupWarmupContextValue {
  return createStartupWarmupState();
}

/**
 * Creates a loading startup warmup state with specified datasets loading.
 *
 * @param {StartupWarmupDatasetKey[]} loadingDatasets Array of dataset keys that are loading.
 * @returns {StartupWarmupContextValue} Loading startup warmup state.
 */
export function createLoadingStartupWarmupState(
  loadingDatasets: StartupWarmupDatasetKey[] = []
): StartupWarmupContextValue {
  const options: CreateStartupWarmupStateOptions = {};
  if (loadingDatasets.includes('assignmentTopics')) {
    options.assignmentTopicsStatus = 'loading';
  }
  if (loadingDatasets.includes('yearGroups')) {
    options.yearGroupsStatus = 'loading';
  }
  if (loadingDatasets.includes('classPartials')) {
    options.classPartialsStatus = 'loading';
  }
  if (loadingDatasets.includes('cohorts')) {
    options.cohortsStatus = 'loading';
  }
  if (loadingDatasets.includes('assignmentDefinitionPartials')) {
    options.assignmentDefinitionPartialsStatus = 'loading';
  }

  const state = createStartupWarmupState(options);
  return {
    ...state,
    isLoading: true,
    isReady: false,
    warmupState: 'loading',
  };
}

/**
 * Creates a failed startup warmup state with specified datasets failed.
 *
 * @param {StartupWarmupDatasetKey[]} failedDatasets Array of dataset keys that have failed.
 * @returns {StartupWarmupContextValue} Failed startup warmup state.
 */
export function createFailedStartupWarmupState(
  failedDatasets: StartupWarmupDatasetKey[] = []
): StartupWarmupContextValue {
  const options: CreateStartupWarmupStateOptions = {};
  if (failedDatasets.includes('assignmentTopics')) {
    options.assignmentTopicsStatus = 'failed';
  }
  if (failedDatasets.includes('yearGroups')) {
    options.yearGroupsStatus = 'failed';
  }
  if (failedDatasets.includes('classPartials')) {
    options.classPartialsStatus = 'failed';
  }
  if (failedDatasets.includes('cohorts')) {
    options.cohortsStatus = 'failed';
  }
  if (failedDatasets.includes('assignmentDefinitionPartials')) {
    options.assignmentDefinitionPartialsStatus = 'failed';
  }

  const state = createStartupWarmupState(options);
  return {
    ...state,
    isFailed: true,
    isReady: false,
    warmupState: 'failed',
  };
}
