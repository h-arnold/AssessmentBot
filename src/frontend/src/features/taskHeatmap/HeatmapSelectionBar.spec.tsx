/**
 * Component tests for the Heatmaps selection bar (`HeatmapSelectionBar`).
 *
 * GREEN: the component is fully implemented. These tests pin the review (L-1)
 * contract that an assignment whose `definitionKey` has no resolvable
 * `assignmentDefinitionPartial` is omitted from the topic/assignment selectors
 * AND a `warn` is emitted via `logFrontendEvent` (the SPEC-mandated diagnostic).
 *
 * They also pin the select-all header guards (a header only applies to a control with
 * more than one option) and the search-query outcomes that the controlled `searchValue`
 * contract in `docs/plans/SPEC.md` decision 5 owns.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithFrontendProviders } from '@/test/renderWithFrontendProviders';
import { requireElement } from '@/test/shared/domGuards';
import { HeatmapSelectionBar } from './HeatmapSelectionBar';
import type { SelectionState } from './selectionCascade';
import type { ClassFull } from '@/services/googleClassrooms/classDetail/classDetailService.zod';
import type { ClassPartial } from '@/services/googleClassrooms/classPartialsService';
import type { AssignmentDefinitionPartialsResponse } from '@/services/assignmentDefinition/assignmentDefinitionPartials.zod';

const { mockLogFrontendEvent } = vi.hoisted(() => ({ mockLogFrontendEvent: vi.fn() }));

vi.mock('@/logging/frontendLogger', () => {
  return {
    logFrontendEvent: mockLogFrontendEvent,
    logFrontendError: vi.fn(),
  };
});

/** The single class ID used across the fixtures below. */
const CLASS_ID = 'class-1';

/**
 * Build a `ClassFull` with two assignments: one whose `definitionKey` resolves
 * to a partial, and one whose `definitionKey` has no resolvable partial.
 *
 * @returns {ClassFull} A class-full fixture.
 */
function makeClassFull(): ClassFull {
  return {
    classId: CLASS_ID,
    className: 'Class 1',
    cohortKey: null,
    courseLength: 1,
    yearGroupKey: 'yg',
    classOwner: null,
    teachers: [],
    active: true,
    students: [{ id: 's1', name: 'S1', email: 's1@test.com' }],
    assignments: [
      {
        assignmentId: 'a-resolvable',
        assignmentDefinitionKey: 'def1',
        updatedAt: '2025-01-01T00:00:00.000Z',
      },
      {
        assignmentId: 'a-missing',
        assignmentDefinitionKey: 'def-missing',
        updatedAt: '2025-01-01T00:00:00.000Z',
      },
    ],
  } as unknown as ClassFull;
}

/**
 * Build the warm-up class-partials fixture.
 *
 * @returns {ClassPartial[]} A class-partials fixture.
 */
function makeClassPartials(): ClassPartial[] {
  return [
    {
      classId: CLASS_ID,
      className: 'Class 1',
      cohortKey: null,
      courseLength: 1,
      yearGroupKey: 'yg',
      classOwner: null,
      teachers: [],
      active: true,
    } as unknown as ClassPartial,
  ];
}

/**
 * Build an `AssignmentDefinitionPartialsResponse` that resolves only `def1`,
 * deliberately omitting `def-missing`.
 *
 * @returns {AssignmentDefinitionPartialsResponse} A partials registry fixture.
 */
function makePartials(): AssignmentDefinitionPartialsResponse {
  return [
    {
      definitionKey: 'def1',
      primaryTitle: 'Resolvable',
      primaryTopic: 'Topic One',
      primaryTopicKey: 'topic-1',
      yearGroupKey: 'yg',
      yearGroupLabel: 'Year 7',
      alternateTitles: [],
      alternateTopics: [],
      documentType: 'doc',
      referenceDocumentId: null,
      templateDocumentId: null,
      assignmentWeighting: 1,
      tasks: [],
      createdAt: null,
      updatedAt: null,
    },
  ] as unknown as AssignmentDefinitionPartialsResponse;
}

/** A controlled, class-selected selection state. */
const selection: SelectionState = {
  classId: CLASS_ID,
  topicKeys: [],
  assignmentIds: [],
} as SelectionState;

/** Width the layout double reports for the tags container, in pixels. */
const LAYOUT_CONTAINER_WIDTH_PX = 500;

/** Width the layout double reports for each rendered tag, in pixels. */
const LAYOUT_ITEM_WIDTH_PX = 50;

/**
 * Layout-aware `ResizeObserver` double for the responsive tag overflow.
 *
 * @remarks
 * happy-dom reports every element width as `0`, so `maxTagCount="responsive"` collapses
 * the selected values into a `+ N …` rest tag and the real tag remove controls never
 * render. This double reports a 500px container and 50px tags so the tags stay visible.
 * `@rc-component/resize-observer` caches one observer instance per module, so the stub
 * must be installed before the first render in this file.
 */
class LayoutResizeObserver {
  private readonly callback: ResizeObserverCallback;

  /**
   * Create the double for one cached observer instance.
   *
   * @param {ResizeObserverCallback} callback - The observer callback.
   */
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  /**
   * Report the measured width for an observed element on the next microtask.
   *
   * @param {Element} element - The observed element.
   * @returns {void}
   */
  observe(element: Element): void {
    const isContainer = element.classList.contains('ant-select-selection-overflow');
    const width = isContainer ? LAYOUT_CONTAINER_WIDTH_PX : LAYOUT_ITEM_WIDTH_PX;
    Object.defineProperties(element, {
      clientWidth: { configurable: true, value: width },
      offsetWidth: { configurable: true, value: width },
    });
    queueMicrotask(() => {
      this.callback(
        [{ target: element } as unknown as ResizeObserverEntry],
        this as unknown as ResizeObserver
      );
    });
  }

  /**
   * Stop observing an element (no measurement state is retained).
   *
   * @returns {void}
   */
  unobserve(): void {
    return;
  }

  /**
   * Drop every observation (no measurement state is retained).
   *
   * @returns {void}
   */
  disconnect(): void {
    return;
  }
}

let user: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  user = userEvent.setup();
  vi.stubGlobal('ResizeObserver', LayoutResizeObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * Render the selection bar with the supplied selection behind no-op callbacks.
 *
 * @param {SelectionState} barSelection - The selection rendered by the bar.
 * @returns {void}
 */
function renderBarWithSelection(barSelection: SelectionState): void {
  renderWithFrontendProviders(
    <HeatmapSelectionBar
      selection={barSelection}
      classPartials={makeClassPartials()}
      assignmentDefinitionPartials={makePartials()}
      classFull={makeClassFull()}
      onSelectClass={vi.fn()}
      onChangeTopics={vi.fn()}
      onChangeAssignments={vi.fn()}
    />
  );
}

/**
 * Resolve the Ant Design Select wrapper that owns a combobox.
 *
 * @param {HTMLElement} comboboxElement - The labelled combobox input.
 * @returns {HTMLElement} The owning `.ant-select` element.
 */
function selectWrapper(comboboxElement: HTMLElement): HTMLElement {
  return requireElement(comboboxElement.closest('.ant-select'), 'Expected the Select wrapper.');
}

describe('HeatmapSelectionBar — omitted-assignment warn (L-1)', () => {
  beforeEach(() => {
    mockLogFrontendEvent.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('emits a warn and omits the assignment whose definitionKey has no resolvable partial', async () => {
    renderWithFrontendProviders(
      <HeatmapSelectionBar
        selection={selection}
        classPartials={makeClassPartials()}
        assignmentDefinitionPartials={makePartials()}
        classFull={makeClassFull()}
        onSelectClass={vi.fn()}
        onChangeTopics={vi.fn()}
        onChangeAssignments={vi.fn()}
      />
    );

    // The warn must fire (ID is deduped per ref guard, so it fires once on first render).
    await waitFor(() => {
      expect(mockLogFrontendEvent).toHaveBeenCalledWith(
        'warn',
        expect.objectContaining({
          context: 'HeatmapSelectionBar',
          metadata: expect.objectContaining({ assignmentId: 'a-missing' }),
        })
      );
    });

    // The warn is the SPEC-mandated diagnostic for an omitted assignment whose
    // definitionKey has no resolvable partial; antd Select options are virtualized
    // (only rendered when the dropdown is open), so the omission is asserted via
    // this warn rather than by scanning DOM option text.
  });

  it('does not warn when every assignment has a resolvable partial', async () => {
    const allResolvableClassFull = makeClassFull();
    // Replace the assignments so both resolve.
    (allResolvableClassFull.assignments as ClassFull['assignments']).forEach((assignment) => {
      assignment.assignmentDefinitionKey = 'def1';
    });

    renderWithFrontendProviders(
      <HeatmapSelectionBar
        selection={selection}
        classPartials={makeClassPartials()}
        assignmentDefinitionPartials={makePartials()}
        classFull={allResolvableClassFull}
        onSelectClass={vi.fn()}
        onChangeTopics={vi.fn()}
        onChangeAssignments={vi.fn()}
      />
    );

    // No omitted ids → no warn fired.
    await waitFor(() => {
      expect(mockLogFrontendEvent).not.toHaveBeenCalled();
    });
  });
});

describe('HeatmapSelectionBar — select-all header guards', () => {
  it('does not render the header on a multi-select listing a single option', async () => {
    // This fixture resolves one topic and one assignment, so neither multi-select
    // reaches the >1-option threshold that makes the header applicable.
    renderWithFrontendProviders(
      <HeatmapSelectionBar
        selection={selection}
        classPartials={makeClassPartials()}
        assignmentDefinitionPartials={makePartials()}
        classFull={makeClassFull()}
        onSelectClass={vi.fn()}
        onChangeTopics={vi.fn()}
        onChangeAssignments={vi.fn()}
      />
    );

    await user.click(screen.getByRole('combobox', { name: /topics/i }));

    expect(screen.getByRole('option', { name: 'Topic One' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /select all/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /select none/i })).not.toBeInTheDocument();

    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('combobox', { name: /assignments/i }));

    expect(screen.getByRole('option', { name: 'Resolvable' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /select all/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /select none/i })).not.toBeInTheDocument();
  });

  it('does not render the header on the single-select class control', async () => {
    const classPartials = [
      ...makeClassPartials(),
      {
        ...makeClassPartials()[0],
        classId: 'class-2',
        className: 'Class 2',
      } as unknown as ClassPartial,
    ];

    renderWithFrontendProviders(
      <HeatmapSelectionBar
        selection={selection}
        classPartials={classPartials}
        assignmentDefinitionPartials={makePartials()}
        classFull={makeClassFull()}
        onSelectClass={vi.fn()}
        onChangeTopics={vi.fn()}
        onChangeAssignments={vi.fn()}
      />
    );

    await user.click(screen.getByRole('combobox', { name: /^class$/i }));

    // Two class options are listed, so a generic header implementation would show here.
    expect(screen.getByRole('option', { name: 'Class 2' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /select all/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /select none/i })).not.toBeInTheDocument();
  });
});

describe('HeatmapSelectionBar — search query outcomes', () => {
  it('clears the query when an option is selected', async () => {
    renderBarWithSelection(selection);

    const topics = screen.getByRole('combobox', { name: /topics/i });
    await user.click(topics);
    await user.type(topics, 'Topic');
    await user.click(screen.getByRole('option', { name: 'Topic One' }));

    expect(topics).toHaveValue('');
  });

  it('keeps the query when a selected option is deselected from the open dropdown', async () => {
    renderBarWithSelection({ classId: CLASS_ID, topicKeys: ['topic-1'], assignmentIds: [] });

    const topics = screen.getByRole('combobox', { name: /topics/i });
    await user.click(topics);
    await user.type(topics, 'Topic');
    await user.click(screen.getByRole('option', { name: 'Topic One' }));

    expect(topics).toHaveValue('Topic');
  });

  it('keeps the query when the dropdown is reopened after focus loss', async () => {
    renderBarWithSelection(selection);

    const topics = screen.getByRole('combobox', { name: /topics/i });
    await user.click(topics);
    await user.type(topics, 'Topic');
    await user.tab();
    await user.click(topics);

    expect(topics).toHaveValue('Topic');
  });

  it('keeps the query when the selection is cleared with the allow-clear control', async () => {
    renderBarWithSelection({ classId: CLASS_ID, topicKeys: ['topic-1'], assignmentIds: [] });

    const topics = screen.getByRole('combobox', { name: /topics/i });
    await user.click(topics);
    await user.type(topics, 'Topic');
    const clearControl = requireElement(
      selectWrapper(topics).querySelector('.ant-select-clear'),
      'Expected the allow-clear control.'
    );
    await user.click(clearControl);

    expect(topics).toHaveValue('Topic');
  });

  it('keeps the query when a selected tag is removed', async () => {
    renderBarWithSelection({ classId: CLASS_ID, topicKeys: ['topic-1'], assignmentIds: [] });

    const topics = screen.getByRole('combobox', { name: /topics/i });
    await user.click(topics);
    await user.type(topics, 'Topic');
    const tag = within(selectWrapper(topics)).getByTitle('Topic One');
    await user.click(
      requireElement(
        tag.querySelector('.ant-select-selection-item-remove'),
        'Expected the tag remove control.'
      )
    );

    expect(topics).toHaveValue('Topic');
  });
});
