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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AssignmentFull } from '@/services/assignmentAssessment/assignmentAssessment.zod';
import { ClassPage } from './ClassPage';
import type { ClassPageContent as ClassPageContentType } from './ClassPageContent';
import {
  CLASS_NAME,
  DEFAULT_CLASS_ID,
  createClassPageAdapterResult as createAdapterResult,
  createReadyClassPageData,
} from '@/test/classPage/classPageFixtures';

// ===========================================================================
// Mock setup (hoisted to avoid temporal dead zone issues)
// ===========================================================================

const { mockUseClassPageData } = vi.hoisted(() => ({ mockUseClassPageData: vi.fn() }));

const { mockClassPageContent } = vi.hoisted(() => {
  return {
    mockClassPageContent: vi.fn(function MockClassPageContent() {
      return createElement('div', { 'data-testid': 'class-page-content' });
    }),
  };
});

const { mockAssessTaskModal } = vi.hoisted(() => {
  return {
    mockAssessTaskModal: vi.fn(function MockAssessTaskModal() {
      return createElement('div', { 'data-testid': 'assess-task-modal' });
    }),
  };
});

const { mockStudentAveragesTableCard } = vi.hoisted(() => {
  return {
    mockStudentAveragesTableCard: vi.fn(function MockStudentAveragesTableCard() {
      return createElement('div', { 'data-testid': 'student-averages-table-card' });
    }),
  };
});

const { mockTaskHeatmapTable } = vi.hoisted(() => {
  return {
    mockTaskHeatmapTable: vi.fn(function MockTaskHeatmapTable() {
      return createElement('div', { 'data-testid': 'task-heatmap-table' });
    }),
  };
});

const { mockGetAssignment } = vi.hoisted(() => ({ mockGetAssignment: vi.fn() }));
mockGetAssignment.mockResolvedValue({
  courseId: 'class-abc-123',
  assignmentId: 'a-1',
  assignmentName: 'Test Assignment',
  dueDate: null,
  updatedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  documentType: 'assessment',
  referenceDocumentId: null,
  templateDocumentId: null,
  tasks: null,
  submissions: [],
  assignmentDefinition: {
    primaryTitle: 'Test Assignment',
    primaryTopic: null,
    primaryTopicKey: null,
    yearGroupKey: 'yg-10',
    yearGroupLabel: null,
    alternateTitles: [],
    alternateTopics: [],
    documentType: 'assessment',
    referenceDocumentId: null,
    templateDocumentId: null,
    referenceLastModified: null,
    templateLastModified: null,
    assignmentWeighting: 1,
    definitionKey: 'def-1',
    tasks: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
} satisfies AssignmentFull);

const { mockUseClassSelection } = vi.hoisted(() => {
  return {
    mockUseClassSelection: vi.fn(() => {
      return {
        selectedClassId: DEFAULT_CLASS_ID,
        className: CLASS_NAME,
        onSelectClass: vi.fn(),
        onNavigateToClasses: vi.fn(),
      };
    }),
  };
});

vi.mock('@/services/assignmentAssessment/assignmentAssessmentService', () => {
  return {
    getAssignment: mockGetAssignment,
  };
});

vi.mock('./useClassPageData', () => {
  return {
    useClassPageData: mockUseClassPageData,
  };
});

vi.mock('./ClassPageContent', () => {
  return {
    ClassPageContent: mockClassPageContent,
  };
});

vi.mock('../classes/AssessTaskModal/AssessTaskModal', () => {
  return {
    AssessTaskModal: mockAssessTaskModal,
  };
});

vi.mock('@/pages/pageContent', () => {
  return {
    pageContent: {
      classDetail: {
        heading: 'Class Overview',
        summary: 'Review assessment performance for this class.',
        recentAssignmentsEmpty: 'No recent assessments yet',
        searchEmpty: 'No students match your search',
      },
    },
  };
});

vi.mock('@/ClassSelectionContext', () => {
  return {
    useClassSelection: mockUseClassSelection,
  };
});

vi.mock('./StudentAveragesTableCard', () => {
  return {
    StudentAveragesTableCard: mockStudentAveragesTableCard,
  };
});

vi.mock('../taskHeatmap/TaskHeatmapTable', () => {
  return {
    TaskHeatmapTable: mockTaskHeatmapTable,
  };
});

// ===========================================================================
// Fixture helpers
// ===========================================================================

/**
 * Extract the last call's first argument as a record.
 * Returns an empty object if the mock has not been called.
 *
 * @returns {Record<string, unknown>} The first argument of the last call.
 */
function getLastCallArguments(): Record<string, unknown> {
  const allCalls = [...mockAssessTaskModal.mock.calls] as unknown as unknown[][];
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
    const { ClassPageContent: RealClassPageContent } = await vi.importActual<{
      ClassPageContent: typeof ClassPageContentType;
    }>('./ClassPageContent');
    mockClassPageContent.mockImplementation(
      RealClassPageContent as unknown as typeof mockClassPageContent
    );

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(ClassPage, {
          classId: DEFAULT_CLASS_ID,
        })
      )
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
    const modalCallArguments = getLastCallArguments();
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
    const modalCallArguments = getLastCallArguments();
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
    const modalCallArguments = getLastCallArguments();
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
    expect(mockAssessTaskModal.mock.calls.length).toBeGreaterThan(callCountBeforeReopen);
  });
});
