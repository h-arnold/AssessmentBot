/**
 * Component tests for the select-all / select-none dropdown header (issue #342) on the
 * standalone Heatmaps selection bar.
 *
 * @remarks
 * The header is rendered by a feature-local wrapper component that does not exist during
 * the red phase. These tests therefore drive the behaviour through the real
 * `HeatmapSelectionBar` surface: importing an absent module would fail for the wrong
 * reason, whereas asserting the rendered behaviour keeps the suite valid once the green
 * wrapper lands. The contract under test is `docs/plans/SPEC.md` decision 5 and
 * `docs/plans/HEATMAP_SELECTION_LAYOUT.md`.
 *
 * A stateful harness applies the component's callbacks through the real
 * `selectionCascadeReducer`, so union, cascade and select-none outcomes are pinned as
 * observable selection state rather than as callback spies.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useReducer } from 'react';
import { renderWithFrontendProviders } from '@/test/renderWithFrontendProviders';
import { createAssignmentPartial, createDefinitionPartial } from '@/test/dataAnalysis/fixtures';
import { createHeatmapClassFull } from '@/test/dataAnalysis/heatmapFixtures';
import { createFixtureClassPartial } from '@/test/classes/classesPageTestHelpers';
import { requireElement } from '@/test/shared/domGuards';
import { HeatmapSelectionBar } from './HeatmapSelectionBar';
import { selectionCascadeReducer, type SelectionState } from './selectionCascade';
import type { AssignmentDefinitionPartial } from '@/services/assignmentDefinition/assignmentDefinitionPartials.zod';
import type { ClassFull } from '@/services/googleClassrooms/classDetail/classDetailService.zod';
import type { ClassPartial } from '@/services/googleClassrooms/classPartialsService';

/** The single class ID shared by every fixture in this suite. */
const CLASS_ID = 'class-abc-123';

/** Accessible names required by the layout spec. */
const SELECT_ALL_TOPICS = 'Select all topics';
const SELECT_NONE_TOPICS = 'Select none topics';
const SELECT_ALL_ASSIGNMENTS = 'Select all assignments';
const SELECT_NONE_ASSIGNMENTS = 'Select none assignments';

/**
 * Build one definition partial with a distinct title and topic label.
 *
 * @param {string} definitionKey - The assignment-definition key.
 * @param {string} primaryTitle - The resolved assignment title.
 * @param {string} primaryTopicKey - The resolved primary topic key.
 * @param {string} primaryTopic - The resolved primary topic label.
 * @returns {AssignmentDefinitionPartial} A partial fixture.
 */
function makePartial(
  definitionKey: string,
  primaryTitle: string,
  primaryTopicKey: string,
  primaryTopic: string
): AssignmentDefinitionPartial {
  return {
    ...createDefinitionPartial({ definitionKey, primaryTopicKey }),
    primaryTitle,
    primaryTopic,
  } as AssignmentDefinitionPartial;
}

/**
 * Build one class assignment entry.
 *
 * @param {string} assignmentId - The Classroom assignment ID.
 * @param {string} definitionKey - The assignment-definition key it resolves through.
 * @returns {ClassFull['assignments'][number]} A class-assignment fixture.
 */
function makeAssignment(
  assignmentId: string,
  definitionKey: string
): ClassFull['assignments'][number] {
  return {
    ...createAssignmentPartial({ assignmentId, definitionKey, submissions: [] }),
    updatedAt: '2025-01-01T00:00:00.000Z',
  };
}

const ASSIGNMENT_DEFINITION_PARTIALS: AssignmentDefinitionPartial[] = [
  makePartial('def-linear', 'Linear Equations', 'topic-algebra', 'Algebra'),
  makePartial('def-quadratic', 'Quadratic Equations', 'topic-algebra', 'Algebra'),
  makePartial('def-circle', 'Circle Theorems', 'topic-geometry', 'Geometry'),
  makePartial('def-triangle', 'Triangle Proofs', 'topic-geometry', 'Geometry'),
];

const CLASS_FULL: ClassFull = createHeatmapClassFull({
  assignments: [
    makeAssignment('a-linear', 'def-linear'),
    makeAssignment('a-quadratic', 'def-quadratic'),
    makeAssignment('a-circle', 'def-circle'),
    makeAssignment('a-triangle', 'def-triangle'),
  ],
});

const CLASS_PARTIALS: ClassPartial[] = [
  createFixtureClassPartial({ classId: CLASS_ID, className: 'Test Class 7A' }),
];

const SINGLE_OPTION_PARTIALS: AssignmentDefinitionPartial[] = [
  makePartial('def-solo', 'Solo Task', 'topic-solo', 'Solo Topic'),
];

const SINGLE_OPTION_CLASS_FULL: ClassFull = createHeatmapClassFull({
  assignments: [makeAssignment('a-solo', 'def-solo')],
});

type HarnessProperties = Readonly<{
  initialSelection: SelectionState;
  classFull?: ClassFull;
  partials?: AssignmentDefinitionPartial[];
}>;

/**
 * Render the selection bar with real cascade state behind its callbacks.
 *
 * @param {HarnessProperties} properties - Initial selection and optional fixtures.
 * @returns {void}
 */
function renderSelectionBar({
  initialSelection,
  classFull = CLASS_FULL,
  partials = ASSIGNMENT_DEFINITION_PARTIALS,
}: HarnessProperties): void {
  /**
   * Render the selection bar against real cascade reducer state.
   *
   * @returns {React.JSX.Element} The selection bar plus the selection probe.
   */
  function SelectionHarness(): React.JSX.Element {
    const [selection, dispatch] = useReducer(selectionCascadeReducer, initialSelection);

    return (
      <>
        <HeatmapSelectionBar
          selection={selection}
          classPartials={CLASS_PARTIALS}
          assignmentDefinitionPartials={partials}
          classFull={classFull}
          onSelectClass={(classId) => dispatch({ type: 'selectClass', classId })}
          onChangeTopics={(topicKeys, assignmentTopicKeys) =>
            dispatch({ type: 'changeTopics', topicKeys, assignmentTopicKeys })
          }
          onChangeAssignments={(assignmentIds) =>
            dispatch({ type: 'changeAssignments', assignmentIds })
          }
        />
        <div data-testid="selection-state">{JSON.stringify(selection)}</div>
      </>
    );
  }

  renderWithFrontendProviders(<SelectionHarness />);
}

/**
 * Read the current cascade selection from the harness probe.
 *
 * @returns {SelectionState} The rendered selection state.
 */
function readSelection(): SelectionState {
  const probe = requireElement(
    screen.getByTestId('selection-state'),
    'Expected the selection probe.'
  );
  return JSON.parse(probe.textContent ?? '') as SelectionState;
}

/**
 * Resolve a labelled combobox.
 *
 * @param {RegExp} name - Accessible-name pattern.
 * @returns {HTMLElement} The combobox input.
 */
function combobox(name: RegExp): HTMLElement {
  return screen.getByRole('combobox', { name });
}

/**
 * Assert a string array without depending on dispatch order.
 *
 * @param {readonly string[]} actual - The observed values.
 * @param {readonly string[]} expected - The expected values.
 * @returns {void}
 */
function expectSameValues(actual: readonly string[], expected: readonly string[]): void {
  expect(actual.toSorted((left, right) => left.localeCompare(right))).toEqual(
    expected.toSorted((left, right) => left.localeCompare(right))
  );
}

let user: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  user = userEvent.setup();
});

describe('HeatmapSelectionBar — select-all header presence', () => {
  it('renders the topics header with control-qualified accessible names when more than one topic is listed', async () => {
    renderSelectionBar({
      initialSelection: { classId: CLASS_ID, topicKeys: [], assignmentIds: [] },
    });

    await user.click(combobox(/topics/i));

    // Harness sanity: the dropdown is open and lists both topics before the header check.
    expect(screen.getByRole('option', { name: 'Algebra' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: SELECT_ALL_TOPICS })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: SELECT_NONE_TOPICS })).toBeInTheDocument();
    expect(screen.getByText('Select all')).toBeVisible();
    expect(screen.getByText('Select none')).toBeVisible();
  });

  it('renders the assignments header with control-qualified accessible names', async () => {
    renderSelectionBar({
      initialSelection: { classId: CLASS_ID, topicKeys: [], assignmentIds: [] },
    });

    await user.click(combobox(/assignments/i));

    expect(screen.getByRole('option', { name: 'Linear Equations' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: SELECT_ALL_ASSIGNMENTS })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: SELECT_NONE_ASSIGNMENTS })).toBeInTheDocument();
  });

  it('omits the header when the control lists at most one option', async () => {
    renderSelectionBar({
      initialSelection: { classId: CLASS_ID, topicKeys: [], assignmentIds: [] },
      classFull: SINGLE_OPTION_CLASS_FULL,
      partials: SINGLE_OPTION_PARTIALS,
    });

    await user.click(combobox(/topics/i));

    expect(screen.getByRole('option', { name: 'Solo Topic' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: SELECT_ALL_TOPICS })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: SELECT_NONE_TOPICS })).not.toBeInTheDocument();
    expect(screen.queryByText('Select all')).not.toBeInTheDocument();
    expect(screen.queryByText('Select none')).not.toBeInTheDocument();

    await user.keyboard('{Escape}');
    await user.click(combobox(/assignments/i));

    expect(screen.getByRole('option', { name: 'Solo Task' })).toBeInTheDocument();
    expect(
      screen.queryByRole('checkbox', { name: SELECT_ALL_ASSIGNMENTS })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: SELECT_NONE_ASSIGNMENTS })).not.toBeInTheDocument();
  });
});

describe('HeatmapSelectionBar — select all scope', () => {
  it('unions every shown assignment into the existing selection when no query is active', async () => {
    renderSelectionBar({
      initialSelection: { classId: CLASS_ID, topicKeys: [], assignmentIds: ['a-linear'] },
    });

    await user.click(combobox(/assignments/i));
    await user.click(screen.getByRole('checkbox', { name: SELECT_ALL_ASSIGNMENTS }));

    const selection = readSelection();
    expectSameValues(selection.assignmentIds, [
      'a-linear',
      'a-quadratic',
      'a-circle',
      'a-triangle',
    ]);
    expect(selection.topicKeys).toEqual([]);

    // Header activation must not close the dropdown.
    expect(screen.getByRole('option', { name: 'Circle Theorems' })).toBeInTheDocument();
  });

  it('narrows assignment select-all to the active topic cascade', async () => {
    renderSelectionBar({
      initialSelection: { classId: CLASS_ID, topicKeys: ['topic-geometry'], assignmentIds: [] },
    });

    await user.click(combobox(/assignments/i));

    expect(screen.queryByRole('option', { name: 'Linear Equations' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: SELECT_ALL_ASSIGNMENTS }));

    const selection = readSelection();
    expectSameValues(selection.assignmentIds, ['a-circle', 'a-triangle']);
    expect(selection.topicKeys).toEqual(['topic-geometry']);
  });

  it('unions only query-matching assignments and keeps the query after the header click', async () => {
    renderSelectionBar({
      initialSelection: { classId: CLASS_ID, topicKeys: [], assignmentIds: ['a-linear'] },
    });

    const assignments = combobox(/assignments/i);
    await user.click(assignments);
    await user.type(assignments, 'circle');

    expect(screen.getByRole('option', { name: 'Circle Theorems' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Triangle Proofs' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: SELECT_ALL_ASSIGNMENTS }));

    expectSameValues(readSelection().assignmentIds, ['a-linear', 'a-circle']);
    expect(assignments).toHaveValue('circle');
    expect(screen.getByRole('option', { name: 'Circle Theorems' })).toBeInTheDocument();
  });

  it('unions only query-matching topics using a case-insensitive label match', async () => {
    renderSelectionBar({
      initialSelection: { classId: CLASS_ID, topicKeys: [], assignmentIds: [] },
    });

    const topics = combobox(/topics/i);
    await user.click(topics);
    await user.type(topics, 'ALGEBRA');

    expect(screen.getByRole('option', { name: 'Algebra' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Geometry' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: SELECT_ALL_TOPICS }));

    expect(readSelection().topicKeys).toEqual(['topic-algebra']);
    expect(topics).toHaveValue('ALGEBRA');
  });

  it('clears a selected assignment whose topic drops out when all shown topics are selected', async () => {
    renderSelectionBar({
      initialSelection: { classId: CLASS_ID, topicKeys: [], assignmentIds: ['a-linear'] },
    });

    const topics = combobox(/topics/i);
    await user.click(topics);
    await user.type(topics, 'geometry');

    // Only the geometry topic is shown, so select-all narrows the active topic set to it.
    expect(screen.getByRole('option', { name: 'Geometry' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Algebra' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: SELECT_ALL_TOPICS }));

    const selection = readSelection();
    expect(selection.topicKeys).toEqual(['topic-geometry']);
    expect(selection.assignmentIds).toEqual([]);
  });
});

describe('HeatmapSelectionBar — select none', () => {
  it('clears the topic selection regardless of the query and keeps the assignment selection', async () => {
    renderSelectionBar({
      initialSelection: {
        classId: CLASS_ID,
        topicKeys: ['topic-algebra', 'topic-geometry'],
        assignmentIds: ['a-linear', 'a-circle'],
      },
    });

    const topics = combobox(/topics/i);
    await user.click(topics);
    await user.type(topics, 'algebra');
    await user.click(screen.getByRole('button', { name: SELECT_NONE_TOPICS }));

    const selection = readSelection();
    expect(selection.topicKeys).toEqual([]);
    expectSameValues(selection.assignmentIds, ['a-linear', 'a-circle']);
    expect(topics).toHaveValue('algebra');
  });

  it('clears the full assignment selection regardless of the query', async () => {
    renderSelectionBar({
      initialSelection: {
        classId: CLASS_ID,
        topicKeys: ['topic-geometry'],
        assignmentIds: ['a-linear', 'a-circle'],
      },
    });

    const assignments = combobox(/assignments/i);
    await user.click(assignments);
    await user.type(assignments, 'linear');
    await user.click(screen.getByRole('button', { name: SELECT_NONE_ASSIGNMENTS }));

    const selection = readSelection();
    expect(selection.assignmentIds).toEqual([]);
    expect(selection.topicKeys).toEqual(['topic-geometry']);
    expect(assignments).toHaveValue('linear');
  });
});

describe('HeatmapSelectionBar — select-all checkbox state', () => {
  it('is checked when every shown topic is selected', async () => {
    renderSelectionBar({
      initialSelection: {
        classId: CLASS_ID,
        topicKeys: ['topic-algebra', 'topic-geometry'],
        assignmentIds: [],
      },
    });

    await user.click(combobox(/topics/i));

    const checkbox = screen.getByRole('checkbox', { name: SELECT_ALL_TOPICS });
    expect(checkbox).toBeChecked();
    expect(checkbox).not.toBePartiallyChecked();
  });

  it('is indeterminate when only some shown topics are selected', async () => {
    renderSelectionBar({
      initialSelection: { classId: CLASS_ID, topicKeys: ['topic-algebra'], assignmentIds: [] },
    });

    await user.click(combobox(/topics/i));

    const checkbox = screen.getByRole('checkbox', { name: SELECT_ALL_TOPICS });
    expect(checkbox).toBePartiallyChecked();
    expect(checkbox).not.toBeChecked();
  });

  it('is unchecked and not indeterminate when the query matches no topics', async () => {
    renderSelectionBar({
      initialSelection: {
        classId: CLASS_ID,
        topicKeys: ['topic-algebra', 'topic-geometry'],
        assignmentIds: [],
      },
    });

    const topics = combobox(/topics/i);
    await user.click(topics);
    await user.type(topics, 'zzz');

    expect(screen.queryByRole('option')).not.toBeInTheDocument();

    const checkbox = screen.getByRole('checkbox', { name: SELECT_ALL_TOPICS });
    expect(checkbox).not.toBeChecked();
    expect(checkbox).not.toBePartiallyChecked();
  });
});
