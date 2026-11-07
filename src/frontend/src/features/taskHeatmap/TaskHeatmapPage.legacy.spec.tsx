/**
 * Assignment status tag on the Task Heatmap navigation card.
 *
 * Pins the `'legacy'` read marker behaviour described in
 * `LEGACY_ASSIGNMENT_READ_LAYOUT.md`: the tag follows the selected assignment
 * in the loaded class response, appears only in the normal navigation card,
 * carries no interaction, and survives full-preview loading and failure.
 *
 * Fixtures validate the committed canonical `small` class and assignment
 * records against their transport schemas, deep-freeze them, and clone per
 * test, changing only the selected assignment's marker so real scores and
 * content are retained. The definition partial is derived from the same
 * canonical assignment, so the page resolves task titles and renders its
 * normal navigation and table.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { App } from 'antd';
import { QueryClientProvider } from '@tanstack/react-query';
import smallClassesRaw from '@synthetic/small/classesById.json?raw';
import smallAssignmentsRaw from '@synthetic/small/assignmentsByKey.json?raw';
import { mockGetAssignment, mockTaskHeatmapTable } from '@/test/taskHeatmapPageMocks';
import { analyserResultFixture } from '@/test/taskHeatmapPageFixtures';
import { createTestQueryClient } from '@/test/dataAnalysis/heatmapFixtures';
import { deepFreeze, requireRecord } from '@/test/shared/canonicalFixturePrimitives';
import { AssignmentFullSchema } from '@/services/assignmentAssessment/assignmentAssessment.zod';
import type { AssignmentFull } from '@/services/assignmentAssessment/assignmentAssessment.zod';
import { AssignmentDefinitionPartialSchema } from '@/services/assignmentDefinition/assignmentDefinitionPartials.zod';
import type { AssignmentDefinitionPartial } from '@/services/assignmentDefinition/assignmentDefinitionPartials.zod';
import { ClassFullSchema } from '@/services/googleClassrooms/classDetail/classDetailService.zod';
import type { ClassFull } from '@/services/googleClassrooms/classDetail/classDetailService.zod';
import { queryKeys } from '@/query/queryKeys';
import { TaskHeatmapPage } from './TaskHeatmapPage';

const LEGACY_TAG_TEXT = 'Reassessment required';
const SELECTED_ASSIGNMENT_ID = 'assignment-0-1';
const CANONICAL_CLASS_ID = 'class-0';

const classesById = JSON.parse(smallClassesRaw) as Record<string, unknown>;
const assignmentsByKey = JSON.parse(smallAssignmentsRaw) as Record<string, unknown>;

/** Canonical `class-0` roster, validated against `ClassFullSchema`. */
const CANONICAL_CLASS: ClassFull = deepFreeze(
  ClassFullSchema.parse(requireRecord(classesById, CANONICAL_CLASS_ID, 'classesById'))
);

/** Canonical selected assignment, validated against `AssignmentFullSchema`. */
const CANONICAL_ASSIGNMENT: AssignmentFull = deepFreeze(
  AssignmentFullSchema.parse(
    requireRecord(assignmentsByKey, SELECTED_ASSIGNMENT_ID, 'assignmentsByKey')
  )
);

/** The title-error navigation card keeps only the Back action. */
const NAV_BACK_ONLY_ACTION_COUNT = 1;

/** Optional render inputs: definition partials and the rerun-callback switch. */
type RenderOptions = Readonly<{
  partials?: AssignmentDefinitionPartial[];
  withReRunCallback?: boolean;
}>;

/**
 * Derive the definition partial for the canonical selected assignment, the same
 * projection the backend emits for its full definition.
 * @returns {AssignmentDefinitionPartial} The partial whose key and tasks match the assignment.
 */
function buildCanonicalPartial(): AssignmentDefinitionPartial {
  const definition = CANONICAL_ASSIGNMENT.assignmentDefinition;
  const partial: Record<string, unknown> = {
    primaryTitle: definition.primaryTitle,
    primaryTopic: definition.primaryTopic,
    primaryTopicKey: definition.primaryTopicKey,
    yearGroupKey: definition.yearGroupKey,
    yearGroupLabel: definition.yearGroupLabel,
    alternateTitles: definition.alternateTitles,
    alternateTopics: definition.alternateTopics,
    documentType: definition.documentType,
    referenceDocumentId: definition.referenceDocumentId,
    templateDocumentId: definition.templateDocumentId,
    assignmentWeighting: definition.assignmentWeighting,
    definitionKey: definition.definitionKey,
    tasks: Object.values(definition.tasks).map((task) => {
      return {
        taskId: task.id,
        taskWeighting: task.taskWeighting,
        taskTitle: task.taskTitle,
      };
    }),
    createdAt: definition.createdAt,
    updatedAt: definition.updatedAt,
  };
  return AssignmentDefinitionPartialSchema.parse(partial);
}

/** Definition partial derived from the canonical assignment, validated against its schema. */
const CANONICAL_PARTIAL: AssignmentDefinitionPartial = deepFreeze(buildCanonicalPartial());

/**
 * Clone the canonical class and set the selected assignment's read marker.
 * @param {'legacy' | 1} marker - The read marker to apply to the selected assignment.
 * @returns {ClassFull} A detached class view with only that marker changed.
 */
function buildClassWithMarker(marker: 'legacy' | 1): ClassFull {
  const clone = structuredClone(CANONICAL_CLASS);
  const assignment = clone.assignments.find(
    (entry) => entry.assignmentId === SELECTED_ASSIGNMENT_ID
  );
  if (!assignment) throw new Error(`Canonical ${SELECTED_ASSIGNMENT_ID} is missing`);
  assignment.assessmentContractVersion = marker;
  return clone;
}

/**
 * Clone the canonical full assignment for the selected assignment.
 * @returns {AssignmentFull} A detached full assignment read.
 */
function buildCanonicalAssignmentFixture(): AssignmentFull {
  return structuredClone(CANONICAL_ASSIGNMENT);
}

/**
 * Render the page with the canonical class fixture and an isolated query client.
 * @param {ClassFull} classFull - The class view supplied to the page.
 * @param {RenderOptions} [options] - Definition partials and the rerun-callback switch.
 * @returns {ReturnType<typeof createTestQueryClient>} The rendered query client.
 */
function renderPage(classFull: ClassFull, options: RenderOptions = {}) {
  const queryClient = createTestQueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <App>
        <TaskHeatmapPage
          analyserResult={analyserResultFixture}
          classFull={classFull}
          assignmentId={SELECTED_ASSIGNMENT_ID}
          assignmentDefinitionPartials={options.partials ?? [CANONICAL_PARTIAL]}
          onBack={vi.fn()}
          refetch={vi.fn()}
          onReRunAssessment={options.withReRunCallback === false ? undefined : vi.fn()}
        />
      </App>
    </QueryClientProvider>
  );
  return queryClient;
}

/**
 * Resolve the navigation card that owns the Back action.
 * @returns {HTMLElement} The navigation card element.
 */
function navigationCard(): HTMLElement {
  const back = screen.getByRole('button', { name: 'Back to Class overview' });
  const card = back.closest('.ant-card');
  if (!(card instanceof HTMLElement)) throw new TypeError('Navigation card is missing');
  return card;
}

/**
 * List the navigation card's buttons and status tag in document order, so the
 * tag's placement between actions is pinned without depending on geometry.
 * @param {HTMLElement} card - The navigation card.
 * @returns {string[]} Accessible text in document order.
 */
function navActionOrder(card: HTMLElement): string[] {
  return [...card.querySelectorAll('button, .ant-tag')].map((element) => element.textContent ?? '');
}

/**
 * Assert the page is in its normal state: table rendered and Back, Re-run and Refresh present.
 * @returns {Promise<void>} Resolves once the rendered table is found.
 */
async function expectNormalNavigation(): Promise<void> {
  await screen.findByTestId('task-heatmap-table');
  const card = navigationCard();
  expect(within(card).getByRole('button', { name: 'Re-run Assessment' })).toBeInTheDocument();
  expect(within(card).getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
}

beforeEach(() => {
  mockGetAssignment.mockImplementation(() => Promise.resolve(buildCanonicalAssignmentFixture()));
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('TaskHeatmapPage — legacy reassessment tag', () => {
  it('shows the non-dismissible warning tag in the navigation card for a legacy selection', async () => {
    renderPage(buildClassWithMarker('legacy'));
    await expectNormalNavigation();

    const tag = within(navigationCard()).getByText(LEGACY_TAG_TEXT);
    expect(tag).toHaveClass('ant-tag');
    expect(tag).toHaveClass('ant-tag-warning');
    expect(tag).toHaveStyle({ margin: '0px' });
    expect(tag.querySelector('.ant-tag-close-icon')).toBeNull();
    expect(navActionOrder(navigationCard())).toEqual([
      'Back to Class overview',
      LEGACY_TAG_TEXT,
      'Re-run Assessment',
      'Refresh',
    ]);
  });

  it('omits the tag for a current selection', async () => {
    renderPage(buildClassWithMarker(1));
    await expectNormalNavigation();

    expect(mockTaskHeatmapTable).toHaveBeenCalled();
    // Whole-screen absence is safe here: the canonical corpus carries no
    // reassessment reasoning, so no preview or stored error shares the tag text.
    expect(screen.queryByText(LEGACY_TAG_TEXT)).toBeNull();
  });

  it('keeps the title-error navigation Back-only with no tag', async () => {
    renderPage(buildClassWithMarker('legacy'), { partials: [] });

    await screen.findByRole('alert');
    const card = navigationCard();
    expect(within(card).queryByText(LEGACY_TAG_TEXT)).toBeNull();
    expect(within(card).queryByRole('button', { name: 'Re-run Assessment' })).toBeNull();
    expect(within(card).queryByRole('button', { name: 'Refresh' })).toBeNull();
    expect(within(card).getAllByRole('button')).toHaveLength(NAV_BACK_ONLY_ACTION_COUNT);
  });

  it('renders the tag as static text with no button or interactive role', async () => {
    renderPage(buildClassWithMarker('legacy'));
    await expectNormalNavigation();

    const tag = within(navigationCard()).getByText(LEGACY_TAG_TEXT);
    expect(tag.closest('button')).toBeNull();
    expect(tag.closest('a')).toBeNull();
    expect(tag).not.toHaveAttribute('role');
    expect(tag).not.toHaveAttribute('tabindex');
    expect(within(navigationCard()).queryByRole('button', { name: LEGACY_TAG_TEXT })).toBeNull();
  });

  it('keeps the tag while the full preview is loading', async () => {
    mockGetAssignment.mockImplementation(() => new Promise(() => {}));
    renderPage(buildClassWithMarker('legacy'));
    await expectNormalNavigation();

    expect(within(navigationCard()).getByText(LEGACY_TAG_TEXT)).toBeInTheDocument();
    expect(mockGetAssignment).toHaveBeenCalled();
  });

  it('keeps the tag when the full preview fails', async () => {
    mockGetAssignment.mockImplementation(() =>
      Promise.reject(new Error('Preview transport failure'))
    );
    const queryClient = renderPage(buildClassWithMarker('legacy'));
    await expectNormalNavigation();

    expect(within(navigationCard()).getByText(LEGACY_TAG_TEXT)).toBeInTheDocument();
    await waitFor(() => {
      const state = queryClient.getQueryState(
        queryKeys.assignment(CANONICAL_CLASS_ID, SELECTED_ASSIGNMENT_ID)
      );
      expect(state).toMatchObject({ status: 'error' });
    });
    expect(within(navigationCard()).getByText(LEGACY_TAG_TEXT)).toBeInTheDocument();
  });

  it('keeps the tag before Refresh when no rerun callback is supplied', async () => {
    renderPage(buildClassWithMarker('legacy'), { withReRunCallback: false });
    await screen.findByTestId('task-heatmap-table');

    const card = navigationCard();
    expect(within(card).getByText(LEGACY_TAG_TEXT)).toBeInTheDocument();
    expect(navActionOrder(card)).toEqual(['Back to Class overview', LEGACY_TAG_TEXT, 'Refresh']);
  });
});
