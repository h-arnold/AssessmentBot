/**
 * Re-run Assessment wiring specs for the Class page (`ClassPage`).
 *
 * Covers the heatmap → modal hand-off agreed for issue #298: the Re-run
 * Assessment action placement inside the heatmap navigation card, the re-run
 * context forwarded to `AssessTaskModal`, and the unchanged manual
 * Start New Assessment entry (which must never carry a re-run context).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClassPage } from './ClassPage';
import type { ClassPageAdapterResult, RecentAssignmentCardModel } from './classPageAdapter.zod';
import {
  analyserResultFixture,
  buildDefaultAssignmentFixture,
  classFullFixture,
  VALID_ASSIGNMENT_PARTIAL,
} from '../../test/taskHeatmapPageFixtures';
import { getAccessibleButtonIndex } from '../../test/shared/buttonOrderingTestHelpers';

const CLASS_PAGE_CLASS_ID = 'class-1';
const RECENT_ASSIGNMENT_NAME = 'Assignment One';

const {
  mockUseClassPageData,
  mockAssessTaskModal,
  mockUseClassSelection,
  mockGetAssignment,
  mockStudentAveragesTableCard,
  mockTaskHeatmapTable,
} = vi.hoisted(() => ({
  mockUseClassPageData: vi.fn(),
  mockAssessTaskModal: vi.fn(function MockAssessTaskModal() {
    return createElement('div', { 'data-testid': 'assess-task-modal' });
  }),
  mockUseClassSelection: vi.fn(() => ({
    selectedClassId: 'class-1',
    className: 'Class A',
    onSelectClass: vi.fn(),
    onNavigateToClasses: vi.fn(),
  })),
  mockGetAssignment: vi.fn(),
  mockStudentAveragesTableCard: vi.fn(function MockStudentAveragesTableCard() {
    return createElement('div', { 'data-testid': 'student-averages-table-card' });
  }),
  mockTaskHeatmapTable: vi.fn(function MockTaskHeatmapTable() {
    return createElement('div', { 'data-testid': 'task-heatmap-table' });
  }),
}));

vi.mock('./useClassPageData', () => ({ useClassPageData: mockUseClassPageData }));

vi.mock('../classes/AssessTaskModal/AssessTaskModal', () => ({
  AssessTaskModal: mockAssessTaskModal,
}));

vi.mock('../../ClassSelectionContext', () => ({
  useClassSelection: mockUseClassSelection,
}));

vi.mock('../../services/assignmentAssessment/assignmentAssessmentService', () => ({
  getAssignment: mockGetAssignment,
}));

vi.mock('./StudentAveragesTableCard', () => ({
  StudentAveragesTableCard: mockStudentAveragesTableCard,
}));

vi.mock('../taskHeatmap/TaskHeatmapTable', () => ({
  TaskHeatmapTable: mockTaskHeatmapTable,
}));

/** Zero-data display metric used by the recent-assignment card fixture. */
const NO_DATA_METRIC: ClassPageAdapterResult['studentAverages'][number]['metrics']['completeness'] =
  {
    state: 'notAttempted',
    value: 'N',
    totalWeight: 0,
    applicableDataPoints: 0,
    totalDataPoints: 0,
  };

/** The recent-assignment card shown in the Class page overview. */
const RECENT_ASSIGNMENT: RecentAssignmentCardModel = {
  assignmentId: 'a-1',
  assignmentName: RECENT_ASSIGNMENT_NAME,
  lastAssessedAt: '2026-01-15T00:00:00.000Z',
  lastAssessedAtLabel: '15 Jan 2026',
  metrics: {
    completeness: NO_DATA_METRIC,
    accuracy: NO_DATA_METRIC,
    spag: NO_DATA_METRIC,
    average: NO_DATA_METRIC,
  },
};

/**
 * Builds ready-state data for the Class page backed by the shared heatmap
 * fixtures, so the heatmap view renders the real `TaskHeatmapPage`.
 *
 * @returns {object} The ready-state payload returned by the mocked data hook.
 */
function createReadyClassPageData() {
  return {
    classFull: classFullFixture,
    analyserResult: analyserResultFixture,
    assignmentDefinitionPartials: [VALID_ASSIGNMENT_PARTIAL],
    adapterResult: {
      recentAssignments: [RECENT_ASSIGNMENT],
      studentAverages: [],
      classMetrics: analyserResultFixture.perClass,
    } satisfies ClassPageAdapterResult,
    error: null,
    surfaceState: { status: 'ready' },
    refetch: vi.fn(),
  };
}

/**
 * Renders the Class page inside a React Query provider.
 *
 * @returns {void}
 */
function renderClassPage(): void {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(ClassPage, { classId: CLASS_PAGE_CLASS_ID })
    )
  );
}

/**
 * Returns the properties from the most recent `AssessTaskModal` render.
 *
 * @returns {Record<string, unknown>} The last call's properties, or an empty object.
 */
function getLastModalProperties(): Record<string, unknown> {
  const latestCall = mockAssessTaskModal.mock.calls.toReversed()[0];
  if (!latestCall) {
    return {};
  }
  return (latestCall as unknown as Array<Record<string, unknown>>)[0] ?? {};
}

/**
 * Clicks the recent-assignment card so the Class page switches to its
 * heatmap view.
 *
 * @param {ReturnType<typeof userEvent.setup>} user The user-event controller.
 * @returns {Promise<void>} Resolves once the heatmap view is active.
 */
async function openHeatmapView(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  const card = await screen.findByRole('button', { name: new RegExp(RECENT_ASSIGNMENT_NAME, 'i') });
  await user.click(card);
}

beforeEach(() => {
  mockUseClassPageData.mockImplementation(() => createReadyClassPageData());
  mockGetAssignment.mockImplementation(() => Promise.resolve(buildDefaultAssignmentFixture()));
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('ClassPage — Re-run Assessment hand-off', () => {
  it('places Re-run Assessment immediately left of Refresh in the heatmap navigation card', async () => {
    const user = userEvent.setup();
    renderClassPage();
    await openHeatmapView(user);
    await screen.findByRole('button', { name: /re-run assessment/i });

    const backIndex = getAccessibleButtonIndex('Back to Class overview');
    const reRunIndex = getAccessibleButtonIndex('Re-run Assessment');
    const refreshIndex = getAccessibleButtonIndex('Refresh');

    expect(backIndex).toBeGreaterThanOrEqual(0);
    expect(refreshIndex).toBeGreaterThan(backIndex);
    expect(reRunIndex).toBe(refreshIndex - 1);
    expect(reRunIndex).toBeGreaterThan(backIndex);
  });

  it('opens the assessment modal with the selected assignment re-run context', async () => {
    const user = userEvent.setup();
    renderClassPage();
    await openHeatmapView(user);

    const reRunButton = await screen.findByRole('button', { name: /re-run assessment/i });
    await user.click(reRunButton);

    expect(mockAssessTaskModal).toHaveBeenCalled();
    expect(getLastModalProperties().reRunContext).toEqual({
      assignmentId: 'a-1',
      definitionKey: 'def-1',
    });
  });

  it('opens the assessment modal without a re-run context from Start New Assessment', async () => {
    const user = userEvent.setup();
    renderClassPage();

    await user.click(await screen.findByRole('button', { name: /start new assessment/i }));

    expect(mockAssessTaskModal).toHaveBeenCalled();
    expect(getLastModalProperties().reRunContext ?? null).toBeNull();
  });

  it('clears the re-run context when the assessment modal is closed', async () => {
    const user = userEvent.setup();
    renderClassPage();
    await openHeatmapView(user);

    await user.click(await screen.findByRole('button', { name: /re-run assessment/i }));
    const closeModal = getLastModalProperties().onClose as () => void;
    act(() => {
      closeModal();
    });

    await user.click(await screen.findByRole('button', { name: /back to class overview/i }));
    await user.click(await screen.findByRole('button', { name: /start new assessment/i }));

    expect(getLastModalProperties().reRunContext ?? null).toBeNull();
  });
});
