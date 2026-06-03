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
 * - src/frontend/src/pages/classes/classesPageModel.ts
 */

import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppQueryClient } from '../query/queryClient';
import { queryKeys } from '../query/queryKeys';
import { renderWithFrontendProviders } from '../test/renderWithFrontendProviders';
import { buildClassesPageModel } from './classes/classesPageModel';
import { ClassesPage } from './ClassesPage';
import { pageContent } from './pageContent';
import type { ClassPartial } from '../services/classPartials.zod';
import type { YearGroup } from '../services/referenceData.zod';

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

vi.mock('../services/classPartialsService', () => ({
  getABClassPartials: getABClassPartialsMock,
}));

vi.mock('../services/referenceDataService', () => ({
  getYearGroups: getYearGroupsMock,
  getCohorts: getCohortsMock,
}));

vi.mock('../services/assignmentDefinitionPartialsService', () => ({
  getAssignmentDefinitionPartials: getAssignmentDefinitionPartialsMock,
}));

vi.mock('../services/assignmentTopicsService', () => ({
  getAssignmentTopics: getAssignmentTopicsMock,
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

// Test fixtures matching SPEC.md and CLASSES_PAGE_LAYOUT.md requirements
// Note: ClassPartial requires all fields from the schema: classId, className, cohortKey,
// courseLength, yearGroupKey, classOwner, teachers, active
const mockYearGroups: YearGroup[] = [
  { key: 'year-group-10', name: 'Year 10' },
  { key: 'year-group-11', name: 'Year 11' },
  { key: 'year-group-9', name: 'Year 9' },
] as const;

const mockClassPartials: ClassPartial[] = [
  {
    classId: 'class-math-10a',
    className: 'Mathematics 10A',
    cohortKey: null,
    courseLength: 1,
    yearGroupKey: 'year-group-10',
    classOwner: null,
    teachers: [],
    active: null,
  },
  {
    classId: 'class-math-10b',
    className: 'Mathematics 10B',
    cohortKey: null,
    courseLength: 1,
    yearGroupKey: 'year-group-10',
    classOwner: null,
    teachers: [],
    active: null,
  },
  {
    classId: 'class-science-11',
    className: 'Science 11',
    cohortKey: null,
    courseLength: 1,
    yearGroupKey: 'year-group-11',
    classOwner: null,
    teachers: [],
    active: null,
  },
] as const;

const mockEmptyClassPartials: ClassPartial[] = [];
const mockEmptyYearGroups: YearGroup[] = [];

// Invalid class partials for trust failure testing
const mockInvalidClassPartials: ClassPartial[] = [
  {
    classId: 'class-invalid-1',
    className: null,
    cohortKey: null,
    courseLength: 1,
    yearGroupKey: 'year-group-10',
    classOwner: null,
    teachers: [],
    active: null,
  },
  {
    classId: 'class-invalid-2',
    className: 'Valid Class',
    cohortKey: null,
    courseLength: 1,
    yearGroupKey: null,
    classOwner: null,
    teachers: [],
    active: null,
  },
  {
    classId: 'class-invalid-3',
    className: 'Another Valid',
    cohortKey: null,
    courseLength: 1,
    yearGroupKey: 'year-group-invalid',
    classOwner: null,
    teachers: [],
    active: null,
  },
] as const;

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

      expect(
        screen.getByRole('heading', { level: 2, name: pageContent.classes.heading })
      ).toBeInTheDocument();
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
        expect(
          screen.getByRole('heading', { level: 2, name: pageContent.classes.heading })
        ).toBeInTheDocument();
        expect(screen.getByText(pageContent.classes.summary)).toBeInTheDocument();

        // Should render a skeleton in the owned content region
        const skeletonRegion = screen.getByRole('status');
        expect(skeletonRegion).toBeInTheDocument();
        expect(skeletonRegion).toHaveAttribute('aria-label', expect.stringContaining('loading'));

        // Collapse should not be visible yet
        expect(screen.queryByRole('region', { name: /year.*group/i })).not.toBeInTheDocument();
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

        // Pre-populate the query client cache BEFORE rendering
        const queryClient = createAppQueryClient();
        queryClient.setQueryData(queryKeys.classPartials(), [...mockClassPartials]);
        queryClient.setQueryData(queryKeys.yearGroups(), [...mockYearGroups]);

        renderWithFrontendProviders(<ClassesPage />, {
          queryClient,
        });

        // Should NOT show skeleton because cache has usable data
        expect(screen.queryByRole('status', { name: /loading/i })).not.toBeInTheDocument();

        // This will fail until the view model integration is implemented
        // The ready state should render instead
        const modelResult = buildClassesPageModel(mockClassPartials, mockYearGroups);
        expect(modelResult).toHaveProperty('panels');
        if ('type' in modelResult && modelResult.type === 'invalidClassesPageData') {
          // Blocking state
          expect(screen.getByRole('alert')).toBeInTheDocument();
        } else {
          // Ready state with panels
          expect(screen.getByRole('region', { name: /year.*group/i })).toBeInTheDocument();
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

        // Pre-populate the query client cache BEFORE rendering
        const queryClient = createAppQueryClient();
        queryClient.setQueryData(queryKeys.classPartials(), []);
        queryClient.setQueryData(queryKeys.yearGroups(), [...mockYearGroups]);

        renderWithFrontendProviders(<ClassesPage />, {
          queryClient,
        });

        // Should show blocking alert
        // This will fail until the blocking alert is implemented
        const alert = screen.getByRole('alert');
        expect(alert).toBeInTheDocument();
        expect(alert).toHaveTextContent(/could not be trusted or loaded/i);

        // Collapse should be suppressed
        expect(screen.queryByRole('region', { name: /year.*group/i })).not.toBeInTheDocument();
      });
    });

    describe('Invalid data states', () => {
      it('shows blocking alert for invalid data result from page-local view model', () => {
        useStartupWarmupStateMock.mockReturnValue(createReadyWarmupState());

        // Pre-populate the query client cache BEFORE rendering
        const queryClient = createAppQueryClient();
        queryClient.setQueryData(queryKeys.classPartials(), [...mockInvalidClassPartials]);
        queryClient.setQueryData(queryKeys.yearGroups(), [...mockYearGroups]);

        renderWithFrontendProviders(<ClassesPage />, {
          queryClient,
        });

        // The view model should detect invalid data and return invalid view model
        const modelResult = buildClassesPageModel(mockInvalidClassPartials, mockYearGroups);
        expect(modelResult).toHaveProperty('type', 'invalidClassesPageData');
        expect(modelResult).toHaveProperty('classIds');
        expect((modelResult as { classIds: string[] }).classIds).toContain('class-invalid-1');
        expect((modelResult as { classIds: string[] }).classIds).toContain('class-invalid-2');
        expect((modelResult as { classIds: string[] }).classIds).toContain('class-invalid-3');

        // Page should show blocking alert
        // This will fail until the blocking alert is implemented
        const alert = screen.getByRole('alert');
        expect(alert).toBeInTheDocument();

        // Collapse should be suppressed
        expect(screen.queryByRole('region', { name: /year.*group/i })).not.toBeInTheDocument();
      });
    });

    describe('Recovery from warm-up failure', () => {
      it('recovers from failed classPartials warmup snapshot when live query resolves successfully', async () => {
        // Start with failed warmup snapshot for classPartials
        useStartupWarmupStateMock.mockReturnValue(createClassPartialsFailedWarmupState());

        const { queryClient } = renderWithFrontendProviders(<ClassesPage />);

        // Initially should show blocking state
        expect(screen.getByRole('alert')).toBeInTheDocument();

        // Now simulate successful live query resolving
        queryClient.setQueryData(queryKeys.classPartials(), [...mockClassPartials]);
        queryClient.setQueryData(queryKeys.yearGroups(), [...mockYearGroups]);

        // Wait for the component to re-render with the new data
        await waitFor(() => {
          // Should no longer show blocking alert
          expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });

        // This will fail until the recovery logic is implemented
        // Should now show ready state
        const modelResult = buildClassesPageModel(mockClassPartials, mockYearGroups);
        expect(modelResult).toHaveProperty('panels');
        if ('type' in modelResult && modelResult.type === 'invalidClassesPageData') {
          expect(screen.getByRole('alert')).toBeInTheDocument();
        } else {
          expect(screen.getByRole('region', { name: /year.*group/i })).toBeInTheDocument();
        }
      });

      it('recovers from failed yearGroups warmup snapshot when live query resolves successfully', async () => {
        // Start with failed warmup snapshot for yearGroups
        useStartupWarmupStateMock.mockReturnValue(createYearGroupsFailedWarmupState());

        const { queryClient } = renderWithFrontendProviders(<ClassesPage />);

        // Initially should show blocking state
        expect(screen.getByRole('alert')).toBeInTheDocument();

        // Now simulate successful live query resolving
        queryClient.setQueryData(queryKeys.yearGroups(), [...mockYearGroups]);
        queryClient.setQueryData(queryKeys.classPartials(), [...mockClassPartials]);

        // Wait for the component to re-render with the new data
        await waitFor(() => {
          // Should no longer show blocking alert
          expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });

        // This will fail until the recovery logic is implemented
        // Should now show ready state
        const modelResult = buildClassesPageModel(mockClassPartials, mockYearGroups);
        expect(modelResult).toHaveProperty('panels');
        if ('type' in modelResult && modelResult.type === 'invalidClassesPageData') {
          expect(screen.getByRole('alert')).toBeInTheDocument();
        } else {
          expect(screen.getByRole('region', { name: /year.*group/i })).toBeInTheDocument();
        }
      });
    });

    describe('Empty states', () => {
      it('renders page-level Empty state when both datasets are trustworthy and empty', () => {
        useStartupWarmupStateMock.mockReturnValue(createReadyWarmupState());

        // Pre-populate the query client cache BEFORE rendering
        const queryClient = createAppQueryClient();
        queryClient.setQueryData(queryKeys.classPartials(), mockEmptyClassPartials);
        queryClient.setQueryData(queryKeys.yearGroups(), mockEmptyYearGroups);

        renderWithFrontendProviders(<ClassesPage />, {
          queryClient,
        });

        // The view model should return empty panels
        const modelResult = buildClassesPageModel(mockEmptyClassPartials, mockEmptyYearGroups);
        expect(modelResult).toHaveProperty('panels', []);
        expect(modelResult).toHaveProperty('defaultExpandedPanelKeys', []);

        // Page should show empty state
        expect(screen.getByText(/no year groups configured/i)).toBeInTheDocument();

        // Collapse should not be visible
        expect(screen.queryByRole('region', { name: /year.*group/i })).not.toBeInTheDocument();
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

      // Fixture with mixed year group ordering to verify alphabetical sort
      const mixedOrderYearGroups: YearGroup[] = [
        { key: 'year-group-11', name: 'Year 11' },
        { key: 'year-group-9', name: 'Year 9' },
        { key: 'year-group-10', name: 'Year 10' },
      ] as const;

      const mixedOrderClassPartials: ClassPartial[] = [
        {
          classId: 'class-math-11a',
          className: 'Mathematics 11A',
          cohortKey: null,
          courseLength: 1,
          yearGroupKey: 'year-group-11',
          classOwner: null,
          teachers: [],
          active: null,
        },
        {
          classId: 'class-science-9',
          className: 'Science 9',
          cohortKey: null,
          courseLength: 1,
          yearGroupKey: 'year-group-9',
          classOwner: null,
          teachers: [],
          active: null,
        },
        {
          classId: 'class-math-10a',
          className: 'Mathematics 10A',
          cohortKey: null,
          courseLength: 1,
          yearGroupKey: 'year-group-10',
          classOwner: null,
          teachers: [],
          active: null,
        },
        {
          classId: 'class-english-10',
          className: 'English 10',
          cohortKey: null,
          courseLength: 1,
          yearGroupKey: 'year-group-10',
          classOwner: null,
          teachers: [],
          active: null,
        },
      ] as const;

      // Fixture with an empty year group (Year 9 has no classes)
      const yearGroupsWithEmpty: YearGroup[] = [
        { key: 'year-group-9', name: 'Year 9' },
        { key: 'year-group-10', name: 'Year 10' },
      ] as const;

      const classPartialsForEmptyPanel: ClassPartial[] = [
        {
          classId: 'class-math-10a',
          className: 'Mathematics 10A',
          cohortKey: null,
          courseLength: 1,
          yearGroupKey: 'year-group-10',
          classOwner: null,
          teachers: [],
          active: null,
        },
      ] as const;

      beforeEach(() => {
        useStartupWarmupStateMock.mockReturnValue(createReadyWarmupState());
      });

      it('verifies panel header order from a mixed year-group fixture', () => {
        // Pre-populate the query client cache BEFORE rendering
        const queryClient = createAppQueryClient();
        queryClient.setQueryData(queryKeys.classPartials(), [...mixedOrderClassPartials]);
        queryClient.setQueryData(queryKeys.yearGroups(), [...mixedOrderYearGroups]);

        renderWithFrontendProviders(<ClassesPage />, {
          queryClient,
        });

        // The view model should sort year groups alphabetically by name
        const modelResult = buildClassesPageModel(mixedOrderClassPartials, mixedOrderYearGroups);
        expect(modelResult).not.toHaveProperty('type');
        expect((modelResult as { panels: unknown[] }).panels).toHaveLength(EXPECTED_PANEL_COUNT);

        // Expected alphabetical order: Year 10, Year 11, Year 9
        const panels = modelResult as { panels: { yearGroupKey: string; yearGroupLabel: string }[] };
        expect(panels.panels[0].yearGroupLabel).toBe('Year 10');
        expect(panels.panels[1].yearGroupLabel).toBe('Year 11');
        expect(panels.panels[2].yearGroupLabel).toBe('Year 9');

        // These tests will fail until the collapse implementation is complete
        // Assert that collapse headers render in the correct alphabetical order
        const collapseRegion = screen.getByRole('region', { name: /year.*group/i });
        expect(collapseRegion).toBeInTheDocument();

        // Find all collapse panel headers - they should be in alphabetical order
        // This will fail until Ant Design Collapse is implemented with proper panel headers
        const panelHeaders = screen.getAllByRole('heading', { level: 3 });
        expect(panelHeaders).toHaveLength(EXPECTED_PANEL_COUNT);
        expect(panelHeaders[0]).toHaveTextContent('Year 10');
        expect(panelHeaders[1]).toHaveTextContent('Year 11');
        expect(panelHeaders[2]).toHaveTextContent('Year 9');
      });

      it('verifies the first alphabetical panel is open on first ready render', () => {
        // Pre-populate the query client cache BEFORE rendering
        const queryClient = createAppQueryClient();
        queryClient.setQueryData(queryKeys.classPartials(), [...mixedOrderClassPartials]);
        queryClient.setQueryData(queryKeys.yearGroups(), [...mixedOrderYearGroups]);

        renderWithFrontendProviders(<ClassesPage />, {
          queryClient,
        });

        // The view model should have the first alphabetical panel as default expanded
        const modelResult = buildClassesPageModel(mixedOrderClassPartials, mixedOrderYearGroups);
        expect(modelResult).not.toHaveProperty('type');

        const viewModel = modelResult as { panels: unknown[]; defaultExpandedPanelKeys: string[] };
        expect(viewModel.defaultExpandedPanelKeys).toHaveLength(EXPECTED_DEFAULT_EXPANDED_COUNT);
        // First alphabetical is Year 10
        expect(viewModel.defaultExpandedPanelKeys[0]).toBe('year-group-10');

        // This will fail until the collapse implementation uses defaultActiveKey
        // Assert that the first panel body is visible (expanded)
        const collapseRegion = screen.getByRole('region', { name: /year.*group/i });
        expect(collapseRegion).toBeInTheDocument();

        // The first panel (Year 10) should have its content visible
        // This will fail until the collapse is implemented with proper defaultActiveKey
        const year10Panel = screen.getByRole('region', { name: /year 10/i });
        expect(year10Panel).toBeInTheDocument();
        expect(year10Panel).toHaveAttribute('aria-expanded', 'true');
      });

      it('verifies an empty year-group panel shows its own empty presentation', () => {
        // Pre-populate the query client cache BEFORE rendering
        const queryClient = createAppQueryClient();
        queryClient.setQueryData(queryKeys.classPartials(), [...classPartialsForEmptyPanel]);
        queryClient.setQueryData(queryKeys.yearGroups(), [...yearGroupsWithEmpty]);

        renderWithFrontendProviders(<ClassesPage />, {
          queryClient,
        });

        // The view model should create panels for all year groups, even empty ones
        const modelResult = buildClassesPageModel(classPartialsForEmptyPanel, yearGroupsWithEmpty);
        expect(modelResult).not.toHaveProperty('type');

        const viewModel = modelResult as { panels: { yearGroupKey: string; classes: unknown[] }[] };
        expect(viewModel.panels).toHaveLength(EXPECTED_PANELS_WITH_EMPTY_COUNT);

        // Year 9 panel should have no classes
        const year9Panel = viewModel.panels.find((p) => p.yearGroupKey === 'year-group-9');
        expect(year9Panel).toBeDefined();
        expect(year9Panel?.classes).toHaveLength(0);

        // This will fail until the in-panel empty presentation is implemented
        // Assert that the empty year group panel shows in-panel empty message
        const collapseRegion = screen.getByRole('region', { name: /year.*group/i });
        expect(collapseRegion).toBeInTheDocument();

        // The Year 9 panel should show an empty message within its body
        // This will fail until Card-based empty state is implemented
        const year9PanelRegion = screen.getByRole('region', { name: /year 9/i });
        expect(year9PanelRegion).toBeInTheDocument();
        expect(year9PanelRegion).toHaveTextContent(/no classes/i);
      });

      it('verifies cards only render under their matching year-group panel', () => {
        // Pre-populate the query client cache BEFORE rendering
        const queryClient = createAppQueryClient();
        queryClient.setQueryData(queryKeys.classPartials(), [...mixedOrderClassPartials]);
        queryClient.setQueryData(queryKeys.yearGroups(), [...mixedOrderYearGroups]);

        renderWithFrontendProviders(<ClassesPage />, {
          queryClient,
        });

        // The view model should group classes by their yearGroupKey
        const modelResult = buildClassesPageModel(mixedOrderClassPartials, mixedOrderYearGroups);
        expect(modelResult).not.toHaveProperty('type');

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

        // This will fail until the collapse with cards is implemented
        const collapseRegion = screen.getByRole('region', { name: /year.*group/i });
        expect(collapseRegion).toBeInTheDocument();

        // Find all class cards
        const math10ACard = screen.getByRole('article', { name: /mathematics 10a/i });
        expect(math10ACard).toBeInTheDocument();

        const science9Card = screen.getByRole('article', { name: /science 9/i });
        expect(science9Card).toBeInTheDocument();

        const math11ACard = screen.getByRole('article', { name: /mathematics 11a/i });
        expect(math11ACard).toBeInTheDocument();

        // Verify card-to-panel association
        const year10PanelRegion = screen.getByRole('region', { name: /year 10/i });
        expect(year10PanelRegion).toContainElement(math10ACard);

        const year11PanelRegion = screen.getByRole('region', { name: /year 11/i });
        expect(year11PanelRegion).toContainElement(math11ACard);

        const year9PanelRegion = screen.getByRole('region', { name: /year 9/i });
        expect(year9PanelRegion).toContainElement(science9Card);
      });
    });
  });
});
