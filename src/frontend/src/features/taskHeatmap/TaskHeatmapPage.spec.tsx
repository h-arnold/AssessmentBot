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
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';
import { App } from 'antd';
import { QueryClientProvider } from '@tanstack/react-query';
import { TaskHeatmapPage } from './TaskHeatmapPage';
import { logFrontendError } from '@/logging/frontendLogger';
import { DataAnalysisService } from '@/services/dataAnalysis/dataAnalysisService';
import * as summaryAdapter from '@/services/dataAnalysis/assignmentSummaryAdapter';
import type { TaskHeatmapTable } from './TaskHeatmapTable';
import {
  analyserResultFixture,
  buildDefaultAssignmentFixture,
  classFullFixture,
  VALID_ASSIGNMENT_PARTIAL,
} from '@/test/taskHeatmapPageFixtures';
import { createTestQueryClient } from '@/test/dataAnalysis/heatmapFixtures';

// ===========================================================================
// Helpers
// ===========================================================================

// ===========================================================================
// Mock setup
// ===========================================================================

const { mockGetAssignment } = vi.hoisted(() => ({ mockGetAssignment: vi.fn() }));
const { mockLogFrontendError } = vi.hoisted(() => ({ mockLogFrontendError: vi.fn() }));
const { mockLogFrontendEvent } = vi.hoisted(() => ({ mockLogFrontendEvent: vi.fn() }));

const { mockTaskHeatmapTable } = vi.hoisted(() => {
  return {
    mockTaskHeatmapTable: vi.fn<typeof TaskHeatmapTable>(() =>
      createElement('div', { 'data-testid': 'task-heatmap-table' })
    ),
  };
});

vi.mock('@/services/assignmentAssessment/assignmentAssessmentService', () => {
  return {
    getAssignment: mockGetAssignment,
  };
});

vi.mock('@/logging/frontendLogger', () => {
  return {
    logFrontendError: mockLogFrontendError,
    logFrontendEvent: mockLogFrontendEvent,
  };
});

vi.mock('./TaskHeatmapTable', () => ({ TaskHeatmapTable: mockTaskHeatmapTable }));

const { TaskHeatmapTable: RealTaskHeatmapTable } = await vi.importActual<{
  TaskHeatmapTable: typeof TaskHeatmapTable;
}>('./TaskHeatmapTable');

// Set default mock to a non-null AssignmentFull fixture so existing tests
// that render through the real TaskHeatmapPage don't fire a real callApi.
mockGetAssignment.mockResolvedValue(buildDefaultAssignmentFixture());

// ===========================================================================
// Tests
// ===========================================================================

describe('TaskHeatmapPage — TaskTitlesUnavailableError and generic Error handling', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    mockGetAssignment.mockImplementation(() => Promise.resolve(buildDefaultAssignmentFixture()));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetAllMocks();
  });

  it.each(['analysis', 'adaptor'] as const)(
    'keeps a functional heatmap after summary %s fails and recovers after rerender',
    async (stage) => {
      mockTaskHeatmapTable.mockImplementation(RealTaskHeatmapTable);
      const error = new Error(`Embedded summary ${stage} recovery failure`);
      const failure =
        stage === 'analysis'
          ? vi.spyOn(DataAnalysisService.prototype, 'analyseAssignmentSummary')
          : vi.spyOn(summaryAdapter, 'adaptAssignmentSummary');
      failure.mockImplementation(() => {
        throw error;
      });
      const onBack = vi.fn();
      const refetch = vi.fn();
      const properties = {
        analyserResult: analyserResultFixture,
        classFull: classFullFixture,
        assignmentId: 'a-1',
        assignmentDefinitionPartials: [VALID_ASSIGNMENT_PARTIAL],
        onBack,
        refetch,
      };
      const queryClient = createTestQueryClient();
      const { rerender } = render(
        <QueryClientProvider client={queryClient}>
          <App>
            <TaskHeatmapPage {...properties} />
          </App>
        </QueryClientProvider>
      );

      const alert = await screen.findByRole('alert');
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
      expect(alert).toHaveClass('ant-alert-error');
      expect(
        within(alert).getByText('The summary could not be built', { exact: true })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('region', { name: 'Completeness summary' })
      ).not.toBeInTheDocument();
      expect(screen.queryByRole('region', { name: 'Accuracy summary' })).not.toBeInTheDocument();
      const table = screen.getByRole('table', { name: 'Task Heatmap' });
      expect(within(table).getByRole('columnheader', { name: 'Task One' })).toBeInTheDocument();
      expect(
        within(table).getByRole('cell', { name: 'Student One, Task One, Completeness: 5' })
      ).toHaveTextContent('5');
      expect(alert.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(onBack).not.toHaveBeenCalled();
      expect(logFrontendError).toHaveBeenCalledExactlyOnceWith('TaskHeatmapPage.summary', error, {
        classId: classFullFixture.classId,
        assignmentId: properties.assignmentId,
      });

      const forename = within(table).getByRole('columnheader', { name: /Forename/ });
      await user.click(forename);
      expect(forename).toHaveAttribute('aria-sort', 'ascending');
      await act(async () => {
        await user.click(screen.getByRole('button', { name: 'Refresh' }));
      });
      await waitFor(() => expect(queryClient.isFetching()).toBe(0));
      expect(refetch).toHaveBeenCalledTimes(1);
      expect(onBack).not.toHaveBeenCalled();
      expect(screen.getByRole('table', { name: 'Task Heatmap' })).toBeInTheDocument();

      failure.mockRestore();
      rerender(
        <QueryClientProvider client={queryClient}>
          <App>
            <TaskHeatmapPage {...properties} analyserResult={{ ...analyserResultFixture }} />
          </App>
        </QueryClientProvider>
      );
      expect(
        await screen.findByRole('region', { name: 'Completeness summary' })
      ).toBeInTheDocument();
      expect(screen.getByRole('region', { name: 'Accuracy summary' })).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByRole('table', { name: 'Task Heatmap' })).toBeInTheDocument();
      expect(onBack).not.toHaveBeenCalled();
      expect(logFrontendError).toHaveBeenCalledTimes(1);
    }
  );

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
      <QueryClientProvider client={queryClient}>
        <App>
          <TaskHeatmapPage
            analyserResult={analyserResultFixture}
            classFull={classFullFixture}
            assignmentId="a-1"
            assignmentDefinitionPartials={partials}
            onBack={onBack}
            refetch={refetch}
          />
        </App>
      </QueryClientProvider>
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

  it('logs via logFrontendError and calls onBack for a generic Error (unknown assignmentId); no Alert rendered', async () => {
    const onBack = vi.fn();
    const refetch = vi.fn();

    // Pass an unknown assignmentId that the adapter will reject with a generic Error
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <App>
          <TaskHeatmapPage
            analyserResult={analyserResultFixture}
            classFull={classFullFixture}
            assignmentId="nonexistent-id"
            assignmentDefinitionPartials={[]}
            onBack={onBack}
            refetch={refetch}
          />
        </App>
      </QueryClientProvider>
    );

    // The error should be logged via logFrontendError('TaskHeatmapPage', ...)
    expect(logFrontendError).toHaveBeenCalledWith('TaskHeatmapPage', expect.any(Error));

    // onBack should be called exactly once (auto-navigate)
    expect(onBack).toHaveBeenCalledTimes(1);

    // The user-safe toast is expected, but the generic failure renders no in-view heatmap.
    expect(
      await screen.findByText(
        'Something went wrong while loading the heatmap. Returning to class overview.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Task Heatmap' })).not.toBeInTheDocument();
  });
});
