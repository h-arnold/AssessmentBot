import type {
  StartupWarmupContextValue,
  StartupWarmupStatus,
} from '@/features/auth/startupWarmupState';

type WarmupOptions = {
  warmupState?: StartupWarmupStatus;
  isClassPartialsDatasetReady?: boolean;
  isClassPartialsDatasetFailed?: boolean;
  isClassPartialsDatasetTrustworthy?: boolean;
  isYearGroupsDatasetReady?: boolean;
  isYearGroupsDatasetFailed?: boolean;
  isYearGroupsDatasetTrustworthy?: boolean;
};

/** Constructor-owned independent readiness, failure and trust flags. */
class DatasetOptions {
  readonly isReady: boolean;
  readonly isFailed: boolean;
  readonly isTrustworthy: boolean;

  /** Initialises one dataset's flags.
   * @param {boolean} [isReady] Readiness override.
   * @param {boolean} [isFailed] Failure override.
   * @param {boolean} [isTrustworthy] Trust override.
   */
  constructor(isReady = true, isFailed = false, isTrustworthy = true) {
    this.isReady = isReady;
    this.isFailed = isFailed;
    this.isTrustworthy = isTrustworthy;
  }
}

/** Constructor-owned defaults for the two page datasets' warm-up states. */
class ClassesPageWarmupOptions {
  readonly warmupState: StartupWarmupStatus;
  readonly classPartials: DatasetOptions;
  readonly yearGroups: DatasetOptions;

  /** Initialises the page-specific warm-up settings.
   * @param {WarmupOptions} [options] Dataset overrides.
   */
  constructor(options: WarmupOptions = {}) {
    this.warmupState = options.warmupState ?? 'ready';
    this.classPartials = new DatasetOptions(
      options.isClassPartialsDatasetReady,
      options.isClassPartialsDatasetFailed,
      options.isClassPartialsDatasetTrustworthy
    );
    this.yearGroups = new DatasetOptions(
      options.isYearGroupsDatasetReady,
      options.isYearGroupsDatasetFailed,
      options.isYearGroupsDatasetTrustworthy
    );
  }
}

/** Resolves dataset failure before readiness, matching the original page harness.
 * @param {boolean} isFailed Whether the dataset failed.
 * @param {boolean} isReady Whether the dataset is ready.
 * @returns {StartupWarmupStatus} Dataset status.
 */
function datasetStatus(isFailed: boolean, isReady: boolean): StartupWarmupStatus {
  if (isFailed) return 'failed';
  return isReady ? 'ready' : 'loading';
}

/** Creates the page-specific warm-up snapshot without coupling readiness to trust.
 * @param {WarmupOptions} [options] Dataset overrides.
 * @returns {StartupWarmupContextValue} Context with independent status and trust probes.
 */
export function createMockStartupWarmupState(options?: WarmupOptions): StartupWarmupContextValue {
  const state = new ClassesPageWarmupOptions(options);
  const datasets = {
    classPartials: {
      status: datasetStatus(state.classPartials.isFailed, state.classPartials.isReady),
      isTrustworthy: state.classPartials.isTrustworthy,
    },
    yearGroups: {
      status: datasetStatus(state.yearGroups.isFailed, state.yearGroups.isReady),
      isTrustworthy: state.yearGroups.isTrustworthy,
    },
    assignmentDefinitionPartials: { status: 'ready', isTrustworthy: true },
    assignmentTopics: { status: 'ready', isTrustworthy: true },
    cohorts: { status: 'ready', isTrustworthy: true },
  } as const;

  return {
    warmupState: state.warmupState,
    isLoading: state.warmupState === 'loading',
    isReady: state.warmupState === 'ready',
    isFailed: state.warmupState === 'failed',
    snapshot: { datasets },
    isDatasetReady: (key) => {
      if (key === 'classPartials') return state.classPartials.isReady;
      if (key === 'yearGroups') return state.yearGroups.isReady;
      return true;
    },
    isDatasetFailed: (key) => {
      if (key === 'classPartials') return state.classPartials.isFailed;
      if (key === 'yearGroups') return state.yearGroups.isFailed;
      return false;
    },
  };
}

/** Creates a ready, trustworthy page warm-up context.
 * @returns {StartupWarmupContextValue} Ready context.
 */
export function createReadyWarmupState(): StartupWarmupContextValue {
  return createMockStartupWarmupState();
}

/** Creates the unresolved initial-load context.
 * @returns {StartupWarmupContextValue} Loading context.
 */
export function createLoadingWarmupState(): StartupWarmupContextValue {
  return createMockStartupWarmupState({
    warmupState: 'loading',
    isClassPartialsDatasetReady: false,
    isClassPartialsDatasetTrustworthy: false,
    isYearGroupsDatasetReady: false,
    isYearGroupsDatasetTrustworthy: false,
  });
}

/** Creates a failed class-partials snapshot with ready year groups.
 * @returns {StartupWarmupContextValue} Failed class-partials context.
 */
export function createClassPartialsFailedWarmupState(): StartupWarmupContextValue {
  return createMockStartupWarmupState({
    isClassPartialsDatasetReady: false,
    isClassPartialsDatasetFailed: true,
    isClassPartialsDatasetTrustworthy: false,
  });
}

/** Creates a failed year-groups snapshot with ready class partials.
 * @returns {StartupWarmupContextValue} Failed year-groups context.
 */
export function createYearGroupsFailedWarmupState(): StartupWarmupContextValue {
  return createMockStartupWarmupState({
    isYearGroupsDatasetReady: false,
    isYearGroupsDatasetFailed: true,
    isYearGroupsDatasetTrustworthy: false,
  });
}
