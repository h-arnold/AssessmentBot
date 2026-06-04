/**
 * ClassesPage component tests - Loading, blocking, and page-empty states
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
 */

import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '../../query/queryKeys';
import { renderWithFrontendProviders } from '../../test/renderWithFrontendProviders';
import { ClassesPage } from '../ClassesPage';
import { pageContent } from '../pageContent';

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
  MOCK_CLASS_PARTIALS,
  MOCK_EMPTY_CLASS_PARTIALS,
  MOCK_EMPTY_YEAR_GROUPS,
  MOCK_INVALID_CLASS_PARTIALS,
  MOCK_YEAR_GROUPS,
} from '../../test/classes/classesPageTestHelpers';

import {
  createMockStartupWarmupState,
  createReadyWarmupState,
  createLoadingWarmupState,
  createClassPartialsFailedWarmupState,
  createYearGroupsFailedWarmupState,
} from './shared-setup';

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

vi.mock('../../features/auth/startupWarmupState', async (importOriginal) => {
  const actualModule = (await importOriginal()) as Record<string, unknown>;

  return {
    ...actualModule,
    useStartupWarmupState: useStartupWarmupStateMock,
  };
});

vi.mock('../../services/classPartialsService', () => ({
  getABClassPartials: getABClassPartialsMock,
}));

vi.mock('../../services/referenceDataService', () => ({
  getYearGroups: getYearGroupsMock,
  getCohorts: getCohortsMock,
}));

vi.mock('../../services/assignmentDefinitionPartialsService', () => ({
  getAssignmentDefinitionPartials: getAssignmentDefinitionPartialsMock,
}));

vi.mock('../../services/assignmentTopicsService', () => ({
  getAssignmentTopics: getAssignmentTopicsMock,
}));

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
        const { modelResult, isInvalid } = verifyClassesPageModel(MOCK_CLASS_PARTIALS, MOCK_YEAR_GROUPS);
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
        const queryClient = createQueryClientWithClassesData([], MOCK_YEAR_GROUPS);
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
        const queryClient = createQueryClientWithClassesData(MOCK_INVALID_CLASS_PARTIALS, MOCK_YEAR_GROUPS);
        renderWithFrontendProviders(<ClassesPage />, {
          queryClient,
        });

        // The view model should detect invalid data and return invalid view model
        const { modelResult } = verifyClassesPageModel(MOCK_INVALID_CLASS_PARTIALS, MOCK_YEAR_GROUPS);
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
        queryClient.setQueryData(queryKeys.classPartials(), [...MOCK_CLASS_PARTIALS]);
        queryClient.setQueryData(queryKeys.yearGroups(), [...MOCK_YEAR_GROUPS]);

        // Wait for the component to re-render with the new data
        await waitFor(() => {
          // Should no longer show blocking alert
          assertNoBlockingAlert();
        });

        // This will fail until the recovery logic is implemented
        // Should now show ready state
        const { modelResult, isInvalid } = verifyClassesPageModel(MOCK_CLASS_PARTIALS, MOCK_YEAR_GROUPS);
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
        queryClient.setQueryData(queryKeys.yearGroups(), [...MOCK_YEAR_GROUPS]);
        queryClient.setQueryData(queryKeys.classPartials(), [...MOCK_CLASS_PARTIALS]);

        // Wait for the component to re-render with the new data
        await waitFor(() => {
          // Should no longer show blocking alert
          assertNoBlockingAlert();
        });

        // This will fail until the recovery logic is implemented
        // Should now show ready state
        const { modelResult, isInvalid } = verifyClassesPageModel(MOCK_CLASS_PARTIALS, MOCK_YEAR_GROUPS);
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
          classPartials: MOCK_EMPTY_CLASS_PARTIALS,
          yearGroups: MOCK_EMPTY_YEAR_GROUPS,
        });

        // The view model should return empty panels
        const { modelResult } = verifyClassesPageModel(MOCK_EMPTY_CLASS_PARTIALS, MOCK_EMPTY_YEAR_GROUPS);
        expect(modelResult).toHaveProperty('panels', []);
        expect(modelResult).toHaveProperty('defaultExpandedPanelKeys', []);

        // Page should show empty state
        assertEmptyState();

        // Collapse should not be visible
        assertNoCollapseRegion();
      });
    });
  });
});
