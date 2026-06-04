/**
 * Shared setup, helper functions, and test data for ClassesPage spec files.
 *
 * Mandatory Reading (Files read):
 * - AGENTS.md
 * - src/frontend/AGENTS.md
 * - SPEC.md
 * - CLASSES_PAGE_LAYOUT.md
 * - docs/developer/frontend/frontend-testing.md
 * - docs/developer/frontend/frontend-loading-and-width-standards.md
 * - docs/developer/frontend/frontend-react-query-and-prefetch.md
 * - src/frontend/src/features/auth/startupWarmupState.ts
 * - src/frontend/src/pages/AssignmentsPage.tsx
 * - src/frontend/src/pages/AssignmentsPage.spec.tsx
 * - src/frontend/src/query/sharedQueries.ts
 * - src/frontend/src/query/queryClient.ts
 * - src/frontend/src/test/renderWithFrontendProviders.tsx
 * - src/frontend/e2e-tests/shared/endToEndRuntimeMocks.ts
 * - src/frontend/src/pages/PageSection.tsx
 * - src/frontend/src/pages/classes/classesPageModel.ts
 * - src/frontend/src/test/classes/classesPageTestHelpers.ts
 *
 * IMPORTANT: This file must NOT import from `src/test/` or use `vi.hoisted()`.
 * Those belong in the per-spec files.
 */

 

// ============================================================================
// Dataset Status Types and Helpers
// ============================================================================

/**
 * Dataset state type for startup warmup mocks.
 */
export type MockDatasetState = {
  status: 'loading' | 'ready' | 'failed';
  isTrustworthy: boolean;
};

/**
 * Dataset keys for the startup warmup state.
 */
export const CLASS_PARTIALS_KEY = 'classPartials' as const;
export const YEAR_GROUPS_KEY = 'yearGroups' as const;

/**
 * Options for creating a mock startup warmup state.
 */
export type CreateMockStartupWarmupStateOptions = {
  warmupState?: 'loading' | 'ready' | 'failed';
  isClassPartialsDatasetReady?: boolean;
  isClassPartialsDatasetFailed?: boolean;
  isClassPartialsDatasetTrustworthy?: boolean;
  isYearGroupsDatasetReady?: boolean;
  isYearGroupsDatasetFailed?: boolean;
  isYearGroupsDatasetTrustworthy?: boolean;
};

/**
 * Helper to determine dataset status based on ready/failed state.
 *
 * @param {boolean} isFailed Whether the dataset has failed.
 * @param {boolean} isReady Whether the dataset is ready.
 * @returns {'failed' | 'ready' | 'loading'} Dataset status.
 */
export function getDatasetStatus(
  isFailed: boolean,
  isReady: boolean
): 'failed' | 'ready' | 'loading' {
  if (isFailed) {
    return 'failed';
  }
  if (isReady) {
    return 'ready';
  }
  return 'loading';
}

/**
 * Creates a dataset state object for a given dataset.
 *
 * @param {boolean} isFailed Whether the dataset has failed.
 * @param {boolean} isReady Whether the dataset is ready.
 * @param {boolean} isTrustworthy Whether the dataset is trustworthy.
 * @returns {MockDatasetState} Dataset state.
 */
export function createDatasetState(
  isFailed: boolean,
  isReady: boolean,
  isTrustworthy: boolean
): MockDatasetState {
  return {
    status: getDatasetStatus(isFailed, isReady),
    isTrustworthy,
  };
}

/**
 * Dataset readiness checker for mock startup warmup state.
 *
 * @param {boolean} isClassPartialsDatasetReady Whether classPartials dataset is ready.
 * @param {boolean} isYearGroupsDatasetReady Whether yearGroups dataset is ready.
 * @returns {(datasetKey: string) => boolean} Dataset readiness function.
 */
export function createIsDatasetReadyFunction(
  isClassPartialsDatasetReady: boolean,
  isYearGroupsDatasetReady: boolean
): (datasetKey: string) => boolean {
  return (datasetKey: string): boolean => {
    if (datasetKey === CLASS_PARTIALS_KEY) {
      return isClassPartialsDatasetReady;
    }
    if (datasetKey === YEAR_GROUPS_KEY) {
      return isYearGroupsDatasetReady;
    }
    return true;
  };
}

/**
 * Dataset failure checker for mock startup warmup state.
 *
 * @param {boolean} isClassPartialsDatasetFailed Whether classPartials dataset has failed.
 * @param {boolean} isYearGroupsDatasetFailed Whether yearGroups dataset has failed.
 * @returns {(datasetKey: string) => boolean} Dataset failure function.
 */
export function createIsDatasetFailedFunction(
  isClassPartialsDatasetFailed: boolean,
  isYearGroupsDatasetFailed: boolean
): (datasetKey: string) => boolean {
  return (datasetKey: string): boolean => {
    if (datasetKey === CLASS_PARTIALS_KEY) {
      return isClassPartialsDatasetFailed;
    }
    if (datasetKey === YEAR_GROUPS_KEY) {
      return isYearGroupsDatasetFailed;
    }
    return false;
  };
}

/**
 * Creates a mock startup warmup context value for testing.
 *
 * @param {CreateMockStartupWarmupStateOptions} options Override options.
 * @returns {object} Mock context value with the shape of StartupWarmupContextValue.
 */
// eslint-disable-next-line complexity -- Test helper with many optional parameters
export function createMockStartupWarmupState(
  options: CreateMockStartupWarmupStateOptions = {}
): {
  warmupState: 'loading' | 'ready' | 'failed';
  isLoading: boolean;
  isReady: boolean;
  isFailed: boolean;
  snapshot: {
    datasets: Record<string, MockDatasetState>;
  };
  isDatasetReady: (datasetKey: string) => boolean;
  isDatasetFailed: (datasetKey: string) => boolean;
} {
  // Extract simple values first
  const warmupState = options.warmupState ?? 'ready';
  const isClassPartialsDatasetReady = options.isClassPartialsDatasetReady ?? true;
  const isClassPartialsDatasetFailed = options.isClassPartialsDatasetFailed ?? false;
  const isClassPartialsDatasetTrustworthy = options.isClassPartialsDatasetTrustworthy ?? true;
  const isYearGroupsDatasetReady = options.isYearGroupsDatasetReady ?? true;
  const isYearGroupsDatasetFailed = options.isYearGroupsDatasetFailed ?? false;
  const isYearGroupsDatasetTrustworthy = options.isYearGroupsDatasetTrustworthy ?? true;

  // Pre-compute all values to avoid inline conditionals
  const classPartialsState = createDatasetState(
    isClassPartialsDatasetFailed,
    isClassPartialsDatasetReady,
    isClassPartialsDatasetTrustworthy
  );
  const yearGroupsState = createDatasetState(
    isYearGroupsDatasetFailed,
    isYearGroupsDatasetReady,
    isYearGroupsDatasetTrustworthy
  );
  const isDatasetReadyFunction = createIsDatasetReadyFunction(
    isClassPartialsDatasetReady,
    isYearGroupsDatasetReady
  );
  const isDatasetFailedFunction = createIsDatasetFailedFunction(
    isClassPartialsDatasetFailed,
    isYearGroupsDatasetFailed
  );

  const isLoading = warmupState === 'loading';
  const isReady = warmupState === 'ready';
  const isFailed = warmupState === 'failed';

  return {
    warmupState,
    isLoading,
    isReady,
    isFailed,
    snapshot: {
      datasets: {
        classPartials: classPartialsState,
        yearGroups: yearGroupsState,
        assignmentDefinitionPartials: { status: 'ready', isTrustworthy: true },
        assignmentTopics: { status: 'ready', isTrustworthy: true },
        cohorts: { status: 'ready', isTrustworthy: true },
      },
    },
    isDatasetReady: isDatasetReadyFunction,
    isDatasetFailed: isDatasetFailedFunction,
  };
}

/**
 * Creates a ready startup warmup state with all datasets ready and trustworthy.
 *
 * @returns {object} Ready state.
 */
export function createReadyWarmupState(): ReturnType<typeof createMockStartupWarmupState> {
  return createMockStartupWarmupState();
}

/**
 * Creates a loading startup warmup state with classPartials and yearGroups loading.
 *
 * @returns {object} Loading state.
 */
export function createLoadingWarmupState(): ReturnType<typeof createMockStartupWarmupState> {
  return createMockStartupWarmupState({
    warmupState: 'loading',
    isClassPartialsDatasetReady: false,
    isClassPartialsDatasetFailed: false,
    isClassPartialsDatasetTrustworthy: false,
    isYearGroupsDatasetReady: false,
    isYearGroupsDatasetFailed: false,
    isYearGroupsDatasetTrustworthy: false,
  });
}

/**
 * Creates a failed startup warmup state with classPartials failed.
 *
 * @returns {object} Failed state.
 */
export function createClassPartialsFailedWarmupState(): ReturnType<typeof createMockStartupWarmupState> {
  return createMockStartupWarmupState({
    warmupState: 'ready',
    isClassPartialsDatasetReady: false,
    isClassPartialsDatasetFailed: true,
    isClassPartialsDatasetTrustworthy: false,
    isYearGroupsDatasetReady: true,
    isYearGroupsDatasetFailed: false,
    isYearGroupsDatasetTrustworthy: true,
  });
}

/**
 * Creates a failed startup warmup state with yearGroups failed.
 *
 * @returns {object} Failed state.
 */
export function createYearGroupsFailedWarmupState(): ReturnType<typeof createMockStartupWarmupState> {
  return createMockStartupWarmupState({
    warmupState: 'ready',
    isClassPartialsDatasetReady: true,
    isClassPartialsDatasetFailed: false,
    isClassPartialsDatasetTrustworthy: true,
    isYearGroupsDatasetReady: false,
    isYearGroupsDatasetFailed: true,
    isYearGroupsDatasetTrustworthy: false,
  });
}

// ============================================================================
// Refetch Helper (plain function, NOT hoisted)
// ============================================================================

/**
 * Creates a ClassPartial-like plain object for refetch mock data.
 *
 * This is a local duplicate of `createFixtureClassPartial` from
 * classesPageTestHelpers.tsx. It cannot be imported because
 * `vi.hoisted()` callbacks execute before module imports are
 * available.
 *
 * @param {string} classId - The class identifier.
 * @param {string} className - The class name.
 * @param {string} yearGroupKey - The year group key.
 * @returns {object} A plain object matching the ClassPartial shape.
 */
export function _refetchClassPartial(
  classId: string,
  className: string,
  yearGroupKey: string
): {
  classId: string;
  className: string;
  cohortKey: null;
  courseLength: number;
  yearGroupKey: string;
  classOwner: null;
  teachers: never[];
  active: null;
} {
  return {
    classId,
    className,
    cohortKey: null,
    courseLength: 1,
    yearGroupKey,
    classOwner: null,
    teachers: [],
    active: null,
  };
}
