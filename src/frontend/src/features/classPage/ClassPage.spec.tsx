/**
 * Tests for the Class page composition root (`ClassPage`).
 *
 * @remarks
 * **Red phase** — the implementation file `ClassPage.tsx` does not exist
 * yet, so running these tests will fail with "Cannot find module" for
 * `./ClassPage`.  This confirms the red-phase contract before
 * implementation (Section 7 of `ACTION_PLAN.md`).
 *
 * @see SPEC_CLASS_PAGE.md — "Page composition root"
 * @see CLASS_PAGE_LAYOUT.md — "Surface hierarchy" and "Global state rules"
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { ClassPage } from './ClassPage';
import type { ClassPageData, ClassPageSurfaceState } from './useClassPageData';
import type { ClassPageAdapterResult } from './classPageAdapter.zod';
import type { ClassFull } from '../../services/googleClassrooms/classDetail/classDetailService.zod';

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
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // -----------------------------------------------------------------------
  // Breadcrumb tests
  // -----------------------------------------------------------------------

  it('renders the three-segment breadcrumb with Classes clickable and className non-clickable', async () => {
    mockUseClassPageData.mockReturnValue(createReadyClassPageData());

    const onNavigateToClasses = vi.fn();
    render(
      createElement(ClassPage, {
        classId: DEFAULT_CLASS_ID,
        onNavigateToClasses,
      })
    );

    // All three segments should be visible
    expect(screen.getByText('AssessmentBot Frontend')).toBeInTheDocument();
    expect(screen.getByText('Classes')).toBeInTheDocument();

    // className appears in both the breadcrumb (3rd segment) and the page heading
    const classNameElements = screen.getAllByText(CLASS_NAME);
    const expectedClassNameInstances = 2;
    expect(classNameElements).toHaveLength(expectedClassNameInstances);

    // The Classes segment is clickable — clicking it calls onNavigateToClasses
    const classesSegment = screen.getByText('Classes');
    await user.click(classesSegment);

    expect(onNavigateToClasses).toHaveBeenCalledTimes(1);
  });

  // -----------------------------------------------------------------------
  // Page heading tests
  // -----------------------------------------------------------------------

  it('renders the page heading with the class name', () => {
    mockUseClassPageData.mockReturnValue(createReadyClassPageData());

    render(
      createElement(ClassPage, {
        classId: DEFAULT_CLASS_ID,
        onNavigateToClasses: vi.fn(),
      })
    );

    // The class name should appear as the heading
    expect(screen.getByRole('heading', { name: CLASS_NAME })).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Header actions tests
  // -----------------------------------------------------------------------

  it('passes onStartNewAssessment callback to ClassPageContent', () => {
    mockUseClassPageData.mockReturnValue(createReadyClassPageData());

    render(
      createElement(ClassPage, {
        classId: DEFAULT_CLASS_ID,
        onNavigateToClasses: vi.fn(),
      })
    );

    // onStartNewAssessment should be wired through ClassPageContent props
    const contentProperties = getFirstCallArguments(mockClassPageContent);
    expect(contentProperties.onStartNewAssessment).toBeTypeOf('function');
  });

  // -----------------------------------------------------------------------
  // Modal open/close tests
  // -----------------------------------------------------------------------

  it('opens the AssessTaskModal when Start New Assessment is clicked', () => {
    mockUseClassPageData.mockReturnValue(createReadyClassPageData());

    render(
      createElement(ClassPage, {
        classId: DEFAULT_CLASS_ID,
        onNavigateToClasses: vi.fn(),
      })
    );

    // The modal should NOT be rendered initially
    expect(mockAssessTaskModal).not.toHaveBeenCalled();

    // Retrieve the onStartNewAssessment callback from ClassPageContent props
    const contentProperties = getFirstCallArguments(mockClassPageContent);
    const onStartNewAssessment = contentProperties.onStartNewAssessment as () => void;

    act(() => {
      onStartNewAssessment();
    });

    // After calling onStartNewAssessment, AssessTaskModal should be rendered
    // with the correct classId, className, and onClose
    expect(mockAssessTaskModal).toHaveBeenCalled();
    const modalCallArguments = getLastCallArguments(mockAssessTaskModal);
    expect(modalCallArguments.classId).toBe(DEFAULT_CLASS_ID);
    expect(modalCallArguments.className).toBe(CLASS_NAME);
    expect(modalCallArguments.onClose).toBeTypeOf('function');
  });

  it('closes the AssessTaskModal when onClose is called', () => {
    mockUseClassPageData.mockReturnValue(createReadyClassPageData());

    render(
      createElement(ClassPage, {
        classId: DEFAULT_CLASS_ID,
        onNavigateToClasses: vi.fn(),
      })
    );

    // Open the modal first by calling onStartNewAssessment via ClassPageContent props
    const contentProperties = getFirstCallArguments(mockClassPageContent);
    const onStartNewAssessment = contentProperties.onStartNewAssessment as () => void;

    act(() => {
      onStartNewAssessment();
    });

    // The modal should have been called (rendered open)
    expect(mockAssessTaskModal).toHaveBeenCalled();

    // Get the onClose callback from the modal's props and call it
    const modalCallArguments = getLastCallArguments(mockAssessTaskModal);
    const onClose = modalCallArguments.onClose as () => void;

    act(() => {
      onClose();
    });

    // After closing: verify onStartNewAssessment toggles correctly.
    // Call onStartNewAssessment again — the modal should be re-rendered
    // with an additional call.
    const callCountBeforeReopen = mockAssessTaskModal.mock.calls.length;

    act(() => {
      onStartNewAssessment();
    });

    // The modal should have been called again (re-opened)
    expect(mockAssessTaskModal.mock.calls.length).toBeGreaterThan(
      callCountBeforeReopen
    );
  });

  // -----------------------------------------------------------------------
  // Navigation via breadcrumb
  // -----------------------------------------------------------------------

  it('calls onNavigateToClasses prop when the breadcrumb Classes segment is clicked', async () => {
    mockUseClassPageData.mockReturnValue(createReadyClassPageData());

    const onNavigateToClasses = vi.fn();
    render(
      createElement(ClassPage, {
        classId: DEFAULT_CLASS_ID,
        onNavigateToClasses,
      })
    );

    const classesSegment = screen.getByText('Classes');
    await user.click(classesSegment);

    expect(onNavigateToClasses).toHaveBeenCalledTimes(1);
  });

  // -----------------------------------------------------------------------
  // Breadcrumb component present
  // -----------------------------------------------------------------------

  it('renders an Ant Design Breadcrumb component (not overriding the shell breadcrumb)', () => {
    mockUseClassPageData.mockReturnValue(createReadyClassPageData());

    const { container } = render(
      createElement(ClassPage, {
        classId: DEFAULT_CLASS_ID,
        onNavigateToClasses: vi.fn(),
      })
    );

    // Ant Design Breadcrumb renders with aria-label="breadcrumb" and
    // produces an .ant-breadcrumb class on the container.
    const breadcrumb = container.querySelector('.ant-breadcrumb');
    expect(breadcrumb).toBeInTheDocument();
  });
});
