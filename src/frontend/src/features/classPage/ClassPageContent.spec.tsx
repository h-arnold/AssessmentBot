/**
 * Tests for the Class page per-state content dispatcher (`ClassPageContent`).
 *
 * @remarks
 * `ClassPageContent` is a thin `switch (status)` dispatcher that delegates
 * to three co-located sub-components:
 * - `ClassPageLoading` — shape-matched skeletons
 * - `ClassPageBlocking` — `Result` per error type
 * - `ClassPageReady` — full content tree
 *
 * @see SPEC_CLASS_PAGE.md — "ClassPageContent — per-state dispatcher"
 * @see CLASS_PAGE_LAYOUT.md — "Surface hierarchy" and "Global state rules"
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';
import { ClassPageContent } from './ClassPageContent';
import type { ClassPageSurfaceState, ClassPageError } from './useClassPageData';
import type { ClassPageAdapterResult } from './classPageAdapter.zod';
import type { AveragingResult } from '../../services/dataAnalysis/dataAnalysis.zod';
import type { ClassFull } from '../../services/googleClassrooms/classDetail/classDetailService.zod';

// ===========================================================================
// Mock setup
// ===========================================================================

const { mockRecentAssignmentsSection } = vi.hoisted(() => ({
  mockRecentAssignmentsSection: vi.fn(function MockRecentAssignmentsSection() {
    return createElement('div', { 'data-testid': 'recent-assignments-section' });
  }),
}));

const { mockStudentAveragesTableCard } = vi.hoisted(() => ({
  mockStudentAveragesTableCard: vi.fn(function MockStudentAveragesTableCard() {
    return createElement('div', { 'data-testid': 'student-averages-table-card' });
  }),
}));

const { mockTaskHeatmapPage } = vi.hoisted(() => ({
  mockTaskHeatmapPage: vi.fn(function MockTaskHeatmapPage() {
    return createElement('div', { 'data-testid': 'task-heatmap-page' });
  }),
}));

vi.mock('./RecentAssignmentsSection', () => ({
  RecentAssignmentsSection: mockRecentAssignmentsSection,
}));

vi.mock('./StudentAveragesTableCard', () => ({
  StudentAveragesTableCard: mockStudentAveragesTableCard,
}));

vi.mock('../taskHeatmap/TaskHeatmapPage', () => ({
  TaskHeatmapPage: mockTaskHeatmapPage,
}));

// ===========================================================================
// Fixture helpers
// ===========================================================================

/**
 * Create a minimal `ClassPageAdapterResult` fixture for ready-state tests.
 *
 * @param {Partial<ClassPageAdapterResult>} [overrides] - Optional overrides.
 * @returns {ClassPageAdapterResult} A fixture with default empty arrays.
 */
function createAdapterResult(
  overrides?: Partial<ClassPageAdapterResult>
): ClassPageAdapterResult {
  return {
    recentAssignments: [],
    studentAverages: [],
    classMetrics: {
      completeness: {
        state: 'computed',
        value: 4,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      },
      accuracy: {
        state: 'computed',
        value: 3.5,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      },
      spag: {
        state: 'notAttempted',
        value: 'N',
        totalWeight: 0,
        applicableDataPoints: 0,
        totalDataPoints: 1,
      },
      overall: {
        state: 'computed',
        value: 3.8,
        totalWeight: 1,
        applicableDataPoints: 1,
        totalDataPoints: 1,
      },
    },
    ...overrides,
  };
}

/**
 * Extract the first call's first argument as a record.
 * Returns an empty object if the mock has not been called.
 *
 * @param {import('vitest').Mock} mock - The mock function to inspect.
 * @returns {Record<string, unknown>} The first argument of the first call.
 */
function getFirstCallArguments(mock: ReturnType<typeof vi.fn>): Record<string, unknown> {
  if (mock.mock.calls.length === 0 || mock.mock.calls[0].length === 0) {
    return {};
  }
  return mock.mock.calls[0][0] as Record<string, unknown>;
}

// ===========================================================================
// Tests
// ===========================================================================

describe('ClassPageContent', () => {
  let user: ReturnType<typeof userEvent.setup>;

  /** Minimal non-null AveragingResult fixture for the heatmap ready gate. */
  const nonNullAnalyserResult = { classId: 'c-1' } as unknown as AveragingResult;

  /** Minimal non-null ClassFull fixture for the heatmap ready gate. */
  const nonNullClassFull = { classId: 'c-1' } as unknown as ClassFull;

  beforeEach(() => {
    user = userEvent.setup();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // -----------------------------------------------------------------------
  // Loading state
  // -----------------------------------------------------------------------

  it('renders skeleton placeholders when surfaceState.status is loading', () => {
    const surfaceState: ClassPageSurfaceState = { status: 'loading' };

    render(
      createElement(ClassPageContent, {
        surfaceState,
        adapterResult: null,
        error: null,
        onStartNewAssessment: vi.fn(),
        onNavigateToClasses: vi.fn(),
        onRetry: vi.fn(),
        analyserResult: null,
        classFull: null,
        selectedView: { view: 'overview' },
        onOpenHeatmap: vi.fn(),
        onBack: vi.fn(),
        refetch: vi.fn(),
        assignmentDefinitionPartials: null,
      })
    );

    // The loading state renders Ant Design Skeleton components.
    // Skeleton renders with a CSS class .ant-skeleton.
    const skeletonElements = document.querySelectorAll('.ant-skeleton');
    expect(skeletonElements.length).toBeGreaterThanOrEqual(1);
  });

  // -----------------------------------------------------------------------
  // Blocking states — retryable errors (Result status="warning")
  // -----------------------------------------------------------------------

  it('renders Result status="warning" for classQueryError with Retry and Back to Classes buttons', async () => {
    const onRetry = vi.fn();
    const onNavigateToClasses = vi.fn();
    const blockingError: ClassPageError = {
      type: 'classQueryError',
      cause: new Error('Network error'),
    };
    const surfaceState: ClassPageSurfaceState = {
      status: 'blocking',
      error: blockingError,
    };

    render(
      createElement(ClassPageContent, {
        surfaceState,
        adapterResult: null,
        error: blockingError,
        onStartNewAssessment: vi.fn(),
        onNavigateToClasses,
        onRetry,
        analyserResult: null,
        classFull: null,
        selectedView: { view: 'overview' },
        onOpenHeatmap: vi.fn(),
        onBack: vi.fn(),
        refetch: vi.fn(),
        assignmentDefinitionPartials: null,
      })
    );

    // Should render Result with status="warning" and title "Couldn't load class"
    expect(screen.getByText("Couldn't load class")).toBeInTheDocument();

    // Retry button should be present and call onRetry
    const retryButton = screen.getByRole('button', { name: /retry/i });
    expect(retryButton).toBeInTheDocument();
    await user.click(retryButton);
    expect(onRetry).toHaveBeenCalledTimes(1);

    // Back to Classes button should be present and call onNavigateToClasses
    const backButton = screen.getByRole('button', { name: /back to classes/i });
    expect(backButton).toBeInTheDocument();
    await user.click(backButton);
    expect(onNavigateToClasses).toHaveBeenCalledTimes(1);
  });

  it('renders Result status="warning" for analyserError with Retry and Back to Classes buttons', async () => {
    const onRetry = vi.fn();
    const onNavigateToClasses = vi.fn();
    const blockingError: ClassPageError = {
      type: 'analyserError',
      cause: new Error('Computation failed'),
    };
    const surfaceState: ClassPageSurfaceState = {
      status: 'blocking',
      error: blockingError,
    };

    render(
      createElement(ClassPageContent, {
        surfaceState,
        adapterResult: null,
        error: blockingError,
        onStartNewAssessment: vi.fn(),
        onNavigateToClasses,
        onRetry,
        analyserResult: null,
        classFull: null,
        selectedView: { view: 'overview' },
        onOpenHeatmap: vi.fn(),
        onBack: vi.fn(),
        refetch: vi.fn(),
        assignmentDefinitionPartials: null,
      })
    );

    // Should render Result with status="warning" and title "Couldn't compute averages"
    expect(screen.getByText("Couldn't compute averages")).toBeInTheDocument();

    // Retry button should be present
    const retryButton = screen.getByRole('button', { name: /retry/i });
    expect(retryButton).toBeInTheDocument();
    await user.click(retryButton);
    expect(onRetry).toHaveBeenCalledTimes(1);

    // Back to Classes button should be present
    const backButton = screen.getByRole('button', { name: /back to classes/i });
    expect(backButton).toBeInTheDocument();
    await user.click(backButton);
    expect(onNavigateToClasses).toHaveBeenCalledTimes(1);
  });

  it('renders Result status="warning" for assignmentDefinitionPartialsFailed with Retry and Back to Classes buttons', async () => {
    const onRetry = vi.fn();
    const onNavigateToClasses = vi.fn();
    const blockingError: ClassPageError = {
      type: 'assignmentDefinitionPartialsFailed',
    };
    const surfaceState: ClassPageSurfaceState = {
      status: 'blocking',
      error: blockingError,
    };

    render(
      createElement(ClassPageContent, {
        surfaceState,
        adapterResult: null,
        error: blockingError,
        onStartNewAssessment: vi.fn(),
        onNavigateToClasses,
        onRetry,
        analyserResult: null,
        classFull: null,
        selectedView: { view: 'overview' },
        onOpenHeatmap: vi.fn(),
        onBack: vi.fn(),
        refetch: vi.fn(),
        assignmentDefinitionPartials: null,
      })
    );

    // Should render Result with status="warning" and title "Couldn't load assessment definitions"
    expect(screen.getByText("Couldn't load assessment definitions")).toBeInTheDocument();

    // Retry button should be present and call onRetry
    const retryButton = screen.getByRole('button', { name: /retry/i });
    expect(retryButton).toBeInTheDocument();
    await user.click(retryButton);
    expect(onRetry).toHaveBeenCalledTimes(1);

    // Back to Classes button should be present and call onNavigateToClasses
    const backButton = screen.getByRole('button', { name: /back to classes/i });
    expect(backButton).toBeInTheDocument();
    await user.click(backButton);
    expect(onNavigateToClasses).toHaveBeenCalledTimes(1);
  });

  it('renders Result status="warning" for assignmentDefinitionPartialsUntrustworthy with Retry and Back to Classes buttons', async () => {
    const onRetry = vi.fn();
    const onNavigateToClasses = vi.fn();
    const blockingError: ClassPageError = {
      type: 'assignmentDefinitionPartialsUntrustworthy',
    };
    const surfaceState: ClassPageSurfaceState = {
      status: 'blocking',
      error: blockingError,
    };

    render(
      createElement(ClassPageContent, {
        surfaceState,
        adapterResult: null,
        error: blockingError,
        onStartNewAssessment: vi.fn(),
        onNavigateToClasses,
        onRetry,
        analyserResult: null,
        classFull: null,
        selectedView: { view: 'overview' },
        onOpenHeatmap: vi.fn(),
        onBack: vi.fn(),
        refetch: vi.fn(),
        assignmentDefinitionPartials: null,
      })
    );

    // Should render Result with status="warning" and title "Assessment definitions are unavailable"
    expect(screen.getByText('Assessment definitions are unavailable')).toBeInTheDocument();

    // Retry button should be present and call onRetry
    const retryButton = screen.getByRole('button', { name: /retry/i });
    expect(retryButton).toBeInTheDocument();
    await user.click(retryButton);
    expect(onRetry).toHaveBeenCalledTimes(1);

    // Back to Classes button should be present and call onNavigateToClasses
    const backButton = screen.getByRole('button', { name: /back to classes/i });
    expect(backButton).toBeInTheDocument();
    await user.click(backButton);
    expect(onNavigateToClasses).toHaveBeenCalledTimes(1);
  });

  // -----------------------------------------------------------------------
  // Blocking states — non-retryable errors (Result status="error")
  // -----------------------------------------------------------------------

  it('renders Result status="error" for classNotFound with only Back to Classes button', async () => {
    const onRetry = vi.fn();
    const onNavigateToClasses = vi.fn();
    const blockingError: ClassPageError = { type: 'classNotFound' };
    const surfaceState: ClassPageSurfaceState = {
      status: 'blocking',
      error: blockingError,
    };

    render(
      createElement(ClassPageContent, {
        surfaceState,
        adapterResult: null,
        error: blockingError,
        onStartNewAssessment: vi.fn(),
        onNavigateToClasses,
        onRetry,
        analyserResult: null,
        classFull: null,
        selectedView: { view: 'overview' },
        onOpenHeatmap: vi.fn(),
        onBack: vi.fn(),
        refetch: vi.fn(),
        assignmentDefinitionPartials: null,
      })
    );

    // Should render Result with status="error" and title "Class not found"
    expect(screen.getByText('Class not found')).toBeInTheDocument();

    // Back to Classes button should be present
    const backButton = screen.getByRole('button', { name: /back to classes/i });
    expect(backButton).toBeInTheDocument();
    await user.click(backButton);
    expect(onNavigateToClasses).toHaveBeenCalledTimes(1);

    // NO Retry button — non-retryable error
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
  });

  it('renders Result status="error" for adapterError with only Back to Classes button', async () => {
    const onRetry = vi.fn();
    const onNavigateToClasses = vi.fn();
    const blockingError: ClassPageError = {
      type: 'adapterError',
      cause: new Error('Duplicate student id'),
    };
    const surfaceState: ClassPageSurfaceState = {
      status: 'blocking',
      error: blockingError,
    };

    render(
      createElement(ClassPageContent, {
        surfaceState,
        adapterResult: null,
        error: blockingError,
        onStartNewAssessment: vi.fn(),
        onNavigateToClasses,
        onRetry,
        analyserResult: null,
        classFull: null,
        selectedView: { view: 'overview' },
        onOpenHeatmap: vi.fn(),
        onBack: vi.fn(),
        refetch: vi.fn(),
        assignmentDefinitionPartials: null,
      })
    );

    // Should render Result with status="error" and title "Class data is invalid"
    expect(screen.getByText('Class data is invalid')).toBeInTheDocument();

    // Back to Classes button should be present
    const backButton = screen.getByRole('button', { name: /back to classes/i });
    expect(backButton).toBeInTheDocument();
    await user.click(backButton);
    expect(onNavigateToClasses).toHaveBeenCalledTimes(1);

    // NO Retry button — non-retryable error
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Ready state
  // -----------------------------------------------------------------------

  it('renders the full content tree when surfaceState.status is ready', () => {
    const adapterResult = createAdapterResult();
    const surfaceState: ClassPageSurfaceState = { status: 'ready' };

    render(
      createElement(ClassPageContent, {
        surfaceState,
        adapterResult,
        error: null,
        onStartNewAssessment: vi.fn(),
        onNavigateToClasses: vi.fn(),
        onRetry: vi.fn(),
        analyserResult: null,
        classFull: null,
        selectedView: { view: 'overview' },
        onOpenHeatmap: vi.fn(),
        onBack: vi.fn(),
        refetch: vi.fn(),
        assignmentDefinitionPartials: null,
      })
    );

    // The ready state should render RecentAssignmentsSection
    expect(mockRecentAssignmentsSection).toHaveBeenCalled();

    // The ready state should render StudentAveragesTableCard
    expect(mockStudentAveragesTableCard).toHaveBeenCalled();

    // Verify RecentAssignmentsSection receives the recentAssignments data
    const recentAssignmentsProperties = getFirstCallArguments(mockRecentAssignmentsSection);
    expect(recentAssignmentsProperties.recentAssignments).toEqual(
      adapterResult.recentAssignments
    );

    // Verify StudentAveragesTableCard receives the adapterResult
    const studentTableProperties = getFirstCallArguments(mockStudentAveragesTableCard);
    expect(studentTableProperties.adapterResult).toEqual(adapterResult);
  });

  // -----------------------------------------------------------------------
  // Heatmap view with assignmentDefinitionPartials (Section 8 prop-thread)
  // -----------------------------------------------------------------------

  it('renders TaskHeatmapPage when selectedView.view is heatmap and assignmentDefinitionPartials is non-null', () => {
    const adapterResult = createAdapterResult();
    const surfaceState: ClassPageSurfaceState = { status: 'ready' };

    render(
      createElement(ClassPageContent, {
        surfaceState,
        adapterResult,
        error: null,
        onStartNewAssessment: vi.fn(),
        onNavigateToClasses: vi.fn(),
        onRetry: vi.fn(),
        analyserResult: nonNullAnalyserResult,
        classFull: nonNullClassFull,
        selectedView: { view: 'heatmap', assignmentId: 'a-1' },
        onOpenHeatmap: vi.fn(),
        onBack: vi.fn(),
        refetch: vi.fn(),
        assignmentDefinitionPartials: [],
      })
    );

    // TaskHeatmapPage should receive the correct props
    expect(mockTaskHeatmapPage).toHaveBeenCalledTimes(1);
    const callArguments = getFirstCallArguments(mockTaskHeatmapPage);
    expect(callArguments).toMatchObject({
      analyserResult: { classId: 'c-1' },
      classFull: { classId: 'c-1' },
      assignmentId: 'a-1',
      assignmentDefinitionPartials: [],
    });
    expect(typeof callArguments.onBack).toBe('function');
    expect(typeof callArguments.refetch).toBe('function');

    // Overview content should NOT render
    expect(mockRecentAssignmentsSection).not.toHaveBeenCalled();
    expect(mockStudentAveragesTableCard).not.toHaveBeenCalled();
  });

  it('falls back to overview content when selectedView.view is heatmap but assignmentDefinitionPartials is null', () => {
    const adapterResult = createAdapterResult();
    const surfaceState: ClassPageSurfaceState = { status: 'ready' };

    render(
      createElement(ClassPageContent, {
        surfaceState,
        adapterResult,
        error: null,
        onStartNewAssessment: vi.fn(),
        onNavigateToClasses: vi.fn(),
        onRetry: vi.fn(),
        analyserResult: nonNullAnalyserResult,
        classFull: nonNullClassFull,
        selectedView: { view: 'heatmap', assignmentId: 'a-1' },
        onOpenHeatmap: vi.fn(),
        onBack: vi.fn(),
        refetch: vi.fn(),
        assignmentDefinitionPartials: null,
      })
    );

    // TaskHeatmapPage should NOT render
    expect(mockTaskHeatmapPage).not.toHaveBeenCalled();

    // Overview content should render instead (fallback)
    expect(mockRecentAssignmentsSection).toHaveBeenCalled();
    expect(mockStudentAveragesTableCard).toHaveBeenCalled();
  });
});
