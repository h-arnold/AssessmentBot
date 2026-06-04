/**
 * ClassesPage component tests - Refresh transitions and accessibility
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
import { createAppQueryClient } from '../../query/queryClient';
import { queryKeys } from '../../query/queryKeys';
import { renderWithFrontendProviders } from '../../test/renderWithFrontendProviders';
import { ClassesPage } from '../ClassesPage';

import {
  buildClassesPageModel,
} from '../classes/classesPageModel';

import {
  MOCK_CLASS_PARTIALS,
  MOCK_YEAR_GROUPS,
} from '../../test/classes/classesPageTestHelpers';

import { createReadyWarmupState } from './shared-setup';

// Hoisted flag to control refetch mock for refresh tests
const mockRefetchEnabled = vi.hoisted(() => ({ value: false }));

/**
 * Creates a ClassPartial-like plain object for refetch mock data.
 *
 * Defined inline because vi.hoisted() callbacks execute before module imports.
 *
 * @param {string} classId - The class identifier.
 * @param {string} className - The class name.
 * @param {string} yearGroupKey - The year group key.
 * @returns {object} A plain object matching the ClassPartial shape.
 */
function _refetchClassPartial(
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

// Mock @tanstack/react-query to support refetch tests
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

// Helper to enable refetch mock for refresh tests
/**
 * Enables the refetch mock.
 */
function enableRefetchMock(): void {
  mockRefetchEnabled.value = true;
}

// Helper to disable refetch mock for refresh tests
/**
 * Disables the refetch mock.
 */
function disableRefetchMock(): void {
  mockRefetchEnabled.value = false;
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

  describe('Owned-surface loading, blocking, and page-empty states', () => {
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
        queryClient.setQueryData(queryKeys.classPartials(), [...MOCK_CLASS_PARTIALS]);
        queryClient.setQueryData(queryKeys.yearGroups(), [...MOCK_YEAR_GROUPS]);

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
          ...MOCK_CLASS_PARTIALS,
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
        queryClient.setQueryData(queryKeys.classPartials(), [...MOCK_CLASS_PARTIALS]);
        queryClient.setQueryData(queryKeys.yearGroups(), [...MOCK_YEAR_GROUPS]);

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
          const modelResult = buildClassesPageModel(invalidClassPartials, MOCK_YEAR_GROUPS);
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
});
