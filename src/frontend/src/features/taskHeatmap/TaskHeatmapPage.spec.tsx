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
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';
import { App } from 'antd';
import { QueryClientProvider } from '@tanstack/react-query';
import { TaskHeatmapPage } from './TaskHeatmapPage';
import { logFrontendError } from '../../logging/frontendLogger';
import {
  analyserResultFixture,
  buildDefaultAssignmentFixture,
  classFullFixture,
  createTestQueryClient,
} from '../../test/taskHeatmapPageFixtures';

// ===========================================================================
// Helpers
// ===========================================================================

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
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(
          App,
          null,
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
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(
          App,
          null,
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
