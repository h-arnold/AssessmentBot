/**
 * RED-phase tests for TaskHeatmapPage — TaskTitlesUnavailableError and generic Error handling.
 *
 * @remarks
 * These tests are expected to FAIL because TaskHeatmapPage does not yet:
 *   - accept `assignmentDefinitionPartials` as a prop
 *   - import or handle `TaskTitlesUnavailableError`
 *   - render an in-view Ant Design Alert for TaskTitlesUnavailableError
 *   - log via logFrontendError on generic Error and call onBack
 *
 * See ACTION_PLAN.md §8 — Required test cases 9 and 10.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';
import type { AveragingResult } from '../../services/dataAnalysis/dataAnalysis.zod';
import type { ClassFull } from '../../services/googleClassrooms/classDetail/classDetailService.zod';
import { TaskHeatmapPage } from './TaskHeatmapPage';
import { logFrontendError } from '../../logging/frontendLogger';
import { createComputedMetricResult } from '../../test/dataAnalysis/fixtures';

// ===========================================================================
// Mock setup
// ===========================================================================

vi.mock('../../logging/frontendLogger', () => ({ logFrontendError: vi.fn() }));

/** Shared computed MetricResult for the student's per-task criteria. */
const COMPUTED_5 = createComputedMetricResult({ value: 5 });
const COMPUTED_4 = createComputedMetricResult({ value: 4 });
const COMPUTED_3 = createComputedMetricResult({ value: 3 });

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
      assignmentDefinition: {
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
        tasks: [{ taskId: 't-1', taskWeighting: 1, taskTitle: 'Task 1 Title' }],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: null,
      },
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

    // Provide a matching partial with null taskTitle to trigger
    // TaskTitlesUnavailableError in the adapter.
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
        definitionKey: 'def-1',
        tasks: [{ taskId: 't-1', taskWeighting: 1, taskTitle: null }],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: null,
      },
    ];

    render(
      createElement(TaskHeatmapPage, {
        analyserResult: analyserResultFixture,
        classFull: classFullFixture,
        assignmentId: 'a-1',
        assignmentDefinitionPartials: partials,
        onBack,
        refetch,
      })
    );

    // The parent title Card (class name) and child title Card (assignment name) stay visible.
    expect(screen.getByText('Assignment One')).toBeInTheDocument();
    expect(screen.getByText('Class A')).toBeInTheDocument();

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
    render(
      createElement(TaskHeatmapPage, {
        analyserResult: analyserResultFixture,
        classFull: classFullFixture,
        assignmentId: 'nonexistent-id',
        assignmentDefinitionPartials: [],
        onBack,
        refetch,
      })
    );

    // The error should be logged via logFrontendError('TaskHeatmapPage', ...)
    expect(logFrontendError).toHaveBeenCalledWith('TaskHeatmapPage', expect.any(Error));

    // onBack should be called exactly once (auto-navigate)
    expect(onBack).toHaveBeenCalledTimes(1);

    // No Ant Design Alert should be rendered (in-view error)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
