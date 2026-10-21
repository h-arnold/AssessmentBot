import '@/test/classes/ClassesPage.mockSetup';
import { screen, waitFor } from '@testing-library/react';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { queryKeys } from '../query/queryKeys';
import { renderWithFrontendProviders } from '../test/renderWithFrontendProviders';

import { ClassesPage } from './ClassesPage';
import { pageContent } from './pageContent';
import {
  resetClassesPageComponentMocks,
  useStartupWarmupStateMock,
} from '@/test/classes/classesPageComponentTestSetup';
import {
  createMockStartupWarmupState,
  createReadyWarmupState,
  createLoadingWarmupState,
  createClassPartialsFailedWarmupState,
  createYearGroupsFailedWarmupState,
} from '@/test/classes/classesPageWarmupFixtures';
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
} from '../test/classes/classesPageTestHelpers';

const mockYearGroups = MOCK_YEAR_GROUPS;
const mockClassPartials = MOCK_CLASS_PARTIALS;
const mockEmptyClassPartials = MOCK_EMPTY_CLASS_PARTIALS;
const mockEmptyYearGroups = MOCK_EMPTY_YEAR_GROUPS;
const mockInvalidClassPartials = MOCK_INVALID_CLASS_PARTIALS;

beforeEach(() => {
  resetClassesPageComponentMocks();
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
