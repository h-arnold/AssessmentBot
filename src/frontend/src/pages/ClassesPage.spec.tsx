/**
 * ClassesPage component tests - Section 3: Owned-surface loading, blocking, and page-empty states
 * Section 4 Red: Year-group collapse behaviour tests (failing until implementation is complete)
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
 * - src/frontend/src/pages/classesPageModel.ts
 * - src/frontend/src/test/classes/classesPageTestHelpers.ts
 */

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppQueryClient } from '../query/queryClient';
import { queryKeys } from '../query/queryKeys';
import { renderWithFrontendProviders } from '../test/renderWithFrontendProviders';
import { buildClassesPageModel } from './classesPageModel';
import { ClassesPage } from './ClassesPage';
import { pageContent } from './pageContent';

// Import shared test helpers to reduce duplication
import {
  createQueryClientWithClassesData,
  renderClassesPage,
  verifyClassesPageModel,
  isInvalidDataViewModel,
  assertCollapseRegion,
  assertNoCollapseRegion,
  assertBlockingAlert,
  assertNoBlockingAlert,
  assertLoadingSkeleton,
  assertNoLoadingSkeleton,
  assertEmptyState,
  assertClassesPageHeading,
  assertClassCardExists,
  assertPanelHeaderExpanded,
  assertPanelContainsClass,
  MOCK_CLASS_PARTIALS,
  MOCK_EMPTY_CLASS_PARTIALS,
  MOCK_EMPTY_YEAR_GROUPS,
  MOCK_INVALID_CLASS_PARTIALS,
  MOCK_YEAR_GROUPS,
  MIXED_ORDER_CLASS_PARTIALS,
  MIXED_ORDER_YEAR_GROUPS,
  YEAR_GROUPS_WITH_EMPTY,
  CLASS_PARTIALS_FOR_EMPTY_PANEL,
  ALPHABETICAL_ORDER_CLASS_PARTIALS,
  TIE_BREAK_CLASS_PARTIALS,
  SINGLE_YEAR_GROUP,
} from '../test/classes/classesPageTestHelpers';

// Hoisted flag to control refetch mock for Section 6 tests
const mockRefetchEnabled = vi.hoisted(() => ({ value: false }));

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
function _refetchClassPartial(classId: string, className: string, yearGroupKey: string) {
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

// Hoisted mock data for refetch scenarios
const refetchClassPartials = vi.hoisted(() => [
  _refetchClassPartial('class-math-10a', 'Mathematics 10A', 'year-group-10'),
  _refetchClassPartial('class-math-10b', 'Mathematics 10B', 'year-group-10'),
  _refetchClassPartial('class-science-11', 'Science 11', 'year-group-11'),
] as const);

const refetchYearGroups = vi.hoisted(() => [
  { key: 'year-group-10', name: 'Year 10' },
  { key: 'year-group-11', name: 'Year 11' },
  { key: 'year-group-9', name: 'Year 9' },
] as const);

// Mock @tanstack/react-query to support Section 6 refetch tests
// This mock is controlled by mockRefetchEnabled.value flag
vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actualModule = (await importOriginal()) as Record<string, unknown>;

  return {
    ...actualModule,
    useQuery: vi.fn((options: unknown) => {
      const options_ = options as { queryKey: Array<unknown> };
      const isClassPartials = options_.queryKey[0] === 'classPartials';
      const isYearGroups = options_.queryKey[0] === 'yearGroups';

      if (mockRefetchEnabled.value && isClassPartials) {
        return {
          data: [...refetchClassPartials],
          isFetching: true,
          isError: false,
          isLoading: false,
          isPending: false,
          error: null,
          dataUpdatedAt: 0,
          refetch: vi.fn().mockResolvedValue({ data: [...refetchClassPartials] }),
        };
      }
      if (mockRefetchEnabled.value && isYearGroups) {
        return {
          data: [...refetchYearGroups],
          isFetching: true,
          isError: false,
          isLoading: false,
          isPending: false,
          error: null,
          dataUpdatedAt: 0,
          refetch: vi.fn().mockResolvedValue({ data: [...refetchYearGroups] }),
        };
      }
      // For non-refetch tests, pass through to the actual implementation
      // This allows other tests to work normally with queryClient.setQueryData()
       
      return (actualModule as { useQuery: (options: unknown) => unknown }).useQuery(options);
    }),
  };
});

// Helper to enable refetch mock for Section 6 tests
/**
 * Enables the refetch mock for Section 6 tests.
 */
function enableRefetchMock(): void {
  mockRefetchEnabled.value = true;
}

// Helper to disable refetch mock for Section 6 tests
/**
 * Disables the refetch mock for Section 6 tests.
 */
function disableRefetchMock(): void {
  mockRefetchEnabled.value = false;
}

const {
  getABClassPartialsMock,
  getYearGroupsMock,
  getCohortsMock,
  getAssignmentTopicsMock,
  getAssignmentDefinitionPartialsMock,
  useStartupWarmupStateMock,
} = vi.hoisted(() => ({
  getABClassPartialsMock: vi.fn(),
  getYearGroupsMock: vi.fn(),
  getCohortsMock: vi.fn(),
  getAssignmentTopicsMock: vi.fn(),
  getAssignmentDefinitionPartialsMock: vi.fn(),
  useStartupWarmupStateMock: vi.fn(),
}));

vi.mock('../features/auth/startupWarmupState', async (importOriginal) => {
  const actualModule = (await importOriginal()) as Record<string, unknown>;

  return {
    ...actualModule,
    useStartupWarmupState: useStartupWarmupStateMock,
  };
});

vi.mock('../services/googleClassrooms/classPartialsService', () => ({
  getABClassPartials: getABClassPartialsMock,
}));

vi.mock('../services/referenceData/referenceDataService', () => ({
  getYearGroups: getYearGroupsMock,
  getCohorts: getCohortsMock,
}));

vi.mock('../services/assignmentDefinition/assignmentDefinitionPartialsService', () => ({
  getAssignmentDefinitionPartials: getAssignmentDefinitionPartialsMock,
}));

vi.mock('../services/assignmentDefinition/assignmentTopicsService', () => ({
  getAssignmentTopics: getAssignmentTopicsMock,
}));

// Mock ClassPage component for shell integration tests
const { mockClassPage } = vi.hoisted(() => ({
  mockClassPage: vi.fn().mockReturnValue(null),
}));

vi.mock('../features/classPage/ClassPage', () => ({
  ClassPage: mockClassPage,
}));

// Mock ClassSelectionContext for shell integration tests
const { mockUseClassSelection } = vi.hoisted(() => ({
  mockUseClassSelection: vi.fn(() => ({
    selectedClassId: null as string | null,
    className: null as string | null,
    onSelectClass: vi.fn(),
    onNavigateToClasses: vi.fn(),
  })),
}));

vi.mock('../ClassSelectionContext', () => ({
  useClassSelection: mockUseClassSelection,
}));

/**
 * Helper to determine dataset status based on ready/failed state.
 *
 * @param {boolean} isFailed Whether the dataset has failed.
 * @param {boolean} isReady Whether the dataset is ready.
 * @returns {'failed' | 'ready' | 'loading'} Dataset status.
 */
function getDatasetStatus(isFailed: boolean, isReady: boolean): 'failed' | 'ready' | 'loading' {
  if (isFailed) {
    return 'failed';
  }
  if (isReady) {
    return 'ready';
  }
  return 'loading';
}

// Use shared mock fixtures from test helpers to reduce duplication
// These are the same as MOCK_* constants imported above
const mockYearGroups = MOCK_YEAR_GROUPS;
const mockClassPartials = MOCK_CLASS_PARTIALS;
const mockEmptyClassPartials = MOCK_EMPTY_CLASS_PARTIALS;
const mockEmptyYearGroups = MOCK_EMPTY_YEAR_GROUPS;
const mockInvalidClassPartials = MOCK_INVALID_CLASS_PARTIALS;

/**
 * Dataset state type for startup warmup mocks.
 */
type MockDatasetState = {
  status: 'loading' | 'ready' | 'failed';
  isTrustworthy: boolean;
};

/**
 * Dataset keys for the startup warmup state.
 */
const CLASS_PARTIALS_KEY = 'classPartials' as const;
const YEAR_GROUPS_KEY = 'yearGroups' as const;

/**
 * Creates a dataset state object for a given dataset.
 *
 * @param {boolean} isFailed Whether the dataset has failed.
 * @param {boolean} isReady Whether the dataset is ready.
 * @param {boolean} isTrustworthy Whether the dataset is trustworthy.
 * @returns {MockDatasetState} Dataset state.
 */
function createDatasetState(
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
 * Creates a mock startup warmup context value for testing.
 *
 * @param {object} options Override options.
 * @param {'loading' | 'ready' | 'failed'} options.warmupState Warmup state.
 * @param {boolean} options.isClassPartialsDatasetReady Whether classPartials dataset is ready.
 * @param {boolean} options.isClassPartialsDatasetFailed Whether classPartials dataset failed.
 * @param {boolean} options.isClassPartialsDatasetTrustworthy Whether classPartials dataset is trustworthy.
 * @param {boolean} options.isYearGroupsDatasetReady Whether yearGroups dataset is ready.
 * @param {boolean} options.isYearGroupsDatasetFailed Whether yearGroups dataset failed.
 * @param {boolean} options.isYearGroupsDatasetTrustworthy Whether yearGroups dataset is trustworthy.
 * @returns {import('../features/auth/startupWarmupState').StartupWarmupContextValue} Mock context value.
 */
/**
 * Options for creating a mock startup warmup state.
 */
type CreateMockStartupWarmupStateOptions = {
  warmupState?: 'loading' | 'ready' | 'failed';
  isClassPartialsDatasetReady?: boolean;
  isClassPartialsDatasetFailed?: boolean;
  isClassPartialsDatasetTrustworthy?: boolean;
  isYearGroupsDatasetReady?: boolean;
  isYearGroupsDatasetFailed?: boolean;
  isYearGroupsDatasetTrustworthy?: boolean;
};

/**
 * Dataset readiness checker for mock startup warmup state.
 *
 * @param {boolean} isClassPartialsDatasetReady Whether classPartials dataset is ready.
 * @param {boolean} isYearGroupsDatasetReady Whether yearGroups dataset is ready.
 * @returns {(datasetKey: string) => boolean} Dataset readiness function.
 */
function createIsDatasetReadyFunction(
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
function createIsDatasetFailedFunction(
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
 * @returns {import('../features/auth/startupWarmupState').StartupWarmupContextValue} Mock context value.
 */
// eslint-disable-next-line complexity -- Test helper with many optional parameters
function createMockStartupWarmupState(
  options: CreateMockStartupWarmupStateOptions = {}
): ReturnType<typeof useStartupWarmupStateMock> {
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
 * @returns {ReturnType<typeof useStartupWarmupStateMock>} Ready state.
 */
function createReadyWarmupState(): ReturnType<typeof useStartupWarmupStateMock> {
  return createMockStartupWarmupState();
}

/**
 * Creates a loading startup warmup state with classPartials and yearGroups loading.
 *
 * @returns {ReturnType<typeof useStartupWarmupStateMock>} Loading state.
 */
function createLoadingWarmupState(): ReturnType<typeof useStartupWarmupStateMock> {
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
 * @returns {ReturnType<typeof useStartupWarmupStateMock>} Failed state.
 */
function createClassPartialsFailedWarmupState(): ReturnType<typeof useStartupWarmupStateMock> {
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
 * @returns {ReturnType<typeof useStartupWarmupStateMock>} Failed state.
 */
function createYearGroupsFailedWarmupState(): ReturnType<typeof useStartupWarmupStateMock> {
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

describe('ClassesPage', () => {
  beforeEach(() => {
    // Mock all service calls to prevent actual API calls
    getABClassPartialsMock.mockResolvedValue([]);
    getYearGroupsMock.mockResolvedValue([]);
    getCohortsMock.mockResolvedValue([]);
    getAssignmentTopicsMock.mockResolvedValue([]);
    getAssignmentDefinitionPartialsMock.mockResolvedValue([]);

    // Default to ready warmup state
    useStartupWarmupStateMock.mockReturnValue(createReadyWarmupState());
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Page shell and heading', () => {
    it('renders the Classes page heading and summary from pageContent', () => {
      renderWithFrontendProviders(<ClassesPage />);

      assertClassesPageHeading();
      expect(screen.getByText(pageContent.classes.summary)).toBeInTheDocument();
    });
  });

  describe('Owned-surface loading, blocking, and page-empty states', () => {
    describe('Initial loading state', () => {
      it('renders skeleton while classPartials and yearGroups are still unresolved with no usable cache', () => {
        // Set up loading warmup state - datasets not ready yet
        useStartupWarmupStateMock.mockReturnValue(createLoadingWarmupState());

        renderWithFrontendProviders(<ClassesPage />);

        // Heading and summary should remain visible (owned by PageSection)
        assertClassesPageHeading();
        expect(screen.getByText(pageContent.classes.summary)).toBeInTheDocument();

        // Should render a skeleton in the owned content region
        assertLoadingSkeleton();

        // Collapse should not be visible yet
        assertNoCollapseRegion();
      });

      it('skips skeleton when trustworthy data is already cached even if wider warm-up is not ready', () => {
        // Set up warmup state where warmup is still loading but datasets are actually ready
        useStartupWarmupStateMock.mockReturnValue(
          createMockStartupWarmupState({
            warmupState: 'loading',
            isClassPartialsDatasetReady: true,
            isClassPartialsDatasetTrustworthy: true,
            isYearGroupsDatasetReady: true,
            isYearGroupsDatasetTrustworthy: true,
          })
        );

        // Use shared helper for rendering with data
        renderClassesPage();

        // Should NOT show skeleton because cache has usable data
        assertNoLoadingSkeleton();

        // This will fail until the view model integration is implemented
        // The ready state should render instead
        const { modelResult, isInvalid } = verifyClassesPageModel(mockClassPartials, mockYearGroups);
        expect(modelResult).toHaveProperty('panels');
        if (isInvalid) {
          // Blocking state
          assertBlockingAlert();
        } else {
          // Ready state with panels
          assertCollapseRegion();
        }
      });
    });

    describe('Query failure states', () => {
      it('shows blocking alert and suppresses collapse region on query failure', () => {
        // Simulate query failure - dataset is ready but not trustworthy
        useStartupWarmupStateMock.mockReturnValue(
          createMockStartupWarmupState({
            isClassPartialsDatasetReady: true,
            isClassPartialsDatasetFailed: false,
            isClassPartialsDatasetTrustworthy: false,
            isYearGroupsDatasetReady: true,
            isYearGroupsDatasetFailed: false,
            isYearGroupsDatasetTrustworthy: true,
          })
        );

        // Use shared helper for rendering with empty class partials
        const queryClient = createQueryClientWithClassesData([], mockYearGroups);
        renderWithFrontendProviders(<ClassesPage />, {
          queryClient,
        });

        // Should show blocking alert
        // This will fail until the blocking alert is implemented
        assertBlockingAlert();

        // Collapse should be suppressed
        assertNoCollapseRegion();
      });
    });

    describe('Invalid data states', () => {
      it('shows blocking alert for invalid data result from page-local view model', () => {
        useStartupWarmupStateMock.mockReturnValue(createReadyWarmupState());

        // Use shared helper for rendering with invalid data
        const queryClient = createQueryClientWithClassesData(mockInvalidClassPartials, mockYearGroups);
        renderWithFrontendProviders(<ClassesPage />, {
          queryClient,
        });

        // The view model should detect invalid data and return invalid view model
        const { modelResult } = verifyClassesPageModel(mockInvalidClassPartials, mockYearGroups);
        expect(modelResult).toHaveProperty('type', 'invalidClassesPageData');
        expect(modelResult).toHaveProperty('classIds');
        if (isInvalidDataViewModel(modelResult)) {
          expect(modelResult.classIds).toContain('class-invalid-1');
          expect(modelResult.classIds).toContain('class-invalid-2');
          expect(modelResult.classIds).toContain('class-invalid-3');
        }

        // Page should show blocking alert
        // This will fail until the blocking alert is implemented
        assertBlockingAlert();

        // Collapse should be suppressed
        assertNoCollapseRegion();
      });
    });

    describe('Recovery from warm-up failure', () => {
      it('recovers from failed classPartials warmup snapshot when live query resolves successfully', async () => {
        // Start with failed warmup snapshot for classPartials
        useStartupWarmupStateMock.mockReturnValue(createClassPartialsFailedWarmupState());

        const { queryClient } = renderWithFrontendProviders(<ClassesPage />);

        // Initially should show blocking state
        assertBlockingAlert();

        // Now simulate successful live query resolving using shared helper
        queryClient.setQueryData(queryKeys.classPartials(), [...mockClassPartials]);
        queryClient.setQueryData(queryKeys.yearGroups(), [...mockYearGroups]);

        // Wait for the component to re-render with the new data
        await waitFor(() => {
          // Should no longer show blocking alert
          assertNoBlockingAlert();
        });

        // This will fail until the recovery logic is implemented
        // Should now show ready state
        const { modelResult, isInvalid } = verifyClassesPageModel(mockClassPartials, mockYearGroups);
        expect(modelResult).toHaveProperty('panels');
        if (isInvalid) {
          assertBlockingAlert();
        } else {
          assertCollapseRegion();
        }
      });

      it('recovers from failed yearGroups warmup snapshot when live query resolves successfully', async () => {
        // Start with failed warmup snapshot for yearGroups
        useStartupWarmupStateMock.mockReturnValue(createYearGroupsFailedWarmupState());

        const { queryClient } = renderWithFrontendProviders(<ClassesPage />);

        // Initially should show blocking state
        assertBlockingAlert();

        // Now simulate successful live query resolving
        queryClient.setQueryData(queryKeys.yearGroups(), [...mockYearGroups]);
        queryClient.setQueryData(queryKeys.classPartials(), [...mockClassPartials]);

        // Wait for the component to re-render with the new data
        await waitFor(() => {
          // Should no longer show blocking alert
          assertNoBlockingAlert();
        });

        // This will fail until the recovery logic is implemented
        // Should now show ready state
        const { modelResult, isInvalid } = verifyClassesPageModel(mockClassPartials, mockYearGroups);
        expect(modelResult).toHaveProperty('panels');
        if (isInvalid) {
          assertBlockingAlert();
        } else {
          assertCollapseRegion();
        }
      });
    });

    describe('Empty states', () => {
      it('renders page-level Empty state when both datasets are trustworthy and empty', () => {
        useStartupWarmupStateMock.mockReturnValue(createReadyWarmupState());

        // Use shared helper for rendering with empty data
        renderClassesPage({
          classPartials: mockEmptyClassPartials,
          yearGroups: mockEmptyYearGroups,
        });

        // The view model should return empty panels
        const { modelResult } = verifyClassesPageModel(mockEmptyClassPartials, mockEmptyYearGroups);
        expect(modelResult).toHaveProperty('panels', []);
        expect(modelResult).toHaveProperty('defaultExpandedPanelKeys', []);

        // Page should show empty state
        assertEmptyState();

        // Collapse should not be visible
        assertNoCollapseRegion();
      });
    });

    describe('Section 4: Year-group collapse behaviour', () => {
      // Constants for expected counts
      const EXPECTED_PANEL_COUNT = 3;
      const EXPECTED_DEFAULT_EXPANDED_COUNT = 1;
      const EXPECTED_YEAR_10_CLASSES_COUNT = 2;
      const EXPECTED_YEAR_11_CLASSES_COUNT = 1;
      const EXPECTED_YEAR_9_CLASSES_COUNT = 1;
      const EXPECTED_PANELS_WITH_EMPTY_COUNT = 2;

      // Use shared fixtures from test helpers

      beforeEach(() => {
        useStartupWarmupStateMock.mockReturnValue(createReadyWarmupState());
      });

      it('verifies panel header order from a mixed year-group fixture', () => {
        // Use shared helper for rendering with mixed order data
        renderClassesPage({
          classPartials: MIXED_ORDER_CLASS_PARTIALS,
          yearGroups: MIXED_ORDER_YEAR_GROUPS,
        });

        // The view model should sort year groups alphabetically by name
        const { modelResult, isInvalid } = verifyClassesPageModel(
          MIXED_ORDER_CLASS_PARTIALS,
          MIXED_ORDER_YEAR_GROUPS
        );
        expect(modelResult).not.toHaveProperty('type');
        if (!isInvalid && 'panels' in modelResult) {
          expect((modelResult as { panels: unknown[] }).panels).toHaveLength(EXPECTED_PANEL_COUNT);
          
          // Expected alphabetical order: Year 10, Year 11, Year 9
          const panels = modelResult as { panels: { yearGroupKey: string; yearGroupLabel: string }[] };
          expect(panels.panels[0].yearGroupLabel).toBe('Year 10');
          expect(panels.panels[1].yearGroupLabel).toBe('Year 11');
          expect(panels.panels[2].yearGroupLabel).toBe('Year 9');
        }

        // These tests will fail until the collapse implementation is complete
        // Assert that collapse headers render in the correct alphabetical order
        assertCollapseRegion();

        // Find all collapse panel headers - they should be in alphabetical order
        // This will fail until Ant Design Collapse is implemented with proper panel headers
        const panelHeaders = screen.getAllByRole('heading', { level: 3 });
        expect(panelHeaders).toHaveLength(EXPECTED_PANEL_COUNT);
        expect(panelHeaders[0]).toHaveTextContent('Year 10');
        expect(panelHeaders[1]).toHaveTextContent('Year 11');
        expect(panelHeaders[2]).toHaveTextContent('Year 9');
      });

      it('verifies the first alphabetical panel is open on first ready render', () => {
        // Use shared helper for rendering with mixed order data
        renderClassesPage({
          classPartials: MIXED_ORDER_CLASS_PARTIALS,
          yearGroups: MIXED_ORDER_YEAR_GROUPS,
        });

        // The view model should have the first alphabetical panel as default expanded
        const { modelResult, isInvalid } = verifyClassesPageModel(
          MIXED_ORDER_CLASS_PARTIALS,
          MIXED_ORDER_YEAR_GROUPS
        );
        expect(modelResult).not.toHaveProperty('type');

        if (!isInvalid && 'defaultExpandedPanelKeys' in modelResult) {
          const viewModel = modelResult as { panels: unknown[]; defaultExpandedPanelKeys: string[] };
          expect(viewModel.defaultExpandedPanelKeys).toHaveLength(EXPECTED_DEFAULT_EXPANDED_COUNT);
          // First alphabetical is Year 10
          expect(viewModel.defaultExpandedPanelKeys[0]).toBe('year-group-10');
        }

        // This will fail until the collapse implementation uses defaultActiveKey
        // Assert that the first panel body is visible (expanded)
        assertCollapseRegion();

        // The first panel (Year 10) should have its content visible
        const year10Panel = screen.getByRole('region', { name: /year 10/i });
        expect(year10Panel).toBeInTheDocument();
        // Ant Design's Collapse.Panel header button manages aria-expanded
        assertPanelHeaderExpanded(/year 10/i, true);
      });

      it('verifies an empty year-group panel shows its own empty presentation', () => {
        // Use shared helper for rendering with empty panel data
        renderClassesPage({
          classPartials: CLASS_PARTIALS_FOR_EMPTY_PANEL,
          yearGroups: YEAR_GROUPS_WITH_EMPTY,
        });

        // The view model should create panels for all year groups, even empty ones
        const { modelResult, isInvalid } = verifyClassesPageModel(
          CLASS_PARTIALS_FOR_EMPTY_PANEL,
          YEAR_GROUPS_WITH_EMPTY
        );
        expect(modelResult).not.toHaveProperty('type');

        if (!isInvalid && 'panels' in modelResult) {
          const viewModel = modelResult as { panels: { yearGroupKey: string; classes: unknown[] }[] };
          expect(viewModel.panels).toHaveLength(EXPECTED_PANELS_WITH_EMPTY_COUNT);

          // Year 9 panel should have no classes
          const year9Panel = viewModel.panels.find((p) => p.yearGroupKey === 'year-group-9');
          expect(year9Panel).toBeDefined();
          expect(year9Panel?.classes).toHaveLength(0);
        }

        // This will fail until the in-panel empty presentation is implemented
        // Assert that the empty year group panel shows in-panel empty message
        assertCollapseRegion();

        // The Year 9 panel should show an empty message within its body
        // This will fail until Card-based empty state is implemented
        const year9PanelRegion = screen.getByRole('region', { name: /year 9/i });
        expect(year9PanelRegion).toBeInTheDocument();
        expect(year9PanelRegion).toHaveTextContent(/no classes/i);
      });

      it('verifies cards only render under their matching year-group panel', () => {
        // Use shared helper for rendering with mixed order data
        renderClassesPage({
          classPartials: MIXED_ORDER_CLASS_PARTIALS,
          yearGroups: MIXED_ORDER_YEAR_GROUPS,
        });

        // The view model should group classes by their yearGroupKey
        const { modelResult, isInvalid } = verifyClassesPageModel(
          MIXED_ORDER_CLASS_PARTIALS,
          MIXED_ORDER_YEAR_GROUPS
        );
        expect(modelResult).not.toHaveProperty('type');

        if (!isInvalid && 'panels' in modelResult) {
          const viewModel = modelResult as {
            panels: { yearGroupKey: string; classes: { classId: string; className: string }[] }[]
          };

          // Verify panel structure from view model
          const year10Panel = viewModel.panels.find((p) => p.yearGroupKey === 'year-group-10');
          expect(year10Panel).toBeDefined();
          expect(year10Panel?.classes).toHaveLength(EXPECTED_YEAR_10_CLASSES_COUNT);

          const year11Panel = viewModel.panels.find((p) => p.yearGroupKey === 'year-group-11');
          expect(year11Panel).toBeDefined();
          expect(year11Panel?.classes).toHaveLength(EXPECTED_YEAR_11_CLASSES_COUNT);

          const year9Panel = viewModel.panels.find((p) => p.yearGroupKey === 'year-group-9');
          expect(year9Panel).toBeDefined();
          expect(year9Panel?.classes).toHaveLength(EXPECTED_YEAR_9_CLASSES_COUNT);
        }

        // This will fail until the collapse with cards is implemented
        assertCollapseRegion();

        // Find all class cards
        assertClassCardExists(/mathematics 10a/i);
        assertClassCardExists(/science 9/i);
        assertClassCardExists(/mathematics 11a/i);

        // Verify card-to-panel association
        assertPanelContainsClass(/year 10/i, /mathematics 10a/i);
        assertPanelContainsClass(/year 11/i, /mathematics 11a/i);
        assertPanelContainsClass(/year 9/i, /science 9/i);
      });
    });

    // ==========================================================================
    // Section 5: Render class cards and placeholder action affordances
    // ==========================================================================

    describe('Section 5: Render class cards and placeholder action affordances', () => {
      // Test constants for magic numbers
      const EXPECTED_ALPHABETICAL_CLASSES_COUNT = 3;
      const EXPECTED_TIE_BREAK_CLASSES_COUNT = 3;
      const EXPECTED_BUTTONS_PER_CARD = 2; // Only View and Edit

      // Use shared fixtures from test helpers

      beforeEach(() => {
        useStartupWarmupStateMock.mockReturnValue(createReadyWarmupState());
      });

      it('verifies card order inside a panel follows className then classId', () => {
        // Use shared helper for rendering with alphabetical order data
        renderClassesPage({
          classPartials: ALPHABETICAL_ORDER_CLASS_PARTIALS,
          yearGroups: mockYearGroups,
        });

        // Verify the view model sorts correctly
        const { modelResult, isInvalid } = verifyClassesPageModel(
          ALPHABETICAL_ORDER_CLASS_PARTIALS,
          mockYearGroups
        );
        expect(modelResult).not.toHaveProperty('type');

        if (!isInvalid && 'panels' in modelResult) {
          const viewModel = modelResult as {
            panels: {
              yearGroupKey: string;
              classes: { classId: string; className: string; yearGroupKey: string; yearGroupLabel: string }[];
            }[];
          };

          const year10Panel = viewModel.panels.find(
            (p) => p.yearGroupKey === 'year-group-10'
          );
          expect(year10Panel).toBeDefined();
          expect(year10Panel?.classes).toHaveLength(EXPECTED_ALPHABETICAL_CLASSES_COUNT);

          // Expected order: English 10, Mathematics 10A, Mathematics 10B
          const expectedClasses = [
            { classId: 'class-english-10', className: 'English 10', yearGroupKey: 'year-group-10', yearGroupLabel: 'Year 10' },
            { classId: 'class-math-10a', className: 'Mathematics 10A', yearGroupKey: 'year-group-10', yearGroupLabel: 'Year 10' },
            { classId: 'class-math-10b', className: 'Mathematics 10B', yearGroupKey: 'year-group-10', yearGroupLabel: 'Year 10' },
          ];
          expect(year10Panel?.classes).toEqual(expectedClasses);
        }

        // Assert rendered cards match the sorted order
        const year10PanelRegion = screen.getByRole('region', { name: /year 10/i });
        expect(year10PanelRegion).toBeInTheDocument();

        const cards = year10PanelRegion.querySelectorAll('[role="article"]');
        expect(cards).toHaveLength(EXPECTED_ALPHABETICAL_CLASSES_COUNT);

        const cardTitles = [...cards].map((card) => card.getAttribute('aria-label'));
        expect(cardTitles).toEqual(['English 10', 'Mathematics 10A', 'Mathematics 10B']);
      });

      it('verifies card order uses classId as tie-break when className is identical', () => {
        // Use shared helper for rendering with tie-break data
        renderClassesPage({
          classPartials: TIE_BREAK_CLASS_PARTIALS,
          yearGroups: SINGLE_YEAR_GROUP,
        });

        // Verify the view model sorts by className then classId
        const { modelResult, isInvalid } = verifyClassesPageModel(
          TIE_BREAK_CLASS_PARTIALS,
          SINGLE_YEAR_GROUP
        );
        expect(modelResult).not.toHaveProperty('type');

        if (!isInvalid && 'panels' in modelResult) {
          const viewModel = modelResult as {
            panels: {
              yearGroupKey: string;
              classes: { classId: string; className: string; yearGroupKey: string; yearGroupLabel: string }[];
            }[];
          };

          const year10Panel = viewModel.panels.find(
            (p) => p.yearGroupKey === 'year-group-10'
          );
          expect(year10Panel).toBeDefined();
          expect(year10Panel?.classes).toHaveLength(EXPECTED_TIE_BREAK_CLASSES_COUNT);

          // Expected order: A Class, Z Class (with classId a-z), Z Class (with classId b-z)
          const expectedClasses = [
            { classId: 'class-b-a', className: 'A Class', yearGroupKey: 'year-group-10', yearGroupLabel: 'Year 10' },
            { classId: 'class-a-z', className: 'Z Class', yearGroupKey: 'year-group-10', yearGroupLabel: 'Year 10' },
            { classId: 'class-b-z', className: 'Z Class', yearGroupKey: 'year-group-10', yearGroupLabel: 'Year 10' },
          ];
          expect(year10Panel?.classes).toEqual(expectedClasses);
        }

        // Assert rendered order matches
        const year10PanelRegion = screen.getByRole('region', { name: /year 10/i });
        expect(year10PanelRegion).toBeInTheDocument();

        const cards = year10PanelRegion.querySelectorAll('[role="article"]');
        expect(cards).toHaveLength(EXPECTED_TIE_BREAK_CLASSES_COUNT);

        const cardTitles = [...cards].map((card) => card.getAttribute('aria-label'));
        expect(cardTitles).toEqual(['A Class', 'Z Class', 'Z Class']);
      });

      it('verifies both placeholder buttons are visible with correct enabled/disabled states for every rendered card', () => {
        // Pre-populate the query client cache BEFORE rendering
        const queryClient = createAppQueryClient();
        queryClient.setQueryData(queryKeys.classPartials(), [
          ...mockClassPartials,
        ]);
        queryClient.setQueryData(queryKeys.yearGroups(), [...mockYearGroups]);

        renderWithFrontendProviders(<ClassesPage />, {
          queryClient,
        });

        // Find all View buttons - there should be one per card
        const viewButtons = screen.getAllByRole('button', { name: /view/i });
        expect(viewButtons.length).toBeGreaterThan(0);

        // Find all Assess Task buttons - there should be one per card
        const assessTaskButtons = screen.getAllByRole('button', { name: 'Assess Task' });
        expect(assessTaskButtons.length).toBeGreaterThan(0);

        // Total cards = total View buttons = total Assess Task buttons
        const expectedCardCount = viewButtons.length;
        expect(assessTaskButtons).toHaveLength(expectedCardCount);

        // Verify every View button is enabled and visible
        for (const viewButton of viewButtons) {
          expect(viewButton).toBeInTheDocument();
          expect(viewButton).toBeEnabled();
          expect(viewButton).toBeVisible();
        }

        // Verify every Assess Task button is enabled and visible
        for (const assessButton of assessTaskButtons) {
          expect(assessButton).toBeInTheDocument();
          expect(assessButton).toBeEnabled();
          expect(assessButton).toBeVisible();
        }
      });

      it('proves no extra metadata such as cohort, teacher list, or status chips is rendered in this iteration', () => {
        // Pre-populate the query client cache BEFORE rendering
        const queryClient = createAppQueryClient();
        queryClient.setQueryData(queryKeys.classPartials(), [
          ...mockClassPartials,
        ]);
        queryClient.setQueryData(queryKeys.yearGroups(), [...mockYearGroups]);

        renderWithFrontendProviders(<ClassesPage />, {
          queryClient,
        });

        // Get all rendered cards
        const cards = screen.getAllByRole('article');
        expect(cards.length).toBeGreaterThan(0);

        // Expected: cards contain only className as title and View/Edit disabled buttons
        // No cohort, teacher, status, Google Classroom, or document type metadata
        const forbiddenPatterns = [
          /cohort/i,
          /teacher/i,
          /instructor/i,
          /active/i,
          /inactive/i,
          /google/i,
          /classroom/i,
          /slides/i,
          /document/i,
        ];

        for (const card of cards) {
          for (const pattern of forbiddenPatterns) {
            expect(card).not.toHaveTextContent(pattern);
          }

          // Verify View and Assess Task buttons are present
          const cardViewButtons = screen.getAllByRole('button', { name: /view/i });
          const cardAssessButtons = screen.getAllByRole('button', { name: 'Assess Task' });
          expect(cardViewButtons.length).toBeGreaterThan(0);
          expect(cardAssessButtons.length).toBeGreaterThan(0);
        }
      });

      it('proves no drag or reorder affordance is present', () => {
        // Pre-populate the query client cache BEFORE rendering
        const queryClient = createAppQueryClient();
        queryClient.setQueryData(queryKeys.classPartials(), [
          ...mockClassPartials,
        ]);
        queryClient.setQueryData(queryKeys.yearGroups(), [...mockYearGroups]);

        renderWithFrontendProviders(<ClassesPage />, {
          queryClient,
        });

        // Get all rendered cards
        const cards = screen.getAllByRole('article');
        expect(cards.length).toBeGreaterThan(0);

        // Expected: cards have only View and Edit buttons, no drag/reorder affordances

        for (const card of cards) {
          // Should NOT contain drag handle
          expect(card).not.toHaveAttribute('draggable', 'true');
          expect(card).not.toHaveClass(/drag/);
          expect(card).not.toHaveClass(/draggable/);

          // Should NOT contain reorder/sort buttons or text
          expect(card).not.toHaveTextContent(/reorder/i);
          expect(card).not.toHaveTextContent(/move/i);
          expect(card).not.toHaveClass(/sort/);
          expect(card).not.toHaveClass(/handle/);

          // Check that the card has exactly View and Assess Task buttons
          const cardButtons = card.querySelectorAll('button');
          expect(cardButtons).toHaveLength(EXPECTED_BUTTONS_PER_CARD);
          // The View button has textContent "View"
          expect(cardButtons[0]?.textContent).toMatch(/view/i);
          // The Assess Task button is icon-only; its accessible name is "Assess Task"
          expect(cardButtons[1]?.getAttribute('aria-label')).toBe('Assess Task');
        }

        // Also verify the card region wrapper has no drag/reorder classes
        const cardRegion = screen.getByRole('region', { name: /year.*group/i });
        expect(cardRegion).not.toHaveClass(/drag/);
        expect(cardRegion).not.toHaveClass(/draggable/);
        expect(cardRegion).not.toHaveClass(/sort/);
      });
      // ==========================================================================
      // Section 4 Red: Assess Task button replacement tests
      // These verify that the Edit button is replaced by an Assess Task icon
      // button. They SHOULD FAIL in the RED phase because the replacement has
      // not been implemented yet. The production code still renders "Edit"
      // buttons, so assertions that target "Assess Task" buttons will fail.
      // ==========================================================================

      it('replaces Edit button with Assess Task icon button on every card', () => {
        renderClassesPage();

        // Edit buttons should no longer exist — FAILS because production code still has Edit
        const editButtons = screen.queryAllByRole('button', { name: /edit/i });
        expect(editButtons).toHaveLength(0);

        // Assess Task buttons should exist on every card — FAILS because not implemented yet
        const assessTaskButtons = screen.getAllByRole('button', { name: 'Assess Task' });
        const cards = screen.getAllByRole('article');
        expect(assessTaskButtons).toHaveLength(cards.length);
        expect(assessTaskButtons.length).toBeGreaterThan(0);
      });

      it('renders the View button as enabled (not disabled)', () => {
        renderClassesPage();

        const viewButtons = screen.getAllByRole('button', { name: /view/i });
        expect(viewButtons.length).toBeGreaterThan(0);

        for (const viewButton of viewButtons) {
          expect(viewButton).toBeVisible();
          expect(viewButton).toBeEnabled();
        }
      });

      it('renders Assess Task buttons with aria-label="Assess Task"', () => {
        renderClassesPage();

        // FAILS because no "Assess Task" buttons exist yet in production code
        const assessTaskButtons = screen.getAllByRole('button', { name: 'Assess Task' });
        expect(assessTaskButtons.length).toBeGreaterThan(0);

        for (const button of assessTaskButtons) {
          // Icon-only button must carry aria-label as its accessible name
          expect(button).toHaveAttribute('aria-label', 'Assess Task');
          // The button should be enabled (not disabled like the old Edit button)
          expect(button).toBeEnabled();
          expect(button).toBeVisible();
        }
      });

      it('maintains card width at 268 px max-width with the new icon button', () => {
        const MAX_CARD_WIDTH_PX = 268;
        renderClassesPage();

        const cards = screen.getAllByRole('article');
        expect(cards.length).toBeGreaterThan(0);

        for (const card of cards) {
          // JSDOM getComputedStyle may not resolve inline styles; check inline style as fallback
          const { maxWidth } = globalThis.getComputedStyle(card);
          let maxWidthPx: number;
          if (maxWidth && maxWidth !== 'none') {
            maxWidthPx = Number.parseInt(maxWidth, 10);
          } else {
            const inlineMaxWidth = (card as HTMLElement).style.maxWidth;
            maxWidthPx = inlineMaxWidth && inlineMaxWidth !== 'none'
              ? Number.parseInt(inlineMaxWidth, 10)
              : Number.POSITIVE_INFINITY;
          }
          expect(maxWidthPx).toBeLessThanOrEqual(MAX_CARD_WIDTH_PX);
        }
      });
    });

    // ==========================================================================
    // Section 6: Harden refresh transitions, accessibility, and narrow-viewport behaviour
    // ==========================================================================

    describe('Section 6: Refresh transitions and accessibility', () => {
      const REFRESH_TEXT_PATTERN = /refreshing|updating|loading/i;

      beforeEach(() => {
        useStartupWarmupStateMock.mockReturnValue(createReadyWarmupState());
        // Ensure refetch mock is disabled by default
        disableRefetchMock();
      });

      afterEach(() => {
        disableRefetchMock();
      });

      it('keeps grouped content visible with aria-busy="true" and visible refresh text when trustworthy cache data exists and a deferred refetch is in flight', async () => {
        // Enable refetch mocking for this test
        enableRefetchMock();

        const queryClient = createAppQueryClient();

        renderWithFrontendProviders(<ClassesPage />, {
          queryClient,
        });

        // Wait for the ready state to render (collapse content should be visible)
        const collapseRegion = await screen.findByRole('region', { name: /year.*group/i });
        expect(collapseRegion).toBeInTheDocument();

        // Get the content section - this has aria-label="Classes page content"
        const contentSection = screen.getByLabelText('Classes page content');
        expect(contentSection).toBeInTheDocument();

        // The section element has implicit role="region"
        expect(contentSection.tagName).toBe('SECTION');

        // During a background refetch (when isFetching is true), the section should have aria-busy="true"
        expect(contentSection).toHaveAttribute('aria-busy', 'true');

        // There should be visible refresh text
        expect(screen.getByText(REFRESH_TEXT_PATTERN)).toBeInTheDocument();

        // Verify the grouped content (collapse) is still visible during refresh
        expect(collapseRegion).toBeInTheDocument();
      });

      it('clears busy state without showing initial skeleton again after a successful refetch', async () => {
        const queryClient = createAppQueryClient();
        queryClient.setQueryData(queryKeys.classPartials(), [...mockClassPartials]);
        queryClient.setQueryData(queryKeys.yearGroups(), [...mockYearGroups]);

        renderWithFrontendProviders(<ClassesPage />, {
          queryClient,
        });

        // Wait for the ready state to render
        const collapseRegion = await screen.findByRole('region', { name: /year.*group/i });
        expect(collapseRegion).toBeInTheDocument();

        const contentSection = screen.getByLabelText('Classes page content');

        // Verify initial state: content is visible
        expect(contentSection).toBeInTheDocument();

        // Simulate a background refetch completing successfully with new data
        const updatedClassPartials = [
          ...mockClassPartials,
          {
            classId: 'class-new-1',
            className: 'New Class',
            cohortKey: null,
            courseLength: 1,
            yearGroupKey: 'year-group-10',
            classOwner: null,
            teachers: [],
            active: null,
          },
        ];

        // Update the cache - this simulates a refetch completing
        queryClient.setQueryData(queryKeys.classPartials(), [...updatedClassPartials]);

        // Wait for re-render
        await waitFor(() => {
          // After refetch completes, busy state should be cleared
          expect(contentSection).not.toHaveAttribute('aria-busy', 'true');
        });

        // Initial skeleton should NOT be visible after refetch
        expect(screen.queryByRole('status', { name: /classes page loading/i })).not.toBeInTheDocument();

        // The collapse should still be visible with updated/new content
        expect(screen.getByRole('region', { name: /year.*group/i })).toBeInTheDocument();
      });

      it('transitions to blocking alert and suppresses collapse when refetch resolves with invalid or unresolvable grouping data', async () => {
        const queryClient = createAppQueryClient();
        queryClient.setQueryData(queryKeys.classPartials(), [...mockClassPartials]);
        queryClient.setQueryData(queryKeys.yearGroups(), [...mockYearGroups]);

        renderWithFrontendProviders(<ClassesPage />, {
          queryClient,
        });

        // Wait for the ready state to render
        const collapseRegion = await screen.findByRole('region', { name: /year.*group/i });
        expect(collapseRegion).toBeInTheDocument();

        // Simulate a refetch that returns invalid data (unresolvable yearGroupKey)
        const invalidClassPartials = [
          {
            classId: 'class-invalid-refetch',
            className: 'Invalid Class',
            cohortKey: null,
            courseLength: 1,
            yearGroupKey: 'year-group-invalid', // This doesn't exist in yearGroups
            classOwner: null,
            teachers: [],
            active: null,
          },
        ];

        queryClient.setQueryData(queryKeys.classPartials(), [...invalidClassPartials]);

        // Wait for re-render and model validation
        await waitFor(() => {
          // The view model should detect invalid data
          const modelResult = buildClassesPageModel(invalidClassPartials, mockYearGroups);
          expect(modelResult).toHaveProperty('type', 'invalidClassesPageData');
        });

        // The page should show blocking alert
        const alert = screen.getByRole('alert');
        expect(alert).toBeInTheDocument();
        expect(alert).toHaveTextContent(/could not be trusted or loaded/i);

        // Collapse should be suppressed
        expect(screen.queryByRole('region', { name: /year.*group/i })).not.toBeInTheDocument();
      });

      it('exposes expected accessible semantics for loading region and busy region', async () => {
        // Enable refetch mocking for this test
        enableRefetchMock();

        const queryClient = createAppQueryClient();

        renderWithFrontendProviders(<ClassesPage />, {
          queryClient,
        });

        // Wait for the ready state to render
        const collapseRegion = await screen.findByRole('region', { name: /year.*group/i });
        expect(collapseRegion).toBeInTheDocument();

        // The content section should exist and be accessible
        const contentSection = screen.getByLabelText('Classes page content');
        expect(contentSection).toBeInTheDocument();

        // Check that the section has the correct aria-label
        expect(contentSection).toHaveAttribute('aria-label', 'Classes page content');

        // During background refresh, the region should have aria-busy="true"
        expect(contentSection).toHaveAttribute('aria-busy', 'true');

        // There should be a visible status region for refresh feedback
        const statusRegions = screen.getAllByRole('status');
        expect(statusRegions.length).toBeGreaterThan(0);

        // At least one status region should have refresh-related text
        const refreshStatus = screen.getByText(REFRESH_TEXT_PATTERN);
        expect(refreshStatus).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Shell integration: selectedClassId state and ClassPage conditional rendering
  // ==========================================================================

  describe('Shell integration', () => {
    beforeEach(() => {
      useStartupWarmupStateMock.mockReturnValue(createReadyWarmupState());
      // Reset context mock to default state (no class selected)
      mockUseClassSelection.mockReturnValue({
        selectedClassId: null,
        className: null,
        onSelectClass: vi.fn(),
        onNavigateToClasses: vi.fn(),
      });
    });

    it('renders the View button as enabled (not disabled)', () => {
      renderClassesPage();

      const viewButtons = screen.getAllByRole('button', { name: /view/i });
      expect(viewButtons.length).toBeGreaterThan(0);
      for (const button of viewButtons) {
        expect(button).toBeEnabled();
      }
    });

    it('clicking the View button calls onSelectClass from context', async () => {
      const user = userEvent.setup();
      const onSelectClass = vi.fn();
      mockUseClassSelection.mockReturnValue({
        selectedClassId: null,
        className: null,
        onSelectClass,
        onNavigateToClasses: vi.fn(),
      });

      renderClassesPage();

      const viewButtons = screen.getAllByRole('button', { name: /view/i });
      await user.click(viewButtons[0]);

      // onSelectClass should have been called with classId and className
      expect(onSelectClass).toHaveBeenCalled();
      const callArguments = onSelectClass.mock.calls[0] as unknown[];
      expect(callArguments[0]).toBeTruthy();
      expect(callArguments[1]).toBeTruthy();
    });

    it('when selectedClassId is set in context, ClassPage is rendered with correct classId', () => {
      const testClassId = 'class-test-123';
      mockUseClassSelection.mockReturnValue({
        selectedClassId: testClassId,
        className: 'Test Class',
        onSelectClass: vi.fn(),
        onNavigateToClasses: vi.fn(),
      });

      renderClassesPage();

      // ClassPage should be rendered
      expect(mockClassPage).toHaveBeenCalled();
      // ClassPage should receive the correct classId
      const classPageProperties = mockClassPage.mock.calls[0][0] as Record<string, unknown>;
      expect(classPageProperties.classId).toBe(testClassId);
    });

    it('the View button does not have tabIndex=-1', () => {
      renderClassesPage();

      const viewButtons = screen.getAllByRole('button', { name: /view/i });
      expect(viewButtons.length).toBeGreaterThan(0);
      for (const button of viewButtons) {
        expect(button).not.toHaveAttribute('tabIndex', '-1');
      }
    });
  });
});
