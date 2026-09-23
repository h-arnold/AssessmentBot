import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';
import { App } from 'antd';
import { QueryClientProvider } from '@tanstack/react-query';
import { TaskHeatmapPage } from './TaskHeatmapPage';
import {
  analyserResultFixture,
  buildDefaultAssignmentFixture,
  classFullFixture,
  createTestQueryClient,
  VALID_ASSIGNMENT_PARTIAL,
} from '../../test/taskHeatmapPageFixtures';

const { mockGetAssignment, mockLogFrontendError, mockLogFrontendEvent, mockTaskHeatmapTable } =
  vi.hoisted(() => ({
    mockGetAssignment: vi.fn(),
    mockLogFrontendError: vi.fn(),
    mockLogFrontendEvent: vi.fn(),
    mockTaskHeatmapTable: vi.fn(() =>
      createElement('div', { 'data-testid': 'task-heatmap-table' })
    ),
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

/**
 * Extracts the props from the most recent TaskHeatmapTable mock call.
 *
 * @returns {Record<string, unknown>} The props object, or an empty object if never called.
 */
function getHeatmapTableProperties(): Record<string, unknown> {
  const latestCall = mockTaskHeatmapTable.mock.calls.toReversed()[0];
  if (!latestCall) {
    return {};
  }
  return (latestCall as unknown as Array<Record<string, unknown>>)[0] ?? {};
}

let user: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  user = userEvent.setup();
  mockGetAssignment.mockImplementation(() => Promise.resolve(buildDefaultAssignmentFixture()));
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('TaskHeatmapPage — assignment useQuery wiring', () => {
  it('calls getAssignment with correct courseId and assignmentId on mount', async () => {
    const refetch = vi.fn();
    render(
      createElement(
        QueryClientProvider,
        { client: createTestQueryClient() },
        createElement(
          App,
          null,
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
      expect(mockGetAssignment).toHaveBeenCalledWith(
        expect.objectContaining({ courseId: 'class-1', assignmentId: 'a-1' })
      );
    });
  });

  it('passes null cellPreviewLookup and true isAssignmentLoading to TaskHeatmapTable while query is pending', async () => {
    mockGetAssignment.mockImplementation(() => new Promise<never>(() => {}));
    render(
      createElement(
        QueryClientProvider,
        { client: createTestQueryClient() },
        createElement(
          App,
          null,
          createElement(TaskHeatmapPage, {
            analyserResult: analyserResultFixture,
            classFull: classFullFixture,
            assignmentId: 'a-1',
            assignmentDefinitionPartials: [VALID_ASSIGNMENT_PARTIAL],
            onBack: vi.fn(),
            refetch: vi.fn(),
          })
        )
      )
    );

    await waitFor(() => expect(mockTaskHeatmapTable).toHaveBeenCalled());
    const properties = getHeatmapTableProperties();
    expect(properties.cellPreviewLookup).toBeNull();
    expect(properties.isAssignmentLoading).toBe(true);
  });

  it('passes a non-null cellPreviewLookup to TaskHeatmapTable on query success', async () => {
    render(
      createElement(
        QueryClientProvider,
        { client: createTestQueryClient() },
        createElement(
          App,
          null,
          createElement(TaskHeatmapPage, {
            analyserResult: analyserResultFixture,
            classFull: classFullFixture,
            assignmentId: 'a-1',
            assignmentDefinitionPartials: [VALID_ASSIGNMENT_PARTIAL],
            onBack: vi.fn(),
            refetch: vi.fn(),
          })
        )
      )
    );

    await waitFor(() => {
      expect(getHeatmapTableProperties().cellPreviewLookup).toBeInstanceOf(Map);
    });
  });

  it('passes showAssignmentError as true to TaskHeatmapTable when getAssignment rejects', async () => {
    mockGetAssignment.mockImplementation(() => Promise.reject(new Error('Network error')));
    render(
      createElement(
        QueryClientProvider,
        { client: createTestQueryClient() },
        createElement(
          App,
          null,
          createElement(TaskHeatmapPage, {
            analyserResult: analyserResultFixture,
            classFull: classFullFixture,
            assignmentId: 'a-1',
            assignmentDefinitionPartials: [VALID_ASSIGNMENT_PARTIAL],
            onBack: vi.fn(),
            refetch: vi.fn(),
          })
        )
      )
    );

    await waitFor(() => expect(getHeatmapTableProperties().showAssignmentError).toBe(true));
  });

  it('passes showAssignmentError as true to TaskHeatmapTable when getAssignment returns null', async () => {
    mockGetAssignment.mockImplementation(() => Promise.resolve(null));
    render(
      createElement(
        QueryClientProvider,
        { client: createTestQueryClient() },
        createElement(
          App,
          null,
          createElement(TaskHeatmapPage, {
            analyserResult: analyserResultFixture,
            classFull: classFullFixture,
            assignmentId: 'a-1',
            assignmentDefinitionPartials: [VALID_ASSIGNMENT_PARTIAL],
            onBack: vi.fn(),
            refetch: vi.fn(),
          })
        )
      )
    );

    await waitFor(() => expect(getHeatmapTableProperties().showAssignmentError).toBe(true));
  });

  it('calls both parent refetch and assignment refetch when Refresh button is clicked', async () => {
    const parentRefetch = vi.fn();
    render(
      createElement(
        QueryClientProvider,
        { client: createTestQueryClient() },
        createElement(
          App,
          null,
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

    await waitFor(() => expect(mockTaskHeatmapTable).toHaveBeenCalled());
    await user.click(screen.getByRole('button', { name: /refresh/i }));
    expect(parentRefetch).toHaveBeenCalledTimes(1);
    const expectedAssignmentCalls = 2;
    expect(mockGetAssignment).toHaveBeenCalledTimes(expectedAssignmentCalls);
  });

  it('logs the assignment fetch error exactly once via logFrontendError', async () => {
    mockGetAssignment.mockImplementation(() => Promise.reject(new Error('Fetch failed')));
    render(
      createElement(
        QueryClientProvider,
        { client: createTestQueryClient() },
        createElement(
          App,
          null,
          createElement(TaskHeatmapPage, {
            analyserResult: analyserResultFixture,
            classFull: classFullFixture,
            assignmentId: 'a-1',
            assignmentDefinitionPartials: [VALID_ASSIGNMENT_PARTIAL],
            onBack: vi.fn(),
            refetch: vi.fn(),
          })
        )
      )
    );

    await waitFor(() => {
      expect(mockLogFrontendError).toHaveBeenCalledWith('TaskHeatmapPage', expect.any(Error));
    });
    const calls = mockLogFrontendError.mock.calls.filter(
      (call: unknown[]) => call[0] === 'TaskHeatmapPage'
    );
    expect(calls).toHaveLength(1);
  });

  it('logs a warning when getAssignment returns null (not found)', async () => {
    mockGetAssignment.mockImplementation(() => Promise.resolve(null));
    render(
      createElement(
        QueryClientProvider,
        { client: createTestQueryClient() },
        createElement(
          App,
          null,
          createElement(TaskHeatmapPage, {
            analyserResult: analyserResultFixture,
            classFull: classFullFixture,
            assignmentId: 'a-1',
            assignmentDefinitionPartials: [VALID_ASSIGNMENT_PARTIAL],
            onBack: vi.fn(),
            refetch: vi.fn(),
          })
        )
      )
    );

    await waitFor(() => {
      expect(mockLogFrontendEvent).toHaveBeenCalledWith(
        'warn',
        expect.objectContaining({
          context: 'TaskHeatmapPage',
          errorMessage: 'Assignment not found in AssignmentFull payload',
        })
      );
    });
  });

  it('does not throw when Refresh is clicked while assignment query is pending; mock invoked at most once during the pre-first-settle window', async () => {
    mockGetAssignment.mockImplementation(() => new Promise<never>(() => {}));
    render(
      createElement(
        QueryClientProvider,
        { client: createTestQueryClient() },
        createElement(
          App,
          null,
          createElement(TaskHeatmapPage, {
            analyserResult: analyserResultFixture,
            classFull: classFullFixture,
            assignmentId: 'a-1',
            assignmentDefinitionPartials: [VALID_ASSIGNMENT_PARTIAL],
            onBack: vi.fn(),
            refetch: vi.fn(),
          })
        )
      )
    );

    await waitFor(() => expect(mockTaskHeatmapTable).toHaveBeenCalled());
    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    await user.click(refreshButton);
    await user.click(refreshButton);
    expect(mockGetAssignment).toHaveBeenCalledTimes(1);
  });
});
