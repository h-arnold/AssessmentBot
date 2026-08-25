/**
 * Tests for TaskHeatmapPage — TaskTitlesUnavailableError and generic Error handling.
 *
 * @remarks
 * These tests verify TaskHeatmapPage's error handling:
 *   - it accepts `assignmentDefinitionPartials` as a prop
 *   - it imports and handles `TaskTitlesUnavailableError`
 *   - it renders an in-view Ant Design Alert for TaskTitlesUnavailableError
 *   - it logs via logFrontendError on generic Error and calls onBack
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';
import { App } from 'antd';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import type { AveragingResult } from '../../services/dataAnalysis/dataAnalysis.zod';
import type {
  AssignmentFull,
} from '../../services/assignmentAssessment/assignmentAssessment.zod';
import type { ClassFull } from '../../services/googleClassrooms/classDetail/classDetailService.zod';
import { TaskHeatmapPage } from './TaskHeatmapPage';
import { logFrontendError } from '../../logging/frontendLogger';
import { createComputedMetricResult } from '../../test/dataAnalysis/fixtures';

// ===========================================================================
// Helpers
// ===========================================================================

/**
 * Creates a fresh QueryClient for test isolation.
 *
 * @returns {QueryClient} A test QueryClient with retries disabled.
 */
function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

/**
 * Builds a minimal schema-valid `AssignmentFull` fixture for default mock value.
 *
 * @returns {AssignmentFull} A valid, empty-submissions assignment.
 */
function buildDefaultAssignmentFixture(): AssignmentFull {
  return {
    courseId: 'class-1',
    assignmentId: 'a-1',
    assignmentName: 'Assignment One',
    dueDate: null,
    updatedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    documentType: 'assessment',
    referenceDocumentId: null,
    templateDocumentId: null,
    tasks: null,
    submissions: [],
    assignmentDefinition: {
      primaryTitle: 'Assignment One',
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
  };
}

// ===========================================================================
// Mock setup
// ===========================================================================

const { mockGetAssignment } = vi.hoisted(() => ({ mockGetAssignment: vi.fn() }));
const { mockLogFrontendError } = vi.hoisted(() => ({ mockLogFrontendError: vi.fn() }));
const { mockLogFrontendEvent } = vi.hoisted(() => ({ mockLogFrontendEvent: vi.fn() }));

const { mockTaskHeatmapTable } = vi.hoisted(() => ({
  mockTaskHeatmapTable: vi.fn(() => createElement('div', { 'data-testid': 'task-heatmap-table' })),
}));

vi.mock('../../services/assignmentAssessment/assignmentAssessmentService', () => ({
  getAssignment: mockGetAssignment,
}));

vi.mock('../../logging/frontendLogger', () => ({
  logFrontendError: mockLogFrontendError,
  logFrontendEvent: mockLogFrontendEvent,
}));

vi.mock('./TaskHeatmapTable', () => ({
  TaskHeatmapTable: mockTaskHeatmapTable,
}));

// Set default mock to a non-null AssignmentFull fixture so existing tests
// that render through the real TaskHeatmapPage don't fire a real callApi.
mockGetAssignment.mockResolvedValue(buildDefaultAssignmentFixture());

/**
 * Extract the props from the most recent TaskHeatmapTable mock call.
 * Uses `as unknown` cast to sidestep the tuple inference from vi.fn().
 *
 * @returns {Record<string, unknown>} The props object, or empty object if never called.
 */
function getHeatmapTableProperties(): Record<string, unknown> {
  const allCalls = mockTaskHeatmapTable.mock.calls;
  if (allCalls.length === 0) return {};
  const callCount = allCalls.length;
  const lastCall = allCalls[callCount - 1];
  // Cast through unknown to sidestep TypeScript's tuple inference from vi.fn()
  const arguments_ = lastCall as unknown;
  const properties = (arguments_ as Array<Record<string, unknown>>)[0];
  return properties ?? {};
}

/** Shared computed MetricResult for the student's per-task criteria. */
const COMPUTED_5 = createComputedMetricResult({ value: 5 });
const COMPUTED_4 = createComputedMetricResult({ value: 4 });
const COMPUTED_3 = createComputedMetricResult({ value: 3 });

/**
 * A valid assignment-definition partial matching 'def-1' so the heatmap
 * adapter can resolve task titles from the warm-up dataset.
 */
const VALID_ASSIGNMENT_PARTIAL = {
  primaryTitle: 'Assignment One',
  primaryTopic: 'Algebra',
  primaryTopicKey: 'algebra',
  yearGroupKey: 'yg-10',
  yearGroupLabel: 'Year 10',
  alternateTitles: [] as string[],
  alternateTopics: [] as string[],
  documentType: 'assignment',
  referenceDocumentId: null,
  templateDocumentId: null,
  assignmentWeighting: 1,
  definitionKey: 'def-1',
  tasks: [{ taskId: 't-1', taskWeighting: 1, taskTitle: 'Task One' }],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: null,
};

/** A ClassFull fixture with one student and one assignment (definitionKey 'def-1'). */
const classFullFixture: ClassFull = {
  classId: 'class-1',
  className: 'Class A',
  cohortKey: null,
  courseLength: 1,
  yearGroupKey: null,
  classOwner: null,
  teachers: [],
  students: [{ id: 's-1', name: 'Student One', email: 's1@test.com' }],
  assignments: [
    {
      assignmentId: 'a-1',
      dueDate: null,
      updatedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      documentType: 'assessment',
      submissions: [],
      assignmentDefinitionKey: 'def-1',
    },
  ],
  active: null,
};

/** An AveragingResult fixture with one perStudentTaskMetric. */
const analyserResultFixture: AveragingResult = {
  classId: 'class-1',
  className: 'Class A',
  perStudent: [],
  perTask: [],
  perClass: {
    completeness: COMPUTED_5,
    accuracy: COMPUTED_4,
    spag: COMPUTED_3,
    overall: COMPUTED_4,
  },
  appliedCriterionWeightings: { completeness: 0.4, accuracy: 0.4, spag: 0.2 },
  perStudentTaskMetrics: [
    {
      classId: 'class-1',
      studentId: 's-1',
      taskKey: 'def-1::t-1',
      completeness: COMPUTED_5,
      accuracy: COMPUTED_4,
      spag: COMPUTED_3,
      overall: COMPUTED_4,
    },
  ],
};

// ===========================================================================
// Tests
// ===========================================================================

describe('TaskHeatmapPage — TaskTitlesUnavailableError and generic Error handling', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // -----------------------------------------------------------------------
  // TaskTitlesUnavailableError — in-view Alert
  // -----------------------------------------------------------------------

  it('renders an Alert when adaptMetricsToHeatmap throws TaskTitlesUnavailableError; header stays visible; Back calls onBack', async () => {
    const onBack = vi.fn();
    const refetch = vi.fn();

    // Provide a partial with a non-matching definitionKey so the adapter
    // throws TaskTitlesUnavailableError (the partial is not found).
    const partials = [
      {
        primaryTitle: 'Assignment One',
        primaryTopic: 'Algebra',
        primaryTopicKey: 'algebra',
        yearGroupKey: 'yg-10',
        yearGroupLabel: 'Year 10',
        alternateTitles: [] as string[],
        alternateTopics: [] as string[],
        documentType: 'assignment',
        referenceDocumentId: null,
        templateDocumentId: null,
        assignmentWeighting: 1,
        definitionKey: 'def-999',
        tasks: [{ taskId: 't-1', taskWeighting: 1, taskTitle: 'Some Title' }],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: null,
      },
    ];

    const queryClient = createTestQueryClient();
    render(
      createElement(QueryClientProvider, { client: queryClient },
        createElement(App, null,
          createElement(TaskHeatmapPage, {
            analyserResult: analyserResultFixture,
            classFull: classFullFixture,
            assignmentId: 'a-1',
            assignmentDefinitionPartials: partials,
            onBack,
            refetch,
          })
        )
      )
    );

    // The title Card stays visible (assignment name is empty because the
    // partials don't match the assignment's definitionKey, which is intentional
    // to trigger TaskTitlesUnavailableError).
    // The parent class-name title is owned by ClassPage, not TaskHeatmapPage.

    // Back button should be present and functional
    const backButton = screen.getByLabelText('Back to Class overview');
    expect(backButton).toBeInTheDocument();
    await user.click(backButton);
    expect(onBack).toHaveBeenCalledTimes(1);

    // An in-view Ant Design Alert should render in place of the table
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveClass('ant-alert-error');
    expect(alert.querySelector('.ant-alert-icon')).toBeInTheDocument();
    expect(screen.getByText('Task titles are currently unavailable.')).toBeInTheDocument();
    expect(screen.getByText('Please try reloading the page.')).toBeInTheDocument();

    // No TaskHeatmapTable should mount
    expect(screen.queryByLabelText('Task Heatmap')).not.toBeInTheDocument();

    // onBack should NOT be auto-invoked on the throw (only the explicit click above)
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  // -----------------------------------------------------------------------
  // Generic Error — logFrontendError + onBack, no Alert
  // -----------------------------------------------------------------------

  it('logs via logFrontendError and calls onBack for a generic Error (unknown assignmentId); no Alert rendered', () => {
    const onBack = vi.fn();
    const refetch = vi.fn();

    // Pass an unknown assignmentId that the adapter will reject with a generic Error
    const queryClient = createTestQueryClient();
    render(
      createElement(QueryClientProvider, { client: queryClient },
        createElement(App, null,
          createElement(TaskHeatmapPage, {
            analyserResult: analyserResultFixture,
            classFull: classFullFixture,
            assignmentId: 'nonexistent-id',
            assignmentDefinitionPartials: [],
            onBack,
            refetch,
          })
        )
      )
    );

    // The error should be logged via logFrontendError('TaskHeatmapPage', ...)
    expect(logFrontendError).toHaveBeenCalledWith('TaskHeatmapPage', expect.any(Error));

    // onBack should be called exactly once (auto-navigate)
    expect(onBack).toHaveBeenCalledTimes(1);

    // No Ant Design Alert should be rendered (in-view error)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

// ===========================================================================
// Assignment useQuery wiring tests (RED phase — will fail until GREEN adds
// useQuery, cellPreviewLookup, isAssignmentLoading, showAssignmentError,
// assignmentRefetch wrapping, and error-logging effects).
// ===========================================================================

describe('TaskHeatmapPage — assignment useQuery wiring', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    mockGetAssignment.mockResolvedValue(buildDefaultAssignmentFixture());
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // -------------------------------------------------------------------------
  // 1. useQuery receives correct courseId and assignmentId
  // -------------------------------------------------------------------------

  it('calls getAssignment with correct courseId and assignmentId on mount', async () => {
    mockGetAssignment.mockResolvedValue(buildDefaultAssignmentFixture());
    const refetch = vi.fn();
    const queryClient = createTestQueryClient();

    render(
      createElement(QueryClientProvider, { client: queryClient },
        createElement(App, null,
          createElement(TaskHeatmapPage, {
            analyserResult: analyserResultFixture,
            classFull: classFullFixture,
            assignmentId: 'a-1',
            assignmentDefinitionPartials: [
              {
                primaryTitle: 'Assignment One',
                primaryTopic: 'Algebra',
                primaryTopicKey: 'algebra',
                yearGroupKey: 'yg-10',
                yearGroupLabel: 'Year 10',
                alternateTitles: [],
                alternateTopics: [],
                documentType: 'assignment',
                referenceDocumentId: null,
                templateDocumentId: null,
                assignmentWeighting: 1,
                definitionKey: 'def-1',
                tasks: [{ taskId: 't-1', taskWeighting: 1, taskTitle: 'Task One' }],
                createdAt: '2026-01-01T00:00:00.000Z',
                updatedAt: null,
              },
            ],
            onBack: vi.fn(),
            refetch,
          })
        )
      )
    );

    await waitFor(() => {
      expect(mockGetAssignment).toHaveBeenCalledWith(
        expect.objectContaining({ courseId: 'class-1', assignmentId: 'a-1' })
      );
    });
  });

  // -------------------------------------------------------------------------
  // 2. While isPending, cellPreviewLookup is null and isAssignmentLoading is true
  // -------------------------------------------------------------------------

  it('passes null cellPreviewLookup and true isAssignmentLoading to TaskHeatmapTable while query is pending', async () => {
    // Make the query never settle so it stays in isPending
    mockGetAssignment.mockReturnValue(new Promise<never>(() => {}));
    const refetch = vi.fn();
    const queryClient = createTestQueryClient();

    render(
      createElement(QueryClientProvider, { client: queryClient },
        createElement(App, null,
          createElement(TaskHeatmapPage, {
            analyserResult: analyserResultFixture,
            classFull: classFullFixture,
            assignmentId: 'a-1',
            assignmentDefinitionPartials: [VALID_ASSIGNMENT_PARTIAL],
            onBack: vi.fn(),
            refetch,
          })
        )
      )
    );

    await waitFor(() => {
      expect(mockTaskHeatmapTable).toHaveBeenCalled();
    });

    const properties = getHeatmapTableProperties();
    expect(properties.cellPreviewLookup).toBeNull();
    expect(properties.isAssignmentLoading).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 3. On success, cellPreviewLookup is a non-null Map
  // -------------------------------------------------------------------------

  it('passes a non-null cellPreviewLookup to TaskHeatmapTable on query success', async () => {
    mockGetAssignment.mockResolvedValue(buildDefaultAssignmentFixture());
    const refetch = vi.fn();
    const queryClient = createTestQueryClient();

    render(
      createElement(QueryClientProvider, { client: queryClient },
        createElement(App, null,
          createElement(TaskHeatmapPage, {
            analyserResult: analyserResultFixture,
            classFull: classFullFixture,
            assignmentId: 'a-1',
            assignmentDefinitionPartials: [VALID_ASSIGNMENT_PARTIAL],
            onBack: vi.fn(),
            refetch,
          })
        )
      )
    );

    await waitFor(() => {
      const properties = getHeatmapTableProperties();
      expect(properties.cellPreviewLookup).toBeInstanceOf(Map);
    });
  });

  // -------------------------------------------------------------------------
  // 4. showAssignmentError is true when isError (fetch failure)
  // -------------------------------------------------------------------------

  it('passes showAssignmentError as true to TaskHeatmapTable when getAssignment rejects', async () => {
    mockGetAssignment.mockRejectedValue(new Error('Network error'));
    const refetch = vi.fn();
    const queryClient = createTestQueryClient();

    render(
      createElement(QueryClientProvider, { client: queryClient },
        createElement(App, null,
          createElement(TaskHeatmapPage, {
            analyserResult: analyserResultFixture,
            classFull: classFullFixture,
            assignmentId: 'a-1',
            assignmentDefinitionPartials: [VALID_ASSIGNMENT_PARTIAL],
            onBack: vi.fn(),
            refetch,
          })
        )
      )
    );

    await waitFor(() => {
      const properties = getHeatmapTableProperties();
      expect(properties.showAssignmentError).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 5. showAssignmentError is true when data is null (not found)
  // -------------------------------------------------------------------------

  it('passes showAssignmentError as true to TaskHeatmapTable when getAssignment returns null', async () => {
    mockGetAssignment.mockResolvedValue(null);
    const refetch = vi.fn();
    const queryClient = createTestQueryClient();

    render(
      createElement(QueryClientProvider, { client: queryClient },
        createElement(App, null,
          createElement(TaskHeatmapPage, {
            analyserResult: analyserResultFixture,
            classFull: classFullFixture,
            assignmentId: 'a-1',
            assignmentDefinitionPartials: [VALID_ASSIGNMENT_PARTIAL],
            onBack: vi.fn(),
            refetch,
          })
        )
      )
    );

    await waitFor(() => {
      const properties = getHeatmapTableProperties();
      expect(properties.showAssignmentError).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 6. Refresh button calls both parent refetch and assignmentRefetch
  // -------------------------------------------------------------------------

  it('calls both parent refetch and assignment refetch when Refresh button is clicked', async () => {
    mockGetAssignment.mockResolvedValue(buildDefaultAssignmentFixture());
    const parentRefetch = vi.fn();
    const queryClient = createTestQueryClient();

    render(
      createElement(QueryClientProvider, { client: queryClient },
        createElement(App, null,
          createElement(TaskHeatmapPage, {
            analyserResult: analyserResultFixture,
            classFull: classFullFixture,
            assignmentId: 'a-1',
            assignmentDefinitionPartials: [VALID_ASSIGNMENT_PARTIAL],
            onBack: vi.fn(),
            refetch: parentRefetch,
          })
        )
      )
    );

    // Wait for the query to settle and the component to render fully
    await waitFor(() => {
      expect(mockTaskHeatmapTable).toHaveBeenCalled();
    });

    // Click the Refresh button
    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    await user.click(refreshButton);

    // Expect parent refetch to have been called (always works, even in RED).
    // In GREEN, assignmentRefetch also fires, which means getAssignment is
    // called a second time (once from mount, once from refetch).
    expect(parentRefetch).toHaveBeenCalledTimes(1);

    // Assert getAssignment was called an additional time (mount + refetch).
    // Will fail in RED because there is no useQuery wiring yet.
    const expectedAssignmentCalls = 2;
    expect(mockGetAssignment).toHaveBeenCalledTimes(expectedAssignmentCalls);
  });

  // -------------------------------------------------------------------------
  // 7. Error effect logs once (not twice in StrictMode)
  // -------------------------------------------------------------------------

  it('logs the assignment fetch error exactly once via logFrontendError', async () => {
    mockGetAssignment.mockRejectedValue(new Error('Fetch failed'));
    const refetch = vi.fn();
    const queryClient = createTestQueryClient();

    render(
      createElement(QueryClientProvider, { client: queryClient },
        createElement(App, null,
          createElement(TaskHeatmapPage, {
            analyserResult: analyserResultFixture,
            classFull: classFullFixture,
            assignmentId: 'a-1',
            assignmentDefinitionPartials: [VALID_ASSIGNMENT_PARTIAL],
            onBack: vi.fn(),
            refetch,
          })
        )
      )
    );

    await waitFor(() => {
      expect(mockLogFrontendError).toHaveBeenCalledWith(
        'TaskHeatmapPage',
        expect.any(Error)
      );
    });

    // Assert it was called exactly once (not twice from StrictMode double-effect)
    const calls = mockLogFrontendError.mock.calls.filter(
      (call: unknown[]) => call[0] === 'TaskHeatmapPage'
    );
    expect(calls).toHaveLength(1);
  });

  // -------------------------------------------------------------------------
  // 8. Not-found effect logs once as warn
  // -------------------------------------------------------------------------

  it('logs a warning when getAssignment returns null (not found)', async () => {
    mockGetAssignment.mockResolvedValue(null);
    const refetch = vi.fn();
    const queryClient = createTestQueryClient();

    render(
      createElement(QueryClientProvider, { client: queryClient },
        createElement(App, null,
          createElement(TaskHeatmapPage, {
            analyserResult: analyserResultFixture,
            classFull: classFullFixture,
            assignmentId: 'a-1',
            assignmentDefinitionPartials: [VALID_ASSIGNMENT_PARTIAL],
            onBack: vi.fn(),
            refetch,
          })
        )
      )
    );

    await waitFor(() => {
      // The not-found log should be 'warn' level with 'Assignment not found' message.
      // Will fail in RED because the warning logging effect does not exist yet.
      expect(mockLogFrontendEvent).toHaveBeenCalledWith(
        'warn',
        expect.objectContaining({
          context: 'TaskHeatmapPage',
          errorMessage: 'Assignment not found in AssignmentFull payload',
        })
      );
    });
  });

  // -------------------------------------------------------------------------
  // 9. Refresh while isPending does not throw and getAssignment called at most once
  // -------------------------------------------------------------------------

  it('does not throw when Refresh is clicked while assignment query is pending; mock invoked at most once during the pre-first-settle window', async () => {
    // Keep the query pending indefinitely
    mockGetAssignment.mockReturnValue(new Promise<never>(() => {}));
    const parentRefetch = vi.fn();
    const queryClient = createTestQueryClient();

    render(
      createElement(QueryClientProvider, { client: queryClient },
        createElement(App, null,
          createElement(TaskHeatmapPage, {
            analyserResult: analyserResultFixture,
            classFull: classFullFixture,
            assignmentId: 'a-1',
            assignmentDefinitionPartials: [VALID_ASSIGNMENT_PARTIAL],
            onBack: vi.fn(),
            refetch: parentRefetch,
          })
        )
      )
    );

    // Wait for the table to have rendered at least once (component mounted)
    await waitFor(() => {
      expect(mockTaskHeatmapTable).toHaveBeenCalled();
    });

    // The query is still pending — click Refresh twice in rapid succession.
    // The expectation: no crash/throw, and getAssignment has been called at
    // most once total (React Query deduplicates).
    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    await user.click(refreshButton);
    await user.click(refreshButton);

    // No assertion on parentRefetch (the green handler may or may not call it
    // before isPending resolves). The key assertion: the component did not
    // throw and getAssignment was called exactly once during the window
    // (by useQuery on mount; React Query deduplicates the two rapid-refetch
    // calls into the same in-flight request).
    expect(mockGetAssignment).toHaveBeenCalledTimes(1);
  });
});
