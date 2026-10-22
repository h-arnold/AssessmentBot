import '@/test/classes/ClassesPage.mockSetup';
import { screen, waitFor } from '@testing-library/react';
import type * as ReactQueryModule from '@tanstack/react-query';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppQueryClient } from '../query/queryClient';
import { queryKeys } from '../query/queryKeys';
import { renderWithFrontendProviders } from '../test/renderWithFrontendProviders';
import { buildClassesPageModel } from './classesPageModel';
import { ClassesPage } from './ClassesPage';

import {
  resetClassesPageComponentMocks,
  useStartupWarmupStateMock,
} from '@/test/classes/classesPageComponentTestSetup';
import { createReadyWarmupState } from '@/test/classes/classesPageWarmupFixtures';
import {
  MOCK_CLASS_PARTIALS,
  MOCK_YEAR_GROUPS,
  createFixtureClassPartial,
} from '../test/classes/classesPageTestHelpers';

// Only this suite substitutes a fetching query with trustworthy cached data.
const mockRefetchEnabled = vi.hoisted(() => ({ value: false }));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actualModule = await importOriginal<typeof ReactQueryModule>();
  // Import the pure fixture owner inside the factory, not the rendering facade.
  // These complete partials include detached canonical metadata snapshots.
  const { MOCK_CLASS_PARTIALS: refetchClassPartials, MOCK_YEAR_GROUPS: refetchYearGroups } =
    await import('../test/classes/classesPageTestFixtures');

  return {
    ...actualModule,
    useQuery: vi.fn((options: Parameters<typeof actualModule.useQuery>[0]) => {
      if (!mockRefetchEnabled.value) {
        // For non-refetch tests, pass through to the actual implementation
        // This allows other tests to work normally with queryClient.setQueryData()
        return actualModule.useQuery(options);
      }

      if (options.queryKey[0] === 'classPartials') {
        return {
          data: [...refetchClassPartials],
          isFetching: true,
          isError: false,
          isLoading: false,
          isPending: false,
          error: null,
          dataUpdatedAt: 0,
          refetch: vi.fn(() => Promise.resolve({ data: [...refetchClassPartials] })),
        };
      }
      if (options.queryKey[0] === 'yearGroups') {
        return {
          data: [...refetchYearGroups],
          isFetching: true,
          isError: false,
          isLoading: false,
          isPending: false,
          error: null,
          dataUpdatedAt: 0,
          refetch: vi.fn(() => Promise.resolve({ data: [...refetchYearGroups] })),
        };
      }
      return actualModule.useQuery(options);
    }),
  };
});

/**
 * Enables the fetching query snapshot.
 */
function enableRefetchMock(): void {
  mockRefetchEnabled.value = true;
}

/**
 * Restores real React Query behaviour.
 */
function disableRefetchMock(): void {
  mockRefetchEnabled.value = false;
}

const mockYearGroups = MOCK_YEAR_GROUPS;
const mockClassPartials = MOCK_CLASS_PARTIALS;

beforeEach(() => {
  resetClassesPageComponentMocks();
});
afterEach(() => {
  vi.resetAllMocks();
});

describe('Refresh transitions and accessibility', () => {
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
      createFixtureClassPartial({
        classId: 'class-new-1',
        className: 'New Class',
        yearGroupKey: 'year-group-10',
      }),
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
      createFixtureClassPartial({
        classId: 'class-invalid-refetch',
        className: 'Invalid Class',
        yearGroupKey: 'year-group-invalid', // This doesn't exist in yearGroups
      }),
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
