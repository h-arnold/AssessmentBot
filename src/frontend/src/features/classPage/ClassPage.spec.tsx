/**
 * Tests for the Class page composition root (`ClassPage`).
 *
 * @see SPEC_CLASS_PAGE.md — "Page composition root"
 * @see CLASS_PAGE_LAYOUT.md — "Surface hierarchy" and "Global state rules"
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { ClassPage } from './ClassPage';
import type { ClassPageData, ClassPageSurfaceState } from './useClassPageData';
import type { ClassPageAdapterResult } from './classPageAdapter.zod';
import type { ClassFull } from '../../services/googleClassrooms/classDetail/classDetailService.zod';
import type { ClassPageContent as ClassPageContentType } from './ClassPageContent';

// ===========================================================================
// Mock setup (hoisted to avoid temporal dead zone issues)
// ===========================================================================

const { mockUseClassPageData } = vi.hoisted(() => ({ mockUseClassPageData: vi.fn() }));

const { mockClassPageContent } = vi.hoisted(() => ({
  mockClassPageContent: vi.fn(function MockClassPageContent() {
    return createElement('div', { 'data-testid': 'class-page-content' });
  }),
}));

const { mockAssessTaskModal } = vi.hoisted(() => ({
  mockAssessTaskModal: vi.fn(function MockAssessTaskModal() {
    return createElement('div', { 'data-testid': 'assess-task-modal' });
  }),
}));

const { mockStudentAveragesTableCard } = vi.hoisted(() => ({
  mockStudentAveragesTableCard: vi.fn(function MockStudentAveragesTableCard() {
    return createElement('div', { 'data-testid': 'student-averages-table-card' });
  }),
}));

const { mockTaskHeatmapTable } = vi.hoisted(() => ({
  mockTaskHeatmapTable: vi.fn(function MockTaskHeatmapTable() {
    return createElement('div', { 'data-testid': 'task-heatmap-table' });
  }),
}));

const { mockUseClassSelection } = vi.hoisted(() => ({
  mockUseClassSelection: vi.fn(() => ({
    selectedClassId: DEFAULT_CLASS_ID,
    className: CLASS_NAME,
    onSelectClass: vi.fn(),
    onNavigateToClasses: vi.fn(),
  })),
}));

vi.mock('./useClassPageData', () => ({
  useClassPageData: mockUseClassPageData,
}));

vi.mock('./ClassPageContent', () => ({
  ClassPageContent: mockClassPageContent,
}));

vi.mock('../classes/AssessTaskModal/AssessTaskModal', () => ({
  AssessTaskModal: mockAssessTaskModal,
}));

vi.mock('../../pages/pageContent', () => ({
  pageContent: {
    classDetail: {
      heading: 'Class Overview',
      summary: 'Review assessment performance for this class.',
      recentAssignmentsEmpty: 'No recent assessments yet',
      searchEmpty: 'No students match your search',
    },
  },
}));

vi.mock('../../ClassSelectionContext', () => ({
  useClassSelection: mockUseClassSelection,
}));

vi.mock('./StudentAveragesTableCard', () => ({
  StudentAveragesTableCard: mockStudentAveragesTableCard,
}));

vi.mock('./TaskHeatmapTable', () => ({
  TaskHeatmapTable: mockTaskHeatmapTable,
}));

// ===========================================================================
// Fixture helpers
// ===========================================================================

const DEFAULT_CLASS_ID = 'class-abc-123';
const CLASS_NAME = '7A1 Digital Technology 2025-2026';

/**
 * Overridable `ClassFull` partial for test data.
 */
const DEFAULT_CLASS_FULL: Partial<ClassFull> = {
  classId: DEFAULT_CLASS_ID,
  className: CLASS_NAME,
};

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
 * Create a minimal `ClassPageData` fixture in the ready state.
 *
 * @param {Partial<ClassPageData>} [overrides] - Optional overrides.
 * @returns {ClassPageData} A fixture with default ready surface state.
 */
function createReadyClassPageData(overrides?: Partial<ClassPageData>): ClassPageData {
  return {
    classFull: DEFAULT_CLASS_FULL as ClassFull,
    classFullQuery: {
      data: DEFAULT_CLASS_FULL,
      dataUpdatedAt: 0,
      error: null,
      errorUpdatedAt: 0,
      failureCount: 0,
      failureReason: null,
      fetchStatus: 'idle',
      isError: false,
      isFetched: true,
      isFetchedAfterMount: true,
      isFetching: false,
      isInitialLoading: false,
      isLoading: false,
      isLoadingError: false,
      isPaused: false,
      isPending: false,
      isPlaceholderData: false,
      isRefetchError: false,
      isRefetching: false,
      isStale: false,
      isSuccess: true,
      promise: Promise.resolve(DEFAULT_CLASS_FULL),
      refetch: vi.fn(),
      status: 'success',
    } as unknown as UseQueryResult<ClassFull | null, Error>,
    assignmentDefinitionPartials: [],
    analyserResult: null,
    adapterResult: createAdapterResult(),
    error: null,
    surfaceState: { status: 'ready' } as ClassPageSurfaceState,
    refetch: vi.fn(),
    ...overrides,
  };
}

/**
 * Extract the last call's first argument as a record.
 * Returns an empty object if the mock has not been called.
 *
 * @param {import('vitest').Mock} mock - The mock function to inspect.
 * @returns {Record<string, unknown>} The first argument of the last call.
 */
function getLastCallArguments(mock: ReturnType<typeof vi.fn>): Record<string, unknown> {
  const allCalls = [...mock.mock.calls];
  const lastCall = allCalls.pop();
  if (!lastCall || lastCall.length === 0) {
    return {};
  }
  return lastCall[0] as Record<string, unknown>;
}

// ===========================================================================
// Tests
// ===========================================================================

describe('ClassPage', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  // -----------------------------------------------------------------------
  // Page heading tests
  // -----------------------------------------------------------------------

  it('renders the page heading with the class name', () => {
    mockUseClassPageData.mockReturnValue(createReadyClassPageData());

    render(
      createElement(ClassPage, {
        classId: DEFAULT_CLASS_ID,
      })
    );

    // The class name should appear as the heading
    expect(screen.getByRole('heading', { name: CLASS_NAME })).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Navigation card visibility tests
  // -----------------------------------------------------------------------

  it('renders the Back to Classes nav card in the overview view', () => {
    mockUseClassPageData.mockReturnValue(createReadyClassPageData());

    render(
      createElement(ClassPage, {
        classId: DEFAULT_CLASS_ID,
      })
    );

    // The nav card should appear with both text and aria-label in overview
    expect(screen.getByLabelText('Back to Classes')).toBeInTheDocument();
    expect(screen.getByText('Back to Classes')).toBeInTheDocument();
  });

  it('hides the Back to Classes nav card when the heatmap view is active', async () => {
    const user = userEvent.setup();

    // Provide an adapter result with a recent assignment so a clickable card
    // renders in the overview.  We use the real ClassPageContent component
    // (via vi.importActual) so clicking the RecentAssignmentCard triggers
    // the view transition inside ClassPage.
    const computedMetric = {
      state: 'computed' as const,
      value: 4,
      totalWeight: 1,
      applicableDataPoints: 1,
      totalDataPoints: 1,
    };

    mockUseClassPageData.mockReturnValue(
      createReadyClassPageData({
        adapterResult: {
          ...createAdapterResult(),
          recentAssignments: [
            {
              assignmentId: 'a-1',
              assignmentName: 'Test Assignment',
              lastAssessedAt: '2026-01-15T00:00:00.000Z',
              lastAssessedAtLabel: '15 Jan 2026',
              metrics: {
                completeness: { ...computedMetric },
                accuracy: { ...computedMetric },
                spag: { ...computedMetric, value: 3 },
                average: { ...computedMetric },
              },
            },
          ],
        },
      })
    );

    // Override the ClassPageContent mock to use the real component so the
    // RecentAssignmentCard → onOpenHeatmap → view transition chain works.
    const { ClassPageContent: RealClassPageContent } =
      await vi.importActual<{ ClassPageContent: typeof ClassPageContentType }>('./ClassPageContent');
    mockClassPageContent.mockImplementation(RealClassPageContent as unknown as typeof mockClassPageContent);

    render(
      createElement(ClassPage, {
        classId: DEFAULT_CLASS_ID,
      })
    );

    // The nav card should be visible initially (overview view)
    expect(screen.getByLabelText('Back to Classes')).toBeInTheDocument();

    // Click the recent assignment card to navigate into the heatmap view
    const card = screen.getByRole('button', { name: /test assignment/i });
    await user.click(card);

    // In the heatmap view the parent "Back to Classes" nav card must not appear
    expect(screen.queryByLabelText('Back to Classes')).not.toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Header actions tests
  // -----------------------------------------------------------------------

  it('renders Start New Assessment button that opens the modal', async () => {
    const user = userEvent.setup();
    mockUseClassPageData.mockReturnValue(createReadyClassPageData());

    render(
      createElement(ClassPage, {
        classId: DEFAULT_CLASS_ID,
      })
    );

    // The modal should NOT be rendered initially
    expect(mockAssessTaskModal).not.toHaveBeenCalled();

    // Click the Start New Assessment button
    const startButton = screen.getByRole('button', { name: /start new assessment/i });
    await user.click(startButton);

    // After clicking, AssessTaskModal should be rendered
    expect(mockAssessTaskModal).toHaveBeenCalled();
    const modalCallArguments = getLastCallArguments(mockAssessTaskModal);
    expect(modalCallArguments.classId).toBe(DEFAULT_CLASS_ID);
    expect(modalCallArguments.className).toBe(CLASS_NAME);
    expect(modalCallArguments.onClose).toBeTypeOf('function');
  });

  // -----------------------------------------------------------------------
  // Modal open/close tests
  // -----------------------------------------------------------------------

  it('opens the AssessTaskModal when Start New Assessment is clicked', async () => {
    const user = userEvent.setup();
    mockUseClassPageData.mockReturnValue(createReadyClassPageData());

    render(
      createElement(ClassPage, {
        classId: DEFAULT_CLASS_ID,
      })
    );

    // The modal should NOT be rendered initially
    expect(mockAssessTaskModal).not.toHaveBeenCalled();

    // Click the Start New Assessment button
    const startButton = screen.getByRole('button', { name: /start new assessment/i });
    await user.click(startButton);

    // After clicking, AssessTaskModal should be rendered
    expect(mockAssessTaskModal).toHaveBeenCalled();
    const modalCallArguments = getLastCallArguments(mockAssessTaskModal);
    expect(modalCallArguments.classId).toBe(DEFAULT_CLASS_ID);
    expect(modalCallArguments.className).toBe(CLASS_NAME);
    expect(modalCallArguments.onClose).toBeTypeOf('function');
  });

  it('closes the AssessTaskModal when onClose is called', async () => {
    const user = userEvent.setup();
    mockUseClassPageData.mockReturnValue(createReadyClassPageData());

    render(
      createElement(ClassPage, {
        classId: DEFAULT_CLASS_ID,
      })
    );

    // Open the modal first by clicking Start New Assessment
    const startButton = screen.getByRole('button', { name: /start new assessment/i });
    await user.click(startButton);

    // The modal should have been called (rendered open)
    expect(mockAssessTaskModal).toHaveBeenCalled();

    // Get the onClose callback from the modal's props and call it
    const modalCallArguments = getLastCallArguments(mockAssessTaskModal);
    const onClose = modalCallArguments.onClose as () => void;

    act(() => {
      onClose();
    });

    // After closing: verify the modal can be re-opened.
    // Click Start New Assessment again — the modal should be re-rendered
    // with an additional call.
    const callCountBeforeReopen = mockAssessTaskModal.mock.calls.length;

    await user.click(startButton);

    // The modal should have been called again (re-opened)
    expect(mockAssessTaskModal.mock.calls.length).toBeGreaterThan(
      callCountBeforeReopen
    );
  });
});
