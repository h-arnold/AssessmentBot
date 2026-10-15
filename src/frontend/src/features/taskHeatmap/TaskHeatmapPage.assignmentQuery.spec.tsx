import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from 'antd';
import {
  mockGetAssignment,
  mockLogFrontendError,
  mockLogFrontendEvent,
  mockTaskHeatmapTable,
} from '../../test/taskHeatmapPageMocks';
import { TaskHeatmapPage } from './TaskHeatmapPage';
import {
  analyserResultFixture,
  buildDefaultAssignmentFixture,
  classFullFixture,
  VALID_ASSIGNMENT_PARTIAL,
} from '../../test/taskHeatmapPageFixtures';
import { createTestQueryClient } from '../../test/dataAnalysis/heatmapFixtures';
import { renderWithFrontendProviders } from '../../test/renderWithFrontendProviders';

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

/**
 * Renders TaskHeatmapPage with its Ant Design and query-client providers.
 *
 * @param {() => void} [refetch] Parent refetch callback.
 * @returns {ReturnType<typeof renderWithFrontendProviders>} Render result and query client.
 */
function renderTaskHeatmapPage(refetch: () => void) {
  return renderWithFrontendProviders(
    <App>
      <TaskHeatmapPage
        analyserResult={analyserResultFixture}
        classFull={classFullFixture}
        assignmentId="a-1"
        assignmentDefinitionPartials={[VALID_ASSIGNMENT_PARTIAL]}
        onBack={vi.fn()}
        refetch={refetch}
      />
    </App>,
    { queryClient: createTestQueryClient() }
  );
}

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
    renderTaskHeatmapPage(refetch);

    await waitFor(() => {
      expect(mockGetAssignment).toHaveBeenCalledWith(
        expect.objectContaining({ courseId: 'class-1', assignmentId: 'a-1' })
      );
    });
  });

  it('passes null cellPreviewLookup and true isAssignmentLoading to TaskHeatmapTable while query is pending', async () => {
    mockGetAssignment.mockImplementation(() => new Promise<never>(() => {}));
    renderTaskHeatmapPage(vi.fn());

    await waitFor(() => expect(mockTaskHeatmapTable).toHaveBeenCalled());
    const properties = getHeatmapTableProperties();
    expect(properties.cellPreviewLookup).toBeNull();
    expect(properties.isAssignmentLoading).toBe(true);
  });

  it('passes a non-null cellPreviewLookup to TaskHeatmapTable on query success', async () => {
    renderTaskHeatmapPage(vi.fn());

    await waitFor(() => {
      expect(getHeatmapTableProperties().cellPreviewLookup).toBeInstanceOf(Map);
    });
  });

  it('passes showAssignmentError as true to TaskHeatmapTable when getAssignment rejects', async () => {
    mockGetAssignment.mockImplementation(() => Promise.reject(new Error('Network error')));
    renderTaskHeatmapPage(vi.fn());

    await waitFor(() => expect(getHeatmapTableProperties().showAssignmentError).toBe(true));
  });

  it('passes showAssignmentError as true to TaskHeatmapTable when getAssignment returns null', async () => {
    mockGetAssignment.mockImplementation(() => Promise.resolve(null));
    renderTaskHeatmapPage(vi.fn());

    await waitFor(() => expect(getHeatmapTableProperties().showAssignmentError).toBe(true));
  });

  it('calls both parent refetch and assignment refetch when Refresh button is clicked', async () => {
    const parentRefetch = vi.fn();
    renderTaskHeatmapPage(parentRefetch);

    await waitFor(() => expect(mockTaskHeatmapTable).toHaveBeenCalled());
    await user.click(screen.getByRole('button', { name: /refresh/i }));
    expect(parentRefetch).toHaveBeenCalledTimes(1);
    const expectedAssignmentCalls = 2;
    expect(mockGetAssignment).toHaveBeenCalledTimes(expectedAssignmentCalls);
  });

  it('logs the assignment fetch error exactly once via logFrontendError', async () => {
    mockGetAssignment.mockImplementation(() => Promise.reject(new Error('Fetch failed')));
    renderTaskHeatmapPage(vi.fn());

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
    renderTaskHeatmapPage(vi.fn());

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
    renderTaskHeatmapPage(vi.fn());

    await waitFor(() => expect(mockTaskHeatmapTable).toHaveBeenCalled());
    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    await user.click(refreshButton);
    await user.click(refreshButton);
    expect(mockGetAssignment).toHaveBeenCalledTimes(1);
  });
});
