/**
 * RED-phase integration tests for the Section 5b heatmap view-state wiring.
 *
 * @remarks
 * **RED phase.** `TaskHeatmapPage` does NOT exist yet. The suite verifies the
 * wiring contract between `ClassPageContent`, `RecentAssignmentsSection`,
 * `RecentAssignmentCard`, and the not-yet-existing `TaskHeatmapPage` by
 * expecting runtime assertion failures caused by absent Section 5b wiring:
 * `ClassPageContent` does not yet accept the GREEN-contract props
 * (`selectedView`, `analyserResult`, `classFull`, `onOpenHeatmap`, `onBack`,
 * `refetch`), so `onOpenHeatmap` is not threaded through to
 * `RecentAssignmentCard` (the card has no `role="button"`), `TaskHeatmapPage`
 * is never rendered, and `logFrontendError` is never called.
 *
 * These tests encode the planned GREEN contract:
 * - `ClassPageContent` gains props: `selectedView`, `analyserResult`,
 *   `classFull`, `onOpenHeatmap`, `onBack`, `refetch` (plus existing props).
 * - When `surfaceState.status === 'ready' && selectedView.view === 'heatmap'`
 *   (and `analyserResult`/`classFull` non-null), it renders `TaskHeatmapPage`
 *   instead of the ready overview tree.
 * - `TaskHeatmapPage` renders header (assignment name, class name, Back button),
 *   a control Card (refresh), and `<TaskHeatmapTable heatmapResult={...} />`.
 * - On `adaptMetricsToHeatmap` throw, it logs via `logFrontendError` and calls
 *   `onBack` (no in-view error UI).
 *
 * @see ACTION_PLAN.md §5 — TaskHeatmapPage view-state wiring
 * @see TASK_HEATMAP_LAYOUT.md — §"1. Header region", §"2. Control region", §"3. Table region"
 * @see SPEC.md — §"Page composition", §"Navigation / breadcrumb", §"Error handling"
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement, useState } from 'react';
import { ClassPageContent } from './ClassPageContent';
import type { ClassPageSurfaceState } from './useClassPageData';
import type { ClassPageAdapterResult } from './classPageAdapter.zod';
import type { AveragingResult } from '../../services/dataAnalysis/dataAnalysis.zod';
import type { ClassFull } from '../../services/googleClassrooms/classDetail/classDetailService.zod';
import {
  createComputedMetricResult,
} from '../../test/dataAnalysis/fixtures';

// ===========================================================================
// Mock setup
// ===========================================================================
//
// Mock only the heavy/ancillary sub-components to keep the overview render
// light. Use the REAL RecentAssignmentsSection, RecentAssignmentCard,
// ClassPageContent, TaskHeatmapTable so the click→heatmap→back chain is
// exercised end-to-end.
//
// Also mock the frontend logger to spy on error-handling pathways.

const { mockStudentAveragesTableCard } = vi.hoisted(() => ({
  mockStudentAveragesTableCard: vi.fn(function MockStudentAveragesTableCard() {
    return createElement('div', { 'data-testid': 'student-averages-table-card' });
  }),
}));

const { logFrontendError: mockLogFrontendError } = vi.hoisted(() => ({
  logFrontendError: vi.fn(),
}));

vi.mock('./StudentAveragesTableCard', () => ({
  StudentAveragesTableCard: mockStudentAveragesTableCard,
}));

vi.mock('../../logging/frontendLogger', () => ({
  logFrontendError: mockLogFrontendError,
}));

// ===========================================================================
// Fixtures
// ===========================================================================
//
// Build three internally consistent fixtures so that
// `adaptMetricsToHeatmap(analyserResultFixture, classFullFixture, 'a-1')`
// succeeds and returns a HeatmapResult whose assignmentName === 'Assignment One'.

/** Shared computed MetricResult for the student's per-task criteria. */
const COMPUTED_5 = createComputedMetricResult({ value: 5 });
const COMPUTED_4 = createComputedMetricResult({ value: 4 });
const COMPUTED_3 = createComputedMetricResult({ value: 3 });

/**
 * A `ClassFull` fixture with one student and one assignment (definitionKey 'def-1',
 * single task 't-1'). The assignment has assignmentId 'a-1' so the heatmap adapter
 * can locate it.
 */
const classFullFixture: ClassFull = {
  classId: 'class-1',
  className: 'Class A',
  cohortKey: null,
  courseLength: 1,
  yearGroupKey: null,
  classOwner: null,
  teachers: [],
  students: [
    { id: 's-1', name: 'Student One', email: 's1@test.com' },
  ],
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
        tasks: [{ taskId: 't-1', taskWeighting: 1, taskTitle: 'Task One' }],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: null,
      },
    },
  ],
  active: null,
};

/**
 * An `AveragingResult` fixture with one perStudentTaskMetric for the single
 * student and task. The metric criteria use computed values that reflect the
 * scores in the task's assessment items.
 */
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

/** A minimal `ClassPageAdapterResult` fixture for the overview render. */
const adapterResultFixture: ClassPageAdapterResult = {
  recentAssignments: [
    {
      assignmentId: 'a-1',
      assignmentName: 'Assignment One',
      lastAssessedAt: '2026-01-15T00:00:00.000Z',
      lastAssessedAtLabel: '15 Jan 2026',
      metrics: {
        completeness: COMPUTED_5,
        accuracy: COMPUTED_4,
        spag: COMPUTED_3,
        average: COMPUTED_4,
      },
    },
  ],
  studentAverages: [],
  classMetrics: {
    completeness: COMPUTED_5,
    accuracy: COMPUTED_4,
    spag: COMPUTED_3,
    overall: COMPUTED_4,
  },
};

/**
 * A minimal `AssignmentDefinitionPartial` fixture for 'def-1' so the heatmap
 * adapter can resolve task titles from the warm-up dataset.
 */
const assignmentPartialFixture = {
  definitionKey: 'def-1',
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
  tasks: [{ taskId: 't-1', taskWeighting: 1, taskTitle: 'Task One' }],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: null,
};

// ===========================================================================
// Harness component
// ===========================================================================
//
// Owns `selectedView` via `useState` and renders the REAL `ClassPageContent`
// with all the GREEN-contract props.

type HarnessProperties = Readonly<{
  initialView?: 'overview' | 'heatmap';
  assignmentId?: string;
}>;

/**
 * Test harness that owns `selectedView` state and renders the real
 * `ClassPageContent` with GREEN-contract props.
 *
 * @param {HarnessProperties} root0 - Component properties.
 * @param {'overview' | 'heatmap'} [root0.initialView='overview'] - Initial view state.
 * @param {string} [root0.assignmentId] - Assignment ID for heatmap view.
 * @returns {JSX.Element} The rendered harness.
 */
function Harness({ initialView = 'overview', assignmentId }: HarnessProperties) {
  const [selectedView, setSelectedView] = useState<{
    view: 'overview' | 'heatmap';
    assignmentId?: string;
  }>({ view: initialView, assignmentId });

  // RED-PHASE CAST: ClassPageContent does not yet accept the GREEN-contract
  // props (analyserResult, classFull, selectedView, onOpenHeatmap, onBack,
  // refetch). The cast through unknown is required so the test can be collected;
  // the suite will fail at runtime (not type-check time) because the view-state
  // wiring does not exist. This cast is removed in the GREEN phase.
  return createElement(
    ClassPageContent,
    {
      surfaceState: { status: 'ready' } as ClassPageSurfaceState,
      adapterResult: adapterResultFixture,
      analyserResult: analyserResultFixture,
      classFull: classFullFixture,
      selectedView,
      onOpenHeatmap: (id: string) => setSelectedView({ view: 'heatmap', assignmentId: id }),
      onBack: () => setSelectedView({ view: 'overview' }),
      refetch: vi.fn(),
      assignmentDefinitionPartials: [assignmentPartialFixture],
      onStartNewAssessment: vi.fn(),
      onNavigateToClasses: vi.fn(),
      onRetry: vi.fn(),
    } as unknown as Parameters<typeof ClassPageContent>[0],
  );
}

// ===========================================================================
// Tests
// ===========================================================================

describe('ClassPage heatmap view-state wiring (RED phase)', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // -----------------------------------------------------------------------
  // Open heatmap on card click
  // -----------------------------------------------------------------------

  it('opens the heatmap view when a RecentAssignmentCard is clicked', async () => {
    // RED phase: this test fails because ClassPageContent does not yet
    // accept the GREEN-contract props (selectedView, analyserResult,
    // classFull, onOpenHeatmap, onBack), so onOpenHeatmap is not threaded
    // to RecentAssignmentCard, meaning the card lacks role="button" and
    // getByRole('button', ...) throws.
    // When GREEN lands, this test passes and the assertions below verify
    // the click→heatmap contract.

    render(createElement(Harness, { initialView: 'overview' }));

    // The overview should render a RecentAssignmentCard for "Assignment One"
    // with role="button" — the card is clickable via onOpenHeatmap.
    const card = screen.getByRole('button', { name: /assignment one/i });
    expect(card).toBeInTheDocument();

    // The heatmap table must NOT be present initially.
    expect(screen.queryByLabelText('Task Heatmap')).not.toBeInTheDocument();

    // Click the card — this should call onOpenHeatmap('a-1') which sets
    // selectedView to { view: 'heatmap', assignmentId: 'a-1' }, causing
    // ClassPageContent to render TaskHeatmapPage.
    await user.click(card);

    // Assert that the TaskHeatmapTable (aria-label="Task Heatmap") is now
    // present — meaning TaskHeatmapPage rendered successfully.
    expect(screen.getByLabelText('Task Heatmap')).toBeInTheDocument();

    // The assignment name "Assignment One" should appear as a header title.
    expect(screen.getByText('Assignment One')).toBeInTheDocument();

    // The overview card should no longer be the sole content.
    // The heatmap table is present, so the card's button role is gone.
    expect(screen.queryByRole('button', { name: /assignment one/i })).not.toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Back returns to overview
  // -----------------------------------------------------------------------

  it('returns to the overview when the Back button is clicked', async () => {
    render(createElement(Harness, { initialView: 'heatmap', assignmentId: 'a-1' }));

    // The heatmap should render — the TaskHeatmapTable with aria-label="Task Heatmap"
    // and the Back button with aria-label "Back to Class overview" should be present.
    expect(screen.getByLabelText('Task Heatmap')).toBeInTheDocument();
    expect(screen.getByLabelText('Back to Class overview')).toBeInTheDocument();

    // Click the Back button.
    await user.click(screen.getByLabelText('Back to Class overview'));

    // The heatmap table should be gone.
    expect(screen.queryByLabelText('Task Heatmap')).not.toBeInTheDocument();

    // The overview should render the RecentAssignmentCard again.
    expect(screen.getByRole('button', { name: /assignment one/i })).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Unknown assignmentId auto-navigates back, no error UI
  // -----------------------------------------------------------------------

  it('auto-navigates back and logs when assignmentId is unknown, with no in-view error UI', () => {
    // Constraint: adaptMetricsToHeatmap throws on unknown assignmentId.
    // TaskHeatmapPage catches, logs via logFrontendError('TaskHeatmapPage', error),
    // and calls onBack (returning to overview). No Ant Design Alert/Result error
    // is rendered in the heatmap view.

    render(createElement(Harness, { initialView: 'heatmap', assignmentId: 'missing-id' }));

    // In RED phase this test can't reach assertions because the module won't load.
    // In GREEN, the catch-and-navigate behaviour means:
    //   - logFrontendError was called with first argument 'TaskHeatmapPage'
    //   - The heatmap table (aria-label="Task Heatmap") is NOT present
    //   - The overview card IS present (onBack returned to overview)
    //   - No in-view Alert/Result error message is shown

    // The following assertions are the GREEN-contract expectations.
    // They will only pass once TaskHeatmapPage catches the throw and calls onBack.

    expect(mockLogFrontendError).toHaveBeenCalledWith('TaskHeatmapPage', expect.any(Error));

    // The heatmap should not be visible.
    expect(screen.queryByLabelText('Task Heatmap')).not.toBeInTheDocument();

    // The overview card should be visible (returned to overview).
    expect(screen.getByRole('button', { name: /assignment one/i })).toBeInTheDocument();

    // No in-view error message should be present.
    // Ant Design Alert renders with role="alert", Result renders as a region.
    // We check for any text that suggests an in-view error.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});